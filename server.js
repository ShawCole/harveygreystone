// Cloud Run entrypoint. Serves the static site (public/) and exposes every
// /api/<name> route by wrapping the existing Netlify-style function handlers
// (netlify/functions/<name>.js) — no handler rewrites. The handlers speak
// { httpMethod, headers, body, queryStringParameters } in and
// { statusCode, headers, body } out; the adapter below translates Express
// <-> that shape.
//
// On Cloud Run there is NO service-account key file: the container runs AS the
// hgc-netlify service account (workload identity), so all GCP clients use ADC
// from the metadata server. _bootstrap.js only materializes a key when
// GCP_SA_KEY is set, which it never is here.
const path = require('path');
const express = require('express');

const app = express();
app.disable('x-powered-by');

// Capture the raw request body as a string for every content type so handlers
// can JSON.parse(event.body) exactly as they did on Netlify. GET/DELETE with no
// body yield '' (handlers already guard with `|| '{}'`).
app.use(express.text({ type: () => true, limit: '30mb' }));

// The /api routes that map 1:1 to netlify/functions/<name>.js.
const ROUTES = [
  'login',
  'deals',
  'upload-url',
  'download-url',
  'file',
  'underwrite',
  'ncnda',
  'portal',
  'portal-sign',
  'portal-upload-url',
  'portal-record',
  'certificate',
  'questionnaire-submit',
  'classify-docs',
];

function toEvent(req) {
  return {
    httpMethod: req.method,
    headers: req.headers, // Express lower-cases header names; _auth reads `cookie`
    body: typeof req.body === 'string' ? req.body : '',
    queryStringParameters: req.query || {},
    path: req.path,
  };
}

function mount(name) {
  const { handler } = require(path.join(__dirname, 'netlify', 'functions', `${name}.js`));
  app.all(`/api/${name}`, async (req, res) => {
    try {
      const result = await handler(toEvent(req), {});
      if (result && result.headers) {
        for (const [k, v] of Object.entries(result.headers)) res.set(k, v);
      }
      res.status((result && result.statusCode) || 200).send((result && result.body) || '');
    } catch (err) {
      console.error(`[${name}] handler error:`, err);
      if (!res.headersSent) res.status(500).json({ error: 'server error' });
    }
  });
}

ROUTES.forEach(mount);

// Liveness probe.
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Static site. `extensions: ['html']` lets /portal resolve portal.html, etc.
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`HGC deal platform listening on :${port}`));
