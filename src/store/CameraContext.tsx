/**
 * CAMERA CONTEXT
 * Unified React Context for camera, editor, and snap sharing state.
 * Replaces the orphaned Redux slices (cameraSlice, editorSlice, snapSlice)
 * to match the project's React Context + Hooks architecture.
 */

import type {
  AppliedFilter,
  CameraFacing,
  CameraSettings,
  CapturedMedia,
  EditMode,
  EditorAction,
  FaceEffect,
  FlashMode,
  OverlayElement,
  RecordingState,
  Snap,
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
  selectedFaceEffect?: FaceEffect;
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

export interface SnapShareState {
  snaps: Snap[];
  drafts: Record<string, Snap>;
  currentShareSnap?: Snap;
  selectedRecipients: string[];
  shareToStory: boolean;
  caption: string;
  allowReplies: boolean;
  allowReactions: boolean;
  uploading: boolean;
  uploadProgress: number;
  error?: string;
}

interface CombinedState {
  camera: CameraState;
  editor: EditorState;
  snap: SnapShareState;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialCameraState: CameraState = {
  settings: {
    facing: "back",
    flashMode: "auto",
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

const initialSnapState: SnapShareState = {
  snaps: [],
  drafts: {},
  selectedRecipients: [],
  shareToStory: false,
  caption: "",
  allowReplies: true,
  allowReactions: true,
  uploading: false,
  uploadProgress: 0,
};

const initialState: CombinedState = {
  camera: initialCameraState,
  editor: initialEditorState,
  snap: initialSnapState,
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
  // Filters & effects
  | { type: "SELECT_FILTER"; payload: string | undefined }
  | { type: "SELECT_FACE_EFFECT"; payload: FaceEffect | undefined }
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
  | { type: "RESET_EDITOR" }
  // Snap sharing
  | { type: "SET_SHARE_SNAP"; payload: Snap }
  | { type: "CLEAR_SHARE_SNAP" }
  | { type: "ADD_RECIPIENT"; payload: string }
  | { type: "REMOVE_RECIPIENT"; payload: string }
  | { type: "CLEAR_RECIPIENTS" }
  | { type: "SET_RECIPIENTS"; payload: string[] }
  | { type: "SET_SHARE_TO_STORY"; payload: boolean }
  | { type: "SET_CAPTION"; payload: string }
  | { type: "SET_ALLOW_REPLIES"; payload: boolean }
  | { type: "SET_ALLOW_REACTIONS"; payload: boolean }
  | { type: "START_UPLOAD" }
  | { type: "SET_UPLOAD_PROGRESS"; payload: number }
  | { type: "UPLOAD_SUCCESS"; payload: Snap }
  | { type: "UPLOAD_ERROR"; payload: string }
  | { type: "SAVE_DRAFT"; payload: { draftId: string; snap: Snap } }
  | { type: "LOAD_DRAFT"; payload: string }
  | { type: "DELETE_DRAFT"; payload: string }
  | { type: "ADD_SNAP"; payload: Snap }
  | { type: "REMOVE_SNAP"; payload: string }
  | { type: "UPDATE_SNAP"; payload: Snap }
  | { type: "RESET_SNAP" };

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
          recordingState: {
            ...state.camera.recordingState,
            isPaused: true,
          },
        },
      };
    case "RESUME_RECORDING":
      return {
        ...state,
        camera: {
          ...state.camera,
          recordingState: {
            ...state.camera.recordingState,
            isPaused: false,
          },
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

    // ── Filters & effects ────────────────────────────────────────────────
    case "SELECT_FILTER":
      return {
        ...state,
        camera: { ...state.camera, selectedFilterId: action.payload },
      };
    case "SELECT_FACE_EFFECT":
      return {
        ...state,
        camera: { ...state.camera, selectedFaceEffect: action.payload },
      };

    // ── Permissions & status ─────────────────────────────────────────────
    case "SET_PERMISSION_GRANTED":
      return {
        ...state,
        camera: { ...state.camera, isPermissionGranted: action.payload },
      };
    case "SET_CAMERA_READY":
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
        editor: {
          ...initialEditorState,
          currentSnap: action.payload,
        },
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
      // Record a remove_filter action for each active filter so undo can restore them
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

      // Replay remaining actions to reconstruct state
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

    // ── Snap sharing ─────────────────────────────────────────────────────
    case "SET_SHARE_SNAP":
      return {
        ...state,
        snap: {
          ...state.snap,
          currentShareSnap: action.payload,
          selectedRecipients: [],
          shareToStory: false,
          caption: "",
        },
      };
    case "CLEAR_SHARE_SNAP":
      return {
        ...state,
        snap: {
          ...state.snap,
          currentShareSnap: undefined,
          selectedRecipients: [],
          shareToStory: false,
          caption: "",
        },
      };
    case "ADD_RECIPIENT":
      return {
        ...state,
        snap: {
          ...state.snap,
          selectedRecipients: state.snap.selectedRecipients.includes(
            action.payload,
          )
            ? state.snap.selectedRecipients
            : [...state.snap.selectedRecipients, action.payload],
        },
      };
    case "REMOVE_RECIPIENT":
      return {
        ...state,
        snap: {
          ...state.snap,
          selectedRecipients: state.snap.selectedRecipients.filter(
            (id: string) => id !== action.payload,
          ),
        },
      };
    case "CLEAR_RECIPIENTS":
      return {
        ...state,
        snap: { ...state.snap, selectedRecipients: [] },
      };
    case "SET_RECIPIENTS":
      return {
        ...state,
        snap: { ...state.snap, selectedRecipients: action.payload },
      };
    case "SET_SHARE_TO_STORY":
      return {
        ...state,
        snap: { ...state.snap, shareToStory: action.payload },
      };
    case "SET_CAPTION":
      return {
        ...state,
        snap: { ...state.snap, caption: action.payload },
      };
    case "SET_ALLOW_REPLIES":
      return {
        ...state,
        snap: { ...state.snap, allowReplies: action.payload },
      };
    case "SET_ALLOW_REACTIONS":
      return {
        ...state,
        snap: { ...state.snap, allowReactions: action.payload },
      };
    case "START_UPLOAD":
      return {
        ...state,
        snap: {
          ...state.snap,
          uploading: true,
          uploadProgress: 0,
          error: undefined,
        },
      };
    case "SET_UPLOAD_PROGRESS":
      return {
        ...state,
        snap: {
          ...state.snap,
          uploadProgress: Math.max(0, Math.min(100, action.payload)),
        },
      };
    case "UPLOAD_SUCCESS":
      return {
        ...state,
        snap: {
          ...state.snap,
          snaps: [action.payload, ...state.snap.snaps],
          uploading: false,
          uploadProgress: 100,
        },
      };
    case "UPLOAD_ERROR":
      return {
        ...state,
        snap: {
          ...state.snap,
          uploading: false,
          error: action.payload,
        },
      };
    case "SAVE_DRAFT":
      return {
        ...state,
        snap: {
          ...state.snap,
          drafts: {
            ...state.snap.drafts,
            [action.payload.draftId]: action.payload.snap,
          },
        },
      };
    case "LOAD_DRAFT": {
      const draft = state.snap.drafts[action.payload];
      if (!draft) return state;
      return {
        ...state,
        snap: { ...state.snap, currentShareSnap: draft },
      };
    }
    case "DELETE_DRAFT": {
      const { [action.payload]: _, ...remaining } = state.snap.drafts;
      return {
        ...state,
        snap: { ...state.snap, drafts: remaining },
      };
    }
    case "ADD_SNAP":
      return {
        ...state,
        snap: {
          ...state.snap,
          snaps: [action.payload, ...state.snap.snaps],
        },
      };
    case "REMOVE_SNAP":
      return {
        ...state,
        snap: {
          ...state.snap,
          snaps: state.snap.snaps.filter((s: Snap) => s.id !== action.payload),
        },
      };
    case "UPDATE_SNAP": {
      const snaps = state.snap.snaps.map((s: Snap) =>
        s.id === action.payload.id ? action.payload : s,
      );
      return { ...state, snap: { ...state.snap, snaps } };
    }
    case "RESET_SNAP":
      return { ...state, snap: initialSnapState };

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

/**
 * Raw context access — throws if used outside CameraProvider.
 */
export function useCameraContext(): CameraContextValue {
  const ctx = useContext(CameraContext);
  if (!ctx) {
    throw new Error("useCameraContext must be used within a CameraProvider");
  }
  return ctx;
}

/**
 * Camera settings & recording state
 */
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
  const selectFaceEffect = useCallback(
    (e: FaceEffect | undefined) =>
      dispatch({ type: "SELECT_FACE_EFFECT", payload: e }),
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
    selectFaceEffect,
    /** Whether AR face-effect mode is active (a face effect is selected) */
    arModeActive: camera.selectedFaceEffect != null,
    setPermissionGranted,
    setCameraReady,
    setCameraError,
    resetCamera,
  };
}

/**
 * Editor state (overlays, filters, undo/redo)
 */
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

/**
 * Snap sharing state (recipients, upload, drafts)
 */
export function useSnapState() {
  const { state, dispatch } = useCameraContext();
  const snap = state.snap;

  const setShareSnap = useCallback(
    (s: Snap) => dispatch({ type: "SET_SHARE_SNAP", payload: s }),
    [dispatch],
  );
  const clearShareSnap = useCallback(
    () => dispatch({ type: "CLEAR_SHARE_SNAP" }),
    [dispatch],
  );
  const addRecipient = useCallback(
    (id: string) => dispatch({ type: "ADD_RECIPIENT", payload: id }),
    [dispatch],
  );
  const removeRecipient = useCallback(
    (id: string) => dispatch({ type: "REMOVE_RECIPIENT", payload: id }),
    [dispatch],
  );
  const clearRecipients = useCallback(
    () => dispatch({ type: "CLEAR_RECIPIENTS" }),
    [dispatch],
  );
  const setRecipients = useCallback(
    (ids: string[]) => dispatch({ type: "SET_RECIPIENTS", payload: ids }),
    [dispatch],
  );
  const setShareToStory = useCallback(
    (v: boolean) => dispatch({ type: "SET_SHARE_TO_STORY", payload: v }),
    [dispatch],
  );
  const setCaption = useCallback(
    (c: string) => dispatch({ type: "SET_CAPTION", payload: c }),
    [dispatch],
  );
  const setAllowReplies = useCallback(
    (v: boolean) => dispatch({ type: "SET_ALLOW_REPLIES", payload: v }),
    [dispatch],
  );
  const setAllowReactions = useCallback(
    (v: boolean) => dispatch({ type: "SET_ALLOW_REACTIONS", payload: v }),
    [dispatch],
  );
  const startUpload = useCallback(
    () => dispatch({ type: "START_UPLOAD" }),
    [dispatch],
  );
  const setUploadProgress = useCallback(
    (p: number) => dispatch({ type: "SET_UPLOAD_PROGRESS", payload: p }),
    [dispatch],
  );
  const uploadSuccess = useCallback(
    (s: Snap) => dispatch({ type: "UPLOAD_SUCCESS", payload: s }),
    [dispatch],
  );
  const uploadError = useCallback(
    (e: string) => dispatch({ type: "UPLOAD_ERROR", payload: e }),
    [dispatch],
  );
  const resetSnap = useCallback(
    () => dispatch({ type: "RESET_SNAP" }),
    [dispatch],
  );

  return {
    ...snap,
    setShareSnap,
    clearShareSnap,
    addRecipient,
    removeRecipient,
    clearRecipients,
    setRecipients,
    setShareToStory,
    setCaption,
    setAllowReplies,
    setAllowReactions,
    startUpload,
    setUploadProgress,
    uploadSuccess,
    uploadError,
    resetSnap,
  };
}
