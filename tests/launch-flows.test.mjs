import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import worker from '../worker/src/index.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const cardId = 'BBBBBBBBBBBB';

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const migrations = new URL('../worker/migrations/', import.meta.url);
  for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(name, migrations), 'utf8'));
  db.prepare("INSERT INTO cards (card_number, card_hash) VALUES ('901', ?)").run(hash(cardId));
  db.exec('INSERT INTO passports (card_id) VALUES (1)');
  const prepare = (sql, values = []) => ({
    bind(...bindings) { return prepare(sql, bindings); },
    async first(column) { const row = db.prepare(sql).get(...values); return column ? row?.[column] ?? null : row ?? null; },
    async all() { return { results: db.prepare(sql).all(...values), success: true }; },
    async run() { const result = db.prepare(sql).run(...values); return { meta: { changes: result.changes, last_row_id: result.lastInsertRowid }, success: true }; }
  });
  const env = {
    DB: { prepare, async batch(statements) {
      db.exec('BEGIN');
      try { const results = []; for (const statement of statements) results.push(await statement.run()); db.exec('COMMIT'); return results; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    } },
    RATE_LIMIT_SECRET: 'test-rate-secret', INNER_CIRCLE_ADMIN_TOKEN: 'test-admin-only', ALLOWED_ORIGINS: 'http://localhost:8999'
  };
  async function request(path, body = {}, admin = false, ip = '192.0.2.1') {
    const response = await worker.fetch(new Request(`https://example.invalid${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8999', 'CF-Connecting-IP': ip, ...(admin ? { Authorization: 'Bearer test-admin-only' } : {}) }, body: JSON.stringify(body)
    }), env);
    return { status: response.status, body: await response.json() };
  }
  async function activate(cardId = 'BBBBBBBBBBBB') {
    const claim = await request('/api/card/claim', { cardId, memberName: 'Test Member', adultConfirmed: true, termsAccepted: true, privacyAcknowledged: true });
    assert.equal(claim.status, 201, JSON.stringify(claim));
    const pin = await request('/api/card/pin/setup', { cardId, pin: '1234' });
    assert.equal(pin.status, 201, JSON.stringify(pin));
    return { cardId, accessToken: pin.body.accessToken };
  }
  return { db, env, request, activate };
}

test('Community Events preserves seeded text, requires admin access and publishes both languages', async () => {
  const { db, env, request } = fixture();
  const original = await request('/api/admin/community-events/get', {}, true);
  assert.equal(original.status, 200);
  assert.equal(original.body.content.en.title, 'Community Events');
  assert.equal(original.body.content.es.title, 'Eventos comunitarios');
  assert.equal((await request('/api/admin/community-events/get')).status, 401);
  const content = structuredClone(original.body.content);
  content.en.nextTitle = 'Our next social';
  content.en.nextDescription = 'Friday at 7 PM';
  content.es.nextTitle = 'Nuestro próximo social';
  content.es.nextDescription = 'Viernes a las 7 PM';
  assert.equal((await request('/api/admin/community-events/update', { content, revision: 1 })).status, 401);
  const updated = await request('/api/admin/community-events/update', { content, revision: 1 }, true);
  assert.equal(updated.status, 200);
  assert.equal(updated.body.revision, 2);
  const response = await worker.fetch(new Request('https://example.invalid/api/public/community-events', { headers: { Origin: 'http://localhost:8999' } }), env);
  assert.equal(response.status, 200);
  const published = await response.json();
  assert.deepEqual(published.content, content);
  assert.deepEqual(Object.keys(published).sort(), ['content', 'revision']);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM security_audit_log WHERE event_type = 'community_events_updated'").get().count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM event_attendance').get().count, 0);
});

test('Community Events rejects unsafe links, incomplete translations and stale saves', async () => {
  const { request } = fixture();
  const original = (await request('/api/admin/community-events/get', {}, true)).body;
  for (const calendarUrl of ['javascript:alert(1)', 'http://example.com', 'https://user:password@example.com']) {
    const invalid = { ...original, content: { ...original.content, calendarUrl } };
    assert.equal((await request('/api/admin/community-events/update', invalid, true)).status, 400);
  }
  const incomplete = structuredClone(original);
  incomplete.content.es.nextTitle = '';
  assert.equal((await request('/api/admin/community-events/update', incomplete, true)).status, 400);
  delete incomplete.content.es;
  assert.equal((await request('/api/admin/community-events/update', incomplete, true)).status, 400);
  const tooLong = structuredClone(original);
  tooLong.content.en.nextDescription = 'x'.repeat(2001);
  assert.equal((await request('/api/admin/community-events/update', tooLong, true)).status, 400);
  assert.equal((await request('/api/admin/community-events/update', original, true)).status, 200);
  assert.equal((await request('/api/admin/community-events/update', original, true)).status, 409);
  assert.equal((await request('/api/admin/community-events/get', {}, true)).body.revision, 2);
});

test('Community Events optional blocks and calendar buttons can be cleared without deleting content history elsewhere', async () => {
  const { request } = fixture();
  const body = (await request('/api/admin/community-events/get', {}, true)).body;
  for (const language of ['en', 'es']) {
    for (const field of ['nextTitle', 'nextDescription', 'outreachTitle', 'outreachDescription', 'buttonLabel']) body.content[language][field] = '';
  }
  body.content.calendarUrl = '';
  assert.equal((await request('/api/admin/community-events/update', body, true)).status, 200);
  const saved = (await request('/api/admin/community-events/get', {}, true)).body.content;
  assert.equal(saved.en.nextDescription, '');
  assert.equal(saved.es.buttonLabel, '');
  assert.equal(saved.calendarUrl, '');
});

test('special-event banner defaults preserve the existing hero and edits persist independently of community copy', async () => {
  const { db, request } = fixture();
  const body = (await request('/api/admin/community-events/get', {}, true)).body;
  assert.equal(body.content.banner.en.date, 'October 11, 2026');
  assert.equal(body.content.banner.es.title, 'Noche de baile latino en Uptown Lounge');
  assert.equal(body.content.banner.visible, true);
  assert.equal(JSON.parse(db.prepare('SELECT content_json FROM community_event_settings').get().content_json).banner, undefined);
  const communityCopy = structuredClone(body.content.en);
  body.content.banner.en.title = 'A new special event';
  body.content.banner.es.title = 'Un nuevo evento especial';
  body.content.banner.linkUrl = 'https://example.com/event';
  assert.equal((await request('/api/admin/community-events/update', body)).status, 401);
  assert.equal((await request('/api/admin/community-events/update', body, true)).status, 200);
  const saved = (await request('/api/admin/community-events/get', {}, true)).body;
  assert.equal(saved.content.banner.en.title, 'A new special event');
  assert.deepEqual(saved.content.en, communityCopy);
  saved.content.banner.visible = false;
  assert.equal((await request('/api/admin/community-events/update', saved, true)).status, 200);
  assert.equal((await request('/api/admin/community-events/get', {}, true)).body.content.banner.visible, false);
});

test('older Community Events editors preserve saved banner settings instead of resetting them', async () => {
  const { request } = fixture();
  const first = (await request('/api/admin/community-events/get', {}, true)).body;
  first.content.banner.visible = false;
  first.content.banner.en.title = 'Keep this banner';
  assert.equal((await request('/api/admin/community-events/update', first, true)).status, 200);
  const legacy = (await request('/api/admin/community-events/get', {}, true)).body;
  delete legacy.content.banner;
  legacy.content.en.nextTitle = 'Community edit';
  assert.equal((await request('/api/admin/community-events/update', legacy, true)).status, 200);
  const saved = (await request('/api/admin/community-events/get', {}, true)).body;
  assert.equal(saved.content.banner.visible, false);
  assert.equal(saved.content.banner.en.title, 'Keep this banner');
});

test('banner validation rejects unsafe links and incomplete visible content without saving', async () => {
  const { request } = fixture();
  const original = (await request('/api/admin/community-events/get', {}, true)).body;
  for (const linkUrl of ['javascript:alert(1)', '//example.com', 'https://user:password@example.com', '#missing-section']) {
    const body = structuredClone(original);
    body.content.banner.linkUrl = linkUrl;
    assert.equal((await request('/api/admin/community-events/update', body, true)).status, 400);
  }
  for (const change of [banner => { banner.es.title = ''; }, banner => { banner.visible = 'false'; }, banner => { banner.en.details = 'x'.repeat(801); }]) {
    const body = structuredClone(original);
    change(body.content.banner);
    assert.equal((await request('/api/admin/community-events/update', body, true)).status, 400);
  }
  assert.equal((await request('/api/admin/community-events/get', {}, true)).body.revision, 1);
});

test('activation, consent, PIN, intro and session lookup complete end-to-end', async () => {
  const { db, request, activate } = fixture();
  assert.equal((await request('/api/card/lookup', { cardId })).body.status, 'unclaimed');
  assert.equal((await request('/api/card/claim', { cardId, memberName: 'Test Member' })).status, 403);
  assert.equal(db.prepare('SELECT status FROM passports').get().status, 'unclaimed');
  const session = await activate();
  assert.equal((await request('/api/card/lookup', session)).body.passport.introSeen, false);
  assert.equal((await request('/api/member/intro/seen', session)).status, 200);
  assert.equal((await request('/api/card/lookup', session)).body.passport.introSeen, true);
  assert.equal((await request('/api/card/pin/unlock', { cardId, pin: '5678' })).status, 403);
  assert.equal((await request('/api/card/pin/unlock', { cardId, pin: '1234' })).status, 200);
  assert.equal((await request('/api/card/lookup', { cardId })).body.status, 'pin_required');
});

test('NFC and code check-ins share one attendance record and timestamp', async () => {
  const { db, request, activate } = fixture();
  const session = await activate();
  db.prepare("INSERT INTO events (title,starts_at,check_in_code_hash,active) VALUES ('Test Social','2026-10-11T19:00',?,1)").run(hash('SOCIALTEST'));
  db.exec('UPDATE invitation_settings SET social_checkin_visible = 1');
  assert.equal((await request('/api/admin/nfc/assign', { passportId: 1, uid: '04:ab:cd:12:34:56:78' }, true)).status, 200);
  const first = await request('/api/admin/nfc/check-in', { eventId: 1, uid: '04ABCD12345678' }, true);
  assert.equal(first.status, 201, JSON.stringify(first));
  const duplicate = await request('/api/admin/nfc/check-in', { eventId: 1, uid: '04 ab cd 12 34 56 78' }, true);
  assert.equal(duplicate.body.status, 'already_checked_in');
  assert.equal(duplicate.body.checkedInAt, first.body.checkedInAt);
  assert.equal((await request('/api/events/check-in', { ...session, checkInCode: 'SOCIALTEST' })).status, 409);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM event_attendance').get().count, 1);
});

test('suspended members cannot log in or mutate with an existing session', async () => {
  const { db, request, activate } = fixture();
  const session = await activate();
  db.exec("UPDATE passports SET status = 'suspended'");
  assert.equal((await request('/api/card/pin/unlock', { cardId, pin: '1234' })).status, 403);
  assert.equal((await request('/api/member/intro/seen', session)).status, 401);
});

test('concurrent PIN creation grants a session only to the winning request', async () => {
  const { db, request } = fixture();
  await request('/api/card/claim', { cardId, memberName: 'Test Member', adultConfirmed: true, termsAccepted: true, privacyAcknowledged: true });
  const results = await Promise.all(['1234','5678'].map(pin => request('/api/card/pin/setup', { cardId, pin })));
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM card_access_sessions').get().count, 1);
});

test('authenticated member refreshes do not exhaust the shared venue activation limit', async () => {
  const { request, activate } = fixture();
  const session = await activate();
  for (let count = 0; count < 42; count += 1) {
    const result = await request('/api/card/lookup', session);
    assert.equal(result.status, 200, `Refresh ${count}: ${JSON.stringify(result)}`);
  }
  assert.equal((await request('/api/card/lookup', { cardId })).status, 200);
});

test('simultaneous wrong PINs still lock the card after five attempts', async () => {
  const { db, request, activate } = fixture();
  await activate();
  await Promise.all(Array.from({ length: 6 }, () => request('/api/card/pin/unlock', { cardId, pin: '9999' })));
  assert.ok(db.prepare('SELECT pin_locked_until FROM passports').get().pin_locked_until);
  assert.equal((await request('/api/card/pin/unlock', { cardId, pin: '1234' })).status, 429);
});

test('all admin read endpoints work against the current schema', async () => {
  const { request, activate } = fixture();
  await activate();
  const source = readFileSync(new URL('../worker/src/index.js', import.meta.url), 'utf8');
  const registry = source.slice(source.indexOf('const ADMIN_READ_ROUTES'), source.indexOf('export default'));
  for (const [, path] of registry.matchAll(/"(\/api\/admin\/[^\"]+)"/g)) {
    const result = await request(path, { passportId: 1, query: '' }, true);
    assert.notEqual(result.status, 500, `${path}: ${JSON.stringify(result)}`);
  }
});

test('hidden ghost missions cannot be claimed before eligibility', async () => {
  const { db, request, activate } = fixture();
  const session = await activate();
  db.exec("INSERT INTO missions (code,title,description,key_reward,visibility_mode,trigger_type,operator_active) VALUES ('test-ghost','Ghost','Test only',2,'ghost','operator',0)");
  const result = await request('/api/missions/claim', { ...session, missionCode: 'test-ghost', idempotencyKey: 'test-ghost-complete-001' });
  assert.equal(result.status, 404, JSON.stringify(result));
  assert.equal(db.prepare('SELECT COUNT(*) count FROM mission_completions').get().count, 0);
});

test('mission completion awards Keys once and rewards cannot overspend', async () => {
  const { db, request, activate } = fixture();
  const session = await activate();
  db.exec("INSERT INTO missions (code,title,description,key_reward) VALUES ('test-mission','Mission','Test only',5)");
  const completion = await request('/api/missions/claim', { ...session, missionCode: 'test-mission', idempotencyKey: 'test-mission-complete-001' });
  assert.equal(completion.status, 201, JSON.stringify(completion));
  assert.equal(completion.body.passport.keyBalance, 5);
  assert.equal((await request('/api/missions/claim', { ...session, missionCode: 'test-mission', idempotencyKey: 'test-mission-complete-002' })).status, 409);
  db.exec("INSERT INTO rewards (code,name,key_cost) VALUES ('test-reward','Test Reward',5)");
  const redemption = await request('/api/rewards/redeem', { ...session, rewardCode: 'test-reward', idempotencyKey: 'test-reward-redeem-001' });
  assert.equal(redemption.status, 201, JSON.stringify(redemption));
  assert.equal(redemption.body.passport.keyBalance, 0);
  assert.notEqual((await request('/api/rewards/redeem', { ...session, rewardCode: 'test-reward', idempotencyKey: 'test-reward-redeem-002' })).status, 201);
});

test('target directory includes claimed members and excludes disabled cards', async () => {
  const { db, request, activate } = fixture();
  const session = await activate();
  assert.equal((await request('/api/technique/targets/update', { ...session, skillCode: 'weight-transfer', action: 'add' })).status, 200);
  const list = await request('/api/admin/technique/target-members', { skillCode: 'weight-transfer' }, true);
  assert.equal(list.body.members.length, 1);
  db.exec('UPDATE cards SET disabled_at = CURRENT_TIMESTAMP');
  assert.equal((await request('/api/admin/technique/target-members', { skillCode: 'weight-transfer' }, true)).body.members.length, 0);
});

test('Dead Drops open at their start time and transmissions expire within the same day', async () => {
  const { db, request, activate } = fixture();
  const session = await activate();
  const past = new Date(Date.now() - 60000).toISOString();
  const future = new Date(Date.now() + 60000).toISOString();
  const saved = await request('/api/admin/dead-drops/save', { title: 'Test Drop', body: 'Synthetic clue', startsAt: past, expiresAt: future, eligibilityType: 'all', maxClaims: 1 }, true);
  assert.equal(saved.status, 200, JSON.stringify(saved));
  const signal = await request('/api/admin/transmissions/send', { message: 'Test signal', scopeType: 'member', passportId: 1 }, true);
  assert.equal(signal.status, 201, JSON.stringify(signal));
  db.prepare('UPDATE manual_transmissions SET expires_at = ?').run(past);
  const profile = await request('/api/card/lookup', session);
  assert.equal(profile.body.passport.deadDrops.length, 1);
  assert.equal(profile.body.passport.transmissions.length, 0);
  assert.equal((await request('/api/member/dead-drop/claim', { ...session, deadDropId: saved.body.id })).status, 200);
});

test('simultaneous Dead Drop claims respect capacity', async () => {
  const { db, request, activate } = fixture();
  const first = await activate();
  db.prepare("INSERT INTO cards (card_number,card_hash) VALUES ('902',?)").run(hash('CCCCCCCCCCCC'));
  db.exec('INSERT INTO passports (card_id) VALUES (2)');
  const second = await activate('CCCCCCCCCCCC');
  const drop = await request('/api/admin/dead-drops/save', { title: 'Only One', body: 'Test capacity', startsAt: new Date(Date.now()-60000).toISOString(), expiresAt: new Date(Date.now()+60000).toISOString(), eligibilityType:'all', maxClaims: 1 }, true);
  const results = await Promise.all([first,second].map(session => request('/api/member/dead-drop/claim', { ...session, deadDropId: drop.body.id })));
  assert.deepEqual(results.map(result => result.status).sort(), [200,409]);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM dead_drop_claims').get().count, 1);
});

test('code-required and private missions cannot be self-awarded without authorization', async () => {
  const { db, request, activate } = fixture();
  const session = await activate();
  db.prepare("INSERT INTO missions (code,title,description,key_reward,verification_required,verification_code_hash) VALUES ('test-code','Test Code','Test',2,1,?)").run(hash('ONLYHERE'));
  assert.equal((await request('/api/missions/claim', { ...session, missionCode:'test-code', verificationCode:'WRONGCODE', idempotencyKey:'test-code-complete-001' })).status,403);
  assert.equal((await request('/api/missions/claim', { ...session, missionCode:'test-code', verificationCode:'ONLYHERE', idempotencyKey:'test-code-complete-002' })).status,201);
  db.exec("INSERT INTO missions (code,title,description,key_reward,scope) VALUES ('test-private','Private','Test',2,'individual')");
  assert.equal((await request('/api/missions/claim', { ...session, missionCode:'test-private', idempotencyKey:'test-private-complete-001' })).status,404);
});

test('invalid-card and wrong-PIN rate limits remain enforced', async () => {
  const { request, activate } = fixture();
  await activate();
  for (let count=0; count<40; count+=1) assert.equal((await request('/api/card/lookup',{cardId:'ZZZZZZZZZZZZ'})).status,404);
  assert.equal((await request('/api/card/lookup',{cardId:'ZZZZZZZZZZZZ'})).status,429);
  for (let count=0; count<4; count+=1) assert.equal((await request('/api/card/pin/unlock',{cardId,pin:'9999'})).status,403);
  assert.equal((await request('/api/card/pin/unlock',{cardId,pin:'9999'})).status,429);
});

test('Overlap radar excludes unavailable members and expired invitations cannot be accepted', async () => {
  const { db, request, activate } = fixture();
  const session = await activate();
  db.prepare("INSERT INTO cards (card_number,card_hash) VALUES ('902',?)").run(hash('CCCCCCCCCCCC'));
  db.exec("INSERT INTO passports (card_id,status,member_name) VALUES (2,'claimed','Test Partner')");
  const skillId = db.prepare("SELECT id FROM technique_competencies WHERE code='weight-transfer'").get().id;
  for (const passportId of [1,2]) db.prepare('INSERT INTO member_targets (passport_id,skill_id) VALUES (?,?)').run(passportId,skillId);
  db.exec("INSERT INTO events (title,starts_at,active) VALUES ('Test Event','2026-10-11T19:00Z',1); INSERT INTO event_attendance (passport_id,event_id) VALUES (1,1),(2,1)");
  assert.equal((await request('/api/admin/technique/overlap-radar', { eventId:1 },true)).body.matches.length,1);
  const match = await request('/api/admin/technique/overlap-activate', { firstPassportId:1,secondPassportId:2,firstSkillId:skillId,secondSkillId:skillId,matchType:'exact' },true);
  assert.equal(match.status,201);
  db.prepare('UPDATE overlap_invitations SET expires_at = ?').run(new Date(Date.now()-60000).toISOString());
  assert.equal((await request('/api/technique/targets/overlap',{...session,overlapId:match.body.id,action:'accept'})).status,404);
  db.exec("UPDATE passports SET status='suspended' WHERE id=2");
  assert.equal((await request('/api/admin/technique/overlap-radar', { eventId:1 },true)).body.matches.length,0);
  assert.equal((await request('/api/admin/technique/overlap-activate', { firstPassportId:1,secondPassportId:2,firstSkillId:skillId,secondSkillId:skillId,matchType:'exact' },true)).status,409);
});
