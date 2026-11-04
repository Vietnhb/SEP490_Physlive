-- Each appeal belongs to one suspension; authority survives staff/role changes.
ALTER TABLE users ADD COLUMN suspension_scope varchar(12);
ALTER TABLE users ADD COLUMN suspension_id uuid;
UPDATE users u SET suspension_id=gen_random_uuid(), suspension_scope=CASE
 WHEN EXISTS (SELECT 1 FROM users actor JOIN roles r ON r.id=actor.role_id
              WHERE actor.id=u.deactivated_by AND r.name='SCHOOL') THEN 'SCHOOL' ELSE 'SYSTEM' END
WHERE u.active=false OR u.account_status='SUSPENDED_READ_ONLY';
ALTER TABLE users ADD CONSTRAINT ck_suspension_scope CHECK (suspension_scope IN ('SCHOOL','SYSTEM'));
ALTER TABLE account_appeals ADD COLUMN suspension_id uuid;
ALTER TABLE account_appeals ADD COLUMN suspension_scope varchar(12);
ALTER TABLE account_appeals ADD COLUMN school_id uuid;
ALTER TABLE account_appeals ADD COLUMN suspended_by integer;
ALTER TABLE account_appeals ADD COLUMN suspended_at timestamptz;
UPDATE account_appeals a SET suspension_id=u.suspension_id,
 suspension_scope=COALESCE(u.suspension_scope,'SYSTEM'), school_id=u.school_id,
 suspended_by=u.deactivated_by, suspended_at=u.deactivated_at FROM users u WHERE u.id=a.user_id;
CREATE INDEX ix_appeal_suspension ON account_appeals(user_id,suspension_id,status);
