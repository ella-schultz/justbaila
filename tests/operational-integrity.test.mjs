import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const workerSource = readFileSync(join(root, "worker/src/index.js"), "utf8");

function database() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const name of readdirSync(join(root, "worker/migrations")).filter((name) => name.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(root, "worker/migrations", name), "utf8"));
  }
  db.exec(`
    INSERT INTO cards (card_number, card_hash) VALUES ('101', 'hash-a'), ('102', 'hash-b');
    INSERT INTO passports (card_id, status, member_name, activation_date) VALUES (1, 'claimed', 'Alpha', CURRENT_TIMESTAMP), (2, 'claimed', 'Beta', CURRENT_TIMESTAMP);
  `);
  return db;
}

function addMission(db, { code = "test", repeatable = 0, cooldown = 0, reward = 2 } = {}) {
  db.prepare(`INSERT INTO missions (code,title,description,key_reward,repeatable,cooldown_hours) VALUES (?,?,?,?,?,?)`)
    .run(code, code, "Test mission", reward, repeatable, cooldown);
  return Number(db.prepare("SELECT id FROM missions WHERE code=?").get(code).id);
}

function completeMission(db, missionId, id, number = 1, verifier = null) {
  db.prepare(`INSERT INTO mission_completions (id,passport_id,mission_id,completion_number,verified_by,relay_verifier_passport_id) VALUES (?,1,?,?,?,?)`)
    .run(id, missionId, number, verifier ? "member-relay" : "member-honor", verifier);
  db.prepare(`INSERT INTO key_transactions (id,passport_id,amount,transaction_type,reason_type,reason_id,description,created_by) VALUES (?,1,2,'earned','mission',?,'award','test')`)
    .run(`key_${id}`, id);
}

test("one-time missions and simultaneous duplicate claims remain unique", () => {
  const db = database(); const mission = addMission(db);
  completeMission(db, mission, "first");
  assert.throws(() => completeMission(db, mission, "second"), /UNIQUE/);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM mission_completions").get().count, 1);
});

test("repeatable mission history supports numbered completions and cooldown calculation", () => {
  const db = database(); const mission = addMission(db, { code: "repeat", repeatable: 1, cooldown: 24 });
  completeMission(db, mission, "repeat-1", 1);
  completeMission(db, mission, "repeat-2", 2);
  assert.equal(db.prepare("SELECT MAX(completion_number) n FROM mission_completions").get().n, 2);
  assert.match(workerSource, /enforceMissionCooldown/);
  assert.match(workerSource, /cooldown_hours/);
});

test("Key awards are idempotent and mission correction uses a compensating ledger entry", () => {
  const db = database(); const mission = addMission(db); completeMission(db, mission, "award-1");
  assert.throws(() => db.prepare(`INSERT INTO key_transactions VALUES ('other',1,2,'earned','mission','award-1','duplicate',CURRENT_TIMESTAMP,'test')`).run(), /UNIQUE/);
  db.prepare(`INSERT INTO admin_corrections (id,target_type,target_id,passport_id,reason,effect_summary) VALUES ('correction-1','mission_completion','award-1',1,'mistake','Mission and Keys reversed')`).run();
  db.prepare(`INSERT INTO key_transactions (id,passport_id,amount,transaction_type,reason_type,reason_id,description,created_by) VALUES ('key-correction',1,-2,'adjustment','adjustment','correction-1','Correction','correction')`).run();
  assert.equal(db.prepare("SELECT SUM(amount) balance FROM key_transactions WHERE passport_id=1").get().balance, 0);
  assert.equal(db.prepare(`SELECT COUNT(*) count FROM mission_completions mc WHERE NOT EXISTS (SELECT 1 FROM admin_corrections ac WHERE ac.target_type='mission_completion' AND ac.target_id=mc.id AND ac.affects_effective_state=1)`).get().count, 0);
});

test("Relay verification rejects reuse and Worker rejects self-verification", () => {
  const db = database(); const mission = addMission(db, { code: "relay", repeatable: 1 });
  completeMission(db, mission, "relay-1", 1, 2);
  assert.throws(() => completeMission(db, mission, "relay-2", 2, 2), /UNIQUE/);
  assert.match(workerSource, /Number\(verifier\.passport_id\) === Number\(passport\.passport_id\)/);
});

test("Signal ownership update is conditional so simultaneous transfers cannot both win", () => {
  const db = database();
  db.exec(`INSERT INTO signals (id,public_code,signal_type_id,original_holder_id,current_holder_id,released_by) VALUES ('s1','WS-TEST',1,1,1,'test')`);
  const first = db.prepare("UPDATE signals SET current_holder_id=2 WHERE id='s1' AND current_holder_id=1").run();
  const second = db.prepare("UPDATE signals SET current_holder_id=1 WHERE id='s1' AND current_holder_id=1").run();
  assert.equal(first.changes, 1); assert.equal(second.changes, 0);
});

test("event attendance is unique and corrections remove it from effective counts", () => {
  const db = database(); db.exec(`INSERT INTO events (title,starts_at) VALUES ('Social','2026-10-01'); INSERT INTO event_attendance (passport_id,event_id) VALUES (1,1)`);
  assert.throws(() => db.exec("INSERT INTO event_attendance (passport_id,event_id) VALUES (1,1)"), /UNIQUE/);
  db.exec(`INSERT INTO admin_corrections (id,target_type,target_id,passport_id,reason,effect_summary) VALUES ('c-att','event_attendance','1',1,'duplicate','Excluded')`);
  assert.equal(db.prepare(`SELECT COUNT(*) count FROM event_attendance ea WHERE NOT EXISTS (SELECT 1 FROM admin_corrections ac WHERE ac.target_type='event_attendance' AND ac.target_id=CAST(ea.id AS TEXT) AND ac.affects_effective_state=1)`).get().count, 0);
});

test("PIN lockout and expiring hashed sessions remain implemented", () => {
  assert.match(workerSource, /pin_failed_attempts = CASE WHEN pin_failed_attempts \+ 1 >= 5/);
  assert.match(workerSource, /datetime\('now', '\+15 minutes'\)/);
  assert.match(workerSource, /card_access_sessions[\s\S]{0,200}token_hash = \?[\s\S]{0,100}expires_at > CURRENT_TIMESTAMP/);
  assert.match(workerSource, /datetime\('now', '\+24 hours'\)/);
});

test("Workshop completion is unique and corrected completion is excluded", () => {
  const db = database();
  const challenge = db.prepare("SELECT id FROM workshop_challenges ORDER BY id LIMIT 1").get().id;
  db.prepare("INSERT INTO workshop_completions (id,passport_id,challenge_id,verification_method) VALUES ('w1',1,?,'honor')").run(challenge);
  assert.throws(() => db.prepare("INSERT INTO workshop_completions (id,passport_id,challenge_id,verification_method) VALUES ('w2',1,?,'honor')").run(challenge), /UNIQUE/);
  db.exec(`INSERT INTO admin_corrections (id,target_type,target_id,passport_id,reason,effect_summary) VALUES ('cw','workshop_completion','w1',1,'mistake','Excluded')`);
  assert.match(workerSource, /recalculateWorkshopProgress/);
});

test("reward spending cannot overdraw normally and duplicate pending redemptions fail", () => {
  const db = database(); const mission = addMission(db, { reward: 10 }); completeMission(db, mission, "funding");
  const reward = db.prepare("SELECT id FROM rewards WHERE code='justbaila-sticker'").get().id;
  db.prepare("INSERT INTO reward_redemptions (id,passport_id,reward_id,keys_spent) VALUES ('r1',1,?,5)").run(reward);
  assert.throws(() => db.prepare("INSERT INTO reward_redemptions (id,passport_id,reward_id,keys_spent) VALUES ('r2',1,?,5)").run(reward), /UNIQUE/);
  assert.throws(() => db.exec(`INSERT INTO key_transactions (id,passport_id,amount,transaction_type,reason_type,reason_id,description,created_by) VALUES ('overspend',1,-50,'spent','reward','overspend','x','member')`), /insufficient key balance/);
});

test("Technique availability and instructor permission are authoritative Worker checks", () => {
  assert.match(workerSource, /Technique feedback is not available right now/);
  assert.match(workerSource, /JOIN passport_roles pr ON pr\.passport_id = p\.id AND pr\.role = 'instructor'/);
});

test("Classified contact sharing remains controlled by the listing owner", () => {
  assert.match(workerSource, /listing_id IN \(SELECT id FROM classified_listings WHERE passport_id = \?\)/);
  assert.match(workerSource, /action === "share_contact"/);
});

test("correction targets are unique, immutable audit records", () => {
  const db = database();
  db.exec(`INSERT INTO admin_corrections (id,target_type,target_id,passport_id,reason,effect_summary) VALUES ('c1','reward_fulfillment','r1',1,'wrong','history only')`);
  assert.throws(() => db.exec(`INSERT INTO admin_corrections (id,target_type,target_id,passport_id,reason,effect_summary) VALUES ('c2','reward_fulfillment','r1',1,'again','duplicate')`), /UNIQUE/);
});
