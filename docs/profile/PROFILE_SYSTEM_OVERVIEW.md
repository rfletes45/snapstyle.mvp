# Profile System Overview

Last verified: 2026-03-30

This is the canonical entry point for the current profile system docs.

## What The Profile System Is Today

The profile system has two live surfaces built on the same board infrastructure:

1. own profile
   - editable widget board
   - drag, resize, add, hide, and restore widgets
2. viewed profile
   - target user’s saved board rendered in read-only mode
   - synthetic viewer-actions widget appended at the bottom

This is the biggest correction from older docs: `UserProfileScreen` is no longer a separate traditional card-stack architecture.

## Core Concepts

### Widget board

A 4-column board of widget instances persisted per user at `Users/{uid}/ProfileLayout/board`.

### Widget instance

A placed widget with:

- widget type
- size
- grid position
- visibility flag
- timestamps

### Read-only board mode

The same board system running without customization controls. This is how viewed profiles work today.

### Synthetic viewer-actions widget

A non-persisted widget injected on viewed profiles to show relationship and action controls.

## Current Widget Types

- `profile-header`
- `social-proof`
- `friends`
- `badges`
- `achievements`
- `mutual-friends`
- `favorite-game`
- `profile-stats`
- `recent-activity`
- `viewer-actions`
- `tasks-overview`
- `wallet-balance`
- `theme-mode`
- `chat-layout-mode`

## Documentation Map

- [WIDGET_BOARD_ARCHITECTURE.md](WIDGET_BOARD_ARCHITECTURE.md)
  - grid model, layout engine, persistence, read-only behavior
- [PROFILE_WIDGETS_REFERENCE.md](PROFILE_WIDGETS_REFERENCE.md)
  - widget inventory, visibility, sizing, and data notes
- [DATA_AND_PERSISTENCE.md](DATA_AND_PERSISTENCE.md)
  - Firestore layout storage and widget data sources
- [INTERACTIONS_AND_EDIT_MODE.md](INTERACTIONS_AND_EDIT_MODE.md)
  - gestures, customize mode, dwell timing, viewer restrictions
- [PROFILE_HERO_CARD.md](PROFILE_HERO_CARD.md)
  - `profile-header` widget behavior
- [SOCIAL_WIDGETS_AND_STREAKS.md](SOCIAL_WIDGETS_AND_STREAKS.md)
  - streaks, friends, mutual friends, recent activity, viewer actions
- [MIGRATION_NOTES.md](MIGRATION_NOTES.md)
  - how to interpret older profile references

Related docs outside this folder:

- [../PROFILE_SYSTEM.md](../PROFILE_SYSTEM.md)
- [../features/profile-economy.md](../features/profile-economy.md)
- [../features/custom-font-color.md](../features/custom-font-color.md)
- [../features/conversation-display-modes.md](../features/conversation-display-modes.md)

## Key Files

- [OwnProfileScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/profile/OwnProfileScreen.tsx)
- [UserProfileScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/profile/UserProfileScreen.tsx)
- `src/components/profile/WidgetBoard/WidgetBoardContainer.tsx`
- `src/components/profile/WidgetBoard/WidgetWrapper.tsx`
- `src/components/profile/WidgetBoard/useBoardState.ts`
- `src/components/profile/WidgetBoard/useBoardPersistence.ts`
- `src/components/profile/WidgetBoard/WidgetRegistry.ts`
- `src/components/profile/WidgetBoard/BoardLayoutEngine.ts`

## Current-State Rules To Preserve

1. The board document is the saved layout source of truth.
2. Viewed profiles must stay read-only; they should not write defaults or persist changes to another user’s layout.
3. `viewer-actions` is synthetic and should not be persisted into the target user’s layout.
4. The profile header widget is non-removable.
