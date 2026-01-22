# Phase 17: Scheduled Messages - Planning Document

## Overview

Phase 17 implements the ability to schedule messages to be sent at a future time. Users can compose a message and choose when it should be delivered to their friend.

## Feature Scope

### Core Features

1. **Schedule Message UI** - Button in chat to schedule instead of send immediately
2. **Date/Time Picker** - Select when the message should be sent
3. **Scheduled Messages List** - View and manage pending scheduled messages
4. **Cancel/Edit Scheduled** - Ability to cancel or modify scheduled messages
5. **Cloud Function Delivery** - Server-side scheduled message delivery

### User Flow

1. User opens chat with a friend
2. Types a message
3. Long-press send button OR tap schedule icon
4. Date/time picker modal appears
5. User selects date and time
6. Message is saved as "scheduled" in Firestore
7. Cloud Function runs periodically to send due messages
8. When time arrives, message is delivered as normal message

## Data Model

### ScheduledMessage Collection

```typescript
interface ScheduledMessage {
  id: string;
  senderId: string; // Who scheduled it
  recipientId: string; // Who will receive it
  chatId: string; // Target chat ID
  content: string; // Message content
  type: "text" | "image"; // Message type
  scheduledFor: Timestamp; // When to send
  createdAt: Timestamp; // When scheduled
  status: "pending" | "sent" | "cancelled" | "failed";
  sentAt?: Timestamp; // When actually sent
  failReason?: string; // If failed, why
}
```

## Implementation Plan

### 1. Data Layer (`src/types/models.ts`)

- Add `ScheduledMessage` interface
- Add `ScheduledMessageStatus` type

### 2. Service Layer (`src/services/scheduledMessages.ts`)

New service with functions:

- `scheduleMessage()` - Create scheduled message
- `getScheduledMessages()` - Get user's scheduled messages
- `cancelScheduledMessage()` - Cancel a pending message
- `updateScheduledMessage()` - Edit message or time
- `subscribeToScheduledMessages()` - Real-time updates

### 3. Firestore Security Rules

```javascript
match /ScheduledMessages/{messageId} {
  // Only sender can read their scheduled messages
  allow read: if isAuth() &&
                request.auth.uid == resource.data.senderId;

  // Only sender can create
  allow create: if isAuth() &&
                  request.auth.uid == request.resource.data.senderId &&
                  request.resource.data.status == 'pending' &&
                  request.resource.data.scheduledFor > request.time;

  // Only sender can update (cancel or modify)
  allow update: if isAuth() &&
                  request.auth.uid == resource.data.senderId &&
                  resource.data.status == 'pending';

  // Only sender can delete
  allow delete: if isAuth() &&
                  request.auth.uid == resource.data.senderId;
}
```

### 4. UI Components

#### ScheduleMessageModal

- Date picker for selecting day
- Time picker for selecting hour/minute
- Quick options: "In 1 hour", "Tomorrow 9 AM", "Tomorrow 6 PM"
- Preview of when message will be sent
- Confirm/Cancel buttons

#### ScheduledMessagesList (in ChatScreen or separate screen)

- List of pending scheduled messages
- Swipe to cancel
- Tap to edit
- Shows countdown to delivery

### 5. ChatScreen Integration

- Long-press on send button to show schedule option
- OR add clock icon next to send button
- Show indicator when viewing chat with scheduled messages

### 6. Cloud Function (`processScheduledMessages`)

```typescript
// Runs every minute via Cloud Scheduler
export const processScheduledMessages = functions.pubsub
  .schedule("every 1 minutes")
  .onRun(async (context) => {
    // Query messages where scheduledFor <= now AND status == 'pending'
    // For each message:
    //   1. Send the actual message via sendMessage()
    //   2. Update status to 'sent'
    //   3. Send push notification
  });
```

## Technical Considerations

### Timezone Handling

- Store all times as UTC Timestamps
- Convert to local time for display
- Use user's device timezone for picker

### Edge Cases

1. **User blocked after scheduling** - Check block status before sending
2. **Chat deleted** - Skip sending, mark as failed
3. **Message too old** - If scheduled > 7 days ago and not sent, mark failed
4. **Network failure** - Retry logic in Cloud Function

### Firestore Indexes

```json
{
  "collectionGroup": "ScheduledMessages",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "senderId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "scheduledFor", "order": "ASCENDING" }
  ]
}
```

## Testing Checklist

- [ ] Schedule a message for 1 minute in future
- [ ] Verify message appears in scheduled list
- [ ] Wait for message to be sent automatically
- [ ] Verify recipient receives message
- [ ] Test cancelling a scheduled message
- [ ] Test editing a scheduled message
- [ ] Test scheduling image/snap
- [ ] Test timezone handling
- [ ] Test blocking after scheduling

## Files to Create/Modify

### New Files

1. `src/services/scheduledMessages.ts` - Service layer
2. `src/components/ScheduleMessageModal.tsx` - UI component
3. `src/components/ScheduledMessagesList.tsx` - List component
4. `firebase/functions/src/scheduled.ts` - Cloud Function

### Modified Files

1. `src/types/models.ts` - Add types
2. `firebase/firestore.rules` - Add rules
3. `firebase/firestore.indexes.json` - Add indexes
4. `src/screens/chat/ChatScreen.tsx` - Add schedule option
5. `firebase/functions/src/index.ts` - Export new function

## Timeline

- Data model & service: 30 min
- Firestore rules: 10 min
- UI components: 45 min
- ChatScreen integration: 20 min
- Cloud Function: 30 min
- Testing: 20 min

**Total: ~2.5 hours**

---

**Phase 17 Status: PLANNING** 📋
