// Public: receives questionnaire answers and emails them via ArkData SMTP
// (Gmail) to the QUESTIONNAIRE_TO recipients. No login — it's a client-facing
// intake form. Light anti-abuse: honeypot field + payload size cap.
const nodemailer = require('nodemailer');

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'method not allowed' }) };
  }
  if ((event.body || '').length > 200000) {
    return { statusCode: 413, headers: JSON_HEADERS, body: JSON.stringify({ error: 'payload too large' }) };
  }
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'bad json' }) }; }

  if (body.website) return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) }; // honeypot

  const { respondent, title, sections } = body;
  if (!Array.isArray(sections)) return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'sections required' }) };

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, QUESTIONNAIRE_TO } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !QUESTIONNAIRE_TO) {
    return { statusCode: 503, headers: JSON_HEADERS, body: JSON.stringify({ error: 'email not configured' }) };
  }

  // Build a readable HTML email from the submitted sections/answers.
  let html = `<div style="font-family:Arial,sans-serif;max-width:720px;">
    <h2 style="color:#0f172a;">${esc(title || 'Questionnaire response')}</h2>
    <p style="color:#475569;">Respondent: <strong>${esc(respondent || 'Not provided')}</strong> · Submitted ${esc(new Date().toISOString())}</p>`;
  for (const sec of sections) {
    const answered = (sec.items || []).filter((it) => it.answer != null && String(it.answer).trim() !== '');
    if (!answered.length) continue;
    html += `<h3 style="color:#0284c7;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-top:24px;">${esc(sec.title)}</h3>`;
    for (const it of answered) {
      html += `<div style="margin:10px 0;"><div style="font-size:13px;color:#0f172a;font-weight:600;">${esc(it.label)}</div>
        <div style="font-size:14px;color:#0284c7;margin-top:2px;">${esc(it.answer)}</div></div>`;
    }
  }
  html += `</div>`;

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  try {
    await transporter.sendMail({
      from: `"HGC Deal Platform" <${SMTP_USER}>`,
      to: QUESTIONNAIRE_TO,
      replyTo: body.email || undefined,
      subject: `Questionnaire response — ${respondent || 'HGC & ARK'}`,
      html,
      text: JSON.stringify({ respondent, sections }, null, 2),
      attachments: [{ filename: 'questionnaire-response.json', content: JSON.stringify(body, null, 2) }],
    });
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('questionnaire-submit email error:', err.message);
    return { statusCode: 502, headers: JSON_HEADERS, body: JSON.stringify({ error: 'could not send email' }) };
  }
};
