PRAGMA foreign_keys = ON;

ALTER TABLE passports ADD COLUMN pin_hash TEXT;
ALTER TABLE passports ADD COLUMN pin_salt TEXT;
ALTER TABLE passports ADD COLUMN pin_failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE passports ADD COLUMN pin_locked_until TEXT;

CREATE TABLE card_access_sessions (
  token_hash TEXT PRIMARY KEY,
  passport_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (passport_id) REFERENCES passports(id) ON DELETE CASCADE
);

CREATE INDEX idx_card_access_sessions_passport ON card_access_sessions(passport_id, expires_at);

CREATE TABLE pin_reset_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passport_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  FOREIGN KEY (passport_id) REFERENCES passports(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_pin_reset_pending ON pin_reset_requests(passport_id) WHERE status = 'pending';

