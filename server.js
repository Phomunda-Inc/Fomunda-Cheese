import { createServer as createHttpServer } from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import proxyAddress from 'proxy-addr';

const root = new URL('./', import.meta.url);
const sessionDuration = 60 * 60 * 1000;
const attemptWindow = 15 * 60 * 1000;
const cookieName = 'phomunda_session';
const hash = (value) => createHash('sha256').update(value).digest();
const publicFiles = new Map([
  ['/', ['index.html', 'text/html']],
  ['/index.html', ['index.html', 'text/html']],
  ['/styles.css', ['styles.css', 'text/css']],
  ['/app.js', ['app.js', 'text/javascript']],
  ['/admin/styles.css', ['admin/styles.css', 'text/css']],
]);

export function createApp({
  username,
  password,
  flag,
  publicOrigin,
  production = false,
  trustedProxies = [],
}) {
  if (
    typeof username !== 'string' ||
    username.length === 0 ||
    username.length > 120 ||
    username === 'replace-with-your-admin-username'
  ) {
    throw new Error('ADMIN_USERNAME must be configured with a username of 1-120 characters.');
  }
  if (!password || password.length < 16 || password === 'replace-with-a-long-unique-password') {
    throw new Error('ADMIN_PASSWORD must be a unique password of at least 16 characters.');
  }
  if (
    typeof flag !== 'string' ||
    !/^OP\{[A-Za-z0-9_-]{1,128}\}$/.test(flag) ||
    flag.includes('--') ||
    flag.slice(3, -1) === 'replace-with-your-challenge-flag'
  ) {
    throw new Error(
      'CTF_FLAG must contain the configured challenge flag: prefix OP followed by braces enclosing 1-128 letters, digits, underscores, or single hyphens.',
    );
  }
  const origin = new URL(publicOrigin);
  if (!['http:', 'https:'].includes(origin.protocol) || publicOrigin !== origin.origin) {
    throw new Error('PUBLIC_ORIGIN must be an HTTP(S) origin without a trailing slash or path.');
  }
  if (production && origin.protocol !== 'https:') {
    throw new Error('Production requires an HTTPS PUBLIC_ORIGIN.');
  }
  let trustProxy;
  try {
    if (!Array.isArray(trustedProxies)) throw new Error('Invalid proxy list.');
    trustProxy = proxyAddress.compile(trustedProxies);
  } catch {
    throw new Error(
      'TRUSTED_PROXIES must be a list of IP addresses, CIDR ranges, or proxy-addr names.',
    );
  }
  const secureCookie = origin.protocol === 'https:';
  const passwordHash = hash(password);
  const sessions = new Map();
  const attempts = new Map();

  function send(res, status, body = '', type = 'text/plain', headers = {}) {
    res.writeHead(status, {
      'Content-Type': `${type}; charset=utf-8`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      ...headers,
    });
    res.end(body);
  }

  function redirect(res, location) {
    send(res, 303, '', 'text/plain', { Location: location });
  }

  function cookie(res, id, maxAge = sessionDuration / 1000) {
    res.setHeader(
      'Set-Cookie',
      `${cookieName}=${id}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secureCookie ? '; Secure' : ''}`,
    );
  }

  function newSession(res, authenticated) {
    const id = randomBytes(32).toString('hex');
    const session = {
      authenticated,
      csrf: randomBytes(32).toString('hex'),
      expires: Date.now() + sessionDuration,
    };
    sessions.set(id, session);
    cookie(res, id);
    return session;
  }

  async function loginPage(res, session, status = 200, error = '') {
    const html = await readFile(new URL('admin/login.html', root), 'utf8');
    send(
      res,
      status,
      html.replace('{{csrf}}', session.csrf).replace('{{error}}', error),
      'text/html',
    );
  }

  async function formData(req) {
    if (req.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') {
      const error = new Error('Unsupported form content type.');
      error.status = 415;
      throw error;
    }
    if (Number(req.headers['content-length']) > 4096) {
      const error = new Error('Form data is too large.');
      error.status = 413;
      throw error;
    }
    let size = 0;
    const chunks = [];
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      size += chunk.length;
      if (size > 4096) {
        req.resume();
        const error = new Error('Form data is too large.');
        error.status = 413;
        throw error;
      }
      chunks.push(chunk);
    }
    return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
  }

  const server = createHttpServer(async (req, res) => {
    try {
      const now = Date.now();
      for (const [id, session] of sessions) {
        if (session.expires <= now) sessions.delete(id);
      }
      for (const [ip, attempt] of attempts) {
        if (attempt.expires <= now) attempts.delete(ip);
      }
      const path = new URL(req.url, origin).pathname;
      const id = req.headers.cookie
        ?.split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${cookieName}=`))
        ?.slice(cookieName.length + 1);
      const session = sessions.get(id);
      const authenticated = session?.authenticated === true;

      if (req.method === 'GET' || req.method === 'HEAD') {
        if (path === '/admin/login') {
          if (authenticated) return redirect(res, '/admin/');
          if (req.method === 'HEAD') return send(res, 200, '', 'text/html');
          if (!session && sessions.size >= 10000) return send(res, 503, 'Please try again later.');
          return await loginPage(res, session || newSession(res, false));
        }
        if (['/admin', '/admin/', '/admin/index.html'].includes(path)) {
          if (!authenticated) return redirect(res, '/admin/login');
          if (path === '/admin') return redirect(res, '/admin/');
          const html = await readFile(new URL('admin/index.html', root), 'utf8');
          const page = html.replace('{{csrf}}', session.csrf).replace('{{flag}}', () => flag);
          return send(res, 200, req.method === 'HEAD' ? '' : page, 'text/html');
        }
        const file = publicFiles.get(path);
        if (file) {
          const content = await readFile(new URL(file[0], root));
          return send(res, 200, req.method === 'HEAD' ? '' : content, file[1]);
        }
        return send(res, 404, 'Page not found.');
      }

      if (req.method !== 'POST' || !['/admin/login', '/admin/logout'].includes(path)) {
        return send(res, 405, 'Method not allowed.', 'text/plain', { Allow: 'GET, HEAD' });
      }
      if (!session || req.headers.origin !== origin.origin) {
        return send(
          res,
          403,
          'Your session expired or the request origin is invalid. Reload the login page.',
        );
      }
      const form = await formData(req);
      if (form.get('csrf') !== session.csrf) {
        return send(res, 403, 'Invalid form token. Reload the page and try again.');
      }
      if (path === '/admin/logout') {
        sessions.delete(id);
        cookie(res, '', 0);
        return redirect(res, '/admin/login');
      }

      const ip = proxyAddress(req, trustProxy);
      const attempt = attempts.get(ip) || { count: 0, expires: now + attemptWindow };
      if (attempt.count >= 5) {
        res.setHeader('Retry-After', String(Math.ceil((attempt.expires - now) / 1000)));
        return await loginPage(
          res,
          session,
          429,
          'Too many failed attempts. Wait 15 minutes before trying again.',
        );
      }
      if (
        form.get('username') !== username ||
        !timingSafeEqual(hash(form.get('password') || ''), passwordHash)
      ) {
        attempt.count += 1;
        attempts.set(ip, attempt);
        return await loginPage(res, session, 401, 'Incorrect username or password.');
      }
      attempts.delete(ip);
      sessions.delete(id);
      newSession(res, true);
      return redirect(res, '/admin/');
    } catch (error) {
      if (error.status === 413 || error.status === 415) {
        return send(res, error.status, error.message);
      }
      console.error('Request failed:', error);
      if (!res.headersSent) send(res, 500, 'An unexpected server error occurred.');
      else res.destroy();
    }
  });
  server.headersTimeout = 15000;
  server.requestTimeout = 15000;
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 3500);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be between 1 and 65535.');
  const publicOrigin = process.env.PUBLIC_ORIGIN || `http://127.0.0.1:${port}`;
  const server = createApp({
    username: process.env.ADMIN_USERNAME ?? 'admin',
    password: process.env.ADMIN_PASSWORD,
    flag: process.env.CTF_FLAG,
    publicOrigin,
    production: process.env.NODE_ENV === 'production',
    trustedProxies: process.env.TRUSTED_PROXIES
      ? process.env.TRUSTED_PROXIES.split(',').map((value) => value.trim())
      : [],
  });
  server.on('error', (error) => {
    console.error('Server failed:', error);
    process.exitCode = 1;
  });
  server.listen(port, host, () => console.log(`Phomunda Inc listening at ${publicOrigin}`));
}
