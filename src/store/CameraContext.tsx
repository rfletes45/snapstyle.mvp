/**
 * CAMERA CONTEXT
 * Unified React Context for camera + editor state (chat-capture flow).
 *
 * NOTE (2026-04-20 stabilization pass):
 *   The legacy snap/share ("SnapShareState") slice was removed along with the
 *   stories feature.  The app's camera is now exclusively used as a chat
 *   capture helper — there is no story share, no full-share recipient
 *   selection, no upload state carried in context.  Removing that slice
 *   substantially reduces global-state churn during camera startup, which
 *   was one of the contributing factors to the TestFlight preview freeze.
 */

import type {
  AppliedFilter,
  CameraFacing,
  CameraSettings,
  CapturedMedia,
  EditMode,
  EditorAction,
  FlashMode,
  OverlayElement,
  RecordingState,
  VideoQuality,
} from "@/types/camera";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from "react";

// ============================================================================
// STATE INTERFACES
// ============================================================================

export interface CameraState {
  settings: CameraSettings;
  recordingState: RecordingState;
  selectedFilterId?: string;
  isPermissionGranted: boolean;
  cameraReady: boolean;
  error?: string;
}

export interface EditorState {
  currentSnap: CapturedMedia | null;
  editMode: EditMode;
  overlayElements: OverlayElement[];
  selectedElementId?: string;
  appliedFilters: AppliedFilter[];
  undoStack: EditorAction[];
  redoStack: EditorAction[];
  zoom: number;
}

interface CombinedState {
  camera: CameraState;
  editor: EditorState;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialCameraState: CameraState = {
  settings: {
    facing: "back",
    flashMode: "off",
    zoom: 0,
    videoQuality: "1080p",
    imageFormat: "jpeg",
    autoFocus: true,
    whiteBalance: "auto",
    exposureCompensation: 0,
  },
  recordingState: {
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioEnabled: true,
    videoCodec: "h264",
    audioCodec: "aac",
    bitrate: 5000000,
  },
  isPermissionGranted: false,
  cameraReady: false,
};

const initialEditorState: EditorState = {
  currentSnap: null,
  editMode: "none",
  overlayElements: [],
  appliedFilters: [],
  undoStack: [],
  redoStack: [],
  zoom: 1,
};

const initialState: CombinedState = {
  camera: initialCameraState,
  editor: initialEditorState,
};

// ============================================================================
// ACTION TYPES
// ============================================================================

type CameraAction =
  // Camera settings
  | { type: "SET_CAMERA_FACING"; payload: CameraFacing }
  | { type: "SET_FLASH_MODE"; payload: FlashMode }
  | { type: "SET_ZOOM"; payload: number }
  | { type: "SET_VIDEO_QUALITY"; payload: VideoQuality }
  | { type: "SET_AUTO_FOCUS"; payload: boolean }
  | {
      type: "SET_WHITE_BALANCE";
      payload: "auto" | "sunny" | "cloudy" | "shadow";
    }
  | { type: "SET_EXPOSURE"; payload: number }
  // Recording
  | { type: "START_RECORDING" }
  | { type: "STOP_RECORDING" }
  | { type: "PAUSE_RECORDING" }
  | { type: "RESUME_RECORDING" }
  | { type: "SET_RECORDING_DURATION"; payload: number }
  | { type: "SET_AUDIO_ENABLED"; payload: boolean }
  // Filters
  | { type: "SELECT_FILTER"; payload: string | undefined }
  // Permissions & status
  | { type: "SET_PERMISSION_GRANTED"; payload: boolean }
  | { type: "SET_CAMERA_READY"; payload: boolean }
  | { type: "SET_CAMERA_ERROR"; payload: string | undefined }
  | { type: "RESET_CAMERA" }
  // Editor
  | { type: "SET_CURRENT_SNAP"; payload: CapturedMedia }
  | { type: "CLEAR_CURRENT_SNAP" }
  | { type: "SET_EDIT_MODE"; payload: EditMode }
  | { type: "ADD_ELEMENT"; payload: OverlayElement }
  | { type: "UPDATE_ELEMENT"; payload: OverlayElement }
  | { type: "REMOVE_ELEMENT"; payload: string }
  | { type: "SELECT_ELEMENT"; payload: string | undefined }
  | { type: "APPLY_FILTER"; payload: AppliedFilter }
  | { type: "REMOVE_FILTER"; payload: string }
  | { type: "CLEAR_ALL_FILTERS" }
  | { type: "SET_EDITOR_ZOOM"; payload: number }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET_EDITOR" };

// ============================================================================
// REDUCER
// ============================================================================

function cameraReducer(
  state: CombinedState,
  action: CameraAction,
): CombinedState {
  switch (action.type) {
    // ── Camera settings ──────────────────────────────────────────────────
    case "SET_CAMERA_FACING":
      return {
        ...state,
        camera: {
          ...state.camera,
          settings: { ...state.camera.settings, facing: action.payload },
        },
      };
    case "SET_FLASH_MODE":
      return {
        ...state,
        camera: {
          ...state.camera,
          settings: { ...state.camera.settings, flashMode: action.payload },
        },
      };
    case "SET_ZOOM":
      return {
        ...state,
        camera: {
          ...state.camera,
          settings: { ...state.camera.settings, zoom: action.payload },
        },
      };
    case "SET_VIDEO_QUALITY":
      return {
        ...state,
        camera: {
          ...state.camera,
          settings: { ...state.camera.settings, videoQuality: action.payload },
        },
      };
    case "SET_AUTO_FOCUS":
      return {
        ...state,
        camera: {
          ...state.camera,
          settings: { ...state.camera.settings, autoFocus: action.payload },
        },
      };
    case "SET_WHITE_BALANCE":
      return {
        ...state,
        camera: {
          ...state.camera,
          settings: { ...state.camera.settings, whiteBalance: action.payload },
        },
      };
    case "SET_EXPOSURE":
      return {
        ...state,
        camera: {
          ...state.camera,
          settings: {
            ...state.camera.settings,
            exposureCompensation: Math.max(-2, Math.min(2, action.payload)),
          },
        },
      };

    // ── Recording ────────────────────────────────────────────────────────
    case "START_RECORDING":
      return {
        ...state,
        camera: {
          ...state.camera,
          recordingState: {
            ...state.camera.recordingState,
            isRecording: true,
            isPaused: false,
            duration: 0,
          },
        },
      };
    case "STOP_RECORDING":
      return {
        ...state,
        camera: {
          ...state.camera,
          recordingState: {
            ...state.camera.recordingState,
            isRecording: false,
            isPaused: false,
            duration: 0,
          },
        },
      };
    case "PAUSE_RECORDING":
      return {
        ...state,
        camera: {
          ...state.camera,
          recordingState: { ...state.camera.recordingState, isPaused: true },
        },
      };
    case "RESUME_RECORDING":
      return {
        ...state,
        camera: {
          ...state.camera,
          recordingState: { ...state.camera.recordingState, isPaused: false },
        },
      };
    case "SET_RECORDING_DURATION":
      return {
        ...state,
        camera: {
          ...state.camera,
          recordingState: {
            ...state.camera.recordingState,
            duration: action.payload,
          },
        },
      };
    case "SET_AUDIO_ENABLED":
      return {
        ...state,
        camera: {
          ...state.camera,
          recordingState: {
            ...state.camera.recordingState,
            audioEnabled: action.payload,
          },
        },
      };

    // ── Filters ──────────────────────────────────────────────────────────
    case "SELECT_FILTER":
      return {
        ...state,
        camera: { ...state.camera, selectedFilterId: action.payload },
      };

    // ── Permissions & status ─────────────────────────────────────────────
    case "SET_PERMISSION_GRANTED":
      return {
        ...state,
        camera: { ...state.camera, isPermissionGranted: action.payload },
      };
    case "SET_CAMERA_READY":
      // Short-circuit no-op dispatches so consumers don't re-render on
      // idempotent ready/not-ready transitions (important during camera
      // startup, when many effects can try to sync this flag).
      if (state.camera.cameraReady === action.payload) return state;
      return {
        ...state,
        camera: { ...state.camera, cameraReady: action.payload },
      };
    case "SET_CAMERA_ERROR":
      return {
        ...state,
        camera: { ...state.camera, error: action.payload },
      };
    case "RESET_CAMERA":
      return { ...state, camera: initialCameraState };

    // ── Editor ───────────────────────────────────────────────────────────
    case "SET_CURRENT_SNAP":
      return {
        ...state,
        editor: { ...initialEditorState, currentSnap: action.payload },
      };
    case "CLEAR_CURRENT_SNAP":
      return { ...state, editor: initialEditorState };
    case "SET_EDIT_MODE":
      return {
        ...state,
        editor: { ...state.editor, editMode: action.payload },
      };
    case "ADD_ELEMENT":
      return {
        ...state,
        editor: {
          ...state.editor,
          overlayElements: [...state.editor.overlayElements, action.payload],
          undoStack: [
            ...state.editor.undoStack,
            { type: "add_element", payload: action.payload },
          ],
          redoStack: [],
        },
      };
    case "UPDATE_ELEMENT": {
      const elements = state.editor.overlayElements.map((el: OverlayElement) =>
        el.id === action.payload.id ? action.payload : el,
      );
      return {
        ...state,
        editor: {
          ...state.editor,
          overlayElements: elements,
          undoStack: [
            ...state.editor.undoStack,
            { type: "modify_element", payload: action.payload },
          ],
          redoStack: [],
        },
      };
    }
    case "REMOVE_ELEMENT":
      return {
        ...state,
        editor: {
          ...state.editor,
          overlayElements: state.editor.overlayElements.filter(
            (el: OverlayElement) => el.id !== action.payload,
          ),
          undoStack: [
            ...state.editor.undoStack,
            { type: "remove_element", payload: action.payload },
          ],
          redoStack: [],
        },
      };
    case "SELECT_ELEMENT":
      return {
        ...state,
        editor: { ...state.editor, selectedElementId: action.payload },
      };
    case "APPLY_FILTER": {
      const filtered = state.editor.appliedFilters.filter(
        (f: AppliedFilter) => f.filterId !== action.payload.filterId,
      );
      return {
        ...state,
        editor: {
          ...state.editor,
          appliedFilters: [...filtered, action.payload],
          undoStack: [
            ...state.editor.undoStack,
            { type: "apply_filter", payload: action.payload },
          ],
          redoStack: [],
        },
      };
    }
    case "REMOVE_FILTER":
      return {
        ...state,
        editor: {
          ...state.editor,
          appliedFilters: state.editor.appliedFilters.filter(
            (f: AppliedFilter) => f.filterId !== action.payload,
          ),
          undoStack: [
            ...state.editor.undoStack,
            { type: "remove_filter", payload: action.payload },
          ],
          redoStack: [],
        },
      };
    case "CLEAR_ALL_FILTERS": {
      const clearFilterActions: EditorAction[] =
        state.editor.appliedFilters.map((f: AppliedFilter) => ({
          type: "remove_filter" as const,
          payload: f.filterId,
        }));
      return {
        ...state,
        editor: {
          ...state.editor,
          appliedFilters: [],
          undoStack: [...state.editor.undoStack, ...clearFilterActions],
          redoStack: [],
        },
      };
    }
    case "SET_EDITOR_ZOOM":
      return {
        ...state,
        editor: {
          ...state.editor,
          zoom: Math.max(1, Math.min(3, action.payload)),
        },
      };
    case "UNDO": {
      if (state.editor.undoStack.length === 0) return state;
      const undoStack = [...state.editor.undoStack];
      const lastAction = undoStack.pop()!;
      const redoStack = [...state.editor.redoStack, lastAction];

      const replayElements: OverlayElement[] = [];
      const replayFilters: AppliedFilter[] = [];
      for (const act of undoStack) {
        if (act.type === "add_element") {
          replayElements.push(act.payload);
        } else if (act.type === "remove_element") {
          const idx = replayElements.findIndex(
            (el: OverlayElement) => el.id === act.payload,
          );
          if (idx !== -1) replayElements.splice(idx, 1);
        } else if (act.type === "modify_element") {
          const idx = replayElements.findIndex(
            (el: OverlayElement) => el.id === act.payload.id,
          );
          if (idx !== -1) replayElements[idx] = act.payload;
        } else if (act.type === "apply_filter") {
          const idx = replayFilters.findIndex(
            (f: AppliedFilter) => f.filterId === act.payload.filterId,
          );
          if (idx !== -1) replayFilters.splice(idx, 1);
          replayFilters.push(act.payload);
        } else if (act.type === "remove_filter") {
          const idx = replayFilters.findIndex(
            (f: AppliedFilter) => f.filterId === act.payload,
          );
          if (idx !== -1) replayFilters.splice(idx, 1);
        }
      }
      return {
        ...state,
        editor: {
          ...state.editor,
          undoStack,
          redoStack,
          overlayElements: replayElements,
          appliedFilters: replayFilters,
        },
      };
    }
    case "REDO": {
      if (state.editor.redoStack.length === 0) return state;
      const redoStack = [...state.editor.redoStack];
      const nextAction = redoStack.pop()!;
      const undoStack = [...state.editor.undoStack, nextAction];

      let elements = [...state.editor.overlayElements];
      let filters = [...state.editor.appliedFilters];

      if (nextAction.type === "add_element") {
        elements.push(nextAction.payload);
      } else if (nextAction.type === "remove_element") {
        elements = elements.filter(
          (el: OverlayElement) => el.id !== nextAction.payload,
        );
      } else if (nextAction.type === "modify_element") {
        const idx = elements.findIndex(
          (el: OverlayElement) => el.id === nextAction.payload.id,
        );
        if (idx !== -1) elements[idx] = nextAction.payload;
      } else if (nextAction.type === "apply_filter") {
        const idx = filters.findIndex(
          (f: AppliedFilter) => f.filterId === nextAction.payload.filterId,
        );
        if (idx !== -1) filters.splice(idx, 1);
        filters.push(nextAction.payload);
      } else if (nextAction.type === "remove_filter") {
        filters = filters.filter(
          (f: AppliedFilter) => f.filterId !== nextAction.payload,
        );
      }
      return {
        ...state,
        editor: {
          ...state.editor,
          undoStack,
          redoStack,
          overlayElements: elements,
          appliedFilters: filters,
        },
      };
    }
    case "RESET_EDITOR":
      return { ...state, editor: initialEditorState };

    default:
      return state;
  }
}

// ============================================================================
// CONTEXT
// ============================================================================

interface CameraContextValue {
  state: CombinedState;
  dispatch: React.Dispatch<CameraAction>;
}

const CameraContext = createContext<CameraContextValue | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function CameraProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cameraReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return (
    <CameraContext.Provider value={value}>{children}</CameraContext.Provider>
  );
}

// ============================================================================
// HOOKS
// ============================================================================

export function useCameraContext(): CameraContextValue {
  const ctx = useContext(CameraContext);
  if (!ctx) {
    throw new Error("useCameraContext must be used within a CameraProvider");
  }
  return ctx;
}

export function useCameraState() {
  const { state, dispatch } = useCameraContext();
  const camera = state.camera;

  const setCameraFacing = useCallback(
    (facing: CameraFacing) =>
      dispatch({ type: "SET_CAMERA_FACING", payload: facing }),
    [dispatch],
  );
  const setFlashMode = useCallback(
    (mode: FlashMode) => dispatch({ type: "SET_FLASH_MODE", payload: mode }),
    [dispatch],
  );
  const setZoom = useCallback(
    (zoom: number) => dispatch({ type: "SET_ZOOM", payload: zoom }),
    [dispatch],
  );
  const setVideoQuality = useCallback(
    (q: VideoQuality) => dispatch({ type: "SET_VIDEO_QUALITY", payload: q }),
    [dispatch],
  );
  const setAutoFocus = useCallback(
    (v: boolean) => dispatch({ type: "SET_AUTO_FOCUS", payload: v }),
    [dispatch],
  );
  const setWhiteBalance = useCallback(
    (wb: "auto" | "sunny" | "cloudy" | "shadow") =>
      dispatch({ type: "SET_WHITE_BALANCE", payload: wb }),
    [dispatch],
  );
  const setExposure = useCallback(
    (v: number) => dispatch({ type: "SET_EXPOSURE", payload: v }),
    [dispatch],
  );
  const startRecording = useCallback(
    () => dispatch({ type: "START_RECORDING" }),
    [dispatch],
  );
  const stopRecording = useCallback(
    () => dispatch({ type: "STOP_RECORDING" }),
    [dispatch],
  );
  const pauseRecording = useCallback(
    () => dispatch({ type: "PAUSE_RECORDING" }),
    [dispatch],
  );
  const resumeRecording = useCallback(
    () => dispatch({ type: "RESUME_RECORDING" }),
    [dispatch],
  );
  const setRecordingDuration = useCallback(
    (d: number) => dispatch({ type: "SET_RECORDING_DURATION", payload: d }),
    [dispatch],
  );
  const setAudioEnabled = useCallback(
    (v: boolean) => dispatch({ type: "SET_AUDIO_ENABLED", payload: v }),
    [dispatch],
  );
  const selectFilter = useCallback(
    (id: string | undefined) =>
      dispatch({ type: "SELECT_FILTER", payload: id }),
    [dispatch],
  );
  const setPermissionGranted = useCallback(
    (v: boolean) => dispatch({ type: "SET_PERMISSION_GRANTED", payload: v }),
    [dispatch],
  );
  const setCameraReady = useCallback(
    (v: boolean) => dispatch({ type: "SET_CAMERA_READY", payload: v }),
    [dispatch],
  );
  const setCameraError = useCallback(
    (e: string | undefined) =>
      dispatch({ type: "SET_CAMERA_ERROR", payload: e }),
    [dispatch],
  );
  const resetCamera = useCallback(
    () => dispatch({ type: "RESET_CAMERA" }),
    [dispatch],
  );

  return {
    ...camera,
    setCameraFacing,
    setFlashMode,
    setZoom,
    setVideoQuality,
    setAutoFocus,
    setWhiteBalance,
    setExposure,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    setRecordingDuration,
    setAudioEnabled,
    selectFilter,
    setPermissionGranted,
    setCameraReady,
    setCameraError,
    resetCamera,
  };
}

export function useEditorState() {
  const { state, dispatch } = useCameraContext();
  const editor = state.editor;

  const setCurrentSnap = useCallback(
    (snap: CapturedMedia) =>
      dispatch({ type: "SET_CURRENT_SNAP", payload: snap }),
    [dispatch],
  );
  const clearCurrentSnap = useCallback(
    () => dispatch({ type: "CLEAR_CURRENT_SNAP" }),
    [dispatch],
  );
  const setEditMode = useCallback(
    (mode: EditMode) => dispatch({ type: "SET_EDIT_MODE", payload: mode }),
    [dispatch],
  );
  const addElement = useCallback(
    (el: OverlayElement) => dispatch({ type: "ADD_ELEMENT", payload: el }),
    [dispatch],
  );
  const updateElement = useCallback(
    (el: OverlayElement) => dispatch({ type: "UPDATE_ELEMENT", payload: el }),
    [dispatch],
  );
  const removeElement = useCallback(
    (id: string) => dispatch({ type: "REMOVE_ELEMENT", payload: id }),
    [dispatch],
  );
  const selectElement = useCallback(
    (id: string | undefined) =>
      dispatch({ type: "SELECT_ELEMENT", payload: id }),
    [dispatch],
  );
  const applyFilter = useCallback(
    (f: AppliedFilter) => dispatch({ type: "APPLY_FILTER", payload: f }),
    [dispatch],
  );
  const removeFilter = useCallback(
    (id: string) => dispatch({ type: "REMOVE_FILTER", payload: id }),
    [dispatch],
  );
  const clearAllFilters = useCallback(
    () => dispatch({ type: "CLEAR_ALL_FILTERS" }),
    [dispatch],
  );
  const setEditorZoom = useCallback(
    (z: number) => dispatch({ type: "SET_EDITOR_ZOOM", payload: z }),
    [dispatch],
  );
  const undo = useCallback(() => dispatch({ type: "UNDO" }), [dispatch]);
  const redo = useCallback(() => dispatch({ type: "REDO" }), [dispatch]);
  const resetEditor = useCallback(
    () => dispatch({ type: "RESET_EDITOR" }),
    [dispatch],
  );

  return {
    ...editor,
    canUndo: editor.undoStack.length > 0,
    canRedo: editor.redoStack.length > 0,
    setCurrentSnap,
    clearCurrentSnap,
    setEditMode,
    addElement,
    updateElement,
    removeElement,
    selectElement,
    applyFilter,
    removeFilter,
    clearAllFilters,
    setEditorZoom,
    undo,
    redo,
    resetEditor,
  };
}
