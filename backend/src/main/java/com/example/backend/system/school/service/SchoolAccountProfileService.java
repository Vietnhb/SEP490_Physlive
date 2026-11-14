package com.example.backend.system.school.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.enums.RoleName;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.school.dto.SchoolAccountProfile;
import com.example.backend.system.school.repository.SchoolClassRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SchoolAccountProfileService {
    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;
    private final SchoolClassRepository classRepository;

    @Transactional(readOnly = true)
    public SchoolAccountProfile profile(UUID schoolId, Integer userId) {
        var actor = currentUserService.requireCurrentUser();
        if (actor.getRole() == null || !RoleName.SCHOOL.matches(actor.getRole().getName())
                || actor.isSuspendedReadOnly() || actor.getSchool() == null
                || !schoolId.equals(actor.getSchool().getId())) {
            throw ApiException.forbidden("Bạn chỉ được xem hồ sơ giáo viên và học sinh thuộc trường mình.");
        }
        var user = userRepository.findById(userId)
                .filter(item -> item.getSchool() != null && schoolId.equals(item.getSchool().getId()))
                .filter(item -> item.getRole() != null && (RoleName.STAFF.matches(item.getRole().getName())
                        || RoleName.STUDENT.matches(item.getRole().getName())))
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy giáo viên hoặc học sinh trong trường."));
        String role = user.getRole().getName();
        var memberships = RoleName.STAFF.matches(role)
                ? classRepository.profileTeacherClasses(schoolId, userId)
                : classRepository.profileStudentClasses(schoolId, userId);
        var classes = memberships.stream().map(item -> new SchoolAccountProfile.ClassInfo(
                item.getId(), item.getName(), item.getGradeLevel(), item.getSchoolYear(), item.getSubject())).toList();
        return new SchoolAccountProfile(user.getId(), user.getFullName(), user.getEmail(), user.getAvatarUrl(),
                user.getDateOfBirth(), role, user.permissionCodes(), !user.isSuspendedReadOnly(),
                user.getAccountStatus(), user.getLastLogin(), schoolId, user.getSchool().getName(), classes);
    }
}
