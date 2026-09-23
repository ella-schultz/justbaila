ALTER TABLE missions ADD COLUMN counts_as_event INTEGER NOT NULL DEFAULT 0 CHECK (counts_as_event IN (0, 1));

CREATE INDEX idx_missions_event_credit ON missions(counts_as_event);
