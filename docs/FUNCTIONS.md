# Cloud Functions Contract

Last updated: 2026-02-18 (Segment 7)

## Source of Truth

- Deployment entrypoint: `firebase-backend/functions/src/index.ts`
- A function is deployed only if it is exported from `index.ts`.
- Several modules (`admin.ts`, `economy.ts`, `leaderboards.ts`, `moderation.ts`, `notifications.ts`, `scheduled.ts`, `scheduledMessages.ts`, `social.ts`) currently re-export implementations from `legacy.ts`.

## Deployed Function Inventory

### Callable APIs (`functions.https.onCall`)

| Functions | Purpose | Inputs | Output | Auth requirement | Primary data paths |
| --- | --- | --- | --- | --- | --- |
| `sendMessageV2`, `editMessageV2`, `deleteMessageForAllV2`, `toggleReactionV2` | Chat send/edit/delete/reaction operations with server-side validation. | Message payloads (chat/group IDs, message IDs, client IDs, text/reactions). | `{ success, ... }` or `HttpsError`. | Authenticated user (`context.auth`). | `Chats/*/Messages`, `Groups/*/Messages`, `Members`, `Reactions`, `RateLimits`, `Users/*/blockedUsers`. |
| `acceptMessageRequest`, `declineMessageRequest` | Accept/decline inbound message requests and update relationship gating state. | Request ID and target conversation metadata. | `{ success, ... }` or `HttpsError`. | Authenticated user. | `MessageRequests`, `Friends`, `Users/*/settings/chatSettings`, `Users/*/settings/inbox`. |
| `publishTypingIndicator`, `publishDeliveryReceipt`, `publishReadReceipt` | Publish privacy-gated presence/read events into member docs. | Chat/group ID + receipt/typing payload. | `{ success }` or `HttpsError`. | Authenticated user. | `Chats/*/Members`, `Groups/*/Members`, `Users/*/settings/chatSettings`, `Users/*/settings/inbox`. |
| `markInboxRead` | Mark a DM/group thread as read in inbox aggregation. | `threadId`, `threadType`. | `{ success }` or `HttpsError`. | Authenticated user. | `Users/*/Inbox`. |
| `mintChatMediaUrl` | Mint upload URL/token for staged chat media. | Message target metadata and file descriptors. | Signed upload details or `HttpsError`. | Authenticated user. | `Chats`, `Groups`, `Members` (+ Storage staging path). |
| `makeMove`, `resignGame` | Turn-based game move and resignation operations. | `gameId`, move/resign payload. | Updated game status or `HttpsError`. | Authenticated user. | `TurnBasedGames`, `Moves`, `PlayerGameStats`, `LeaderboardStats`. |
| `getTurnCredentials` | Generate TURN credentials for active call session media relay. | Call/session identifiers. | ICE/TURN credentials or `HttpsError`. | Authenticated user. | `Calls`, `Users`. |
| `sendGift`, `openGift`, `getGiftHistory` | Gift send/open/history operations in economy subsystem. | Gift payload or paging params. | Gift state/history objects or `HttpsError`. | Authenticated user. | `Gifts`, `PremiumProducts`, `Users/*/inventory`, `Users/*/wallet|tokens`. |
| `validateReceipt`, `restorePurchases`, `getPurchaseHistory` | IAP receipt validation and restoration flow. | Platform receipt + purchase metadata. | Verification/restoration payload or `HttpsError`. | Authenticated user. | `IAPPurchases`, `Inventory`, `StoreProducts`, `PremiumProducts`, `Wallets`. |
| `purchaseWithTokens`, `grantItem` | Token shop purchase/grant operations. | Item/grant payload. | Purchase/grant result or `HttpsError`. | Authenticated user (`grantItem` is elevated flow in code path). | `PointsShopCatalog`, `Wallets`, `Users/*/inventory`, `Users/*/purchases`. |
| `fetchLinkPreview` | Resolve and cache URL preview metadata for chat. | URL + optional rendering hints. | Preview metadata or `HttpsError`. | Authenticated user. | `LinkPreviews`. |
| `getRateLimitStatus` | Read user-global limiter status for diagnostics/UI backoff. | Optional action key/context. | `{ allowed, remaining, resetAt, ... }`. | Authenticated user. | `RateLimits`. |
| `triggerDailyDeals` | Manual trigger for daily-deal generation. | Optional force flags. | Trigger status. | Authenticated user (operational endpoint). | `DailyDeals`, `WeeklyDeals`, `PointsShopCatalog`. |
| `claimTaskReward`, `recordDailyLogin` | Task reward claiming + login progression. | Task/login payload. | Reward/progress payload. | Authenticated user. | `Tasks`, `TaskProgress`, `Wallets`, `Transactions`, `Users`. |
| `sendFriendRequestWithRateLimit`, `checkMessageRateLimit` | Social/message abuse protection checks. | Friend/message rate-limit payload. | Allow/deny payload or `HttpsError`. | Authenticated user. | `RateLimits`, `FriendRequests`, `Users`. |
| `adminSetBan`, `adminLiftBan`, `adminApplyStrike`, `adminApplyWarning`, `adminResolveReport`, `adminSetAdminClaim` | Moderation/admin mutation endpoints. | Admin action payload. | Moderation operation result. | Authenticated user with admin claim checks in function logic. | `Bans`, `UserStrikes`, `UserWarnings`, `Reports`, `Users`. |

### Firestore Triggers (`functions.firestore.document(...).on*`)

| Functions | Trigger path(s) | Purpose | Auth requirement | Primary data paths touched |
| --- | --- | --- | --- | --- |
| `onDMMessageInbox`, `onGroupMessageInbox` | `Chats/{chatId}/Messages/{messageId}` create; `Groups/{groupId}/Messages/{messageId}` create | Maintain per-user inbox aggregate docs. | Trigger context (no caller auth). | `Users/*/Inbox`, `Groups/*/Members`. |
| `onCallCreated`, `onCallUpdated` | `Calls/{callId}` create/update | Call lifecycle fanout and signaling cleanup state updates. | Trigger context. | `Calls`, `CallHistory`, `Users`. |
| `createGameFromInvite`, `onUniversalInviteUpdate`, `processGameCompletion`, `onGameCompletedCreateHistory`, `onGameHistoryCreatedUpdateLeaderboard` | `GameInvites/{inviteId}` create/update; game session updates; `GameHistory/{historyId}` create | Multiplayer invite lifecycle, completion processing, history+leaderboard updates. | Trigger context. | `GameInvites`, `TurnBasedGames`, `RealtimeGameSessions`, `GameHistory`, `LeaderboardStats`, `PlayerGameStats`. |
| `onChatSettingsChanged`, `onInboxSettingsChanged` | `Users/{uid}/settings/chatSettings` update; `Users/{uid}/settings/inbox` update | Reconcile privacy settings into active chat/group member visibility. | Trigger context. | `Users/*/settings`, `Chats/*/Members`, `Groups/*/Members`. |
| `onNewMessage`, `onNewGroupMessageV2`, `onNewFriendRequest`, `onStoryViewed`, `onDeleteMessage` | Message/friend/story paths in legacy wrappers | Push notifications, story-view side effects, and cleanup hooks. | Trigger context. | `Chats`, `Groups`, `FriendRequests`, `stories`, Storage-linked message paths. |
| `onUserCreated`, `onMessageSentTaskProgress`, `onStoryViewedTaskProgress`, `onStoryPostedTaskProgress`, `onGamePlayedTaskProgress`, `onFriendAddedTaskProgress` | User/message/story/game/friend event docs | Economy/task progression and wallet initialization hooks. | Trigger context. | `Users`, `Tasks`, `TaskProgress`, `Wallets`, `Transactions`, `Friends`. |
| `onGameSessionCreated`, `onStreakAchievementCheck`, `onNewMessageEvent`, `onNewReport`, `onScheduledMessageCreated` | Game session/friend/report/scheduled-message paths | Leaderboard updates, moderation event fanout, scheduled-message indexing. | Trigger context. | `GameSessions`, `Leaderboards`, `Reports`, `ScheduledMessages`, event collections. |

### Scheduled / PubSub Jobs (`functions.pubsub.schedule(...)`)

| Functions | Purpose | Auth requirement | Primary data paths touched |
| --- | --- | --- | --- |
| `generateDailyDeals`, `generateWeeklyDeals`, `cleanupOldDeals` | Deal generation and stale-deal cleanup. | Scheduler/service account. | `DailyDeals`, `WeeklyDeals`, `PointsShopCatalog`. |
| `handleCallTimeouts`, `cleanupCallSignaling` | Expire stale call sessions/signaling artifacts. | Scheduler/service account. | `Calls`, `CallHistory`. |
| `processMatchmakingQueue`, `expireGameInvites`, `expireMatchmakingEntries`, `cleanupOldGames`, `cleanupResolvedInvites`, `cleanupStaleMatchmakingEntries`, `cleanupVacantGames`, `cleanupOldGameSessions` | Matchmaking queue processing and stale game/invite cleanup. | Scheduler/service account. | `MatchmakingQueue`, `GameInvites`, `TurnBasedGames`, `RealtimeGameSessions`, `GameHistory`. |
| `expireGifts` | Expire unclaimed gifts. | Scheduler/service account. | `Gifts`. |
| `cleanupStagingOrphans` | Remove orphaned staged media uploads. | Scheduler/service account. | Chat media staging docs + Storage staging paths. |
| `streakReminder`, `cleanupExpiredSnaps`, `cleanupExpiredStories`, `cleanupOldScheduledMessages`, `processScheduledMessages`, `cleanupExpiredPushTokens`, `updateExpiredBans`, `weeklyLeaderboardReset` | Legacy scheduled maintenance jobs. | Scheduler/service account. | `stories`, `ScheduledMessages`, push-token fields, `Bans`, `Leaderboards`. |

### HTTP Request Endpoints (`functions.https.onRequest`)

| Functions | Purpose | Auth / access control in current code | Primary data paths touched |
| --- | --- | --- | --- |
| `migrateGameInvites`, `migrateGameInvitesDryRun`, `rollbackGameInvitesMigration` | Universal invite migration utilities. | No Firebase auth middleware; rollback requires `?confirm=YES_ROLLBACK`. Intended operational use only. | `GameInvites`. |
| `seedDailyTasks` | Seed default task catalog. | No enforced auth check (comment notes it should be protected/removed in production). | `Tasks`. |
| `initializeExistingWallets` | Backfill wallet docs for existing users. | No enforced auth check (comment marks as admin utility). | `Users`, `Wallets`, `Transactions`. |
| `seedShopCatalog` | Seed shop catalog docs. | No enforced auth check (comment marks as admin utility). | `ShopCatalog`. |
| `initializeFirstAdmin` | Bootstrap first admin claim for a UID. | Requires POST + `secretKey` (env `ADMIN_SETUP_KEY` fallback). | Firebase Auth custom claims + `Users`. |

## Non-deployed / Deprecated Candidates (Segment 7)

These functions exist in source but are intentionally not exported from `index.ts` and are therefore not deployed:

- `registerVoIPToken`
- `sendCallNotification`
- `cancelCall`
- `onGroupCallInviteCreated`
- `onGroupCallParticipantJoined`
- `onGroupCallHostAction`
- `cleanupStaleActiveInvites`

Proof of no active exports/callers:

- `rg -n "registerVoIPToken|sendCallNotification|cancelCall|onGroupCallInviteCreated|onGroupCallParticipantJoined|onGroupCallHostAction|cleanupStaleActiveInvites" firebase-backend/functions/src`
- matches only declaration sites in `calls.ts` / `games.ts`

## Segment 7 Safety Notes

- Logging hardening in `inboxTriggers.ts` and `rateLimiter.ts` now uses `functions.logger.error` with sanitized error strings instead of raw `console.error` dumps.
- Non-deployed function candidates were converted from `export const` to local `const` to reduce accidental future deployment risk without changing runtime behavior.
- Core deployment contract remains stable because `index.ts` export surface was not changed.
