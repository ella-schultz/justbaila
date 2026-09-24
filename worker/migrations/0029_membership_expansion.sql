PRAGMA foreign_keys = ON;

CREATE TABLE member_capabilities (
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  capability TEXT NOT NULL CHECK (capability IN ('membership_nomination', 'membership_invitation')),
  unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unlock_source TEXT NOT NULL DEFAULT 'lifetime_keys',
  PRIMARY KEY (passport_id, capability)
);

CREATE TABLE membership_nominations (
  id TEXT PRIMARY KEY,
  nominator_passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  nominee_description TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'completed', 'closed')),
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_membership_nominations_status ON membership_nominations(status, submitted_at);
CREATE INDEX idx_membership_nominations_nominator ON membership_nominations(nominator_passport_id, submitted_at);

CREATE TABLE membership_invitations (
  id TEXT PRIMARY KEY,
  inviter_passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  invitee_description TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'card_assigned', 'completed', 'closed')),
  assigned_card_id INTEGER UNIQUE REFERENCES cards(id) ON DELETE RESTRICT,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_membership_invitations_status ON membership_invitations(status, requested_at);
CREATE INDEX idx_membership_invitations_inviter ON membership_invitations(inviter_passport_id, requested_at);

INSERT OR IGNORE INTO member_capabilities (passport_id, capability)
SELECT p.id, 'membership_nomination'
FROM passports p
WHERE 25 <= (
  SELECT COALESCE(SUM(kt.amount), 0)
  FROM key_transactions kt
  JOIN mission_completions mc ON mc.id = kt.reason_id AND mc.passport_id = kt.passport_id
  WHERE kt.passport_id = p.id AND kt.transaction_type = 'earned' AND kt.reason_type = 'mission' AND kt.amount > 0
);

INSERT OR IGNORE INTO member_capabilities (passport_id, capability)
SELECT p.id, 'membership_invitation'
FROM passports p
WHERE 75 <= (
  SELECT COALESCE(SUM(kt.amount), 0)
  FROM key_transactions kt
  JOIN mission_completions mc ON mc.id = kt.reason_id AND mc.passport_id = kt.passport_id
  WHERE kt.passport_id = p.id AND kt.transaction_type = 'earned' AND kt.reason_type = 'mission' AND kt.amount > 0
);
