# Chat System V3 — Comprehensive Documentation

> **Status:** All 10 segments implemented, feature-flagged (default OFF).  
> **Last Updated:** June 2025  
> **Supersedes:** [03_CHAT_V2.md](./03_CHAT_V2.md)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Feature Flags](#feature-flags)
4. [Segment 1 — Settings V3](#segment-1--settings-v3)
5. [Segment 2 — Delivery Acks](#segment-2--delivery-acks)
6. [Segment 3 — Staged Media Pipeline](#segment-3--staged-media-pipeline)
7. [Segment 4 — Inbox Scaling](#segment-4--inbox-scaling)
8. [Segment 5 — Message Requests](#segment-5--message-requests)
9. [Segment 6 — Global Rate Limiting](#segment-6--global-rate-limiting)
10. [Segment 7 — Privacy Server Enforcement](#segment-7--privacy-server-enforcement)
11. [Segment 8 — Error Taxonomy & Debug HUD](#segment-8--error-taxonomy--debug-hud)
12. [Segment 9 — Group Features & Settings](#segment-9--group-features--settings)
13. [Segment 10 — Tests & Cleanup](#segment-10--tests--cleanup)
14. [Data Model Reference](#data-model-reference)
15. [Migration & Rollout Guide](#migration--rollout-guide)
16. [Troubleshooting](#troubleshooting)

---

## Overview

Chat V3 is a 10-segment incremental improvement plan built on top of the existing Chat V2 (outbox → Cloud Function → Firestore) architecture. Each segment is independently feature-flagged and defaults to OFF, enabling safe rollout.

### Key Principles

- **No breaking changes** — V1/V2 code paths remain intact.
- **Feature flags gate every code path** — toggle in `constants/featureFlags.ts` or server-side constants.
- **Server-authoritative** — enforcement always happens in Cloud Functions; the client is advisory only.
- **Idempotent writes** — `sendMessageV2` uses `messageId` deduplication.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      React Native Client                  │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌─────────┐ │
│  │ Composer  │→│  Outbox   │→│  chatV2.ts │→│ Firebase │ │
│  │          │  │ (staged)  │  │ (callable) │  │  SDK    │ │
│  └──────────┘  └──────────┘  └───────────┘  └─────────┘ │
│       │              │                            │       │
│  ┌────┴────┐  ┌──────┴──────┐              ┌─────┴─────┐ │
│  │Settings │  │stagedUpload │              │ Firestore  │ │
│  │Resolver │  │signedMedia  │              │  Listener  │ │
│  └─────────┘  └─────────────┘              └───────────┘ │
└──────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│                    Cloud Functions                         │
│                                                           │
│  sendMessageV2 ──→ validate ──→ membership ──→ group     │
│                         │         settings ──→ block      │
│                         │         check ────→ rate limit  │
│                         │                  ──→ write msg  │
│                         │                                 │
│  chatMedia ────→ commitStagedAttachments                  │
│              ──→ mintChatMediaUrl                         │
│              ──→ cleanupStagingOrphans                    │
│                                                           │
│  inboxTriggers → onDMMessageInbox / onGroupMessageInbox  │
│  messageRequests → checkDmAcceptance / accept / decline   │
│  rateLimiter ──→ checkGlobalRateLimit / getRateLimitStatus│
│  privacyPublish → typing / delivery / read callables      │
│               ──→ onChatSettingsChanged trigger            │
│               ──→ onInboxSettingsChanged trigger           │
└──────────────────────────────────────────────────────────┘
```

---

## Feature Flags

### Client-side (`constants/featureFlags.ts`)

| Flag                           | Segment | Default   | Purpose                                    |
| ------------------------------ | ------- | --------- | ------------------------------------------ |
| `CHAT_SETTINGS_V3`             | S1      | `false`   | Settings V3 resolver + per-chat overrides  |
| `CHAT_DELIVERY_ACKS`           | S2      | `false`   | Delivery watermarks in read receipts       |
| `CHAT_SIGNED_MEDIA_URLS`       | S3      | `false`   | Signed URL viewing via `mintChatMediaUrl`  |
| `CHAT_STAGED_UPLOADS`          | S3      | `false`   | Client-side staged upload pipeline         |
| `CHAT_INBOX_AGGREGATION`       | S4      | `false`   | Per-user Inbox subcollection subscriptions |
| `CHAT_MESSAGE_REQUESTS`        | S5      | `false`   | Message request UI and hooks               |
| `CHAT_GLOBAL_RATE_LIMIT`       | S6      | `false`   | Client-side rate limit budget display      |
| `CHAT_PRIVACY_SERVER_ENFORCED` | S7      | `false`   | Route typing/read/delivery through server  |
| `CHAT_DEBUG_HUD`               | S8      | `__DEV__` | Dev-only debug overlay                     |

### Server-side (in respective Cloud Function files)

| Flag                                | Segment | File                | Default |
| ----------------------------------- | ------- | ------------------- | ------- |
| `ENABLE_GLOBAL_RATE_LIMIT`          | S6      | `messaging.ts`      | `false` |
| `ENABLE_PRIVACY_SERVER_ENFORCED`    | S7      | `privacyPublish.ts` | `false` |
| `ENABLE_GROUP_SETTINGS_ENFORCEMENT` | S9      | `messaging.ts`      | `false` |

---

## Segment 1 — Settings V3

### Files

| File                                            | Role                                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/services/messaging/resolveChatSettings.ts` | Pure resolver function                                                                      |
| `src/types/messaging.ts`                        | `ChatSettingsV3`, `EffectiveChatSettings`, `PerChatPrivacyOverrides`, `GroupSettings` types |

### How It Works

Three-level precedence resolution:

```
per-chat override  →  global V3 setting  →  default fallback
```

1. **`resolveEffectiveChatSettings(input)`** — takes optional `inboxSettings`, `chatSettingsV3`, `perChatOverrides`, and `groupSettings`. Returns an `EffectiveChatSettings` object with 7 resolved boolean/string fields.
2. **`resolveTriState(override, globalValue)`** — maps `"inherit"` → global, `"on"` → true, `"off"` → false.
3. When `CHAT_SETTINGS_V3` is OFF, the resolver falls back to mapping legacy `InboxSettings` fields to the effective shape.
4. **`resolveFromInboxSettings()`** — convenience wrapper for existing code.

### Types

```typescript
interface ChatSettingsV3 {
  dmAcceptance: "everyone" | "friends_only" | "requests";
  notificationPreview: "full" | "sender_only" | "generic";
  autoDownloadMedia: "never" | "wifi" | "always";
  publishReadReceipts: boolean;
  publishDeliveryReceipts: boolean;
  publishTyping: boolean;
  publishOnlineStatus: boolean;
  publishLastSeen: boolean;
}

interface PerChatPrivacyOverrides {
  readReceipts?: "inherit" | "on" | "off";
  deliveryReceipts?: "inherit" | "on" | "off";
  typingIndicators?: "inherit" | "on" | "off";
  notificationPreview?: "inherit" | "full" | "sender_only" | "generic";
  autoDownloadMedia?: "inherit" | "never" | "wifi" | "always";
}

interface EffectiveChatSettings {
  publishReadReceipts: boolean;
  publishDeliveryReceipts: boolean;
  publishTyping: boolean;
  publishOnlineStatus: boolean;
  publishLastSeen: boolean;
  notificationPreview: NotificationPreview;
  autoDownloadMedia: AutoDownloadMedia;
}
```

---

## Segment 2 — Delivery Acks

### Files

| File                           | Role                                                             |
| ------------------------------ | ---------------------------------------------------------------- |
| `src/hooks/useReadReceipts.ts` | Subscribes to delivery watermark when `CHAT_DELIVERY_ACKS` is ON |
| `src/services/chatMembers.ts`  | `updateDeliveryWatermark()`, `subscribeToDeliveryReceipt()`      |
| `src/types/messaging.ts`       | `MemberStatePublic.lastDeliveredAtPublic`                        |

### How It Works

When `CHAT_DELIVERY_ACKS` is enabled:

1. Client writes `lastDeliveredAtPublic` to `Chats/{chatId}/Members/{uid}` or `Groups/{groupId}/Members/{uid}`.
2. `subscribeToDeliveryReceipt(chatId, uid)` subscribes to the other user's delivery watermark.
3. `useReadReceipts` hook integrates both read and delivery watermarks, providing `isMessageDelivered()` and `getMessageStatus()` → `"sent" | "delivered" | "read"`.

### Firestore Path

```
Chats/{chatId}/Members/{uid}/lastDeliveredAtPublic: number
Groups/{groupId}/Members/{uid}/lastDeliveredAtPublic: number
```

---

## Segment 3 — Staged Media Pipeline

### Files

| File                                          | Role                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `firebase-backend/functions/src/chatMedia.ts` | `commitStagedAttachments()`, `mintChatMediaUrl` callable, `cleanupStagingOrphans` scheduled |
| `src/services/messaging/stagedUpload.ts`      | `uploadToStaging()`, path helpers                                                           |
| `src/services/messaging/signedMediaCache.ts`  | In-memory signed URL cache                                                                  |

### How It Works

**Upload Flow (Staging):**

1. Client calls `uploadToStaging(conversationId, file)` → writes to `chat-staging/{conversationId}/{uuid}/{filename}`.
2. `sendMessageV2` receives `stagedAttachments[]` → server calls `commitStagedAttachments()`.
3. `commitStagedAttachments()` validates count (≤10), size (≤25MB each), MIME type, copies files from staging to final path, strips download tokens, returns committed attachment metadata.
4. Staging files are deleted after copy.

**Viewing Flow (Signed URLs):**

1. Client calls `mintChatMediaUrl({ path, variant })` callable.
2. Server validates membership, generates signed URL with 5-min TTL.
3. Client caches the URL via `signedMediaCache.ts` (30s early expiry buffer, request dedup).

**Cleanup:**

- `cleanupStagingOrphans` runs every 6 hours, deletes staging objects older than 6 hours.

### Allowed MIME Types

`image/jpeg`, `image/png`, `image/gif`, `image/webp`, `video/mp4`, `video/quicktime`, `audio/aac`, `audio/m4a`, `audio/mpeg`, `application/pdf`.

---

## Segment 4 — Inbox Scaling

### Files

| File                                              | Role                                                    |
| ------------------------------------------------- | ------------------------------------------------------- |
| `firebase-backend/functions/src/inboxTriggers.ts` | Firestore triggers for DM/group messages → Inbox update |
| `src/hooks/useInboxAggregation.ts`                | Client hook for inbox subscription                      |

### How It Works

**Server Side:**

- `onDMMessageInbox` — Firestore trigger on `Chats/{chatId}/Messages/{messageId}`. Updates both participants' `Users/{uid}/Inbox/dm:{chatId}`.
- `onGroupMessageInbox` — Firestore trigger on `Groups/{groupId}/Messages/{messageId}`. Updates all group members' inbox (batched at 450 per write batch).
- `markInboxRead` — callable that resets `unreadCount` to 0.

**Client Side:**

- `useInboxAggregation(uid)` — subscribes to `Users/{uid}/Inbox` ordered by `lastActivityAt desc`.
- Provides filtering: all/dms/groups/unread.
- Separates pinned vs. regular conversations.
- Computes `totalUnread` across all entries.

### Inbox Document Schema

```typescript
interface InboxEntry {
  id: string; // "dm:{chatId}" or "group:{groupId}"
  scope: "dm" | "group";
  conversationId: string;
  lastMessage: string;
  lastMessageKind: string;
  lastMessageSenderId: string;
  lastMessageSenderName: string;
  lastActivityAt: number;
  unreadCount: number;
  pinned?: boolean;
  archived?: boolean;
  muted?: boolean;
}
```

---

## Segment 5 — Message Requests

### Files

| File                                                | Role                                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| `firebase-backend/functions/src/messageRequests.ts` | `checkDmAcceptance()`, `acceptMessageRequest`, `declineMessageRequest` callables |
| `src/hooks/useMessageRequests.ts`                   | Client hook for pending requests                                                 |

### How It Works

1. `sendMessageV2` calls `checkDmAcceptance(senderId, recipientUid, chatId, preview, kind)`.
2. If `dmAcceptance === "everyone"` → allowed.
3. If friends (via `Friends` collection) → allowed regardless of setting.
4. If `"friends_only"` and not friends → rejected.
5. If `"requests"` and not friends → creates `MessageRequest` doc under recipient, returns `"request_created"`.
6. `sendMessageV2` returns `{ messageRequestCreated: true }` to the client.
7. Recipient uses `useMessageRequests` to see pending requests and call `accept`/`decline`.
8. Decline optionally blocks the requester.

### MessageRequest Document

```
Users/{recipientUid}/MessageRequests/{chatId}
```

```typescript
interface MessageRequest {
  chatId: string;
  requesterId: string;
  requesterName: string;
  requesterAvatarConfig: object | null;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
  resolvedAt?: number;
  messagePreview: string;
  messageKind: string;
}
```

---

## Segment 6 — Global Rate Limiting

### Files

| File                                            | Role                                                    |
| ----------------------------------------------- | ------------------------------------------------------- |
| `firebase-backend/functions/src/rateLimiter.ts` | `checkGlobalRateLimit()`, `getRateLimitStatus` callable |
| `firebase-backend/functions/src/messaging.ts`   | `ENABLE_GLOBAL_RATE_LIMIT` server flag                  |

### How It Works

- **Collection:** `RateLimits/globalChat_{uid}`
- **Design:** Fixed-window buckets (1-minute windows), 3 buckets deep.
- **Limit:** 60 messages per user per window.
- **Transaction:** Atomic read-check-write via Firestore transaction.
- **Fail-open:** On error, the rate limiter allows the message through.
- **Pruning:** Old buckets beyond the window are removed on each check.

### Rate Limit Response

```typescript
interface GlobalRateLimitResult {
  allowed: boolean;
  remaining: number;
  windowSeconds: number;
  retryAfterSeconds?: number;
}
```

When `ENABLE_GLOBAL_RATE_LIMIT` is `false`, the legacy per-conversation `checkRateLimit()` is used instead.

---

## Segment 7 — Privacy Server Enforcement

### Files

| File                                               | Role                                         |
| -------------------------------------------------- | -------------------------------------------- |
| `firebase-backend/functions/src/privacyPublish.ts` | Server callables + Firestore triggers        |
| `src/services/chatMembers.ts`                      | Client-side routing through server callables |
| `src/services/presence.ts`                         | Status visibility queries                    |
| `firebase-backend/database.rules.json`             | RTDB rules for `/statusVisibility`           |

### Server Callables

| Callable                 | Purpose                                                                           |
| ------------------------ | --------------------------------------------------------------------------------- |
| `publishTypingIndicator` | Writes `typingAt` to Members doc after settings check                             |
| `publishDeliveryReceipt` | Writes `lastDeliveredAtPublic` after settings check                               |
| `publishReadReceipt`     | Writes `lastReadAtPublic` after settings check; always writes `lastSeenAtPrivate` |

Each callable:

1. Validates auth + membership.
2. Loads effective settings (3-level resolver duplicated server-side).
3. If the relevant publish flag is OFF → returns `{ written: false }` (silent no-op).
4. If ON → writes timestamp to `Members/{uid}` doc → returns `{ written: true }`.

### Firestore Triggers

| Trigger                  | Purpose                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `onChatSettingsChanged`  | Mirrors `publishOnlineStatus` + `publishLastSeen` to RTDB `/statusVisibility/{uid}` |
| `onInboxSettingsChanged` | Same mirroring for legacy inbox settings                                            |

### Client Integration

When `CHAT_PRIVACY_SERVER_ENFORCED` is ON:

- `updateTypingIndicator()` calls `publishTypingIndicator` callable instead of direct Firestore write.
- `updateReadWatermark()` calls `publishReadReceipt` callable.
- `updateDeliveryWatermark()` calls `publishDeliveryReceipt` callable.

### RTDB Status Visibility

```json
{
  "statusVisibility": {
    "{uid}": {
      "onlineStatus": true,
      "lastSeen": true
    }
  }
}
```

`getStatusVisibility(uid)` and `subscribeToStatusVisibility(uid)` read from this path.

---

## Segment 8 — Error Taxonomy & Debug HUD

### Files

| File                                   | Role                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `src/types/messaging.ts`               | `ChatErrorCode` enum, `ChatError`, `classifyChatError()`, `generateTraceId()`    |
| `src/services/outbox.ts`               | Attaches `traceId` on enqueue, classifies errors with `ChatErrorCode` on failure |
| `src/services/chatV2.ts`               | Passes `traceId` through `SendMessageV2Params`                                   |
| `src/hooks/useChatDebugInfo.ts`        | Debug info aggregation hook                                                      |
| `src/components/chat/ChatDebugHUD.tsx` | Dev-only debug overlay component                                                 |

### Error Codes

```typescript
enum ChatErrorCode {
  UNKNOWN = "unknown",
  NETWORK_OFFLINE = "network_offline",
  RATE_LIMITED = "rate_limited",
  NOT_MEMBER = "not_member",
  BLOCKED = "blocked",
  INVALID_CONTENT = "invalid_content",
  ATTACHMENT_TOO_LARGE = "attachment_too_large",
  SERVER_ERROR = "server_error",
  AUTH_EXPIRED = "auth_expired",
  MESSAGE_REQUEST_PENDING = "message_request_pending",
}
```

### Trace IDs

- Format: `"trace_{timestamp}_{random}"`.
- Generated by `generateTraceId()` when a message enters the outbox.
- Attached to the Cloud Function call via `traceId` parameter.
- Logged server-side for correlation.
- `classifyChatError(error)` maps Firebase error codes to `ChatErrorCode` for UI display.

### Debug HUD

The `ChatDebugHUD` component (visible only when `CHAT_DEBUG_HUD` is `true`, defaults to `__DEV__`) displays:

- Conversation ID, scope, member count.
- Read/delivery watermarks.
- Effective settings snapshot.
- Outbox queue: pending, sending, failed counts.
- Recent trace IDs with error codes.
- Feature flag status for all `CHAT_FEATURES`.
- Network connection state.

---

## Segment 9 — Group Features & Settings

### Files

| File                                          | Role                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| `firebase-backend/functions/src/messaging.ts` | `enforceGroupSettings()`, helpers, `ENABLE_GROUP_SETTINGS_ENFORCEMENT` flag |
| `src/types/messaging.ts`                      | `GroupSettings` interface                                                   |
| `firebase-backend/firestore.indexes.json`     | Composite index for slow-mode query                                         |

### Group Settings

```typescript
interface GroupSettings {
  slowModeSeconds?: number; // 0 = off
  announcementOnly?: boolean; // true = admins only can send
  allowMediaFromMembers?: boolean; // false = only admins send media
  allowMentionsAll?: boolean; // false = only admins can @all
  retentionMode?: "standard" | "ephemeral_client_only";
}
```

Stored at `Groups/{groupId}.settings`.

### Enforcement Flow

In `sendMessageV2`, after the membership check (step 3) and before the block check (step 4):

```
3b. Group settings enforcement
    scope === "group" → enforceGroupSettings(groupId, senderId, kind, mentionUids)
```

`enforceGroupSettings()` no-ops when `ENABLE_GROUP_SETTINGS_ENFORCEMENT` is `false`.

When enabled, it performs 4 checks (admins/owners bypass all):

| #   | Check                                                                             | Error Code           | HTTP Status |
| --- | --------------------------------------------------------------------------------- | -------------------- | ----------- |
| 1   | **Announcement-only** — non-admins blocked from all sends                         | `permission-denied`  | 403         |
| 2   | **Slow mode** — minimum gap between messages per user                             | `resource-exhausted` | 429         |
| 3   | **Media permissions** — non-admins blocked from media/voice/file                  | `permission-denied`  | 403         |
| 4   | **@mention all** — non-admins blocked from "all"/"@all"/"everyone" in mentionUids | `permission-denied`  | 403         |

### Admin Detection

`isGroupAdminOrOwner(groupId, uid)` checks:

1. `Groups/{groupId}.createdBy === uid` (owner check).
2. `Groups/{groupId}/Members/{uid}.role` is `"admin"` or `"owner"`.

### Slow Mode Query

```
Groups/{groupId}/Messages
  .where("senderId", "==", uid)
  .orderBy("serverReceivedAt", "desc")
  .limit(1)
```

Requires composite index: `senderId ASC + serverReceivedAt DESC` on `Messages` collection group (added to `firestore.indexes.json`).

### Retention Mode

`retentionMode` is **documented only** — no server enforcement in this segment.

| Value                     | Semantics                                                                                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `"standard"`              | Normal message history. Search, pins, and full history work as usual.                                                                                                                                                                |
| `"ephemeral_client_only"` | Clients should auto-expire local messages after a configurable TTL. Server does NOT delete; it simply skips full-text search indexing and disables pinning. A future segment may add server-side TTL via a scheduled Cloud Function. |

---

## Segment 10 — Tests & Cleanup

### Test Coverage

Tests cover all major server functions and client services:

| Test File                                              | Coverage                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `__tests__/services/sendMessageV2.test.ts`             | Group settings enforcement flow in `sendMessageV2`                             |
| `__tests__/services/messageRequests.test.ts`           | `checkDmAcceptance`, `acceptMessageRequest`, `declineMessageRequest`           |
| `__tests__/services/rateLimiter.test.ts`               | Global rate limit: allow, block, prune, fail-open                              |
| `__tests__/services/privacyPublish.test.ts`            | Privacy callables: settings enforcement, membership check, no-op when disabled |
| `__tests__/services/resolveChatSettings.test.ts`       | Settings V3 resolver: 3-level precedence, TriState, legacy fallback            |
| `__tests__/services/outboxErrorClassification.test.ts` | Error classification and trace ID generation                                   |

### Safe Cleanup Guidance

**DO NOT delete any V1/V2 code at this stage.** All old paths remain as fallbacks.

When ready for V2 deprecation (future milestone):

1. Enable all feature flags in staging.
2. Monitor for errors / regressions for 2 weeks.
3. Add deprecation log warnings to V1 paths.
4. After 30 days of zero V1 traffic, remove dead paths.

**Files that will be candidates for cleanup (NOT NOW):**

- Legacy `checkRateLimit()` in `messaging.ts` (replaced by `checkGlobalRateLimit`).
- Direct Firestore writes in `chatMembers.ts` (replaced by server callables in S7).
- `InboxSettings` mapping code in `resolveChatSettings.ts` (replaced by `ChatSettingsV3`).

---

## Data Model Reference

### Firestore Collections

```
Users/{uid}/
  ├── settings/inbox              — InboxSettings (legacy)
  ├── settings/chatSettings       — ChatSettingsV3 (S1)
  ├── Inbox/{entryId}             — InboxEntry (S4)
  ├── MessageRequests/{chatId}    — MessageRequest (S5)
  └── blockedUsers/{otherUid}     — Block entry

Chats/{chatId}/
  ├── members: string[]           — DM participant UIDs
  ├── Messages/{messageId}        — MessageV2
  ├── Members/{uid}/              — MemberStatePublic
  │     ├── lastReadAtPublic
  │     ├── lastDeliveredAtPublic  — (S2)
  │     └── typingAt
  └── MembersPrivate/{uid}/       — MemberStatePrivate
        ├── lastSeenAtPrivate
        └── privacyOverrides      — PerChatPrivacyOverrides (S1)

Groups/{groupId}/
  ├── createdBy: string
  ├── settings: GroupSettings     — (S9)
  ├── Messages/{messageId}        — MessageV2
  └── Members/{uid}/
        ├── role: "member"|"admin"|"owner"
        ├── lastReadAtPublic
        ├── lastDeliveredAtPublic
        └── typingAt

RateLimits/globalChat_{uid}      — Rate limit buckets (S6)
```

### RTDB Paths

```
/presence/{uid}/
  ├── online: boolean
  └── lastSeen: number

/statusVisibility/{uid}/          — (S7)
  ├── onlineStatus: boolean
  └── lastSeen: boolean
```

---

## Migration & Rollout Guide

### Recommended Rollout Order

```
S1 (Settings V3)  →  S2 (Delivery Acks)  →  S7 (Privacy)
         ↓
S3 (Media Pipeline)  →  S6 (Rate Limit)  →  S9 (Group Features)
         ↓
S4 (Inbox)  →  S5 (Message Requests)
         ↓
S8 (Debug HUD — dev only, already ON)
```

### Per-Segment Rollout Steps

1. **Deploy Cloud Functions** with server flags still OFF.
2. **Enable client flag** in `featureFlags.ts`.
3. Monitor errors in Debug HUD / Crashlytics for 48h.
4. **Enable server flag** (where applicable).
5. Confirm in production for 1 week before next segment.

### Firestore Indexes Required

Before enabling S9 (Group Features), deploy:

```json
{
  "collectionGroup": "Messages",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "senderId", "order": "ASCENDING" },
    { "fieldPath": "serverReceivedAt", "order": "DESCENDING" }
  ]
}
```

This index is already defined in `firestore.indexes.json`.

---

## Troubleshooting

### Common Issues

| Symptom                            | Cause                                                         | Fix                                                      |
| ---------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| Settings resolver returns defaults | `CHAT_SETTINGS_V3` flag is OFF                                | Enable the flag                                          |
| Delivery watermarks not updating   | `CHAT_DELIVERY_ACKS` flag is OFF                              | Enable the flag                                          |
| Media uploads fail                 | Staging path permissions                                      | Check Storage rules for `chat-staging/` prefix           |
| Inbox not showing messages         | `CHAT_INBOX_AGGREGATION` flag is OFF or triggers not deployed | Deploy `inboxTriggers` and enable flag                   |
| Message request UI empty           | `CHAT_MESSAGE_REQUESTS` flag is OFF                           | Enable flag; ensure `messageRequests` functions deployed |
| Rate limit errors (unexpected)     | `ENABLE_GLOBAL_RATE_LIMIT` is ON with low window              | Check `RateLimits/globalChat_{uid}` doc                  |
| Privacy writes silently no-op      | `ENABLE_PRIVACY_SERVER_ENFORCED` is OFF                       | Enable server flag after deploying `privacyPublish`      |
| Group enforcement not working      | `ENABLE_GROUP_SETTINGS_ENFORCEMENT` is OFF                    | Enable server flag; ensure composite index deployed      |
| Debug HUD not visible              | Not in `__DEV__` mode or `CHAT_DEBUG_HUD` is false            | Only shows in dev builds by default                      |
| Slow mode not enforcing            | Missing Firestore index                                       | Deploy `firestore.indexes.json`                          |

### Debug Checklist

1. Open Debug HUD (shake gesture or dev menu).
2. Check feature flag status panel.
3. Check trace ID of failed message — correlate with Cloud Function logs.
4. Check `ChatErrorCode` on failed outbox items.
5. Verify Firestore rules allow the write path.
6. Check RTDB `/statusVisibility/{uid}` for privacy mirroring.
