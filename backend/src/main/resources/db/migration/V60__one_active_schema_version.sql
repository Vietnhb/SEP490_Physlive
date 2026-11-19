-- Keep one approved version per schema family. Historical definitions and saved runs remain intact.
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY lower(schema_id)
    ORDER BY CASE WHEN version ~* '^v?[0-9]+([._-][0-9]+)*$'
      THEN regexp_split_to_array(regexp_replace(lower(version), '^v', ''), '[._-]')::numeric[] ELSE ARRAY[0]::numeric[] END DESC,
      lower(version) DESC, created_at DESC, id DESC
  ) AS position
  FROM schema_versions WHERE lifecycle_status = 'APPROVED'
)
UPDATE schema_versions s SET lifecycle_status = 'RETIRED', updated_at = now(), record_version = record_version + 1
FROM ranked r WHERE s.id = r.id AND r.position > 1;
CREATE UNIQUE INDEX uk_schema_one_approved_family ON schema_versions(lower(schema_id)) WHERE lifecycle_status = 'APPROVED';
