const { authed, unauthorized } = require('./_auth');
const { isValidPath, deleteObject } = require('./_gcs');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (!authed(event)) return unauthorized();
  if (event.httpMethod !== 'DELETE' && event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  }
  let path;
  try { ({ path } = JSON.parse(event.body || '{}')); }
  catch { return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'bad json' }) }; }

  if (!isValidPath(path)) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid path' }) };
  }
  try {
    await deleteObject(path);
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('file delete error:', err);
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server error' }) };
  }
};
