PRAGMA foreign_keys = ON;

CREATE TABLE admin_corrections (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN (
    'mission_completion', 'event_attendance', 'passport_milestone',
    'workshop_completion', 'technique_check', 'signal_relay', 'reward_fulfillment'
  )),
  target_id TEXT NOT NULL,
  passport_id INTEGER REFERENCES passports(id) ON DELETE SET NULL,
  correction_kind TEXT NOT NULL DEFAULT 'reversed' CHECK (correction_kind IN ('reversed', 'invalidated')),
  affects_effective_state INTEGER NOT NULL DEFAULT 1 CHECK (affects_effective_state IN (0, 1)),
  reason TEXT,
  effect_summary TEXT NOT NULL,
  corrected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  corrected_by TEXT NOT NULL DEFAULT 'mission-desk-admin',
  UNIQUE(target_type, target_id)
);

CREATE INDEX idx_admin_corrections_target ON admin_corrections(target_type, target_id);
CREATE INDEX idx_admin_corrections_passport ON admin_corrections(passport_id, corrected_at DESC);
CREATE INDEX idx_admin_corrections_time ON admin_corrections(corrected_at DESC);

DROP TRIGGER IF EXISTS prevent_negative_key_balance;
CREATE TRIGGER prevent_negative_key_balance
BEFORE INSERT ON key_transactions
WHEN NEW.amount < 0
  AND NEW.created_by != 'correction'
  AND (SELECT COALESCE(SUM(amount), 0) FROM key_transactions WHERE passport_id = NEW.passport_id) + NEW.amount < 0
BEGIN
  SELECT RAISE(ABORT, 'insufficient key balance');
END;

-- Deprecated compatibility structures intentionally retained:
-- stamps, passport_rewards, missions.counts_as_event, the mission-initiate
-- milestone code, and the looking_for Classified category.
