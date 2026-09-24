UPDATE technique_competencies
SET active = 0, updated_at = CURRENT_TIMESTAMP
WHERE code = 'lead-cycle';
