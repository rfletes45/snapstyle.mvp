# Security and Privacy

Last updated: 2026-02-18 (Segment 15)

## Scope

This document covers practical security controls for the client app, Firebase backend, and Colyseus server in this repository.

## Secrets and Config Hygiene

- `.env` and `.env.*` are ignored by default in `.gitignore` (except `*.example` templates).
- Service account key files are ignored via glob patterns:
  - `**/serviceAccountKey.json`
  - `**/service-account.json`
- `src/services/firebaseConfig.local.ts` contains Firebase client config. This is client bootstrap config (not a server private key), but it should still be treated as environment-specific configuration.
- Admin bootstrap/setup key policy:
  - `ADMIN_SETUP_KEY` must be configured in environment.
  - Weak placeholders are rejected (`SECRET`, `change-me`, `dev-secret-change-me`, etc.).
  - Minimum supported length is 16 characters.

## Auth and Authorization Controls

### Callable Functions (`onCall`)

- User-facing callables require `context.auth`.
- Admin callables require admin claims (`context.auth.token.admin == true`) where applicable.

### HTTP Admin/Migration Endpoints (`onRequest`)

The following endpoints are now explicitly protected:

- `seedDailyTasks`
- `initializeExistingWallets`
- `seedShopCatalog`
- `migrateGameInvites`
- `migrateGameInvitesDryRun`
- `rollbackGameInvitesMigration`

Accepted auth methods:

1. `Authorization: Bearer <firebase-id-token>` with `admin` custom claim.
2. `x-admin-setup-key` (or `secretKey` in body/query) matching secure `ADMIN_SETUP_KEY`.

`initializeFirstAdmin` requires the setup key path (`ADMIN_SETUP_KEY`) and no longer falls back to a hardcoded default.

## Firestore Least-Privilege Notes

The current ruleset already enforces strict access on sensitive collections (validated during Segment 15 spot audit):

- `IAPPurchases`: client read-own only; client update/delete denied.
- `RateLimits`, `LinkPreviews`: server-write patterns.
- `Reports` and moderation paths: restricted reads and admin-only mutation paths.
- `BugReports`: authenticated read restrictions and server-oriented write discipline.

Any new client write/query shape must still be checked against:

- `firebase-backend/firestore.rules`
- `firebase-backend/firestore.indexes.json`

## Logging and Privacy

- `fetchLinkPreview` function logs now sanitize URLs by stripping query/hash to reduce accidental token leakage.
- Admin/migration endpoints now fail closed for missing/invalid admin auth instead of allowing unauthenticated execution.
- Continue to avoid logging raw secrets, full auth tokens, full receipt payloads, and high-risk PII.

## Data Stored (High-Level)

- Account/profile data (`Users` and subcollections)
- Messaging artifacts (`Chats`, `Groups`, inbox/request projections)
- Gameplay/invite/session state (`GameInvites`, sessions/history/leaderboards)
- Commerce/economy (`Wallets`, `IAPPurchases`, shop/gift records)
- Operational debugging (`BugReports`, rate-limit/server logs)

## Retention Assumptions

- Retention appears policy-driven by feature (for example, some scheduled cleanup jobs exist for expired content and stale docs).
- No single global retention policy source-of-truth exists in code today.
- Treat retention as an explicit product/legal decision; document collection-specific policy before changing data lifecycles.

## Vulnerability Reporting Guidance

- Prefer private disclosure to project maintainers with:
  - affected files/paths
  - reproduction steps
  - impact assessment
  - proposed minimal remediation
- Do not include secrets, full tokens, or private user data in issue text or logs.
