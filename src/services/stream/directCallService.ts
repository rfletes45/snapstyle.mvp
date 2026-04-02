/**
 * Direct Call Service
 *
 * Handles 1:1 audio and video calls using Stream Video's ringing flow.
 * Each call gets a unique ID and uses Stream's built-in ringing mechanism.
 *
 * Bootstrap sequence:
 *  1. Best-effort user provisioning (caller + callee should exist in Stream)
 *  2. getOrCreate the call with ringing + members + settings_override
 *  3. Join (no settings_override — Stream validates target_resolution)
 *  4. Set camera/mic state programmatically after join
 */

import { callSettingsService } from "@/services/calls";
import type { DirectCallMode } from "@/types/streamCall";
import type { Call } from "@stream-io/video-react-native-sdk";
import { validateParticipantIds } from "./callSettingsValidator";
import { getStreamClient } from "./streamClient";
import { ensureStreamUsersExist } from "./streamUserProvisioning";
import { toStreamDevice } from "./streamUtils";

// Lazy-load callManager — may not exist in Expo Go
let callManager: any = null;
try {
  callManager = require("@stream-io/video-react-native-sdk").callManager;
} catch {
  // Not available
}

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
  const cameraOn = mode === "video" && config.video.startEnabled;

  // Validate participant IDs before any network calls
  const [validCallerId, validCalleeId] = validateParticipantIds(
    [callerId, calleeId],
    "direct call",
  );

  // Step 1: Best-effort provision caller & callee as Stream users.
  // getStreamVideoToken already upserts the CALLER on every token fetch,
  // and the callee may already exist from their own token fetch.
  // We attempt provisioning but proceed if it fails — getOrCreate below
  // will fail with a clear "user not found" error if the user truly
  // doesn't exist, which we surface with a specific message.
  let provisionFailed = false;
  try {
    await ensureStreamUsersExist([validCallerId, validCalleeId]);
  } catch (provisionErr: any) {
    provisionFailed = true;
    console.warn(
      `${TAG} User provisioning failed (non-fatal, proceeding):`,
      provisionErr?.code ?? "",
      provisionErr?.message ?? provisionErr,
    );
  }

  // Step 2: Create (or get existing) call with ringing and member list.
  // settings_override goes HERE at creation time, not in join().
  // Passing video settings in join() causes Stream to validate
  // target_resolution defaults which fail with width/height < 240.
  const call = client.call(DIRECT_CALL_TYPE, callId);

  try {
    await call.getOrCreate({
      ring: true,
      data: {
        members: [
          { user_id: validCallerId, role: "admin" },
          { user_id: validCalleeId },
        ],
        custom: {
          mode,
        },
        settings_override: {
          audio: {
            mic_default_on: true,
            default_device: toStreamDevice(config.audio.defaultOutput),
          },
          video: {
            camera_default_on: cameraOn,
            // ALWAYS provide a valid target_resolution when overriding ANY
            // video field. Stream's API stores the override as-is — missing
            // fields default to {0, 0} which fails validation (min 240×240).
            target_resolution: { width: 1280, height: 720, bitrate: 3000000 },
          },
        },
      },
    });
  } catch (createErr: any) {
    const errMsg = createErr?.message ?? String(createErr);
    // If provisioning failed AND create failed, give a specific message
    if (
      provisionFailed &&
      (errMsg.includes("user") || errMsg.includes("don't exist"))
    ) {
      console.error(
        `${TAG} getOrCreate failed after provisioning failure:`,
        createErr,
      );
      throw new Error(
        "Unable to start call: one or more participants could not be registered. " +
          "The other user may need to open the app first.",
      );
    }
    console.error(`${TAG} getOrCreate failed:`, createErr);
    throw new Error(classifyCallError(createErr, "create"));
  }

  // Step 2b: Configure the native audio session BEFORE joining.
  // callManager.start() sets iOS AVAudioSession to .playAndRecord and
  // Android audio routing. Without this, two-way audio won't work for
  // audio-only calls (video calls use <CallContent> which handles this
  // internally). Use earpiece for audio calls, speaker for video.
  if (callManager?.start) {
    try {
      const deviceEndpoint =
        mode === "video"
          ? "speaker"
          : toStreamDevice(config.audio.defaultOutput);
      callManager.start({
        audioRole: "communicator",
        deviceEndpointType: deviceEndpoint,
      });
    } catch (err) {
      console.warn(`${TAG} callManager.start failed:`, err);
    }
  }

  // Step 3: Join the call. No settings_override here — settings were
  // applied at creation time above. The SDK reads camera_default_on
  // from the call settings to decide whether to enable camera hardware.
  try {
    await call.join({ create: false, ring: true });
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

  // Only touch camera hardware when mode is video.
  // For audio calls, skip camera.enable/disable entirely to prevent
  // the iOS camera indicator from activating.
  if (mode === "video") {
    try {
      if (cameraOn) {
        await call.camera.enable();
      } else {
        await call.camera.disable();
      }
    } catch {
      // Non-fatal — camera state may already be correct
    }
  }

  console.log(`${TAG} Call ${callId} started (${mode}) → ${calleeId}`);
  return call;
}

/**
 * Accept an incoming ringing call.
 * Camera/mic state is set programmatically after join to avoid
 * settings_override validation issues (target_resolution).
 */
export async function acceptDirectCall(
  call: Call,
  mode: DirectCallMode = "audio",
): Promise<void> {
  const config = callSettingsService.getCallConfig();
  const cameraOn = mode === "video" && config.video.startEnabled;

  // Configure native audio session before joining (same as startDirectCall).
  if (callManager?.start) {
    try {
      const deviceEndpoint =
        mode === "video"
          ? "speaker"
          : toStreamDevice(config.audio.defaultOutput);
      callManager.start({
        audioRole: "communicator",
        deviceEndpointType: deviceEndpoint,
      });
    } catch (err) {
      console.warn(`${TAG} callManager.start failed:`, err);
    }
  }

  // Join the call. The caller's settings_override.camera_default_on
  // controls whether the SDK enables camera after join.
  // For audio calls: camera_default_on = false → no camera hardware access.
  // For video calls: camera_default_on = cameraOn → SDK may enable camera.
  await call.join();

  // Only touch camera hardware when mode is video.
  // For audio calls, camera_default_on: false in the caller's settings is sufficient.
  if (mode === "video") {
    try {
      if (cameraOn) {
        await call.camera.enable();
      } else {
        await call.camera.disable();
      }
    } catch {
      // Non-fatal — defaults are usually acceptable
    }
  }

  // Ensure microphone is on
  try {
    await call.microphone.enable();
  } catch {
    // Non-fatal — defaults are usually acceptable
  }
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
