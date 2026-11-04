package com.example.backend.system.account.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.dto.AppealContracts.AppealResponse;
import com.example.backend.system.account.dto.AppealContracts.CreateAppealRequest;
import com.example.backend.system.account.dto.AppealContracts.ResolveAppealRequest;
import com.example.backend.system.account.model.entity.AccountAppeal;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.repository.AccountAppealRepository;
import com.example.backend.system.account.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class AccountAppealService {
    private final AccountAppealRepository appealRepository;
    private final UserRepository userRepository;
    private final CurrentUserService currentUser;
    private final AdminService adminService;

    @Transactional
    public AppealResponse createAppeal(Authentication authentication, CreateAppealRequest request) {
        if (authentication == null) throw ApiException.unauthorized("Vui lòng đăng nhập.");
        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy tài khoản."));
        user = userRepository.findByIdForUpdate(user.getId())
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy tài khoản."));
        if (Set.of("MANAGER", "ADMIN").contains(role(user)))
            throw ApiException.forbidden("Vui lòng liên hệ quản trị viên hệ thống để mở lại tài khoản.");
        if (!user.isSuspendedReadOnly() || user.getSuspensionId() == null)
            throw ApiException.conflict("Tài khoản không có quyết định tạm khóa hợp lệ.");
        if (appealRepository.existsByUserIdAndSuspensionIdAndStatus(user.getId(), user.getSuspensionId(), "PENDING"))
            throw ApiException.conflict("Bạn đã có yêu cầu đang chờ xử lý cho lần khóa này.");

        AccountAppeal appeal = new AccountAppeal();
        appeal.setUser(user);
        appeal.setReason(request.reason().trim());
        appeal.setContent(request.content().trim());
        appeal.setSuspensionId(user.getSuspensionId());
        appeal.setSuspensionScope(user.getSuspensionScope());
        appeal.setSchoolId(user.getSchool() == null ? null : user.getSchool().getId());
        appeal.setSuspendedBy(user.getDeactivatedBy());
        appeal.setSuspendedAt(user.getDeactivatedAt());
        appeal.setCreatedAt(Instant.now());
        appeal.setStatus("PENDING");
        return response(appealRepository.save(appeal), user);
    }

    public List<AppealResponse> myAppeals(Authentication authentication) {
        if (authentication == null) throw ApiException.unauthorized("Vui lòng đăng nhập.");
        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy tài khoản."));
        return appealRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(appeal -> response(appeal, user)).toList();
    }

    public List<AppealResponse> allAppeals() {
        User actor = requireHandler();
        return appealRepository.findAllByOrderByCreatedAtDesc().stream()
                .filter(appeal -> canView(actor, appeal)).map(appeal -> response(appeal, actor)).toList();
    }

    @Transactional
    public AppealResponse resolveAppeal(UUID id, ResolveAppealRequest request) {
        User actor = requireHandler();
        AccountAppeal appeal = appealRepository.findByIdForUpdate(id)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy yêu cầu."));
        User target = userRepository.findByIdForUpdate(appeal.getUser().getId())
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy tài khoản."));
        if (!canHandle(actor, appeal, target))
            throw ApiException.forbidden("Bạn không có quyền xử lý yêu cầu này hoặc quyết định khóa đã thay đổi.");
        if (!"PENDING".equals(appeal.getStatus())) throw ApiException.conflict("Yêu cầu đã được xử lý.");
        if (request == null || request.status() == null || request.resolutionNote() == null || request.resolutionNote().isBlank())
            throw ApiException.badRequest("Vui lòng nhập kết quả và lý do xử lý.");
        String status = request.status().trim().toUpperCase(Locale.ROOT);
        if (!Set.of("APPROVED", "REJECTED").contains(status)) throw ApiException.badRequest("Kết quả không hợp lệ.");
        if ("APPROVED".equals(status)) adminService.setActive(target.getId(), true);
        appeal.setStatus(status);
        appeal.setResolutionNote(request.resolutionNote().trim());
        appeal.setResolvedAt(Instant.now());
        return response(appealRepository.save(appeal), actor);
    }

    private User requireHandler() {
        User actor = currentUser.requireCurrentUser();
        if (!Set.of("SCHOOL", "MANAGER").contains(role(actor)))
            throw ApiException.forbidden("Không có quyền xem yêu cầu mở khóa.");
        return actor;
    }

    private boolean canView(User actor, AccountAppeal appeal) {
        if (Set.of("ADMIN", "MANAGER").contains(role(appeal.getUser()))) return false;
        if ("MANAGER".equals(role(actor))) return true;
        return "SCHOOL".equals(role(actor)) && actor.getSchool() != null
                && actor.getSchool().getId().equals(appeal.getSchoolId())
                && Set.of("STAFF", "STUDENT").contains(role(appeal.getUser()));
    }

    private boolean canHandle(User actor, AccountAppeal appeal, User target) {
        if (!canView(actor, appeal) || actor.getId().equals(target.getId()) || !currentSuspension(appeal, target)
                || !Objects.equals(appeal.getSuspensionScope(), target.getSuspensionScope())) return false;
        if ("SYSTEM".equals(appeal.getSuspensionScope())) return "MANAGER".equals(role(actor));
        return "SCHOOL".equals(appeal.getSuspensionScope()) && "SCHOOL".equals(role(actor))
                && target.getSchool() != null && actor.getSchool().getId().equals(target.getSchool().getId());
    }

    private static boolean currentSuspension(AccountAppeal appeal, User target) {
        return target.isSuspendedReadOnly() && appeal.getSuspensionId() != null
                && appeal.getSuspensionId().equals(target.getSuspensionId());
    }

    private AppealResponse response(AccountAppeal appeal, User actor) {
        AppealResponse value = AppealResponse.from(appeal);
        return new AppealResponse(value.id(), value.userId(), value.userEmail(), value.userName(), value.reason(),
                value.content(), value.status(), value.resolutionNote(), value.createdAt(), value.resolvedAt(), value.authority(),
                "PENDING".equals(appeal.getStatus()) && canHandle(actor, appeal, appeal.getUser()),
                currentSuspension(appeal, appeal.getUser()));
    }

    private static String role(User user) { return user.getRole() == null ? "" : user.getRole().getName(); }
}
