# Phase 13: Stories UX + Performance

**Start Date**: January 20, 2026  
**Status**: 🚧 IN PROGRESS  
**Prerequisite**: Phase 12 Complete ✅

---

## 📋 Overview

Phase 13 focuses on improving the Stories feature's performance and user experience:

1. **Batch story loading** - Reduce Firestore reads by batching operations
2. **Viewed state caching** - Avoid redundant checks for already-viewed stories
3. **Story expiration handling** - Client-side filtering and cleanup
4. **Feed rendering optimization** - Virtualized list for smooth scrolling
5. **Image preloading** - Prefetch images before user navigates to viewer
6. **Loading states polish** - Better skeleton/shimmer loading UI

---

## 🎯 Goals

### Performance Targets

- Story feed load: < 1 second (currently ~2-3s due to N+1 view checks)
- Story viewer load: < 500ms (preload images)
- Reduce Firestore reads by ~60% through batching/caching

### UX Improvements

- Smoother story feed scrolling
- No jarring loading states when navigating
- Clear expired story handling
- Better visual feedback for unviewed vs viewed stories

---

## 🔍 Current State Analysis

### Issues Identified

#### 1. N+1 Query Problem (Critical)

```typescript
// Current: StoriesScreen.tsx
for (const story of fetchedStories) {
  const hasViewed = await hasUserViewedStory(story.id, currentFirebaseUser.uid);
  if (hasViewed) viewed.add(story.id);
}
```

- If user has 20 friends with 5 stories each = 100 individual Firestore reads just for view checks!
- Each `hasUserViewedStory()` is a separate `getDoc()` call

#### 2. No Caching

- Every screen focus triggers full reload
- View status is re-checked on every load
- Images are re-downloaded each time

#### 3. No Image Preloading

- User taps story → loading spinner → image downloads
- Could preload while scrolling through feed

#### 4. Expired Stories Not Handled Client-Side

- Stories may expire while user is viewing feed
- No visual indication of time remaining

---

## ✨ Implementation Plan

### Task 1: Batch View Status Checking

Replace N individual `getDoc()` calls with batched queries.

**New Function**: `getBatchViewedStories(storyIds, userId)`

```typescript
// Batch check which stories user has viewed
export async function getBatchViewedStories(
  storyIds: string[],
  userId: string,
): Promise<Set<string>> {
  const viewedSet = new Set<string>();

  // Process in batches of 30 (Firestore 'in' limit)
  const batchSize = 30;
  for (let i = 0; i < storyIds.length; i += batchSize) {
    const batch = storyIds.slice(i, i + batchSize);

    // Query views subcollection for this user's views
    const viewPromises = batch.map((storyId) =>
      getDoc(doc(db, "stories", storyId, "views", userId)),
    );

    const results = await Promise.all(viewPromises);
    results.forEach((docSnap, index) => {
      if (docSnap.exists()) {
        viewedSet.add(batch[index]);
      }
    });
  }

  return viewedSet;
}
```

### Task 2: In-Memory View Cache

Cache viewed story IDs in React state/context to avoid redundant checks.

```typescript
// StoriesScreen - add caching
const [viewedCache, setViewedCache] = useState<Map<string, boolean>>(new Map());

// Only check stories not in cache
const uncachedStoryIds = storyIds.filter((id) => !viewedCache.has(id));
if (uncachedStoryIds.length > 0) {
  const newViewed = await getBatchViewedStories(uncachedStoryIds, userId);
  // Merge into cache
}
```

### Task 3: Story Expiration Client-Side

Filter out expired stories and show time remaining.

```typescript
// Filter expired stories client-side
const validStories = stories.filter((s) => s.expiresAt > Date.now());

// Calculate time remaining for display
const getTimeRemaining = (expiresAt: number): string => {
  const remaining = expiresAt - Date.now();
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  if (hours > 0) return `${hours}h`;
  const minutes = Math.floor(remaining / (1000 * 60));
  return `${minutes}m`;
};
```

### Task 4: Image Preloading

Preload story images while user is on the feed.

```typescript
// Preload images for visible stories
import { Image } from "react-native";

const preloadImages = (stories: Story[]) => {
  stories.slice(0, 5).forEach(async (story) => {
    try {
      const uri = await downloadSnapImage(story.storagePath);
      Image.prefetch(uri);
    } catch (e) {
      // Silent fail - preload is optimization only
    }
  });
};
```

### Task 5: Optimized Story Feed Rendering

Use FlatList with proper optimization props.

```typescript
<FlatList
  data={stories}
  horizontal
  showsHorizontalScrollIndicator={false}
  keyExtractor={(item) => item.id}
  renderItem={renderStoryItem}
  initialNumToRender={5}
  maxToRenderPerBatch={3}
  windowSize={5}
  removeClippedSubviews={Platform.OS !== 'web'}
  getItemLayout={(data, index) => ({
    length: STORY_ITEM_WIDTH,
    offset: STORY_ITEM_WIDTH * index,
    index,
  })}
/>
```

### Task 6: Loading State Polish

Add skeleton loading and shimmer effects.

```typescript
// Skeleton story item while loading
const StoryItemSkeleton = () => (
  <View style={styles.storyItem}>
    <View style={[styles.storyThumbnail, styles.skeleton]} />
    <View style={[styles.usernameContainer, styles.skeleton]} />
  </View>
);
```

---

## 📁 Files to Modify

### Services

1. **`src/services/stories.ts`**
   - Add `getBatchViewedStories()` function
   - Add `preloadStoryImage()` function
   - Optimize `getFriendsStories()` with better caching hints

### Screens

2. **`src/screens/stories/StoriesScreen.tsx`**
   - Replace N+1 view checks with batched call
   - Add in-memory view cache
   - Add image preloading on mount
   - Use FlatList instead of ScrollView
   - Add skeleton loading state
   - Add expiration time display

3. **`src/screens/stories/StoryViewerScreen.tsx`**
   - Use preloaded image if available
   - Add progress bar for time remaining
   - Handle expired story gracefully

### Components (New)

4. **`src/components/StoryItem.tsx`**
   - Extracted story item component
   - Memoized for better performance

5. **`src/components/StoryItemSkeleton.tsx`**
   - Loading skeleton component

---

## ✅ Definition of Done

### Performance

- [ ] Story feed loads in < 1 second
- [ ] Max 2-3 Firestore reads per load (not N+1)
- [ ] Images preload in background
- [ ] Smooth 60fps scrolling on story feed

### Functionality

- [ ] Viewed stories cached in memory
- [ ] Expired stories filtered client-side
- [ ] Time remaining shown on stories
- [ ] Preloaded images used in viewer

### Code Quality

- [ ] TypeScript compiles with zero errors
- [ ] No console errors/warnings
- [ ] Code follows existing patterns
- [ ] Functions have JSDoc comments

### Testing

- [ ] Load feed with 10+ stories - verify < 1s
- [ ] Navigate to story viewer - verify fast image load
- [ ] Let story expire - verify handled gracefully
- [ ] Scroll story feed - verify smooth performance

---

## 🚀 Let's Begin

Starting with **Task 1: Batch View Status Checking** - the biggest performance win.
