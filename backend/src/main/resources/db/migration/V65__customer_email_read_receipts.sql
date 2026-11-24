CREATE TABLE school_customer_email_reads (
 actor_id integer NOT NULL REFERENCES users(id),
 reply_id uuid NOT NULL REFERENCES school_customer_email_replies(id) ON DELETE CASCADE,
 read_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,reply_id)
);
CREATE INDEX idx_customer_email_reply_created ON school_customer_email_replies(email_id,created_at DESC);
CREATE INDEX idx_customer_email_actor ON school_customer_emails(actor_id,created_at DESC);
ALTER TABLE school_customer_email_reads ENABLE ROW LEVEL SECURITY;
