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
      if (request.method === "POST" && url.pathname.startsWith("/api/admin/")) {
        await requireAdmin(request, env);
        const body = await readJson(request);
        if (url.pathname === "/api/admin/passports/search") return await searchPassports(body.query, env, cors);
        if (url.pathname === "/api/admin/passports/details") return await getAdminPassport(body.passportId, env, cors);
        if (url.pathname === "/api/admin/missions/complete") return await completeMission(body, env, cors);
        if (url.pathname === "/api/admin/missions/create") return await createMission(body, env, cors);
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
      ((SELECT COUNT(*) FROM event_attendance ea WHERE ea.passport_id = p.id)
        + (SELECT COUNT(*) FROM mission_completions mc JOIN missions m ON m.id = mc.mission_id WHERE mc.passport_id = p.id AND m.counts_as_event = 1)) AS attendance_count,
      (SELECT COUNT(*) FROM stamps s WHERE s.passport_id = p.id) AS stamp_count,
      (SELECT COUNT(DISTINCT mc.mission_id) FROM mission_completions mc WHERE mc.passport_id = p.id) AS mission_count,
      (SELECT COALESCE(SUM(kt.amount), 0) FROM key_transactions kt WHERE kt.passport_id = p.id) AS key_balance
    FROM cards c JOIN passports p ON p.card_id = c.id
    WHERE c.card_hash = ? LIMIT 1
  `).bind(cardHash).first();
}

async function buildPublicPassport(passport, env) {
  await evaluateMilestones(passport.passport_id, env);
  const [missionsResult, latestKeyTransaction, milestonesResult] = await Promise.all([
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
      SELECT m.code, m.title, m.description, m.criteria_type, m.threshold,
        pm.achieved_at
      FROM milestones m
      LEFT JOIN passport_milestones pm ON pm.milestone_id = m.id AND pm.passport_id = ?
      WHERE m.active = 1
      ORDER BY m.sort_order, m.id
    `).bind(passport.passport_id).all()
  ]);

  const milestones = (milestonesResult.results || []).map((milestone) => ({
    code: milestone.code,
    title: milestone.title,
    description: milestone.description,
    criteriaType: milestone.criteria_type,
    threshold: Number(milestone.threshold || 0),
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
    milestones,
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

async function evaluateMilestones(passportId, env) {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO passport_milestones (passport_id, milestone_id)
    SELECT ?, m.id
    FROM milestones m
    WHERE m.active = 1
      AND m.criteria_type IS NOT NULL
      AND m.threshold IS NOT NULL
      AND (
        (m.criteria_type = 'events' AND (
          (SELECT COUNT(*) FROM event_attendance ea WHERE ea.passport_id = ?)
          + (SELECT COUNT(*) FROM mission_completions mc JOIN missions cm ON cm.id = mc.mission_id WHERE mc.passport_id = ? AND cm.counts_as_event = 1)
        ) >= m.threshold)
        OR (m.criteria_type = 'missions' AND (SELECT COUNT(DISTINCT mc.mission_id) FROM mission_completions mc WHERE mc.passport_id = ?) >= m.threshold)
        OR (m.criteria_type = 'keys' AND (SELECT COALESCE(SUM(kt.amount), 0) FROM key_transactions kt WHERE kt.passport_id = ?) >= m.threshold)
      )
  `).bind(passportId, passportId, passportId, passportId, passportId).run();
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
  const countsAsEvent = body.countsAsEvent ? 1 : 0;
  let verificationCodeHash = null;
  if (verificationRequired) verificationCodeHash = await sha256(normalizeVerificationCode(body.verificationCode));

  const slug = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "mission";
  const code = `${slug}-${crypto.randomUUID().slice(0, 6)}`;
  const sortResult = await env.DB.prepare(`SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order FROM missions`).first();
  await env.DB.prepare(`
    INSERT INTO missions
      (code, title, description, key_reward, repeatable, active, sort_order, verification_required, verification_code_hash, counts_as_event)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
  `).bind(code, title, description, keyReward, repeatable, Number(sortResult.next_order), verificationRequired, verificationCodeHash, countsAsEvent).run();

  return json({ status: "created", mission: { code, title, description, keyReward, repeatable: Boolean(repeatable), verificationRequired: Boolean(verificationRequired), countsAsEvent: Boolean(countsAsEvent) } }, 201, cors);
}

async function getPassportById(rawPassportId, env) {
  const passportId = normalizePositiveInteger(rawPassportId, "Passport");
  return env.DB.prepare(`
    SELECT p.id AS passport_id, p.member_name, p.activation_date, p.status, c.card_number,
      ((SELECT COUNT(*) FROM event_attendance ea WHERE ea.passport_id = p.id)
        + (SELECT COUNT(*) FROM mission_completions mc JOIN missions m ON m.id = mc.mission_id WHERE mc.passport_id = p.id AND m.counts_as_event = 1)) AS attendance_count,
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
