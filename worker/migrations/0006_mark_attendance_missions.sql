UPDATE missions
SET counts_as_event = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE code = 'follow-the-music';
