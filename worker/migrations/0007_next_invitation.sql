CREATE TABLE invitation_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  kicker TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  button_label TEXT,
  button_url TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL DEFAULT 'system'
);

INSERT INTO invitation_settings (id, kicker, title, description)
VALUES (
  1,
  'The next invitation',
  'Something special is taking shape.',
  'Keep this card close. Private event details and member opportunities will appear here first.'
);
