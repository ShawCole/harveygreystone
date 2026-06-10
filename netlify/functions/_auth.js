// Stateless signed-cookie session. Token = base64url(payload).hmacSHA256(payload).
const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || 'insecure-dev-secret';
const COOKIE = 'hgc_session';
const TTL_MS = 12 * 60 * 60 * 1000; // 12h

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verifyToken(token) {
  if (!token || token.indexOf('.') === -1) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString()); }
  catch { return null; }
  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

function getCookie(event, name) {
  const header = (event.headers && (event.headers.cookie || event.headers.Cookie)) || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

// Build a Set-Cookie header value for a fresh session.
function sessionCookie() {
  const token = sign({ exp: Date.now() + TTL_MS });
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${TTL_MS / 1000}`;
}

// Returns the session payload if the request carries a valid cookie, else null.
function authed(event) {
  return verifyToken(getCookie(event, COOKIE));
}

// Standard 401 response.
function unauthorized() {
  return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'unauthorized' }) };
}

module.exports = { sessionCookie, authed, unauthorized, COOKIE };
