CREATE TABLE school_customer_emails (
 id uuid PRIMARY KEY, school_id uuid NOT NULL REFERENCES schools(id), actor_id integer NOT NULL REFERENCES users(id), actor_name varchar(255) NOT NULL,
 request_id uuid NOT NULL, recipient varchar(255) NOT NULL, subject varchar(180) NOT NULL, body text NOT NULL CHECK(length(body)<=20000),
 reason varchar(24) NOT NULL, reply_token uuid NOT NULL UNIQUE,
 status varchar(24) NOT NULL DEFAULT 'QUEUED', delivery_rank integer NOT NULL DEFAULT 0, provider_id uuid UNIQUE,
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz,
 last_error varchar(500), created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz, status_at timestamptz,
 UNIQUE(actor_id,request_id), CHECK(status IN('QUEUED','SENDING','UNKNOWN','ACCEPTED','DELAYED','DELIVERED','BOUNCED','COMPLAINED','FAILED')),
 CHECK(reason IN('LICENSE','AI_QUOTA','USAGE','OTHER'))
);
CREATE INDEX idx_customer_emails_school ON school_customer_emails(school_id,created_at DESC,id DESC);
CREATE INDEX idx_customer_emails_queue ON school_customer_emails(next_attempt_at) WHERE status IN('QUEUED','SENDING','UNKNOWN');
CREATE TABLE school_customer_email_events (
 event_id varchar(255) PRIMARY KEY, provider_id uuid, event_type varchar(64) NOT NULL, occurred_at timestamptz NOT NULL,
 delivery_rank integer NOT NULL DEFAULT 0, delivery_status varchar(24), received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_email_events_provider ON school_customer_email_events(provider_id,delivery_rank DESC,occurred_at DESC);
CREATE TABLE school_customer_email_replies (
 id uuid PRIMARY KEY, email_id uuid NOT NULL REFERENCES school_customer_emails(id), provider_id uuid NOT NULL UNIQUE,
 sender varchar(255) NOT NULL, subject varchar(998) NOT NULL, body text NOT NULL CHECK(length(body)<=100000),
 attachments jsonb NOT NULL DEFAULT '[]', received_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_email_replies_thread ON school_customer_email_replies(email_id,received_at,id);
ALTER TABLE school_customer_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_customer_email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_customer_email_replies ENABLE ROW LEVEL SECURITY;
