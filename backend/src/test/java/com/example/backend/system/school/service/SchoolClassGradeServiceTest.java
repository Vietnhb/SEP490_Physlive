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
    private final SchoolClassGradeService service = new SchoolClassGradeService(classes, enrollments, assignments, submissions, users, current);
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
}
