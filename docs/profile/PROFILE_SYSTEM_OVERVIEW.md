# Profile System Overview

Last verified: 2026-03-27

This is the **canonical entry point** for all Profile system documentation. Start here, then follow links to deeper docs.

## What the Profile System Is

The Profile system is how users express identity and view others within SnapStyle. It has two major surfaces:

1. **Own Profile** (`OwnProfileScreen`) — a fully customizable **widget board** where the user arranges profile widgets on a 4-column grid. Widgets can be dragged, resized, added, removed, and reordered.
2. **Other User Profile** (`UserProfileScreen`) — a read-only profile view with relationship-aware actions (add friend, message, call, block, report) and privacy-evaluated content.

The own-profile surface was rebuilt from a static card layout into a **dynamic widget board** in early 2026. The other-user profile remains a traditional scrollable card layout.

## Core Concepts

| Concept               | Description                                                                                                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Widget Board**      | A 4-column grid layout engine that hosts movable, resizable profile widgets. Persisted per-user in Firestore.                                                                             |
| **Profile Hero Card** | The mandatory, non-removable widget at the top of the board. Supports 3 sizes: wide (4×1), large (4×2), hero (4×4). Contains identity, level, status, and action buttons.                 |
| **Customize Mode**    | Entered via long-press on any widget. Enables drag-to-reorder, resize, add/remove widgets. Exited via Done (saves) or Cancel (reverts).                                                   |
| **Widget Gallery**    | A bottom sheet in customize mode listing all available widgets by category. Users add new widgets or restore hidden ones.                                                                 |
| **Widget Registry**   | Central metadata store defining every widget type: supported sizes, removability, category, max instances.                                                                                |
| **Cosmetic Layer**    | PFP, decorations, backgrounds, themes, badges, chat appearance — owned via entitlements, equipped via profile writes. Documented separately in [PROFILE_SYSTEM.md](../PROFILE_SYSTEM.md). |

## Major Surfaces

### Own Profile (Widget Board)

**Entry:** Profile tab → `OwnProfileScreen`

The own profile renders a `WidgetBoardContainer` that manages the full widget lifecycle:

- View mode: read-only, scrollable, widgets respond to taps (navigate to friends, badges, etc.)
- Customize mode: drag/drop reorder, resize handles, remove buttons, add-widget gallery

Default widget layout on first load:

1. Profile Hero Card (4×4 hero)
2. Social Proof / Streak Widget (4×1 wide)
3. Friends Card (2×2 medium)
4. Badges Card (2×2 medium)
5. Achievements Card (4×1 wide)

### Other User Profile (Traditional Layout)

**Entry:** Tap user avatar/name anywhere → `UserProfileScreen`

Traditional scrollable layout:

1. Profile header (avatar, name, bio, status, level, friendship info)
2. Relationship action bar (message, call, add friend, etc.)
3. Social proof section (streak + activity rows)
4. Overview cards (Friends, Badges, Achievements) — privacy-evaluated
5. Mutual friends section

### Customization & Shopping

- **Customization Hub** (`CustomizationHubScreen`) — equip-only, browse/equip owned cosmetics
- **Cosmetics Shop** (`CosmeticsShopScreen`) — purchase-only, buy new cosmetics with tokens
- Both are accessible from the hero card (Shop and Customize buttons) and via navigation

## Canonical Terminology

Use these terms consistently across all docs and code:

| Term              | Meaning                                    | Do NOT use                                                          |
| ----------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| Widget Board      | The 4-column grid layout system            | "profile layout", "card grid"                                       |
| Profile Hero Card | The main profile identity widget           | "profile header widget", "main card"                                |
| Customize Mode    | The drag/resize/add editing state          | "edit mode" (ambiguous with bio/picture editing)                    |
| View Mode         | The non-editing default state              | "read mode", "normal mode"                                          |
| Widget Gallery    | The add-widget bottom sheet                | "widget picker", "add widget modal"                                 |
| Streak Widget     | Social Proof widget showing friend streaks | "social proof card" (legacy name, widget type ID is `social-proof`) |
| Wide              | 4×1 widget size (88px tall)                | "horizontal", "banner"                                              |
| Large             | 4×2 widget size (184px tall)               | "big"                                                               |
| Hero              | 4×4 widget size (376px tall)               | "extra large", "full"                                               |
| Small             | 2×1 widget size (88px tall)                | "mini", "compact"                                                   |
| Medium            | 2×2 widget size (184px tall)               | "square"                                                            |

## Documentation Map

| Document                                                           | Covers                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **[WIDGET_BOARD_ARCHITECTURE.md](WIDGET_BOARD_ARCHITECTURE.md)**   | Grid model, layout engine, drag/reflow, resize, persistence, animation   |
| **[PROFILE_HERO_CARD.md](PROFILE_HERO_CARD.md)**                   | Hero card size variants, content per size, settings/actions, level bar   |
| **[PROFILE_WIDGETS_REFERENCE.md](PROFILE_WIDGETS_REFERENCE.md)**   | Every widget type: purpose, sizes, data, interactions, states            |
| **[INTERACTIONS_AND_EDIT_MODE.md](INTERACTIONS_AND_EDIT_MODE.md)** | View vs customize mode, drag, dwell, resize, sheets, gestures, gotchas   |
| **[DATA_AND_PERSISTENCE.md](DATA_AND_PERSISTENCE.md)**             | Firestore paths, widget layout storage, data sources per widget, privacy |
| **[SOCIAL_WIDGETS_AND_STREAKS.md](SOCIAL_WIDGETS_AND_STREAKS.md)** | Streak system integration, social data sources, activity feed            |
| **[MIGRATION_NOTES.md](MIGRATION_NOTES.md)**                       | What changed from old profile, deprecated docs/components                |

## Related Documents (Outside Profile Scope)

| Document                                                      | Relevance                                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| [PROFILE_SYSTEM.md](../PROFILE_SYSTEM.md)                     | Cosmetic ownership, entitlements, equip flows, rendering pipeline |
| [features/profile-economy.md](../features/profile-economy.md) | Privacy model, economy contracts, relationship/moderation         |
| [NOTIFICATION_SYSTEM.md](../NOTIFICATION_SYSTEM.md)           | Streak reminders, friend request notifications                    |
| [GAMES_V4_SYSTEM.md](../GAMES_V4_SYSTEM.md)                   | Achievement system, leaderboards (feeds profile widgets)          |

## Key Implementation Files

| File                                                          | Purpose                                          |
| ------------------------------------------------------------- | ------------------------------------------------ |
| `src/screens/profile/OwnProfileScreen.tsx`                    | Own profile entry point, widget data assembly    |
| `src/screens/profile/UserProfileScreen.tsx`                   | Other user profile entry point                   |
| `src/components/profile/WidgetBoard/WidgetBoardContainer.tsx` | Root board component                             |
| `src/components/profile/WidgetBoard/WidgetWrapper.tsx`        | Per-widget wrapper (drag, resize, edit controls) |
| `src/components/profile/WidgetBoard/BoardLayoutEngine.ts`     | Grid packing, conflict resolution, compaction    |
| `src/components/profile/WidgetBoard/useBoardState.ts`         | Mode management, dwell logic, layout actions     |
| `src/components/profile/WidgetBoard/useBoardPersistence.ts`   | Firestore load/save/sync                         |
| `src/components/profile/WidgetBoard/WidgetRegistry.ts`        | Widget type definitions and metadata             |
| `src/components/profile/WidgetBoard/WidgetGallery.tsx`        | Add/restore widget sheet                         |
| `src/components/profile/WidgetBoard/adapters.tsx`             | Widget content renderers per type and size       |
| `src/components/profile/WidgetBoard/types.ts`                 | TypeScript types, grid constants, size presets   |
| `src/hooks/useTopStreaks.ts`                                  | Real-time Firestore streak data subscription     |
| `src/components/profile/ProfileHeader/OwnProfileHeader.tsx`   | Standalone editable profile header               |
| `src/components/profile/ProfileHeader/UserProfileHeader.tsx`  | Read-only profile header for other users         |
| `src/components/profile/OverviewCards/`                       | Card components (Friends, Badges, Achievements)  |
