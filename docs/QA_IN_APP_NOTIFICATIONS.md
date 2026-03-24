# In-App Notifications QA Script

Last verified: 2026-03-24

Feature scope:

- inbox/chat in-app notifications (`dm_message`, `group_message`, `message_request`, `friend_request`)
- games in-app notifications (`game_invite`, `game_lobby_ready`, `game_turn`, `game_resolved`, `achievement_unlocked`)
- commerce notifications (`gift_received`, `gift_opened`)
- payload normalization and dedupe behavior
- push token registration and badge count
- notification architecture docs: [NOTIFICATION_SYSTEM.md](NOTIFICATION_SYSTEM.md)

Primary runtime files:

- `src/store/InAppNotificationsContext.tsx`
- `src/store/AuthContext.tsx`
- `src/services/notifications.ts`
- `src/services/userNotifications.ts`
- `src/services/notifications/normalizeNotification.ts`
- `firebase-backend/functions/src/notificationCenter.ts`
- `firebase-backend/functions/src/notifications.ts`

## Prerequisites

1. Two test accounts in at least one DM and one group.
2. App running in dev or preview on two clients (device or simulator).
3. Firestore access for verification.
4. Feature flags configured for the environment under test.
5. There is no legacy push env toggle in the current implementation. Validate behavior through the shared notification center and per-user notification records instead.

## Test A - DM Message In-App Notifications

### A1) Banner appears when recipient is outside the active DM and not on inbox

1. Account A stays on a non-chat screen (for example profile).
2. Account B sends a DM to account A.
3. Verify account A sees one in-app message banner.
4. Verify banner text reflects sender and message preview.

Expected:

- exactly one banner
- no duplicate banner within debounce window

### A2) Suppression while recipient is already in the same chat

1. Account A opens the exact DM thread with account B.
2. Account B sends a new message.
3. Verify no in-app banner appears for account A.

Expected:

- notification is suppressed because `currentChatId` matches

### A3) Suppression on inbox screen

1. Account A opens `ChatList`.
2. Account B sends a DM to account A.
3. Verify account A does not see a message banner.

Expected:

- in-app message notification suppressed on inbox screen

### A4) Tap routing

1. Trigger A1 again.
2. Tap banner on account A.
3. Verify navigation lands on `ChatDetail` for sender.

Expected:

- correct route and params

## Test B - Group Message In-App Notifications

### B1) Banner on group message from another member

1. Account A is outside group/chat screens.
2. Account B sends a message in a shared group.
3. Verify account A receives one group message banner.

Expected:

- title/body indicates group context
- no duplicate within debounce window

### B2) Suppression for sender

1. Account A sends a group message.
2. Verify account A does not receive an in-app banner for their own message.

Expected:

- sender self-notification is not shown

### B3) Tap routing

1. Trigger B1 again.
2. Tap banner.
3. Verify navigation lands on `GroupChat` with correct `groupId`.

## Test C - Friend Request In-App Notifications

### C1) Banner for new pending request

1. Account B sends friend request to account A.
2. Account A is not on `Connections`.
3. Verify account A sees a friend request banner.

Expected:

- one banner only
- title/body show request intent

### C2) Suppression on connections screen

1. Account A opens `Connections`.
2. Send another friend request from test account C if available.
3. Verify no friend request in-app banner appears.

Expected:

- friend request banner suppressed while already on connections screen

### C3) Tap routing

1. Trigger C1 again.
2. Tap banner.
3. Verify navigation to `Connections`.

## Test D - Game Turn And Achievement Notifications

### D1) Turn banner outside games area

1. Account A opens a non-games screen.
2. Account B makes a move that hands turn to account A.
3. Verify account A receives `game_turn` in-app banner.

Expected:

- title: "Your turn"
- route target: `GamePlayV4`

Firestore check:

- `Users/{uid}/Notifications/{notificationId}` exists with `channel == "in_app"`
- `type` is `game_turn`
- `presentedAt` gets set by client after handling

### D2) Turn suppression inside games area

1. Account A opens any games screen.
2. Trigger a `game_turn` notification.
3. Verify no banner appears.

Expected:

- notification is marked delivered without showing banner

### D3) Achievement banner outside games area

1. Account A is outside games area.
2. Complete game action that unlocks achievement for account A.
3. Verify one `achievement_unlocked` banner appears.

Expected:

- route target is `AchievementSection` when `sectionId` exists
- otherwise route target is `AchievementsHub`

### D4) Achievement suppression in games area

1. Account A is on a games screen.
2. Trigger achievement unlock.
3. Verify no in-app banner appears.

Expected:

- doc is marked delivered
- no visible banner

## Test E - Dedupe And Collapse Behavior

### E1) Dedupe helper window

1. Trigger two semantically identical payloads within 1.5s for same dedupe key.
2. Verify only first is processed for routing path that uses dedupe map.

Expected:

- second event ignored during dedupe window

Reference:

- `NOTIFICATION_DEDUPE_WINDOW_MS` in `src/services/notifications/normalizeNotification.ts`

### E2) In-app debounce window

1. Trigger same in-app notification entity within 3 seconds.
2. Verify banner appears only once.

Expected:

- second event suppressed by `InAppNotificationsContext` debounce

### E3) Distinct entities still show

1. Trigger notifications with different entity IDs (for example two different chat IDs).
2. Verify each distinct entity can show a banner.

Expected:

- no cross-entity suppression

## Test F - Payload Normalization Contracts

Validate normalization with representative payloads.

### F1) Legacy DM payload

Input:

```json
{ "type": "message", "senderId": "uid_b", "chatId": "chat_1" }
```

Expected canonical route:

- screen: `ChatDetail`
- dedupeKey: `dm_message:chat_1`

### F2) Group payload

Input:

```json
{ "type": "group_message", "groupId": "group_1", "groupName": "Project" }
```

Expected canonical route:

- screen: `GroupChat`
- dedupeKey: `group_message:group_1`

### F3) Game turn payload

Input:

```json
{ "type": "game_turn", "sessionId": "sess_1", "gameId": "tic_tac_toe" }
```

Expected canonical route:

- screen: `GamePlayV4`
- dedupeKey: `game_turn:sess_1`

### F4) Achievement payload

Input:

```json
{ "type": "achievement_unlocked", "sectionId": "champion" }
```

Expected canonical route:

- screen: `AchievementSection`
- dedupeKey: `achievement_unlocked:champion`

## Test G - Security And Ownership Checks

### G1) Client cannot create `Users/{uid}/Notifications` docs

Expected:

- denied by Firestore rules

### G2) Client cannot mutate protected fields (`type`, `payload`, `collapseKey`, `createdAt`)

Expected:

- denied by rules

### G3) Owner can update `readAt`, `presentedAt`, and `archivedAt`

Expected:

- allowed for owner only

### G4) Non-owner cannot read another user's notifications

Expected:

- denied

## Test H - Legacy Trigger Migration Safety

### H1) Confirm environment flag intent

1. Confirm notification delivery is flowing through `firebase-backend/functions/src/notificationCenter.ts`.
2. Record whether the recipient had an active session, a push-capable device, or both.

### H2) Duplicate channel smoke

1. Trigger a DM/group event that can emit both push and in-app pathways.
2. Verify user does not experience duplicate in-app routing side effects.

Expected:

- no duplicate navigation events
- no rapid duplicate banners for same entity

## Verification Checklist

- [ ] DM message in-app banner behavior is correct (show + suppress)
- [ ] Group message in-app banner behavior is correct (show + suppress)
- [ ] Friend request in-app banner behavior is correct (show + suppress)
- [ ] Game turn and achievement in-app behavior is correct
- [ ] Tap routing lands on correct destination for each type
- [ ] Dedupe/debounce behavior prevents duplicates
- [ ] Firestore ownership/rule constraints are enforced
- [ ] Legacy migration flag intent is verified for environment
- [ ] Push token registration completes without crypto.getRandomValues crash
- [ ] Badge count subscription succeeds (no persistent permissions error)
- [ ] Badge count updates when notifications are read/created
- [ ] Push notifications received when app is backgrounded
- [ ] Cold-start notification tap navigates to correct screen
- [ ] Android 13+ POST_NOTIFICATIONS permission is requested
- [ ] Notification channels are created on Android
- [ ] Denied permissions result in graceful degradation, not crash
