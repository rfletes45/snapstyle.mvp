/**
 * COMPREHENSIVE CAMERA SYSTEM TYPE DEFINITIONS
 * Covers all aspects of photo/video capture, editing, and sharing
 */

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
    [key in keyof FaceLandmarks]?: { x: number; y: number };
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

export type OverlayElement =
  | TextElement
  | StickerElement
  | DrawingElement
  | PollElement;

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
  overlayElements: OverlayElement[];

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
  overlayElements: OverlayElement[];
  selectedElementId?: string;
  appliedFilters: AppliedFilter[];
  undoStack: EditorAction[];
  redoStack: EditorAction[];
  zoom: number;
}

export type EditorAction =
  | { type: "add_element"; payload: OverlayElement }
  | { type: "remove_element"; payload: string }
  | { type: "modify_element"; payload: OverlayElement }
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

/**
 * ============================================================================
 * SNAP DRAFT
 * ============================================================================
 */

export interface SnapDraft {
  id: string;
  userId: string;
  media: CapturedMedia;
  overlayElements: OverlayElement[];
  filters: AppliedFilter[];
  caption?: string;
  createdAt: number;
  expiresAt: number; // Auto-delete after 30 days
}

/**
 * ============================================================================
 * SNAP VIEWER STATE
 * ============================================================================
 */

export interface SnapViewerState {
  snapId: string;
  snap: Snap;
  viewedAt: number;
  canReply: boolean;
  canReact: boolean;
  replies: SnapReply[];
}

/**
 * ============================================================================
 * CAMERA PERMISSION STATES
 * ============================================================================
 */

export type PermissionStatus = "granted" | "denied" | "undetermined";

export interface CameraPermissions {
  camera: PermissionStatus;
  microphone: PermissionStatus;
  photoLibrary: PermissionStatus;
}

/**
 * ============================================================================
 * FACE DETECTION TRACKING
 * ============================================================================
 */

export interface FaceTrack {
  trackingId: number;
  frames: Array<{
    timestamp: number;
    face: DetectedFace;
  }>;
}

/**
 * ============================================================================
 * MUSIC/AUDIO
 * ============================================================================
 */

export interface BackgroundMusic {
  id: string;
  title: string;
  artist: string;
  duration: number;
  url: string;
  thumbnail?: string;
  genre?: string;
  mood?: string[];
}

export interface AudioMix {
  musicVolume: number; // 0 to 1
  originalVolume: number; // 0 to 1 (from video mic)
}

/**
 * ============================================================================
 * SNAP METADATA FOR STORAGE
 * ============================================================================
 */

export interface SnapStorageMetadata {
  snapId: string;
  senderId: string;
  mediaType: "photo" | "video";
  fileSize: number;
  uploadedAt: number;
  expiresAt?: number;
  compressionRatio: number;
}
