ALTER TABLE missions
ADD COLUMN scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'individual'));

CREATE TABLE mission_assignments (
  id TEXT PRIMARY KEY,
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'revoked')),
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  revoked_at TEXT,
  assigned_by TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_mission_assignments_one_active
ON mission_assignments(mission_id) WHERE status = 'active';

CREATE INDEX idx_mission_assignments_member
ON mission_assignments(passport_id, status, assigned_at);

CREATE INDEX idx_mission_assignments_mission
ON mission_assignments(mission_id, assigned_at);
