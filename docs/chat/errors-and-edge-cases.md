# Errors & Edge Cases

> A "what can go wrong" encyclopedia with exact mitigations in code.

---

## 1. Send Failures

### 1.1. Network Offline

| Aspect         | Detail                                                                          |
| -------------- | ------------------------------------------------------------------------------- |
| **Symptom**    | Message shows "sending" state indefinitely                                      |
| **Mitigation** | Outbox persists to AsyncStorage; `useOutboxProcessor` retries on reconnect      |
| **User sees**  | Optimistic message with spinner; `NetworkBanner` shows offline indicator        |
| **Code**       | `src/services/outbox.ts :: enqueueMessage()`, `src/hooks/useOutboxProcessor.ts` |

### 1.2. Rate Limit Exceeded

| Aspect         | Detail                                                               |
| -------------- | -------------------------------------------------------------------- |
| **Symptom**    | CF returns `resource-exhausted` error                                |
| **Limit**      | 30 messages/minute per conversation                                  |
| **Mitigation** | Error propagated to UI; outbox marks item as `"failed"`              |
| **User sees**  | Error toast: "Too many messages, please wait"                        |
| **Code**       | `firebase-backend/functions/src/messaging.ts` rate limit transaction |

### 1.3. Blocked by Recipient

| Aspect         | Detail                                                             |
| -------------- | ------------------------------------------------------------------ |
| **Symptom**    | CF returns `permission-denied`                                     |
| **Mitigation** | Error propagated; outbox marks `"failed"`                          |
| **User sees**  | Error toast: "Cannot send message" (generic, doesn't reveal block) |
| **Code**       | `firebase-backend/functions/src/messaging.ts` block check          |

### 1.4. Not a Member

| Aspect         | Detail                                                         |
| -------------- | -------------------------------------------------------------- |
| **Symptom**    | CF returns `permission-denied`                                 |
| **Cause**      | User was removed from group, or chat doc doesn't exist         |
| **Mitigation** | Client should navigate away; outbox marks `"failed"`           |
| **Code**       | `firebase-backend/functions/src/messaging.ts` membership check |

### 1.5. Text Too Long

| Aspect           | Detail                                                                  |
| ---------------- | ----------------------------------------------------------------------- |
| **Symptom**      | CF returns `invalid-argument`                                           |
| **Limit**        | 10,000 characters (`MAX_MESSAGE_TEXT_LENGTH`)                           |
| **Client check** | Composer should prevent this; type constant in `src/types/messaging.ts` |
| **Mitigation**   | CF validates; client should also validate                               |

### 1.6. Too Many Attachments

| Aspect           | Detail                                                    |
| ---------------- | --------------------------------------------------------- |
| **Limit**        | 10 attachments (`MAX_ATTACHMENTS_PER_MESSAGE`), 10MB each |
| **Client check** | `useAttachmentPicker` enforces `maxAttachments`           |
| **Server check** | CF validates array length                                 |

### 1.7. Idempotency Conflict

| Aspect         | Detail                                                                    |
| -------------- | ------------------------------------------------------------------------- |
| **Symptom**    | CF returns `already-exists` with conflict marker                          |
| **Cause**      | Two devices tried to create message with same ID but different `clientId` |
| **Frequency**  | Extremely rare (UUID collision)                                           |
| **Mitigation** | Client should generate a new `messageId` and retry                        |

---

## 2. Edit Failures

### 2.1. Edit Window Expired

| Aspect           | Detail                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Window**       | 15 minutes (`EDIT_WINDOW_MS = 900000ms`)                                                                             |
| **Client check** | `canEdit()` in `src/types/messaging.ts` uses `Date.now()`                                                            |
| **Server check** | CF uses `FieldValue.serverTimestamp()` comparison                                                                    |
| **Gap**          | Client and server clocks may differ by seconds → possible edge case at boundary                                      |
| **User sees**    | Error toast: "Edit window expired"                                                                                   |
| **Code**         | `src/services/messageActions.ts :: canEditMessage()`, `firebase-backend/functions/src/messaging.ts :: editMessageV2` |

### 2.2. Edit Non-Text Message

| Aspect           | Detail                                                                    |
| ---------------- | ------------------------------------------------------------------------- |
| **Symptom**      | CF returns `failed-precondition`                                          |
| **Rule**         | Only `kind: "text"` messages can be edited                                |
| **Client check** | UI should only show "Edit" for text messages                              |
| **Code**         | `firebase-backend/functions/src/messaging.ts :: editMessageV2` validation |

### 2.3. Edit Already-Deleted Message

| Aspect         | Detail                                                                          |
| -------------- | ------------------------------------------------------------------------------- |
| **Symptom**    | CF returns `failed-precondition`                                                |
| **Cause**      | Another user (or admin) deleted the message between UI display and edit attempt |
| **Mitigation** | CF checks `deletedForAll`; returns error                                        |

---

## 3. Delete Failures

### 3.1. Delete-for-All Without Permission

| Aspect         | Detail                                                                 |
| -------------- | ---------------------------------------------------------------------- |
| **DM rule**    | Only sender, within edit window                                        |
| **Group rule** | Sender (within window) or admin/owner (any time)                       |
| **Symptom**    | CF returns `permission-denied`                                         |
| **Code**       | `firebase-backend/functions/src/messaging.ts :: deleteMessageForAllV2` |

### 3.2. Delete-for-Me Fails

| Aspect               | Detail                                                     |
| -------------------- | ---------------------------------------------------------- |
| **Mechanism**        | Direct Firestore write (`arrayUnion` to `hiddenFor`)       |
| **Possible failure** | Firestore rules reject if `request.auth.uid` doesn't match |
| **Mitigation**       | Service catches error and shows toast                      |
| **Code**             | `src/services/messageActions.ts :: deleteMessageForMe()`   |

---

## 4. Reaction Failures

### 4.1. Rate Limited

| Aspect        | Detail                                     |
| ------------- | ------------------------------------------ |
| **Limit**     | 10 reactions/min per user per conversation |
| **Symptom**   | CF returns `resource-exhausted`            |
| **User sees** | Brief error; reaction not applied          |

### 4.2. Max Emojis Reached

| Aspect           | Detail                                                          |
| ---------------- | --------------------------------------------------------------- |
| **Limit**        | 12 unique emoji types per message (`MAX_REACTIONS_PER_MESSAGE`) |
| **Symptom**      | CF returns `failed-precondition`                                |
| **Client check** | `reactions.ts :: canAddReaction()` checks locally               |

### 4.3. Invalid Emoji

| Aspect           | Detail                                                   |
| ---------------- | -------------------------------------------------------- |
| **Allowlist**    | 16 emojis hardcoded in CF and client                     |
| **Symptom**      | CF returns `invalid-argument`                            |
| **Client check** | `reactions.ts :: isAllowedEmoji()` validates before call |

---

## 5. Subscription Failures

### 5.1. Permission Denied on Subscription

| Aspect         | Detail                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------- |
| **Cause**      | User removed from group; chat doc deleted; auth token expired                                 |
| **Symptom**    | `onSnapshot` fires error callback                                                             |
| **Mitigation** | `useUnifiedMessages` sets `error` state; screen can display error UI                          |
| **User sees**  | Error message or redirect to inbox                                                            |
| **Code**       | `src/services/messageList.ts` — `onSnapshot` error handler, `src/hooks/useUnifiedMessages.ts` |

### 5.2. Listener Detach Failure

| Aspect         | Detail                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| **Cause**      | Component unmounts while listener is still being set up                                                    |
| **Mitigation** | `useEffect` cleanup returns `unsubscribe()` function                                                       |
| **Code**       | All subscription hooks follow pattern: `useEffect(() => { const unsub = subscribe(); return unsub; }, [])` |

### 5.3. Stale Data After Reconnection

| Aspect          | Detail                                                                           |
| --------------- | -------------------------------------------------------------------------------- |
| **Cause**       | Firestore SDK replays from local cache, then syncs with server                   |
| **Risk**        | Briefly showing old data                                                         |
| **Mitigation**  | Firestore handles this automatically; `metadata.hasPendingWrites` can be checked |
| **Not checked** | Current code doesn't use `metadata.hasPendingWrites` to indicate pending state   |

---

## 6. Presence Failures

### 6.1. RTDB Disconnect Not Firing

| Aspect         | Detail                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| **Cause**      | Network cut abruptly (no clean disconnect); RTDB times out after ~60s                                 |
| **Symptom**    | User shows "online" for up to 60 seconds after going offline                                          |
| **Mitigation** | `onDisconnect()` handler in `presence.ts :: initializePresence()` sets `online: false` and `lastSeen` |
| **Code**       | `src/services/presence.ts`                                                                            |

### 6.2. Multiple Devices

| Aspect         | Detail                                                                                  |
| -------------- | --------------------------------------------------------------------------------------- |
| **Cause**      | User logged in on two devices                                                           |
| **Risk**       | First device disconnect could set user as "offline" while second device is still active |
| **Mitigation** | Not handled — single `status/{uid}` entry; last writer wins                             |
| **Known gap**  | No device-level presence tracking                                                       |

---

## 7. Typing Indicator Edge Cases

### 7.1. Typing Stuck "On"

| Aspect         | Detail                                                                            |
| -------------- | --------------------------------------------------------------------------------- |
| **Cause**      | User starts typing, then app crashes/backgrounded without clearing                |
| **Mitigation** | `TYPING_TIMEOUT_MS = 8000` — client-side timeout auto-clears display              |
| **Server**     | The `typingAt` field persists in Firestore; cleared by timeout on subscriber side |
| **Code**       | `src/hooks/useTypingStatus.ts`                                                    |

### 7.2. Throttle Hides Real-Time Typing

| Aspect        | Detail                                                                    |
| ------------- | ------------------------------------------------------------------------- |
| **Cause**     | `TYPING_THROTTLE_MS = 2000` limits updates                                |
| **Effect**    | Typing indicator may appear with up to 2s delay                           |
| **Trade-off** | Reduces Firestore writes (cost + performance) at the expense of immediacy |

---

## 8. Group-Specific Edge Cases

### 8.1. Owner Leaves Group

| Aspect          | Detail                                                                |
| --------------- | --------------------------------------------------------------------- |
| **Behavior**    | Owner must transfer ownership before leaving                          |
| **Enforcement** | `groupMembers.ts :: leaveAndDeleteGroup()` checks role                |
| **User sees**   | Error: "You must transfer ownership before leaving"                   |
| **Code**        | `src/services/groupMembers.ts`, `src/hooks/useConversationActions.ts` |

### 8.2. Removed While Chatting

| Aspect         | Detail                                                               |
| -------------- | -------------------------------------------------------------------- |
| **Cause**      | Admin removes member while they have the chat open                   |
| **Symptom**    | `onSnapshot` fires `permission-denied` error                         |
| **Mitigation** | Error propagated to screen; should navigate to inbox                 |
| **Gap**        | No server-sent "you were removed" system message currently generated |

### 8.3. Group Full (Max Members)

| Aspect          | Detail                                  |
| --------------- | --------------------------------------- |
| **Limit**       | 20 members (`GROUP_LIMITS.MAX_MEMBERS`) |
| **Enforcement** | `groups.ts` checks before invite/add    |
| **User sees**   | Error: "Group is full"                  |

### 8.4. Invite Expired

| Aspect          | Detail                                                                        |
| --------------- | ----------------------------------------------------------------------------- |
| **Expiry**      | 7 days (`GROUP_LIMITS.INVITE_EXPIRY_DAYS`)                                    |
| **Enforcement** | Client checks `expiresAt`; server doesn't auto-delete expired invites         |
| **Gap**         | Expired invites persist in Firestore until accepted/declined/manually cleaned |

---

## 9. Scheduled Message Edge Cases

### 9.1. Delivery Delay

| Aspect            | Detail                                            |
| ----------------- | ------------------------------------------------- |
| **Cause**         | CF `processScheduledMessages` runs every 1 minute |
| **Maximum delay** | Up to 59 seconds past `scheduledFor`              |
| **Mitigation**    | None — inherent to cron-based approach            |

### 9.2. Conversation Deleted Before Delivery

| Aspect       | Detail                                                                   |
| ------------ | ------------------------------------------------------------------------ |
| **Cause**    | User deletes chat after scheduling message                               |
| **Behavior** | CF tries to write to non-existent chat → marks `status: "failed"`        |
| **Gap**      | User not notified of failure unless they check scheduled messages screen |

### 9.3. Blocked Before Delivery

| Aspect       | Detail                                                                |
| ------------ | --------------------------------------------------------------------- |
| **Cause**    | Recipient blocks sender after message scheduled                       |
| **Behavior** | Depends on CF implementation — if block check included, message fails |
| **Gap**      | `processScheduledMessages` in `legacy.ts` may not check block status  |

---

## 10. Media/Attachment Edge Cases

### 10.1. Upload Fails Mid-Send

| Aspect        | Detail                                                              |
| ------------- | ------------------------------------------------------------------- |
| **Cause**     | Network fails during Storage upload                                 |
| **Symptom**   | `uploadProgress` stuck; eventually errors                           |
| **User sees** | Error; message not sent; attachments and text preserved in composer |
| **Code**      | `src/hooks/useChatComposer.ts` — `onUploadAttachments` error path   |

### 10.2. Orphaned Files in Storage

| Aspect             | Detail                                                     |
| ------------------ | ---------------------------------------------------------- |
| **Cause**          | Upload succeeds but message send fails                     |
| **Risk**           | Files persist in Storage without corresponding message     |
| **Mitigation**     | None — no cleanup job                                      |
| **Recommendation** | Add a periodic cleanup function to delete orphaned uploads |

### 10.3. `attachments.ts` Has Stubs

| Aspect       | Detail                                                    |
| ------------ | --------------------------------------------------------- |
| **Evidence** | File contains "H10" comments marking stub implementations |
| **Impact**   | Some attachment validation/processing may be incomplete   |
| **Code**     | `src/services/attachments.ts`                             |

---

## 11. Link Preview Edge Cases

### 11.1. Slow/Failing Preview Fetch

| Aspect       | Detail                                                                         |
| ------------ | ------------------------------------------------------------------------------ |
| **Timeout**  | CF: 5 seconds; Client: varies                                                  |
| **Fallback** | Message displays without preview; URL remains clickable                        |
| **Caching**  | Successful previews cached 24 hours in Firestore                               |
| **Code**     | `firebase-backend/functions/src/linkPreview.ts`, `src/services/linkPreview.ts` |

### 11.2. Blocked Domain

| Aspect        | Detail                                                               |
| ------------- | -------------------------------------------------------------------- |
| **Behavior**  | CF `fetchLinkPreviewFunction` skips blocked domains                  |
| **User sees** | No preview rendered; URL still displayed                             |
| **Code**      | `BLOCKED_DOMAINS` in `firebase-backend/functions/src/linkPreview.ts` |

---

## 12. V1/V2 Compatibility Edge Cases

### 12.1. Mixed Schema Messages

| Aspect         | Detail                                                                              |
| -------------- | ----------------------------------------------------------------------------------- |
| **Cause**      | Firestore contains both V1-only (old messages) and V2 messages                      |
| **Mitigation** | `DMMessageItem.tsx` reads both `senderId`/`sender`, `text`/`content`, `kind`/`type` |
| **Adapter**    | `messageAdapters.ts :: messageWithProfileToV2()` converts V1 to V2                  |
| **Code**       | `src/utils/messageAdapters.ts`, `src/components/DMMessageItem.tsx`                  |

### 12.2. Legacy Read Field

| Aspect         | Detail                                                                   |
| -------------- | ------------------------------------------------------------------------ |
| **V1**         | `message.read: boolean` — set per-message                                |
| **V2**         | Read receipts via `Members/{uid}.lastReadAtPublic` watermark             |
| **Mitigation** | V2 ignores `read` field; V1 clients can still set it via Firestore rules |
| **Rule**       | Firestore allows updating `read` field as a legacy compat case           |

---

## 13. Error Handling Patterns

### Common Pattern in Services

```typescript
try {
  await firestoreOperation();
} catch (error) {
  log.error("Operation failed", { error, operation: "name" });
  throw error; // Re-throw for caller to handle
}
```

### Common Pattern in Hooks

```typescript
try {
  await service.doThing();
  showSuccess("Done!");
} catch (error) {
  log.error("Failed", error);
  showError("Something went wrong");
}
```

### Missing Error Boundaries

- No React Error Boundaries wrapping chat screens specifically.
- A crash in message rendering crashes the entire chat screen.
- **Recommendation**: Add error boundaries around `ChatMessageList` and `ChatComposer`.

---

## 14. Debugging Guide

### Common Issues

| Issue                      | How to Debug                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Messages not appearing     | Check `onSnapshot` subscription is active (logger tag: `messageList`). Verify Firestore rules allow read. Check `hiddenFor` doesn't include user. |
| Message stuck "sending"    | Check outbox: `outbox.ts :: getOutboxStats()`. Check network status. Look for CF errors in Firebase Console.                                      |
| Typing indicator stuck     | Check `Members/{uid}.typingAt` in Firestore Console. Wait 8s for auto-clear.                                                                      |
| Read receipts not updating | Check `Members/{uid}.lastReadAtPublic`. Verify `sendReadReceipts` privacy setting.                                                                |
| Push notifications missing | Check `MembersPrivate/{uid}.mutedUntil`. Check `Users/{uid}.expoPushToken`. Check CF logs for `onNewMessage`.                                     |
| Reactions not showing      | Check `Reactions/{emoji}` subcollection. Verify `reactionsSummary` on message doc. Check CF `toggleReactionV2` logs.                              |

### Logger Tags

Key logger tags for filtering:

| Tag                      | File                                |
| ------------------------ | ----------------------------------- |
| `useChat`                | `src/hooks/useChat.ts`              |
| `useChatComposer`        | `src/hooks/useChatComposer.ts`      |
| `useUnifiedChatScreen`   | `src/hooks/useUnifiedChatScreen.ts` |
| `messageList`            | `src/services/messageList.ts`       |
| `outbox`                 | `src/services/outbox.ts`            |
| `syncEngine`             | `src/services/sync/syncEngine.ts`   |
| `chatV2`                 | `src/services/chatV2.ts`            |
| `presence`               | `src/services/presence.ts`          |
| `hooks/useLocalMessages` | `src/hooks/useLocalMessages.ts`     |
