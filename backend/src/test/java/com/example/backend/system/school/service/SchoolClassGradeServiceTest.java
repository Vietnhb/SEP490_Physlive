package com.example.backend.system.school.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.assignment.model.entity.*;
import com.example.backend.system.assignment.model.enums.*;
import com.example.backend.system.assignment.repository.*;
import com.example.backend.system.school.model.entity.*;
import com.example.backend.system.school.repository.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SchoolClassGradeServiceTest {
    private final SchoolClassRepository classes = mock(SchoolClassRepository.class);
    private final ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);
    private final AssignmentRepository assignments = mock(AssignmentRepository.class);
    private final AssignmentSubmissionRepository submissions = mock(AssignmentSubmissionRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final CurrentUserService current = mock(CurrentUserService.class);
    private final ClassTeacherAssignmentRepository teacherLinks = mock(ClassTeacherAssignmentRepository.class);
    private final SchoolClassGradeService service = new SchoolClassGradeService(classes, enrollments, assignments, submissions, users, current, teacherLinks);
    private final UUID schoolId = UUID.randomUUID(), classId = UUID.randomUUID();
    private final School school = new School();
    private final User student = new User(), actor = new User(), teacher = new User();
    private final Assignment assignment = new Assignment();
    private final AssignmentSubmission submission = new AssignmentSubmission();
    private final ClassEnrollment enrollment = new ClassEnrollment();

    @BeforeEach void setup() {
        school.setId(schoolId);
        Role role = new Role(); role.setName("SCHOOL"); actor.setRole(role); actor.setSchool(school);
        student.setId(2); student.setFullName("Học sinh cũ"); student.setEmail("old@test.com");
        teacher.setFullName("Giáo viên mới");
        SchoolClass classroom = new SchoolClass(); classroom.setId(classId); classroom.setSchool(school); classroom.setName("10A1"); classroom.setSchoolYear("2026-2027");
        assignment.setId(UUID.randomUUID()); assignment.setTeacher(teacher); assignment.setTitle("Bài tập 1"); assignment.setSchoolClass(classroom); assignment.getAssignedStudentIds().add(2);
        enrollment.setStudent(student); enrollment.setStatus(ClassEnrollment.EnrollmentStatus.TRANSFERRED);
        submission.setAssignment(assignment); submission.setStudent(student); submission.setScore(BigDecimal.ZERO); submission.setMaxScore(BigDecimal.TEN);
        submission.setCompletedAt(Instant.now()); submission.setGradingStatus(GradingStatus.TEACHER_CONFIRMED); submission.setGradedBy(teacher); submission.setFeedback("Cần làm lại lập luận");
        when(current.requireCurrentUser()).thenReturn(actor);
        when(classes.findById(classId)).thenReturn(Optional.of(classroom));
        when(assignments.findBySchoolClassIdOrderByAssignedAtDesc(classId)).thenReturn(List.of(assignment));
        when(enrollments.findByClassId(classId)).thenReturn(List.of(enrollment));
        when(users.findAllById(any())).thenReturn(List.of(student));
        when(submissions.findByAssignmentIdIn(any())).thenReturn(List.of(submission));
    }
    @Test void strictOverdueMissingAndPredictionOnlyReceiveZeroButCompletedWorkKeepsGrade() {
        assignment.setAllowLateSubmission(false); assignment.setDueAt(Instant.now().minusSeconds(10));
        when(submissions.findByAssignmentIdIn(any())).thenReturn(List.of());
        var missing = service.get(schoolId, classId).students().getFirst().cells().getFirst();
        assertEquals("MISSED_DEADLINE", missing.state()); assertEquals(BigDecimal.ZERO, missing.score());
        assertTrue(new String(service.csv(schoolId, classId), StandardCharsets.UTF_8).contains("Quá hạn · Không nộp (0 điểm)"));
        submission.setCompletedAt(null); when(submissions.findByAssignmentIdIn(any())).thenReturn(List.of(submission));
        assertEquals("MISSED_DEADLINE", service.get(schoolId, classId).students().getFirst().cells().getFirst().state());
        submission.setCompletedAt(assignment.getDueAt().minusSeconds(20)); submission.setScore(BigDecimal.TEN);
        var complete = service.get(schoolId, classId).students().getFirst().cells().getFirst();
        assertEquals("TEACHER_CONFIRMED", complete.state()); assertEquals(BigDecimal.TEN, complete.score());
        assignment.setAllowLateSubmission(true); submission.setCompletedAt(null);
        var late = service.get(schoolId, classId).students().getFirst().cells().getFirst();
        assertEquals("IN_PROGRESS", late.state()); assertNull(late.score());
    }
    @Test void formerStudentKeepsZeroGradeFeedbackAndActualGrader() {
        var row = service.get(schoolId, classId).students().getFirst();
        assertFalse(row.current()); assertEquals(BigDecimal.ZERO, row.cells().getFirst().score());
        assertEquals("Giáo viên mới", row.cells().getFirst().gradedBy()); assertEquals("Cần làm lại lập luận", row.cells().getFirst().feedback());
    }
    @Test void missingSubmissionAndUngradedAreNotZero() {
        when(submissions.findByAssignmentIdIn(any())).thenReturn(List.of());
        var cell = service.get(schoolId, classId).students().getFirst().cells().getFirst();
        assertEquals("NOT_STARTED", cell.state()); assertNull(cell.score());
        when(submissions.findByAssignmentIdIn(any())).thenReturn(List.of(submission)); submission.setScore(null);
        assertEquals("SUBMITTED", service.get(schoolId, classId).students().getFirst().cells().getFirst().state());
    }
    @Test void transferredStudentStartsNewClassWithoutImportingOldGrades() {
        UUID targetId = UUID.randomUUID();
        SchoolClass target = new SchoolClass(); target.setId(targetId); target.setSchool(school); target.setName("10A2"); target.setSchoolYear("2026-2027");
        Assignment newWork = new Assignment(); newWork.setId(UUID.randomUUID()); newWork.setSchoolClass(target); newWork.setTeacher(teacher);
        newWork.setTitle("New class work"); newWork.getAssignedStudentIds().add(student.getId());
        ClassEnrollment joined = new ClassEnrollment(); joined.setStudent(student); joined.setSchoolClass(target); joined.setStatus(ClassEnrollment.EnrollmentStatus.ACTIVE);
        when(classes.findById(targetId)).thenReturn(Optional.of(target));
        when(assignments.findBySchoolClassIdOrderByAssignedAtDesc(targetId)).thenReturn(List.of(newWork));
        when(enrollments.findByClassId(targetId)).thenReturn(List.of(joined));
        when(submissions.findByAssignmentIdIn(List.of(newWork.getId()))).thenReturn(List.of());
        var newRow = service.get(schoolId, targetId).students().getFirst();
        assertTrue(newRow.current()); assertNull(newRow.cells().getFirst().score());
        assertEquals("NOT_STARTED", newRow.cells().getFirst().state());
        assertEquals(newWork.getId(), newRow.cells().getFirst().assignmentId());
        var oldRow = service.get(schoolId, classId).students().getFirst();
        assertFalse(oldRow.current()); assertEquals(BigDecimal.ZERO, oldRow.cells().getFirst().score());
        assertEquals(assignment.getId(), oldRow.cells().getFirst().assignmentId());
    }
    @Test void currentStudentNotAssignedToOldWorkIsExplicitlyUnassigned() {
        enrollment.setStatus(ClassEnrollment.EnrollmentStatus.ACTIVE); assignment.getAssignedStudentIds().clear();
        when(submissions.findByAssignmentIdIn(any())).thenReturn(List.of());
        var row = service.get(schoolId, classId).students().getFirst();
        assertTrue(row.current()); assertEquals("NOT_ASSIGNED", row.cells().getFirst().state());
    }
    @Test void blocksForeignSchoolRolesAndClassIdsBeforeReadingResults() {
        School other = new School(); other.setId(UUID.randomUUID()); actor.setSchool(other);
        assertThrows(ApiException.class, () -> service.get(schoolId, classId));
        actor.setSchool(school); actor.getRole().setName("STAFF");
        assertThrows(ApiException.class, () -> service.get(schoolId, classId));
        actor.getRole().setName("SCHOOL");
        classes.findById(classId).orElseThrow().setSchool(other);
        assertThrows(ApiException.class, () -> service.get(schoolId, classId));
        verifyNoInteractions(submissions);
    }
    @Test void csvPreservesHistoryAndEscapesSpreadsheetFormulas() {
        student.setFullName("=HYPERLINK(\"unsafe\")");
        String csv = new String(service.csv(schoolId, classId), StandardCharsets.UTF_8);
        assertTrue(csv.startsWith("\uFEFF")); assertTrue(csv.contains("Đã rời lớp"));
        assertTrue(csv.contains("'=HYPERLINK")); assertTrue(csv.contains("\"0\",\"10\""));
    }

    private void teachingActor() {
        actor.setId(101); actor.setActive(true);
        Role role = new Role(); role.setName("STAFF"); actor.setRole(role);
        actor.grantPermission(new Permission("TEACH"), null);
        classes.findById(classId).orElseThrow().setIsActive(true);
    }
    @Test void currentTeacherCanReadHistoricalGradesAndAnotherAssignedClass() {
        teachingActor();
        when(teacherLinks.existsBySchoolClassIdAndTeacherIdAndIsActiveTrue(classId, 101)).thenReturn(true);
        assertEquals(BigDecimal.ZERO, service.forTeacher(classId).students().getFirst().cells().getFirst().score());
        UUID secondId = UUID.randomUUID(); SchoolClass second = new SchoolClass();
        second.setId(secondId); second.setSchool(school); second.setName("10A2"); second.setSchoolYear("2026-2027"); second.setIsActive(true);
        when(classes.findById(secondId)).thenReturn(Optional.of(second));
        when(teacherLinks.existsBySchoolClassIdAndTeacherIdAndIsActiveTrue(secondId, 101)).thenReturn(true);
        when(assignments.findBySchoolClassIdOrderByAssignedAtDesc(secondId)).thenReturn(List.of());
        when(enrollments.findByClassId(secondId)).thenReturn(List.of());
        assertEquals(secondId, service.forTeacher(secondId).classId());
    }
    @Test void teacherLosesGradebookAccessImmediatelyAfterUnassignment() {
        teachingActor();
        assertThrows(ApiException.class, () -> service.forTeacher(classId));
        verify(assignments, never()).findBySchoolClassIdOrderByAssignedAtDesc(any());
    }
    @Test void teacherCannotReadOtherSchoolOrInactiveClass() {
        teachingActor();
        var classroom = classes.findById(classId).orElseThrow(); classroom.setIsActive(false);
        when(teacherLinks.existsBySchoolClassIdAndTeacherIdAndIsActiveTrue(classId, 101)).thenReturn(true);
        assertThrows(ApiException.class, () -> service.forTeacher(classId));
        classroom.setIsActive(true); School foreign = new School(); foreign.setId(UUID.randomUUID()); classroom.setSchool(foreign);
        assertThrows(ApiException.class, () -> service.forTeacher(classId));
        verify(assignments, never()).findBySchoolClassIdOrderByAssignedAtDesc(any());
    }
    @Test void staffWithoutTeachingPermissionOrInactiveAccountCannotReadGradebook() {
        teachingActor(); actor.getPermissions().clear();
        assertThrows(ApiException.class, () -> service.forTeacher(classId));
        actor.grantPermission(new Permission("TEACH"), null); actor.setActive(false);
        assertThrows(ApiException.class, () -> service.forTeacher(classId));
    }
}
