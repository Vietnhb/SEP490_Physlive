-- Additive audit trail. Existing grades remain unchanged; the first edit captures their previous values.
CREATE TABLE assignment_grade_changes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    submission_id uuid NOT NULL REFERENCES assignment_submissions(id),
    actor_id integer REFERENCES users(id),
    actor_name varchar(255) NOT NULL,
    event_type varchar(24) NOT NULL,
    previous_score numeric(8,3),
    new_score numeric(8,3),
    previous_feedback text,
    new_feedback text,
    previous_status varchar(32),
    new_status varchar(32),
    previous_grader_id integer,
    previous_grader_name varchar(255),
    previous_graded_at timestamptz,
    reason varchar(2000),
    CONSTRAINT ck_grade_change_event CHECK (event_type IN ('GRADED', 'AUTO_GRADED', 'REOPENED'))
);
CREATE INDEX ix_grade_changes_submission_time ON assignment_grade_changes(submission_id, created_at DESC, id DESC);
