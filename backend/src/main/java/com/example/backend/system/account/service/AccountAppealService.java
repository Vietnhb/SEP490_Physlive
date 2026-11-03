package com.example.backend.system.account.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.dto.AppealContracts.*;
import com.example.backend.system.account.model.entity.AccountAppeal;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.repository.AccountAppealRepository;
import com.example.backend.system.account.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;

@org.springframework.stereotype.Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class AccountAppealService {
    private final AccountAppealRepository appealRepository;
    private final UserRepository userRepository;
    private final CurrentUserService currentUser;
    private final AdminService adminService;

    @Transactional
    public AppealResponse createAppeal(Authentication authentication, CreateAppealRequest request) {
        if (authentication == null) throw ApiException.unauthorized("Vui lòng đăng nhập để gửi khiếu nại");
        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy người dùng"));
        user = userRepository.findByIdForUpdate(user.getId()).orElseThrow(() -> ApiException.notFound("Không tìm thấy người dùng"));
        if (!isSuspended(user)) throw ApiException.conflict("Chỉ tài khoản đang bị tạm khóa mới được gửi khiếu nại.");
        if (appealRepository.existsByUserIdAndStatus(user.getId(), "PENDING"))
            throw ApiException.conflict("Bạn đã có đơn đang chờ xử lý. Vui lòng chờ phản hồi.");
        AccountAppeal appeal = new AccountAppeal();
        appeal.setUser(user);
        appeal.setReason(request.reason().trim());
        appeal.setContent(request.content().trim());
        appeal.setStatus("PENDING");
        appeal.setCreatedAt(Instant.now());
        return AppealResponse.from(appealRepository.save(appeal));
    }

    public List<AppealResponse> myAppeals(Authentication authentication) {
        if (authentication == null) throw ApiException.unauthorized("Vui lòng đăng nhập để xem khiếu nại");
        User user = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy người dùng"));
        return appealRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream().map(AppealResponse::from).toList();
    }

    public List<AppealResponse> allAppeals() {
        User actor = requireHandler();
        return appealRepository.findAllByOrderByCreatedAtDesc()
                .stream().filter(item -> canHandle(actor, item.getUser()))
                .map(AppealResponse::from).toList();
    }

    @Transactional
    public AppealResponse resolveAppeal(UUID id, ResolveAppealRequest request) {
        User actor = requireHandler();
        AccountAppeal appeal = appealRepository.findByIdForUpdate(id)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy khiếu nại"));
        User target = userRepository.findByIdForUpdate(appeal.getUser().getId())
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy người dùng"));
        if (!canHandle(actor, target)) throw ApiException.forbidden("Bạn không có quyền xử lý khiếu nại của tài khoản này.");
        if (!"PENDING".equals(appeal.getStatus())) throw ApiException.conflict("Đơn này đã được xử lý.");
        if (request == null || request.status() == null || request.resolutionNote() == null || request.resolutionNote().isBlank())
            throw ApiException.badRequest("Vui lòng nhập kết quả và lý do xử lý.");
        String status = request.status().trim().toUpperCase(java.util.Locale.ROOT);
        if (!"APPROVED".equals(status) && !"REJECTED".equals(status)) {
            throw ApiException.badRequest("Trạng thái xử lý phải là APPROVED hoặc REJECTED");
        }
        if ("APPROVED".equals(status)) {
            User user = target;
            if (!isSuspended(user)) throw ApiException.conflict("Tài khoản đã được mở khóa. Hãy kiểm tra lại và ghi kết quả xử lý.");
            // Reuse quota, target-role and single-school-manager checks from normal activation.
            adminService.setActive(user.getId(), true);
            user.setAccountStatus("ACTIVE");
            user.setActive(true);
            user.setSuspensionReason(null);
            user.setSuspendedUntil(null);
            userRepository.save(user);
        }
        appeal.setStatus(status);
        appeal.setResolutionNote(request.resolutionNote().trim());
        appeal.setResolvedAt(Instant.now());
        return AppealResponse.from(appealRepository.save(appeal));
    }

    private User requireHandler() {
        User actor = currentUser.requireCurrentUser();
        String role = role(actor);
        if (!"ADMIN".equals(role) && !"MANAGER".equals(role)) throw ApiException.forbidden("Không có quyền xử lý khiếu nại tài khoản.");
        return actor;
    }

    private static boolean canHandle(User actor, User target) {
        if (actor.getId().equals(target.getId())) return false;
        return "ADMIN".equals(role(actor)) ? "MANAGER".equals(role(target))
                : "MANAGER".equals(role(actor)) && java.util.Set.of("REVIEWER", "SCHOOL", "STAFF", "STUDENT").contains(role(target));
    }

    private static String role(User user) { return user.getRole() == null ? "" : user.getRole().getName(); }
    private static boolean isSuspended(User user) {
        return Boolean.FALSE.equals(user.getActive()) || "SUSPENDED_READ_ONLY".equals(user.getAccountStatus());
    }
}
