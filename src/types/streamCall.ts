/**
 * Stream Video Types
 *
 * Defines types used throughout the Stream-based call system.
 * These replace the legacy Firestore-based call types.
 */

// ---------------------------------------------------------------------------
// Call modes
// ---------------------------------------------------------------------------

/** Direct calls are private 1:1 ringing calls */
export type DirectCallMode = "audio" | "video";

/** Voice channels are shared, non-ringing group audio rooms */
export type VoiceChannelMode = "voice_channel";

// ---------------------------------------------------------------------------
// Direct call status (mirrors Stream call states for convenience)
// ---------------------------------------------------------------------------

export type DirectCallStatus =
  | "idle"
  | "ringing" // outgoing ring or incoming ring
  | "joining" // accepted, connecting to SFU
  | "joined" // active media session
  | "left"; // call ended/declined/missed

// ---------------------------------------------------------------------------
// Voice channel status
// ---------------------------------------------------------------------------

export type VoiceChannelStatus = "idle" | "joining" | "joined" | "left";

// ---------------------------------------------------------------------------
// Participant (simplified — Stream provides the authoritative data)
// ---------------------------------------------------------------------------

export interface StreamParticipantInfo {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSpeaking: boolean;
}

// ---------------------------------------------------------------------------
// Direct call metadata (for navigation params and history)
// ---------------------------------------------------------------------------

export interface DirectCallParams {
  callId: string;
  recipientId: string;
  recipientName: string;
  mode: DirectCallMode;
  isOutgoing: boolean;
}

// ---------------------------------------------------------------------------
// Voice channel metadata
// ---------------------------------------------------------------------------

export interface VoiceChannelParams {
  /** Deterministic channel ID, e.g. `voice_channel_{groupId}` */
  channelId: string;
  /** Display name for the voice channel */
  channelName: string;
  /** The group/chat ID this channel belongs to */
  groupId: string;
}

// ---------------------------------------------------------------------------
// Busy state
// ---------------------------------------------------------------------------

export type ActiveMediaSession =
  | {
      type: "direct_call";
      callId: string;
      recipientName?: string;
      mode?: DirectCallMode;
    }
  | {
      type: "voice_channel";
      channelId: string;
      channelName?: string;
      groupId?: string;
    }
  | null;
