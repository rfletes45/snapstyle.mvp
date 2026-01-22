# Phase 17 Complete: Scheduled Messages + Leaderboards + Achievements

## Summary

Phase 17 implements:

1. **Scheduled Messages** - Compose messages now and have them automatically sent at a specified time
2. **Leaderboards** (per guide) - Weekly per-game leaderboards with global and friends-only views
3. **Achievements** (per guide) - Game-based, streak, and social achievements with progress tracking

---

## Part A: Scheduled Messages

### 1. Schedule Message Modal (`src/components/ScheduleMessageModal.tsx`)

- **Quick Options**: Pre-set scheduling times
  - "In 1 hour"
  - "In 3 hours"
  - "Tomorrow 9 AM"
  - "Tomorrow 6 PM"
- **Custom Date/Time**: Manual input for specific scheduling
  - Date input (MM/DD format)
  - Time input (HH:MM format)
  - AM/PM toggle
- **Preview**: Shows exactly when the message will be sent
- **Validation**: Ensures scheduled time is between 5 minutes and 30 days in the future
- **Dark theme styling** matching app design

### 2. Scheduled Messages Service (`src/services/scheduledMessages.ts`)

Full CRUD operations for scheduled messages:

- `scheduleMessage()` - Create a new scheduled message
- `getScheduledMessages()` - Fetch user's scheduled messages with optional status filter
- `getScheduledMessagesForChat()` - Get scheduled messages for a specific chat
- `cancelScheduledMessage()` - Cancel a pending scheduled message
- `updateScheduledMessageContent()` - Edit message content before delivery
- `updateScheduledMessageTime()` - Reschedule delivery time
- `deleteScheduledMessage()` - Permanently delete a scheduled message
- `subscribeToScheduledMessages()` - Real-time updates subscription
- `getTimeUntilDelivery()` - Human-readable countdown (e.g., "in 2 hours")
- `formatScheduledTime()` - Display formatting for dates

### 3. ChatScreen Integration

- **Schedule Button**: Clock icon button next to Send button
- **Modal Integration**: Opens ScheduleMessageModal when tapped
- **Message Handling**: Schedules the current text input for future delivery
- **Confirmation**: Shows alert confirming scheduled time

### 4. Scheduled Messages Management Screen (`src/screens/chat/ScheduledMessagesScreen.tsx`)

- **List View**: Shows all scheduled messages with status
- **Filter Chips**: Filter by All, Pending, Sent, Cancelled, Failed
- **Real-time Updates**: Live subscription for pending messages
- **Actions**:
  - Cancel pending messages
  - Delete any message
- **Status Indicators**: Color-coded chips showing message status
- **Time Display**: Shows scheduled time and countdown

### 5. Chat List Integration

- **Header Button**: Clock icon in ChatListScreen header
- **Badge**: Shows count of pending scheduled messages
- **Navigation**: Opens ScheduledMessagesScreen

### 6. Cloud Functions (`firebase/functions/src/index.ts`)

#### `processScheduledMessages`

- Runs every 1 minute via Cloud Scheduler
- Queries pending messages where `scheduledFor <= now`
- Delivers messages by creating them in the chat
- Updates chat's `lastMessage` field
- Marks scheduled message as "sent" with `sentAt` timestamp
- Handles errors by marking messages as "failed" with reason

#### `onScheduledMessageCreated`

- Firestore trigger on new scheduled message creation
- Logs creation details for monitoring

#### `cleanupOldScheduledMessages`

- Runs daily at 3 AM UTC
- Removes scheduled messages older than 30 days (sent, cancelled, or failed)
- Prevents database bloat

### 7. Firestore Rules

```javascript
match /ScheduledMessages/{messageId} {
  allow read: if isAuth() && request.auth.uid == resource.data.senderId;
  allow create: if isAuth() &&
    request.auth.uid == request.resource.data.senderId &&
    request.resource.data.status == 'pending' &&
    request.resource.data.scheduledFor is timestamp &&
    request.resource.data.scheduledFor > request.time &&
    validStringLength(request.resource.data.content, 1, 2000) &&
    request.resource.data.type in ['text', 'image'];
  allow update: if isAuth() &&
    request.auth.uid == resource.data.senderId &&
    resource.data.status == 'pending';
  allow delete: if isAuth() && request.auth.uid == resource.data.senderId;
}
```

### 8. Firestore Indexes

Added 4 composite indexes for efficient querying:

1. `senderId` + `scheduledFor` (ASC)
2. `senderId` + `status` + `scheduledFor`
3. `senderId` + `chatId` + `status` + `scheduledFor`
4. `status` + `scheduledFor` (for Cloud Function queries)

### 9. Type Definitions (`src/types/models.ts`)

```typescript
export type ScheduledMessageStatus =
  | "pending"
  | "sent"
  | "cancelled"
  | "failed";

export interface ScheduledMessage {
  id: string;
  senderId: string;
  recipientId: string;
  chatId: string;
  content: string;
  type: "text" | "image";
  scheduledFor: number;
  createdAt: number;
  status: ScheduledMessageStatus;
  sentAt?: number;
  failReason?: string;
}
```

## Files Created/Modified

### New Files

- `src/components/ScheduleMessageModal.tsx` - Modal for scheduling
- `src/services/scheduledMessages.ts` - Full service layer
- `src/screens/chat/ScheduledMessagesScreen.tsx` - Management screen
- `PHASE_17_PREP.md` - Planning document
- `PHASE_17_COMPLETE.md` - This file

### Modified Files

- `src/types/models.ts` - Added ScheduledMessage types
- `src/screens/chat/ChatScreen.tsx` - Added schedule button and modal
- `src/screens/chat/ChatListScreen.tsx` - Added header button with badge
- `src/navigation/RootNavigator.tsx` - Added ScheduledMessagesScreen route
- `firebase/firestore.rules` - Added ScheduledMessages collection rules
- `firebase/firestore.indexes.json` - Added required composite indexes
- `firebase/functions/src/index.ts` - Added Cloud Functions for delivery

## User Flow

1. **Composing**: User types a message in ChatScreen
2. **Scheduling**: User taps clock icon to open schedule modal
3. **Selecting Time**: User picks a quick option or enters custom date/time
4. **Confirming**: User taps "Schedule Message" button
5. **Feedback**: Alert confirms the scheduled time
6. **Managing**: User can view all scheduled messages from chat list header
7. **Delivery**: Cloud Function automatically sends at scheduled time
8. **Notification**: Recipient receives normal message notification

---

## Part B: Leaderboards (Per Guide)

### 1. Leaderboard Types (`src/types/models.ts`)

```typescript
export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  avatarConfig: AvatarConfig;
  score: number;
  updatedAt: number;
  rank?: number;
}

export type WeekKey = string; // Format: "2026-W03"
```

### 2. Leaderboards Service (`src/services/leaderboards.ts`)

- `getWeeklyLeaderboard()` - Fetch top 100 global entries for a game/week
- `getFriendsLeaderboard()` - Fetch leaderboard filtered to friends only
- `getUserRank()` - Get user's rank in global leaderboard
- `updateLeaderboardEntry()` - Client-side fallback (prefer Cloud Function)
- `getRankDisplay()` - Format rank with emoji (🥇, 🥈, 🥉)
- `formatWeekKey()` - Human-readable week display

### 3. LeaderboardScreen (`src/screens/games/LeaderboardScreen.tsx`)

- **Game Selector**: Toggle between Reaction Time and Speed Tap
- **View Selector**: Toggle between Global and Friends-only
- **Week Navigation**: View current or previous weeks
- **User Rank Card**: Highlights user's current position
- **Ranked List**: Shows avatar, name, score, and rank for each entry

### 4. Firestore Structure

```
Leaderboards/{gameId}_{weekKey}/Entries/{uid}
  - uid: string
  - displayName: string
  - avatarConfig: object
  - score: number
  - updatedAt: timestamp
```

---

## Part C: Achievements (Per Guide)

### 1. Achievement Types (`src/types/models.ts`)

16 achievement types across 4 categories:

- **Game**: first_play, reaction_master, speed_demon, 10_sessions, 50_sessions
- **Streak**: 3_days, 7_days, 30_days, 100_days
- **Social**: first_friend, 10_friends, first_snap, 100_snaps, first_story
- **Collection**: first_cosmetic, full_set

### 2. Achievements Service (`src/services/achievements.ts`)

- `ACHIEVEMENT_DEFINITIONS` - Static definitions with name, description, icon, rarity
- `getUserAchievements()` - Fetch all user achievements
- `hasAchievement()` - Check if user has specific achievement
- `grantAchievement()` - Grant achievement (prefer Cloud Function)
- `checkGameAchievements()` - Check and grant game-related achievements
- `checkStreakAchievements()` - Check and grant streak achievements
- `getRarityColor()` - Get color for rarity display
- `getCompletionPercentage()` - Calculate completion percentage

### 3. AchievementsScreen (`src/screens/games/AchievementsScreen.tsx`)

- **Summary Card**: Shows total earned/total with progress bar
- **Category Sections**: Grouped by Game, Streak, Social, Collection
- **Achievement Cards**: Icon, name, description, rarity chip, earned status
- **Locked/Unlocked States**: Visual distinction between earned and unearned

### 4. Firestore Structure

```
Users/{uid}/Achievements/{achievementType}
  - type: string
  - earnedAt: timestamp
  - meta?: { score?, gameId?, streakCount? }
```

---

## Part D: Cloud Functions (Combined)

### Scheduled Messages Functions

- `processScheduledMessages` - Runs every 1 minute
- `onScheduledMessageCreated` - Logs creation
- `cleanupOldScheduledMessages` - Daily cleanup

### Leaderboard Functions

- `onGameSessionCreated` - Updates leaderboard on new game session
- `weeklyLeaderboardReset` - Weekly notification (Mondays)

### Achievement Functions

- `onGameSessionCreated` - Also checks game achievements
- `onStreakAchievementCheck` - Checks streak achievements on streak update
- `grantAchievementIfNotEarned()` - Helper to prevent duplicates

### Anti-Cheat Validation

- `isValidScore()` - Validates score bounds:
  - Reaction time: 100ms - 2000ms
  - Tap count: 1 - 200

---

## Deployment Steps

### 1. Deploy Firestore Rules

```bash
cd snapstyle-mvp
npx firebase deploy --only firestore:rules
```

### 2. Deploy Firestore Indexes

```bash
npx firebase deploy --only firestore:indexes
```

### 3. Deploy Cloud Functions

```bash
cd firebase/functions
npm install
npm run build
cd ../..
npx firebase deploy --only functions
```

## Testing Checklist

### Scheduled Messages

- [ ] Type a message and tap schedule button
- [ ] Verify modal opens with quick options
- [ ] Select "In 1 hour" and verify preview
- [ ] Try custom date/time input
- [ ] Verify validation for past times
- [ ] Schedule a message and verify alert
- [ ] Check ScheduledMessages collection in Firestore
- [ ] Access scheduled messages list from chat header
- [ ] Cancel a pending message
- [ ] Filter by different statuses
- [ ] Wait for scheduled time and verify delivery
- [ ] Verify message appears in chat
- [ ] Verify notification sent to recipient

### Leaderboards

- [ ] Navigate to Games Hub > Leaderboards
- [ ] Play a game and check leaderboard entry created
- [ ] Toggle between Reaction and Speed Tap games
- [ ] Toggle between Global and Friends views
- [ ] Navigate to previous weeks
- [ ] Verify user rank is displayed

### Achievements

- [ ] Navigate to Games Hub > Achievements
- [ ] Play first game and verify "First Game" achievement
- [ ] Check achievement appears in list
- [ ] Verify progress bar updates
- [ ] Achieve reaction time < 200ms for "Lightning Reflexes"
- [ ] Achieve 100+ taps for "Speed Demon"

## Architecture Notes

- Scheduled messages stored in top-level `ScheduledMessages` collection
- Cloud Function runs as cron job every minute
- Messages moved to `Chats/{chatId}/Messages` on delivery
- Original scheduled message kept for audit trail
- Auto-cleanup after 30 days for processed messages

## Deployment Status

✅ **Firestore Rules** - Deployed successfully  
✅ **Firestore Indexes** - Deployed successfully (Entries composite indexes)  
✅ **Cloud Functions** - All 13 functions deployed:

- `onGameSessionCreated` - NEW (leaderboard + achievement triggers)
- `onStreakAchievementCheck` - NEW (streak achievement monitoring)
- `weeklyLeaderboardReset` - NEW (weekly cron job)
- `processScheduledMessages` - Updated
- `onScheduledMessageCreated` - Updated
- `cleanupOldScheduledMessages` - Updated
- Plus 7 existing functions updated

## Phase 17 Status: ✅ COMPLETE
