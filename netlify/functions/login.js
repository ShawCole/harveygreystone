const { sessionCookie } = require('./_auth');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  }
  let password;
  try { ({ password } = JSON.parse(event.body || '{}')); }
  catch { return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'bad request' }) }; }

  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server not configured' }) };
  }
  if (typeof password !== 'string' || password !== expected) {
    return { statusCode: 401, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, error: 'incorrect password' }) };
  }
  return {
    statusCode: 200,
    headers: { ...JSON_HEADERS, 'Set-Cookie': sessionCookie() },
    body: JSON.stringify({ ok: true }),
  };
};
