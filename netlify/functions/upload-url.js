const { authed, unauthorized } = require('./_auth');
const { objectPath, signedPutUrl } = require('./_gcs');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (!authed(event)) return unauthorized();
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  }
  let dealId, docId, filename, contentType;
  try { ({ dealId, docId, filename, contentType } = JSON.parse(event.body || '{}')); }
  catch { return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'bad json' }) }; }

  if (dealId == null || docId == null || !filename) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'dealId, docId, filename required' }) };
  }
  try {
    const path = objectPath(dealId, docId, filename);
    const url = await signedPutUrl(path, contentType);
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ url, path }) };
  } catch (err) {
    console.error('upload-url error:', err);
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server error' }) };
  }
};
