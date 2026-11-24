package com.example.backend.system.library.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.service.AccountAccessService;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.library.model.entity.LibraryItem;
import com.example.backend.system.library.model.enums.LibraryModerationStatus;
import com.example.backend.system.library.model.enums.Visibility;
import com.example.backend.system.library.repository.LibraryItemRepository;
import com.example.backend.system.library.repository.LibraryModerationAuditRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class LibraryModerationServiceTest {
    private final LibraryItemRepository items = mock(LibraryItemRepository.class);
    private final LibraryModerationAuditRepository audits = mock(LibraryModerationAuditRepository.class);
    private final CurrentUserService currentUser = mock(CurrentUserService.class);
    private final AccountAccessService access = mock(AccountAccessService.class);
    private final LibraryModerationService service = new LibraryModerationService(items, audits, currentUser, access);

    private User reviewer(int id, String name) {
        User user = new User();
        user.setId(id);
        user.setFullName(name);
        user.setEmail("rev" + id + "@physlive.vn");
        when(currentUser.requireCurrentUser()).thenReturn(user);
        when(access.canReviewPublic(user)).thenReturn(true);
        return user;
    }

    private LibraryItem pendingPublicItem(UUID id, int ownerId) {
        LibraryItem item = new LibraryItem();
        item.setId(id);
        item.setTitle("Ném xiên THPT");
        item.setVisibility(Visibility.PUBLIC);
        item.setModerationStatus(LibraryModerationStatus.PENDING);
        item.setActive(true);
        User owner = new User();
        owner.setId(ownerId);
        owner.setFullName("Giáo viên");
        item.setOwner(owner);
        when(items.findByIdForUpdate(id)).thenReturn(Optional.of(item));
        when(items.save(any())).thenAnswer(call -> call.getArgument(0));
        return item;
    }

    @Test
    void claimTakeoverAndReleaseRespectOwnership() {
        UUID id = UUID.randomUUID();
        LibraryItem item = pendingPublicItem(id, 99);
        User revA = reviewer(1, "Reviewer A");
        User revB = new User();
        revB.setId(2);
        revB.setFullName("Reviewer B");

        service.claim(id, false, false);
        assertEquals(revA, item.getAssignedTo());

        // Reviewer B cannot claim without force or release Reviewer A's claim
        when(currentUser.requireCurrentUser()).thenReturn(revB);
        when(access.canReviewPublic(revB)).thenReturn(true);
        assertThrows(ApiException.class, () -> service.claim(id, false, false));
        assertThrows(ApiException.class, () -> service.claim(id, true, false));

        // Force takeover succeeds
        service.claim(id, false, true);
        assertEquals(revB, item.getAssignedTo());

        // Reviewer B can release own claim
        service.claim(id, true, false);
        assertNull(item.getAssignedTo());
    }

    @Test
    void moderateBlocksWhenClaimedByOtherOrStaleStatusAndClearsClaimOnSuccess() {
        UUID id = UUID.randomUUID();
        LibraryItem item = pendingPublicItem(id, 99);
        User revA = reviewer(1, "Reviewer A");
        User revB = new User();
        revB.setId(2);
        revB.setFullName("Reviewer B");
        item.setAssignedTo(revB);

        // Claimed by Reviewer B -> Reviewer A is blocked
        assertThrows(ApiException.class, () -> service.moderate(id, LibraryModerationStatus.APPROVED, null, LibraryModerationStatus.PENDING));

        // Assigned to self, but stale expectedStatus -> blocked
        item.setAssignedTo(revA);
        assertThrows(ApiException.class, () -> service.moderate(id, LibraryModerationStatus.APPROVED, null, LibraryModerationStatus.REJECTED));

        // Valid approval clears assignedTo and writes audit
        var result = service.moderate(id, LibraryModerationStatus.APPROVED, null, LibraryModerationStatus.PENDING);
        assertEquals(LibraryModerationStatus.APPROVED, result.moderationStatus());
        assertNull(item.getAssignedTo());
        verify(audits).save(any());
    }
}
