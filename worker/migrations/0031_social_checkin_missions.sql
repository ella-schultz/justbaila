PRAGMA foreign_keys = ON;

ALTER TABLE missions
ADD COLUMN social_checkin_only INTEGER NOT NULL DEFAULT 0
CHECK (social_checkin_only IN (0, 1));

CREATE INDEX idx_missions_social_checkin_only ON missions(active, social_checkin_only, sort_order);
