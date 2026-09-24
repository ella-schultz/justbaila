ALTER TABLE milestones
ADD COLUMN hidden_until_achieved INTEGER NOT NULL DEFAULT 0
CHECK (hidden_until_achieved IN (0, 1));

CREATE INDEX idx_milestones_hidden ON milestones(active, hidden_until_achieved, sort_order);
