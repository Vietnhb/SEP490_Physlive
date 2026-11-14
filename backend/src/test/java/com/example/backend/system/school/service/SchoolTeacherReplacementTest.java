package com.example.backend.system.school.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.account.service.*;
import com.example.backend.system.school.model.entity.*;
import com.example.backend.system.school.repository.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SchoolTeacherReplacementTest {
    final SchoolClassRepository classes = mock(SchoolClassRepository.class);
    final ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);
    final ClassTeacherAssignmentRepository teachers = mock(ClassTeacherAssignmentRepository.class);
    final SchoolRepository schools = mock(SchoolRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final CurrentUserService current = mock(CurrentUserService.class);
    final RoleValidationService roles = mock(RoleValidationService.class);
    final AccountAccessService access = mock(AccountAccessService.class);
    final com.example.backend.system.assignment.repository.AssignmentRepository work = mock(com.example.backend.system.assignment.repository.AssignmentRepository.class);
    final SchoolClassService service = new SchoolClassService(classes, enrollments, teachers, schools, users, current, roles,
            mock(LicenseCheckService.class), access, mock(jakarta.persistence.EntityManager.class), work);
    final School school = new School(); final SchoolClass classroom = new SchoolClass();
    final User actor = new User(), previous = new User(), next = new User();
    final ClassTeacherAssignment oldLink = new ClassTeacherAssignment();
    @BeforeEach void setup() {
        school.setId(UUID.randomUUID()); classroom.setId(UUID.randomUUID()); classroom.setSchool(school); classroom.setIsActive(true);
        Role role = new Role(); role.setName("SCHOOL"); actor.setRole(role); actor.setSchool(school);
        previous.setId(1); previous.setFullName("Original"); next.setId(2); next.setFullName("Replacement"); next.setSchool(school);
        Role staff = new Role(); staff.setName("STAFF"); next.setRole(staff);
        oldLink.setTeacher(previous); oldLink.setSchoolClass(classroom);
        when(current.requireCurrentUser()).thenReturn(actor); when(roles.canManageSchool(actor, school.getId())).thenReturn(true);
        when(schools.findByIdForUpdate(school.getId())).thenReturn(Optional.of(school)); when(classes.findById(classroom.getId())).thenReturn(Optional.of(classroom));
        when(teachers.findByClassIdAndIsActiveTrue(classroom.getId())).thenReturn(List.of(oldLink));
        when(users.findById(2)).thenReturn(Optional.of(next)); when(access.canTeach(next)).thenReturn(true);
        when(teachers.save(any())).thenAnswer(call -> call.getArgument(0));
    }
    @Test void replacesOnlyMembershipAndKeepsClassWorkAndStudentsUntouched() {
        var result = service.replaceTeacher(school.getId(), classroom.getId(), 2, 1);
        assertFalse(oldLink.getIsActive()); assertEquals(2, result.teacherId());
        var order = inOrder(schools, teachers);
        order.verify(schools).findByIdForUpdate(school.getId()); order.verify(teachers).findByClassIdAndIsActiveTrue(classroom.getId());
        order.verify(teachers).saveAndFlush(oldLink); order.verify(teachers).findBySchoolClassIdAndTeacherId(classroom.getId(), 2);
        order.verify(teachers).save(any()); verifyNoInteractions(enrollments, work);
    }
    @Test void staleExpectedTeacherCannotOverwriteNewAssignment() {
        assertThrows(ApiException.class, () -> service.replaceTeacher(school.getId(), classroom.getId(), 2, 99));
        assertTrue(oldLink.getIsActive()); verify(teachers, never()).saveAndFlush(any());
    }
    @Test void invalidReplacementCannotDeactivateExistingTeacher() {
        when(access.canTeach(next)).thenReturn(false);
        assertThrows(ApiException.class, () -> service.replaceTeacher(school.getId(), classroom.getId(), 2, 1));
        assertTrue(oldLink.getIsActive()); verify(teachers, never()).saveAndFlush(any());
    }
    @Test void replacementMustBelongToSameSchool() {
        var other = new School(); other.setId(UUID.randomUUID()); next.setSchool(other);
        assertThrows(ApiException.class, () -> service.replaceTeacher(school.getId(), classroom.getId(), 2, 1));
        assertTrue(oldLink.getIsActive());
    }
    @Test void existingAssignmentOfReplacementToAnotherClassIsNotRemoved() {
        service.replaceTeacher(school.getId(), classroom.getId(), 2, 1);
        verify(teachers, never()).findActiveByTeacherId(any());
        verify(teachers, never()).delete(any());
    }
}
