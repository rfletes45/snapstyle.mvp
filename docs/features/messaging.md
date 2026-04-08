# Messaging

Last verified: 2026-04-01

## Scope

This is the current-state reference for:

- DM chat
- group chat
- inbox and unread behavior
- message requests
- reactions, voice notes, mentions, attachments, and scheduled messages
- notification interactions that are directly tied to chat

## Current Status

- native messaging runtime: implemented and primary
- web messaging runtime: implemented as a compatibility path
- inbox aggregation backend: implemented
- inbox aggregation client default: not yet switched on
- DM and group detail screens: unified around a shared `MessageV2` screen foundation
- threads: implemented, but still a specialized screen

## Main Files

Screens:

- [ChatListScreenV2.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/chat/ChatListScreenV2.tsx)
- [ChatScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/chat/ChatScreen.tsx)
- [GroupChatScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/groups/GroupChatScreen.tsx)
- [ThreadScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/chat/ThreadScreen.tsx)
- [ScheduledMessagesScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/chat/ScheduledMessagesScreen.tsx)
- [InboxSettingsScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/chat/InboxSettingsScreen.tsx)
- [ChatSettingsScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/chat/ChatSettingsScreen.tsx)

Hooks and services:

- [useChat.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/hooks/useChat.ts)
- [useLocalMessages.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/hooks/useLocalMessages.ts)
- [useUnifiedMessages.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/hooks/useUnifiedMessages.ts)
- [useUnifiedChatScreen.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/hooks/useUnifiedChatScreen.ts)
- [useInboxData.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/hooks/useInboxData.ts)
- [useUnifiedInboxRequests.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/hooks/useUnifiedInboxRequests.ts)
- [ChatHeader.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/components/chat/ChatHeader.tsx)
- [ChatMessageRenderer.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/components/chat/ChatMessageRenderer.tsx)
- [sendDraft.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/chat/sendDraft.ts)
- [groupMembers.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/groupMembers.ts)
- `src/services/messaging/*`
- `src/services/outbox.ts`
- `src/services/messageList.ts`
- `src/services/sync/syncEngine.ts`

Backend:

- [messaging.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/messaging.ts)
- [messageRequests.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/messageRequests.ts)
- [inboxTriggers.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/inboxTriggers.ts)
- [chatMedia.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/chatMedia.ts)
- [notificationCenter.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/notificationCenter.ts)

## Runtime Architecture

Detailed shared-surface documentation lives in [chat-platform.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/architecture/chat-platform.md).

### Native

Native devices run the local-first path:

- `USE_LOCAL_STORAGE = true`
- `useChat` delegates to `useLocalMessages`
- SQLite is the immediate UI cache
- sync and reconciliation come from the sync engine
- `useUnifiedMessages` is disabled so the Firestore-first runtime does not double-own the screen

### Web

Web uses the Firestore-first compatibility path:

- `USE_LOCAL_STORAGE = false`
- `useChat` delegates to `useUnifiedMessages`
- send orchestration flows through `src/services/messaging/send.ts`
- subscriptions flow through `src/services/messaging/subscribe.ts` and `src/services/messageList.ts`
- optimistic queue state is persisted by `src/services/outbox.ts`

### Important invariant

One conversation screen should have one active message owner. The current `useChat` implementation enforces that split.

## Conversation and Message Authority

### Conversation identity

- DM identity is deterministic and tied to `Chats/{chatId}`
- groups live under `Groups/{groupId}`

### Canonical write path

`sendMessageV2` in the Functions backend is the authoritative DM/group write path.

Server-side guarantees include:

- authenticated sender
- DM/group membership validation
- DM block checks
- message request gating
- idempotency using `messageId` and client identifiers
- canonical `serverReceivedAt`
- attachment commit from staging to final media storage

### Native local cache

On native, optimistic rows land in SQLite first and then reconcile against the authoritative server message when sync completes.

### Screen-level canonical model

The DM and group detail screens now converge at the `MessageV2` boundary:

- both screens derive timeline rows from `MessageV2`
- both screens use the shared header/list/composer/action-sheet scaffold
- DM-specific behavior is now layered on top of the shared model instead of converting into a separate legacy message shape

## Inbox and Unread Model

Current state is a partial migration:

- backend always maintains `Users/{uid}/Inbox/*`
- client still defaults to fan-out reads through `useInboxData`
- `CHAT_FEATURES.CHAT_INBOX_AGGREGATION` is still `false`

Unread authority:

- canonical source: `MembersPrivate` watermarks
- aggregated inbox unread counts: derived hints only

`markInboxRead` resets the aggregated inbox hint, but it does not replace member-private unread state.

## Message Requests

Message requests are always on.

Active pieces:

- backend enforcement: `messageRequests.ts`
- client subscription: `useMessageRequests.ts`
- merge surface: `useUnifiedInboxRequests.ts`

There is no longer a client-side feature flag that hides message requests while the backend still enforces them.

## Message Features

### Reactions

- backed by `toggleReactionV2`
- stored as both message summary data and reaction subcollection state
- supported in both DM and group screens

### Voice messages

- recorder: `useVoiceRecorder.ts`
- send surface: shared send helpers in `src/chat/sendDraft.ts`
- playback: `VoiceMessagePlayer.tsx`

### Mentions

- stored on the message shape as `mentionUids` and `mentionSpans`
- compose-time suggestions are handled in `MentionAutocomplete.tsx`

### Attachments

Attachment flow is two-phase:

1. client uploads to `chat-staging/...`
2. `sendMessageV2` finalizes into `chat-media/...`

Current constraints are enforced server-side in `chatMedia.ts`.

The top-level DM and group screens now share the same attachment send orchestration for:

- tray attachments
- direct camera sends
- direct gallery sends

### Scheduled messages

- client service: `src/services/scheduledMessages.ts`
- management screen: `ScheduledMessagesScreen.tsx`
- backend processing remains a legacy-style proxy but is still active

### Per-chat settings

Settings are split between:

- global inbox settings under `Users/{uid}/settings/inbox`
- per-conversation overrides shown in `ChatSettingsScreen.tsx`

### Conversation display mode

Rendering supports:

- `bubbles`
- `stacked`

That choice is viewer-side only. See [conversation-display-modes.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/features/conversation-display-modes.md).

## Group Chat Notes

Group chat currently includes:

- normal group messaging
- typing and unread behavior
- group-specific settings screens
- voice-room occupancy and entry points for Stream voice channels

Important correction from older docs:

- the active group voice implementation is Stream-based
- old references to `groupCallService` are legacy and not the live runtime

Group-specific behavior that still intentionally differs from DM:

- mentions
- group permissions and moderation
- member-style toggles
- voice-room header actions

## Notification Relationship

Chat event producers feed the shared notification center. Messaging-specific notification types include:

- `dm_message`
- `group_message`
- `message_request`

The notification center chooses one channel only:

- `in_app`
- `push`
- `none`

Client chat notification handling must preserve `conversationScope` so DM and group notifications do not collapse onto a bare conversation ID.

## Known Current Rough Edges

- backend inbox aggregation is live, but the client default still reads fan-out data
- `ThreadScreen` remains a specialized local-first surface instead of using the full shared chat runtime
- the web path still relies on older compatibility modules underneath the unified hook surface
- group settings types and enforcement hooks exist, but the stricter server enforcement flags remain disabled
- group typing writes still stamp legacy `typingExpiresAt` alongside canonical `typingAt` during migration compatibility

## Explicit Non-Truths From Older Docs

The following older claims are no longer accurate:

- there is no active `InboxSearchScreen.tsx` in the current repo
- the current group-call entry in chat is not powered by the old Firestore/WebRTC group call service
- the old `CHAT_LEGACY_PUSH_ENABLED` contract is not part of the live implementation

## Recommended Validation

```bash
npm run type-check
npm run lint
npm run test
npm --prefix firebase-backend/functions run build
```
