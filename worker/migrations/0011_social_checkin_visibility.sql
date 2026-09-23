ALTER TABLE invitation_settings
ADD COLUMN social_checkin_visible INTEGER NOT NULL DEFAULT 0
CHECK (social_checkin_visible IN (0, 1));
