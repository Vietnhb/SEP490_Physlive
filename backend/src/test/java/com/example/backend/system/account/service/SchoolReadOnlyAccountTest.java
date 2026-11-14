package com.example.backend.system.account.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.dto.UpdateManagedUserRequest;
import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.repository.*;
import com.example.backend.system.school.model.entity.School;
import com.example.backend.system.school.repository.SchoolRepository;
import com.example.backend.system.school.service.LicenseCheckService;
import jakarta.persistence.EntityManager;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SchoolReadOnlyAccountTest {
    @Test void schoolCannotModifyAnotherSchoolAccountEvenThroughDirectEndpoints() {
        var users = mock(UserRepository.class); var current = mock(CurrentUserService.class); var access = mock(RoleValidationService.class);
        var service = new AdminService(users, mock(RoleRepository.class), mock(PasswordEncoder.class), current, access,
                mock(AccountAccessService.class), mock(LicenseCheckService.class), mock(SchoolRepository.class), mock(EntityManager.class));
        var school = new School(); school.setId(UUID.randomUUID());
        var role = new Role(); role.setName("SCHOOL");
        var actor = new User(); actor.setId(1); actor.setRole(role); actor.setSchool(school);
        var target = new User(); target.setId(2); target.setRole(role); target.setSchool(school); target.setActive(true); target.setFullName("School account");
        when(current.requireCurrentUser()).thenReturn(actor); when(access.canManageSchool(actor, school.getId())).thenReturn(true);
        when(users.findById(2)).thenReturn(Optional.of(target)); when(users.findByIdForUpdate(2)).thenReturn(Optional.of(target));
        assertThrows(ApiException.class, () -> service.updateUserForSchool(school.getId(), 2, new UpdateManagedUserRequest("Changed", "STUDENT", school.getId().toString())));
        assertThrows(ApiException.class, () -> service.resetPasswordForSchool(school.getId(), 2, "StrongPassword123!"));
        assertThrows(ApiException.class, () -> service.suspendForSchool(school.getId(), 2, "Reason"));
        assertThrows(ApiException.class, () -> service.setActiveForSchool(school.getId(), 2, true));
        assertEquals("School account", target.getFullName()); verify(users, never()).save(any());
    }
}
