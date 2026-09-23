ALTER TABLE events ADD COLUMN check_in_code_hash TEXT;
ALTER TABLE events ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1));
ALTER TABLE events ADD COLUMN updated_at TEXT;

CREATE UNIQUE INDEX idx_events_check_in_code_hash ON events(check_in_code_hash) WHERE check_in_code_hash IS NOT NULL;
CREATE INDEX idx_events_active_starts ON events(active, starts_at);

UPDATE missions SET counts_as_event = 0 WHERE counts_as_event != 0;
