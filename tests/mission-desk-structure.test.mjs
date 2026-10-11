import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import nodeTest from "node:test";
import { existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const privateDeskAvailable = existsSync(new URL("admin-local/index.html", root)) && existsSync(new URL("admin-local/admin.js", root));
const test = (name, callback) => nodeTest(name, { skip: privateDeskAvailable ? false : "Private Mission Desk is intentionally excluded from the public repository." }, callback);
const html = privateDeskAvailable ? await readFile(new URL("admin-local/index.html", root), "utf8") : "";
const script = privateDeskAvailable ? await readFile(new URL("admin-local/admin.js", root), "utf8") : "";

function ids(source) {
  return [...source.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
}

test("Mission Desk markup has unique element IDs", () => {
  const allIds = ids(html);
  assert.equal(new Set(allIds).size, allIds.length);
});

test("every top-level tab controls a permanent workspace", () => {
  const controls = [...html.matchAll(/class="[^"]*workspace-tab[^"]*"[^>]*aria-controls="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(controls, [
    "workspace-overview", "workspace-members", "workspace-missions", "workspace-progression",
    "workspace-community", "workspace-workshop", "workspace-technique-lab", "workspace-hidden",
    "workspace-content", "workspace-live", "workspace-tonight", "workspace-activity"
  ]);
  controls.forEach((id) => assert.match(html, new RegExp(`id="${id}"`)));
});

test("obsolete donor workspaces and runtime teleportation are retired", () => {
  ["workspace-justbaila", "workspace-after-dark", "workspace-signals", "id=\"workspace-technique\""].forEach((value) => assert.equal(html.includes(value), false));
  assert.equal(script.includes("organizeControlCenter"), false);
  assert.equal(script.includes("destination.append(panel)"), false);
  assert.equal(script.includes("makeStation("), false);
});

test("authoritative controls exist exactly once", () => {
  const authoritative = [
    "search-form", "nfc-assignment-form", "mission-form", "mission-manager", "event-form", "event-list",
    "milestone-form", "milestone-manager", "reward-form", "reward-manager", "redemption-list",
    "workshop-form", "workshop-manager", "technique-check-form", "technique-request-list",
    "signals-visibility-form", "signal-form", "signal-list", "classifieds-moderation",
    "archive-form", "archive-manager", "schedule-form", "schedule-manager", "correction-list"
  ];
  const allIds = ids(html);
  authoritative.forEach((id) => assert.equal(allIds.filter((candidate) => candidate === id).length, 1, id));
});

test("Quick Find indexes all operational areas and useful aliases", () => {
  ["correction", "relay", "workshop", "milestone", "signal", "event", "pin reset", "reward", "technique", "assignment"].forEach((term) => {
    assert.equal(script.toLowerCase().includes(term), true, term);
  });
  assert.match(html, /id="desk-quick-find-results"/);
});

test("member context links to authoritative tools rather than cloning editors", () => {
  assert.match(html, /id="member-context-station"/);
  assert.match(script, /loadMemberContext/);
  assert.match(script, /member-preview\.html\?passportId=/);
  assert.equal((html.match(/id="mission-form"/g) || []).length, 1);
});
