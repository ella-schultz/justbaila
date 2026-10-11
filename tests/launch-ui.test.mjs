import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const member = readFileSync(new URL('../tap/app.js', import.meta.url), 'utf8');
const adminPath = new URL('../admin-local/admin.js', import.meta.url);
const admin = existsSync(adminPath) ? readFileSync(adminPath, 'utf8') : null;
const deniedStorage = { getItem() { throw new Error('Storage blocked'); }, setItem() { throw new Error('Storage blocked'); } };

test('member startup works when browser storage is blocked', () => {
  const context = vm.createContext({ window: { location: { search: '' }, localStorage: deniedStorage }, URLSearchParams });
  vm.runInContext(member.slice(0, member.indexOf('let currentUndergroundLevel')), context);
  assert.equal(vm.runInContext('accessToken', context), '');
});

test('successful PIN login opens the passport even when storage cannot be saved', async () => {
  let opened = false;
  const button = {};
  const message = {};
  const context = vm.createContext({
    window: { localStorage: deniedStorage }, API_BASE_URL: 'https://example.invalid', cardId: 'BBBBBBBBBBBB', accessTokenKey: 'test', accessToken: '',
    transitionToPassport: async () => { opened = true; },
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ accessToken: 'test-only', passport: {} }) }),
    message, form: { querySelector: () => button, reset() {} }
  });
  vm.runInContext(member.slice(member.indexOf('async function submitPinRequest('), member.indexOf('async function requestPinReset(')), context);
  await vm.runInContext("submitPinRequest('/test','1234',message,form)", context);
  assert.equal(opened, true);
  assert.equal(button.disabled, false);
  assert.equal(message.textContent, '');
});

test('database UTC timestamps display the same as equivalent ISO timestamps', () => {
  for (const source of [member, admin].filter(Boolean)) {
    const handler = source.match(/function formatDateTime\(value\) \{[\s\S]*?\n\}/)[0];
    const context = vm.createContext({ Intl, Date });
    vm.runInContext(handler, context);
    assert.equal(vm.runInContext("formatDateTime('2026-10-11 20:00:00')", context), vm.runInContext("formatDateTime('2026-10-11T20:00:00Z')", context));
    assert.doesNotThrow(() => vm.runInContext("formatDateTime('invalid')", context));
  }
});

test('Mission Desk sends local event times with a timezone', { skip: !admin }, () => {
  const context = vm.createContext({ Date });
  vm.runInContext(admin.match(/function localDateTimeToIso\(value\) \{[\s\S]*?\n\}/)[0], context);
  assert.equal(vm.runInContext("localDateTimeToIso('2026-10-11T19:00')", context), new Date('2026-10-11T19:00').toISOString());
  assert.match(admin, /startsAt: localDateTimeToIso\(data.get\("startsAt"\)\)/);
});
