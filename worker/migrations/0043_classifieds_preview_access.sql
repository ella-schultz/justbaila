CREATE TABLE classified_access_overrides (
  passport_id INTEGER PRIMARY KEY REFERENCES passports(id) ON DELETE CASCADE,
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  note TEXT
);

INSERT OR REPLACE INTO classified_access_overrides (passport_id, granted_at, expires_at, note)
SELECT p.id, CURRENT_TIMESTAMP, datetime('now', '+24 hours'), 'Temporary preview access for card 001'
FROM passports p JOIN cards c ON c.id = p.card_id
WHERE c.card_number = '001';
