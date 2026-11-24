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
    @Test void managerSeesComplaintsButCannotResolve() {
        actor("MANAGER");
        assertThrows(ApiException.class, service::complaintsForReview);
        when(repository.findTop200ByKindOrderByCreatedAtDesc(SupportKind.COMPLAINT)).thenReturn(List.of());
        assertTrue(service.adminList(SupportKind.COMPLAINT).isEmpty());
        UUID id = UUID.randomUUID(); SupportItem item = new SupportItem(); item.setKind(SupportKind.COMPLAINT);
        User sender = new User(); sender.setId(2); item.setSender(sender); item.setStatus(SupportStatus.OPEN);
        when(repository.findByIdForUpdate(id)).thenReturn(Optional.of(item));
        when(repository.save(any())).thenAnswer(call -> call.getArgument(0));
        assertThrows(ApiException.class, () -> service.resolveComplaint(id, new UpdateSupportRequest(SupportStatus.RESOLVED, "Xong")));
        assertThrows(ApiException.class, () -> service.update(id, new UpdateSupportRequest(SupportStatus.RESOLVED, "Xong")));
        assertFalse(item.isReviewerReferred());
    }
    @Test void reviewerCanReadComplaintsButCannotUseManagerSupportDesk() {
        User reviewer = actor("REVIEWER");
        when(access.canHandleComplaints(reviewer)).thenReturn(true);
        when(repository.findTop200ByKindOrderByCreatedAtDesc(SupportKind.COMPLAINT)).thenReturn(List.of());
        assertTrue(service.complaintsForReview().isEmpty());
        verify(repository).findTop200ByKindOrderByCreatedAtDesc(SupportKind.COMPLAINT);
        assertThrows(ApiException.class, () -> service.adminList(SupportKind.MESSAGE));
    }
    @Test void reviewerWithoutPermissionsCannotAccessComplaints() {
        User bareReviewer = actor("REVIEWER");
        when(access.canHandleComplaints(bareReviewer)).thenReturn(false);
        assertThrows(ApiException.class, service::complaintsForReview);
        assertThrows(ApiException.class, service::complaintCounts);
    }
    @Test void reviewerRespondsAndCannotResolveOwnOrClaimedOrStaleComplaint() {
        User reviewer = actor("REVIEWER");
        when(access.canHandleComplaints(reviewer)).thenReturn(true);
        User sender = new User(); sender.setId(2);
        User otherReviewer = new User(); otherReviewer.setId(3); otherReviewer.setFullName("Reviewer B");
        UUID id = UUID.randomUUID(); SupportItem item = new SupportItem(); item.setId(id);
        item.setKind(SupportKind.COMPLAINT); item.setSender(sender); item.setStatus(SupportStatus.OPEN);
        when(repository.findByIdForUpdate(id)).thenReturn(Optional.of(item));
        when(repository.save(any())).thenAnswer(call -> call.getArgument(0));
        // Claimed by another reviewer blocks resolution until takeover.
        item.setAssignedTo(otherReviewer);
        assertThrows(ApiException.class, () -> service.resolveComplaint(id, new UpdateSupportRequest(SupportStatus.RESOLVED, "Đã xong")));
        item.setAssignedTo(reviewer);
        // Stale expectedStatus blocks resolution.
        assertThrows(ApiException.class, () -> service.resolveComplaint(id, new UpdateSupportRequest(SupportStatus.RESOLVED, "Đã xong", SupportStatus.READ, null)));
        assertThrows(ApiException.class, () -> service.resolveComplaint(id, new UpdateSupportRequest(SupportStatus.RESOLVED, " ")));
        assertEquals(SupportStatus.RESOLVED, service.resolveComplaint(id, new UpdateSupportRequest(SupportStatus.RESOLVED, "Đã kiểm tra và cập nhật", SupportStatus.OPEN, null)).status());
        assertEquals(reviewer, item.getRespondedBy());
        assertNull(item.getAssignedTo());
        assertThrows(ApiException.class, () -> service.resolveComplaint(id, new UpdateSupportRequest(SupportStatus.READ, "Mở lại")));
        item.setStatus(SupportStatus.READ);
        item.setSender(reviewer);
        assertThrows(ApiException.class, () -> service.resolveComplaint(id, new UpdateSupportRequest(SupportStatus.RESOLVED, "Tự xử lý")));
    }
    @Test void reviewerCanEscalateComplaintToLawGapOnceAndRespectsClaimLock() {
        var lawGapService = mock(com.example.backend.system.reviewer.service.LawGapService.class);
        SupportService withEscalation = new SupportService(repository, current, access, null, null, lawGapService);
        User reviewer = actor("REVIEWER");
        when(access.canHandleComplaints(reviewer)).thenReturn(true);
        User sender = new User(); sender.setId(2);
        User otherReviewer = new User(); otherReviewer.setId(3); otherReviewer.setFullName("Reviewer B");
        UUID id = UUID.randomUUID();
        SupportItem item = new SupportItem();
        item.setId(id);
        item.setKind(SupportKind.COMPLAINT);
        item.setSender(sender);
        item.setSubject("Sai tầm xa");
        item.setContent("Tính sai tầm xa ném ngang");
        item.setStatus(SupportStatus.OPEN);
        when(repository.findByIdForUpdate(id)).thenReturn(Optional.of(item));
        when(repository.save(any())).thenAnswer(call -> call.getArgument(0));

        // Reviewer who already has CONTENT_EDIT should edit directly instead of escalating
        when(access.canEditContext(reviewer)).thenReturn(true);
        assertThrows(ApiException.class, () -> withEscalation.escalateComplaintToLawGap(id, new EscalateLawGapRequest("thpt_kinematics", "KINEMATICS", "Tự chuyển")));
        when(access.canEditContext(reviewer)).thenReturn(false);

        // Claimed by another reviewer blocks escalation
        item.setAssignedTo(otherReviewer);
        assertThrows(ApiException.class, () -> withEscalation.escalateComplaintToLawGap(id, new EscalateLawGapRequest("thpt_kinematics", "KINEMATICS", "Thiếu điều kiện")));

        // Claimed by self succeeds
        item.setAssignedTo(reviewer);
        var createdGap = new com.example.backend.system.reviewer.model.entity.LawGap();
        UUID gapId = UUID.randomUUID();
        createdGap.setId(gapId);
        createdGap.setStatus("OPEN");
        when(lawGapService.createFromComplaint(eq(id), eq("Sai tầm xa"), any(), eq("thpt_kinematics"), eq("KINEMATICS"), eq("Thiếu điều kiện")))
                .thenReturn(createdGap);

        SupportView view = withEscalation.escalateComplaintToLawGap(id, new EscalateLawGapRequest("thpt_kinematics", "KINEMATICS", "Thiếu điều kiện"));
        assertEquals(gapId, view.lawGapId());
        assertEquals("OPEN", view.lawGapStatus());
        assertEquals(SupportStatus.READ, view.status());
        assertTrue(view.reviewerReferred());

        // Duplicate escalation is rejected
        assertThrows(ApiException.class, () -> withEscalation.escalateComplaintToLawGap(id, new EscalateLawGapRequest("thpt_kinematics", "KINEMATICS", "Lần 2")));
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
