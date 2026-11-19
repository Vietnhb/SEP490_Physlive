-- Preserve the former late-submission policy for existing assignments.
ALTER TABLE assignments ADD COLUMN allow_late_submission boolean NOT NULL DEFAULT true;
DO $$ DECLARE constraint_row record; BEGIN
  FOR constraint_row IN SELECT conname FROM pg_constraint WHERE conrelid = 'assignment_submissions'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%grading_status%' LOOP
    EXECUTE format('ALTER TABLE assignment_submissions DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;
END $$;
ALTER TABLE assignment_submissions ADD CONSTRAINT assignment_submissions_grading_status_check CHECK (grading_status IN ('PENDING','AI_GRADED','TEACHER_CONFIRMED','RETURNED','MISSED_DEADLINE'));
CREATE INDEX idx_assignments_strict_deadline ON assignments(due_at) WHERE allow_late_submission = false;
