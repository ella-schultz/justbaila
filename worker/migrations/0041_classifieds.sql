CREATE TABLE classified_contacts (
  passport_id INTEGER PRIMARY KEY REFERENCES passports(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('phone', 'instagram', 'other')),
  contact_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE classified_listings (
  id TEXT PRIMARY KEY,
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('practice_partner', 'skill_exchange', 'looking_for', 'dance_plans', 'other')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  availability TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'removed', 'expired')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE TABLE classified_responses (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES classified_listings(id) ON DELETE CASCADE,
  responder_passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dismissed', 'contact_shared')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(listing_id, responder_passport_id)
);

CREATE TABLE classified_reports (
  id TEXT PRIMARY KEY,
  reporter_passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  listing_id TEXT REFERENCES classified_listings(id) ON DELETE CASCADE,
  response_id TEXT REFERENCES classified_responses(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  CHECK ((listing_id IS NOT NULL AND response_id IS NULL) OR (listing_id IS NULL AND response_id IS NOT NULL))
);

CREATE INDEX idx_classified_listings_active ON classified_listings(status, expires_at, created_at);
CREATE INDEX idx_classified_responses_listing ON classified_responses(listing_id, status, created_at);
CREATE INDEX idx_classified_responses_member ON classified_responses(responder_passport_id, status);
CREATE INDEX idx_classified_reports_status ON classified_reports(status, created_at);
