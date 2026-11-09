package com.example.backend.system.account.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CurrentUserService {

    private final UserRepository userRepository;

    public User currentUserOrNull() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof org.springframework.security.authentication.AnonymousAuthenticationToken) return null;
        User checked = checkedUser(authentication);
        return checked != null ? checked : userRepository.findByEmail(authentication.getName()).orElse(null);
    }

    public User requireCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw ApiException.unauthorized("Vui lòng đăng nhập để tiếp tục");
        }
        User checked = checkedUser(authentication);
        if (checked != null) return checked;
        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> ApiException.unauthorized("Tài khoản đăng nhập không còn tồn tại"));
    }
    private User checkedUser(Authentication authentication) {
        var attributes = org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
        if (attributes instanceof org.springframework.web.context.request.ServletRequestAttributes servlet) {
            Object checked = servlet.getRequest().getAttribute("physlive.authenticated-user");
            if (checked instanceof User user && authentication.getName().equals(user.getEmail())) return user;
        }
        return null;
    }
}
