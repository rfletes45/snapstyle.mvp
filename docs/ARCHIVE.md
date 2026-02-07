# Development History Archive

> Completed phase documentation preserved for historical reference.  
> This file consolidates audit trails and implementation records.

---

## Project Timeline Summary

| Phase       | Focus                                | Status                   |
| ----------- | ------------------------------------ | ------------------------ |
| Phase 0-4   | Initial setup, auth, basic UI        | ✅ Complete              |
| Phase 5-8   | Profile, avatar, cosmetics           | ✅ Complete              |
| Phase 9-11  | Chat V1 implementation               | ✅ Complete (Deprecated) |
| Phase 12-14 | Groups, notifications                | ✅ Complete              |
| Phase 15-17 | Chat V2 migration                    | ✅ Complete              |
| Phase 18-21 | V2 features, polish                  | ✅ Complete              |
| Phase A-G   | Avatar customization, theme          | ✅ Complete              |
| Phase H     | Chat V1 decommission                 | ✅ Complete              |
| Cleanup     | Dead code removal                    | ✅ Complete (PRs 8-11)   |
| Inbox       | Inbox screen overhaul (8 phases)     | ✅ Complete (Jan 2026)   |
| UNI         | Unified messaging architecture       | ✅ Complete (Jan 2026)   |
| Polish      | Group chat polish & message grouping | ✅ Complete (Jan 2026)   |
| Storage     | Client-side SQLite storage migration | ✅ Complete (Jan 2026)   |
| Privacy     | Chat privacy features (4 settings)   | ✅ Complete (Feb 2026)   |
| Perf        | Chat loading optimization            | ✅ Complete (Jan 2026)   |
| Reply       | Enhanced reply system design         | ✅ Complete (2025)       |
| Calls       | Voice/video calling system           | ✅ Complete (Feb 2026)   |
| SP Games    | 4 new single-player games            | ✅ Complete (Feb 2026)   |
| Notifs      | In-app notification overhaul         | ✅ Complete (Feb 2026)   |
| Inbox++     | Inbox default, unread sort, game msg | ✅ Complete (Feb 2026)   |

---

## New Single-Player Games Summary

**Completed**: February 2026

### Overview

Implemented 4 new single-player games with full test coverage (217 total tests):

| Game          | Category | Tests | Description                             |
| ------------- | -------- | ----- | --------------------------------------- |
| Tile Slide    | Puzzle   | 39    | Classic sliding puzzle (3×3, 4×4, 5×5)  |
| Hex Collapse  | Puzzle   | 54    | Hexagonal match-3 with chain reactions  |
| Color Flow    | Puzzle   | 62    | Flow Free-style path connection puzzles |
| Brick Breaker | Action   | 62    | Classic Breakout with power-ups         |

### Key Files

- Logic: `src/services/games/{tileSlide,hexCollapse,colorFlow,brickBreaker}Logic.ts`
- Screens: `src/screens/games/{TileSlide,HexCollapse,ColorFlow,BrickBreaker}GameScreen.tsx`
- Tests: `__tests__/games/{tileSlide,hexCollapse,colorFlow,brickBreaker}Logic.test.ts`
- Types: `src/types/singlePlayerGames.ts`

### Documentation

All game details consolidated into [06_GAMES.md](06_GAMES.md).

**Deleted**: `NEW_SINGLEPLAYER_GAMES_PLAN.md` — Plan completed, details in 06_GAMES.md.

---

## In-App Notifications & Inbox Improvements Summary

**Completed**: February 2026

### In-App Notifications Overhaul

- Added `game_invite` and `achievement` notification types
- Added per-screen suppression (suppress game invites on game screens, achievements on achievements screen)
- Added Firestore listener for real-time game invite notifications
- Updated `InAppToast` with game_invite (green 🎮) and achievement (gold 🏆) icons/colors

### Inbox Improvements

- Made Inbox the default screen (`initialRouteName="Inbox"`)
- Added `recentlyReadRef` guard to prevent marking conversations as read on every render
- Added `game_invite` message kind for game invite conversation previews
- Added `profilePictureUrl` and `decorationId` fields to inbox conversation items
- Fixed own profile theme colors and added avatar decoration equip UI
- Added `ProfilePictureWithDecoration` throughout inbox and group chat screens

---

## Client-Side Storage Migration Summary

**Completed**: January 31, 2026

### Overview

Complete migration from server-first (Firebase Firestore) to **local-first architecture** using SQLite for messages and file system for media caching.

### Architecture Change

```
BEFORE (Server-First):
  User Action → Cloud Function → Firestore → Real-time Listener → UI

AFTER (Local-First):
  User Action → SQLite → UI (immediate)
                     ↓
              Background Sync → Firestore (eventual)
```

### Implementation Summary

| Phase   | Component       | Files Created                                                             |
| ------- | --------------- | ------------------------------------------------------------------------- |
| Phase 1 | Database Setup  | `src/services/database/index.ts` (schema, singleton)                      |
| Phase 2 | Message Storage | `src/services/database/messageRepository.ts`, `conversationRepository.ts` |
| Phase 3 | Media Caching   | `src/services/mediaCache.ts`                                              |
| Phase 4 | Sync Engine     | `src/services/sync/syncEngine.ts`                                         |
| Phase 5 | Feature Flags   | `constants/featureFlags.ts` (USE_LOCAL_STORAGE)                           |
| Phase 6 | Maintenance     | `src/services/database/maintenance.ts`                                    |

### Key Technologies

- **expo-sqlite** (~15.0.3) — SQLite database
- **expo-file-system** (19.0.21) — Media file caching
- **expo-crypto** — UUID generation (replaced `uuid` package for RN compatibility)

### Database Schema

```sql
conversations (id, scope, name, last_message_*, is_archived, is_muted, ...)
messages (id, conversation_id, sender_id, kind, text, sync_status, ...)
attachments (id, message_id, kind, local_uri, remote_url, upload_status, ...)
reactions (id, message_id, user_id, emoji, sync_status)
sync_cursors (conversation_id, last_synced_at, sync_token)
```

### Feature Flag

```typescript
// constants/featureFlags.ts
export const USE_LOCAL_STORAGE = true; // Set false to rollback
```

### Debug Screen

Added `LocalStorageDebugScreen` (Settings → Developer → Local Storage Debug) with:

- Database statistics
- Test message insertion (local-only)
- Sync controls
- Media cache management
- Maintenance actions

### Documentation Updates

- `01_ARCHITECTURE.md` — Added Local Storage Layer section
- `00_INDEX.md` — Added local storage references
- `CLIENT_SIDE_STORAGE_MIGRATION_PLAN.md` — Archived (plan completed)

---

## Unified Messaging Architecture Summary

**Completed**: January 2026

### Overview

Complete unification of DM and Group chat systems through shared abstractions:

- **Single `useChat` hook** for both DM and Group messaging
- **Unified `ChatComposer`** component for input handling
- **Unified `ChatMessageList`** component for message display
- **Scope-aware services** (`scope: "dm" | "group"`)

### GroupChatScreen Refactor (January 31, 2026)

**Goal**: Make GroupChatScreen use the same SQLite-first architecture as ChatScreen

**Changes Made**:

| Component        | Before (Legacy)                                 | After (Unified)                                           |
| ---------------- | ----------------------------------------------- | --------------------------------------------------------- |
| Message source   | `subscribeToGroupMessages()` (Firestore direct) | `screen.messages` (SQLite via useUnifiedChatScreen)       |
| Send text        | `sendGroupMessage()`                            | `screen.chat.sendMessage()`                               |
| Send attachments | `sendGroupMessage()` (bypass)                   | `screen.chat.sendMessage({ attachments })`                |
| Send voice       | `uploadVoiceMessage()`                          | `screen.chat.sendMessage({ kind: "voice", attachments })` |
| Pagination       | Local state + `getGroupMessages()`              | `screen.chat.pagination` + `screen.chat.loadOlder()`      |
| Message type     | `GroupMessage`                                  | `MessageV2`                                               |
| Swipe-to-reply   | `SwipeableGroupMessage`                         | `SwipeableMessage`                                        |

**Files Modified**:

- `src/screens/groups/GroupChatScreen.tsx` — Removed legacy imports, switched to unified hooks
- `src/types/messaging.ts` — Added `scorecard` to `MessageV2`, `durationMs` to `LocalAttachment`

**Deleted** (deprecated files removed during cleanup):

- `SwipeableGroupMessage.tsx` — Deleted, use `SwipeableMessage` instead
- `GroupMessageItem.tsx` — Deleted, component was never used after unified refactor
- `ReplyBubble.tsx` (original) — Deleted, superseded by `ReplyBubbleNew.tsx`

**Deprecated Services** (kept for migration, will be removed later):

- `subscribeToGroupMessages()` — Use `useUnifiedChatScreen` instead
- `sendGroupMessage()` for attachments — Use unified `sendMessage({ attachments })`

### Key Achievements

| Metric                        | Before       | After      |
| ----------------------------- | ------------ | ---------- |
| `ChatScreen.tsx`              | ~1,700 lines | ~800 lines |
| `GroupChatScreen.tsx`         | ~1,700 lines | ~600 lines |
| Duplicate components          | 2            | 0          |
| Message subscription patterns | 4            | 2          |

### New Unified Modules

**`src/services/messaging/`**:

- `send.ts` — Unified message sending
- `subscribe.ts` — Unified message subscriptions
- `memberState.ts` — Unified mute/archive/notify
- `adapters/groupAdapter.ts` — GroupMessage ↔ MessageV2 conversion

**`src/hooks/`**:

- `useChat.ts` — Master chat hook combining all functionality
- `useUnifiedMessages.ts` — Message subscription + outbox
- `useChatComposer.ts` — Composer state management

**`src/components/chat/`**:

- `ChatComposer.tsx` — Unified input component
- `ChatMessageList.tsx` — Unified message list

### Documentation Consolidated

The following phase documentation was consolidated and deleted:

- `PHASE1_DISCOVERY_REPORT.md` — Initial architecture mapping
- `PHASE2_INCONSISTENCY_REPORT.md` — DM vs Group differences
- `PHASE3_REDUNDANCY_REPORT.md` — Service layer duplication
- `ARCHITECTURE_PROPOSAL.md` — Unification proposal
- `ARCHITECTURE_REVIEW_PROMPT.md` — Review guidelines
- `IMPLEMENTATION_TICKETS.md` — Implementation tasks
- `UNIFIED_COMPOSER_PLAN.md` — Composer unification plan
- `CHAT_INFINITE_SCROLL_PROMPT.md` — Infinite scroll plan
- `REORGANIZATION_PROMPT.md` — Reorganization guidelines

---

## Universal Game Invites Summary

**Completed**: January 2026

### Overview

Complete redesign of the game invitation system to support universal (non-person-specific) invites:

- **Group Chat Invites**: First N players to join lock in the game
- **Variable Player Games**: Support for 2-8 player games with slot-based joining
- **Spectator Mode**: Unlimited spectators after game is full
- **Smart Visibility**: Group invites stay in chat, DM invites appear in Play page

### Key Changes

| Component                  | Change                                                    |
| -------------------------- | --------------------------------------------------------- |
| `UniversalGameInvite` type | New comprehensive invite model with slots and spectators  |
| `gameInvites.ts` service   | Refactored with lazy Firestore getters, new query methods |
| Firestore security rules   | Updated for `eligibleUserIds` array-contains queries      |
| Firestore indexes          | Added composite indexes for universal invite queries      |
| Migration script           | `migrateGameInvites.ts` for legacy invite migration       |

### Visibility Rules

| Context | Target    | Show in Chat | Show in Play Page |
| ------- | --------- | ------------ | ----------------- |
| DM      | specific  | ✅           | ✅                |
| Group   | universal | ✅           | ❌                |

### Implementation Files

- `src/services/gameInvites.ts` — Main invite service (refactored)
- `src/types/turnBased.ts` — Universal invite type definitions
- `firebase-backend/firestore.rules` — Security rules for invites
- `firebase-backend/functions/src/games.ts` — Cloud Functions
- `firebase-backend/functions/src/migrations/migrateGameInvites.ts` — Migration

---

## Group Chat Polish Summary

**Completed**: January 2026

### Message Grouping System

Implemented visual message grouping for group chats:

- Messages from same sender within 2 minutes are grouped
- Single name shown at top of group
- Single avatar + timestamp shown at bottom of group
- Reply messages always standalone (break group chains)
- 3px spacing within groups, 12px between groups

### Group Invite Improvements

- Fixed expired invite detection (7-day expiry)
- Filter expired invites when checking for pending duplicates
- Proper Timestamp comparison for invite expiry

### Reply Bubble Alignment

- Fixed 40px indent for reply bubbles on received messages
- Proper avatar spacing maintained

---

## Inbox Overhaul Summary

**Completed**: January 2026

### Overview

Complete redesign of the ChatListScreen (now `ChatListScreenV2`) to create a modern messaging hub with:

- Filter tabs (All, Unread, Groups, DMs, Requests)
- Swipe actions (Pin, Mute, Delete)
- Long-press context menu
- Profile quick view modal
- Integrated friend requests
- Full-text search with filters
- Dedicated settings screen

### Files Created

**Components** (`src/components/chat/inbox/`):

- `ConversationItem.tsx` — Conversation row
- `SwipeableConversation.tsx` — Swipe gesture wrapper
- `ConversationContextMenu.tsx` — Long-press menu
- `InboxHeader.tsx` — Header with avatar/search
- `InboxTabs.tsx` — Filter tabs
- `PinnedSection.tsx` — Collapsible pinned section
- `FriendRequestItem.tsx` — Friend request row
- `InboxFAB.tsx` — Multi-action FAB
- `ProfilePreviewModal.tsx` — Quick profile view
- `MuteOptionsSheet.tsx` — Mute duration picker
- `DeleteConfirmDialog.tsx` — Delete confirmation
- `EmptyState.tsx` — Contextual empty states
- `index.ts` — Barrel exports

**Hooks**:

- `useInboxData.ts` — Unified inbox data with filters
- `useConversationActions.ts` — Pin/mute/delete operations
- `useFriendRequests.ts` — Friend request subscription

**Services**:

- `inboxSettings.ts` — Inbox settings (Firestore)

**Screens**:

- `ChatListScreenV2.tsx` — Main inbox (overhauled)
- `InboxSearchScreen.tsx` — Full search screen
- `InboxSettingsScreen.tsx` — Settings screen

**Utilities**:

- `animations.ts` — Reusable animation utilities
- `haptics.ts` — Centralized haptic feedback

### Documentation

- [03_CHAT_V2.md](./03_CHAT_V2.md) — Includes Inbox Overhaul section

> **Deleted during cleanup (Jan 2026):**
>
> - `INBOX_OVERHAUL_PLAN.md` — Consolidated into this file and 03_CHAT_V2
> - `INBOX_OVERHAUL_CHANGELOG.md` — Consolidated into this file
> - `INBOX_OVERHAUL_PLAN_DETAILED.md` — 3500-line spec, obsolete after completion

---

## Chat V1 Decommission Summary

**Completed**: PRs 1-7

### Removed Files

```
src/screens/ChatScreen.tsx          (legacy V1 screen)
src/services/messaging.ts           (V1 messaging service)
src/services/chat.ts                (V1 chat service)
src/hooks/useChatList.ts            (V1 hook)
src/hooks/useConversation.ts        (V1 hook)
```

### Migration Path

- All chat functionality now uses V2 system
- Message subscription via `useMessagesV2.ts`
- Outbox pattern for reliable sending
- Server timestamp ordering
- Watermark-based read state

---

## Dead Code Cleanup Summary

**Completed**: PRs 8-11

### PR 8: Firebase Directory

Deleted entire `firebase/` directory:

- Duplicate of `firebase-backend/`
- ~3,000+ lines of code
- 72MB node_modules

### PR 9: Unused UI Components

Removed 6 components (~784 lines):

- `AppCard.tsx` — Generic card (unused)
- `ListRow.tsx` — List item (unused)
- `ScreenContainer.tsx` — Wrapper (replaced)
- `Section.tsx` — Layout (unused)
- `Divider.tsx` — Simple line (unused)
- `StatusBanner.tsx` — Banner (unused)

### PR 10: Unused Hooks

Removed 4 hooks (~910 lines):

- `useAsync.ts` — Generic async (replaced by TanStack Query)
- `useAsyncAction.ts` — Action wrapper (unused)
- `useRetry.ts` — Retry logic (built into outbox)
- `useKeyboardHeight.ts` — Keyboard tracking (replaced)

### PR 11: Unused Dependencies

Removed from package.json:

- `expo-web-browser` — Not used anywhere

---

## Key Architecture Decisions

### Decision: Outbox Pattern for Messages

**Problem**: Messages could be lost on network issues  
**Solution**: Persist to AsyncStorage before sending  
**Result**: Reliable offline-first messaging

### Decision: Watermark-based Read State

**Problem**: Per-message read flags don't scale  
**Solution**: Single timestamp per user per conversation  
**Result**: O(1) read state updates instead of O(n)

### Decision: Server Timestamp Ordering

**Problem**: Client clocks can be wrong  
**Solution**: Use server `serverReceivedAt` for ordering  
**Result**: Consistent message order across all clients

### Decision: Zustand over Redux

**Problem**: Redux boilerplate overhead  
**Solution**: Lightweight Zustand stores  
**Result**: Simpler state management with persistence

### Decision: Firebase Callable over REST

**Problem**: Need authentication and validation  
**Solution**: Callable functions with built-in auth  
**Result**: Cleaner API with automatic token handling

---

## Bug Fixes Archive

### Chat Messages Not Appearing (Phase 17)

**Issue**: Messages sent but not displayed  
**Cause**: V1 and V2 used different field names  
**Fix**: Ensure all code uses V2 field names

### Theme Toggle Flicker (Phase A)

**Issue**: Flash of wrong theme on app load  
**Cause**: Theme state loading async  
**Fix**: Show loading state until theme loaded

### Web Photo Capture (Phase 18)

**Issue**: Camera not working on web  
**Cause**: Different API for browser  
**Fix**: Use MediaCapture API with getUserMedia

### Duplicate Messages (Phase 19)

**Issue**: Same message appearing twice  
**Cause**: Race condition in outbox  
**Fix**: Server-side idempotency check

### Notification Deep Links (Phase 20)

**Issue**: Tapping notification opens wrong chat  
**Cause**: Chat ID not passed correctly  
**Fix**: Include chatId in notification payload

---

## Audit Reports Consolidated

### Chat V2 Audit (Original)

All three rules verified:

1. ✅ NO DUPLICATE SENDS — idempotency via clientId
2. ✅ AUTHORITATIVE ORDERING — serverReceivedAt field
3. ✅ READ STATE — watermark pattern implemented

### Performance Audit

- Cold start: ~2.5s (target <3s) ✅
- Chat list load: ~400ms (target <500ms) ✅
- Send message: ~800ms (target <1s) ✅

### Security Audit

- Firestore rules: User-scoped access ✅
- Storage rules: Authenticated uploads ✅
- Cloud Functions: Auth required ✅
- No sensitive data in client code ✅

---

## Voice/Video Calling System Summary

**Completed**: February 2026

### Overview

Full WebRTC-based voice and video calling system with native integration for 1:1 and group calls.

### Features Implemented

| Feature           | Status      | Notes                                 |
| ----------------- | ----------- | ------------------------------------- |
| 1:1 Audio Calls   | ✅ Complete | WebRTC peer-to-peer                   |
| 1:1 Video Calls   | ✅ Complete | Camera/video support                  |
| Group Audio Calls | ✅ Complete | Up to 8 participants                  |
| Group Video Calls | ✅ Complete | Mesh topology                         |
| Native Call UI    | ✅ Complete | CallKeep for iOS/Android              |
| Background Calls  | ✅ Complete | Calls continue when app minimized     |
| Call History      | ✅ Complete | Full call logs with filtering         |
| Call Settings     | ✅ Complete | Audio/video preferences               |
| Adaptive Bitrate  | ✅ Complete | Auto-adjusts quality based on network |
| Call Analytics    | ✅ Complete | Quality metrics and issue tracking    |

### Key Files Created

**Services** (`src/services/calls/`):

- `callService.ts` — Main call lifecycle management
- `webRTCService.ts` — WebRTC peer connection handling
- `groupCallService.ts` — Group call coordination
- `callKeepService.ts` — Native call UI integration (iOS CallKit, Android ConnectionService)
- `callHistoryService.ts` — Call logs and history
- `callAnalyticsService.ts` — Quality metrics

**Components** (`src/components/calls/`):

- `CallButton.tsx` — Initiate calls from chat
- `VideoGrid.tsx` — Multi-participant video layout
- `SpeakerView.tsx` — Active speaker highlighting

**Screens** (`src/screens/calls/`):

- `AudioCallScreen.tsx` — Audio-only call UI
- `VideoCallScreen.tsx` — Video call UI
- `GroupCallScreen.tsx` — Group call UI
- `CallHistoryScreen.tsx` — Call logs
- `CallSettingsScreen.tsx` — Call preferences

**Hooks** (`src/hooks/calls/`):

- `useCall.ts` — Call state management
- `useGroupCallParticipants.ts` — Group participant tracking

### Technical Details

- **Technology**: WebRTC via `react-native-webrtc`
- **Native Integration**: `react-native-callkeep` for CallKit/ConnectionService
- **Signaling**: Firestore for call state synchronization
- **Platform Support**: iOS (requires dev build), Android (requires dev build), Web (limited - no native UI)
- **Expo Go**: Not supported (requires native modules)

### Feature Flags

Feature flags in `constants/featureFlags.ts` → `CALL_FEATURES`:

- `CALLS_ENABLED` — Master switch
- `AUDIO_CALLS_ENABLED` — Audio-only calls
- `VIDEO_CALLS_ENABLED` — Video calls
- `GROUP_CALLS_ENABLED` — Group calls
- `NATIVE_CALL_UI_ENABLED` — CallKeep integration
- `CALL_HISTORY_ENABLED` — Call history screen
- `CALL_SETTINGS_ENABLED` — Call settings screen

**Full plan**: [archived/VIDEO_CALL_IMPLEMENTATION_PLAN.md](archived/VIDEO_CALL_IMPLEMENTATION_PLAN.md)

---

## Chat Privacy Features Summary

**Completed**: February 2026

### Overview

Implemented four privacy features with reciprocal privacy model (if you disable, you neither send nor receive).

### Features Implemented

| Setting           | Files Created                                        | Status      |
| ----------------- | ---------------------------------------------------- | ----------- |
| Read Receipts     | `useReadReceipts.ts`, `chatMembers.ts` updates       | ✅ Complete |
| Typing Indicators | `useTypingStatus.ts`, `TypingIndicator.tsx`          | ✅ Complete |
| Online Status     | `usePresence.ts`, `presence.ts`, RTDB integration    | ✅ Complete |
| Last Seen         | `PresenceIndicator.tsx`, integrated with usePresence | ✅ Complete |

### Technical Details

- Storage: `Users/{uid}/settings/inbox`
- RTDB used for presence (low-latency): `/presence/{uid}`
- All features follow reciprocal privacy model

**Full documentation**: [03_CHAT_V2.md - Chat Privacy Features](03_CHAT_V2.md#chat-privacy-features)

---

## Chat Loading Optimization Summary

**Completed**: January 2026

### Overview

Optimizations to achieve instant chat loading and eliminate UI flickering.

### Key Improvements

| Phase   | Change                   | Result                     |
| ------- | ------------------------ | -------------------------- |
| Phase 1 | ChatSkeleton component   | No more loading spinners   |
| Phase 2 | Navigation data passing  | Instant header rendering   |
| Phase 3 | Parallel Firestore calls | ~50% init time reduction   |
| Phase 4 | Profile cache service    | ~87% faster repeated opens |

### Performance Results

| Metric                        | Before | After  | Improvement |
| ----------------------------- | ------ | ------ | ----------- |
| Time to first message visible | ~500ms | <100ms | ~80%        |
| Loading spinner duration      | ~300ms | 0ms    | 100%        |
| Repeated chat open latency    | ~400ms | <50ms  | ~87%        |

### Files Created

- `src/components/chat/ChatSkeleton.tsx` — Shimmer skeleton components
- `src/services/cache/profileCache.ts` — LRU profile caching (5-min TTL)

---

## Reply System Design Summary

**Completed**: 2025

### Overview

Enhanced reply system with Apple Messages-style design and advanced features.

### Features Implemented

| Feature             | Description                                      |
| ------------------- | ------------------------------------------------ |
| Swipe-to-Reply      | Unified `SwipeableMessage` for DM and Group      |
| Reply Bubble        | Outline-style bubble above main message          |
| Curved Connector    | Line connecting reply bubble to message          |
| Highlight Animation | Blue pulse when scrolling to replied message     |
| Jump-Back Button    | "Back to reply" floating button after navigation |

### Key Components

- `SwipeableMessage.tsx` — Unified swipe gesture (replaced SwipeableGroupMessage)
- `ReplyBubbleNew.tsx` — Enhanced reply preview (exported as ReplyBubble)
- `ScrollReturnButton.tsx` — Jump-back navigation
- `MessageHighlightOverlay.tsx` — Highlight animation

### Deleted (Superseded)

- `SwipeableGroupMessage.tsx` — Replaced by unified SwipeableMessage
- `ReplyBubble.tsx` (original) — Replaced by ReplyBubbleNew

---

## Migration Notes

### If Restoring Old Features

The removed code can be found in git history:

```bash
# View deleted files
git log --diff-filter=D --summary

# Restore specific file
git checkout <commit>^ -- path/to/file
```

### Deprecated Patterns

These patterns were removed and should not be reintroduced:

1. **Direct Firestore writes for messages** — Use outbox
2. **Per-message read flags** — Use watermarks
3. **Client-side message ordering** — Use server timestamps
4. **Polling for new messages** — Use onSnapshot

---

## Document Consolidation Record

### Original Files → Consolidated

| Original File                   | Destination             |
| ------------------------------- | ----------------------- |
| ARCHITECTURE.md                 | docs/01_ARCHITECTURE.md |
| COMPREHENSIVE_APP_GUIDE.md      | docs/01_ARCHITECTURE.md |
| RULES_PLAN.md                   | docs/02_FIREBASE.md     |
| CHAT_OVERHAUL_IMPLEMENTATION.md | docs/03_CHAT_V2.md      |
| CHAT_V2_DONE_CRITERIA.md        | docs/03_CHAT_V2.md      |
| TEST_MATRIX.md                  | docs/04_TESTING.md      |
| CHAT_V2_TESTING.md              | docs/04_TESTING.md      |
| QUICKSTART.md                   | docs/05_RUNBOOK.md      |
| INDEX.md                        | docs/00_INDEX.md        |
| All PHASE\_\*.md files          | docs/ARCHIVE.md         |

### Deleted January 2026 (Completed Work)

| File                           | Reason                        |
| ------------------------------ | ----------------------------- |
| PHASE1_DISCOVERY_REPORT.md     | Unified architecture complete |
| PHASE2_INCONSISTENCY_REPORT.md | Inconsistencies resolved      |
| PHASE3_REDUNDANCY_REPORT.md    | Redundancy eliminated         |
| ARCHITECTURE_PROPOSAL.md       | Proposal implemented          |
| ARCHITECTURE_REVIEW_PROMPT.md  | Review complete               |
| IMPLEMENTATION_TICKETS.md      | All tickets completed         |
| UNIFIED_COMPOSER_PLAN.md       | Composer unified              |
| CHAT_INFINITE_SCROLL_PROMPT.md | Infinite scroll implemented   |
| REORGANIZATION_PROMPT.md       | Reorganization complete       |
| GAME_IMPLEMENTATION_PROMPT.md  | Games implemented             |
| GAME_REBUILD_RESEARCH.md       | Research consolidated to 06   |
| GAME_RESEARCH_FINDINGS.md      | Findings consolidated to 06   |
| REORGANIZATION_CHANGELOG.md    | Cleanup complete              |
| UNIVERSAL_GAME_INVITES_PLAN.md | Universal invites implemented |

### Deleted February 2026 (Consolidation)

| File                                | Reason                                             |
| ----------------------------------- | -------------------------------------------------- |
| CHAT_SETTINGS_AUDIT.md              | Summarized in ARCHIVE.md, details in 03_CHAT_V2    |
| CHAT_OPTIMIZATION_PLAN.md           | Summarized in ARCHIVE.md                           |
| REPLY_SYSTEM_DESIGN.md              | Summarized in ARCHIVE.md, details in 03_CHAT_V2    |
| NEW_SINGLEPLAYER_GAMES_PLAN.md      | Completed, game details in 06_GAMES.md             |
| PROFILE_SCREEN_OVERHAUL_PLAN.md     | Superseded by NEW_PROFILE_SYSTEM_PLAN.md           |
| AVATAR_ROLLOUT_GUIDE.md (ref)       | Reference removed, file never existed in archived/ |
| DIGITAL_AVATAR_SYSTEM_PLAN.md (ref) | Reference removed, file never existed in archived/ |

### Deleted (No Longer Relevant)

- GAP_CHECKLIST.md — Gaps addressed
- DELIVERY_MANIFEST.md — Old delivery tracking
- PROJECT_COMPLETION_REPORT.md — Outdated
- CHAT_MESSAGING_AUDIT.md — Consolidated to V2 docs
- CHAT*V2_AUDIT*\*.md — Consolidated to V2 docs
- WEB_PHOTO_CAPTURE_FIX.md — Issue resolved
- TESTING_PHASE_0.md — Old test plan

