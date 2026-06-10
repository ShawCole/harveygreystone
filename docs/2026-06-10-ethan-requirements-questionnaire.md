# HGC & ARK Deal Platform — Requirements Questionnaire (for Ethan)

**Purpose:** capture *everything* you want this platform to do, so we can prioritize and build in the right order. It's organized by area. For each capability, mark a priority — you don't have to want all of it.

**Date:** 2026-06-10 · **Live build:** https://hgc-deal-platform.netlify.app

### How to fill this out
Put one of these next to each item (or just tell me in your own words):
- **M** = Must-have (core to how you work)
- **N** = Nice-to-have (would help, not urgent)
- **L** = Later (someday / when we productize)
- **X** = Don't want it

### Current state legend (what's already live today)
- ✅ built & live   🔶 partly built   ⬜ not built yet

This questionnaire is informed by what professional virtual data rooms (Datasite, Intralinks, iDeals, Firmex, Ansarada) and fundraising platforms actually offer, so it covers the full universe of what's possible — not just what we've built.

---

## A. Vision, users & roles

1. In one or two sentences, what is this platform *for* you — a **deal CRM** (track your pipeline), a **data room** (hold/share deal documents with investors & lenders), or **both as one system**?
2. Who logs in and uses it? (e.g. you, Corey, other HGC partners, analysts, assistants…)
3. Do **outside parties** ever get access — the founders/companies raising capital, or the **investors/lenders** reviewing deals? Or is it internal-only for now?
4. Roughly how many deals do you run at once, and how many people touch the platform?

**Roles & permissions** (who can do what)
- ⬜ Multiple user accounts, each with their own login (instead of one shared password) — **M / N / L / X**
- ⬜ Role levels (e.g. Admin, Team member, Read-only, Investor/guest) — **M / N / L / X**
- ⬜ Per-deal access (a teammate or investor only sees the deals they're assigned) — **M / N / L / X**

---

## B. Deals & pipeline (the CRM side)

*Current: ✅ deals with capital, fee %, equity %, win probability, status (Lead→Proposal→Negotiation→Closed), drag-to-rank, notes; ✅ dashboard metrics, pipeline view, analytics tables, CSV/JSON/PDF export.*

1. Are the deal **stages** right (Lead → Proposal → Negotiation → Closed), or do you think in different stages (e.g. Sourcing, Screening, Underwriting, Term Sheet, Diligence, Funded)?
2. What **fields** do you wish every deal had that it doesn't today? (e.g. deal type, industry, geography, instrument debt/equity, target close date, source/referrer, lender vs investor target…)
3. Do you track **economics** beyond fee % and equity % (success fees, retainers, expected vs realized revenue, who gets paid what)?
4. Capabilities:
   - 🔶 Custom fields you can add yourself per deal — **M / N / L / X**
   - ⬜ Deal-stage automation (e.g. moving to "Diligence" prompts a document request) — **M / N / L / X**
   - ⬜ Deal duplication / templates (start a new deal from a template) — **M / N / L / X**
   - ✅ Deal scoring / ranking — keep, change, or expand? **____**

---

## C. Data Room — documents & structure

*Current: ✅ every deal carries your 120-document Capital Raise Data Room checklist (10 sections / 28 subfolders), per-document intake status (Outstanding→Requested→Received→Reviewed/N-A), real file uploads, completeness % gated by deal size + an international toggle.*

1. Is the 120-doc template the **right master checklist**, or do you want to edit it (add/remove/rename docs, change which are Required)?
2. Should you be able to **customize the checklist per deal** (a real-estate deal vs an operating business need different docs)?
3. How do you want files organized — the current section/subfolder checklist, or also a **free-form folder tree** you can drag files into?
4. Capabilities:
   - ⬜ **Bulk upload** (drag a whole folder; auto-sort into sections) — **M / N / L / X**
   - ⬜ **Document versioning** (keep v1, v2… of the same doc, see history) — **M / N / L / X**
   - ⬜ **In-app document viewer** (read PDFs/Excel without downloading) — **M / N / L / X**
   - ⬜ **Full-text search / OCR** across all uploaded documents — **M / N / L / X**
   - ⬜ **Document requests** (send the company a checklist of what's missing, they upload directly) — **M / N / L / X**
   - ⬜ **Redaction** (black out sensitive info before sharing) — **M / N / L / X**
   - ⬜ Per-document **notes / comments** and an **assigned owner** — **M / N / L / X**

---

## D. Access control, sharing & investor access

*This is the heart of a "data room" — controlling who sees which documents. Current: ⬜ none yet (single shared login; files are internal-only).*

1. Do you need to **share a deal's data room with an outside investor/lender** and control exactly what they see? (This is the biggest "data room" feature.)
2. If yes — should different investors see **different document sets** for the same deal (tiered access: teaser → full diligence after NDA)?
3. Capabilities:
   - ⬜ **Invite an investor** by email to view a specific deal's data room — **M / N / L / X**
   - ⬜ **Granular permissions** per investor: view-only, download, print, or no access — per document/section — **M / N / L / X**
   - ⬜ **Expiring access** / time-limited links — **M / N / L / X**
   - ⬜ **Instant revoke** (cut off an investor's access immediately) — **M / N / L / X**
   - ⬜ **NDA gate** before an investor can enter (you already have NDA text on the login) — **M / N / L / X**
   - ⬜ **Dynamic watermarking** (investor's name/email stamped on every page they view) — **M / N / L / X**
   - ⬜ **"View-only / fence view"** (no download, screenshot-resistant viewing) — **M / N / L / X**

---

## E. Security & compliance

*Current: ✅ server-side password + session, all data isolated in a dedicated, transferable cloud project, files in private storage (signed-URL access only), nothing public.*

1. What's your bar for security messaging to investors — "bank-grade / SOC 2 / encrypted" language, or is a clean private login enough for now?
2. Capabilities:
   - ⬜ **Two-factor authentication (2FA)** on logins — **M / N / L / X**
   - ⬜ **Audit log** (immutable record of every view/download/login, exportable) — **M / N / L / X**
   - ⬜ **IP restrictions** (only allow access from certain locations) — **M / N / L / X**
   - ⬜ **KYC / AML / OFAC** screening tracking on counterparties — **M / N / L / X**
   - ⬜ **Data retention / auto-delete** after a deal closes — **M / N / L / X**
   - ⬜ Formal compliance posture (SOC 2 / GDPR data-residency choices) — **M / N / L / X**

---

## F. Q&A, collaboration & workflow

*How questions and tasks flow between you, your team, and counterparties. Current: ✅ basic Tasks tab (title, due date, priority, related deal); ⬜ no Q&A or comments.*

1. Today, how do diligence **questions from investors** reach you and how do you answer them — email? Do you want them tracked inside the platform?
2. Capabilities:
   - ⬜ **Q&A module** (investor submits a question against a deal/document; you assign, answer, close it; full thread history) — **M / N / L / X**
   - ⬜ **Comments / discussion threads** on a deal or document — **M / N / L / X**
   - ⬜ **Task assignment** to specific teammates with due dates & status — **M / N / L / X**
   - ⬜ **Approval workflows** (a doc must be reviewed/approved before it's shared) — **M / N / L / X**
   - ⬜ **@mentions / internal notes** vs investor-visible messages — **M / N / L / X**

---

## G. Analytics, tracking & reporting

*Current: ✅ pipeline metrics, deal performance tables, data-room completeness %, CSV/JSON/PDF export.*

1. What do you most want to **see at a glance** about your pipeline and each deal?
2. Capabilities:
   - ⬜ **Investor engagement tracking** — who viewed which document, when, how long ("interest heatmap") — **M / N / L / X**
   - ⬜ **Data-room readiness dashboard** across the whole portfolio (which deals are diligence-ready) — **M / N / L / X**
   - ⬜ **Activity feed** (recent uploads, status changes, investor visits) — **M / N / L / X**
   - ⬜ **Custom reports / exports** (per investor, per deal, per period) — **M / N / L / X**
   - ⬜ **Revenue forecasting** (weighted pipeline, expected fees over time) — **M / N / L / X**

---

## H. AI & automation

*Current: 🔶 the underwriting/screening engine is built in the UI but the AI is switched off (needs an API key). Modern data rooms increasingly include AI for the items below.*

1. You originally had an **AI underwriter** (drop documents → instant risk read, ratings, green/red flags, valuation, memo). Is turning that **back on** a priority? (We'd run it on the latest Claude model.)
2. Capabilities:
   - 🔶 **AI underwriting memo** from dropped documents (banker/investor fit, risk, valuation, flags, verdict) — **M / N / L / X**
   - ⬜ **AI document classification** (auto-file an uploaded doc into the right data-room slot) — **M / N / L / X**
   - ⬜ **AI completeness check** (read the docs, tell you what's actually missing or inconsistent) — **M / N / L / X**
   - ⬜ **Ask-the-data-room** (natural-language Q&A over a deal's documents, with citations) — **M / N / L / X**
   - ⬜ **AI redaction** (auto-detect & black out PII before sharing) — **M / N / L / X**
   - ⬜ **AI deal-readiness scoring** (predict how investor-ready a deal is) — **M / N / L / X**
   - ⬜ **AI document summaries** (one-paragraph summary of any uploaded file) — **M / N / L / X**

---

## I. Investor / lender relations

*Tracking the capital side — who you're raising from, not just the deals. Current: ✅ basic Contacts tab; ⬜ no investor pipeline.*

1. Do you keep a list of **investors / lenders / family offices** and track outreach (who you've pitched which deal, their interest, their criteria)?
2. Capabilities:
   - ⬜ **Investor CRM** (profiles, check size, sector/geo preferences, debt vs equity) — **M / N / L / X**
   - ⬜ **Match deals to investors** (surface which investors fit a given deal) — **M / N / L / X**
   - ⬜ **Outreach tracking** (status per investor per deal: contacted → interested → passed → committed) — **M / N / L / X**
   - ⬜ **Commitment / allocation tracking** (who's committed how much toward a raise) — **M / N / L / X**

---

## J. Notifications & reminders

*Current: ⬜ none (no email/alerts yet).*
- ⬜ **Email alerts** (new investor view, new Q&A, document uploaded, task due) — **M / N / L / X**
- ⬜ **Reminders** (follow-up on a deal, chase a missing required doc) — **M / N / L / X**
- ⬜ **Daily/weekly digest** of pipeline activity — **M / N / L / X**
- ⬜ **In-app notifications** — **M / N / L / X**

---

## K. Integrations
- ⬜ **E-signature** (DocuSign/equivalent for NDAs, term sheets) — **M / N / L / X**
- ⬜ **Email / calendar** (log emails to a deal; schedule from the app) — **M / N / L / X**
- ⬜ **Import from Google Drive / Dropbox** (pull existing deal folders in) — **M / N / L / X**
- ⬜ **Accounting / financial data** (QuickBooks, Plaid) — **M / N / L / X**
- ⬜ **External CRM** (HubSpot/Salesforce) sync — **M / N / L / X**
- ⬜ **Public API** (so other tools can connect) — **M / N / L / X**

---

## L. Branding, white-label & multiple clients

*We deliberately built this isolated/transferable so it can become its own product or move to another org.*
1. Should the platform carry **HGC & ARK branding** (logo, colors) — and would you ever want to **white-label** it for clients or partners under their brand?
2. Capabilities:
   - ⬜ **Custom branding** (your logo, colors, domain like `data.hgc….com`) — **M / N / L / X**
   - ⬜ **Multi-client / multi-tenant** (run separate, walled-off instances for different firms) — **M / N / L / X**
   - ⬜ **Per-deal branded investor portals** — **M / N / L / X**

---

## M. Mobile & UX
- ⬜ **Mobile-friendly** investor & team experience — **M / N / L / X**
- ⬜ **Dark mode / accessibility** — **M / N / L / X**
- Anything about the **current look & feel** you'd change? **____**

---

## N. Commercial, deployment & data ownership
1. Is this purely **internal for HGC & ARK**, or do you see it becoming a **product you sell / license**?
2. Where should it ultimately live — keep it where it is, or move to a domain like **`data.hgcark.com`**?
3. Any requirement around **owning/exporting all the data** at any time (we already keep it isolated and transferable)?
4. Roughly what's the **timeline** and which 2–3 capabilities above would move the needle most for you *right now*?

---

## P. Client portals, NCNDA e-signature & certificates

*A per-deal, client-facing link where the company raising capital can sign your NCNDA and upload their documents — without giving them access to the rest of your platform. (We're building a first version of this now: the portal enforces signing before upload; internal access stays soft-gated for now and can become a hard requirement later.)*

1. **NCNDA flow:** confirm the order — your internal team signs first (so it arrives "already signed by us"), then the client countersigns before they can upload anything. Is that right?
2. Who on your side counts as **"internal team" that must sign** — specific people, or any HGC partner? Should *all* of them be required, or is one authorized signer enough?
3. Is it a **single standing NCNDA** (same document every deal) or does the agreement text change per deal/client?
4. Do you want the signed certificate to be **legally robust** (counsel-reviewed text, audit trail, possibly a real e-sign provider like DocuSign), or is a clean in-house signature + tamper-evident certificate enough for now?
5. Capabilities:
   - 🔶 **Per-deal client upload link** (unique, client-facing, no full-platform access) — **M / N / L / X**
   - 🔶 **NCNDA gate** — client must sign before uploading/viewing anything — **M / N / L / X**
   - 🔶 **Multi-party signing** — internal team signs, then client signs, then it's finalized — **M / N / L / X**
   - 🔶 **Verifiable certificate** generated when all parties have signed (tamper-evident, with a verification link) — **M / N / L / X**
   - ⬜ **Hard gate** — eventually block *internal* platform/data access too if the NCNDA isn't signed — **M / N / L / X**
   - ⬜ **Real e-signature provider** (DocuSign/Dropbox Sign) for legal-grade signatures — **M / N / L / X**
   - ⬜ **Countersigned PDF** — produce a final signed PDF of the NCNDA itself (not just a certificate) — **M / N / L / X**
   - ⬜ **Per-document NDA** (different documents require different/additional agreements) — **M / N / L / X**
   - ⬜ **Client sees a checklist** of what to upload (your required-doc list) on their portal — **M / N / L / X**
   - ⬜ **Notify the team** when a client signs or uploads — **M / N / L / X**

---

## O. Anything else
What does this platform need to do that isn't captured above? What does a "perfect" version look like to you a year from now?

> _Reply in-line, or just talk me through it and I'll fill it in. Once you prioritize, I'll turn the **M**s into the next build phases._
