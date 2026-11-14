package com.example.backend.system.school.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** School-facing profile. Credentials and unrelated account data are never returned. */
public record SchoolAccountProfile(Integer id, String fullName, String email, String avatarUrl,
        LocalDate dateOfBirth, String role, List<String> permissions, boolean active,
        String accountStatus, Instant lastLogin, UUID schoolId, String schoolName,
        List<ClassInfo> classes) {
    public record ClassInfo(UUID id, String name, int gradeLevel, String schoolYear, String subject) { }
}
