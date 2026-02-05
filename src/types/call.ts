/**
 * Call Types and Interfaces
 * Real-time video/phone calling system for Vibe
 *
 * Note: MediaStream is typed as 'any' to avoid importing react-native-webrtc
 * which doesn't work on web platforms.
 */

import { AvatarConfig } from "./models";

// Use any type for MediaStream to support web/Expo Go where WebRTC isn't available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MediaStreamType = any;

// ============================================================================
// Core Types
// ============================================================================

export type CallType = "audio" | "video";
export type CallScope = "dm" | "group";

export type CallStatus =
  | "ringing" // Call initiated, waiting for answer
  | "connecting" // Call accepted, establishing connection
  | "connected" // Active call
  | "ended" // Call ended normally
  | "declined" // Recipient declined
  | "missed" // No answer within timeout
  | "failed"; // Technical failure

export type CallEndReason =
  | "completed"
  | "declined"
  | "missed"
  | "failed"
  | "busy"
  | "cancelled";

export type ParticipantConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

// ============================================================================
// Participant Types
// ============================================================================

export interface CallParticipant {
  odId: string;
  odname: string;
  displayName: string;
  avatarConfig?: AvatarConfig;
  joinedAt: number | null; // null = invited but not joined
  leftAt: number | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  connectionState: ParticipantConnectionState;
}

// ============================================================================
// Call Document (Firestore)
// ============================================================================

export interface Call {
  id: string;
  scope: CallScope;
  conversationId: string; // Chat ID or Group ID (links to existing conversation)
  type: CallType;
  status: CallStatus;

  // Participants
  callerId: string; // Who initiated the call
  callerName: string;
  participants: Record<string, CallParticipant>;

  // Timing
  createdAt: number;
  answeredAt: number | null;
  endedAt: number | null;

  // Call metadata
  endReason?: CallEndReason;
  duration?: number; // In seconds (calculated on end)

  // WebRTC specific
  roomId?: string; // Room ID for the call

  // For group calls
  maxParticipants?: number; // Limit for group calls (default 8)
  hostId?: string; // Host can manage participants (defaults to callerId)
  isLocked?: boolean; // Prevent new participants from joining
  activeSpeakerId?: string; // Current active speaker (voice activity)
  pinnedParticipantId?: string; // Pinned participant for focus view
}

// ============================================================================
// Group Call Specific Types
// ============================================================================

export type GroupCallRole = "host" | "co-host" | "participant";

export interface GroupCallParticipant extends CallParticipant {
  role: GroupCallRole;
  raisedHand: boolean;
  raisedHandAt?: number;
  isScreenSharing?: boolean;
  audioLevel?: number; // 0-100 for voice activity detection
}

export interface GroupCallSettings {
  maxParticipants: number;
  allowScreenShare: boolean;
  muteOnJoin: boolean;
  videoOffOnJoin: boolean;
  allowParticipantsToUnmute: boolean;
  hostOnlyInvite: boolean;
  recordingEnabled: boolean;
}

export interface GroupCallInvite {
  callId: string;
  inviterId: string;
  inviterName: string;
  inviteeId: string;
  groupId: string;
  groupName: string;
  callType: CallType;
  createdAt: number;
  expiresAt: number;
  status: "pending" | "accepted" | "declined" | "expired";
}

// Layout types for group video calls
export type GroupCallLayout = "grid" | "speaker" | "sidebar";

export interface GroupCallState extends CallState {
  layout: GroupCallLayout;
  activeSpeakerId: string | null;
  pinnedParticipantId: string | null;
  participantsWithRaisedHands: string[];
  isHost: boolean;
  isCoHost: boolean;
  settings: GroupCallSettings;
}

// ============================================================================
// Call History (Denormalized for faster queries)
// ============================================================================

export interface CallHistoryEntry {
  callId: string;
  odId: string; // Participant user ID
  otherParticipants: {
    odId: string;
    displayName: string;
    avatarConfig?: AvatarConfig;
  }[];
  type: CallType;
  scope: CallScope;
  status: CallStatus;
  direction: "incoming" | "outgoing";
  createdAt: number;
  duration: number | null;
  wasAnswered: boolean;
}

// ============================================================================
// WebRTC Signaling Types
// ============================================================================

export type SignalType = "offer" | "answer" | "ice-candidate" | "bye";

export interface SignalingMessage {
  id: string;
  type: SignalType;
  from: string; // odId
  to: string; // odId
  callId: string;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit | null;
  createdAt: number;
}

// ============================================================================
// ICE Configuration
// ============================================================================

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceConfig {
  iceServers: IceServer[];
  iceTransportPolicy?: "all" | "relay";
}

// ============================================================================
// Call Service Types
// ============================================================================

export interface StartCallParams {
  conversationId: string;
  participantIds: string[];
  type: CallType;
  scope: CallScope;
}

export interface CallState {
  currentCall: Call | null;
  incomingCall: Call | null;
  isConnecting: boolean;
  isConnected: boolean;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isVideoEnabled: boolean;
  localStream: MediaStreamType | null;
  remoteStreams: Map<string, MediaStreamType>;
  callDuration: number;
  networkQuality: "good" | "fair" | "poor" | "unknown";
}

export interface CallActions {
  startCall: (params: StartCallParams) => Promise<string>;
  answerCall: (callId: string) => Promise<void>;
  declineCall: (callId: string) => Promise<void>;
  endCall: (callId?: string) => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleVideo: () => void;
  switchCamera: () => Promise<void>;
}

// ============================================================================
// Call Events
// ============================================================================

export type CallEvent =
  | { type: "call_started"; call: Call }
  | { type: "call_answered"; call: Call }
  | { type: "call_ended"; call: Call; reason: CallEndReason }
  | { type: "call_failed"; call: Call; error: string }
  | { type: "participant_joined"; callId: string; participant: CallParticipant }
  | { type: "participant_left"; callId: string; odId: string }
  | { type: "participant_muted"; callId: string; odId: string; muted: boolean }
  | {
      type: "participant_video_changed";
      callId: string;
      odId: string;
      enabled: boolean;
    }
  | { type: "remote_stream_added"; callId: string; odId: string }
  | { type: "remote_stream_removed"; callId: string; odId: string }
  | { type: "network_quality_changed"; quality: "good" | "fair" | "poor" }
  // Group call specific events
  | { type: "active_speaker_changed"; callId: string; odId: string | null }
  | { type: "participant_pinned"; callId: string; odId: string | null }
  | {
      type: "participant_role_changed";
      callId: string;
      odId: string;
      role: GroupCallRole;
    }
  | { type: "hand_raised"; callId: string; odId: string; raised: boolean }
  | { type: "call_locked"; callId: string; locked: boolean }
  | { type: "all_muted"; callId: string; byHostId: string }
  | {
      type: "participant_removed";
      callId: string;
      odId: string;
      byHostId: string;
    }
  | { type: "layout_changed"; callId: string; layout: GroupCallLayout }
  | { type: "screen_share_started"; callId: string; odId: string }
  | { type: "screen_share_stopped"; callId: string; odId: string };

export type CallEventHandler = (event: CallEvent) => void;

// ============================================================================
// Privacy Settings
// ============================================================================

export type CallsAllowedFrom = "everyone" | "friends_only" | "nobody";

export interface CallPrivacySettings {
  allowCallsFrom: CallsAllowedFrom;
  dndEnabled: boolean;
  dndSchedule?: {
    startHour: number; // 0-23
    endHour: number; // 0-23
    timezone: string;
  };
}

// ============================================================================
// Push Notification Payload
// ============================================================================

export interface CallNotificationPayload {
  type: "incoming_call" | "call_cancelled" | "call_missed";
  callId: string;
  callerId: string;
  callerName: string;
  callType: CallType;
  conversationId: string;
  scope: CallScope;
  hasVideo: "true" | "false";
  uuid: string; // For CallKeep
}

// ============================================================================
// CallKeep Types
// ============================================================================

export interface CallKeepOptions {
  ios: {
    appName: string;
    imageName?: string;
    supportsVideo: boolean;
    maximumCallGroups: string;
    maximumCallsPerCallGroup: string;
    ringtoneSound?: string;
    includesCallsInRecents: boolean;
  };
  android: {
    alertTitle: string;
    alertDescription: string;
    cancelButton: string;
    okButton: string;
    imageName?: string;
    additionalPermissions?: string[];
    selfManaged: boolean;
    foregroundService?: {
      channelId: string;
      channelName: string;
      notificationTitle: string;
      notificationIcon?: string;
    };
  };
}

// ============================================================================
// Analytics Events
// ============================================================================

export interface CallAnalyticsEvent {
  event:
    | "call_initiated"
    | "call_answered"
    | "call_declined"
    | "call_ended"
    | "call_failed"
    | "call_missed";
  callId: string;
  callType: CallType;
  scope: CallScope;
  duration?: number;
  participants: number;
  failureReason?: string;
  networkQuality?: string;
}

// ============================================================================
// Constants
// ============================================================================

export const CALL_TIMEOUT_MS = 30000; // 30 seconds ring timeout
export const CALL_RECONNECT_TIMEOUT_MS = 15000; // 15 seconds to reconnect
export const MAX_GROUP_PARTICIPANTS = 8;

export const DEFAULT_ICE_SERVERS: IceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

// Twilio TURN server credentials will be fetched from Cloud Functions
export const TURN_CREDENTIAL_ENDPOINT = "getTurnCredentials";

// ============================================================================
// Call History Types (Phase 4)
// ============================================================================

export interface CallHistoryFilter {
  type?: CallType | "all";
  scope?: CallScope | "all";
  direction?: "incoming" | "outgoing" | "missed" | "all";
  startDate?: number;
  endDate?: number;
  contactId?: string; // Filter by specific contact
}

export interface CallHistoryStats {
  totalCalls: number;
  totalDuration: number; // In seconds
  incomingCalls: number;
  outgoingCalls: number;
  missedCalls: number;
  averageDuration: number;
  longestCall: number;
  mostCalledContact?: {
    odId: string;
    displayName: string;
    callCount: number;
  };
}

// ============================================================================
// Call Settings Types (Phase 4)
// ============================================================================

export type CameraPosition = "front" | "back";
export type AudioOutput = "earpiece" | "speaker" | "bluetooth" | "wired";
export type RingtoneOption = "default" | "vibrate_only" | "silent" | "custom";

export interface DNDSchedule {
  enabled: boolean;
  startHour: number; // 0-23
  startMinute: number; // 0-59
  endHour: number; // 0-23
  endMinute: number; // 0-59
  timezone: string;
  daysOfWeek: number[]; // 0 = Sunday, 6 = Saturday
}

export interface CallSettings {
  // Camera settings
  defaultCamera: CameraPosition;
  mirrorFrontCamera: boolean;
  autoEnableVideo: boolean;

  // Audio settings
  defaultAudioOutput: AudioOutput;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;

  // Ringtone settings
  ringtone: RingtoneOption;
  customRingtoneUri?: string;
  vibrationEnabled: boolean;
  ringtoneVolume: number; // 0-100

  // Do Not Disturb
  dndSchedule: DNDSchedule;

  // Privacy settings
  allowCallsFrom: CallsAllowedFrom;
  showCallPreview: boolean; // Show caller info on lock screen
  announceCallerName: boolean; // Text-to-speech for incoming calls

  // Quality settings
  preferredVideoQuality: "auto" | "high" | "medium" | "low";
  dataSaverMode: boolean; // Reduce bandwidth usage
  wifiOnlyVideo: boolean; // Disable video on cellular

  // Accessibility
  flashOnRing: boolean; // Flash screen on incoming call
  hapticFeedback: boolean;
  largeCallControls: boolean;
}

export const DEFAULT_CALL_SETTINGS: CallSettings = {
  defaultCamera: "front",
  mirrorFrontCamera: true,
  autoEnableVideo: false,
  defaultAudioOutput: "earpiece",
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  ringtone: "default",
  vibrationEnabled: true,
  ringtoneVolume: 80,
  dndSchedule: {
    enabled: false,
    startHour: 22,
    startMinute: 0,
    endHour: 7,
    endMinute: 0,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  },
  allowCallsFrom: "everyone",
  showCallPreview: true,
  announceCallerName: false,
  preferredVideoQuality: "auto",
  dataSaverMode: false,
  wifiOnlyVideo: false,
  flashOnRing: false,
  hapticFeedback: true,
  largeCallControls: false,
};

// ============================================================================
// Call Quality Metrics (Phase 4)
// ============================================================================

export interface CallQualityMetrics {
  callId: string;
  timestamp: number;

  // Network metrics
  roundTripTime: number; // ms
  jitter: number; // ms
  packetLoss: number; // percentage
  bandwidth: {
    upload: number; // kbps
    download: number; // kbps
  };

  // Audio metrics
  audioLevel: number; // 0-100
  audioCodec: string;
  audioSampleRate: number;

  // Video metrics (if video call)
  videoWidth?: number;
  videoHeight?: number;
  videoFrameRate?: number;
  videoCodec?: string;
  videoBitrate?: number;

  // Quality score
  qualityScore: number; // 1-5 (MOS-like score)
  qualityRating: "excellent" | "good" | "fair" | "poor" | "bad";
}

export interface CallQualityReport {
  callId: string;
  userId: string;
  callType: CallType;
  callDuration: number;
  averageQualityScore: number;
  metrics: CallQualityMetrics[];
  issues: CallQualityIssue[];
  userFeedback?: {
    rating: number; // 1-5
    comment?: string;
    reportedIssues: string[];
  };
}

export interface CallQualityIssue {
  timestamp: number;
  type:
    | "high_latency"
    | "packet_loss"
    | "low_bandwidth"
    | "audio_glitch"
    | "video_freeze"
    | "connection_drop";
  severity: "minor" | "moderate" | "severe";
  duration: number; // ms
  details?: string;
}

// ============================================================================
// Call Analytics Events (Phase 4)
// ============================================================================

export interface DetailedCallAnalyticsEvent extends CallAnalyticsEvent {
  // Device info
  platform: "ios" | "android";
  osVersion: string;
  appVersion: string;
  deviceModel: string;

  // Network info
  connectionType: "wifi" | "cellular" | "ethernet" | "unknown";
  cellularGeneration?: "3g" | "4g" | "5g";

  // Call quality
  averageQualityScore?: number;
  peakPacketLoss?: number;
  peakLatency?: number;

  // Timing
  ringDuration?: number; // Time spent ringing
  connectDuration?: number; // Time to establish connection

  // User actions
  mutedDuringCall: boolean;
  cameraToggledCount: number;
  speakerToggledCount: number;
  cameraFlippedCount: number;

  // Errors
  iceConnectionFailures: number;
  mediaStreamErrors: number;
  reconnectionAttempts: number;
}

// ============================================================================
// Feature Flags for Calls (Phase 4)
// ============================================================================

export interface CallFeatureFlags {
  callsEnabled: boolean;
  videoCallsEnabled: boolean;
  groupCallsEnabled: boolean;
  screenSharingEnabled: boolean;
  callRecordingEnabled: boolean;
  callHistoryEnabled: boolean;
  callSettingsEnabled: boolean;
  callAnalyticsEnabled: boolean;
  rolloutPercentage: number;
}
