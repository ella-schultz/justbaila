ALTER TABLE missions ADD COLUMN verification_required INTEGER NOT NULL DEFAULT 0 CHECK (verification_required IN (0, 1));
ALTER TABLE missions ADD COLUMN verification_code_hash TEXT;

CREATE INDEX idx_missions_active_sort ON missions(active, sort_order);
