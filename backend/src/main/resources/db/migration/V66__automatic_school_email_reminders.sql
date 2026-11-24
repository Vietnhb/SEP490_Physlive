ALTER TABLE school_customer_emails ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE school_customer_emails ADD COLUMN reminder_key varchar(120);
CREATE UNIQUE INDEX uq_school_email_reminder ON school_customer_emails(school_id,reminder_key) WHERE reminder_key IS NOT NULL;
ALTER TABLE school_customer_emails DROP CONSTRAINT school_customer_emails_status_check;
ALTER TABLE school_customer_emails ADD CONSTRAINT school_customer_emails_status_check CHECK(status IN('QUEUED','SENDING','UNKNOWN','ACCEPTED','DELAYED','DELIVERED','BOUNCED','COMPLAINED','FAILED','SKIPPED'));
ALTER TABLE school_customer_emails ADD CONSTRAINT school_email_reminder_sender_check CHECK(reminder_key IS NULL OR actor_id IS NULL);
UPDATE school_customer_emails SET status='SKIPPED',last_error='Đã ngừng gửi email thủ công. Thư chưa gửi được giữ lại trong nhật ký.' WHERE actor_id IS NOT NULL AND status='QUEUED' AND attempts=0;
