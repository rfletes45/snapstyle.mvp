/**
 * Direct Call Service
 *
 * Handles 1:1 audio and video calls using Stream Video's ringing flow.
 * Each call gets a unique ID and uses Stream's built-in ringing mechanism.
 */

import type { DirectCallMode } from "@/types/streamCall";
import type { Call } from "@stream-io/video-react-native-sdk";
import { getStreamClient } from "./streamClient";

/**
 * Stream call type for 1:1 ringing calls.
 * Uses Stream's built-in "default" call type which supports ringing.
 */
const DIRECT_CALL_TYPE = "default";

/**
 * Start an outgoing ringing call.
 *
 * @param callId   Unique call ID (use uuid)
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
  const call = client.call(DIRECT_CALL_TYPE, callId);

  await call.getOrCreate({
    ring: true,
    data: {
      members: [{ user_id: callerId, role: "admin" }, { user_id: calleeId }],
      custom: {
        mode,
      },
    },
  });

  // Join with appropriate media settings
  await call.join({
    create: false,
    ring: true,
    data: {
      settings_override: {
        audio: { mic_default_on: true, default_device: "speaker" },
        video: { camera_default_on: mode === "video" },
      },
    },
  });

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
  await call.join({
    data: {
      settings_override: {
        audio: { mic_default_on: true, default_device: "speaker" },
        video: { camera_default_on: mode === "video" },
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
