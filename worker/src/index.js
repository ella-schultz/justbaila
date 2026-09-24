const CARD_ID_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{12}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,100}$/;
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
        const { cardId } = await readJson(request);
        return await lookupCard(cardId, env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/card/claim") {
        await enforceRateLimit(request, env);
        const { cardId, memberName } = await readJson(request);
        return await claimCard(cardId, memberName, env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/missions/claim") {
        await enforceRateLimit(request, env);
        return await claimMission(await readJson(request), env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/events/check-in") {
        await enforceRateLimit(request, env);
        return await checkInEvent(await readJson(request), env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/milestones/claim") {
        await enforceRateLimit(request, env);
        return await claimMilestone(await readJson(request), env, cors);
      }
      if (request.method === "POST" && url.pathname === "/api/rewards/redeem") {
        await enforceRateLimit(request, env);
        return await redeemReward(await readJson(request), env, cors);
      }
      if (request.method === "GET" && url.pathname === "/api/public/schedule") {
        return await getPublicSchedule(env, cors);
      }
      if (request.method === "POST" && url.pathname.startsWith("/api/admin/")) {
        await requireAdmin(request, env);
        const body = await readJson(request);
        if (url.pathname === "/api/admin/passports/search") return await searchPassports(body.query, env, cors);
        if (url.pathname === "/api/admin/passports/details") return await getAdminPassport(body.passportId, env, cors);
        if (url.pathname === "/api/admin/missions/complete") return await completeMission(body, env, cors);
        if (url.pathname === "/api/admin/missions/create") return await createMission(body, env, cors);
        if (url.pathname === "/api/admin/missions/list") return await listAdminMissions(env, cors);
        if (url.pathname === "/api/admin/missions/update") return await updateMission(body, env, cors);
        if (url.pathname === "/api/admin/missions/set-active") return await setMissionActive(body, env, cors);
        if (url.pathname === "/api/admin/events/create") return await createEvent(body, env, cors);
        if (url.pathname === "/api/admin/events/list") return await listAdminEvents(env, cors);
        if (url.pathname === "/api/admin/events/set-code") return await setEventCode(body, env, cors);
        if (url.pathname === "/api/admin/social-checkin/get") return await getAdminSocialCheckin(env, cors);
        if (url.pathname === "/api/admin/social-checkin/update") return await updateSocialCheckin(body, env, cors);
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
        if (url.pathname === "/api/admin/rewards/redemptions") return await listRewardRedemptions(env, cors);
        if (url.pathname === "/api/admin/rewards/fulfill") return await fulfillReward(body, env, cors);
        if (url.pathname === "/api/admin/invitation/get") return await getAdminInvitation(env, cors);
        if (url.pathname === "/api/admin/invitation/update") return await updateInvitation(body, env, cors);
      }
      if (request.method === "GET" && url.pathname === "/api/health") return json({ status: "ok" }, 200, cors);
      return json({ error: "Not found." }, 404, cors);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status, cors);
      console.error("Inner Circle API error", error);
      return json({ error: "The Inner Circle is temporarily unavailable." }, 500, cors);
    }
  }
};

async function lookupCard(rawCardId, env, cors) {
  const cardId = normalizeCardId(rawCardId);
  const passport = await getPassportByHash(await sha256(cardId), env);
  if (!passport || passport.disabled_at) return json({ status: "invalid" }, 404, cors);
  if (passport.status === "unclaimed") return json({ status: "unclaimed", cardNumber: passport.card_number }, 200, cors);
  if (passport.status !== "claimed") return json({ status: "unavailable" }, 403, cors);
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
    if (existing.status === "claimed") return json({ status: "claimed", passport: await buildPublicPassport(existing, env) }, 409, cors);
    return json({ status: "unavailable" }, 403, cors);
  }
  const passport = await getPassportByHash(cardHash, env);
  return json({ status: "claimed", passport: await buildPublicPassport(passport, env) }, 201, cors);
}

async function getPassportByHash(cardHash, env) {
  return env.DB.prepare(`
    SELECT c.card_number, c.disabled_at, p.id AS passport_id, p.status, p.member_name, p.activation_date,
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
  const [missionsResult, latestKeyTransaction, milestonesResult, invitation, rewardsResult] = await Promise.all([
    env.DB.prepare(`
      SELECT m.code, m.title, m.description, m.key_reward, m.repeatable, m.verification_required, m.counts_as_event,
        COUNT(mc.id) AS completion_count, MAX(mc.verified_at) AS completed_at,
        COALESCE(SUM(CASE WHEN kt.amount > 0 THEN kt.amount ELSE 0 END), 0) AS keys_earned
      FROM missions m
      LEFT JOIN mission_completions mc ON mc.mission_id = m.id AND mc.passport_id = ?
      LEFT JOIN key_transactions kt ON kt.reason_type = 'mission' AND kt.reason_id = mc.id
      WHERE m.active = 1
      GROUP BY m.id ORDER BY m.sort_order, m.id
    `).bind(passport.passport_id).all(),
    env.DB.prepare(`
      SELECT id, amount, description, created_at FROM key_transactions
      WHERE passport_id = ? AND amount > 0 ORDER BY created_at DESC, id DESC LIMIT 1
    `).bind(passport.passport_id).first(),
    env.DB.prepare(`
      SELECT m.code, m.title, m.description, m.criteria_type, m.threshold, m.claimable_by_code, m.member_claimable,
        pm.achieved_at
      FROM milestones m
      LEFT JOIN passport_milestones pm ON pm.milestone_id = m.id AND pm.passport_id = ?
      WHERE m.active = 1
      ORDER BY m.sort_order, m.id
    `).bind(passport.passport_id).all(),
    env.DB.prepare(`
      SELECT kicker, title, description, button_label, button_url, social_checkin_visible, updated_at
      FROM invitation_settings WHERE id = 1
    `).first(),
    env.DB.prepare(`
      SELECT r.code, r.name AS title, r.description, r.key_cost,
        EXISTS(SELECT 1 FROM reward_redemptions rr WHERE rr.reward_id = r.id AND rr.passport_id = ? AND rr.status = 'requested') AS pending
      FROM rewards r WHERE r.active = 1 ORDER BY r.sort_order, r.id
    `).bind(passport.passport_id).all()
  ]);

  const milestones = (milestonesResult.results || []).map((milestone) => ({
    code: milestone.code,
    title: milestone.title,
    description: milestone.description,
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
    keyBalance: Number(passport.key_balance || 0),
    socialCheckinVisible: Boolean(invitation?.social_checkin_visible),
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
      verificationRequired: Boolean(mission.verification_required),
      countsAsEvent: Boolean(mission.counts_as_event),
      completed: Number(mission.completion_count) > 0,
      completionCount: Number(mission.completion_count),
      completedAt: mission.completed_at,
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

async function redeemReward(body, env, cors) {
  const cardId = normalizeCardId(body.cardId);
  const rewardCode = String(body.rewardCode || "").trim();
  const idempotencyKey = String(body.idempotencyKey || "").trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) throw new HttpError(400, "Invalid redemption request.");
  const passport = await getPassportByHash(await sha256(cardId), env);
  if (!passport || passport.disabled_at) throw new HttpError(404, "Card not recognized.");
  if (passport.status !== "claimed") throw new HttpError(403, "Activate this passport before redeeming rewards.");
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
        OR (m.criteria_type = 'missions' AND (SELECT COUNT(DISTINCT mc.mission_id) FROM mission_completions mc WHERE mc.passport_id = ?) >= m.threshold)
        OR (m.criteria_type = 'keys' AND (SELECT COALESCE(SUM(kt.amount), 0) FROM key_transactions kt WHERE kt.passport_id = ?) >= m.threshold)
      )
  `).bind(passportId, passportId, passportId, passportId).run();
}

async function searchPassports(rawQuery, env, cors) {
  const query = String(rawQuery || "").trim().slice(0, 80);
  const likeQuery = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const result = await env.DB.prepare(`
    SELECT p.id AS passport_id, p.member_name, p.activation_date, c.card_number,
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
    SELECT id, code, title, key_reward, repeatable FROM missions WHERE code = ? AND active = 1 LIMIT 1
  `).bind(missionCode).first();
  if (!mission) throw new HttpError(404, "Mission not found.");

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
  if (passport.status !== "claimed") throw new HttpError(403, "Activate this passport before claiming missions.");

  const mission = await env.DB.prepare(`
    SELECT id, code, title, key_reward, repeatable, verification_required, verification_code_hash
    FROM missions WHERE code = ? AND active = 1 LIMIT 1
  `).bind(missionCode).first();
  if (!mission) throw new HttpError(404, "Mission not found.");

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
  const verificationRequired = body.verificationRequired ? 1 : 0;
  let verificationCodeHash = null;
  if (verificationRequired) verificationCodeHash = await sha256(normalizeVerificationCode(body.verificationCode));

  const slug = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "mission";
  const code = `${slug}-${crypto.randomUUID().slice(0, 6)}`;
  const sortResult = await env.DB.prepare(`SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order FROM missions`).first();
  await env.DB.prepare(`
    INSERT INTO missions
      (code, title, description, key_reward, repeatable, active, sort_order, verification_required, verification_code_hash, counts_as_event)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, 0)
  `).bind(code, title, description, keyReward, repeatable, Number(sortResult.next_order), verificationRequired, verificationCodeHash).run();

  return json({ status: "created", mission: { code, title, description, keyReward, repeatable: Boolean(repeatable), verificationRequired: Boolean(verificationRequired) } }, 201, cors);
}

async function listAdminMissions(env, cors) {
  const result = await env.DB.prepare(`
    SELECT m.code, m.title, m.description, m.key_reward, m.repeatable, m.verification_required, m.active,
      COUNT(mc.id) AS completion_count
    FROM missions m
    LEFT JOIN mission_completions mc ON mc.mission_id = m.id
    GROUP BY m.id
    ORDER BY m.active DESC, m.sort_order, m.id
  `).all();
  return json({ missions: (result.results || []).map(toAdminMission) }, 200, cors);
}

async function updateMission(body, env, cors) {
  const code = String(body.code || "").trim();
  const existing = await env.DB.prepare(`SELECT id, verification_required, verification_code_hash FROM missions WHERE code = ?`).bind(code).first();
  if (!existing) throw new HttpError(404, "Mission not found.");
  const title = normalizeMissionText(body.title, "Mission title", 3, 80);
  const description = normalizeMissionText(body.description, "Description", 10, 500);
  const keyReward = Number(body.keyReward);
  if (!Number.isInteger(keyReward) || keyReward < 0 || keyReward > 100) throw new HttpError(400, "Key reward must be between 0 and 100.");
  const repeatable = body.repeatable ? 1 : 0;
  const verificationRequired = body.verificationRequired ? 1 : 0;
  let verificationCodeHash = existing.verification_code_hash;
  if (verificationRequired && String(body.verificationCode || "").trim()) {
    verificationCodeHash = await sha256(normalizeVerificationCode(body.verificationCode));
  }
  if (verificationRequired && !verificationCodeHash) throw new HttpError(400, "Enter a verification code for this mission.");
  if (!verificationRequired) verificationCodeHash = null;

  await env.DB.prepare(`
    UPDATE missions SET title = ?, description = ?, key_reward = ?, repeatable = ?,
      verification_required = ?, verification_code_hash = ?, updated_at = CURRENT_TIMESTAMP
    WHERE code = ?
  `).bind(title, description, keyReward, repeatable, verificationRequired, verificationCodeHash, code).run();
  return json({ status: "updated" }, 200, cors);
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
  if (passport.status !== "claimed") throw new HttpError(403, "Activate this passport before checking in.");
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

async function claimMilestone(body, env, cors) {
  const cardId = normalizeCardId(body.cardId);
  const passport = await getPassportByHash(await sha256(cardId), env);
  if (!passport || passport.disabled_at) throw new HttpError(404, "Card not recognized.");
  if (passport.status !== "claimed") throw new HttpError(403, "Activate this passport before claiming milestones.");
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
    SELECT m.code, m.title, m.description, m.criteria_type, m.threshold, m.member_claimable,
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
  const requiresCode = Boolean(normalizeBoolean(body.requiresCode));
  const claimCode = requiresCode ? normalizeVerificationCode(body.claimCode) : null;
  const claimCodeHash = claimCode ? await sha256(claimCode) : null;
  const slug = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "milestone";
  const code = `${slug}-${crypto.randomUUID().slice(0, 6)}`;
  const sortResult = await env.DB.prepare(`SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order FROM milestones`).first();
  try {
    await env.DB.prepare(`
      INSERT INTO milestones
        (code, title, description, criteria_type, threshold, sort_order, active, claimable_by_code,
         claim_code_hash, claim_code_display, member_claimable)
      VALUES (?, ?, ?, NULL, NULL, ?, 1, ?, ?, ?, 1)
    `).bind(code, title, description, Number(sortResult.next_order), requiresCode ? 1 : 0, claimCodeHash, claimCode).run();
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
  const existing = await env.DB.prepare(`SELECT member_claimable FROM milestones WHERE code = ? LIMIT 1`).bind(code).first();
  if (!existing) throw new HttpError(404, "Milestone not found.");
  if (existing.member_claimable) {
    const requiresCode = normalizeBoolean(body.requiresCode);
    await env.DB.prepare(`
      UPDATE milestones
      SET title = ?, description = ?, claimable_by_code = ?,
        claim_code_hash = CASE WHEN ? = 0 THEN NULL ELSE claim_code_hash END,
        claim_code_display = CASE WHEN ? = 0 THEN NULL ELSE claim_code_display END
      WHERE code = ?
    `).bind(title, description, requiresCode, requiresCode, requiresCode, code).run();
  } else {
    await env.DB.prepare(`UPDATE milestones SET title = ?, description = ? WHERE code = ?`).bind(title, description, code).run();
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
    code: milestone.code, title: milestone.title, description: milestone.description,
    criteriaType: milestone.criteria_type, threshold: Number(milestone.threshold || 0),
    memberClaimable: Boolean(milestone.member_claimable), requiresCode: Boolean(milestone.claimable_by_code),
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
    verificationRequired: Boolean(mission.verification_required), active: Boolean(mission.active),
    completionCount: Number(mission.completion_count)
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

async function getPassportById(rawPassportId, env) {
  const passportId = normalizePositiveInteger(rawPassportId, "Passport");
  return env.DB.prepare(`
    SELECT p.id AS passport_id, p.member_name, p.activation_date, p.status, c.card_number,
      (SELECT COUNT(*) FROM event_attendance ea WHERE ea.passport_id = p.id) AS attendance_count,
      (SELECT COUNT(*) FROM stamps s WHERE s.passport_id = p.id) AS stamp_count,
      (SELECT COUNT(DISTINCT mc.mission_id) FROM mission_completions mc WHERE mc.passport_id = p.id) AS mission_count,
      (SELECT COALESCE(SUM(kt.amount), 0) FROM key_transactions kt WHERE kt.passport_id = p.id) AS key_balance
    FROM passports p JOIN cards c ON c.id = p.card_id
    WHERE p.id = ? AND p.status = 'claimed' AND c.disabled_at IS NULL LIMIT 1
  `).bind(passportId).first();
}

async function buildAdminPassport(passport, env) {
  return { passportId: Number(passport.passport_id), ...await buildPublicPassport(passport, env) };
}

function toAdminPassportSummary(passport) {
  return {
    passportId: Number(passport.passport_id), memberName: passport.member_name,
    cardNumber: passport.card_number, activationDate: passport.activation_date,
    keyBalance: Number(passport.key_balance || 0)
  };
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

async function readJson(request) {
  if (!(request.headers.get("Content-Type") || "").includes("application/json")) throw new HttpError(415, "Expected a JSON request.");
  try { return await request.json(); } catch { throw new HttpError(400, "Invalid request."); }
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
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
