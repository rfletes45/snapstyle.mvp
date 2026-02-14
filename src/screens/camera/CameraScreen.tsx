/**
 * UNIFIED CAMERA + EDITOR SCREEN
 *
 * Two modes in ONE screen, driven by `capturedMedia` state:
 *
 * A) capturedMedia === null  ->  CAMERA MODE
 *    Live CameraView, pinch-to-zoom, filter carousel, capture button, etc.
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

import CameraFilterOverlay from "@/components/camera/CameraFilterOverlay";
import DrawingCanvas, {
  type DrawnPath,
} from "@/components/camera/DrawingCanvas";
import FaceEffectOverlay from "@/components/camera/FaceEffectOverlay";
import FaceEffectPicker from "@/components/camera/FaceEffectPicker";
import PollCreator from "@/components/camera/PollCreator";
import SkiaFilteredImage, {
  SkiaFilterThumbnail,
  type SkiaFilteredImageRef,
} from "@/components/camera/SkiaFilteredImage";
import {
  useCamera,
  useCameraPermissions,
  usePhotoCapture,
  useRecording,
} from "@/hooks/camera/useCameraHooks";
import { useFaceDetection } from "@/hooks/camera/useFaceDetection";
import * as CameraService from "@/services/camera/cameraService";
import { FILTER_LIBRARY } from "@/services/camera/filterService";
import {
  useCameraState,
  useEditorState,
  useSnapState,
} from "@/store/CameraContext";
import type {
  CapturedMedia,
  FaceEffect as FaceEffectType,
  FilterConfig,
  OverlayElement,
  PollElement,
  Snap,
  StickerElement,
  TextElement,
} from "@/types/camera";
import { generateUUID } from "@/utils/uuid";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useNavigation, useRoute } from "@react-navigation/native";
import { CameraView } from "expo-camera";
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

// VisionCamera — loaded for AR face-effect mode
let VisionCamera: any = null;
let useCameraDevice: any = null;
try {
  const vc = require("react-native-vision-camera");
  VisionCamera = vc.Camera;
  useCameraDevice = vc.useCameraDevice;
} catch {
  // VisionCamera unavailable — AR effects will be disabled
}

const logger = createLogger("screens/camera/CameraScreen");
// =============================================================================
// TYPES & CONSTANTS
// =============================================================================

export type CameraMode = "full" | "chat";

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

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const CameraScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const params = (route.params || {}) as CameraScreenParams;
  const mode: CameraMode = params.mode || "full";

  // -- Context state ----------------------------------------------------------
  const {
    setCameraFacing,
    setFlashMode,
    setZoom,
    selectFilter,
    setExposure,
    selectFaceEffect,
    selectedFaceEffect,
    arModeActive,
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
  const { setShareSnap } = useSnapState();

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

  // -- AR Face Detection (VisionCamera + MLKit) -------------------------------
  const visionDevice = useCameraDevice
    ? useCameraDevice(settings.facing === "front" ? "front" : "back")
    : null;
  const visionCameraRef = useRef<any>(null);
  const {
    detectedFaces,
    handleFacesDetected,
    faceDetectionOptions,
    clearFaces,
  } = useFaceDetection({ enabled: arModeActive });

  // Show face effects toggle (camera mode only, not while recording)
  const [showFaceEffects, setShowFaceEffects] = useState(false);

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

  // Video recording timer display (seconds)
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX_RECORDING_SECONDS = 60;

  // Pinch-to-zoom tracking
  const baseZoom = useRef(0);

  // Double-tap-to-flip tracking
  const lastTapTime = useRef(0);

  // ==========================================================================
  // LOCAL STATE - Editor mode
  // ==========================================================================
  /** When non-null we are in editor mode; null = camera mode */
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia | null>(
    null,
  );
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

  const isEditorMode = capturedMedia !== null;

  // -- Active live filter -----------------------------------------------------
  const activeFilter: FilterConfig | null = useMemo(() => {
    const f = ALL_FILTERS[selectedFilterIndex];
    return f && f.id !== "none" ? f : null;
  }, [selectedFilterIndex]);

  useEffect(() => {
    selectFilter(activeFilter?.id);
  }, [activeFilter, selectFilter]);

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
      await startRecording(settings);

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
    settings,
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

  // -- AR Face Effect handlers ------------------------------------------------
  const handleSelectFaceEffect = useCallback(
    (effectId: FaceEffectType | null) => {
      selectFaceEffect(effectId ?? undefined);
      if (effectId) {
        setShowFaceEffects(true);
      }
      triggerHaptic();
    },
    [selectFaceEffect, triggerHaptic],
  );

  const handleToggleFaceEffects = useCallback(() => {
    const next = !showFaceEffects;
    setShowFaceEffects(next);
    if (!next) {
      // Leaving face effects mode — clear the selection and faces
      selectFaceEffect(undefined);
      clearFaces();
    }
    triggerHaptic();
  }, [showFaceEffects, selectFaceEffect, clearFaces, triggerHaptic]);

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

  // Filter carousel item
  const renderFilterItem = useCallback(
    ({ item, index }: { item: FilterConfig; index: number }) => (
      <TouchableOpacity
        style={[
          styles.filterChip,
          selectedFilterIndex === index && styles.filterChipActive,
        ]}
        onPress={() => {
          setSelectedFilterIndex(index);
          triggerHaptic();
        }}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.filterChipText,
            selectedFilterIndex === index && styles.filterChipTextActive,
          ]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
      </TouchableOpacity>
    ),
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
    clearAllFilters();
    haptic();
  }, [clearAllFilters, haptic]);

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
              const FileSystem = await import("expo-file-system/legacy");
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
        const MediaLibrary = await import("expo-media-library");
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
              const FileSystem = await import("expo-file-system/legacy");
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

      if (mode === "chat") {
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
      } else {
        // Build Snap for share screen
        const createdSnap: Snap = {
          id: generateUUID(),
          senderId: "",
          senderDisplayName: "",
          mediaType: capturedMedia.type,
          mediaUrl: finalUri,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          recipients: [],
          storyVisible: false,
          caption: "",
          filters: appliedFilters,
          overlayElements,
          viewedBy: [],
          reactions: [],
          replies: [],
          allowReplies: true,
          allowReactions: true,
          viewOnceOnly: false,
          screenshotNotification: true,
          uploadStatus: "pending",
          uploadProgress: 0,
        };
        setShareSnap(createdSnap);
        navigation.navigate("CameraShare");
      }
    } finally {
      setIsExporting(false);
    }
  }, [
    capturedMedia,
    isExporting,
    mode,
    params,
    appliedFilters,
    overlayElements,
    setShareSnap,
    navigation,
  ]);

  // -- Computed editor filter (for Skia rendering) ----------------------------
  const editorFilter = useMemo<FilterConfig | null>(() => {
    if (selectedFilterId === "none") return null;
    const f = ALL_FILTERS.find((ff) => ff.id === selectedFilterId);
    return f ?? null;
  }, [selectedFilterId]);

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
        <View style={styles.cameraContainer}>
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
                width={SCREEN_W}
                height={SCREEN_H}
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
          ) : arModeActive && VisionCamera && visionDevice ? (
            /* -- AR MODE: VisionCamera with face detection ---------------- */
            <TouchableOpacity
              activeOpacity={1}
              onPress={handleDoubleTapFlip}
              style={{ flex: 1 }}
            >
              <VisionCamera
                ref={visionCameraRef}
                style={styles.camera}
                device={visionDevice}
                isActive={true}
                photo={true}
                video={true}
                faceDetectionCallback={handleFacesDetected}
                faceDetectionOptions={faceDetectionOptions}
              />

              {/* Face Effect Overlay (Skia-rendered) */}
              <FaceEffectOverlay
                faces={detectedFaces}
                selectedEffect={selectedFaceEffect ?? null}
                previewWidth={SCREEN_W}
                previewHeight={SCREEN_H}
                mirrored={settings.facing === "front"}
              />

              {/* Live Filter Overlay (translucent tint) — also works in AR mode */}
              <CameraFilterOverlay filter={activeFilter} />

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

              {/* Top-left toolbar */}
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
              </View>

              {/* Countdown Overlay */}
              {countdown !== null && (
                <View style={styles.countdownOverlay}>
                  <Text style={styles.countdownText}>{countdown}</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            /* -- CAMERA: live CameraView ---------------------------------- */
            <TouchableOpacity
              activeOpacity={1}
              onPress={handleDoubleTapFlip}
              style={{ flex: 1 }}
            >
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
                {/* Live Filter Overlay (translucent tint) */}
                <CameraFilterOverlay filter={activeFilter} />

                {/* Brightness Overlay */}
                {exposureValue !== 0 && (
                  <View
                    style={[
                      styles.brightnessOverlay,
                      {
                        backgroundColor:
                          exposureValue > 0
                            ? `rgba(255,255,255,${Math.min(0.5, exposureValue * 0.25)})`
                            : `rgba(0,0,0,${Math.min(0.6, Math.abs(exposureValue) * 0.3)})`,
                      },
                    ]}
                    pointerEvents="none"
                  />
                )}

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
                  <TouchableOpacity
                    style={styles.toolbarButton}
                    onPress={handleToggleFaceEffects}
                  >
                    <Ionicons
                      name="happy-outline"
                      size={24}
                      color={showFaceEffects ? "#FFD700" : "#fff"}
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
              </CameraView>
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
                <Text style={styles.doneBtnText}>
                  {mode === "chat" ? "Send" : "Next"}
                </Text>
                <Ionicons
                  name={mode === "chat" ? "send" : "arrow-forward"}
                  size={18}
                  color="#fff"
                  style={{ marginLeft: 6 }}
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* --- CAMERA: Filter Carousel (only in camera mode, hidden while recording) */}
      {!isEditorMode && !recordingState.isRecording && !showFaceEffects && (
        <View style={styles.filterCarouselContainer}>
          <FlatList
            data={ALL_FILTERS}
            renderItem={renderFilterItem}
            keyExtractor={filterKeyExtractor}
            ListEmptyComponent={
              <Text style={styles.listEmptyText}>No filters available.</Text>
            }
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterCarouselContent}
          />
        </View>
      )}

      {/* --- CAMERA: Face Effect Picker (replaces filter carousel) -------- */}
      {!isEditorMode && !recordingState.isRecording && showFaceEffects && (
        <FaceEffectPicker
          selectedEffect={selectedFaceEffect ?? null}
          onSelectEffect={handleSelectFaceEffect}
          expanded={true}
        />
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
        <View style={styles.controlBar}>
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
      <Modal visible={showStickerPicker} transparent animationType="slide">
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

  // -- Brightness Overlay -----------------------------------------------------
  brightnessOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 1 },

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

  // -- Filter Carousel (camera mode) ------------------------------------------
  filterCarouselContainer: {
    position: "absolute",
    bottom: 120,
    left: 0,
    right: 0,
    height: 50,
  },
  filterCarouselContent: { paddingHorizontal: 10, alignItems: "center" },
  filterChip: {
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 20,
    justifyContent: "center",
  },
  filterChipActive: {
    backgroundColor: "rgba(0,122,255,0.8)",
    borderWidth: 2,
    borderColor: "#007AFF",
  },
  filterChipText: { color: "#fff", fontSize: 12, fontWeight: "500" },
  filterChipTextActive: { fontWeight: "700" },

  // -- Control Bar (camera mode) ----------------------------------------------
  controlBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: "rgba(0,0,0,0.6)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingBottom: 20,
  },
  controlButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 50,
    height: 50,
  },
  controlButtonLabel: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },

  // -- Capture Button ---------------------------------------------------------
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#fff",
  },
  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
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
