package com.example.backend.system.account.service;

import com.example.backend.exception.ApiException;
import com.example.backend.security.PasswordPolicy;
import com.example.backend.system.account.dto.CreateManagedUserRequest;
import com.example.backend.system.account.dto.UpdateManagedUserRequest;
import com.example.backend.system.account.dto.UserStatusResponse;
import com.example.backend.system.account.model.entity.Role;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.model.enums.RoleName;
import com.example.backend.system.account.repository.RoleRepository;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.school.model.entity.School;
import com.example.backend.system.school.repository.SchoolRepository;
import com.example.backend.system.school.service.LicenseCheckService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminService {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final CurrentUserService currentUserService;
    private final RoleValidationService roleValidationService;
    private final AccountAccessService accountAccessService;
    private final LicenseCheckService licenseCheckService;
    private final com.example.backend.system.school.repository.SchoolRepository schoolRepository;
    private final jakarta.persistence.EntityManager entityManager;

    public record UserPage(java.util.List<UserStatusResponse> items, long totalElements, int totalPages, int page, int size,
                           java.util.Map<String, Long> counts) { }

    @Transactional(readOnly = true)
    public UserPage usersPage(java.util.UUID schoolId, int page, int size, String query, String role, String tier, String status) {
        if (schoolId != null) requireSchoolAccess(schoolId);
        if (query != null && query.length() > 200) throw ApiException.badRequest("Search is too long.");
        User actor = schoolId == null ? null : currentUserService.requireCurrentUser();
        Integer firstUserId = actor != null && actor.getRole() != null && RoleName.SCHOOL.matches(actor.getRole().getName())
                ? actor.getId() : null;
        org.springframework.data.jpa.domain.Specification<User> scope = (root, cq, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            if (schoolId != null) {
                predicates.add(cb.equal(root.get("school").get("id"), schoolId));
                predicates.add(root.get("role").get("name").in(java.util.List.of("SCHOOL", "STAFF", "STUDENT")));
            }
            if (firstUserId != null && cq != null && cq.getResultType() != Long.class && cq.getResultType() != long.class) {
                cq.orderBy(cb.asc(cb.<Integer>selectCase().when(cb.equal(root.get("id"), firstUserId), 0).otherwise(1)),
                        cb.asc(root.get("fullName")), cb.asc(root.get("id")));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        org.springframework.data.jpa.domain.Specification<User> filters = (root, cq, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            if (role != null && !role.isBlank() && !role.equals("ALL")) predicates.add(cb.equal(root.get("role").get("name"), role));
            var tierRoles = switch (tier == null ? "ALL" : tier) {
                case "SYSTEM" -> java.util.List.of("ADMIN", "MANAGER");
                case "SCHOOL" -> java.util.List.of("SCHOOL", "STAFF");
                case "INDIVIDUAL" -> java.util.List.of("STUDENT", "REVIEWER");
                default -> java.util.List.<String>of();
            };
            if (!tierRoles.isEmpty()) predicates.add(root.get("role").get("name").in(tierRoles));
            if ("SUSPENDED_READ_ONLY".equals(status) || "SUSPENDED".equals(status)) predicates.add(cb.or(cb.isFalse(root.get("active")), cb.equal(root.get("accountStatus"), "SUSPENDED_READ_ONLY")));
            else if ("WARNED".equals(status)) predicates.add(cb.equal(root.get("accountStatus"), "WARNED"));
            else if ("ACTIVE".equals(status)) predicates.add(cb.and(cb.or(cb.isTrue(root.get("active")), cb.isNull(root.get("active"))), cb.or(cb.isNull(root.get("accountStatus")), cb.equal(root.get("accountStatus"), "ACTIVE"))));
            if (query != null && !query.isBlank()) {
                String needle = "%" + query.trim().toLowerCase(java.util.Locale.ROOT).replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
                var school = root.join("school", jakarta.persistence.criteria.JoinType.LEFT);
                predicates.add(cb.or(cb.like(root.get("id").as(String.class), needle, '!'), cb.like(cb.lower(root.get("email")), needle, '!'), cb.like(cb.lower(root.get("fullName")), needle, '!'),
                        cb.like(cb.lower(school.get("name")), needle, '!'), cb.like(cb.lower(school.get("code")), needle, '!')));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        var request = com.example.backend.common.dto.PageResponse.request(page, size, firstUserId != null
                ? org.springframework.data.domain.Sort.unsorted()
                : org.springframework.data.domain.Sort.by("fullName").and(org.springframework.data.domain.Sort.by("id")));
        var result = userRepository.findAll(scope.and(filters), request);
        if (page > 0 && result.isEmpty() && result.getTotalElements() > 0)
            result = userRepository.findAll(scope.and(filters), request.withPage(Math.max(0, result.getTotalPages() - 1)));
        java.util.Map<String, Long> counts = new java.util.HashMap<>();
        for (var count : userRepository.accountCounts(schoolId)) {
            if (schoolId != null && !java.util.Set.of("SCHOOL", "STAFF", "STUDENT").contains(count.getRole())) continue;
            counts.merge(count.getRole() == null ? "UNKNOWN" : count.getRole(), count.getTotal(), Long::sum);
            counts.merge("total", count.getTotal(), Long::sum);
            if (Boolean.FALSE.equals(count.getActive())) counts.merge("suspended", count.getTotal(), Long::sum);
        }
        return new UserPage(result.stream().map(this::toUser).toList(), result.getTotalElements(), result.getTotalPages(), result.getNumber(), size, counts);
    }

    @Transactional(readOnly = true)
    public List<UserStatusResponse> users() {
        return userRepository.findAll().stream().map(this::toUser).toList();
    }

    @Transactional(readOnly = true)
    public List<UserStatusResponse> usersForSchool(java.util.UUID schoolId) {
        requireSchoolAccess(schoolId);
        return userRepository.findBySchoolId(schoolId).stream().map(this::toUser).toList();
    }

    @Transactional(readOnly = true)
    public void requireUserInSchool(java.util.UUID schoolId, Integer userId) {
        requireSchoolAccess(schoolId);
        userRepository.findById(userId)
                .filter(user -> user.getSchool() != null && schoolId.equals(user.getSchool().getId()))
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy người dùng trong trường"));
    }

    @Transactional
    public UserStatusResponse suspendForSchool(java.util.UUID schoolId, Integer userId, String reason) {
        requireUserInSchool(schoolId, userId);
        return setActive(userId, false, reason);
    }

    @Transactional
    public UserStatusResponse createUserForSchool(java.util.UUID schoolId, CreateManagedUserRequest request) {
        requireSchoolAccess(schoolId);
        return createUser(new CreateManagedUserRequest(request.email(), request.password(), request.fullName(),
                request.role(), schoolId.toString(), request.dateOfBirth(), request.avatarUrl(), request.permissions()));
    }

    @Transactional
    public UserStatusResponse updateUserForSchool(java.util.UUID schoolId, Integer userId, UpdateManagedUserRequest request) {
        requireUserInSchool(schoolId, userId);
        return updateUser(userId, new UpdateManagedUserRequest(request.fullName(), request.role(), schoolId.toString(),
                request.dateOfBirth(), request.avatarUrl(), request.permissions()));
    }

    @Transactional
    public UserStatusResponse resetPasswordForSchool(java.util.UUID schoolId, Integer userId, String password) {
        requireUserInSchool(schoolId, userId);
        return resetPassword(userId, password);
    }

    @Transactional
    public UserStatusResponse setActiveForSchool(java.util.UUID schoolId, Integer userId, boolean active) {
        requireUserInSchool(schoolId, userId);
        return setActive(userId, active);
    }

    @Transactional
    public UserStatusResponse createUser(CreateManagedUserRequest request) {
        if (userRepository.findFirstByEmailIgnoreCase(request.email().trim()).isPresent()) {
            throw ApiException.conflict("Email đã tồn tại");
        }
        Role role = roleRepository.findByName(request.role().trim().toUpperCase(java.util.Locale.ROOT))
                .orElseThrow(() -> ApiException.badRequest("Vai trò không được hỗ trợ"));
        var school = resolveSchool(request.institutionId());
        roleValidationService.validateRoleSchoolConsistency(role.getName(), school);
        User actor = currentUserService.requireCurrentUser();
        if (actor.getRole() != null && RoleName.ADMIN.matches(actor.getRole().getName())) {
            if (!RoleName.MANAGER.matches(role.getName()))
                throw ApiException.forbidden("Quản trị viên chỉ có thể tạo tài khoản quản lý");
        } else {
            if (RoleName.MANAGER.matches(role.getName()))
                throw ApiException.forbidden("Chỉ quản trị viên mới được tạo tài khoản quản lý");
            requireManage(role.getName(), school);
        }
        requireStudentSeat(role.getName(), school);
        validatePassword(request.password());
        User user = new User();
        user.setEmail(request.email().trim().toLowerCase(java.util.Locale.ROOT));
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setMustChangePassword(true);
        user.setFullName(request.fullName().trim());
        user.setRole(role);
        user.setSchool(school);
        user.setDateOfBirth(request.dateOfBirth());
        user.setAvatarUrl(normalizeAvatar(request.avatarUrl()));
        accountAccessService.applyPermissions(user, role.getName(), request.permissions(), actor);
        if (RoleName.SCHOOL.matches(role.getName()))
            roleValidationService.validateSingleSchoolManager(school.getId(), null);
        user.setActive(true);
        return toUser(userRepository.save(user));
    }

    @Transactional
    public UserStatusResponse setActive(Integer id, boolean active) {
        return setActive(id, active, "Tạm khóa bởi quản trị viên.");
    }

    @Transactional
    public UserStatusResponse setActive(Integer id, boolean active, String reason) {
        if (!active && currentUserService.requireCurrentUser().getId().equals(id)) {
            throw ApiException.conflict("Bạn không thể khóa tài khoản của chính mình");
        }
        User user = userRepository.findByIdForUpdate(id)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy người dùng"));
        requireManage(user.getRole().getName(), user.getSchool());
        if (active && Boolean.FALSE.equals(user.getActive())) requireStudentSeat(user.getRole().getName(), user.getSchool());
        if (active && RoleName.SCHOOL.matches(user.getRole().getName()))
            roleValidationService.validateSingleSchoolManager(user.getSchool().getId(), user.getId());
        User actor = currentUserService.requireCurrentUser();
        boolean schoolActor = actor.getRole() != null && RoleName.SCHOOL.matches(actor.getRole().getName());
        if (schoolActor && user.isSuspendedReadOnly() && !"SCHOOL".equals(user.getSuspensionScope()))
            throw ApiException.forbidden("Tài khoản bị khóa ở cấp hệ thống. School không có quyền thay đổi quyết định này.");
        if (actor.getRole() != null && RoleName.MANAGER.matches(actor.getRole().getName())
                && user.isSuspendedReadOnly() && "SCHOOL".equals(user.getSuspensionScope()))
            throw ApiException.forbidden("Tài khoản do School tạm khóa. Manager chỉ được xem; nhà trường chịu trách nhiệm mở lại.");
        if (!active && (reason == null || reason.isBlank())) throw ApiException.badRequest("Vui lòng nhập lý do tạm khóa.");
        if (!active && reason.length() > 2000) throw ApiException.badRequest("Lý do quá dài.");
        if (!active && user.isSuspendedReadOnly() && java.util.Objects.equals(user.getSuspensionScope(), schoolActor ? "SCHOOL" : "SYSTEM"))
            throw ApiException.conflict("Tài khoản đã bị khóa ở cấp quản lý này.");
        user.setAccountStatus(active ? "ACTIVE" : "SUSPENDED_READ_ONLY");
        user.setSuspensionReason(active ? null : reason.trim());
        user.setSuspendedUntil(null);
        user.setSuspensionScope(active ? null : schoolActor ? "SCHOOL" : "SYSTEM");
        user.setSuspensionId(active ? null : java.util.UUID.randomUUID());
        user.setActive(active);
        user.setDeactivatedAt(active ? null : java.time.Instant.now());
        user.setDeactivatedBy(active ? null : currentUserService.requireCurrentUser().getId());
        return toUser(userRepository.save(user));
    }

    @Transactional
    public UserStatusResponse resetPassword(Integer id, String newPassword) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy người dùng"));
        requireManage(user.getRole().getName(), user.getSchool());
        validatePassword(newPassword);
        user.setPassword(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(true);
        return toUser(userRepository.save(user));
    }

    private UserStatusResponse toUser(User user) {
        String status = user.getAccountStatus() != null ? user.getAccountStatus()
                : (!Boolean.FALSE.equals(user.getActive()) ? "ACTIVE" : "SUSPENDED_READ_ONLY");
        return new UserStatusResponse(user.getId(), user.getEmail(), user.getFullName(),
                user.getRole() == null ? "UNKNOWN" : user.getRole().getName(), !Boolean.FALSE.equals(user.getActive()),
                user.getInstitutionId(), user.getLastLogin(), user.getDateOfBirth(), user.getAvatarUrl(),
                user.getSchool() == null ? null : user.getSchool().getId(),
                user.getSchool() == null ? null : user.getSchool().getName(), user.isMustChangePassword(),
                user.permissionCodes(),
                status, user.getSuspensionReason(), user.getSuspendedUntil(), user.getSuspensionScope());
    }

    @Transactional
    public UserStatusResponse updateUser(Integer id, UpdateManagedUserRequest request) {
        User user = userRepository.findById(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy người dùng"));
        requireManage(user.getRole().getName(), user.getSchool());
        Role role = roleRepository.findByName(request.role().trim().toUpperCase(java.util.Locale.ROOT))
                .orElseThrow(() -> ApiException.badRequest("Vai trò không được hỗ trợ"));
        if (RoleName.MANAGER.matches(role.getName()) && !RoleName.MANAGER.matches(user.getRole().getName())
                && !RoleName.ADMIN.matches(currentUserService.requireCurrentUser().getRole().getName()))
            throw ApiException.forbidden("Chỉ quản trị viên mới được tạo tài khoản quản lý");
        if (currentUserService.requireCurrentUser().getId().equals(id) && !role.getName().equals(user.getRole().getName()))
            throw ApiException.conflict("Bạn không thể thay đổi vai trò của chính mình");
        var school = resolveSchool(request.institutionId());
        roleValidationService.validateRoleSchoolConsistency(role.getName(), school);
        requireManage(role.getName(), school);
        boolean alreadyOccupiesSeat = RoleName.STUDENT.matches(user.getRole().getName()) && !Boolean.FALSE.equals(user.getActive())
                && user.getSchool() != null && school != null && user.getSchool().getId().equals(school.getId());
        if (!Boolean.FALSE.equals(user.getActive()) && !alreadyOccupiesSeat) requireStudentSeat(role.getName(), school);
        if (Boolean.TRUE.equals(user.getActive()) && RoleName.SCHOOL.matches(role.getName()))
            roleValidationService.validateSingleSchoolManager(school.getId(), user.getId());
        user.setFullName(request.fullName().trim()); user.setRole(role); user.setSchool(school);
        if (request.dateOfBirth() != null) user.setDateOfBirth(request.dateOfBirth());
        if (request.avatarUrl() != null) user.setAvatarUrl(normalizeAvatar(request.avatarUrl()));
        // Permissions of the former role are dropped; a new STAFF/REVIEWER gets the role defaults unless narrowed.
        accountAccessService.applyPermissions(user, role.getName(), request.permissions(), currentUserService.requireCurrentUser());
        return toUser(userRepository.save(user));
    }

    private void requireManage(String targetRole, com.example.backend.system.school.model.entity.School school) {
        User actor = currentUserService.requireCurrentUser();
        if (actor.getRole() != null && RoleName.ADMIN.matches(actor.getRole().getName())) {
            if (!RoleName.MANAGER.matches(targetRole))
                throw ApiException.forbidden("Quản trị viên chỉ có thể quản lý tài khoản quản lý");
            return;
        }
        if (RoleName.MANAGER.matches(targetRole))
            throw ApiException.forbidden("Chỉ Admin được quản lý tài khoản Manager.");
        if (RoleName.ADMIN.matches(targetRole))
            throw ApiException.forbidden("Không thể quản lý tài khoản quản trị viên tại đây");
        if (actor.getRole() != null && RoleName.MANAGER.matches(actor.getRole().getName())) return;
        if (school == null || !roleValidationService.canManageSchool(actor, school.getId())
                || !(RoleName.STAFF.matches(targetRole) || RoleName.STUDENT.matches(targetRole)))
            throw ApiException.forbidden("Bạn chỉ được quản lý giáo viên và học sinh trong trường của mình");
        licenseCheckService.requireWriteAccess(actor);
    }

    private static void validatePassword(String password) {
        PasswordPolicy.requireValid(password);
    }

    private static String normalizeAvatar(String avatarUrl) {
        return avatarUrl == null || avatarUrl.isBlank() ? null : avatarUrl.trim();
    }

    private void requireSchoolAccess(java.util.UUID schoolId) {
        User actor = currentUserService.requireCurrentUser();
        boolean departmentHead = accountAccessService.isDepartmentHead(actor) && actor.getSchool() != null
                && schoolId.equals(actor.getSchool().getId());
        if (!departmentHead && !roleValidationService.canManageSchool(actor, schoolId)) {
            throw ApiException.forbidden("Bạn không có quyền truy cập trường này");
        }
    }

    private void requireStudentSeat(String role, com.example.backend.system.school.model.entity.School school) {
        if (!RoleName.STUDENT.matches(role) || school == null) return;
        var locked = schoolRepository.findByIdForUpdate(school.getId())
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy trường"));
        entityManager.refresh(locked, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        if (locked.getStudentQuota() != null && userRepository.countActiveStudents(locked.getId()) >= locked.getStudentQuota())
            throw ApiException.conflict("Trường đã hết quota học sinh. Vui lòng nâng gói hoặc tạm khóa tài khoản không còn sử dụng.");
    }

    private com.example.backend.system.school.model.entity.School resolveSchool(String id) {
        if (id == null || id.isBlank()) return null;
        try {
            return schoolRepository.findById(java.util.UUID.fromString(id))
                    .filter(com.example.backend.system.school.model.entity.School::isActive)
                    .orElseThrow(() -> ApiException.badRequest("Vui lòng chọn trường đang hoạt động"));
        } catch (IllegalArgumentException ex) { throw ApiException.badRequest("Định danh trường không hợp lệ"); }
    }
}
