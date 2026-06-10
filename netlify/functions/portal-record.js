// Public: record a completed client upload on the deal (token-gated).
const { ensureSchema, findDealByToken, saveDeal } = require('./_db');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  }
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'bad json' }) }; }
  const { token, path, filename, size } = body;
  if (!token || !path || !filename) return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'token, path, filename required' }) };
  try {
    await ensureSchema();
    const deal = await findDealByToken(token);
    if (!deal) return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid or expired link' }) };
    // path must belong to this deal's client-uploads namespace
    if (!String(path).startsWith(`deals/${deal.id}/client-uploads/`)) {
      return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid path' }) };
    }
    const signed = (deal.payload.ncnda && (deal.payload.ncnda.signatures || []).some((s) => s.party === 'client'));
    if (!signed) return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'NCNDA not signed' }) };
    if (!Array.isArray(deal.payload.clientUploads)) deal.payload.clientUploads = [];
    deal.payload.clientUploads.push({ path, filename: String(filename).slice(0, 200), size: Number(size) || 0, uploadedAt: new Date().toISOString() });
    await saveDeal(deal.id, deal.payload);
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('portal-record error:', err);
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server error' }) };
  }
};
