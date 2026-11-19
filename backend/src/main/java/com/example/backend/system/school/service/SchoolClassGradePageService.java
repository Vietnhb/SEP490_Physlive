package com.example.backend.system.school.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.assignment.model.entity.Assignment;
import com.example.backend.system.assignment.model.entity.AssignmentSubmission;
import com.example.backend.system.assignment.repository.AssignmentRepository;
import com.example.backend.system.assignment.repository.AssignmentSubmissionRepository;
import com.example.backend.system.school.dto.ClassGradebook;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Bound both axes before loading entities and submissions; never build the full class × assignment matrix. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SchoolClassGradePageService {
    private final SchoolClassGradeService grades;
    private final CurrentUserService currentUser;
    private final NamedParameterJdbcTemplate jdbc;
    private final AssignmentRepository assignments;
    private final AssignmentSubmissionRepository submissions;
    private final UserRepository users;
    public record Page(UUID classId, String className, String schoolYear, List<ClassGradebook.Assignment> assignments,
                       List<ClassGradebook.Student> students, long totalAssignments, int assignmentPage, int assignmentSize,
                       int assignmentPages, long totalStudents, int studentPage, int studentSize, int studentPages) { }

    static final String LESSON_FILTER = """
        FROM assignments a WHERE a.school_class_id = :classId
          AND (:assignment = 'ALL' OR a.id::text = :assignment)
          AND strpos(lower(a.title), :title) > 0
          AND a.assigned_at >= :from AND a.assigned_at < :until
        """;
    static final String ACTIVE = "EXISTS (SELECT 1 FROM class_enrollments e WHERE e.class_id = :classId AND e.student_id = u.id AND e.status = 'ACTIVE')";
    static final String STUDENT_FILTER = """
        FROM users u WHERE (
          EXISTS (SELECT 1 FROM class_enrollments e WHERE e.class_id = :classId AND e.student_id = u.id)
          OR EXISTS (SELECT 1 FROM assignment_students r JOIN assignments a ON a.id = r.assignment_id WHERE a.school_class_id = :classId AND r.student_id = u.id)
          OR EXISTS (SELECT 1 FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.school_class_id = :classId AND s.student_id = u.id)
        ) AND (strpos(lower(coalesce(u.full_name, '') || ' ' || coalesce(u.email, '')), :studentQuery) > 0)
          AND (:assignment = 'ALL'
            OR EXISTS (SELECT 1 FROM assignment_students r WHERE r.assignment_id::text = :assignment AND r.student_id = u.id)
            OR EXISTS (SELECT 1 FROM assignment_submissions s WHERE s.assignment_id::text = :assignment AND s.student_id = u.id))
        """;

    public Page forTeacher(UUID classId, int assignmentPage, int assignmentSize, int studentPage, int studentSize,
                           String assignment, String title, String studentQuery, String membership, LocalDate from, LocalDate to) {
        var actor = currentUser.requireCurrentUser();
        if (actor.getRole() == null || !"STAFF".equals(actor.getRole().getName()) || actor.getSchool() == null)
            throw ApiException.forbidden("Tài khoản không có quyền giảng dạy.");
        return get(actor.getSchool().getId(), classId, assignmentPage, assignmentSize, studentPage, studentSize,
                assignment, title, studentQuery, membership, from, to);
    }

    public Page get(UUID schoolId, UUID classId, int assignmentPage, int assignmentSize, int studentPage, int studentSize,
                    String assignment, String title, String studentQuery, String membership, LocalDate from, LocalDate to) {
        var classroom = grades.authorize(schoolId, classId);
        if (from != null && to != null && from.isAfter(to)) throw ApiException.badRequest("Từ ngày phải trước hoặc bằng đến ngày.");
        if (!Set.of("ALL", "CURRENT", "FORMER").contains(membership)) throw ApiException.badRequest("Bộ lọc thành viên không hợp lệ.");
        if (!"ALL".equals(assignment)) { try { UUID.fromString(assignment); } catch (IllegalArgumentException invalid) { throw ApiException.badRequest("Mã bài tập không hợp lệ."); } }
        assignmentSize = Math.clamp(assignmentSize, 1, 5); studentSize = Math.clamp(studentSize, 1, 50);
        ZoneId zone = ZoneId.of("Asia/Ho_Chi_Minh");
        Map<String, Object> params = new HashMap<>(); params.put("classId", classId); params.put("assignment", assignment);
        params.put("title", title.trim().toLowerCase(Locale.ROOT)); params.put("studentQuery", studentQuery.trim().toLowerCase(Locale.ROOT));
        params.put("from", Timestamp.from(from == null ? Instant.parse("1900-01-01T00:00:00Z") : from.atStartOfDay(zone).toInstant()));
        params.put("until", Timestamp.from(to == null ? Instant.parse("9999-12-31T00:00:00Z") : to.plusDays(1).atStartOfDay(zone).toInstant()));
        long lessonCount = jdbc.queryForObject("SELECT count(*) " + LESSON_FILTER, params, Long.class);
        int lessonPages = Math.max(1, (int) Math.ceil((double) lessonCount / assignmentSize));
        assignmentPage = Math.clamp(assignmentPage, 0, lessonPages - 1);
        params.put("assignmentSize", assignmentSize); params.put("assignmentOffset", assignmentPage * assignmentSize);
        List<UUID> lessonIds = jdbc.query("SELECT a.id " + LESSON_FILTER + " ORDER BY a.assigned_at DESC, a.id DESC LIMIT :assignmentSize OFFSET :assignmentOffset", params,
                (row, index) -> row.getObject("id", UUID.class));
        List<Assignment> lessons = lessonIds.isEmpty() ? List.of() : assignments.findAllById(lessonIds);
        Map<UUID, Assignment> lessonMap = lessons.stream().collect(Collectors.toMap(Assignment::getId, item -> item));
        lessons = lessonIds.stream().map(lessonMap::get).filter(Objects::nonNull).toList();
        String studentFilter = STUDENT_FILTER + ("CURRENT".equals(membership) ? " AND " + ACTIVE : "FORMER".equals(membership) ? " AND NOT " + ACTIVE : "");
        long studentCount = lessonCount == 0 ? 0 : jdbc.queryForObject("SELECT count(*) " + studentFilter, params, Long.class);
        int studentPages = Math.max(1, (int) Math.ceil((double) studentCount / studentSize));
        studentPage = Math.clamp(studentPage, 0, studentPages - 1);
        params.put("studentSize", studentSize); params.put("studentOffset", studentPage * studentSize);
        Map<Integer, Boolean> current = new LinkedHashMap<>();
        if (studentCount > 0) jdbc.query("SELECT u.id, " + ACTIVE + " AS is_current " + studentFilter
                + " ORDER BY lower(coalesce(u.full_name, '')), u.id LIMIT :studentSize OFFSET :studentOffset", params,
                row -> { current.put(row.getInt("id"), row.getBoolean("is_current")); });
        List<Integer> studentIds = List.copyOf(current.keySet());
        Map<Integer, com.example.backend.system.account.model.entity.User> people = studentIds.isEmpty() ? Map.of()
                : users.findAllById(studentIds).stream().collect(Collectors.toMap(com.example.backend.system.account.model.entity.User::getId, item -> item));
        List<AssignmentSubmission> results = lessonIds.isEmpty() || studentIds.isEmpty() ? List.of() : submissions.findByAssignmentIdInAndStudentIdIn(lessonIds, studentIds);
        Map<UUID, Map<Integer, AssignmentSubmission>> cells = new HashMap<>();
        results.forEach(item -> cells.computeIfAbsent(item.getAssignment().getId(), ignored -> new HashMap<>()).put(item.getStudent().getId(), item));
        final List<Assignment> shownLessons = lessons;
        List<ClassGradebook.Student> shownStudents = studentIds.stream().filter(people::containsKey).map(id -> new ClassGradebook.Student(id,
                people.get(id).getFullName(), people.get(id).getEmail(), current.get(id), shownLessons.stream()
                .map(lesson -> grades.cell(lesson, id, cells.getOrDefault(lesson.getId(), Map.of()).get(id))).toList())).toList();
        return new Page(classId, classroom.getName(), classroom.getSchoolYear(), lessons.stream().map(item -> new ClassGradebook.Assignment(item.getId(), item.getTitle(),
                item.getStatus().name(), item.getMaxScore(), item.getTeacher().getFullName(), item.getDueAt())).toList(), shownStudents,
                lessonCount, assignmentPage, assignmentSize, lessonPages, studentCount, studentPage, studentSize, studentPages);
    }
}
