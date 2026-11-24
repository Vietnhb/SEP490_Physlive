CREATE TABLE school_customer_contacts (
 id uuid PRIMARY KEY,
 school_id uuid NOT NULL REFERENCES schools(id),
 actor_id integer NOT NULL REFERENCES users(id),
 actor_name varchar(255) NOT NULL,
 channel varchar(16) NOT NULL CHECK (channel IN ('EMAIL','PHONE','OTHER')),
 reason varchar(24) NOT NULL CHECK (reason IN ('LICENSE','AI_QUOTA','USAGE','OTHER')),
 outcome varchar(24) NOT NULL CHECK (outcome IN ('NO_ANSWER','WAITING','CONTACTED','RESOLVED')),
 recipient varchar(255), note varchar(2000) NOT NULL,
 contacted_at timestamptz NOT NULL, next_follow_up_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (next_follow_up_at IS NULL OR next_follow_up_at > contacted_at),
 CHECK (outcome <> 'RESOLVED' OR next_follow_up_at IS NULL)
);
CREATE INDEX idx_school_customer_contacts_latest ON school_customer_contacts(school_id,contacted_at DESC,created_at DESC,id DESC);
CREATE INDEX idx_school_customer_contacts_followup ON school_customer_contacts(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
