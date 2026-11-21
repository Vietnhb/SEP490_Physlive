CREATE TABLE account_administration_audits (
 id uuid PRIMARY KEY, occurred_at timestamptz NOT NULL DEFAULT now(),
 actor_id integer NOT NULL, actor_name varchar(120) NOT NULL, actor_role varchar(40) NOT NULL,
 target_id integer NOT NULL, target_name varchar(120) NOT NULL, target_email varchar(255) NOT NULL,
 action varchar(32) NOT NULL, reason text, before_state text NOT NULL, after_state text NOT NULL
);
CREATE INDEX idx_account_admin_audit_time ON account_administration_audits(occurred_at DESC, id DESC);
CREATE INDEX idx_account_admin_audit_target ON account_administration_audits(target_id, occurred_at DESC);
