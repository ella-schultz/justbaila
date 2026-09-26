CREATE TABLE passport_nfc_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  uid TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removed_at TEXT
);

CREATE UNIQUE INDEX idx_passport_nfc_active_passport
  ON passport_nfc_cards(passport_id) WHERE active = 1;

CREATE INDEX idx_passport_nfc_active_uid
  ON passport_nfc_cards(uid, active);

CREATE TABLE nfc_checkin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attendance_id INTEGER NOT NULL UNIQUE REFERENCES event_attendance(id) ON DELETE CASCADE,
  nfc_card_id INTEGER NOT NULL REFERENCES passport_nfc_cards(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
