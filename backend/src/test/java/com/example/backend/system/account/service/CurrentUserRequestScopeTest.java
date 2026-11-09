package com.example.backend.system.account.service;

import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CurrentUserRequestScopeTest {
    @Test void reusesOnlyTheIdentityCheckedWithinTheCurrentRequest() {
        var repository = mock(UserRepository.class); var service = new CurrentUserService(repository);
        var checked = new User(); checked.setEmail("first@test.invalid");
        var next = new User(); next.setEmail("next@test.invalid");
        var request = new MockHttpServletRequest(); request.setAttribute("physlive.authenticated-user", checked);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        try {
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(checked.getEmail(), null, java.util.List.of()));
            assertSame(checked, service.requireCurrentUser()); verifyNoInteractions(repository);
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(next.getEmail(), null, java.util.List.of()));
            when(repository.findByEmail(next.getEmail())).thenReturn(Optional.of(next));
            assertSame(next, service.requireCurrentUser()); verify(repository).findByEmail(next.getEmail());
        } finally { RequestContextHolder.resetRequestAttributes(); SecurityContextHolder.clearContext(); }
    }
}
