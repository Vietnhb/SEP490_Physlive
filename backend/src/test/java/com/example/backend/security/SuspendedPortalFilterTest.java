package com.example.backend.security;

import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.school.model.entity.School;
import com.example.backend.system.school.service.LicenseCheckService;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import java.util.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SuspendedPortalFilterTest {
    private final JwtUtil jwt = mock(JwtUtil.class);
    private final UserRepository users = mock(UserRepository.class);
    private final LicenseCheckService license = mock(LicenseCheckService.class);
    private final JwtFilter filter = new JwtFilter(jwt, users, license, new ObjectMapper());
    private void setup() {
        User user = new User(); user.setEmail("locked@test.com"); user.setActive(false); user.setMustChangePassword(true);
        Role role = new Role(); role.setName("SCHOOL"); user.setRole(role);
        School school = new School(); school.setActive(false); user.setSchool(school);
        Claims claims = mock(Claims.class); when(claims.getSubject()).thenReturn(user.getEmail());
        when(jwt.extractClaims("token")).thenReturn(claims); when(users.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }
    @Test void portalRemainsAvailableDespiteSchoolLicenseAndPasswordRestrictions() throws Exception {
        setup();
        for (String[] endpoint : List.of(new String[]{"POST", "/api/appeals"}, new String[]{"GET", "/api/appeals/my"},
                new String[]{"GET", "/api/user/me"}, new String[]{"GET", "/api/support/mine"}, new String[]{"POST", "/api/auth/logout"})) {
            var request = new MockHttpServletRequest(endpoint[0], endpoint[1]); request.addHeader("Authorization", "Bearer token");
            var response = new MockHttpServletResponse(); FilterChain chain = mock(FilterChain.class);
            filter.doFilter(request, response, chain);
            verify(chain).doFilter(request, response);
            assertEquals("locked@test.com", SecurityContextHolder.getContext().getAuthentication().getName());
        }
    }
    @Test void allOtherReadsAndWritesAreBlockedIncludingPrefixLookalikes() throws Exception {
        setup();
        for (String[] endpoint : List.of(new String[]{"GET", "/api/admin/appeals"}, new String[]{"GET", "/api/schools/123/users"},
                new String[]{"POST", "/api/support/messages"}, new String[]{"PUT", "/api/user/me/password"},
                new String[]{"POST", "/api/appeals/123/resolve"}, new String[]{"GET", "/api/appeals/my/extra"})) {
            var request = new MockHttpServletRequest(endpoint[0], endpoint[1]); request.addHeader("Authorization", "Bearer token");
            var response = new MockHttpServletResponse(); FilterChain chain = mock(FilterChain.class);
            filter.doFilter(request, response, chain);
            assertEquals(403, response.getStatus()); verifyNoInteractions(chain);
        }
    }
}
