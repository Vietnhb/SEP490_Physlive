package com.example.backend.system.support.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.service.*;
import com.example.backend.system.support.dto.SupportContracts.*;
import com.example.backend.system.support.model.entity.SupportItem;
import com.example.backend.system.support.model.enums.*;
import com.example.backend.system.support.repository.SupportItemRepository;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SupportPermissionsTest {
    private final SupportItemRepository repository = mock(SupportItemRepository.class);
    private final CurrentUserService current = mock(CurrentUserService.class);
    private final AccountAccessService access = mock(AccountAccessService.class);
    private final SupportService service = new SupportService(repository, current, access);
    private User actor(String roleName) {
        User user = new User(); user.setId(1); Role role = new Role(); role.setName(roleName); user.setRole(role);
        when(current.requireCurrentUser()).thenReturn(user); return user;
    }
    @Test void onlyTeachingStaffCanFileComplaintIncludingGenericEntry() {
        for (String role : List.of("MANAGER", "STUDENT", "SCHOOL", "REVIEWER", "ADMIN", "STAFF")) {
            actor(role);
            assertThrows(ApiException.class, () -> service.createComplaint(new CreateComplaintRequest("Sai", "Nội dung", null)));
            assertThrows(ApiException.class, () -> service.create(SupportKind.COMPLAINT, new CreateSupportRequest("Sai", "Nội dung")));
        }
        User teacher = actor("STAFF"); when(access.canTeach(teacher)).thenReturn(true);
        when(repository.save(any())).thenAnswer(call -> call.getArgument(0));
        assertEquals(SupportKind.COMPLAINT, service.createComplaint(new CreateComplaintRequest("Sai", "Nội dung", null)).kind());
    }
    @Test void managerReceivesComplaintsAndCanResolveWithoutReferral() {
        actor("MANAGER");
        assertThrows(ApiException.class, service::complaintsForReview);
        when(repository.findTop200ByKindOrderByCreatedAtDesc(SupportKind.COMPLAINT)).thenReturn(List.of());
        assertTrue(service.adminList(SupportKind.COMPLAINT).isEmpty());
        UUID id = UUID.randomUUID(); SupportItem item = new SupportItem(); item.setKind(SupportKind.COMPLAINT);
        User sender = new User(); sender.setId(2); item.setSender(sender); item.setStatus(SupportStatus.OPEN);
        when(repository.findByIdForUpdate(id)).thenReturn(Optional.of(item));
        when(repository.save(any())).thenAnswer(call -> call.getArgument(0));
        assertThrows(ApiException.class, () -> service.resolveComplaint(id, new UpdateSupportRequest(SupportStatus.RESOLVED, "Xong")));
        assertEquals(SupportStatus.RESOLVED, service.update(id, new UpdateSupportRequest(SupportStatus.RESOLVED, "Xong")).status());
        assertFalse(item.isReviewerReferred());
    }
    @Test void reviewerCanReadComplaintsButCannotUseManagerSupportDesk() {
        actor("REVIEWER"); when(repository.findTop200ByKindAndReviewerReferredTrueOrderByCreatedAtDesc(SupportKind.COMPLAINT)).thenReturn(List.of());
        assertTrue(service.complaintsForReview().isEmpty());
        verify(repository).findTop200ByKindAndReviewerReferredTrueOrderByCreatedAtDesc(SupportKind.COMPLAINT);
        verify(repository, never()).findTop200ByKindOrderByCreatedAtDesc(SupportKind.COMPLAINT);
        assertThrows(ApiException.class, () -> service.adminList(SupportKind.MESSAGE));
    }
    @Test void reviewerRespondsAndCannotResolveOwnComplaint() {
        User reviewer = actor("REVIEWER");
        User sender = new User(); sender.setId(2);
        UUID id = UUID.randomUUID(); SupportItem item = new SupportItem(); item.setId(id);
        item.setKind(SupportKind.COMPLAINT); item.setSender(sender); item.setStatus(SupportStatus.OPEN);
        when(repository.findByIdForUpdate(id)).thenReturn(Optional.of(item));
        when(repository.save(any())).thenAnswer(call -> call.getArgument(0));
        assertThrows(ApiException.class, () -> service.resolveComplaint(id, new UpdateSupportRequest(SupportStatus.RESOLVED, "Đã kiểm tra")));
        item.setReviewerReferred(true);
        assertThrows(ApiException.class, () -> service.resolveComplaint(id, new UpdateSupportRequest(SupportStatus.RESOLVED, " ")));
        assertEquals(SupportStatus.RESOLVED, service.resolveComplaint(id, new UpdateSupportRequest(SupportStatus.RESOLVED, "Đã kiểm tra và cập nhật")).status());
        assertEquals(reviewer, item.getRespondedBy());
        assertThrows(ApiException.class, () -> service.resolveComplaint(id, new UpdateSupportRequest(SupportStatus.READ, "Mở lại")));
        item.setStatus(SupportStatus.READ);
        item.setSender(reviewer);
        assertThrows(ApiException.class, () -> service.resolveComplaint(id, new UpdateSupportRequest(SupportStatus.RESOLVED, "Tự xử lý")));
    }
    @Test void managerCanReferOnlyUnresolvedSimulationComplaintsAndReviewerCannotRefer() {
        actor("MANAGER");
        UUID id = UUID.randomUUID(); SupportItem item = new SupportItem(); item.setKind(SupportKind.MESSAGE); item.setStatus(SupportStatus.OPEN);
        User sender = new User(); sender.setId(2); item.setSender(sender);
        when(repository.findByIdForUpdate(id)).thenReturn(Optional.of(item));
        when(repository.save(any())).thenAnswer(call -> call.getArgument(0));
        assertThrows(ApiException.class, () -> service.referReviewer(id));
        item.setKind(SupportKind.COMPLAINT); item.setStatus(SupportStatus.RESOLVED);
        assertThrows(ApiException.class, () -> service.referReviewer(id));
        item.setStatus(SupportStatus.OPEN);
        assertTrue(service.referReviewer(id).reviewerReferred());
        assertEquals(SupportStatus.READ, item.getStatus());
        actor("REVIEWER");
        assertThrows(ApiException.class, () -> service.referReviewer(id));
    }
    @Test void managerInboxIncludesAllSupportTypes() {
        actor("MANAGER");
        when(repository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of());
        assertTrue(service.adminList(null).isEmpty());
        verify(repository).findAllByOrderByCreatedAtDesc();
    }
    @Test void everyRoleCanSendOrdinarySupportAndManagerCanReadIt() {
        when(repository.save(any())).thenAnswer(call -> call.getArgument(0));
        for (String role : List.of("MANAGER", "STUDENT", "SCHOOL", "REVIEWER", "ADMIN", "STAFF")) {
            actor(role);
            assertEquals(SupportKind.MESSAGE, service.create(SupportKind.MESSAGE, new CreateSupportRequest("Hỗ trợ", "Nội dung")).kind());
        }
        actor("MANAGER"); when(repository.findTop200ByKindOrderByCreatedAtDesc(SupportKind.MESSAGE)).thenReturn(List.of());
        assertTrue(service.adminList(SupportKind.MESSAGE).isEmpty());
    }
}
