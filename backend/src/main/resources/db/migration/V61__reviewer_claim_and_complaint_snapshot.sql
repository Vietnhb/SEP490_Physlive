ALTER TABLE support_items ADD COLUMN IF NOT EXISTS simulation_snapshot jsonb;
ALTER TABLE support_items ADD COLUMN IF NOT EXISTS assigned_to_id integer REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE support_items ADD COLUMN IF NOT EXISTS law_gap_id uuid REFERENCES law_gaps(id) ON DELETE SET NULL;
ALTER TABLE library_items ADD COLUMN IF NOT EXISTS assigned_to_id integer REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_support_items_assigned_to ON support_items (assigned_to_id) WHERE assigned_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_support_items_law_gap ON support_items (law_gap_id) WHERE law_gap_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_library_items_assigned_to ON library_items (assigned_to_id) WHERE assigned_to_id IS NOT NULL;

CREATE OR REPLACE FUNCTION vn_fold(input text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT translate(
    lower(input),
    'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
  );
$$;

ALTER TABLE law_gaps ADD COLUMN IF NOT EXISTS decided_by_id integer REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE law_gaps ADD COLUMN IF NOT EXISTS decided_at timestamptz;
ALTER TABLE law_gaps ADD COLUMN IF NOT EXISTS source_complaint_id uuid REFERENCES support_items(id) ON DELETE SET NULL;
ALTER TABLE law_gaps DROP CONSTRAINT IF EXISTS law_gaps_kind_check;
ALTER TABLE law_gaps ADD CONSTRAINT law_gaps_kind_check CHECK (kind IN ('UNCHECKED', 'NO_ROLE', 'AMBIGUOUS', 'VIOLATION', 'COMPLAINT'));

CREATE TABLE IF NOT EXISTS schema_version_audits (
    id uuid PRIMARY KEY,
    schema_version_id uuid NOT NULL REFERENCES schema_versions(id) ON DELETE CASCADE,
    actor_id integer REFERENCES users(id) ON DELETE SET NULL,
    action varchar(32) NOT NULL,
    from_status varchar(24),
    to_status varchar(24),
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schema_version_audits_version
    ON schema_version_audits (schema_version_id, created_at DESC);
