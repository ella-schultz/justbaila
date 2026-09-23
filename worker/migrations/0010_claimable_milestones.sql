ALTER TABLE milestones ADD COLUMN claimable_by_code INTEGER NOT NULL DEFAULT 0 CHECK (claimable_by_code IN (0, 1));
ALTER TABLE milestones ADD COLUMN claim_code_hash TEXT;

CREATE UNIQUE INDEX idx_milestones_claim_code_hash ON milestones(claim_code_hash) WHERE claim_code_hash IS NOT NULL;

INSERT OR IGNORE INTO milestones
  (code, title, description, criteria_type, threshold, sort_order, active, claimable_by_code)
VALUES
  ('studio-class', 'Studio Class', 'Take a studio class with JustBaila.', NULL, NULL, 60, 1, 1),
  ('private-lesson', 'Private Lesson', 'Take a private lesson with JustBaila.', NULL, NULL, 70, 1, 1);
