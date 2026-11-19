package com.example.backend.system.support.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.Role;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.account.service.AccountAppealService;
import com.example.backend.system.school.model.entity.School;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SupportInboxDatesTest {
    private final EntityManager em = mock(EntityManager.class);
    private final CurrentUserService current = mock(CurrentUserService.class);
    private final AccountAppealService appeals = mock(AccountAppealService.class);
    private final Query count = mock(Query.class), rows = mock(Query.class);
    private final SupportInboxService service = new SupportInboxService(em, current, mock(SupportService.class), appeals);
    private final UUID schoolId = UUID.randomUUID();

    private void setup(String roleName) {
        User actor = new User(); Role role = new Role(); role.setName(roleName); actor.setRole(role);
        School school = new School(); school.setId(schoolId); actor.setSchool(school);
        when(current.requireCurrentUser()).thenReturn(actor);
        when(em.createNativeQuery(startsWith("select count(*)"))).thenReturn(count);
        when(em.createNativeQuery(startsWith("select id, kind"))).thenReturn(rows);
        when(count.getSingleResult()).thenReturn(21L);
        when(rows.getResultList()).thenReturn(List.of());
        when(appeals.viewsByIds(List.of())).thenReturn(List.of());
    }

    @Test void schoolDatesAreBoundBeforePaginationAndIncludeTheWholeLastVietnameseDay() {
        setup("SCHOOL");
        var page = service.page(1, 10, "ACCOUNT", "ALL", "TODO", "teacher", LocalDate.of(2026, 11, 13), LocalDate.of(2026, 11, 14));
        assertEquals(21, page.totalElements()); assertEquals(3, page.totalPages()); assertEquals(1, page.page());
        for (Query query : List.of(count, rows)) {
            verify(query).setParameter("fromInstant", Instant.parse("2026-11-12T17:00:00Z"));
            verify(query).setParameter("untilInstant", Instant.parse("2026-11-14T17:00:00Z"));
            verify(query).setParameter("school", schoolId);
        }
        verify(rows).setFirstResult(10); verify(rows).setMaxResults(10);
        verify(em).createNativeQuery(argThat(sql -> sql.startsWith("select id, kind") && sql.contains("a.school_id = :school") && sql.contains("created_at >= :fromInstant") && sql.contains("created_at < :untilInstant") && !sql.contains("union all")));
    }

    @Test void managerDatesCoverBothSupportAndAppealsWithTheSameBounds() {
        setup("MANAGER");
        service.page(0, 10, "ALL", "ALL", "ALL", "", null, LocalDate.of(2026, 11, 14));
        verify(em).createNativeQuery(argThat(sql -> sql.startsWith("select id, kind") && sql.contains("union all") && sql.contains("created_at < :untilInstant")));
        verify(count).setParameter("fromInstant", Instant.parse("1900-01-01T00:00:00Z"));
        verify(rows).setParameter("untilInstant", Instant.parse("2026-11-14T17:00:00Z"));
        verify(rows, never()).setParameter(eq("school"), any());
    }

    @Test void invalidDateRangeDoesNotReadInboxData() {
        assertThrows(ApiException.class, () -> service.page(0, 10, "ALL", "ALL", "ALL", "", LocalDate.of(2026, 11, 15), LocalDate.of(2026, 11, 14)));
        verifyNoInteractions(em, current, appeals);
    }
}
