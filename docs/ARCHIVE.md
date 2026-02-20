# Documentation Archive Policy

Last updated: 2026-02-19

This file replaces prior long-form historical writeups.

## What Was Archived/Pruned

The repository removed completed planning artifacts and redundant deep-dive duplicates, including:

- Legacy chat doc set under `docs/chat/`
- Large game change-log dumps under `docs/games/`
- One-off plan/QA docs (overhaul plans, integration plans, package wishlists)
- Duplicated subsystem variants that overlapped canonical docs

## Canonical Docs To Use Instead

- Architecture: `docs/01_ARCHITECTURE.md`
- Firebase/Rules/Functions: `docs/02_FIREBASE.md`, `docs/FIRESTORE_CONTRACT.md`, `docs/FUNCTIONS.md`
- Chat: `docs/CHAT_SYSTEM.md`, `docs/03_CHAT_V2.md`
- Profile: `docs/PROFILE_SYSTEM.md`
- Games: `docs/06_GAMES.md`, `docs/GAMES_PLATFORM.md`, `docs/COLYSEUS_SERVER.md`
- Configuration/Security/Testing: `docs/CONFIGURATION.md`, `docs/SECURITY_PRIVACY.md`, `docs/TESTING.md`
- Audit state: `docs/AUDIT_REPORT_2026-02-17.md`, `docs/DEPRECATION_MAP.md`

## How To Retrieve Removed Historical Material

Use git history when you need old planning detail:

```bash
git log -- docs/
git log --diff-filter=D --summary -- docs/
git show <commit>:docs/<old-file>.md
```

## Rule Going Forward

When implementation is complete, keep one canonical doc per subsystem and remove superseded plans/checklists instead of stacking more documents.
