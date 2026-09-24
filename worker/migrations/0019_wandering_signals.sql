PRAGMA foreign_keys = ON;

CREATE TABLE member_relay_codes (
  passport_id INTEGER PRIMARY KEY REFERENCES passports(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  code_display TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE signal_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO signal_types (code, name) VALUES ('wandering', 'Wandering Signal');

CREATE TABLE signals (
  id TEXT PRIMARY KEY,
  public_code TEXT NOT NULL UNIQUE,
  signal_type_id INTEGER NOT NULL REFERENCES signal_types(id),
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  original_holder_id INTEGER NOT NULL REFERENCES passports(id),
  current_holder_id INTEGER NOT NULL REFERENCES passports(id),
  released_by TEXT NOT NULL,
  event_id INTEGER REFERENCES events(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_relayed_at TEXT,
  retired_at TEXT
);

CREATE INDEX idx_signals_current_holder ON signals(current_holder_id, status);
CREATE INDEX idx_signals_status_created ON signals(status, created_at);

CREATE TABLE signal_relays (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  signal_id TEXT NOT NULL REFERENCES signals(id),
  sender_passport_id INTEGER NOT NULL REFERENCES passports(id),
  recipient_passport_id INTEGER NOT NULL REFERENCES passports(id),
  event_id INTEGER REFERENCES events(id),
  relayed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (sender_passport_id != recipient_passport_id)
);

CREATE INDEX idx_signal_relays_signal_time ON signal_relays(signal_id, relayed_at, id);
CREATE INDEX idx_signal_relays_sender ON signal_relays(sender_passport_id);
CREATE INDEX idx_signal_relays_recipient ON signal_relays(recipient_passport_id);
