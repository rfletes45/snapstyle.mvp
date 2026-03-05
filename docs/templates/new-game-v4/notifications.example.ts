// ──────────────────────────────────────────────────────────
// Template: Notification Payloads for a New Game
//
// Notifications live in:
//   Backend:  firebase-backend/functions/src/gamesV4/notifications.ts
//   Client:   src/services/notificationService.ts (listener)
//
// Two notification types are used by Games V4:
//   1. Turn notifications — "It's your turn in My Game vs Player2"
//   2. Achievement notifications — "🏆 You earned 'First Blood'!"
//
// This file shows example payloads and wiring.
// ──────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════
// 1. TURN NOTIFICATION (sent after opponent's move)
// ═══════════════════════════════════════════════════════════

// Sent by: notifications.ts → sendTurnNotification()
// Triggered from: submitTurnMoveV4 callable (after successful move persistence)

const turnNotificationPayload = {
  // Firestore path: Notifications/{recipientUid}/items/{autoId}
  type: "game_turn" as const,
  gameId: "my_game",
  sessionId: "sess_abc123",
  senderUid: "uid_of_player_who_just_moved",
  senderDisplayName: "Player One",
  title: "Your Turn!",
  body: "Player One made a move in My Game. It's your turn!",
  // Presence gating: notification is only written if recipient
  // has NO active presence heartbeat (i.e. app is backgrounded)
  // This prevents spamming users who are already looking at the game.
  createdAt: "Timestamp.now()",
  read: false,
  // Optional deep link data for navigation:
  data: {
    screen: "GamePlay",
    params: {
      gameId: "my_game",
      sessionId: "sess_abc123",
    },
  },
};

// ═══════════════════════════════════════════════════════════
// 2. ACHIEVEMENT UNLOCK NOTIFICATION
// ═══════════════════════════════════════════════════════════

// Sent by: notifications.ts → sendAchievementNotification()
// Triggered from: resolveSessionV4Internal Phase 8 (Achievement Evaluation)

const achievementNotificationPayload = {
  // Firestore path: Notifications/{recipientUid}/items/{autoId}
  type: "achievement_unlock" as const,
  achievementType: "my_game_first_win",
  title: "🏆 Achievement Unlocked!",
  body: "You earned 'First Blood' — Win your first game of My Game",
  tokenReward: 10,
  createdAt: "Timestamp.now()",
  read: false,
  data: {
    screen: "Achievements",
    params: {
      sectionId: "my_game",
    },
  },
};

// ═══════════════════════════════════════════════════════════
// 3. GAME INVITE NOTIFICATION
// ═══════════════════════════════════════════════════════════

// Sent by: invites.ts → sendInviteV4 callable
// Recipient sees this in their notification feed + PinnedInviteBar

const inviteNotificationPayload = {
  type: "game_invite" as const,
  gameId: "my_game",
  sessionId: "sess_abc123",
  senderUid: "uid_inviter",
  senderDisplayName: "Player One",
  title: "Game Invite",
  body: "Player One invited you to play My Game!",
  createdAt: "Timestamp.now()",
  read: false,
  data: {
    screen: "GameDetail",
    params: {
      gameId: "my_game",
      sessionId: "sess_abc123",
    },
  },
};

// ═══════════════════════════════════════════════════════════
// 4. GAME OVER NOTIFICATION
// ═══════════════════════════════════════════════════════════

// Sent by: notifications.ts (from resolveSessionV4Internal Phase 9)
// Only sent to participants who are NOT currently present

const gameOverNotificationPayload = {
  type: "game_over" as const,
  gameId: "my_game",
  sessionId: "sess_abc123",
  title: "Game Over!",
  body: "Your game of My Game has ended. Tap to see results!",
  createdAt: "Timestamp.now()",
  read: false,
  data: {
    screen: "GameOver",
    params: {
      gameId: "my_game",
      sessionId: "sess_abc123",
    },
  },
};

// ═══════════════════════════════════════════════════════════
// 5. PRESENCE GATING LOGIC
// ═══════════════════════════════════════════════════════════

// Before writing a notification, the backend checks:
//
//   const presenceRef = db.doc(`Presence/${recipientUid}`);
//   const presenceSnap = await presenceRef.get();
//   const isOnline = presenceSnap.exists &&
//     presenceSnap.data()?.lastHeartbeat?.toMillis() > Date.now() - 60_000;
//
//   if (!isOnline) {
//     await db.collection(`Notifications/${recipientUid}/items`).add(payload);
//   }
//
// This means:
//   - If the recipient's app is open (heartbeat < 60s old), NO notification is written
//   - If the recipient is offline, the notification IS written
//   - The client in-app notification listener (NotificationBanner) handles
//     real-time toasts for users who ARE online

// ═══════════════════════════════════════════════════════════
// 6. CLIENT-SIDE LISTENER
// ═══════════════════════════════════════════════════════════

// The client listens to Notifications/{uid}/items via onSnapshot.
// When a new doc appears:
//   1. Shows in-app banner/toast
//   2. On tap → navigates to data.screen with data.params
//   3. Marks notification as read (read: true)
//
// No game-specific code needed on the client notification listener.
// All routing is handled by the generic `data.screen` + `data.params`.

// ═══════════════════════════════════════════════════════════
// CHECKLIST
// ═══════════════════════════════════════════════════════════
// □ Turn notifications: no changes needed if using standard submitTurnMoveV4
// □ Achievement notifications: automatic from resolveSessionV4Internal
// □ Invite notifications: automatic from sendInviteV4
// □ Game over notifications: automatic from resolveSessionV4Internal
// □ Verify presence gating is working (test with app backgrounded)
// □ Verify deep link navigation for each notification type
// □ Test notification rendering in NotificationBanner component
