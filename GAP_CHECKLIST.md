# SnapStyle MVP — Gap Checklist (Phases 15–24)

**Generated**: January 20, 2026  
**Scope**: Post-MVP V1.1 → V2 Prep  
**Phases**: 15–24

---

## Feature → Implementation Mapping

### A) UX Polish + App Stability

| Feature                             | Screens                                                                                | Services | Firestore | Functions |
| ----------------------------------- | -------------------------------------------------------------------------------------- | -------- | --------- | --------- |
| AppGate boot gating (no flicker)    | `App.tsx` (verify), `src/components/AppGate.tsx`                                       | -        | -         | -         |
| Loading/Empty/Error standardization | All major screens                                                                      | -        | -         | -         |
| Snackbars/toasts for feedback       | All screens with actions                                                               | -        | -         | -         |
| Pull-to-refresh                     | `ChatListScreen`, `FriendsScreen`, `StoriesScreen`, `TasksScreen`, `LeaderboardScreen` | -        | -         | -         |
| Image placeholders                  | `StoriesScreen`, `ChatScreen`, `Avatar` components                                     | -        | -         | -         |

### B) Reliability + Error Handling

| Feature                              | Screens                    | Services                       | Firestore | Functions |
| ------------------------------------ | -------------------------- | ------------------------------ | --------- | --------- |
| Centralized error mapping            | -                          | `src/utils/errors.ts` (extend) | -         | -         |
| Consistent result pattern / AppError | -                          | All services                   | -         | -         |
| Listener unsubscribe verification    | All screens with listeners | All services with onSnapshot   | -         | -         |
| Retry/backoff for uploads            | -                          | `storage.ts`                   | -         | -         |
| Retry/backoff for push token save    | -                          | `notifications.ts`, `users.ts` | -         | -         |
| ErrorBoundary wired at root          | `App.tsx`                  | -                              | -         | -         |

### C) Social Completeness

| Feature                     | Screens                  | Services                                 | Firestore                        | Functions |
| --------------------------- | ------------------------ | ---------------------------------------- | -------------------------------- | --------- |
| Outgoing requests + cancel  | `FriendsScreen` (modify) | `friends.ts` (add `cancelFriendRequest`) | -                                | -         |
| Unfriend                    | `FriendsScreen` (modify) | `friends.ts` (add `unfriend`)            | -                                | -         |
| Resend failed messages      | `ChatScreen` (modify)    | `chat.ts` (retry logic)                  | -                                | -         |
| Typing indicator (optional) | `ChatScreen`             | `chat.ts`                                | `Chats/{id}/typing/{uid}` (TTL)  | -         |
| Reactions (optional)        | `ChatScreen`             | `chat.ts`                                | `Messages` (add `reactions` map) | -         |

### D) Group Chat

| Feature                    | Screens                                        | Services           | Firestore                                            | Functions        |
| -------------------------- | ---------------------------------------------- | ------------------ | ---------------------------------------------------- | ---------------- |
| Create group               | `GroupChatCreateScreen` (new)                  | `groups.ts` (new)  | `Groups/{groupId}`, `Groups/{groupId}/Members/{uid}` | -                |
| Invite flow                | `GroupChatCreateScreen`, `GroupChatInfoScreen` | `groups.ts`        | `GroupInvites/{inviteId}`                            | -                |
| Accept/decline invite      | `FriendsScreen` or new screen                  | `groups.ts`        | `GroupInvites`                                       | -                |
| Leave group                | `GroupChatInfoScreen` (new)                    | `groups.ts`        | `Groups/{groupId}/Members`                           | -                |
| Roles (owner/admin/member) | `GroupChatInfoScreen`                          | `groups.ts`        | `Members.role` field                                 | -                |
| Group messages             | `ChatScreen` (extend)                          | `chat.ts` (extend) | `Chats` (chatType:"group"), `Messages`               | -                |
| Read receipts (lastReadAt) | `ChatScreen`                                   | `chat.ts`          | `Members.lastReadAt`                                 | -                |
| Blocked user restrictions  | -                                              | `groups.ts`        | -                                                    | Enforce in rules |

**Firestore Collections (New):**

- `Groups/{groupId}` — id, name, ownerId, createdAt, memberCount, avatarPath?
- `Groups/{groupId}/Members/{uid}` — uid, role, joinedAt, lastReadAt
- `GroupInvites/{inviteId}` — id, groupId, fromUid, toUid, status, createdAt, expiresAt

**Firestore Indexes (New):**

- `GroupInvites`: toUid + status (for incoming invites query)
- `Groups/Members`: role queries (optional)

### E) Real Games

| Feature               | Screens                             | Services                      | Firestore                     | Functions                    |
| --------------------- | ----------------------------------- | ----------------------------- | ----------------------------- | ---------------------------- |
| Reaction Tap game     | `ReactionTapGameScreen` (new)       | `games.ts` (new/extend)       | `GameSessions`                | `submitGameScore`            |
| Timed Tap game        | `TimedTapGameScreen` (new)          | `games.ts`                    | `GameSessions`                | `submitGameScore`            |
| Share score to chat   | `ChatScreen` (extend message types) | `chat.ts` (scorecard message) | `Messages` (kind:"scorecard") | -                            |
| Anti-cheat validation | -                                   | -                             | -                             | `submitGameScore` (callable) |

**Functions (New):**

- `submitGameScore` (callable) — validate bounds, write session, update leaderboard

### F) Leaderboards + Achievements

| Feature            | Screens                       | Services                | Firestore                                       | Functions                   |
| ------------------ | ----------------------------- | ----------------------- | ----------------------------------------------- | --------------------------- |
| Weekly leaderboard | `LeaderboardScreen` (new)     | `leaderboards.ts` (new) | `Leaderboards/{gameId}_{weekKey}/Entries/{uid}` | Update in `submitGameScore` |
| Friends-only view  | `LeaderboardScreen`           | `leaderboards.ts`       | -                                               | -                           |
| Achievements       | `ProfileScreen` (add section) | `achievements.ts` (new) | `Users/{uid}/Achievements/{id}`                 | Triggered by various events |

**Firestore Collections (New):**

- `Leaderboards/{gameId}_{weekKey}/Entries/{uid}` — uid, score, updatedAt
- `Users/{uid}/Achievements/{achievementId}` — id, uid, type, earnedAt, meta

**Firestore Indexes (New):**

- `Leaderboards/Entries`: score DESC, updatedAt

### G) Economy + Tasks + Shop

| Feature              | Screens                       | Services           | Firestore                                             | Functions                        |
| -------------------- | ----------------------------- | ------------------ | ----------------------------------------------------- | -------------------------------- |
| Wallet display       | `ProfileScreen`, `ShopScreen` | `economy.ts` (new) | `Wallets/{uid}`                                       | -                                |
| Transaction history  | `ProfileScreen` (optional)    | `economy.ts`       | `Transactions/{txId}`                                 | -                                |
| Daily tasks          | `TasksScreen` (new)           | `tasks.ts` (new)   | `Tasks/{taskId}`, `Users/{uid}/TaskProgress/{taskId}` | `claimTaskReward`, task triggers |
| Task progress        | `TasksScreen`                 | `tasks.ts`         | `TaskProgress`                                        | onCreate triggers                |
| Shop catalog         | `ShopScreen` (new)            | `shop.ts` (new)    | `ShopCatalog/{itemId}`                                | -                                |
| Purchase with tokens | `ShopScreen`                  | `shop.ts`          | `Purchases/{id}`                                      | `purchaseWithTokens`             |

**Firestore Collections (New):**

- `Wallets/{uid}` — uid, tokensBalance, updatedAt
- `Transactions/{txId}` — id, uid, type, amount, reason, createdAt, refId
- `Tasks/{taskId}` — id, cadence, title, type, target, rewardTokens, rewardItemId, active
- `Users/{uid}/TaskProgress/{taskId}` — taskId, progress, claimed, dayKey, updatedAt
- `ShopCatalog/{itemId}` — id, cosmeticId, priceTokens, availableFrom, availableTo, featured, rarity
- `Purchases/{purchaseId}` — id, uid, itemId, currency, price, createdAt, status

**Firestore Indexes (New):**

- `ShopCatalog`: featured + availableTo/availableFrom
- `TaskProgress`: dayKey queries
- `Transactions`: uid + createdAt DESC

**Functions (New):**

- `claimTaskReward` (callable) — validate, award tokens/items, mark claimed
- `purchaseWithTokens` (callable) — atomic decrement + grant
- Task progress triggers (onCreate Message, StoryView, GameSession)

### H) Trust & Safety v1.5

| Feature            | Screens                         | Services           | Firestore                         | Functions                                       |
| ------------------ | ------------------------------- | ------------------ | --------------------------------- | ----------------------------------------------- |
| Rate limiting      | -                               | -                  | -                                 | `onCall` wrappers for friend requests, messages |
| Push token cleanup | -                               | `notifications.ts` | `Users.expoPushToken`             | Expo response handler                           |
| Bans/strikes       | Client ban check                | `safety.ts` (new)  | `Bans/{uid}`, `UserStrikes/{uid}` | `adminSetBan`, `applyStrike`                    |
| Admin report queue | `AdminReportsQueueScreen` (new) | `admin.ts` (new)   | `Reports`                         | Admin callables                                 |

**Firestore Collections (New):**

- `Bans/{uid}` — uid, status, reason, expiresAt, createdAt, by
- `UserStrikes/{uid}` — uid, strikeCount, lastStrikeAt

**Functions (New):**

- `adminSetBan` (callable, admin-only)
- `applyStrike` (callable, admin-only)
- Rate limiter helper functions

### I) Settings + Account + Accessibility + i18n

| Feature              | Screens                             | Services   | Firestore                      | Functions                  |
| -------------------- | ----------------------------------- | ---------- | ------------------------------ | -------------------------- |
| Settings hub         | `SettingsScreen` (new)              | -          | -                              | -                          |
| Notification toggles | `SettingsScreen`                    | `users.ts` | `Users.settings.notifications` | -                          |
| Privacy settings     | `SettingsScreen`                    | `users.ts` | `Users.settings.privacy`       | -                          |
| Edit displayName     | `SettingsScreen` or `ProfileScreen` | `users.ts` | `Users.displayName`            | -                          |
| Delete account       | `SettingsScreen`                    | `users.ts` | -                              | `deleteAccount` (callable) |
| Accessibility labels | All screens                         | -          | -                              | -                          |
| i18n scaffold        | `src/i18n/` (new), `strings.ts`     | -          | -                              | -                          |

**Functions (New):**

- `deleteAccount` (callable) — best-effort deletion

### J) Release Prep

| Feature          | Screens            | Services | Firestore | Functions |
| ---------------- | ------------------ | -------- | --------- | --------- |
| EAS profiles     | -                  | -        | -         | -         |
| Env validation   | `App.tsx` / config | -        | -         | -         |
| Store checklists | Docs only          | -        | -         | -         |

**Docs (New):**

- `STORE_SUBMISSION_CHECKLIST.md`
- `RELEASE_CHECKLIST.md`

### K) Migration Prep Layer

| Feature                | Screens | Services                         | Firestore          | Functions          |
| ---------------------- | ------- | -------------------------------- | ------------------ | ------------------ |
| DataSource abstraction | -       | `src/services/datasource/` (new) | -                  | -                  |
| Events emission        | -       | -                                | `Events/{eventId}` | Server-side writes |

**Firestore Collections (New):**

- `Events/{eventId}` — id, type, uid, createdAt, payload, version

**Docs (New):**

- `MIGRATION_PLAN.md`

---

## Phase Summary

| Phase | Focus                       | New Screens            | New Services                     | New Collections                            | New Functions                           |
| ----- | --------------------------- | ---------------------- | -------------------------------- | ------------------------------------------ | --------------------------------------- |
| 15    | Polish + Settings + Errors  | SettingsScreen         | errors.ts (extend)               | -                                          | -                                       |
| 16    | Games + Scorecards          | ReactionTap, TimedTap  | games.ts                         | -                                          | submitGameScore                         |
| 17    | Leaderboards + Achievements | LeaderboardScreen      | leaderboards.ts, achievements.ts | Leaderboards, Achievements                 | (update submitGameScore)                |
| 18    | Wallet + Tasks              | TasksScreen            | economy.ts, tasks.ts             | Wallets, Transactions, Tasks, TaskProgress | claimTaskReward, task triggers          |
| 19    | Shop                        | ShopScreen             | shop.ts                          | ShopCatalog, Purchases                     | purchaseWithTokens                      |
| 20    | Group Chat                  | GroupCreate, GroupInfo | groups.ts                        | Groups, GroupInvites                       | -                                       |
| 21    | Safety v1.5                 | AdminReportsQueue      | safety.ts, admin.ts              | Bans, UserStrikes                          | adminSetBan, applyStrike, rate limiters |
| 22    | Media Pipeline              | -                      | storage.ts (extend)              | -                                          | -                                       |
| 23    | Release Prep                | -                      | -                                | -                                          | -                                       |
| 24    | Migration Prep              | -                      | datasource/\*.ts                 | Events                                     | -                                       |

---

## Firestore Rules Summary (To Add)

```
// Wallets: owner read, server write
// Transactions: owner read, server write
// Tasks: authenticated read active
// TaskProgress: owner read, server write
// ShopCatalog: public read, server write
// Purchases: owner read, server write
// Leaderboards: public read, server write
// Achievements: owner read, server write
// Groups: members read, restricted writes
// GroupInvites: recipient read, sender create, recipient update
// Bans: user reads own, admin writes
// UserStrikes: admin only
// Events: server only
```

---

## Ready to Start Phase 15

**Phase 15 Deliverables:**

1. Verify AppGate boot gating (no auth flicker)
2. Standardize UI states with LoadingState/EmptyState/ErrorState
3. Extend src/utils/errors.ts with Firebase error mapping
4. Add snackbar/toast feedback pattern
5. Create SettingsScreen hub with routes
6. Wire ErrorBoundary at app root
7. QA: no regressions

**Files to Create/Modify:**

- `src/utils/errors.ts` — extend
- `src/screens/settings/SettingsScreen.tsx` — new
- `src/navigation/RootNavigator.tsx` — add Settings route
- `App.tsx` — verify ErrorBoundary
- Various screens — add consistent UI states
