import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const migration = await readFile(new URL("worker/migrations/0047_wave3_command_center.sql", root), "utf8");
const worker = await readFile(new URL("worker/src/index.js", root), "utf8");
const member = await readFile(new URL("tap/app.js", root), "utf8");
const privateDeskAvailable = existsSync(new URL("admin-local/index.html", root)) && existsSync(new URL("admin-local/admin.js", root));
const deskTest = (name, callback) => test(name, { skip: privateDeskAvailable ? false : "Private Mission Desk is intentionally excluded from the public repository." }, callback);
const admin = privateDeskAvailable ? await readFile(new URL("admin-local/admin.js", root), "utf8") : "";
const memberHtml = await readFile(new URL("tap/index.html", root), "utf8");
const adminHtml = privateDeskAvailable ? await readFile(new URL("admin-local/index.html", root), "utf8") : "";

test("Current Targets are limited to three server-side", () => {
  assert.match(worker, /COUNT\(\*\) count FROM member_targets/);
  assert.match(worker, />= 3/);
  assert.match(worker, /up to three Current Targets/);
});

test("Technique role filtering is account-backed and includes Either skills", () => {
  assert.match(worker, /preferred_role/);
  assert.match(member, /skill\.role==="either"\|\|skill\.role===techniqueLab\.preferredRole/);
  assert.match(memberHtml, /id="target-role"/);
});

test("archived skills and Target history remain referentially safe", () => {
  assert.match(migration, /active INTEGER NOT NULL DEFAULT 1/);
  assert.match(migration, /CREATE TABLE target_history/);
  assert.match(migration, /skill_id INTEGER NOT NULL REFERENCES technique_competencies/);
  assert.doesNotMatch(worker, /DELETE FROM technique_competencies/);
});

test("Overlap is automatic and helper status is not member-facing", () => {
  assert.match(migration, /available_to_help INTEGER NOT NULL DEFAULT 0/);
  assert.doesNotMatch(member, /Available to help/);
  assert.doesNotMatch(memberHtml, /Open to Overlap/);
});

test("Overlap requires presence, compatibility, and role compatibility", () => {
  assert.doesNotMatch(worker, /JOIN overlap_preferences opa/);
  assert.match(worker, /JOIN event_attendance ea[\s\S]*JOIN event_attendance eb/);
  assert.match(worker, /technique_complementarity/);
  assert.match(worker, /role_applicability = 'either'[\s\S]*role_applicability !=/);
});

deskTest("Mission Desk can list every active member holding a Target", () => {
  assert.match(worker, /api\/admin\/technique\/target-members/);
  assert.match(worker, /FROM member_targets mt JOIN passports p/);
  assert.match(admin, /Overlap directory/);
  assert.match(admin, /overlap-directory-target/);
});

deskTest("Overlap directory can Signal exactly two selected members", () => {
  assert.match(admin, /overlapMessageRecipients\.size!==2/);
  assert.match(admin, /messageType:"overlap"/);
  assert.match(admin, /passportIds:\[\.\.\.overlapMessageRecipients\]/);
});

deskTest("Overlap directory can activate a match without an event", () => {
  assert.match(admin, /createDirectoryOverlap/);
  assert.match(admin, /firstSkillId:Number\(skill\.id\)/);
  assert.match(worker, /eventId \? 4 : 24/);
});

test("Command Center events survive an activity-stream failure", () => {
  assert.match(worker, /listAdminActivityData\(env\)\.catch/);
  assert.match(worker, /SELECT id, title, starts_at, location, active FROM events/);
});

test("declining an Overlap has no Key or penalty mutation", () => {
  const body = worker.match(/async function respondOverlap[\s\S]*?\n}/)?.[0] || "";
  assert.match(body, /"declined"/);
  assert.doesNotMatch(body, /key_transactions|amount|penalty|reward/);
});

test("Dead Drops enforce time, eligibility, max claims, and one claim per member", () => {
  assert.match(migration, /PRIMARY KEY \(dead_drop_id, passport_id\)/);
  assert.match(worker, /datetime\(starts_at\) <= CURRENT_TIMESTAMP AND datetime\(expires_at\) > CURRENT_TIMESTAMP/);
  assert.match(worker, /max_claims/);
  assert.match(worker, /This Dead Drop is not available/);
});

test("Ghost Missions are filtered before reaching member views", () => {
  assert.match(migration, /visibility_mode TEXT NOT NULL DEFAULT 'normal'/);
  assert.match(worker, /isGhostMissionEligible/);
  assert.match(worker, /visibleMissions\.map/);
});

test("manual transmissions are scoped, bounded, temporary, and authorization remains admin-side", () => {
  assert.match(migration, /scope_type TEXT NOT NULL CHECK \(scope_type IN \('member', 'selected', 'event'\)\)/);
  assert.match(worker, /recipients\.length > 200/);
  assert.match(worker, /durationHours \|\| 4/);
  assert.match(worker, /await requireAdmin\(request, env\)/);
});

deskTest("private admin notes are absent from the public passport builder", () => {
  const publicBuilder = worker.match(/async function buildPublicPassport[\s\S]*?\n}\n\nconst CLASSIFIED/)?.[0] || "";
  assert.doesNotMatch(publicBuilder, /member_admin_notes|admin_watchlist|watchNote/);
  assert.match(admin, /Private dossier note/);
});

deskTest("Wave 3 extends Technique Lab rather than creating a standalone Target workspace", () => {
  assert.match(member, /renderCurrentTargets/);
  assert.match(adminHtml, /Shared skill catalog/);
  assert.doesNotMatch(adminHtml, /data-workspace="targets"/);
});
