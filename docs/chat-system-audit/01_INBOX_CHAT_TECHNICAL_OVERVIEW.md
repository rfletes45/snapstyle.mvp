# Inbox & Chat System - Technical Overview

Last verified: 2026-03-05  
Status: Phase 0 complete, Phase 1 documented

## 1) Scope

This document maps the active Inbox/Chat system across:

- Inbox list and conversation rows
- DM + group chat screens
- Thread view
- Requests/connections and blocked users entry points tied to chat
- Chat settings + inbox settings
- In-app/push notification routing into chat
- Game invite entry points launched from chat

## 2) Navigation Surfaces and Routes

Primary route/type source:

- `src/navigation/RootNavigator.tsx`
- `src/types/navigation/root.ts`

Chat-related route map:

- Tab stack:
  - `InboxStack.ChatList` -> `ChatListScreenV2`
  - `InboxStack.ScheduledMessages` -> `ScheduledMessagesScreen`
  - `InboxStack.GroupInvites` -> `GroupInvitesScreen`
  - `InboxStack.InboxSettings` -> `InboxSettingsScreen`
  - `InboxStack.InboxSearch` -> `InboxSearchScreen`
- Main stack overlays:
  - `ChatDetail` -> `ChatScreen` (DM)
  - `GroupChat` -> `GroupChatScreen`
  - `ThreadView` -> `ThreadScreen`
  - `ChatSettings` -> `ChatSettingsScreen`
  - `GroupChatInfo` -> `GroupChatInfoScreen`
  - `Connections` -> `FriendsScreen`
- Profile-linked screen:
  - `ProfileStack.BlockedUsers` -> `BlockedUsersScreen` (navigated from inbox settings)

Deep links configured:

- `chat/:friendUid` -> `ChatDetail`
- `group/:groupId` -> `GroupChat`
- Game routes (`game/lobby/:inviteId`, `game/play/:sessionId`, etc.) for in-chat game flows

## 3) Screen and Hook Composition

### Inbox list

- Screen: `src/screens/chat/ChatListScreenV2.tsx`
- Primary data hook: `src/hooks/useInboxData.ts`
- Actions hook: `src/hooks/useConversationActions.ts`
- Requests data:
  - `src/hooks/useFriendRequests.ts`
  - group invites from `src/services/groups.ts` (`getPendingInvites`)
- Row/UI components:
  - `src/components/chat/inbox/ConversationItem.tsx`
  - `src/components/chat/inbox/SwipeableConversation.tsx`
  - `src/components/chat/inbox/ConversationContextMenu.tsx`

### DM screen

- Screen: `src/screens/chat/ChatScreen.tsx`
- Orchestration hook: `src/hooks/useUnifiedChatScreen.ts`
  - internally composes `useChat` + `useChatComposer`
- Message rendering:
  - list shell: `src/components/chat/ChatMessageList.tsx`
  - item renderer: `src/components/DMMessageItem.tsx`

### Group screen

- Screen: `src/screens/groups/GroupChatScreen.tsx`
- Same unified orchestration hook path as DM with group config
- Group metadata/membership via `src/services/groups.ts`

### Thread screen

- Screen: `src/screens/chat/ThreadScreen.tsx`
- Uses SQLite repository directly:
  - `src/services/database/messageRepository.ts`
- Sends replies by local insert + `syncPendingMessages()` in `src/services/sync/syncEngine.ts`

## 4) Data Flow

### 4.1 Inbox list flow

Current active default path (`CHAT_FEATURES.CHAT_INBOX_AGGREGATION = false`):

1. `useInboxData` subscribes to:
   - `Chats` where `members` contains user
   - `Groups` where `memberIds` contains user
2. For each conversation, reads per-user private state:
   - `Chats/{chatId}/MembersPrivate/{uid}`
   - `Groups/{groupId}/MembersPrivate/{uid}`
3. Joins profile snapshots for DM counterpart user (`Users/{otherUid}`)
4. Produces unified `InboxConversation[]` for UI

Alternative staged path (flagged off):

- `useInboxAggregation` reads `Users/{uid}/Inbox/*` (server-aggregated entries from triggers)

### 4.2 Conversation message flow

Unified send path:

1. Screen -> `useUnifiedChatScreen` -> `useChat.sendMessage`
2. `useChat` chooses runtime by `USE_LOCAL_STORAGE`:
   - Native default: SQLite-first (`useLocalMessages`)
   - Web fallback: Firestore-first (`useUnifiedMessages`)
3. Local-first send:
   - insert local row in SQLite (`messageRepository.insertMessage`)
   - background sync via `syncEngine.syncPendingMessages()` -> callable `sendMessageV2`
4. Server write:
   - `firebase-backend/functions/src/messaging.ts` (`sendMessageV2`)
   - validates membership/permissions/limits and writes canonical message + conversation preview fields

### 4.3 Realtime strategy

- Inbox:
  - Firestore `onSnapshot` on `Chats` + `Groups` (or aggregated inbox path when enabled)
- DM/group messages:
  - local-first path listens through `syncEngine.subscribeToConversation` and reloads from SQLite
  - fallback path listens directly to Firestore message subcollections via `messageList.ts`
- Requests:
  - friend requests via Firestore listener in `useFriendRequests`
  - group invites currently polled on focus in `ChatListScreenV2` (not subscribed there)

## 5) State Ownership

- Navigation + route ownership:
  - React Navigation stacks in `RootNavigator.tsx`
- Auth/user identity:
  - `src/store/AuthContext.tsx`
  - `src/store/UserContext.tsx`
- In-app notification state + suppression:
  - `src/store/InAppNotificationsContext.tsx`
- Conversation settings state:
  - per-thread private docs in `MembersPrivate`
  - global inbox settings in `Users/{uid}/settings/inbox`

## 6) Notification and Deep Link Entry Behavior

Foreground/in-app:

- In-app toast notifications are generated from Firestore listeners in `InAppNotificationsContext`.
- Tap behavior:
  - Toast press triggers navigation via `InAppToast` -> `App.tsx` navigation callback.
  - Message taps also trigger optimistic read handler registration in inbox screen.

Push-tap behavior:

- `AuthContext` registers `addNotificationResponseListener`.
- Payload routes:
  - `type=message` -> `ChatDetail` with `senderId`
  - `type=group_message` -> `GroupChat` with `groupId`
  - `type=friend_request` -> `Connections`

## 7) Listener Lifecycle Summary

- Inbox screen:
  - `useInboxData` manages chat/group subscriptions with cleanup on unmount/uid change.
- Chat screens:
  - unified hooks manage message subscriptions.
  - `setCurrentChatId` used during focus/unfocus for notification suppression.
- Thread screen:
  - currently manually reloads local DB and includes interval polling (identified for fix in refactor plan).
