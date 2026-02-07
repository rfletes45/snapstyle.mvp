# CAMERA SYSTEM - NATIVE IMPLEMENTATION & INTEGRATION PLAN

**Status**: Comprehensive Research & Planning Phase  
**Date**: February 6, 2026  
**Scope**: Native implementations + Full infrastructure integration

---

## PHASE 1: NATIVE FEATURE IMPLEMENTATIONS

### 1. Image Filtering Service

**What exists**: Placeholder that returns base image  
**What's needed**: Native image manipulation with color matrix filters

**Implementation approach**:

- Use `expo-image-manipulator` for basic filters
- Use `react-native-skia` for advanced filters (matrix operations)
- Create filter pipeline that applies multiple adjustments

**Key tasks**:

- [ ] Create `src/services/camera/nativeImageFiltering.ts`
  - Implement brightness, contrast, saturation adjustments
  - Implement color matrix transformations
  - Implement blur and other effects
  - Build filter composition pipeline

**Time estimate**: 4-6 hours

---

### 2. Video Processing Service

**What exists**: Placeholder FFmpeg integration  
**What's needed**: Actual FFmpeg-based video encoding

**Implementation approach**:

- Use `react-native-ffmpeg` for video compression
- Support multiple quality levels (720p, 1080p)
- Handle bitrate optimization
- Create progress callbacks

**Key tasks**:

- [ ] Create `src/services/camera/nativeVideoProcessing.ts`
  - Video compression with quality options
  - Bitrate calculation based on duration
  - Frame extraction for thumbnails
  - Error handling and fallbacks

**Time estimate**: 5-7 hours

---

### 3. Face Detection with ML Kit

**What exists**: Placeholder returning empty faces  
**What's needed**: Real Firebase ML Kit integration

**Implementation approach**:

- Use `expo-face-detector` or Firebase ML Kit
- Detect 21-point face mesh
- Track facial landmarks
- Calculate face orientation and expressions

**Key tasks**:

- [ ] Replace `src/services/camera/faceDetectionService.ts`
  - Integrate ML Kit initialization
  - Real face detection from camera frame
  - Landmark extraction (eyes, nose, mouth, ears)
  - Expression detection (smile, eye open, head pose)

**Time estimate**: 5-7 hours

---

### 4. Drawing Canvas Service

**What exists**: Placeholder that returns base image  
**What's needed**: Real canvas implementation for drawing

**Implementation approach**:

- Use `react-native-skia` for high-performance drawing
- Support brush styles, colors, opacity
- Record drawing paths for replay
- Composite with base image

**Key tasks**:

- [ ] Create `src/services/camera/nativeDrawing.ts`
  - Canvas initialization and rendering
  - Brush stroke handling
  - Color and size controls
  - Path recording and replay
  - Export to image

**Time estimate**: 6-8 hours

---

## PHASE 2: INFRASTRUCTURE INTEGRATION

### 1. Firebase Configuration & Setup

**What's needed**: Firestore indexes, security rules, storage paths

**Key tasks**:

- [ ] Create `src/config/firebase-setup.ts`
  - Firestore index definitions (JSON)
  - Storage rules configuration
  - Collection structure documentation
- [ ] Create `firebase/firestore.indexes.json`
  - Index for snap queries (senderId, storyVisible, storyExpiresAt)
  - Index for story queries (friends list, expiry)
  - Index for user snap queries

- [ ] Create `firebase/firestore.rules`
  - Access control for Snaps collection
  - Access control for story snaps
  - View tracking permissions
  - React/reply permissions

- [ ] Create `firebase/storage.rules`
  - Upload permissions (authenticated users)
  - Read permissions (snap recipients)
  - Delete permissions (snap owner only)

**Time estimate**: 3-4 hours

---

### 2. Chat System Integration

**What's needed**: Service to send snaps as DMs

**Key tasks**:

- [ ] Create `src/services/chat/snapMessageService.ts`
  - sendSnapToChat(snap, conversationId, userId)
  - recordSnapViewInChat(conversationId, messageId, userId)
  - getSnapMessagesInConversation()
- [ ] Update `src/types/chat.ts` (if missing)
  - Add SnapMessage type extending ChatMessage
  - Add snap-specific fields (snapId, thumbnail, status)

- [ ] Update ChatScreen
  - Render snap messages with thumbnail preview
  - Handle tap to view snap
  - Record snap view in chat context

**Time estimate**: 4-5 hours

---

### 3. Story System Integration

**What's needed**: Query and display story snaps

**Key tasks**:

- [ ] Create `src/services/story/storySnapService.ts`
  - getVisibleStories(userId, friendIds)
  - calculateStoryProgress(createdAt, expiresAt)
  - getStoriesFromFriend(friendId)
  - archiveExpiredStories()

- [ ] Update `src/types/story.ts` (if missing)
  - Add StoryItem and StoryUser types
  - Add story progress tracking

- [ ] Create StoryRing component
  - Visual representation of story status
  - Progress ring animation
  - Tap to view story

**Time estimate**: 4-5 hours

---

### 4. Profile System Integration

**What's needed**: Display user snap gallery in profile

**Key tasks**:

- [ ] Update ProfileScreen component
  - Add snap gallery section
  - Display user's snaps grid (3 columns)
  - Tap to view snap detail
  - Show snap statistics (views, reactions, replies)

- [ ] Create `src/screens/camera/SnapDetailScreen.tsx`
  - Full-screen snap viewer
  - View timeline (who viewed and when)
  - Reaction/reply display
  - Screenshot detection UI

- [ ] Update ProfileType
  - Add snap statistics fields
  - Add privacy settings for snaps

**Time estimate**: 4-5 hours

---

### 5. Notification System Integration

**What's needed**: Snap event notifications

**Key tasks**:

- [ ] Create `src/services/notifications/snapNotifications.ts`
  - notifySnapReceived(snap)
  - notifySnapViewed(snap, viewer)
  - notifySnapScreenshotted(snap, screenshotter)
  - notifySnapReaction(snap, reactor, emoji)
  - notifySnapReply(snap, replier)

- [ ] Update notification types
  - Add snap notification types
  - Add snap-specific payload

- [ ] Create Cloud Function
  - firebase/functions/src/notifications/snapNotifications.ts
  - Trigger on Snap creation
  - Trigger on view events
  - Screenshot detection

**Time estimate**: 5-6 hours

---

### 6. Permission Declarations

**What's needed**: iOS/Android permission setup

**Key tasks**:

- [ ] Update `ios/Podfile` (if needed)
  - Add camera/microphone requirements
  - Add photo library permissions

- [ ] Update `ios/[AppName]/Info.plist`
  - NSCameraUsageDescription
  - NSMicrophoneUsageDescription
  - NSPhotoLibraryUsageDescription
  - NSPhotoLibraryAddOnlyUsageDescription

- [ ] Update `android/app/AndroidManifest.xml`
  - CAMERA permission
  - RECORD_AUDIO permission
  - READ_EXTERNAL_STORAGE
  - WRITE_EXTERNAL_STORAGE

- [ ] Create `src/utils/permissions.ts`
  - requestCameraPermission()
  - requestMicrophonePermission()
  - requestPhotoLibraryPermission()
  - checkAllPermissions()

**Time estimate**: 2-3 hours

---

## IMPLEMENTATION SCHEDULE

| Phase       | Component        | Duration | Priority |
| ----------- | ---------------- | -------- | -------- |
| Native      | Image Filtering  | 4-6h     | HIGH     |
| Native      | Video Processing | 5-7h     | HIGH     |
| Native      | Face Detection   | 5-7h     | HIGH     |
| Native      | Drawing Canvas   | 6-8h     | MEDIUM   |
| Integration | Firebase Config  | 3-4h     | HIGH     |
| Integration | Chat System      | 4-5h     | HIGH     |
| Integration | Story System     | 4-5h     | HIGH     |
| Integration | Profile System   | 4-5h     | MEDIUM   |
| Integration | Notifications    | 5-6h     | MEDIUM   |
| Integration | Permissions      | 2-3h     | HIGH     |

**Total Estimated Time**: 43-55 hours  
**Recommendation**: 1-2 week implementation sprint

---

## DEPENDENCIES

### New NPM Packages

```
react-native-ffmpeg          # Video processing
react-native-skia             # High-performance graphics
expo-face-detector            # Face detection (or Firebase ML Kit)
expo-image-manipulator        # Already have this
react-native-camera           # Already have this
expo-camera                   # Already have this
expo-notifications            # For notifications
```

### Firebase Services

- Firestore (read/write snaps)
- Cloud Storage (media upload)
- Cloud Functions (notifications)
- ML Kit (face detection)

---

## SUCCESS CRITERIA

### Native Implementations ✅

- [ ] Image filters apply correctly with no performance degradation
- [ ] Videos compress to target sizes (<5MB for 10s at 1080p)
- [ ] Face detection runs at 30 FPS with <200ms latency
- [ ] Drawing renders smoothly with pressure sensitivity

### Integration Points ✅

- [ ] Snaps send to chat with thumbnail preview
- [ ] Story snaps visible with 24-hour expiry
- [ ] Profile shows snap gallery with statistics
- [ ] Notifications delivered for all snap events
- [ ] All permissions requested and granted properly

### Performance Targets ✅

- Photo capture: <100ms
- Video start: <200ms
- Face detection: 30 FPS
- Filter application: <500ms
- Export: <5 seconds

---

## NEXT STEPS

1. **Review** this plan with team
2. **Prioritize** components (likely: Firebase config first, then native features)
3. **Execute** Phase 1 (native features)
4. **Execute** Phase 2 (integrations)
5. **Test** end-to-end flows
6. **Deploy** to staging then production

---

**Plan Complete. Ready for Implementation Phase.**
