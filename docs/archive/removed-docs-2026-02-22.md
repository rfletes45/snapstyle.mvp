# Removed Documentation Log (2026-02-22)

This repository documentation was aggressively condensed on 2026-02-22.

Reason:

- Too many historical plan/audit docs were overlapping, stale, or already implemented.
- Canonical docs were restructured under `docs/architecture`, `docs/backend`, `docs/features`, and `docs/operations`.

## Removed Files

- `docs/00_INDEX.md`
- `docs/01_ARCHITECTURE.md`
- `docs/02_FIREBASE.md`
- `docs/03_CHAT_V2.md`
- `docs/03_CHAT_V3.md`
- `docs/05_RUNBOOK.md`
- `docs/06_GAMES.md`
- `docs/ACHIEVEMENTS_V2.md`
- `docs/AI_PROJECT_GUIDE.md`
- `docs/ARCHIVE.md`
- `docs/AUDIT_CHECKLIST.md`
- `docs/AUDIT_REPORT_2026-02-17.md`
- `docs/CALLS_CAMERA.md`
- `docs/CHAT_POLISH_REVIEW.md`
- `docs/CHAT_SYSTEM.md`
- `docs/COLYSEUS_MULTIPLAYER_PLAN.md`
- `docs/COLYSEUS_SERVER.md`
- `docs/CONFIGURATION.md`
- `docs/CURRENT_PROFILE_SYSTEM_GUIDE.md`
- `docs/CURRENT_SYSTEM_DEEP_DIVE.md`
- `docs/DATA_CONTRACT_CLIENT.md`
- `docs/DEPRECATION_MAP.md`
- `docs/EMBEDDED_WEB_GAMES.md`
- `docs/FIRESTORE_CONTRACT.md`
- `docs/FUNCTIONS.md`
- `docs/GAME_SYSTEM_OVERHAUL_PLAN.md`
- `docs/GAME_SYSTEM_REFERENCE.md`
- `docs/GAMES_PLATFORM.md`
- `docs/NEW_PROFILE_SYSTEM_PLAN.md`
- `docs/PERFORMANCE.md`
- `docs/PLAY_SCREEN_OVERHAUL_PLAN.md`
- `docs/PLAY_SCREEN_RUNDOWN.md`
- `docs/PROFILE_SYSTEM.md`
- `docs/REPO_MAP.md`
- `docs/SECURITY_PRIVACY.md`
- `docs/SHOP_OVERHAUL_PLAN.md`
- `docs/SPECTATOR_SYSTEM_PLAN.md`
- `docs/TESTING.md`
- `docs/VISUAL_ENHANCEMENT_PACKAGES.md`

## How to Recover Historical Content

Use git history when you need old details:

```bash
# List prior versions of docs
git log -- docs

# View a removed file from before the cleanup
git show HEAD~1:docs/06_GAMES.md
```

The active source of truth is now the new docs tree rooted at `docs/README.md`.
