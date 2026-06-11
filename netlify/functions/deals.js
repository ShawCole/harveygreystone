const { authed, unauthorized } = require('./_auth');
const { ensureSchema, readAll, writeAll } = require('./_db');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (!authed(event)) return unauthorized();

  try {
    await ensureSchema();

    if (event.httpMethod === 'GET') {
      const data = await readAll();
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); }
      catch { return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'bad json' }) }; }
      await writeAll({
        deals: body.deals || [],
        tasks: body.tasks || [],
        contacts: body.contacts || [],
        investors: body.investors, // undefined => preserved (older clients won't wipe it)
      });
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  } catch (err) {
    console.error('deals error:', err);
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: 'server error' }) };
  }
};
