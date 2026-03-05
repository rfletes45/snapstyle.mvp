# Firebase and Functions

Last verified: 2026-02-22

## Backend Topology

Configured by `firebase.json`:

- Functions source: `firebase-backend/functions`
- Firestore rules: `firebase-backend/firestore.rules`
- Firestore indexes: `firebase-backend/firestore.indexes.json`
- Realtime DB rules: `firebase-backend/database.rules.json`
- Storage rules: `firebase-backend/storage.rules`

Client bootstrap path:

- Firebase SDK init: `src/services/firebase.ts`
- Local config source: `src/services/firebaseConfig.local.ts`

## Functions Runtime and Entry

- Entry: `firebase-backend/functions/src/index.ts`
- Runtime target: Node 20 (`firebase-backend/functions/package.json`)
- Build script: `npm --prefix firebase-backend/functions run build`

Function categories in use:

- Messaging and inbox:
  - `messaging.ts`, `inboxTriggers.ts`, `messageRequests.ts`, `privacyPublish.ts`, `rateLimiter.ts`, `chatMedia.ts`
- Economy/shop/IAP/gifting:
  - `economy.ts`, `shop.ts`, `cosmeticEntitlements.ts`, `iap.ts`, `gifting.ts`, `dailyDeals.ts`
- Calls/notifications/moderation/admin/scheduled:
  - `calls.ts`, `notifications.ts`, `moderation.ts`, `admin.ts`, `scheduled*.ts`

## High-Impact Callable APIs

Messaging:

- `sendMessageV2`
- `editMessageV2`
- `deleteMessageForAllV2`
- `toggleReactionV2`
- `markInboxRead`
- `publishTypingIndicator`
- `publishReadReceipt`
- `publishDeliveryReceipt`

Economy/shop:

- `claimTaskReward`
- `purchaseWithTokens`
- `purchaseCosmeticWithTokens`
- `validateReceipt`
- `verifyIAPPurchase` (compat alias)

Requests/rate limits:

- `acceptMessageRequest`
- `declineMessageRequest`
- `getRateLimitStatus`

## Messaging Function Guarantees (Important)

`sendMessageV2` enforces key server-side safety checks:

1. Auth required and sender validated.
2. Membership validation for DM/group context.
3. Block checks for DM sends.
4. Rate limiting (global limiter path exists but rollout-gated server-side).
5. Idempotency by using `messageId` as doc ID and storing `idempotencyKey = clientId:messageId`.
6. Server-authoritative timestamps.
7. Optional staged attachment commit path (`chat-staging` -> `chat-media`).

## Firestore Contract Summary

Use `firebase-backend/firestore.rules` as the definitive contract. Important collection families:

- Identity/profile:
  - `Users/{uid}`
  - `Users/{uid}/settings/{settingId}`
  - `Users/{uid}/blockedUsers/{blockedUid}`
- Messaging:
  - `Chats/{chatId}` and `Chats/{chatId}/Messages/{messageId}`
  - `Groups/{groupId}`, `Members`, `Messages`
  - Inbox and MessageRequests related structures
- Economy and commerce:
  - `Wallets`, `Transactions`, `Tasks`, `TaskProgress`, `ShopCatalog`, purchase collections
- Calls and moderation:
  - `Calls`, `CallSignaling`, `Reports`, `Bans`, warning/admin artifacts

## Storage Contract Summary

Defined by `firebase-backend/storage.rules`. Active path families:

- DM media: `pictures/{chatId}/...`, `dm-voice/{chatId}/...`
- Story/profile media: `stories/{authorId}/...`, `avatars/{userId}/...`, `users/{userId}/profile/...`
- Group media: `groups/{groupId}/messages|attachments|voice/...`
- Messaging media pipeline:
  - Staging: `chat-staging/...`
  - Finalized media (server/signed URL path): `chat-media/...`

## Rules and Index Safety

When query/write shapes change:

1. Update client service queries.
2. Update `firestore.rules` if authorization/shape changed.
3. Update `firestore.indexes.json` for new compound query needs.
4. Build functions and run app tests before deploy.

## Build and Deploy Commands

```bash
# Build functions
npm --prefix firebase-backend/functions run build

# Deploy functions only
firebase deploy --only functions

# Deploy Firestore rules + indexes
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes

# Deploy Storage rules
firebase deploy --only storage

# Deploy all configured Firebase resources
firebase deploy
```

## Change Checklist

1. Keep client and server data contracts in sync.
2. Preserve server-authoritative writes for money, moderation, and canonical message writes.
3. Do not bypass callable guards with new direct client writes without rule analysis.
4. Update this document when exported function names, storage paths, or key collections change.
