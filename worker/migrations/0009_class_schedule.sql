CREATE TABLE schedule_entries (
  id TEXT PRIMARY KEY,
  day_key TEXT NOT NULL CHECK (day_key IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  class_name_en TEXT NOT NULL,
  class_name_es TEXT NOT NULL,
  time_text TEXT NOT NULL,
  level_en TEXT NOT NULL,
  level_es TEXT NOT NULL,
  location_en TEXT NOT NULL,
  location_es TEXT NOT NULL,
  link_url TEXT,
  link_label_en TEXT,
  link_label_es TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_schedule_entries_active_order ON schedule_entries(active, sort_order);

INSERT INTO schedule_entries
  (id, day_key, class_name_en, class_name_es, time_text, level_en, level_es, location_en, location_es, link_url, link_label_en, link_label_es, sort_order)
VALUES
  ('tuesday-bachata', 'tuesday', 'Bachata', 'Bachata', '6:15 PM - 7:15 PM', 'Open Level', 'Nivel abierto', 'UCSB GauchoRec Program, Robertson Gym', 'Programa UCSB GauchoRec, Robertson Gym', 'https://register.recreation.ucsb.edu/Program/GetProgramDetails?courseId=8af81e31-5f4c-4a96-bf27-055e572c4af2', 'Sign Up / Learn more', 'Inscríbete / Más información', 10),
  ('tuesday-beginner-salsa', 'tuesday', 'Beginner Salsa', 'Salsa principiante', '7:30 PM - 8:30 PM', 'Beginner', 'Principiante', 'UCSB GauchoRec Program, Robertson Gym', 'Programa UCSB GauchoRec, Robertson Gym', 'https://register.recreation.ucsb.edu/Program/GetProgramDetails?courseId=a375c517-0251-4005-949b-abb2ffc3ddcc', 'Sign Up / Learn more', 'Inscríbete / Más información', 20),
  ('wednesday-salsa-01', 'wednesday', 'Salsa 0-1', 'Salsa 0-1', '6:00 PM - 7:00 PM', 'Beginner', 'Principiante', 'Brazilian Cultural Arts Center of Santa Barbara', 'Brazilian Cultural Arts Center of Santa Barbara', 'https://dance805.com', 'Sign Up / Learn more', 'Inscríbete / Más información', 30),
  ('wednesday-salsa-12', 'wednesday', 'Salsa 1-2', 'Salsa 1-2', '7:00 PM - 8:00 PM', 'Intermediate', 'Intermedio', 'Brazilian Cultural Arts Center of Santa Barbara', 'Brazilian Cultural Arts Center of Santa Barbara', 'https://dance805.com', 'Sign Up / Learn more', 'Inscríbete / Más información', 40),
  ('thursday-zumba', 'thursday', 'Zumba', 'Zumba', '6:15 PM - 7:00 PM', 'Open Level', 'Nivel abierto', 'UCSB GauchoRec', 'UCSB GauchoRec', 'https://register.recreation.ucsb.edu/Program/GetProgramDetails?courseId=4c06ba8b-07c9-4774-883d-af2070296d2e', 'Sign Up / Learn more', 'Inscríbete / Más información', 50),
  ('sunday-zumba', 'sunday', 'Zumba', 'Zumba', '11:15 AM - 12:15 PM', 'Open/All Ages', 'Abierto/Todas las edades', 'Brazilian Cultural Arts Center of Santa Barbara', 'Brazilian Cultural Arts Center of Santa Barbara', 'https://dance805.com', 'Sign Up / Learn more', 'Inscríbete / Más información', 60),
  ('sunday-private-lessons', 'sunday', 'Private Lessons', 'Clases privadas', '8:00 AM - 6:00 PM', 'All levels', 'Todos los niveles', '5370 Hollister Avenue, Goleta, CA 93117', '5370 Hollister Avenue, Goleta, CA 93117', 'https://calendar.app.google/LTxs26Qe16TgwNfz7', 'Book / Learn more', 'Reservar / Más información', 70);
