package com.example.backend.system.assignment.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.assignment.dto.AssignmentContracts.*;
import com.example.backend.system.assignment.model.entity.*;
import com.example.backend.system.assignment.model.enums.*;
import com.example.backend.system.assignment.repository.*;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import java.time.Instant;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class AssignmentDeadlineTest {
    private final AssignmentRepository assignments = mock(AssignmentRepository.class);
    private final AssignmentSubmissionRepository submissions = mock(AssignmentSubmissionRepository.class);
    private final CurrentUserService current = mock(CurrentUserService.class);
    private final AssignmentService service = new AssignmentService(assignments, submissions, null, null, current, null, null, null, null, null);
    private final Assignment assignment = new Assignment();
    private final User student = new User();
    AssignmentDeadlineTest() {
        assignment.setId(UUID.randomUUID()); assignment.setDueAt(Instant.now().minusSeconds(60)); assignment.setAllowLateSubmission(false);
        assignment.setQuestions(JsonNodeFactory.instance.objectNode().put("activityType", "FREE_EXPLORATION"));
        student.setId(7); assignment.setAssignedStudentIds(Set.of(7));
        when(current.requireCurrentUser()).thenReturn(student);
        when(assignments.findById(assignment.getId())).thenReturn(Optional.of(assignment));
        when(submissions.findByAssignmentIdAndStudentId(assignment.getId(), 7)).thenReturn(Optional.empty());
        when(submissions.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }
    @Test void strictDeadlineRejectsPredictionAndFinalHandInWithoutWritingWork() {
        assertThrows(ApiException.class, () -> service.submit(assignment.getId(), new SubmitPredictionRequest(JsonNodeFactory.instance.objectNode().put("answerText", "prediction"))));
        assertThrows(ApiException.class, () -> service.complete(assignment.getId(), new CompleteAssignmentRequest("conclusion")));
        verify(submissions, never()).save(any());
    }
    @Test void lateAllowedAcceptsPredictionAndFinalWork() {
        assignment.setAllowLateSubmission(true);
        var prediction = service.submit(assignment.getId(), new SubmitPredictionRequest(JsonNodeFactory.instance.objectNode().put("answerText", "prediction")));
        assertNull(prediction.completedAt()); assertEquals(GradingStatus.PENDING, prediction.gradingStatus());
        var result = service.complete(assignment.getId(), new CompleteAssignmentRequest("conclusion"));
        assertNotNull(result.completedAt()); assertTrue(result.completedAt().isAfter(assignment.getDueAt())); assertNull(result.score());
    }
    @Test void deadlineBoundaryIncludesExactDeadlineButNotOneNanosecondBefore() {
        assertFalse(AssignmentDeadlinePolicy.expired(assignment, assignment.getDueAt().minusNanos(1)));
        assertTrue(AssignmentDeadlinePolicy.expired(assignment, assignment.getDueAt()));
        assignment.setDueAt(null); assertFalse(AssignmentDeadlinePolicy.expired(assignment, Instant.now()));
    }
    @Test void finalWorkAndConfirmedGradesArePreservedButPredictionOnlyOrReturnedWorkMissesDeadline() {
        var work = new AssignmentSubmission(); work.setScore(BigDecimal.TEN); work.setCompletedAt(assignment.getDueAt().minusSeconds(1));
        assertFalse(AssignmentDeadlinePolicy.missed(assignment, work, Instant.now()));
        work.setCompletedAt(null); work.setSubmittedAt(assignment.getDueAt().minusSeconds(60));
        assertTrue(AssignmentDeadlinePolicy.missed(assignment, work, Instant.now()));
        work.setRetryAllowed(true); assertTrue(AssignmentDeadlinePolicy.missed(assignment, work, Instant.now()));
        assignment.setAllowLateSubmission(true); assertFalse(AssignmentDeadlinePolicy.missed(assignment, null, Instant.now()));
    }
    @Test void settlementIsIdempotentAndOnlyTouchesIncompleteStrictAssignments() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class); new AssignmentDeadlineSettlement(jdbc).settle();
        verify(jdbc).update(argThat((String sql) -> sql.contains("ON CONFLICT") && sql.contains("DO NOTHING") && sql.contains("allow_late_submission = false")), eq(AssignmentDeadlinePolicy.FEEDBACK));
        verify(jdbc).update(argThat((String sql) -> sql.contains("s.completed_at IS NULL") && sql.contains("s.grading_status <> 'MISSED_DEADLINE'") && !sql.contains("completed_at =")), eq(AssignmentDeadlinePolicy.FEEDBACK));
    }
}
