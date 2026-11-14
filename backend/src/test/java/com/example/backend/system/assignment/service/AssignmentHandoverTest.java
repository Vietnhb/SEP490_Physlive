package com.example.backend.system.assignment.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.assignment.model.entity.*;
import com.example.backend.system.assignment.repository.*;
import com.example.backend.system.school.model.entity.*;
import com.example.backend.system.school.repository.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AssignmentHandoverTest {
    private final AssignmentRepository assignments = mock(AssignmentRepository.class);
    private final AssignmentSubmissionRepository submissions = mock(AssignmentSubmissionRepository.class);
    private final CurrentUserService current = mock(CurrentUserService.class);
    private final ClassTeacherAssignmentRepository teachers = mock(ClassTeacherAssignmentRepository.class);
    private final AssignmentGradeChangeRepository history = mock(AssignmentGradeChangeRepository.class);
    private final SchoolRepository schools = mock(SchoolRepository.class);
    private final AssignmentService service = new AssignmentService(assignments, submissions, null, null, current, null, mock(ClassEnrollmentRepository.class), teachers, history, schools);
    private final User original = teacher(1), replacement = teacher(2), student = new User();
    private final Assignment assignment = new Assignment();
    private final AssignmentSubmission submission = new AssignmentSubmission();
    private final SchoolClass classroom = new SchoolClass();

    private User teacher(int id) {
        User user = new User(); user.setId(id); user.setActive(true); user.setFullName("Teacher " + id);
        Role role = new Role(); role.setName("STAFF"); user.setRole(role); user.grantPermission(new Permission("TEACH"), null); return user;
    }
    @BeforeEach void setup() {
        School school = new School(); school.setId(UUID.randomUUID()); original.setSchool(school); replacement.setSchool(school);
        classroom.setId(UUID.randomUUID()); classroom.setSchool(school); classroom.setIsActive(true);
        assignment.setId(UUID.randomUUID()); assignment.setSchoolClass(classroom); assignment.setTeacher(original); assignment.setAssignedAt(Instant.now());
        var spec = new com.example.backend.system.problem.model.entity.Specification(); spec.setId(UUID.randomUUID()); assignment.setSpecification(spec);
        student.setId(3); student.setFullName("Student");
        submission.setId(UUID.randomUUID()); submission.setAssignment(assignment); submission.setStudent(student); submission.setCompletedAt(Instant.now());
        when(assignments.findById(assignment.getId())).thenReturn(Optional.of(assignment));
        when(submissions.findById(submission.getId())).thenReturn(Optional.of(submission));
        when(submissions.findByIdForUpdate(submission.getId())).thenReturn(Optional.of(submission));
        when(schools.findByIdForUpdate(school.getId())).thenReturn(Optional.of(school));
        when(submissions.save(any())).thenAnswer(call -> call.getArgument(0));
        when(teachers.existsBySchoolClassIdAndTeacherIdAndIsActiveTrue(classroom.getId(), 2)).thenReturn(true);
    }
    @Test void newTeacherGradesOldWorkWithoutChangingCreator() {
        when(current.requireCurrentUser()).thenReturn(replacement);
        service.grade(assignment.getId(), submission.getId(), new BigDecimal("8"), "Tốt", true);
        assertEquals(replacement, submission.getGradedBy()); assertEquals(original, assignment.getTeacher());
    }
    @Test void originalTeacherCannotReadGradeReopenOrCloseAfterHandover() {
        when(current.requireCurrentUser()).thenReturn(original);
        when(submissions.findByAssignmentIdOrderBySubmittedAtDesc(assignment.getId())).thenReturn(List.of(submission));
        assertThrows(ApiException.class, () -> service.submissions(assignment.getId()));
        assertThrows(ApiException.class, () -> service.grade(assignment.getId(), submission.getId(), BigDecimal.TEN, "", true));
        assertThrows(ApiException.class, () -> service.reopen(assignment.getId(), submission.getId()));
        assertThrows(ApiException.class, () -> service.setStatus(assignment.getId(), com.example.backend.system.assignment.model.enums.AssignmentStatus.CLOSED));
    }
    @Test void replacementSeesAssignmentsCreatedBeforeTheirAppointment() {
        when(current.requireCurrentUser()).thenReturn(replacement);
        ClassTeacherAssignment link = new ClassTeacherAssignment(); link.setSchoolClass(classroom);
        when(teachers.findActiveByTeacherId(2)).thenReturn(List.of(link));
        when(assignments.findBySchoolClassIdOrderByAssignedAtDesc(classroom.getId())).thenReturn(List.of(assignment));
        var result = service.forTeacher().getFirst();
        assertTrue(result.canManage()); assertEquals(1, result.assignedById());
    }
    @Test void crossSchoolTeacherCannotTakeOverAndStudentsKeepTheirOwnHistory() {
        when(current.requireCurrentUser()).thenReturn(replacement);
        School other = new School(); other.setId(UUID.randomUUID()); replacement.setSchool(other);
        assertThrows(ApiException.class, () -> service.submissions(assignment.getId()));
        Role role = new Role(); role.setName("STUDENT"); student.setRole(role);
        when(current.requireCurrentUser()).thenReturn(student);
        when(assignments.findByAssignedStudentIdsContaining(3)).thenReturn(List.of(assignment));
        when(submissions.findByAssignmentIdAndStudentId(assignment.getId(), 3)).thenReturn(Optional.of(submission));
        assertEquals(assignment.getId(), service.forStudent().getFirst().id());
    }

    @Test void confirmedGradeEditRequiresReasonAndPreservesPreviousTeacherAndValues() {
        when(current.requireCurrentUser()).thenReturn(replacement);
        submission.setScore(new BigDecimal("8")); submission.setFeedback("Original feedback");
        submission.setGradingStatus(com.example.backend.system.assignment.model.enums.GradingStatus.TEACHER_CONFIRMED);
        submission.setGradedBy(original); submission.setGradedAt(Instant.parse("2026-11-01T00:00:00Z"));
        assertThrows(ApiException.class, () -> service.grade(assignment.getId(), submission.getId(), BigDecimal.TEN, "New feedback", true));
        assertEquals(new BigDecimal("8"), submission.getScore()); verify(history, never()).save(any());
        clearInvocations(schools, submissions);
        var updated = service.grade(assignment.getId(), submission.getId(), BigDecimal.TEN, "New feedback", true, "Reviewed the measurement");
        assertEquals(2, updated.gradedById()); assertEquals("Teacher 2", updated.gradedByName());
        var change = org.mockito.ArgumentCaptor.forClass(AssignmentGradeChange.class); verify(history).save(change.capture());
        assertEquals(new BigDecimal("8"), change.getValue().getPreviousScore()); assertEquals(BigDecimal.TEN, change.getValue().getNewScore());
        assertEquals("Original feedback", change.getValue().getPreviousFeedback()); assertEquals("New feedback", change.getValue().getNewFeedback());
        assertEquals(1, change.getValue().getPreviousGraderId()); assertEquals("Teacher 1", change.getValue().getPreviousGraderName());
        assertEquals("Reviewed the measurement", change.getValue().getReason()); assertEquals(replacement, change.getValue().getActor());
        assertEquals(original, assignment.getTeacher());
        var order = inOrder(schools, submissions);
        order.verify(schools).findByIdForUpdate(classroom.getSchool().getId());
        order.verify(submissions).findByIdForUpdate(submission.getId());
    }

    @Test void unchangedConfirmedGradeDoesNotOverwriteOriginalGrader() {
        when(current.requireCurrentUser()).thenReturn(replacement);
        submission.setScore(new BigDecimal("8")); submission.setFeedback("Kept"); submission.setGradedBy(original);
        submission.setGradingStatus(com.example.backend.system.assignment.model.enums.GradingStatus.TEACHER_CONFIRMED);
        service.grade(assignment.getId(), submission.getId(), new BigDecimal("8.000"), "Kept", true);
        assertEquals(original, submission.getGradedBy()); verify(history, never()).save(any()); verify(submissions, never()).save(any());
    }

    @Test void returningConfirmedWorkRequiresReasonAndKeepsOldGradeInHistory() {
        when(current.requireCurrentUser()).thenReturn(replacement);
        assignment.setStatus(com.example.backend.system.assignment.model.enums.AssignmentStatus.ACTIVE);
        submission.setScore(new BigDecimal("8")); submission.setGradedBy(original);
        submission.setGradingStatus(com.example.backend.system.assignment.model.enums.GradingStatus.TEACHER_CONFIRMED);
        assertThrows(ApiException.class, () -> service.reopen(assignment.getId(), submission.getId()));
        service.reopen(assignment.getId(), submission.getId(), "Repeat the experiment");
        var change = org.mockito.ArgumentCaptor.forClass(AssignmentGradeChange.class); verify(history).save(change.capture());
        assertEquals("REOPENED", change.getValue().getEventType()); assertEquals(new BigDecimal("8"), change.getValue().getPreviousScore());
        assertNull(change.getValue().getNewScore()); assertEquals("Teacher 1", change.getValue().getPreviousGraderName());
        assertTrue(submission.isRetryAllowed()); assertNull(submission.getCompletedAt());
    }

    @Test void historyIsVisibleToCurrentTeacherAndOwnSchoolButNotFormerTeacherOrOtherSchool() {
        when(current.requireCurrentUser()).thenReturn(original);
        assertThrows(ApiException.class, () -> service.gradeHistory(assignment.getId(), submission.getId(), 0, 10));
        when(history.findBySubmissionId(eq(submission.getId()), any())).thenReturn(org.springframework.data.domain.Page.empty());
        when(current.requireCurrentUser()).thenReturn(replacement);
        assertEquals(0, service.gradeHistory(assignment.getId(), submission.getId(), 0, 10).totalElements());
        User admin = new User(); Role role = new Role(); role.setName("SCHOOL"); admin.setRole(role); admin.setSchool(classroom.getSchool());
        when(current.requireCurrentUser()).thenReturn(admin);
        assertEquals(0, service.gradeHistory(assignment.getId(), submission.getId(), 0, 10).totalElements());
        School foreign = new School(); foreign.setId(UUID.randomUUID()); admin.setSchool(foreign);
        assertThrows(ApiException.class, () -> service.gradeHistory(assignment.getId(), submission.getId(), 0, 10));
    }

    @Test void formerTeacherNoLongerListsPreviouslyCreatedClassAssignments() {
        when(current.requireCurrentUser()).thenReturn(original);
        when(assignments.findByTeacherIdOrderByCreatedAtDesc(original.getId())).thenReturn(List.of(assignment));
        assertTrue(service.forTeacher().isEmpty());
    }
}
