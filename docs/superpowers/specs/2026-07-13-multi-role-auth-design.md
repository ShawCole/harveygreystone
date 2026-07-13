# Multi-Role Auth & Provisioned Data Rooms — Design

**Date:** 2026-07-13
**Status:** Approved by Shaw
**Replaces:** single master password (`APP_PASSWORD`) + token-link client portal

## Problem

The platform has one master password shared by everyone and a token-link portal for clients. Clients need real accounts to upload documents (one-by-one and in batches), and access must be scoped: internal admins see everything, while team members, external lending partners, and clients see only the deals they are provisioned on.

## Roles

| Role | Data room scope | Capabilities | Provisioned by |
|---|---|---|---|
| **Admin** (internal) | All deals, always | Everything: deals, users, grants, statuses, uploads, pipeline, investors, contacts | Seeded / other admins |
| **Team** (internal) | Granted deals only | Full deal read/write within grants (docs, statuses, uploads, AI features). No user management, no deal create/delete | Admin grants per-deal |
| **Lender** (external) | Granted deals only | Data room view/download + upload (term sheets, LOIs). No statuses, no pipeline/investors/contacts | Admin grants per-deal |
| **Client** (external) | Own deal(s) only | Data room view/download + upload (their checklist + batch). No statuses | Bound at invite |

Notes:
- Clients currently see the full data room for their deal. Doc-level visibility flags (internal vs. shared) are a known follow-up for when internal analysis lives in data rooms — no such content exists today.
- All admins are equal; there is no super-admin tier.

## Auth Infrastructure

- **GCP Identity Platform** on project `dataroom-500817`, email/password provider only.
- **Invite-only:** self-signup disabled. Admins create accounts server-side; invitee receives a password-setup email link. Identity Platform handles password hashing, resets, brute-force protection.
- **Frontend:** Firebase Auth JS SDK via CDN script tag — vanilla JS, no build step.
- **Backend:** `firebase-admin` verifies the ID token on every API call, replacing the `hgc_session` cookie check.

## User Store

New `users` table in Cloud SQL (Postgres):

| Column | Type | Notes |
|---|---|---|
| `uid` | text PK | Identity Platform user ID |
| `email` | text unique | |
| `name` | text | |
| `role` | text | `admin` \| `team` \| `lender` \| `client` |
| `deal_grants` | integer[] | Deal IDs; ignored for admins |
| `status` | text | `active` \| `disabled` |
| `created_at`, `updated_at` | timestamptz | |

Postgres is the source of truth for role + grants (queryable, auditable). Backend loads the user per request with a short in-memory cache.

## Authorization Model

Single middleware on every API route: verify ID token → load user from Postgres → enforce role + deal grant.

- Deal-scoped endpoints (`deals`, `upload-url`, `download-url`, `file`, `classify-docs`, `underwrite`) check deal membership before acting.
- GCS signed URLs are minted only after the grant check — storage inherits the model.
- `GET /api/deals` filters server-side to granted deals; external users never receive other deals' data in any response.
- Status changes (received/reviewed/etc.) restricted to admin + team.
- User management endpoints restricted to admin.

## Login & Role-Scoped UI (one app)

Everyone logs in at `app.harveygreystone.com`. After login the app fetches `GET /api/me` (role + grants) and renders:

- **Admin/Team:** current sidebar app. Team sees only granted deals in every view (pipeline, dashboard, readiness).
- **Client/Lender:** slim view — no sidebar nav; their data room(s) only: funding-type checklist, batch upload zone with AI classification (same flow as admin side), full data room tree, download links. Multiple grants → simple deal picker first.

### NCNDA gate

- On first access to each deal, **clients and lenders both** must sign the NCNDA before the data room unlocks.
- Signature recorded per user: uid, email, name, title, timestamp, IP, hash — same tamper-evident scheme as today (`_ncnda.js`).
- Agreement text is unchanged (pending lawyer review, per standing instruction).
- `portal.html` and portal token endpoints retire; old token links show a notice redirecting to log in.

## User Management (admin UI)

- New **Users** view in the sidebar, admin-only: invite user (email, name, role, deal grants) → creates account + sends password-setup email; edit role/grants; deactivate (disables login immediately).
- Deal detail modal gains an **Access** sub-tab: who can see this deal, add/remove grants.

## Migration & Cutover

1. Ship backend + frontend with Identity Platform auth.
2. Seed three admins: `shaw@harveygreystone.com`, `ethan@harveygreystone.com`, `noah@harveygreystone.com` — each receives a password-setup email.
3. Verify all three can log in → remove the `APP_PASSWORD` code path entirely (master password retires; no transition backdoor).
4. Retire portal token endpoints.

**Rollback:** redeploy the previous Cloud Run revision — password auth restores instantly.

## Error Handling

- Invalid/expired token → 401; frontend redirects to login.
- Valid token, no grant on requested deal → 403 with generic message (no deal existence leak).
- Disabled user → 403 on every call regardless of token validity.
- Identity Platform outage → auth fails closed (no fallback password).

## Testing

- Backend: per-role authorization tests against each deal-scoped endpoint (admin/team/lender/client × granted/not-granted).
- Signed-URL minting refuses non-granted deals.
- `GET /api/deals` returns only granted deals per role.
- NCNDA gate blocks data room API access for unsigned external users.
- Cutover check: all three admin accounts log in before `APP_PASSWORD` removal.

## Known Follow-Ups (out of scope)

- Doc-level visibility flags (internal vs. shared) for client-facing data rooms
- Custom SMTP so invite/reset emails send from `@harveygreystone.com` (default sender is `noreply@dataroom-500817.firebaseapp.com`)
- Email notifications to internal team when a client uploads
- Per-user audit log of views/downloads
- Lawyer-reviewed NCNDA template text
