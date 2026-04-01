# Chat Platform Architecture

Last verified: 2026-04-01

## Purpose

This document describes the current shared architecture for direct messages and group chat after the chat-surface unification pass.

Use this file as the primary reference when changing:

- chat screen scaffolding
- message rendering
- send/composer behavior
- typing, read, unread, and member-state behavior
- shared chat UI components and hooks

## Canonical Model

Both DM and group conversations now use the same message shape at the screen/render boundary:

- `MessageV2` in [messaging.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/types/messaging.ts)

That means:

- `ChatScreen.tsx` and `GroupChatScreen.tsx` both build timelines from `MessageV2`
- DM no longer converts into a separate legacy display-only message model
- `MessageActionsSheet` now receives canonical messages in both scopes

## Shared Foundation

### Shared screen scaffold

The main DM and group detail screens share these top-level building blocks:

- [useUnifiedChatScreen.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/hooks/useUnifiedChatScreen.ts)
- [ChatHeader.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/components/chat/ChatHeader.tsx)
- [ChatMessageList.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/components/chat/ChatMessageList.tsx)
- [ChatComposer.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/components/chat/ChatComposer.tsx)
- [MessageActionsSheet.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/components/chat/MessageActionsSheet.tsx)
- [SystemMessageChip.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/components/chat/SystemMessageChip.tsx)

### Shared message flow

The main screen message flow is now:

1. `useUnifiedChatScreen` exposes canonical `MessageV2[]`
2. screens derive any scope-specific display metadata
3. [buildTimeline.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/chat/buildTimeline.ts) inserts grouping flags and date dividers
4. system messages render through `SystemMessageChip`
5. non-system messages render through shared/canonical message components

### Shared send flow

DM and group screens now share send orchestration through:

- [sendDraft.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/chat/sendDraft.ts)

Shared helpers there cover:

- draft send for text + tray attachments
- direct media sends from camera/gallery bypass paths
- voice sends
- animal signal sends

Scope-specific behavior is injected instead of forked:

- DMs call the shared path with no mention decoration
- groups add mention extraction via `buildTextOptions` and `buildAttachmentOptions`

### Shared persistence/runtime

The runtime split is still:

- native: `useChat` -> `useLocalMessages` -> SQLite + sync engine
- web: `useChat` -> `useUnifiedMessages` compatibility path

The important detail is that both screen types consume the same `useChat` surface even though the storage backend differs by platform.

## Shared vs Scope-Specific Responsibilities

### Universal chat logic

These areas should stay shared unless there is a strong product reason not to:

- message envelope and normalization
- timeline/date-divider construction
- top-level header scaffold
- list virtualization and return-to-bottom behavior
- composer shell and reply-preview UI
- message action sheet
- media viewer wiring
- reactions subscription model
- retry / optimistic send plumbing
- system-message presentation

### DM-specific logic

These remain intentionally DM-only:

- presence and last-seen subtitle logic
- reciprocal read/delivery receipt display
- direct-call entry point
- block/report actions
- personalized empty state copy

### Group-specific logic

These remain intentionally group-only:

- member identity lookup across many senders
- mentions and autocomplete
- group role / permission checks
- moderation/admin capabilities
- show-member-chat-styles preference
- group info / permissions routes
- voice-room occupancy and join/start controls

## Member-State Contract

### Public state

Public conversation member docs are conceptually aligned between DMs and groups:

- path: `Chats/{chatId}/Members/{uid}` or `Groups/{groupId}/Members/{uid}`
- canonical typing field: `typingAt`
- canonical delivery watermark: `lastDeliveredAtPublic`
- canonical read watermark: `lastReadAtPublic`

Group member-state normalization lives in:

- [groupMembers.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/groupMembers.ts)

Important migration detail:

- group reads still tolerate legacy `typingExpiresAt`
- group writes currently stamp both `typingAt` and `typingExpiresAt` for compatibility
- new code should treat `typingAt` as the canonical field

### Private state

Private member docs remain the owner-only source for:

- mute/archive/pin
- private unread watermarks
- notification overrides
- show-member-chat-styles

Group private writes were aligned with DM semantics during the unification pass:

- they now use merge-based writes for the main settings/watermark mutations instead of assuming the private doc already exists

## Render Architecture

### DM

DM rendering now stays on canonical `MessageV2` all the way down:

- [ChatScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/chat/ChatScreen.tsx)
- [ChatMessageRenderer.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/components/chat/ChatMessageRenderer.tsx)
- [DMMessageItem.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/components/DMMessageItem.tsx)
- [StackedMessageRenderer.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/components/chat/StackedMessageRenderer.tsx)

The old DM-only adapter layer is gone.

### Group

Group rendering stays on `MessageV2` and remains the richer reference implementation for:

- multi-sender identity presentation
- mentions
- permissions-aware actions
- member-style suppression
- voice-room controls

Primary files:

- [GroupChatScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/groups/GroupChatScreen.tsx)
- [GroupStackedMessageRenderer.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/components/chat/GroupStackedMessageRenderer.tsx)

### Grouped Bubble Spacing

Message grouping is determined by `buildTimeline.ts` which sets `isGroupedWithPrevious` and `isGroupedWithNext` flags based on same-sender, same-day, within-2-minute, and no-reply conditions.

Layout tokens in [displayMode.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/chat/displayMode.ts) define spacing constants:

| Token                                | Bubble mode | Stacked mode |
| ------------------------------------ | ----------- | ------------ |
| `groupGap` (between sender groups)   | 14px        | 14px         |
| `withinGroupGap` (within same group) | 2px         | 2px          |

**Bubble mode spacing** is applied via `marginBottom` on each message container:

- Default: `marginBottom: 14` (between groups)
- Grouped with next: `marginBottom: 2` (tight within-group spacing)
- Files: `DMMessageItem.tsx` (DM), `GroupChatScreen.tsx` styles (Group)

**Stacked mode spacing** is applied via `marginTop` on feed rows:

- Group start: `marginTop: F.groupGap` (14)
- Within group: `marginTop: F.withinGroupGap` (2)
- Files: `StackedMessageRenderer.tsx`, `GroupStackedMessageRenderer.tsx`

**Timestamp visibility**: Timestamps are only rendered on the last message of a group (`isGroupEnd`). They are conditionally rendered (not hidden with opacity) to avoid phantom spacing between grouped bubbles. This applies to both DM and Group Chat bubble modes.

**Spacing ownership**: The message container owns inter-message spacing. Timestamps, sender names, avatars, and reactions add their own internal spacing only when rendered. No element contributes invisible spacing when hidden.

## Backend Contract Expectations

Core backend expectations still come from:

- [messaging.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/messaging.ts)
- [messageRequests.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/messageRequests.ts)
- [inboxTriggers.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/inboxTriggers.ts)
- [privacyPublish.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/privacyPublish.ts)

Screen-level assumptions that should remain true:

- `sendMessageV2` is authoritative for DM and group writes
- optimistic/native rows must reconcile back into `MessageV2`
- member-private watermarks remain the unread authority
- inbox aggregation docs remain derived hints, not the source of truth

## Extension Points

When adding new shared chat features, prefer this order:

1. extend `MessageV2` and backend contracts first
2. add shared helpers/components under `src/chat/` or `src/components/chat/`
3. inject scope-specific behavior from screens rather than duplicating full components
4. document whether the feature is universal, DM-only, or group-only

Good extension seams:

- `sendDraft.ts` for send orchestration
- `ChatHeader` for shared top-bar behavior
- `ChatMessageRenderer` / `GroupStackedMessageRenderer` for render behavior
- `MessageActionsSheet` for interaction affordances

## Intentional Exceptions

These are still not fully merged into the main chat surface:

- [ThreadScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/chat/ThreadScreen.tsx) remains a specialized thread-focused screen
- web still uses the Firestore-first compatibility runtime underneath `useChat`

Treat those as known exceptions, not as the pattern for new chat work.

## Migration Notes

- If you find old docs or comments mentioning a DM-only `MessageWithProfile` render pipeline, they are stale.
- If you change group typing behavior, preserve `typingAt` as the canonical field and only keep `typingExpiresAt` as temporary compatibility.
- If you need a new DM/group difference, add it at the screen-configuration layer first. Do not fork the full render pipeline unless the product behavior is genuinely different.
