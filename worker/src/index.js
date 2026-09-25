const CARD_ID_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{12}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,100}$/;
const RELAY_CODE_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_ATTEMPTS = 40;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = getCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      if (!cors) return json({ error: "Origin not allowed." }, 403);
      return new Response(null, { status: 204, headers: cors });
    }
    if (!cors) return json({ error: "Origin not allowed." }, 403);

    try {
      if (request.method === "POST" && url.pathname === "/api/card/lookup") {
        await enforceRateLimit(request, env);
        const { cardId, accessToken } = await readJson(request);
        return await lookupCard(cardId, accessToken, env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/card/claim") {
        await enforceRateLimit(request, env);
        const { cardId, memberName } = await readJson(request);
        return await claimCard(cardId, memberName, env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/card/pin/setup") {
        await enforceRateLimit(request, env);
        return await setupCardPin(await readJson(request), env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/card/pin/unlock") {
        await enforceRateLimit(request, env);
        return await unlockCardPin(await readJson(request), env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/card/pin/reset-request") {
        await enforceRateLimit(request, env);
        return await requestPinReset(await readJson(request), env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/missions/claim") {
        await enforceRateLimit(request, env);
        const body = await readJson(request); await requirePinSession(body, env); return await claimMission(body, env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/events/check-in") {
        await enforceRateLimit(request, env);
        const body = await readJson(request); await requirePinSession(body, env); return await checkInEvent(body, env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/milestones/claim") {
        await enforceRateLimit(request, env);
        const body = await readJson(request); await requirePinSession(body, env); return await claimMilestone(body, env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/technique/request") {
        await enforceRateLimit(request, env);
        const body = await readJson(request); await requirePinSession(body, env); return await requestTechniqueCheck(body, env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/rewards/redeem") {
        await enforceRateLimit(request, env);
        const body = await readJson(request); await requirePinSession(body, env); return await redeemReward(body, env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/membership/nominate") {
        await enforceRateLimit(request, env);
        const body = await readJson(request); await requirePinSession(body, env); return await submitMembershipNomination(body, env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/membership/invite") {
        await enforceRateLimit(request, env);
        const body = await readJson(request); await requirePinSession(body, env); return await submitMembershipInvitation(body, env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/signals/recipient") {
        await enforceRateLimit(request, env);
        const body = await readJson(request); await requirePinSession(body, env); return await resolveSignalRecipient(body, env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/signals/relay") {
        await enforceRateLimit(request, env);
        const body = await readJson(request); await requirePinSession(body, env); return await relaySignal(body, env, cors);
      }
      if (request.method === "GET" && url.pathname === "/api/public/schedule") {
        return await getPublicSchedule(env, cors);
      }
      if (request.method === "POST" && url.pathname.startsWith("/api/instructor/")) {
        await enforceRateLimit(request, env);
        const body = await readJson(request);
        await requirePinSession(body, env);
        const instructor = await requireInstructorCard(body.cardId, env);
        if (url.pathname === "/api/instructor/members") return await listInstructorMembers(env, cors);
        if (url.pathname === "/api/instructor/technique/requests") return await listTechniqueRequests(env, cors);
        if (url.pathname === "/api/instructor/technique/member") return await getAdminTechniqueMember(body, env, cors);
        if (url.pathname === "/api/instructor/technique/check") return await recordTechniqueCheck(body, env, cors, instructor);
      }
      if (request.method === "POST" && url.pathname.startsWith("/api/admin/")) {
        await requireAdmin(request, env);
        const body = await readJson(request);
        if (url.pathname === "/api/admin/passports/search") return await searchPassports(body.query, env, cors);
        if (url.pathname === "/api/admin/passports/details") return await getAdminPassport(body.passportId, env, cors);
        if (url.pathname === "/api/admin/passports/reset-pin") return await adminResetPin(body, env, cors);
        if (url.pathname === "/api/admin/passports/dismiss-pin-reset") return await dismissPinReset(body, env, cors);
        if (url.pathname === "/api/admin/missions/complete") return await completeMission(body, env, cors);
        if (url.pathname === "/api/admin/missions/create") return await createMission(body, env, cors);
        if (url.pathname === "/api/admin/missions/list") return await listAdminMissions(env, cors);
        if (url.pathname === "/api/admin/missions/update") return await updateMission(body, env, cors);
        if (url.pathname === "/api/admin/missions/set-active") return await setMissionActive(body, env, cors);
        if (url.pathname === "/api/admin/missions/set-code") return await setMissionCode(body, env, cors);
        if (url.pathname === "/api/admin/missions/revoke-assignment") return await revokeMissionAssignment(body, env, cors);
        if (url.pathname === "/api/admin/events/create") return await createEvent(body, env, cors);
        if (url.pathname === "/api/admin/events/list") return await listAdminEvents(env, cors);
        if (url.pathname === "/api/admin/events/set-code") return await setEventCode(body, env, cors);
        if (url.pathname === "/api/admin/social-checkin/get") return await getAdminSocialCheckin(env, cors);
        if (url.pathname === "/api/admin/social-checkin/update") return await updateSocialCheckin(body, env, cors);
        if (url.pathname === "/api/admin/signals/visibility/get") return await getAdminSignalsVisibility(env, cors);
        if (url.pathname === "/api/admin/signals/visibility/update") return await updateSignalsVisibility(body, env, cors);
        if (url.pathname === "/api/admin/schedule/list") return await listAdminSchedule(env, cors);
        if (url.pathname === "/api/admin/schedule/create") return await createScheduleEntry(body, env, cors);
        if (url.pathname === "/api/admin/schedule/update") return await updateScheduleEntry(body, env, cors);
        if (url.pathname === "/api/admin/schedule/set-active") return await setScheduleEntryActive(body, env, cors);
        if (url.pathname === "/api/admin/milestones/codes") return await listMilestoneCodes(env, cors);
        if (url.pathname === "/api/admin/milestones/set-code") return await setMilestoneCode(body, env, cors);
        if (url.pathname === "/api/admin/milestones/list") return await listAdminMilestones(env, cors);
        if (url.pathname === "/api/admin/milestones/create") return await createMilestone(body, env, cors);
        if (url.pathname === "/api/admin/milestones/update") return await updateMilestone(body, env, cors);
        if (url.pathname === "/api/admin/milestones/set-active") return await setMilestoneActive(body, env, cors);
        if (url.pathname === "/api/admin/rewards/list") return await listAdminRewards(env, cors);
        if (url.pathname === "/api/admin/rewards/create") return await createReward(body, env, cors);
        if (url.pathname === "/api/admin/rewards/update") return await updateReward(body, env, cors);
        if (url.pathname === "/api/admin/rewards/set-active") return await setRewardActive(body, env, cors);
        if (url.pathname === "/api/admin/archive/list") return await listAdminArchiveEntries(env, cors);
        if (url.pathname === "/api/admin/archive/create") return await createArchiveEntry(body, env, cors);
        if (url.pathname === "/api/admin/archive/update") return await updateArchiveEntry(body, env, cors);
        if (url.pathname === "/api/admin/archive/set-active") return await setArchiveEntryActive(body, env, cors);
        if (url.pathname === "/api/admin/rewards/redemptions") return await listRewardRedemptions(env, cors);
        if (url.pathname === "/api/admin/rewards/fulfill") return await fulfillReward(body, env, cors);
        if (url.pathname === "/api/admin/invitation/get") return await getAdminInvitation(env, cors);
        if (url.pathname === "/api/admin/invitation/update") return await updateInvitation(body, env, cors);
        if (url.pathname === "/api/admin/signals/create") return await createSignal(body, env, cors);
        if (url.pathname === "/api/admin/signals/list") return await listAdminSignals(env, cors);
        if (url.pathname === "/api/admin/signals/details") return await getAdminSignal(body, env, cors);
        if (url.pathname === "/api/admin/signals/retire") return await retireSignal(body, env, cors);
        if (url.pathname === "/api/admin/technique/member") return await getAdminTechniqueMember(body, env, cors);
        if (url.pathname === "/api/admin/technique/requests") return await listTechniqueRequests(env, cors);
        if (url.pathname === "/api/admin/technique/check") return await recordTechniqueCheck(body, env, cors);
        if (url.pathname === "/api/admin/technique/settings/get") return await getAdminTechniqueSettings(env, cors);
        if (url.pathname === "/api/admin/technique/settings/update") return await updateTechniqueSettings(body, env, cors);
        if (url.pathname === "/api/admin/instructors/list") return await listInstructors(env, cors);
        if (url.pathname === "/api/admin/instructors/set") return await setInstructorRole(body, env, cors);
        if (url.pathname === "/api/admin/membership/list") return await listMembershipRequests(env, cors);
        if (url.pathname === "/api/admin/membership/update") return await updateMembershipRequest(body, env, cors);
        if (url.pathname === "/api/admin/membership/available-cards") return await listAvailableInvitationCards(env, cors);
      }
      if (request.method === "GET" && url.pathname === "/api/health") return json({ status: "ok" }, 200, cors);
      return json({ error: "Not found." }, 404, cors);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status, cors);
      console.error("Inner Circle API error", error);
      return json({ error: "The Underground is temporarily unavailable." }, 500, cors);
    }
  }
};

async function lookupCard(rawCardId, accessToken, env, cors) {
  const cardId = normalizeCardId(rawCardId);
  const passport = await getPassportByHash(await sha256(cardId), env);
  if (!passport || passport.disabled_at) return json({ status: "invalid" }, 404, cors);
  if (passport.status === "unclaimed") return json({ status: "unclaimed", cardNumber: passport.card_number }, 200, cors);
  if (passport.status !== "claimed") return json({ status: "unavailable" }, 403, cors);
  if (!passport.pin_hash) return json({ status: "pin_setup", cardNumber: passport.card_number }, 200, cors);
  if (!await hasValidPinSession(passport.passport_id, accessToken, env)) return json({ status: "pin_required", cardNumber: passport.card_number }, 200, cors);
  return json({ status: "claimed", passport: await buildPublicPassport(passport, env) }, 200, cors);
}

async function claimCard(rawCardId, rawMemberName, env, cors) {
  const cardId = normalizeCardId(rawCardId);
  const memberName = normalizeMemberName(rawMemberName);
  const cardHash = await sha256(cardId);
  const result = await env.DB.prepare(`
    UPDATE passports
    SET status = 'claimed', member_name = ?, activation_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE card_id = (SELECT id FROM cards WHERE card_hash = ? AND disabled_at IS NULL)
      AND status = 'unclaimed'
    RETURNING id
  `).bind(memberName, cardHash).first();

  if (!result) {
    const existing = await getPassportByHash(cardHash, env);
    if (!existing || existing.disabled_at) return json({ status: "invalid" }, 404, cors);
    if (existing.status === "claimed") return json({ status: existing.pin_hash ? "pin_required" : "pin_setup", cardNumber: existing.card_number }, 409, cors);
    return json({ status: "unavailable" }, 403, cors);
  }
  const passport = await getPassportByHash(cardHash, env);
  return json({ status: "pin_setup", cardNumber: passport.card_number }, 201, cors);
}

async function setupCardPin(body, env, cors) {
  const cardId = normalizeCardId(body.cardId);
  const pin = normalizePin(body.pin);
  const passport = await getPassportByHash(await sha256(cardId), env);
  if (!passport || passport.disabled_at) throw new HttpError(404, "Card not recognized.");
  if (passport.status !== "claimed") throw new HttpError(403, "Claim this access card first.");
  if (passport.pin_hash) throw new HttpError(409, "This card already has a PIN.");
  const salt = makeRandomToken(16);
  const pinHash = await hashPin(pin, salt);
  await env.DB.prepare(`UPDATE passports SET pin_hash = ?, pin_salt = ?, pin_failed_attempts = 0, pin_locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND pin_hash IS NULL`)
    .bind(pinHash, salt, passport.passport_id).run();
  const accessToken = await createPinSession(passport.passport_id, env);
  const refreshed = await getPassportByHash(await sha256(cardId), env);
  return json({ status: "claimed", accessToken, passport: await buildPublicPassport(refreshed, env) }, 201, cors);
}

async function unlockCardPin(body, env, cors) {
  const cardId = normalizeCardId(body.cardId);
  const pin = normalizePin(body.pin);
  const passport = await getPassportByHash(await sha256(cardId), env);
  if (!passport || passport.disabled_at) throw new HttpError(404, "Card not recognized.");
  if (!passport.pin_hash) return json({ status: "pin_setup", cardNumber: passport.card_number }, 409, cors);
  if (passport.pin_locked_until && new Date(`${passport.pin_locked_until.replace(" ", "T")}Z`).getTime() > Date.now()) {
    throw new HttpError(429, "Too many incorrect attempts. Try again in 15 minutes.");
  }
  const valid = constantTimeEqual(await hashPin(pin, passport.pin_salt), passport.pin_hash);
  if (!valid) {
    const failedAttempts = Number(passport.pin_failed_attempts || 0) + 1;
    const lock = failedAttempts >= 5;
    await env.DB.prepare(`UPDATE passports SET pin_failed_attempts = ?, pin_locked_until = CASE WHEN ? THEN datetime('now', '+15 minutes') ELSE NULL END WHERE id = ?`)
      .bind(lock ? 0 : failedAttempts, lock ? 1 : 0, passport.passport_id).run();
    throw new HttpError(lock ? 429 : 403, lock ? "Too many incorrect attempts. Try again in 15 minutes." : "That PIN is not correct.");
  }
  await env.DB.prepare(`UPDATE passports SET pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = ?`).bind(passport.passport_id).run();
  const accessToken = await createPinSession(passport.passport_id, env);
  return json({ status: "claimed", accessToken, passport: await buildPublicPassport(passport, env) }, 200, cors);
}

async function requestPinReset(body, env, cors) {
  const passport = await getPassportByHash(await sha256(normalizeCardId(body.cardId)), env);
  if (!passport || passport.disabled_at || passport.status !== "claimed") throw new HttpError(404, "Card not recognized.");
  await env.DB.prepare(`INSERT OR IGNORE INTO pin_reset_requests (passport_id) VALUES (?)`).bind(passport.passport_id).run();
  return json({ status: "requested", message: "Reset requested. PIN resets are completed at the convenience of the JustBaila team." }, 201, cors);
}

async function createPinSession(passportId, env) {
  const accessToken = makeRandomToken(32);
  await env.DB.prepare(`INSERT INTO card_access_sessions (token_hash, passport_id, expires_at) VALUES (?, ?, datetime('now', '+24 hours'))`)
    .bind(await sha256(accessToken), passportId).run();
  return accessToken;
}

async function hasValidPinSession(passportId, accessToken, env) {
  if (!accessToken) return false;
  const session = await env.DB.prepare(`SELECT token_hash FROM card_access_sessions WHERE token_hash = ? AND passport_id = ? AND expires_at > CURRENT_TIMESTAMP LIMIT 1`)
    .bind(await sha256(String(accessToken)), passportId).first();
  return Boolean(session);
}

async function requirePinSession(body, env) {
  const passport = await getPassportByHash(await sha256(normalizeCardId(body.cardId)), env);
  if (!passport || passport.disabled_at || !await hasValidPinSession(passport.passport_id, body.accessToken, env)) throw new HttpError(401, "Enter your card PIN again.");
  return passport;
}

async function adminResetPin(body, env, cors) {
  const passportId = normalizePositiveInteger(body.passportId, "Passport");
  await env.DB.batch([
    env.DB.prepare(`UPDATE passports SET pin_hash = NULL, pin_salt = NULL, pin_failed_attempts = 0, pin_locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(passportId),
    env.DB.prepare(`DELETE FROM card_access_sessions WHERE passport_id = ?`).bind(passportId),
    env.DB.prepare(`UPDATE pin_reset_requests SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE passport_id = ? AND status = 'pending'`).bind(passportId)
  ]);
  return json({ status: "reset" }, 200, cors);
}

async function dismissPinReset(body, env, cors) {
  const passportId = normalizePositiveInteger(body.passportId, "Passport");
  await env.DB.prepare(`UPDATE pin_reset_requests SET status = 'dismissed', resolved_at = CURRENT_TIMESTAMP WHERE passport_id = ? AND status = 'pending'`).bind(passportId).run();
  return json({ status: "dismissed" }, 200, cors);
}

async function getPassportByHash(cardHash, env) {
  return env.DB.prepare(`
    SELECT c.card_number, c.disabled_at, p.id AS passport_id, p.status, p.member_name, p.activation_date, p.pin_hash, p.pin_salt, p.pin_failed_attempts, p.pin_locked_until,
      EXISTS (SELECT 1 FROM passport_roles pr WHERE pr.passport_id = p.id AND pr.role = 'instructor') AS is_instructor,
      (SELECT COUNT(*) FROM event_attendance ea WHERE ea.passport_id = p.id) AS attendance_count,
      (SELECT COUNT(*) FROM stamps s WHERE s.passport_id = p.id) AS stamp_count,
      (SELECT COUNT(DISTINCT mc.mission_id) FROM mission_completions mc WHERE mc.passport_id = p.id) AS mission_count,
      (SELECT COALESCE(SUM(kt.amount), 0) FROM key_transactions kt WHERE kt.passport_id = p.id) AS key_balance
    FROM cards c JOIN passports p ON p.card_id = c.id
    WHERE c.card_hash = ? LIMIT 1
  `).bind(cardHash).first();
}

async function buildPublicPassport(passport, env) {
  await evaluateMilestones(passport.passport_id, env);
  const membershipAccess = await ensureMembershipCapabilities(passport.passport_id, env);
  const relayCode = await ensureMemberRelayCode(passport.passport_id, env);
  const techniqueLab = await buildTechniqueLab(passport.passport_id, env, false);
  const doorAccess = getDoorAccess(passport);
  const [missionsResult, latestKeyTransaction, milestonesResult, invitation, rewardsResult, signalsResult, archiveResult] = await Promise.all([
    env.DB.prepare(`
      SELECT m.code, m.title, m.description, m.key_reward, m.repeatable, m.cooldown_hours, m.verification_required, m.counts_as_event, m.scope, m.social_checkin_only,
        ma.status AS assignment_status,
        COUNT(mc.id) AS completion_count, MAX(mc.verified_at) AS completed_at,
        COALESCE(SUM(CASE WHEN kt.amount > 0 THEN kt.amount ELSE 0 END), 0) AS keys_earned
      FROM missions m
      LEFT JOIN mission_completions mc ON mc.mission_id = m.id AND mc.passport_id = ?
      LEFT JOIN key_transactions kt ON kt.reason_type = 'mission' AND kt.reason_id = mc.id
      LEFT JOIN mission_assignments ma ON ma.mission_id = m.id AND ma.passport_id = ? AND ma.status = 'active'
      WHERE m.active = 1
        AND (m.scope = 'global' OR ma.id IS NOT NULL)
        AND (m.social_checkin_only = 0 OR EXISTS (
          SELECT 1 FROM invitation_settings settings WHERE settings.id = 1 AND settings.social_checkin_visible = 1
        ))
      GROUP BY m.id, ma.id
      ORDER BY CASE WHEN m.scope = 'individual' THEN 0 ELSE 1 END, m.sort_order, m.id
    `).bind(passport.passport_id, passport.passport_id).all(),
    env.DB.prepare(`
      SELECT id, amount, description, created_at FROM key_transactions
      WHERE passport_id = ? AND amount > 0 ORDER BY created_at DESC, id DESC LIMIT 1
    `).bind(passport.passport_id).first(),
    env.DB.prepare(`
      SELECT m.code, m.title, m.description, m.reveal_text, m.criteria_type, m.threshold, m.claimable_by_code, m.member_claimable,
        pm.achieved_at
      FROM milestones m
      LEFT JOIN passport_milestones pm ON pm.milestone_id = m.id AND pm.passport_id = ?
      WHERE m.active = 1 AND (m.hidden_until_achieved = 0 OR pm.achieved_at IS NOT NULL)
      ORDER BY m.sort_order, m.id
    `).bind(passport.passport_id).all(),
    env.DB.prepare(`
      SELECT kicker, title, description, button_label, button_url, social_checkin_visible, signals_visible, updated_at
      FROM invitation_settings WHERE id = 1
    `).first(),
    env.DB.prepare(`
      SELECT r.code, r.name AS title, r.description, r.key_cost,
        EXISTS(SELECT 1 FROM reward_redemptions rr WHERE rr.reward_id = r.id AND rr.passport_id = ? AND rr.status = 'requested') AS pending
      FROM rewards r WHERE r.active = 1 ORDER BY r.sort_order, r.id
    `).bind(passport.passport_id).all(),
    env.DB.prepare(`
      SELECT s.public_code, COALESCE(NULLIF(s.title, ''), st.name) AS title, st.code AS type, s.created_at, s.last_relayed_at
      FROM signals s JOIN signal_types st ON st.id = s.signal_type_id
      WHERE s.current_holder_id = ? AND s.status = 'active'
      ORDER BY COALESCE(s.last_relayed_at, s.created_at) DESC
    `).bind(passport.passport_id).all(),
    env.DB.prepare(`
      SELECT code, label, title, body, content_type, action_label, href
      FROM archive_entries WHERE active = 1 ORDER BY sort_order, id
    `).all()
  ]);

  const milestones = (milestonesResult.results || []).map((milestone) => ({
    code: milestone.code,
    title: milestone.title,
    description: milestone.achieved_at && milestone.reveal_text ? milestone.reveal_text : milestone.description,
    criteriaType: milestone.criteria_type,
    threshold: Number(milestone.threshold || 0),
    claimableByCode: Boolean(milestone.claimable_by_code),
    memberClaimable: Boolean(milestone.member_claimable),
    achieved: Boolean(milestone.achieved_at),
    achievedAt: milestone.achieved_at
  }));

  return {
    cardNumber: passport.card_number,
    memberName: passport.member_name,
    activationDate: passport.activation_date,
    attendanceCount: Number(passport.attendance_count || 0),
    milestoneCount: milestones.filter((milestone) => milestone.achieved).length,
    missionCount: Number(passport.mission_count || 0),
    undergroundLevel: getUndergroundLevel(Number(passport.mission_count || 0)),
    keyBalance: Number(passport.key_balance || 0),
    relayCode,
    isInstructor: Boolean(passport.is_instructor),
    doorAccess,
    membershipAccess,
    techniqueLab,
    archiveEntries: (archiveResult.results || []).map(toArchiveEntry),
    signals: (signalsResult.results || []).map((signal) => ({
      code: signal.public_code,
      title: signal.title,
      type: signal.type,
      receivedAt: signal.last_relayed_at || signal.created_at
    })),
    socialCheckinVisible: Boolean(invitation?.social_checkin_visible),
    signalsVisible: Boolean(invitation?.signals_visible),
    invitation: invitation ? {
      kicker: invitation.kicker,
      title: invitation.title,
      description: invitation.description,
      buttonLabel: invitation.button_label,
      buttonUrl: invitation.button_url,
      updatedAt: invitation.updated_at
    } : null,
    milestones,
    rewards: (rewardsResult.results || []).map((reward) => ({
      code: reward.code, title: reward.title, description: reward.description,
      keyCost: Number(reward.key_cost), pending: Boolean(reward.pending)
    })),
    missions: (missionsResult.results || []).map((mission) => ({
      code: mission.code,
      title: mission.title,
      description: mission.description,
      keyReward: Number(mission.key_reward),
      repeatable: Boolean(mission.repeatable),
      cooldownHours: Number(mission.cooldown_hours || 0),
      verificationRequired: Boolean(mission.verification_required),
      countsAsEvent: Boolean(mission.counts_as_event),
      scope: mission.scope,
      privateAssignment: mission.scope === "individual",
      socialCheckinOnly: Boolean(mission.social_checkin_only),
      assignmentStatus: mission.assignment_status || null,
      completed: Number(mission.completion_count) > 0,
      completionCount: Number(mission.completion_count),
      completedAt: mission.completed_at,
      nextAvailableAt: getMissionNextAvailableAt(mission.completed_at, Number(mission.cooldown_hours || 0)),
      keysEarned: Number(mission.keys_earned || 0)
    })),
    latestKeyTransaction: latestKeyTransaction ? {
      id: latestKeyTransaction.id,
      amount: Number(latestKeyTransaction.amount),
      description: latestKeyTransaction.description,
      createdAt: latestKeyTransaction.created_at
    } : null
  };
}

function getDoorAccess(_passport) {
  return { state: "locked" };
}

async function getLifetimeKeysEarned(passportId, env) {
  const result = await env.DB.prepare(`
    SELECT COALESCE(SUM(kt.amount), 0) AS lifetime_keys
    FROM key_transactions kt
    JOIN mission_completions mc ON mc.id = kt.reason_id AND mc.passport_id = kt.passport_id
    WHERE kt.passport_id = ? AND kt.transaction_type = 'earned' AND kt.reason_type = 'mission' AND kt.amount > 0
  `).bind(passportId).first();
  return Number(result?.lifetime_keys || 0);
}

async function ensureMembershipCapabilities(passportId, env) {
  const lifetimeKeys = await getLifetimeKeysEarned(passportId, env);
  const statements = [];
  if (lifetimeKeys >= 25) statements.push(env.DB.prepare(`INSERT OR IGNORE INTO member_capabilities (passport_id, capability) VALUES (?, 'membership_nomination')`).bind(passportId));
  if (lifetimeKeys >= 75) statements.push(env.DB.prepare(`INSERT OR IGNORE INTO member_capabilities (passport_id, capability) VALUES (?, 'membership_invitation')`).bind(passportId));
  if (statements.length) await env.DB.batch(statements);
  const result = await env.DB.prepare(`SELECT capability, unlocked_at FROM member_capabilities WHERE passport_id = ?`).bind(passportId).all();
  const capabilities = new Map((result.results || []).map((row) => [row.capability, row.unlocked_at]));
  return {
    canNominate: capabilities.has('membership_nomination'),
    canInvite: capabilities.has('membership_invitation'),
    nominationUnlockedAt: capabilities.get('membership_nomination') || null,
    invitationUnlockedAt: capabilities.get('membership_invitation') || null
  };
}

async function requireMembershipCapability(rawCardId, capability, env) {
  const cardId = normalizeCardId(rawCardId);
  const passport = await getPassportByHash(await sha256(cardId), env);
  if (!passport || passport.disabled_at) throw new HttpError(404, "Card not recognized.");
  if (passport.status !== "claimed") throw new HttpError(403, "Enter the Underground first.");
  await ensureMembershipCapabilities(passport.passport_id, env);
  const access = await env.DB.prepare(`SELECT 1 AS allowed FROM member_capabilities WHERE passport_id = ? AND capability = ? LIMIT 1`).bind(passport.passport_id, capability).first();
  if (!access) throw new HttpError(403, "That access has not been granted.");
  return passport;
}

async function submitMembershipNomination(body, env, cors) {
  const passport = await requireMembershipCapability(body.cardId, 'membership_nomination', env);
  const nominee = normalizeMissionText(body.nominee, "Who you are thinking of", 2, 160);
  const reason = normalizeOptionalText(body.reason, "Reason", 600);
  await env.DB.prepare(`INSERT INTO membership_nominations (id, nominator_passport_id, nominee_description, reason) VALUES (?, ?, ?, ?)`).bind(`nom_${crypto.randomUUID()}`, passport.passport_id, nominee, reason || null).run();
  return json({ status: "submitted", message: "SIGNAL SENT // We'll take it from here." }, 201, cors);
}

async function submitMembershipInvitation(body, env, cors) {
  const passport = await requireMembershipCapability(body.cardId, 'membership_invitation', env);
  const invitee = normalizeMissionText(body.invitee, "Who you are inviting", 2, 160);
  const note = normalizeOptionalText(body.note, "Note", 600);
  await env.DB.prepare(`INSERT INTO membership_invitations (id, inviter_passport_id, invitee_description, note) VALUES (?, ?, ?, ?)`).bind(`invite_${crypto.randomUUID()}`, passport.passport_id, invitee, note || null).run();
  return json({ status: "requested", message: "INVITATION RECORDED // We'll prepare the access card." }, 201, cors);
}

function getUndergroundLevel(completedMissionCount) {
  if (completedMissionCount >= 30) return "UNKNOWN";
  if (completedMissionCount >= 19) return "ARCHITECT";
  if (completedMissionCount >= 13) return "ENVOY";
  if (completedMissionCount >= 6) return "INSIDER";
  if (completedMissionCount >= 3) return "AGENT";
  if (completedMissionCount >= 1) return "OPERATIVE";
  return "INITIATE";
}

async function ensureMemberRelayCode(passportId, env) {
  const existing = await env.DB.prepare(`SELECT code_display FROM member_relay_codes WHERE passport_id = ? LIMIT 1`).bind(passportId).first();
  if (existing) return existing.code_display;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode(6);
    try {
      await env.DB.prepare(`INSERT INTO member_relay_codes (passport_id, code_hash, code_display) VALUES (?, ?, ?)`).bind(passportId, await sha256(code), code).run();
      return code;
    } catch (error) {
      const created = await env.DB.prepare(`SELECT code_display FROM member_relay_codes WHERE passport_id = ? LIMIT 1`).bind(passportId).first();
      if (created) return created.code_display;
    }
  }
  throw new HttpError(503, "A relay code could not be created. Please try again.");
}

async function resolveSignalRecipient(body, env, cors) {
  const sender = await getClaimedPassportFromCard(body.cardId, env);
  const signal = await getHeldSignal(body.signalCode, sender.passport_id, env);
  const relayCode = normalizeRelayCode(body.relayCode);
  const recipient = await env.DB.prepare(`
    SELECT p.id AS passport_id, p.member_name FROM member_relay_codes mrc
    JOIN passports p ON p.id = mrc.passport_id
    WHERE mrc.code_hash = ? AND p.status = 'claimed' LIMIT 1
  `).bind(await sha256(relayCode)).first();
  if (!recipient) throw new HttpError(404, "That member code was not recognized.");
  if (Number(recipient.passport_id) === Number(sender.passport_id)) throw new HttpError(409, "A Signal cannot be relayed back to yourself.");
  return json({ signal: { code: signal.public_code, title: signal.title }, recipient: { name: recipient.member_name, relayCode } }, 200, cors);
}

async function relaySignal(body, env, cors) {
  const sender = await getClaimedPassportFromCard(body.cardId, env);
  const signalCode = String(body.signalCode || "").trim().toUpperCase();
  const relayCode = normalizeRelayCode(body.relayCode);
  const idempotencyKey = String(body.idempotencyKey || "").trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) throw new HttpError(400, "Invalid relay request.");
  const recipient = await env.DB.prepare(`
    SELECT p.id AS passport_id, p.member_name FROM member_relay_codes mrc
    JOIN passports p ON p.id = mrc.passport_id
    WHERE mrc.code_hash = ? AND p.status = 'claimed' LIMIT 1
  `).bind(await sha256(relayCode)).first();
  if (!recipient) throw new HttpError(404, "That member code was not recognized.");
  if (Number(recipient.passport_id) === Number(sender.passport_id)) throw new HttpError(409, "A Signal cannot be relayed back to yourself.");

  const signal = await env.DB.prepare(`SELECT id, current_holder_id, status FROM signals WHERE public_code = ? LIMIT 1`).bind(signalCode).first();
  if (!signal || signal.status !== "active") throw new HttpError(404, "That Signal is no longer active.");
  const prior = await env.DB.prepare(`SELECT signal_id, sender_passport_id, recipient_passport_id FROM signal_relays WHERE idempotency_key = ? LIMIT 1`).bind(idempotencyKey).first();
  if (prior) {
    if (prior.signal_id !== signal.id || Number(prior.sender_passport_id) !== Number(sender.passport_id) || Number(prior.recipient_passport_id) !== Number(recipient.passport_id)) throw new HttpError(409, "That relay request has already been used.");
    return json({ status: "relayed", message: "SIGNAL RELAYED", passport: await buildPublicPassport(sender, env) }, 200, cors);
  }

  const relayId = `relay_${crypto.randomUUID()}`;
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO signal_relays (id, idempotency_key, signal_id, sender_passport_id, recipient_passport_id, event_id)
      SELECT ?, ?, s.id, ?, ?, s.event_id FROM signals s
      WHERE s.id = ? AND s.status = 'active' AND s.current_holder_id = ?
    `).bind(relayId, idempotencyKey, sender.passport_id, recipient.passport_id, signal.id, sender.passport_id),
    env.DB.prepare(`
      UPDATE signals SET current_holder_id = ?, last_relayed_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'active' AND current_holder_id = ?
        AND EXISTS (SELECT 1 FROM signal_relays WHERE id = ?)
    `).bind(recipient.passport_id, signal.id, sender.passport_id, relayId)
  ]);
  const completed = await env.DB.prepare(`SELECT id FROM signal_relays WHERE id = ? LIMIT 1`).bind(relayId).first();
  if (!completed) throw new HttpError(409, "The Signal has already moved. Refresh to see its current location.");
  await evaluateMilestones(sender.passport_id, env);
  await evaluateMilestones(recipient.passport_id, env);
  const chain = await env.DB.prepare(`
    SELECT DISTINCT holder_id FROM (
      SELECT original_holder_id AS holder_id FROM signals WHERE id = ?
      UNION SELECT recipient_passport_id AS holder_id FROM signal_relays WHERE signal_id = ?
    )
  `).bind(signal.id, signal.id).all();
  if ((chain.results || []).length >= 10) {
    for (const holder of chain.results || []) await evaluateMilestones(Number(holder.holder_id), env);
  }
  return json({ status: "relayed", message: "SIGNAL RELAYED", recipient: { name: recipient.member_name }, passport: await buildPublicPassport(sender, env) }, 201, cors);
}

async function getClaimedPassportFromCard(rawCardId, env) {
  const passport = await getPassportByHash(await sha256(normalizeCardId(rawCardId)), env);
  if (!passport || passport.disabled_at) throw new HttpError(404, "Card not recognized.");
  if (passport.status !== "claimed") throw new HttpError(403, "Activate your access card first.");
  return passport;
}

async function getHeldSignal(rawSignalCode, passportId, env) {
  const signalCode = String(rawSignalCode || "").trim().toUpperCase();
  const signal = await env.DB.prepare(`
    SELECT s.id, s.public_code, COALESCE(NULLIF(s.title, ''), st.name) AS title
    FROM signals s JOIN signal_types st ON st.id = s.signal_type_id
    WHERE s.public_code = ? AND s.current_holder_id = ? AND s.status = 'active' LIMIT 1
  `).bind(signalCode, passportId).first();
  if (!signal) throw new HttpError(409, "You are no longer carrying that Signal.");
  return signal;
}

async function createSignal(body, env, cors) {
  const passportId = normalizePositiveInteger(body.passportId, "Member");
  const title = String(body.title || "").trim().slice(0, 100);
  const eventId = body.eventId ? normalizePositiveInteger(body.eventId, "Event") : null;
  const passport = await getPassportById(passportId, env);
  if (!passport || passport.status !== "claimed") throw new HttpError(404, "Member not found.");
  const type = await env.DB.prepare(`SELECT id FROM signal_types WHERE code = 'wandering' AND active = 1 LIMIT 1`).first();
  const signalId = `signal_${crypto.randomUUID()}`;
  let publicCode = "";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    publicCode = `WS-${randomCode(6)}`;
    try {
      await env.DB.prepare(`
        INSERT INTO signals (id, public_code, signal_type_id, title, original_holder_id, current_holder_id, released_by, event_id)
        VALUES (?, ?, ?, ?, ?, ?, 'inner-circle-admin', ?)
      `).bind(signalId, publicCode, type.id, title || null, passportId, passportId, eventId).run();
      break;
    } catch (error) {
      if (attempt === 7) throw error;
      publicCode = "";
    }
  }
  return json({ status: "created", signal: await getAdminSignalRecord(signalId, env) }, 201, cors);
}

async function listAdminSignals(env, cors) {
  const result = await env.DB.prepare(`
    SELECT s.id, s.public_code, COALESCE(NULLIF(s.title, ''), st.name) AS title, s.status,
      p.member_name AS current_holder, s.created_at, s.last_relayed_at,
      (SELECT COUNT(*) FROM signal_relays sr WHERE sr.signal_id = s.id) AS relay_count,
      (SELECT COUNT(DISTINCT holder_id) FROM (SELECT s.original_holder_id AS holder_id UNION SELECT sr.recipient_passport_id FROM signal_relays sr WHERE sr.signal_id = s.id)) AS unique_members
    FROM signals s JOIN signal_types st ON st.id = s.signal_type_id JOIN passports p ON p.id = s.current_holder_id
    ORDER BY s.status = 'active' DESC, COALESCE(s.last_relayed_at, s.created_at) DESC
  `).all();
  return json({ signals: result.results || [] }, 200, cors);
}

async function getAdminSignal(body, env, cors) {
  const signalId = String(body.signalId || "").trim();
  const signal = await getAdminSignalRecord(signalId, env);
  if (!signal) throw new HttpError(404, "Signal not found.");
  const history = await env.DB.prepare(`
    SELECT sr.relayed_at, sender.member_name AS sender_name, recipient.member_name AS recipient_name
    FROM signal_relays sr JOIN passports sender ON sender.id = sr.sender_passport_id
    JOIN passports recipient ON recipient.id = sr.recipient_passport_id
    WHERE sr.signal_id = ? ORDER BY sr.relayed_at, sr.id
  `).bind(signalId).all();
  return json({ signal, history: history.results || [] }, 200, cors);
}

async function getAdminSignalRecord(signalId, env) {
  return env.DB.prepare(`
    SELECT s.id, s.public_code, COALESCE(NULLIF(s.title, ''), st.name) AS title, st.code AS type, s.status,
      original.member_name AS original_holder, current.member_name AS current_holder,
      e.title AS event_title, s.created_at, s.last_relayed_at, s.retired_at,
      (SELECT COUNT(*) FROM signal_relays sr WHERE sr.signal_id = s.id) AS relay_count,
      (SELECT COUNT(DISTINCT holder_id) FROM (SELECT s.original_holder_id AS holder_id UNION SELECT sr.recipient_passport_id FROM signal_relays sr WHERE sr.signal_id = s.id)) AS unique_members
    FROM signals s JOIN signal_types st ON st.id = s.signal_type_id
    JOIN passports original ON original.id = s.original_holder_id JOIN passports current ON current.id = s.current_holder_id
    LEFT JOIN events e ON e.id = s.event_id WHERE s.id = ? LIMIT 1
  `).bind(signalId).first();
}

async function retireSignal(body, env, cors) {
  const signalId = String(body.signalId || "").trim();
  const result = await env.DB.prepare(`UPDATE signals SET status = 'retired', retired_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active' RETURNING id`).bind(signalId).first();
  if (!result) throw new HttpError(404, "Active Signal not found.");
  return json({ status: "retired" }, 200, cors);
}

async function redeemReward(body, env, cors) {
  const cardId = normalizeCardId(body.cardId);
  const rewardCode = String(body.rewardCode || "").trim();
  const idempotencyKey = String(body.idempotencyKey || "").trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) throw new HttpError(400, "Invalid redemption request.");
  const passport = await getPassportByHash(await sha256(cardId), env);
  if (!passport || passport.disabled_at) throw new HttpError(404, "Card not recognized.");
  if (passport.status !== "claimed") throw new HttpError(403, "Enter the Underground before redeeming rewards.");
  const reward = await env.DB.prepare(`SELECT id, name AS title, key_cost FROM rewards WHERE code = ? AND active = 1 LIMIT 1`).bind(rewardCode).first();
  if (!reward) throw new HttpError(404, "Reward not found.");
  const existing = await env.DB.prepare(`SELECT id FROM reward_redemptions WHERE id = ? LIMIT 1`).bind(idempotencyKey).first();
  if (!existing) {
    const balance = Number(passport.key_balance || 0);
    const cost = Number(reward.key_cost);
    if (balance < cost) throw new HttpError(409, `You need ${cost - balance} more Keys for this reward.`);
    try {
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO reward_redemptions (id, passport_id, reward_id, keys_spent) VALUES (?, ?, ?, ?)`)
          .bind(idempotencyKey, passport.passport_id, reward.id, cost),
        env.DB.prepare(`INSERT INTO key_transactions
          (id, passport_id, amount, transaction_type, reason_type, reason_id, description, created_by)
          VALUES (?, ?, ?, 'spent', 'reward', ?, ?, 'member')`)
          .bind(`key_${idempotencyKey}`, passport.passport_id, -cost, idempotencyKey, `Reward redeemed: ${reward.title}`)
      ]);
    } catch (error) {
      if (String(error).includes("insufficient key balance")) throw new HttpError(409, "You no longer have enough Keys for this reward.");
      if (String(error).includes("UNIQUE")) {
        const repeatedRequest = await env.DB.prepare(`SELECT id FROM reward_redemptions WHERE id = ? LIMIT 1`).bind(idempotencyKey).first();
        if (!repeatedRequest) throw new HttpError(409, "This reward already has a pending redemption.");
      } else {
        throw error;
      }
    }
  }
  const refreshed = await getPassportByHash(await sha256(cardId), env);
  return json({ status: "requested", rewardTitle: reward.title, passport: await buildPublicPassport(refreshed, env) }, 201, cors);
}

async function listAdminRewards(env, cors) {
  const result = await env.DB.prepare(`
    SELECT r.code, r.name AS title, r.description, r.key_cost, r.active,
      COUNT(rr.id) AS redemption_count
    FROM rewards r LEFT JOIN reward_redemptions rr ON rr.reward_id = r.id
    GROUP BY r.id ORDER BY r.active DESC, r.sort_order, r.id
  `).all();
  return json({ rewards: (result.results || []).map(toAdminReward) }, 200, cors);
}

async function createReward(body, env, cors) {
  const title = normalizeMissionText(body.title, "Reward title", 3, 100);
  const description = normalizeMissionText(body.description, "Description", 3, 500);
  const keyCost = normalizeRewardCost(body.keyCost);
  const slug = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "reward";
  const code = `${slug}-${crypto.randomUUID().slice(0, 6)}`;
  const sortResult = await env.DB.prepare(`SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order FROM rewards`).first();
  await env.DB.prepare(`INSERT INTO rewards (code, name, description, key_cost, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`)
    .bind(code, title, description, keyCost, Number(sortResult.next_order)).run();
  return json({ status: "created", code }, 201, cors);
}

async function updateReward(body, env, cors) {
  const code = String(body.code || "").trim();
  const title = normalizeMissionText(body.title, "Reward title", 3, 100);
  const description = normalizeMissionText(body.description, "Description", 3, 500);
  const keyCost = normalizeRewardCost(body.keyCost);
  const result = await env.DB.prepare(`UPDATE rewards SET name = ?, description = ?, key_cost = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ? RETURNING id`)
    .bind(title, description, keyCost, code).first();
  if (!result) throw new HttpError(404, "Reward not found.");
  return json({ status: "updated" }, 200, cors);
}

async function setRewardActive(body, env, cors) {
  const code = String(body.code || "").trim();
  const active = normalizeBoolean(body.active);
  const result = await env.DB.prepare(`UPDATE rewards SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ? RETURNING id`).bind(active, code).first();
  if (!result) throw new HttpError(404, "Reward not found.");
  return json({ status: active ? "restored" : "archived" }, 200, cors);
}

async function listRewardRedemptions(env, cors) {
  const result = await env.DB.prepare(`
    SELECT rr.id, rr.keys_spent, rr.status, rr.redeemed_at, rr.fulfilled_at,
      r.name AS reward_title, p.member_name, c.card_number
    FROM reward_redemptions rr
    JOIN rewards r ON r.id = rr.reward_id
    JOIN passports p ON p.id = rr.passport_id
    JOIN cards c ON c.id = p.card_id
    ORDER BY CASE rr.status WHEN 'requested' THEN 0 ELSE 1 END, rr.redeemed_at DESC LIMIT 100
  `).all();
  return json({ redemptions: result.results || [] }, 200, cors);
}

async function fulfillReward(body, env, cors) {
  const id = String(body.id || "").trim();
  const result = await env.DB.prepare(`
    UPDATE reward_redemptions SET status = 'fulfilled', fulfilled_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'requested' RETURNING id
  `).bind(id).first();
  if (!result) throw new HttpError(404, "Pending redemption not found.");
  return json({ status: "fulfilled" }, 200, cors);
}

function toAdminReward(reward) {
  return { code: reward.code, title: reward.title, description: reward.description,
    keyCost: Number(reward.key_cost), active: Boolean(reward.active), redemptionCount: Number(reward.redemption_count) };
}

async function listAdminArchiveEntries(env, cors) {
  const result = await env.DB.prepare(`
    SELECT code, label, title, body, content_type, action_label, href, active, sort_order
    FROM archive_entries ORDER BY active DESC, sort_order, id
  `).all();
  return json({ entries: (result.results || []).map((entry) => ({ ...toArchiveEntry(entry), active: Boolean(entry.active), sortOrder: Number(entry.sort_order) })) }, 200, cors);
}

async function createArchiveEntry(body, env, cors) {
  const entry = normalizeArchiveEntry(body);
  const slug = entry.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "archive-file";
  const code = `${slug}-${crypto.randomUUID().slice(0, 6)}`;
  const sortResult = await env.DB.prepare(`SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order FROM archive_entries`).first();
  await env.DB.prepare(`
    INSERT INTO archive_entries (code, label, title, body, content_type, action_label, href, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(code, entry.label, entry.title, entry.body, entry.contentType, entry.actionLabel, entry.href, Number(sortResult.next_order)).run();
  return json({ status: "created", code }, 201, cors);
}

async function updateArchiveEntry(body, env, cors) {
  const code = String(body.code || "").trim();
  const entry = normalizeArchiveEntry(body);
  const result = await env.DB.prepare(`
    UPDATE archive_entries SET label = ?, title = ?, body = ?, content_type = ?, action_label = ?, href = ?, updated_at = CURRENT_TIMESTAMP
    WHERE code = ? RETURNING id
  `).bind(entry.label, entry.title, entry.body, entry.contentType, entry.actionLabel, entry.href, code).first();
  if (!result) throw new HttpError(404, "Archive file not found.");
  return json({ status: "updated" }, 200, cors);
}

async function setArchiveEntryActive(body, env, cors) {
  const code = String(body.code || "").trim();
  const active = normalizeBoolean(body.active);
  const result = await env.DB.prepare(`UPDATE archive_entries SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ? RETURNING id`).bind(active, code).first();
  if (!result) throw new HttpError(404, "Archive file not found.");
  return json({ status: active ? "restored" : "hidden" }, 200, cors);
}

function toArchiveEntry(entry) {
  return {
    code: entry.code,
    label: entry.label,
    title: entry.title,
    body: entry.body,
    type: entry.content_type || "text",
    actionLabel: entry.action_label || "",
    href: entry.href || ""
  };
}

function normalizeArchiveEntry(body) {
  const label = normalizeMissionText(body.label, "Archive label", 2, 60);
  const title = normalizeMissionText(body.title, "Archive title", 3, 140);
  const entryBody = normalizeMissionText(body.body, "Archive text", 3, 1200);
  const contentType = String(body.contentType || "text").trim().toLowerCase();
  if (!new Set(["text", "link", "audio", "image", "video"]).has(contentType)) throw new HttpError(400, "Archive content type is invalid.");
  const actionLabel = String(body.actionLabel || "").trim().slice(0, 60) || null;
  const href = normalizeOptionalUrl(body.href);
  if ((actionLabel && !href) || (!actionLabel && href)) throw new HttpError(400, "Archive link text and URL must be provided together.");
  return { label, title, body: entryBody, contentType, actionLabel, href };
}

async function evaluateMilestones(passportId, env) {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO passport_milestones (passport_id, milestone_id)
    SELECT ?, m.id
    FROM milestones m
    WHERE m.active = 1
      AND m.criteria_type IS NOT NULL
      AND m.threshold IS NOT NULL
      AND (
        (m.criteria_type = 'events' AND (SELECT COUNT(*) FROM event_attendance ea WHERE ea.passport_id = ?) >= m.threshold)
        OR (m.criteria_type = 'event_locations' AND (
          SELECT COUNT(DISTINCT LOWER(TRIM(e.location)))
          FROM event_attendance ea JOIN events e ON e.id = ea.event_id
          WHERE ea.passport_id = ? AND e.location IS NOT NULL AND TRIM(e.location) != ''
        ) >= m.threshold)
        OR (m.criteria_type = 'missions' AND (SELECT COUNT(DISTINCT mc.mission_id) FROM mission_completions mc WHERE mc.passport_id = ?) >= m.threshold)
        OR (m.criteria_type = 'keys' AND (SELECT COALESCE(SUM(kt.amount), 0) FROM key_transactions kt WHERE kt.passport_id = ?) >= m.threshold)
        OR (m.criteria_type = 'signal_received' AND (
          EXISTS (SELECT 1 FROM signals s WHERE s.original_holder_id = ?)
          OR EXISTS (SELECT 1 FROM signal_relays sr WHERE sr.recipient_passport_id = ?)
        ))
        OR (m.criteria_type = 'signal_sent' AND EXISTS (
          SELECT 1 FROM signal_relays sr WHERE sr.sender_passport_id = ?
        ))
        OR (m.criteria_type = 'signal_full_circle' AND EXISTS (
          SELECT 1 FROM signal_relays return_relay
          JOIN signals s ON s.id = return_relay.signal_id
          WHERE return_relay.recipient_passport_id = ?
            AND (
              s.original_holder_id = ?
              OR EXISTS (
                SELECT 1 FROM signal_relays prior
                WHERE prior.signal_id = return_relay.signal_id
                  AND prior.recipient_passport_id = ?
                  AND prior.rowid < return_relay.rowid
              )
            )
            AND 3 <= (
              SELECT COUNT(DISTINCT earlier.recipient_passport_id)
              FROM signal_relays earlier
              WHERE earlier.signal_id = return_relay.signal_id
                AND earlier.rowid < return_relay.rowid
                AND earlier.recipient_passport_id != ?
            ) + CASE
              WHEN s.original_holder_id != ? AND NOT EXISTS (
                SELECT 1 FROM signal_relays earlier_origin
                WHERE earlier_origin.signal_id = return_relay.signal_id
                  AND earlier_origin.rowid < return_relay.rowid
                  AND earlier_origin.recipient_passport_id = s.original_holder_id
              ) THEN 1 ELSE 0 END
        ))
        OR (m.criteria_type = 'signal_long_distance' AND EXISTS (
          SELECT 1 FROM signals s
          WHERE (s.original_holder_id = ? OR EXISTS (
            SELECT 1 FROM signal_relays participation
            WHERE participation.signal_id = s.id
              AND (participation.sender_passport_id = ? OR participation.recipient_passport_id = ?)
          ))
          AND 10 <= (SELECT COUNT(DISTINCT journey.recipient_passport_id) FROM signal_relays journey WHERE journey.signal_id = s.id)
            + CASE WHEN EXISTS (
              SELECT 1 FROM signal_relays origin_check
              WHERE origin_check.signal_id = s.id AND origin_check.recipient_passport_id = s.original_holder_id
            ) THEN 0 ELSE 1 END
        ))
        OR (m.criteria_type = 'triple_threat'
          AND EXISTS (SELECT 1 FROM mission_completions mc WHERE mc.passport_id = ?)
          AND EXISTS (SELECT 1 FROM key_transactions kt WHERE kt.passport_id = ? AND kt.amount > 0)
          AND (
            EXISTS (SELECT 1 FROM signals s WHERE s.original_holder_id = ?)
            OR EXISTS (SELECT 1 FROM signal_relays sr WHERE sr.sender_passport_id = ? OR sr.recipient_passport_id = ?)
          )
        )
      )
  `).bind(
    passportId, passportId, passportId, passportId, passportId, passportId,
    passportId, passportId,
    passportId,
    passportId, passportId, passportId, passportId,
    passportId, passportId, passportId,
    passportId, passportId, passportId, passportId, passportId
  ).run();
}

async function searchPassports(rawQuery, env, cors) {
  const query = String(rawQuery || "").trim().slice(0, 80);
  const likeQuery = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const result = await env.DB.prepare(`
    SELECT p.id AS passport_id, p.member_name, p.activation_date, c.card_number, p.pin_hash IS NOT NULL AS pin_configured,
      EXISTS(SELECT 1 FROM pin_reset_requests prr WHERE prr.passport_id = p.id AND prr.status = 'pending') AS pin_reset_requested,
      (SELECT COALESCE(SUM(amount), 0) FROM key_transactions kt WHERE kt.passport_id = p.id) AS key_balance
    FROM passports p JOIN cards c ON c.id = p.card_id
    WHERE p.status = 'claimed'
      AND (? = '' OR p.member_name LIKE ? ESCAPE '\\' OR c.card_number LIKE ? ESCAPE '\\')
    ORDER BY p.member_name COLLATE NOCASE LIMIT 25
  `).bind(query, likeQuery, likeQuery).all();
  return json({ passports: (result.results || []).map(toAdminPassportSummary) }, 200, cors);
}

async function getAdminPassport(rawPassportId, env, cors) {
  const passport = await getPassportById(rawPassportId, env);
  if (!passport) throw new HttpError(404, "Passport not found.");
  return json({ passport: await buildAdminPassport(passport, env) }, 200, cors);
}

async function completeMission(body, env, cors) {
  const passportId = normalizePositiveInteger(body.passportId, "Passport");
  const missionCode = String(body.missionCode || "").trim();
  const idempotencyKey = String(body.idempotencyKey || "").trim();
  const note = normalizeOptionalNote(body.note);
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) throw new HttpError(400, "Invalid completion request.");

  const passport = await getPassportById(passportId, env);
  if (!passport) throw new HttpError(404, "Passport not found.");
  const mission = await env.DB.prepare(`
    SELECT m.id, m.code, m.title, m.key_reward, m.repeatable, m.cooldown_hours, m.scope,
      (SELECT ma.id FROM mission_assignments ma WHERE ma.mission_id = m.id AND ma.passport_id = ? AND ma.status IN ('active', 'completed') ORDER BY ma.assigned_at DESC LIMIT 1) AS assignment_id
    FROM missions m WHERE m.code = ? AND m.active = 1 LIMIT 1
  `).bind(passportId, missionCode).first();
  if (!mission) throw new HttpError(404, "Mission not found.");
  if (mission.scope === "individual" && !mission.assignment_id) throw new HttpError(404, "Private assignment not found for this member.");

  const existingRequest = await env.DB.prepare(`
    SELECT mc.id, mc.passport_id, mc.mission_id, COALESCE(kt.amount, 0) AS amount
    FROM mission_completions mc LEFT JOIN key_transactions kt ON kt.reason_type = 'mission' AND kt.reason_id = mc.id
    WHERE mc.id = ? LIMIT 1
  `).bind(idempotencyKey).first();
  if (existingRequest) {
    if (Number(existingRequest.passport_id) !== passportId || Number(existingRequest.mission_id) !== Number(mission.id)) {
      throw new HttpError(409, "That completion request has already been used.");
    }
    return json({ status: "already_completed", keysAwarded: Number(existingRequest.amount), passport: await buildAdminPassport(passport, env) }, 200, cors);
  }

  const completion = await env.DB.prepare(`
    SELECT COUNT(*) AS completion_count, COALESCE(MAX(completion_number), 0) AS last_completion
    FROM mission_completions WHERE passport_id = ? AND mission_id = ?
  `).bind(passportId, mission.id).first();
  if (!mission.repeatable && Number(completion.completion_count) > 0) {
    throw new HttpError(409, "This mission has already been completed for this passport.");
  }
  await enforceMissionCooldown(passportId, mission, env);

  const completionNumber = mission.repeatable ? Number(completion.last_completion) + 1 : 1;
  const keysAwarded = Number(mission.key_reward);
  const statements = [env.DB.prepare(`
    INSERT INTO mission_completions (id, passport_id, mission_id, completion_number, verified_by, note)
    VALUES (?, ?, ?, ?, 'inner-circle-admin', ?)
  `).bind(idempotencyKey, passportId, mission.id, completionNumber, note)];
  if (keysAwarded > 0) {
    statements.push(env.DB.prepare(`
      INSERT INTO key_transactions
        (id, passport_id, amount, transaction_type, reason_type, reason_id, description, created_by)
      VALUES (?, ?, ?, 'earned', 'mission', ?, ?, 'inner-circle-admin')
    `).bind(`key_${idempotencyKey}`, passportId, keysAwarded, idempotencyKey, `Mission complete: ${mission.title}`));
  }
  if (mission.assignment_id) {
    statements.push(env.DB.prepare(`
      UPDATE mission_assignments SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'active'
    `).bind(mission.assignment_id));
  }

  try {
    await env.DB.batch(statements);
  } catch (error) {
    const completed = await env.DB.prepare(`SELECT id FROM mission_completions WHERE passport_id = ? AND mission_id = ? LIMIT 1`).bind(passportId, mission.id).first();
    if (!mission.repeatable && completed) throw new HttpError(409, "This mission has already been completed for this passport.");
    throw error;
  }

  return json({
    status: "completed",
    message: `MISSION COMPLETE // +${keysAwarded} ${keysAwarded === 1 ? "KEY" : "KEYS"}`,
    keysAwarded,
    passport: await buildAdminPassport(passport, env)
  }, 201, cors);
}

async function claimMission(body, env, cors) {
  const cardId = normalizeCardId(body.cardId);
  const missionCode = String(body.missionCode || "").trim();
  const idempotencyKey = String(body.idempotencyKey || "").trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) throw new HttpError(400, "Invalid completion request.");

  const passport = await getPassportByHash(await sha256(cardId), env);
  if (!passport || passport.disabled_at) throw new HttpError(404, "Card not recognized.");
  if (passport.status !== "claimed") throw new HttpError(403, "Enter the Underground before claiming missions.");

  const mission = await env.DB.prepare(`
    SELECT m.id, m.code, m.title, m.key_reward, m.repeatable, m.cooldown_hours, m.verification_required, m.verification_code_hash, m.scope, m.social_checkin_only,
      (SELECT ma.id FROM mission_assignments ma WHERE ma.mission_id = m.id AND ma.passport_id = ? AND ma.status IN ('active', 'completed') ORDER BY ma.assigned_at DESC LIMIT 1) AS assignment_id
    FROM missions m WHERE m.code = ? AND m.active = 1 LIMIT 1
  `).bind(passport.passport_id, missionCode).first();
  if (!mission) throw new HttpError(404, "Mission not found.");
  if (mission.scope === "individual" && !mission.assignment_id) throw new HttpError(404, "That private assignment is not available to this member.");
  if (mission.social_checkin_only) {
    const settings = await env.DB.prepare(`SELECT social_checkin_visible FROM invitation_settings WHERE id = 1`).first();
    if (!settings?.social_checkin_visible) throw new HttpError(403, "That mission is not currently active.");
  }

  if (mission.verification_required) {
    const verificationCode = normalizeVerificationCode(body.verificationCode);
    const suppliedHash = await sha256(verificationCode);
    if (!constantTimeEqual(suppliedHash, mission.verification_code_hash || "")) {
      throw new HttpError(403, "That mission code is not correct.");
    }
  }

  const completion = await env.DB.prepare(`
    SELECT COUNT(*) AS completion_count, COALESCE(MAX(completion_number), 0) AS last_completion
    FROM mission_completions WHERE passport_id = ? AND mission_id = ?
  `).bind(passport.passport_id, mission.id).first();
  if (!mission.repeatable && Number(completion.completion_count) > 0) {
    throw new HttpError(409, "You already completed this mission.");
  }
  await enforceMissionCooldown(passport.passport_id, mission, env);

  const completionNumber = mission.repeatable ? Number(completion.last_completion) + 1 : 1;
  const keysAwarded = Number(mission.key_reward);
  const statements = [env.DB.prepare(`
    INSERT INTO mission_completions (id, passport_id, mission_id, completion_number, verified_by)
    VALUES (?, ?, ?, ?, ?)
  `).bind(idempotencyKey, passport.passport_id, mission.id, completionNumber, mission.verification_required ? "member-code" : "member-honor")];
  if (keysAwarded > 0) {
    statements.push(env.DB.prepare(`
      INSERT INTO key_transactions
        (id, passport_id, amount, transaction_type, reason_type, reason_id, description, created_by)
      VALUES (?, ?, ?, 'earned', 'mission', ?, ?, ?)
    `).bind(`key_${idempotencyKey}`, passport.passport_id, keysAwarded, idempotencyKey, `Mission complete: ${mission.title}`, mission.verification_required ? "member-code" : "member-honor"));
  }
  if (mission.assignment_id) {
    statements.push(env.DB.prepare(`
      UPDATE mission_assignments SET status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'active'
    `).bind(mission.assignment_id));
  }

  try {
    await env.DB.batch(statements);
  } catch (error) {
    const existing = await env.DB.prepare(`SELECT id FROM mission_completions WHERE passport_id = ? AND mission_id = ? LIMIT 1`).bind(passport.passport_id, mission.id).first();
    if (!mission.repeatable && existing) throw new HttpError(409, "You already completed this mission.");
    throw error;
  }

  const refreshed = await getPassportByHash(await sha256(cardId), env);
  return json({
    status: "completed",
    message: `MISSION COMPLETE // +${keysAwarded} ${keysAwarded === 1 ? "KEY" : "KEYS"}`,
    passport: await buildPublicPassport(refreshed, env)
  }, 201, cors);
}

async function createMission(body, env, cors) {
  const title = normalizeMissionText(body.title, "Mission title", 3, 80);
  const description = normalizeMissionText(body.description, "Description", 10, 500);
  const keyReward = Number(body.keyReward);
  if (!Number.isInteger(keyReward) || keyReward < 0 || keyReward > 100) throw new HttpError(400, "Key reward must be between 0 and 100.");
  const repeatable = body.repeatable ? 1 : 0;
  const cooldownHours = repeatable ? normalizeCooldownHours(body.cooldownHours) : 0;
  const scope = normalizeMissionScope(body.scope);
  if (scope === "individual" && repeatable) throw new HttpError(400, "Individual assignments cannot be repeatable.");
  const assignedPassportId = scope === "individual" ? normalizePositiveInteger(body.passportId, "Assigned member") : null;
  if (assignedPassportId && !await getPassportById(assignedPassportId, env)) throw new HttpError(404, "Assigned member not found.");
  const verificationRequired = body.verificationRequired ? 1 : 0;
  const socialCheckinOnly = body.socialCheckinOnly ? 1 : 0;
  let verificationCodeHash = null;
  let verificationCodeDisplay = null;
  if (verificationRequired) {
    verificationCodeDisplay = normalizeVerificationCode(body.verificationCode);
    verificationCodeHash = await sha256(verificationCodeDisplay);
  }

  const slug = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "mission";
  const code = `${slug}-${crypto.randomUUID().slice(0, 6)}`;
  const sortResult = await env.DB.prepare(`SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order FROM missions`).first();
  const statements = [env.DB.prepare(`
    INSERT INTO missions
      (code, title, description, key_reward, repeatable, cooldown_hours, active, sort_order, verification_required, verification_code_hash, verification_code_display, counts_as_event, scope, social_checkin_only)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 0, ?, ?)
  `).bind(code, title, description, keyReward, repeatable, cooldownHours, Number(sortResult.next_order), verificationRequired, verificationCodeHash, verificationCodeDisplay, scope, socialCheckinOnly)];
  if (scope === "individual") {
    statements.push(env.DB.prepare(`
      INSERT INTO mission_assignments (id, mission_id, passport_id, assigned_by)
      SELECT ?, id, ?, 'inner-circle-admin' FROM missions WHERE code = ?
    `).bind(`assignment_${crypto.randomUUID()}`, assignedPassportId, code));
  }
  await env.DB.batch(statements);

  return json({ status: "created", mission: { code, title, description, keyReward, repeatable: Boolean(repeatable), cooldownHours, verificationRequired: Boolean(verificationRequired), socialCheckinOnly: Boolean(socialCheckinOnly), scope } }, 201, cors);
}

async function listAdminMissions(env, cors) {
  const result = await env.DB.prepare(`
    SELECT m.code, m.title, m.description, m.key_reward, m.repeatable, m.cooldown_hours, m.verification_required, m.scope, m.social_checkin_only,
      m.verification_code_display, m.verification_code_hash IS NOT NULL AS code_configured, m.active,
      COUNT(mc.id) AS completion_count,
      ma.id AS assignment_id, ma.passport_id AS assigned_passport_id, ma.status AS assignment_status,
      ma.assigned_at, ma.completed_at, ma.revoked_at, p.member_name AS assigned_member_name, c.card_number AS assigned_card_number
    FROM missions m
    LEFT JOIN mission_completions mc ON mc.mission_id = m.id
    LEFT JOIN mission_assignments ma ON ma.id = (
      SELECT latest.id FROM mission_assignments latest WHERE latest.mission_id = m.id
      ORDER BY CASE latest.status WHEN 'active' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END, latest.assigned_at DESC LIMIT 1
    )
    LEFT JOIN passports p ON p.id = ma.passport_id
    LEFT JOIN cards c ON c.id = p.card_id
    GROUP BY m.id, ma.id
    ORDER BY m.active DESC, m.sort_order, m.id
  `).all();
  return json({ missions: (result.results || []).map(toAdminMission) }, 200, cors);
}

async function updateMission(body, env, cors) {
  const code = String(body.code || "").trim();
  const existing = await env.DB.prepare(`
    SELECT m.id, m.verification_required, m.verification_code_hash, m.verification_code_display,
      (SELECT ma.passport_id FROM mission_assignments ma WHERE ma.mission_id = m.id ORDER BY ma.assigned_at DESC LIMIT 1) AS latest_assigned_passport_id,
      (SELECT ma.status FROM mission_assignments ma WHERE ma.mission_id = m.id ORDER BY ma.assigned_at DESC LIMIT 1) AS latest_assignment_status
    FROM missions m WHERE m.code = ?
  `).bind(code).first();
  if (!existing) throw new HttpError(404, "Mission not found.");
  const title = normalizeMissionText(body.title, "Mission title", 3, 80);
  const description = normalizeMissionText(body.description, "Description", 10, 500);
  const keyReward = Number(body.keyReward);
  if (!Number.isInteger(keyReward) || keyReward < 0 || keyReward > 100) throw new HttpError(400, "Key reward must be between 0 and 100.");
  const repeatable = body.repeatable ? 1 : 0;
  const cooldownHours = repeatable ? normalizeCooldownHours(body.cooldownHours) : 0;
  const scope = normalizeMissionScope(body.scope);
  if (scope === "individual" && repeatable) throw new HttpError(400, "Individual assignments cannot be repeatable.");
  const assignedPassportId = scope === "individual" ? normalizePositiveInteger(body.passportId, "Assigned member") : null;
  if (assignedPassportId && !await getPassportById(assignedPassportId, env)) throw new HttpError(404, "Assigned member not found.");
  const verificationRequired = body.verificationRequired ? 1 : 0;
  const socialCheckinOnly = body.socialCheckinOnly ? 1 : 0;
  let verificationCodeHash = existing.verification_code_hash;
  let verificationCodeDisplay = existing.verification_code_display;
  if (verificationRequired && String(body.verificationCode || "").trim()) {
    verificationCodeDisplay = normalizeVerificationCode(body.verificationCode);
    verificationCodeHash = await sha256(verificationCodeDisplay);
  }
  if (verificationRequired && !verificationCodeHash) throw new HttpError(400, "Enter a verification code for this mission.");
  if (!verificationRequired) { verificationCodeHash = null; verificationCodeDisplay = null; }

  const statements = [env.DB.prepare(`
    UPDATE missions SET title = ?, description = ?, key_reward = ?, repeatable = ?, cooldown_hours = ?,
      verification_required = ?, verification_code_hash = ?, verification_code_display = ?, scope = ?, social_checkin_only = ?, updated_at = CURRENT_TIMESTAMP
    WHERE code = ?
  `).bind(title, description, keyReward, repeatable, cooldownHours, verificationRequired, verificationCodeHash, verificationCodeDisplay, scope, socialCheckinOnly, code)];
  const activeAssignment = await env.DB.prepare(`
    SELECT ma.id, ma.passport_id FROM mission_assignments ma WHERE ma.mission_id = ? AND ma.status = 'active' LIMIT 1
  `).bind(existing.id).first();
  if (scope === "global" && activeAssignment) {
    statements.push(env.DB.prepare(`UPDATE mission_assignments SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active'`).bind(activeAssignment.id));
  }
  const completedForSelectedMember = existing.latest_assignment_status === "completed" && Number(existing.latest_assigned_passport_id) === assignedPassportId;
  if (scope === "individual" && !completedForSelectedMember && (!activeAssignment || Number(activeAssignment.passport_id) !== assignedPassportId)) {
    if (activeAssignment) statements.push(env.DB.prepare(`UPDATE mission_assignments SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'active'`).bind(activeAssignment.id));
    statements.push(env.DB.prepare(`INSERT INTO mission_assignments (id, mission_id, passport_id, assigned_by) VALUES (?, ?, ?, 'inner-circle-admin')`).bind(`assignment_${crypto.randomUUID()}`, existing.id, assignedPassportId));
  }
  await env.DB.batch(statements);
  return json({ status: "updated" }, 200, cors);
}

async function revokeMissionAssignment(body, env, cors) {
  const assignmentId = String(body.assignmentId || "").trim();
  const result = await env.DB.prepare(`
    UPDATE mission_assignments SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'active' RETURNING id
  `).bind(assignmentId).first();
  if (!result) throw new HttpError(404, "Active assignment not found.");
  return json({ status: "revoked" }, 200, cors);
}

async function setMissionActive(body, env, cors) {
  const code = String(body.code || "").trim();
  const active = body.active ? 1 : 0;
  const result = await env.DB.prepare(`
    UPDATE missions SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ? RETURNING id
  `).bind(active, code).first();
  if (!result) throw new HttpError(404, "Mission not found.");
  return json({ status: active ? "restored" : "archived" }, 200, cors);
}

async function setMissionCode(body, env, cors) {
  const missionCode = String(body.missionCode || "").trim();
  const verificationCode = normalizeVerificationCode(body.verificationCode);
  const result = await env.DB.prepare(`
    UPDATE missions SET verification_code_hash = ?, verification_code_display = ?, updated_at = CURRENT_TIMESTAMP
    WHERE code = ? AND verification_required = 1 RETURNING id
  `).bind(await sha256(verificationCode), verificationCode, missionCode).first();
  if (!result) throw new HttpError(404, "Code-required mission not found.");
  return json({ status: "updated", verificationCode }, 200, cors);
}

async function createEvent(body, env, cors) {
  const title = normalizeMissionText(body.title, "Event title", 3, 100);
  const startsAt = normalizeEventDate(body.startsAt);
  const location = normalizeOptionalText(body.location, "Location", 160);
  const checkInCode = normalizeVerificationCode(body.checkInCode);
  const checkInCodeHash = await sha256(checkInCode);
  try {
    await env.DB.prepare(`
      INSERT INTO events (title, starts_at, location, check_in_code_hash, check_in_code_display, active, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `).bind(title, startsAt, location, checkInCodeHash, checkInCode).run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) throw new HttpError(409, "That event code is already in use.");
    throw error;
  }
  return json({ status: "created" }, 201, cors);
}

async function listAdminEvents(env, cors) {
  const result = await env.DB.prepare(`
    SELECT e.id, e.title, e.starts_at, e.location, e.check_in_code_display, e.active, COUNT(ea.id) AS check_in_count
    FROM events e LEFT JOIN event_attendance ea ON ea.event_id = e.id
    GROUP BY e.id ORDER BY e.starts_at DESC, e.id DESC LIMIT 50
  `).all();
  return json({ events: (result.results || []).map((event) => ({
    eventId: Number(event.id), title: event.title, startsAt: event.starts_at,
    location: event.location, checkInCode: event.check_in_code_display || "",
    active: Boolean(event.active), checkInCount: Number(event.check_in_count)
  })) }, 200, cors);
}

async function setEventCode(body, env, cors) {
  const eventId = normalizePositiveInteger(body.eventId, "Event");
  const checkInCode = normalizeVerificationCode(body.checkInCode);
  const checkInCodeHash = await sha256(checkInCode);
  try {
    const result = await env.DB.prepare(`
      UPDATE events
      SET check_in_code_hash = ?, check_in_code_display = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? RETURNING id
    `).bind(checkInCodeHash, checkInCode, eventId).first();
    if (!result) throw new HttpError(404, "Event not found.");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (String(error).includes("UNIQUE")) throw new HttpError(409, "That event code is already in use.");
    throw error;
  }
  return json({ status: "updated", checkInCode }, 200, cors);
}

async function checkInEvent(body, env, cors) {
  const setting = await env.DB.prepare(`
    SELECT social_checkin_visible FROM invitation_settings WHERE id = 1
  `).first();
  if (!setting || !setting.social_checkin_visible) throw new HttpError(403, "Social check-in is not open right now.");
  const cardId = normalizeCardId(body.cardId);
  const passport = await getPassportByHash(await sha256(cardId), env);
  if (!passport || passport.disabled_at) throw new HttpError(404, "Card not recognized.");
  if (passport.status !== "claimed") throw new HttpError(403, "Enter the Underground before checking in.");
  const codeHash = await sha256(normalizeVerificationCode(body.checkInCode));
  const event = await env.DB.prepare(`
    SELECT id, title FROM events WHERE check_in_code_hash = ? AND active = 1 LIMIT 1
  `).bind(codeHash).first();
  if (!event) throw new HttpError(404, "Event code not recognized.");

  const result = await env.DB.prepare(`
    INSERT INTO event_attendance (passport_id, event_id) VALUES (?, ?)
    ON CONFLICT(passport_id, event_id) DO NOTHING RETURNING id
  `).bind(passport.passport_id, event.id).first();
  if (!result) throw new HttpError(409, "You already checked in to this event.");
  const refreshed = await getPassportByHash(await sha256(cardId), env);
  return json({ status: "checked_in", eventTitle: event.title, passport: await buildPublicPassport(refreshed, env) }, 201, cors);
}

async function getAdminSocialCheckin(env, cors) {
  const setting = await env.DB.prepare(`
    SELECT social_checkin_visible FROM invitation_settings WHERE id = 1
  `).first();
  if (!setting) throw new HttpError(404, "Social check-in settings were not found.");
  return json({ visible: Boolean(setting.social_checkin_visible) }, 200, cors);
}

async function updateSocialCheckin(body, env, cors) {
  const visible = normalizeBoolean(body.visible);
  await env.DB.prepare(`
    UPDATE invitation_settings
    SET social_checkin_visible = ?, updated_at = CURRENT_TIMESTAMP, updated_by = 'inner-circle-admin'
    WHERE id = 1
  `).bind(visible).run();
  return json({ visible: Boolean(visible) }, 200, cors);
}

async function getAdminSignalsVisibility(env, cors) {
  const setting = await env.DB.prepare(`SELECT signals_visible FROM invitation_settings WHERE id = 1`).first();
  if (!setting) throw new HttpError(404, "Signal settings were not found.");
  return json({ visible: Boolean(setting.signals_visible) }, 200, cors);
}

async function updateSignalsVisibility(body, env, cors) {
  const visible = normalizeBoolean(body.visible);
  await env.DB.prepare(`
    UPDATE invitation_settings SET signals_visible = ?, updated_at = CURRENT_TIMESTAMP, updated_by = 'inner-circle-admin'
    WHERE id = 1
  `).bind(visible).run();
  return json({ visible: Boolean(visible) }, 200, cors);
}

async function claimMilestone(body, env, cors) {
  const cardId = normalizeCardId(body.cardId);
  const passport = await getPassportByHash(await sha256(cardId), env);
  if (!passport || passport.disabled_at) throw new HttpError(404, "Card not recognized.");
  if (passport.status !== "claimed") throw new HttpError(403, "Enter the Underground before claiming milestones.");
  let milestone;
  if (body.milestoneCode) {
    const milestoneCode = String(body.milestoneCode).trim();
    milestone = await env.DB.prepare(`
      SELECT id, title FROM milestones
      WHERE code = ? AND member_claimable = 1 AND claimable_by_code = 0 AND active = 1 LIMIT 1
    `).bind(milestoneCode).first();
    if (!milestone) throw new HttpError(404, "Milestone is not available for direct claiming.");
  } else {
    const codeHash = await sha256(normalizeVerificationCode(body.claimCode));
    milestone = await env.DB.prepare(`
      SELECT id, title FROM milestones
      WHERE claim_code_hash = ? AND member_claimable = 1 AND claimable_by_code = 1 AND active = 1 LIMIT 1
    `).bind(codeHash).first();
    if (!milestone) throw new HttpError(404, "Milestone code not recognized.");
  }

  const result = await env.DB.prepare(`
    INSERT INTO passport_milestones (passport_id, milestone_id) VALUES (?, ?)
    ON CONFLICT(passport_id, milestone_id) DO NOTHING RETURNING id
  `).bind(passport.passport_id, milestone.id).first();
  if (!result) throw new HttpError(409, "You already claimed this milestone.");
  const refreshed = await getPassportByHash(await sha256(cardId), env);
  return json({ status: "claimed", milestoneTitle: milestone.title, passport: await buildPublicPassport(refreshed, env) }, 201, cors);
}

async function listAdminMilestones(env, cors) {
  const result = await env.DB.prepare(`
    SELECT m.code, m.title, m.description, m.reveal_text, m.criteria_type, m.threshold, m.member_claimable, m.hidden_until_achieved,
      m.claimable_by_code, m.claim_code_display, m.claim_code_hash IS NOT NULL AS code_configured,
      m.active, COUNT(pm.id) AS achievement_count
    FROM milestones m
    LEFT JOIN passport_milestones pm ON pm.milestone_id = m.id
    GROUP BY m.id ORDER BY m.active DESC, m.sort_order, m.id
  `).all();
  return json({ milestones: (result.results || []).map(toAdminMilestone) }, 200, cors);
}

async function createMilestone(body, env, cors) {
  const title = normalizeMissionText(body.title, "Milestone title", 3, 100);
  const description = normalizeMissionText(body.description, "Description", 3, 500);
  const revealText = normalizeMissionText(body.revealText, "Reveal text", 3, 500);
  const requiresCode = Boolean(normalizeBoolean(body.requiresCode));
  const hiddenUntilAchieved = Boolean(normalizeBoolean(body.hiddenUntilAchieved));
  if (hiddenUntilAchieved && !requiresCode) throw new HttpError(400, "Secret member-claimable milestones must require a code.");
  const claimCode = requiresCode ? normalizeVerificationCode(body.claimCode) : null;
  const claimCodeHash = claimCode ? await sha256(claimCode) : null;
  const slug = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "milestone";
  const code = `${slug}-${crypto.randomUUID().slice(0, 6)}`;
  const sortResult = await env.DB.prepare(`SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order FROM milestones`).first();
  try {
    await env.DB.prepare(`
      INSERT INTO milestones
        (code, title, description, reveal_text, criteria_type, threshold, sort_order, active, claimable_by_code,
         claim_code_hash, claim_code_display, member_claimable, hidden_until_achieved)
      VALUES (?, ?, ?, ?, NULL, NULL, ?, 1, ?, ?, ?, 1, ?)
    `).bind(code, title, description, revealText, Number(sortResult.next_order), requiresCode ? 1 : 0, claimCodeHash, claimCode, hiddenUntilAchieved ? 1 : 0).run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) throw new HttpError(409, "That milestone code is already in use.");
    throw error;
  }
  return json({ status: "created", code }, 201, cors);
}

async function updateMilestone(body, env, cors) {
  const code = String(body.code || "").trim();
  const title = normalizeMissionText(body.title, "Milestone title", 3, 100);
  const description = normalizeMissionText(body.description, "Description", 3, 500);
  const revealText = normalizeMissionText(body.revealText, "Reveal text", 3, 500);
  const existing = await env.DB.prepare(`SELECT member_claimable FROM milestones WHERE code = ? LIMIT 1`).bind(code).first();
  if (!existing) throw new HttpError(404, "Milestone not found.");
  if (existing.member_claimable) {
    const requiresCode = normalizeBoolean(body.requiresCode);
    const hiddenUntilAchieved = normalizeBoolean(body.hiddenUntilAchieved);
    if (hiddenUntilAchieved && !requiresCode) throw new HttpError(400, "Secret member-claimable milestones must require a code.");
    await env.DB.prepare(`
      UPDATE milestones
      SET title = ?, description = ?, reveal_text = ?, claimable_by_code = ?, hidden_until_achieved = ?,
        claim_code_hash = CASE WHEN ? = 0 THEN NULL ELSE claim_code_hash END,
        claim_code_display = CASE WHEN ? = 0 THEN NULL ELSE claim_code_display END
      WHERE code = ?
    `).bind(title, description, revealText, requiresCode, hiddenUntilAchieved, requiresCode, requiresCode, code).run();
  } else {
    const hiddenUntilAchieved = normalizeBoolean(body.hiddenUntilAchieved);
    await env.DB.prepare(`UPDATE milestones SET title = ?, description = ?, reveal_text = ?, hidden_until_achieved = ? WHERE code = ?`).bind(title, description, revealText, hiddenUntilAchieved, code).run();
  }
  return json({ status: "updated" }, 200, cors);
}

async function setMilestoneActive(body, env, cors) {
  const code = String(body.code || "").trim();
  const active = normalizeBoolean(body.active);
  const result = await env.DB.prepare(`UPDATE milestones SET active = ? WHERE code = ? RETURNING id`).bind(active, code).first();
  if (!result) throw new HttpError(404, "Milestone not found.");
  return json({ status: active ? "restored" : "archived" }, 200, cors);
}

function toAdminMilestone(milestone) {
  return {
    code: milestone.code, title: milestone.title, description: milestone.description, revealText: milestone.reveal_text || "",
    criteriaType: milestone.criteria_type, threshold: Number(milestone.threshold || 0),
    memberClaimable: Boolean(milestone.member_claimable), requiresCode: Boolean(milestone.claimable_by_code),
    hiddenUntilAchieved: Boolean(milestone.hidden_until_achieved),
    claimCode: milestone.claim_code_display || "", codeConfigured: Boolean(milestone.code_configured),
    active: Boolean(milestone.active), achievementCount: Number(milestone.achievement_count)
  };
}

async function listMilestoneCodes(env, cors) {
  const result = await env.DB.prepare(`
    SELECT code, title, description, claim_code_display, claim_code_hash IS NOT NULL AS code_configured
    FROM milestones WHERE member_claimable = 1 AND claimable_by_code = 1 AND active = 1 ORDER BY sort_order, id
  `).all();
  return json({ milestones: (result.results || []).map((milestone) => ({
    code: milestone.code, title: milestone.title, description: milestone.description,
    claimCode: milestone.claim_code_display || "", codeConfigured: Boolean(milestone.code_configured)
  })) }, 200, cors);
}

async function setMilestoneCode(body, env, cors) {
  const milestoneCode = String(body.milestoneCode || "").trim();
  const claimCode = normalizeVerificationCode(body.claimCode);
  const claimCodeHash = await sha256(claimCode);
  try {
    const result = await env.DB.prepare(`
      UPDATE milestones SET claim_code_hash = ?, claim_code_display = ?
      WHERE code = ? AND member_claimable = 1 AND claimable_by_code = 1 AND active = 1 RETURNING id
    `).bind(claimCodeHash, claimCode, milestoneCode).first();
    if (!result) throw new HttpError(404, "Milestone not found.");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (String(error).includes("UNIQUE")) throw new HttpError(409, "That code is already assigned to another milestone.");
    throw error;
  }
  return json({ status: "updated", claimCode }, 200, cors);
}

function toAdminMission(mission) {
  return {
    code: mission.code, title: mission.title, description: mission.description,
    keyReward: Number(mission.key_reward), repeatable: Boolean(mission.repeatable),
    cooldownHours: Number(mission.cooldown_hours || 0),
    verificationRequired: Boolean(mission.verification_required), verificationCode: mission.verification_code_display || "",
    socialCheckinOnly: Boolean(mission.social_checkin_only),
    codeConfigured: Boolean(mission.code_configured), active: Boolean(mission.active),
    completionCount: Number(mission.completion_count), scope: mission.scope || "global",
    assignmentId: mission.assignment_id || null,
    assignedPassportId: mission.assigned_passport_id ? Number(mission.assigned_passport_id) : null,
    assignedMemberName: mission.assigned_member_name || null,
    assignedCardNumber: mission.assigned_card_number || null,
    assignmentStatus: mission.assignment_status || null,
    assignedAt: mission.assigned_at || null,
    assignmentCompletedAt: mission.completed_at || null,
    assignmentRevokedAt: mission.revoked_at || null
  };
}

async function getPublicSchedule(env, cors) {
  const result = await env.DB.prepare(`
    SELECT id, day_key, class_name_en, class_name_es, time_text, level_en, level_es,
      location_en, location_es, link_url, link_label_en, link_label_es, sort_order
    FROM schedule_entries WHERE active = 1 ORDER BY sort_order, id
  `).all();
  return json({ entries: (result.results || []).map(toScheduleEntry) }, 200, cors);
}

async function listAdminSchedule(env, cors) {
  const result = await env.DB.prepare(`
    SELECT id, day_key, class_name_en, class_name_es, time_text, level_en, level_es,
      location_en, location_es, link_url, link_label_en, link_label_es, sort_order, active
    FROM schedule_entries ORDER BY active DESC, sort_order, id
  `).all();
  return json({ entries: (result.results || []).map(toScheduleEntry) }, 200, cors);
}

async function createScheduleEntry(body, env, cors) {
  const entry = normalizeScheduleEntry(body);
  const id = `class_${crypto.randomUUID()}`;
  const orderResult = await env.DB.prepare(`SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order FROM schedule_entries`).first();
  await env.DB.prepare(`
    INSERT INTO schedule_entries
      (id, day_key, class_name_en, class_name_es, time_text, level_en, level_es, location_en, location_es,
       link_url, link_label_en, link_label_es, sort_order, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).bind(id, entry.dayKey, entry.classNameEn, entry.classNameEs, entry.timeText, entry.levelEn, entry.levelEs,
    entry.locationEn, entry.locationEs, entry.linkUrl, entry.linkLabelEn, entry.linkLabelEs, Number(orderResult.next_order)).run();
  return json({ status: "created", id }, 201, cors);
}

async function updateScheduleEntry(body, env, cors) {
  const id = String(body.id || "").trim();
  const entry = normalizeScheduleEntry(body);
  const result = await env.DB.prepare(`
    UPDATE schedule_entries SET day_key = ?, class_name_en = ?, class_name_es = ?, time_text = ?,
      level_en = ?, level_es = ?, location_en = ?, location_es = ?, link_url = ?, link_label_en = ?,
      link_label_es = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? RETURNING id
  `).bind(entry.dayKey, entry.classNameEn, entry.classNameEs, entry.timeText, entry.levelEn, entry.levelEs,
    entry.locationEn, entry.locationEs, entry.linkUrl, entry.linkLabelEn, entry.linkLabelEs, id).first();
  if (!result) throw new HttpError(404, "Schedule entry not found.");
  return json({ status: "updated" }, 200, cors);
}

async function setScheduleEntryActive(body, env, cors) {
  const id = String(body.id || "").trim();
  const active = body.active ? 1 : 0;
  const result = await env.DB.prepare(`
    UPDATE schedule_entries SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING id
  `).bind(active, id).first();
  if (!result) throw new HttpError(404, "Schedule entry not found.");
  return json({ status: active ? "restored" : "archived" }, 200, cors);
}

function normalizeScheduleEntry(body) {
  const allowedDays = new Set(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
  const dayKey = String(body.dayKey || "").trim().toLowerCase();
  if (!allowedDays.has(dayKey)) throw new HttpError(400, "Choose a valid day.");
  const linkUrl = normalizeOptionalUrl(body.linkUrl);
  const linkLabelEn = normalizeOptionalText(body.linkLabelEn, "English link label", 60);
  const linkLabelEs = normalizeOptionalText(body.linkLabelEs, "Spanish link label", 60);
  if (linkUrl && (!linkLabelEn || !linkLabelEs)) throw new HttpError(400, "Add both English and Spanish link labels.");
  return {
    dayKey,
    classNameEn: normalizeMissionText(body.classNameEn, "English class name", 2, 100),
    classNameEs: normalizeMissionText(body.classNameEs, "Spanish class name", 2, 100),
    timeText: normalizeMissionText(body.timeText, "Class time", 2, 80),
    levelEn: normalizeMissionText(body.levelEn, "English level", 2, 100),
    levelEs: normalizeMissionText(body.levelEs, "Spanish level", 2, 100),
    locationEn: normalizeMissionText(body.locationEn, "English location", 2, 180),
    locationEs: normalizeMissionText(body.locationEs, "Spanish location", 2, 180),
    linkUrl,
    linkLabelEn: linkUrl ? linkLabelEn : null,
    linkLabelEs: linkUrl ? linkLabelEs : null
  };
}

function toScheduleEntry(entry) {
  return {
    id: entry.id, dayKey: entry.day_key, classNameEn: entry.class_name_en,
    classNameEs: entry.class_name_es, timeText: entry.time_text, levelEn: entry.level_en,
    levelEs: entry.level_es, locationEn: entry.location_en, locationEs: entry.location_es,
    linkUrl: entry.link_url || "", linkLabelEn: entry.link_label_en || "",
    linkLabelEs: entry.link_label_es || "", sortOrder: Number(entry.sort_order),
    active: entry.active === undefined ? true : Boolean(entry.active)
  };
}

async function getAdminInvitation(env, cors) {
  const invitation = await env.DB.prepare(`
    SELECT kicker, title, description, button_label, button_url, updated_at
    FROM invitation_settings WHERE id = 1
  `).first();
  if (!invitation) throw new HttpError(404, "Invitation settings were not found.");
  return json({ invitation: {
    kicker: invitation.kicker,
    title: invitation.title,
    description: invitation.description,
    buttonLabel: invitation.button_label || "",
    buttonUrl: invitation.button_url || "",
    updatedAt: invitation.updated_at
  } }, 200, cors);
}

async function updateInvitation(body, env, cors) {
  const kicker = normalizeMissionText(body.kicker, "Invitation label", 2, 60);
  const title = normalizeMissionText(body.title, "Invitation title", 3, 120);
  const description = normalizeMissionText(body.description, "Invitation description", 3, 800);
  const buttonLabel = normalizeOptionalText(body.buttonLabel, "Button label", 60);
  const buttonUrl = normalizeOptionalUrl(body.buttonUrl);
  if ((buttonLabel && !buttonUrl) || (!buttonLabel && buttonUrl)) {
    throw new HttpError(400, "Provide both a button label and URL, or leave both blank.");
  }

  await env.DB.prepare(`
    UPDATE invitation_settings
    SET kicker = ?, title = ?, description = ?, button_label = ?, button_url = ?,
      updated_at = CURRENT_TIMESTAMP, updated_by = 'inner-circle-admin'
    WHERE id = 1
  `).bind(kicker, title, description, buttonLabel, buttonUrl).run();
  return await getAdminInvitation(env, cors);
}

async function buildTechniqueLab(passportId, env, includeInstructorGuidance) {
  const [settings, result] = await Promise.all([
    env.DB.prepare(`SELECT checks_available, availability_window FROM technique_settings WHERE id = 1`).first(),
    env.DB.prepare(`
      SELECT tc.code, tc.name, tc.member_description, tc.instructor_criteria, tc.feedback_options,
        tr.status AS request_status, tr.requested_at,
        latest.result AS latest_result, latest.feedback_tags, latest.instructor_note,
        latest.instructor_name, latest.checked_at,
        (SELECT COUNT(*) FROM technique_checks history WHERE history.passport_id = ? AND history.competency_id = tc.id) AS check_count
      FROM technique_competencies tc
      LEFT JOIN technique_requests tr ON tr.passport_id = ? AND tr.competency_id = tc.id
      LEFT JOIN technique_checks latest ON latest.id = (
        SELECT recent.id FROM technique_checks recent
        WHERE recent.passport_id = ? AND recent.competency_id = tc.id
        ORDER BY recent.checked_at DESC, recent.id DESC LIMIT 1
      )
      WHERE tc.active = 1 ORDER BY tc.sort_order, tc.id
    `).bind(passportId, passportId, passportId).all()
  ]);

  return {
    checksAvailable: Boolean(settings?.checks_available),
    availabilityWindow: settings?.availability_window || null,
    competencies: (result.results || []).map((competency) => {
      const latestResult = competency.latest_result || null;
      const state = latestResult === "verified"
        ? "verified"
        : ((competency.request_status === "active" || latestResult === "keep_working") ? "working" : "not_checked");
      const item = {
        code: competency.code,
        name: competency.name,
        description: competency.member_description,
        state,
        requestActive: competency.request_status === "active",
        requestedAt: competency.requested_at || null,
        latestResult,
        feedbackTags: parseJsonArray(competency.feedback_tags),
        instructorNote: competency.instructor_note || null,
        checkedAt: competency.checked_at || null,
        checkCount: Number(competency.check_count || 0)
      };
      if (includeInstructorGuidance) {
        item.instructorCriteria = competency.instructor_criteria;
        item.feedbackOptions = parseJsonArray(competency.feedback_options);
        item.instructorName = competency.instructor_name || null;
      }
      return item;
    })
  };
}

async function requestTechniqueCheck(body, env, cors) {
  const cardId = normalizeCardId(body.cardId);
  const passport = await getPassportByHash(await sha256(cardId), env);
  if (!passport || passport.disabled_at) throw new HttpError(404, "Card not recognized.");
  if (passport.status !== "claimed") throw new HttpError(403, "Enter the Underground before using Technique Lab.");
  const competencyCode = String(body.competencyCode || "").trim().toLowerCase();
  const competency = await env.DB.prepare(`SELECT id FROM technique_competencies WHERE code = ? AND active = 1`).bind(competencyCode).first();
  if (!competency) throw new HttpError(404, "Technique competency not found.");
  await env.DB.prepare(`
    INSERT INTO technique_requests (passport_id, competency_id, status, requested_at, resolved_at)
    VALUES (?, ?, 'active', CURRENT_TIMESTAMP, NULL)
    ON CONFLICT(passport_id, competency_id) DO UPDATE SET status = 'active', requested_at = CURRENT_TIMESTAMP, resolved_at = NULL
  `).bind(passport.passport_id, competency.id).run();
  return json({ status: "requested", techniqueLab: await buildTechniqueLab(passport.passport_id, env, false) }, 200, cors);
}

async function getAdminTechniqueMember(body, env, cors) {
  const passport = await getPassportById(body.passportId, env);
  if (!passport) throw new HttpError(404, "Member not found.");
  return json({
    member: toAdminPassportSummary(passport),
    techniqueLab: await buildTechniqueLab(passport.passport_id, env, true)
  }, 200, cors);
}

async function listTechniqueRequests(env, cors) {
  const result = await env.DB.prepare(`
    SELECT tr.passport_id, tr.requested_at, p.member_name, c.card_number,
      tc.code AS competency_code, tc.name AS competency_name
    FROM technique_requests tr
    JOIN passports p ON p.id = tr.passport_id
    JOIN cards c ON c.id = p.card_id
    JOIN technique_competencies tc ON tc.id = tr.competency_id
    WHERE tr.status = 'active' AND p.status = 'claimed' AND c.disabled_at IS NULL AND tc.active = 1
    ORDER BY tr.requested_at, p.member_name COLLATE NOCASE, tc.sort_order
  `).all();
  return json({ requests: (result.results || []).map((request) => ({
    passportId: Number(request.passport_id),
    memberName: request.member_name,
    cardNumber: request.card_number,
    competencyCode: request.competency_code,
    competencyName: request.competency_name,
    requestedAt: request.requested_at
  })) }, 200, cors);
}

async function recordTechniqueCheck(body, env, cors, authorizedInstructor = null) {
  const passport = await getPassportById(body.passportId, env);
  if (!passport) throw new HttpError(404, "Member not found.");
  const competencyCode = String(body.competencyCode || "").trim().toLowerCase();
  const competency = await env.DB.prepare(`
    SELECT id, name, feedback_options FROM technique_competencies WHERE code = ? AND active = 1
  `).bind(competencyCode).first();
  if (!competency) throw new HttpError(404, "Technique competency not found.");
  const result = String(body.result || "").trim().toLowerCase();
  if (result !== "verified" && result !== "keep_working") throw new HttpError(400, "Choose Verified or Keep Working.");
  const instructorName = authorizedInstructor
    ? authorizedInstructor.member_name
    : normalizeMissionText(body.instructorName, "Instructor name", 2, 80);
  const createdBy = authorizedInstructor ? `instructor-card:${authorizedInstructor.passport_id}` : "mission-desk-admin";
  const instructorNote = normalizeOptionalNote(body.instructorNote);
  const allowedFeedback = new Set(parseJsonArray(competency.feedback_options));
  const feedbackTags = Array.isArray(body.feedbackTags) ? [...new Set(body.feedbackTags.map((tag) => String(tag).trim()).filter(Boolean))] : [];
  if (feedbackTags.some((tag) => !allowedFeedback.has(tag))) throw new HttpError(400, "Choose valid feedback guidance.");
  if (result === "verified" && feedbackTags.length) throw new HttpError(400, "Feedback tags are only used with Keep Working.");
  const previousKeepWorking = result === "verified" ? await env.DB.prepare(`
    SELECT id FROM technique_checks WHERE passport_id = ? AND competency_id = ? AND result = 'keep_working' LIMIT 1
  `).bind(passport.passport_id, competency.id).first() : null;
  const checkId = `technique_${crypto.randomUUID()}`;
  const statements = [
    env.DB.prepare(`
      INSERT INTO technique_checks
        (id, passport_id, competency_id, instructor_name, result, feedback_tags, instructor_note, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(checkId, passport.passport_id, competency.id, instructorName, result, JSON.stringify(feedbackTags), instructorNote, createdBy),
    env.DB.prepare(`
      INSERT INTO technique_requests (passport_id, competency_id, status, requested_at, resolved_at)
      VALUES (?, ?, 'resolved', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(passport_id, competency_id) DO UPDATE SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
    `).bind(passport.passport_id, competency.id)
  ];
  if (previousKeepWorking) {
    statements.push(env.DB.prepare(`
      INSERT OR IGNORE INTO passport_milestones (passport_id, milestone_id)
      SELECT ?, id FROM milestones WHERE code = 'technique-second-pass' AND active = 1
    `).bind(passport.passport_id));
  }
  await env.DB.batch(statements);
  return json({
    status: "recorded",
    checkId,
    milestoneAwarded: Boolean(previousKeepWorking),
    techniqueLab: await buildTechniqueLab(passport.passport_id, env, true)
  }, 201, cors);
}

async function getAdminTechniqueSettings(env, cors) {
  const settings = await env.DB.prepare(`SELECT checks_available, availability_window, updated_at FROM technique_settings WHERE id = 1`).first();
  return json({
    checksAvailable: Boolean(settings?.checks_available),
    availabilityWindow: settings?.availability_window || "",
    updatedAt: settings?.updated_at || null
  }, 200, cors);
}

async function updateTechniqueSettings(body, env, cors) {
  const checksAvailable = normalizeBoolean(body.checksAvailable);
  const availabilityWindow = normalizeOptionalText(body.availabilityWindow, "Availability window", 120);
  await env.DB.prepare(`
    UPDATE technique_settings SET checks_available = ?, availability_window = ?, updated_at = CURRENT_TIMESTAMP, updated_by = 'inner-circle-admin' WHERE id = 1
  `).bind(checksAvailable, availabilityWindow).run();
  return await getAdminTechniqueSettings(env, cors);
}

async function getPassportById(rawPassportId, env) {
  const passportId = normalizePositiveInteger(rawPassportId, "Passport");
  return env.DB.prepare(`
    SELECT p.id AS passport_id, p.member_name, p.activation_date, p.status, c.card_number, p.pin_hash IS NOT NULL AS pin_configured,
      EXISTS(SELECT 1 FROM pin_reset_requests prr WHERE prr.passport_id = p.id AND prr.status = 'pending') AS pin_reset_requested,
      EXISTS (SELECT 1 FROM passport_roles pr WHERE pr.passport_id = p.id AND pr.role = 'instructor') AS is_instructor,
      (SELECT COUNT(*) FROM event_attendance ea WHERE ea.passport_id = p.id) AS attendance_count,
      (SELECT COUNT(*) FROM stamps s WHERE s.passport_id = p.id) AS stamp_count,
      (SELECT COUNT(DISTINCT mc.mission_id) FROM mission_completions mc WHERE mc.passport_id = p.id) AS mission_count,
      (SELECT COALESCE(SUM(kt.amount), 0) FROM key_transactions kt WHERE kt.passport_id = p.id) AS key_balance
    FROM passports p JOIN cards c ON c.id = p.card_id
    WHERE p.id = ? AND p.status = 'claimed' AND c.disabled_at IS NULL LIMIT 1
  `).bind(passportId).first();
}

async function buildAdminPassport(passport, env) {
  return { passportId: Number(passport.passport_id), pinConfigured: Boolean(passport.pin_configured), pinResetRequested: Boolean(passport.pin_reset_requested), ...await buildPublicPassport(passport, env) };
}

function toAdminPassportSummary(passport) {
  return {
    passportId: Number(passport.passport_id), memberName: passport.member_name,
    cardNumber: passport.card_number, activationDate: passport.activation_date,
    keyBalance: Number(passport.key_balance || 0), pinConfigured: Boolean(passport.pin_configured), pinResetRequested: Boolean(passport.pin_reset_requested)
  };
}

async function requireInstructorCard(rawCardId, env) {
  const cardId = normalizeCardId(rawCardId);
  const instructor = await env.DB.prepare(`
    SELECT p.id AS passport_id, p.member_name, c.card_number
    FROM cards c
    JOIN passports p ON p.card_id = c.id
    JOIN passport_roles pr ON pr.passport_id = p.id AND pr.role = 'instructor'
    WHERE c.card_hash = ? AND c.disabled_at IS NULL AND p.status = 'claimed'
    LIMIT 1
  `).bind(await sha256(cardId)).first();
  if (!instructor) throw new HttpError(403, "Instructor access required.");
  return instructor;
}

async function listInstructorMembers(env, cors) {
  const result = await env.DB.prepare(`
    SELECT p.id AS passport_id, p.member_name, c.card_number
    FROM passports p JOIN cards c ON c.id = p.card_id
    WHERE p.status = 'claimed' AND c.disabled_at IS NULL
    ORDER BY p.member_name COLLATE NOCASE
  `).all();
  return json({ members: (result.results || []).map((member) => ({
    passportId: Number(member.passport_id), memberName: member.member_name, cardNumber: member.card_number
  })) }, 200, cors);
}

async function listInstructors(env, cors) {
  const result = await env.DB.prepare(`
    SELECT p.id AS passport_id, p.member_name, c.card_number, pr.granted_at
    FROM passport_roles pr
    JOIN passports p ON p.id = pr.passport_id
    JOIN cards c ON c.id = p.card_id
    WHERE pr.role = 'instructor'
    ORDER BY c.card_number
  `).all();
  return json({ instructors: (result.results || []).map((instructor) => ({
    passportId: Number(instructor.passport_id), memberName: instructor.member_name,
    cardNumber: instructor.card_number, grantedAt: instructor.granted_at
  })) }, 200, cors);
}

async function setInstructorRole(body, env, cors) {
  const passport = await getPassportById(body.passportId, env);
  if (!passport) throw new HttpError(404, "Member not found.");
  const enabled = normalizeBoolean(body.enabled);
  if (enabled) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO passport_roles (passport_id, role, granted_by) VALUES (?, 'instructor', 'inner-circle-admin')
    `).bind(passport.passport_id).run();
  } else {
    await env.DB.prepare(`DELETE FROM passport_roles WHERE passport_id = ? AND role = 'instructor'`).bind(passport.passport_id).run();
  }
  return await listInstructors(env, cors);
}

async function listMembershipRequests(env, cors) {
  const [nominations, invitations] = await Promise.all([
    env.DB.prepare(`
      SELECT n.id, n.nominee_description, n.reason, n.status, n.submitted_at, n.updated_at,
        p.member_name AS nominator_name, c.card_number AS nominator_card,
        EXISTS(SELECT 1 FROM member_capabilities mc WHERE mc.passport_id = n.nominator_passport_id AND mc.capability = 'membership_nomination') AS authority_valid
      FROM membership_nominations n JOIN passports p ON p.id = n.nominator_passport_id JOIN cards c ON c.id = p.card_id
      ORDER BY n.submitted_at DESC
    `).all(),
    env.DB.prepare(`
      SELECT i.id, i.invitee_description, i.note, i.status, i.requested_at, i.updated_at,
        p.member_name AS inviter_name, c.card_number AS inviter_card, assigned.card_number AS assigned_card_number,
        EXISTS(SELECT 1 FROM member_capabilities mc WHERE mc.passport_id = i.inviter_passport_id AND mc.capability = 'membership_invitation') AS authority_valid
      FROM membership_invitations i JOIN passports p ON p.id = i.inviter_passport_id JOIN cards c ON c.id = p.card_id
      LEFT JOIN cards assigned ON assigned.id = i.assigned_card_id
      ORDER BY i.requested_at DESC
    `).all()
  ]);
  return json({ nominations: nominations.results || [], invitations: invitations.results || [] }, 200, cors);
}

async function listAvailableInvitationCards(env, cors) {
  const result = await env.DB.prepare(`
    SELECT c.id, c.card_number FROM cards c JOIN passports p ON p.card_id = c.id
    WHERE p.status = 'unclaimed' AND c.disabled_at IS NULL
      AND NOT EXISTS(SELECT 1 FROM membership_invitations i WHERE i.assigned_card_id = c.id)
    ORDER BY CAST(c.card_number AS INTEGER), c.card_number
  `).all();
  return json({ cards: (result.results || []).map((card) => ({ cardId: Number(card.id), cardNumber: card.card_number })) }, 200, cors);
}

async function updateMembershipRequest(body, env, cors) {
  const requestType = String(body.requestType || "");
  const requestId = String(body.requestId || "").trim();
  if (!requestId) throw new HttpError(400, "Request is invalid.");
  if (requestType === "nomination") {
    const status = String(body.status || "");
    if (!["submitted", "approved", "completed", "closed"].includes(status)) throw new HttpError(400, "Nomination status is invalid.");
    const result = await env.DB.prepare(`UPDATE membership_nominations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING id`).bind(status, requestId).first();
    if (!result) throw new HttpError(404, "Nomination not found.");
  } else if (requestType === "invitation") {
    const status = String(body.status || "");
    if (!["requested", "card_assigned", "completed", "closed"].includes(status)) throw new HttpError(400, "Invitation status is invalid.");
    const assignedCardId = body.assignedCardId ? normalizePositiveInteger(body.assignedCardId, "Card") : null;
    if (status === "card_assigned" && !assignedCardId) throw new HttpError(400, "Choose an available access card.");
    if (assignedCardId) {
      const card = await env.DB.prepare(`
        SELECT c.id FROM cards c JOIN passports p ON p.card_id = c.id
        WHERE c.id = ? AND c.disabled_at IS NULL AND p.status = 'unclaimed'
          AND NOT EXISTS(SELECT 1 FROM membership_invitations i WHERE i.assigned_card_id = c.id AND i.id != ?)
      `).bind(assignedCardId, requestId).first();
      if (!card) throw new HttpError(409, "That access card is no longer available.");
    }
    const result = await env.DB.prepare(`UPDATE membership_invitations SET status = ?, assigned_card_id = COALESCE(?, assigned_card_id), updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING id`).bind(status, assignedCardId, requestId).first();
    if (!result) throw new HttpError(404, "Invitation not found.");
  } else {
    throw new HttpError(400, "Request type is invalid.");
  }
  return await listMembershipRequests(env, cors);
}

async function requireAdmin(request, env) {
  if (!env.INNER_CIRCLE_ADMIN_TOKEN) throw new Error("INNER_CIRCLE_ADMIN_TOKEN is not configured.");
  const authorization = request.headers.get("Authorization") || "";
  const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!constantTimeEqual(suppliedToken, env.INNER_CIRCLE_ADMIN_TOKEN)) throw new HttpError(401, "Administrator access required.");
}

function constantTimeEqual(left, right) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) difference |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  return difference === 0;
}

async function enforceRateLimit(request, env) {
  if (!env.RATE_LIMIT_SECRET) throw new Error("RATE_LIMIT_SECRET is not configured.");
  const ipAddress = request.headers.get("CF-Connecting-IP") || "local";
  const windowStart = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
  const rateKey = await sha256(`${env.RATE_LIMIT_SECRET}:${ipAddress}:${windowStart}`);
  const result = await env.DB.prepare(`
    INSERT INTO rate_limits (rate_key, window_start, attempts) VALUES (?, ?, 1)
    ON CONFLICT(rate_key) DO UPDATE SET attempts = attempts + 1 RETURNING attempts
  `).bind(rateKey, windowStart).first();
  if (Number(result.attempts) > RATE_LIMIT_ATTEMPTS) throw new HttpError(429, "Too many attempts. Please wait and try again.");
}

function normalizeCardId(value) {
  const cardId = String(value || "").trim().toUpperCase();
  if (!CARD_ID_PATTERN.test(cardId)) throw new HttpError(400, "Card not recognized.");
  return cardId;
}

function normalizeMemberName(value) {
  const memberName = String(value || "").trim().replace(/\s+/g, " ");
  if (memberName.length < 2 || memberName.length > 80) throw new HttpError(400, "Enter a name between 2 and 80 characters.");
  return memberName;
}

function normalizePositiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new HttpError(400, `${label} is invalid.`);
  return number;
}

function normalizeRewardCost(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 5 || number > 10000) throw new HttpError(400, "Reward cost must be between 5 and 10,000 Keys.");
  return number;
}

function normalizeCooldownHours(value) {
  const number = Number(value || 0);
  if (!Number.isInteger(number) || number < 0 || number > 8760) throw new HttpError(400, "Mission cooldown must be between 0 and 8,760 hours.");
  return number;
}

function getMissionNextAvailableAt(completedAt, cooldownHours) {
  if (!completedAt || cooldownHours < 1) return null;
  const completed = new Date(completedAt.includes("T") ? completedAt : `${completedAt.replace(" ", "T")}Z`);
  if (Number.isNaN(completed.getTime())) return null;
  const nextAvailable = new Date(completed.getTime() + cooldownHours * 60 * 60 * 1000);
  return nextAvailable.getTime() > Date.now() ? nextAvailable.toISOString() : null;
}

async function enforceMissionCooldown(passportId, mission, env) {
  const cooldownHours = Number(mission.cooldown_hours || 0);
  if (!mission.repeatable || cooldownHours < 1) return;
  const latest = await env.DB.prepare(`
    SELECT verified_at FROM mission_completions
    WHERE passport_id = ? AND mission_id = ? ORDER BY verified_at DESC, rowid DESC LIMIT 1
  `).bind(passportId, mission.id).first();
  const nextAvailableAt = getMissionNextAvailableAt(latest?.verified_at, cooldownHours);
  if (nextAvailableAt) throw new HttpError(409, `This mission is available again ${formatCooldownDate(nextAvailableAt)}.`);
}

function formatCooldownDate(value) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles", timeZoneName: "short" }).format(new Date(value));
}

function normalizeBoolean(value) {
  if (value !== true && value !== false) throw new HttpError(400, "Visibility setting is invalid.");
  return value ? 1 : 0;
}

function normalizeOptionalNote(value) {
  const note = String(value || "").trim();
  if (note.length > 500) throw new HttpError(400, "Note must be 500 characters or fewer.");
  return note || null;
}

function normalizeVerificationCode(value) {
  const code = String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
  if (code.length < 4 || code.length > 40) throw new HttpError(400, "Mission code must be between 4 and 40 characters.");
  return code;
}

function normalizeMissionScope(value) {
  const scope = String(value || "global").trim().toLowerCase();
  if (scope !== "global" && scope !== "individual") throw new HttpError(400, "Choose a valid mission assignment.");
  return scope;
}

function normalizeRelayCode(value) {
  const code = String(value || "").trim().toUpperCase();
  if (!RELAY_CODE_PATTERN.test(code)) throw new HttpError(400, "Enter the six-character relay code.");
  return code;
}

function randomCode(length) {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

function normalizeMissionText(value, label, minimum, maximum) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (text.length < minimum || text.length > maximum) throw new HttpError(400, `${label} must be between ${minimum} and ${maximum} characters.`);
  return text;
}

function normalizeOptionalText(value, label, maximum) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (text.length > maximum) throw new HttpError(400, `${label} must be ${maximum} characters or fewer.`);
  return text || null;
}

function normalizeOptionalUrl(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  let url;
  try { url = new URL(text); } catch { throw new HttpError(400, "Enter a complete invitation URL."); }
  if (url.protocol !== "https:") throw new HttpError(400, "Invitation URLs must use HTTPS.");
  return url.toString();
}

function normalizeEventDate(value) {
  const text = String(value || "").trim();
  const date = new Date(text);
  if (!text || Number.isNaN(date.getTime())) throw new HttpError(400, "Enter a valid event date and time.");
  return date.toISOString();
}

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readJson(request) {
  if (!(request.headers.get("Content-Type") || "").includes("application/json")) throw new HttpError(415, "Expected a JSON request.");
  try { return await request.json(); } catch { throw new HttpError(400, "Invalid request."); }
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizePin(value) {
  const pin = String(value || "").trim();
  if (!/^\d{4}$/.test(pin)) throw new HttpError(400, "Enter a 4-digit PIN.");
  return pin;
}

async function hashPin(pin, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 100000 }, key, 256);
  return [...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function makeRandomToken(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = String(env.ALLOWED_ORIGINS || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (origin && !allowedOrigins.includes(origin)) return null;
  const headers = {
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'", "X-Content-Type-Options": "nosniff"
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...extraHeaders } });
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
