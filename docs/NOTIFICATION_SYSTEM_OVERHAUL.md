# Push Notification System Overhaul — Deliverables

## 1. Audit Summary

### Backend Producers Identified (19 total)

| Producer         | File                       | Trigger                             | Status                            |
| ---------------- | -------------------------- | ----------------------------------- | --------------------------------- |
| DM message       | `notifications.ts`         | `messages/{id}` onCreate            | ✅ Uses `notifyUser`              |
| Group message    | `notifications.ts`         | `groupMessages/{id}` onCreate       | ✅ Uses `notifyUser`              |
| Message request  | `notifications.ts`         | `messages/{id}` onCreate            | ✅ Uses `notifyUser`              |
| Friend request   | `social.ts`                | `friendRequests/{id}` onCreate      | ✅ Uses `notifyUser`              |
| Friend accepted  | `social.ts`                | `friendRequests/{id}` onUpdate      | ✅ Uses `notifyUser`              |
| Game invite      | `gamesV4/notifications.ts` | `notifyUser` call                   | ✅ Uses `notifyUser`              |
| Game turn        | `gamesV4/notifications.ts` | `notifyUser` call                   | ✅ Uses `notifyUser`              |
| Game resolved    | `gamesV4/notifications.ts` | `notifyUser` call                   | ✅ Uses `notifyUser`              |
| Game lobby       | `gamesV4/notifications.ts` | `notifyUser` call                   | ✅ Uses `notifyUser`              |
| Achievement      | `gamesV4/notifications.ts` | `notifyUser` call                   | ✅ Uses `notifyUser`              |
| Gift received    | `gifting.ts`               | purchase handler                    | ✅ Uses `notifyUser`              |
| Gift opened      | `gifting.ts`               | open handler                        | ✅ Uses `notifyUser`              |
| Streak milestone | `streaks.ts`               | milestone check                     | ✅ Migrated to `notifyUser`       |
| Streak at-risk   | `streaks.ts`               | reminder check                      | ✅ Migrated to `notifyUser`       |
| Cosmetic unlock  | `streaks.ts`               | milestone cosmetic grant            | ✅ Migrated to `notifyUser`       |
| Story viewed     | `legacy.ts`                | `stories/{id}/views/{vid}` onCreate | ✅ Migrated to `notifyUser`       |
| Admin warning    | `legacy.ts`                | `adminApplyWarning` onCall          | ⚠️ Still uses legacy (admin-only) |
| Legacy DM        | `legacy.ts`                | —                                   | 🔴 Dead code (orphaned)           |
| Legacy group msg | `legacy.ts`                | —                                   | 🔴 Dead code (orphaned)           |

### Client Architecture

- **Token registration**: `AuthContext.tsx` → registers Expo push token on auth change, stores in Firestore `Users/{uid}.expoPushToken`
- **Android channels**: 7 channels registered at startup in `notifications.ts`
- **Normalization**: `normalizeNotification.ts` maps raw push payloads → canonical shape with route + dedupe key
- **In-app toasts**: `InAppNotificationsContext.tsx` subscribes to Firestore `Notifications/{uid}/items`, renders via `InAppToast.tsx`
- **Push tap routing**: `useNotificationHandler` extracts route from normalized payload → React Navigation `navigate()`

---

## 2. Major Problems Found & Fixed

### P1 — Legacy bypass paths (streaks + story view)

**Problem**: `streaks.ts` (3 notification types) and `legacy.ts:onStoryViewed` called `sendExpoPushNotification` directly, bypassing the notification center entirely. These notifications had:

- No deduplication
- No canonical Firestore record (invisible in notification inbox)
- No in-app toast delivery
- No mute/presence checking
- No badge count management
- No invalid token cleanup

**Fix**: Migrated all 4 producers to `notifyUser()`.

### P2 — Coarse Android channel mapping

**Problem**: All non-game notifications routed to a single "default" channel. Users couldn't independently control message vs social vs achievement notifications.

**Fix**: Added `resolveAndroidChannelId()` function + 3 new client channels (messages, social, achievements).

### P3 — No iOS thread grouping

**Problem**: No `threadId` in push payloads. All notifications appeared as a flat list in iOS Notification Center.

**Fix**: Added `resolveIosThreadId()` function that groups by conversation ID, game session, invite category, or social category.

### P4 — Generic notification copy

**Problem**: Titles like "Achievement unlocked", "Game over", "New friend request" were bland and uninformative.

**Fix**: Personalized, action-oriented copy for all 16 canonical types. Highlights:

- Game-resolved notifications tell each recipient whether THEY won or lost
- Group messages attribute the sender in preview
- Gift notifications include the item name
- Achievements list the first 2 titles when multiple unlocked

### P5 — Missing client normalization for new types

**Problem**: `streak_milestone`, `streak_at_risk`, `cosmetic_unlock`, `story_viewed` returned `null` from the normalizer, causing dead-end taps on push notifications.

**Fix**: Added normalization handlers with appropriate deep-link routes for all 4 types.

---

## 3. Final Canonical Taxonomy (16 types)

| Type               | Category  | Android Channel | iOS Thread              | Route             |
| ------------------ | --------- | --------------- | ----------------------- | ----------------- |
| `dm`               | messaging | messages        | `conv:{convoId}`        | Conversation      |
| `group_message`    | messaging | messages        | `conv:{convoId}`        | GroupConversation |
| `message_request`  | messaging | messages        | `conv:{convoId}`        | Conversation      |
| `friend_request`   | social    | social          | `social:invites`        | Friends           |
| `friend_accepted`  | social    | social          | `social:friends`        | Friends           |
| `game_invite`      | games     | game-invites    | `invite:{gameType}`     | GameDetail        |
| `game_turn`        | games     | game-invites    | `game:{sessionId}`      | GameBoard         |
| `game_resolved`    | games     | game-invites    | `game:{sessionId}`      | GameDetail        |
| `game_lobby`       | games     | game-invites    | `game:{sessionId}`      | GameDetail        |
| `achievement`      | games     | achievements    | `achieve`               | GameDetail        |
| `gift_received`    | social    | social          | `social:gifts`          | PurchaseHistory   |
| `gift_opened`      | social    | social          | `social:gifts`          | PurchaseHistory   |
| `streak_milestone` | social    | achievements    | `streak:{friendshipId}` | Friends           |
| `streak_at_risk`   | social    | achievements    | `streak:{friendshipId}` | Friends           |
| `cosmetic_unlock`  | social    | achievements    | `social:cosmetics`      | Friends           |
| `story_viewed`     | social    | social          | `social:stories`        | MainTabs          |

---

## 4. Payload Improvements by Type

### Messages

| Type              | Before                                     | After                                               |
| ----------------- | ------------------------------------------ | --------------------------------------------------- |
| DM (generic)      | **"New message"** / "Open Vibe to view it" | **"Vibe"** / "You have a new message"               |
| DM (full preview) | **"{sender}"** / "{preview}"               | (unchanged — already good)                          |
| Group (full)      | **"{group}"** / "{preview}"                | **"{group}"** / "{sender}: {preview}"               |
| Group (mention)   | **"{group}"** / "{preview}"                | **"{group}"** / "{sender} mentioned you: {preview}" |
| Message request   | **"New message request"** / "{msg}"        | **"Message Request"** / "{name} wants to connect"   |

### Social

| Type            | Before                                                         | After                                                             |
| --------------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| Friend request  | **"New friend request"** / "{name} wants to be your friend"    | **"Friend Request"** / "{name} wants to be friends"               |
| Friend accepted | **"Friend request accepted"** / "{name} accepted your request" | **"You're Now Friends!"** / "{name} accepted your friend request" |
| Gift received   | **"You received a gift!"** / "{sender} sent you a {item}"      | **"{sender} sent you a gift!"** / "Tap to unwrap your {item}"     |
| Gift opened     | **"Your gift was opened!"** / "{recipient} opened your {item}" | **"{recipient} opened your gift!"** / "They loved the {item}"     |

### Games

| Type          | Before                                               | After                                                                        |
| ------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| Game invite   | **"Game Invite"** / "{sender} invited you to {game}" | **"{sender} — Game Invite"** (subtitle: game) / "Ready to play? Tap to join" |
| Game turn     | **"Your turn!"** / "It's your turn in {game}"        | **"Your Turn — {game}"** / "It's your move against {opponent}. Tap to play"  |
| Game resolved | **"Game over"** / "{game} finished"                  | **"Game Over — {game}"** / personalized per recipient (win/loss/draw)        |
| Game lobby    | **"Player joined"** / "{player} joined {game}"       | **"{player} Joined"** (subtitle: game) / "Your game is ready to start!"      |
| Achievement   | **"Achievement unlocked"** / "You unlocked {titles}" | **"Achievement Unlocked!"** / "You earned {count}: {first 2 titles}"         |

### Streaks (NEW — previously no canonical record)

| Type             | Copy                                                                       |
| ---------------- | -------------------------------------------------------------------------- |
| Streak milestone | **"🔥 {days}-Day Streak!"** / "{friend} and you hit {days} days!"          |
| Streak at-risk   | **"⏰ Streak Expiring!"** / "Your streak with {friend} ends soon"          |
| Cosmetic unlock  | **"🎉 New Cosmetic!"** / "You unlocked {item} for your {days}-day streak!" |
| Story viewed     | **"{viewer} viewed your story"** / "Tap to see who's watching"             |

---

## 5. Platform Decisions

### Android Channels (7 total)

| Channel ID            | Name                   | Importance | Types                                                  |
| --------------------- | ---------------------- | ---------- | ------------------------------------------------------ |
| `default`             | General                | DEFAULT    | Fallback                                               |
| `messages`            | Messages               | HIGH       | dm, group_message, message_request                     |
| `social`              | Social                 | HIGH       | friend*request, friend_accepted, gift*\*, story_viewed |
| `game-invites`        | Games                  | HIGH       | game_invite, game_turn, game_resolved, game_lobby      |
| `achievements`        | Achievements & Streaks | DEFAULT    | achievement, streak\_\*, cosmetic_unlock               |
| `vibe-incoming-calls` | Incoming Calls         | MAX        | (calls)                                                |
| `vibe-group-calls`    | Group Calls            | HIGH       | (calls)                                                |

### iOS

- **threadId**: Set per notification type for Notification Center grouping (see taxonomy table)
- **categoryId**: Not yet assigned (would enable actionable notifications; future enhancement)
- **subtitle**: Used for game notifications to show game name separately from title

---

## 6. Token & Transport Fixes

| Fix                                                          | Detail                                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Streak notifications now routed through center               | Gains: deduplication, invalid token cleanup, badge count, in-app record |
| Story view notifications now routed through center           | Same gains as above                                                     |
| Legacy `sendExpoPushNotification` callers reduced from 6 → 1 | Only `adminApplyWarning` remains on legacy path                         |
| Android channel resolution                                   | Push payloads now include `channelId` matching registered channels      |
| iOS thread resolution                                        | Push payloads now include `threadId` for grouping                       |

---

## 7. Routing / Deep-Link Fixes

| Type                           | Client Normalizer           | Route Target   |
| ------------------------------ | --------------------------- | -------------- |
| streak_milestone               | ✅ Added                    | Friends screen |
| streak_at_risk                 | ✅ Added                    | Friends screen |
| cosmetic_unlock                | ✅ Added                    | Friends screen |
| story_viewed                   | ✅ Added                    | MainTabs       |
| Legacy alias `streak_reminder` | ✅ Maps to `streak_at_risk` | Friends screen |
| Legacy alias `story_view`      | ✅ Maps to `story_viewed`   | MainTabs       |

---

## 8. Files Modified

### Backend (`firebase-backend/functions/src/`)

| File                       | Changes                                                                                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notificationCenter.ts`    | +4 canonical types, +subtitle/friendshipId/androidChannelId/iosThreadId/iosCategoryId fields, +`resolveAndroidChannelId()`, +`resolveIosThreadId()`, updated push payload builder |
| `notifications.ts`         | Improved DM/group/message-request copy                                                                                                                                            |
| `social.ts`                | Improved friend request/accepted copy                                                                                                                                             |
| `gamesV4/notifications.ts` | Improved invite/turn/resolved/lobby/achievement copy; personalized game-over per recipient                                                                                        |
| `gifting.ts`               | Improved gift received/opened copy                                                                                                                                                |
| `streaks.ts`               | **Full migration**: replaced legacy push with `notifyUser()` for all 3 notification types                                                                                         |
| `legacy.ts`                | **Migrated** `onStoryViewed` from `sendExpoPushNotification` to `notifyUser()`                                                                                                    |

### Client (`src/`)

| File                                              | Changes                                                               |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| `services/notifications.ts`                       | +3 Android channels (messages, social, achievements)                  |
| `services/notifications/normalizeNotification.ts` | +4 canonical types, +normalization handlers for streak/cosmetic/story |
| `store/InAppNotificationsContext.tsx`             | Expanded `NotificationType` union                                     |
| `components/InAppToast.tsx`                       | Added icons + colors for 4 new types                                  |

---

## 9. Remaining Limitations & Future Work

| Item                                                        | Priority | Notes                                                                                               |
| ----------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `adminApplyWarning` still on legacy push                    | Low      | Admin-only function; small blast radius                                                             |
| Conversation-style Android notifications                    | Medium   | Requires native `NotificationServiceExtension` work                                                 |
| iOS actionable categories (`categoryId`)                    | Medium   | Would enable "Reply" / "Mark Read" actions on lock screen                                           |
| Dead code in `legacy.ts`                                    | Low      | Orphaned `onNewMessage`, `onNewGroupMessageV2`, `onNewFriendRequest` implementations can be deleted |
| `sendExpoPushNotification` / `getUserPushToken` deprecation | Low      | Blocked by `adminApplyWarning` migration; after that, can be removed from exports                   |
| Rich media attachments                                      | Low      | Images/avatars in push notifications (platform-specific)                                            |
| Notification preferences UI                                 | Medium   | Per-channel toggle screen on client to match Android channel granularity                            |

---

## 10. Validation

| Check                           | Result                              |
| ------------------------------- | ----------------------------------- |
| Backend `tsc --noEmit`          | ✅ Clean (0 errors)                 |
| Frontend `tsc --noEmit`         | ✅ No new errors (all pre-existing) |
| `normalizeNotification.test.ts` | ✅ 10/10 passed                     |
| Chat/timeline/divider tests     | ✅ 83/83 passed                     |
