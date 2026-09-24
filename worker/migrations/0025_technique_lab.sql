CREATE TABLE technique_competencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  member_description TEXT NOT NULL,
  instructor_criteria TEXT NOT NULL,
  feedback_options TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE technique_requests (
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  competency_id INTEGER NOT NULL REFERENCES technique_competencies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  PRIMARY KEY (passport_id, competency_id)
);

CREATE TABLE technique_checks (
  id TEXT PRIMARY KEY,
  passport_id INTEGER NOT NULL REFERENCES passports(id) ON DELETE CASCADE,
  competency_id INTEGER NOT NULL REFERENCES technique_competencies(id) ON DELETE CASCADE,
  instructor_name TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('verified', 'keep_working')),
  feedback_tags TEXT NOT NULL DEFAULT '[]',
  instructor_note TEXT,
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL DEFAULT 'mission-desk-admin'
);

CREATE TABLE technique_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  checks_available INTEGER NOT NULL DEFAULT 0 CHECK (checks_available IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL DEFAULT 'inner-circle-admin'
);

INSERT INTO technique_settings (id, checks_available) VALUES (1, 0);

CREATE INDEX idx_technique_competencies_active ON technique_competencies(active, sort_order);
CREATE INDEX idx_technique_checks_member ON technique_checks(passport_id, competency_id, checked_at DESC);
CREATE INDEX idx_technique_requests_status ON technique_requests(status, requested_at);

INSERT INTO technique_competencies
  (code, name, member_description, instructor_criteria, feedback_options, sort_order)
VALUES
  ('timing', 'Timing', 'Maintain the basic timing consistently while dancing with a partner.', 'Verify when the dancer can reliably maintain the appropriate basic timing without repeatedly losing or rushing the count.', '["Stay with the basic count","Avoid rushing the count","Recover the timing calmly","Keep timing consistent with a partner"]', 10),
  ('weight-transfer', 'Weight Transfer', 'Clearly transfer weight when stepping and distinguish a weighted step from a tap.', 'Verify when weight changes are intentional, stable, and appropriate to the movement being danced.', '["Complete each weight change","Distinguish steps from taps","Stabilize before the next step","Make weight changes more intentional"]', 20),
  ('connection', 'Connection', 'Maintain clear, comfortable partner connection without gripping, pulling, collapsing, or excessive force.', 'Verify when the dancer can maintain usable connection while allowing the partner freedom to move and respond.', '["Reduce gripping","Reduce pulling or pushing","Maintain connection without collapsing","Allow the partner more freedom to respond"]', 30),
  ('lead-cycle', 'Lead Cycle', 'Prepare → initiate → allow → resolve.', 'Verify when the dancer can repeatedly create an appropriate preparation; clearly initiate the intended movement; allow the partner time to respond rather than forcing them through it; maintain usable connection during the response; and allow the movement to resolve before beginning the next lead.', '["Preparation needs to be clearer","Direction needs to be clearer","Reduce force","Allow more response time","Maintain connection through the response","Let the movement resolve before initiating the next lead"]', 40),
  ('frame', 'Frame', 'Maintain enough structure to communicate clearly without becoming rigid.', 'Verify when the dancer can maintain appropriate structure and responsiveness without excessive tension or collapse.', '["Reduce tension","Maintain more consistent structure","Avoid collapsing through the frame","Stay responsive rather than rigid"]', 50),
  ('floorcraft', 'Floorcraft', 'Share a crowded dance floor safely and intentionally.', 'Verify when the dancer demonstrates reasonable awareness of surrounding dancers, controls movement appropriately for available space, and avoids unnecessarily dangerous or disruptive movement.', '["Scan the surrounding floor more often","Use smaller movement in crowded space","Protect the shared dance lane","Adjust patterns to the available space"]', 60);

INSERT OR IGNORE INTO milestones
  (code, title, description, reveal_text, criteria_type, threshold, sort_order, claimable_by_code, member_claimable, hidden_until_achieved, active)
VALUES
  ('technique-second-pass', 'Second Pass', 'Receive guidance, return for another check, and become verified.', 'That''s what improvement looks like.', 'technique_improvement', 1, 130, 0, 0, 1, 1);
