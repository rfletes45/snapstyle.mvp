# Chat System — Complete Reference

> Consolidated chat system documentation for SnapStyle MVP.
> Covers architecture, rendering, composer, reactions, keyboard, GIF integration,
> custom font colors, data contracts, inbox/unread, threading, notifications,
> performance, known issues, and sustaining roadmap.

Last verified: 2026-04-12

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [File Inventory](#3-file-inventory)
4. [Navigation & Chat Entry Performance](#4-navigation--chat-entry-performance)
5. [Runtime Architecture](#5-runtime-architecture)
6. [Chat Screens & Shared Foundation](#6-chat-screens--shared-foundation)
7. [Send Pipeline & Message Flow](#7-send-pipeline--message-flow)
8. [Display Modes — Bubbles vs Stacked](#8-display-modes--bubbles-vs-stacked)
9. [Grouped Card System (Stacked Mode)](#9-grouped-card-system-stacked-mode)
10. [Composer System](#10-composer-system)
11. [Keyboard Architecture](#11-keyboard-architecture)
12. [Reaction System](#12-reaction-system)
13. [GIF Integration (KLIPY)](#13-gif-integration-klipy)
14. [Custom Font Color System](#14-custom-font-color-system)
15. [Message Features](#15-message-features)
16. [Data Contracts](#16-data-contracts)
17. [Inbox & Unread System](#17-inbox--unread-system)
18. [Thread System](#18-thread-system)
19. [Notification Integration](#19-notification-integration)
20. [Backend Integration](#20-backend-integration)
21. [Performance & Instrumentation](#21-performance--instrumentation)
22. [Test Coverage](#22-test-coverage)
23. [Known Issues & Risks](#23-known-issues--risks)
24. [Sustaining Roadmap](#24-sustaining-roadmap)
25. [Historical Checkpoints](#25-historical-checkpoints)

---

## 1. System Overview

### Current Status

| Area                                       | Status                                                       |
| ------------------------------------------ | ------------------------------------------------------------ |
| Native messaging runtime (SQLite-first)    | Implemented and primary                                      |
| Web messaging runtime (Firestore fallback) | Implemented as compatibility path                            |
| Inbox aggregation backend                  | Implemented                                                  |
| Inbox aggregation client default           | Not yet switched on (`CHAT_INBOX_AGGREGATION = false`)       |
| DM + group detail screens                  | Unified around shared `MessageV2` foundation                 |
| Threads                                    | Implemented (specialized screen)                             |
| Display modes (Bubbles + Stacked)          | Implemented, viewer-side setting                             |
| Grouped card system                        | Implemented with adaptive width snapping and corner rounding |
| Composer toolbar customization             | Implemented with drag-and-drop editing                       |
| GIF picker (KLIPY)                         | Implemented behind feature flag                              |
| Custom font colors                         | Implemented with 16-color catalog                            |
| Reactions                                  | Implemented with optimistic UI                               |

### Scope

This document covers:

- DM chat and group chat
- Inbox and unread behavior
- Message requests
- Reactions, voice notes, mentions, attachments, and scheduled messages
- Composer toolbar customization
- Keyboard architecture
- GIF/sticker integration
- Custom font color system
- Display modes (Bubbles vs Stacked)
- Grouped card rendering system
- Notification interactions tied to chat
- Data contracts and normalization layers
- Performance instrumentation
- Known issues and sustaining roadmap

### Canonical Model

Both DM and group conversations use the same message shape at the screen/render boundary:

- `MessageV2` in `src/types/messaging.ts`

This means:

- `ChatScreen.tsx` and `GroupChatScreen.tsx` both build timelines from `MessageV2`
- DM no longer converts into a separate legacy display-only message model
- `MessageActionsSheet` receives canonical messages in both scopes

---

## 2. Architecture

### High-Level System Map

```
┌──────────────────────────────────────────────────────────────────┐
│                     Navigation Layer                             │
│  MainTab → InboxStack → ChatListScreenV2                         │
│         │                 ├─ ChatScreen (DM)          ← MainStack│
│         │                 ├─ GroupChatScreen (group)   ← MainStack│
│         │                 └─ ThreadScreen             ← MainStack│
│         │                                                        │
│         └─ freezeOnBlur: true (inactive screens frozen)          │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Runtime Layer                                │
│  useChat ─┬─ useLocalMessages (native, SQLite-first)             │
│           └─ useUnifiedMessages (web, Firestore fallback)        │
│                                                                  │
│  useInboxData ─┬─ fan-out mode (subscribe Chats + Groups)        │
│                └─ aggregated mode (Users/{uid}/Inbox/*)           │
│                                                                  │
│  useUnifiedInboxRequests (friend + group + message requests)     │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Render Layer                                 │
│  buildTimeline() → TimelineItem[] (grouping flags + dividers)    │
│         │                                                        │
│         ├─ Bubble mode → DMMessageItem / GroupChatScreen inline   │
│         └─ Stacked mode → StackedMessageRenderer /               │
│                           GroupStackedMessageRenderer             │
│              └─ Grouped Card System (CardWidthTracker, snap,     │
│                 adaptive corner rounding)                        │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Backend Layer                                │
│  sendMessageV2 (Cloud Function) → Firestore write + triggers     │
│  inboxTriggers → per-user aggregated inbox update                │
│  toggleReactionV2 → reaction subcollection + summary update      │
│  notificationCenter → channel routing (in-app / push / none)     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. File Inventory

### Screens

| File                                           | Purpose                                                |
| ---------------------------------------------- | ------------------------------------------------------ |
| `src/screens/chat/ChatListScreenV2.tsx`        | Inbox list with conversations + requests tabs          |
| `src/screens/chat/ChatScreen.tsx`              | DM chat detail screen                                  |
| `src/screens/groups/GroupChatScreen.tsx`       | Group chat detail screen                               |
| `src/screens/chat/ThreadScreen.tsx`            | Thread/reply view                                      |
| `src/screens/chat/ScheduledMessagesScreen.tsx` | Scheduled messages management                          |
| `src/screens/chat/InboxSettingsScreen.tsx`     | Inbox-level settings                                   |
| `src/screens/chat/ChatSettingsScreen.tsx`      | Per-chat settings                                      |
| `src/screens/groups/GroupChatInfoScreen.tsx`   | Group info/settings with fixed-hero cover-sheet layout |

### Components

| File                                                  | Purpose                                                  |
| ----------------------------------------------------- | -------------------------------------------------------- |
| `src/components/chat/ChatHeader.tsx`                  | Shared header scaffold                                   |
| `src/components/chat/ChatMessageList.tsx`             | Inverted FlatList wrapper                                |
| `src/components/chat/ChatComposer.tsx`                | Composer UI (text input, toolbar, attachments)           |
| `src/components/chat/ChatMessageRenderer.tsx`         | DM entry point — delegates to Stacked or Bubble renderer |
| `src/components/chat/MessageActionsSheet.tsx`         | Long-press action sheet with quick reactions             |
| `src/components/chat/SystemMessageChip.tsx`           | System message presentation                              |
| `src/components/DMMessageItem.tsx`                    | DM bubble-mode message renderer                          |
| `src/components/chat/StackedMessageRenderer.tsx`      | DM stacked-mode message renderer with card containers    |
| `src/components/chat/GroupStackedMessageRenderer.tsx` | Group stacked-mode message renderer with card containers |
| `src/components/chat/ReactionBar.tsx`                 | ReactionPills + QuickReactionBar                         |
| `src/components/chat/ReactionDetailSheet.tsx`         | Modal showing who reacted per emoji                      |
| `src/components/chat/ThreadIndicator.tsx`             | "View thread (N replies)" link                           |
| `src/components/chat/DateDivider.tsx`                 | Day separator                                            |
| `src/components/chat/ChatKeyboardScrollView.tsx`      | KCSV adapter + ChatFooterWrapper + isKCSVAvailable       |
| `src/components/chat/PickerLoadingFallback.tsx`       | Suspense fallback for lazy-loaded picker buttons         |
| `src/components/chat/lazyChatComponents.tsx`          | React.lazy wrappers for picker sheets (GIF, emoji, etc)  |

### Hooks & Services

| File                                                  | Purpose                                                   |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `src/hooks/useChat.ts`                                | Runtime selector — delegates to local or unified messages |
| `src/hooks/useLocalMessages.ts`                       | SQLite-first message runtime (native)                     |
| `src/hooks/useUnifiedMessages.ts`                     | Firestore-first message runtime (web fallback)            |
| `src/hooks/useUnifiedChatScreen.ts`                   | Shared screen scaffold hook                               |
| `src/hooks/useInboxData.ts`                           | Inbox runtime selector (fan-out or aggregated)            |
| `src/hooks/useInboxAggregation.ts`                    | Aggregated inbox mode                                     |
| `src/hooks/useUnifiedInboxRequests.ts`                | Unified requests stream                                   |
| `src/hooks/useConversationActions.ts`                 | Conversation action handlers                              |
| `src/hooks/useFontColor.ts`                           | Custom font color hook                                    |
| `src/hooks/useChatKeyboard.ts`                        | Keyboard SharedValues + JS state                          |
| `src/services/chat/normalizeMessage.ts`               | Canonical message normalization                           |
| `src/services/chat/normalizeInboxRow.ts`              | Canonical inbox row normalization                         |
| `src/services/chat/fanoutInboxNormalization.ts`       | Fan-out inbox normalizers                                 |
| `src/services/chat/unifiedInboxRequests.ts`           | Request merge + dedupe                                    |
| `src/services/chat/messageRequestsContract.ts`        | Message request normalization                             |
| `src/services/chat/threadIdentityWarmup.ts`           | Pre-navigation identity/asset warmup                      |
| `src/services/chat/unifiedMessagesLifecycle.ts`       | Realtime + pagination merge                               |
| `src/services/chat/inboxAggregation.ts`               | Aggregated inbox mark-read                                |
| `src/services/messaging/send.ts`                      | Send orchestration (web path)                             |
| `src/services/messaging/subscribe.ts`                 | Firestore realtime subscriptions                          |
| `src/services/messaging/messageMerge.ts`              | Merge helper                                              |
| `src/services/reactions.ts`                           | Reaction service (toggle, subscribe, optimistic)          |
| `src/services/notifications/normalizeNotification.ts` | Notification payload adapter                              |
| `src/services/profileService.ts`                      | Profile + equip/unequip font color                        |
| `src/services/groupMembers.ts`                        | Group member state normalization                          |
| `src/services/scheduledMessages.ts`                   | Scheduled messages service                                |
| `src/hooks/chat/useTwoPhaseListConfig.ts`             | Two-phase FlatList config (conservative → full)           |
| `src/services/outbox.ts`                              | Optimistic outbox (web)                                   |
| `src/services/messageList.ts`                         | Message list service (web)                                |
| `src/services/sync/syncEngine.ts`                     | SQLite sync engine (native)                               |

### Chat Logic

| File                        | Purpose                                                  |
| --------------------------- | -------------------------------------------------------- |
| `src/chat/buildTimeline.ts` | Precomputes grouping flags + date dividers               |
| `src/chat/displayMode.ts`   | Layout tokens, MessageViewModel, buildMessageViewModel() |
| `src/chat/sendDraft.ts`     | Shared send orchestration (DM + group)                   |

### Grouped Card System

| File                                          | Purpose                                             |
| --------------------------------------------- | --------------------------------------------------- |
| `src/components/chat/useGroupedCardLayout.ts` | Shared React hook for card layout                   |
| `src/components/chat/groupedCardLayout.ts`    | Pure utility functions (radii, snap, normalization) |
| `src/components/chat/CardWidthTracker.ts`     | Graph-based width measurement + pub/sub             |
| `src/components/chat/estimateMessageWidth.ts` | Pre-mount width estimation for cold-cache rows      |

### Composer & Toolbar

| File                                            | Purpose                           |
| ----------------------------------------------- | --------------------------------- |
| `src/components/chat/ChatComposer.tsx`          | Main composer component           |
| `src/components/chat/ComposerToolbar.tsx`       | Customizable toolbar rendering    |
| `src/components/chat/ComposerToolbarEditor.tsx` | Edit/drag-and-drop toolbar editor |
| `src/hooks/useComposerToolbar.ts`               | Toolbar state management hook     |

### GIF Integration

| File                                     | Purpose                             |
| ---------------------------------------- | ----------------------------------- |
| `src/components/chat/GifPicker.tsx`      | GIF search/browse UI                |
| `src/components/chat/GifPickerSheet.tsx` | Bottom sheet wrapper for GIF picker |
| `src/components/chat/GifGrid.tsx`        | Masonry grid for GIF results        |
| `src/components/chat/GifPreview.tsx`     | Individual GIF cell                 |
| `src/services/gifService.ts`             | KLIPY API client                    |
| `src/hooks/useGifPicker.ts`              | GIF picker state management         |
| `src/services/gifCacheService.ts`        | GIF result caching                  |

### Cosmetics

| File                                      | Purpose                                  |
| ----------------------------------------- | ---------------------------------------- |
| `src/cosmetics/types.ts`                  | ChatAppearance, SenderStyle types        |
| `src/cosmetics/chatCatalog.ts`            | CHAT_FONT_COLOR_CATALOG                  |
| `src/cosmetics/chatDefaults.ts`           | CHAT_FONT_COLORS map, getChatFontColor() |
| `src/cosmetics/chatAppearanceResolver.ts` | fontColorHex resolver + sanitizer        |

### Performance

| File                                            | Purpose                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `src/utils/chatPerf.ts`                         | Lightweight perf instrumentation (mount/focus/buildTimeline timing) |
| `src/hooks/chat/useTwoPhaseListConfig.ts`       | Two-phase FlatList promotion with chatPerf instrumentation          |
| `src/components/chat/PickerLoadingFallback.tsx` | Suspense fallback for lazy-loaded picker buttons (260px spinner)    |
| `src/components/chat/lazyChatComponents.tsx`    | React.lazy wrappers — code-split picker sheets from chat bundle     |

### Backend

| File                                                   | Purpose                                 |
| ------------------------------------------------------ | --------------------------------------- |
| `firebase-backend/functions/src/messaging.ts`          | sendMessageV2, toggleReactionV2         |
| `firebase-backend/functions/src/messageRequests.ts`    | Message request endpoints               |
| `firebase-backend/functions/src/inboxTriggers.ts`      | Per-user aggregated inbox triggers      |
| `firebase-backend/functions/src/chatMedia.ts`          | Chat media upload/finalization          |
| `firebase-backend/functions/src/notificationCenter.ts` | Notification routing (in-app/push/none) |
| `firebase-backend/functions/src/notifications.ts`      | Legacy DM/group push triggers           |

---

## 4. Navigation & Chat Entry Performance

### Navigate-First Pattern

Navigation from the inbox to a chat screen follows a **navigate-first** pattern:

1. `ChatListScreenV2.handleConversationPress` calls `navigation.navigate()` immediately
2. Identity/asset warmup (`prepareDmThreadEntry`, `prepareGroupChatNavigation` from `threadIdentityWarmup.ts`) runs in the background as fire-and-forget
3. Cached data (name, avatar, group metadata) is passed via nav params as `initialData` / `initialGroupData` for instant display before subscriptions deliver full data

### Deferred Mount Work

Both `ChatScreen` and `GroupChatScreen` defer non-critical work via `InteractionManager.runAfterInteractions()`:

- `markConversationNotificationsRead` — deferred until transition completes
- `getGroupMemberPrivate` (group only) — deferred member preferences read
- Background profile refresh on DM re-focus — deferred

### Screen Freeze on Blur

The `MainStack` navigator uses `freezeOnBlur: true`, which freezes inactive screens via `react-native-screens`. When navigating Chat → Thread or Chat → GroupInfo, the chat screen receives no React re-renders, effects, or state updates. Return-to-chat is near-instant (native view unfreeze).

### Performance Instrumentation

Performance is instrumented via `chatPerf` (`src/utils/chatPerf.ts`) at mount, focus, and `buildTimeline` call sites. Console logs tagged `⏱ chatPerf`.

Key measurement points:

- `chatPerf.mark("group-chat-mount")` / `chatPerf.mark("dm-chat-mount")` — screen constructor
- `chatPerf.trackMount(screenName, conversationId)` — confirms new instance vs resume
- `chatPerf.trackFocus(screenName, conversationId, wasAlreadyMounted)` — focus events
- `chatPerf.time("group-buildTimeline", () => buildTimeline(...))` — timeline cost

---

## 5. Runtime Architecture

### Message Runtime Selector

Entry hook: `src/hooks/useChat.ts`

- **Native default** (`USE_LOCAL_STORAGE=true`):
  - `useLocalMessages` (`src/hooks/useLocalMessages.ts`)
  - SQLite repositories under `src/services/database/*`
  - Sync bridge: `src/services/sync/syncEngine.ts`
- **Fallback** (`USE_LOCAL_STORAGE=false`, web path):
  - `useUnifiedMessages` (`src/hooks/useUnifiedMessages.ts`)
  - Firestore realtime via `src/services/messaging/subscribe.ts`

Both paths normalize into canonical `MessageV2` with shared comparison and dedupe logic from `src/services/chat/normalizeMessage.ts`.

**Important invariant**: One conversation screen should have one active message owner. The `useChat` implementation enforces that split.

### Inbox Runtime Selector

Entry hook: `src/hooks/useInboxData.ts`

- **Fan-out mode** (`CHAT_FEATURES.CHAT_INBOX_AGGREGATION=false`):
  - Subscribes to `Chats` and `Groups`
  - Joins member private state from `MembersPrivate`
  - Uses shared fan-out normalizers in `src/services/chat/fanoutInboxNormalization.ts`
- **Aggregated mode** (`CHAT_FEATURES.CHAT_INBOX_AGGREGATION=true`):
  - `useInboxAggregation` (`src/hooks/useInboxAggregation.ts`)
  - Reads `Users/{uid}/Inbox/*`
  - Still pulls `MembersPrivate` for authoritative unread and settings parity

Both modes produce the same `InboxConversation` shape via `src/services/chat/normalizeInboxRow.ts`.

### Requests Runtime

Unified requests source:

- `src/hooks/useUnifiedInboxRequests.ts`
- Merge and sort contract: `src/services/chat/unifiedInboxRequests.ts`

Merged sources:

- Friend requests (`useFriendRequests`)
- Group invites (`subscribeToPendingInvites`)
- Message requests (`useMessageRequests`)

The requests tab in `ChatListScreenV2` renders this single typed stream with:

- Stable item key format: `{kind}:{id}`
- Pull-to-refresh calls unified refresh
- Per-kind action handlers (friend: accept/decline, group invite: accept/decline + navigate, message request: accept/decline callables)

### Notification Runtime

- **Push tap normalization and navigation**: `src/store/AuthContext.tsx` → adapter: `src/services/notifications/normalizeNotification.ts`
- **Foreground in-app notifications**: `src/store/InAppNotificationsContext.tsx` with listeners for friend requests, chat updates, group updates, and `Users/{uid}/InAppNotificationsV4`
- **Legacy DM/group push triggers**: `firebase-backend/functions/src/notifications.ts`

Note: `CHAT_LEGACY_PUSH_ENABLED` was documented as an env flag for gating legacy push triggers but has no implementation in the codebase. Legacy push triggers are not separately gated.

### Runtime Mode Parity Guarantees

The following parity guarantees are explicit and test-backed:

1. Same canonical message shape from SQLite rows and Firestore docs
2. Same ordering rules in all runtime paths
3. Same dedupe semantics for pagination and realtime overlap
4. Same inbox row shape across fan-out and aggregated modes
5. Same unread computation function across inbox data sources
6. Same request tab semantics regardless of source-specific backend behavior

---

## 6. Chat Screens & Shared Foundation

### Shared Screen Scaffold

The main DM and group detail screens share these top-level building blocks:

- `useUnifiedChatScreen.ts` — shared screen state hook
- `ChatHeader.tsx` — shared header
- `ChatMessageList.tsx` — inverted FlatList wrapper
- `ChatComposer.tsx` — composer with toolbar
- `MessageActionsSheet.tsx` — long-press action sheet
- `SystemMessageChip.tsx` — system message presentation

### Shared Message Flow

1. `useUnifiedChatScreen` exposes canonical `MessageV2[]`
2. Screens derive any scope-specific display metadata
3. `buildTimeline.ts` inserts grouping flags and date dividers
4. System messages render through `SystemMessageChip`
5. Non-system messages render through shared/canonical message components

### Shared Send Flow

DM and group screens share send orchestration through `sendDraft.ts`:

- Draft send for text + tray attachments
- Direct media sends from camera/gallery bypass paths
- Voice sends
- Animal signal sends

Scope-specific behavior is injected instead of forked:

- DMs call the shared path with no mention decoration
- Groups add mention extraction via `buildTextOptions` and `buildAttachmentOptions`

### Shared Persistence/Runtime

The runtime split is:

- **Native**: `useChat` → `useLocalMessages` → SQLite + sync engine
- **Web**: `useChat` → `useUnifiedMessages` → Firestore compatibility services

Both screen types consume the same `useChat` surface even though the storage backend differs by platform.

### Shared vs Scope-Specific Responsibilities

**Universal chat logic** (should stay shared):

- Message envelope and normalization
- Timeline/date-divider construction
- Top-level header scaffold
- List virtualization and return-to-bottom behavior
- Composer shell and reply-preview UI
- Message action sheet
- Media viewer wiring
- Reactions subscription model
- Retry / optimistic send plumbing
- System-message presentation

**DM-specific logic**:

- Presence and last-seen subtitle
- Reciprocal read/delivery receipt display
- Direct-call entry point
- Block/report actions
- Personalized empty state copy

**Group-specific logic**:

- Member identity lookup across many senders
- Mentions and autocomplete
- Group role / permission checks
- Moderation/admin capabilities
- Show-member-chat-styles preference
- Group info / permissions routes
- Voice-room occupancy and join/start controls

### Member-State Contract

**Public state** (`Chats/{chatId}/Members/{uid}` or `Groups/{groupId}/Members/{uid}`):

- Canonical typing field: `typingAt`
- Canonical delivery watermark: `lastDeliveredAtPublic`
- Canonical read watermark: `lastReadAtPublic`

Migration detail: group reads still tolerate legacy `typingExpiresAt`; group writes stamp both `typingAt` and `typingExpiresAt` for compatibility. New code should treat `typingAt` as the canonical field.

**Private state** (`MembersPrivate/{uid}`) — owner-only source for:

- Mute/archive/pin
- Private unread watermarks
- Notification overrides
- Show-member-chat-styles

### Render Architecture

**DM rendering**: Canonical `MessageV2` all the way down:

- `ChatScreen.tsx` → `ChatMessageRenderer.tsx` → `DMMessageItem.tsx` (bubble) or `StackedMessageRenderer.tsx` (stacked)

**Group rendering**: `MessageV2` with multi-sender identity, mentions, permissions-aware actions:

- `GroupChatScreen.tsx` → `GroupStackedMessageRenderer.tsx` (stacked) or inline bubble renderer

### Reaction Subscription Stability

Both chat screens stabilize their reaction `useEffect` dependency using a `reactionTargetKey` — a memoized sorted comma-joined string of visible message IDs. This prevents the subscription from tearing down and re-subscribing on every `messages` array reference change.

### GroupChatInfoScreen — Fixed-Hero Cover-Sheet Architecture

`src/screens/groups/GroupChatInfoScreen.tsx` uses a **counter-translate cover-sheet** pattern so the hero section (group avatar, name, action buttons) stays visually fixed while the content sheet scrolls up to cover it.

#### Layer Model

```
┌──────────────────────────────────────────────────────────────────┐
│  Layer 1 — fixedHeroBg (absolute, zIndex: 0, pointerEvents: none)│
│  Background image + LinearGradient only. No interactive elements.│
└──────────────────────────────────────────────────────────────────┘
         ▼ (painted first)
┌──────────────────────────────────────────────────────────────────┐
│  Layer 2 — Animated.ScrollView                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Spacer (height: heroSpacerHeight)                         │  │
│  │    └─ Animated.View (heroFixedContent)                     │  │
│  │         translateY: +scrollY  → stays visually fixed       │  │
│  │         Contains: avatar, name, edit buttons, voice room   │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Content sheet (opaque bg, minHeight: windowHeight)        │  │
│  │    Members, settings, permissions, leave/delete buttons    │  │
│  │    Painted AFTER spacer → covers hero via painter's order  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
         ▲ (painted last)
┌──────────────────────────────────────────────────────────────────┐
│  Floating header (absolute, zIndex: 10)                          │
│  Back button + animated title opacity                            │
└──────────────────────────────────────────────────────────────────┘
```

#### How the Counter-Translate Works

The hero content lives **inside** the ScrollView spacer. As the user scrolls, the spacer moves up with scroll content. The hero applies `translateY: +scrollY`, perfectly counteracting the scroll displacement so it appears motionless:

```ts
const clampedSpacerHeight = Math.max(heroSpacerHeight, 1);
const heroFixedTranslateY = scrollY.interpolate({
  inputRange: [0, clampedSpacerHeight],
  outputRange: [0, clampedSpacerHeight],
  extrapolate: "clamp",
});
```

The content sheet is the next sibling after the spacer inside the ScrollView. Because it is painted **after** the hero, it naturally covers it as the user scrolls — no z-index manipulation needed.

#### Key Design Decisions

| Decision                                             | Rationale                                                                        |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| Hero inside ScrollView (not absolute overlay)        | Touch events work naturally — no `pointerEvents` toggling needed                 |
| Counter-translate instead of absolute fixed          | Avoids touch priority vs visual stacking conflicts                               |
| `Math.max(heroSpacerHeight, 1)` guard                | Prevents `Animated.interpolate` crash from `[0, 0]` inputRange                   |
| `overflow: "visible"` on spacer                      | Hero content extends beyond spacer bounds before measurement                     |
| `pointerEvents: "box-none"` on spacer + hero wrapper | Allows touches to pass through to hero buttons                                   |
| Background in separate absolute layer                | Avoids background scrolling; `pointerEvents: "none"` prevents touch interference |

#### Measurement Flow

1. `handleHeroLayout` fires `onLayout` → sets `heroContentHeight`
2. `heroBgHeight` = `heroContentHeight + HERO_BG_EXTENSION` (or fallback)
3. `heroSpacerHeight` = `heroContentHeight` (or `HERO_FALLBACK_HEIGHT`)
4. `HERO_FALLBACK_HEIGHT` = `TOTAL_HEADER_HEIGHT + 280` — used before first layout measurement

---

## 7. Send Pipeline & Message Flow

### Send Pipeline (High Level)

1. UI calls `chat.sendMessage(...)` from `useChat`
2. Runtime path:
   - Local-first inserts to SQLite and syncs pending writes
   - Fallback path invokes messaging service and callable
3. Cloud Function `sendMessageV2` validates auth, membership, block/rate-limit, and message request gating
4. Server writes message with authoritative timestamp and updates conversation preview fields
5. Realtime subscription merges server snapshot with optimistic state

Core files:

- `src/hooks/useChat.ts`
- `src/services/messaging/send.ts`
- `src/services/messaging/messageMerge.ts`
- `firebase-backend/functions/src/messaging.ts`

### Ordering and Dedupe

Canonical sort precedence (every runtime path):

1. `serverReceivedAt` descending
2. `createdAt` descending
3. `id` descending

Canonical dedupe identity: `message.id`

Conflict resolution:

- Newer canonical timestamp wins
- If tied, prefer server-confirmed/non-local over local optimistic variant

Core functions (all in `src/services/chat/normalizeMessage.ts`):

- `compareMessagesCanonicalDesc`
- `dedupeAndSortMessages`
- `mergeMessageCollections`

### Realtime + Pagination Merge

Realtime and pagination overlap (including modified snapshots) is unified through:

- `src/services/chat/unifiedMessagesLifecycle.ts`
- `src/services/messaging/messageMerge.ts`

Goal: no duplicate rows and stable identity when optimistic messages are reconciled by server snapshots.

### Message Status Lifecycle

1. `sending` — optimistic/local outbox phase
2. `failed` — outbox write failed or callable failed
3. `sent` — server ack or realtime authoritative snapshot

Important: canonical contract is timestamp and identity based; `status` is advisory UI state and must not control ordering.

---

## 8. Display Modes — Bubbles vs Stacked

### Overview

The app supports two chat display modes, switchable per-user (viewer-side preference):

| Mode                  | Style                     | Visual Description                                               |
| --------------------- | ------------------------- | ---------------------------------------------------------------- |
| **Bubbles** (default) | Classic iMessage/WhatsApp | Rounded bubbles, sent right-aligned, received left-aligned       |
| **Stacked**           | Discord-style             | Left-aligned feed with avatar, name, and grouped card containers |

Display mode is a **viewer-side** setting — each user sees the mode they chose, regardless of what the other participant(s) use.

### Architecture

```
User toggles display mode in ChatSettingsScreen
    │
    ▼
dual-write: AsyncStorage (instant) + Firestore Users/{uid} (persistent)
    │
    ▼
useConversationDisplayMode() reads combined source
    │
    ▼
ChatMessageRenderer / GroupChatScreen selects renderer
    │
    ├─ "bubbles" → DMMessageItem / inline bubble views
    └─ "stacked" → StackedMessageRenderer / GroupStackedMessageRenderer
```

### Feed Layout Tokens (`FEED_LAYOUT` from `displayMode.ts`)

These tokens define the spatial contract for stacked mode:

```typescript
export const FEED_LAYOUT: FeedLayoutTokens = {
  screenEdgeInset: 0,
  gutterWidth: 40, // Left column reserved for avatars
  gutterGap: 14, // Gap between gutter and content
  contentIndent: 54, // Total indent: 0 + 40 + 14
  avatarSize: 40, // Avatar diameter at group-start
  groupGap: 14, // Vertical space between sender groups
  withinGroupGap: 0, // NO gap between grouped messages (cards flush)
  rowPaddingV: 2, // Vertical padding per feed row
  rowPaddingH: 8, // Horizontal padding per feed row
  mediaRadius: 8, // Corner radius for media cards
  imageMaxWidth: 260, // Max image width in pixels
  imageMaxHeight: 300, // Max image height in pixels
  imageMinWidth: 140, // Min image width in pixels
  authorNameFontSize: 16,
  timestampFontSize: 12.5,
  messageFontSize: 16,
  messageLineHeight: 22.5,
  reactionRowGap: 2,
  replyPreviewGap: 4,
  selfTintOpacity: 0, // Self-message tint (disabled)
  selfAccentWidth: 0, // Self-message accent (disabled)
};
```

### Content-Column Anchoring

In stacked mode, the content column starts at `contentIndent` (54px) from the left edge. This is the consistent left-alignment anchor for:

- Author name + timestamp header
- Text messages
- Image messages
- Voice messages
- Reply previews
- Grouped card backgrounds

The gutter (40px) + gap (14px) are reserved for the avatar (displayed at group-start only) and remain as a spacer for within-group rows.

### Bubble Mode Spacing

Applied via `marginBottom` on each message container:

- Default: `marginBottom: 14` (between groups — `groupGap`)
- Grouped with next: `marginBottom: 2` (tight within-group — `withinGroupGap`)

Files: `DMMessageItem.tsx` (DM), `GroupChatScreen.tsx` styles (Group)

### Stacked Mode Spacing

Applied via `marginTop` on feed rows:

- Group start: `marginTop: groupGap (14)`
- Within group: `marginTop: withinGroupGap (0)`

Files: `StackedMessageRenderer.tsx`, `GroupStackedMessageRenderer.tsx`

### Timestamp Visibility

Timestamps are only rendered on the last message of a group (`isGroupEnd`). They are conditionally rendered (not hidden with opacity) to avoid phantom spacing between grouped bubbles.

### Spacing Ownership

The message container owns inter-message spacing. Timestamps, sender names, avatars, and reactions add their own internal spacing only when rendered. No element contributes invisible spacing when hidden.

### Self-Message Distinction

In stacked mode, self-sent messages use the same left-aligned feed layout. Self-distinction is handled through:

- `selfTintOpacity: 0` — no background tint (currently disabled)
- `selfAccentWidth: 0` — no left accent border (currently disabled)

### Mention Highlighting (Group Only)

In group stacked mode, messages that mention the current user get a tinted background row with a left accent border. This highlighting applies to the card wrapper, not the feed row.

### Feature Parity Between Modes

Both modes support:

- Reactions (pills below message)
- Reply previews
- Thread indicators
- Media messages (images, voice)
- Long-press actions
- System messages
- Date dividers

### Settings UI

Display mode is changed in `ChatSettingsScreen` under "Display" section. The setting persists via dual-write (AsyncStorage for instant + Firestore for cross-device).

### Custom Font Color in Stacked Mode

- **Default**: `theme.colors.onSurface` — adapts to theme
- **Custom**: Fixed hex color from `fontColorHex`

Author names, timestamps, metadata: always theme-adaptive regardless of custom font color.

---

## 9. Grouped Card System (Stacked Mode)

### Overview

The grouped card system wraps consecutive messages from the same sender into visually unified card containers with adaptive corner rounding. Messages within a group have **zero vertical gap** (`withinGroupGap: 0`) and share a continuous background, creating a cohesive block.

**Key behaviors:**

- Messages from the same sender within a time window are grouped
- Each card uses a two-View structure: outer `cardWrapper` (background, radii, minWidth) wrapping inner `cardContent` (padding, self-sizing, onLayout)
- Cards use `colors.background` as their solid background color
- Adjacent cards with similar widths (within `GROUPED_CARD_SNAP_THRESHOLD = 24px`) are cluster-snapped to the widest member
- Right-edge corners round/flatten based on directional width comparison with neighbors
- Left-edge corners are always flat within groups (left-aligned, edges flush)
- Group boundary corners (first message's top, last message's bottom) are always rounded
- Thread indicators for mid-group messages render **inline** inside the card
- Cards render immediately at full opacity with deterministic flag-based corners

### Grouping Rules

Grouping is determined by `buildTimeline()` in `src/chat/buildTimeline.ts`. Two adjacent messages are grouped when they satisfy all of:

1. **Same sender** (`senderId` match)
2. **Within time threshold** (`MESSAGE_GROUP_THRESHOLD_MS = 2 minutes`)
3. **Neither message is a reply** (`replyTo` is falsy on both)
4. **Same calendar day** (grouping is broken at day boundaries)
5. **Neither is a system message** (group chats only)

**Important:** Grouping is NOT broken by `replyCount` (thread roots). A message that is the root of a thread can appear in the middle of a grouped run.

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│ GroupChatScreen / ChatScreen (parent)                            │
│                                                                  │
│  ┌─ CardWidthTracker (single instance per conversation) ───────┐ │
│  │  - nodes: Map<messageId, CardWidthNode>                     │ │
│  │    (CardWidthNode: { width?, prevId?, nextId? })            │ │
│  │  - listeners: Map<messageId, Set<snapshot callback>>        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ FlatList (inverted) ───────────────────────────────────────┐ │
│  │  renderItem → for each TimelineItem:                        │ │
│  │    ├─ type: "date-divider" → <DateDivider />                │ │
│  │    └─ type: "message" →                                     │ │
│  │        ├─ Compute groupPrevMessageId / groupNextMessageId   │ │
│  │        └─ <GroupStackedMessageRenderer /> (group chats)      │ │
│  │           or <StackedMessageRenderer /> (DMs)                │ │
│  │             └─ useGroupedCardLayout() hook                   │ │
│  │               └─ cardWrapper View (background, radii, snap)  │ │
│  │                 └─ cardContent View (onLayout → width track) │ │
│  │                   ├─ MessageHighlightOverlay                │ │
│  │                   ├─ Author header (group-start only)       │ │
│  │                   ├─ Reply preview (StackedReplyReference)  │ │
│  │                   ├─ Message content (text / image / voice) │ │
│  │                   ├─ Reaction pills                         │ │
│  │                   └─ ThreadIndicator (inline, mid-group)    │ │
│  │               └─ ThreadIndicator (external, group-end/solo) │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Row Grid Structure

```
┌──────────────────────────────────────────────────────────┐
│ feedRow (width: 100%, paddingHorizontal: 8)              │
│                                                          │
│  ┌──────────┐  ┌──────────────────────────────────────┐  │
│  │  gutter   │  │  contentColumn (flex: 1)             │  │
│  │  (40px)   │  │                                      │  │
│  │  + gap    │  │  ┌─ cardWrapper (outer) ───────────┐ │  │
│  │  (14px)   │  │  │  alignSelf: "flex-start"       │ │  │
│  │           │  │  │  backgroundColor: background   │ │  │
│  │  [avatar] │  │  │  overflow: "hidden"             │ │  │
│  │  or       │  │  │  [adaptive border radii]        │ │  │
│  │  [spacer] │  │  │  [minWidth: snapMinWidth]       │ │  │
│  │           │  │  │                                 │ │  │
│  │           │  │  │  ┌─ cardContent (inner) ──────┐ │ │  │
│  │           │  │  │  │  paddingH: 12, paddingV: 6 │ │ │  │
│  │           │  │  │  │  onLayout → width tracking  │ │ │  │
│  │           │  │  │  │  [message content]          │ │ │  │
│  │           │  │  │  └────────────────────────────┘ │ │  │
│  │           │  │  └─────────────────────────────────┘ │  │
│  └──────────┘  └──────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

- **Group-start rows**: Avatar in gutter, author name + timestamp in header
- **Within-group rows**: Empty spacer in gutter (same width), no header
- **Spacing**: `marginTop: groupGap (14px)` for group-start, `marginTop: 0` within group

### Card Container Rendering

Each message uses a two-View structure. The outer `cardWrapper` owns background color, border radii, overflow clipping, and snap width. The inner `cardContent` owns padding and the `onLayout` handler for width measurement.

```typescript
cardWrapper: {
  alignSelf: "flex-start",     // Self-sizing width
}
cardContent: {
  alignSelf: "flex-start",     // Content determines natural width
  paddingHorizontal: 12,       // rowPaddingH + 4
  paddingVertical: 6,          // rowPaddingV + 4
}
```

**Vertical padding tightening**: Within-group cards use reduced vertical padding:

```typescript
const CARD_PAD_V = 6; // At group boundaries & solo
const CARD_PAD_V_INNER = 2; // Between grouped cards

const cardPaddingTop = vm.isGroupStart ? CARD_PAD_V : CARD_PAD_V_INNER;
const cardPaddingBottom = vm.isGroupEnd ? CARD_PAD_V : CARD_PAD_V_INNER;
```

**Why two Views?** The `onLayout` handler measures the inner content width, not the outer container. This prevents feedback loops where a snap-expanded width gets re-reported.

**No opacity gate**: Cards render at full opacity (`1`) immediately. No delayed pop-in. Initial corners from grouping flags alone are correct enough for the common case.

### CardWidthTracker

A graph-based pub/sub system that tracks message widths and their group adjacency. Each message is a node with optional prev/next links forming a doubly-linked list per sender group.

```typescript
interface CardWidthNode {
  width?: number; // Measured width (normalized to 2px grid)
  prevId?: string; // Message ID of neighbor above in same group
  nextId?: string; // Message ID of neighbor below in same group
}

interface CardWidthSnapshot {
  rawWidth?: number; // This message's measured width
  snappedWidth?: number; // This message's cluster-resolved snapped width
  prevSnappedWidth?: number; // Neighbor above's snapped width
  nextSnappedWidth?: number; // Neighbor below's snapped width
  prevMessageId?: string;
  nextMessageId?: string;
}
```

One instance is created per conversation screen via `useMemo`. Recreated when conversation ID changes.

When a width is reported or neighbors change, the tracker:

1. Collects all connected message IDs by walking prev/next links
2. Resolves `snappedWidth` via snap cluster algorithm
3. Builds `CardWidthSnapshot` with snapped widths of self and neighbors
4. Notifies all subscribers in the affected group

Cross-instance `WIDTH_CACHE` (Map, max 5000 entries) persists across tracker instances for instant corners on re-opened conversations.

### Width Snapping

Width snapping uses a **cluster-based** algorithm. The tracker walks the entire chain of adjacent messages to find the connected "snap cluster" — the longest contiguous run where pairwise widths are all within `GROUPED_CARD_SNAP_THRESHOLD = 24px`.

All messages in a snap cluster are expanded to the width of the widest member via `minWidth` on the outer `cardWrapper`.

Snapping is transitive: if A↔B and B↔C are each within threshold, all three snap to `max(A, B, C)` even if `|A - C| > threshold`.

### Adaptive Corner Rounding

```
GROUPED_CARD_RADIUS = 8px

SOLO MESSAGES: All four corners = 8 (fully rounded)

GROUPED MESSAGES:
  LEFT EDGES: Always flush within group. Only group-start TL and group-end BL get 8.
  RIGHT EDGES: Determined by directional width comparison.
    - Rounded (8) when current card is WIDER than neighbor (exposed edge)
    - Flat (0) when current card is same width or narrower (flush/tucked)
    - Flat (0) when neighbor width is unknown (safe fallback)
  Group boundary corners (start top, end bottom): always 8.
```

**Decision matrix:**

| Corner           | Group Start  | Group End    | Within Group |
| ---------------- | ------------ | ------------ | ------------ |
| **Top-Left**     | `8`          | `0`          | `0`          |
| **Bottom-Left**  | `0`          | `8`          | `0`          |
| **Top-Right**    | `8` (always) | Width rule ↓ | Width rule ↓ |
| **Bottom-Right** | Width rule ↓ | `8` (always) | Width rule ↓ |

**Width rule**: `currentWidth > adjacentWidth` → `8` (rounded); else → `0` (flat)

### useGroupedCardLayout Hook

Both renderers delegate all card layout logic to this shared hook:

```typescript
const { handleCardLayout, groupCardRadius, snapMinWidth } =
  useGroupedCardLayout({
    messageId,
    cardWidthTracker,
    groupPrevMessageId,
    groupNextMessageId,
    isGroupStart: vm.isGroupStart,
    isGroupEnd: vm.isGroupEnd,
  });
```

The hook:

1. Pre-seeds from width cache on mount via `useState` lazy initializer
2. Registers group neighbors via `setGroupNeighbors()` in `useLayoutEffect` (before first paint)
3. Subscribes to snapshot changes with stable setter using `snapshotWidthsEqual()` comparison
4. Memoizes radii and snap width from the latest snapshot

### First-Paint Strategy

The system achieves instant-correct rendering through a multi-layer approach:

1. **Precomputed grouping flags** — `buildTimeline()` computes flags before render. Passed as primitive boolean props for efficient `React.memo` short-circuiting.

2. **Deterministic initial corners** — Before any `onLayout`, cards use group-position-based defaults (boundary corners = 8, within-group = 0). Correct for the common same-width case.

3. **Cross-instance width cache** — Persists across tracker instances. Re-opened conversations start with fully resolved corners.

4. **Pre-mount width estimation** — `estimateMessageWidth.ts` predicts card-content width from message metadata (text character count with script-aware widths, media dimensions, metadata boosts). Fed to tracker via `seedBatch()` before row components mount.

5. **Pre-paint setup via `useLayoutEffect`** — Runs synchronously after React commits but before frame paint. Warm-cache rows include resolved neighbor widths.

6. **Coalesced notifications** — `setTimeout(0)` merges multiple width reports into one flush. `snapshotWidthsEqual()` eliminates re-renders from reference inequality.

### Thread Indicator Placement

The `threadPlacement` view-model property determines where thread indicators render:

| Value        | When                              | Location                              |
| ------------ | --------------------------------- | ------------------------------------- |
| `"none"`     | No thread                         | Not rendered                          |
| `"inline"`   | Thread root AND grouped with next | Inside `cardContent`, after reactions |
| `"external"` | Thread root AND group-end/solo    | Separate row below the card           |

Inline placement preserves grouped continuity — the thread link is visually part of the card, with no gap between this card and the next.

### Date Dividers

Day separators use the `DateDivider` component — a horizontal row with two hairline rules flanking a centered date label in a pill-shaped box. Uses theme `colors.divider`, `colors.textSecondary`, and `colors.background`.

### FlatList Virtualization

```typescript
windowSize: 101,              // 50 screens above + 1 viewport + 50 below
initialNumToRender: 20,
maxToRenderPerBatch: 50,
updateCellsBatchingPeriod: 16, // One frame (60 fps)
removeClippedSubviews: false,  // Must stay false on inverted lists
```

### MessageViewModel

Built internally from raw primitive props via `useMemo` in `GroupStackedMessageRenderer`:

| Field             | Type                               | Description                                |
| ----------------- | ---------------------------------- | ------------------------------------------ |
| `isGroupStart`    | `boolean`                          | First in sender group (show avatar + name) |
| `isGroupEnd`      | `boolean`                          | Last in sender group (show timestamp)      |
| `showAvatar`      | `boolean`                          | Avatar should be rendered                  |
| `showDisplayName` | `boolean`                          | Author name should be rendered             |
| `showTimestamp`   | `boolean`                          | Timestamp row should be rendered           |
| `threadPlacement` | `"inline" \| "external" \| "none"` | Thread indicator position                  |

### Constants Reference

| Constant                      | Value | Description                                |
| ----------------------------- | ----- | ------------------------------------------ |
| `GROUPED_CARD_RADIUS`         | `8`   | Corner radius for rounded edges            |
| `GROUPED_CARD_SNAP_THRESHOLD` | `24`  | Max width diff for snap cluster membership |
| `withinGroupGap`              | `0`   | Zero gap between grouped messages          |
| `groupGap`                    | `14`  | Vertical space between sender groups       |
| `cardContent.paddingH`        | `12`  | Inner card horizontal padding              |
| `cardContent.paddingV`        | `6`   | Inner card vertical padding                |
| `CARD_PAD_V_INNER`            | `2`   | Tightened vertical padding within group    |

### Renderer Differences

While card layout logic is shared, the renderers differ in:

- **GroupStackedMessageRenderer**: Raw grouping flag primitives → internal `useMemo` VM. `@mention` row highlighting. `MessageWithMentions` for text. Stable parent callbacks.
- **StackedMessageRenderer**: `useTheme()` from react-native-paper. No mention highlighting. Plain `Text`. `useLinkPreviews` hook. Direct `navigation.navigate` for threads.

---

## 10. Composer System

### Composing UI

The main composer component (`ChatComposer.tsx`) handles:

- Text input with reply-preview UI
- Attachment tray
- Voice recording
- Customizable toolbar
- `overflow: "visible"`, `minHeight: 40`, total height ~56px

### Composer Toolbar Customization

Users can rearrange and customize toolbar items through a drag-and-drop editor.

#### Data Model

```typescript
interface ComposerToolbarLayout {
  toolbar: string[]; // Ordered list of visible item IDs
  overflow: string[]; // Items hidden in overflow menu
}
```

Stored at `Users/{uid}.composerToolbar` in Firestore.

#### Available Item IDs

| ID           | Label         | Removable                            |
| ------------ | ------------- | ------------------------------------ |
| `camera`     | Camera        | Yes                                  |
| `gallery`    | Photo Library | Yes                                  |
| `gif`        | GIFs          | Yes                                  |
| `sticker`    | Stickers      | Yes                                  |
| `voice`      | Voice Note    | Yes                                  |
| `file`       | File          | Yes                                  |
| `schedule`   | Schedule Send | Yes                                  |
| `animal`     | Send Animal   | Yes                                  |
| `gameInvite` | Game Invite   | Yes                                  |
| `mention`    | Mention (@)   | Yes                                  |
| `messageBar` | Message Bar   | **No** (fixed position, always last) |

**Constraints**: Maximum 6 items in the toolbar. The `messageBar` item is non-removable and always appears last.

#### Default Layout

```typescript
toolbar: ["camera", "gallery", "gif", "sticker", "voice", "messageBar"];
overflow: ["file", "schedule", "animal", "gameInvite", "mention"];
```

#### Persistence (Dual-Write)

1. `AsyncStorage` — immediate read on next app launch (no network dependency)
2. `Firestore Users/{uid}.composerToolbar` — cloud backup for multi-device parity

Read priority: Firestore snapshot > AsyncStorage fallback > hardcoded default.

#### Drag-and-Drop System

- `PanGestureHandler` from `react-native-gesture-handler`
- **Frozen-origin pattern**: When a drag starts, the dragged item's original index is frozen. Swap logic references this frozen origin, not the live layout
- **Swap threshold**: Drag must cross 50% of the adjacent item's width to trigger a swap
- **Haptic feedback**: `expo-haptics` `ImpactFeedbackStyle.Light` on swap
- **Animations**: `Reanimated` `withSpring` for item repositioning

#### Edit Mode State Tiers

1. **Idle** — toolbar renders normally
2. **Editing** — items show remove buttons, overflow items visible
3. **Dragging** — active gesture, swap detection running
4. **Confirming** — save pending (dual-write in progress)

#### Adding New Toolbar Items

1. Add new ID to `TOOLBAR_ITEM_IDS` array
2. Add icon/label mapping to `TOOLBAR_ITEM_META`
3. Add to `DEFAULT_OVERFLOW` array (or `DEFAULT_TOOLBAR` if default-visible)
4. Wire action handler in `ComposerToolbar.tsx`'s `handleItemPress`
5. Existing users: new item auto-appears in overflow (layout merge handles unknown IDs)

---

## 11. Keyboard Architecture

### Executive Summary

The keyboard architecture has gone through 3 iterations trying to solve a fundamental problem: making the chat composer track the keyboard smoothly while the inverted FlatList also resizes correctly.

### Runtime Environment

- **Expo Go**: KCSV (KeyboardChatScrollView) is NOT available — requires native build
- Available: KSV (KeyboardStickyView), KAV (KeyboardAvoidingView), `useReanimatedKeyboardAnimation`, `useKeyboardHandler`
- `KeyboardProvider` already wraps the app

### The Fundamental Problem

Both KSV and KAV are designed for "simple" keyboard avoidance. The chat screen requires a specific combination of:

1. **Inverted FlatList** — newest messages at bottom, `maintainVisibleContentPosition` active
2. **Composer at bottom** — must sit flush above the keyboard when open
3. **Message list must resize** — visible area must shrink when keyboard opens
4. **Conditional safe area** — bottom safe area needed when keyboard closed, not when open
5. **Interactive keyboard dismiss** — iOS drag-to-dismiss must be smooth

### Why KSV Fails

KSV uses `translateY` (visual-only transform). It doesn't trigger flex layout changes. The FlatList still occupies the same pixel count. Only the footer moves — floating over the bottom messages.

### Why KAV `behavior: "height"` Fails

KAV's `"height"` behavior sets explicit `height` + `flex: 0`. This triggers layout change, BUT:

- Layout is async (Reanimated UI thread vs RN Yoga JS thread) → 1+ frame lag → jitter
- Digital flex transition: `flex: 1` → `{ height: X, flex: 0 }` is discontinuous
- Safe-area spacer stays visible (gap issue)
- Frame measurement issues with stale `initialFrame`

### Current Architecture (v3 KAV)

The current implementation uses KAV with `behavior: "height"`, which has known jitter but provides the closest-to-correct behavior for the current constraints.

### Chat Screen Flex Stack

| Element            | Height     | Notes                      |
| ------------------ | ---------- | -------------------------- |
| ChatHeader         | ~56px      | Fixed                      |
| PinnedInviteBar    | ~48px or 0 | Conditional                |
| ChatMessageList    | Remaining  | Inverted FlatList, flex: 1 |
| NetworkBanner      | ~28px or 0 | Animated                   |
| TypingBar/Bubble   | ~24px or 0 | Conditional                |
| ChatComposer       | ~56px      | minHeight: 40saw           |
| Safe-area spacer   | ~34px      | Always rendered            |
| ScrollReturnButton | —          | position: absolute         |

### Requirements

Must have:

1. Messages must scroll up when keyboard opens (FlatList shrinks)
2. Composer flush above keyboard (no gap)
3. Composer above safe area when keyboard closed
4. Smooth animation (no jitter/stutter)
5. Interactive dismiss works (iOS drag-to-dismiss)
6. Works in Expo Go
7. `maintainVisibleContentPosition` must not fight keyboard
8. Works in both stacked and bubble display modes
9. Works for both ChatScreen (DM) and GroupChatScreen

### Solution Path

When a native build (`expo-dev-client`) is available, the **KCSV + KSV** architecture is the intended solution:

- KCSV handles `contentInset` on the UI thread (zero layout reflow for the FlatList)
- KSV handles footer positioning with smooth `translateY`
- This is what `react-native-keyboard-controller` was designed for

### Key Files

| File                                             | Role                                               |
| ------------------------------------------------ | -------------------------------------------------- |
| `src/components/chat/ChatKeyboardScrollView.tsx` | KCSV adapter + ChatFooterWrapper + isKCSVAvailable |
| `src/components/chat/ChatMessageList.tsx`        | Inverted FlatList                                  |
| `src/components/chat/ChatComposer.tsx`           | Composer UI                                        |
| `src/hooks/chat/useChatKeyboard.ts`              | Keyboard SharedValues + JS state                   |
| `src/screens/chat/ChatScreen.tsx`                | DM — KeyboardAvoidingView + ChatFooterWrapper      |
| `src/screens/groups/GroupChatScreen.tsx`         | Group — same pattern                               |

---

## 12. Reaction System

### UX Flow

1. **Long-press a message** → `MessageActionsSheet` opens
2. **Quick reactions** — 6 curated emojis (👍 ❤️ 😂 😮 😢 🔥) at top of sheet
3. **"+" button** — Opens full emoji picker (`rn-emoji-keyboard`) with categories, search, recent, skin tones
4. **Selecting an emoji** closes picker/sheet, calls `toggleReactionV2` on server
5. **Reaction pills** appear below message bubble (emoji + count). Tapping toggles participation
6. **Tapping own pill** removes reaction

### Data Model

**Message document** (`reactionsSummary`):

```
Chats/{chatId}/Messages/{messageId}
Groups/{groupId}/Messages/{messageId}
  └─ reactionsSummary: Record<string, number>  // { "🔥": 2, "❤️": 1 }
```

**Reactions subcollection**:

```
.../Messages/{messageId}/Reactions/{emoji}
  ├─ emoji: string
  ├─ uids: string[]
  ├─ count: number
  └─ updatedAt: number
```

- Document ID = emoji character
- Max 20 unique emojis per message
- Max 10 users displayed per emoji in detail sheet

### Service Layer

| Function                                | Description                                          |
| --------------------------------------- | ---------------------------------------------------- |
| `toggleReaction()`                      | Calls `toggleReactionV2` Cloud Function              |
| `applyOptimisticReaction()`             | Pure function: computes next reactions array locally |
| `subscribeToReactions()`                | Real-time Firestore listener for one message         |
| `subscribeToMultipleMessageReactions()` | Batch subscription for visible messages              |
| `getReactions()`                        | One-shot fetch                                       |
| `parseReactionsFromMessage()`           | Parse denormalized summary into `ReactionSummary[]`  |

All in `src/services/reactions.ts`.

### Cloud Function (`toggleReactionV2`)

- **Input**: `{ conversationId, scope, messageId, emoji }`
- **Validation**: Auth, membership, rate limit (10/min), emoji ≤ 10 chars
- **Logic**: Firestore transaction — adds/removes UID, updates denormalized `reactionsSummary`
- **Output**: `{ success, action: "added"|"removed", reactionsSummary }`

### Optimistic Updates

1. User taps reaction → `applyOptimisticReaction()` computes next local state (pure function)
2. Parent screen calls `setMessageReactions()` immediately with optimistic result
3. Cloud Function call is fired in background (fire-and-forget)
4. On success: Firestore listener overwrites with authoritative state (usually identical)
5. On failure: `applyOptimisticReaction()` called again to roll back

**Key details:**

- **Per-emoji debounce**: `inflight` ref Set prevents double-taps on same emoji
- **`optimisticIds` ref**: Messages with optimistic reactions are always included in subscription set (fixes first-reaction blindspot)
- **No blocking state**: Replaced old `loadingEmoji` state with per-emoji inflight ref

### Subscription Stability

Both chat screens use a `reactionTargetKey` — a `useMemo`-derived sorted comma-joined string of visible message IDs — as the `useEffect` dependency. Only rebuilds when the set of message IDs actually changes.

### Animations

- **Pill tap**: Spring scale (`withSequence(withSpring(1.25), withSpring(1))`)
- **Pill enter/exit**: `FadeIn.duration(200)` / `FadeOut.duration(150)`
- **Layout transitions**: `LinearTransition.springify()`
- **Haptic feedback**: `expo-haptics` `ImpactFeedbackStyle.Light`
- **Theme-aware**: `primaryContainer`/`primary` for own reactions, `surfaceVariant` for others

### Known Limitations

- Denormalized `reactionsSummary` doesn't include per-user data — `hasReacted` is always `false` from summary alone. Full reaction subscriptions needed for accurate state.
- `ReactionDetailSheet` loads profiles one-by-one; slow for many reactors.
- If Cloud Function fails silently, optimistic state persists until Firestore listener delivers authoritative data.

---

## 13. GIF Integration (KLIPY)

### Architecture

```
UI Layer (GifPicker, GifGrid, GifPreview)
    │
    ▼
Service Layer (gifService.ts, gifCacheService.ts)
    │
    ▼
KLIPY API (external)
```

### Feature Flag

GIF picker visibility is controlled by a feature flag. When disabled, the GIF toolbar item is hidden.

### KLIPY API Endpoints

| Endpoint                            | Purpose           |
| ----------------------------------- | ----------------- |
| `GET /v1/gifs/trending`             | Trending GIFs     |
| `GET /v1/gifs/search?q={query}`     | Search GIFs       |
| `GET /v1/gifs/{id}`                 | GIF details       |
| `GET /v1/gifs/categories`           | Category listing  |
| `GET /v1/stickers/trending`         | Trending stickers |
| `GET /v1/stickers/search?q={query}` | Search stickers   |

### Authentication

API key sent via `X-API-Key` header. Key stored in app config, not hardcoded.

### Rate Limits

- 100 requests/minute per API key
- Client-side debounce on search (300ms)

### Provider Pattern

`gifService.ts` abstracts the KLIPY API behind a provider interface, enabling future provider swaps without UI changes.

### Caching Strategy

`gifCacheService.ts` implements:

- In-memory LRU cache for search results
- Trending results cached with 5-minute TTL
- Category list cached for session duration

### Message Flow

1. User opens GIF picker from composer toolbar
2. Trending GIFs load on open
3. User searches or browses categories
4. User taps a GIF → picker closes
5. GIF URL + metadata passed to send flow
6. Message sent with `kind: "media"` and GIF attachment
7. Recipients render GIF inline via cached URL

### Known Limitations

1. No offline GIF browsing (requires network)
2. Search results limited to 50 per query
3. GIF file size not enforced client-side (server handles)
4. Attribution requirements per KLIPY terms
5. No GIF favorites/recents persistence across sessions

---

## 14. Custom Font Color System

### Overview

Users can select a custom font color for chat messages through the Customization Hub. Default is **theme-adaptive** (changes with active theme). Custom colors are **fixed** (stay the same regardless of theme).

### Data Model

**ChatAppearance** (per-user, Firestore at `Users/{uid}.chatAppearance`):

```typescript
interface ChatAppearance {
  bubbleColorId: string | null;
  fontId: string | null;
  fontColorId: string | null; // null = theme-adaptive default
  animalThemeId: string | null;
}
```

**SenderStyle** (per-message stamp):

```typescript
interface SenderStyle {
  fontColorId?: string | null;
  fontColorHex?: string | null; // Pre-resolved hex for forward-compat
  v: 1;
}
```

Stamped on every outgoing message via `buildSenderStyle()` so recipients render custom font color without fetching profiles.

### Resolution Logic

**Outgoing**: `resolveOutgoingChatStyle()` resolves `fontColorId` → hex via cosmetic catalog → `CHAT_FONT_COLORS` map → catalog metadata → `null` (theme-adaptive).

**Incoming**: `resolveIncomingBubbleStyle()` prefers `senderStyle.fontColorHex` → catalog lookup → metadata → `null`.

### Rendering Behavior

| Mode    | Default                             | Custom                        |
| ------- | ----------------------------------- | ----------------------------- |
| Stacked | `theme.colors.onSurface` (adapts)   | Fixed hex from `fontColorHex` |
| Bubble  | Contrast-computed `bubbleTextColor` | `fontColorHex` overrides      |

Custom font color applies to chat message body text only. Does NOT apply to error text, button labels, badges, status indicators, navigation labels, placeholder text, or timestamps/metadata.

### Color Catalog

16 curated colors across rarity tiers:

| Tier         | Colors                                               | Acquisition |
| ------------ | ---------------------------------------------------- | ----------- |
| Free/Starter | Snow (#FFFFFF), Charcoal (#2D2D2D), Silver (#B0B0B0) | Default     |
| Common       | Sky Blue, Lavender, Mint, Rose, Peach                | 150 tokens  |
| Uncommon     | Coral, Gold, Aqua, Lime                              | 250 tokens  |
| Rare         | Neon Pink, Electric Blue, Emerald                    | 400 tokens  |

### Hooks

- `useFontColor()` — centralized hook: `{ textColor, textSecondaryColor, isCustom, customHex, chatTextColor }`
- `resolveFontColor()` — standalone utility for non-hook contexts

### Backward Compatibility

- `sanitizeChatAppearance()` uses spread with defaults — old users without `fontColorId` get `null` (theme-adaptive)
- `senderStyle` fields are optional — old messages render with theme defaults
- No breaking changes to existing rendering

---

## 15. Message Features

### Reactions

See [Section 12](#12-reaction-system) for full details.

### Voice Messages

- Recorder: `useVoiceRecorder.ts`
- Send surface: shared send helpers in `src/chat/sendDraft.ts`
- Playback: `VoiceMessagePlayer.tsx`

### Mentions (Group Only)

- Stored on message as `mentionUids` and `mentionSpans`
- Compose-time suggestions: `MentionAutocomplete.tsx`
- Rendering: `MessageWithMentions` component in group stacked renderer

### Attachments

Two-phase flow:

1. Client uploads to `chat-staging/...`
2. `sendMessageV2` finalizes into `chat-media/...`

Constraints enforced server-side in `chatMedia.ts`. DM and group screens share attachment send orchestration for tray attachments, direct camera sends, and direct gallery sends.

### Scheduled Messages

- Client service: `src/services/scheduledMessages.ts`
- Management screen: `ScheduledMessagesScreen.tsx`
- Backend processing remains a legacy-style proxy but is still active

### Message Requests

Always on — no client-side feature flag.

- Backend enforcement: `messageRequests.ts`
- Client subscription: `useMessageRequests.ts`
- Merge surface: `useUnifiedInboxRequests.ts`

---

## 16. Data Contracts

### Message Contract (`MessageV2`)

Type source: `src/types/messaging.ts`

```typescript
interface MessageV2 {
  id: string;
  scope: "dm" | "group";
  conversationId: string;
  senderId: string;
  senderName?: string;
  kind: "text" | "media" | "voice" | "file" | "system" | "animal";

  text?: string;
  animalId?: string;

  createdAt: number;
  serverReceivedAt: number;
  editedAt?: number;

  replyTo?: ReplyToMetadata;
  threadRootId?: string | null;
  replyCount?: number;
  lastReplyAt?: number;

  attachments?: AttachmentV2[];
  mentionUids?: string[];
  mentionSpans?: MentionSpan[];
  reactionsSummary?: Record<string, number>;

  deletedForAll?: { by: string; at: number };
  hiddenFor?: string[];
  linkPreview?: LinkPreviewV2;

  clientId: string;
  idempotencyKey: string;

  senderStyle?: {
    bubbleColorId?: string | null;
    bubbleColorHex?: string | null;
    fontId?: string | null;
    fontKey?: string | null;
    fontColorId?: string | null;
    fontColorHex?: string | null;
    animalThemeId?: string | null;
    v: 1;
  };

  status?: "sending" | "sent" | "delivered" | "failed";
  isLocal?: boolean;
}
```

Normalization boundaries:

- SQLite → `MessageV2`: `normalizeMessageFromLocalRow`
- Firestore → `MessageV2`: `normalizeMessageFromFirestoreDoc`

Both in `src/services/chat/normalizeMessage.ts`.

### Reply Contract (`ReplyToMetadata`)

```typescript
interface ReplyToMetadata {
  messageId: string;
  senderId: string;
  senderName?: string;
  kind: MessageKind;
  textSnippet?: string;
  attachmentPreview?: {
    kind: "image" | "video" | "audio" | "file";
    thumbUrl?: string;
  };
}
```

Thread root behavior: `threadRootId` points to root; root carries `replyCount` and `lastReplyAt`.

### Inbox Row Contract (`InboxConversation`)

```typescript
interface InboxConversation {
  id: string;
  type: "dm" | "group";
  name: string;
  avatarUrl: string | null;

  avatarConfig?: AvatarConfig;
  profilePictureUrl?: string | null;
  decorationId?: string | null;
  avatarIds?: string[];

  otherUserId?: string;
  participantCount?: number;

  lastMessage: {
    text: string;
    senderName: string;
    timestamp: number;
    type: "text" | "image" | "voice" | "attachment";
  } | null;

  memberState: MemberStatePrivate;
  unreadCount: number;
  hasMentions: boolean;
  isOnline?: boolean;
  createdAt: number;
}
```

Construction paths:

- Fan-out: `normalizeFanoutDMConversation` / `normalizeFanoutGroupConversation` in `fanoutInboxNormalization.ts`
- Aggregated: `normalizeConversationFromInboxEntry` in `normalizeInboxRow.ts`

### Aggregated Inbox Entry (`InboxEntry`)

Path: `Users/{uid}/Inbox/{threadId}`

```typescript
interface InboxEntry {
  threadId: string; // dm:{chatId} or group:{groupId}
  scope: "dm" | "group";
  conversationId: string;
  lastActivityAt: number;
  lastSenderId: string;
  lastMessageKind: string;
  lastMessagePreview: string;
  unreadCount: number;
  unreadSince?: number;

  pinnedAt?: number | null;
  archived: boolean;
  mutedUntil?: number | null;
  notifyLevel: "all" | "mentions" | "none";

  groupName?: string;
  avatarPath?: string;
  memberCount?: number;

  otherUserName?: string;
  otherUserId?: string;
}
```

Write source: `firebase-backend/functions/src/inboxTriggers.ts`

### Member State Contract (`MemberStatePrivate`)

```typescript
interface MemberStatePrivate {
  uid: string;
  archived?: boolean;
  mutedUntil?: number | null;
  notifyLevel?: "all" | "mentions" | "none";

  sendReadReceipts?: boolean;
  lastSeenAtPrivate: number;
  lastMarkedUnreadAt?: number;

  pinnedAt?: number | null;
  deletedAt?: number | null;
  hiddenUntilNewMessage?: boolean;

  showMemberChatStyles?: boolean;
}
```

Public state (`Members/{uid}`) publishes read/delivery/typing markers if enabled.

### Message Request Contract

```typescript
interface MessageRequest {
  chatId: string;
  requesterId: string;
  requesterName: string;
  requesterAvatarConfig: AvatarConfig;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
  resolvedAt?: number;
  messagePreview: string;
  messageKind: string;
}
```

### Unified Requests Union

```typescript
type UnifiedInboxRequestItem =
  | {
      id: string;
      kind: "friend_request";
      createdAt: number;
      friendRequest: FriendRequestWithUser;
    }
  | {
      id: string;
      kind: "group_invite";
      createdAt: number;
      groupInvite: GroupInvite;
    }
  | {
      id: string;
      kind: "message_request";
      createdAt: number;
      messageRequest: MessageRequest;
    };
```

Merge semantics: dedupe key `${kind}:${id}`, sort by `createdAt desc` then `id asc`.

### Canonical Notification Contract

`CanonicalNotification` output fields:

- `type`: `message`, `group_message`, `friend_request`, `game_turn`, `achievement_unlocked`
- `dedupeKey`
- `route { screen, params }`

---

## 17. Inbox & Unread System

### Inbox Sort Behavior

Shared across both fan-out and aggregated modes:

1. Pinned rows first (`pinnedAt` descending among pinned)
2. Most recent activity (`lastMessage.timestamp` or `createdAt`)
3. Stable tie-breaker by `id`

### Unread Source of Truth

Canonical function: `computeUnreadCount` in `src/services/chat/normalizeInboxRow.ts`

Constants:

- `UNREAD_TOLERANCE_MS = 5000`
- `RECENTLY_READ_TTL_MS = 30000`

Inputs:

- `lastActivityAt`
- `memberState.lastSeenAtPrivate`
- `memberState.lastMarkedUnreadAt`
- Optional `recentlyReadAt`
- Optional `unreadHintCount`

Rules (in strict order):

1. If `recentlyReadAt` is still in TTL window → unread is `0`
2. If `lastMarkedUnreadAt > lastSeenAtPrivate` → unread is `1`
3. If `lastActivityAt > lastSeenAtPrivate + tolerance` → unread is `1`
4. If no private watermark and unread hint exists → unread is `1`
5. Otherwise → unread is `0`

### Unread Badge Rendering

Helper: `src/components/chat/inbox/unreadBadge.ts`

Values: empty for `<=0`, numeric `1..99`, cap `99+`.

### Mark-Read Behavior

- UI optimistically sets local unread to `0`
- Conversation open updates private watermark through DM/group member services
- Aggregated mode also calls `markInboxRead` callable to clear inbox hint count

### Current Migration State

- Backend always maintains `Users/{uid}/Inbox/*`
- Client still defaults to fan-out reads (`CHAT_INBOX_AGGREGATION = false`)
- `markInboxRead` resets aggregated inbox hint but does NOT replace member-private unread state

---

## 18. Thread System

### Thread Realtime Lifecycle

Thread subscriptions are lifecycle-scoped via `src/screens/chat/threadLifecycle.ts`:

- Subscribe once for active thread context
- Cleanup unsubscribes on screen unmount/route change
- No callback execution after cleanup

### Thread Screen

`ThreadScreen.tsx` remains a specialized thread-focused screen (intentional exception — not part of the shared chat surface).

### Thread Model

- `threadRootId` points to root message ID for all replies in a thread
- Root message carries `replyCount` and `lastReplyAt`
- Thread roots can appear in the middle of grouped message runs

---

## 19. Notification Integration

### Notification Flow

1. Raw payload arrives from push or in-app collection
2. `normalizeNotificationPayload` maps raw variants to canonical route and dedupe key
3. Dedupe checks prevent duplicate handling in short windows
4. Route navigation executes from canonical notification model

### Normalization Layer

File: `src/services/notifications/normalizeNotification.ts`

Functions:

- `normalizeNotificationPayload`
- `shouldHandleNotificationByDedupeKey`

### Integration Points

- Push tap: `AuthContext.tsx` → adapter → navigation
- In-app: `InAppNotificationsContext.tsx` → listeners → in-app display
- Notification center: `notificationCenter.ts` handles channel routing (in_app/push/none)

---

## 20. Backend Integration

### Messaging Function Layer

File: `firebase-backend/functions/src/messaging.ts`

Responsibilities:

- Auth and membership checks
- Block checks
- Rate limiting
- Message request gating integration
- Idempotent message write semantics

### Inbox Trigger Layer

File: `firebase-backend/functions/src/inboxTriggers.ts`

Responsibilities:

- Update per-user aggregated inbox docs on DM/group message creation
- Reset sender unread, increment recipients unread
- Maintain preview and snapshot fields
- Expose `markInboxRead` callable to clear unread hints

### Backend Contract Expectations

Screen-level assumptions that should remain true:

- `sendMessageV2` is authoritative for DM and group writes
- Optimistic/native rows must reconcile back into `MessageV2`
- Member-private watermarks remain the unread authority
- Inbox aggregation docs remain derived hints, not the source of truth

---

## 21. Performance & Instrumentation

### chatPerf Utility

File: `src/utils/chatPerf.ts`

Lightweight perf instrumentation with console logs tagged `⏱ chatPerf`.

Key measurement points:

| Method                                                           | Purpose                                               |
| ---------------------------------------------------------------- | ----------------------------------------------------- |
| `chatPerf.mark(label)`                                           | Mark a timing point (mount, focus)                    |
| `chatPerf.trackMount(screen, conversationId)`                    | New instance vs resume                                |
| `chatPerf.trackFocus(screen, conversationId, wasAlreadyMounted)` | Focus events                                          |
| `chatPerf.time(label, fn)`                                       | Measure function execution time (e.g., buildTimeline) |

### Navigate-First Pattern

See [Section 4](#4-navigation--chat-entry-performance).

### Screen Freeze

`freezeOnBlur: true` on `MainStack` eliminates React overhead for inactive chat screens.

### FlatList Tuning

See [Section 9 — FlatList Virtualization](#flatlist-virtualization).

### Width Cache

Cross-instance `WIDTH_CACHE` (max 5000 entries) in `CardWidthTracker` persists across conversation re-opens.

### Coalesced Notifications

`CardWidthTracker` uses `setTimeout(0)` to merge multiple width reports into one flush, preventing O(N²) cascades during pagination.

### Two-Phase FlatList Config

Hook: `src/hooks/chat/useTwoPhaseListConfig.ts`

Both `ChatScreen` and `GroupChatScreen` use a two-phase FlatList configuration to speed up initial render:

- **Phase 1 (conservative)**: `initialNumToRender: 12`, `maxToRenderPerBatch: 6`, `windowSize: 5` — fast first paint
- **Phase 2 (full)**: Promoted after `InteractionManager.runAfterInteractions` + 300 ms delay — `maxToRenderPerBatch: 12`, `windowSize: 11`

Phase 2 promotion is instrumented via `chatPerf.mark("phase2-promote")` and `chatPerf.measure("phase2-delay")`.

### Lazy-Loaded Picker Buttons

File: `src/components/chat/lazyChatComponents.tsx`

Five toolbar picker sheets (GIF, Emoji, Sticker, Game, GifSticker) are code-split with `React.lazy()`. Each button component wraps its sheet in `<Suspense fallback={<PickerLoadingFallback />}>`.

`PickerLoadingFallback` (`src/components/chat/PickerLoadingFallback.tsx`) renders a centered `ActivityIndicator` at 260px height.

### Inbox Press-In Preloading

`ChatListScreenV2` fires `prepareDmThreadEntry` / `prepareGroupChatNavigation` on `onPressIn` (touch-down) rather than waiting for `onPress` (touch-up). This overlaps ~100–200 ms of identity/asset warmup with the user's finger-down duration.

---

## 22. Test Coverage

### Contract and Merge Tests

- `__tests__/services/normalizeMessage.test.ts`
- `__tests__/services/chatV2.mergeMessagesWithOutbox.test.ts`
- `__tests__/services/normalizeInboxRow.test.ts`
- `__tests__/services/normalizeNotification.test.ts`
- `__tests__/services/messageRequests.test.ts`

### Hook and Integration Behavior

- `__tests__/hooks/inboxPathParity.test.ts`
- `__tests__/hooks/useUnifiedInboxRequests.test.ts`
- `__tests__/integration/unifiedChat.test.ts`
- `__tests__/screens/threadScreen.lifecycle.test.ts`

### UI Behavior

- `__tests__/components/conversationItem.unreadBadge.test.ts`

### Manual Verification Checklist

1. Inbox loads with identical semantics in fan-out and aggregated modes
2. Requests tab shows friend/group/message requests and refreshes all sources
3. Open DM and group threads, send messages, no duplicates on realtime updates
4. Scroll pagination and receive realtime updates concurrently, ordering stable
5. Open thread view and navigate away/back, no leaked listeners
6. Notification tap routes to correct destination without duplicate navigation
7. Long-press message → quick reaction tray appears with 6 emojis
8. Tap quick reaction → pill appears below correct message
9. Tap "+" → full emoji picker with categories and search
10. Tap own reaction pill → reaction removed
11. Reactions work for text, image, voice, and animal messages
12. Both display modes (bubbles/stacked) render correctly
13. Grouped cards snap correctly and corner rounding adapts
14. Composer toolbar drag-and-drop works
15. GIF picker loads and sends GIF messages
16. Custom font color applies in both display modes

---

## 23. Known Issues & Risks

### Resolved Risk Ledger

All major Phase 3+ risks have been resolved:

| Risk                                              | Status    | Resolution                                            |
| ------------------------------------------------- | --------- | ----------------------------------------------------- |
| Dual-runtime contract drift (SQLite vs Firestore) | **Fixed** | Canonical normalization layer, shared ordering/dedupe |
| Inbox path drift (fan-out vs aggregated)          | **Fixed** | Shared row normalization, unread computation          |
| Requests-tab source fragmentation                 | **Fixed** | Unified typed request stream                          |
| Notification payload mismatch and dedupe          | **Fixed** | Canonical notification adapter                        |
| Group chat runtime crash (timestamp)              | **Fixed** | Hardened Firestore timestamp parsing                  |
| Text-node rendering warning                       | **Fixed** | Guarded slot/children rendering                       |
| GroupChatInfoScreen hero buttons not pressable    | **Fixed** | Counter-translate cover-sheet architecture (see §6)   |

### Current Non-Blocking Risks

#### Legacy push trigger overlap (Low)

`CHAT_LEGACY_PUSH_ENABLED` was documented as a gating flag but has no implementation. Legacy push triggers are not separately gated.

**Mitigation**: canonical payload adapter + dedupe keys reduce duplicates on client. `notificationCenter.ts` handles channel selection.

#### Full repo type-check not usable as chat gate (Medium)

Unrelated TypeScript errors outside chat reduce confidence in `npx tsc --noEmit` as a chat regression gate.

**Mitigation**: targeted chat unit/integration suites are green.

#### Aggregated inbox enrichments are minimal (Low)

Aggregated docs keep compact preview fields; richer avatar/profile parity still depends on client lookups.

**Mitigation**: client normalization preserves parity behavior and fallback defaults.

#### Keyboard jitter on KAV (Medium)

Current KAV `behavior: "height"` has known jitter due to async layout lag between Reanimated UI thread and RN Yoga JS thread.

**Resolution path**: Install `expo-dev-client` for native build → use KCSV + KSV architecture.

---

## 24. Sustaining Roadmap

### S1 — Notification Migration Guardrails (Low)

Prevent duplicate delivery when legacy triggers coexist with in-app channels. If separate legacy push gating is needed, implement `CHAT_LEGACY_PUSH_ENABLED` before relying on it.

### S2 — High-Volume Merge Stress Testing (Medium)

Add larger synthetic fixtures, repeat modified-snapshot merges with overlapping page windows, assert stable identity.

Targets:

- `__tests__/integration/unifiedChat.test.ts`
- `__tests__/services/chatV2.mergeMessagesWithOutbox.test.ts`

### S3 — Inbox Parity Telemetry (Low)

Emit diagnostic counters in debug builds for fan-out vs aggregated row count and unread deltas. Track pinned ordering mismatches.

### S4 — Aggregated Inbox Enrichment (Low, Optional)

Evaluate adding richer avatar/profile snapshots to `InboxEntry` from triggers.

### S5 — Thread Lifecycle Reliability Sweep (Medium)

Add route churn tests for rapid thread switching. Verify no callback execution after cleanup. Confirm unsubscribe counts match subscribe counts.

---

## 25. Historical Checkpoints

These checkpoints record the Phase 2→3+ cleanup effort:

| Checkpoint | Date       | Theme                                                                       | Status   |
| ---------- | ---------- | --------------------------------------------------------------------------- | -------- |
| C1         | 2026-03-04 | Thread listener and notification correctness                                | Complete |
| C2         | 2026-03-04 | Requests tab integration and dead code cleanup                              | Complete |
| C3         | 2026-03-04 | Local message lifecycle reset hardening                                     | Complete |
| C4         | 2026-03-04 | Merge and dedupe helper extraction                                          | Complete |
| C5         | 2026-03-05 | Canonical message normalization parity                                      | Complete |
| C6         | 2026-03-05 | Inbox normalization and unread source-of-truth                              | Complete |
| C7         | 2026-03-05 | Unified inbox requests typed hook                                           | Complete |
| C8         | 2026-03-05 | Notification payload adapter and legacy gating                              | Complete |
| C9         | 2026-03-05 | Group chat runtime crash and text-node warning                              | Complete |
| C10        | 2026-04    | Chat-entry performance (two-phase FlatList, lazy pickers, press-in preload) | Complete |
| C11        | 2026-04    | GroupChatInfoScreen fixed-hero cover-sheet architecture                     | Complete |

---

## Extension Points

When adding new shared chat features, prefer this order:

1. Extend `MessageV2` and backend contracts first
2. Add shared helpers/components under `src/chat/` or `src/components/chat/`
3. Inject scope-specific behavior from screens rather than duplicating components
4. Document whether the feature is universal, DM-only, or group-only

Good extension seams:

- `sendDraft.ts` for send orchestration
- `ChatHeader` for shared top-bar behavior
- `ChatMessageRenderer` / `GroupStackedMessageRenderer` for render behavior
- `MessageActionsSheet` for interaction affordances

## Intentional Exceptions

- `ThreadScreen.tsx` remains a specialized screen (not part of shared chat surface)
- Web still uses the Firestore-first compatibility runtime underneath `useChat`

## Migration Notes

- If you find old docs/comments mentioning a DM-only `MessageWithProfile` render pipeline, they are stale
- If you change group typing behavior, preserve `typingAt` as canonical field; keep `typingExpiresAt` as temporary compatibility
- If you need a new DM/group difference, add it at the screen-configuration layer first — do not fork the full render pipeline
