// Public, token-gated client portal state. No session — the unguessable
// per-deal token IS the credential. Returns only non-sensitive deal info.
const { ensureSchema, findDealByToken } = require('./_db');
const { ensureNcnda, publicView } = require('./_ncnda');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  }
  const token = event.queryStringParameters && event.queryStringParameters.token;
  if (!token) return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'token required' }) };
  try {
    await ensureSchema();
    const deal = await findDealByToken(token);
    if (!deal) return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid or expired link' }) };
    ensureNcnda(deal.payload); // safe; token already matched
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(publicView(deal)) };
  } catch (err) {
    console.error('portal error:', err);
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server error' }) };
  }
};
