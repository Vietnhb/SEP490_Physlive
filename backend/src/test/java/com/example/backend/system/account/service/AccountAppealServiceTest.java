package com.example.backend.system.account.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.dto.AppealContracts.*;
import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.repository.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AccountAppealServiceTest {
    private final AccountAppealRepository appeals = mock(AccountAppealRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final CurrentUserService current = mock(CurrentUserService.class);
    private final AdminService admin = mock(AdminService.class);
    private final AccountAppealService service = new AccountAppealService(appeals, users, current, admin);

    private User user(int id, String name) {
        User user = new User(); user.setId(id); user.setEmail(id + "@test.com");
        Role role = new Role(); role.setName(name); user.setRole(role); user.setActive(false);
        return user;
    }
    private AccountAppeal pending(User target) {
        AccountAppeal appeal = new AccountAppeal(); appeal.setId(UUID.randomUUID()); appeal.setUser(target);
        when(appeals.findByIdForUpdate(appeal.getId())).thenReturn(Optional.of(appeal));
        when(users.findByIdForUpdate(target.getId())).thenReturn(Optional.of(target));
        when(appeals.save(any())).thenAnswer(call -> call.getArgument(0));
        return appeal;
    }
    private CreateAppealRequest request() { return new CreateAppealRequest("Mở khóa", "Vui lòng xem xét"); }

    @Test void onlySuspendedUsersCanSubmitAndPendingCannotBeDuplicated() {
        User target = user(2, "STUDENT");
        var auth = new UsernamePasswordAuthenticationToken(target.getEmail(), "");
        when(users.findByEmail(target.getEmail())).thenReturn(Optional.of(target));
        when(users.findByIdForUpdate(2)).thenReturn(Optional.of(target));
        when(appeals.save(any())).thenAnswer(call -> call.getArgument(0));
        target.setActive(true);
        assertThrows(ApiException.class, () -> service.createAppeal(auth, request()));
        target.setActive(false);
        assertEquals("PENDING", service.createAppeal(auth, request()).status());
        when(appeals.existsByUserIdAndStatus(2, "PENDING")).thenReturn(true);
        assertThrows(ApiException.class, () -> service.createAppeal(auth, request()));
        verify(appeals, times(1)).save(any());
    }
    @Test void listIsScopedToHandlerRole() {
        var managerAppeal = pending(user(2, "MANAGER"));
        var studentAppeal = pending(user(3, "STUDENT"));
        var adminAppeal = pending(user(4, "ADMIN"));
        when(appeals.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(managerAppeal, studentAppeal, adminAppeal));
        when(current.requireCurrentUser()).thenReturn(user(1, "ADMIN"));
        assertEquals(List.of(managerAppeal.getId()), service.allAppeals().stream().map(AppealResponse::id).toList());
        when(current.requireCurrentUser()).thenReturn(user(1, "MANAGER"));
        assertEquals(List.of(studentAppeal.getId()), service.allAppeals().stream().map(AppealResponse::id).toList());
        when(current.requireCurrentUser()).thenReturn(user(1, "STAFF"));
        assertThrows(ApiException.class, service::allAppeals);
    }
    @Test void managerCannotHandleManagerOrAdminEvenByDirectId() {
        when(current.requireCurrentUser()).thenReturn(user(1, "MANAGER"));
        for (String role : List.of("MANAGER", "ADMIN")) {
            var appeal = pending(user(2, role));
            assertThrows(ApiException.class, () -> service.resolveAppeal(appeal.getId(), new ResolveAppealRequest("APPROVED", "Đồng ý")));
        }
        verifyNoInteractions(admin);
    }
    @Test void approvalReusesQuotaChecksAndClearsSuspension() {
        when(current.requireCurrentUser()).thenReturn(user(1, "MANAGER"));
        User target = user(2, "STUDENT"); target.setAccountStatus("SUSPENDED_READ_ONLY"); target.setSuspensionReason("Lý do");
        var appeal = pending(target);
        assertEquals("APPROVED", service.resolveAppeal(appeal.getId(), new ResolveAppealRequest("APPROVED", "Đồng ý")).status());
        verify(admin).setActive(2, true);
        assertTrue(target.getActive()); assertEquals("ACTIVE", target.getAccountStatus()); assertNull(target.getSuspensionReason());
        assertThrows(ApiException.class, () -> service.resolveAppeal(appeal.getId(), new ResolveAppealRequest("REJECTED", "Khác")));
    }
    @Test void quotaFailureDoesNotResolveAppeal() {
        when(current.requireCurrentUser()).thenReturn(user(1, "MANAGER"));
        var appeal = pending(user(2, "STUDENT"));
        doThrow(ApiException.conflict("Hết quota")).when(admin).setActive(2, true);
        assertThrows(ApiException.class, () -> service.resolveAppeal(appeal.getId(), new ResolveAppealRequest("APPROVED", "Đồng ý")));
        assertEquals("PENDING", appeal.getStatus()); verify(appeals, never()).save(any());
    }
    @Test void adminApprovesManagerAndRejectionRequiresNoteWithoutUnlocking() {
        when(current.requireCurrentUser()).thenReturn(user(1, "ADMIN"));
        var appeal = pending(user(2, "MANAGER"));
        assertThrows(ApiException.class, () -> service.resolveAppeal(appeal.getId(), new ResolveAppealRequest("REJECTED", " ")));
        assertEquals("REJECTED", service.resolveAppeal(appeal.getId(), new ResolveAppealRequest("REJECTED", "Chưa đủ căn cứ")).status());
        assertFalse(appeal.getUser().getActive()); verifyNoInteractions(admin);
        var other = pending(user(3, "MANAGER"));
        assertEquals("APPROVED", service.resolveAppeal(other.getId(), new ResolveAppealRequest("APPROVED", "Đồng ý")).status());
    }
    @Test void mineReturnsOnlyCurrentUsersHistory() {
        User target = user(2, "STUDENT"); var appeal = pending(target);
        when(users.findByEmail(target.getEmail())).thenReturn(Optional.of(target));
        when(appeals.findByUserIdOrderByCreatedAtDesc(2)).thenReturn(List.of(appeal));
        assertEquals(appeal.getId(), service.myAppeals(new UsernamePasswordAuthenticationToken(target.getEmail(), "")).getFirst().id());
        verify(appeals, never()).findAllByOrderByCreatedAtDesc();
    }
}
