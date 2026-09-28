CREATE TABLE workshop_member_progress (
  passport_id INTEGER PRIMARY KEY REFERENCES passports(id) ON DELETE CASCADE,
  current_level INTEGER NOT NULL DEFAULT 1 CHECK (current_level BETWEEN 1 AND 4),
  level_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
