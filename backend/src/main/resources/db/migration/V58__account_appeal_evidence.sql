CREATE TABLE account_appeal_evidence (
    id uuid PRIMARY KEY,
    appeal_id uuid NOT NULL REFERENCES account_appeals(id),
    content_type varchar(32) NOT NULL,
    content bytea NOT NULL,
    CONSTRAINT ck_appeal_evidence_type CHECK (content_type IN ('image/jpeg', 'image/png')),
    CONSTRAINT ck_appeal_evidence_size CHECK (octet_length(content) BETWEEN 1 AND 2097152)
);
CREATE INDEX ix_appeal_evidence_appeal ON account_appeal_evidence(appeal_id);
