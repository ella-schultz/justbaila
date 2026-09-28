CREATE TABLE workshop_challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  workshop_level INTEGER NOT NULL CHECK (workshop_level BETWEEN 1 AND 4),
  required_for_advance INTEGER NOT NULL DEFAULT 1 CHECK (required_for_advance IN (0, 1)),
  verification_required INTEGER NOT NULL DEFAULT 0 CHECK (verification_required IN (0, 1)),
  verification_code_hash TEXT,
  verification_code_display TEXT,
  key_reward INTEGER NOT NULL DEFAULT 0 CHECK (key_reward BETWEEN 0 AND 100),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE workshop_completions (
  id TEXT PRIMARY KEY,
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  challenge_id INTEGER NOT NULL REFERENCES workshop_challenges(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verification_method TEXT NOT NULL CHECK (verification_method IN ('honor', 'code')),
  UNIQUE(passport_id, challenge_id)
);

CREATE INDEX idx_workshop_challenges_level ON workshop_challenges(workshop_level, active, sort_order);
CREATE INDEX idx_workshop_completions_passport ON workshop_completions(passport_id);

INSERT INTO workshop_challenges (code, title, description, workshop_level, required_for_advance, sort_order) VALUES
  ('the-quiet-dance', 'The Quiet Dance', 'Dance one full song without using your three favorite patterns. Your assignment is not to add something. Notice what happens when you take something away.', 1, 1, 10),
  ('the-break', 'The Break', 'During one dance, deliberately allow a musical break to breathe instead of immediately filling it with another pattern.', 1, 1, 20),
  ('the-other-side', 'The Other Side', 'Spend one song deliberately using your weaker turn direction.', 1, 1, 30),
  ('the-basic', 'The Basic', 'Spend at least 30 seconds of one dance using only basics while experimenting with timing, direction, connection, and musical interpretation.', 1, 1, 40),
  ('listen-first', 'Listen First', 'For the first 30 seconds of a song, resist the urge to immediately build into patterns. Listen to the music and your partner first.', 1, 1, 50);
