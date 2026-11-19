package com.example.backend.system.assignment.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Persist deadline zeros without pretending the student handed in work. Idempotent across servers/restarts. */
@Service
@RequiredArgsConstructor
public class AssignmentDeadlineSettlement {
    private final JdbcTemplate jdbc;
    @Scheduled(fixedDelay = 30_000)
    @Transactional
    public void settle() {
        jdbc.update("""
            INSERT INTO assignment_submissions (id, created_at, updated_at, assignment_id, student_id, predictions,
                submitted_at, score, max_score, feedback, grading_status, graded_at, retry_allowed)
            SELECT gen_random_uuid(), now(), now(), a.id, recipient.student_id, '{}'::jsonb,
                a.due_at, 0, a.max_score, ?, 'MISSED_DEADLINE', a.due_at, false
            FROM assignments a JOIN assignment_students recipient ON recipient.assignment_id = a.id
            WHERE a.allow_late_submission = false AND a.due_at <= now()
            ON CONFLICT (assignment_id, student_id) DO NOTHING
            """, AssignmentDeadlinePolicy.FEEDBACK);
        jdbc.update("""
            UPDATE assignment_submissions s SET score = 0, max_score = a.max_score,
                feedback = ?, grading_status = 'MISSED_DEADLINE', graded_at = a.due_at, retry_allowed = false, updated_at = now()
            FROM assignments a WHERE s.assignment_id = a.id AND a.allow_late_submission = false AND a.due_at <= now()
                AND s.completed_at IS NULL AND s.grading_status <> 'MISSED_DEADLINE'
            """, AssignmentDeadlinePolicy.FEEDBACK);
    }
}
