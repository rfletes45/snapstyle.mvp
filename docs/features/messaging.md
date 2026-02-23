# Messaging System

Last verified: 2026-02-22

## Scope

This doc covers the active DM/group messaging stack, including its current hybrid migration state (SQLite local-first + Firestore fallback) and server-authoritative callable writes.

## Current Runtime Architecture

Primary chat orchestration hook:

- `src/hooks/useChat.ts`

Mode selection:

- `USE_LOCAL_STORAGE = true` (native):
  - Local data: `src/services/database/`
  - Sync engine: `src/services/sync/syncEngine.ts`
  - Hook path: `useLocalMessages`
- `USE_LOCAL_STORAGE = false` (web fallback):
  - Firestore subscription path: `useUnifiedMessages`

Because both modes are live, both are active contracts.

## Canonical Service Surface

Unified entrypoint:

- `src/services/messaging/index.ts`

Submodules:

- Send: `src/services/messaging/send.ts`
- Subscribe: `src/services/messaging/subscribe.ts`
- Member state: `src/services/messaging/memberState.ts`
- Adapters: `src/services/messaging/adapters/`

Legacy compatibility layers still in use:

- `src/services/chatV2.ts`
- `src/services/messageList.ts`
- `src/services/outbox.ts`

## Message Model Contract (V2)

Source type: `src/types/messaging.ts` (`MessageV2`).

Key fields and meanings:

- `id`: message document ID (client-generated UUID)
- `scope`: `dm` or `group`
- `conversationId`: chat/group reference
- `kind`: content type (`text`, `media`, `voice`, `file`, etc.)
- `createdAt`: client intent timestamp
- `serverReceivedAt`: authoritative ordering timestamp
- `attachments[]`: media/file payloads
- `replyTo`: frozen reply snapshot metadata
- `hiddenFor[]` and `deletedForAll`: deletion semantics
- `mentionUids` and `mentionSpans`: mention handling
- `clientId` + `idempotencyKey`: duplicate-send prevention

## Send/Edit/Delete/Reaction Pipeline

Send path:

1. UI calls `sendMessage(...)`.
2. Message enters optimistic/outbox flow.
3. `sendMessageV2` callable validates and writes.
4. Subscriptions/sync reconcile authoritative state.

Server checks in `sendMessageV2` include:

- Auth + membership validation
- Block checks (DM)
- Rate-limit checks
- Idempotent return if message already exists
- Server timestamping
- Optional staged attachment commit

Mutation callables:

- Edit: `editMessageV2`
- Delete-for-all: `deleteMessageForAllV2`
- Reactions: `toggleReactionV2`

## Read, Typing, and Delivery State

Client member-state APIs:

- `updateReadWatermark`
- `setTypingIndicator`
- `setMuted`, `setArchived`, `setNotifyLevel`

Server-side privacy-publish APIs:

- `publishTypingIndicator`
- `publishReadReceipt`
- `publishDeliveryReceipt`
- `markInboxRead`

These are part of the gradual shift to server-enforced privacy semantics.

## SQLite Local-First Contract

Local store source:

- `src/services/database/index.ts`

Core tables:

- `conversations`
- `messages`
- `attachments`
- `reactions`
- `sync_cursors`

Sync responsibilities:

- Upload pending writes
- Pull new authoritative messages
- Keep local status in sync with server state

## Chat Settings V3 Flags

`CHAT_FEATURES` in `constants/featureFlags.ts` gates rollout of:

- settings resolver v3
- signed media URLs
- staged uploads
- message requests
- global rate limiting
- inbox aggregation
- delivery acks
- server-enforced privacy publish writes

As of 2026-02-22, most V3 behavior flags are disabled and treated as staged rollout toggles.

## Critical Invariants

1. Ordering must be based on `serverReceivedAt`, not `createdAt`.
2. `messageId` reuse on retry must stay idempotent.
3. DM and group flows must both pass for every message feature.
4. Local-first mode must not regress fallback mode behavior.
5. Privacy-related member writes must respect flag and server enforcement paths.

## Change Checklist

1. If adding/changing message fields, update:
   - `src/types/messaging.ts`
   - SQLite schema + mappers (`src/services/database/`)
   - callable validation/writes (`firebase-backend/functions/src/messaging.ts`)
2. Validate both storage modes (`USE_LOCAL_STORAGE` true/false).
3. Validate DM + group behavior separately.
4. Run tests in `docs/operations/testing.md` relevant to messaging and backend.
5. Update this document if contract fields, callables, or rollout defaults change.
