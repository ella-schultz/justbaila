import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';

const member = readFileSync(new URL('../tap/app.js', import.meta.url), 'utf8');
const adminPath = new URL('../admin-local/admin.js', import.meta.url);
const admin = existsSync(adminPath) ? readFileSync(adminPath, 'utf8') : null;

function install(context, source, names) {
  for (const name of names) vm.runInContext(source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0], context);
}

function screen() {
  return {
    hidden: true, scrollTop: 800, focusOptions: null,
    scrollTo(options) { this.scrollTop = options.top; this.behavior = options.behavior; },
    scrollIntoView(options) { this.entryOptions = options; },
    focus(options) { this.focusOptions = options; },
    replaceChildren() {}, classList: { add() {}, remove() {} }
  };
}

function fixture() {
  const nodes = new Map();
  const node = selector => { if (!nodes.has(selector)) nodes.set(selector, screen()); return nodes.get(selector); };
  const scrolls = [];
  const context = vm.createContext({
    window: { scrollTo: options => scrolls.push(options), localStorage: { getItem: () => 'yes', setItem() {} }, requestAnimationFrame: callback => callback(), location: { hash: '#the-door' } },
    document: { querySelector: node, body: { classList: { add() {}, remove() {} } } },
    cardId: 'test', isInstructor: false, techniqueLabSection: screen(), techniqueDiscovery: screen(), techniqueInterface: screen(),
    archiveRoom: screen(), currentArchiveEntries: [], makeArchiveFile() {}, classifiedsSection: screen(),
    memberIntro: screen(), memberIntroEnter: screen(), memberIntroError: screen()
  });
  install(context, member, ['startScreenAtTop', 'openTechniqueLab', 'revealTechniqueInterface', 'closeTechniqueLab', 'openArchive', 'openClassifieds', 'showMemberIntro']);
  return { context, node, scrolls };
}

test('Archive and Classifieds reopen at their own top without moving the underlying page', () => {
  const { context, scrolls } = fixture();
  for (const [handler, name] of [['openArchive', 'archiveRoom'], ['openClassifieds', 'classifiedsSection']]) {
    vm.runInContext(`${handler}()`, context);
    assert.equal(context[name].scrollTop, 0);
    assert.equal(context[name].behavior, 'instant');
    context[name].scrollTop = 950;
    vm.runInContext(`${handler}()`, context);
    assert.equal(context[name].scrollTop, 0);
  }
  assert.equal(scrolls.length, 0);
});

test('Technique Lab opens at its start and returning home starts at the top', () => {
  const { context, scrolls, node } = fixture();
  vm.runInContext('openTechniqueLab(); revealTechniqueInterface()', context);
  assert.equal(context.techniqueLabSection.scrollTop, 0);
  assert.equal(context.techniqueLabSection.entryOptions.block, 'start');
  assert.equal(context.techniqueLabSection.entryOptions.behavior, 'instant');
  vm.runInContext('closeTechniqueLab()', context);
  assert.equal(scrolls.at(-1).top, 0);
  assert.equal(node('#passport-monogram').focusOptions.preventScroll, true);
});

test('intro focus does not skip the welcome text to its bottom button', () => {
  const { context } = fixture();
  vm.runInContext('showMemberIntro()', context);
  assert.equal(context.memberIntro.scrollTop, 0);
  assert.equal(context.memberIntroEnter.focusOptions.preventScroll, true);
});

test('access state changes reset scroll but repeated passport updates do not', () => {
  const { context, scrolls } = fixture();
  Object.assign(context, { states: { pin: screen(), passport: screen() }, gatedContent: [screen()], updateHeroCopy() {}, accessSeal: screen(), accessLabel: screen() });
  context.states.pin.hidden = false;
  install(context, member, ['showState']);
  vm.runInContext("showState('passport', 'Access granted')", context);
  assert.equal(scrolls.length, 1);
  vm.runInContext("showState('passport', 'Access granted')", context);
  assert.equal(scrolls.length, 1);
});

test('passport refresh does not reopen an already-open Door or interrupt Workshop', () => {
  const { context } = fixture();
  let opens = 0;
  Object.assign(context, { currentDoorAccess: {}, doorRoom: screen(), showDoorRoom() { opens++; context.doorRoom.hidden = false; }, closeDoorRoom() { throw new Error('Unexpected close'); } });
  install(context, member, ['handleDoorRoute']);
  vm.runInContext('handleDoorRoute(); handleDoorRoute()', context);
  assert.equal(opens, 1);
});

test('Mission Desk tabs start at the top and section routes retain their destination', { skip: !admin }, () => {
  const { context, scrolls } = fixture();
  const tab = { dataset: { workspace: 'community' }, classList: { toggle() {} }, setAttribute() {} };
  const page = { dataset: { workspacePage: 'community' }, classList: { toggle() {} }, contains: () => true };
  const section = screen();
  Object.assign(context, { workspaceTabs: [tab], adminToken: '', history: { replaceState() {} } });
  context.document.querySelectorAll = () => [page];
  context.document.getElementById = () => section;
  install(context, admin, ['activateWorkspace', 'activateWorkspaceForCurrentHash']);
  vm.runInContext("activateWorkspace('community')", context);
  assert.equal(scrolls.at(-1).top, 0);
  context.window.location.hash = '#door-mode-station';
  vm.runInContext('activateWorkspaceForCurrentHash()', context);
  assert.equal(section.entryOptions.block, 'start');
});
