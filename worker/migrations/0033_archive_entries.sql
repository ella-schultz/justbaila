PRAGMA foreign_keys = ON;

CREATE TABLE archive_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text',
  action_label TEXT,
  href TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO archive_entries (code, label, title, body, sort_order) VALUES
  ('field-note-001', 'FIELD NOTE 001', 'The clave isn''t just percussion.', 'Once you start hearing its conversation with the rest of the music, salsa feels different.', 10),
  ('file-002', 'FILE 002', 'So… what actually makes something bachata?', 'Hint: it isn''t the body roll. The answer begins with the music, its history, and the place it came from.', 20),
  ('memorandum-003', 'MEMORANDUM 003', 'The floor remembers.', 'Every person who welcomes someone new changes the room a little. Most of that history is never written down.', 30);
