ALTER TABLE missions
ADD COLUMN relay_verification_required INTEGER NOT NULL DEFAULT 0
CHECK (relay_verification_required IN (0, 1));

ALTER TABLE mission_completions
ADD COLUMN relay_verifier_passport_id INTEGER REFERENCES passports(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_mission_relay_verifier_once
ON mission_completions(passport_id, mission_id, relay_verifier_passport_id)
WHERE relay_verifier_passport_id IS NOT NULL;

CREATE INDEX idx_mission_completions_relay_verifier
ON mission_completions(relay_verifier_passport_id);
