package com.example.backend.system.assignment.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.service.AccountAccessService;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.assignment.dto.AssignmentContracts.SchoolAssignment;
import com.example.backend.system.assignment.dto.AssignmentContracts.SchoolAssignmentDetail;
import com.example.backend.system.assignment.dto.AssignmentContracts.SchoolAssignmentStudent;
import com.example.backend.system.assignment.model.entity.AssignmentSubmission;
import com.example.backend.system.assignment.repository.AssignmentRepository;
import com.example.backend.system.assignment.repository.AssignmentSubmissionRepository;
import java.util.Comparator;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SchoolAssignmentService {
    private final AssignmentRepository assignments;
    private final CurrentUserService currentUser;
    private final AccountAccessService access;
    private final AssignmentSubmissionRepository submissions;
    private final UserRepository users;

    private void requireHeadOf(UUID schoolId) {
        User actor = currentUser.requireCurrentUser();
        if (!access.isDepartmentHead(actor) || actor.getSchool() == null || !schoolId.equals(actor.getSchool().getId()))
            throw ApiException.forbidden("Chỉ Trưởng bộ môn được xem phân công bài tập trong trường mình.");
    }

    @Transactional(readOnly = true)
    public Page<SchoolAssignment> list(UUID schoolId, int page, int size) {
        requireHeadOf(schoolId);
        if (page < 0 || size < 1 || size > 100)
            throw ApiException.badRequest("Phân trang không hợp lệ.");
        return assignments.findSchoolAssignments(schoolId, PageRequest.of(page, size, Sort.by("createdAt").descending()))
                .map(item -> new SchoolAssignment(item.getId(), item.getTitle(),
                        item.getSchoolClass() == null ? null : item.getSchoolClass().getId(),
                        item.getSchoolClass() == null ? null : item.getSchoolClass().getName(),
                        item.getSchoolClass() == null ? null : item.getSchoolClass().getSchoolYear(),
                        item.getTeacher().getId(), item.getTeacher().getFullName(), item.getAssignedStudentIds().size(),
                        item.getStatus().name(), item.getAssignedAt(), item.getDueAt()));
    }

    /**
     * One assignment of the head's school, read-only: what the teacher set and where each assigned student is.
     * Answers stay with the teacher who grades them; the head sees progress and scores only.
     */
    @Transactional(readOnly = true)
    public SchoolAssignmentDetail detail(UUID schoolId, UUID assignmentId) {
        requireHeadOf(schoolId);
        var assignment = assignments.findById(assignmentId)
                // the same ownership as the list: the class's school, or the teacher's for work set without a class
                .filter(item -> item.getSchoolClass() != null
                        ? item.getSchoolClass().getSchool() != null && schoolId.equals(item.getSchoolClass().getSchool().getId())
                        : item.getTeacher() != null && item.getTeacher().getSchool() != null && schoolId.equals(item.getTeacher().getSchool().getId()))
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy bài tập trong trường."));
        Map<Integer, AssignmentSubmission> byStudent = submissions.findByAssignmentIdOrderBySubmittedAtDesc(assignmentId).stream()
                .filter(item -> item.getStudent() != null)
                .collect(Collectors.toMap(item -> item.getStudent().getId(), Function.identity(), (latest, older) -> latest));
        var students = users.findAllById(assignment.getAssignedStudentIds()).stream()
                .sorted(Comparator.comparing(user -> user.getFullName() == null ? "" : user.getFullName()))
                .map(user -> {
                    AssignmentSubmission work = byStudent.get(user.getId());
                    return new SchoolAssignmentStudent(user.getId(), user.getFullName(), user.getEmail(), user.getAvatarUrl(),
                            work == null ? null : work.getSubmittedAt(), work == null ? null : work.getCompletedAt(),
                            work == null ? null : work.getGradingStatus().name(), work == null ? null : work.getScore(),
                            work == null || work.getMaxScore() == null ? assignment.getMaxScore() : work.getMaxScore());
                }).toList();
        var schoolClass = assignment.getSchoolClass();
        return new SchoolAssignmentDetail(assignment.getId(), assignment.getTitle(), assignment.getDescription(),
                schoolClass == null ? null : schoolClass.getId(), schoolClass == null ? null : schoolClass.getName(),
                schoolClass == null ? null : schoolClass.getSchoolYear(), assignment.getTeacher().getId(),
                assignment.getTeacher().getFullName(), assignment.getTeacher().getEmail(), assignment.getStatus().name(),
                assignment.getAssignedAt(), assignment.getDueAt(), assignment.isAllowLateSubmission(), assignment.getMaxScore(),
                assignment.getQuestions() != null && assignment.getQuestions().isArray() ? assignment.getQuestions().size() : 0,
                students);
    }
}
