# PHASE 4: PHOTO SNAPS (Photo Capture, Send, View-Once)

**Status:** Ready to Implement
**Date:** January 19, 2026
**Complexity:** Medium (camera integration, storage uploads, view-once tracking)

---

## Overview

Phase 4 extends the chat system to support ephemeral photo snaps. Users can capture or select photos, send them to friends, and view them in a fullscreen viewer. Photos are deleted immediately after viewing (view-once flow) or auto-deleted via TTL if unopened after 24 hours.

**Key Features:**

- ✅ Capture photos via camera or select from gallery
- ✅ Compress/resize images before upload (expo-image-manipulator)
- ✅ Upload to Firebase Storage at `snaps/{chatId}/{messageId}.jpg`
- ✅ Send as message with type: "image" (content = storagePath)
- ✅ Fullscreen snap viewer with download on tap
- ✅ Mark snap opened (set openedAt + openedBy) and delete message doc
- ✅ Auto-delete unopened snaps after 24h (TTL)
- ✅ Cloud Function cleanup: delete Storage object when message doc deleted

---

## Dependencies to Install

Currently NOT installed in `package.json`:

```bash
npm install expo-camera expo-image-picker expo-image-manipulator
```

**Package details:**

- `expo-camera@~16.0.0` - Camera capture with preview
- `expo-image-picker@~16.0.1` - Select photos from device gallery
- `expo-image-manipulator@~12.0.1` - Resize/compress images

**Note:** All three are standard Expo modules; no native module setup required in managed workflow.

---

## Firestore Schema Updates

### Message Type Extended

The Message interface already supports type: "image":

```typescript
export interface Message {
  id: string;
  sender: string;
  type: "text" | "image"; // ← Already prepared in Phase 3
  content: string; // ← Text OR storagePath for images
  createdAt: number;
  expiresAt: number; // ← Still applies: 24h expiry
  read: boolean;
  readAt?: number;
  openedAt?: timestamp; // ← NEW: When snap was opened
  openedBy?: string; // ← NEW: Who opened it
}
```

**No schema changes needed** — Message docs already support image metadata.

---

## Service Layer: `src/services/storage.ts` (NEW)

Create new service file for all Storage operations:

### Functions to Implement

```typescript
/**
 * Upload snap image to Storage at snaps/{chatId}/{messageId}.jpg
 * Expects image to already be compressed before upload
 * Returns storagePath for saving in Message document
 */
export async function uploadSnapImage(
  chatId: string,
  messageId: string,
  imageUri: string, // Local file URI from camera/picker
): Promise<string>; // Returns "snaps/{chatId}/{messageId}.jpg"

/**
 * Download snap image from Storage
 * Used in fullscreen viewer before displaying
 */
export async function downloadSnapImage(storagePath: string): Promise<string>; // Returns local cache URI or public URL

/**
 * Delete snap image from Storage
 * Called when message doc is deleted (view-once) or after viewing
 */
export async function deleteSnapImage(storagePath: string): Promise<void>;

/**
 * Compress image before upload
 * Resize to max 1024px, JPEG quality 0.7
 * Reduces file size from MB to ~50-200KB
 */
export async function compressImage(
  imageUri: string,
  maxSize: number = 1024,
  quality: number = 0.7,
): Promise<string>; // Returns compressed image URI
```

### Implementation Details

**`uploadSnapImage()`:**

- Uses Firebase Storage reference at `snaps/{chatId}/{messageId}.jpg`
- Uploads binary JPEG data from compressed image
- Returns storage path string for Message.content field
- Error handling: logs and throws for UI to catch

**`downloadSnapImage()`:**

- Uses Firebase Storage reference from storagePath
- Downloads to device cache (expo-file-system or similar)
- Returns local URI for Image component to display
- Caching: avoid re-downloading same snap if user views multiple times

**`deleteSnapImage()`:**

- Uses Firebase Storage reference from storagePath
- Deletes file; errors (file not found) are acceptable
- Called from message deletion handler and Cloud Function

**`compressImage()`:**

- Uses expo-image-manipulator to resize and compress
- If image larger than 1024px: scale proportionally
- JPEG quality 0.7 balances quality vs. file size
- Returns local URI of compressed image (in app cache)

---

## Chat Service Updates: `src/services/chat.ts`

### Existing `sendMessage()` Extended

Update to support image type:

```typescript
export async function sendMessage(
  chatId: string,
  sender: string,
  content: string,
  type: "text" | "image" = "text",
): Promise<void> {
  // If type: "image", content should be storagePath
  // If type: "text", content is message text (max 500 chars)
  // Create message doc with expiresAt = now + 24h
  // Update chat metadata
  // Call updateStreak for snaps too (counts toward daily exchange)
}
```

### New Function: Mark Snap Opened

```typescript
/**
 * Mark snap as opened and delete message document
 * Called when user closes fullscreen snap viewer
 * Records who opened it and when for author analytics (future)
 * Then immediately deletes the message doc (view-once)
 */
export async function markSnapOpened(
  chatId: string,
  messageId: string,
  openedBy: string,
): Promise<void>;
```

**Behavior:**

1. Update Messages/{messageId}:
   - Set `openedAt`: current timestamp
   - Set `openedBy`: UID of viewer
2. Delete Messages/{messageId} immediately after updating
3. Caller should also call `deleteSnapImage()` from storage service
4. This is the "view-once" enforcement — once opened, message vanishes

---

## UI Updates

### ChatScreen Extensions

Update `src/screens/chat/ChatScreen.tsx`:

**New UI Elements:**

1. **Photo Capture Button**
   - Add button below text input (or as part of input row)
   - Icon: Camera 📷 (Material Community Icons)
   - On press: show ActionSheetIOS or Platform.select modal:
     ```
     [ ] Take Photo (camera capture)
     [ ] Choose from Gallery (image picker)
     [ ] Cancel
     ```

2. **Image Message Rendering**
   - Update message bubble rendering:
     - Type "text": render as before (text content)
     - Type "image": render as lock icon 🔒 or placeholder
     - Show preview thumbnail (optional, requires download)
     - On tap: navigate to SnapViewerScreen

**Permissions Requests:**

- Import `expo-permissions` or use built-in permission requests
- Request "camera" permission before opening camera
- Request "media library" permission before opening gallery
- Handle permission denial gracefully (show alert)

**Upload Flow (on send):**

```
User taps camera button
  ↓
User captures or selects photo
  ↓
Show loading indicator: "Compressing..."
  ↓
Call compressImage() → get compressed URI
  ↓
Show loading: "Uploading..."
  ↓
Generate messageId
  ↓
Call uploadSnapImage(chatId, messageId, compressedUri)
  ↓
Get storagePath back
  ↓
Call sendMessage(chatId, sender, storagePath, "image")
  ↓
Message appears as 🔒 in chat list
  ↓
Loading clears, ready for next message
```

---

### SnapViewerScreen (NEW)

Create `src/screens/chat/SnapViewerScreen.tsx` - fullscreen snap viewer:

**Purpose:** Fullscreen display of snap before auto-deletion

**Navigation:**

- Accessed from ChatScreen when user taps an image message
- Route param: `{ messageId, chatId, storagePath }`

**Features:**

1. **Fullscreen Layout:**
   - Full screen image display
   - No status bar (or transparent overlay)
   - Black background behind image
   - Image centered and scaled to fit screen (maintain aspect ratio)

2. **Download & Display:**
   - On mount: show spinner "Loading..."
   - Call `downloadSnapImage(storagePath)` to get image
   - When ready: display image
   - Cache the image URI to avoid re-downloads

3. **User Interaction:**
   - User can pinch-zoom to examine details (optional: add gesture handlers)
   - User taps to dismiss (or swipe down, or X button in corner)
   - Timer (optional): auto-dismiss after 3 seconds
   - Show countdown if auto-dismiss enabled

4. **On Dismiss:**
   - Call `markSnapOpened(chatId, messageId, currentUid)` to:
     - Record opening metadata
     - Delete message doc from Firestore (view-once)
   - Call `deleteSnapImage(storagePath)` to:
     - Remove from Storage (cleanup)
   - Show brief feedback: "Snap deleted" (optional toast)
   - Navigate back to ChatScreen
   - Chat list auto-updates (message gone)

5. **Error Handling:**
   - If download fails: show alert "Failed to load snap"
   - If deletion fails: still navigate back (log error, Storage cleanup happens via Cloud Function fallback)
   - Network errors: show alert and let user retry

---

## Navigation Updates

Update `src/navigation/RootNavigator.tsx`:

Add SnapViewerScreen to ChatStackNavigator:

```typescript
ChatStack.Screen
  name="SnapViewer"
  component={SnapViewerScreen}
  options={{
    headerShown: false,        // Full screen
    animationEnabled: true,
    presentation: "modal",     // Slide in from bottom (iOS) / fade (Android)
  }}
```

ChatScreen navigation call:

```typescript
navigation.navigate("SnapViewer", {
  messageId: message.id,
  chatId: chatId,
  storagePath: message.content,
});
```

---

## Firebase Storage Rules

Update `storage.rules` (deploy to Firebase Console):

```
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    // Snaps: members of a chat can read/write snaps for that chat
    match /snaps/{chatId}/{messageId=**} {
      allow read, write: if request.auth != null &&
                           isChatMember(chatId, request.auth.uid);
    }

    // Helper function: check if user is member of chat
    function isChatMember(chatId, uid) {
      let chatDoc = firestore.get(
        /databases/(default)/documents/Chats/$(chatId)
      );
      return chatDoc.data.members.hasAny([uid]);
    }
  }
}
```

**Deployment:**

- Go to Firebase Console → Storage → Rules tab
- Copy rules above into editor
- Click "Publish"

---

## Cloud Function: Message Cleanup

Create `firebase/functions/src/cleanup.ts` - auto-delete Storage files when messages expire:

```typescript
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Triggered when a message document is deleted
 * Cleans up associated Storage object if it's an image snap
 */
export const onDeleteMessage = functions.firestore
  .document("Chats/{chatId}/Messages/{messageId}")
  .onDelete(async (snap, context) => {
    const message = snap.data();
    const { chatId } = context.params;

    // Only process image messages
    if (message.type !== "image") {
      return;
    }

    const storagePath = message.content; // e.g., "snaps/chatId/messageId.jpg"

    try {
      const bucket = admin.storage().bucket();
      await bucket.file(storagePath).delete();
      console.log(`Deleted storage object: ${storagePath}`);
    } catch (error: any) {
      // File may already be deleted or not exist; this is OK
      if (error.code !== 404) {
        console.error(`Error deleting storage file: ${error.message}`);
      }
    }
  });
```

**Deployment:**

```bash
cd firebase/functions
npm install  # if needed
firebase deploy --only functions:onDeleteMessage
```

---

## Firestore Security Rules Update

Add rule for Messages subcollection to allow delete after reading:

```firestore
// Already exists from Phase 3, but ensure it allows:
match /Chats/{chatId} {
  match /Messages/{messageId} {
    // Users in chat can read messages
    allow read: if request.auth != null &&
                 isChatMember(request.auth.uid, resource.data.chatId);

    // Sender creates messages
    allow create: if request.auth != null &&
                   request.auth.uid == request.resource.data.sender;

    // Current user can update (mark opened) and delete after opening
    allow update, delete: if request.auth != null &&
                           isChatMember(request.auth.uid, get(/databases/(default)/documents/Chats/$(chatId)).data.members);
  }
}
```

---

## Definition of Done

✅ expo-camera, expo-image-picker, expo-image-manipulator installed
✅ Storage service (upload, download, delete, compress) fully implemented
✅ Chat service extended to support image messages
✅ Chat screen has camera button + image picker modal
✅ Image compression works (>1MB → ~50-200KB)
✅ Upload to Storage path `snaps/{chatId}/{messageId}.jpg` works
✅ Message doc stores storagePath (not URL)
✅ Image messages render as 🔒 lock icon in chat list
✅ Tap image → SnapViewerScreen with fullscreen display
✅ On snap viewer close: markSnapOpened() called → message deleted (view-once)
✅ Cloud Function cleanup deletes Storage file when message doc deleted
✅ TTL still applies: unopened snaps auto-delete after 24h
✅ Firebase Storage rules deployed (chat members can read snaps)
✅ Firestore rules allow message deletion after viewing
✅ TypeScript strict mode passes (0 errors)
✅ App compiles and runs without errors

---

## Manual Firestore Configuration

1. **Firebase Storage Rules:**
   - Go to Firebase Console → Storage → Rules
   - Deploy rules from `storage.rules` (see Security Rules section above)

2. **Firestore TTL (already configured from Phase 3):**
   - Verify `expiresAt` field is still configured for Messages collection
   - No additional setup needed (snaps use same TTL as text messages)

3. **Deploy Cloud Function:**

   ```bash
   cd firebase/functions
   firebase deploy --only functions:onDeleteMessage
   ```

   - Verifies function can access Firestore and Storage
   - Enables automatic cleanup when messages are deleted

4. **Firestore Indexes (if needed):**
   - If querying large chat collections, Firestore will suggest indexes
   - Usually auto-created on first query; monitor Firebase Console

---

## Testing Instructions (Manual on Emulator/Device)

### Prerequisites

- Two test accounts in Friends list
- Both have chat open or available

### Test 1: Capture Photo with Camera

**Steps:**

1. Sign in as User A
2. Open chat with User B
3. Tap camera button (📷)
4. Select "Take Photo" option
5. Camera preview opens
6. Point at anything, tap capture button
7. Confirm/accept captured photo
8. Verify loading states: "Compressing..." → "Uploading..."
9. Check chat list:
   - Image message appears as 🔒 lock icon (not thumbnail)
   - Chat updated with recent timestamp

**Expected Result:** ✅ Photo captured, uploaded, appears as lock icon in chat

### Test 2: Select Photo from Gallery

**Steps:**

1. Open chat with User B
2. Tap camera button (📷)
3. Select "Choose from Gallery" option
4. Gallery picker opens
5. Select existing photo from device
6. Confirm/accept
7. Verify loading states: "Compressing..." → "Uploading..."
8. Chat updates with 🔒 lock icon

**Expected Result:** ✅ Gallery photo selected, uploaded, appears in chat

### Test 3: View Snap (View-Once)

**Steps:**

1. User B's device: open chat, see 🔒 icon from User A's snap
2. Tap the 🔒 icon
3. SnapViewerScreen opens (fullscreen)
4. Photo displays with loading spinner initially
5. Once loaded: full image visible, centered, black background
6. (Optional) pinch-zoom to inspect
7. Tap screen or wait 3 seconds (if auto-dismiss enabled)
8. Snap viewer closes, navigates back to chat
9. Verify:
   - Message 🔒 is GONE from chat list (deleted)
   - Toast shows "Snap deleted" (if enabled)

**Expected Result:** ✅ Snap opens fullscreen, auto-closes, message deleted (view-once works)

### Test 4: Unopened Snap TTL (24-Hour Expiry)

**Note:** Production test takes 24 hours. For quick testing:

**Steps:**

1. User A sends snap to User B
2. User B does NOT open it (leave 🔒 in chat)
3. (Wait 24 hours in production, or manually set expiresAt to past time in Firestore Console)
4. After 24h, TTL auto-deletes the message doc
5. When User B refreshes chat or reopens app:
   - 🔒 message is gone
   - Storage file is deleted (via Cloud Function)

**Expected Result:** ✅ After 24h, unopened snap auto-deleted via TTL

### Test 5: Storage Cleanup on Delete

**Steps (Simulating deletion):**

1. User A sends snap to User B
2. User B opens snap → message deleted, snap viewer closes
3. Go to Firebase Console → Storage → snaps folder
4. Verify:
   - File `snaps/{chatId}/{messageId}.jpg` DOES NOT exist
   - Confirms Cloud Function or client delete worked

**Expected Result:** ✅ Storage file deleted after viewing

### Test 6: Permissions Handling

**Steps:**

1. Deny camera permission:
   - Tap camera button
   - System asks "Allow access to camera?" → Tap "Don't Allow"
   - Verify:
     - Alert appears: "Camera permission denied" (or similar)
     - Can still chat with text
     - Can try again later

2. Deny gallery permission:
   - Tap camera button
   - Select "Choose from Gallery"
   - System asks "Allow access to photos?" → Tap "Don't Allow"
   - Verify:
     - Alert appears
     - Can still use camera option

**Expected Result:** ✅ Graceful permission denied handling

### Test 7: Image Compression

**Steps:**

1. Capture or select a large photo (>2MB if available)
2. Check local device storage before upload
3. Send snap
4. Go to Firebase Console → Storage → snaps/{chatId}/{messageId}.jpg
5. Check file size:
   - Should be ~50-200KB (not original MB)
   - Confirms compression (expo-image-manipulator) works

**Expected Result:** ✅ Image compressed to reasonable size before upload

### Test 8: Error Handling (Network Disconnect)

**Steps:**

1. Start sending snap
2. While "Uploading..." is shown, turn OFF network
3. Verify:
   - Error alert appears
   - Input field remains (snap can be retried or chat continues)
   - No partial state left

**Expected Result:** ✅ Network errors handled gracefully

### Test 9: Cross-Device Real-Time

**Steps:**

1. User A's device: send snap to User B
2. User B's device: watching chat list
3. Verify:
   - New 🔒 appears in User B's chat list in real-time (no refresh needed)
   - Listener from Phase 3 delivers the message update

**Expected Result:** ✅ Real-time message delivery works for images too

---

## Known Limitations & Future Work

- **No Thumbnail Preview:** Lock icon (🔒) used instead of actual image thumbnail
  - Phase 5+ could add thumbnail if desired (requires persistent storage of preview)
- **No Timer UI:** Auto-dismiss timer hidden; could show countdown "3...2...1" in future
- **No Zoom Animations:** Basic fullscreen only; could add pinch-zoom gesture in future
- **No Snap Replay:** Once deleted, permanently gone (true Snapchat behavior in MVP)
- **No Snap Stories:** Phase 5 adds Stories feature (multi-recipients)
- **No Analytics:** openedBy field stored but not displayed to sender yet

---

## Files to Create/Modify

**Create:**

- ✅ `src/services/storage.ts` - Storage upload/download/delete operations
- ✅ `src/screens/chat/SnapViewerScreen.tsx` - Fullscreen snap viewer
- ✅ `firebase/functions/src/cleanup.ts` - Cloud Function for Storage cleanup

**Modify:**

- ✅ `src/services/chat.ts` - Add `markSnapOpened()` function
- ✅ `src/screens/chat/ChatScreen.tsx` - Add camera button, image rendering
- ✅ `src/navigation/RootNavigator.tsx` - Add SnapViewerScreen to ChatStack
- ✅ `package.json` - Add expo-camera, expo-image-picker, expo-image-manipulator
- ✅ `storage.rules` - Add snaps/{chatId}/\* rules
- ✅ Firestore Security Rules - Update Messages rules to allow delete after viewing

**Deploy:**

- ✅ Firebase Storage rules via Console
- ✅ Cloud Function `onDeleteMessage` via `firebase deploy`

---

## Next Phase

**PHASE 5: Stories**

Phase 5 adds persistent photo stories visible to all friends for 24 hours:

- Post photo story: upload to `stories/{authorId}/{storyId}.jpg`
- Stories bar showing friends' stories (if not expired)
- View story: fullscreen display, tap to mark viewed
- View count: aggregate Views subcollection for author to see who viewed
- Auto-delete after 24h via TTL
