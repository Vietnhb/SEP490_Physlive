package com.example.backend.system.assignment.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.enums.PermissionCode;
import com.example.backend.system.account.model.enums.RoleName;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.school.dto.SchoolAccountProfile;
import com.example.backend.system.school.repository.ClassEnrollmentRepository;
import com.example.backend.system.school.repository.ClassTeacherAssignmentRepository;
import com.example.backend.system.school.repository.SchoolClassRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TeacherStudentProfileService {
    private final CurrentUserService currentUser;
    private final UserRepository users;
    private final SchoolClassRepository classes;
    private final ClassTeacherAssignmentRepository teachers;
    private final ClassEnrollmentRepository enrollments;

    @Transactional(readOnly = true)
    public SchoolAccountProfile profile(UUID classId, Integer studentId) {
        var actor = currentUser.requireCurrentUser();
        if (actor.getRole() == null || !RoleName.STAFF.matches(actor.getRole().getName())
                || !actor.hasPermission(PermissionCode.TEACH) || actor.isSuspendedReadOnly() || actor.getSchool() == null)
            throw ApiException.forbidden("Bạn không có quyền xem hồ sơ học sinh của lớp.");
        var classroom = classes.findById(classId).orElseThrow(() -> ApiException.notFound("Không tìm thấy lớp học."));
        if (!Boolean.TRUE.equals(classroom.getIsActive()) || classroom.getSchool() == null
                || !actor.getSchool().getId().equals(classroom.getSchool().getId())
                || !teachers.existsBySchoolClassIdAndTeacherIdAndIsActiveTrue(classId, actor.getId()))
            throw ApiException.forbidden("Bạn chỉ được xem học sinh của lớp đang phụ trách.");
        var student = users.findById(studentId)
                .filter(u -> u.getSchool() != null && actor.getSchool().getId().equals(u.getSchool().getId()))
                .filter(u -> u.getRole() != null && RoleName.STUDENT.matches(u.getRole().getName()))
                .filter(u -> enrollments.existsBySchoolClassIdAndStudentId(classId, u.getId()))
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy học sinh trong lớp."));
        // Historical members remain identifiable from submissions; other classes and login metadata are excluded.
        var membership = enrollments.findBySchoolClassIdAndStudentIdAndStatus(classId, studentId,
                com.example.backend.system.school.model.entity.ClassEnrollment.EnrollmentStatus.ACTIVE);
        var visibleClasses = membership.isPresent() ? List.of(new SchoolAccountProfile.ClassInfo(classId,
                classroom.getName(), classroom.getGradeLevel(), classroom.getSchoolYear(), classroom.getSubject()))
                : List.<SchoolAccountProfile.ClassInfo>of();
        return new SchoolAccountProfile(student.getId(), student.getFullName(), student.getEmail(), student.getAvatarUrl(),
                student.getDateOfBirth(), "STUDENT", List.of(), !student.isSuspendedReadOnly(), student.getAccountStatus(),
                null, actor.getSchool().getId(), actor.getSchool().getName(), visibleClasses);
    }
}
