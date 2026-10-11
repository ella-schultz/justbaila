ALTER TABLE overlap_preferences
ADD COLUMN preferred_role TEXT CHECK (preferred_role IN ('lead', 'follow'));
