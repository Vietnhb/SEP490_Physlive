package com.example.backend.system.school.service;

import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.account.service.*;
import com.example.backend.system.assignment.model.entity.Assignment;
import com.example.backend.system.assignment.repository.AssignmentRepository;
import com.example.backend.system.school.model.entity.*;
import com.example.backend.system.school.repository.*;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class SchoolStudentTransferWorkTest {
    @Test void transferKeepsOldRecipientsAndAddsOnlyOpenTargetWorkWithoutDuplicates() {
        SchoolClassRepository classes = mock(SchoolClassRepository.class);
        ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);
        SchoolRepository schools = mock(SchoolRepository.class);
        UserRepository users = mock(UserRepository.class);
        CurrentUserService current = mock(CurrentUserService.class);
        RoleValidationService roles = mock(RoleValidationService.class);
        AssignmentRepository assignments = mock(AssignmentRepository.class);
        SchoolClassService service = new SchoolClassService(classes, enrollments, mock(ClassTeacherAssignmentRepository.class), schools,
                users, current, roles, mock(LicenseCheckService.class), mock(AccountAccessService.class), mock(EntityManager.class), assignments);
        UUID schoolId = UUID.randomUUID(), oldId = UUID.randomUUID(), targetId = UUID.randomUUID();
        School school = new School(); school.setId(schoolId);
        SchoolClass target = new SchoolClass(); target.setId(targetId); target.setSchool(school); target.setSchoolYear("2026-2027"); target.setIsActive(true);
        SchoolClass previous = new SchoolClass(); previous.setId(oldId); previous.setSchool(school);
        User student = new User(); student.setId(3); student.setSchool(school); student.setActive(true);
        Role studentRole = new Role(); studentRole.setName("STUDENT"); student.setRole(studentRole);
        User actor = new User(); Role manager = new Role(); manager.setName("MANAGER"); actor.setRole(manager);
        ClassEnrollment old = new ClassEnrollment(); old.setSchoolClass(previous); old.setStudent(student); old.setStatus(ClassEnrollment.EnrollmentStatus.ACTIVE);
        when(current.requireCurrentUser()).thenReturn(actor); when(roles.canManageSchool(actor, schoolId)).thenReturn(true);
        when(schools.findByIdForUpdate(schoolId)).thenReturn(Optional.of(school)); when(classes.findById(targetId)).thenReturn(Optional.of(target));
        when(users.findById(3)).thenReturn(Optional.of(student));
        when(enrollments.findActiveEnrollment(3, "2026-2027")).thenAnswer(call -> old.getStatus() == ClassEnrollment.EnrollmentStatus.ACTIVE ? Optional.of(old) : Optional.empty());
        when(enrollments.save(any())).thenAnswer(call -> call.getArgument(0));
        Assignment oldWork = new Assignment(); oldWork.getAssignedStudentIds().add(3);
        Assignment targetWork = new Assignment(), alreadyAssigned = new Assignment(); alreadyAssigned.getAssignedStudentIds().add(3);
        when(assignments.findOpenForTransfer(eq(targetId), any(Instant.class))).thenReturn(List.of(targetWork, alreadyAssigned));
        service.transferStudent(schoolId, targetId, 3);
        assertEquals(ClassEnrollment.EnrollmentStatus.TRANSFERRED, old.getStatus());
        assertTrue(oldWork.getAssignedStudentIds().contains(3)); assertTrue(targetWork.getAssignedStudentIds().contains(3));
        assertEquals(1, alreadyAssigned.getAssignedStudentIds().size());
        verify(assignments).save(targetWork); verify(assignments, never()).save(alreadyAssigned);
        verify(assignments, never()).findOpenForTransfer(eq(oldId), any());
        var order = inOrder(schools, enrollments); order.verify(schools).findByIdForUpdate(schoolId); order.verify(enrollments).findActiveEnrollment(3, "2026-2027");
    }
}
