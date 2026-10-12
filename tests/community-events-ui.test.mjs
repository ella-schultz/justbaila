import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../community-events.js', import.meta.url), 'utf8');
const english = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const spanish = readFileSync(new URL('../index-es.html', import.meta.url), 'utf8');
const fields = ['kicker', 'title', 'description', 'nextTitle', 'nextDescription', 'outreachTitle', 'outreachDescription', 'buttonLabel'];

function fixture(language = 'en') {
  const nodes = new Map();
  const node = selector => {
    const key = selector.replaceAll("'", '"');
    if (!nodes.has(key)) nodes.set(key, { textContent: 'Static fallback', href: 'https://calendar.google.com', removeAttribute(name) { delete this[name]; } });
    return nodes.get(key);
  };
  const context = vm.createContext({ URL, document: { documentElement: { lang: language } }, communityEventsSection: { querySelector: node } });
  vm.runInContext(source.slice(source.indexOf('function renderCommunityEventsContent')), context);
  const content = { en: Object.fromEntries(fields.map(field => [field, `English ${field}`])), es: Object.fromEntries(fields.map(field => [field, `Español ${field}`])), calendarUrl: 'https://calendar.google.com/calendar/' };
  return { context, node, content };
}

test('both main pages expose matching content hooks and retain static fallback text', () => {
  for (const html of [english, spanish]) {
    for (const field of fields) assert.equal(html.split(`data-community-field="${field}"`).length - 1, 1);
    assert.match(html, /community-events\.js/);
    assert.match(html, /Uptown Lounge/);
  }
});

test('community copy is language-specific plain text and optional blocks can be hidden', () => {
  for (const language of ['en', 'es']) {
    const { context, node, content } = fixture(language);
    content[language].title = '<img src=x onerror=alert(1)>';
    content[language].nextTitle = '';
    content[language].nextDescription = '';
    content[language].buttonLabel = '';
    context.content = content;
    vm.runInContext('renderCommunityEventsContent(content)', context);
    assert.equal(node('[data-community-field="title"]').textContent, content[language].title);
    assert.equal(node('[data-community-field="description"]').textContent, content[language].description);
    assert.equal(node('[data-community-block="next"]').hidden, true);
    assert.equal(node('[data-community-field="buttonLabel"]').hidden, true);
    assert.equal(node('[data-community-field="buttonLabel"]').href, undefined);
  }
});

test('malformed content and unsafe URLs leave the entire static section intact', () => {
  for (const calendarUrl of ['javascript:alert(1)', 'https://user:password@example.com', 'not a URL']) {
    const { context, node, content } = fixture();
    context.content = { ...content, calendarUrl };
    vm.runInContext('renderCommunityEventsContent(content)', context);
    assert.equal(node('[data-community-field="title"]').textContent, 'Static fallback');
  }
  const { context, node } = fixture();
  vm.runInContext('renderCommunityEventsContent({ en: {} })', context);
  assert.equal(node('[data-community-field="title"]').textContent, 'Static fallback');
});
