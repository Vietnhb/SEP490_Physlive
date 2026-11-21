package com.example.backend.system.operations.service;

import com.example.backend.system.assignment.repository.AssignmentSubmissionRepository;
import com.example.backend.system.library.repository.LibraryItemRepository;
import com.example.backend.system.school.repository.LicensePlanRepository;
import com.example.backend.system.school.repository.SchoolPaymentRepository;
import com.example.backend.system.simulation.repository.SimulationRunRepository;
import java.time.DayOfWeek;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AdminAnalyticsOperationTest {
    @Test void operationDetailsReconcileWithBothTotalsAndUseVietnamCalendarBoundaries() {
        var payments = mock(SchoolPaymentRepository.class, RETURNS_DEEP_STUBS);
        var library = mock(LibraryItemRepository.class, RETURNS_DEEP_STUBS);
        var submissions = mock(AssignmentSubmissionRepository.class, RETURNS_DEEP_STUBS);
        var runs = mock(SimulationRunRepository.class, RETURNS_DEEP_STUBS);
        var runCounts = runs.operationCounts(any(), any(), any(), any(), any(), any());
        var workCounts = submissions.operationCounts(any(), any(), any(), any(), any(), any());
        when(runCounts.getWeek()).thenReturn(20L); when(runCounts.getMonth()).thenReturn(60L);
        when(workCounts.getWeek()).thenReturn(12L); when(workCounts.getMonth()).thenReturn(40L);
        when(workCounts.getSubmittedWeek()).thenReturn(8L); when(workCounts.getGradedWeek()).thenReturn(4L);
        when(workCounts.getSubmittedMonth()).thenReturn(25L); when(workCounts.getGradedMonth()).thenReturn(15L);
        var service = new AdminAnalyticsService(payments, library, submissions, mock(LicensePlanRepository.class), runs);
        var result = service.getAnalytics();
        var details = result.operationBreakdown();
        assertEquals(32, result.operationsThisWeek()); assertEquals(100, result.operationsThisMonth());
        assertEquals(result.operationsThisWeek(), details.weekly().simulationRuns() + details.weekly().submissions() + details.weekly().gradedSubmissions());
        assertEquals(result.operationsThisMonth(), details.monthly().simulationRuns() + details.monthly().submissions() + details.monthly().gradedSubmissions());
        var zone = ZoneId.of("Asia/Ho_Chi_Minh");
        assertEquals(DayOfWeek.MONDAY, details.weekStart().atZone(zone).getDayOfWeek());
        assertEquals(0, details.weekStart().atZone(zone).getHour());
        assertEquals(1, details.monthStart().atZone(zone).getDayOfMonth());
        assertFalse(details.measuredAt().isBefore(details.weekStart()));
    }
}
