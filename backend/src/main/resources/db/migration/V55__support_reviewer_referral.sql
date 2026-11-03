-- Manager receives simulation complaints first; only referred items enter the review desk.
ALTER TABLE support_items
    ADD COLUMN IF NOT EXISTS reviewer_referred boolean NOT NULL DEFAULT false;
