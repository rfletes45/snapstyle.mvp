# Phase 6: Notifications + Streaks - Preparation

**Status:** READY FOR IMPLEMENTATION ✅  
**Date:** January 20, 2026  
**Estimated Duration:** 6-8 hours

---

## Overview

Phase 6 adds real-time push notifications and streak tracking to SnapStyle. Users receive notifications for messages, friend requests, and story views. Streaks track consecutive days of messaging between friends.

### Key Features

1. **Push Notifications**
   - New message notifications
   - Friend request notifications
   - Story view notifications
   - Streak milestone celebrations
   - Daily at-risk streak reminders

2. **Streak Tracking**
   - Consecutive days of message exchange
   - Automatic increment when both users message in a day
   - Reset on missed days
   - Milestones at 3, 7, 14, 30, 50, 100, 365 days
   - At-risk detection when only one user has messaged

3. **Cloud Functions**
   - Message triggers for push notifications + streak updates
   - Friend request notifications
   - Story view notifications
   - Daily reminder function for at-risk streaks

---

## Architecture

### Services

#### `src/services/notifications.ts` (New)

**Handles all push notification logic**

- `registerForPushNotifications()` - Get Expo Push Token
- `savePushToken()` - Store token in Firestore
- `removePushToken()` - Clean up on logout
- `scheduleLocalNotification()` - Test notifications
- Notification listeners for received/tapped notifications

#### `src/services/streaks.ts` (New)

**Manages streak calculations and tracking**

- `getStreakStatus()` - Current streak info
- `recordMessageSent()` - Track messages and update streaks
- `getActiveStreaks()` - All active streaks for user
- `getStreaksAtRisk()` - Streaks needing action today
- `formatStreakDisplay()` - Pretty emoji formatting
- `getMilestoneMessage()` - Milestone celebration text

### Cloud Functions (firebase/functions/src/index.ts)

```typescript
// New Functions:
onNewMessage(); // Send push + update streaks
onNewFriendRequest(); // Notify on friend request
onStoryViewed(); // Notify story author
streakReminder(); // Daily at 8 PM UTC

// Existing Functions (Phase 4-5):
onDeleteMessage();
cleanupExpiredSnaps();
cleanupExpiredStories();
```

### Data Model Changes

**Friend Document** (existing, used by streaks)

```typescript
{
  id: string;
  users: [uid1, uid2];
  createdAt: number;
  streakCount: number;              // Current streak
  streakUpdatedDay: string;         // YYYY-MM-DD
  lastSentDay_uid1?: string;        // Last day user1 sent
  lastSentDay_uid2?: string;        // Last day user2 sent
  blockedBy?: string | null;
}
```

**User Document** (existing, add this field)

```typescript
{
  // ... existing fields
  expoPushToken?: string;           // For push notifications
}
```

### Firestore Security Rules

**No changes needed** - Existing rules support:

- Users can update their own `expoPushToken`
- Friends can update their own friendship document (streak fields)
- Cloud Functions have full access via admin SDK

---

## Implementation Checklist

### Part 1: Dependencies & Services (1-2 hours)

- [ ] Install `expo-notifications` and `expo-device`
- [ ] Create `src/services/notifications.ts`
  - [ ] Permission request logic
  - [ ] Token management (save/remove)
  - [ ] Listener setup
  - [ ] Local notification scheduling
- [ ] Create `src/services/streaks.ts`
  - [ ] Streak status calculation
  - [ ] Message sent tracking
  - [ ] Active streak retrieval
  - [ ] At-risk detection
  - [ ] Display formatting

### Part 2: Cloud Functions (2-3 hours)

- [ ] Update `firebase/functions/src/index.ts`
  - [ ] `onNewMessage()` trigger
    - [ ] Get recipient's push token
    - [ ] Send notification
    - [ ] Call streak update function
  - [ ] `onNewFriendRequest()` trigger
  - [ ] `onStoryViewed()` trigger
  - [ ] `streakReminder()` scheduled function
  - [ ] Helper function for streak updates
  - [ ] Helper function for milestone notifications
- [ ] Build and verify compilation (`npm run build`)

### Part 3: Integration (2-3 hours)

- [ ] Update `src/store/AuthContext.tsx`
  - [ ] Auto-register for push notifications on login
  - [ ] Remove token on logout
  - [ ] Set up notification listeners
  - [ ] Handle notification taps (navigation)
- [ ] Verify FriendsScreen displays streaks
  - [ ] Streak count with fire emoji
  - [ ] Already exists via `Friend.streakCount`
- [ ] Update ChatScreen to call `recordMessageSent()`
  - [ ] After message creation succeeds
  - [ ] Pass friendship ID and sender ID
- [ ] Update StoriesScreen to check notifications permission

### Part 4: Testing & Docs (1-2 hours)

- [ ] Verify no TypeScript errors (`npm run lint`)
- [ ] Test notification permissions flow
- [ ] Test streak tracking (send 2 messages from different users)
- [ ] Test milestone detection
- [ ] Write PHASE_6_COMPLETE.md
- [ ] Update INDEX.md with Phase 6 info

---

## Key Implementation Details

### Streak Logic

A streak increments when:

1. Both users have sent at least one message in the same calendar day
2. The streak was either started today or updated yesterday
3. Neither user has missed a day

Example:

```
Monday: User A sends → lastSentDay_uid1 = "2026-01-20"
Monday: User B sends → lastSentDay_uid2 = "2026-01-20"
        → streakCount = 1, streakUpdatedDay = "2026-01-20"

Tuesday: User A sends → lastSentDay_uid1 = "2026-01-21"
Tuesday: User B sends → lastSentDay_uid2 = "2026-01-21"
        → streakCount = 2, streakUpdatedDay = "2026-01-21"

Wednesday: Only User A sends → lastSentDay_uid1 = "2026-01-22"
        → No increment (User B hasn't sent yet)
        → Streak is "at risk"

Wednesday: User B doesn't send by end of day
Thursday: Dayback to 0
        → streakCount = 0
```

### Notification Types

1. **Message Notification**
   - Title: Sender's display name
   - Body: "📸 Sent you a snap!" or message text
   - Data: `{ type: "message", chatId, senderId }`

2. **Friend Request**
   - Title: "New Friend Request! 👋"
   - Body: "{Name} wants to be your friend"
   - Data: `{ type: "friend_request", requestId, senderId }`

3. **Story View**
   - Title: "Story Viewed! 👀"
   - Body: "{Name} viewed your story"
   - Data: `{ type: "story_view", storyId, viewerId }`

4. **Streak Milestone**
   - Title: "Streak Milestone! 🎉"
   - Body: "🔥 7-day streak! Amazing!" (varies by milestone)
   - Data: `{ type: "streak_milestone", milestone }`

5. **Streak Reminder**
   - Title: "Streak at Risk! ⚠️"
   - Body: "Your 5-day streak is about to end!"
   - Data: `{ type: "streak_reminder", friendshipId, streakCount }`

### Platform Considerations

- **Web**: Notifications won't work (no Expo Push integration)
- **iOS/Android**: Full notification support with background handling
- **Development**: Mock tokens used in dev mode for testing

---

## Testing Strategy

### Unit Tests

- Streak calculation logic (various date scenarios)
- Milestone detection
- At-risk detection
- Display formatting

### Integration Tests

1. **Message Flow**
   - Send message → Verify streak update
   - Both users send → Verify increment
   - Miss a day → Verify reset

2. **Notifications**
   - Send message → Verify recipient gets notification
   - Friend request → Verify notified
   - Story view → Verify author notified

3. **Edge Cases**
   - Duplicate message sends in same second
   - Timezone boundaries (midnight)
   - Network failures during streak update
   - Missing push token

### Manual Testing (Dev Mode)

```bash
# Login on two devices/accounts
# Device A sends message to Device B
# → Device B should see notification
# → Check Firestore: lastSentDay_uid_B should update
# → If Device A also sent today, streakCount should increment

# Wait until next day
# Device A sends, Device B doesn't
# → Streak should be "at risk"
# → 8 PM UTC: Both should get reminder notification

# Device B misses entire day
# → Next day: Streak should reset to 0
```

---

## Dependencies Added

```json
{
  "expo-notifications": "latest",
  "expo-device": "latest"
}
```

These are automatically compatible with Expo SDK 54.

---

## Deployment Notes

### Before Deploying Cloud Functions

1. Verify compilation: `cd firebase/functions && npm run build`
2. Test locally: `firebase emulators:start --only functions`
3. Verify Firestore rules allow Cloud Functions to write to collections

### Cloud Functions Requirements

- Must have Expo project ID configured (optional, uses default)
- Requires internet access to `https://exp.host/--/api/v2/push/send`
- Firebase Admin SDK v12.0+
- Scheduled functions require Firebase Blaze plan

---

## Rollback Plan

If issues occur:

1. **Notifications broken**: Disable onNewMessage function

   ```bash
   firebase deploy --only functions:cleanupExpiredSnaps,functions:cleanupExpiredStories
   ```

2. **Streaks broken**: Set `recordMessageSent()` to no-op in Cloud Function

3. **Push tokens stored**: Can be cleared via Firestore UI or script

---

## Acceptance Criteria

✅ Push notifications sent for:

- New messages (with "snap" indicator)
- Friend requests
- Story views
- Streak milestones
- At-risk streaks (daily at 8 PM)

✅ Streaks:

- Increment when both users message in a day
- Reset when a day is missed
- Display in FriendsScreen with fire emoji
- Detect at-risk status
- Notify on milestones (3, 7, 14, 30, 50, 100, 365)

✅ Code Quality:

- Zero TypeScript errors
- ESLint passes (warnings OK)
- All services fully documented
- Cloud Functions compile and deploy

✅ Performance:

- Notification sent within 5 seconds of message
- Streak update completes before response sent
- No impact on message send time

---

## Known Limitations

1. **Web Platform**: No native push notification support
2. **Background**: iOS notification handling requires app to be active or in background
3. **Timezone**: Streak tracking uses UTC by default (customizable)
4. **Rate Limits**: Expo may rate-limit rapid push sends (rare in practice)
5. **Offline**: Streak updates require Cloud Function execution (no offline support)

---

## Next Steps

After Phase 6 completion:

- **Phase 7**: Avatar customization + cosmetics system
- **Phase 8**: Safety features (reporting, blocking) + final polish

---

## Resources

- [Expo Notifications Docs](https://docs.expo.dev/notifications/overview/)
- [Firebase Cloud Functions Docs](https://firebase.google.com/docs/functions)
- [Firestore Security Rules Guide](https://firebase.google.com/docs/firestore/security/get-started)

---

**Prepared by:** AI Assistant  
**Last Updated:** January 20, 2026
