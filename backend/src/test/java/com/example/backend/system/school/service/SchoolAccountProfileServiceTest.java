package com.example.backend.system.school.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.Role;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.school.model.entity.School;
import com.example.backend.system.school.repository.SchoolClassRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SchoolAccountProfileServiceTest {
    final CurrentUserService current = mock(CurrentUserService.class);
    final UserRepository users = mock(UserRepository.class);
    final SchoolClassRepository classes = mock(SchoolClassRepository.class);
    final SchoolAccountProfileService service = new SchoolAccountProfileService(current, users, classes);
    final School school = new School();
    User actor;

    @BeforeEach void setup() {
        school.setId(UUID.randomUUID()); school.setName("School A");
        actor = user(1, "SCHOOL", school);
        when(current.requireCurrentUser()).thenReturn(actor);
    }

    User user(int id, String roleName, School owner) {
        var role = new Role(); role.setName(roleName);
        var user = new User(); user.setId(id); user.setRole(role); user.setSchool(owner);
        user.setFullName("Profile fixture"); user.setEmail("profile@test.invalid");
        user.setPassword("private-test-hash"); return user;
    }

    @Test void returnsTeacherProfileAndCurrentClassesWithoutCredentials() throws Exception {
        var teacher = user(2, "STAFF", school);
        teacher.setDateOfBirth(java.time.LocalDate.of(1990, 1, 15));
        when(users.findById(2)).thenReturn(Optional.of(teacher));
        var classroom = mock(SchoolClassRepository.ProfileClass.class);
        when(classroom.getId()).thenReturn(UUID.randomUUID()); when(classroom.getName()).thenReturn("10A1");
        when(classroom.getGradeLevel()).thenReturn(10); when(classroom.getSchoolYear()).thenReturn("2026-2027");
        when(classes.profileTeacherClasses(school.getId(), 2)).thenReturn(List.of(classroom));
        var profile = service.profile(school.getId(), 2);
        assertEquals("STAFF", profile.role()); assertEquals(teacher.getDateOfBirth(), profile.dateOfBirth());
        assertEquals("10A1", profile.classes().getFirst().name());
        String json = new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().writeValueAsString(profile);
        assertFalse(json.contains("password")); assertFalse(json.contains("private-test-hash"));
        verify(classes, never()).profileStudentClasses(any(), any());
    }

    @Test void canViewSuspendedStudentWithoutChangingAccountState() {
        var student = user(3, "STUDENT", school); student.setActive(false);
        student.setAccountStatus("SUSPENDED_READ_ONLY");
        when(users.findById(3)).thenReturn(Optional.of(student));
        when(classes.profileStudentClasses(school.getId(), 3)).thenReturn(List.of());
        var profile = service.profile(school.getId(), 3);
        assertFalse(profile.active()); assertTrue(profile.classes().isEmpty());
        verify(users, never()).save(any()); verify(classes, never()).profileTeacherClasses(any(), any());
    }

    @Test void rejectsSchoolIdOutsideActorsSchoolBeforeReadingTarget() {
        var error = assertThrows(ApiException.class, () -> service.profile(UUID.randomUUID(), 2));
        assertEquals(HttpStatus.FORBIDDEN, error.getStatus()); verifyNoInteractions(users, classes);
    }

    @Test void hidesAccountsOutsideSchoolAndNonTeacherStudentRoles() {
        var other = new School(); other.setId(UUID.randomUUID());
        for (var target : List.of(user(2, "STUDENT", other), user(2, "SCHOOL", school), user(2, "MANAGER", school))) {
            when(users.findById(2)).thenReturn(Optional.of(target));
            assertEquals(HttpStatus.NOT_FOUND, assertThrows(ApiException.class, () -> service.profile(school.getId(), 2)).getStatus());
        }
        verifyNoInteractions(classes);
    }

    @Test void rejectsNonSchoolActorsIncludingDepartmentHeadAndManager() {
        for (String role : List.of("STAFF", "STUDENT", "MANAGER", "REVIEWER", "ADMIN")) {
            actor.getRole().setName(role);
            assertEquals(HttpStatus.FORBIDDEN, assertThrows(ApiException.class, () -> service.profile(school.getId(), 2)).getStatus());
        }
        verifyNoInteractions(users, classes);
    }

    @Test void suspendedSchoolCannotReadProfiles() {
        actor.setActive(false);
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ApiException.class, () -> service.profile(school.getId(), 2)).getStatus());
        verifyNoInteractions(users, classes);
    }
}
