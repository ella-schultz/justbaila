PRAGMA foreign_keys = ON;

ALTER TABLE missions
ADD COLUMN cooldown_hours INTEGER NOT NULL DEFAULT 0
CHECK (cooldown_hours >= 0 AND cooldown_hours <= 8760);
