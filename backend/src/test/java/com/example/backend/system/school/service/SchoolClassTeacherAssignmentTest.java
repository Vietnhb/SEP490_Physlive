package com.example.backend.system.school.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.Role;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.account.service.AccountAccessService;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.account.service.RoleValidationService;
import com.example.backend.system.school.model.entity.ClassTeacherAssignment;
import com.example.backend.system.school.model.entity.School;
import com.example.backend.system.school.model.entity.SchoolClass;
import com.example.backend.system.school.repository.*;
import jakarta.persistence.EntityManager;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SchoolClassTeacherAssignmentTest {
    private final SchoolClassRepository classes = mock(SchoolClassRepository.class);
    private final ClassTeacherAssignmentRepository assignments = mock(ClassTeacherAssignmentRepository.class);
    private final SchoolRepository schools = mock(SchoolRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final CurrentUserService currentUser = mock(CurrentUserService.class);
    private final RoleValidationService roles = mock(RoleValidationService.class);
    private final AccountAccessService access = mock(AccountAccessService.class);
    private final SchoolClassService service = new SchoolClassService(classes, mock(ClassEnrollmentRepository.class),
            assignments, schools, users, currentUser, roles, mock(LicenseCheckService.class), access, mock(EntityManager.class), mock(com.example.backend.system.assignment.repository.AssignmentRepository.class));
    private final UUID schoolId = UUID.randomUUID(), classId = UUID.randomUUID();
    private final User teacher = new User();

    @BeforeEach
    void setup() {
        School school = new School(); school.setId(schoolId);
        SchoolClass classroom = new SchoolClass(); classroom.setId(classId); classroom.setSchool(school); classroom.setIsActive(true);
        Role managerRole = new Role(); managerRole.setName("MANAGER");
        User actor = new User(); actor.setRole(managerRole);
        Role teacherRole = new Role(); teacherRole.setName("STAFF");
        teacher.setId(42); teacher.setRole(teacherRole); teacher.setSchool(school); teacher.setActive(true);
        when(currentUser.requireCurrentUser()).thenReturn(actor);
        when(roles.canManageSchool(actor, schoolId)).thenReturn(true);
        when(schools.findByIdForUpdate(schoolId)).thenReturn(Optional.of(school));
        when(classes.findById(classId)).thenReturn(Optional.of(classroom));
        when(users.findById(42)).thenReturn(Optional.of(teacher));
        when(access.canTeach(teacher)).thenReturn(true);
        when(assignments.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void rejectsSecondTeacherForSameClass() {
        when(assignments.existsBySchoolClassIdAndTeacherIdNotAndIsActiveTrue(classId, 42)).thenReturn(true);
        assertEquals(HttpStatus.CONFLICT, assertThrows(ApiException.class, () -> service.assignTeacher(schoolId, classId, 42)).getStatus());
        verify(assignments, never()).save(any());
    }

    @Test
    void allowsSameTeacherToTeachMultipleClasses() {
        UUID secondClassId = UUID.randomUUID();
        SchoolClass secondClass = new SchoolClass();
        secondClass.setId(secondClassId); secondClass.setSchool(teacher.getSchool()); secondClass.setIsActive(true);
        when(classes.findById(secondClassId)).thenReturn(Optional.of(secondClass));

        assertEquals(42, service.assignTeacher(schoolId, classId, 42).teacherId());
        assertEquals(42, service.assignTeacher(schoolId, secondClassId, 42).teacherId());

        var saved = org.mockito.ArgumentCaptor.forClass(ClassTeacherAssignment.class);
        verify(assignments, times(2)).save(saved.capture());
        assertEquals(java.util.List.of(classId, secondClassId), saved.getAllValues().stream()
                .map(item -> item.getSchoolClass().getId()).toList());
        assertTrue(saved.getAllValues().stream().allMatch(item -> item.getTeacher() == teacher && item.getIsActive()));
    }

    @Test
    void allowsFirstAssignment() {
        assertEquals(42, service.assignTeacher(schoolId, classId, 42).teacherId());
        var order = inOrder(schools, assignments);
        order.verify(schools).findByIdForUpdate(schoolId);
        order.verify(assignments).existsBySchoolClassIdAndTeacherIdNotAndIsActiveTrue(classId, 42);
    }

    @Test
    void reusesExistingInactiveAssignment() {
        ClassTeacherAssignment existing = new ClassTeacherAssignment(); existing.setIsActive(false);
        when(assignments.findBySchoolClassIdAndTeacherId(classId, 42)).thenReturn(Optional.of(existing));
        service.assignTeacher(schoolId, classId, 42);
        assertTrue(existing.getIsActive());
        verify(assignments).save(existing);
    }
}
