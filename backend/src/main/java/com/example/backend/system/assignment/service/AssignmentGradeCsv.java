package com.example.backend.system.assignment.service;

import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.assignment.model.entity.Assignment;
import com.example.backend.system.assignment.model.entity.AssignmentSubmission;
import com.example.backend.system.assignment.model.enums.GradingStatus;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/** One row per recipient, independent of UI search, membership filters and pagination. */
public final class AssignmentGradeCsv {
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss").withZone(ZoneId.of("Asia/Ho_Chi_Minh"));
    private AssignmentGradeCsv() { }
    public static byte[] render(Assignment assignment, List<User> recipients, List<AssignmentSubmission> submissions, Instant now) {
        Map<Integer, AssignmentSubmission> byStudent = submissions.stream().collect(Collectors.toMap(item -> item.getStudent().getId(), item -> item, (first, second) -> first));
        StringBuilder csv = new StringBuilder("\uFEFF");
        row(csv, "STT", "Họ và tên", "Email", "Lớp", "Bài tập", "Điểm", "Điểm tối đa", "Trạng thái", "Hạn nộp", "Thời gian nộp", "Nộp muộn", "Nhận xét", "Người chấm", "Thời gian chấm");
        List<User> ordered = recipients.stream().filter(user -> assignment.getAssignedStudentIds().contains(user.getId()))
                .sorted(Comparator.comparing((User user) -> Objects.toString(user.getFullName(), ""), String.CASE_INSENSITIVE_ORDER).thenComparing(User::getId)).toList();
        int index = 0;
        for (User student : ordered) {
            AssignmentSubmission work = byStudent.get(student.getId());
            boolean missed = AssignmentDeadlinePolicy.missed(assignment, work, now);
            boolean completed = work != null && work.getCompletedAt() != null;
            String state = missed ? "Quá hạn · Không nộp" : work == null ? "Chưa nộp" : work.isRetryAllowed() ? "Trả làm lại"
                    : !completed ? "Đang làm" : work.getScore() == null ? "Chờ chấm"
                    : work.getGradingStatus() == GradingStatus.TEACHER_CONFIRMED ? "Đã chấm" : "Điểm tạm tính";
            BigDecimal score = missed ? BigDecimal.ZERO : completed ? work.getScore() : null;
            String feedback = missed ? AssignmentDeadlinePolicy.FEEDBACK : work == null ? "" : work.getFeedback();
            String grader = missed ? "Hệ thống" : work == null || work.getGradedBy() == null ? "" : work.getGradedBy().getFullName();
            row(csv, Integer.toString(++index), student.getFullName(), student.getEmail(), assignment.getSchoolClass() == null ? "" : assignment.getSchoolClass().getName(),
                    assignment.getTitle(), number(score), number(assignment.getMaxScore()), state, time(assignment.getDueAt()), completed ? time(work.getCompletedAt()) : "",
                    completed ? assignment.getDueAt() != null && work.getCompletedAt().isAfter(assignment.getDueAt()) ? "Có" : "Không" : "",
                    feedback, grader, time(missed ? assignment.getDueAt() : work == null ? null : work.getGradedAt()));
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }
    private static String number(BigDecimal value) { return value == null ? "" : value.stripTrailingZeros().toPlainString(); }
    private static String time(Instant value) { return value == null ? "" : TIME.format(value); }
    private static void row(StringBuilder csv, String... fields) { csv.append(Arrays.stream(fields).map(AssignmentGradeCsv::cell).collect(Collectors.joining(","))).append("\r\n"); }
    private static String cell(String value) {
        String text = Objects.toString(value, "");
        String leading = text.stripLeading();
        if ((!text.isEmpty() && "\t\r\n".indexOf(text.charAt(0)) >= 0) || (!leading.isEmpty() && "=+@-".indexOf(leading.charAt(0)) >= 0)) text = "'" + text;
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }
}
