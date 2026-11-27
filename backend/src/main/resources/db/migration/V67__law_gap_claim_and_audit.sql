-- Add claim tracking and audit trail for law gaps so reviewers can see who claimed and who resolved each item.
ALTER TABLE law_gaps ADD COLUMN IF NOT EXISTS assigned_to_id BIGINT REFERENCES users(id);
ALTER TABLE law_gaps ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS law_gap_audits (
    id UUID PRIMARY KEY,
    law_gap_id UUID NOT NULL REFERENCES law_gaps(id) ON DELETE CASCADE,
    actor_id BIGINT REFERENCES users(id),
    action VARCHAR(32) NOT NULL,
    from_status VARCHAR(24),
    to_status VARCHAR(24),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_law_gap_audits_created_at ON law_gap_audits (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_law_gap_audits_gap_id ON law_gap_audits (law_gap_id, created_at DESC);
