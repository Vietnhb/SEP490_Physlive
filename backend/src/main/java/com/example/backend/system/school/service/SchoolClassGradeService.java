package com.example.backend.system.school.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.assignment.model.entity.Assignment;
import com.example.backend.system.assignment.model.entity.AssignmentSubmission;
import com.example.backend.system.assignment.repository.AssignmentRepository;
import com.example.backend.system.assignment.repository.AssignmentSubmissionRepository;
import com.example.backend.system.school.dto.ClassGradebook;
import com.example.backend.system.school.repository.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SchoolClassGradeService {
    private final SchoolClassRepository classes;
    private final ClassEnrollmentRepository enrollments;
    private final AssignmentRepository assignments;
    private final AssignmentSubmissionRepository submissions;
    private final UserRepository users;
    private final CurrentUserService currentUser;

    public ClassGradebook get(UUID schoolId, UUID classId) {
        User actor = currentUser.requireCurrentUser();
        String role = actor.getRole() == null ? "" : actor.getRole().getName();
        if (!"MANAGER".equals(role) && !("SCHOOL".equals(role) && actor.getSchool() != null && schoolId.equals(actor.getSchool().getId())))
            throw ApiException.forbidden("Bạn không được xem bảng điểm của trường này.");
        var classroom = classes.findById(classId).filter(item -> schoolId.equals(item.getSchool().getId()))
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy lớp trong trường."));
        List<Assignment> lessons = assignments.findBySchoolClassIdOrderByAssignedAtDesc(classId);
        var membership = enrollments.findByClassId(classId);
        Set<Integer> current = membership.stream().filter(item -> item.getStatus() == com.example.backend.system.school.model.entity.ClassEnrollment.EnrollmentStatus.ACTIVE)
                .map(item -> item.getStudent().getId()).collect(Collectors.toSet());
        Set<Integer> studentIds = new HashSet<>();
        membership.forEach(item -> studentIds.add(item.getStudent().getId()));
        lessons.forEach(item -> studentIds.addAll(item.getAssignedStudentIds()));
        List<AssignmentSubmission> results = lessons.isEmpty() ? List.of() : submissions.findByAssignmentIdIn(lessons.stream().map(Assignment::getId).toList());
        Map<UUID, Map<Integer, AssignmentSubmission>> byAssignment = new HashMap<>();
        results.forEach(item -> {
            studentIds.add(item.getStudent().getId());
            byAssignment.computeIfAbsent(item.getAssignment().getId(), ignored -> new HashMap<>()).put(item.getStudent().getId(), item);
        });
        List<ClassGradebook.Student> students = users.findAllById(studentIds).stream()
                .sorted(Comparator.comparing(user -> Objects.toString(user.getFullName(), ""), String.CASE_INSENSITIVE_ORDER))
                .map(user -> new ClassGradebook.Student(user.getId(), user.getFullName(), user.getEmail(), current.contains(user.getId()),
                        lessons.stream().map(lesson -> cell(lesson, user.getId(), byAssignment.getOrDefault(lesson.getId(), Map.of()).get(user.getId()))).toList())).toList();
        return new ClassGradebook(classId, classroom.getName(), classroom.getSchoolYear(), lessons.stream()
                .map(item -> new ClassGradebook.Assignment(item.getId(), item.getTitle(), item.getStatus().name(), item.getMaxScore(), item.getTeacher().getFullName(), item.getDueAt())).toList(), students);
    }

    private ClassGradebook.Cell cell(Assignment assignment, Integer studentId, AssignmentSubmission submission) {
        String state;
        if (submission == null) state = assignment.getAssignedStudentIds().contains(studentId) ? "NOT_STARTED" : "NOT_ASSIGNED";
        else if (submission.isRetryAllowed()) state = "RETURNED";
        else if (submission.getCompletedAt() == null) state = "IN_PROGRESS";
        else if (submission.getScore() == null) state = "SUBMITTED";
        else state = submission.getGradingStatus() == null ? "SUBMITTED" : submission.getGradingStatus().name();
        return new ClassGradebook.Cell(assignment.getId(), state, submission == null || submission.getCompletedAt() == null ? null : submission.getScore(),
                submission == null || submission.getMaxScore() == null ? assignment.getMaxScore() : submission.getMaxScore(),
                submission == null ? null : submission.getFeedback(),
                submission == null || submission.getGradedBy() == null ? null : submission.getGradedBy().getFullName(),
                submission == null ? null : submission.getGradedAt(), submission == null ? null : submission.getCompletedAt(),
                submission == null ? null : submission.getId());
    }

    public byte[] csv(UUID schoolId, UUID classId) {
        ClassGradebook book = get(schoolId, classId);
        StringBuilder csv = new StringBuilder("\uFEFFLớp,Năm học,Học sinh,Email,Thành viên,Bài tập,Người giao bài,Trạng thái,Điểm,Điểm tối đa,Người chấm,Nhận xét,Ngày chấm\r\n");
        Map<UUID, ClassGradebook.Assignment> lessons = book.assignments().stream().collect(Collectors.toMap(ClassGradebook.Assignment::id, item -> item));
        for (var student : book.students()) for (var result : student.cells()) {
            if ("NOT_ASSIGNED".equals(result.state())) continue;
            var lesson = lessons.get(result.assignmentId());
            List<String> row = Arrays.asList(book.className(), book.schoolYear(), student.fullName(), student.email(), student.current() ? "Đang học" : "Đã rời lớp",
                    lesson.title(), lesson.assignedBy(), stateLabel(result.state()), result.score() == null ? "" : result.score().toPlainString(),
                    result.maxScore() == null ? "" : result.maxScore().toPlainString(), result.gradedBy(), result.feedback(), result.gradedAt() == null ? "" : result.gradedAt().toString());
            csv.append(row.stream().map(SchoolClassGradeService::csvCell).collect(Collectors.joining(","))).append("\r\n");
        }
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static String stateLabel(String state) {
        return switch (state) {
            case "NOT_STARTED" -> "Chưa làm"; case "IN_PROGRESS" -> "Đang làm"; case "SUBMITTED" -> "Chưa chấm";
            case "RETURNED" -> "Trả làm lại"; case "AI_GRADED" -> "AI đã chấm"; case "TEACHER_CONFIRMED" -> "Giáo viên đã xác nhận";
            default -> state;
        };
    }
    private static String csvCell(String value) {
        String text = value == null ? "" : value;
        String leading = text.stripLeading();
        if ((!text.isEmpty() && "\t\r\n".indexOf(text.charAt(0)) >= 0) || (!leading.isEmpty() && "=+@-".indexOf(leading.charAt(0)) >= 0)) text = "'" + text;
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }
}
