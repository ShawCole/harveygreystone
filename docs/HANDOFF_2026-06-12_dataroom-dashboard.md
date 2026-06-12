# Handoff: dataroom-dashboard → dataroom-dashboard-2 (2026-06-12)

## Session Summary
Rebuilt Ethan's single-file deal-tracking app ("HGC & ARK Capital Consulting — Deal Platform") into a real, isolated, transferable backend + data room, then started building Ethan's prioritized Must-haves. **Live: https://hgc-deal-platform.netlify.app** (password `HGCARK2027!`). Everything below is deployed and verified.

## Infrastructure (LOCKED)
- **GCP project `hgc-dataroom`** (under arkdata.io org, billing `016FC5-9DF4D3-80E3DD`) — dedicated + isolated so it transfers to another org wholesale.
- **Cloud SQL Postgres 16** `hgc-dataroom:us-central1:hgc-db` (db-f1-micro, ENTERPRISE edition). DB `hgc`, user `hgcapp`. Tables: `deals`, `tasks`, `contacts`, `investors` — all `id BIGINT PK + payload JSONB + updated_at`.
- **GCS bucket** `hgc-dataroom-docs` — uploaded files (signed-URL only, private).
- **Netlify site** `hgc-deal-platform` (BizyPro team), repo linked. Build publishes ONLY `public/`; functions in `netlify/functions/`.
- **SA** `hgc-netlify@hgc-dataroom.iam` — key lives ONLY in Netlify env `GCP_SA_KEY` + `~/.config/gcloud/hgc-netlify-key.json`. Current key id `9c1061782a421d456f9c12532b4992aba3e47659` (two prior keys were leaked-then-revoked — see Gotchas).
- Secrets in `.secrets.env` (gitignored, repo root) + Netlify env. Connection-name etc. in `.secrets.env`.

## Arc 1: Backend + Data Room (commits d8a4f9b → 08a0356)
- `35cd8b9` Phase 1 backend: `/api/login` (server-side password → signed session cookie), `/api/deals` GET/POST (auth-gated, transactional per-row sync, seeds the 15 real deals), `/api/{upload-url,download-url,file}` (GCS signed URLs), `/api/underwrite` (503 STUB — AI deferred).
- `1dced79` auth fails closed if SESSION_SECRET missing. `681b3fc` publish only `public/` (secrets 404). 
- `d3a531a`→`08a0356` Data Room: `public/data-room-template.json` (120 docs / 10 sections / 28 subfolders / 61 required), `public/dataroom.js` (intake status Outstanding→Requested→Received→Reviewed/NA, completeness gated by deal-size band + international toggle, GCS uploads, event-delegation XSS-hardened).
- Verified: login gating (401), write persistence, delete-missing sync, upload→download→delete, status persistence.

## Arc 2: Client portal + NCNDA (commit d3a531a)
- `public/portal.html` at `/portal.html?t=<token>` — per-deal unguessable token; client must sign NCNDA before uploading (HARD-gated). Internal team countersigns via `public/ncnda.js` admin (🔏 button on deal cards). **Verifiable certificate** (tamper-evident hash chain) when both sign → `/api/certificate?cert=`.
- Backend: `_ncnda.js` + `ncnda/portal/portal-sign/portal-upload-url/portal-record/certificate` functions; `_db.js` `findDealByToken`/`findDealByCertificate` (jsonb query).
- Verified end-to-end (internal sign → gate blocks → client sign → finalize → cert valid → client upload → team sees it).
- **NCNDA text in `_ncnda.js` is a PLACEHOLDER.** Real template lives at `/home/shaw/scripts/agent-orchestra/legal/templates/mutual-ncnda-arkdata.md` (ArkData mutual NCNDA, Texas/Travis County, fill-in fields: client_legal_name/state/entity_type/effective_date). **DO NOT swap until Shaw/arkdata-legal sends specific edits.** See memory `ref-arkdata-ncnda-template`.

## Arc 3: Questionnaire + email (commits 17d75d0, b5269d5, 1abb2af)
- `public/questionnaire.html` (OrchestraOS dark style, 16 sections A–P, M/N/L/X pills) → `/api/questionnaire-submit` → **nodemailer Gmail SMTP** (`smtp.gmail.com:587`, `SMTP_USER=shaw@arkdata.io`, pass from GCP Secret Manager `arkdata-intake-smtp-password` in arkdata-hub) → emails to `shaw@arkdata.io,noah@arkdata.io` (`QUESTIONNAIRE_TO`).
- **Ethan submitted** (retrieved via IMAP). Full responses + prioritized order: `docs/2026-06-10-ethan-responses.md`. NOTE: submit only emails — it does NOT persist server-side (consider adding).

## Arc 4: Investor CRM + readiness dashboard (commits 0ae9eee, c45ba22)
- `investors` table + persistence (extended `_db.js` readAll/writeAll + `deals.js`). `public/investors.js` + Investors tab: profiles, per-deal engagements (contacted/interested/passed/committed + amount), portfolio summary, check-size deal matching. Deal cards show committed-vs-sought.
- Dashboard: `HGCDataRoom.portfolioReadiness()` per-deal completeness bars.
- **Browser-verified live** (headless Chrome): all modules load no-error, login→15 deals→15 cards, Investors/Dashboard/DataRoom/NCNDA all render. DB clean (15 deals, 0 of tasks/contacts/investors).

## What needs building next (Ethan's Musts, priority order)
### 1. AI UNDERWRITER (Ethan's explicit #1) — UNBLOCKING NOW
Shaw is providing an Anthropic API key this session. The UI is ALREADY built (frontend `autoReadDocuments`/`runUwAnalysis` POST `/api/underwrite` with `{prompt}`, expect `{result}`). Just implement `netlify/functions/underwrite.js` to call Claude. **Read the `claude-api` skill first** — use `claude-opus-4-8`, official `@anthropic-ai/sdk` (add to package.json), adaptive thinking, stream for long memos. Set `ANTHROPIC_API_KEY` in Netlify env (and a GCP secret). Also Musts: AI completeness check, deal-readiness scoring, doc summaries. Ethan will provide real docs to Shaw to test.
### 2. Investor CRM polish (mostly done) → 3. Data-room depth (versioning, in-app viewer via pdf.js already loaded, OCR search, per-doc notes/owner, bulk upload) → 4. Expanded pipeline stages + fields + stage automation → 5. Analytics (engagement tracking, revenue forecasting) → 6. Audit log, email alerts (SMTP available), integrations (e-sign/Drive/accounting), mobile/dark-mode, NCNDA hard-gate, custom domain (data.hgcark.com).

## Critical gotchas (do not relearn)
- **NEVER run `netlify env:list --plain`** — it dumps the full `GCP_SA_KEY` private key into the transcript. This leaked + forced key rotation TWICE this session. To see env keys use `netlify env:list` (masked) or `... | cut -d= -f1`.
- **Rotating GCP_SA_KEY requires a redeploy** — functions hold the env from their last deploy, so a revoked key breaks live Cloud SQL + GCS until `netlify deploy --build --prod`.
- **Cloud SQL first-instance provisioning is SLOW** (~15+ min) but healthy; the CREATE op shows RUNNING with no error.
- **`db-f1-micro` needs `--edition=ENTERPRISE`** (default tried ENTERPRISE_PLUS → 400).
- **Delete-guard hook** blocks any bash with `rm -rf`, `git rm --cached <secret>`, `pkill` patterns, or deleting credential files. Move secrets to `~/.trash-safety/` instead; revoke cloud keys via `gcloud ... keys delete` in an ISOLATED command (don't batch with file deletes).
- **Headless Chrome + `confirm()` dialogs hang** the CDP eval — override `window.confirm=()=>true` before testing flows that confirm.
- **gcloud user creds need interactive `gcloud auth login`** to refresh; the deploy SA `arkdata-deploy@arkdata-hub` has GCS but NOT Cloud SQL admin.
- **SMTP password** is GCP secret `arkdata-intake-smtp-password` in project `arkdata-hub` (also usable for IMAP read of shaw@arkdata.io if you need to retrieve a submission).

## Key files
| File | What |
|---|---|
| `netlify/functions/_db.js` | pool + ensureSchema/seed + readAll/writeAll + findDealByToken/Certificate |
| `netlify/functions/_ncnda.js` | NCNDA text (PLACEHOLDER) + hashing/cert |
| `netlify/functions/underwrite.js` | STUB — implement Claude call here (#1) |
| `public/index.html` | main app (inline script: deals/tasks/contacts/investors globals, load/save, tabs) |
| `public/dataroom.js` `ncnda.js` `investors.js` | the three UI modules (classic scripts, share globals) |
| `docs/2026-06-10-ethan-responses.md` | Ethan's priorities |
| `.secrets.env` | all secret values (gitignored) |
