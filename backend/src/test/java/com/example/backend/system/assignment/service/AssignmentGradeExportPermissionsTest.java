package com.example.backend.system.assignment.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.assignment.controller.AssignmentController;
import com.example.backend.system.assignment.model.entity.Assignment;
import com.example.backend.system.assignment.repository.*;
import com.example.backend.system.school.model.entity.*;
import com.example.backend.system.school.repository.ClassTeacherAssignmentRepository;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class AssignmentGradeExportPermissionsTest {
    final AssignmentRepository assignments = mock(AssignmentRepository.class);
    final AssignmentSubmissionRepository submissions = mock(AssignmentSubmissionRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final CurrentUserService current = mock(CurrentUserService.class);
    final ClassTeacherAssignmentRepository links = mock(ClassTeacherAssignmentRepository.class);
    final AssignmentService service = new AssignmentService(assignments, submissions, null, users, current, null, null, links, null, null);
    final Assignment assignment = new Assignment(); final User actor = new User(); final SchoolClass classroom = new SchoolClass();
    AssignmentGradeExportPermissionsTest() {
        School school = new School(); school.setId(UUID.randomUUID()); actor.setId(10); actor.setSchool(school); actor.setActive(true); Role role = new Role(); role.setName("STAFF"); actor.setRole(role); actor.grantPermission(new Permission("TEACH"), null);
        classroom.setId(UUID.randomUUID()); classroom.setIsActive(true); classroom.setSchool(school);
        assignment.setId(UUID.randomUUID()); assignment.setSchoolClass(classroom); assignment.setTeacher(new User()); assignment.setAssignedStudentIds(Set.of(7));
        when(current.requireCurrentUser()).thenReturn(actor); when(assignments.findById(assignment.getId())).thenReturn(Optional.of(assignment));
    }
    @Test void currentReplacementTeacherCanExportWithoutChangingOriginalAuthor() {
        when(links.existsBySchoolClassIdAndTeacherIdAndIsActiveTrue(classroom.getId(), actor.getId())).thenReturn(true);
        when(users.findAllById(Set.of(7))).thenReturn(List.of()); when(submissions.findByAssignmentIdIn(List.of(assignment.getId()))).thenReturn(List.of());
        assertTrue(service.exportGrades(assignment.getId()).length > 0);
        verify(users).findAllById(Set.of(7)); verify(submissions).findByAssignmentIdIn(List.of(assignment.getId()));
    }
    @Test void formerTeacherCrossSchoolAndInactiveClassCannotExport() {
        assertThrows(ApiException.class, () -> service.exportGrades(assignment.getId()));
        when(links.existsBySchoolClassIdAndTeacherIdAndIsActiveTrue(classroom.getId(), actor.getId())).thenReturn(true);
        School other = new School(); other.setId(UUID.randomUUID()); actor.setSchool(other);
        assertThrows(ApiException.class, () -> service.exportGrades(assignment.getId()));
        actor.setSchool(classroom.getSchool()); classroom.setIsActive(false);
        assertThrows(ApiException.class, () -> service.exportGrades(assignment.getId())); verifyNoInteractions(users, submissions);
    }
    @ParameterizedTest @ValueSource(strings = {"STUDENT", "SCHOOL", "MANAGER"}) void nonTeacherRolesCannotExportEvenWithAnAssignmentId(String roleName) {
        actor.getRole().setName(roleName); assertThrows(ApiException.class, () -> service.exportGrades(assignment.getId())); verifyNoInteractions(users, submissions);
    }
    @Test void controllerReturnsAnAttachmentWithUtf8CsvContentType() {
        AssignmentService stub = mock(AssignmentService.class); byte[] csv = "sample".getBytes(); when(stub.exportGrades(assignment.getId())).thenReturn(csv);
        var result = new AssignmentController(stub).exportGrades(assignment.getId());
        assertEquals("text/csv;charset=UTF-8", result.getHeaders().getContentType().toString()); assertEquals("attachment", result.getHeaders().getContentDisposition().getType()); assertArrayEquals(csv, result.getBody());
    }
}
