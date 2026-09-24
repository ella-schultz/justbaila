CREATE TABLE passport_roles (
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  granted_by TEXT NOT NULL DEFAULT 'inner-circle-admin',
  PRIMARY KEY (passport_id, role)
);

CREATE INDEX idx_passport_roles_role ON passport_roles(role, passport_id);

INSERT OR IGNORE INTO passport_roles (passport_id, role, granted_by)
SELECT p.id, 'instructor', 'founding-instructor-setup'
FROM passports p
JOIN cards c ON c.id = p.card_id
WHERE c.card_number IN ('001', '002');
