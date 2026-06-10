const { authed, unauthorized } = require('./_auth');
const { isValidPath, signedGetUrl } = require('./_gcs');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (!authed(event)) return unauthorized();
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  }
  const path = event.queryStringParameters && event.queryStringParameters.path;
  if (!isValidPath(path)) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'invalid path' }) };
  }
  try {
    const url = await signedGetUrl(path);
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ url }) };
  } catch (err) {
    console.error('download-url error:', err);
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server error' }) };
  }
};
