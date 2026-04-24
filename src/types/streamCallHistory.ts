/**
 * Stream Call History Types
 *
 * Normalized history model for the Stream-based calling system.
 * Stored in Firestore at Users/{uid}/StreamCallHistory/{id}
 */

// ---------------------------------------------------------------------------
// Entry classification
// ---------------------------------------------------------------------------

export type CallEntryType = "direct_audio" | "direct_video" | "voice_room";

export type CallDirection = "incoming" | "outgoing" | "joined";

export type CallResult =
  | "completed"
  | "missed"
  | "declined"
  | "canceled"
  | "left"
  | "ongoing";

// ---------------------------------------------------------------------------
// History entry (Firestore document)
// ---------------------------------------------------------------------------

export interface StreamCallHistoryEntry {
  /** Document ID — for direct calls equals callId, for rooms equals `${callId}_${userId}` */
  id: string;
  /** Owner of this history record */
  userId: string;
  /** Stream call ID */
  callId: string;
  /** Stream call session ID for completed sessions when available */
  sessionId?: string | null;

  // Classification
  entryType: CallEntryType;
  direction: CallDirection;
  result: CallResult;

  // Timing
  startedAt: number;
  endedAt: number | null;
  durationSeconds: number | null;

  // Direct call peer info (null for voice rooms)
  otherUserId: string | null;
  otherUserName: string | null;
  otherUserAvatar: string | null;

  // Voice room info (null for direct calls)
  groupId: string | null;
  groupName: string | null;
  groupAvatar: string | null;
  participantCount: number | null;

  // Metadata
  initiatedBy: string;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Filter for querying history
// ---------------------------------------------------------------------------

export type CallHistoryFilterType = "all" | "missed" | "direct" | "rooms";

export interface StreamCallHistoryFilter {
  filterType?: CallHistoryFilterType;
  maxResults?: number;
}
