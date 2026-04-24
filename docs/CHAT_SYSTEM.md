# Chat System — Complete Reference

> Consolidated chat system documentation for SnapStyle MVP.
> Covers architecture, rendering, scorecards, composer, voice recording,
> keyboard behavior, reactions, GIF integration, custom font colors,
> data contracts, inbox/unread, threading, notifications, performance,
> known issues, and sustaining roadmap.

Last verified: 2026-04-23

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
| Inbox aggregation client default           | Enabled (`CHAT_INBOX_AGGREGATION = true`)                    |
| DM + group detail screens                  | Unified around shared `MessageV2` foundation                 |
| Threads                                    | Implemented (specialized screen)                             |
| Display modes (Bubbles + Stacked)          | Implemented, viewer-side setting                             |
| Grouped card system                        | Implemented with adaptive width snapping and corner rounding |
| Composer toolbar customization             | Implemented with drag-and-drop editing                       |
| Inline game scorecards in chat             | Implemented with trusted structured payload + rich renderer  |
| Multiline composer growth                  | Implemented (1-5 visible lines, then internal scroll)        |
| Voice recording inside composer shell      | Implemented                                                  |
| Keyboard scroll container                  | Shared fallback path is primary; KCSV scroll component off   |
| GIF picker (KLIPY)                         | Implemented behind feature flag                              |
| Custom font colors                         | Implemented with 16-color catalog                            |
| Reactions                                  | Implemented with optimistic UI                               |

### Scope

This document covers:

- DM chat and group chat
- Inbox and unread behavior
- Message requests
- Reactions, voice notes, mentions, attachments, and scheduled messages
- Inline game scorecards as a chat-rendered cross-system surface
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
+------------------------------------------------------------------+
¦                     Navigation Layer                             ¦
¦  MainTab ? InboxStack ? ChatListScreenV2                         ¦
¦         ¦                 +- ChatScreen (DM)          ? MainStack¦
¦         ¦                 +- GroupChatScreen (group)   ? MainStack¦
¦         ¦                 +- ThreadScreen             ? MainStack¦
¦         ¦                                                        ¦
¦         +- freezeOnBlur: true (inactive screens frozen)          ¦
+------------------------------------------------------------------+
         ¦
         ?
+------------------------------------------------------------------+
¦                     Runtime Layer                                ¦
¦  useChat --- useLocalMessages (native, SQLite-first)             ¦
¦           +- useUnifiedMessages (web, Firestore fallback)        ¦
¦                                                                  ¦
¦  useInboxData --- fan-out mode (subscribe Chats + Groups)        ¦
¦                +- aggregated mode (Users/{uid}/Inbox/*)           ¦
¦                                                                  ¦
¦  useUnifiedInboxRequests (friend + group + message requests)     ¦
+------------------------------------------------------------------+
         ¦
         ?
+------------------------------------------------------------------+
¦                     Render Layer                                 ¦
¦  buildTimeline() ? TimelineItem[] (grouping flags + dividers)    ¦
¦         ¦                                                        ¦
¦         +- Bubble mode ? DMMessageItem / GroupChatScreen inline   ¦
¦         +- Stacked mode ? StackedMessageRenderer /               ¦
¦                           GroupStackedMessageRenderer             ¦
¦              +- Grouped Card System (CardWidthTracker, snap,     ¦
¦                 adaptive corner rounding)                        ¦
+------------------------------------------------------------------+
         ¦
         ?
+------------------------------------------------------------------+
¦                     Backend Layer                                ¦
¦  sendMessageV2 (Cloud Function) ? Firestore write + triggers     ¦
¦  inboxTriggers ? per-user aggregated inbox update                ¦
¦  toggleReactionV2 ? reaction subcollection + summary update      ¦
¦  notificationCenter ? channel routing (in-app / push / none)     ¦
+------------------------------------------------------------------+
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

| File                                                  | Purpose                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| `src/components/chat/ChatHeader.tsx`                  | Shared header scaffold                                         |
| `src/components/chat/ChatMessageList.tsx`             | Inverted FlatList wrapper                                      |
| `src/components/chat/ChatComposer.tsx`                | Composer UI (text input, toolbar, attachments)                 |
| `src/components/chat/NativeComposerInput.tsx`         | iOS native UITextView-backed composer path                     |
| `src/components/chat/CameraLongPressButton.tsx`       | Dual-action camera button: tap camera, hold to arm photos      |
| `src/components/chat/AnimalLongPressButton.tsx`       | Dual-action animal button: tap quick picker, hold full catalog |
| `src/components/chat/VoiceRecordButton.tsx`           | Hold-to-record gesture owner for voice messages                |
| `src/components/chat/VoiceRecordingHost.tsx`          | Composer-scoped recording overlay + measurement bridge         |
| `src/components/chat/ChatMessageRenderer.tsx`         | DM entry point - delegates to Stacked or Bubble renderer       |
| `src/components/chat/MessageActionsSheet.tsx`         | Long-press action sheet with quick reactions                   |
| `src/components/chat/SystemMessageChip.tsx`           | System message presentation                                    |
| `src/gamesV4/components/ChatScorecardMessage.tsx`     | First-class chat wrapper for trusted game scorecards           |
| `src/gamesV4/components/GameScorecard.tsx`            | Rich scorecard card rendered inline in chat                    |
| `src/components/DMMessageItem.tsx`                    | DM bubble-mode message renderer                                |
| `src/components/chat/StackedMessageRenderer.tsx`      | DM stacked-mode message renderer with card containers          |
| `src/components/chat/GroupStackedMessageRenderer.tsx` | Group stacked-mode message renderer with card containers       |
| `src/components/chat/ReactionBar.tsx`                 | ReactionPills + QuickReactionBar                               |
| `src/components/chat/ReactionDetailSheet.tsx`         | Modal showing who reacted per emoji                            |
| `src/components/chat/ThreadIndicator.tsx`             | "View thread (N replies)" link                                 |
| `src/components/chat/DateDivider.tsx`                 | Day separator                                                  |
| `src/components/chat/ChatKeyboardScrollView.tsx`      | KCSV adapter + ChatFooterWrapper + isKCSVAvailable             |
| `src/components/chat/PickerLoadingFallback.tsx`       | Suspense fallback for lazy-loaded picker buttons               |
| `src/components/chat/lazyChatComponents.tsx`          | React.lazy wrappers for modals (emoji, schedule, block)        |
| `src/components/chat/pickerPreload.ts`                | Eager preload registry for toolbar picker sheet bundles        |

### Hooks & Services

| File                                                  | Purpose                                                   |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `src/hooks/useChat.ts`                                | Runtime selector — delegates to local or unified messages |
| `src/hooks/useLocalMessages.ts`                       | SQLite-first message runtime (native)                     |
| `src/hooks/useUnifiedMessages.ts`                     | Firestore-first message runtime (web fallback)            |
| `src/hooks/useUnifiedChatScreen.ts`                   | Shared screen scaffold hook                               |
| `src/hooks/useChatComposer.ts`                        | Unified composer state (text, mentions, attachments, voice) |
| `src/hooks/useInboxData.ts`                           | Inbox runtime selector (fan-out or aggregated)            |
| `src/hooks/useInboxAggregation.ts`                    | Aggregated inbox mode                                     |
| `src/hooks/useUnifiedInboxRequests.ts`                | Unified requests stream                                   |
| `src/hooks/useConversationActions.ts`                 | Conversation action handlers                              |
| `src/hooks/useFontColor.ts`                           | Custom font color hook                                    |
| `src/contexts/ComposerSheetContext.tsx`               | Picker-sheet replacement, handoff floor, interaction gates |
| `src/store/ChatKeyboardPreferenceContext.tsx`         | Global auto-open keyboard preference                      |
| `src/services/chat/normalizeMessage.ts`               | Canonical message normalization                           |
| `src/services/chat/normalizeInboxRow.ts`              | Canonical inbox row normalization                         |
| `src/services/chat/fanoutInboxNormalization.ts`       | Fan-out inbox normalizers                                 |
| `src/services/chat/unifiedInboxRequests.ts`           | Request merge + dedupe                                    |
| `src/services/chat/messageRequestsContract.ts`        | Message request normalization                             |
| `src/services/chat/threadIdentityWarmup.ts`           | Pre-navigation identity/asset warmup                      |
| `src/services/chat/unifiedMessagesLifecycle.ts`       | Realtime + pagination merge                               |
| `src/services/chat/inboxAggregation.ts`               | Aggregated inbox mark-read                                |
| `src/services/chat/inboxParityTelemetry.ts`           | Debug-mode fan-out vs aggregated inbox parity comparison  |
| `src/services/messaging/send.ts`                      | Send orchestration (web path)                             |
| `src/services/messaging/subscribe.ts`                 | Firestore realtime subscriptions                          |
| `src/services/messaging/messageMerge.ts`              | Merge helper                                              |
| `src/services/reactions.ts`                           | Reaction service (toggle, subscribe, optimistic)          |
| `src/gamesV4/services/scorecardWire.ts`               | Trusted scorecard wire format + preview sanitization      |
| `src/services/notifications/normalizeNotification.ts` | Notification payload adapter                              |
| `src/services/profileService.ts`                      | Profile + equip/unequip font color                        |
| `src/services/groupMembers.ts`                        | Group member state normalization                          |
| `src/services/scheduledMessages.ts`                   | Scheduled messages service                                |
| `src/hooks/chat/useTwoPhaseListConfig.ts`             | Two-phase FlatList config (conservative ? full)           |
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

| File                                                               | Purpose                               |
| ------------------------------------------------------------------ | ------------------------------------- |
| `src/components/chat/ChatComposer.tsx`                             | Main composer component               |
| `src/components/chat/ComposerToolbar/ComposerToolbarRegistry.ts`   | Central item definition catalog       |
| `src/components/chat/ComposerToolbar/ComposerToolbarRow.tsx`       | Toolbar rendering row                 |
| `src/components/chat/ComposerToolbar/ComposerCustomizeToolbar.tsx` | Edit/drag-and-drop toolbar editor     |
| `src/components/chat/ComposerToolbar/ComposerItemPicker.tsx`       | Item picker for adding toolbar items  |
| `src/components/chat/ComposerToolbar/types.ts`                     | Toolbar type definitions and defaults |
| `src/hooks/useComposerToolbarLayout.ts`                            | Toolbar state + persistence hook      |
| `src/components/chat/pickerPreload.ts`                             | Eager import cache for picker sheets  |

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
| `src/components/chat/lazyChatComponents.tsx`    | React.lazy wrappers — code-split modal sheets from chat bundle      |
| `src/components/chat/pickerPreload.ts`          | Eager preload cache — imports picker bundles on composer mount      |
| `src/utils/imagePrefetch.ts`                    | Image.prefetch utilities + usePrefetch hook                         |
| `src/utils/remoteImageSource.ts`                | URL normalization + source builder for expo-image cache alignment   |

### Backend

| File                                                   | Purpose                                                |
| ------------------------------------------------------ | ------------------------------------------------------ |
| `firebase-backend/functions/src/messaging.ts`          | sendMessageV2, toggleReactionV2                        |
| `firebase-backend/functions/src/messageRequests.ts`    | Message request endpoints                              |
| `firebase-backend/functions/src/inboxTriggers.ts`      | Per-user aggregated inbox triggers + member-state sync |
| `firebase-backend/functions/src/chatMedia.ts`          | Chat media upload/finalization                         |
| `firebase-backend/functions/src/notificationCenter.ts` | Notification routing (in-app/push/none)                |
| `firebase-backend/functions/src/notifications.ts`      | Canonical DM/group push triggers                       |

---

## 4. Navigation & Chat Entry Performance

### Navigate-First Pattern

Navigation from the inbox to a chat screen follows a **navigate-first** pattern:

1. `ChatListScreenV2.handleConversationPress` calls `navigation.navigate()` immediately
2. Identity/asset warmup (`prepareDmThreadEntry`, `prepareGroupChatNavigation` from `threadIdentityWarmup.ts`) runs in the background as fire-and-forget
3. Cached data (name, avatar, group metadata) is passed via nav params as `initialData` / `initialGroupData` for instant display before subscriptions deliver full data

### Press-In Preloading

`ChatListScreenV2.handleConversationPressIn` fires on touch-down (~150–300 ms before tap completes):

- **DM**: calls `prepareDmThreadEntry` (avatar + decoration warmup)
- **Group**: normalizes `backgroundUrl` via `normalizeRemoteImageUrl()`, calls `prefetchImages([bgUrl])` for earliest possible cache hit, then fires `prepareGroupChatNavigation()` in parallel

This overlaps warmup work with the user's finger-down duration, giving the background image ~150–300 ms of loading time before the screen even mounts.

### Group Background Loading Architecture

Group chat backgrounds pass through a multi-layered warmup pipeline to ensure instant display on both first open and subsequent reopens.

#### Cache Alignment

All paths use `normalizeRemoteImageUrl()` (trims whitespace) before interacting with expo-image. The render path uses `buildRemoteImageSource(url)` which normalizes internally. This ensures the prefetch cache key, warmup cache key, and render cache key are always identical.

#### Warmup Pipeline

```
handleConversationPressIn (touch-down, ~150-300ms before navigation)
+- prefetchImages([normalizedUrl])        ? Image.prefetch("memory-disk")
+- prepareGroupChatNavigation()           ? fire-and-forget
    +- prepareGroupThreadEntry()
        +- warmIdentityImageUrls([bgUrl]) ? Image.loadAsync(normalizedUrl)
        +- (runs in parallel with member fetch)

handleConversationPress (tap complete)
+- navigation.navigate("GroupChat", { initialGroupData })
    +- GroupChatScreen mounts
        +- useState initializer seeds group.backgroundUrl from initialGroupData
        +- usePrefetch(groupBackgroundUrls) schedules Image.prefetch()
        +- AppImage renders with buildRemoteImageSource(group.backgroundUrl)
```

#### Rendering

`GroupChatScreen` renders the background via `AppImage` inside `ChatKeyboardContainer.backgroundLayer`:

- `source={buildRemoteImageSource(group.backgroundUrl)}` — normalized URI for cache alignment
- `priority="high"` — signals expo-image to prioritize this load
- `transition={0}` — no cross-dissolve animation
- `cachePolicy="memory-disk"` — reads from memory first, falls back to disk
- Container uses `backgroundColor: "#121212"` (dark neutral) as fallback when `backgroundUrl` is set, eliminating white flash in light mode

#### Reopen Stability

`warmRemoteImage()` in `threadIdentityWarmup.ts` always calls `Image.loadAsync()` regardless of whether a previous load succeeded (no JS-side ImageRef caching). Concurrent calls to the same URL are deduped via `imageWarmPromises`. This ensures the native memory cache is re-warmed on every open — the platform may evict decoded bitmaps from memory after a screen unmounts, so re-calling `Image.loadAsync()` is required to guarantee memory residency.

When `group.backgroundUrl` from Firestore matches `initialGroupData.backgroundUrl`, `usePrefetch`'s string-keyed dedup skips redundant prefetch calls. The `groupBackgroundUrls` useMemo dependency on `group?.backgroundUrl` prevents unnecessary recomputation.

### Deferred Mount Work

Both `ChatScreen` and `GroupChatScreen` defer non-critical work via `scheduleIdleWork()` (yields to the next idle frame) to avoid blocking navigation transitions:

- `markConversationNotificationsRead` — deferred to idle (pure backend side-effect)
- `getGroupMemberPrivate` (group only) — deferred member preferences read
- Background profile refresh on DM re-focus — deferred to idle
- Link preview fetching (group only) — deferred to idle

The `isGroupMember` membership check remains gated on `InteractionManager.runAfterInteractions()` because its error state would cause a jarring UI change during transition animation.

### Screen Freeze on Blur

The `MainStack` navigator uses `freezeOnBlur: true`, which freezes inactive screens via `react-native-screens`. When navigating Chat ? Thread or Chat ? GroupInfo, the chat screen receives no React re-renders, effects, or state updates. Return-to-chat is near-instant (native view unfreeze).

Note: `freezeOnBlur` only applies to screens already in the back stack. When the user navigates **back** (e.g., from GroupChat to Inbox), GroupChatScreen is popped and unmounted — each navigation to GroupChat creates a fresh component instance.

### Performance Instrumentation

Performance is instrumented via `chatPerf` (`src/utils/chatPerf.ts`) at mount, focus, and `buildTimeline` call sites. Console logs tagged `? chatPerf`.

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
  - Builds `MemberStatePrivate` from synced Inbox entry fields (zero extra reads) when `lastSeenAtPrivate` is present; falls back to `MembersPrivate` fetch for pre-sync entries

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

- **Push tap normalization and navigation**: `src/store/AuthContext.tsx` ? adapter: `src/services/notifications/normalizeNotification.ts`
- **Foreground in-app notifications**: `src/store/InAppNotificationsContext.tsx` with listeners for friend requests, chat updates, group updates, and `Users/{uid}/InAppNotificationsV4`
- **Legacy DM/group push triggers**: `firebase-backend/functions/src/notifications.ts`

Note: Legacy push triggers were removed from `legacy.ts` on 2026-04-13 (~450 LOC of dead code). `index.ts` imports only canonical versions from `notifications.ts`. All chat push notifications route through `notificationCenter.ts` with atomic dedupe.

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
4. True system messages render through `SystemMessageChip`
5. Trusted scorecard messages are decoded with `getTrustedScorecardPayload()` and render through `ChatScorecardMessage`
6. All other messages render through shared/canonical message components

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

- **Native**: `useChat` ? `useLocalMessages` ? SQLite + sync engine
- **Web**: `useChat` ? `useUnifiedMessages` ? Firestore compatibility services

Both screen types consume the same `useChat` surface even though the storage backend differs by platform.

### Shared vs Scope-Specific Responsibilities

**Universal chat logic** (should stay shared):

- Message envelope and normalization
- Scorecard trust gate plus scorecard preview/copy sanitization
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

**Private state** (`MembersPrivate/{uid}`) - owner-only source for:

- Mute/archive/pin
- Private unread watermarks
- Notification overrides
- Auto-send scorecards for hosted games in this specific conversation
- Show-member-chat-styles

Important scope distinctions:

- `autoSendScorecards` is per-conversation and defaults to enabled when missing. It only affects scorecard auto-posting for games the current user hosted.
- `showMemberChatStyles` is group-only and affects how incoming member styles are rendered, not how scorecards or system cards are authored.
- "Open Keyboard on Chat Open" is not a per-chat setting. It is a global preference stored at `Users/{uid}.autoOpenKeyboardOnChat` and mirrored into AsyncStorage by `ChatKeyboardPreferenceContext`.

### Render Architecture

**DM rendering**: Canonical `MessageV2` all the way down:

- `ChatScreen.tsx` ? `ChatMessageRenderer.tsx` ? `DMMessageItem.tsx` (bubble) or `StackedMessageRenderer.tsx` (stacked)

**Group rendering**: `MessageV2` with multi-sender identity, mentions, permissions-aware actions:

- `GroupChatScreen.tsx` ? `GroupStackedMessageRenderer.tsx` (stacked) or inline bubble renderer

### Reaction Subscription Stability

Both chat screens stabilize their reaction `useEffect` dependency using a `reactionTargetKey` — a memoized sorted comma-joined string of visible message IDs. This prevents the subscription from tearing down and re-subscribing on every `messages` array reference change.

### GroupChatInfoScreen — Fixed-Hero Cover-Sheet Architecture

`src/screens/groups/GroupChatInfoScreen.tsx` uses a **counter-translate cover-sheet** pattern so the hero section (group avatar, name, action buttons) stays visually fixed while the content sheet scrolls up to cover it.

#### Layer Model

```
+------------------------------------------------------------------+
¦  Layer 1 — fixedHeroBg (absolute, zIndex: 0, pointerEvents: none)¦
¦  Background image + LinearGradient only. No interactive elements.¦
+------------------------------------------------------------------+
         ? (painted first)
+------------------------------------------------------------------+
¦  Layer 2 — Animated.ScrollView                                   ¦
¦  +------------------------------------------------------------+  ¦
¦  ¦  Spacer (height: heroSpacerHeight)                         ¦  ¦
¦  ¦    +- Animated.View (heroFixedContent)                     ¦  ¦
¦  ¦         translateY: +scrollY  ? stays visually fixed       ¦  ¦
¦  ¦         Contains: avatar, name, edit buttons, voice room   ¦  ¦
¦  +------------------------------------------------------------+  ¦
¦  +------------------------------------------------------------+  ¦
¦  ¦  Content sheet (opaque bg, minHeight: windowHeight)        ¦  ¦
¦  ¦    Members, settings, permissions, leave/delete buttons    ¦  ¦
¦  ¦    Painted AFTER spacer ? covers hero via painter's order  ¦  ¦
¦  +------------------------------------------------------------+  ¦
+------------------------------------------------------------------+
         ? (painted last)
+------------------------------------------------------------------+
¦  Floating header (absolute, zIndex: 10)                          ¦
¦  Back button + animated title opacity                            ¦
+------------------------------------------------------------------+
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

1. `handleHeroLayout` fires `onLayout` ? sets `heroContentHeight`
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
    ¦
    ?
dual-write: AsyncStorage (instant) + Firestore Users/{uid} (persistent)
    ¦
    ?
useConversationDisplayMode() reads combined source
    ¦
    ?
ChatMessageRenderer / GroupChatScreen selects renderer
    ¦
    +- "bubbles" ? DMMessageItem / inline bubble views
    +- "stacked" ? StackedMessageRenderer / GroupStackedMessageRenderer
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
- Trusted scorecard rows in stacked group chats keep the same group boundary logic via `ChatScorecardMessage`, which mirrors the grouped-card surface/corner rules around the fixed-width `<GameScorecard />`

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
+------------------------------------------------------------------+
¦ GroupChatScreen / ChatScreen (parent)                            ¦
¦                                                                  ¦
¦  +- CardWidthTracker (single instance per conversation) -------+ ¦
¦  ¦  - nodes: Map<messageId, CardWidthNode>                     ¦ ¦
¦  ¦    (CardWidthNode: { width?, prevId?, nextId? })            ¦ ¦
¦  ¦  - listeners: Map<messageId, Set<snapshot callback>>        ¦ ¦
¦  +-------------------------------------------------------------+ ¦
¦                                                                  ¦
¦  +- FlatList (inverted) ---------------------------------------+ ¦
¦  ¦  renderItem ? for each TimelineItem:                        ¦ ¦
¦  ¦    +- type: "date-divider" ? <DateDivider />                ¦ ¦
¦  ¦    +- type: "message" ?                                     ¦ ¦
¦  ¦        +- Compute groupPrevMessageId / groupNextMessageId   ¦ ¦
¦  ¦        +- <GroupStackedMessageRenderer /> (group chats)      ¦ ¦
¦  ¦           or <StackedMessageRenderer /> (DMs)                ¦ ¦
¦  ¦             +- useGroupedCardLayout() hook                   ¦ ¦
¦  ¦               +- cardWrapper View (background, radii, snap)  ¦ ¦
¦  ¦                 +- cardContent View (onLayout ? width track) ¦ ¦
¦  ¦                   +- MessageHighlightOverlay                ¦ ¦
¦  ¦                   +- Author header (group-start only)       ¦ ¦
¦  ¦                   +- Reply preview (StackedReplyReference)  ¦ ¦
¦  ¦                   +- Message content (text / image / voice) ¦ ¦
¦  ¦                   +- Reaction pills                         ¦ ¦
¦  ¦                   +- ThreadIndicator (inline, mid-group)    ¦ ¦
¦  ¦               +- ThreadIndicator (external, group-end/solo) ¦ ¦
¦  +--------------------------------------------------------------+ ¦
+------------------------------------------------------------------+
```

### Row Grid Structure

```
+----------------------------------------------------------+
¦ feedRow (width: 100%, paddingHorizontal: 8)              ¦
¦                                                          ¦
¦  +----------+  +--------------------------------------+  ¦
¦  ¦  gutter   ¦  ¦  contentColumn (flex: 1)             ¦  ¦
¦  ¦  (40px)   ¦  ¦                                      ¦  ¦
¦  ¦  + gap    ¦  ¦  +- cardWrapper (outer) -----------+ ¦  ¦
¦  ¦  (14px)   ¦  ¦  ¦  alignSelf: "flex-start"       ¦ ¦  ¦
¦  ¦           ¦  ¦  ¦  backgroundColor: background   ¦ ¦  ¦
¦  ¦  [avatar] ¦  ¦  ¦  overflow: "hidden"             ¦ ¦  ¦
¦  ¦  or       ¦  ¦  ¦  [adaptive border radii]        ¦ ¦  ¦
¦  ¦  [spacer] ¦  ¦  ¦  [minWidth: snapMinWidth]       ¦ ¦  ¦
¦  ¦           ¦  ¦  ¦                                 ¦ ¦  ¦
¦  ¦           ¦  ¦  ¦  +- cardContent (inner) ------+ ¦ ¦  ¦
¦  ¦           ¦  ¦  ¦  ¦  paddingH: 12, paddingV: 6 ¦ ¦ ¦  ¦
¦  ¦           ¦  ¦  ¦  ¦  onLayout ? width tracking  ¦ ¦ ¦  ¦
¦  ¦           ¦  ¦  ¦  ¦  [message content]          ¦ ¦ ¦  ¦
¦  ¦           ¦  ¦  ¦  +----------------------------+ ¦ ¦  ¦
¦  ¦           ¦  ¦  +---------------------------------+ ¦  ¦
¦  +----------+  +--------------------------------------+  ¦
+----------------------------------------------------------+
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

Snapping is transitive: if A?B and B?C are each within threshold, all three snap to `max(A, B, C)` even if `|A - C| > threshold`.

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
| **Top-Right**    | `8` (always) | Width rule ? | Width rule ? |
| **Bottom-Right** | Width rule ? | `8` (always) | Width rule ? |

**Width rule**: `currentWidth > adjacentWidth` ? `8` (rounded); else ? `0` (flat)

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

- **GroupStackedMessageRenderer**: Raw grouping flag primitives ? internal `useMemo` VM. `@mention` row highlighting. `MessageWithMentions` for text. Stable parent callbacks.
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

### Multiline Text Box Contract

The current composer grows upward from a one-line shell to a five-line shell, then hands overflow to the input's internal scroll view.

Current implementation details:

- `ChatComposer.tsx` clamps the text-box shell with `COMPOSER_MIN_HEIGHT = 40` and `COMPOSER_MAX_HEIGHT = 130`
- the growth contract is owned by the text-input container, not by the outer chat screen
- the fallback React Native `TextInput` path is multiline and relies on native internal scrolling once the shell hits max height
- the iOS native path uses `NativeComposerInput.tsx`, which listens to the native view's `onContentSizeChange` and applies an explicit height between `40` and `130` so Yoga expands correctly
- `ChatComposer.tsx` itself does not run a JS `onContentSizeChange` measurement loop
- send clears the current input buffer immediately, then refocuses once so the keyboard stays open without the older multi-timeout flicker workaround

Practical result:

- line 1 to line 5 expands the composer shell
- once the user goes past that height, the shell stays capped and the text view scrolls internally
- chat layout reacts to the shell height because the composer itself changes height, rather than because the screen measures text manually

### Voice Recording Inside the Composer

Voice recording is no longer a separate floating strip. The recording UI is rendered inside the same text-box shell.

Ownership split:

- `VoiceRecordButton.tsx` owns the gesture and recorder lifecycle
- `useVoiceRecorder.ts` owns recorder permissions, timing, duration tracking, and completion payloads
- `VoiceRecordingHost.tsx` bridges host bounds and recording state from the mic button back up to the composer
- `VoiceRecordingOverlay` is rendered as the last child of `textInputContainer`, so the text box visually transforms into the recording surface

Current interaction model:

- mic is shown only when there is no text, no attachment payload, and no overriding right accessory competing for that slot
- press-and-hold starts recording
- drag left over the far-left X target arms cancel
- drag up over the centered lock target arms lock
- release cancels, locks, or stops-and-sends depending on hover target
- when locked, the mic hides and the overlay's right-side discard/send controls take over
- on web, voice recording uses a click-to-toggle path instead of press-and-hold

Layout details that matter:

- the overlay background intentionally matches the composer shell background
- the timer pill sits above the composer and is centered over the lock target
- because the overlay measures the real `textInputContainer` bounds, cancel/lock/timer placement adapts automatically to toolbar width, composer resizing, and left/right accessory changes

### Composer Toolbar Customization

Users can rearrange and customize toolbar items through a drag-and-drop editor.

#### Architecture

The toolbar system is modeled after the WidgetBoard registry pattern:

| File                                        | Role                                                         |
| ------------------------------------------- | ------------------------------------------------------------ |
| `ComposerToolbarRegistry.ts`                | Central item definition catalog (metadata, constraints)      |
| `ComposerToolbarRow.tsx`                    | Runtime toolbar rendering                                    |
| `ComposerCustomizeToolbar.tsx`              | Drag-and-drop editor overlay                                 |
| `ComposerItemPicker.tsx`                    | Category-grouped picker for adding items                     |
| `types.ts`                                  | `ComposerToolbarItemId`, `ComposerToolbarItem`, layout types |
| `useComposerToolbarLayout.ts` (in `hooks/`) | Persistence, validation, and state management                |

#### Data Model

```typescript
type ComposerToolbarItemId =
  | "message-bar"
  | "camera"
  | "game"
  | "animal"
  | "send"
  | "emoji"
  | "schedule"
  | "gif"
  | "sticker"
  | "gif-sticker"
  | "image-picker";

interface ComposerToolbarItem {
  id: ComposerToolbarItemId;
  position: number; // 0-based left-to-right
  flexWeight?: number; // Only for message-bar (0.3–0.8)
}
```

Stored at `Users/{uid}.composerToolbar` in Firestore.

#### Available Item IDs

| ID             | Label           | Category | Removable               |
| -------------- | --------------- | -------- | ----------------------- |
| `message-bar`  | Message Bar     | core     | **No** (always present) |
| `camera`       | Camera          | media    | Yes                     |
| `game`         | Games           | actions  | Yes                     |
| `animal`       | Animal          | actions  | Yes                     |
| `send`         | Send Button     | core     | Yes                     |
| `emoji`        | Emoji           | actions  | Yes                     |
| `schedule`     | Schedule        | actions  | Yes                     |
| `gif`          | GIF             | media    | Yes                     |
| `sticker`      | Stickers        | media    | Yes                     |
| `gif-sticker`  | GIFs & Stickers | media    | Yes                     |
| `image-picker` | Photos          | media    | Yes                     |

#### Camera Button Interaction Contract

The `camera` toolbar item is a **single dual-behavior item** backed by `CameraLongPressButton.tsx`. It does **not** proxy through the separate `image-picker` toolbar item; the dedicated `image-picker` item remains an independent toolbar button that always opens the library directly.

Camera behavior:

- **Quick tap** ? opens the normal camera (`handleCaptureFromCamera()`)
- **Hold** ? arms image-picker mode after `425 ms`
- **Release after arming** ? opens the photo library (`handleAddAttachment()`)

When the hold crosses the image-picker threshold, the camera button updates **before** the picker opens:

- icon swaps from `camera` to `image-multiple`
- circular button background turns purple (`#8B5CF6`)
- one light haptic fires

The armed image-picker state stays visible until the gesture resolves or is cancelled. If toolbar edit mode takes over, the camera button clears the armed state and suppresses the gallery launch.

If the user keeps holding past the camera slot's edit-mode threshold, the parent toolbar slot marks that press as claimed for edit mode before entering edit mode. The camera button treats that preemption signal as a hard cancellation point, so release cannot also open the gallery.

#### Animal Button Interaction Contract

The `animal` toolbar item is now a **single dual-behavior item** backed by `AnimalLongPressButton.tsx`.

Animal behavior:

- **Quick tap** ? opens the lightweight anchored animal picker bubble in chat
- **Hold** ? arms alternate animal-picker mode after `425 ms`
- **Release after arming** ? opens the full animal catalog via `Customization` ? `chat_animal_theme`

When the hold crosses the alternate-picker threshold, the animal button updates **before** navigation happens:

- the equipped animal image swaps to the alternate animal-picker icon (`paw`)
- the circular button background turns purple (`#8B5CF6`)
- one light haptic fires

The armed alternate-picker state stays visible until the gesture resolves or is cancelled. If toolbar edit mode takes over, the animal button clears the armed state and suppresses the alternate picker launch.

If the user keeps holding past the animal slot's edit-mode threshold, the parent toolbar slot marks that press as claimed for edit mode before entering edit mode. The animal button treats that preemption signal as a hard cancellation point, so release cannot also navigate to the full animal picker.

#### Toolbar Gesture Ownership

Toolbar edit mode is owned by `ComposerToolbarItem.tsx` via a slot-level long-press gesture, while child dual-mode buttons own their own tap-vs-hold behavior inside the slot.

Current child-owned dual-mode buttons:

- `CameraLongPressButton.tsx`
- `AnimalLongPressButton.tsx`

Default edit-mode long press:

- `500 ms` for all standard toolbar items

Dual-mode timing exceptions:

- image-picker arming threshold: `425 ms`
- animal alternate-picker arming threshold: `425 ms`
- edit-mode threshold: `1000 ms` (`500 ms` base + `500 ms` camera-only delay)
- animal edit-mode threshold: `1000 ms` (`500 ms` base + `500 ms` animal-only delay)

These item-specific delays prevent the slot-level edit-mode gesture from stealing the same press that is intended to switch the camera or animal button into its alternate picker mode. Other toolbar items keep the original edit-mode timing.

Crossing the slot's edit-mode threshold is also treated as a hard cancellation point for the child dual-mode action. The slot publishes that preemption before edit mode is entered, which avoids the responder race where edit mode appears and the earlier child hold action still fires on release.

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

`ComposerToolbarRegistry.ts` now carries per-item interaction metadata. `ComposerToolbarItem.tsx` reads the slot's configured edit-mode delay, which lets the camera item opt into the longer `1000 ms` edit-mode threshold without slowing down the rest of the toolbar.

### Picker Sheet Eager Preloading

Toolbar picker buttons (GIF, Emoji, Sticker, Game, GifSticker) are code-split via `React.lazy()` for bundle size reduction. The current system does more than warm imports: it preloads the picker modules, warms first-open data, prefetches the first visible preview assets into the `expo-image` cache, and then warm-mounts picker sheets offscreen after chat entry settles so the first visible open does not pay for a cold sheet/list mount.

#### How It Works

`src/components/chat/pickerPreload.ts` maintains a singleton cache of `import()` promises per picker module and warms initial picker data/image caches:

```
preloadPickersForToolbar(["gif", "emoji", "sticker"]) ? starts imports
  +- getGifPickerImport()      ? import("./GifPicker")         [cached]
  +- getEmojiPickerImport()    ? import("./FullEmojiPicker")   [cached]
  +- getStickerPickerImport()  ? import("./StickerPicker")     [cached]

warmGifPickerData()
  +- fetchTrending({ limit: 30 })
  +- getCategories()
  +- prefetchImages(first preview/category URLs)

warmStickerPickerData()
  +- fetchTrendingStickers({ limit: 30 })
  +- prefetchImages(first preview URLs)
```

Each button component's `React.lazy()` factory calls the same getter (e.g., `React.lazy(() => getGifPickerImport())`), so when the user taps the button, `React.lazy` resolves instantly from the cached promise. Once the import has resolved, the button keeps the picker component mounted with `open={false}` and `warmupEnabled={true}`. The picker renders a `DraggableBottomSheet` with `keepMountedWhenClosed`, so the Portal, sheet host, search bar, list, and first-frame layout all warm in the background rather than on the tap that the user feels.

#### Trigger

`ChatComposer.tsx` calls `preloadPickersForToolbar(activeToolbarItems.map(i => i.id))` in a `useEffect` on mount and whenever the toolbar layout changes. After `InteractionManager.runAfterInteractions()` plus `scheduleIdleWork()`, the composer flips a local warm-mount gate so equipped picker buttons can mount their hidden picker trees offscreen without contending with chat-entry animation. Only items with picker sheets are matched; non-picker items (camera, send, message-bar) are ignored.

#### Adding New Picker Items

1. Add the lazy import getter to `pickerPreload.ts`
2. Map the toolbar item ID to the getter in `MODULE_PRELOAD_MAP`
3. Add any first-open data or preview-image warmup to `warmDataForPicker()` when the picker has network-backed content
4. Update the button component's `React.lazy` factory to use the getter and pass the picker through the hidden warm-mount path

---

## 11. Keyboard Architecture

### Executive Summary

The current keyboard stack is built around one shared fallback container, not
around a native KCSV-first path.

What is true today:

- `KeyboardProvider` still wraps the app
- `useReanimatedKeyboardAnimationCompat()` is the live keyboard-height source
- native builds still benefit from keyboard-controller shared values when available
- Expo Go falls back to React Native keyboard events via `src/utils/optionalKeyboardController.tsx`
- `ChatKeyboardScrollView.tsx` still contains the KCSV codepath, but `kcsvAvailable` is intentionally hardcoded to `false`

### Why the Current Stack Exists

The chat screens need all of these at once:

1. An inverted `FlatList` that keeps the newest rows anchored at the bottom.
2. A composer that sits flush above the keyboard.
3. A message viewport that actually shrinks when the keyboard opens.
4. A bottom safe-area spacer when the keyboard is closed.
5. Smooth keyboard dismiss and picker-sheet handoff on iOS.

The older KAV/KSV-style approaches did not hold those constraints together
cleanly. The current production path favors a simpler animated layout
container over a scroll-wrapper trick.

### Active Production Path

All three chat screens now share one keyboard stack:

- `ChatKeyboardContainer` resolves to the fallback container in every build.
- The active path is an animated `paddingBottom` layout driven by shared
  keyboard values plus picker-sheet state.
- `ChatFooterWrapper` keeps the composer attached to the same bottom region.
- `renderScrollComponent` resolves to a plain `ScrollView` wrapper because the
  KCSV scroll component is deliberately disabled.
- `ComposerSheetContext` coordinates keyboard-to-sheet replacement, handoff
  floor, and interaction gates so picker sheets and the keyboard do not fight.

### Why the KCSV Scroll Component Is Off

`ChatKeyboardScrollView.tsx` keeps the KCSV code around, but it is not the
active runtime because it produced visible list motion during sheet-to-keyboard
and keyboard-to-sheet transitions.

The current fallback path won because:

- it kept the composer flush to the keyboard without visual drift
- it caused less chat-list motion during picker transitions
- it matched Expo Go behavior better
- it still preserved the useful native piece: shared keyboard-height values

### Composer and List Coordination

The message list and composer now coordinate through layout ownership rather
than through ad hoc screen measurement:

- the composer changes its own height as text grows
- the keyboard container animates the bottom region
- the safe-area spacer is part of the shared footer stack
- `maintainVisibleContentPosition` keeps doing its normal list job instead of
  being asked to fake keyboard avoidance

The result is that composer growth, keyboard movement, and picker replacement
all flow through the same shared bottom region.

### Global Keyboard Preference

The "Open Keyboard on Chat Open" toggle is global, not per-conversation.

Implementation:

- context: `src/store/ChatKeyboardPreferenceContext.tsx`
- local persistence: AsyncStorage key `@vibe/auto_open_keyboard_on_chat`
- cloud mirror: `Users/{uid}.autoOpenKeyboardOnChat`
- default: enabled when missing

`ChatScreen.tsx` and `GroupChatScreen.tsx` both honor that preference when
deciding whether to focus the composer on entry.

### Key Files

| File | Role |
| ---- | ---- |
| `src/components/chat/ChatKeyboardScrollView.tsx` | Active fallback container, footer wrapper, dormant KCSV switch |
| `src/components/chat/ChatMessageList.tsx` | Inverted list wrapper |
| `src/components/chat/ChatComposer.tsx` | Composer UI and height-owning text shell |
| `src/contexts/ComposerSheetContext.tsx` | Keyboard-replacement sheet state, handoff floor, interaction gate |
| `src/screens/chat/ChatScreen.tsx` | DM screen using the shared keyboard stack |
| `src/screens/groups/GroupChatScreen.tsx` | Group screen using the shared keyboard stack |
| `src/screens/chat/ThreadScreen.tsx` | Thread screen using the same footer/container pattern |
| `src/store/ChatKeyboardPreferenceContext.tsx` | Global auto-open keyboard preference |
| `src/utils/optionalKeyboardController.tsx` | Expo Go keyboard fallback feeding shared values |

---

## 12. Reaction System

### UX Flow

1. Long-press a message and open `MessageActionsSheet`.
2. Use one of the 6 curated quick reactions at the top of the sheet.
3. Use the `+` button to open the full `rn-emoji-keyboard` picker.
4. Select an emoji and call `toggleReactionV2`.
5. Render reaction pills below the message row.
6. Tap an existing pill to toggle participation.

### Data Model

Message docs carry a denormalized summary:

```text
Chats/{chatId}/Messages/{messageId}
Groups/{groupId}/Messages/{messageId}
  -> reactionsSummary: Record<string, number>
```

Per-message detail lives in a subcollection:

```text
.../Messages/{messageId}/Reactions/{emoji}
  -> emoji
  -> uids[]
  -> count
  -> updatedAt
```

Operational limits enforced in the stack today:

- document ID is the emoji itself
- max 20 unique emojis per message
- max 10 users are shown per emoji tab in the detail sheet

### Service Layer

Everything routes through `src/services/reactions.ts`.

| Function | What it owns |
| ---- | ---- |
| `toggleReaction()` | Calls the backend function |
| `applyOptimisticReaction()` | Pure optimistic state transform |
| `subscribeToReactions()` | Real-time listener for one message |
| `subscribeToMultipleMessageReactions()` | Batched visible-row subscription |
| `getReactions()` | One-shot fetch |
| `parseReactionsFromMessage()` | Converts `reactionsSummary` into `ReactionSummary[]` |

### Backend Function

`toggleReactionV2` validates:

- auth
- conversation membership
- emoji length
- basic rate limits

Then it runs a Firestore transaction that adds or removes the current UID and
updates `reactionsSummary`.

### Optimistic Behavior

The reaction path is intentionally optimistic:

1. The local array is updated immediately.
2. The server call runs in the background.
3. The Firestore listener later overwrites local state with the authoritative row.
4. Failures roll back through the same pure updater.

Implementation details that matter:

- an inflight set prevents rapid double-taps on the same emoji
- optimistic messages are forced into the subscription set so the first added
  reaction is not missed
- the screens stabilize their subscription dependency with a sorted
  `reactionTargetKey`, so effects do not rebuild on every `messages` array
  identity change

### Detail Sheet vs Long-Press Preview

These surfaces have distinct responsibilities:

- `ReactionDetailSheet.tsx` is a reactor list only. It does not show message
  preview text.
- `MessageActionsSheet.tsx` owns long-press preview text, copy text, and reply
  metadata derivation.
- `SwipeableMessage.tsx` mirrors the same reply-snippet sanitization rules for
  swipe-to-reply.

That split matters for scorecards: the scorecard row can still be reacted to,
but any text-based surface normalizes it to `Game Scorecard` rather than
showing the raw wire payload.

### Animations and Limits

- reaction pills use spring scale on tap
- pill enter and exit use fade transitions
- layout changes use `LinearTransition.springify()`
- `expo-haptics` light impact is used for quick feedback

Current non-blocking limitations:

- `reactionsSummary` does not contain per-user membership, so summary-only rows
  cannot know `hasReacted` without subscribing
- `ReactionDetailSheet` resolves profile details in batches on open
- if the server call fails but the real-time listener is delayed, optimistic
  state can linger briefly

---

## 13. GIF Integration (KLIPY)

### Architecture

```text
GifPicker / GifGrid / GifPreview
  -> gifService.ts + gifCacheService.ts
  -> KLIPY API
```

### Current Behavior

- visibility is feature-flagged
- toolbar buttons are code-split and eagerly preloaded by the composer
- trending and category data are warmed in the background
- preview assets are prefetched into the `expo-image` cache
- sending a GIF uses the normal message pipeline with a `kind: "media"`
  attachment backed by the remote URL

### Provider and Cache Model

`gifService.ts` abstracts the provider so the UI is not coupled directly to
KLIPY's API shape.

`gifCacheService.ts` currently handles:

- in-memory search caching
- trending cache with TTL
- category cache for the session

### Limits

1. No offline GIF browsing.
2. Search still depends on network-backed provider results.
3. File-size enforcement remains server-side.
4. Favorites and recents are not yet persisted across sessions.

---

## 14. Custom Font Color System

### Overview

Custom font color is implemented as part of chat cosmetics, not as a special
message renderer exception.

Current model:

- user preference lives on `Users/{uid}.chatAppearance`
- outgoing messages stamp a sender-style snapshot
- incoming rows resolve color from the stamped snapshot first
- missing data falls back to theme-adaptive defaults

### Core Contracts

`ChatAppearance` is stored per user:

```typescript
interface ChatAppearance {
  bubbleColorId: string | null;
  fontId: string | null;
  fontColorId: string | null;
  animalThemeId: string | null;
}
```

Operational sender-style stamping comes from `buildSenderStyle()` in
`src/cosmetics/chatAppearanceResolver.ts`, which can include:

- `bubbleColorId`
- `bubbleColorHex`
- `fontId`
- `fontKey`
- `fontColorId`
- `fontColorHex`
- `animalThemeId`
- `v`

### Rendering Rules

| Mode | Default | Custom |
| ---- | ---- | ---- |
| Stacked | theme `onSurface` | fixed `fontColorHex` |
| Bubble | contrast-computed text color | fixed `fontColorHex` overrides |

Custom font color applies to message body text only. It does not recolor
timestamps, metadata rows, badges, placeholders, or navigation chrome.

### Backward Compatibility

- missing `fontColorId` means theme-adaptive default
- historical rows without sender-style data still render correctly
- catalog lookup remains best-effort, with resolved hex values providing
  forward compatibility

---

## 15. Message Features

### 15.1 Scorecards

Scorecards are a chat surface, not a new `MessageKind`.

Render path:

- transport is a `kind: "text"` message
- the raw `text` field carries a sentinel-prefixed JSON envelope
- trust comes from `clientId`, not from the text body
- DM and group screens call `getTrustedScorecardPayload()` before the normal
  system-message fallback
- trusted rows render through `ChatScorecardMessage`, which wraps
  `<GameScorecard />` in the normal message frame

What the wrapper participates in:

- sender avatar and display name
- timestamps and self/other alignment
- swipe-to-reply
- long-press actions
- inline reactions
- thread indicators
- grouped stacked-card behavior
- accessibility labels

Grouped behavior matters in stacked mode:

- group scorecards mirror the grouped-card surface and corner rules
- the fixed-width scorecard card still slots cleanly into grouped runs
- scorecards do not bypass the normal grouping pipeline

Text-based fallback behavior:

- inbox rows collapse scorecards to `Game Scorecard`
- aggregated inbox docs do the same
- long-press preview text, reply snippets, and clipboard copy also collapse to
  `Game Scorecard`
- `ReactionDetailSheet` never shows message text, so there is no extra preview
  path there

Security and privacy hardening:

- plain sentinel text is not enough to render a rich scorecard
- `sendMessageV2` rejects user-authored sentinel text unless a structured
  `scorecardPayload` is provided
- the server revalidates and rebuilds the wire text itself
- SQLite preserves trusted scorecard `clientId` values via the `client_id`
  migration, so rich scorecards survive local hydration

Current caveat:

- DM and group push preview code still has one raw-text path that can leak the
  scorecard envelope. See [Section 23](#23-known-issues--risks).

### 15.2 Voice Messages

Voice messages have two separate concerns:

- compose-time recording UI
- transcript-time playback

Compose-time ownership:

- `ChatComposer.tsx`
- `VoiceRecordButton.tsx`
- `VoiceRecordingHost.tsx`
- `useVoiceRecorder.ts`

Send path:

- `sendVoiceRecordingMessage()` in `src/chat/sendDraft.ts`
- message kind is `voice`
- audio metadata travels through the attachment path

Playback ownership stays with the voice-message rendering components rather
than the composer.

### 15.3 Mentions

Group mentions are still a group-only feature.

- stored as `mentionUids` and `mentionSpans`
- compose-time suggestions come from the group mention autocomplete path
- stacked group rendering uses mention-aware text rendering

### 15.4 Attachments

Attachments still use the shared DM/group orchestration path:

1. client-side staging and selection
2. upload and finalization through the messaging backend
3. render through the canonical attachment-capable message rows

Constraints are enforced server-side in `chatMedia.ts`.

### 15.5 Scheduled Messages

- client service: `src/services/scheduledMessages.ts`
- management UI: `ScheduledMessagesScreen.tsx`
- backend processing remains active through the existing scheduled-message path

### 15.6 Message Requests

Message requests are always on.

- backend enforcement lives in `messageRequests.ts`
- client subscription flows through the unified inbox-request surfaces
- there is no longer a client feature flag around the request system

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
  deletedForAll?: { by: string; at: number };
  hiddenFor?: string[];
  mentionUids?: string[];
  mentionSpans?: MentionSpan[];
  attachments?: AttachmentV2[];
  linkPreview?: LinkPreviewV2;
  clientId: string;
  idempotencyKey: string;
  reactionsSummary?: Record<string, number>;
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
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
}
```

Normalization boundaries:

- SQLite to `MessageV2`: `normalizeMessageFromLocalRow()`
- Firestore to `MessageV2`: `normalizeMessageFromFirestoreDoc()`

Both live in `src/services/chat/normalizeMessage.ts`.

### Sender-Style Note

There is a live cross-module sharp edge here:

- `src/types/messaging.ts` declares an inline `senderStyle` shape
- `src/cosmetics/types.ts` defines the operational `SenderStyle` contract used
  by `buildSenderStyle()`

At runtime, sender-style data can include the richer cosmetics fields,
including `fontColorId` and `fontColorHex`. Treat the cosmetics type as the
operationally richer contract even though the messaging type still lags it.

### Scorecard Transport Contract

Scorecards do not add a new message kind. They travel as a trusted text
envelope plus a structured send-time payload.

Send-time contract:

- client calls `sendMessage()` with `kind: "text"` and `scorecardPayload`
- backend validates the structured payload
- backend rewrites `text` to
  `"[SCORECARD_V1]{json}\nGame Scorecard"`
- backend stamps trusted `clientId = "server-share:{senderUid}"`

Resolver auto-post contract:

- the games resolve pipeline writes the same on-wire text envelope directly
- those rows use `clientId = "server"`

Client trust model:

- `getTrustedScorecardPayload()` trusts only `clientId === "server"` or
  `clientId` starting with `server-share:`
- `isScorecardMessage()` is intentionally broader for sanitization, so preview
  and copy surfaces still collapse sentinel-prefixed text even before trust is
  proven
- SQLite persists `clientId` via the `client_id` column so trusted scorecards
  stay trusted after local hydration

### Scorecard Payload Contract

Type source: `src/gamesV4/types/scorecard.ts`

```typescript
interface GameScorecardPayload {
  v: 1;
  sessionId: string;
  gameId: string;
  gameTitle: string;
  runtimeType: "solo" | "turnBased" | "realtime";
  resolutionType: string;
  winnerIds: string[];
  scoreboard: Array<{
    uid: string;
    displayName: string;
    profilePictureUrl?: string | null;
    decorationId?: string | null;
    score: number;
    placement: number;
  }>;
  durationMs: number;
  createdAt: number;
  winnerEquippedBackgroundId?: string | null;
  senderEquippedBackgroundId?: string | null;
}
```

Important detail: this payload is not stored as a top-level `MessageV2`
property. It is embedded into the sentinel-encoded `text` field.

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

Thread roots still use `threadRootId`, `replyCount`, and `lastReplyAt`.

### Inbox Row Contract (`InboxConversation`)

The inbox row contract intentionally presents scorecards as generic text
previews rather than as a dedicated scorecard type.

Construction paths:

- fan-out: `normalizeFanoutDMConversation()` and
  `normalizeFanoutGroupConversation()`
- aggregated: `normalizeConversationFromInboxEntry()`

Key fields:

- conversation identity and scope
- avatar and decoration snapshots
- `lastMessage` preview bundle
- `memberState`
- unread state and mention hints

### Aggregated Inbox Entry (`InboxEntry`)

Path: `Users/{uid}/Inbox/{threadId}`

Key fields today:

- `threadId`
- `scope`
- `conversationId`
- `lastActivityAt`
- `lastSenderId`
- `lastMessageKind`
- `lastMessagePreview`
- `unreadCount`
- pin, archive, mute, and notify settings

Write source: `firebase-backend/functions/src/inboxTriggers.ts`

### Member State Contract (`MemberStatePrivate`)

`MembersPrivate/{uid}` currently carries:

- archive, pin, and mute state
- notify level
- private unread watermarks
- `sendReadReceipts`
- `autoSendScorecards`
- `showMemberChatStyles` for groups

Important scope note:

- `autoSendScorecards` is per-conversation and defaults to enabled when absent
- `showMemberChatStyles` is group-only

### Message Request Contract

Message requests still normalize into one shared inbox-request union.

Core request fields:

- requester identity snapshot
- status
- created and resolved timestamps
- preview text and message kind

### Canonical Notification Contract

`normalizeNotificationPayload()` produces a canonical notification model with:

- a normalized type
- a dedupe key
- canonical route data

That canonical model is what push taps and in-app notification surfaces route
from.

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

1. If `recentlyReadAt` is still in TTL window ? unread is `0`
2. If `lastMarkedUnreadAt > lastSeenAtPrivate` ? unread is `1`
3. If `lastActivityAt > lastSeenAtPrivate + tolerance` ? unread is `1`
4. If no private watermark and unread hint exists ? unread is `1`
5. Otherwise ? unread is `0`

### Unread Badge Rendering

Helper: `src/components/chat/inbox/unreadBadge.ts`

Values: empty for `<=0`, numeric `1..99`, cap `99+`.

### Mark-Read Behavior

- UI optimistically sets local unread to `0`
- Conversation open updates private watermark through DM/group member services
- Aggregated mode also calls `markInboxRead` callable to clear inbox hint count

### Current Migration State

- Backend always maintains `Users/{uid}/Inbox/*`
- Client defaults to aggregated reads (`CHAT_INBOX_AGGREGATION = true`) since 2026-04-13
- Fan-out path remains available as immediate rollback (`CHAT_INBOX_AGGREGATION = false`)
- Dev mode runs both paths in parallel with parity telemetry via `compareInboxParity()`
- `markInboxRead` resets aggregated inbox hint but does NOT replace member-private unread state

---

## 18. Thread System

### Thread Realtime Lifecycle

Thread subscriptions are lifecycle-scoped via `src/screens/chat/threadLifecycle.ts`:

- Subscribe once for active thread context
- Cleanup unsubscribes on screen unmount/route change
- No callback execution after cleanup

### Thread Screen

`ThreadScreen.tsx` is a specialized thread-focused screen. It now uses the shared keyboard architecture (`ChatKeyboardContainer` + `ChatFooterWrapper` + `KeyboardSafeAreaSpacer`) and is wrapped in `ComposerSheetProvider` via `RootNavigator.tsx`. The FlatList uses `keyboardDismissMode="interactive"` and `keyboardShouldPersistTaps="handled"`. Since threads use a non-inverted list, KCSV is not used — the `FallbackKeyboardContainer` path applies.

### Thread Model

- `threadRootId` points to root message ID for all replies in a thread
- Root message carries `replyCount` and `lastReplyAt`
- Thread roots can appear in the middle of grouped message runs

---

## 19. Notification Integration

### Notification Flow

1. Raw payload arrives from push delivery or the in-app collection.
2. `normalizeNotificationPayload()` maps variants into the canonical route model.
3. Dedupe logic short-circuits duplicate handling windows.
4. Navigation executes from the canonical notification contract.

### Normalization Layer

Primary file: `src/services/notifications/normalizeNotification.ts`

Key responsibilities:

- normalize mixed payload shapes into one route contract
- emit a stable dedupe key
- hide provider-specific quirks from the rest of the app

### Integration Points

- push taps: auth/bootstrap notification handling -> canonical adapter -> navigation
- in-app notifications: in-app context -> canonical adapter -> route handling
- channel routing: backend notification center chooses `in_app`, `push`, or `none`

### Preview Modes

Inbox settings still control preview behavior for message notifications:

- `full`
- `sender_only`
- `generic`

DM and group message push copy is built in
`firebase-backend/functions/src/notifications.ts`.

### Scorecard Preview Caveat

Inbox rows and aggregated inbox entries sanitize scorecards to
`Game Scorecard`, but the legacy DM/group push preview builder still reads raw
`message.text`. That means full-preview message notifications can still leak
scorecard wire text today. This is a known gap, not the intended privacy
contract.

## 20. Backend Integration

### Messaging Function Layer

Primary file: `firebase-backend/functions/src/messaging.ts`

Responsibilities:

- auth and membership checks
- block checks
- rate limiting
- idempotent message write semantics
- message-request gating
- reserved `clientId` rejection for server-authored namespaces
- structured scorecard validation plus server-side wire-text rebuild

### Inbox Trigger Layer

Primary file: `firebase-backend/functions/src/inboxTriggers.ts`

Responsibilities:

- update per-user aggregated inbox docs for DM and group message creation
- reset sender unread and increment recipient unread
- maintain preview and snapshot fields such as `lastSenderName`
- sanitize scorecard previews to `Game Scorecard` before they reach aggregated inbox docs
- keep inbox rows aligned with member-private pin/archive/mute/read-state changes

### Scorecard-Specific Backend Hardening

The current scorecard trust split spans chat and games:

- `sendMessageV2` rejects user attempts to send `clientId: "server"` or
  `clientId: "server-share:*"`
- user-authored sentinel text without structured `scorecardPayload` is rejected
- when `scorecardPayload` is present, the server rebuilds the stored wire text
  itself and stamps a trusted `clientId`
- aggregated inbox previews are sanitized, but push-notification preview
  sanitization is still incomplete

### Backend Contract Expectations

These assumptions should remain true:

- `sendMessageV2` remains authoritative for DM and group writes
- optimistic/native rows reconcile back into canonical `MessageV2`
- member-private watermarks remain the unread authority
- inbox aggregation docs remain derived hints, not the source of truth
- scorecards remain trusted structured payloads, not plain text that happens to
  look like one

## 21. Performance & Instrumentation

### chatPerf Utility

File: `src/utils/chatPerf.ts`

Lightweight perf instrumentation with console logs tagged `? chatPerf`.

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

- **Phase 1 (conservative)**: `initialNumToRender: 15`, `maxToRenderPerBatch: 10`, `windowSize: 11`, `updateCellsBatchingPeriod: 50` — fast first paint
- **Phase 2 (full)**: Promoted after `InteractionManager.runAfterInteractions` + 300 ms delay, wrapped in `startTransition` — `maxToRenderPerBatch: 50`, `windowSize: 101`, `updateCellsBatchingPeriod: 16`

Phase 2 promotion is instrumented via `chatPerf.mark("phase2:{conversationId}")` and `chatPerf.measure()` at interaction-done and promoted checkpoints.

### Lazy-Loaded Picker Buttons

File: `src/components/chat/pickerPreload.ts` (registry) + individual button files

Five toolbar picker sheets (GIF, Emoji, Sticker, Game, GifSticker) are code-split with `React.lazy()`. Each button component (`GifButton`, `EmojiButton`, `StickerButton`, `GameButton`, `GifStickerButton`) wraps its sheet in `<Suspense fallback={<PickerLoadingFallback />}>` as a fallback path.

**Eager preloading + warm-mounted picker shells**: `ChatComposer` calls `preloadPickersForToolbar(activeToolbarItems)` on mount, which starts the dynamic imports and first-open data/image warmups for all equipped picker items immediately after the first paint. When each import settles, `pickerPreload.ts` stores the resolved component reference in a module-level cache. Each button reads this cache synchronously via `getResolved*Picker()` at render time. If the component is already loaded, the button renders it directly — bypassing `React.lazy()` and `Suspense` entirely. After chat entry becomes idle, the equipped picker buttons keep those resolved picker components mounted offscreen with `warmupEnabled={true}`. The picker then renders a hidden `DraggableBottomSheet` via `keepMountedWhenClosed`, which pre-mounts the Portal, sheet host, list, and first-frame subtree before the user taps. The `Suspense` + `React.lazy` path is kept as a fallback for the rare case where a picker is tapped before preloading finishes.

**Cache alignment + synchronous state hydration**: GIF/sticker/category preview images render through `AppImage` (`expo-image`) instead of RN `Image`, matching the cache warmed by `prefetchImages()`. The GIF and Sticker services now expose synchronous cache snapshot helpers (`peekTrendingGifPage`, `peekGifCategories`, `peekTrendingStickerPage`) so picker components can seed their initial state from already-warmed service caches instead of waiting for a new async fetch to complete on first visible open.

**Combined GIF+Sticker warmup**: `GifStickerPicker` now warms both the GIF and Sticker data paths in the background even if the initial tab is only one side. Closing the combined picker resets search/UI state but preserves warmed result sets and loaded flags, so reopening or first-switching tabs does not re-pay the initial fetch/mount cost.

**Seamless sheet switching** (three layers):

1. **switchingRef guard**: `ComposerSheetContext.activateSheet()` uses a `switchingRef` flag when transitioning between pickers. When one picker replaces another, the old sheet's close callback fires but `deactivateSheet()` skips resetting the shared animated values (`sheetTranslateY`, `isSheetActive`, etc.) because they are about to be overwritten by the incoming sheet.

2. **Portal overlap via requestAnimationFrame**: The old sheet's teardown (`prev()`) is deferred by one frame using `requestAnimationFrame`. This ensures the new sheet's Portal registers with `PortalManager` (via `componentDidMount`) before the old one unregisters (via `componentWillUnmount`), preventing the gap where neither Portal is visible. React Native Paper's Portal uses class lifecycle methods ? `PortalManager.setState`, which re-renders one frame later; without overlap the old sheet disappears before the new one appears.

3. **Pre-positioned translateY on mount**: `DraggableBottomSheet` initializes its internal `translateY` from `sharedTranslateY.value` (when provided, i.e. keyboard-replacement mode) instead of always starting at `SCREEN_HEIGHT`. This means the new sheet renders at the correct snap position on its very first frame, instead of rendering off-screen and then jumping to the snap position when the `useEffect` fires.

`PickerLoadingFallback` (`src/components/chat/PickerLoadingFallback.tsx`) renders a centered `ActivityIndicator` at 260px height. It is only visible if a picker is tapped before the preload completes (e.g., within the first ~1 s of screen mount on slow devices).

### Group Background Image Warmup

See [Section 4 — Group Background Loading Architecture](#group-background-loading-architecture).

Key invariant: `warmRemoteImage()` always calls `Image.loadAsync()` — it does not cache `ImageRef` objects across calls. This prevents stale JS-side cache references from masking native memory-cache eviction after screen unmount. Concurrent calls to the same URL are deduped via `imageWarmPromises` (in-flight promise map).

### Inbox Press-In Preloading

`ChatListScreenV2` fires `prepareDmThreadEntry` / `prepareGroupChatNavigation` on `onPressIn` (touch-down) rather than waiting for `onPress` (touch-up). This overlaps ~100–200 ms of identity/asset warmup with the user's finger-down duration.

---

## 22. Test Coverage

### Contract and Merge Tests

- `__tests__/services/normalizeMessage.test.ts`
- `__tests__/services/chatV2.mergeMessagesWithOutbox.test.ts`
- `__tests__/services/normalizeInboxRow.test.ts`
- `__tests__/services/normalizeInboxRow.expanded.test.ts` — 53 tests covering boundary constants, field passthrough, sorting, edge cases
- `__tests__/services/inboxVisibilityParity.test.ts` — visibility filtering + parity telemetry (archive/mute/pin mismatch detection)
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
7. Long-press message ? quick reaction tray appears with 6 emojis
8. Tap quick reaction ? pill appears below correct message
9. Tap "+" ? full emoji picker with categories and search
10. Tap own reaction pill ? reaction removed
11. Reactions work for text, image, voice, and animal messages
12. Both display modes (bubbles/stacked) render correctly
13. Grouped cards snap correctly and corner rounding adapts
14. Composer toolbar drag-and-drop works
15. Quick tap on camera button opens the camera without entering toolbar edit mode
16. Hold on camera button flips to the photo icon, turns purple, triggers one light haptic, and opens the photo library before edit mode can steal the gesture
17. Quick tap on animal button opens the anchored animal picker without entering toolbar edit mode
18. Hold on animal button flips to the alternate picker icon, turns purple, triggers one light haptic, and opens the full animal picker before edit mode can steal the gesture
19. GIF picker loads and sends GIF messages
20. Custom font color applies in both display modes
21. Auto-posted or manually shared scorecards render as rich cards in DM and group chats
22. Inbox conversation previews show Game Scorecard instead of raw sentinel text
23. Long-press, swipe-to-reply, and copy on scorecards all use the generic fallback label
24. Chat settings Auto-send Scorecards toggle suppresses hosted-game auto-posts only for that conversation
25. Voice recording lock, cancel, timer placement, and locked-mode send/discard controls behave inside the composer shell

---

## 23. Known Issues & Risks

### Resolved Risk Ledger

All major Phase 3+ risks below this line are either fixed or intentionally
retired:

| Risk | Status | Resolution |
| ---- | ------ | ---------- |
| Dual-runtime contract drift (SQLite vs Firestore) | **Fixed** | Canonical normalization layer and shared ordering/dedupe |
| Inbox path drift (fan-out vs aggregated) | **Fixed** | Shared row normalization and unread computation |
| Requests-tab source fragmentation | **Fixed** | Unified typed request stream |
| Notification payload mismatch and dedupe | **Fixed** | Canonical notification adapter |
| Group chat runtime crash (timestamp) | **Fixed** | Hardened Firestore timestamp parsing |
| Text-node rendering warning | **Fixed** | Guarded slot/children rendering |
| GroupChatInfoScreen hero buttons not pressable | **Fixed** | Counter-translate cover-sheet architecture |
| Group background slow on reopen | **Fixed** | Removed stale image-ref cache and always re-warm |
| Toolbar picker first-open spinner | **Fixed** | Eager preload on composer mount |
| KAV-based keyboard layout jitter | **Fixed** | Shared fallback keyboard container replaced the old KAV path |

### Current Non-Blocking Risks

#### Scorecard push previews can still leak wire text (Medium)

`firebase-backend/functions/src/notifications.ts` still builds DM/group
preview copy from raw `message.text`. Scorecards intentionally store a sentinel
plus JSON in `text`, so full-preview notifications can still surface raw wire
payload instead of `Game Scorecard`.

Mitigation already in place:

- inbox rows sanitize scorecards
- aggregated inbox triggers sanitize scorecards
- long-press, reply, and copy surfaces sanitize scorecards

Missing parity:

- DM/group push preview copy
- any other preview surface that reads raw message text without calling the
  scorecard sanitizers

#### Dedicated scorecard regression coverage is still thin (Medium)

There is no dedicated automated suite yet for:

- scorecard preview sanitization across every chat surface
- trusted `clientId` persistence through SQLite hydration
- hosted-game auto-post plus per-chat `autoSendScorecards` gating
- duplicate-post prevention for the scorecard message path

#### Sender-style type drift is still live (Low)

`src/types/messaging.ts` and `src/cosmetics/types.ts` are still slightly out of
sync around the richer `SenderStyle` shape, especially the font-color fields.
Runtime code already tolerates the richer payload, but the cross-module type
contract is still looser than it should be.

#### KCSV scroll component is intentionally disabled (Informational)

`ChatKeyboardScrollView.tsx` hardcodes `kcsvAvailable = false`. This is not an
accidental native regression. The KCSV scroll component was intentionally
disabled because it caused visible list motion during sheet-to-keyboard
transitions. Native builds still use keyboard-controller shared values through
`useReanimatedKeyboardAnimationCompat()`.

#### Expo Go keyboard fallback uses post-layout events on Android (Low)

`useFallbackKeyboardAnimation()` uses `keyboardDidShow` and `keyboardDidHide`
on Android rather than iOS-style will-show events. That produces slight visual
lag on Android in Expo Go. No cleaner workaround exists without a native
module.

## 24. Sustaining Roadmap

### S1 - Notification Migration Guardrails (Resolved - Cleaned Up)

Legacy dead push triggers were removed from the legacy path. Canonical triggers
in `notifications.ts` now route through `notificationCenter.ts` with atomic
dedupe.

### S2 - High-Volume Merge Stress Testing (Medium)

Add larger synthetic fixtures, repeat modified-snapshot merges with overlapping
page windows, and assert stable identity.

Primary targets:

- `__tests__/integration/unifiedChat.test.ts`
- `__tests__/services/chatV2.mergeMessagesWithOutbox.test.ts`

### S3 - Inbox Parity Telemetry (Complete)

Debug-mode shadow comparison in
`src/services/chat/inboxParityTelemetry.ts` compares fan-out and aggregated
inbox results and logs divergences in conversation count, unread state, sort
order, and pin/archive/mute parity.

### S4 - Aggregated Inbox Enrichment (Low, Optional)

Evaluate adding richer avatar and profile snapshots to `InboxEntry` from the
trigger layer.

### S5 - Thread Lifecycle Reliability Sweep (Medium)

Add route-churn tests for rapid thread switching. Verify no callback execution
after cleanup and confirm unsubscribe counts match subscribe counts.

### S6 - Scorecard Preview Parity and Regression Coverage (Medium)

Add explicit coverage for the cross-system scorecard surface:

- sanitize scorecards in every preview surface, including DM/group push copy
- add regression tests for reply, copy, and preview sanitization
- add hosted-game auto-post tests covering `autoSendScorecards` gating and
  duplicate-post protection
- add local-cache trust tests to prove `client_id` persistence keeps
  scorecards trusted after SQLite hydration

### S7 - Sender-Style Type Alignment (Low)

Align the richer cosmetics `SenderStyle` contract with the messaging-layer
message type so docs, runtime writes, and TypeScript all describe the same
payload.

## 25. Historical Checkpoints

These checkpoints record the Phase 2?3+ cleanup effort:

| Checkpoint | Date       | Theme                                                                                                                                                                                                                       | Status   |
| ---------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| C1         | 2026-03-04 | Thread listener and notification correctness                                                                                                                                                                                | Complete |
| C2         | 2026-03-04 | Requests tab integration and dead code cleanup                                                                                                                                                                              | Complete |
| C3         | 2026-03-04 | Local message lifecycle reset hardening                                                                                                                                                                                     | Complete |
| C4         | 2026-03-04 | Merge and dedupe helper extraction                                                                                                                                                                                          | Complete |
| C5         | 2026-03-05 | Canonical message normalization parity                                                                                                                                                                                      | Complete |
| C6         | 2026-03-05 | Inbox normalization and unread source-of-truth                                                                                                                                                                              | Complete |
| C7         | 2026-03-05 | Unified inbox requests typed hook                                                                                                                                                                                           | Complete |
| C8         | 2026-03-05 | Notification payload adapter and legacy gating                                                                                                                                                                              | Complete |
| C9         | 2026-03-05 | Group chat runtime crash and text-node warning                                                                                                                                                                              | Complete |
| C10        | 2026-04    | Chat-entry performance (two-phase FlatList, lazy pickers, press-in preload)                                                                                                                                                 | Complete |
| C11        | 2026-04    | GroupChatInfoScreen fixed-hero cover-sheet architecture                                                                                                                                                                     | Complete |
| C12        | 2026-04-13 | ThreadScreen keyboard migration, Expo Go fallback fix, legacy trigger cleanup, inbox aggregation blockers (5/5), test expansion (+58 tests)                                                                                 | Complete |
| C13        | 2026-04-13 | KCSV native path confirmed for all screens, ThreadScreen scroll routing complete, aggregated inbox flag flipped, parity telemetry wired, merge/lifecycle stress tests (+15 tests)                                           | Complete |
| C14        | 2026-04-13 | Group background reopen regression fixed (stale ImageRef cache removed), composer picker eager preload added, background warmup pipeline fully normalized (cache-key alignment, dark fallback, priority high, transition 0) | Complete |
| C15        | 2026-04-13 | Picker presentation polish: resolved component cache bypasses React.lazy Suspense flash, switchingRef in ComposerSheetContext prevents visual gap during picker-to-picker transitions                                       | Complete |
| C16        | 2026-04-22 | Scorecards promoted to a first-class chat surface, reply/copy/inbox sanitization hardened, multiline composer growth documented to actual implementation, KCSV scroll component intentionally disabled in favor of the shared fallback path | Complete |

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

- `ThreadScreen.tsx` remains a specialized screen (not part of shared chat surface) but now uses the shared keyboard architecture (`ChatKeyboardContainer` + `ChatFooterWrapper` + `KeyboardSafeAreaSpacer`)
- Web still uses the Firestore-first compatibility runtime underneath `useChat`

## Migration Notes

- If you find old docs/comments mentioning a DM-only `MessageWithProfile` render pipeline, they are stale
- If you change group typing behavior, preserve `typingAt` as canonical field; keep `typingExpiresAt` as temporary compatibility
- If you need a new DM/group difference, add it at the screen-configuration layer first — do not fork the full render pipeline


