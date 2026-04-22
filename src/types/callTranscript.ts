/**
 * Call Transcript Types
 *
 * Privacy-first local transcript pipeline for direct 1:1 audio calls only.
 *
 * Transcripts are:
 *  - Generated server-side via Stream's transcription feature
 *  - Delivered once to the app via an authenticated backend endpoint
 *  - Persisted locally on-device in SQLite
 *  - Deleted from server after local ACK or after a hard 2-day max
 *
 * NEVER:
 *  - Stored permanently in Firestore as source of truth
 *  - Generated for video calls or voice rooms
 *  - Started when either participant has transcription disabled
 */

export type CallTranscriptStatus =
  | "not_applicable" // Non-audio-direct call — transcripts never apply
  | "disabled_by_setting" // Local user disabled transcripts
  | "disabled_by_policy" // Remote user or server policy disabled
  | "policy_unresolved" // Could not resolve policy — fail closed
  | "processing" // Transcription running / server generating
  | "ready_remote" // Server copy exists; not yet downloaded locally
  | "downloading" // Download in flight
  | "saved_local" // Persisted locally — server copy may or may not be deleted
  | "expired" // Server copy deleted before we saved it locally
  | "failed" // Any terminal failure
  | "deleted_local"; // User manually deleted the local copy

export interface CallTranscriptMeta {
  /** Stream call ID */
  callId: string;
  /** Stream session ID — disambiguates multiple sessions on the same callId */
  sessionId: string;
  /** The user who owns this local row (the signed-in uid) */
  ownerUid: string;
  /** Associated StreamCallHistory entry id (for join-back to CallInfo) */
  entryId: string | null;

  transcriptStatus: CallTranscriptStatus;

  /** Unix ms — when the server copy will be hard-deleted (≤ 2 days from creation) */
  serverExpiresAt: number | null;
  /** Unix ms — when we finished writing all segments locally */
  localSavedAt: number | null;
  /** Unix ms — when the server confirmed deletion of its copy */
  deletedFromServerAt: number | null;

  lastError: string | null;
  updatedAt: number;
}

export interface CallTranscriptSegment {
  callId: string;
  sessionId: string;
  /** 0-based order within the transcript */
  segmentIndex: number;
  /** Stream user id of the speaker */
  speakerId: string | null;
  /** Best-known display name at write time — may be stale */
  speakerName: string | null;
  /** Unix ms offsets from call start (or absolute ms — normalized on write) */
  startTimeMs: number;
  endTimeMs: number;
  text: string;
}

/**
 * Lightweight availability record exposed through the authenticated backend
 * endpoint (NOT the full transcript — the full transcript comes via signed
 * URL or chunked segments).
 */
export interface TranscriptAvailability {
  callId: string;
  sessionId: string;
  status: "processing" | "ready" | "expired" | "not_found";
  serverExpiresAt: number | null;
  /** Signed URL or function-relative path to fetch segments. Null until ready. */
  downloadUrl: string | null;
  /** Indicates whether this came from Stream-managed fallback storage. */
  source: "external" | "stream_fallback" | null;
}
