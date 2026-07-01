// NOTE: Requires aiplatform.googleapis.com API enabled on GCP project dataroom-500817
const { authed, unauthorized } = require('./_auth');
const { VertexAI } = require('@google-cloud/vertexai');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT_ID || 'dataroom-500817';
const LOCATION = 'us-central1';
const MODEL = 'gemini-2.5-flash';

// Reinforce the exact output contract the frontend parses: a single JSON object
// on line 1 (no markdown fences), then the full memo. The detailed instructions
// and document text arrive in the user prompt built by the client.
const SYSTEM = `You are a meticulous, skeptical capital-markets underwriter performing a rigorous first-pass screening for a capital-raising firm. A licensed broker signs off after you. Be specific, quantitative, and conservative — never fabricate figures; write "NOT PROVIDED" where data is missing.

Output format is strict: the VERY FIRST line of your response must be the single-line JSON object the user specifies (raw JSON, no markdown, no code fences, no leading text). After that JSON line, write the full underwriter memo. Do not wrap the JSON in backticks.`;

let vertexAI = null;
function getModel() {
  if (!vertexAI) vertexAI = new VertexAI({ project: PROJECT, location: LOCATION });
  return vertexAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: { parts: [{ text: SYSTEM }] },
  });
}

exports.handler = async (event) => {
  if (!authed(event)) return unauthorized();
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  }

  let prompt;
  try { ({ prompt } = JSON.parse(event.body || '{}')); }
  catch { return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'bad json' }) }; }

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'prompt required' }) };
  }

  try {
    const model = getModel();
    const genResult = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const result = genResult.response.candidates[0].content.parts
      .map(p => p.text)
      .join('')
      .trim();

    if (!result) {
      return { statusCode: 502, headers: JSON_HEADERS, body: JSON.stringify({ error: 'empty analysis returned' }) };
    }

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ result }) };
  } catch (err) {
    console.error('underwrite error:', err && err.message ? err.message : err);
    const status = err && err.status === 429 ? 429 : 500;
    return { statusCode: status, headers: JSON_HEADERS, body: JSON.stringify({ error: 'underwriting failed; please retry' }) };
  }
};
