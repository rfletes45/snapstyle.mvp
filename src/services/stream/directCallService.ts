/**
 * Direct Call Service
 *
 * Handles 1:1 audio and video calls using Stream Video's ringing flow.
 * Each call gets a unique ID and uses Stream's built-in ringing mechanism.
 *
 * Bootstrap sequence:
 *  1. Blocking user provisioning (caller + callee must exist in Stream)
 *  2. getOrCreate the call with ringing + members
 *  3. Join with media settings
 *
 * Step 1 is BLOCKING — Stream requires all referenced users to exist before
 * call creation. If provisioning fails, the call is NOT attempted.
 */

import { callSettingsService } from "@/services/calls";
import type { DirectCallMode } from "@/types/streamCall";
import type { Call } from "@stream-io/video-react-native-sdk";
import { getStreamClient } from "./streamClient";
import { ensureStreamUsersExist } from "./streamUserProvisioning";
import { toStreamDevice } from "./streamUtils";

const TAG = "[DirectCallService]";

/**
 * Stream call type for 1:1 ringing calls.
 * Uses Stream's built-in "default" call type which supports ringing.
 */
const DIRECT_CALL_TYPE = "default";

/**
 * Start an outgoing ringing call.
 *
 * @param callId   Unique call ID (use uuid)
 * @param callerId The caller's user ID
 * @param calleeId The recipient's user ID
 * @param mode     "audio" or "video"
 * @returns The Stream Call object
 */
export async function startDirectCall(
  callId: string,
  callerId: string,
  calleeId: string,
  mode: DirectCallMode,
): Promise<Call> {
  const client = getStreamClient();
  const config = callSettingsService.getCallConfig();

  // Step 1: Ensure both caller and callee exist as Stream users.
  // Stream REQUIRES all users to exist before they are referenced as call
  // members.  This call is BLOCKING — if provisioning fails the call must
  // not proceed, otherwise getOrCreate will fail with
  // "users … don't exist" (stream error code 4).
  try {
    await ensureStreamUsersExist([callerId, calleeId]);
  } catch (provisionErr: any) {
    console.error(
      `${TAG} User provisioning failed (blocking):`,
      provisionErr?.message ?? provisionErr,
    );
    throw new Error(
      "Unable to start call: could not provision call participants. " +
        "Please check your connection and try again.",
    );
  }

  // Step 2: Create (or get existing) call with ringing and member list.
  const call = client.call(DIRECT_CALL_TYPE, callId);

  try {
    await call.getOrCreate({
      ring: true,
      data: {
        members: [{ user_id: callerId, role: "admin" }, { user_id: calleeId }],
        custom: {
          mode,
        },
      },
    });
  } catch (createErr: any) {
    console.error(`${TAG} getOrCreate failed:`, createErr);
    throw new Error(classifyCallError(createErr, "create"));
  }

  // Step 3: Join with media settings derived from user preferences.
  const cameraOn = mode === "video" && config.video.startEnabled;
  try {
    await call.join({
      create: false,
      ring: true,
      data: {
        settings_override: {
          audio: {
            mic_default_on: true,
            default_device: toStreamDevice(config.audio.defaultOutput),
          },
          video: { camera_default_on: cameraOn },
        },
      },
    });
  } catch (joinErr: any) {
    console.error(`${TAG} join failed:`, joinErr);
    // Clean up the created call so it doesn't leave a phantom ringing state
    try {
      await call.endCall();
    } catch {
      /* best effort cleanup */
    }
    throw new Error(classifyCallError(joinErr, "join"));
  }

  console.log(`${TAG} Call ${callId} started (${mode}) → ${calleeId}`);
  return call;
}

/**
 * Accept an incoming ringing call.
 * Passes settings_override to ensure audio-only calls don't enable camera.
 */
export async function acceptDirectCall(
  call: Call,
  mode: DirectCallMode = "audio",
): Promise<void> {
  const config = callSettingsService.getCallConfig();
  const cameraOn = mode === "video" && config.video.startEnabled;

  await call.join({
    data: {
      settings_override: {
        audio: {
          mic_default_on: true,
          default_device: toStreamDevice(config.audio.defaultOutput),
        },
        video: { camera_default_on: cameraOn },
      },
    },
  });
}

/**
 * Reject/decline an incoming ringing call.
 */
export async function rejectDirectCall(call: Call): Promise<void> {
  await call.leave({ reject: true });
}

/**
 * End an active direct call for both participants.
 */
export async function endDirectCall(call: Call): Promise<void> {
  try {
    await call.endCall();
  } catch {
    // Fallback to leave if endCall fails (e.g. already ended by remote)
    await call.leave();
  }
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * Transform raw Stream/Firebase errors into user-readable messages
 * with enough detail for TestFlight debugging.
 */
function classifyCallError(err: any, phase: "create" | "join"): string {
  const raw = err?.message ?? String(err);
  const code = err?.code ?? "";

  // Firebase Functions errors
  if (code === "not-found" || raw.includes("not-found")) {
    return `Call setup failed: backend function unavailable (${phase}). Please update the app or try again later.`;
  }
  if (code === "unauthenticated" || raw.includes("unauthenticated")) {
    return "You must be logged in to make a call.";
  }
  if (code === "permission-denied" || raw.includes("permission-denied")) {
    return "You don't have permission to call this user.";
  }

  // Stream API errors
  if (raw.includes("call type") && raw.includes("not found")) {
    return `Call type not configured on server. Contact support. (${phase})`;
  }
  if (raw.includes("user") && raw.includes("not found")) {
    return `Could not find one of the call participants. Try again. (${phase})`;
  }
  if (raw.includes("already joined") || raw.includes("already in a call")) {
    return "You're already in a call. End it before starting a new one.";
  }
  if (
    raw.includes("network") ||
    raw.includes("timeout") ||
    raw.includes("ECONNREFUSED")
  ) {
    return "Network error — check your connection and try again.";
  }

  // Fallback — include phase for debugging
  return `Unable to ${phase === "create" ? "start" : "connect to"} call: ${raw}`;
}
