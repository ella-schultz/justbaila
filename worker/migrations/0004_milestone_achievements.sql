ALTER TABLE milestones ADD COLUMN criteria_type TEXT;
ALTER TABLE milestones ADD COLUMN threshold INTEGER;
ALTER TABLE milestones ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE milestones ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1));

INSERT OR IGNORE INTO milestones (code, title, description, criteria_type, threshold, sort_order)
VALUES
  ('first-night', 'First Night', 'Attend your first JustBaila social.', 'events', 1, 10),
  ('inner-circle-regular', 'Inner Circle Regular', 'Attend five JustBaila socials.', 'events', 5, 20),
  ('after-dark-devotee', 'After Dark Devotee', 'Attend ten JustBaila socials.', 'events', 10, 30),
  ('mission-initiate', 'Mission Initiate', 'Complete your first Secret Mission.', 'missions', 1, 40),
  ('keeper-of-keys', 'Keeper of Keys', 'Build a balance of ten Keys.', 'keys', 10, 50);

CREATE INDEX idx_milestones_active_sort ON milestones(active, sort_order);
