# PHASE 5: STORIES (Photo Stories Visible to Friends for 24 Hours)

**Status:** Ready to Implement
**Date:** January 19, 2026
**Complexity:** Medium (photo upload, persistent feed, view tracking)

---

## Overview

Phase 5 extends the app to support photo stories. Users can post photos visible to all their friends for 24 hours. Stories appear in a dedicated stories bar/screen, and users can tap to view a story fullscreen. The system tracks who viewed each story and auto-deletes expired stories.

**Key Features:**

- 📸 Post photo story: capture/select photo and upload to `stories/{authorId}/{storyId}.jpg`
- 📺 Stories feed: show stories from all friends in horizontal bar (newest first)
- 👁️ View story fullscreen with view counter
- 📊 View tracking: record each view in Views subcollection
- ⏰ Auto-delete after 24h via TTL
- ☑️ Mark story as viewed (set viewed=true + viewedAt)
- 🗑️ Manual delete: author can delete their own story

---

## Firestore Schema

### New Collection: `stories/{storyId}`

```typescript
export interface Story {
  id: string;
  authorId: string;           // User who posted story
  createdAt: number;          // Timestamp
  expiresAt: number;          // 24h from now (TTL index for auto-delete)
  storagePath: string;        // stories/{authorId}/{storyId}.jpg
  viewCount: number;          // Aggregate view count (cached)
  recipientIds?: string[];    // Array of friend IDs (for queries)
}
```

### New Subcollection: `stories/{storyId}/views/{userId}`

```typescript
export interface StoryView {
  userId: string;
  viewedAt: number;          // When they viewed it
  viewed: boolean;           // true (for querying convenience)
}
```

---

## Type Definitions: `src/types/models.ts`

### Add:

```typescript
export interface Story {
  id: string;
  authorId: string;
  createdAt: number;
  expiresAt: number;
  storagePath: string;
  viewCount: number;
  recipientIds?: string[];
}

export interface StoryView {
  userId: string;
  viewedAt: number;
  viewed: boolean;
}
```

---

## Service Layer: `src/services/stories.ts` (NEW)

Create new service file for all story operations:

### Functions to Implement

```typescript
/**
 * Post a new story
 * @param authorId - Current user ID
 * @param imageUri - Local file URI (pre-compressed)
 * @returns Story ID
 */
export async function postStory(
  authorId: string,
  imageUri: string,
): Promise<string>;

/**
 * Get all unexpired stories from friends
 * Fetches from Firestore where:
 * - expiresAt > now()
 * - authorId in currentUser.friendIds OR authorId == currentUser.uid
 * Returns sorted by createdAt DESC (newest first)
 */
export async function getFriendsStories(userId: string): Promise<Story[]>;

/**
 * Get single story for viewing
 */
export async function getStory(storyId: string): Promise<Story | null>;

/**
 * Mark story as viewed by current user
 * Creates/updates entry in stories/{storyId}/views/{userId}
 * Increments viewCount on story doc
 */
export async function markStoryViewed(
  storyId: string,
  userId: string,
): Promise<void>;

/**
 * Get view count for a story
 */
export async function getStoryViewCount(storyId: string): Promise<number>;

/**
 * Get list of users who viewed a story (for author)
 */
export async function getStoryViewers(storyId: string): Promise<string[]>;

/**
 * Delete a story (author only)
 */
export async function deleteStory(storyId: string, storagePath: string): Promise<void>;
```

---

## UI Components

### StoriesScreen: `src/screens/stories/StoriesScreen.tsx`

Shows a horizontal scrollable bar of friends' stories (like Snapchat/Instagram):

**Layout:**
- Header: "Stories"
- Horizontal scroll view with story cards
- Each card shows: Friend's avatar + first frame of story
- Tap to view fullscreen

**Features:**
- List stories from `getFriendsStories(currentUserId)`
- Show "Add Story +" button to post new story
- Filter out expired stories (expiresAt > now())
- Sort by newest first
- Display view count on each card (if viewed by current user, show checkmark)

**Interactions:**
- Tap story card → open StoryViewerScreen
- Press "Add Story +" → camera/gallery menu → StoryViewerScreen (own story, no dismiss)

### StoryViewerScreen: `src/screens/stories/StoryViewerScreen.tsx`

Fullscreen story viewer (similar to SnapViewerScreen but persistent):

**Layout:**
- Fullscreen image on black background
- Bottom overlay: "X views" or "1 view"
- Top-right: "Delete" button (only if author)
- Tap image to return to StoriesScreen

**Features:**
- Download and display story image
- Show view count: `getStoryViewCount(storyId)`
- Mark as viewed: `markStoryViewed(storyId, userId)` on mount
- Display "You viewed this" if current user already viewed
- If author, show delete button
- On delete or tap: navigate back to StoriesScreen

---

## Cloud Functions

### `onPostStory` Trigger

**When:** Document created in `stories/{storyId}`

**What:**
1. Set `expiresAt = createdAt + 24h`
2. Copy `recipientIds` from user.friendIds (for Firestore query compatibility)
3. Log: "Story {storyId} posted by {authorId}"

**File:** `firebase/functions/src/index.ts`

### `cleanupExpiredStories` Scheduled Function

**When:** Daily at 2 AM UTC (same as snap cleanup)

**What:**
1. Query stories where expiresAt < now()
2. For each expired story:
   - Delete storagePath from Storage
   - Delete story document
3. Log: "Cleaned up {count} expired stories"

**File:** `firebase/functions/src/index.ts`

---

## Firestore Security Rules

### Stories Collection

```javascript
match /stories/{storyId} {
  // Anyone can read unexpired stories from their friends
  allow read: if request.auth != null && isAuth() && (
    resource.data.expiresAt > request.time.toMillis() &&
    (request.auth.uid in resource.data.recipientIds || 
     resource.data.authorId == request.auth.uid)
  );
  
  // Only owner can create/update/delete
  allow create: if isAuth() && request.resource.data.authorId == request.auth.uid;
  allow update: if isAuth() && resource.data.authorId == request.auth.uid;
  allow delete: if isAuth() && resource.data.authorId == request.auth.uid;
  
  // Views subcollection: anyone can add view record
  match /views/{userId} {
    allow read: if request.auth != null && isAuth();
    allow create: if isAuth() && request.resource.data.userId == request.auth.uid;
  }
}
```

---

## Storage Rules

### Stories Path

```javascript
match /stories/{authorId}/{allPaths=**} {
  // Anyone can read unexpired stories
  allow read: if request.auth != null;
  // Only author can upload/delete
  allow write: if request.auth.uid == authorId;
}
```

---

## Implementation Order

1. **Update Firestore schema** - Add Story model and Views subcollection
2. **Create types** - Add Story and StoryView interfaces
3. **Implement services** - Build stories.ts with all CRUD operations
4. **Build StoriesScreen UI** - Stories bar with story cards + add button
5. **Build StoryViewerScreen** - Fullscreen viewer with delete option
6. **Update security rules** - Deploy stories collection rules
7. **Create Cloud Functions** - onPostStory + cleanupExpiredStories
8. **Deploy functions** - `firebase deploy`
9. **Test end-to-end** - Post story → view → cleanup
10. **Commit** - All changes with descriptive message

---

## Key Differences from Snaps (Phase 4)

| Feature | Snaps | Stories |
|---------|-------|---------|
| **Recipients** | One specific friend | All friends |
| **Persistence** | Deleted immediately after viewing (view-once) | Persists 24h for multiple viewers |
| **View tracking** | Simple openedAt + openedBy | Views subcollection (multiple views) |
| **Screen** | In chat (ChatScreen) | Dedicated StoriesScreen |
| **Viewer** | SnapViewerScreen (auto-dismiss) | StoryViewerScreen (persistent, return manually) |

---

## Testing Checklist

- [ ] Post story: upload image to `stories/{authorId}/{storyId}.jpg`
- [ ] View story: image loads in fullscreen viewer
- [ ] View count: increments when user views
- [ ] View multiple stories: feed shows multiple friends' stories
- [ ] Expired stories: don't appear after 24h
- [ ] Delete story: removed immediately for all users
- [ ] Own story: shows delete button in viewer
- [ ] Cloud Function cleanup: verifies expired stories deleted (next day)

---

## Next Phase

**PHASE 6: Notifications + Streaks**

- Push notifications for messages, friend requests, and story views
- Streak counter: track consecutive days of chat activity
- Daily notification: remind to chat if streak at risk

---

## Notes

- **No image compression in cloud function** — compress client-side before upload (like Phase 4)
- **Aggregate view count** — cache on story doc for quick read; update with Cloud Function
- **Query optimization** — recipientIds array allows Firestore to query "where user in friends"
- **TTL cleanup** — expiresAt field with TTL index auto-deletes documents (Firebase feature)
- **No story editing** — delete + re-post only (simpler implementation)
