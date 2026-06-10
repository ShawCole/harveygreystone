# Ethan's Questionnaire Responses — synthesis & build order

**Submitted:** 2026-06-10 by Ethan Hamilton. Source: questionnaire email (JSON attachment).
Users: Ethan, Noah Shaw, possibly Maurice Francis (+ Shaw). **Internal use only** for now ("No internal use" = outside parties do NOT get access yet). Wants it eventually on a **domain** (data.hgcark.com-style), HGC & ARK branded, **no white-label**. Both **CRM + data room as one system**.

## Ethan's #1 priority (his own words)
> "Making the AI underwriter with documents provided to Shaw and launched."

So: **turn the AI underwriter on** (it's built but stubbed) — Ethan will hand Shaw real deal docs to test/launch it. **Blocker: needs an Anthropic API key.**

## Must-haves, grouped

**AI (the headline):**
- AI underwriting memo from dropped docs — **Must** (#1)
- AI completeness check (what's missing/inconsistent) — **Must**
- AI deal-readiness scoring — **Must**
- AI document summaries — **Must**
- (classification, ask-the-data-room = Nice; AI redaction = No)

**Investor / lender CRM — entire section Must:**
- Investor profiles (check size, sector/geo, debt/equity), deal↔investor matching, outreach tracking (contacted→interested→passed→committed), commitment/allocation tracking.

**Data Room docs:**
- Bulk upload, document versioning, in-app viewer, full-text search/OCR, **document requests** (client uploads — partly delivered via the new client portal), per-document notes/comments + owner — all **Must**. (redaction = Later)

**Analytics:** investor engagement tracking, data-room readiness dashboard, revenue forecasting — **Must**.

**Pipeline:** deal-stage automation — **Must**; wants **different/expanded stages** (Lead→Proposal→Negotiation→Closed was just a placeholder); all the extra fields "preferred." Custom fields = Nice.

**Integrations (heavy, mostly Must):** e-signature, email/calendar logging to deals, Google Drive/Dropbox import, accounting (QuickBooks/Plaid). CRM sync + public API = Later.

**Plumbing Musts:** audit log; email alerts (new view, upload, etc.); mobile-friendly; dark mode.

**NCNDA (validates what we built):** one authorized internal signer (Noah or Ethan) — *matches current "1 internal + client finalizes"*; same NCNDA doc every deal — *matches*; in-house tamper-evident certificate for now — *matches*; DocuSign-grade = Nice/Later. **New Must:** eventually **hard-gate** internal access if NCNDA unsigned (deferred trigger).

**Lower priority:** investor-facing access control / tiered sharing (all **Nice** — "investors have it with us anyways"); 2FA = Later; Q&A module = Later; task assignment / approval workflow = No; data auto-delete = No.

## Proposed build order
1. **AI underwriter (live)** — implement `/api/underwrite` against `claude-opus-4-8`; wire completeness check, readiness scoring, summaries into the existing UI. *(needs API key)*
2. **Investor CRM** — new module: investor profiles + outreach/commitment tracking + deal↔investor matching.
3. **Data-room depth** — versioning, in-app viewer, OCR/full-text search, per-doc notes/owner, bulk upload.
4. **Pipeline upgrade** — expanded stages + the extra deal fields + stage automation.
5. **Analytics** — engagement tracking, readiness dashboard, revenue forecasting.
6. **Notifications + audit log**, then **integrations** (e-sign, Drive import, accounting), **mobile/dark-mode polish**, **custom domain**, and the **NCNDA hard-gate**.
