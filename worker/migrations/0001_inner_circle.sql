PRAGMA foreign_keys = ON;

CREATE TABLE cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_number TEXT NOT NULL UNIQUE,
  card_hash TEXT NOT NULL UNIQUE,
  issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disabled_at TEXT,
  notes TEXT
);

CREATE INDEX idx_cards_hash ON cards(card_hash);

CREATE TABLE passports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL UNIQUE REFERENCES cards(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'unclaimed' CHECK (status IN ('unclaimed', 'claimed', 'suspended')),
  member_name TEXT,
  activation_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_passports_status ON passports(status);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  location TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE event_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  checked_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(passport_id, event_id)
);

CREATE TABLE stamps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  stamp_type TEXT NOT NULL,
  note TEXT,
  awarded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE passport_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  reward_id INTEGER NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'earned' CHECK (status IN ('earned', 'redeemed', 'expired')),
  earned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  redeemed_at TEXT,
  UNIQUE(passport_id, reward_id)
);

CREATE TABLE milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE passport_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  milestone_id INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  achieved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(passport_id, milestone_id)
);

CREATE TABLE rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1
);
