# Handoff: datamoon-integration agent → dataroom-dashboard (2026-07-07)

## Session Summary

Built the Harvey Greystone Capital deal platform from an empty repo to a production-deployed data room application. Started with Ethan's original hardcoded HTML dashboard, rebuilt it as a Cloud Run app with Cloud SQL + GCS backend, overhauled the UI from a generic tabbed SPA to a modern sidebar-nav institutional design, added funding-type-specific client intake checklists (7 loan types), batch document upload with AI classification (Vertex AI Gemini), and mapped the custom domain `app.harveygreystone.com`.

## Arc 1: GCP Infrastructure Setup (June 28)

**What was built:**
- Created GCP org `harveygreystone.com` via Cloud Identity
- Created GCP project `dataroom-500817` under the org
- Provisioned: Cloud SQL (Postgres 15, `hgc-db`), GCS bucket (`hgc-dataroom-docs-500817`), service account (`hgc-netlify@dataroom-500817.iam.gserviceaccount.com`)
- Created isolated repo `~/repos/harveygreystone/` → `github.com/ShawCole/harveygreystone` (public)
- Created Dockerfile, deployed to Cloud Run
- Commits: `0f3ffb5` through `0a7e36d`

**Decisions LOCKED:**
- GCP project is `dataroom-500817` (not `dataroom` — GCP appended the suffix)
- All HGC infra is isolated from ArkData GCP projects
- Service account has Editor role on the project (for full deployment access from VPS)
- DNS is on Namecheap

**Gotchas that cost time:**
- GCP org policies blocked SA key creation — had to override `iam.disableServiceAccountKeyCreation` AND `iam.managed.disableServiceAccountKeyCreation` at project level
- `iam.allowedPolicyMemberDomains` org policy blocked `allUsers` IAM binding for Cloud Run — had to override at project level
- iPad Cloud Shell kept breaking long commands across lines — solved by using `echo '...' > /tmp/x.sh && bash /tmp/x.sh` or `printf '%s'` pattern

## Arc 2: UI Overhaul (June 28-30)

**What was built:**
- Complete CSS design system: navy/gold/charcoal institutional palette, 400+ CSS classes
- Replaced all inline styles and emoji icons with CSS classes and SVG icons
- Sidebar navigation (collapsible, dark navy, SVG icons, badge counts, mobile hamburger menu)
- Deal detail modal (replaces inline split panel) with sub-tabs: Overview, Client Intake, Data Room, Investors, Portal, Underwriting
- Data room renders inline in deal modal (not a separate modal)
- Kanban toggle in Deals view
- Redesigned portal.html and questionnaire.html to match
- Commits: `9d0193c` through `3a7d0ff`, then `43b20f9`, `4dc2c63`

**Decisions LOCKED:**
- Vanilla HTML/CSS/JS — no React, no build tools
- All CSS in `<style>` block at top of index.html
- Sidebar layout (not horizontal tabs)
- Deal detail is a modal (not inline split panel)

## Arc 3: Funding-Type Checklists (June 30)

**What was built:**
- `funding-checklists.json` with 7 loan types and their required documents (from Ethan's spec)
- `fundingType` field on deals (dropdown in creation + edit)
- "Client Intake" sub-tab in deal detail showing type-specific document checklist
- Client portal (`portal.html`) shows "Documents needed for your [type]" with per-document upload slots
- Backend: portal endpoints pass `fundingType` + `clientIntake` state, support `docId` parameter for targeted uploads
- Commit: `0340a2e`

**The 7 funding types:**
1. Business Unsecured Loans & LOC
2. Business Secured Loans & LOC
3. Unsecured Real Estate Loan & LOC
4. Secured Real Estate Loans & LOC
5. Merchant Cash Advance (MCA)
6. Business Credit Card Stacking
7. Personal Loans, LOC & Credit Card Stacking

## Arc 4: Batch Upload + AI Classification (June 30 - July 2)

**What was built:**
- Batch upload zone in data room — drop multiple files, AI categorizes them
- `classify-docs.js` backend endpoint — sends extracted text to Gemini, returns classifications + extracted contacts
- Fuzzy filename matching fallback when AI unavailable
- Contact extraction — AI pulls stakeholder names/roles from documents
- Migrated ALL AI from Anthropic Claude to Vertex AI Gemini (`gemini-2.5-flash`)
- AI requirements docs at `docs/ai-requirements/`
- Commits: `89efc46`, `2e96cd8`, `233628e`, `8fc5f03`, `9bdb164`

**Decisions LOCKED:**
- Vertex AI Gemini (not Anthropic) — no external API keys needed, uses ADC on Cloud Run
- `gemini-2.5-flash` for both classification and underwriting
- Section IDs must be zero-padded (`04` not `4`) to match template

## Arc 5: Domain Mapping (July 4)

**What was built:**
- `app.harveygreystone.com` CNAME → `ghs.googlehosted.com` in Namecheap
- Cloud Run domain mapping created
- SSL certificate provisioned by Google
- Commit: no code changes, infrastructure only

**Status: LIVE** — `https://app.harveygreystone.com` serves the platform (verified HTTP 200)

## What Needs Building Next (Priorities)

### 1. Test and stabilize AI features
- Vertex AI Gemini integration needs real-world testing with deal documents
- The `@google-cloud/vertexai` package warns about Node 18 (requires >=22) — Dockerfile uses `node:18-slim`, should upgrade to `node:22-slim`
- Underwriting analysis needs testing end-to-end (drop PDF → get memo + auto-filled fields)

### 2. Client portal enhancements
- Portal at `app.harveygreystone.com/portal.html?t=TOKEN` — test the full NCNDA → upload flow
- Client intake checklist should show real-time completion status
- Consider email notifications when client uploads documents

### 3. Multi-user authentication
- Currently single master password (`HGCARK2027!`) for everyone
- Need per-user login, roles (admin, team member, client)
- This is the biggest gap vs. production readiness

### 4. Data persistence edge cases
- Whole-blob save (last-write-wins) — fine for single user, breaks with concurrent edits
- No audit log of changes
- No document versioning

### 5. Mobile experience
- Hamburger menu works but views are desktop-optimized
- Data room sections cramped on small screens

## Critical Gotchas (Do Not Relearn)

- **Deploy command requires SA activation first:** Always run `gcloud auth activate-service-account --key-file=...` before `gcloud builds submit` or `gcloud run deploy` — the VPS has multiple gcloud accounts and defaults to `shaw@arkdata.io` which has no access to `dataroom-500817`.
- **Build + deploy one-liner:** `gcloud auth activate-service-account --key-file=/home/shaw/repos/harveygreystone/.gcp-sa-key.json --project=dataroom-500817 2>&1 && gcloud builds submit --tag us-central1-docker.pkg.dev/dataroom-500817/hgc-platform/hgc-deal-platform:latest --project=dataroom-500817 ~/repos/harveygreystone/ 2>&1 && gcloud run deploy hgc-deal-platform --image=us-central1-docker.pkg.dev/dataroom-500817/hgc-platform/hgc-deal-platform:latest --region=us-central1 --project=dataroom-500817 --quiet 2>&1`
- **AI section IDs must be zero-padded:** Gemini returns section IDs as `"4"` not `"04"` — `dataroom.js` now does `String(cls.matchedSection).padStart(2, '0')` to fix this. Don't remove it.
- **Extra closing brace kills everything:** A stray `}` in the main `<script>` block breaks ALL JavaScript (NDA button, login, everything). Run `node -e` syntax check after any HTML edits.
- **`.gcp-sa-key.json` is gitignored** — matched by `*sa-key*.json` pattern in `.gitignore`. Never commit it.
- **Cloud Run env vars:** Set via console UI or `--update-env-vars`. Current vars: `CLOUD_SQL_CONNECTION_NAME`, `DB_USER`, `DB_PASS`, `DB_NAME`, `GCS_BUCKET`, `SESSION_SECRET`, `APP_PASSWORD`, `GCP_SA_KEY`.

## Key Files Modified This Session

| File | Lines | What it does |
|------|-------|-------------|
| `public/index.html` | 2598 | Main SPA — CSS design system, sidebar nav, all views, deal modal, underwriting |
| `public/dataroom.js` | 746 | Data room module — batch upload, AI classification, inline rendering |
| `public/investors.js` | 210 | Investor CRM module |
| `public/ncnda.js` | 195 | NCNDA/portal admin module |
| `public/portal.html` | 243 | Client-facing portal — NCNDA signing + document upload |
| `public/questionnaire.html` | 293 | Requirements intake form |
| `public/funding-checklists.json` | — | 7 funding types with required documents |
| `public/data-room-template.json` | — | 120-doc capital raise template (10 sections, 28 subfolders) |
| `netlify/functions/classify-docs.js` | 110 | AI document classification endpoint (Vertex AI Gemini) |
| `netlify/functions/underwrite.js` | 62 | AI underwriting endpoint (Vertex AI Gemini) |
| `netlify/functions/portal-upload-url.js` | — | Client upload with optional docId for intake tracking |
| `netlify/functions/portal-record.js` | — | Client upload recording with clientIntake state |
| `netlify/functions/_ncnda.js` | — | NCNDA state + publicView includes fundingType |
| `server.js` | — | Cloud Run entrypoint, added `classify-docs` to routes |
| `Dockerfile` | 13 | `node:18-slim`, copies server + netlify + public |
| `docs/ai-requirements/` | — | Specs for underwriting + document classification AI surfaces |

## Data State

- **Cloud SQL:** 4 tables (deals, tasks, contacts, investors) — 15 seeded deals, 0 tasks/contacts/investors
- **GCS bucket:** `hgc-dataroom-docs-500817` — test uploads only
- **Cloud Run:** Revision `hgc-deal-platform-00019-bs6` serving 100% traffic
- **Domain:** `app.harveygreystone.com` → Cloud Run (SSL active, HTTP 200 verified)
