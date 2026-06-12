const { authed, unauthorized } = require('./_auth');
const Anthropic = require('@anthropic-ai/sdk');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Model + generation settings for the first-pass underwriting memo.
const MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 32000; // memos run long (≈15 sections); streaming avoids HTTP timeouts.

// Reinforce the exact output contract the frontend parses: a single JSON object
// on line 1 (no markdown fences), then the full memo. The detailed instructions
// and document text arrive in the user prompt built by the client.
const SYSTEM = `You are a meticulous, skeptical capital-markets underwriter performing a rigorous first-pass screening for a capital-raising firm. A licensed broker signs off after you. Be specific, quantitative, and conservative — never fabricate figures; write "NOT PROVIDED" where data is missing.

Output format is strict: the VERY FIRST line of your response must be the single-line JSON object the user specifies (raw JSON, no markdown, no code fences, no leading text). After that JSON line, write the full underwriter memo. Do not wrap the JSON in backticks.`;

let client = null;
function getClient() {
  if (!client) client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  return client;
}

exports.handler = async (event) => {
  if (!authed(event)) return unauthorized();
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { statusCode: 503, headers: JSON_HEADERS, body: JSON.stringify({ error: 'AI underwriting is not configured (no API key).' }) };
  }

  let prompt;
  try { ({ prompt } = JSON.parse(event.body || '{}')); }
  catch { return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'bad json' }) }; }

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'prompt required' }) };
  }

  try {
    // Stream internally (long output) and assemble the full text. The client
    // consumes a single buffered { result } response; Cloud Run's request
    // timeout (600s) comfortably covers a full memo.
    const stream = getClient().messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') {
      return { statusCode: 422, headers: JSON_HEADERS, body: JSON.stringify({ error: 'The model declined to analyze these documents.' }) };
    }

    const result = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
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
