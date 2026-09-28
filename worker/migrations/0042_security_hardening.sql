CREATE TABLE security_audit_log (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor_passport_id INTEGER REFERENCES passports(id) ON DELETE SET NULL,
  route TEXT,
  outcome TEXT NOT NULL,
  metadata TEXT,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_security_audit_event ON security_audit_log(event_type, occurred_at);
CREATE INDEX idx_security_audit_actor ON security_audit_log(actor_passport_id, occurred_at);
CREATE INDEX idx_security_audit_time ON security_audit_log(occurred_at);
