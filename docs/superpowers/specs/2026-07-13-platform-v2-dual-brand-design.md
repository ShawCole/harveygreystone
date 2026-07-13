# Platform v2: Dual-Brand Deal Origination + Operations — Design

**Date:** 2026-07-13
**Status:** Approved by Shaw
**Supersedes:** `2026-07-13-multi-role-auth-design.md` (auth design absorbed into §8)
**Source material:** `github.com/Ethan2026-ai/Data-Room` (Capital Streams prototype — see its `docs/DESIGN.md` and `SETUP.md` for original intent), current production platform at `app.harveygreystone.com`

## Problem

Ethan delivered a working prototype ("Capital Streams Deal Platform") that defines the desired product: a client-facing deal-origination funnel (public intake → NDA → sectioned document uploads → questionnaire → status tracker) plus a three-tier AI desk (Vet → Project Summary → Letterhead) and AI contract drafting. It runs on localhost with flat-file storage, shared passcodes, and the Anthropic API.

Our production platform has the operations side: 120-doc data room, AI batch classification, investor CRM, contacts, tasks, portfolio dashboard, Cloud SQL + GCS + Vertex Gemini on Cloud Run, and an approved multi-role auth design.

v2 merges them: the prototype's product and UI, rebuilt on our infrastructure, keeping our operations modules — serving **two brands from one deployment**.

## Business context

- **Harvey Greystone** (Ethan) and **Capital Streams LLC** (Maurice Burks, Impossible Solutions) both originate deals on this platform. A gold streaming deal finances the Capital Streams fund, which in turn helps fund Harvey Greystone.
- Each client sees exactly **one** brand — whichever firm brought them in.
- Revenue model includes a success fee contracted before official underwriting; "I don't have this" document gaps are CPA-help revenue opportunities (firm has CPA partners); client revisits happen by phone, never email.
- **Official underwriting happens once, by humans.** The AI tiers are pre-screen and preparation — explicitly not double underwriting (Maurice's requirement).
- Internal verdicts, scores, and summaries must **never** leak to any client surface.

## 1. Branding layer

- `brand` field on every deal: `harveygreystone` | `capitalstreams`.
- Brand default resolved from **hostname**: `app.harveygreystone.com` → HGC; the future Capital Streams domain (not yet available) → CS. Same Cloud Run service, additional domain mapping added when the domain exists — no code change.
- Overridable per intake link (`/apply?b=cs`) and editable per deal by admins.
- `brands.json` config per brand: display name, serif wordmark text, legal entity name (NDA/contract/letterhead party), email sender name, accent palette. **Text wordmarks only until logos exist** — logo file slots reserved in config.
- Brand-scoped surfaces: client portal, NDA text/party, letterheads, contracts, status page, email drafts, page titles.
- Internal deal room is unified across brands; each deal shows a brand chip.

## 2. UI design language

Adopt the prototype's aesthetic, replacing the current navy/gold design system:

- Light baby-blue theme: bg `#eef5fb`, panels `#ffffff`, borders `#d8e7f3`, navy text `#0f2b45`/`#1c3a57`, muted `#69829a`, accent `#5aa9e0`, status greens/reds/ambers (`#188a4e`/`#c34a45`/`#b17d12`), 14px radius, subtle shadows.
- Serif wordmark (Georgia) — brand-dependent text; system font stack for UI; wide letter-spacing eyebrows.
- Layout: fixed left sidebar (intake-link box, deal rail with 📁 + company + stage + owner chip + status pill, footer stats) + main pane.
- Deal detail as tabs: **Overview / Documents / Client Answers / AI Analysis / Offers & Contracts / History**.
- Our operations modules stay as sidebar views: **Dashboard, Deals, Investors, Contacts, Tasks, Users** (Users = admin only).
- Instant-feeling interactions: apply server responses to local state, no blocking prompts, no full refetches.
- Vanilla HTML/CSS/JS — no framework, no build step (standing rule).

## 3. Client funnel

### /apply — public intake
- Brand-aware (hostname + `?b=` override). Anyone with the link can apply.
- Every visit starts a **fresh application** — never resume another session (hard requirement; known prior bug).
- Fields: company, contact name, email, phone, "what are you looking for?" (16 funding-need options).
- Creates deal (brand, unguessable token, stage `intake`), redirects to `/u/<token>`.

### NDA gate
- Client must e-sign before any upload. Uses **our tamper-evident scheme** (agreement version + hash, signer name/title/email, timestamp, IP, sigHash, certificate verification) — an upgrade over the prototype's name+userAgent record.
- Party name = deal's brand legal entity. Agreement text remains the current template pending lawyer review (standing rule: don't touch the legal text).

### Step 1 — Documents
- Checklist auto-selected by deal type from the SOP (equity / debt / line-of-credit / other catalogs).
- One section per required document; per-section multi-file upload to **GCS via signed URLs**.
- **"I don't have this"** flag with note; flagged to team as CPA-help opportunity; counts as resolved.
- Team can push additional requested sections to a client's page anytime.
- **Batch upload with AI classification:** client drops many files at once; Gemini classifies each into checklist sections with confidence + reasoning; client confirms before upload (same flow the team side already has).
- Client cannot advance until every section is uploaded or don't-have.

### Step 2 — Questionnaire (unlocks after Step 1)
- Total ask; use-of-funds line items (purpose + amount, dynamic rows); expected rate; structure preference (loan / equity / VC-angel / convertible-SAFE / revenue-based / hybrid / open / not sure); term preference; check-all products considered; outstanding debt; MCA positions; collateral; equity/down payment.
- **Prior funding attempts:** where (lender), year (dropdown to 1990), result selector — follow-up question swaps by result: Approved → "why did you decline their offer?", Declined → "what reason did they give?", Withdrew → optional note.

### Status page
- The client's `/u/<token>` link doubles as a live tracker: Application → Review → Agreement → Underwriting → Offer → Signing & Funding.
- Shows published letterhead (read-only) and published contracts awaiting clickwrap e-signature.
- Document upload remains available.
- Server-side `clientStatus()` projection exposes ONLY: sections, questionnaire-submitted flag, coarse step, published offer/contracts. No verdicts, scores, summaries, stage names, or internal notes — enforced at the API layer, not the UI.

## 4. AI desk (all Vertex AI Gemini — no Anthropic, standing rule)

Model: `gemini-2.5-flash` (revisit per-surface if quality demands). Prompts ported from the prototype with intent preserved.

- **① AI Vet** — quick pre-screen, not underwriting. Two-call pattern (kept deliberately separate): (1) research pass using **Gemini Google Search grounding** to verify the company — registration, principals, footprint, adverse news, claim plausibility; (2) structured verdict pass — `good_deal | bad_deal | needs_more_info`, score, ONE ballpark rate + structure, web findings table, red flags, missing-critical list, draft client message.
- **② Project Summary** — the partners' deep read after the revisit call. Signature feature: **fund-use allocation** — split the ask into separate financing products by purpose, each with its own amount, product, rate, term, collateral basis, rationale; internally consistent rates (collateralized < unsecured; bridge > term). Plus client ask vs recommendation, debt/MCA position analysis, prior-decline fixes required, structure recommendation honoring client preference, missing documents (with `ai_can_draft` only for templates, never source docs), underwriting-readiness verdict + blockers.
- **③ Letterhead / term sheet** — one facility section per allocation, indicative and non-binding language, [BRACKETED PLACEHOLDERS] for undecided items, brand-correct header. Always human-reviewed; explicit publish/unpublish to client.
- **Contracts** — 10 types (engagement/success-fee, term loan, CRE, equipment, construction, LOC, bridge, equity subscription, convertible note, RBF). Every draft opens with "DRAFT — prepared for review by the parties and their counsel; not legal advice; binding only when executed." Publish → client clickwrap e-sign (tamper-evident record).
- **Client doc templates** — AI-drafted fillable templates (exec summary, one-pager, projections, use-of-funds, bios) pre-filled from verified documents, unknowns as [CLIENT TO COMPLETE] placeholders.
- **Knowledge grounding** — SOP PDFs stored in GCS under `knowledge/`; all of them included in every AI-desk call as the firm rulebook (`Fund Operation Procedures.pdf` seeded from the prototype repo). Admin can add PDFs.
- **Existing AI surfaces retained:** underwriting memo with 30-field extraction (team-side), batch document classification + contact extraction.

## 5. Pipeline & attribution

- Stages: `intake → docs_in → intake_complete → ai_vetted → revisit_client → good_deal → summary_review → contract → underwriting → letterhead → signing → funding_date → funded`, plus `declined` (terminal side path).
- One-click stage moves from the pill bar; assignable Owner per deal shown on the deal card.
- Per-deal **history log**: every stage move, upload, AI run, publish, signature — attributed to the authenticated user's real name (or `client` / `ai`).

## 6. Checklist reconciliation

- The prototype's 4 SOP checklists (equity / debt / LOC / other) drive the **client intake funnel** — chosen by deal type via the looking-for mapping.
- Our 120-doc data room template and 7 funding-type checklists remain as the **team-side deep data room** (Documents tab retains the full tree with statuses and deal-size banding).
- Both catalogs live in config JSON; admin-editable UI is a later enhancement, not in scope.

## 7. Data model (Cloud SQL + GCS)

- Extend deal payload (JSONB, whole-blob save as today): `brand`, `uploadToken`, `dealType`, `lookingFor`, `owner`, `stage`, `nda` (tamper-evident record), `docSections[]` (id, name, optional, status `pending|uploaded|dont_have`, note, files[]), `questionnaire`, `vet`, `summary`, `letterhead` (+published), `contracts[]` (+published, signature), `generatedDocs[]`, `history[]`.
- New `users` table (see §8). Existing tables (tasks, contacts, investors) unchanged.
- All uploads in GCS bucket `hgc-dataroom-docs-500817` (name unchanged — standing rule) under `deals/<dealId>/sections/<sectionId>/`; SOP PDFs under `knowledge/`.
- Existing 15 seeded deals default to `brand: harveygreystone`.

## 8. Auth & roles (absorbed from the superseded auth spec)

- **GCP Identity Platform** on `dataroom-500817`, email/password, invite-only (self-signup disabled). Frontend: Firebase Auth JS SDK via CDN. Backend: `firebase-admin` token verification middleware on every API route.
- **Roles:** `admin` (all deals) · `team` (granted deals; full deal work; no user management or deal delete) · `lender` (granted deals; view/download + upload only) · `client` (own deals; portal surface only).
- **Roster at cutover:** Admins — Shaw, Ethan, Noah, Maurice. Team — Francis, Marcus. Invite emails: shaw@/ethan@/noah@harveygreystone.com confirmed; Maurice/Francis/Marcus TBD.
- **Clients are token-first:** /apply issues a token link (no account needed — the funnel must stay frictionless). A client account (bound to their deal) can be offered by invite later; both credentials hit the same `clientStatus()` projection.
- `users` table: uid, email, name, role, deal_grants int[], status, timestamps. Postgres is source of truth; short in-memory cache.
- Deal-grant check before minting any GCS signed URL; `GET /api/deals` filtered server-side by grants.
- NCNDA gate applies to clients and lenders both, per deal, before data access.
- Master password (`APP_PASSWORD`) retires once all admin accounts verified. Rollback = redeploy previous revision.
- Errors: 401 invalid token → login; 403 no grant (generic message, no deal-existence leak); disabled user → 403 always; auth outage fails closed.

## 9. Build order (each phase independently shippable)

1. **Brand layer + UI re-skin** — brands.json, hostname resolution, brand chip; rebuild index.html views in the new design language; keep all current functionality working.
2. **Client funnel** — /apply, NDA gate (tamper-evident), sectioned uploads + client batch AI classification, questionnaire, status page with strict projection.
3. **AI desk** — Vet with search grounding, Project Summary, Letterhead, Contracts, client doc templates, knowledge-folder grounding; publish/e-sign flows.
4. **Auth cutover** — Identity Platform, 6 team users + roles, per-action attribution, retire master password.

Phases 2 and 3 run under the existing master password until phase 4; actions attribute to "team" until then.

## Error handling & testing

- Every phase: `node --check` on all JS + the index.html script-block check (standing gotcha) before deploy.
- Client-surface leak test: assert `/api/portal/*` responses never contain vet/summary/score/stage-name fields.
- AI endpoints: schema-validate structured outputs; fall back gracefully (vet unavailable → manual pipeline continues; classification unavailable → fuzzy filename matching).
- Fresh-application test: two consecutive /apply visits must produce two independent deals.
- Auth phase: per-role × granted/not-granted matrix tests on every deal-scoped endpoint; signed-URL refusal without grant.

## Known follow-ups (out of scope)

- Capital Streams domain mapping (when domain access arrives — config only)
- Brand logos (config slots reserved)
- Lawyer-reviewed NCNDA + contract templates
- Admin-editable checklist catalogs
- Email notifications on client uploads; custom SMTP sender
- Doc-level visibility flags for client-facing data rooms
- Concurrent-edit safety (whole-blob save is last-write-wins)
