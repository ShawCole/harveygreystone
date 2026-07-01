const { authed, unauthorized } = require('./_auth');
const Anthropic = require('@anthropic-ai/sdk');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8000;

const SYSTEM = `You are a document classification assistant for a capital-raising data room. Given a list of uploaded files (with their extracted text) and a template of document categories, classify each file into the best matching category and extract any people/stakeholders mentioned.

Respond with ONLY a JSON array (no markdown, no code fences):
[
  {
    "filename": "original filename",
    "matchedSection": "section id (e.g. 01)",
    "matchedSectionName": "section name",
    "matchedSubfolderIndex": 0,
    "matchedDocIndex": 0,
    "matchedDocName": "matched document name",
    "confidence": 85,
    "reasoning": "brief explanation",
    "contacts": [
      { "name": "John Smith", "role": "CEO", "company": "Acme Corp", "email": "john@acme.com" }
    ]
  }
]

For contacts, extract any names, roles, titles, companies, emails, and phone numbers you find in the document text. Only include people who appear to be stakeholders (executives, board members, investors, lawyers, accountants — not random mentions).

If a file doesn't match any category well, set confidence below 30 and matchedDocName to "Uncategorized".`;

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

exports.handler = async (event) => {
  if (!authed(event)) return unauthorized();
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { statusCode: 503, headers: JSON_HEADERS, body: JSON.stringify({ error: 'AI classification unavailable (no API key).' }) };
  }

  let files, templateSections;
  try {
    ({ files, templateSections } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'bad json' }) };
  }

  if (!Array.isArray(files) || files.length === 0) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'files array required' }) };
  }
  if (!Array.isArray(templateSections) || templateSections.length === 0) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'templateSections required' }) };
  }

  // Build the user prompt
  const fileDescriptions = files.map((f, i) => {
    const textPreview = f.text ? f.text.substring(0, 3000) : '(no text extracted)';
    return `File ${i + 1}: "${f.filename}"\nText preview:\n${textPreview}`;
  }).join('\n\n---\n\n');

  const templateDescription = templateSections.map(sec => {
    const subs = sec.subfolders.map((sf, si) => {
      const docs = sf.documents.map((d, di) => `      [${si}.${di}] ${d.name}`).join('\n');
      return `    Subfolder: ${sf.name}\n${docs}`;
    }).join('\n');
    return `Section ${sec.id}: ${sec.name}\n${subs}`;
  }).join('\n\n');

  const userPrompt = `Here are ${files.length} uploaded files to classify:\n\n${fileDescriptions}\n\n---\n\nHere is the data room template with all document categories:\n\n${templateDescription}\n\nClassify each file into the best matching category and extract any stakeholder contacts found in the text.`;

  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const resultText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    if (!resultText) {
      return { statusCode: 502, headers: JSON_HEADERS, body: JSON.stringify({ error: 'empty classification returned' }) };
    }

    // Parse JSON — handle possible markdown fences just in case
    let classifications;
    try {
      const cleaned = resultText.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '');
      classifications = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('classify-docs JSON parse error:', parseErr.message, 'raw:', resultText.substring(0, 500));
      return { statusCode: 502, headers: JSON_HEADERS, body: JSON.stringify({ error: 'failed to parse AI response', raw: resultText.substring(0, 200) }) };
    }

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ classifications }) };
  } catch (err) {
    console.error('classify-docs error:', err && err.message ? err.message : err);
    const status = err && err.status === 429 ? 429 : 500;
    return { statusCode: status, headers: JSON_HEADERS, body: JSON.stringify({ error: 'classification failed; please retry' }) };
  }
};
