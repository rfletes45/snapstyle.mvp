# Messaging System

Last verified: 2026-03-22

## Scope

This is the canonical reference for DM chat, group chat, inbox state, message requests, message features (edit/delete, reactions, voice, scheduled, mentions, attachments), realtime subscriptions, and message-driven notifications.

Historical migration notes still exist under `docs/chat-system-audit/`, but they are no longer the source of truth.

## Runtime Architecture

Primary screen orchestration:

- `src/hooks/useChat.ts`
- `src/hooks/useUnifiedChatScreen.ts`
- `src/screens/chat/ChatScreen.tsx`
- `src/screens/groups/GroupChatScreen.tsx`
- `src/screens/chat/ThreadScreen.tsx`

Supporting screens:

- `src/screens/chat/ChatListScreenV2.tsx` (inbox)
- `src/screens/chat/InboxSearchScreen.tsx` (conversation search)
- `src/screens/chat/InboxSettingsScreen.tsx` (global inbox preferences)
- `src/screens/chat/ChatSettingsScreen.tsx` (per-conversation notification overrides)
- `src/screens/chat/ScheduledMessagesScreen.tsx` (manage scheduled messages)
- `src/screens/groups/GroupChatInfoScreen.tsx` (group details and member management)
- `src/screens/groups/GroupChatCreateScreen.tsx` (group creation wizard)

Runtime ownership is now explicit:

- Native (`USE_LOCAL_STORAGE=true`):
  - `useChat` uses `src/hooks/useLocalMessages.ts`
  - SQLite is the immediate UI cache via `src/services/database/*`
  - realtime and resync come from `src/services/sync/syncEngine.ts`
  - `useUnifiedMessages` is mounted with `enabled: false`, so the Firestore-first runtime does not create duplicate listeners
- Web (`USE_LOCAL_STORAGE=false`):
  - `useChat` uses `src/hooks/useUnifiedMessages.ts`
  - this path still depends on `src/services/messaging/send.ts`, `src/services/messaging/subscribe.ts`, `src/services/chatV2.ts`, and `src/services/messageList.ts`

The local-first path is the primary native implementation. The Firestore-first path remains a compatibility runtime for web.

## Source Of Truth By Concern

- DM conversation identity:
  - `src/services/chat.ts:getOrCreateChat`
  - Firestore `Chats/{chatId}` where `chatId` is the sorted user pair
- Group identity and membership:
  - `src/services/groups.ts:createGroup`
  - Firestore `Groups/{groupId}`, `Groups/{groupId}/Members`, `Groups/{groupId}/MembersPrivate`
- Message persistence:
  - server-authoritative write path: `firebase-backend/functions/src/messaging.ts`
  - client-local cache on native: SQLite `messages` table via `src/services/database/messageRepository.ts`
- Inbox membership state:
  - primary read path today: `src/hooks/useInboxData.ts` fan-out reads from `Chats` and `Groups`
  - backend also maintains `Users/{uid}/Inbox/*` through `firebase-backend/functions/src/inboxTriggers.ts`
- Unread/read state:
  - source of truth: `MembersPrivate.lastSeenAtPrivate` and related member-private watermarks
  - aggregated inbox `unreadCount` is a derived hint, not the canonical authority
- Notifications:
  - source of truth: `Users/{uid}/Notifications/{notificationId}`
  - delivery selection: `firebase-backend/functions/src/notificationCenter.ts`
  - device/session coordination: `Users/{uid}/NotificationDevices`, `Users/{uid}/NotificationSessions`

## Conversation Lifecycle

DM creation and lookup:

1. UI resolves the peer user.
2. `getOrCreateChat()` builds the deterministic chat ID from the two UIDs.
3. The service validates blocks before creating `Chats/{chatId}`.
4. Membership, member-private state, and messages live under the `Chats/{chatId}` subtree.

Group creation:

1. `createGroup()` writes `Groups/{groupId}`.
2. The creator is inserted into `Members`.
3. Group membership and per-user private state are stored under the group document.
4. Group message writes flow through the same server messaging callable as DMs, but with group membership checks.

Thread replies:

- `ThreadScreen` is still a separate local-thread surface.
- It reads replies from SQLite and relies on `syncEngine.subscribeToConversation(...)` plus `syncPendingMessages()`.
- It is not yet unified into `useChat`, so thread behavior should be treated as a specialized screen on top of the same local-first storage.

## Message Lifecycle

Native local-first send flow:

1. `useChat.sendMessage(...)` inserts an optimistic row into SQLite.
2. Attachments and reply metadata are stored locally in the same transaction.
3. `syncPendingMessages()` pushes pending rows through the sync engine.
4. The authoritative backend write still lands through `sendMessageV2`.
5. Realtime sync writes the canonical server message back into SQLite, and normalization reconciles optimistic versus authoritative state.

Native local-first read flow:

1. `useChat` now owns automatic read watermark writes for both DM and group screens.
2. DM public read receipts still respect the effective setting supplied by `useReadReceipts`.
3. Screen-specific fallback read effects should not fork this behavior anymore.
4. Inbox optimistic read updates remain UI sugar; canonical unread state is still member-private.

Web fallback send flow:

1. `useChat.sendMessage(...)` delegates to `src/services/messaging/send.ts`.
2. That wrapper still routes through `src/services/chatV2.ts`.
3. The server callable `sendMessageV2` performs the same authoritative validation and write steps.
4. `useUnifiedMessages` merges realtime snapshots with outbox items for optimistic state.

Authoritative server guarantees in `sendMessageV2`:

- auth required
- DM or group membership enforcement
- DM block checks
- message request gating
- rate limiting (global bucketed limiter defined but currently disabled via `ENABLE_GLOBAL_RATE_LIMIT=false`)
- group settings enforcement (slow mode, announcement-only, media restrictions defined but currently disabled via `ENABLE_GROUP_SETTINGS_ENFORCEMENT=false`)
- idempotency via `messageId` and `idempotencyKey`
- canonical `serverReceivedAt` timestamps
- staged attachment commit (staging → chat-media)
- conversation preview updates
- thread reply counter updates

## Inbox And Unread Model

Current client inbox ownership:

- `src/hooks/useInboxData.ts` is the active inbox reader because `CHAT_FEATURES.CHAT_INBOX_AGGREGATION` is still `false`
- `src/hooks/useInboxAggregation.ts` exists for the aggregated inbox path but is not the default runtime today
- the aggregated hook still hydrates `MembersPrivate` per conversation for archive, mute, pin, and private watermark parity, so it is not yet a pure single-listener client design

Current backend inbox behavior:

- `firebase-backend/functions/src/inboxTriggers.ts` always maintains aggregated inbox docs under `Users/{uid}/Inbox`
- `markInboxRead` only resets the derived aggregated inbox unread hint
- this means the codebase is in a partial migration state: backend aggregation writes are live, but the client still defaults to fan-out reads and member-private watermarks remain the canonical unread authority

Unread semantics:

- compute from member-private watermarks first
- use `src/services/chat/normalizeInboxRow.ts` for normalization
- treat aggregated unread fields as hints only

## Message Requests

Message requests are always on.

- backend enforcement: `firebase-backend/functions/src/messageRequests.ts`
- client subscription: `src/hooks/useMessageRequests.ts`
- inbox merge surface: `src/hooks/useUnifiedInboxRequests.ts`
- request actions: `acceptMessageRequest`, `declineMessageRequest`

There is no longer a client feature flag for message requests. The previous gating was removed because the backend already enforced requests, which could otherwise hide legitimate pending requests from the UI.

## Realtime Ownership

Native conversation screens:

- realtime source: `src/services/sync/syncEngine.ts`
- screen hook: `src/hooks/useLocalMessages.ts`
- local cache reloads after sync notifications

Web fallback conversation screens:

- realtime source: `src/services/messaging/subscribe.ts`
- hook: `src/hooks/useUnifiedMessages.ts`

Important invariant:

- only one message runtime should own a screen at a time
- `useChat` now enforces that by disabling the Firestore-first hook whenever local-first mode is active

## Notifications

Notification event producers:

- chat and message request events: `firebase-backend/functions/src/notifications.ts`
- game events: `firebase-backend/functions/src/gamesV4/notifications.ts`
- social and gifting events also route into the same center

Notification routing center:

- `firebase-backend/functions/src/notificationCenter.ts`

Notification center behavior:

1. read inbox notification preferences from `Users/{uid}/settings/inbox`
2. suppress if the conversation is muted
3. inspect fresh `NotificationSessions`
4. suppress if the user is already viewing the target surface
5. choose one channel: `in_app`, `push`, or `none`
6. write the canonical notification record to `Users/{uid}/Notifications/{notificationId}`
7. send Expo push only when the selected channel is `push`

Client consumers:

- feed and badge subscription: `src/services/userNotifications.ts`
- foreground banners and session heartbeats: `src/store/InAppNotificationsContext.tsx`
- push tap normalization and navigation: `src/store/AuthContext.tsx`
- client conversation read-marking is scope-aware (`dm` vs `group`) when clearing notification records
- in-app toast presses and “last viewed conversation” tracking now preserve conversation scope so group and DM notification flows use the same ownership model

There is no `CHAT_LEGACY_PUSH_ENABLED` environment contract in the current implementation.

## Message Features

Edit and delete:

- client service: `src/services/messageActions.ts` (`editMessage`, `deleteMessage`)
- server enforcement: `firebase-backend/functions/src/messaging.ts` (editMessage, deleteMessage callables)
- edit window: 15 minutes from send time
- delete modes: delete for self, delete for everyone
- UI surface: `MessageActionsSheet` bottom sheet on message long-press

Reactions:

- type: `reactionsSummary` field on `MessageV2` (`Record<string, number>`)
- UI: `ReactionBar` (picker) and `ReactionDetailSheet` (who reacted)

Voice messages:

- recorder hook: `src/hooks/useVoiceRecorder.ts`
- playback component: `src/components/chat/VoiceMessagePlayer.tsx`
- record button: `src/components/chat/VoiceRecordButton.tsx`
- stored as audio attachment with duration and waveform metadata

Mentions:

- stored as `mentionUids: string[]` and `mentionSpans: MentionSpan[]` on `MessageV2`
- `MentionSpan` defines `{ uid, start, end }` offsets into message text
- UI: `src/components/chat/MentionAutocomplete.tsx` for `@name` suggestions while composing
- separate unread mention counter from general unread in inbox

Link previews:

- type: `LinkPreviewV2` with Open Graph data
- UI: `src/components/chat/LinkPreviewCard.tsx`

Attachment pipeline:

- two-phase upload model
- Phase 1: client uploads to `chat-staging/{scope}/{conversationId}/{messageId}/` (public read, short-lived)
- Phase 2: `sendMessageV2` Cloud Function moves staging → `chat-media/` (private)
- orphan cleanup: `cleanupStagingOrphans` scheduled function removes abandoned files after 6 hours
- server constraints: max 25 MB per file, max 10 attachments per message, MIME whitelist (image/_, video/_, audio/\*, PDF, Office docs, text)
- backend service: `firebase-backend/functions/src/chatMedia.ts`
- client hooks: `src/hooks/useAttachmentPicker.ts` (camera + gallery)
- UI: `AttachmentTray` (send queue), `AttachmentGrid` (message display), `MediaViewerModal` (full-screen viewer)

Scheduled messages:

- client service: `src/services/scheduledMessages.ts`
- backend: `firebase-backend/functions/src/scheduledMessages.ts` (legacy proxy to `processScheduledMessages`)
- Firestore path: `Users/{uid}/scheduledMessages`
- constraints: minimum 5 minutes, maximum 30 days in the future
- management screen: `src/screens/chat/ScheduledMessagesScreen.tsx`
- UI: `src/components/ScheduleMessageModal.tsx` (date/time picker)

Per-chat settings:

- type: `ChatSettingsV3` (global) and `EffectiveChatSettings` (resolved per-conversation)
- resolver: `src/services/messaging/resolveChatSettings.ts`
- global settings: `src/services/inboxSettings.ts` (Firestore path `Users/{uid}/settings/inbox`)
- per-chat overrides managed through `src/screens/chat/ChatSettingsScreen.tsx`
- settings include: mute duration, notification level, read receipt toggles, archive

Group settings:

- type: `GroupSettings` in `src/types/messaging.ts`
- defined fields: `slowModeSeconds`, `announcementOnly`, `allowMediaFromMembers`, `allowMentionsAll`, `retentionMode`
- server enforcement exists but is disabled (`ENABLE_GROUP_SETTINGS_ENFORCEMENT=false`)
- no client UI currently renders or edits these settings

Game invites:

- both ChatScreen and GroupChatScreen support creating game invites (V4 Games)
- UI: `GamePickerModal` for game selection, `createGameInvite` service for invite creation

Group calls:

- available in GroupChatScreen when `areNativeCallsAvailable=true`
- excluded on web and Expo Go builds
- lazy-loaded via `groupCallService`

## Chat Composer and Input

- unified hook: `src/hooks/useChatComposer.ts`
- component: `src/components/chat/ChatComposer.tsx` (scope-aware for DM vs group)
- features: text input, voice recording button, attachment picker, reply preview bar, mention autocomplete (groups), animal themes
- keyboard tracking: `src/hooks/chat/useChatKeyboard.ts` (Reanimated animated values)
- auto-scroll on new messages: `src/hooks/chat/useNewMessageAutoscroll.ts`

## Live Compatibility Debt

- The web fallback path still relies on wrapper services that delegate into older `chatV2` and `messageList` modules.
- Backend inbox aggregation is already live even though the client default reader is still fan-out.
- `ThreadScreen` remains a separate local-thread implementation instead of sharing the full `useChat` stack.
- `firebase-backend/functions/src/deleteAccount.ts` still contains explicit cleanup for legacy `Conversations`, root `Notifications`, and `InAppNotificationsV4` data so old documents can still be scrubbed safely.
- Group settings types and server enforcement code exist but are gated behind a disabled feature flag with no client UI.
- Scheduled messages backend is still a legacy proxy.

## Validation

Targeted tests exercised during the 2026-03-18 cleanup:

```bash
npm test -- --runInBand __tests__/services/chatV3Client.test.ts __tests__/services/resolveChatSettings.test.ts __tests__/services/outboxErrorClassification.test.ts
```

Recommended follow-up checks for messaging work:

```bash
npm --prefix firebase-backend/functions run build
```
