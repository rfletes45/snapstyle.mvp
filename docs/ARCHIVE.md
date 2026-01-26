# Development History Archive

> Completed phase documentation preserved for historical reference.  
> This file consolidates audit trails and implementation records.

---

## Project Timeline Summary

| Phase       | Focus                            | Status                   |
| ----------- | -------------------------------- | ------------------------ |
| Phase 0-4   | Initial setup, auth, basic UI    | ✅ Complete              |
| Phase 5-8   | Profile, avatar, cosmetics       | ✅ Complete              |
| Phase 9-11  | Chat V1 implementation           | ✅ Complete (Deprecated) |
| Phase 12-14 | Groups, notifications            | ✅ Complete              |
| Phase 15-17 | Chat V2 migration                | ✅ Complete              |
| Phase 18-21 | V2 features, polish              | ✅ Complete              |
| Phase A-G   | Avatar customization, theme      | ✅ Complete              |
| Phase H     | Chat V1 decommission             | ✅ Complete              |
| Cleanup     | Dead code removal                | ✅ Complete (PRs 8-11)   |
| Inbox       | Inbox screen overhaul (8 phases) | ✅ Complete (Jan 2026)   |

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

- [INBOX_OVERHAUL_PLAN.md](./INBOX_OVERHAUL_PLAN.md) — Implementation summary
- [03_CHAT_V2.md](./03_CHAT_V2.md) — Includes Inbox Overhaul section

> **Deleted during cleanup (Jan 2026):**
>
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

### Deleted (No Longer Relevant)

- GAP_CHECKLIST.md — Gaps addressed
- DELIVERY_MANIFEST.md — Old delivery tracking
- PROJECT_COMPLETION_REPORT.md — Outdated
- CHAT_MESSAGING_AUDIT.md — Consolidated to V2 docs
- CHAT*V2_AUDIT*\*.md — Consolidated to V2 docs
- WEB_PHOTO_CAPTURE_FIX.md — Issue resolved
- TESTING_PHASE_0.md — Old test plan
