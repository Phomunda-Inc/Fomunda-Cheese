import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createApp } from './server.js';

const password = 'test-only-not-a-deployed-credential';
const flag = 'OP{test-only-dummy-flag}';

async function fixture(t, username = 'admin', options = {}) {
  // A fixed origin keeps CSRF validation independent of the ephemeral listening port.
  const origin = 'http://127.0.0.1:3500';
  const server = createApp({ ...options, username, password, flag, publicOrigin: origin });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  );
  const url = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) =>
    fetch(`${url}${path}`, { redirect: 'manual', ...options });
  const login = await request('/admin/login');
  const html = await login.text();
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const csrf = html.match(/name="csrf" value="([a-f0-9]+)"/)[1];
  const submit = (values = {}, headers = {}) =>
    request('/admin/login', {
      method: 'POST',
      headers: { Cookie: cookie, Origin: origin, ...headers },
      body: new URLSearchParams({ csrf, username, password, ...values }),
    });
  return { request, submit, cookie, csrf, origin, login, loginHtml: html };
}

test('protected routes redirect and private files are not exposed', async (t) => {
  const { request, login, loginHtml } = await fixture(t);
  assert.equal(login.status, 200);
  assert.ok(!loginHtml.includes(flag));
  assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  for (const path of ['/admin', '/admin/', '/admin/index.html']) {
    const response = await request(path);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), '/admin/login');
    assert.ok(!(await response.text()).includes(flag));
  }
  for (const path of [
    '/.env',
    '/server.js',
    '/admin/login.html',
    '/README.md',
    '/.git/config',
    '/package-lock.json',
    '/node_modules/proxy-addr/index.js',
    '/.local/history-report.json',
    '/.local/public-original.bundle',
  ]) {
    assert.equal((await request(path)).status, 404, path);
  }
  for (const path of ['/', '/styles.css', '/app.js', '/admin/styles.css']) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.ok(!(await response.text()).includes(flag), path);
  }
  assert.equal((await request('/admin/', { method: 'HEAD' })).status, 303);
});

test('login rotates the session, exposes the admin page, and logout invalidates it', async (t) => {
  const { request, submit, cookie, origin } = await fixture(t);
  const response = await submit();
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/admin/');
  const authenticatedCookie = response.headers.get('set-cookie').split(';')[0];
  assert.notEqual(authenticatedCookie, cookie);
  assert.equal((await request('/admin/', { headers: { Cookie: cookie } })).status, 303);
  for (const path of ['/admin/', '/admin/index.html']) {
    const page = await request(path, { headers: { Cookie: authenticatedCookie } });
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('cache-control'), 'no-store');
    const html = await page.text();
    assert.ok(html.includes(`<code class="flag-value">${flag}</code>`));
    assert.equal(html.split(flag).length - 1, 1);
    assert.ok(html.replace(/<!--[\s\S]*?-->/g, '').includes(flag));
    assert.doesNotMatch(html, /{{csrf}}/);
    assert.doesNotMatch(html, /{{flag}}/);
    assert.doesNotMatch(html, new RegExp(password));
  }
  const page = await request('/admin/', { headers: { Cookie: authenticatedCookie } });
  const csrf = (await page.text()).match(/name="csrf" value="([a-f0-9]+)"/)[1];
  assert.equal(
    (await request('/admin/login', { headers: { Cookie: authenticatedCookie } })).status,
    303,
  );
  const invalidLogout = await request('/admin/logout', {
    method: 'POST',
    headers: { Cookie: authenticatedCookie, Origin: origin },
    body: new URLSearchParams({ csrf: 'invalid' }),
  });
  assert.equal(invalidLogout.status, 403);
  const logout = await request('/admin/logout', {
    method: 'POST',
    headers: { Cookie: authenticatedCookie, Origin: origin },
    body: new URLSearchParams({ csrf }),
  });
  assert.equal(logout.status, 303);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  const denied = await request('/admin/', { headers: { Cookie: authenticatedCookie } });
  assert.equal(denied.status, 303);
  assert.ok(!(await denied.text()).includes(flag));
});

test('bad credentials, forged requests, and oversized forms are rejected', async (t) => {
  const { submit, request, origin, cookie } = await fixture(t);
  assert.equal((await submit({ csrf: 'wrong' })).status, 403);
  assert.equal((await submit({}, { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await submit({}, { Cookie: '' })).status, 403);
  const wrongPassword = await submit({ password: 'wrong-password' });
  assert.equal(wrongPassword.status, 401);
  assert.match(await wrongPassword.text(), /Incorrect username or password/);
  assert.equal((await submit({ username: 'not-admin' })).status, 401);
  assert.equal((await submit({ password: 'x'.repeat(5000) })).status, 413);
  assert.equal(
    (
      await request('/admin/login', {
        method: 'POST',
        headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
        body: '{}',
      })
    ).status,
    415,
  );
  assert.equal((await request('/admin/', { method: 'POST' })).status, 405);
  const chunked = await request('/admin/login', {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: origin,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: (async function* () {
      yield 'password=' + 'x'.repeat(5000);
    })(),
    duplex: 'half',
  });
  assert.equal(chunked.status, 413);
});

test('configured admin username is used for login', async (t) => {
  const { submit } = await fixture(t, 'challenge-admin');
  assert.equal((await submit({ username: 'admin' })).status, 401);
  assert.equal((await submit()).status, 303);
});

test('five failed attempts trigger a cooldown even for the correct password', async (t) => {
  const { submit } = await fixture(t);
  for (let count = 0; count < 5; count += 1) {
    assert.equal((await submit({ password: 'wrong' })).status, 401);
  }
  const response = await submit();
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get('retry-after')) > 0);
  assert.match(await response.text(), /Too many failed attempts/);
});

test('forwarded headers cannot bypass cooldowns without a trusted peer', async (t) => {
  for (const trustedProxies of [[], ['192.0.2.10']]) {
    const { submit } = await fixture(t, 'admin', { trustedProxies });
    for (let count = 0; count < 5; count += 1) {
      assert.equal(
        (await submit({ password: 'wrong' }, { 'X-Forwarded-For': '203.0.113.10' })).status,
        401,
      );
    }
    assert.equal((await submit({}, { 'X-Forwarded-For': '203.0.113.11' })).status, 429);
  }
});

test('trusted proxies isolate player cooldowns and ignore spoofed leftmost addresses', async (t) => {
  const { submit } = await fixture(t, 'admin', { trustedProxies: ['loopback'] });
  for (let count = 0; count < 5; count += 1) {
    assert.equal(
      (
        await submit(
          { password: 'wrong' },
          {
            'X-Forwarded-For': '198.51.100.1, 203.0.113.10',
          },
        )
      ).status,
      401,
    );
  }
  assert.equal(
    (
      await submit(
        {},
        {
          'X-Forwarded-For': '198.51.100.2, 203.0.113.10',
        },
      )
    ).status,
    429,
  );
  assert.equal((await submit({}, { 'X-Forwarded-For': '203.0.113.11' })).status, 303);
});

test('invalid proxy trust configuration fails closed', () => {
  for (const trustedProxies of [true, 'loopback', ['not-an-address'], [null]]) {
    assert.throws(
      () =>
        createApp({
          username: 'admin',
          password,
          flag,
          publicOrigin: 'http://localhost:3500',
          trustedProxies,
        }),
      /TRUSTED_PROXIES/,
    );
  }
});

