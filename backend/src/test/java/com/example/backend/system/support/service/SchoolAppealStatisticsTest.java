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

class SchoolAppealStatisticsTest {
    private final EntityManager em = mock(EntityManager.class);
    private final CurrentUserService current = mock(CurrentUserService.class);
    private final Query aggregate = mock(Query.class), monthly = mock(Query.class);
    private final SupportInboxService service = new SupportInboxService(em, current, mock(SupportService.class), mock(AccountAppealService.class));
    private final UUID schoolId = UUID.randomUUID();
    private final Instant now = Instant.parse("2026-01-15T03:00:00Z");

    private void actor(String name) {
        var user = new User(); var role = new Role(); role.setName(name); user.setRole(role);
        var school = new School(); school.setId(schoolId); user.setSchool(school);
        when(current.requireCurrentUser()).thenReturn(user);
    }
    private void queries() {
        when(em.createNativeQuery(startsWith("select count(*) filter"))).thenReturn(aggregate);
        when(em.createNativeQuery(startsWith("select cast(date_trunc"))).thenReturn(monthly);
    }
    @Test void computesWholeSchoolMetricsAndZeroFillsSixVietnameseMonthsAcrossYears() {
        actor("SCHOOL"); queries();
        when(aggregate.getSingleResult()).thenReturn(new Object[]{2L, now.minusSeconds(172800).getEpochSecond(), 14L, 3L, 1.2});
        when(monthly.getResultList()).thenReturn(java.util.Collections.singletonList(new Object[]{java.sql.Date.valueOf("2025-12-01"), 4L}));
        var result = service.schoolStatistics(now);
        assertEquals(2, result.pending()); assertEquals(2.0, result.oldestPendingDays());
        assertEquals(14, result.approved30Days()); assertEquals(3, result.rejected30Days());
        assertEquals(1.2, result.averageResolutionDays()); assertEquals(6, result.months().size());
        assertEquals(LocalDate.of(2025,8,1), result.months().getFirst().month());
        assertEquals(0, result.months().getFirst().count()); assertEquals(4, result.months().get(4).count());
        assertEquals(LocalDate.of(2026,1,1), result.months().getLast().month());
        verify(aggregate).setParameter("school", schoolId); verify(monthly).setParameter("school", schoolId);
        verify(aggregate).setParameter("recent", Instant.parse("2025-12-16T17:00:00Z"));
        verify(monthly).setParameter("firstMonth", Instant.parse("2025-07-31T17:00:00Z"));
        verify(em).createNativeQuery(argThat(sql -> sql.startsWith("select count(*) filter") && sql.contains("a.school_id = :school") && sql.contains("a.resolved_at >= :recent") && sql.contains("a.created_at <= :now")));
    }
    @Test void noResolvedRequestsReturnsMissingAverageRatherThanFabricatedZeroDuration() {
        actor("SCHOOL"); queries();
        when(aggregate.getSingleResult()).thenReturn(new Object[]{0L, null, 0L, 0L, null});
        when(monthly.getResultList()).thenReturn(List.of());
        var result = service.schoolStatistics(now);
        assertNull(result.oldestPendingDays()); assertNull(result.averageResolutionDays());
        assertTrue(result.months().stream().allMatch(month -> month.count() == 0));
    }
    @Test void otherRolesCannotReadSchoolStatistics() {
        for (String role : List.of("MANAGER", "STAFF", "STUDENT")) {
            actor(role);
            assertThrows(ApiException.class, () -> service.schoolStatistics(now));
        }
        verifyNoInteractions(em);
    }
}
