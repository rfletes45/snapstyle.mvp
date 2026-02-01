# Chat Loading Optimization Plan

> **Status**: ✅ COMPLETE (January 2026)
>
> All primary optimizations have been implemented. Future enhancements moved to backlog.

## Executive Summary

This document outlines optimizations implemented to achieve instant chat loading, eliminate UI flickering, and create a polished, native-feeling experience.

---

## ✅ Completed Optimizations

### Phase 1: Eliminate Loading Flicker (DONE)

#### 1.1 ChatSkeleton Component ✅

Created `src/components/chat/ChatSkeleton.tsx` with:

- Shimmer animation for loading states
- `ChatSkeleton` - Message list placeholder with realistic bubble patterns
- `ConversationSkeleton` - Inbox item placeholder
- `ConversationListSkeleton` - Multiple inbox items placeholder

#### 1.2 Shell-First Rendering ✅

Updated `ChatScreen.tsx` and `GroupChatScreen.tsx` to:

- Always render header and composer immediately
- Show skeleton only in message area during loading
- Removed full-screen `LoadingState` spinner

#### 1.3 Instant SQLite Loading ✅

Updated `useLocalMessages.ts` to:

- Initialize state synchronously from SQLite via `useMemo`
- Start with `isLoading=false` when cached data exists
- Only show loading if no cached messages exist

### Phase 2: Navigation Data Passing (DONE)

#### 2.1 Pass Initial Data via Navigation ✅

Updated `ChatListScreenV2.tsx` to pass cached conversation data:

- DM: `chatId`, `friendName`, `friendAvatar`, `friendAvatarConfig`
- Group: `name`, `avatarUrl`

#### 2.2 Use Initial Data in Screens ✅

Updated `ChatScreen.tsx` to:

- Initialize `chatId` and `friendProfile` from route params if available
- Skip Firestore calls when cached data is present
- Refresh profile data in background (non-blocking)

### Phase 3: Parallel Data Loading (DONE)

#### 3.1 Parallelize Firestore Calls ✅

Updated `ChatScreen.tsx` initialization to:

- Use `Promise.all()` for `getOrCreateChat` and `getUserProfileByUid`
- Cut initialization time roughly in half

### Phase 4: Profile Caching Infrastructure (DONE)

#### 4.1 Profile Cache Service ✅

Created `src/services/cache/profileCache.ts` with:

- In-memory LRU cache with 5-minute TTL
- `getCachedProfile` - Async fetch with caching
- `getCachedProfileSync` - Synchronous cache lookup
- `prefetchProfiles` - Batch prefetch for inbox
- `invalidateProfile` - Manual cache invalidation

---

## 📊 Expected Performance Improvements

| Metric                        | Before    | After           | Improvement     |
| ----------------------------- | --------- | --------------- | --------------- |
| Time to first message visible | ~500ms    | <100ms          | ~80% faster     |
| Loading spinner duration      | ~300ms    | 0ms (skeleton)  | 100% eliminated |
| UI elements "pop-in"          | 3-4 items | 0 (all at once) | 100% eliminated |
| Repeated chat open latency    | ~400ms    | <50ms           | ~87% faster     |

---

## 🔜 Future Optimizations (Backlog)

### Smart Background Sync

Instead of syncing on every screen mount, implement smart sync based on data freshness:

```typescript
const shouldSync = () => {
  const timeSinceSync = Date.now() - cursor.last_sync_attempt;
  return timeSinceSync > 30_000; // 30 seconds
};
```

### Prefetch on Long-Press

When user long-presses a conversation in inbox, prefetch its messages in background.

### Conversation Metadata SQLite Cache

Store conversation metadata (name, avatar) in SQLite for truly instant header rendering even without navigation params.

---

## 📁 Files Changed

### New Files

- `src/components/chat/ChatSkeleton.tsx` - Shimmer skeleton components
- `src/services/cache/profileCache.ts` - Profile caching service

### Modified Files

- `src/hooks/useLocalMessages.ts` - Instant SQLite initialization
- `src/screens/chat/ChatScreen.tsx` - Skeleton, parallel init, nav params
- `src/screens/groups/GroupChatScreen.tsx` - Skeleton loading
- `src/screens/chat/ChatListScreenV2.tsx` - Pass initial data to navigation
- `src/components/chat/index.ts` - Export skeleton components

---

## Technical Notes

### Why SQLite-First Works

The key insight is that SQLite reads are **synchronous** operations. By calling `getMessagesForConversation()` inside `useMemo` during component initialization, we can populate state with cached data before the first render completes.

### Navigation Param Optimization

React Navigation params are available synchronously on the first render. By passing conversation metadata from the inbox, we eliminate the need for async profile fetches before displaying the header.

### Skeleton vs Spinner Psychology

Skeletons that match the final layout provide better perceived performance because they:

1. Show immediate feedback that content is loading
2. Create a mental model of what's coming
3. Feel faster than blank screens with spinners

| Metric                        | Current   | Target          |
| ----------------------------- | --------- | --------------- |
| Time to first message visible | ~500ms    | <100ms          |
| Loading spinner duration      | ~300ms    | 0ms (skeleton)  |
| UI elements "pop-in"          | 3-4 items | 0 (all at once) |
| Repeated chat open latency    | ~400ms    | <50ms           |

---

## Technical Risks & Mitigations

### Risk 1: Stale Data Display

**Mitigation**: Show subtle sync indicator when background sync is happening. Use optimistic UI updates.

### Risk 2: Memory Pressure from Caching

**Mitigation**: Implement LRU eviction for profile cache. Limit prefetch to recent conversations.

### Risk 3: Race Conditions in Parallel Loading

**Mitigation**: Use proper state management with refs to track initialization status. Cancel in-flight requests on unmount.

---

## Appendix: Current Code References

### Key Files to Modify

- `src/hooks/useLocalMessages.ts` - Local message loading
- `src/hooks/useChat.ts` - Main chat hook
- `src/hooks/useInboxData.ts` - Inbox data loading
- `src/screens/chat/ChatScreen.tsx` - DM screen
- `src/screens/groups/GroupChatScreen.tsx` - Group screen
- `src/screens/chat/ChatListScreenV2.tsx` - Inbox screen
- `src/components/ui/LoadingState.tsx` - Replace with skeleton

### New Files to Create

- `src/components/chat/ChatSkeleton.tsx` - Message list skeleton
- `src/components/chat/inbox/ConversationSkeleton.tsx` - Inbox item skeleton
- `src/hooks/useInboxPrefetch.ts` - Prefetch logic
- `src/services/cache/profileCache.ts` - Profile caching
- `src/services/database/metadataRepository.ts` - Metadata cache
