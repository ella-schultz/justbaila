ALTER TABLE milestones
ADD COLUMN member_claimable INTEGER NOT NULL DEFAULT 0
CHECK (member_claimable IN (0, 1));

UPDATE milestones
SET member_claimable = 1
WHERE code IN ('studio-class', 'private-lesson');

CREATE INDEX idx_milestones_member_claimable ON milestones(member_claimable, active, sort_order);
