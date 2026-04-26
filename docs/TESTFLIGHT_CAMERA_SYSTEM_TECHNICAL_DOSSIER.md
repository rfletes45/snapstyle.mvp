# TestFlight Camera System Technical Dossier

Date: 2026-04-20
Repository: snapstyle-mvp
Target runtime: iOS TestFlight / native release build
Audit mode: Read-only code audit
Implementation changes in this pass: None

This dossier describes the current camera and camera-derived media system as it exists in source today. It is written as a handoff artifact for a later fix, refactor, stabilization, or performance pass.

## 1. Executive Summary

The app does not have one camera system. It has one primary in-app camera and editor stack, plus several parallel camera or capture-adjacent paths that bypass it entirely.

The most important current truths are:

1. The primary in-app camera is `src/screens/camera/CameraScreen.tsx`, backed by VisionCamera when available and `expo-camera` as fallback.
2. Chat and group media sending do not use the full share pipeline. They use a chat-specific return-route handoff plus a local-first message sync/upload pipeline.
3. Stories currently exist in two different architectures:
   - a direct story service using Storage path `stories/{authorId}/{storyId}.jpg` and Firestore collection `stories`
   - a snap-based story model using `Pictures` plus an uppercase `Stories` index
4. Profile photo, onboarding photo, group avatar, group background, and QR scanning all use separate capture implementations, mostly through `expo-image-picker` or `expo-camera`, not the unified camera screen.
5. The full camera share path is materially less production-ready than the chat path. `ShareScreen` still loads mock friends instead of real recipients.
6. Video capture is exposed in the main camera UI, but the editor/export stack is strongly photo-first. Recorded-video handling is not end-to-end convincing.
7. Permission handling is duplicated across multiple layers and some photo-library helpers are placeholders or optional-module fallbacks.
8. TestFlight behavior depends heavily on the VisionCamera native path, app-state transitions, and release-only GPU startup timing.
9. Several pieces of camera metadata drift from the final exported pixels because important editor state is held only in local component state, not in the persisted snap model.
10. No dedicated camera-focused test coverage was found under `__tests__` for the major camera, share, story, picker, or scanner flows.

The practical outcome is that camera work in this repo should be approached as a system-unification problem, not as a single-screen bug-fix problem.

## 2. Audit Scope And Method

This audit was performed by reading the current source code and build configuration only. No application logic was changed. No runtime fixes were applied.

The review focused on:

1. Camera entry points
2. Navigation into and out of camera flows
3. Permissions and privacy strings
4. Live preview rendering
5. Capture controls and gestures
6. Editor and export behavior
7. Chat, group, story, profile, onboarding, group-photo, and QR flows
8. Upload, storage, and sync behavior
9. Release and TestFlight-specific risk surfaces
10. Manual QA and future stabilization priorities

Important limitation: this dossier is code-grounded, but not device-verified in this pass. Where runtime behavior is inferred from code, that is stated explicitly.

## 3. Build And Runtime Foundation

| Area                   | Current state                                                                                | Implication                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Framework              | React Native `0.81.5`, Expo `~54.0.31`, React `19.1.0`                                       | Native build behavior matters more than Expo Go behavior for TestFlight.                               |
| Primary camera libs    | `react-native-vision-camera`, `expo-camera`, `expo-image-picker`                             | The app intentionally supports multiple capture backends.                                              |
| Filter/render libs     | `@shopify/react-native-skia`, `react-native-view-shot`                                       | The preview/export pipeline is mixed: GPU filter rendering plus screenshot compositing fallback.       |
| Upload/storage         | Firebase Storage, Firestore, Cloud Functions                                                 | Media output paths differ by feature area.                                                             |
| iOS build config       | `app.config.ts` sets iOS build number `41` and deployment target `16.0`                      | TestFlight uses the native module/plugin configuration from Expo config, not Expo Go fallbacks.        |
| VisionCamera plugin    | `react-native-vision-camera` plugin enabled with frame processors and microphone permission  | Live filtered preview depends on native frame-processor support being present in the TestFlight build. |
| Camera backend flag    | `USE_VISION_CAMERA = true`                                                                   | Native builds should prefer VisionCamera, but the code still supports fallback loading.                |
| Local messaging flag   | `USE_LOCAL_STORAGE = true` on native                                                         | Chat media sends use local-first optimistic insertion and background sync.                             |
| Staged upload flag     | `CHAT_FEATURES.CHAT_STAGED_UPLOADS = false`                                                  | The newer staged chat-media pipeline exists but is not the active production path.                     |
| Optional media library | `expo-media-library` is not present in `package.json`                                        | Saving to the actual Photos library is conditional and may silently fall back to app-local storage.    |
| Removed native surface | `react-native-vision-camera-face-detector` was unused in current source and has been removed | The active camera feature set no longer carries this extra native dependency.                          |

### iOS privacy string observations

`app.config.ts` currently defines:

- `NSCameraUsageDescription: "Vibe needs camera access for video calls"`
- `NSMicrophoneUsageDescription: "Vibe needs microphone access for calls"`
- `NSPhotoLibraryUsageDescription: "Vibe needs photo library access to save and share photos"`

The VisionCamera plugin config also includes broader text for photos, videos, and microphone access. The source therefore contains mismatched privacy messaging between app-level Info.plist values and camera-plugin values.

For a TestFlight build, that mismatch matters because the app uses camera access for much more than calls.

## 4. System Ownership Map And File Inventory

### 4.1 Primary unified camera stack

| File                                            | Weight    | Relevance                                                                                                                |
| ----------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `App.tsx`                                       | Primary   | Mounts the global `CameraProvider`, making camera/snap state app-wide rather than route-local.                           |
| `app.config.ts`                                 | Primary   | Defines iOS privacy strings, VisionCamera plugin config, and native build settings that determine TestFlight behavior.   |
| `constants/featureFlags.ts`                     | Primary   | Enables VisionCamera and local-first messaging, while disabling staged chat uploads.                                     |
| `src/navigation/RootNavigator.tsx`              | Primary   | Lazily loads `Camera` and `CameraShare`, sets transitions, and applies stack-wide `freezeOnBlur`.                        |
| `src/store/CameraContext.tsx`                   | Primary   | Central reducer for camera settings, recording state, editor state, and snap share state.                                |
| `src/hooks/camera/useCameraHooks.ts`            | Primary   | Provides permission checks, camera refs, photo capture, recording, and snap upload/share hooks.                          |
| `src/services/camera/cameraService.ts`          | Primary   | Owns permission routing, photo capture, video recording, compression, thumbnailing, and local file save/delete behavior. |
| `src/screens/camera/CameraScreen.tsx`           | Primary   | Core in-app camera and editor screen; this is the main camera UI for native capture.                                     |
| `src/components/camera/LiveFilterCamera.tsx`    | Primary   | VisionCamera wrapper with Skia frame processor and imperative compatibility layer.                                       |
| `src/components/camera/SkiaFilteredImage.tsx`   | Primary   | Editor-side filtered image renderer and snapshot source for pixel-accurate export when overlays are absent.              |
| `src/components/camera/CameraFilterOverlay.tsx` | Primary   | Fallback filter approximation for the `expo-camera` path.                                                                |
| `src/components/camera/DrawingCanvas.tsx`       | Primary   | Live drawing overlay used by the editor.                                                                                 |
| `src/components/camera/PollCreator.tsx`         | Secondary | Poll authoring UI for editor overlays.                                                                                   |

### 4.2 Chat and group media send path

| File                                            | Weight    | Relevance                                                                                                                |
| ----------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/components/chat/CameraLongPressButton.tsx` | Secondary | Chat toolbar launcher: short tap opens camera, 425 ms hold arms gallery.                                                 |
| `src/components/chat/ImagePickerButton.tsx`     | Secondary | Direct gallery picker button for chat.                                                                                   |
| `src/hooks/useAttachmentPicker.ts`              | Primary   | Bridges chat/group screens with camera return params, gallery selection, local tray state, and immediate-send callbacks. |
| `src/screens/chat/ChatScreen.tsx`               | Primary   | DM screen that wires direct camera/gallery sends into the messaging pipeline.                                            |
| `src/screens/groups/GroupChatScreen.tsx`        | Primary   | Group chat equivalent of the DM media-send integration.                                                                  |
| `src/chat/sendDraft.ts`                         | Primary   | Converts local media attachments into `chat.sendMessage(...)` calls.                                                     |
| `src/hooks/useChat.ts`                          | Primary   | Active local-first send pipeline: optimistic SQLite insert plus background sync trigger.                                 |
| `src/services/sync/syncEngine.ts`               | Primary   | Uploads pending local attachments and calls `sendMessageV2`.                                                             |
| `src/services/storage.ts`                       | Primary   | Real upload path for chat media attachments, thumbnails, and several other media features.                               |
| `src/services/messaging/stagedUpload.ts`        | Secondary | Newer staging pipeline for chat media, currently disabled.                                                               |
| `firebase-backend/functions/src/chatMedia.ts`   | Secondary | Server-side commit and signed-URL logic for staged chat attachments, not currently on the active client path.            |

### 4.3 Full snap/share/story-adjacent path

| File                                        | Weight    | Relevance                                                                                                 |
| ------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| `src/screens/camera/ShareScreen.tsx`        | Primary   | Recipient selection and publish screen for the full camera mode.                                          |
| `src/services/camera/snapService.ts`        | Primary   | Uploads full-mode snaps to Storage and Firestore `Pictures`.                                              |
| `src/services/story/snapStoryService.ts`    | Secondary | Snap-based story index built on `Pictures` plus uppercase `Stories`.                                      |
| `src/services/stories.ts`                   | Primary   | Direct story posting/viewing service built on lowercase `stories` and `stories/{authorId}/{storyId}.jpg`. |
| `src/screens/stories/StoriesScreen.tsx`     | Primary   | Story/moment launcher with native camera and gallery entry points.                                        |
| `src/screens/stories/StoryViewerScreen.tsx` | Primary   | Existing story viewer and new-story preview/post screen.                                                  |

### 4.4 Parallel capture flows outside the unified camera screen

| File                                                             | Weight    | Relevance                                                                        |
| ---------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------- |
| `src/components/profile/ProfilePicture/ProfilePictureEditor.tsx` | Primary   | Uses `expo-image-picker` camera or library for profile pictures.                 |
| `src/services/profileService.ts`                                 | Secondary | Uploads profile picture and thumbnail to user-specific storage paths.            |
| `src/screens/groups/GroupChatInfoScreen.tsx`                     | Primary   | Uses `expo-image-picker` for group avatar and chat background capture/selection. |
| `src/screens/onboarding/OnboardingPhotoScreen.tsx`               | Primary   | Optional signup photo flow using `expo-image-picker`.                            |
| `src/components/friends/QRCodeSheet.tsx`                         | Primary   | Separate `expo-camera` QR scanner with its own permission flow and torch toggle. |
| `src/utils/webImagePicker.ts`                                    | Secondary | Web fallback for camera capture and image selection.                             |

### 4.5 Supporting and incidental surfaces

| File                                           | Weight     | Relevance                                                                                                     |
| ---------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `src/utils/permissions.ts`                     | Secondary  | Duplicate permission helper layer with placeholder photo-library behavior.                                    |
| `src/services/camera/nativeVideoProcessing.ts` | Secondary  | Video compression/trim/filter/thumbnails service, mostly placeholder behavior today.                          |
| `src/services/camera/editorService.ts`         | Secondary  | Generic overlay/filter export helpers; much of it is placeholder and not the active CameraScreen export path. |
| `src/screens/stream/DirectCallScreen.tsx`      | Incidental | Uses Stream Video SDK camera state and requests camera permission, but is not part of the CameraScreen stack. |
| `src/screens/stream/VoiceChannelScreen.tsx`    | Incidental | Same separation as DirectCallScreen for voice-room video toggles.                                             |

### Parallel systems currently in play

1. Unified in-app camera/editor: `CameraScreen` + `CameraContext` + `cameraService`
2. OS camera via ImagePicker: profile, onboarding, group photo, group background
3. QR scanner camera: standalone `expo-camera` page-sheet flow
4. Chat camera send: unified camera as a return-to-route capture helper
5. Full share snap pipeline: `CameraScreen` full mode -> `ShareScreen` -> `snapService`
6. Direct story posting pipeline: `StoryViewerScreen` -> `services/stories.ts`
7. Snap-based story pipeline: `snapService` / `snapStoryService`
8. Call camera pipeline: Stream Video SDK state and permissions

## 5. Entry Points And Navigation Matrix

| Entry point             | Starting surface                          | Path                                                                                         | Output                                          | Notes                                                                     |
| ----------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| DM short-tap camera     | `CameraLongPressButton`                   | `ChatScreen` -> `navigation.navigate("Camera", { mode: "chat", returnRoute: "ChatDetail" })` | Immediate media send through chat pipeline      | Most direct native in-app camera send path.                               |
| DM hold-to-gallery      | `CameraLongPressButton`                   | Hold 425 ms, release, open gallery                                                           | Immediate gallery send or tray update           | Gesture semantics differ from the full camera.                            |
| Group short-tap camera  | Group chat toolbar                        | `GroupChatScreen` -> `Camera` in chat mode                                                   | Immediate group media send                      | Same return-route architecture as DM.                                     |
| Stories native capture  | `StoriesScreen`                           | `navigation.navigate("Camera", { mode: "full" })`                                            | Full snap/share flow, not direct `postStory`    | Native story capture does not use the same path as gallery story posting. |
| Stories gallery pick    | `StoriesScreen`                           | `expo-image-picker` -> `StoryViewer` with `isNewStory: true`                                 | Direct story post through `services/stories.ts` | Different backend than native capture.                                    |
| Profile picture camera  | `ProfilePictureEditor`                    | `ImagePicker.launchCameraAsync(...)`                                                         | Upload to `users/{userId}/profile/...`          | Bypasses CameraScreen completely.                                         |
| Group avatar camera     | `GroupChatInfoScreen`                     | `ImagePicker.launchCameraAsync(...)`                                                         | Upload to `groups/{groupId}/avatar/...`         | Separate uploader and crop behavior.                                      |
| Group background camera | `GroupChatInfoScreen`                     | `ImagePicker.launchCameraAsync(...)`                                                         | Upload to `groups/{groupId}/background/...`     | Aspect ratio targets screen shape, not square.                            |
| Onboarding photo camera | `OnboardingPhotoScreen`                   | `ImagePicker.launchCameraAsync(...)`                                                         | Stores local URI in onboarding state            | No immediate upload in this screen.                                       |
| QR scan                 | `QRCodeSheet`                             | `expo-camera` `CameraView` barcode scanner                                                   | `onScan(data)` callback                         | Separate scanner modal and permission hook.                               |
| Call camera             | `DirectCallScreen` / `VoiceChannelScreen` | Stream SDK camera toggle/flip                                                                | In-call local video                             | Separate camera system, separate lifecycle.                               |

### Navigation-level release observations

1. `Camera` and `CameraShare` are lazy `require(...)` routes in `RootNavigator`, which means module load happens at runtime, not app boot.
2. The main stack uses `freezeOnBlur: true`, so hidden screens stop React updates while kept on the stack.
3. The chat camera return path depends on `navigation.goBack()` followed by a delayed `navigation.navigate(returnRoute, { capturedImageUri })` after 50 ms. That is functional but timing-sensitive.
4. `CameraShare` uses a right-slide transition, so the full camera path is architecturally a two-screen flow even though the camera UI looks single-purpose.

## 6. Permissions And Privacy Model

### Permission handling surfaces

| Surface                        | Camera               | Microphone           | Photo library     | Notes                                                                        |
| ------------------------------ | -------------------- | -------------------- | ----------------- | ---------------------------------------------------------------------------- |
| `CameraScreen`                 | Yes                  | Yes                  | Save flow only    | `useCameraPermissions()` blocks the screen until camera and mic are granted. |
| `LiveFilterCamera`             | Uses camera hardware | Uses audio for video | No                | VisionCamera path requests mic because video recording is enabled.           |
| `useAttachmentPicker` gallery  | No                   | No                   | Yes               | Requests media-library permission through `expo-image-picker`.               |
| `ProfilePictureEditor`         | Yes                  | No                   | Yes               | Requests camera and media library independently.                             |
| `GroupChatInfoScreen`          | Yes                  | No                   | Yes               | Requests through ImagePicker camera/library usage.                           |
| `OnboardingPhotoScreen`        | Yes                  | No                   | Yes               | Separate onboarding permission prompts.                                      |
| `StoriesScreen` native capture | Via `CameraScreen`   | Via `CameraScreen`   | Gallery path only | Native story capture inherits the unified camera permission behavior.        |
| `QRCodeSheet`                  | Yes                  | No                   | No                | Uses `expo-camera`'s own `useCameraPermissions()` hook.                      |
| Call screens                   | Yes                  | Depends on call type | No                | Use `utils/permissions.requestCameraPermission()` and Stream SDK state.      |

### Important findings

1. The main camera asks for both camera and microphone even if the user only wants to take a still photo.
2. Permission logic is duplicated between `src/services/camera/cameraService.ts` and `src/utils/permissions.ts`.
3. `src/utils/permissions.ts` treats photo-library permission as granted when `expo-media-library` is absent.
4. `src/services/camera/cameraService.ts` also treats photo-library access as granted if the optional module is missing.
5. `CameraScreen` tries to save to the real photo library only if a runtime import of `expo-media-library` succeeds; otherwise it copies the file into app documents and still reports success.
6. The app-level camera and microphone usage descriptions are call-oriented, which does not match actual feature usage across chat, stories, profile setup, QR, and editing.

### TestFlight implication

On a real TestFlight build, permission prompts and Settings strings are part of the production experience. Any mismatch between strings and actual camera usage will be more visible than it is during local engineering use.

## 7. Primary Unified Camera Stack

### 7.1 Provider and reducer model

`App.tsx` mounts `CameraProvider` high in the app tree. The provider is global, not route-scoped.

Default camera state in `CameraContext` is:

- facing: back
- flash: off
- zoom: 0
- video quality: 1080p
- image format: jpeg
- autofocus: true
- white balance: auto
- exposure compensation: 0

Default snap share state is also global, including:

- current share snap
- selected recipients
- share-to-story flag
- caption
- allow replies
- allow reactions
- upload state

This means camera/share state can outlive a single route lifetime unless the reducer explicitly resets it.

### 7.2 CameraScreen mode model

`CameraScreen` has two orthogonal modes:

1. Route mode:
   - `full`
   - `chat`
2. Internal screen mode:
   - live camera mode when `capturedMedia === null`
   - editor mode when `capturedMedia !== null`

This is an important architectural choice: one screen owns live preview, capture, editing, export, and final dispatch.

### 7.3 Hook ownership inside the screen

`CameraScreen` depends on:

- `useCameraPermissions()` for camera/mic gating
- `useCamera()` for camera ref and readiness
- `usePhotoCapture()` for still-photo capture
- `useRecording()` for video record/stop lifecycle
- `useCameraState()` for hardware settings
- `useEditorState()` for overlay/filter reducer state
- `useSnapState()` for the full-share handoff to `ShareScreen`

This is the central stack future camera work will touch first.

## 8. Live Preview And Backend Switching

### 8.1 Backend selection logic

At module load time, `CameraScreen` uses a runtime selection strategy:

1. If `USE_VISION_CAMERA` is true, try to load VisionCamera and `LiveFilterCamera`.
2. If that fails, load `expo-camera`'s `CameraView`.
3. If both fail, render a "Camera Unavailable" screen.

This allows Expo Go style fallback behavior while keeping VisionCamera enabled for native builds.

### 8.2 VisionCamera path

`LiveFilterCamera.tsx` uses:

- `useCameraDevice(...)`
- `useSkiaFrameProcessor(...)`
- `Camera` from `react-native-vision-camera`

Key runtime behavior:

1. It renders real per-pixel filtered preview using a Skia color filter on each frame.
2. It exposes an imperative ref so existing `cameraService` code can still call `takePictureAsync`, `recordAsync`, and `stopRecording`.
3. It enables `photo={true}`, `video={true}`, and `audio={true}`.
4. It maps normalized zoom into the actual device zoom range, capped at 8x.
5. It passes through exposure.
6. It hardcodes `torch="off"` for preview.

That last point is important: the UI exposes flash mode, but there is no live preview torch path in the main camera preview.

### 8.3 `expo-camera` fallback path

When VisionCamera cannot load, `CameraScreen` renders `CameraView` and applies `CameraFilterOverlay` on top.

That fallback is materially different:

- the filter is a derived tint approximation, not pixel-accurate filtering
- preview behavior is dependent on `expo-camera`
- QR scanning elsewhere in the app also uses `expo-camera`, so the dependency remains required even if VisionCamera is the preferred backend

### 8.4 First-frame freeze mitigation already present in code

`CameraScreen` contains an explicit comment that eager overlay-color computation used to block the main thread for roughly 300-500 ms and contribute to an approximately 2 second TestFlight freeze during first frames.

The current implementation fixes that specific issue by lazily computing and caching filter swatch colors on first access.

This is strong evidence that the camera stack already has release-build-specific performance history.

### 8.5 Capability comparison

| Capability          | VisionCamera path                   | `expo-camera` fallback                                       |
| ------------------- | ----------------------------------- | ------------------------------------------------------------ |
| Live filter preview | Real Skia color-matrix processing   | Flat overlay approximation                                   |
| Runtime gating      | Uses `isActive` prop                | Rendered only when `isActive` and `CameraView` are available |
| Photo capture       | Imperative `takePhoto` wrapper      | Native `takePictureAsync` via camera ref                     |
| Video recording     | Imperative `startRecording` wrapper | Depends on fallback camera ref behavior                      |
| Zoom mapping        | Device-aware mapped zoom            | Raw normalized zoom prop                                     |
| Torch preview       | Hardcoded off                       | No dedicated torch UI here                                   |

## 9. Capture Controls And Gestures

### Implemented controls in the main camera UI

| Control                | Current behavior                             |
| ---------------------- | -------------------------------------------- |
| Photo capture          | Tap capture button                           |
| Video recording        | Long-press capture button, tap again to stop |
| Recording max duration | 60 seconds                                   |
| Camera flip            | Flip button and double-tap on preview        |
| Flash cycle            | Off -> Auto -> On                            |
| Pinch zoom             | Normalized 0..1 zoom, displayed up to 8x     |
| Exposure               | Slider from -2 EV to +2 EV                   |
| Timer                  | 0, 3, 10 seconds                             |
| Grid                   | Toggle overlay                               |
| Filter picker          | Lazy modal with filter swatches              |
| Recording timer        | On-screen MM:SS indicator                    |

### Not implemented or only partially implemented

| Capability                       | Current status                                              |
| -------------------------------- | ----------------------------------------------------------- |
| Explicit photo/video mode switch | Not present; tap means photo, long-press means video        |
| Tap-to-focus                     | Not implemented in the screen or service                    |
| Preview torch toggle             | Not implemented in the main camera UI                       |
| White balance UI                 | State exists in types/context, no active UI in CameraScreen |
| Manual focus point               | Not implemented                                             |
| Burst or rapid capture           | Not implemented                                             |
| Video trim UI                    | Not implemented                                             |
| Video filter export pipeline     | Placeholder-only outside the active screen path             |

### Capture-service details that matter

`cameraService.capturePhoto(...)`:

1. Uses quality `0.85` for speed.
2. Uses `skipProcessing` for the back camera.
3. Disables `skipProcessing` and enables `mirror` for the front camera.

`cameraService.startVideoRecording(...)` and `stopVideoRecording(...)`:

1. Keep an external `_activeRecordingPromise`.
2. Return placeholder dimensions of `1920 x 1080` rather than real probed dimensions.
3. Depend on UI-level recording time to fill duration after stop.

That means recorded-video metadata is partially synthetic.

## 10. Editor, Overlay, And Export Pipeline

### 10.1 What the editor actually renders

In editor mode, `CameraScreen` renders:

1. `SkiaFilteredImage` for the base captured image
2. `DrawingCanvas` for freehand drawing
3. draggable overlay elements for text, stickers, and polls
4. local UI controls for undo/redo, rotate, save, discard, and send/next

The editor is clearly built around a still image. Nothing in the active editor path renders or previews video frames.

### 10.2 Editor tool support

| Tool       | Live UI support      | Export support                                           | Persistence quality |
| ---------- | -------------------- | -------------------------------------------------------- | ------------------- |
| Text       | Yes                  | Yes, flattened through ViewShot or Skia snapshot context | Medium              |
| Sticker    | Yes                  | Yes, flattened                                           | Medium              |
| Poll       | Yes, visual overlay  | Yes, flattened visual only                               | Low                 |
| Drawing    | Yes                  | Yes, flattened visual only                               | Low                 |
| Filter     | Yes                  | Yes                                                      | Medium              |
| Rotate     | Yes                  | Yes, flattened result only                               | Low                 |
| Video edit | No real dedicated UI | No convincing end-to-end pipeline                        | Very low            |

### 10.3 Export behavior in `handleDone`

The editor export branch is:

1. Start with `capturedMedia.uri`
2. If there are no overlays and a filter is active, attempt a full-resolution Skia snapshot
3. Otherwise try `captureRef(...)` on the editor container via `react-native-view-shot`
4. If the media type is photo, run a final compression pass through `cameraService.compressImage(...)`
5. If route mode is `chat`, return the final URI to the caller
6. If route mode is `full`, construct a `Snap` object and navigate to `CameraShare`

### 10.4 Save-to-library behavior

`handleSaveToLibrary` first tries to import `expo-media-library` dynamically. If the import works and permissions are granted, it saves to the actual photo library.

If the import fails, it falls back to `cameraService.saveMediaToLibrary(...)`, which copies the file into the app's documents directory under `media/`.

From the user's perspective the UI still reports success. That means "Saved" does not necessarily mean "saved to the Photos app".

### 10.5 Important data-model drift inside the editor

Several editor behaviors are only tracked in local component state and are not fully reflected in the exported `Snap` metadata:

1. Dragged overlay positions live in local `elementPositions`, but `createdSnap.overlayElements` uses reducer state, not those final dragged positions.
2. Freehand drawing lives in local `drawPaths`, not in `overlayElements`, so structured drawing data is not carried forward in the created snap model.
3. Rotation lives in local `rotation` and is flattened into pixels, but is not represented in snap metadata.
4. Filter intensity lives in local `filterIntensity`; the reducer-side `appliedFilters` are not continuously updated when the slider changes.

This means the exported pixel result may look correct while the persisted structured metadata is stale or incomplete.

### 10.6 Recorded-video mismatch

The main camera UI allows long-press video recording, but the active editor path uses `SkiaFilteredImage`, which expects an image URI, not a video URI.

As a result, the current screen is architecturally photo-first with video exposure layered on top. A later stabilization pass should treat recorded-video editing and export as a separate feature track rather than assuming it is already complete.

## 11. Full Snap Share Flow

### Sequence

```text
CameraScreen (mode: full)
  -> capture photo or video
  -> editor export in handleDone()
  -> setShareSnap(createdSnap)
  -> navigate("CameraShare")
  -> ShareScreen builds final Snap + recipients + story toggle
  -> useSnapUpload().uploadSnap(...)
  -> SnapService.uploadPicture(...)
  -> upload media to Firebase Storage
  -> create Firestore document in Pictures
  -> update Users/{recipient}/ViewedSnaps
```

### Key implementation details

1. `ShareScreen` reads `currentShareSnap` from `CameraContext`.
2. `ShareScreen` loads a hardcoded mock friend list (`Alice`, `Bob`, `Charlie`, `Diana`, `Eve`) instead of querying real recipients.
3. `handlePublish()` fetches the local media URI into a blob, then calls `uploadSnap(...)`.
4. `snapService.uploadPicture(...)` uploads to `snaps/{userId}/{snapId}/media.{ext}` and creates a document in Firestore `Pictures`.
5. Recipient tracking is written under `Users/{recipientId}/ViewedSnaps`.

### Full-share-specific problems

1. Recipient selection is not production-ready because the friend list is mocked.
2. `showingStory` is kept in local screen state and diverges from reducer `shareToStory` state.
3. The full-share publish path does not call `publishSnapToStory(...)` directly.
4. `UPLOAD_SUCCESS` in `CameraContext` marks upload complete but does not clear `currentShareSnap` or selected recipients.
5. On success, `ShareScreen` navigates to `Camera`, which is a route jump, not a reducer reset.

The practical conclusion is that the full-share path exists, but it is significantly less mature than the chat-send path.

## 12. Chat Media Capture And Send Flow

### 12.1 Launcher behavior

Chat uses a dedicated launcher interaction model:

- short tap on `CameraLongPressButton` -> open in-app camera
- hold for 425 ms -> arm image-picker mode
- release after arming -> open gallery instead

This is a different UX contract from the main camera itself, where long-press starts video recording.

### 12.2 Native in-app camera return path

The chat camera path is:

```text
ChatScreen / GroupChatScreen
  -> useAttachmentPicker.captureFromCamera()
  -> navigate("Camera", { mode: "chat", returnRoute, returnData })
  -> CameraScreen.handleDone()
  -> goBack()
  -> delayed navigate(returnRoute, { capturedImageUri })
  -> useAttachmentPicker effect sees routeParams.capturedImageUri
  -> onCameraCapture(imageUri)
  -> sendMediaAttachmentMessage(...)
```

This handoff is route-param-driven rather than callback-driven.

### 12.3 Gallery path

`useAttachmentPicker` also supports:

1. multi-select gallery tray behavior
2. direct immediate-send behavior when `onGalleryPick` is supplied
3. web file-picker fallback through `src/utils/webImagePicker.ts`

### 12.4 Active production send path on native

With `USE_LOCAL_STORAGE = true`, the active send path is:

```text
sendMediaAttachmentMessage()
  -> useChat.sendMessage(... kind: "media")
  -> insert optimistic message and local attachments into SQLite
  -> prepend optimistic in-memory message
  -> trigger syncPendingMessages()
  -> syncEngine.syncSingleMessage()
  -> uploadMultipleAttachments()
  -> sendMessageV2 Cloud Function
```

### 12.5 Chat attachment upload paths

`syncEngine` chooses upload base paths as follows:

- DM image/media: `snaps/{conversationId}`
- DM voice: `dm-voice/{conversationId}`
- Group image/media: `groups/{conversationId}/messages`
- Group voice: `groups/{conversationId}/voice`

`storage.ts` uploads images sequentially, compresses them, and generates thumbnails.

### 12.6 Disabled staged-upload path

The repo contains a more advanced staged upload pipeline:

- `src/services/messaging/stagedUpload.ts`
- `firebase-backend/functions/src/chatMedia.ts`

But `CHAT_FEATURES.CHAT_STAGED_UPLOADS` is currently false, so the production chat path is still direct client upload plus `sendMessageV2` payload attachment URLs.

### 12.7 Chat-flow fragility

`useAttachmentPicker`'s `capturedImageUri` effect reads `attachments` while depending only on `routeParams?.capturedImageUri`. In the tray-add path, that is a stale-closure risk for append behavior.

## 13. Stories And Story-Adjacent Flows

This repo currently has two story systems.

### 13.1 Direct story service

Files:

- `src/screens/stories/StoriesScreen.tsx`
- `src/screens/stories/StoryViewerScreen.tsx`
- `src/services/stories.ts`

This path works like this:

1. Gallery pick in `StoriesScreen` launches `StoryViewer` with `isNewStory: true`.
2. `StoryViewerScreen` compresses the selected image.
3. `postStory(authorId, imageUri)` uploads to `stories/{authorId}/{storyId}.jpg`.
4. It writes a Firestore document to lowercase `stories`.
5. Views are tracked under lowercase `stories/{storyId}/views/{userId}`.

### 13.2 Snap-based story service

Files:

- `src/services/camera/snapService.ts`
- `src/services/story/snapStoryService.ts`

This path works differently:

1. Snaps are stored as `Pictures` documents.
2. Story visibility is represented on the picture document via `storyVisible`.
3. `publishSnapToStory(...)` updates the `Pictures` doc and also writes or updates an uppercase `Stories` document per user.

### 13.3 Entry-method split

The crucial inconsistency is here:

1. Native capture from `StoriesScreen` goes to `Camera` in full mode.
2. `Camera` full mode always routes to `CameraShare`, not to `StoryViewer`'s direct `postStory` path.
3. Gallery story posting goes through `StoryViewer` and lowercase `stories`.

So the user's actual backend path depends on how they entered the story flow.

### 13.4 Why this matters

The app currently mixes all of the following:

- Storage path family `stories/...`
- Firestore collection `stories`
- Firestore collection `Pictures`
- Firestore collection `Stories`

Those are not aliases. They are distinct backends and data models.

### 13.5 Story-system conclusion

The repo does not have one canonical story camera/output path today. It has at least two.

## 14. Profile, Group, Onboarding, QR, And Call Flows

### 14.1 Profile picture

`ProfilePictureEditor` uses `expo-image-picker` camera or library flow with square editing and uploads through `uploadProfilePicture(...)`.

`profileService.uploadProfilePicture(...)`:

- resizes main image to 1024x1024
- creates a 128x128 thumbnail
- uploads to:
  - `users/{userId}/profile/picture.jpg`
  - `users/{userId}/profile/picture_thumb.jpg`
- updates `Users/{userId}` with the new URLs

This is a separate capture and upload architecture.

### 14.2 Group avatar and chat background

`GroupChatInfoScreen` uses `expo-image-picker` for both camera and library access.

Storage paths are different again:

- avatar: `groups/{groupId}/avatar/picture.jpg`
- background: `groups/{groupId}/background/picture.jpg`

The group-background crop targets screen-like proportions rather than square proportions.

### 14.3 Onboarding photo

`OnboardingPhotoScreen`:

1. requests ImagePicker camera or library permission directly
2. captures/selects a square image
3. stores only the local `photoUri` in onboarding state

No upload happens here. This is a temporary onboarding-only capture surface.

### 14.4 QR scanner

`QRCodeSheet` is a separate `expo-camera` implementation with:

- its own `useCameraPermissions()` hook from `expo-camera`
- `CameraView`
- QR-only barcode settings
- torch toggle
- page-sheet modal presentation

It shares the device camera, but not the main camera architecture.

### 14.5 Call camera

`DirectCallScreen` and `VoiceChannelScreen` use Stream Video SDK camera state from `useCallStateHooks().useCameraState()`.

Important implications:

1. Call video is not built on `CameraScreen`.
2. Call camera permission requests go through `src/utils/permissions.ts`.
3. Call camera toggle/flip lifecycles are separate from snap/chat camera state.

The app therefore contains a camera feature area that is user-visible but architecturally outside the main camera subsystem.

## 15. Storage, Upload, And Temporary File Handling

### 15.1 There is no single upload service

| Use case                | Service                                    | Storage convention                                                  |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| Chat media              | `src/services/storage.ts` via `syncEngine` | `snaps/{conversationId}` or `groups/{conversationId}/messages`      |
| Full snap share         | `src/services/camera/snapService.ts`       | `snaps/{userId}/{snapId}/media.{ext}`                               |
| Direct story post       | `src/services/stories.ts`                  | `stories/{authorId}/{storyId}.jpg`                                  |
| Profile photo           | `src/services/profileService.ts`           | `users/{userId}/profile/...`                                        |
| Group avatar/background | `src/services/storage.ts` helpers          | `groups/{groupId}/avatar/...` and `groups/{groupId}/background/...` |

### 15.2 Temporary export files

`CameraScreen` creates temporary files in cache for:

- Skia save snapshot
- Skia export snapshot
- ViewShot composite output

These are necessary for export, but there is no obvious end-of-flow cleanup for the temporary camera export files created during save/send.

### 15.3 Compression layering

Compression exists in multiple places:

1. `cameraService.compressImage(...)`
2. `storage.compressImage(...)`
3. `profileService.uploadProfilePicture(...)` image manipulation
4. `uploadAttachmentV2(...)` image compression before upload
5. `StoryViewerScreen` direct compression before `postStory(...)`

That duplication means image quality, size, and timing are feature-dependent.

### 15.4 Video processing is mostly placeholder today

`src/services/camera/nativeVideoProcessing.ts` includes APIs for:

- video compression
- thumbnail extraction
- frame extraction
- trim
- filter application

But the current implementation largely returns placeholder metadata or the original URI. It also contains a stub thumbnail implementation when `expo-video-thumbnails` is not installed.

For TestFlight, that means any path depending on true video transcoding or proper video thumbnails should be treated as high-risk until proven on-device.

### 15.5 Generic editor service is also mostly placeholder

`src/services/camera/editorService.ts` contains generalized overlay rendering and video export ideas, but much of it is placeholder behavior and it is not the actual live export path used by `CameraScreen`.

### 15.6 File-save semantics are inconsistent

"Save" in the camera editor can mean:

1. real save to the Photos library if an optional module is available
2. app-internal document copy if the module is not available

Those are materially different user outcomes.

## 16. Lifecycle, App State, And TestFlight Behavior

### 16.1 Main camera lifecycle controls

`CameraScreen` computes:

```text
isActive = isFocused && appActive && !isEditorMode
```

This is good design for native hardware release.

It means the camera is intended to deactivate when:

- the route loses focus
- the app backgrounds
- the user enters editor mode

`useRecording()` also attempts best-effort cleanup on unmount by stopping any active recording.

### 16.2 Stack lifecycle interactions

Because `RootNavigator` uses `freezeOnBlur: true`, off-screen routes stop updating while preserved in the stack. That is a performance optimization, but it makes navigation timing more important for route-param-based return flows.

### 16.3 Release/TestFlight-specific risk surfaces

1. VisionCamera availability differs between Expo Go and a real native build, so local dev fallback behavior is not equivalent to TestFlight behavior.
2. The code already documents a release-only first-frame freeze class caused by expensive filter setup.
3. The main chat return flow depends on `goBack()` plus delayed `navigate(...)`, which is more likely to surface timing edge cases in real navigation stacks than in isolated local testing.
4. Backgrounding during recording or during export is not deeply state-modeled beyond basic cleanup.
5. Several optional or placeholder modules are more likely to show up as broken assumptions in release than in engineering happy paths.

### 16.4 Expo Go is not a valid proxy for TestFlight

For camera work in this repo, Expo Go mainly exercises the fallback `expo-camera` experience. TestFlight exercises the intended VisionCamera path plus real native plugin configuration.

## 17. State Machine And Event Dependency Analysis

### 17.1 Main camera state machine

| State             | Entry condition                               | Exit condition                            | Primary dependencies                            | Failure risk                                               |
| ----------------- | --------------------------------------------- | ----------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| Permission gate   | Missing camera or mic permission              | Permissions granted or user leaves        | `useCameraPermissions()`                        | User may be blocked for photo-only use if mic is denied.   |
| Live preview idle | Screen focused, app active, no captured media | Capture, record, background, route change | `isActive`, backend load, camera initialization | Backend load or init timing failures surface here.         |
| Countdown         | Timer > 0 and capture pressed                 | Timer reaches 0 or screen leaves          | local countdown interval                        | Background/navigation mid-countdown is not richly modeled. |
| Capturing photo   | `doCapture()`                                 | Success to editor, failure to idle        | camera readiness, capture service               | `isBusy` gates state heavily.                              |
| Recording         | Long-press start                              | Stop press, max duration, unmount         | recording promise, timer refs                   | UI timer and service metadata can drift.                   |
| Editor            | `capturedMedia !== null`                      | Discard, save, send/next                  | local editor state + reducer state              | Local-state drift from reducer state is significant.       |
| Exporting         | `handleDone()` or save                        | chat return, full share route, or failure | Skia snapshot, ViewShot, compression            | Video path is not strongly supported.                      |
| Chat return       | mode `chat` after export                      | caller processes `capturedImageUri`       | navigation stack, route params                  | timing-sensitive handoff.                                  |
| Full share        | mode `full` after export                      | `CameraShare` upload or back out          | `currentShareSnap` in context                   | Share flow is only partly wired to production data.        |
| Snap upload       | `ShareScreen` publish                         | upload success or error                   | `snapService`, context upload state             | reducer does not fully clear share state after success.    |

### 17.2 Important overlapping state representations

The camera stack carries similar concepts in multiple places:

1. Live preview filter uses `selectedFilterIndex`; editor filter uses `selectedFilterId`; persisted snap metadata uses `appliedFilters`.
2. Recording duration exists in `CameraContext.recordingState.duration`, but the main screen also tracks its own `recordingSeconds` and writes that back into captured media.
3. Overlay element base positions live in reducer state, but actual dragged positions live in local `elementPositions`.
4. Drawing lives in local `drawPaths`, not in the shared overlay-element reducer.
5. Share-to-story exists in reducer state, but `ShareScreen` uses its own local `showingStory` state.

This is a core source of fragility.

### 17.3 Critical dependency chains

#### Camera capture readiness chain

```text
backend loads -> preview mounts -> onInitialized/onCameraReady -> cameraReady true
-> capture/record handlers allowed
```

#### Chat send chain

```text
CameraScreen export -> navigation return param -> useAttachmentPicker effect
-> sendMediaAttachmentMessage -> useChat local insert -> syncPendingMessages
-> syncEngine attachment upload -> sendMessageV2
```

#### Full share chain

```text
CameraScreen export -> setShareSnap -> ShareScreen local selection state
-> useSnapUpload -> snapService upload -> Pictures doc
```

#### Story gallery chain

```text
StoriesScreen gallery -> StoryViewer isNewStory -> compressImage
-> postStory -> lowercase stories
```

#### Story native camera chain

```text
StoriesScreen native capture -> Camera full -> CameraShare -> Pictures path
```

Those last two chains are not the same feature backend.

## 18. Risk, Fragility, And Inconsistency Analysis

### High-risk structural issues

1. The app has multiple competing camera and story systems instead of one canonical ownership model.
2. The main editor/export path is photo-first even though video recording is exposed in the UI.
3. Full share uses mock recipients and is therefore not a trustworthy production publish path today.
4. Story posting is split across lowercase `stories`, uppercase `Stories`, and `Pictures`.
5. Important editor state is flattened into pixels but not represented correctly in persisted metadata.

### Medium-risk implementation issues

1. Permission behavior is duplicated and partly placeholder-based.
2. Save-to-library semantics are inconsistent and depend on an optional module not listed in dependencies.
3. Chat camera return depends on delayed navigation timing.
4. Video compression, video filter application, and video thumbnails are mostly placeholder behavior.
5. Temporary export files do not have an obvious cleanup path.

### Lower-level but still important inconsistencies

1. Flash UI exists, but preview torch is hardcoded off in VisionCamera.
2. The data model includes settings like white balance and autofocus, but the main UI exposes only a subset.
3. The unused `react-native-vision-camera-face-detector` native dependency has been removed.
4. Call camera flows share user-facing camera behavior but live outside the main camera system.

### Test coverage gap

No dedicated Jest coverage was found for:

- `CameraScreen`
- `ShareScreen`
- `useAttachmentPicker`
- `StoryViewerScreen` post path
- `ProfilePictureEditor`
- `GroupChatInfoScreen` media flows
- `QRCodeSheet`

This means the most fragmented and stateful camera behaviors currently depend on manual validation.

## 19. Manual QA Matrix

Run this matrix on at least one fresh-install iPhone and one upgrade-install iPhone using the actual TestFlight build.

Suggested environments:

1. Fresh install, all permissions unset
2. Existing install, permissions previously denied
3. Low-connectivity network
4. Offline network
5. App background/foreground transitions during active camera use

| ID    | Scenario                                | Path                                        | Expected result                                                         | Watch for                                                   |
| ----- | --------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| QA-01 | First open from DM camera tap           | DM -> camera chat mode                      | Camera and mic prompts resolve, live preview starts, capture works      | blank preview, missing prompt, stuck permission gate        |
| QA-02 | Deny camera on first launch             | DM -> camera chat mode                      | Permission screen appears with Settings path                            | broken retry loop, no recovery path                         |
| QA-03 | Deny mic but allow camera               | DM -> camera chat mode                      | Current implementation blocks entry                                     | photo-only path unexpectedly unavailable                    |
| QA-04 | Cold launch into camera full mode       | Stories native capture or direct navigation | VisionCamera preview appears quickly                                    | first-frame freeze, black screen, no backend                |
| QA-05 | Flip camera using button                | CameraScreen                                | Front/back device swaps reliably                                        | preview freeze, orientation mismatch                        |
| QA-06 | Double-tap flip                         | CameraScreen                                | Same as flip button                                                     | accidental trigger, missed double-tap                       |
| QA-07 | Pinch zoom                              | CameraScreen                                | Zoom indicator updates and preview zooms smoothly                       | jumpy zoom, crash on high zoom                              |
| QA-08 | Timer capture 3s and 10s                | CameraScreen                                | Countdown overlay counts down and capture fires once                    | duplicate capture, stuck countdown                          |
| QA-09 | Flash modes off/auto/on                 | CameraScreen                                | Capture succeeds in all three modes                                     | preview mismatch, capture failure                           |
| QA-10 | Long-press record and tap stop          | CameraScreen                                | Recording starts, timer runs, stop returns to editor                    | stuck busy state, no media produced                         |
| QA-11 | Record to 60-second cap                 | CameraScreen                                | Auto-stop at 60 seconds                                                 | app hang, corrupted output                                  |
| QA-12 | Save to library                         | Camera editor                               | Asset is saved where product expects it                                 | "Saved" badge with no actual Photos save                    |
| QA-13 | Chat camera send                        | DM -> camera chat mode                      | Optimistic media bubble appears and eventually uploads                  | return-route failure, missing message, stuck pending upload |
| QA-14 | Group camera send                       | Group chat -> camera chat mode              | Same as DM but in group path                                            | group-specific upload path issues                           |
| QA-15 | Chat gallery immediate send             | DM/group                                    | Gallery images send without tray regressions                            | stale attachment tray, duplicate sends                      |
| QA-16 | Hold-to-gallery gesture                 | CameraLongPressButton                       | Hold opens gallery, short tap opens camera                              | wrong launcher opens, edit-mode conflict                    |
| QA-17 | Native story capture from StoriesScreen | Stories -> Camera full                      | Verify whether user lands in CameraShare and what backend stores result | unexpected path divergence from gallery stories             |
| QA-18 | Gallery story post                      | Stories -> gallery -> StoryViewer           | Story uploads to lowercase `stories` and can be viewed                  | mismatch with native story capture                          |
| QA-19 | Profile picture camera path             | Profile editor                              | Camera opens via ImagePicker, upload updates profile picture and thumb  | crop issues, permission denial handling                     |
| QA-20 | Group avatar camera path                | Group info                                  | Avatar updates after upload                                             | permission issues, stale UI                                 |
| QA-21 | Group background camera path            | Group info                                  | Background updates with correct crop feel                               | wrong aspect ratio, upload failure                          |
| QA-22 | Onboarding photo take and skip          | Onboarding                                  | Photo is stored locally or skip works cleanly                           | blocked onboarding flow                                     |
| QA-23 | QR scanner permission and scan          | QRCodeSheet                                 | Permission prompt appears, scan callback fires, torch toggles           | scanner not firing, modal state issues                      |
| QA-24 | Background app while live camera open   | CameraScreen                                | Camera deactivates and resumes cleanly on return                        | black preview, hardware lock, crash                         |
| QA-25 | Background app during recording         | CameraScreen                                | Recording either stops safely or recovers predictably                   | corrupt media, stuck recording state                        |
| QA-26 | Offline DM image send                   | Chat send path                              | Optimistic bubble inserts and later syncs on reconnect                  | dropped upload, duplicate send                              |
| QA-27 | Kill app with pending image upload      | Chat send path                              | Pending message recovers from SQLite sync                               | orphan pending item, attachment loss                        |
| QA-28 | Re-open full share after upload         | Camera full -> ShareScreen                  | No stale recipients or stale snap data                                  | previous share state leaking forward                        |

## 20. Top Files, Top Risks, And Recommended Fix Sequence

### 20.1 Top 10 files for future camera work

| Rank | File                                                                   | Why it matters most                                                                                    |
| ---- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1    | `src/screens/camera/CameraScreen.tsx`                                  | Owns preview, capture, editor, export, and route dispatch for the primary camera experience.           |
| 2    | `src/store/CameraContext.tsx`                                          | Central state layer whose current mixed responsibilities create metadata drift and lifecycle coupling. |
| 3    | `src/hooks/camera/useCameraHooks.ts`                                   | Encapsulates permissions, photo capture, recording, and snap upload hooks.                             |
| 4    | `src/services/camera/cameraService.ts`                                 | Real hardware-facing service for capture, recording, compression, and save behavior.                   |
| 5    | `src/components/camera/LiveFilterCamera.tsx`                           | Defines the actual TestFlight-native VisionCamera behavior.                                            |
| 6    | `src/hooks/useAttachmentPicker.ts`                                     | Key bridge from camera/gallery entry to chat/group send behavior.                                      |
| 7    | `src/hooks/useChat.ts`                                                 | Active production local-first send path for media messages.                                            |
| 8    | `src/services/sync/syncEngine.ts`                                      | Converts optimistic local media rows into uploads and backend sends.                                   |
| 9    | `src/screens/camera/ShareScreen.tsx`                                   | Full-share path remains incomplete and currently uses mock recipients.                                 |
| 10   | `src/services/stories.ts` and `src/services/story/snapStoryService.ts` | These two files define the competing story backends that should eventually be unified.                 |

### 20.2 Top 10 current risks, ordered by severity

1. Video capture is exposed in the primary camera UI, but the editor/export stack is not truly video-ready.
2. The app has two different story systems with different storage paths and different Firestore collections, including case-sensitive collection-name divergence.
3. `ShareScreen` still uses mock friend data, which undermines the full-share feature path.
4. Editor-local state and persisted snap metadata can disagree on positions, drawings, rotation, and filter intensity.
5. Permission handling is duplicated and photo-library handling is partly placeholder-based.
6. Save-to-library can silently mean app-local file copy instead of actual Photos save.
7. The chat camera return path is timing-sensitive because it relies on `goBack()` plus delayed `navigate(...)`.
8. Video processing helpers are mostly placeholder implementations, including thumbnail and compression behavior.
9. The repo contains several parallel capture flows that bypass the main camera stack, increasing inconsistency and fix cost.
10. There is no focused automated test coverage for the highest-risk camera flows.

### 20.3 Recommended future fix sequence

1. Decide on the canonical ownership model: one camera system plus explicit exceptions, or continued multi-system support with clear boundaries.
2. Split photo and video support into honest feature tracks. Either complete video editing/export properly or remove the appearance of full video support from the primary camera.
3. Unify story architecture. Pick one storage/doc model and migrate all native and gallery story entry points onto it.
4. Replace `ShareScreen` mock recipients with real recipient data and complete the full-share path before spending time polishing it.
5. Consolidate permission handling into one authoritative layer and make photo-library behavior explicit rather than placeholder-based.
6. Reconcile editor local state with persisted model state so exported pixels and saved metadata match.
7. Replace placeholder video-processing and save-to-library assumptions with real production implementations.
8. Simplify or harden the chat camera return path so it is not dependent on delayed route timing.
9. Add targeted instrumentation and logging around camera backend selection, camera readiness, export success/failure, and media-send handoffs.
10. Add focused tests and QA scripts for the now-canonicalized camera, chat, and story flows.

### 20.4 Open questions for the follow-up engineering pass

1. Is the product intent to keep both a snap-style `Pictures` model and a direct `stories` model, or should one replace the other?
2. Is full-mode `CameraShare` still intended to ship as a user-facing feature soon, or is chat capture the real production priority?
3. Should photo-only users be allowed through the main camera flow without granting microphone access?
4. Does the product require real video editing/export, or only raw video capture/send?
5. Should "Save" guarantee Photos-library persistence, or is app-local save acceptable?

## Closing Conclusion

The current camera system is functional in several important areas, especially the chat media send path, but it is not architecturally unified. The codebase contains one main camera stack, several parallel capture stacks, two story systems, a photo-first editor that exposes video capture, and a full-share path that is still partly scaffolded.

For TestFlight stabilization, the right next move is not a narrow bug fix. It is to define the canonical camera ownership model, choose a single story backend, and separate production-ready surfaces from partial implementations.
