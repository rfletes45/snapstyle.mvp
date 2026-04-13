# Vibe Documentation

Last verified: 2026-03-30

This folder is organized around current runtime truth first. Treat the files below as canonical unless a document is explicitly marked historical.

## Recommended Read Order

1. [system-overview.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/architecture/system-overview.md)
2. [runbook.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/operations/runbook.md)
3. [configuration-and-security.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/operations/configuration-and-security.md)
4. subsystem docs for the area you are changing

## Canonical Current-State Docs

### Architecture

- [system-overview.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/architecture/system-overview.md)
  - app bootstrap, provider tree, navigation, active subsystem map, source-of-truth boundaries
- [firebase-and-functions.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/backend/firebase-and-functions.md)
  - Firebase topology, Cloud Functions exports, Firestore families, Stream and Colyseus boundaries

### Features

- [auth-and-social.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/features/auth-and-social.md)
  - auth bootstrap, onboarding gate, friends, contacts discovery, profile viewing, camera/story status
- [calls-and-audio.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/features/calls-and-audio.md)
  - Stream direct calls, group voice channels, history, settings, gating, known rough edges
- [profile-economy.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/features/profile-economy.md)
  - widget-board profiles, cosmetics/customization, wallet, shop, tasks, achievements, appearance controls
- [CHAT_SYSTEM.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/CHAT_SYSTEM.md)
  - Consolidated chat reference: architecture, rendering, display modes, composer, reactions, keyboard, GIF, font colors, data contracts, inbox/unread, performance

### Profile Deep Reference

- [PROFILE_SYSTEM.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/PROFILE_SYSTEM.md)
  - cosmetics ownership, entitlements, equip flows, rendering contracts
- [PROFILE_SYSTEM_OVERVIEW.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/profile/PROFILE_SYSTEM_OVERVIEW.md)
  - profile doc entrypoint and terminology
- [WIDGET_BOARD_ARCHITECTURE.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/profile/WIDGET_BOARD_ARCHITECTURE.md)
- [PROFILE_WIDGETS_REFERENCE.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/profile/PROFILE_WIDGETS_REFERENCE.md)
- [DATA_AND_PERSISTENCE.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/profile/DATA_AND_PERSISTENCE.md)
- [INTERACTIONS_AND_EDIT_MODE.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/profile/INTERACTIONS_AND_EDIT_MODE.md)
- [PROFILE_HERO_CARD.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/profile/PROFILE_HERO_CARD.md)
- [SOCIAL_WIDGETS_AND_STREAKS.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/profile/SOCIAL_WIDGETS_AND_STREAKS.md)
- [MIGRATION_NOTES.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/profile/MIGRATION_NOTES.md)

### Operations

- [runbook.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/operations/runbook.md)
- [testing.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/operations/testing.md)
- [configuration-and-security.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/operations/configuration-and-security.md)
- [NOTIFICATION_SYSTEM.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/NOTIFICATION_SYSTEM.md)
- [STREAM_SETUP_GUIDE.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/STREAM_SETUP_GUIDE.md)

### Games

The Games V4 docs were audited during this pass and remain the canonical source for game architecture:

- [GAMES_V4_SYSTEM.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/GAMES_V4_SYSTEM.md)
- [GAMES_V4_RUNBOOK.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/GAMES_V4_RUNBOOK.md)
- [GAME_INTEGRATION_GUIDE_V4.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/GAME_INTEGRATION_GUIDE_V4.md)
- [REALTIME_FRAMEWORK.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/REALTIME_FRAMEWORK.md)

## Historical / Non-Canonical Docs

These files may still be useful as audits, plans, or incident notes, but they are not the source of truth for current behavior:

- `docs/CALL_SYSTEM_AUDIT_REFERENCE.md`
- `docs/QA_*`
- `docs/*AUDIT*.md`
- `docs/*PLAN*.md`
- `docs/*OVERHAUL*.md`

Use them only for background context, then reconcile against the current-state docs and the code.

## Maintenance Rules

- Update the matching doc in the same change as behavior or contract changes.
- Prefer current-state descriptions over roadmap language.
- Call out partial, experimental, dormant, or legacy systems explicitly.
- When two docs disagree, the code and the current-state docs win.
