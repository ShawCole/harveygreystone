const { authed, unauthorized } = require('./_auth');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// AI underwriting is deferred until an Anthropic API key is provisioned.
// When ANTHROPIC_API_KEY is present this will call claude-opus-4-8 via the
// official SDK; until then it returns a clean, frontend-friendly message.
exports.handler = async (event) => {
  if (!authed(event)) return unauthorized();
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  }
  return {
    statusCode: 503,
    headers: JSON_HEADERS,
    body: JSON.stringify({ error: 'AI underwriting is not yet configured. Add an Anthropic API key to enable it.' }),
  };
};
