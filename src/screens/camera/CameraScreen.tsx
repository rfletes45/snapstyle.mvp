/**
 * UNIFIED CAMERA + EDITOR SCREEN
 *
 * Two modes in ONE screen, driven by `capturedMedia` state:
 *
 * A) capturedMedia === null  ->  CAMERA MODE
 *    Live VisionCamera, pinch-to-zoom, filter carousel, capture button, etc.
 *
 * B) capturedMedia !== null  ->  EDITOR MODE
 *    Frozen Image replaces camera feed.  Full editing toolbar appears
 *    (text, draw, filter, sticker, poll, undo/redo, rotate).
 *    "Discard" clears capturedMedia -> back to camera.
 *    "Send" (chat) / "Next" (full) dispatches the result.
 *
 * Bug fixes included:
 *   - isBusy resets when discarding (no more stuck capture button)
 *   - Chat-mode send pops back to existing ChatDetail instead of pushing
 *   - DraggableItem uses Animated.ValueXY for real-time 60 fps dragging
 */

import CameraFilterOverlay, {
  filterToOverlayColor,
} from "@/components/camera/CameraFilterOverlay";
import DrawingCanvas, {
  type DrawnPath,
} from "@/components/camera/DrawingCanvas";
import PollCreator from "@/components/camera/PollCreator";
import SkiaFilteredImage, {
  SkiaFilterThumbnail,
  type SkiaFilteredImageRef,
} from "@/components/camera/SkiaFilteredImage";
import { USE_VISION_CAMERA } from "@/constants/featureFlags";
import {
  useCamera,
  useCameraPermissions,
  usePhotoCapture,
  useRecording,
} from "@/hooks/camera/useCameraHooks";
import * as CameraService from "@/services/camera/cameraService";
import { FILTER_LIBRARY } from "@/services/camera/filterService";
import { useCameraState, useEditorState } from "@/store/CameraContext";
import type {
  CapturedMedia,
  FilterConfig,
  OverlayElement,
  PollElement,
  StickerElement,
  TextElement,
} from "@/types/camera";
import { generateUUID } from "@/utils/uuid";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  GestureHandlerRootView,
  State as GestureState,
  PinchGestureHandler,
  type HandlerStateChangeEvent,
  type PinchGestureHandlerEventPayload,
  type PinchGestureHandlerGestureEvent,
} from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ViewShot, { captureRef } from "react-native-view-shot";

import { createLogger } from "@/utils/log";

// ---------------------------------------------------------------------------
// Dynamic camera imports – runtime fallback strategy
// ---------------------------------------------------------------------------
// Strategy:
//   1. If USE_VISION_CAMERA is true, try loading VisionCamera + LiveFilterCamera.
//   2. If that fails (Expo Go, missing native module), fall back to expo-camera.
//   3. CameraFilterOverlay (tint overlay) is ONLY used in the expo-camera
//      fallback path.  When LiveFilterCamera is active, the Skia frame
//      processor provides real per-pixel GPU filtering — no overlay needed.
// ---------------------------------------------------------------------------

let LiveFilterCamera: any = null;
let CameraView: any = null;
let visionCameraAvailable = false;

// Attempt VisionCamera + LiveFilterCamera (preferred path)
if (USE_VISION_CAMERA) {
  try {
    require("react-native-vision-camera");
    visionCameraAvailable = true;
  } catch {
    // VisionCamera native module unavailable (e.g. Expo Go)
  }

  if (visionCameraAvailable) {
    try {
      LiveFilterCamera =
        require("@/components/camera/LiveFilterCamera").LiveFilterCamera;
    } catch {
      // LiveFilterCamera component failed to load
    }
  }
}

// Fallback: load expo-camera if VisionCamera/LiveFilterCamera is unavailable
if (!LiveFilterCamera) {
  try {
    CameraView = require("expo-camera").CameraView;
  } catch {
    // expo-camera also unavailable
  }
}

const logger = createLogger("screens/camera/CameraScreen");
// =============================================================================
// TYPES & CONSTANTS
// =============================================================================

export type CameraMode = "chat";

export interface CameraScreenParams {
  mode?: CameraMode;
  chatId?: string;
  returnRoute?: string;
  returnData?: Record<string, any>;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// "None" placeholder filter prepended to the library
const NONE_FILTER: FilterConfig = {
  id: "none",
  name: "Normal",
  category: "vintage",
  brightness: 0,
  contrast: 1,
  saturation: 1,
  hue: 0,
};

const ALL_FILTERS: FilterConfig[] = [NONE_FILTER, ...FILTER_LIBRARY];

// Lazily compute overlay colors for the filter carousel.  filterToOverlayColor()
// does expensive color matrix math (7 matrix multiplications per filter).
// Computing all filters eagerly at module load blocked the main thread for
// 300-500 ms right when VisionCamera's GPU pipeline needed to deliver its
// first frames — a leading cause of the ~2 s camera freeze in TestFlight.
// Now each color is computed on first access and cached thereafter.
const FILTER_OVERLAY_COLORS = new Map<string, string | null>();
function getFilterOverlayColor(f: FilterConfig): string | null {
  if (f.id === "none") return null;
  let cached = FILTER_OVERLAY_COLORS.get(f.id);
  if (cached === undefined) {
    cached = filterToOverlayColor(f, 1.0);
    FILTER_OVERLAY_COLORS.set(f.id, cached);
  }
  return cached;
}

const TIMER_OPTIONS = [0, 3, 10] as const;
type TimerOption = (typeof TIMER_OPTIONS)[number];

type EditTool = "none" | "text" | "draw" | "filter" | "sticker" | "poll";

// Colour palette for text & drawing
const PALETTE = [
  "#FFFFFF",
  "#000000",
  "#FF3B30",
  "#FF9500",
  "#FFCC00",
  "#34C759",
  "#007AFF",
  "#5856D6",
  "#AF52DE",
  "#FF2D55",
  "#00C7BE",
  "#A2845E",
];

// Brush sizes
const BRUSH_SIZES = [3, 6, 10, 16, 24];

// Emoji stickers
const EMOJI_STICKERS = [
  "\u{1F600}",
  "\u{1F602}",
  "\u{1F970}",
  "\u{1F60D}",
  "\u{1F914}",
  "\u{1F60E}",
  "\u{1F973}",
  "\u{1F622}",
  "\u{1F621}",
  "\u{1F92F}",
  "\u{1F389}",
  "\u{1F38A}",
  "\u2764\uFE0F",
  "\u{1F525}",
  "\u2B50",
  "\u{1F4AF}",
  "\u{1F44D}",
  "\u{1F44E}",
  "\u{1F64C}",
  "\u{1F4AA}",
  "\u2728",
  "\u{1F308}",
  "\u2600\uFE0F",
  "\u{1F319}",
  "\u{1F98B}",
  "\u{1F338}",
  "\u{1F355}",
  "\u{1F3B5}",
  "\u{1F4F8}",
  "\u{1F4AC}",
  "\u{1F3C6}",
  "\u{1F3AF}",
  "\u{1F48E}",
  "\u{1F680}",
  "\u{1F440}",
  "\u{1F91D}",
  "\u{1F480}",
  "\u{1FAE1}",
  "\u{1F917}",
  "\u{1F608}",
];

const TOOLBAR_H = 52;
const BOTTOM_BAR_H = 70;

// =============================================================================
// DRAGGABLE ITEM  uses Animated.ValueXY for real-time 60fps dragging
// =============================================================================

interface DraggableItemProps {
  id: string;
  initialX: number;
  initialY: number;
  onPositionChange: (x: number, y: number) => void;
  onLongPress?: () => void;
  children: React.ReactNode;
}

const DraggableItem: React.FC<DraggableItemProps> = React.memo(
  ({ initialX, initialY, onPositionChange, onLongPress, children }) => {
    // Track position with a plain ref for instant feedback; render via style
    const position = useRef({ x: initialX, y: initialY });
    const startPos = useRef({ x: 0, y: 0 });
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const viewRef = useRef<View>(null);

    // Keep callbacks fresh via refs so PanResponder never goes stale
    const onPositionChangeRef = useRef(onPositionChange);
    onPositionChangeRef.current = onPositionChange;
    const onLongPressRef = useRef(onLongPress);
    onLongPressRef.current = onLongPress;

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: (_, gs) =>
            Math.abs(gs.dx) > 2 || Math.abs(gs.dy) > 2,
          onPanResponderGrant: () => {
            startPos.current = { ...position.current };
            if (onLongPressRef.current) {
              longPressTimer.current = setTimeout(() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
                  () => {},
                );
                onLongPressRef.current?.();
              }, 600);
            }
          },
          onPanResponderMove: (_, gs) => {
            position.current = {
              x: startPos.current.x + gs.dx,
              y: startPos.current.y + gs.dy,
            };
            // Cancel long-press if user started dragging
            if (
              longPressTimer.current &&
              (Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5)
            ) {
              clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
            }
            // Move the view directly via setNativeProps for 60 fps
            viewRef.current?.setNativeProps({
              style: {
                left: position.current.x,
                top: position.current.y,
              },
            });
          },
          onPanResponderRelease: () => {
            if (longPressTimer.current) {
              clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
            }
            onPositionChangeRef.current(position.current.x, position.current.y);
          },
          onPanResponderTerminate: () => {
            if (longPressTimer.current) {
              clearTimeout(longPressTimer.current);
              longPressTimer.current = null;
            }
          },
        }),
      [], // stable — callbacks accessed via refs
    );

    return (
      <View
        ref={viewRef}
        {...panResponder.panHandlers}
        style={{
          position: "absolute",
          left: initialX,
          top: initialY,
          zIndex: 10,
        }}
      >
        {children}
      </View>
    );
  },
);
DraggableItem.displayName = "DraggableItem";

// =============================================================================
// TOOL BUTTON
// =============================================================================

interface ToolButtonProps {
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
}

const ToolButton: React.FC<ToolButtonProps> = React.memo(
  ({ icon, label, active, onPress }) => (
    <TouchableOpacity
      style={[styles.toolBtn, active && styles.toolBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={22}
        color={active ? "#007AFF" : "#fff"}
      />
      <Text style={[styles.toolLabel, active && styles.toolLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  ),
);
ToolButton.displayName = "ToolButton";

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const CameraScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const params = (route.params || {}) as CameraScreenParams;

  // -- Focus & app-state – camera must only be active when visible ------------
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(
    () => AppState.currentState === "active",
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (status) => {
      const nextActive = status === "active";
      // Idempotent guard — avoid re-rendering consumers on no-op transitions
      // (React 18+ bails out of identical setState anyway, but this keeps
      // the camera startup window quiet).
      setAppActive((prev) => (prev === nextActive ? prev : nextActive));
    });
    return () => sub.remove();
  }, []);

  // -- Context state ----------------------------------------------------------
  const {
    setCameraFacing,
    setFlashMode,
    setZoom,
    setExposure,
  } = useCameraState();
  const {
    overlayElements,
    appliedFilters,
    canUndo,
    canRedo,
    addElement,
    removeElement,
    undo: undoAction,
    redo: redoAction,
    applyFilter: applyEditorFilter,
    clearAllFilters,
    setCurrentSnap,
    setEditMode: setEditorEditMode,
  } = useEditorState();

  // -- Permissions ------------------------------------------------------------
  const { isPermissionGranted, permissionError, requestPermissions } =
    useCameraPermissions();

  // Safe area insets for proper screen padding
  const insets = useSafeAreaInsets();

  // -- Camera controls --------------------------------------------------------
  const { cameraRef, cameraReady, settings, onCameraReady, onCameraError } =
    useCamera();
  const { isCapturing, capturePhoto } = usePhotoCapture(cameraRef);
  const { recordingState, startRecording, stopRecording } =
    useRecording(cameraRef);

  // ==========================================================================
  // LOCAL STATE - Camera mode
  // ==========================================================================
  const [selectedFilterIndex, setSelectedFilterIndex] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const [showExposure, setShowExposure] = useState(false);
  const [exposureValue, setExposureValue] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState<TimerOption>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [showFilterPicker, setShowFilterPicker] = useState(false);

  // ==========================================================================
  // LOCAL STATE - Editor mode
  // ==========================================================================
  /** When non-null we are in editor mode; null = camera mode */
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia | null>(
    null,
  );
  const isEditorMode = capturedMedia !== null;

  // -- Camera isActive computation ---------------------------------------------
  // Camera should be active ONLY when the screen is focused, the app is in
  // the foreground, and we are NOT in editor mode (viewing a captured image).
  const isActive = isFocused && appActive && !isEditorMode;

  // NOTE (2026-04-20 freeze fix): the previous implementation dispatched
  // `setCameraReady(false)` via global context whenever `isActive` toggled
  // off.  That caused a global re-render during camera startup, which in
  // turn fed new props back into LiveFilterCamera and contributed to the
  // TestFlight preview freeze.  We now rely solely on VisionCamera's
  // `onInitialized` callback — which will re-fire whenever the native
  // session restarts — to flip `cameraReady` back on.  The reducer short-
  // circuits no-op SET_CAMERA_READY dispatches so a stale `true` value
  // remaining after backgrounding is harmless.

  // Video recording timer display (seconds)
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX_RECORDING_SECONDS = 60;

  // Pinch-to-zoom tracking
  const baseZoom = useRef(0);

  // Double-tap-to-flip tracking
  const lastTapTime = useRef(0);

  const [activeTool, setActiveTool] = useState<EditTool>("none");

  // Text tool
  const [textInput, setTextInput] = useState("");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [textFont, setTextFont] = useState<
    "Roboto" | "Playfair" | "Caveat" | "Pacifico"
  >("Roboto");
  const [textSize, setTextSize] = useState(32);
  const [showTextDialog, setShowTextDialog] = useState(false);

  // Drawing tool
  const [drawColor, setDrawColor] = useState("#FF3B30");
  const [drawBrush, setDrawBrush] = useState(6);
  const [drawPaths, setDrawPaths] = useState<DrawnPath[]>([]);
  const [drawEraser, setDrawEraser] = useState(false);
  /** Tracks drawing history for per-stroke undo (separate from element undo). */
  const drawPathsHistory = useRef<DrawnPath[][]>([]);

  // Filter (editor)
  const [selectedFilterId, setSelectedFilterId] = useState<string>("none");
  const [filterIntensity, setFilterIntensity] = useState(1.0);

  // Sticker
  const [showStickerPicker, setShowStickerPicker] = useState(false);

  // Poll
  const [showPollCreator, setShowPollCreator] = useState(false);

  // Rotation
  const [rotation, setRotation] = useState(0);

  // Draggable positions
  const [elementPositions, setElementPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});

  // ViewShot ref for compositing the editor view into a flat image
  const editorViewShotRef = useRef<ViewShot>(null);
  const skiaFilterRef = useRef<SkiaFilteredImageRef>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Capture flash (white flash feedback on photo capture)
  const [showCaptureFlash, setShowCaptureFlash] = useState(false);

  // Save to library success
  const [showSavedBadge, setShowSavedBadge] = useState(false);

  // Measured preview container dimensions (accounts for toolbar/bottom bar)
  const [previewLayout, setPreviewLayout] = useState<{
    width: number;
    height: number;
  }>({ width: SCREEN_W, height: SCREEN_H });

  const handlePreviewLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width, height } = e.nativeEvent.layout;
      setPreviewLayout((prev) => {
        if (prev.width === width && prev.height === height) return prev;
        return { width, height };
      });
    },
    [],
  );

  // -- Active live filter -----------------------------------------------------
  const activeFilter: FilterConfig | null = useMemo(() => {
    const f = ALL_FILTERS[selectedFilterIndex];
    return f && f.id !== "none" ? f : null;
  }, [selectedFilterIndex]);

  // NOTE (2026-04-20 freeze fix): we intentionally do NOT mirror
  // `activeFilter` into CameraContext (`selectFilter(...)`) anymore.  That
  // global dispatch re-rendered every consumer of the camera context on
  // every filter tap, cascading new props into LiveFilterCamera.  The
  // active filter is already passed directly into LiveFilterCamera via
  // prop, so the mirror was pure duplicate state.

  // -- Haptic helpers ---------------------------------------------------------
  const triggerHaptic = useCallback(
    (
      style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light,
    ) => {
      Haptics.impactAsync(style).catch(() => {});
    },
    [],
  );
  const haptic = triggerHaptic;

  // ==========================================================================
  // CAMERA-MODE HANDLERS
  // ==========================================================================

  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    return () => {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, []);

  // -- Photo capture ----------------------------------------------------------
  const doCapture = useCallback(async () => {
    if (!cameraReady || isCapturing || isBusy) return;
    setIsBusy(true);

    try {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

      // Flash effect
      setShowCaptureFlash(true);
      setTimeout(() => setShowCaptureFlash(false), 150);

      const media = await capturePhoto(settings);

      if (!media) {
        setIsBusy(false);
        return;
      }

      // Transfer the live camera filter to the editor immediately
      const liveFilter = ALL_FILTERS[selectedFilterIndex];
      if (liveFilter && liveFilter.id !== "none") {
        setSelectedFilterId(liveFilter.id);
        applyEditorFilter({
          filterId: liveFilter.id,
          intensity: 1.0,
          timestamp: Date.now(),
        });
      }

      // Close filter picker if open (transitioning to editor mode)
      setShowFilterPicker(false);

      // Show the preview immediately — defer compression to export time
      setCurrentSnap(media);
      setEditorEditMode("none");
      setCapturedMedia(media);
      // isBusy stays true - will reset when user discards
    } catch (error) {
      logger.error("[Camera] Capture failed:", error);
      setIsBusy(false);
    }
  }, [
    cameraReady,
    isCapturing,
    isBusy,
    capturePhoto,
    settings,
    selectedFilterIndex,
    applyEditorFilter,
    setCurrentSnap,
    setEditorEditMode,
    triggerHaptic,
  ]);

  const doCaptureRef = useRef(doCapture);
  useEffect(() => {
    doCaptureRef.current = doCapture;
  }, [doCapture]);

  const handleCapture = useCallback(() => {
    if (isBusy || countdown !== null) return;

    if (timerSeconds === 0) {
      doCaptureRef.current();
    } else {
      let remaining = timerSeconds;
      setCountdown(remaining);
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

      countdownInterval.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (countdownInterval.current)
            clearInterval(countdownInterval.current);
          countdownInterval.current = null;
          setCountdown(null);
          doCaptureRef.current();
        } else {
          setCountdown(remaining);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
        }
      }, 1000);
    }
  }, [timerSeconds, triggerHaptic, isBusy, countdown]);

  // -- Video recording (long-press) ------------------------------------------
  const handleStartVideoRecording = useCallback(async () => {
    if (!cameraReady || isBusy || recordingState.isRecording) return;
    setIsBusy(true);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      await startRecording();

      // Start visual timer
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          if (next >= MAX_RECORDING_SECONDS) {
            // Auto-stop at max duration
            handleStopVideoRecordingRef.current?.();
          }
          return next;
        });
      }, 1000);
    } catch {
      setIsBusy(false);
    }
  }, [
    cameraReady,
    isBusy,
    recordingState.isRecording,
    startRecording,
    triggerHaptic,
  ]);

  const handleStopVideoRecording = useCallback(async () => {
    if (!recordingState.isRecording) return;

    // Stop timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const media = await stopRecording();
      if (media) {
        media.duration = recordingSeconds * 1000;
        setCurrentSnap(media);
        setEditorEditMode("none");
        setCapturedMedia(media);
      } else {
        setIsBusy(false);
      }
    } catch {
      setIsBusy(false);
    }
    setRecordingSeconds(0);
  }, [
    recordingState.isRecording,
    stopRecording,
    recordingSeconds,
    setCurrentSnap,
    setEditorEditMode,
    triggerHaptic,
  ]);

  // Ref so the auto-stop timer can call the latest version
  const handleStopVideoRecordingRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    handleStopVideoRecordingRef.current = handleStopVideoRecording;
  }, [handleStopVideoRecording]);

  // Cleanup recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  // Format recording time as MM:SS
  const formatRecordingTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, []);

  // -- Camera flip / flash / zoom / exposure / timer / grid -------------------
  const handleFlipCamera = useCallback(() => {
    const newFacing = settings.facing === "back" ? "front" : "back";
    setCameraFacing(newFacing);
    triggerHaptic();
  }, [settings.facing, setCameraFacing, triggerHaptic]);

  const handleFlashToggle = useCallback(() => {
    const modes: Array<"auto" | "on" | "off"> = ["auto", "on", "off"];
    const currentIndex = modes.indexOf(settings.flashMode);
    setFlashMode(modes[(currentIndex + 1) % modes.length]);
    triggerHaptic();
  }, [settings.flashMode, setFlashMode, triggerHaptic]);

  const onPinchGestureEvent = useCallback(
    (event: PinchGestureHandlerGestureEvent) => {
      const scale = event.nativeEvent.scale;
      const newZoom = Math.min(
        1,
        Math.max(0, baseZoom.current + (scale - 1) * 0.5),
      );
      setZoom(newZoom);
    },
    [setZoom],
  );

  const onPinchHandlerStateChange = useCallback(
    (event: HandlerStateChangeEvent<PinchGestureHandlerEventPayload>) => {
      if (event.nativeEvent.oldState === GestureState.ACTIVE) {
        baseZoom.current = settings.zoom;
      }
    },
    [settings.zoom],
  );

  const handleExposureChange = useCallback(
    (value: number) => {
      setExposureValue(value);
      setExposure(value);
    },
    [setExposure],
  );

  const handleTimerToggle = useCallback(() => {
    setTimerSeconds((prev) => {
      const idx = TIMER_OPTIONS.indexOf(prev);
      return TIMER_OPTIONS[(idx + 1) % TIMER_OPTIONS.length];
    });
    triggerHaptic();
  }, [triggerHaptic]);

  const handleGridToggle = useCallback(() => {
    setShowGrid((prev) => !prev);
    triggerHaptic();
  }, [triggerHaptic]);

  /** Double-tap on camera preview to flip the camera */
  const handleDoubleTapFlip = useCallback(() => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapTime.current < DOUBLE_TAP_DELAY) {
      handleFlipCamera();
      lastTapTime.current = 0; // reset so triple-tap doesn't fire again
    } else {
      lastTapTime.current = now;
    }
  }, [handleFlipCamera]);

  // Filter picker item — uses colour indicators derived from each filter's
  // colour matrix. Lightweight: no Skia Canvas, no live camera duplication.
  // Each thumbnail is a static color swatch that represents the filter's
  // visual character, computed once and cached.
  const renderFilterItem = useCallback(
    ({ item, index }: { item: FilterConfig; index: number }) => {
      const isSelected = selectedFilterIndex === index;
      const tintColor = getFilterOverlayColor(item);
      return (
        <TouchableOpacity
          style={[styles.filterChip, isSelected && styles.filterChipActive]}
          onPress={() => {
            setSelectedFilterIndex(index);
            triggerHaptic();
          }}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.filterThumbColor,
              tintColor ? { backgroundColor: tintColor } : undefined,
            ]}
          >
            {item.id === "none" && (
              <Ionicons
                name="ban-outline"
                size={18}
                color="rgba(255,255,255,0.5)"
              />
            )}
            {isSelected && item.id !== "none" && (
              <Ionicons name="checkmark-circle" size={18} color="#007AFF" />
            )}
          </View>
          <Text
            style={[
              styles.filterChipText,
              isSelected && styles.filterChipTextActive,
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
        </TouchableOpacity>
      );
    },
    [selectedFilterIndex, triggerHaptic],
  );
  const filterKeyExtractor = useCallback((item: FilterConfig) => item.id, []);

  // ==========================================================================
  // EDITOR-MODE HANDLERS
  // ==========================================================================

  const selectTool = useCallback(
    (tool: EditTool) => {
      haptic();
      setActiveTool((prev) => (prev === tool ? "none" : tool));
      if (tool === "text") setShowTextDialog(true);
      if (tool === "sticker") setShowStickerPicker(true);
      if (tool === "poll") setShowPollCreator(true);
    },
    [haptic],
  );

  // -- Text -------------------------------------------------------------------
  const handleAddText = useCallback(() => {
    if (!textInput.trim()) return;
    const el: TextElement = {
      id: generateUUID(),
      type: "text",
      content: textInput.trim(),
      position: { x: SCREEN_W / 2 - 60, y: SCREEN_H * 0.35 },
      size: textSize,
      rotation: 0,
      font: textFont,
      color: textColor,
      opacity: 1,
    };
    addElement(el);
    setTextInput("");
    setShowTextDialog(false);
    setActiveTool("none");
    haptic();
  }, [textInput, textSize, textFont, textColor, addElement, haptic]);

  // -- Stickers ---------------------------------------------------------------
  const handleAddSticker = useCallback(
    (emoji: string) => {
      const el: StickerElement = {
        id: generateUUID(),
        type: "sticker",
        stickerId: emoji,
        position: { x: SCREEN_W / 2 - 30, y: SCREEN_H * 0.35 },
        size: 60,
        rotation: 0,
        opacity: 1,
        scale: 1,
      };
      addElement(el);
      setShowStickerPicker(false);
      setActiveTool("none");
      haptic();
    },
    [addElement, haptic],
  );

  // -- Poll -------------------------------------------------------------------
  const handleCreatePoll = useCallback(
    (poll: PollElement) => {
      const el: PollElement = {
        ...poll,
        position: { x: SCREEN_W * 0.1, y: SCREEN_H * 0.3 },
      };
      addElement(el);
      haptic();
    },
    [addElement, haptic],
  );

  // -- Editor filter selection ------------------------------------------------
  const handleSelectEditorFilter = useCallback(
    (filter: FilterConfig) => {
      setSelectedFilterId(filter.id);
      if (filter.id === "none") {
        clearAllFilters();
      } else {
        applyEditorFilter({
          filterId: filter.id,
          intensity: filterIntensity,
          timestamp: Date.now(),
        });
      }
      haptic();
    },
    [filterIntensity, applyEditorFilter, clearAllFilters, haptic],
  );

  // -- Rotation ---------------------------------------------------------------
  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
    haptic();
  }, [haptic]);

  // -- Undo drawing -----------------------------------------------------------
  const handleUndoDrawing = useCallback(() => {
    if (drawPathsHistory.current.length > 0) {
      // Pop the last snapshot from history and restore it
      const previous = drawPathsHistory.current.pop()!;
      setDrawPaths(previous);
      haptic();
    } else if (drawPaths.length > 0) {
      // Fallback: remove the last path if no history entry exists
      setDrawPaths((prev) => prev.slice(0, -1));
      haptic();
    } else {
      undoAction();
    }
  }, [drawPaths.length, undoAction, haptic]);

  // -- Delete element (long press) --------------------------------------------
  const handleDeleteElement = useCallback(
    (id: string) => {
      removeElement(id);
      haptic();
    },
    [removeElement, haptic],
  );

  // -- Discard (back to camera) -----------------------------------------------
  const handleDiscard = useCallback(() => {
    setCapturedMedia(null);
    setIsBusy(false); // fixes the stuck capture button bug
    setActiveTool("none");
    setDrawPaths([]);
    setDrawEraser(false);
    drawPathsHistory.current = [];
    setElementPositions({});
    setRotation(0);
    setSelectedFilterId("none");
    setShowFilterPicker(false);
    clearAllFilters();
    haptic();
  }, [clearAllFilters, haptic]);

  // -- Computed editor filter (for Skia rendering) ----------------------------
  const editorFilter = useMemo<FilterConfig | null>(() => {
    if (selectedFilterId === "none") return null;
    const f = ALL_FILTERS.find((ff) => ff.id === selectedFilterId);
    return f ?? null;
  }, [selectedFilterId]);

  // -- Save to photo library --------------------------------------------------
  const handleSaveToLibrary = useCallback(async () => {
    if (!capturedMedia) return;
    try {
      let saveUri = capturedMedia.uri;

      // Check if there are overlay elements that need compositing
      const hasOverlays = overlayElements.length > 0 || drawPaths.length > 0;

      if (!hasOverlays && skiaFilterRef.current && editorFilter) {
        // No overlays — use Skia's full-resolution snapshot for pixel-perfect export
        try {
          const snapshot = await skiaFilterRef.current.makeSnapshot();
          if (snapshot) {
            const bytes = snapshot.encodeToBytes();
            if (bytes) {
              const FileSystem = await import("@/utils/fileSystem");
              const tmpPath = `${FileSystem.cacheDirectory}skia_save_${Date.now()}.jpg`;
              const base64 = btoa(
                String.fromCharCode(...new Uint8Array(bytes)),
              );
              await FileSystem.writeAsStringAsync(tmpPath, base64, {
                encoding: FileSystem.EncodingType.Base64,
              });
              saveUri = tmpPath;
              logger.info("[Camera] Skia snapshot used for save (full-res)");
            }
          }
        } catch (skiaErr) {
          logger.warn(
            "[Camera] Skia snapshot failed, falling back to ViewShot:",
            skiaErr,
          );
        }
      }

      // Fall back to ViewShot composite if we haven't got a Skia export
      if (saveUri === capturedMedia.uri && editorViewShotRef.current) {
        try {
          const composited = await captureRef(editorViewShotRef, {
            format: "jpg",
            quality: 0.95,
            result: "tmpfile",
          });
          if (composited) saveUri = composited;
        } catch {
          // Fall back to raw image
        }
      }

      // Try expo-media-library for saving to camera roll
      try {
        const mediaLibraryModuleName = "expo-media-library";
        const MediaLibrary = await import(mediaLibraryModuleName);
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === "granted") {
          await MediaLibrary.saveToLibraryAsync(saveUri);
          setShowSavedBadge(true);
          setTimeout(() => setShowSavedBadge(false), 2000);
          haptic(Haptics.ImpactFeedbackStyle.Medium);
          logger.info("[Camera] Saved to photo library");
        } else {
          logger.warn("[Camera] Photo library permission denied");
        }
      } catch (libError) {
        // expo-media-library may not be installed — fall back to local save
        const filename = `snap_${Date.now()}.jpg`;
        await CameraService.saveMediaToLibrary(saveUri, filename);
        setShowSavedBadge(true);
        setTimeout(() => setShowSavedBadge(false), 2000);
        haptic(Haptics.ImpactFeedbackStyle.Medium);
        logger.info("[Camera] Saved to app storage");
      }
    } catch (error) {
      logger.error("[Camera] Failed to save to library:", error);
    }
  }, [capturedMedia, haptic, overlayElements, drawPaths, editorFilter]);

  // -- Done / Send / Next -----------------------------------------------------
  const handleDone = useCallback(async () => {
    if (!capturedMedia || isExporting) return;

    setIsExporting(true);
    try {
      // Flatten the editor view (image + filter + drawings + overlays)
      // into a single composited image.
      let finalUri = capturedMedia.uri;

      // Check if there are overlay elements that need ViewShot compositing
      const hasOverlays = overlayElements.length > 0 || drawPaths.length > 0;

      if (!hasOverlays && skiaFilterRef.current && editorFilter) {
        // No overlays — use Skia full-res snapshot for pixel-perfect export
        try {
          const snapshot = await skiaFilterRef.current.makeSnapshot();
          if (snapshot) {
            const bytes = snapshot.encodeToBytes();
            if (bytes) {
              const FileSystem = await import("@/utils/fileSystem");
              const tmpPath = `${FileSystem.cacheDirectory}skia_export_${Date.now()}.jpg`;
              const base64 = btoa(
                String.fromCharCode(...new Uint8Array(bytes)),
              );
              await FileSystem.writeAsStringAsync(tmpPath, base64, {
                encoding: FileSystem.EncodingType.Base64,
              });
              finalUri = tmpPath;
              logger.info("[Camera] Skia snapshot exported (full-res)");
            }
          }
        } catch (skiaErr) {
          logger.warn(
            "[Camera] Skia export failed, falling back to ViewShot:",
            skiaErr,
          );
        }
      }

      // Fall back to ViewShot composite for overlays or if Skia failed
      if (finalUri === capturedMedia.uri && editorViewShotRef.current) {
        try {
          const composited = await captureRef(editorViewShotRef, {
            format: "jpg",
            quality: 0.9,
            result: "tmpfile",
          });
          if (composited) {
            finalUri = composited;
            logger.info("[Camera] Editor view composited via ViewShot");
          }
        } catch (flattenError) {
          logger.warn(
            "[Camera] ViewShot capture failed, using raw image:",
            flattenError,
          );
        }
      }

      // Compress the final image for smaller upload size (photos only)
      if (capturedMedia.type === "photo") {
        try {
          const compressed = await CameraService.compressImage(finalUri, 0.82);
          finalUri = compressed.uri;
          logger.info(
            `[Camera] Compressed export: ${CameraService.formatFileSize(compressed.size)}`,
          );
        } catch {
          // Non-fatal — proceed with uncompressed
        }
      }

      // Chat-return flow: hand the captured image back to the calling screen.
      // Full-share ("CameraShare"/"ShareScreen") was removed with the stories
      // deprecation \u2014 the camera is now exclusively a chat capture helper.
      const { returnRoute, returnData } = params;
      if (returnRoute) {
        navigation.goBack();
        setTimeout(() => {
          navigation.navigate(returnRoute, {
            ...returnData,
            capturedImageUri: finalUri,
          });
        }, 50);
      } else {
        navigation.goBack();
      }
    } finally {
      setIsExporting(false);
    }
  }, [
    capturedMedia,
    isExporting,
    params,
    navigation,
  ]);

  // -- Render overlay elements (editor) ---------------------------------------
  const renderOverlayElement = useCallback(
    (el: OverlayElement) => {
      if (el.type === "drawing") return null;

      const pos = elementPositions[el.id] ?? el.position;

      if (el.type === "text") {
        return (
          <DraggableItem
            key={el.id}
            id={el.id}
            initialX={pos.x}
            initialY={pos.y}
            onPositionChange={(x: number, y: number) =>
              setElementPositions((prev) => ({ ...prev, [el.id]: { x, y } }))
            }
            onLongPress={() => handleDeleteElement(el.id)}
          >
            <Text
              style={{
                fontSize: el.size,
                color: el.color,
                fontFamily: el.font === "Roboto" ? undefined : el.font,
                fontWeight: el.font === "Roboto" ? "700" : "400",
                textShadowColor: "rgba(0,0,0,0.6)",
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 3,
              }}
            >
              {el.content}
            </Text>
          </DraggableItem>
        );
      }

      if (el.type === "sticker") {
        return (
          <DraggableItem
            key={el.id}
            id={el.id}
            initialX={pos.x}
            initialY={pos.y}
            onPositionChange={(x: number, y: number) =>
              setElementPositions((prev) => ({ ...prev, [el.id]: { x, y } }))
            }
            onLongPress={() => handleDeleteElement(el.id)}
          >
            <Text style={{ fontSize: el.size }}>{el.stickerId}</Text>
          </DraggableItem>
        );
      }

      if (el.type === "poll") {
        return (
          <DraggableItem
            key={el.id}
            id={el.id}
            initialX={pos.x}
            initialY={pos.y}
            onPositionChange={(x: number, y: number) =>
              setElementPositions((prev) => ({ ...prev, [el.id]: { x, y } }))
            }
            onLongPress={() => handleDeleteElement(el.id)}
          >
            <View style={styles.pollBubble}>
              <Text style={styles.pollQuestion}>{el.question}</Text>
              {el.pollType === "yes_no" && (
                <View style={styles.pollOptionsRow}>
                  <View
                    style={[styles.pollOption, { backgroundColor: "#34C759" }]}
                  >
                    <Text style={styles.pollOptionText}>Yes</Text>
                  </View>
                  <View
                    style={[styles.pollOption, { backgroundColor: "#FF3B30" }]}
                  >
                    <Text style={styles.pollOptionText}>No</Text>
                  </View>
                </View>
              )}
              {el.pollType === "multiple_choice" && el.options && (
                <View style={styles.pollMCContainer}>
                  {el.options.map((opt) => (
                    <View key={opt.id} style={styles.pollMCOption}>
                      <Text style={styles.pollMCText}>{opt.text}</Text>
                    </View>
                  ))}
                </View>
              )}
              {el.pollType === "slider" && (
                <View style={styles.pollSliderRow}>
                  <Text style={styles.pollSliderLabel}>{el.minLabel}</Text>
                  <View style={styles.pollSliderTrack} />
                  <Text style={styles.pollSliderLabel}>{el.maxLabel}</Text>
                </View>
              )}
              {el.pollType === "question" && (
                <View style={styles.pollAnswerBox}>
                  <Text style={styles.pollAnswerPlaceholder}>
                    Tap to answer...
                  </Text>
                </View>
              )}
            </View>
          </DraggableItem>
        );
      }

      return null;
    },
    [elementPositions, handleDeleteElement],
  );

  // -- Editor filter thumbnail item -------------------------------------------
  const renderFilterThumb = useCallback(
    ({ item }: { item: FilterConfig }) => {
      const isActive = selectedFilterId === item.id;
      return (
        <TouchableOpacity
          style={[styles.filterThumb, isActive && styles.filterThumbActive]}
          onPress={() => handleSelectEditorFilter(item)}
          activeOpacity={0.7}
        >
          {capturedMedia && (
            <SkiaFilterThumbnail
              uri={capturedMedia.uri}
              filter={item}
              width={72}
              height={64}
            />
          )}
          <View
            style={[
              styles.filterThumbOverlay,
              isActive && { borderColor: "#007AFF" },
            ]}
          />
          <Text
            style={[
              styles.filterThumbText,
              isActive && styles.filterThumbTextActive,
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
        </TouchableOpacity>
      );
    },
    [selectedFilterId, capturedMedia, handleSelectEditorFilter],
  );

  // ==========================================================================
  // PERMISSION SCREEN
  // ==========================================================================

  if (!isPermissionGranted) {
    const isDenied =
      permissionError?.toLowerCase().includes("denied") ||
      permissionError?.toLowerCase().includes("blocked");

    return (
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        <View style={styles.permissionContainer}>
          <View style={styles.permissionIconCircle}>
            <Ionicons name="camera-outline" size={48} color="#fff" />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            {permissionError ||
              "SnapStyle needs access to your camera and microphone to take photos and videos."}
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermissions}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.permissionButtonText}>Grant Permissions</Text>
          </TouchableOpacity>
          {isDenied && (
            <TouchableOpacity
              style={styles.permissionSettingsButton}
              onPress={() => Linking.openSettings()}
            >
              <Ionicons
                name="settings-outline"
                size={18}
                color="#007AFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.permissionSettingsText}>Open Settings</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.permissionBackButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.permissionBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ==========================================================================
  // NO CAMERA BACKEND AVAILABLE
  // ==========================================================================

  const hasAnyCameraBackend = !!(LiveFilterCamera || CameraView);
  if (!hasAnyCameraBackend) {
    return (
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        <View style={styles.permissionContainer}>
          <View style={styles.permissionIconCircle}>
            <Ionicons name="alert-circle-outline" size={48} color="#FF4444" />
          </View>
          <Text style={styles.permissionTitle}>Camera Unavailable</Text>
          <Text style={styles.permissionText}>
            No camera module could be loaded. If you&apos;re using Expo Go, set
            USE_VISION_CAMERA to false in featureFlags.ts. For production
            builds, ensure react-native-vision-camera is installed.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons
              name="refresh-outline"
              size={20}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.permissionButtonText}>Go Back & Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* --- CAMERA / PREVIEW AREA ---------------------------------------- */}
      <PinchGestureHandler
        onGestureEvent={onPinchGestureEvent}
        onHandlerStateChange={onPinchHandlerStateChange}
        enabled={!isEditorMode}
      >
        <View style={styles.cameraContainer} onLayout={handlePreviewLayout}>
          {isEditorMode && capturedMedia ? (
            /* -- EDITOR: frozen captured image ----------------------------- */
            <ViewShot
              ref={editorViewShotRef}
              options={{ format: "jpg", quality: 0.9 }}
              style={styles.previewContainer}
            >
              {/* Skia-rendered image with real GPU filter */}
              <SkiaFilteredImage
                ref={skiaFilterRef}
                uri={capturedMedia.uri}
                filter={editorFilter}
                intensity={filterIntensity}
                width={previewLayout.width}
                height={previewLayout.height}
                rotation={rotation}
                style={StyleSheet.absoluteFill}
              />

              {/* Drawing canvas */}
              <DrawingCanvas
                color={drawColor}
                strokeWidth={
                  drawEraser ? Math.max(20, drawBrush * 3) : drawBrush
                }
                enabled={activeTool === "draw"}
                eraser={drawEraser}
                paths={drawPaths}
                onPathsChange={(newPaths) => {
                  // Record a snapshot before the change for undo history
                  drawPathsHistory.current.push(drawPaths);
                  setDrawPaths(newPaths);
                }}
              />

              {/* Overlay elements (text, stickers, polls) */}
              {overlayElements.map(renderOverlayElement)}
            </ViewShot>
          ) : (
            /* -- CAMERA: live camera feed (VisionCamera or expo-camera) -- */
            <TouchableOpacity
              activeOpacity={1}
              onPress={handleDoubleTapFlip}
              style={{ flex: 1 }}
            >
              {/* Camera component — LiveFilterCamera (VisionCamera+Skia) or
                  CameraView (expo-camera) based on USE_VISION_CAMERA flag */}
              {LiveFilterCamera ? (
                <LiveFilterCamera
                  ref={cameraRef}
                  facing={settings.facing}
                  filter={activeFilter}
                  flashMode={settings.flashMode}
                  zoom={settings.zoom}
                  exposure={exposureValue}
                  isActive={isActive}
                  style={styles.camera}
                  onInitialized={onCameraReady}
                  onError={onCameraError}
                />
              ) : isActive && CameraView ? (
                <CameraView
                  ref={cameraRef}
                  style={styles.camera}
                  facing={settings.facing}
                  flash={settings.flashMode}
                  zoom={settings.zoom}
                  exposure={exposureValue}
                  onCameraReady={onCameraReady}
                  onMountError={onCameraError}
                >
                  {/* Tint-overlay filter approximation for expo-camera */}
                  <CameraFilterOverlay filter={activeFilter} />
                </CameraView>
              ) : (
                <View style={styles.camera} />
              )}

              {/* --- Shared camera-mode overlays (render on top of camera) --- */}

              {/* Grid Overlay */}
              {showGrid && (
                <View style={styles.gridOverlay} pointerEvents="none">
                  <View
                    style={[
                      styles.gridLine,
                      styles.gridLineV,
                      { left: "33.33%" },
                    ]}
                  />
                  <View
                    style={[
                      styles.gridLine,
                      styles.gridLineV,
                      { left: "66.66%" },
                    ]}
                  />
                  <View
                    style={[
                      styles.gridLine,
                      styles.gridLineH,
                      { top: "33.33%" },
                    ]}
                  />
                  <View
                    style={[
                      styles.gridLine,
                      styles.gridLineH,
                      { top: "66.66%" },
                    ]}
                  />
                </View>
              )}

              {/* Close Button */}
              <TouchableOpacity
                style={[
                  styles.closeButton,
                  { top: Math.max(50, insets.top + 8) },
                ]}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="close" size={30} color="#fff" />
              </TouchableOpacity>

              {/* Top-left toolbar: Timer, Grid, Exposure */}
              <View
                style={[
                  styles.topToolbar,
                  { top: Math.max(50, insets.top + 8) },
                ]}
              >
                <TouchableOpacity
                  style={styles.toolbarButton}
                  onPress={handleTimerToggle}
                >
                  <Ionicons name="timer-outline" size={24} color="#fff" />
                  {timerSeconds > 0 && (
                    <View style={styles.toolbarBadgeContainer}>
                      <Text style={styles.toolbarBadgeText}>
                        {timerSeconds}s
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toolbarButton}
                  onPress={handleGridToggle}
                >
                  <Ionicons
                    name={showGrid ? "grid" : "grid-outline"}
                    size={24}
                    color={showGrid ? "#FFD700" : "#fff"}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toolbarButton}
                  onPress={() => setShowExposure((v) => !v)}
                >
                  <Ionicons
                    name="sunny-outline"
                    size={24}
                    color={showExposure ? "#FFD700" : "#fff"}
                  />
                </TouchableOpacity>
              </View>

              {/* Exposure Slider */}
              {showExposure && (
                <View style={styles.exposureSliderContainer}>
                  <Ionicons name="sunny" size={16} color="#FFD700" />
                  <View style={styles.exposureSliderWrapper}>
                    <Slider
                      style={styles.exposureSlider}
                      minimumValue={-2}
                      maximumValue={2}
                      value={exposureValue}
                      onValueChange={handleExposureChange}
                      minimumTrackTintColor="#FFD700"
                      maximumTrackTintColor="rgba(255,255,255,0.4)"
                      thumbTintColor="#fff"
                      step={0.1}
                    />
                  </View>
                  <Ionicons name="moon-outline" size={16} color="#fff" />
                  {exposureValue !== 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setExposureValue(0);
                        setExposure(0);
                        haptic();
                      }}
                      style={styles.exposureResetBtn}
                    >
                      <Text style={styles.exposureResetText}>Reset</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.exposureValueText}>
                    {exposureValue > 0 ? "+" : ""}
                    {exposureValue.toFixed(1)} EV
                  </Text>
                </View>
              )}

              {/* Countdown Overlay */}
              {countdown !== null && (
                <View style={styles.countdownOverlay}>
                  <Text style={styles.countdownText}>{countdown}</Text>
                </View>
              )}

              {/* Zoom Level Indicator */}
              {settings.zoom > 0 && (
                <View style={styles.zoomIndicator}>
                  <Text style={styles.zoomText}>
                    {(1 + settings.zoom * 7).toFixed(1)}x
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </PinchGestureHandler>

      {/* --- CAPTURE FLASH (white overlay) -------------------------------- */}
      {showCaptureFlash && (
        <View style={styles.captureFlash} pointerEvents="none" />
      )}

      {/* --- SAVED BADGE -------------------------------------------------- */}
      {showSavedBadge && (
        <View style={styles.savedBadge} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={20} color="#34C759" />
          <Text style={styles.savedBadgeText}>Saved</Text>
        </View>
      )}

      {/* --- EDITOR TOP BAR (only in editor mode) ------------------------- */}
      {isEditorMode && (
        <View
          style={[styles.editorTopBar, { top: Math.max(50, insets.top + 8) }]}
        >
          <TouchableOpacity onPress={handleDiscard} style={styles.topBtn}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.topRight}>
            <TouchableOpacity
              onPress={handleUndoDrawing}
              disabled={!canUndo && drawPaths.length === 0}
              style={[
                styles.topBtn,
                !canUndo && drawPaths.length === 0 && styles.topBtnDisabled,
              ]}
            >
              <Ionicons name="arrow-undo" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={redoAction}
              disabled={!canRedo}
              style={[styles.topBtn, !canRedo && styles.topBtnDisabled]}
            >
              <Ionicons name="arrow-redo" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRotate} style={styles.topBtn}>
              <Ionicons name="refresh-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveToLibrary}
              style={styles.topBtn}
            >
              <Ionicons name="download-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* --- EDITOR: Draw options bar ------------------------------------- */}
      {isEditorMode && activeTool === "draw" && (
        <View style={styles.drawOptionsBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.paletteScroll}
          >
            {PALETTE.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.paletteColor,
                  { backgroundColor: c },
                  drawColor === c && styles.paletteColorActive,
                ]}
                onPress={() => {
                  setDrawColor(c);
                  haptic();
                }}
              />
            ))}
          </ScrollView>
          <View style={styles.brushRow}>
            {BRUSH_SIZES.map((sz) => (
              <TouchableOpacity
                key={sz}
                onPress={() => {
                  setDrawBrush(sz);
                  setDrawEraser(false);
                  haptic();
                }}
                style={[
                  styles.brushBtn,
                  drawBrush === sz && !drawEraser && styles.brushBtnActive,
                ]}
              >
                <View
                  style={[
                    styles.brushDot,
                    {
                      width: Math.max(8, sz),
                      height: Math.max(8, sz),
                      borderRadius: Math.max(4, sz / 2),
                      backgroundColor: drawColor,
                    },
                  ]}
                />
              </TouchableOpacity>
            ))}
            {/* Eraser toggle */}
            <TouchableOpacity
              onPress={() => {
                setDrawEraser((prev) => !prev);
                haptic();
              }}
              style={[styles.brushBtn, drawEraser && styles.brushBtnActive]}
            >
              <Ionicons
                name="bandage-outline"
                size={18}
                color={drawEraser ? "#007AFF" : "#fff"}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* --- EDITOR: Filter options bar ----------------------------------- */}
      {isEditorMode && activeTool === "filter" && (
        <View style={styles.filterOptionsBar}>
          <FlatList
            data={ALL_FILTERS}
            renderItem={renderFilterThumb}
            keyExtractor={(f) => f.id}
            ListEmptyComponent={
              <Text style={styles.listEmptyText}>No filters available.</Text>
            }
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
            initialNumToRender={6}
            maxToRenderPerBatch={4}
            windowSize={5}
            getItemLayout={(_data, index) => ({
              length: 80,
              offset: 80 * index,
              index,
            })}
          />
          {selectedFilterId !== "none" && (
            <View style={styles.intensityRow}>
              <Text style={styles.intensityLabel}>Intensity</Text>
              <Slider
                style={styles.intensitySlider}
                minimumValue={0}
                maximumValue={1}
                value={filterIntensity}
                onValueChange={setFilterIntensity}
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="rgba(255,255,255,0.3)"
                thumbTintColor="#fff"
                step={0.05}
              />
              <Text style={styles.intensityValue}>
                {Math.round(filterIntensity * 100)}%
              </Text>
            </View>
          )}
        </View>
      )}

      {/* --- EDITOR: Main toolbar ----------------------------------------- */}
      {isEditorMode && (
        <View style={styles.editorToolbar}>
          <ToolButton
            icon="text"
            label="Text"
            active={activeTool === "text"}
            onPress={() => selectTool("text")}
          />
          <ToolButton
            icon="brush"
            label="Draw"
            active={activeTool === "draw"}
            onPress={() => selectTool("draw")}
          />
          <ToolButton
            icon="color-palette-outline"
            label="Filter"
            active={activeTool === "filter"}
            onPress={() => selectTool("filter")}
          />
          <ToolButton
            icon="happy-outline"
            label="Sticker"
            active={activeTool === "sticker"}
            onPress={() => selectTool("sticker")}
          />
          <ToolButton
            icon="stats-chart-outline"
            label="Poll"
            active={activeTool === "poll"}
            onPress={() => selectTool("poll")}
          />
        </View>
      )}

      {/* --- EDITOR: Bottom action bar ------------------------------------ */}
      {isEditorMode && (
        <View style={styles.editorBottomBar}>
          <TouchableOpacity
            style={styles.discardBtn}
            onPress={handleDiscard}
            disabled={isExporting}
          >
            <Text style={styles.discardBtnText}>Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.doneBtn, isExporting && { opacity: 0.7 }]}
            onPress={handleDone}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.doneBtnText}>Send</Text>
                <Ionicons
                  name="send"
                  size={18}
                  color="#fff"
                  style={{ marginLeft: 6 }}
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* --- CAMERA: Filter Button (opens picker on demand) -------- */}
      {!isEditorMode && !recordingState.isRecording && (
        <TouchableOpacity
          style={styles.filterPickerButton}
          onPress={() => {
            setShowFilterPicker(true);
            triggerHaptic();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="color-filter-outline" size={22} color="#fff" />
          {activeFilter && (
            <Text style={styles.filterPickerButtonLabel} numberOfLines={1}>
              {activeFilter.name}
            </Text>
          )}
          {!activeFilter && (
            <Text style={styles.filterPickerButtonLabel}>Filters</Text>
          )}
        </TouchableOpacity>
      )}

      {/* --- CAMERA: Filter Picker Modal (lazy-mounted on demand) -- */}
      {showFilterPicker && (
        <Modal
          visible={showFilterPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowFilterPicker(false)}
        >
          <TouchableOpacity
            style={styles.filterPickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowFilterPicker(false)}
          />
          <View style={styles.filterPickerSheet}>
            <View style={styles.filterPickerHeader}>
              <Text style={styles.filterPickerTitle}>Filters</Text>
              <TouchableOpacity
                onPress={() => setShowFilterPicker(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={ALL_FILTERS}
              renderItem={renderFilterItem}
              keyExtractor={filterKeyExtractor}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPickerList}
              initialNumToRender={8}
              maxToRenderPerBatch={6}
              windowSize={5}
              getItemLayout={(_data, index) => ({
                length: 72,
                offset: 72 * index,
                index,
              })}
            />
          </View>
        </Modal>
      )}

      {/* --- CAMERA: Recording Timer Indicator ----------------------------- */}
      {!isEditorMode && recordingState.isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingTimerText}>
            {formatRecordingTime(recordingSeconds)}
          </Text>
          <Text style={styles.recordingHint}>Tap to stop</Text>
        </View>
      )}

      {/* --- CAMERA: Control Bar (only in camera mode) -------------------- */}
      {!isEditorMode && (
        <View
          style={[
            styles.controlBar,
            { paddingBottom: Math.max(28, insets.bottom + 12) },
          ]}
        >
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleFlashToggle}
          >
            <Ionicons
              name={
                settings.flashMode === "on"
                  ? "flash"
                  : settings.flashMode === "off"
                    ? "flash-off"
                    : "flash-outline"
              }
              size={28}
              color="#fff"
            />
            <Text style={styles.controlButtonLabel}>
              {settings.flashMode === "auto"
                ? "AUTO"
                : settings.flashMode === "on"
                  ? "ON"
                  : "OFF"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.captureButton,
              recordingState.isRecording && styles.captureButtonRecording,
            ]}
            onPress={
              recordingState.isRecording
                ? handleStopVideoRecording
                : handleCapture
            }
            onLongPress={handleStartVideoRecording}
            delayLongPress={400}
            activeOpacity={0.7}
            disabled={isBusy && !recordingState.isRecording}
          >
            <View
              style={[
                styles.captureButtonInner,
                recordingState.isRecording &&
                  styles.captureButtonInnerRecording,
              ]}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleFlipCamera}
          >
            <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
            <Text style={styles.controlButtonLabel}>FLIP</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* --- MODALS ------------------------------------------------------- */}

      {/* Text Dialog */}
      <Modal visible={showTextDialog} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.textDialog}>
            <Text style={styles.dialogTitle}>Add Text</Text>
            <TextInput
              style={styles.textDialogInput}
              placeholder="Type here..."
              placeholderTextColor="#666"
              value={textInput}
              onChangeText={setTextInput}
              maxLength={200}
              multiline
              autoFocus
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.colorScrollRow}
            >
              {PALETTE.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.paletteColor,
                    { backgroundColor: c },
                    textColor === c && styles.paletteColorActive,
                  ]}
                  onPress={() => setTextColor(c)}
                />
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.fontScrollRow}
            >
              {(["Roboto", "Playfair", "Caveat", "Pacifico"] as const).map(
                (f) => (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.fontBtn,
                      textFont === f && styles.fontBtnActive,
                    ]}
                    onPress={() => setTextFont(f)}
                  >
                    <Text style={styles.fontBtnText}>{f}</Text>
                  </TouchableOpacity>
                ),
              )}
            </ScrollView>
            <View style={styles.sizeRow}>
              <Text style={styles.sizeLabel}>Size: {textSize}</Text>
              <Slider
                style={styles.sizeSlider}
                minimumValue={16}
                maximumValue={72}
                value={textSize}
                onValueChange={(v: number) => setTextSize(Math.round(v))}
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="rgba(255,255,255,0.3)"
                thumbTintColor="#fff"
                step={1}
              />
            </View>
            <View style={styles.dialogBtnRow}>
              <TouchableOpacity
                style={styles.dialogCancel}
                onPress={() => {
                  setShowTextDialog(false);
                  setActiveTool("none");
                }}
              >
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dialogAdd,
                  !textInput.trim() && { opacity: 0.4 },
                ]}
                onPress={handleAddText}
                disabled={!textInput.trim()}
              >
                <Text style={styles.dialogAddText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Sticker Picker */}
      <Modal visible={showStickerPicker} transparent animationType="fade">
        <View style={styles.stickerModal}>
          <View style={styles.stickerHeader}>
            <Text style={styles.stickerTitle}>Stickers</Text>
            <TouchableOpacity
              onPress={() => {
                setShowStickerPicker(false);
                setActiveTool("none");
              }}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={EMOJI_STICKERS}
            numColumns={5}
            keyExtractor={(item) => item}
            ListEmptyComponent={
              <Text style={styles.listEmptyText}>No stickers available.</Text>
            }
            contentContainerStyle={styles.stickerGrid}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.stickerCell}
                onPress={() => handleAddSticker(item)}
              >
                <Text style={styles.stickerEmoji}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Poll Creator */}
      <PollCreator
        visible={showPollCreator}
        onClose={() => {
          setShowPollCreator(false);
          setActiveTool("none");
        }}
        onCreatePoll={handleCreatePoll}
      />
    </GestureHandlerRootView>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

  // -- Capture Flash ----------------------------------------------------------
  captureFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.65)",
    zIndex: 50,
  },

  // -- Saved Badge ------------------------------------------------------------
  savedBadge: {
    position: "absolute",
    top: "15%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    zIndex: 40,
  },
  savedBadgeText: {
    color: "#34C759",
    fontSize: 14,
    fontWeight: "700",
  },

  // -- Camera -----------------------------------------------------------------
  cameraContainer: { flex: 1 },
  camera: { flex: 1 },

  closeButton: {
    position: "absolute",
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },

  // -- Permissions ------------------------------------------------------------
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  permissionIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(0,122,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 10,
  },
  permissionText: {
    fontSize: 15,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 22,
  },
  permissionButton: {
    flexDirection: "row",
    paddingHorizontal: 30,
    paddingVertical: 14,
    backgroundColor: "#007AFF",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 12,
  },
  permissionButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  permissionSettingsButton: {
    flexDirection: "row",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  permissionSettingsText: {
    color: "#007AFF",
    fontSize: 15,
    fontWeight: "600",
  },
  permissionBackButton: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionBackText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontWeight: "500",
  },

  // -- Camera Top Toolbar -----------------------------------------------------
  topToolbar: {
    position: "absolute",
    top: 50,
    left: 16,
    flexDirection: "column",
    gap: 12,
    zIndex: 10,
  },
  toolbarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  toolbarBadgeContainer: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "#FF3B30",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },

  // -- Grid Overlay -----------------------------------------------------------
  gridOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 2 },
  gridLine: { position: "absolute", backgroundColor: "rgba(255,255,255,0.3)" },
  gridLineV: { width: 1, top: 0, bottom: 0 },
  gridLineH: { height: 1, left: 0, right: 0 },

  // -- Exposure Slider --------------------------------------------------------
  exposureSliderContainer: {
    position: "absolute",
    right: 16,
    top: "20%",
    height: "45%",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  exposureSliderWrapper: {
    width: 40,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  exposureSlider: { width: 200, height: 40, transform: [{ rotate: "-90deg" }] },
  exposureValueText: {
    color: "#FFD700",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  exposureResetBtn: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255,215,0,0.25)",
  },
  exposureResetText: {
    color: "#FFD700",
    fontSize: 10,
    fontWeight: "700",
  },

  // -- Countdown --------------------------------------------------------------
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 20,
  },
  countdownText: {
    fontSize: 120,
    fontWeight: "900",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  // -- Zoom Indicator ---------------------------------------------------------
  zoomIndicator: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 5,
  },
  zoomText: { color: "#FFD700", fontSize: 13, fontWeight: "700" },

  // -- Filter Button + Picker (camera mode) ----------------------------------
  filterPickerButton: {
    position: "absolute",
    bottom: 125,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    zIndex: 15,
  },
  filterPickerButtonLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    maxWidth: 100,
  },
  filterPickerBackdrop: {
    flex: 1,
  },
  filterPickerSheet: {
    backgroundColor: "rgba(0,0,0,0.92)",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 36,
  },
  filterPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  filterPickerTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  filterPickerList: {
    paddingHorizontal: 10,
    paddingVertical: 16,
    alignItems: "center",
  },
  // (Legacy filterCarouselContainer kept for reference but no longer rendered)
  filterCarouselContainer: {
    position: "absolute",
    bottom: 118,
    left: 0,
    right: 0,
    height: 84,
    zIndex: 15,
  },
  filterCarouselContent: { paddingHorizontal: 10, alignItems: "center" },
  filterChip: {
    marginRight: 8,
    width: 64,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 12,
    overflow: "hidden",
    paddingBottom: 4,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  filterChipActive: {
    backgroundColor: "rgba(0,122,255,0.25)",
    borderColor: "#007AFF",
  },
  filterThumbColor: {
    width: 56,
    height: 44,
    borderRadius: 8,
    margin: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  filterChipText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  },
  filterChipTextActive: { fontWeight: "700", color: "#7BBFFF" },

  // -- Control Bar (camera mode) ----------------------------------------------
  controlBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 110,
    backgroundColor: "rgba(0,0,0,0.65)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingBottom: 28,
    paddingTop: 8,
  },
  controlButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 52,
    height: 52,
  },
  controlButtonLabel: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },

  // -- Capture Button ---------------------------------------------------------
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#fff",
  },
  captureButtonInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#fff",
  },
  captureButtonRecording: {
    borderColor: "#FF3B30",
  },
  captureButtonInnerRecording: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#FF3B30",
  },

  // -- Recording Indicator ----------------------------------------------------
  recordingIndicator: {
    position: "absolute",
    bottom: 180,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    zIndex: 15,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF3B30",
  },
  recordingTimerText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  recordingHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontWeight: "500",
  },

  // === EDITOR STYLES =========================================================

  // -- Preview ----------------------------------------------------------------
  previewContainer: { flex: 1, backgroundColor: "#111", overflow: "hidden" },
  editorPreview: { flex: 1, width: "100%" },
  filterOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 1 },

  // -- Editor Top bar ---------------------------------------------------------
  editorTopBar: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    zIndex: 30,
  },
  topRight: { flexDirection: "row", gap: 8 },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  topBtnDisabled: { opacity: 0.35 },

  // -- Draw options -----------------------------------------------------------
  drawOptionsBar: {
    position: "absolute",
    top: 100,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 25,
  },
  paletteScroll: {
    paddingVertical: 6,
    gap: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  paletteColor: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "transparent",
    marginHorizontal: 2,
  },
  paletteColorActive: { borderColor: "#fff", transform: [{ scale: 1.2 }] },
  brushRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 8,
  },
  brushBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  brushBtnActive: {
    backgroundColor: "rgba(0,122,255,0.35)",
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  brushDot: { backgroundColor: "#fff" },

  // -- Filter options (editor) ------------------------------------------------
  filterOptionsBar: {
    position: "absolute",
    bottom: TOOLBAR_H + BOTTOM_BAR_H + 6,
    left: 0,
    right: 0,
    zIndex: 25,
  },
  filterList: { paddingHorizontal: 10 },
  listEmptyText: {
    color: "#9A9A9A",
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: "center",
  },
  filterThumb: {
    width: 72,
    height: 96,
    marginRight: 8,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#222",
  },
  filterThumbActive: { borderWidth: 2, borderColor: "#007AFF" },
  filterThumbImage: {
    width: "100%",
    height: 64,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  filterThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  filterThumbText: {
    color: "#ccc",
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 4,
  },
  filterThumbTextActive: { color: "#007AFF" },
  intensityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  intensityLabel: { color: "#aaa", fontSize: 12, fontWeight: "600" },
  intensitySlider: { flex: 1, marginHorizontal: 10 },
  intensityValue: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    width: 38,
    textAlign: "right",
  },

  // -- Editor Toolbar ---------------------------------------------------------
  editorToolbar: {
    flexDirection: "row",
    height: TOOLBAR_H,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  toolBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  toolBtnActive: { backgroundColor: "rgba(0,122,255,0.18)" },
  toolLabel: { color: "#aaa", fontSize: 10, fontWeight: "600", marginTop: 2 },
  toolLabelActive: { color: "#007AFF" },

  // -- Editor Bottom bar ------------------------------------------------------
  editorBottomBar: {
    flexDirection: "row",
    height: BOTTOM_BAR_H,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 20 : 8,
    gap: 12,
  },
  discardBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },
  discardBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  doneBtn: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  doneBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // -- Text Dialog ------------------------------------------------------------
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  textDialog: {
    width: "88%",
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    padding: 20,
  },
  dialogTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 14,
  },
  textDialogInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 12,
    color: "#fff",
    fontSize: 16,
    minHeight: 56,
    marginBottom: 12,
  },
  colorScrollRow: { marginBottom: 10 },
  fontScrollRow: { marginBottom: 12 },
  fontBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginRight: 8,
  },
  fontBtnActive: { backgroundColor: "#007AFF" },
  fontBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  sizeRow: { marginBottom: 14 },
  sizeLabel: {
    color: "#aaa",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  sizeSlider: { width: "100%", height: 36 },
  dialogBtnRow: { flexDirection: "row", gap: 10 },
  dialogCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },
  dialogCancelText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  dialogAdd: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#007AFF",
    alignItems: "center",
  },
  dialogAddText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // -- Sticker Modal ----------------------------------------------------------
  stickerModal: { flex: 1, backgroundColor: "#000", paddingTop: 50 },
  stickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.15)",
  },
  stickerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  stickerGrid: { padding: 10 },
  stickerCell: {
    flex: 1,
    aspectRatio: 1,
    margin: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stickerEmoji: { fontSize: 36 },

  // -- Poll Bubble ------------------------------------------------------------
  pollBubble: {
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 16,
    padding: 14,
    width: SCREEN_W * 0.75,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  pollQuestion: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  pollOptionsRow: { flexDirection: "row", gap: 10 },
  pollOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  pollOptionText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  pollMCContainer: { gap: 6 },
  pollMCOption: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  pollMCText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  pollSliderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pollSliderLabel: { color: "#fff", fontSize: 18 },
  pollSliderTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  pollAnswerBox: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  pollAnswerPlaceholder: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontStyle: "italic",
  },
});

export default CameraScreen;
