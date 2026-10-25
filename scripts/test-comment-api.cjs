const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function client(fetch, timer = setTimeout) {
  const context = { window: {}, fetch, AbortController, setTimeout: timer, clearTimeout };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'comment-api.js'), 'utf8'), context);
  return context.window.CommentAPI;
}
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8' }
});

for (const [name, response] of [
  ['HTML 404', () => new Response('<h1>Not found</h1>', { status: 404 })],
  ['static PHP source', () => new Response('<?php database();', { headers: { 'Content-Type': 'text/plain' } })],
  ['malformed JSON', () => new Response('<br>PHP warning', { headers: { 'Content-Type': 'application/json' } })],
  ['missing database', () => json({ error: 'SQLSTATE connection details' }, 503)],
  ['empty JSON object', () => json({})],
  ['JSON null', () => json(null)],
  ['JSON array', () => json([])],
  ['empty response', () => new Response(null, { status: 204 })],
  ['network failure', () => { throw new TypeError('Failed to fetch'); }]
]) {
  test(name + ' becomes a safe unavailable error', async () => {
    const api = client(async () => response());
    await assert.rejects(api.request('/api/comments.php'), error =>
      error.serviceUnavailable === true && error.message === api.unavailableMessage);
  });
}

test('valid client errors remain actionable', async () => {
  const api = client(async () => json({ error: 'That username is already taken.' }, 409));
  await assert.rejects(api.request('/api/comments.php'), { message: 'That username is already taken.' });
});

test('successful account state is not confused with an outage', async () => {
  const api = client(async () => json({ signed_in: false }));
  const result = await api.request('/api/comments.php?account=1');
  assert.equal(result.signed_in, false);
});

test('unexpected successful response shape is unavailable', async () => {
  const api = client(async () => json({ unexpected: true }));
  await assert.rejects(api.request('/api/comments.php', {}, value => typeof value.signed_in === 'boolean'),
    error => error.serviceUnavailable === true);
});

test('writes are never automatically retried', async () => {
  let calls = 0;
  const api = client(async (url, options) => {
    calls++;
    assert.equal(options.method, 'POST');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.body, '{"action":"account_create"}');
    throw new Error('Connection lost');
  });
  await assert.rejects(api.request('/api/comments.php', { method: 'POST', body: '{"action":"account_create"}' }));
  assert.equal(calls, 1);
});

test('hanging requests time out', async () => {
  const api = client((url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('Aborted')));
  }), callback => setTimeout(callback, 1));
  await assert.rejects(api.request('/api/comments.php'), error => error.serviceUnavailable === true);
});

function fakeDOM() {
  const nodes = new Map();
  function element() {
    const children = new Map();
    return {
      hidden: true, disabled: false, textContent: '', value: '', events: {}, dataset: { commentSlug: 'example' },
      classList: { toggle() {} }, style: { setProperty() {} },
      elements: { namedItem: name => get('input:' + name) },
      querySelector: selector => {
        if (!children.has(selector)) children.set(selector, element());
        return children.get(selector);
      },
      querySelectorAll: () => [],
      addEventListener(event, handler) { this.events[event] = handler; },
      append() {}, after() {}, contains() { return true; }, replaceChildren() { this.textContent = ''; }, setAttribute() {},
      scrollIntoView() {}, reset() {}
    };
  }
  function get(selector) {
    if (!nodes.has(selector)) nodes.set(selector, element());
    return nodes.get(selector);
  }
  const page = element();
  page.querySelector = get;
  return { get, page, document: { querySelector: () => page, createElement: element } };
}

test('account outage hides account actions, offers retry, and recovers without clearing data', async () => {
  const dom = fakeDOM();
  let online = false;
  const api = client(async () => online ? json({ signed_in: false }) : new Response('<html>offline</html>'));
  const context = {
    document: dom.document, CommentAPI: api,
    window: { location: { hash: '' }, addEventListener() {} }, setTimeout, clearTimeout,
    localStorage: { clear() { assert.fail('must not clear saved data'); }, removeItem() { assert.fail('must not remove saved data'); } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'account.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(dom.get('.account-loading').textContent, api.unavailableMessage);
  assert.equal(dom.get('.account-auth').hidden, true);
  assert.equal(dom.get('.account-dashboard').hidden, true);
  assert.equal(dom.get('.account-retry').hidden, false);
  online = true;
  await dom.get('.account-retry').events.click();
  assert.equal(dom.get('.account-auth').hidden, false);
  assert.equal(dom.get('.account-dashboard').hidden, true);
  assert.equal(dom.get('.account-loading').hidden, true);
  assert.equal(dom.get('.account-retry').hidden, true);
});

test('profile outage has a retry and does not claim the profile was deleted', async () => {
  const dom = fakeDOM();
  let online = false;
  const api = client(async () => online
    ? json({ username: 'Example', created_at: '2026-01-01', avatar_seed: '123456789abcdef123', comment_count: 0, comments: [], has_more: false })
    : json({ error: 'SQL connection error' }, 503));
  vm.runInNewContext(fs.readFileSync(path.join(root, 'profile.js'), 'utf8'), {
    document: dom.document, CommentAPI: api, URLSearchParams,
    window: { location: { search: '?u=Example' } }
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(dom.get('.profile-status').textContent, api.unavailableMessage);
  assert.equal(dom.get('.profile-retry').hidden, false);
  assert.equal(dom.get('.profile-more').hidden, true);
  online = true;
  await dom.get('.profile-retry').events.click();
  assert.equal(dom.get('.profile-name').textContent, 'Example');
  assert.equal(dom.get('.profile-status').textContent, '');
  assert.equal(dom.get('.profile-retry').hidden, true);
});

test('blog account card does not render an outage as signed out', async () => {
  const dom = fakeDOM();
  const api = client(async () => new Response('Not found', { status: 404 }));
  vm.runInNewContext(fs.readFileSync(path.join(root, 'blog-account.js'), 'utf8'), {
    document: dom.document, CommentAPI: api, window: { addEventListener() {} }
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(dom.get('.blog-account-loading').textContent, api.unavailableMessage);
  assert.equal(dom.get('.blog-account-loading').hidden, false);
  assert.equal(dom.get('.blog-account-guest').hidden, true);
  assert.equal(dom.get('.blog-account-member').hidden, true);
});

test('comment outage disables posting and does not present anonymous account state', async () => {
  const dom = fakeDOM();
  const api = client(async () => new Response('<html>Not found</html>', { status: 404 }));
  vm.runInNewContext(fs.readFileSync(path.join(root, 'comments.js'), 'utf8'), {
    document: dom.document, CommentAPI: api, URLSearchParams,
    MutationObserver: class { observe() {} },
    window: { addEventListener() {} }, setTimeout, clearTimeout
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(dom.get('.comments-list').textContent, api.unavailableMessage);
  assert.equal(dom.get('.comments-form').querySelector('button[type="submit"]').disabled, true);
  assert.equal(dom.get('.comment-account-guest').hidden, true);
  assert.equal(dom.get('.comment-account-member').hidden, true);
  assert.equal(dom.get('.comments-form').querySelector('.comment-identity').textContent, 'Account status unavailable.');
});
