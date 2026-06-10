# HGC & ARK Deal Platform — Backend Rebuild + Data Room (design)

**Date:** 2026-06-10
**Owner:** Shaw (ArkData) / client: HGC & ARK Capital Consulting (Ethan)
**Status:** Approved design → implementation

## Problem

Ethan built a single-file deal-tracking web app ("HGC & ARK Capital Consulting — Deal
Platform"). It is already wired for a backend it never got: the frontend calls same-origin
`GET/POST /api/deals` and `POST /api/underwrite`. The live Vercel deployment has those
functions but unprovisioned (Vercel KV env vars missing → 500; Claude call uses a stale model
id + no key → 500), so the app silently falls back to **per-browser `localStorage`** — data
lives in whoever's laptop opened the page, is never shared, and AI underwriting is dead.

Separately, Ethan supplied the **Capital Raise Data Room** index (universal template, 10
sections / 28 subfolders / **120 documents**, 61 required by default, with deal-size and
international gating) and asked to "make it more functional" — i.e. turn the dashboard into a
real **data room / intake & underwriting readiness tracker**, where each deal tracks document
completeness and actually holds the documents.

This rebuild stands up a real, shared, isolated backend **and** adds the data-room layer.

## Goals

1. Shared persistence: deals / tasks / contacts stored server-side, synced across users.
2. **Data Room per deal**: the 120-document template, per-document intake status, real file
   uploads, and completeness tracking (required-set aware of deal size + international).
3. Isolated, transferable backend in ArkData's GCP, handed to another org later.
4. Real session auth — every `/api` endpoint gated, not just the login screen.
5. Deploy to Netlify, seed the 15 real deals, verify on the live prod URL.

## Non-goals (deferred)

- **AI underwriting.** `/api/underwrite` returns a clean "not configured" 503 until an
  Anthropic key is provided; when enabled it uses `claude-opus-4-8` via `@anthropic-ai/sdk`
  (the live Vercel version's `claude-sonnet-4-20250514` is stale).
- **Per-entity REST / optimistic concurrency** on the deals blob (see Known Tradeoff).
- Real per-user accounts (single shared master password remains, but server-side + session).
- Document versioning, watermarking, granular per-investor data-room access.

## Architecture

```
Browser ──▶ Netlify (static index.html)
   │  signed session cookie on every /api call
   ├─ /api/deals, /api/login, /api/underwrite ─▶ Netlify Functions (Node)
   │                                                  │
   │                                                  ├─▶ Cloud SQL Postgres  (structured: deals/tasks/contacts + data-room status)
   │  direct upload/download via short-lived          │
   └─ signed URLs ───────────────────────────────────┴─▶ GCS bucket  (the actual document files)
```

Both Cloud SQL instance and the GCS bucket live isolated in ArkData's GCP (preferably a
dedicated project) so the whole backend transfers to a new org as a unit.

- **Frontend:** Ethan's `index.html`. Edits: remove hardcoded `PASSWORD`; route login through
  `/api/login`; add the **Data Room** UI (tab + per-deal data-room view); reconcile the thin
  "Docs" concept into the data room. Underwriting/Screening tabs stay but degrade cleanly.
- **Hosting:** Netlify — static page + Functions under `/api/*`, same origin.
- **Structured store:** dedicated Cloud SQL for PostgreSQL (ArkData GCP).
- **File store:** dedicated GCS bucket; objects keyed `deals/<dealId>/<docId>/<filename>`.
- **Connectivity:** Functions use `@google-cloud/cloud-sql-connector` + `pg` (service-account
  IAM, no public IP) for Postgres, and the GCS SDK (same service account) to mint signed URLs.

## Auth / session

- `POST /api/login` checks `{password}` against `APP_PASSWORD`; on success sets an HttpOnly,
  signed (HMAC over `SESSION_SECRET`), short-lived session cookie. Password leaves the page
  source entirely.
- Every other `/api/*` function verifies the cookie before doing anything (today the live
  `/api/deals` is wide open — unacceptable for confidential deal data). Invalid/absent → 401,
  frontend bounces to the login screen.

## Data model

**Cloud SQL** — three tables, low-churn, transfer-friendly:

```sql
CREATE TABLE deals    (id BIGINT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE tasks    (id BIGINT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE contacts (id BIGINT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now());
```

`payload` holds the full object as the frontend models it. Each deal's payload gains:

```jsonc
"dataRoom": {
  "<docId>": {
    "status": "outstanding|requested|received|reviewed|na",
    "file":  { "path": "deals/3/04.1.1/...xlsx", "filename": "...", "size": 12345, "uploadedAt": "..." } | null,
    "link":  "https://drive.google.com/...",   // optional external pointer
    "note":  "string",
    "updatedAt": "ISO-8601"
  }
},
"intl": false   // international toggle → Section 06 required-in-full
```

`docId` is the stable `SS.f.d` coordinate (section.subfolderIndex.docIndex) from the template.

**Template** — `data-room-template.json` (committed): the canonical 10 sections / 28 subfolders
/ 120 docs with `required` flags, deal-size guidance, and the international rule. Shipped to the
frontend; completeness and required-gating computed client-side.

## Data Room behavior

- Per deal, render the template grouped section → subfolder → document; each document shows its
  intake status (Outstanding → Requested → Received → Reviewed, or N/A) and an
  upload/download/link/note control.
- **Required set is dynamic:** base 61 required; deal-size guidance ($1–5M / $5–25M / $25–100M)
  and the per-deal `intl` toggle (Section 06 required-in-full) adjust which docs count toward
  "required complete."
- **Completeness:** deal card + dashboard show "received/reviewed vs required" (e.g. "42 / 61"),
  per-section progress, and a readiness rollup across the portfolio. A document counts complete
  when status is `received` or `reviewed` (or `na` for non-applicable optionals).

## File uploads (GCS, signed URLs)

- `POST /api/upload-url` (auth) `{dealId, docId, filename, contentType}` → returns a short-lived
  signed **PUT** URL + the object path. Browser uploads the file directly to GCS (bypasses
  Function payload/size limits), then PATCHes the deal payload's `dataRoom[docId].file`.
- `GET /api/download-url?path=…` (auth) → short-lived signed **GET** URL.
- `DELETE /api/file` (auth) `{dealId, docId}` → deletes the object, clears `file`.
- All paths validated against the requesting session; objects are private (no public ACL).

## API summary (frontend contract preserved + extended)

| Endpoint | Behavior |
|---|---|
| `POST /api/login` | Password check → signed session cookie. |
| `GET /api/deals` | (auth) `{deals, tasks, contacts}`. |
| `POST /api/deals` | (auth) `{deals, tasks, contacts}` → transactional per-row upsert + delete-missing. |
| `POST /api/upload-url` | (auth) → signed PUT URL for a deal/document. |
| `GET /api/download-url` | (auth) → signed GET URL. |
| `DELETE /api/file` | (auth) → delete a document's file. |
| `POST /api/underwrite` | 503 `{error:"AI underwriting is not yet configured."}` (deferred). |

## Seeding

Idempotent schema-create + seed on first deploy: create tables; if `deals` is empty, insert
the 15 real deals currently hardcoded (Voozaa, Walmart, BKFC, Colton Elliot–Tampa RE, Meat
Factory, Lake Havasu Energy, Kelly Walker, James SAFE, Satellite Company, Pyrolysis Systems,
Trade Desk Fund, David, International Bridge Loan, Gold Deals, Oil Deals). Each opens with an
empty data room (all docs `outstanding`).

## Phasing (ship incrementally)

1. **Backend foundation** — Netlify scaffold, Cloud SQL provision, session auth, `/api/login`
   + `/api/deals`, seed, deploy, verify shared persistence. (Original v1.)
2. **Data Room (status only)** — template integration, per-deal checklist UI, intake status,
   completeness, deal-size + international required gating. No files yet.
3. **Real file uploads** — GCS bucket, signed-URL upload/download/delete wired into each doc.
4. **(Later)** AI underwriting when a key lands.

## Known tradeoff (flagged, not hidden)

The frontend still POSTs the whole deals dataset on save. We store it row-by-row (better than
the old whole-blob KV), but a stale browser could overwrite a concurrent edit at the dataset
level. Acceptable for a small team now; per-deal `PATCH`/`DELETE` is a fast follow.

## Environment / secrets (Netlify env vars)

- `APP_PASSWORD` — master login password (out of source).
- `SESSION_SECRET` — HMAC key for the session cookie.
- `GCP_SA_KEY` — service-account JSON (Cloud SQL connector + GCS signing).
- `CLOUD_SQL_CONNECTION_NAME`, `DB_NAME`, `DB_USER`, `DB_PASS` — Postgres.
- `GCS_BUCKET` — document bucket name.
- `ANTHROPIC_API_KEY` — absent in v1; presence flips `/api/underwrite` live.

## Verification

- `GET /api/deals` without a session → 401; with a valid session → seeded deals (200).
- Add a deal in browser A → reload browser B → it appears (shared persistence, not localStorage).
- Open a deal's data room → set a doc to Received → reload → persists; completeness updates.
- Upload a financial model to a document → it stores in GCS → download link works → delete works.
- Required count tracks deal size + international toggle.
- Wrong password rejected; password absent from page source (view-source).
- `POST /api/underwrite` returns the clean 503 (not a 500/stacktrace).
