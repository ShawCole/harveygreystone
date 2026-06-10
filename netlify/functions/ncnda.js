// Internal (auth-gated) NCNDA management for a deal:
//   GET  ?dealId=  -> ensure a client-portal token exists; return state + portal URL
//   POST {dealId, name, title, email}  -> add an internal-team signature
const { authed, unauthorized } = require('./_auth');
const { ensureSchema, getDeal, saveDeal } = require('./_db');
const { ensureNcnda, makeSignature, tryFinalize } = require('./_ncnda');

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const clientIp = (e) => (e.headers['x-nf-client-connection-ip'] || (e.headers['x-forwarded-for'] || '').split(',')[0] || '').trim();
const portalUrl = (e, token) => `https://${e.headers.host}/portal.html?t=${token}`;

exports.handler = async (event) => {
  if (!authed(event)) return unauthorized();
  try {
    await ensureSchema();

    if (event.httpMethod === 'GET') {
      const dealId = Number(event.queryStringParameters && event.queryStringParameters.dealId);
      const payload = await getDeal(dealId);
      if (!payload) return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'deal not found' }) };
      ensureNcnda(payload);
      await saveDeal(dealId, payload);
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ncnda: payload.ncnda, portalUrl: portalUrl(event, payload.ncnda.token), clientUploads: payload.clientUploads || [] }) };
    }

    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'bad json' }) }; }
      const dealId = Number(body.dealId);
      if (!body.name) return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'name required' }) };
      const payload = await getDeal(dealId);
      if (!payload) return { statusCode: 404, headers: JSON_HEADERS, body: JSON.stringify({ error: 'deal not found' }) };
      const ncnda = ensureNcnda(payload);
      ncnda.signatures.push(makeSignature({ party: 'internal', name: body.name, title: body.title, email: body.email, ip: clientIp(event) }));
      tryFinalize(ncnda);
      await saveDeal(dealId, payload);
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ncnda, portalUrl: portalUrl(event, ncnda.token) }) };
    }

    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  } catch (err) {
    console.error('ncnda error:', err);
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server error' }) };
  }
};
