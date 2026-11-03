package com.example.backend.system.account.service;

import com.example.backend.exception.ApiException;
import com.example.backend.security.JwtUtil;
import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.school.repository.LicensePlanRepository;
import com.example.backend.system.school.service.LicenseCheckService;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SuspendedLoginTest {
    private final UserRepository users = mock(UserRepository.class);
    private final JwtUtil jwt = mock(JwtUtil.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final LicenseCheckService license = mock(LicenseCheckService.class);
    private final AuthService service = new AuthService(users, jwt, encoder, mock(LicensePlanRepository.class), license);
    private final User user = new User();
    private void setup(String roleName, Boolean active) {
        Role role = new Role(); role.setName(roleName); user.setRole(role); user.setEmail("demo@test.com");
        user.setId(1); user.setActive(active); user.setPassword("$2atest");
        when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(encoder.matches("correct", user.getPassword())).thenReturn(true);
        when(jwt.generateToken(user.getEmail(), roleName)).thenReturn("token");
    }
    @Test void lockedSchoolAuthenticatesWithoutUnlocking() {
        setup("SCHOOL", false);
        assertEquals("token", service.login(user.getEmail(), "correct").getToken());
        assertFalse(user.getActive());
    }
    @Test void suspendedStudentCanAppealEvenWhenLicenseExpired() {
        setup("STUDENT", false); user.setMustChangePassword(true);
        assertEquals("token", service.login(user.getEmail(), "correct").getToken());
        assertFalse(user.getActive()); verify(license, never()).isLicenseActive(user);
    }
    @Test void wrongPasswordCannotAuthenticateLockedAccount() {
        setup("SCHOOL", false);
        assertThrows(ApiException.class, () -> service.login(user.getEmail(), "wrong"));
        verifyNoInteractions(jwt);
    }
    @Test void unknownLegacyFlagAndActiveExpiredStudentRemainBlocked() {
        setup("STUDENT", null);
        assertThrows(ApiException.class, () -> service.login(user.getEmail(), "correct"));
        user.setActive(true); user.setMustChangePassword(false);
        assertThrows(ApiException.class, () -> service.login(user.getEmail(), "correct"));
        verifyNoInteractions(jwt);
    }
}
