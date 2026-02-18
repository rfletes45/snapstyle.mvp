# Firestore Contract

Last verified: 2026-02-18

## Scope

This document maps client Firestore writes and query patterns to:

- `firebase-backend/firestore.rules`
- `firebase-backend/firestore.indexes.json`
- client write/query code under `src/services/`, `src/hooks/`, and `src/screens/`

Inventory command used for write-path discovery:

```bash
rg -n "\b(setDoc|addDoc|updateDoc|writeBatch|runTransaction|deleteDoc)\b" src --glob "*.ts" --glob "*.tsx"
```

## Canonical Collections

These are the main contract collections used by the app:

- `Users/{uid}` and user subcollections (`inventory`, `blockedUsers`, `Achievements`, `Badges`, `settings`, `TaskProgress`, `GameSessions`, `OwnedDecorations`, `OwnedThemes`, `mutedUsers`, `Inbox`, `MessageRequests`)
- `Chats/{chatId}` with `Messages`, `Members`, `MembersPrivate`
- `Groups/{groupId}` with `Messages`, `Members`, `MembersPrivate`
- `FriendRequests`, `Friends`
- `stories` (and legacy `Stories`)
- `GameInvites`, `TurnBasedGames`, `MatchmakingQueue`, `LeaderboardStats`, `Leaderboards`
- `ScheduledMessages`
- `Calls`, `CallSignaling`, `Users/{uid}/CallHistory`
- `Wallets`, `Transactions`
- `BugReports`, `Reports`, `UserReports`, `UserWarnings`
- `Notifications`, `IAPPurchases`, `BundlePurchases`, `PromoCodes`
- `SpectatorSessions`, `SpectatorInvites`

## Write Path to Rule Alignment

### High-confidence aligned paths

- Chat member state writes in `src/services/chatMembers.ts` and `src/services/groupMembers.ts` align with:
  - monotonic watermark rules in `Chats/{chatId}/Members/{uid}` and `Groups/{groupId}/Members/{uid}`
  - owner-only private-state rules in `MembersPrivate` docs
- Message writes via chat/group services align with sender/member validation in:
  - `Chats/{chatId}/Messages/{messageId}`
  - `Groups/{groupId}/Messages/{messageId}`
- Story writes in `src/services/stories.ts` align with:
  - `stories/{storyId}`
  - `stories/{storyId}/views/{userId}`
- Universal invite flows in `src/services/gameInvites.ts` align with:
  - `GameInvites/{inviteId}` status transitions, participant access, and spectator updates
- Profile writes in `src/services/profileService.ts` align with `Users/{uid}` validators:
  - `bio`, `status`, `privacy`, `theme`, `featuredBadges`, decoration ownership subcollections
- Scheduled message writes in `src/services/scheduledMessages.ts` align with:
  - `ScheduledMessages/{messageId}` sender-only write/update constraints
- Bug report submission in `src/services/bugReports.ts` aligns with:
  - `BugReports/{reportId}` (`uid == auth.uid`, `status == "new"`)

### Alignment fixes applied in Segment 6

1. Query validity fix:
- `src/services/story/snapStoryService.ts`
  - `getStoriesFromFriend()` had `where("expiresAt", ">", now)` without ordering by `expiresAt`.
  - Added `orderBy("expiresAt", "asc")` before `orderBy("createdAt", "asc")`.

2. Rules-contract write fix:
- `src/services/iap.ts`
  - Removed client-side `updateDoc()` on `IAPPurchases` in mock flow.
  - This avoids a denied write (`IAPPurchases` updates are disallowed by rules).

## Query and Index Contract

### Existing important index coverage (already present)

- `Chats`: `members` array + `lastMessageAt` ordering
- `FriendRequests`: sender/recipient/status combinations
- `stories`: `recipientIds` array + `expiresAt`
- `ScheduledMessages`: sender/status/chat + `scheduledFor`
- `Groups`: `memberIds` array + activity ordering
- `GameInvites`: sender/recipient/status, eligible users, conversation filters, play-page filters
- `TurnBasedGames`: player/status/game-type ordering combinations
- `MatchmakingQueue`: matchmaking filter combinations
- `Inbox`: `lastActivityAt`
- `MessageRequests`: `status` + `createdAt`

### Index additions in Segment 6

Added to `firebase-backend/firestore.indexes.json`:

- `Pictures`:
  - `senderId` ASC, `storyVisible` ASC, `expiresAt` ASC, `createdAt` ASC
  - `senderId` ASC, `storyVisible` ASC, `expiresAt` ASC, `createdAt` DESC
- `Stories`:
  - `isSnapStory` ASC, `expiresAt` ASC

These cover active story query shapes used in `src/services/story/snapStoryService.ts`.

## Current Risk Notes

- Rules include both modern and legacy collection paths (`stories` and `Stories`, modern chat/group paths and legacy conversation/picture flows). This is intentional in current migration state.
- A full emulator-backed rules test suite is not yet present; current `__tests__/services/firestoreRules.test.ts` is logical/unit-style coverage, not emulator enforcement.
- Future cleanup should remove unused legacy write paths only after caller-proof and regression checks.

## Validation Checklist for Firestore Changes

When adding/changing Firestore writes or queries:

1. Update TypeScript models first.
2. Update service-layer write/query code.
3. Verify/update `firebase-backend/firestore.rules`.
4. Verify/update `firebase-backend/firestore.indexes.json`.
5. Run:
   - `npm run type-check`
   - `npm run lint`
   - `npm run test -- --ci --watchAll=false --no-cache`
   - `cd firebase-backend/functions && npx --no-install tsc --noEmit`
