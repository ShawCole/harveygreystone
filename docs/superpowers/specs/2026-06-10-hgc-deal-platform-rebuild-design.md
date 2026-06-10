# HGC & ARK Deal Platform — Backend Rebuild (v1)

**Date:** 2026-06-10
**Owner:** Shaw (ArkData) / client: HGC & ARK Capital Consulting (Ethan)
**Status:** Approved design → implementation

## Problem

Ethan built a single-file deal-tracking web app ("HGC & ARK Capital Consulting — Deal
Platform"). It is already wired for a backend it never got: the frontend calls three
same-origin endpoints — `GET/POST /api/deals` and `POST /api/underwrite`. The live Vercel
deployment has those serverless functions but they are unprovisioned (Vercel KV env vars
missing → 500; Claude call uses a stale model id + no key → 500), so the app silently falls
back to **per-browser `localStorage`**. Result: "data" lives in whoever's laptop opened the
page, is never shared, and the AI underwriting is dead.

This rebuild stands up a real, shared, isolated backend so the existing frontend persists
data across users and devices.

## Goals (v1)

1. Shared persistence: deals / tasks / contacts stored server-side, synced across all users.
2. Isolated, transferable backend in ArkData's GCP that can be handed to another org later.
3. Keep Ethan's frontend essentially as-is (its API contract is already correct).
4. Move the master password out of the page source.
5. Deploy to Netlify, seed the 15 real deals, verify on the live prod URL.

## Non-goals (v1 — explicitly deferred)

- **AI underwriting.** `/api/underwrite` returns a clean "not configured" response until an
  Anthropic API key is provided. When enabled it will use `claude-opus-4-8` via the official
  `@anthropic-ai/sdk` (the live Vercel version's `claude-sonnet-4-20250514` is stale).
- **Per-entity REST / optimistic concurrency.** See Known Tradeoff below.
- Real per-user accounts (single shared master password remains, but server-side).

## Architecture

```
Browser ──▶ Netlify (static index.html)
                │  /api/* same-origin
                ▼
        Netlify Functions (Node)
                │  Cloud SQL connector (service-account IAM)
                ▼
        Cloud SQL for PostgreSQL  (dedicated, isolated, transferable — ArkData GCP)
```

- **Frontend:** Ethan's `index.html`, unchanged in structure. Edits: (1) remove the hardcoded
  `PASSWORD` constant and route login through `POST /api/login`; (2) everything else already
  points at the correct same-origin endpoints.
- **Hosting:** Netlify — static `index.html` + Netlify Functions under `/api/*`, same origin.
  Re-pointable later to a `data.<client>.com` subdomain.
- **Database:** A dedicated Cloud SQL for PostgreSQL instance in ArkData's GCP, isolated so the
  instance (or its enclosing project) can be transferred to a new organization. Provisioning
  detail (dedicated project vs dedicated instance in `arkdata-hub`) decided in implementation
  step 1 based on org/billing permissions; preference is a dedicated project for clean transfer.
- **Connectivity:** Netlify Functions connect via `@google-cloud/cloud-sql-connector` + `pg`,
  authenticating with a dedicated service-account key stored as a Netlify env var. No public-IP
  / `0.0.0.0/0` exposure. A small pool (max 1–2 connections per invocation) avoids exhausting
  Cloud SQL's connection limit under serverless fan-out.

## Data model

Three tables, low-churn and transfer-friendly:

```sql
CREATE TABLE deals    (id BIGINT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE tasks    (id BIGINT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE contacts (id BIGINT PRIMARY KEY, payload JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now());
```

`payload` holds the full object exactly as the frontend models it (capital, status, fee,
probability, rank, AI scores, memo, files, notes, …). JSONB avoids modeling ~30 columns now;
typed columns can be promoted later for SQL reporting without a frontend change.

## API (matches the contract the frontend already calls)

| Endpoint | Behavior |
|---|---|
| `GET /api/deals` | Returns `{deals, tasks, contacts}` — all rows' payloads. |
| `POST /api/deals` | Body `{deals, tasks, contacts}`. In one transaction: upsert each row by `id`, delete rows whose `id` is absent from the payload. Real per-row writes. |
| `POST /api/login` | Body `{password}`. Compares against `APP_PASSWORD` env var → `{ok:true}` / 401. Password no longer in page source. |
| `POST /api/underwrite` | Returns `503 {error:"AI underwriting is not yet configured."}` for v1. Frontend already renders `data.error` gracefully. Swappable to the real Claude call when a key lands. |

## Seeding

A schema-create + seed routine (run on first deploy, idempotent): create tables if absent;
if `deals` is empty, insert the 15 real deals currently hardcoded in the frontend (Voozaa,
Walmart, BKFC, Colton Elliot–Tampa RE, Meat Factory, Lake Havasu Energy, Kelly Walker, James
SAFE, Satellite Company, Pyrolysis Systems, Trade Desk Fund, David, International Bridge Loan,
Gold Deals, Oil Deals). The live site then opens with the real pipeline, not empty.

## Known tradeoff (flagged, not hidden)

The frontend still POSTs the entire dataset on every save. We store it row-by-row (a real
improvement over the old whole-blob KV), but a stale browser could still overwrite a
concurrent edit at the dataset level. Acceptable for a small team in v1. The clean fix —
frontend switches to per-deal `PATCH`/`DELETE` against per-row endpoints — is a fast follow,
not v1.

## Environment / secrets (Netlify env vars)

- `APP_PASSWORD` — master login password (moved out of source).
- `GCP_SA_KEY` — service-account JSON for the Cloud SQL connector.
- `CLOUD_SQL_CONNECTION_NAME`, `DB_NAME`, `DB_USER`, `DB_PASS` — Cloud SQL connection params.
- `ANTHROPIC_API_KEY` — absent in v1; presence flips `/api/underwrite` to the live Claude call.

## Deliverable

A Netlify prod URL that: gates on the NDA + server-side password, loads the 15 seeded deals
from Cloud SQL, persists adds/edits/deletes/reorders across browsers, and degrades cleanly on
the (deferred) underwriting feature. Registered as a client asset.

## Verification

- `GET /api/deals` on prod returns the seeded deals as JSON (HTTP 200).
- Add a deal in browser A → reload browser B → it appears (proves shared persistence, not
  localStorage).
- Edit a deal's capital/status → reload → persists.
- Login rejects a wrong password and accepts the configured one; password absent from page
  source (view-source check).
- `POST /api/underwrite` returns the clean 503 message (not a 500/stacktrace).
