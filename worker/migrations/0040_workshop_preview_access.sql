CREATE TABLE workshop_access_overrides (
  passport_id INTEGER PRIMARY KEY REFERENCES passports(id) ON DELETE CASCADE,
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note TEXT
);

INSERT OR IGNORE INTO workshop_access_overrides (passport_id, note)
SELECT p.id, 'Temporary preview access for card 001'
FROM passports p JOIN cards c ON c.id = p.card_id
WHERE c.card_number = '001';
