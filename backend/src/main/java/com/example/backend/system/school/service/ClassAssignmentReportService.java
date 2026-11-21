package com.example.backend.system.school.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.enums.PermissionCode;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.school.model.entity.SchoolClass;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** Class report keeps historical recipients and final hand-ins; no per-assignment/entity queries. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class ClassAssignmentReportService {
    private final SchoolClassGradeService grades;
    private final CurrentUserService currentUser;
    private final NamedParameterJdbcTemplate jdbc;
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    public record Totals(long assignments, long recipients, long submitted, long notSubmitted, long late,
                         long awaitingGrade, long confirmed, long missedDeadline, BigDecimal average10, BigDecimal submissionRate) { }
    public record Row(UUID id, String title, String assignedBy, String status, Instant assignedAt, Instant dueAt,
                      long recipients, long submitted, long notSubmitted, long late, long awaitingGrade,
                      long confirmed, long missedDeadline, BigDecimal average10) { }
    public record Page(UUID classId, String className, String schoolYear, Instant asOf, Totals summary,
                       List<Row> items, int page, int size, int totalPages, long totalElements) { }

    // UNION retains an old submission even if its recipient entry was removed by a historical transfer.
    static final String REPORT_SQL = """
        WITH lessons AS (
          SELECT a.*, coalesce(u.full_name, '') AS assigned_by FROM assignments a
          JOIN users u ON u.id = a.teacher_id
          WHERE a.school_class_id = :classId AND (:status = 'ALL' OR a.status = :status)
            AND strpos(lower(a.title), :query) > 0 AND a.assigned_at >= :from AND a.assigned_at < :until
        ), recipients AS (
          SELECT r.assignment_id, r.student_id FROM assignment_students r JOIN lessons a ON a.id = r.assignment_id
          UNION
          SELECT s.assignment_id, s.student_id FROM assignment_submissions s JOIN lessons a ON a.id = s.assignment_id
        ), facts AS (
          SELECT r.assignment_id, s.completed_at, s.score, coalesce(s.max_score, a.max_score) AS max_score,
            coalesce(s.retry_allowed, false) AS returned, s.grading_status, a.due_at,
            (NOT a.allow_late_submission AND a.due_at <= :now AND s.completed_at IS NULL) AS missed
          FROM recipients r JOIN lessons a ON a.id = r.assignment_id
          LEFT JOIN assignment_submissions s ON s.assignment_id = r.assignment_id AND s.student_id = r.student_id
        ), counts AS (
          SELECT assignment_id, count(*) AS recipients,
            count(*) FILTER (WHERE completed_at IS NOT NULL AND NOT returned) AS submitted,
            count(*) FILTER (WHERE completed_at IS NOT NULL AND NOT returned AND completed_at > due_at) AS late,
            count(*) FILTER (WHERE completed_at IS NOT NULL AND NOT returned
              AND (score IS NULL OR grading_status IS DISTINCT FROM 'TEACHER_CONFIRMED')) AS awaiting_grade,
            count(*) FILTER (WHERE completed_at IS NOT NULL AND NOT returned AND score IS NOT NULL
              AND grading_status = 'TEACHER_CONFIRMED') AS confirmed,
            count(*) FILTER (WHERE missed) AS missed_deadline,
            count(*) FILTER (WHERE missed OR (completed_at IS NOT NULL AND NOT returned AND score IS NOT NULL
              AND grading_status = 'TEACHER_CONFIRMED' AND max_score > 0)) AS score_count,
            coalesce(sum(CASE WHEN missed THEN 0 WHEN completed_at IS NOT NULL AND NOT returned
              AND grading_status = 'TEACHER_CONFIRMED' AND score IS NOT NULL AND max_score > 0
              THEN score * 10 / max_score ELSE 0 END), 0) AS score_total
          FROM facts GROUP BY assignment_id
        ), report AS (
          SELECT a.id, a.title, a.assigned_by, a.status, a.assigned_at, a.due_at,
            coalesce(c.recipients, 0) AS recipients, coalesce(c.submitted, 0) AS submitted,
            coalesce(c.recipients, 0) - coalesce(c.submitted, 0) AS not_submitted,
            coalesce(c.late, 0) AS late, coalesce(c.awaiting_grade, 0) AS awaiting_grade,
            coalesce(c.confirmed, 0) AS confirmed, coalesce(c.missed_deadline, 0) AS missed_deadline,
            coalesce(c.score_count, 0) AS score_count, coalesce(c.score_total, 0) AS score_total
          FROM lessons a LEFT JOIN counts c ON c.assignment_id = a.id
        )
        """;
    private record Context(SchoolClass classroom, Map<String, Object> parameters, Instant now) { }
    private Context prepare(UUID classId, String query, String status, LocalDate from, LocalDate to) {
        var actor = currentUser.requireCurrentUser();
        if (actor.getRole() == null || !"STAFF".equals(actor.getRole().getName()) || actor.getSchool() == null
                || !Boolean.TRUE.equals(actor.getActive()) || actor.isSuspendedReadOnly() || !actor.hasPermission(PermissionCode.TEACH))
            throw ApiException.forbidden("Bạn không có quyền xem báo cáo giảng dạy.");
        var classroom = grades.authorize(actor.getSchool().getId(), classId);
        if (!Set.of("ALL", "ACTIVE", "CLOSED").contains(status)) throw ApiException.badRequest("Trạng thái bài tập không hợp lệ.");
        if (query == null || query.length() > 160) throw ApiException.badRequest("Từ khóa tối đa 160 ký tự.");
        if ((from != null && (from.getYear() < 1900 || from.getYear() > 9998))
                || (to != null && (to.getYear() < 1900 || to.getYear() > 9998)) || (from != null && to != null && from.isAfter(to)))
            throw ApiException.badRequest("Khoảng ngày giao bài không hợp lệ.");
        Instant now = Instant.now();
        Map<String, Object> p = new HashMap<>(); p.put("classId", classId); p.put("status", status);
        p.put("query", query.trim().toLowerCase(Locale.ROOT)); p.put("now", Timestamp.from(now));
        p.put("from", Timestamp.from(from == null ? Instant.parse("1900-01-01T00:00:00Z") : from.atStartOfDay(ZONE).toInstant()));
        p.put("until", Timestamp.from(to == null ? Instant.parse("9999-12-31T00:00:00Z") : to.plusDays(1).atStartOfDay(ZONE).toInstant()));
        return new Context(classroom, p, now);
    }
    public Page page(UUID classId, String query, String status, LocalDate from, LocalDate to, int page, int size) {
        Context ctx = prepare(classId, query, status, from, to);
        Totals totals = jdbc.queryForObject(REPORT_SQL + """
            SELECT count(*) AS assignments, coalesce(sum(recipients),0) AS recipients,
              coalesce(sum(submitted),0) AS submitted, coalesce(sum(not_submitted),0) AS not_submitted,
              coalesce(sum(late),0) AS late, coalesce(sum(awaiting_grade),0) AS awaiting_grade,
              coalesce(sum(confirmed),0) AS confirmed, coalesce(sum(missed_deadline),0) AS missed_deadline,
              coalesce(sum(score_count),0) AS score_count, coalesce(sum(score_total),0) AS score_total FROM report
            """, ctx.parameters(), (rs, index) -> new Totals(rs.getLong("assignments"), rs.getLong("recipients"), rs.getLong("submitted"),
                rs.getLong("not_submitted"), rs.getLong("late"), rs.getLong("awaiting_grade"), rs.getLong("confirmed"), rs.getLong("missed_deadline"),
                average(rs.getBigDecimal("score_total"), rs.getLong("score_count")), percent(rs.getLong("submitted"), rs.getLong("recipients"))));
        size = Math.clamp(size, 1, 50); int pages = Math.max(1, (int) Math.ceil((double) totals.assignments() / size));
        page = Math.clamp(page, 0, pages - 1); ctx.parameters().put("limit", size); ctx.parameters().put("offset", (long) page * size);
        List<Row> rows = totals.assignments() == 0 ? List.of() : jdbc.query(REPORT_SQL + "SELECT * FROM report ORDER BY assigned_at DESC, id DESC LIMIT :limit OFFSET :offset", ctx.parameters(), ROW);
        return new Page(classId, ctx.classroom().getName(), ctx.classroom().getSchoolYear(), ctx.now(), totals, rows, page, size, pages, totals.assignments());
    }
    static BigDecimal average(BigDecimal total, long count) { return count == 0 ? null : total.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP); }
    static BigDecimal percent(long submitted, long recipients) { return recipients == 0 ? null : BigDecimal.valueOf(submitted * 100).divide(BigDecimal.valueOf(recipients), 1, RoundingMode.HALF_UP); }
    private static Instant instant(ResultSet rs, String name) throws SQLException { Timestamp time = rs.getTimestamp(name); return time == null ? null : time.toInstant(); }
    static final RowMapper<Row> ROW = (rs, index) -> new Row(rs.getObject("id", UUID.class), rs.getString("title"), rs.getString("assigned_by"), rs.getString("status"), instant(rs,"assigned_at"), instant(rs,"due_at"),
        rs.getLong("recipients"), rs.getLong("submitted"), rs.getLong("not_submitted"), rs.getLong("late"), rs.getLong("awaiting_grade"), rs.getLong("confirmed"), rs.getLong("missed_deadline"), average(rs.getBigDecimal("score_total"), rs.getLong("score_count")));

    public byte[] csv(UUID classId, String query, String status, LocalDate from, LocalDate to) {
        Context ctx = prepare(classId, query, status, from, to);
        StringBuilder csv = new StringBuilder("\uFEFF");
        csvRow(csv, "Lớp", "Năm học", "Bài tập", "Người giao", "Ngày giao", "Hạn nộp", "Trạng thái", "Được giao", "Đã nộp", "Chưa nộp", "Nộp trễ", "Chờ chấm", "Đã chấm", "Quá hạn 0 điểm", "Điểm TB /10");
        jdbc.query(REPORT_SQL + "SELECT * FROM report ORDER BY assigned_at DESC, id DESC", ctx.parameters(), (org.springframework.jdbc.core.RowCallbackHandler) rs -> {
            Row row = ROW.mapRow(rs, 0);
            csvRow(csv, ctx.classroom().getName(), ctx.classroom().getSchoolYear(), row.title(), row.assignedBy(), time(row.assignedAt()), time(row.dueAt()), "ACTIVE".equals(row.status()) ? "Đang mở" : "Đã đóng",
                row.recipients(), row.submitted(), row.notSubmitted(), row.late(), row.awaitingGrade(), row.confirmed(), row.missedDeadline(), row.average10());
        });
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }
    private static String time(Instant value) { return value == null ? "" : DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(ZONE).format(value); }
    static void csvRow(StringBuilder out, Object... values) { out.append(Arrays.stream(values).map(value -> {
        String text = Objects.toString(value, ""); String leading = text.stripLeading();
        if ((!text.isEmpty() && "\t\r\n".indexOf(text.charAt(0)) >= 0) || (!leading.isEmpty() && "=+-@".indexOf(leading.charAt(0)) >= 0)) text = "'" + text;
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }).collect(Collectors.joining(","))).append("\r\n"); }
}
