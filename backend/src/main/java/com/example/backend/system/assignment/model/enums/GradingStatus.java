package com.example.backend.system.assignment.model.enums;

public enum GradingStatus {
    PENDING,
    /** A score the teacher saved without confirming yet. The name is kept because stored rows and the DB check use it. */
    AI_GRADED,
    TEACHER_CONFIRMED,
    MISSED_DEADLINE,
    RETURNED
}
