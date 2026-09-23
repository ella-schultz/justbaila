PRAGMA foreign_keys = ON;

CREATE TABLE missions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  key_reward INTEGER NOT NULL DEFAULT 0 CHECK (key_reward >= 0),
  repeatable INTEGER NOT NULL DEFAULT 0 CHECK (repeatable IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mission_completions (
  id TEXT PRIMARY KEY,
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  completion_number INTEGER NOT NULL DEFAULT 1 CHECK (completion_number > 0),
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_by TEXT NOT NULL,
  note TEXT,
  UNIQUE(passport_id, mission_id, completion_number)
);

CREATE INDEX idx_mission_completions_passport ON mission_completions(passport_id);
CREATE INDEX idx_mission_completions_mission ON mission_completions(mission_id);

CREATE TABLE key_transactions (
  id TEXT PRIMARY KEY,
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount != 0),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earned', 'spent', 'adjustment')),
  reason_type TEXT NOT NULL CHECK (reason_type IN ('mission', 'reward', 'adjustment')),
  reason_id TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL,
  UNIQUE(reason_type, reason_id)
);

CREATE INDEX idx_key_transactions_passport ON key_transactions(passport_id);
CREATE INDEX idx_key_transactions_created ON key_transactions(created_at);

INSERT INTO missions (code, title, description, key_reward, repeatable, active, sort_order)
VALUES
  ('follow-the-music', 'Follow the Music', 'Attend an Inner Circle dance night and try one song outside your usual style.', 1, 0, 1, 10),
  ('cross-the-floor', 'Cross the Floor', 'Ask someone new to dance, welcome a first-time guest, or help another dancer feel like they belong.', 2, 0, 1, 20),
  ('the-last-song', 'The Last Song', 'Stay until the final song of a JustBaila social and share the floor with the people who made the night special.', 2, 0, 1, 30);
