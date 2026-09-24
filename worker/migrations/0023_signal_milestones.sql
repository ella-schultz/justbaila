UPDATE milestones
SET title = 'Signal Received',
    description = 'Become the holder of a Wandering Signal.',
    reveal_text = 'Something found you.',
    criteria_type = 'signal_received',
    threshold = 1,
    claimable_by_code = 0,
    claim_code_hash = NULL,
    claim_code_display = NULL,
    member_claimable = 0,
    hidden_until_achieved = 1,
    active = 1
WHERE code = 'mission-initiate';

INSERT OR IGNORE INTO milestones
  (code, title, description, reveal_text, criteria_type, threshold, sort_order, claimable_by_code, member_claimable, hidden_until_achieved, active)
VALUES
  ('signal-pass-it-on', 'Pass It On', 'Successfully relay a Wandering Signal.', 'It wasn''t meant to stop with you.', 'signal_sent', 1, 80, 0, 0, 1, 1),
  ('signal-full-circle', 'Full Circle', 'A Wandering Signal returns after reaching at least three other people.', 'An old signal has returned.', 'signal_full_circle', 1, 90, 0, 0, 1, 1),
  ('signal-long-distance', 'Long Distance', 'Participate in a Wandering Signal journey that reaches ten unique holders.', 'That traveled farther than expected.', 'signal_long_distance', 1, 100, 0, 0, 1, 1),
  ('signal-triple-threat', 'Triple Threat', 'Complete a Mission, earn a Key, and participate in a Wandering Signal journey.', 'You''ve been busy down here.', 'triple_threat', 1, 110, 0, 0, 1, 1);
