// Public: the client signs the NCNDA on their portal (token-gated).
const { ensureSchema, findDealByToken, saveDeal } = require('./_db');
const { ensureNcnda, makeSignature, tryFinalize } = require('./_ncnda');

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const clientIp = (e) => (e.headers['x-nf-client-connection-ip'] || (e.headers['x-forwarded-for'] || '').split(',')[0] || '').trim();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  }
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'bad json' }) }; }
  const { token, name, title, email, agree } = body;
  if (!token) return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'token required' }) };
  if (!name || !agree) return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'name and agreement consent required' }) };
  try {
    await ensureSchema();
    const deal = await findDealByToken(token);
    if (!deal) return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid or expired link' }) };
    const ncnda = ensureNcnda(deal.payload);
    if (ncnda.signatures.some((s) => s.party === 'client')) {
      return { statusCode: 409, headers: JSON_HEADERS, body: JSON.stringify({ error: 'this agreement has already been signed by the client' }) };
    }
    ncnda.signatures.push(makeSignature({ party: 'client', name, title, email, ip: clientIp(event) }));
    if (email && !deal.payload.clientEmail) deal.payload.clientEmail = email;
    tryFinalize(ncnda);
    await saveDeal(deal.id, deal.payload);
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true, status: ncnda.status, certificateId: ncnda.certificateId || null }) };
  } catch (err) {
    console.error('portal-sign error:', err);
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server error' }) };
  }
};
