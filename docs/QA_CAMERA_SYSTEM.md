# Camera System — Architecture & QA Reference

> Last updated: 2026-04-14

## Architecture Overview

The camera system is a **dual-mode unified screen** (`CameraScreen.tsx`) that
handles both live camera capture and post-capture editing in a single component.

### Mode A — Camera Mode (`capturedMedia === null`)

- Live VisionCamera preview with Skia GPU frame processors
- Real-time per-pixel color matrix filters
- Pinch-to-zoom, double-tap-to-flip, hardware exposure slider
- Photo capture (tap) and video recording (long-press)

### Mode B — Editor Mode (`capturedMedia !== null`)

- Frozen captured image with Skia-filtered rendering
- Text overlays, drawing canvas, stickers, polls
- Filter selection with intensity slider
- Undo/redo, rotation, save-to-library
- Export via Skia snapshot (preferred) or ViewShot composite

## Key Files

| File                                            | Role                                      |
| ----------------------------------------------- | ----------------------------------------- |
| `src/screens/camera/CameraScreen.tsx`           | Main dual-mode screen                     |
| `src/screens/camera/ShareScreen.tsx`            | Recipient selection & publish             |
| `src/components/camera/LiveFilterCamera.tsx`    | VisionCamera + Skia GPU wrapper           |
| `src/components/camera/CameraFilterOverlay.tsx` | Tint fallback (expo-camera path)          |
| `src/components/camera/SkiaFilteredImage.tsx`   | Editor filtered image renderer            |
| `src/components/camera/DrawingCanvas.tsx`       | SVG drawing overlay                       |
| `src/components/camera/PollCreator.tsx`         | Poll/question overlay builder             |
| `src/hooks/camera/useCameraHooks.ts`            | Permissions, capture, recording hooks     |
| `src/services/camera/cameraService.ts`          | Photo/video capture service               |
| `src/services/camera/filterService.ts`          | 37 filter library & color matrix          |
| `src/services/camera/snapService.ts`            | Upload / Firestore operations             |
| `src/store/CameraContext.tsx`                   | Global state (React Context + useReducer) |
| `constants/featureFlags.ts`                     | `USE_VISION_CAMERA` toggle                |

## Camera Backend Strategy

- **Primary**: `react-native-vision-camera` v4.7.3 with
  `@shopify/react-native-skia` v2.2.12 frame processors
- **Fallback**: `expo-camera` v17.0.10 with tint overlay approximation
- Feature flag: `USE_VISION_CAMERA = true` in `constants/featureFlags.ts`
- Runtime check: if VisionCamera native module fails to load, falls back
  to expo-camera automatically

## Camera Lifecycle Management

### `isActive` control (critical for stability)

The camera's `isActive` prop is computed as:

```
isActive = isFocused && appActive && !isEditorMode
```

- **`isFocused`** — from `useIsFocused()` (React Navigation). Camera
  deactivates when navigating to another screen.
- **`appActive`** — from `AppState` listener. Camera deactivates when
  the app goes to the background.
- **`isEditorMode`** — `true` when `capturedMedia !== null`. Camera
  deactivates while editing a captured photo/video.

When `isActive` becomes `false`, `cameraReady` is reset to `false`.
When the camera reactivates, `onInitialized` fires and sets
`cameraReady` back to `true`.

### Known constraint

**Do NOT call `takePhoto()` while a Skia frame processor is active.**
VisionCamera's `takePhoto()` can stall the Skia rendering pipeline.
If a thumbnail preview is needed, capture it only after deactivating
the frame processor or use an alternative approach (color indicators).

## Filter System

- 25+ filters across 10 categories (vintage, B&W, cool, warm, vibrant,
  soft, retro, artistic, neon, nostalgia)
- Each filter is a `FilterConfig` with brightness, contrast, saturation,
  hue, sepia, blur, color matrix, vignette, grain, split-tone, etc.
- Live preview: Skia frame processor applies a 4×5 `ColorMatrix` to every
  frame on the GPU
- Editor: `SkiaFilteredImage` applies the same matrix with an intensity
  slider
- Camera-mode carousel: uses lightweight colour indicators derived from
  `filterToOverlayColor()` — no auto-capture needed

## Exposure Control

- The exposure slider controls **real hardware EV bias** via VisionCamera's
  `exposure` prop (passed directly to the camera sensor)
- Range: -2 EV to +2 EV, step 0.1
- No software overlay — the camera hardware handles all brightness adjustment
- Expo-camera fallback path also receives the `exposure` prop

## Flash Default

- Flash defaults to **off** (not auto) on camera open
- Users can cycle through off → auto → on via the flash toggle button
- The default is set in `CameraContext.tsx` initial state

## Permission Handling

1. Check status first (no prompt)
2. Only request if undetermined
3. Report denied clearly with "Open Settings" button
4. iOS: `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`
5. Android: `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`

## Bugs Fixed (2026-04-01)

### Camera freeze after ~2 seconds

**Root cause**: An automatic silent `takePhoto()` call 800ms after
camera initialization (for filter carousel thumbnails) collided with
the active Skia frame processor, permanently stalling the GPU pipeline.

**Fix** (April 1):

1. Removed the auto-capture `useEffect` and related state
2. Replaced Skia-rendered filter thumbnails with lightweight colour
   indicators derived from each filter's colour matrix
3. Added proper `isActive` lifecycle control (focus + app state +
   editor mode)

**Further fix** (April 14):

1. Removed entire AR face detection system — eliminated second
   `useCameraDevice` hook call, `useFaceDetection` hook, face
   detection callback, and second VisionCamera rendering branch
2. Made filter overlay colour computation lazy (computed on first
   access, not at module load) to avoid 300-500ms main thread block
   during camera initialization
3. Only one camera instance is ever mounted at a time

### Brightness overlay removed

**Root cause**: A fake `rgba()` View overlay was rendered on top of the camera
previewing doubling the effect of the real hardware exposure bias.

**Fix**: Removed the overlay entirely. VisionCamera's `exposure` prop
provides real hardware EV bias — no visual workaround needed.

## Testing Checklist

- [ ] Camera opens without freezing on iOS
- [ ] Camera opens without freezing on Android
- [ ] Camera remains responsive past 2, 10, 30 seconds
- [ ] Repeatedly open/close camera (5+ times) — no crash or freeze
- [ ] Navigate away and back — camera restarts cleanly
- [ ] App background → foreground — camera resumes
- [ ] Selecting a filter changes the live preview in real time
- [ ] Switching filters mid-session works smoothly

- [ ] Photo capture produces a valid image
- [ ] Video recording works (long-press → stop)
- [ ] Editor mode shows captured image with filter
- [ ] Editor filter/overlay tools function correctly
- [ ] Permission flow works on fresh install
- [ ] Denied permissions show "Open Settings" button
- [ ] Control bar respects safe area (no overlap with home indicator)
- [ ] Filter carousel looks clean (no empty placeholder boxes)
- [ ] expo-camera fallback works when VisionCamera unavailable

## Removed Systems (April 14, 2026)

### AR Face Effects — Fully Removed

The following files were deleted:

- `src/components/camera/FaceEffectOverlay.tsx`
- `src/components/camera/FaceEffectPicker.tsx`
- `src/hooks/camera/useFaceDetection.ts`
- `src/services/camera/faceDetectionService.ts`
- `src/services/camera/nativeFaceDetection.ts`
- `assets/effects/` directory

Related state/types removed from: `CameraContext.tsx`, `types/camera.ts`,
`useCameraHooks.ts`, `CameraScreen.tsx`.

The `react-native-vision-camera-face-detector` package can be safely
uninstalled from `package.json` if no other code depends on it.

## Future Improvements

- Consider using `react-native-reanimated` for capture button press
  animation
- Add gallery picker quick-access to control bar
- Implement filter intensity slider in camera mode (not just editor)
- Persist filter preference across sessions
- Add frame-rate monitoring in development builds
