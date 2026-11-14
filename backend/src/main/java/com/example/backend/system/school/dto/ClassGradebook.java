package com.example.backend.system.school.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ClassGradebook(UUID classId, String className, String schoolYear,
                             List<Assignment> assignments, List<Student> students) {
    public record Assignment(UUID id, String title, String status, BigDecimal maxScore,
                             String assignedBy, Instant dueAt) { }
    public record Student(Integer id, String fullName, String email, boolean current, List<Cell> cells) { }
    public record Cell(UUID assignmentId, String state, BigDecimal score, BigDecimal maxScore,
                       String feedback, String gradedBy, Instant gradedAt, Instant completedAt, UUID submissionId) { }
}
