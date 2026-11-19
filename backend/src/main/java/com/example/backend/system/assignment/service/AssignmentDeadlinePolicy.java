package com.example.backend.system.assignment.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.assignment.model.entity.Assignment;
import com.example.backend.system.assignment.model.entity.AssignmentSubmission;
import java.time.Instant;

/** The final hand-in timestamp, not the prediction timestamp, determines whether work met the deadline. */
public final class AssignmentDeadlinePolicy {
    public static final String FEEDBACK = "Quá hạn nộp bài. Bài tập không cho phép nộp trễ, hệ thống ghi nhận 0 điểm.";
    private AssignmentDeadlinePolicy() { }
    public static boolean expired(Assignment assignment, Instant now) {
        return !assignment.isAllowLateSubmission() && assignment.getDueAt() != null && !now.isBefore(assignment.getDueAt());
    }
    public static boolean missed(Assignment assignment, AssignmentSubmission submission, Instant now) {
        return expired(assignment, now) && (submission == null || submission.getCompletedAt() == null);
    }
    public static void requireBeforeDeadline(Assignment assignment) {
        if (expired(assignment, Instant.now())) throw ApiException.badRequest(FEEDBACK);
    }
}
