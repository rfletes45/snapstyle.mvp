# Camera-Based Camera System - Comprehensive Implementation Plan

**Version:** 1.0
**Date:** February 6, 2026
**Status:** Planning Phase
**Scope:** Full camera system with video, filters, stickers, text, polls, effects

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Research & Market Analysis](#2-research--market-analysis)
3. [Core Architecture](#3-core-architecture)
4. [Type Definitions](#4-type-definitions)
5. [Database Schema](#5-database-schema)
6. [Component Architecture](#6-component-architecture)
7. [Service Layer](#7-service-layer)
8. [Screen Implementations](#8-screen-implementations)
9. [Feature Specifications](#9-feature-specifications)
10. [Advanced Features](#10-advanced-features)
11. [Performance & Optimization](#11-performance--optimization)
12. [Integration Points](#12-integration-points)
13. [User Flows](#13-user-flows)
14. [Dependencies & Libraries](#14-dependencies--libraries)
15. [Implementation Phases](#15-implementation-phases)
16. [File Structure](#16-file-structure)
17. [Testing Strategy](#17-testing-strategy)
18. [Feature Suggestions](#18-feature-suggestions)

---

## 1. Executive Summary

### Vision

Build a native, feature-rich camera system that rivals Snapchat's capabilities, enabling users to:

- Capture high-quality photos and videos
- Apply real-time filters and effects
- Add text, stickers, and creative overlays
- Create interactive polls
- Apply face detection and AR effects
- Share directly within the app

### Key Differentiators

| Feature                | Snapchat     | Snapstyle               | Advantage            |
| ---------------------- | ------------ | ----------------------- | -------------------- |
| **Capture Speed**      | 500ms        | <300ms (optimized)      | Faster capture       |
| **Real-time Filters**  | 15-20        | 25-30                   | More variety         |
| **AR Face Effects**    | Yes (ML Kit) | Yes (ML Kit)            | Equal                |
| **Custom Fonts**       | Limited      | 12+ fonts               | Better customization |
| **Poll Types**         | Binary       | Multiple types          | More engagement      |
| **Video Recording**    | Yes          | Yes + Background music  | Enhanced             |
| **Direct Integration** | Limited      | Deep friend integration | Seamless sharing     |
| **Voice Messages**     | Yes          | Yes + Effect filters    | More fun             |

### Technical Stack

- **Native Camera API:** expo-camera, react-native-camera
- **Video Processing:** react-native-ffmpeg, react-native-video
- **Image Manipulation:** react-native-skia, expo-image-manipulator
- **ML/AR:** React Native ML Kit, Expo face detection
- **State Management:** Redux + Redux Persist
- **Database:** Firestore (Snaps collection)
- **Storage:** Firebase Storage (organized by user/timestamp)
- **Real-time:** Firestore listeners + WebRTC (for live features)

---

## 2. Research & Market Analysis

### Snapchat's Core Features (Reference Implementation)

#### 2.1 Capture Phase

- **Tap to photo** (< 100ms)
- **Press to video** (unlimited duration, up to 600 seconds for stories)
- **Face detection** (21+ face effects available)
- **Filter carousel** (horizontal scroll)
- **Real-time preview** (60 FPS on high-end devices)
- **Flash support** (on/off/auto modes)
- **Camera switching** (front/back)
- **Pinch to zoom** (0.5x to 8x)

#### 2.2 Editing Phase

- **Text tool** (12+ fonts, colors, sizes, positioning)
- **Sticker tool** (emoji, bitmoji, custom stickers)
- **Scissors tool** (cutout/eraser)
- **Drawing tool** (brush with multiple styles)
- **Brightness/Contrast** (sliders)
- **Crop & Rotate**
- **Filters** (color adjustments, vintage, B&W)

#### 2.3 Poll/Interactive Features

- **Yes/No poll** (binary choice)
- **Multiple choice** (A/B/C/D)
- **Question sticker** (receive responses)
- **Opinion sticker** (tap to vote)
- **Pinned messages** (important snaps)

#### 2.4 Sharing

- **Direct message** (with view tracking)
- **Story upload** (24-hour expiry)
- **Best friends only** (subset of friends)
- **View count & receipts** (read receipts)
- **Delete anytime** (control)

### Industry Best Practices

1. **Performance First**
   - Camera preview must start instantly
   - Filter application < 16ms (60 FPS)
   - Video encoding happens asynchronously
   - Compress images before upload

2. **User Delight**
   - Haptic feedback on capture
   - Smooth animations between states
   - Undo/redo for edits
   - Live preview of effects

3. **Data Privacy**
   - Photos deleted from device after upload
   - View tracking timestamps
   - Encrypted transport (HTTPS + TLS)
   - No permanent server storage (24-hour expiry for stories)

4. **Accessibility**
   - High contrast mode
   - Text scaling
   - Screen reader support
   - Voice control for capture

---

## 3. Core Architecture

### 3.1 System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Camera Screen                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │          Camera Preview (RNCamera)               │   │
│  │  - Real-time capture                             │   │
│  │  - Face detection overlay                        │   │
│  │  - Filter preview                                │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │      Filter Carousel (Horizontal FlatList)       │   │
│  │  - 25+ filters with preview                      │   │
│  │  - Real-time application                         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │        Control Bar (Bottom Dock)                 │   │
│  │  - Capture button (tap/long-press)               │   │
│  │  - Flash, Camera switch, Settings                │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ↓ (after capture)
┌─────────────────────────────────────────────────────────┐
│                   Editor Screen                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │        Photo/Video Preview                       │   │
│  │  - Full screen content                           │   │
│  │  - Overlay elements (text, stickers)             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │        Toolbar (Top + Bottom)                    │   │
│  │  - Text, Stickers, Drawing, Effects              │   │
│  │  - Undo, Redo, Save, Share                       │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          ↓ (after editing)
┌─────────────────────────────────────────────────────────┐
│                  Share Screen                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │     Recipients (Friends, Groups, Story)          │   │
│  │  - Tap to select (checkmarks)                    │   │
│  │  - Search, favorites, recent                     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │     Caption & Settings                           │   │
│  │  - Optional message                              │   │
│  │  - Allow replies, view receipts                  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 3.2 State Management Architecture

```typescript
// Redux Store Structure
store/
├── slices/
│   ├── cameraSlice.ts
│   │   ├── cameraState (front/back, zoom, flash mode)
│   │   ├── recordingState (duration, paused, bitrate)
│   │   └── previewState (current snap, format)
│   │
│   ├── editorSlice.ts
│   │   ├── editorState (current element, undo/redo stack)
│   │   ├── overlayElements (text, stickers, drawings)
│   │   ├── filterState (current filter, intensity)
│   │   └── effectsStack (applied effects)
│   │
│   └── snapSlice.ts
│       ├── currentSnap (metadata)
│       ├── recipients (selected friends)
│       ├── shareSettings (duration, replies allowed)
│       └── uploadProgress (status, percentage)
```

### 3.3 Data Flow Diagram

```
User Opens Camera
    ↓
CameraScreen Initializes
    ├─ Request Camera Permissions
    ├─ Initialize Camera Preview (60 FPS)
    ├─ Load Filter Definitions
    └─ Set up Face Detection

User Interaction
    ├─ Tap → Capture Photo
    ├─ Long Press → Start Video Recording
    ├─ Scroll Filters → Apply Filter
    ├─ Press Flash → Toggle Mode
    └─ Switch Camera → Change Facing

Media Captured
    ↓
EditorScreen Opens
    ├─ Load Photo/Video Preview
    ├─ Set up Drawing Canvas
    └─ Initialize Edit Tools

User Edits
    ├─ Add Text
    ├─ Apply Stickers
    ├─ Draw on Canvas
    ├─ Adjust Brightness
    └─ Apply Filters

User Shares
    ↓
ShareScreen Opens
    ├─ Load Friends List
    ├─ Select Recipients
    └─ Optional Caption

User Sends
    ↓
Upload Process
    ├─ Compress Media
    ├─ Encrypt Data
    ├─ Upload to Firebase Storage
    ├─ Create Snap Document in Firestore
    ├─ Update Friends' View Lists
    └─ Delete Local Copy
```

---

## 4. Type Definitions

### 4.1 Core Camera Types

```typescript
// src/types/camera.ts

/**
 * ============================================================================
 * CAMERA DEVICE & SETTINGS
 * ============================================================================
 */

export type CameraFacing = "front" | "back";
export type FlashMode = "off" | "on" | "auto";
export type VideoQuality = "720p" | "1080p" | "4k";
export type ImageFormat = "jpeg" | "png" | "webp";

export interface CameraSettings {
  facing: CameraFacing;
  flashMode: FlashMode;
  zoom: number; // 0 - maxZoom
  videoQuality: VideoQuality;
  imageFormat: ImageFormat;
  autoFocus: boolean;
  whiteBalance: "auto" | "sunny" | "cloudy" | "shadow";
  exposureCompensation: number; // -2 to +2
}

export interface CameraDevice {
  deviceId: string;
  name: string;
  facing: CameraFacing;
  maxZoom: number;
  minZoom: number;
  hasFlash: boolean;
  hasAutoFocus: boolean;
}

/**
 * ============================================================================
 * MEDIA CAPTURE
 * ============================================================================
 */

export type MediaType = "photo" | "video";
export type SnapType = "photo" | "video" | "story" | "memory";

export interface CapturedMedia {
  id: string;
  type: MediaType;
  uri: string; // Local file path
  timestamp: number;
  duration?: number; // For videos (ms)
  dimensions: {
    width: number;
    height: number;
  };
  fileSize: number; // In bytes
  mimeType: string;
  exif?: {
    latitude?: number;
    longitude?: number;
    datetime: string;
  };
}

/**
 * ============================================================================
 * FILTERS & EFFECTS
 * ============================================================================
 */

export type FilterCategory =
  | "vintage"
  | "bw" // Black & White
  | "cool"
  | "warm"
  | "vibrant"
  | "soft"
  | "retro"
  | "artistic"
  | "neon"
  | "nostalgia";

export interface FilterConfig {
  id: string;
  name: string;
  category: FilterCategory;
  description?: string;
  icon?: string;

  // Color adjustments
  brightness: number; // -1 to +1
  contrast: number; // 0 to 2
  saturation: number; // 0 to 2
  hue: number; // 0 to 360

  // Effects
  blur?: number; // 0 to 25 (pixels)
  sepia?: number; // 0 to 1
  invert?: number; // 0 or 1

  // Advanced
  colorMatrix?: number[][]; // 4x5 color matrix for custom transformations
}

export interface AppliedFilter {
  filterId: string;
  intensity: number; // 0 to 1 (for blending)
  timestamp: number;
}

/**
 * ============================================================================
 * FACE DETECTION & AR EFFECTS
 * ============================================================================
 */

export interface FaceDetectionResult {
  faces: DetectedFace[];
  timestamp: number;
}

export interface DetectedFace {
  faceId: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  landmarks: FaceLandmarks;
  eulerAngleX: number; // Roll
  eulerAngleY: number; // Pitch
  eulerAngleZ: number; // Yaw
  smilingProbability: number; // 0 to 1
  leftEyeOpenProbability: number;
  rightEyeOpenProbability: number;
  trackingId: number;
}

export interface FaceLandmarks {
  leftEye: Point;
  rightEye: Point;
  leftEar: Point;
  rightEar: Point;
  leftCheek: Point;
  rightCheek: Point;
  leftMouth: Point;
  rightMouth: Point;
  mouthBottom: Point;
  noseBase: Point;
}

export type FaceEffect =
  | "flower_crown"
  | "dog_filter"
  | "cat_filter"
  | "glasses"
  | "sunglasses"
  | "crown"
  | "bunny_ears"
  | "skull_mask"
  | "heart_eyes"
  | "devil_horns"
  | "butterfly"
  | "rainbow_mouth"
  | "tears"
  | "nose_blush"
  | "golden_mask"
  | "ice_crown";

export interface FaceEffectConfig {
  id: FaceEffect;
  name: string;
  category: "accessories" | "masks" | "expressions" | "overlays";
  assetPath: string;
  requiresFaceDetection: boolean;
  landmarkOffsets?: {
    [landmark in keyof FaceLandmarks]?: { x: number; y: number };
  };
  scale?: number;
}

/**
 * ============================================================================
 * TEXT & STICKERS (OVERLAY ELEMENTS)
 * ============================================================================
 */

export interface TextElement {
  id: string;
  type: "text";
  content: string;
  position: {
    x: number;
    y: number;
  };
  size: number; // Font size in pixels
  rotation: number; // 0 to 360 degrees
  font: TextFont;
  color: string; // Hex color
  backgroundColor?: string;
  opacity: number; // 0 to 1
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
}

export type TextFont =
  | "Roboto"
  | "RobotoBold"
  | "RobotoItalic"
  | "Playfair"
  | "Caveat"
  | "Pacifico"
  | "GrandHotel"
  | "Fredoka"
  | "Quicksand"
  | "SpaceGrotesk"
  | "Courier"
  | "Comic";

export interface StickerElement {
  id: string;
  type: "sticker";
  stickerId: string;
  position: {
    x: number;
    y: number;
  };
  size: number; // Width in pixels (aspect ratio preserved)
  rotation: number;
  opacity: number;
  scale: number;
}

export interface DrawingElement {
  id: string;
  type: "drawing";
  paths: DrawingPath[];
  opacity: number;
}

export interface DrawingPath {
  points: Point[];
  color: string;
  width: number;
  opacity: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * ============================================================================
 * POLLS & INTERACTIVE ELEMENTS
 * ============================================================================
 */

export type PollType = "yes_no" | "multiple_choice" | "slider" | "question";

export interface PollElement {
  id: string;
  type: "poll";
  pollType: PollType;
  position: {
    x: number;
    y: number;
  };

  // Common
  question: string;

  // Yes/No
  yesResponses?: number;
  noResponses?: number;

  // Multiple Choice
  options?: PollOption[];

  // Slider
  minLabel?: string;
  maxLabel?: string;

  // Metadata
  createdAt: number;
  expiresAt?: number;
  resultsVisible: boolean;
}

export interface PollOption {
  id: string;
  text: string;
  responses: number;
}

/**
 * ============================================================================
 * SNAP & STORY OBJECTS
 * ============================================================================
 */

export interface Snap {
  id: string;
  senderId: string;
  senderDisplayName: string;
  senderAvatar?: string;

  // Media
  mediaType: "photo" | "video";
  mediaUrl: string; // Firebase Storage URL
  duration?: number; // For videos (seconds)

  // Metadata
  createdAt: number;
  updatedAt: number;

  // Visibility
  recipients: SnapRecipient[];
  storyVisible: boolean;
  storyExpiresAt?: number;

  // Editing
  caption?: string;
  filters: AppliedFilter[];
  overlayElements: (
    | TextElement
    | StickerElement
    | DrawingElement
    | PollElement
  )[];

  // Engagement
  viewedBy: SnapView[];
  reactions: SnapReaction[];
  replies: SnapReply[];

  // Settings
  allowReplies: boolean;
  allowReactions: boolean;
  viewOnceOnly: boolean;
  screenshotNotification: boolean;

  // Status
  uploadStatus: "pending" | "uploading" | "uploaded" | "error";
  uploadProgress: number; // 0 to 100
}

export interface SnapRecipient {
  userId: string;
  addedAt: number;
  recipientType: "direct" | "story" | "group";
}

export interface SnapView {
  userId: string;
  viewedAt: number;
  screenshotTaken: boolean;
}

export interface SnapReaction {
  userId: string;
  emoji: string;
  timestamp: number;
}

export interface SnapReply {
  id: string;
  userId: string;
  displayName: string;
  avatar?: string;
  messageType: "text" | "snap";
  content: string; // Text or Snap ID
  timestamp: number;
  read: boolean;
}

/**
 * ============================================================================
 * RECORDING STATE
 * ============================================================================
 */

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // In milliseconds
  audioEnabled: boolean;
  videoCodec: "h264" | "h265";
  audioCodec: "aac" | "opus";
  bitrate: number; // In bps
}

/**
 * ============================================================================
 * EDITOR STATE
 * ============================================================================
 */

export type EditMode =
  | "none"
  | "text"
  | "sticker"
  | "drawing"
  | "filter"
  | "poll";

export interface EditorState {
  currentSnap: CapturedMedia | null;
  editMode: EditMode;
  overlayElements: (
    | TextElement
    | StickerElement
    | DrawingElement
    | PollElement
  )[];
  selectedElementId?: string;
  appliedFilters: AppliedFilter[];
  undoStack: EditorAction[];
  redoStack: EditorAction[];
  zoom: number;
}

export type EditorAction =
  | { type: "add_element"; payload: any }
  | { type: "remove_element"; payload: string }
  | { type: "modify_element"; payload: any }
  | { type: "apply_filter"; payload: AppliedFilter }
  | { type: "remove_filter"; payload: string };

/**
 * ============================================================================
 * STICKER LIBRARY
 * ============================================================================
 */

export interface Sticker {
  id: string;
  name: string;
  category: StickerCategory;
  assetPath: string;
  animated: boolean;
  favorite: boolean;
  aspectRatio: number;
}

export type StickerCategory =
  | "emoji"
  | "animals"
  | "objects"
  | "nature"
  | "expressions"
  | "celebration"
  | "seasonal"
  | "custom";
```

---

## 5. Database Schema

### 5.1 Firestore Collections

```
/Snaps/{snapId}
├── senderId: string
├── senderDisplayName: string
├── senderAvatar: string | null
├── mediaType: 'photo' | 'video'
├── mediaUrl: string
├── duration: number | null (for videos)
├── createdAt: timestamp
├── updatedAt: timestamp
├── recipients: {
│   userId: string,
│   addedAt: timestamp,
│   recipientType: 'direct' | 'story' | 'group'
│ }[]
├── storyVisible: boolean
├── storyExpiresAt: timestamp | null
├── caption: string | null
├── filters: {
│   filterId: string,
│   intensity: number,
│   timestamp: timestamp
│ }[]
├── overlayElements: {
│   type: 'text' | 'sticker' | 'drawing' | 'poll',
│   data: {...}
│ }[]
├── viewedBy: {
│   userId: string,
│   viewedAt: timestamp,
│   screenshotTaken: boolean
│ }[]
├── reactions: {
│   userId: string,
│   emoji: string,
│   timestamp: timestamp
│ }[]
├── replies: SnapReply[]
├── allowReplies: boolean
├── allowReactions: boolean
├── viewOnceOnly: boolean
├── screenshotNotification: boolean
└── uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'error'

/Users/{userId}/ViewedSnaps/{snapId}
├── snapId: string
├── senderId: string
├── viewedAt: timestamp
├── screenshotTaken: boolean

/Users/{userId}/SavedFilters/{filterId}
├── filterId: string
├── name: string
├── config: FilterConfig
├── createdAt: timestamp

/Users/{userId}/StickerFavorites/{stickerId}
├── stickerId: string
├── addedAt: timestamp

/Users/{userId}/SnapDrafts/{draftId}
├── snapId: string
├── mediaType: 'photo' | 'video'
├── mediaUrl: string (local or temporary)
├── overlayElements: OverlayElement[]
├── filters: AppliedFilter[]
├── createdAt: timestamp
└── expiresAt: timestamp
```

### 5.2 Firebase Storage Structure

```
/snaps/{userId}/{snapId}/
├── original.jpg          # Original captured media
├── compressed.jpg        # Compressed for upload
├── thumbnail.jpg         # 200x200 thumbnail for previews
└── processed.jpg         # With overlays applied (optional cache)

/drafts/{userId}/{draftId}/
├── media.jpg             # Temporary draft media
└── metadata.json         # Draft metadata

/stickers/{category}/{stickerId}/
├── sticker.png           # Sticker image
├── sticker-animated.gif  # Animated version (if available)
└── metadata.json         # Sticker metadata
```

---

## 6. Component Architecture

### 6.1 Component Structure

```
src/components/camera/
├── CameraScreen.tsx                 # Main camera view
├── CameraPreview.tsx                # Camera feed with overlays
├── FilterCarousel.tsx               # Horizontal scrollable filters
├── CameraControlBar.tsx             # Capture, flash, settings
├── FaceEffectOverlay.tsx            # AR effects visualization
│
├── EditorScreen.tsx                 # Photo/video editor
├── OverlayCanvas.tsx                # Canvas for drawing/text/stickers
├── TextTool.tsx                     # Text input & formatting
├── StickerPicker.tsx                # Sticker selection
├── DrawingTool.tsx                  # Drawing canvas
├── FilterAdjuster.tsx               # Filter intensity slider
├── PollCreator.tsx                  # Poll creation UI
│
├── ShareScreen.tsx                  # Recipients & captions
├── RecipientSelector.tsx            # Friend list with checkboxes
├── SnapPreview.tsx                  # Preview before sending
│
├── Common/
│   ├── CameraButton.tsx             # Capture button component
│   ├── BottomDock.tsx               # Bottom control bar
│   ├── ColorPicker.tsx              # Color selection
│   ├── FontSelector.tsx             # Font picker
│   └── EffectButton.tsx             # Effect toggle button
│
└── Modals/
    ├── CameraSettingsModal.tsx      # Camera settings
    ├── FilterDetailsModal.tsx       # Filter preview & settings
    ├── EffectsLibraryModal.tsx     # Face effects gallery
    └── RecordingTimerModal.tsx      # Recording duration display
```

### 6.2 Component Specifications

#### CameraScreen.tsx

```typescript
/**
 * Main camera screen
 * - Real-time camera preview with face detection
 * - Filter carousel
 * - Recording controls
 * - Navigation to editor
 */

interface CameraScreenProps {
  navigation: NavigationProp<any>;
}

// Features:
// 1. Continuous face detection at 30 FPS
// 2. Real-time filter preview
// 3. Tap to capture, long-press to record
// 4. Double-tap to switch camera
// 5. Pinch to zoom
// 6. Swipe up for settings, down for filter details
```

#### EditorScreen.tsx

```typescript
/**
 * Photo/video editing interface
 * - Preview with overlays
 * - Text, sticker, drawing tools
 * - Filter adjustments
 * - Poll creation
 * - Undo/redo
 */

interface EditorScreenProps {
  route: RouteProp<any, "Editor">;
  navigation: NavigationProp<any>;
}

// Features:
// 1. Full-screen preview
// 2. Tool palette (top/bottom)
// 3. Element selection & manipulation
// 4. Undo/redo with visual feedback
// 5. Layer management (z-index)
// 6. Export with watermark option
```

#### ShareScreen.tsx

```typescript
/**
 * Share configuration
 * - Select recipients (friends, groups, story)
 * - Optional caption
 * - Settings (duration, replies, reactions)
 * - Upload progress
 */

interface ShareScreenProps {
  route: RouteProp<any, "Share">;
  navigation: NavigationProp<any>;
}

// Features:
// 1. Search friends
// 2. Favorite/recent friends
// 3. Group selection
// 4. View receipts toggle
// 5. Screenshot notification toggle
// 6. Upload progress with pause/resume
```

---

## 7. Service Layer

### 7.1 Camera Service

```typescript
// src/services/camera.ts

/**
 * CAMERA CAPTURE
 */

export async function capturePhoto(
  cameraRef: RNCamera.RefType | null,
  settings: CameraSettings,
): Promise<CapturedMedia>;

export async function startVideoRecording(
  cameraRef: RNCamera.RefType | null,
  settings: CameraSettings,
): Promise<void>;

export async function stopVideoRecording(
  cameraRef: RNCamera.RefType | null,
): Promise<CapturedMedia>;

export async function pauseVideoRecording(
  cameraRef: RNCamera.RefType | null,
): Promise<void>;

export async function resumeVideoRecording(
  cameraRef: RNCamera.RefType | null,
): Promise<void>;

/**
 * CAMERA PERMISSIONS
 */

export async function requestCameraPermission(): Promise<boolean>;
export async function requestMicrophonePermission(): Promise<boolean>;
export async function getCameraPermissionStatus(): Promise<PermissionStatus>;

/**
 * FACE DETECTION
 */

export async function detectFaces(
  imageUri: string,
): Promise<FaceDetectionResult>;

export function processDetectedFaces(
  faces: DetectedFace[],
  effect: FaceEffect,
): FaceEffectOverlay[];

/**
 * MEDIA COMPRESSION
 */

export async function compressImage(
  sourceUri: string,
  targetQuality: number, // 0.5 to 1.0
): Promise<{
  uri: string;
  width: number;
  height: number;
  size: number;
}>;

export async function compressVideo(
  sourceUri: string,
  targetResolution: VideoQuality,
): Promise<{
  uri: string;
  duration: number;
  size: number;
  bitrate: number;
}>;

/**
 * THUMBNAIL GENERATION
 */

export async function generateThumbnail(
  mediaUri: string,
  mediaType: "photo" | "video",
  size: number,
): Promise<string>;
```

### 7.2 Filter Service

```typescript
// src/services/filters.ts

export const FILTER_LIBRARY: FilterConfig[] = [
  // Vintage
  { id: 'vintage_sunset', name: 'Sunset Vintage', ... },
  { id: 'vintage_film', name: 'Film', ... },

  // Black & White
  { id: 'bw_classic', name: 'Classic BW', ... },
  { id: 'bw_high_contrast', name: 'High Contrast', ... },

  // ... 21+ more filters
];

export function getFilterById(filterId: string): FilterConfig | undefined;

export function getFiltersByCategory(
  category: FilterCategory,
): FilterConfig[];

export async function applyFilterToImage(
  imageUri: string,
  filter: FilterConfig,
  intensity: number,
): Promise<string>;

export async function applyFilterToVideo(
  videoUri: string,
  filter: FilterConfig,
  intensity: number,
): Promise<string>;

export function blendFilters(
  filters: AppliedFilter[],
): FilterConfig; // Merged filter
```

### 7.3 Editor Service

```typescript
// src/services/editor.ts

export async function renderOverlayElement(
  baseImageUri: string,
  element: TextElement | StickerElement | DrawingElement,
): Promise<string>;

export async function renderAllOverlays(
  baseImageUri: string,
  elements: OverlayElement[],
): Promise<string>;

export async function exportSnapAsImage(
  mediaUri: string,
  overlays: OverlayElement[],
  filters: AppliedFilter[],
): Promise<string>;

export async function exportSnapAsVideo(
  videoUri: string,
  overlays: OverlayElement[],
  filters: AppliedFilter[],
): Promise<string>;

export function calculateElementPosition(
  containerSize: { width: number; height: number },
  elementSize: { width: number; height: number },
  position: { x: number; y: number },
): { x: number; y: number };

export function getElementBounds(element: OverlayElement): {
  x: number;
  y: number;
  width: number;
  height: number;
};
```

### 7.4 Picture service

```typescript
// src/services/snapService.ts

export async function uploadSnap(
  snap: Snap,
  mediaFile: File,
  onProgress?: (progress: number) => void,
): Promise<string>; // Returns Snap ID

export async function deleteSnap(snapId: string, userId: string): Promise<void>;

export async function viewSnap(
  snapId: string,
  userId: string,
  screenshotTaken?: boolean,
): Promise<void>;

export async function addReaction(
  snapId: string,
  userId: string,
  emoji: string,
): Promise<void>;

export async function replyToSnap(
  snapId: string,
  userId: string,
  reply: SnapReply,
): Promise<void>;

export async function getSnapReceipts(snapId: string): Promise<SnapView[]>;

export async function shareToStory(
  snap: Snap,
  duration?: number,
): Promise<void>;

export async function createDraft(snap: Partial<Snap>): Promise<string>;

export async function loadDraft(draftId: string): Promise<Snap>;

export async function deleteDraft(draftId: string): Promise<void>;
```

### 7.5 Face Detection Service

```typescript
// src/services/faceDetection.ts

export async function initializeFaceDetection(): Promise<void>;

export async function detectFacesInFrame(
  frameData: any,
): Promise<DetectedFace[]>;

export function shouldRenderEffect(face: DetectedFace): boolean;

export function getEffectPositioning(
  face: DetectedFace,
  effect: FaceEffectConfig,
): {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export async function trackFaceMovement(
  frames: any[],
  duration: number,
): Promise<FaceTrack[]>;

interface FaceTrack {
  trackingId: number;
  frames: Array<{
    timestamp: number;
    face: DetectedFace;
  }>;
}
```

---

## 8. Screen Implementations

### 8.1 CameraScreen - Detailed Implementation

```typescript
// src/screens/camera/CameraScreen.tsx

/**
 * CAMERA SCREEN - Main recording interface
 *
 * Layout:
 * ┌─────────────────────────┐
 * │                         │ (Status bar: battery, time)
 * │   Camera Preview        │ (60 FPS preview with face detection)
 * │   + Face Detection      │
 * │   + Filter Preview      │
 * │                         │
 * └─────────────────────────┘
 * ┌─────────────────────────┐ (Horizontal carousel)
 * │ Filter: None  B&W  Cool │ (25+ filters with preview chips)
 * │         Warm  Vibrant   │
 * └─────────────────────────┘
 * ┌─────────────────────────┐ (Bottom dock)
 * │ ◄ Flash ◎ Camera ⚙️     │ (Settings buttons)
 * │     🔴 (Capture Button) │ (Tap = photo, LongPress = video)
 * │                         │
 * └─────────────────────────┘
 */

interface CameraScreenState {
  cameraReady: boolean;
  recording: boolean;
  recordingDuration: number;
  faces: DetectedFace[];
  currentFilterId?: string;
  zoom: number;
  flashMode: FlashMode;
  facing: CameraFacing;
  selectedEffect?: FaceEffect;
}

// Hooks:
// - useCameraPermissions() → request/check
// - useFaceDetection() → continuous face detection
// - useRecording() → recording state management
// - useCamera() → camera device management

// Interactions:
// 1. Tap capture button → Photo (< 100ms)
// 2. Long press → Video recording (up to 600 seconds)
// 3. Scroll filters → Real-time preview
// 4. Double tap → Switch camera (front/back)
// 5. Pinch → Zoom (0.5x to 8x)
// 6. Swipe up → Open settings
// 7. Swipe filter left/right → Browse filters
// 8. Tap effect → Apply face effect
```

### 8.2 EditorScreen - Detailed Implementation

```typescript
// src/screens/camera/EditorScreen.tsx

/**
 * EDITOR SCREEN - Post-capture editing
 *
 * Layout:
 * ┌─────────────────────────────────┐
 * │ ◄ Close      Export      ...     │ (Top bar)
 * │                                 │
 * │      [Photo/Video Preview]      │ (Full screen with overlays)
 * │      (Tap to select elements)    │
 * │                                 │
 * ├─────────────────────────────────┤
 * │ T  🎨 ⭕ ✏️  📊  🔥  Undo Redo  │ (Tools: Text, Sticker, Drawing, Poll)
 * └─────────────────────────────────┘
 */

interface EditorScreenState {
  selectedElementId?: string;
  editMode: EditMode;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  panOffset: { x: number; y: number };
}

// Key Features:
// 1. Tap on elements to select/edit
// 2. Pinch to zoom (preview only)
// 3. Pan around preview (when zoomed)
// 4. Long press element → Delete option
// 5. Double tap → Edit text/sticker
// 6. Swipe up → More options
// 7. Undo/Redo with visual feedback
// 8. Layers panel (z-index management)

// Tool Interactions:
// TEXT: Tap position → Enter text → Format (font, size, color)
// STICKER: Scroll gallery → Tap sticker → Place on canvas
// DRAWING: Activate → Draw paths → Color picker → Save
// FILTER: Slider → Adjust intensity → Apply
// POLL: Enter question → Add options → Set type → Place
```

### 8.3 ShareScreen - Detailed Implementation

```typescript
// src/screens/camera/ShareScreen.tsx

/**
 * SHARE SCREEN - Recipients & publishing
 *
 * Layout:
 * ┌──────────────────────────────┐
 * │ ◄ Back                 Send   │ (Top bar)
 * ├──────────────────────────────┤
 * │ [Snap Preview - Thumbnail]   │ (Small preview)
 * ├──────────────────────────────┤
 * │ Friends:                     │ (Recipients list)
 * │ ✓ Alice    ✓ Bob             │ (Tap to toggle)
 * │   Charlie   ✓ Diana          │
 * │ Story  ✓                     │ (Toggle story)
 * ├──────────────────────────────┤
 * │ Caption:                     │ (Optional message)
 * │ [________________]           │
 * ├──────────────────────────────┤
 * │ ☐ Allow replies              │ (Settings)
 * │ ☐ View receipts              │
 * │ ☐ Screenshot notification    │
 * ├──────────────────────────────┤
 * │ ▓▓▓▓▓░░░░ Uploading 50%      │ (Progress)
 * └──────────────────────────────┘
 */

interface ShareScreenState {
  selectedRecipients: Set<string>;
  shareToStory: boolean;
  caption: string;
  allowReplies: boolean;
  allowReactions: boolean;
  viewReceiptsVisible: boolean;
  uploading: boolean;
  uploadProgress: number;
}

// Key Features:
// 1. Search friends (text input)
// 2. Favorite friends list
// 3. Recent friends list
// 4. Group selection
// 5. Story toggle
// 6. Keyboard dismissal on scroll
// 7. Upload with pause/resume capability
// 8. Error handling & retry
```

---

## 9. Feature Specifications

### 9.1 Photo Capture

```typescript
/**
 * Requirements:
 * - Capture within 100ms of tap
 * - Save at native resolution (12MP+)
 * - Auto white balance adjustment
 * - Auto-focus before capture
 * - Haptic feedback on capture
 * - Optional: Burst mode (10 photos/sec)
 */

// Capture Flow:
// 1. User taps capture button
// 2. System focuses (100-150ms)
// 3. Flash fires (if enabled)
// 4. Photo captured (1-2MB)
// 5. Navigate to editor
```

### 9.2 Video Recording

```typescript
/**
 * Requirements:
 * - Start recording within 200ms of long-press
 * - 1080p @ 30 FPS (or device maximum)
 * - H.264 video codec
 * - AAC audio codec
 * - Bitrate: 3-6 Mbps for 1080p
 * - Support pause/resume
 * - Max duration: 600 seconds (10 minutes)
 * - Continuous audio during recording
 * - Auto-switch to optimal quality
 */

// Recording Flow:
// 1. Long-press capture button
// 2. Record start sound
// 3. Timer shows duration (00:00)
// 4. Preview updates at ~30 FPS
// 5. Face detection continues
// 6. Release to stop, or tap stop button
// 7. Processing begins (compression)
```

### 9.3 Real-time Filters

```typescript
/**
 * Filter Categories (25+ total):
 *
 * VINTAGE (3)
 * - Sunset Vintage (sepia, reduced sat)
 * - Film (grain, slight blur, vignette)
 * - Polaroid (color shift, dark edges)
 *
 * BLACK & WHITE (3)
 * - Classic B&W (straight conversion)
 * - High Contrast B&W (+contrast, +brightness)
 * - Moody B&W (-brightness, +contrast)
 *
 * COOL TONES (4)
 * - Cool Blue (hue shift, -saturation)
 * - Arctic (blue cast, high contrast)
 * - Cyberpunk (magenta/cyan split)
 * - Night Mode (low brightness, blue)
 *
 * WARM TONES (4)
 * - Warm Gold (hue shift, +saturation)
 * - Sunset Orange (orange cast, -brightness)
 * - Cozy Sepia (brown cast)
 * - Golden Hour (warm, +contrast)
 *
 * VIBRANT (3)
 * - Vivid (high saturation, high contrast)
 * - Neon (bright, digital, color separation)
 * - Psychedelic (inverted, high saturation)
 *
 * SOFT (3)
 * - Soft Focus (blur effect, -contrast)
 * - Dreamy (soft, low saturation)
 * - Pastel (soft, desaturated)
 *
 * RETRO (2)
 * - 80s (magenta/cyan, grain)
 * - VHS (color distortion, lines)
 *
 * ARTISTIC (2)
 * - Oil Painting (blur, posterize)
 * - Sketch (edge detection, B&W)
 */

// Filter Application:
// 1. Continuous preview in camera
// 2. Apply on tap (0ms for cache, <16ms for real-time)
// 3. Intensity slider (0 to 100%)
// 4. Blend multiple filters
// 5. Save custom filter presets
```

### 9.4 Text Overlay

```typescript
/**
 * Features:
 * - 12 font families (various styles)
 * - Adjustable size (8px to 200px)
 * - 256 color options (+ custom hex)
 * - Rotation (0 to 360°)
 * - Opacity (0 to 100%)
 * - Optional background
 * - Optional stroke/outline
 * - Optional shadow/glow
 * - Max 200 characters per text element
 * - Max 10 text elements per snap
 *
 * Fonts:
 * - Roboto (regular, bold, italic)
 * - Playfair Display (elegant)
 * - Caveat (handwriting)
 * - Pacifico (brush)
 * - Grand Hotel (script)
 * - Fredoka (rounded)
 * - Quicksand (geometric)
 * - Space Grotesk (modern)
 * - Courier (monospace)
 * - Comic Sans (fun)
 */

// Text Tool Flow:
// 1. User taps "T" button
// 2. Tap position on canvas
// 3. Keyboard opens with text input
// 4. Format options (font, size, color)
// 5. Tap outside → Confirm placement
// 6. Can reposition/edit by double-tapping
```

### 9.5 Sticker System

```typescript
/**
 * Sticker Library:
 * - 100+ stickers across 8 categories
 * - Mix of static & animated (GIF)
 * - Emoji stickers
 * - Custom bitmoji (if integrated)
 *
 * Categories:
 * - Emoji (50+)
 * - Animals (15+)
 * - Objects (20+)
 * - Nature (15+)
 * - Expressions (10+)
 * - Celebration (10+)
 * - Seasonal (15+)
 * - Custom/User-made (expandable)
 */

// Sticker Tool Flow:
// 1. User taps sticker button
// 2. Sticker picker shows categories
// 3. Tap sticker → Appears on canvas
// 4. Pinch to resize
// 5. Rotate by two-finger twist
// 6. Drag to reposition
// 7. Tap again to select, swipe to delete
```

### 9.6 Drawing Tool

```typescript
/**
 * Features:
 * - Freehand drawing
 * - Multiple brush styles (thin, medium, thick)
 * - 256 color palette
 * - Adjustable opacity
 * - Eraser tool
 * - Clear entire drawing
 * - Undo last stroke
 *
 * Brush Types:
 * - Normal (smooth)
 * - Marker (thick, slight transparency)
 * - Crayon (textured)
 * - Neon (glowing effect)
 */

// Drawing Flow:
// 1. User taps drawing/brush button
// 2. Canvas becomes active for touch
// 3. Draw freely with finger
// 4. Change color/brush mid-drawing
// 5. Eraser to remove strokes
// 6. Tap outside or "Done" → Confirm
```

### 9.7 Poll System

```typescript
/**
 * Poll Types:
 *
 * YES/NO
 * - Single question
 * - Two options: Yes / No
 * - Real-time vote counts
 *
 * MULTIPLE CHOICE
 * - Single question
 * - 2-4 options (A, B, C, D)
 * - Vote counts for each
 *
 * SLIDER
 * - "How would you rate this?"
 * - 1-10 scale (or 0-100)
 * - Shows distribution
 *
 * QUESTION
 * - Open-ended question
 * - Responses as text replies
 * - No voting, just answers
 */

// Poll Creation Flow:
// 1. User taps poll button
// 2. Choose poll type
// 3. Enter question text
// 4. Add options (if applicable)
// 5. Customize colors
// 6. Place on canvas
// 7. Recipients can respond
// 8. Results update in real-time
```

### 9.8 Face Effects (AR)

```typescript
/**
 * Face Effects (16 total):
 *
 * ACCESSORIES:
 * - Flower Crown (animated)
 * - Sunglasses (follows face)
 * - Crown (royal effect)
 * - Glasses (nerd effect)
 *
 * MASKS:
 * - Dog Filter (puppy ears, nose, tongue)
 * - Cat Filter (cat ears, whiskers, nose)
 * - Skull Mask (skeleton effect)
 * - Golden Mask (shiny effect)
 *
 * EXPRESSIONS:
 * - Heart Eyes (love effect)
 * - Devil Horns (mischievous)
 * - Tears (sad effect)
 * - Nose Blush (embarrassed)
 *
 * OVERLAYS:
 * - Bunny Ears (bunny nose)
 * - Butterfly (flying animation)
 * - Rainbow Mouth (colorful overlay)
 * - Ice Crown (frozen effect)
 *
 * Requires:
 * - Face detection (ML Kit)
 * - Landmark tracking (21-point face mesh)
 * - Real-time rendering
 */

// Effect Application:
// 1. Continuous face detection
// 2. Face visible → Show effect button
// 3. User taps effect
// 4. Immediately applies to faces
// 5. Follows face movement
// 6. Can adjust intensity/opacity
```

---

## 10. Advanced Features

### 10.1 Real-time Performance Optimization

```typescript
/**
 * OPTIMIZATION STRATEGIES:
 */

// 1. Camera Preview (60 FPS)
// - Use native camera module
// - Skip JavaScript frame processing
// - Render overlays on native layer
// - Debounce face detection to 30 FPS

// 2. Filter Application
// - Use native image processing (Metal on iOS, RenderScript on Android)
// - GPU acceleration for blur, color shifts
// - Cache filter configs
// - Batch apply filters

// 3. Face Detection
// - Run at 30 FPS maximum
// - Skip frames if face not found
// - Cache landmark calculations
// - Only re-detect on timeout

// 4. Memory Management
// - Stream video frames (don't hold in memory)
// - Delete temporary files immediately
// - Use weak references for large objects
// - Implement cleanup in useEffect

// 5. Video Compression
// - Process in background thread
// - Stream encoding (don't wait for full video)
// - Adaptive bitrate based on device
// - Use hardware encoding (H.264 codec)
```

### 10.2 Background Music for Videos

```typescript
/**
 * Background Music Feature:
 * - User can select music from library
 * - Music starts/stops with video
 * - Volume adjustment (fade in/out)
 * - Trim music to video duration
 * - Mix with original audio
 *
 * Implementation:
 * - Music library sourced from:
 *   - Royalty-free API (e.g., Pixabay Music, Freepik)
 *   - Licensed music service (Spotify API)
 *   - User's device music library
 *
 * Flow:
 * 1. User taps "Add Music" in editor
 * 2. Browse music library
 * 3. Preview music
 * 4. Trim to video length
 * 5. Adjust mix (original audio vs music)
 * 6. Save to video
 */
```

### 10.3 Boomerang Effect

```typescript
/**
 * Boomerang (looping video):
 * - Record 1-second video
 * - Play forward, then backward (loop)
 * - Creates mesmerizing looping effect
 *
 * Implementation:
 * 1. Capture video frames (30 FPS = 30 frames/sec)
 * 2. Reverse frame order
 * 3. Combine original + reversed
 * 4. Export as video file
 * 5. Duration = 2 seconds minimum
 */
```

### 10.4 Reverse Video

```typescript
/**
 * Reverse Video:
 * - Play video backward
 * - Slow motion reverse
 *
 * Implementation:
 * 1. Extract video frames
 * 2. Reverse frame order
 * 3. Re-encode video
 * 4. Maintain audio (optional)
 */
```

### 10.5 Screenshot Detection

```typescript
/**
 * Screenshot Notification:
 * - Notify user if someone screenshots their snap
 * - Requires secure rendering (can't screenshot media)
 *
 * Implementation:
 * - Native screenshot detection
 * - Send notification to sender
 * - Mark snap as "screenshot" in metadata
 * - Log timestamp
 *
 * Challenges:
 * - Can't prevent screenshots (Android limitation)
 * - Can only detect & notify
 * - Privacy implication
 */
```

### 10.6 Picture encryption

```typescript
/**
 * End-to-End Encryption:
 * - Encrypt snap before upload
 * - Decrypt only for intended recipient
 * - Zero-knowledge architecture
 *
 * Implementation:
 * - RSA key exchange (asymmetric)
 * - AES-256 content encryption (symmetric)
 * - HMAC for integrity
 * - Keys stored in secure enclave
 */
```

### 10.7 Picture expiry & Deletion

```typescript
/**
 * Auto-Deletion:
 * - Direct snaps: delete after viewing
 * - Story snaps: delete after 24 hours
 * - Unsent snaps: delete after 30 days
 *
 * Implementation:
 * - Firestore scheduled functions
 * - Firebase Storage lifecycle rules
 * - Local cleanup on next app open
 * - User override option (allow save)
 */
```

### 10.8 Analytics & Metrics

```typescript
/**
 * Track:
 * - Average capture time
 * - Most used filters
 * - Effect popularity
 * - Video average duration
 * - Engagement metrics
 *
 * Implementation:
 * - Firebase Analytics
 * - Custom events
 * - User segmentation
 * - A/B testing for features
 */
```

---

## 11. Performance & Optimization

### 11.1 Memory Management

```typescript
/**
 * Memory Budget:
 * - Camera preview: < 50MB
 * - Single photo (compressed): < 3MB
 * - Video (1min, 1080p): < 50MB
 * - Face detection model: < 10MB
 * - Filter library: < 5MB
 * - Overlay canvas: < 20MB
 *
 * TOTAL TARGET: < 150MB RAM
 */

// Optimization Techniques:
// 1. Use image pools (reuse memory)
// 2. Stream processing (don't load full video)
// 3. Lazy load sticker library
// 4. Unload filters not in use
// 5. Clear listener subscriptions
```

### 11.2 Storage Optimization

```typescript
/**
 * Storage Strategy:
 * - Original media: Temporary (deleted after upload)
 * - Thumbnails: Cached (1-week expiry)
 * - Filters/effects: Bundled with app
 * - Drafts: User-managed (notification if expired)
 *
 * Total App Size: < 100MB (before user media)
 */
```

### 11.3 Battery Consumption

```typescript
/**
 * Optimization:
 * - Reduce camera preview FPS during inactivity
 * - Pause face detection if not needed
 * - Use more efficient codecs (H.265)
 * - Reduce screen brightness during recording
 * - Stop background tasks during upload
 */
```

### 11.4 Network Optimization

```typescript
/**
 * Upload Strategy:
 * - Compress before upload
 * - Parallel upload (4 snaps max)
 * - Pause on weak connection (< 1 Mbps)
 * - Retry with exponential backoff
 * - Resume from last position
 * - Cache failed uploads (24-hour expiry)
 */
```

---

## 12. Integration Points

### 12.1 Navigation Integration

```typescript
// Update navigation to include:
export type MainStackParamList = {
  // ... existing
  Camera: undefined;
  CameraEditor: { snap: CapturedMedia };
  CameraShare: { snapId: string };
};

// In RootNavigator:
// <Stack.Screen name="Camera" component={CameraScreen} />
// <Stack.Screen name="CameraEditor" component={EditorScreen} />
// <Stack.Screen name="CameraShare" component={ShareScreen} />
```

### 12.2 Chat Integration

```typescript
/**
 * Send snap in DM:
 * 1. User creates snap in camera
 * 2. Shares to specific friend (direct message)
 * 3. Snap appears in chat thread
 * 4. View tracking in DM context
 * 5. Reply option in chat
 */

// In ChatScreen:
// - Add snap thumbnail to message list
// - Tap to open full viewer
// - Show "Viewed at HH:MM" timestamp
// - Allow reply via chat input
```

### 12.3 Story Integration

```typescript
/**
 * Share to Story:
 * 1. User creates snap
 * 2. Toggles "Share to Story"
 * 3. 24-hour expiry
 * 4. Appears in story timeline
 * 5. Friends can view & react
 */

// In UserProfileScreen:
// - Add story section
// - Show last 24 hours of snaps
// - Progress rings for expiry
// - View count
```

### 12.4 Friend Activity

```typescript
/**
 * Activity Feed:
 * 1. Track snap sends (who sent to whom)
 * 2. Track reactions/replies
 * 3. Show in activity feed
 * 4. Timestamp + context
 */

// In ActivityFeedScreen:
// - "Alice sent you a snap"
// - "Bob reacted to your snap"
// - "Diana replied: Great photo!"
```

### 12.5 User Profile Integration

```typescript
/**
 * Profile Camera Gallery:
 * 1. Show best snaps on profile
 * 2. User selects favorites
 * 3. Display in gallery grid
 * 4. Public or friends-only
 */

// In UserProfileScreen:
// - Add "Snap Gallery" section
// - Show grid of best snaps
// - Tap to open snap viewer
```

---

## 13. User Flows

### 13.1 Standard Snap Send Flow

```
1. User opens app
2. Taps camera icon (or navigates to CameraScreen)
3. Sees camera preview with filter carousel
4. Taps capture button → Photo taken
5. Navigates to EditorScreen
6. Adds text "Hi!" with font/color
7. Adds sticker (emoji)
8. Applies filter (Sunset Vintage @ 50% intensity)
9. Taps "Next" → ShareScreen
10. Selects friend "Alice"
11. Toggles "Allow replies" ON
12. Taps "Send"
13. Upload progress shows 0% → 100%
14. Success notification
15. Returns to camera

Timing:
- Steps 3-4: 1 second
- Steps 5-8: 30 seconds
- Step 9-12: 15 seconds
- Step 13-14: 5-30 seconds (depends on file size & connection)
- TOTAL: ~50-75 seconds
```

### 13.2 Video with Music Flow

```
1. User opens camera
2. Long-presses capture button
3. Records 5-second video
4. Releases button
5. EditorScreen opens
6. Taps "Add Music"
7. Browses music library
8. Previews track
9. Selects track (auto-trims to 5 seconds)
10. Adjusts audio mix (80% music, 20% original)
11. Reviews result
12. Shares to friend or story
13. Upload begins
```

### 13.3 Filter Experimentation Flow

```
1. Camera open
2. Swipe filter carousel left/right
3. Each filter applies in real-time preview
4. Try 5-6 filters
5. Find "Neon" filter
6. Adjust intensity with slider (0% → 75%)
7. Takes photo with neon effect
8. Edit if desired
9. Share
```

---

## 14. Dependencies & Libraries

### 14.1 Required Packages

```json
{
  "dependencies": {
    // Camera
    "react-native-camera": "^4.2.1",
    "expo-camera": "^13.0.0",
    "react-native-video": "^5.2.1",

    // Image/Video Processing
    "react-native-skia": "^0.1.200",
    "expo-image-manipulator": "^11.3.0",
    "react-native-ffmpeg": "^0.6.5",

    // Face Detection
    "@react-native-firebase/ml-vision": "^16.0.0",
    "react-native-vision-camera": "^2.15.0",

    // UI Components
    "react-native-gesture-handler": "^2.11.0",
    "react-native-reanimated": "^3.0.0",
    "react-native-paper": "^5.8.0",

    // State Management
    "redux": "^4.2.1",
    "react-redux": "^8.1.1",
    "redux-persist": "^6.0.0",

    // File Management
    "react-native-fs": "^2.20.0",
    "rn-fetch-blob": "^0.12.0",

    // Audio
    "react-native-audio-record": "^0.2.8",
    "react-native-audio-toolkit": "^2.0.9",

    // Utilities
    "uuid": "^9.0.0",
    "date-fns": "^2.29.0",
    "lodash": "^4.17.21"
  }
}
```

### 14.2 Optional Packages

```json
{
  "dependencies": {
    // Additional Effects
    "react-native-lottie": "^6.0.0", // Animated stickers
    "react-native-ar": "^0.2.0", // Advanced AR

    // Music Library
    "react-native-track-player": "^3.2.0", // Audio playback

    // Advanced Compression
    "react-native-ffmpeg-full": "^0.6.5", // Full FFmpeg

    // Offline Support
    "realm": "^11.10.0", // Local database for drafts

    // Analytics
    "@segment/analytics-react-native": "^2.10.0"
  }
}
```

---

## 15. Implementation Phases

### Phase 1: Foundation (Week 1)

- [x] Create type definitions
- [x] Set up Redux store structure
- [x] Implement basic camera screen
- [x] Request permissions

### Phase 2: Core Camera (Week 2)

- [ ] Photo capture (< 100ms)
- [ ] Video recording
- [ ] Camera controls (flash, zoom, switch)
- [ ] Haptic feedback

### Phase 3: Filters (Week 3)

- [ ] Implement 25+ filters
- [ ] Real-time filter preview
- [ ] Filter carousel UI
- [ ] Intensity adjustment

### Phase 4: Face Detection (Week 4)

- [ ] Set up ML Kit
- [ ] Real-time face detection (30 FPS)
- [ ] Face effect system
- [ ] 16 AR effects

### Phase 5: Editor (Week 5)

- [ ] Overlay canvas
- [ ] Text tool with fonts
- [ ] Sticker system
- [ ] Drawing tool

### Phase 6: Polls & Advanced (Week 6)

- [ ] Poll creation
- [ ] Poll response handling
- [ ] Undo/redo system
- [ ] Element manipulation

### Phase 7: Sharing & Backend (Week 7)

- [ ] Share screen
- [ ] Upload to Firebase
- [ ] Snap document creation
- [ ] View tracking

### Phase 8: Integration (Week 8)

- [ ] Chat integration
- [ ] Story system
- [ ] Activity feed
- [ ] Profile integration

### Phase 9: Advanced Features (Week 9)

- [ ] Background music
- [ ] Boomerang effect
- [ ] Reverse video
- [ ] Encryption

### Phase 10: Polish & Testing (Week 10)

- [ ] Performance optimization
- [ ] Bug fixes
- [ ] Accessibility
- [ ] Comprehensive testing

---

## 16. File Structure

### New Files to Create

```
src/
├── screens/camera/
│   ├── CameraScreen.tsx              # Main camera screen
│   ├── EditorScreen.tsx              # Photo/video editor
│   ├── ShareScreen.tsx               # Share recipients & settings
│   ├── SnapViewerScreen.tsx          # View received snaps
│   └── SnapHistoryScreen.tsx         # Snap gallery
│
├── components/camera/
│   ├── CameraPreview.tsx             # Camera feed
│   ├── FilterCarousel.tsx            # Filter picker
│   ├── CameraControlBar.tsx          # Controls (capture, flash, etc)
│   ├── RecordingTimer.tsx            # Video duration display
│   │
│   ├── Editor/
│   │   ├── EditorCanvas.tsx          # Main editing surface
│   │   ├── TextTool.tsx              # Text input & formatting
│   │   ├── StickerPicker.tsx         # Sticker selection
│   │   ├── DrawingTool.tsx           # Drawing canvas
│   │   ├── FilterAdjuster.tsx        # Filter intensity
│   │   └── PollCreator.tsx           # Poll UI
│   │
│   ├── Share/
│   │   ├── RecipientList.tsx         # Friend selection
│   │   ├── StoryToggle.tsx           # Story share option
│   │   └── SnapPreview.tsx           # Preview before send
│   │
│   └── Common/
│       ├── CameraButton.tsx          # Capture button
│       ├── BottomDock.tsx            # Bottom control bar
│       ├── ColorPicker.tsx           # Color selection
│       └── FontSelector.tsx          # Font picker
│
├── services/camera/
│   ├── cameraService.ts              # Photo/video capture
│   ├── filterService.ts              # Filter operations
│   ├── faceDetectionService.ts       # Face detection & effects
│   ├── editorService.ts              # Overlay rendering
│   ├── snapService.ts                # Snap CRUD operations
│   ├── videoService.ts               # Video processing
│   └── musicService.ts               # Background music
│
├── hooks/camera/
│   ├── useCameraPermissions.ts       # Permission management
│   ├── useFaceDetection.ts           # Face detection hook
│   ├── useRecording.ts               # Recording state
│   ├── useCamera.ts                  # Camera controls
│   └── useEditor.ts                  # Editor state
│
├── store/slices/
│   ├── cameraSlice.ts                # Camera state
│   ├── editorSlice.ts                # Editor state
│   └── snapSlice.ts                  # Snap state
│
├── types/camera.ts                   # Camera type definitions
│
├── data/camera/
│   ├── filters.ts                    # Filter definitions
│   ├── faceEffects.ts                # Face effect configs
│   └── stickers.ts                   # Sticker library
│
└── utils/camera/
    ├── cameraUtils.ts                # Helper functions
    ├── filterUtils.ts                # Filter processing
    └── mediaUtils.ts                 # Media manipulation
```

---

## 17. Testing Strategy

### 17.1 Unit Tests

```typescript
// __tests__/camera/cameraService.test.ts
describe("Camera Service", () => {
  describe("capturePhoto", () => {
    it("should capture photo within 100ms");
    it("should handle camera errors gracefully");
    it("should save photo to correct location");
  });

  describe("compressImage", () => {
    it("should reduce file size by 60-70%");
    it("should maintain image quality");
  });
});

// __tests__/camera/filterService.test.ts
describe("Filter Service", () => {
  describe("applyFilter", () => {
    it("should apply filter in < 16ms");
    it("should blend multiple filters");
  });
});
```

### 17.2 Integration Tests

```typescript
// __tests__/camera/snapFlow.test.ts
describe("Snap Creation Flow", () => {
  it("should capture → edit → share → upload");
  it("should handle upload failures with retry");
  it("should update friends view list on completion");
});
```

### 17.3 Performance Tests

```typescript
// __tests__/camera/performance.test.ts
describe("Camera Performance", () => {
  it("camera preview should maintain 60 FPS");
  it("filter preview should update in < 16ms");
  it("face detection should run at 30 FPS");
  it("video encoding should use hardware acceleration");
});
```

### 17.4 Device Tests

```
- iPhone SE (small screen, older processor)
- iPhone 14 Pro (high-end)
- Samsung Galaxy A12 (mid-range Android)
- OnePlus 11 (high-end Android)
- Pixel 4a (mid-range Android)
```

---

## 18. Feature Suggestions

### 18.1 Additional Features to Consider

1. **Live Chat with Snaps**
   - Send snaps in video calls
   - Draw while on call
   - Share screen for collaborative editing

2. **Picture Marketplace**
   - Sell custom filters
   - Creator economy
   - Trending effects

3. **Group Pictures**
   - Collaborative snap creation
   - Multiple contributors
   - Real-time sync

4. **Picture Memories**
   - On this day: Show snaps from 1 year ago
   - Monthly recap
   - Year in review video

5. **Advanced Editing**
   - Crop & rotate
   - Brightness/contrast sliders
   - Blur/focus adjustment
   - Red-eye removal

6. **Voice Effects**
   - Voice modulation (helium, deep, echo)
   - Speech to text
   - Sound effects library

7. **Picture Remixing**
   - Use others' snaps as base
   - Add your own elements
   - Collaborative art

8. **Picture Reactions**
   - More emoji reactions
   - Custom reaction packs
   - Animated reactions (Lottie)

9. **Scheduled Snaps**
   - Schedule send time
   - Recurring snaps
   - Birthday reminders

10. **Picture NFTs**
    - Mint special snaps as NFTs
    - Tradeable Picture collections
    - Blockchain integration

11. **Picture Comments**
    - Threaded comments on snaps
    - @ mentions
    - Comment notifications

12. **Picture Editing After Send**
    - Edit caption
    - Add more recipients
    - Change expiry time

13. **Picture Analytics**
    - View analytics for story snaps
    - Peak view times
    - Engagement metrics

14. **Picture Backup**
    - Auto-backup to cloud
    - Sync across devices
    - Recovery options

---

## Summary

This comprehensive plan covers a Camera-Based camera system with:

### Core Features (MVP)

- Photo & video capture
- 25+ real-time filters
- Text overlay with 12 fonts
- 100+ stickers
- Drawing tool
- AR face effects (16 types)
- Poll system
- Direct messaging integration
- Story system
- Upload & sharing

### Advanced Features

- Background music
- Boomerang effect
- Reverse video
- Screenshot detection
- End-to-end encryption
- Auto-deletion
- Analytics

### Performance Target

- Camera startup: < 300ms
- Photo capture: < 100ms
- Video start: < 200ms
- Filter preview: < 16ms (60 FPS)
- Face detection: 30 FPS
- Total RAM usage: < 150MB

### Integration

- Chat system
- Friend activity
- User profiles
- Stories timeline
- Notifications

**Estimated Implementation: 10 weeks**

**Team Size: 3-4 developers** (1 backend, 2-3 mobile)

---

**Next Steps:**

1. Review this plan thoroughly
2. Validate assumptions with stakeholders
3. Finalize technology stack
4. Create detailed sprint planning
5. Begin Phase 1 implementation

