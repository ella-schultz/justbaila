ALTER TABLE technique_competencies ADD COLUMN category TEXT NOT NULL DEFAULT 'Foundations';
ALTER TABLE technique_competencies ADD COLUMN role_applicability TEXT NOT NULL DEFAULT 'either' CHECK (role_applicability IN ('lead', 'follow', 'either'));
ALTER TABLE technique_competencies ADD COLUMN target_eligible INTEGER NOT NULL DEFAULT 1 CHECK (target_eligible IN (0, 1));
ALTER TABLE technique_competencies ADD COLUMN evaluation_eligible INTEGER NOT NULL DEFAULT 1 CHECK (evaluation_eligible IN (0, 1));
ALTER TABLE technique_competencies ADD COLUMN overlap_eligible INTEGER NOT NULL DEFAULT 1 CHECK (overlap_eligible IN (0, 1));
ALTER TABLE technique_competencies ADD COLUMN micro_guidance TEXT NOT NULL DEFAULT '[]';

CREATE TABLE technique_complementarity (
  skill_id INTEGER NOT NULL REFERENCES technique_competencies(id),
  complementary_skill_id INTEGER NOT NULL REFERENCES technique_competencies(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (skill_id, complementary_skill_id),
  CHECK (skill_id != complementary_skill_id)
);

CREATE TABLE member_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES technique_competencies(id),
  status TEXT NOT NULL DEFAULT 'learning' CHECK (status IN ('learning', 'working', 'comfortable')),
  available_to_help INTEGER NOT NULL DEFAULT 0 CHECK (available_to_help IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cleared_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_member_targets_active ON member_targets(passport_id, skill_id) WHERE active = 1;
CREATE INDEX idx_member_targets_radar ON member_targets(active, skill_id, passport_id);

CREATE TABLE target_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES technique_competencies(id),
  action TEXT NOT NULL CHECK (action IN ('added', 'status_changed', 'cleared', 'help_opt_in', 'help_opt_out', 'suggested', 'suggestion_accepted', 'suggestion_declined')),
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL DEFAULT 'member'
);

CREATE TABLE target_suggestions (
  id TEXT PRIMARY KEY,
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES technique_competencies(id),
  suggested_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);

CREATE TABLE overlap_preferences (
  passport_id INTEGER PRIMARY KEY REFERENCES passports(id) ON DELETE CASCADE,
  open_to_overlap INTEGER NOT NULL DEFAULT 0 CHECK (open_to_overlap IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE overlap_invitations (
  id TEXT PRIMARY KEY,
  event_id INTEGER REFERENCES events(id),
  first_passport_id INTEGER NOT NULL REFERENCES passports(id),
  second_passport_id INTEGER NOT NULL REFERENCES passports(id),
  first_skill_id INTEGER NOT NULL REFERENCES technique_competencies(id),
  second_skill_id INTEGER NOT NULL REFERENCES technique_competencies(id),
  match_type TEXT NOT NULL CHECK (match_type IN ('exact', 'complementary')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'accepted', 'declined', 'dismissed', 'expired')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  created_by TEXT NOT NULL DEFAULT 'mission-desk-admin',
  UNIQUE(event_id, first_passport_id, second_passport_id, first_skill_id, second_skill_id)
);

CREATE TABLE admin_watchlist (
  passport_id INTEGER PRIMARY KEY REFERENCES passports(id) ON DELETE CASCADE,
  note TEXT,
  watched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  watched_by TEXT NOT NULL DEFAULT 'inner-circle-admin'
);

CREATE TABLE member_admin_notes (
  id TEXT PRIMARY KEY,
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL DEFAULT 'inner-circle-admin'
);

CREATE TABLE manual_transmissions (
  id TEXT PRIMARY KEY,
  message_type TEXT NOT NULL,
  message TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('member', 'selected', 'event')),
  event_id INTEGER REFERENCES events(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'inner-circle-admin'
);
CREATE TABLE manual_transmission_recipients (
  transmission_id TEXT NOT NULL REFERENCES manual_transmissions(id) ON DELETE CASCADE,
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  dismissed_at TEXT,
  PRIMARY KEY (transmission_id, passport_id)
);

CREATE TABLE dead_drops (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'none' CHECK (action_type IN ('none', 'url', 'assignment_hook')),
  action_value TEXT,
  eligibility_type TEXT NOT NULL DEFAULT 'all' CHECK (eligibility_type IN ('all', 'member', 'event', 'level')),
  eligibility_value TEXT,
  starts_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  max_claims INTEGER,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL DEFAULT 'inner-circle-admin'
);
CREATE TABLE dead_drop_claims (
  dead_drop_id TEXT NOT NULL REFERENCES dead_drops(id) ON DELETE CASCADE,
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (dead_drop_id, passport_id)
);

ALTER TABLE missions ADD COLUMN visibility_mode TEXT NOT NULL DEFAULT 'normal' CHECK (visibility_mode IN ('normal', 'ghost'));
ALTER TABLE missions ADD COLUMN trigger_type TEXT NOT NULL DEFAULT 'none' CHECK (trigger_type IN ('none', 'level', 'milestone', 'event_count', 'target', 'mission', 'private_assignment', 'signal_history', 'operator'));
ALTER TABLE missions ADD COLUMN trigger_value TEXT;
ALTER TABLE missions ADD COLUMN operator_active INTEGER NOT NULL DEFAULT 0 CHECK (operator_active IN (0, 1));

UPDATE technique_competencies SET category = CASE code
  WHEN 'timing' THEN 'Timing & Music'
  WHEN 'weight-transfer' THEN 'Foundations'
  WHEN 'connection' THEN 'Partnering'
  WHEN 'lead-cycle' THEN 'Leading'
  WHEN 'frame' THEN 'Partnering'
  WHEN 'floorcraft' THEN 'Movement'
  ELSE 'Foundations' END;

CREATE INDEX idx_target_history_member ON target_history(passport_id, created_at DESC);
CREATE INDEX idx_overlap_active ON overlap_invitations(status, event_id, created_at DESC);
CREATE INDEX idx_transmission_recipient ON manual_transmission_recipients(passport_id, dismissed_at);
CREATE INDEX idx_dead_drops_active ON dead_drops(active, starts_at, expires_at);
