// Public: issue a signed PUT URL for a client upload — ONLY if the client has
// signed the NCNDA. This is the hard gate on the client side.
const { ensureSchema, findDealByToken } = require('./_db');
const { signedPutUrl } = require('./_gcs');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  }
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'bad json' }) }; }
  const { token, filename, contentType, docId } = body;
  if (!token || !filename) return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'token and filename required' }) };
  try {
    await ensureSchema();
    const deal = await findDealByToken(token);
    if (!deal) return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid or expired link' }) };
    const signed = (deal.payload.ncnda && (deal.payload.ncnda.signatures || []).some((s) => s.party === 'client'));
    if (!signed) return { statusCode: 403, headers: JSON_HEADERS, body: JSON.stringify({ error: 'You must sign the NCNDA before uploading documents.' }) };
    const safe = String(filename).replace(/[^\w.\- ]+/g, '_').slice(0, 200);
    const safeDocId = docId ? String(docId).replace(/[^\w.\-]+/g, '_').slice(0, 100) : null;
    const path = safeDocId
      ? `deals/${deal.id}/intake/${safeDocId}/${Date.now()}_${safe}`
      : `deals/${deal.id}/client-uploads/${Date.now()}_${safe}`;
    const url = await signedPutUrl(path, contentType);
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ url, path }) };
  } catch (err) {
    console.error('portal-upload-url error:', err);
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server error' }) };
  }
};
