const { resolveBrand, getBrand } = require('./_brands');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  }
  const override = event.queryStringParameters && event.queryStringParameters.b;
  const key = resolveBrand(event.headers && event.headers.host, override);
  return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(getBrand(key)) };
};
