PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO milestones
  (code, title, description, reveal_text, criteria_type, threshold, sort_order, active, claimable_by_code, member_claimable, hidden_until_achieved)
VALUES
  ('across-town', 'Across Town', 'Attend two JustBaila socials at different locations.', 'You know more than one way in.', 'event_locations', 2, 25, 1, 0, 0, 0);
