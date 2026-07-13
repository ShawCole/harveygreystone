# v2 Phase 1: Brand Layer + UI Re-skin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dual-brand layer (Harvey Greystone / Capital Streams) resolved from hostname, and re-skin the platform from navy/gold to the approved baby-blue light design language — keeping every current feature working.

**Architecture:** A `brands.json` config + tiny server-side resolver expose `GET /api/brand` (hostname → brand, `?b=` override). The frontend bootstraps `window.BRAND` and renders brand-aware wordmarks; every deal carries a `brand` field (default `harveygreystone`, backfilled on load). The re-skin keeps ALL existing CSS variable names and swaps their values, so the 400+ existing classes keep working; only the sidebar (dark→light) and wordmark need structural CSS changes.

**Tech Stack:** Vanilla HTML/CSS/JS (no framework — standing rule), Express + Netlify-style handlers, `node:test` for the resolver unit test, Cloud Run deploy.

**Spec:** `docs/superpowers/specs/2026-07-13-platform-v2-dual-brand-design.md` §1–2, §9 phase 1.

**Standing gotchas (apply to every task):**
- After ANY `public/index.html` edit run the script-block check (Task 7 Step 1 command).
- `.gcp-sa-key.json` is gitignored — never commit it.
- Deploys need SA activation first (see Task 7).

---

### Task 1: Brand config + resolver

**Files:**
- Create: `public/brands.json`
- Create: `netlify/functions/_brands.js`
- Create: `tests/brands.test.js`

- [ ] **Step 1: Create `public/brands.json`**

```json
{
  "default": "harveygreystone",
  "brands": {
    "harveygreystone": {
      "displayName": "Harvey Greystone",
      "wordmark": "HARVEY GREYSTONE",
      "tagline": "Deal Platform",
      "legalEntity": "Harvey Greystone Capital and its authorized representatives",
      "emailSender": "Harvey Greystone Capital",
      "hostnames": ["app.harveygreystone.com"],
      "logo": null
    },
    "capitalstreams": {
      "displayName": "Capital Streams",
      "wordmark": "CAPITAL STREAMS",
      "tagline": "Deal Platform",
      "legalEntity": "Capital Streams LLC and its authorized representatives",
      "emailSender": "Capital Streams",
      "hostnames": [],
      "logo": null
    }
  }
}
```

(`hostnames` for capitalstreams stays empty until the CS domain exists — mapping it later is config-only.)

- [ ] **Step 2: Write the failing test — `tests/brands.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
const { resolveBrand, getBrand } = require('../netlify/functions/_brands');

test('resolves harveygreystone from its hostname', () => {
  assert.strictEqual(resolveBrand('app.harveygreystone.com'), 'harveygreystone');
});

test('unknown hostname falls back to default', () => {
  assert.strictEqual(resolveBrand('hgc-deal-platform-463556847516.us-central1.run.app'), 'harveygreystone');
  assert.strictEqual(resolveBrand(undefined), 'harveygreystone');
});

test('explicit override beats hostname', () => {
  assert.strictEqual(resolveBrand('app.harveygreystone.com', 'capitalstreams'), 'capitalstreams');
});

test('invalid override is ignored', () => {
  assert.strictEqual(resolveBrand('app.harveygreystone.com', 'nonsense'), 'harveygreystone');
});

test('hostname with port resolves', () => {
  assert.strictEqual(resolveBrand('app.harveygreystone.com:443'), 'harveygreystone');
});

test('getBrand returns full config with key', () => {
  const b = getBrand('capitalstreams');
  assert.strictEqual(b.key, 'capitalstreams');
  assert.strictEqual(b.wordmark, 'CAPITAL STREAMS');
  assert.ok(b.legalEntity.includes('Capital Streams LLC'));
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd ~/repos/harveygreystone && node --test tests/*.test.js`
Expected: FAIL — `Cannot find module '../netlify/functions/_brands'`

- [ ] **Step 4: Implement `netlify/functions/_brands.js`**

```js
// Brand resolution for the dual-brand platform (Harvey Greystone / Capital Streams).
// Source of truth is public/brands.json (also fetched by client pages).
const fs = require('fs');
const path = require('path');

let CONFIG = null;
function config() {
  if (!CONFIG) {
    CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'brands.json'), 'utf8'));
  }
  return CONFIG;
}

// hostname (may include :port) + optional explicit override -> brand key
function resolveBrand(hostname, override) {
  const cfg = config();
  if (override && cfg.brands[override]) return override;
  const host = String(hostname || '').toLowerCase().split(':')[0];
  for (const [key, b] of Object.entries(cfg.brands)) {
    if ((b.hostnames || []).includes(host)) return key;
  }
  return cfg.default;
}

// brand key -> full config object (with key included); unknown -> default brand
function getBrand(key) {
  const cfg = config();
  const k = cfg.brands[key] ? key : cfg.default;
  return { key: k, ...cfg.brands[k] };
}

module.exports = { resolveBrand, getBrand };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ~/repos/harveygreystone && node --test tests/*.test.js`
Expected: 6 passing

- [ ] **Step 6: Add test script to `package.json`**

In `package.json` `"scripts"` block, add after the `start` line:

```json
    "start": "node server.js",
    "test": "node --test tests/*.test.js"
```

- [ ] **Step 7: Commit**

```bash
git add public/brands.json netlify/functions/_brands.js tests/brands.test.js package.json
git commit -m "feat: brand config + hostname resolver for dual-brand platform"
```

---

### Task 2: `GET /api/brand` endpoint

**Files:**
- Create: `netlify/functions/brand.js`
- Modify: `server.js` (ROUTES array, ~line 24)
- Modify: `tests/brands.test.js` (add handler test)

- [ ] **Step 1: Add failing handler test to `tests/brands.test.js`**

```js
test('brand handler resolves from host header', async () => {
  const { handler } = require('../netlify/functions/brand');
  const res = await handler({ httpMethod: 'GET', headers: { host: 'app.harveygreystone.com' }, queryStringParameters: {} });
  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.key, 'harveygreystone');
});

test('brand handler honors ?b= override', async () => {
  const { handler } = require('../netlify/functions/brand');
  const res = await handler({ httpMethod: 'GET', headers: { host: 'app.harveygreystone.com' }, queryStringParameters: { b: 'capitalstreams' } });
  const body = JSON.parse(res.body);
  assert.strictEqual(body.key, 'capitalstreams');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/*.test.js`
Expected: 6 pass, 2 FAIL — `Cannot find module '../netlify/functions/brand'`

- [ ] **Step 3: Implement `netlify/functions/brand.js`**

Public endpoint (no session check) — pre-login pages (login screen, future /apply) need it.

```js
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
```

- [ ] **Step 4: Register the route in `server.js`**

In the `ROUTES` array (after `'classify-docs',`), add:

```js
  'brand',
```

- [ ] **Step 5: Run tests + syntax check**

Run: `node --test tests/*.test.js && node --check server.js`
Expected: 8 passing, no syntax error

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/brand.js server.js tests/brands.test.js
git commit -m "feat: GET /api/brand — hostname-resolved brand config endpoint"
```

---

### Task 3: Frontend brand bootstrap + deal brand field

**Files:**
- Modify: `public/index.html` (main `<script>` block + sidebar/auth markup)

- [ ] **Step 1: Add brand bootstrap to the main script block**

In `public/index.html`, near the top of the main `<script>` block (just after the `let nextDealId = 17;` declaration around line 1126), add:

```js
  // --- Brand (dual-brand platform) ---
  window.BRAND = { key: 'harveygreystone', displayName: 'Harvey Greystone', wordmark: 'HARVEY GREYSTONE', tagline: 'Deal Platform' };
  (async function initBrand() {
    try {
      const r = await fetch('/api/brand' + location.search.replace(/^\?/, '?'));
      if (r.ok) window.BRAND = await r.json();
    } catch (e) { /* offline/default is fine */ }
    document.title = `${window.BRAND.displayName} — ${window.BRAND.tagline}`;
    const wm = document.getElementById('brandWordmark');
    if (wm) wm.textContent = window.BRAND.wordmark;
    const sub = document.getElementById('brandTagline');
    if (sub) sub.textContent = window.BRAND.tagline;
    const authLogo = document.getElementById('authBrand');
    if (authLogo) authLogo.textContent = window.BRAND.displayName;
  })();
```

- [ ] **Step 2: Give the wordmark/auth elements the IDs the bootstrap targets**

Sidebar brand block (currently around line 482):

```html
    <div class="sidebar-brand">
      <div>
        <div class="sidebar-brand-text brand-serif" id="brandWordmark">HARVEY GREYSTONE</div>
        <div class="sidebar-brand-sub" id="brandTagline">Deal Platform</div>
      </div>
    </div>
```

(Removes the gold `HG` icon square — the serif wordmark IS the brand mark until logos exist.)

Auth overlay logo (currently line 432 `<div class="auth-logo">HGC &amp; ARK Capital Consulting</div>`):

```html
    <div class="auth-logo brand-serif" id="authBrand">Harvey Greystone</div>
```

- [ ] **Step 3: Default `brand` on deal creation + backfill on load**

In `addDeal()` (~line 2163), inside the `deals.push({` object literal, add after `id: nextDealId++,`:

```js
      brand: (window.BRAND && window.BRAND.key) || 'harveygreystone',
```

Do the same in the second `deals.push({` (~line 2436 — the AI auto-read creation path).

Where deals load from the server (the function containing `nextDealId = (deals.reduce(...)` ~line 1160), add immediately after deals are assigned:

```js
      deals.forEach(d => { if (!d.brand) d.brand = 'harveygreystone'; });
```

- [ ] **Step 4: Brand chip on deal cards + deal detail modal**

Add CSS (in the `<style>` block, next to the existing `.badge` rules):

```css
.brand-chip { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: 2px 8px; border-radius: var(--radius-full); border: 1px solid var(--gray-300); color: var(--gray-600); background: var(--gray-100); vertical-align: middle; }
.brand-serif { font-family: var(--serif); letter-spacing: .14em; }
```

Add a helper in the main script block (next to `escHtml`):

```js
  function brandChip(d) {
    const b = d.brand === 'capitalstreams' ? 'CS' : 'HG';
    const title = d.brand === 'capitalstreams' ? 'Capital Streams' : 'Harvey Greystone';
    return `<span class="brand-chip" title="${title}">${b}</span>`;
  }
```

In `renderDeals()` where the deal card renders the deal name (find the card template that outputs `d.name` inside `view-deals`), append `${brandChip(d)}` immediately after the name element. Do the same in the deal detail modal header where the deal name is set.

- [ ] **Step 5: Syntax check**

Run (from repo root):

```bash
node -e "const vm=require('vm'); const fs=require('fs'); const h=fs.readFileSync('public/index.html','utf8'); const s=h.match(/<script>([\s\S]*?)<\/script>/g)||[]; s.forEach((x,i)=>{try{new vm.Script(x.replace(/<\/?script>/g,''));console.log('Block',i,': OK')}catch(e){console.log('Block',i,':',e.message)}})"
```

Expected: all blocks OK

- [ ] **Step 6: Commit**

```bash
git add public/index.html
git commit -m "feat: brand bootstrap, per-deal brand field + chip, brand-aware wordmark"
```

---

### Task 4: CSS token re-skin (baby-blue light theme)

**Files:**
- Modify: `public/index.html` (`:root` token block only, ~lines 9–79)

Strategy: keep every variable NAME, swap VALUES. The prototype palette maps onto our token names so the 400+ component classes need no edits.

- [ ] **Step 1: Replace the `:root` token values**

Replace these specific declarations in the `:root` block (leave any token not listed here unchanged — spacing, text sizes, durations all stay):

```css
  --navy: #0f2b45;
  --navy-dark: #0f2b45;
  --navy-light: #1c3a57;
  --charcoal: #1c3a57;
  --gold: #5aa9e0;
  --gold-light: #a9d2ef;
  --gold-muted: rgba(90, 169, 224, 0.15);
  --white: #ffffff;
  --gray-50: #f4f9fd;
  --gray-100: #e8f3fc;
  --gray-200: #d8e7f3;
  --gray-300: #c8dff2;
  --gray-400: #8fa9c0;
  --gray-500: #69829a;
  --gray-600: #5e7f9b;
  --gray-700: #1c3a57;
  --gray-800: #16324a;
  --gray-900: #0f2b45;
  --success: #188a4e;
  --success-light: rgba(24, 138, 78, 0.12);
  --warning: #b17d12;
  --warning-light: rgba(177, 125, 18, 0.12);
  --danger: #c34a45;
  --danger-light: rgba(195, 74, 69, 0.12);
  --info: #5aa9e0;
  --info-light: rgba(90, 169, 224, 0.12);
```

And these structural tokens:

```css
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
```

Add one new token (after `--font-mono`):

```css
  --serif: Georgia, 'Times New Roman', serif;
```

- [ ] **Step 2: Page background**

Change the `body` rule background from `var(--gray-50)` to:

```css
body { font-family: var(--font-sans); color: var(--gray-800); background: #eef5fb; line-height: var(--leading-normal); }
```

- [ ] **Step 3: Visual smoke test**

Run: `node --check` is N/A for CSS — instead run the script-block check (unchanged blocks should still pass) and open the page:

```bash
node -e "const vm=require('vm'); const fs=require('fs'); const h=fs.readFileSync('public/index.html','utf8'); const s=h.match(/<script>([\s\S]*?)<\/script>/g)||[]; s.forEach((x,i)=>{try{new vm.Script(x.replace(/<\/?script>/g,''));console.log('Block',i,': OK')}catch(e){console.log('Block',i,':',e.message)}})"
```

Expected: all blocks OK. (Full visual verification happens after deploy in Task 7.)

- [ ] **Step 4: Commit**

```bash
git add public/index.html
git commit -m "feat: re-skin design tokens to baby-blue light palette"
```

---

### Task 5: Sidebar light restyle + auth screen

**Files:**
- Modify: `public/index.html` (sidebar + auth CSS rules, ~lines 88–140)

The token swap alone leaves the sidebar navy (it uses `--navy-dark` as background). The prototype sidebar is a white panel with a hairline border.

- [ ] **Step 1: Restyle the sidebar rules**

Replace these rules (keep selectors identical, change declarations):

```css
.sidebar { width: var(--sidebar-width); background: var(--white); border-right: 1px solid var(--gray-200); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100; transition: width var(--duration) var(--ease); overflow: hidden; }
.sidebar-brand { padding: var(--sp-6) var(--sp-5); border-bottom: 1px solid var(--gray-200); display: flex; align-items: center; gap: var(--sp-3); }
.sidebar-brand-text { font-size: var(--text-sm); font-weight: 700; color: var(--navy); white-space: nowrap; overflow: hidden; }
.sidebar-brand-sub { font-size: var(--text-xs); color: var(--gray-500); font-weight: 400; letter-spacing: .28em; text-transform: uppercase; }
.nav-section-label { font-size: 11px; font-weight: 600; color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.06em; padding: var(--sp-4) var(--sp-5) var(--sp-2); }
.nav-item { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-5); margin: var(--sp-1) var(--sp-2); border-radius: var(--radius-md); color: var(--gray-600); cursor: pointer; transition: all var(--duration) var(--ease); font-size: var(--text-sm); font-weight: 500; white-space: nowrap; }
.nav-item:hover { background: var(--gray-100); color: var(--navy); }
.nav-item.active { background: var(--gold-muted); color: var(--navy); }
.sidebar-footer { padding: var(--sp-4) var(--sp-5); border-top: 1px solid var(--gray-200); display: flex; align-items: center; gap: var(--sp-3); }
.sidebar-avatar { width: 32px; height: 32px; border-radius: var(--radius-full); background: var(--gray-100); display: flex; align-items: center; justify-content: center; color: var(--navy); font-weight: 600; font-size: var(--text-xs); flex-shrink: 0; }
.sidebar-footer-name { font-size: var(--text-sm); color: var(--navy); font-weight: 500; }
```

Also update any remaining sidebar-scoped rules using `rgba(255,255,255,...)` backgrounds or `--gray-300`/`--gray-400` text on dark (search `grep -n "sidebar\|nav-item\|mobile" public/index.html` within the style block) to the light equivalents above.

- [ ] **Step 2: Auth overlay to light theme**

```css
.auth-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: #eef5fb; }
```

- [ ] **Step 3: Script-block check** (same command as Task 4 Step 3). Expected: all OK.

- [ ] **Step 4: Commit**

```bash
git add public/index.html
git commit -m "feat: light sidebar + auth screen matching prototype design language"
```

---

### Task 6: Brand-aware re-skin of portal.html + questionnaire.html

**Files:**
- Modify: `public/portal.html`
- Modify: `public/questionnaire.html`
- Modify: `netlify/functions/_ncnda.js` (publicView only — NOT the agreement text)

- [ ] **Step 1: Expose the deal's brand in the portal payload**

In `netlify/functions/_ncnda.js`, find the `publicView` function and add `brand` to the returned object:

```js
    brand: deal.payload.brand || 'harveygreystone',
```

(Do NOT touch `NCNDA_TEXT`, `NCNDA_TITLE`, or `NCNDA_VERSION` — legal text is frozen pending counsel. Party naming inside the agreement is a Phase 2 item.)

- [ ] **Step 2: Re-skin both pages' token blocks**

`portal.html` and `questionnaire.html` each have their own `<style>` with the navy/gold tokens. Apply the same value swaps as Task 4 Step 1 (same variable names) and set page background `#e8f3fc`.

- [ ] **Step 3: Brand-aware wordmark on both pages**

In `portal.html`, the deal payload now includes `brand`. Where the page header renders the firm name, replace the hardcoded name with:

```html
<div class="portal-brand" id="portalBrand">Harvey Greystone</div>
```

```css
.portal-brand { font-family: Georgia, 'Times New Roman', serif; letter-spacing: .14em; text-transform: uppercase; font-weight: 700; color: var(--navy); }
```

And in the script after the portal data loads:

```js
      const BRAND_NAMES = { harveygreystone: 'HARVEY GREYSTONE', capitalstreams: 'CAPITAL STREAMS' };
      const bEl = document.getElementById('portalBrand');
      if (bEl) bEl.textContent = BRAND_NAMES[data.brand] || BRAND_NAMES.harveygreystone;
      document.title = `${(BRAND_NAMES[data.brand] || 'HARVEY GREYSTONE')
        .split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' ')} — Client Portal`;
```

In `questionnaire.html` (no deal context — it's the public intake form), fetch the hostname brand:

```js
      fetch('/api/brand' + location.search).then(r => r.json()).then(b => {
        document.title = `${b.displayName} — Questionnaire`;
        const el = document.getElementById('portalBrand');
        if (el) el.textContent = b.wordmark;
      }).catch(() => {});
```

with the same `portal-brand` header element and CSS as portal.html.

- [ ] **Step 4: Syntax checks**

```bash
node --check netlify/functions/_ncnda.js && node --test tests/*.test.js
for f in portal questionnaire; do node -e "const vm=require('vm'); const fs=require('fs'); const h=fs.readFileSync('public/$f.html','utf8'); const s=h.match(/<script>([\s\S]*?)<\/script>/g)||[]; s.forEach((x,i)=>{try{new vm.Script(x.replace(/<\/?script>/g,''));console.log('$f block',i,': OK')}catch(e){console.log('$f block',i,':',e.message)}})"; done
```

Expected: all OK, 8 tests passing

- [ ] **Step 5: Commit**

```bash
git add public/portal.html public/questionnaire.html netlify/functions/_ncnda.js
git commit -m "feat: brand-aware light re-skin of client portal and questionnaire"
```

---

### Task 7: Verify, deploy, live checks

**Files:** none new

- [ ] **Step 1: Full local verification**

```bash
cd ~/repos/harveygreystone && node --test tests/*.test.js && node --check server.js && node --check public/dataroom.js && node --check public/investors.js && node --check public/ncnda.js && node -e "const vm=require('vm'); const fs=require('fs'); const h=fs.readFileSync('public/index.html','utf8'); const s=h.match(/<script>([\s\S]*?)<\/script>/g)||[]; s.forEach((x,i)=>{try{new vm.Script(x.replace(/<\/?script>/g,''));console.log('Block',i,': OK')}catch(e){console.log('Block',i,':',e.message)}})"
```

Expected: 8 tests pass, every check OK

- [ ] **Step 2: Deploy**

```bash
gcloud auth activate-service-account --key-file=/home/shaw/repos/harveygreystone/.gcp-sa-key.json --project=dataroom-500817 2>&1 && gcloud builds submit --tag us-central1-docker.pkg.dev/dataroom-500817/hgc-platform/hgc-deal-platform:latest --project=dataroom-500817 ~/repos/harveygreystone/ 2>&1 && gcloud run deploy hgc-deal-platform --image=us-central1-docker.pkg.dev/dataroom-500817/hgc-platform/hgc-deal-platform:latest --region=us-central1 --project=dataroom-500817 --quiet 2>&1
```

Expected: new revision serving 100%

- [ ] **Step 3: Live checks**

```bash
curl -s https://app.harveygreystone.com/api/brand | python3 -m json.tool
curl -s "https://app.harveygreystone.com/api/brand?b=capitalstreams" | python3 -m json.tool
curl -s -o /dev/null -w "%{http_code}\n" https://app.harveygreystone.com/
```

Expected: first returns `"key": "harveygreystone"` with wordmark `HARVEY GREYSTONE`; second returns `"key": "capitalstreams"`; third returns `200`.

- [ ] **Step 4: Manual visual pass (Shaw/Ethan)**

Login screen light-themed with serif brand; sidebar white with serif wordmark; deals list shows brand chips; portal + questionnaire pages light-themed. All existing features (deal CRUD, data room, batch AI upload, underwriting, NCNDA flow) still work.

- [ ] **Step 5: Push**

```bash
git push
```

---

## Out of scope for this plan (later phases)

- Phase 2: /apply intake, NDA gate parameterization, sectioned uploads, questionnaire funnel, status page
- Phase 3: AI Vet / Project Summary / Letterhead / Contracts / knowledge grounding
- Phase 4: Identity Platform auth cutover
- CS domain mapping (config-only when domain arrives)
