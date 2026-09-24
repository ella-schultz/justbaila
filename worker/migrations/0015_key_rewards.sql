PRAGMA foreign_keys = ON;

ALTER TABLE rewards ADD COLUMN code TEXT;
ALTER TABLE rewards ADD COLUMN key_cost INTEGER NOT NULL DEFAULT 5 CHECK (key_cost >= 5);
ALTER TABLE rewards ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rewards ADD COLUMN updated_at TEXT;

CREATE UNIQUE INDEX idx_rewards_code ON rewards(code) WHERE code IS NOT NULL;

CREATE TABLE reward_redemptions (
  id TEXT PRIMARY KEY,
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  reward_id INTEGER NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
  keys_spent INTEGER NOT NULL CHECK (keys_spent >= 5),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'fulfilled')),
  redeemed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fulfilled_at TEXT
);

CREATE INDEX idx_rewards_active_sort ON rewards(active, sort_order);
CREATE INDEX idx_reward_redemptions_passport ON reward_redemptions(passport_id, redeemed_at);
CREATE INDEX idx_reward_redemptions_status ON reward_redemptions(status, redeemed_at);
CREATE UNIQUE INDEX idx_reward_redemptions_pending
ON reward_redemptions(passport_id, reward_id) WHERE status = 'requested';

CREATE TRIGGER prevent_negative_key_balance
BEFORE INSERT ON key_transactions
WHEN NEW.amount < 0
  AND (SELECT COALESCE(SUM(amount), 0) FROM key_transactions WHERE passport_id = NEW.passport_id) + NEW.amount < 0
BEGIN
  SELECT RAISE(ABORT, 'insufficient key balance');
END;

INSERT INTO rewards (code, name, description, key_cost, sort_order, updated_at)
VALUES
  ('justbaila-sticker', 'JustBaila Sticker', 'A little badge of belonging for your water bottle, laptop, or dance bag.', 5, 10, CURRENT_TIMESTAMP),
  ('song-request', 'Priority Song Request', 'Choose a song for an upcoming JustBaila social playlist.', 10, 20, CURRENT_TIMESTAMP),
  ('justbaila-keychain', 'JustBaila Keychain', 'A small keepsake for the Keys you earned on the dance floor.', 20, 30, CURRENT_TIMESTAMP),
  ('social-admission', 'Social Admission', 'One complimentary admission to a JustBaila social.', 30, 40, CURRENT_TIMESTAMP),
  ('group-class-pass', 'Group Class Pass', 'One complimentary JustBaila group class.', 45, 50, CURRENT_TIMESTAMP),
  ('merch-credit', 'Merch Credit', 'Twenty dollars toward available JustBaila merchandise.', 60, 60, CURRENT_TIMESTAMP),
  ('private-half-off', 'Half-Price Private Lesson', 'Receive fifty percent off one private lesson with us.', 75, 70, CURRENT_TIMESTAMP),
  ('free-private', 'Free Private Lesson', 'One complimentary private lesson with Hector or Ella.', 100, 80, CURRENT_TIMESTAMP);
