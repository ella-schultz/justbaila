UPDATE milestones
SET criteria_type = 'events',
    threshold = 2,
    claimable_by_code = 0,
    claim_code_hash = NULL,
    claim_code_display = NULL,
    member_claimable = 0,
    hidden_until_achieved = 0
WHERE code = 'you-came-back-190da6';
