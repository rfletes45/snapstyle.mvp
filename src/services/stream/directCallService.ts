/**
 * Direct Call Service
 *
 * Handles 1:1 audio and video calls using Stream's ringing flow.
 *
 * Stream-aligned lifecycle:
 *  1. Best-effort provision caller + callee in Stream
 *  2. Request local media permissions deliberately
 *  3. `getOrCreate({ ring: true })` with a unique call ID
 *  4. Start the local audio session while the caller is ringing
 *  5. Let Stream auto-join the caller when the first callee accepts
 *  6. Apply local mic/camera state after the join completes
 */

import { callSettingsService } from "@/services/calls";
import type { DirectCallMode } from "@/types/streamCall";
import type { Call } from "@stream-io/video-react-native-sdk";
import { validateParticipantIds } from "./callSettingsValidator";
import {
  requestCallPermissions,
  startCallAudioSession,
  stopCallAudioSession,
} from "./callSessionManager";
import {
  applyCallMediaPreferences,
  applyCallReconnectPolicy,
  applyPreferredCameraDirection,
  joinCallWithRetry,
} from "./callRuntime";
import { getStreamClient } from "./streamClient";
import { ensureStreamUsersExist } from "./streamUserProvisioning";
import { toStreamDevice } from "./streamUtils";

const TAG = "[DirectCallService]";

const getCallingState = () =>
  (require("@stream-io/video-react-native-sdk") as typeof import("@stream-io/video-react-native-sdk"))
    .CallingState;

/**
 * Stream call type for 1:1 ringing calls.
 */
const DIRECT_CALL_TYPE = "default";

export async function startDirectCall(
  callId: string,
  callerId: string,
  calleeId: string,
  mode: DirectCallMode,
): Promise<Call> {
  const client = getStreamClient();
  const config = callSettingsService.getCallConfig();
  const wantsCameraOn = mode === "video" && config.video.startEnabled;

  const [validCallerId, validCalleeId] = validateParticipantIds(
    [callerId, calleeId],
    "direct call",
  );

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

  let requestedPermissions;
  try {
    requestedPermissions = await requestCallPermissions({
      microphone: true,
      camera: wantsCameraOn,
    });
  } catch (err) {
    console.warn(`${TAG} Permission request failed during call start:`, err);
    throw err;
  }
  const cameraOn = wantsCameraOn && requestedPermissions.cameraGranted;

  const call = client.call(DIRECT_CALL_TYPE, callId);

  try {
    await call.getOrCreate({
      ring: true,
      video: mode === "video",
      data: {
        members: [
          { user_id: validCallerId, role: "admin" },
          { user_id: validCalleeId },
        ],
        custom: {
          mode,
        },
      },
    });
  } catch (createErr: any) {
    const errMsg = createErr?.message ?? String(createErr);
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

  applyCallReconnectPolicy(call, `direct call ${callId}`);

  const deviceEndpoint =
    mode === "video" ? "speaker" : toStreamDevice(config.audio.defaultOutput);
  try {
    await startCallAudioSession(deviceEndpoint);
  } catch (err) {
    console.warn(`${TAG} callManager.start failed:`, err);
  }

  watchLocalDeviceSetupOnJoin(call, {
    context: `outgoing direct call ${callId}`,
    enableMicrophone: true,
    enableCamera: cameraOn,
  });
  return call;
}

export async function acceptDirectCall(
  call: Call,
  mode: DirectCallMode = "audio",
): Promise<void> {
  const CallingState = getCallingState();
  const config = callSettingsService.getCallConfig();
  const wantsCameraOn = mode === "video" && config.video.startEnabled;
  let requestedPermissions;
  try {
    requestedPermissions = await requestCallPermissions({
      microphone: true,
      camera: wantsCameraOn,
    });
  } catch (err) {
    console.warn(`${TAG} Permission request failed during call accept:`, err);
    throw err;
  }
  const cameraOn = wantsCameraOn && requestedPermissions.cameraGranted;

  const deviceEndpoint =
    mode === "video" ? "speaker" : toStreamDevice(config.audio.defaultOutput);
  try {
    await startCallAudioSession(deviceEndpoint);
  } catch (err) {
    console.warn(`${TAG} callManager.start failed:`, err);
  }

  applyCallReconnectPolicy(call, `direct call ${call.id}`);

  try {
    if (
      call.state.callingState !== CallingState.JOINING &&
      call.state.callingState !== CallingState.JOINED
    ) {
      await joinCallWithRetry(call, undefined, `direct call ${call.id}`);
    }

    await ensureLocalDevices(call, {
      context: `accepted direct call ${call.id}`,
      enableMicrophone: true,
      enableCamera: cameraOn,
    });
    applyCallMediaPreferences(call, `accepted direct call ${call.id}`);
  } catch (err) {
    console.error(`${TAG} Accept/join failed:`, err);
    await stopCallAudioSession();
    throw new Error(classifyCallError(err, "join"));
  }
}

export async function rejectDirectCall(
  call: Call,
  reason: "decline" | "busy" | "cancel" = "decline",
): Promise<void> {
  try {
    await call.leave({ reject: true, reason });
  } finally {
    await stopCallAudioSession();
  }
}

export async function endDirectCall(call: Call): Promise<void> {
  const CallingState = getCallingState();
  try {
    if (call.state.callingState === CallingState.RINGING) {
      const reason = call.isCreatedByMe ? "cancel" : "decline";
      await call.leave({ reject: true, reason });
      return;
    }

    await call.endCall();
  } catch {
    await call.leave();
  } finally {
    await stopCallAudioSession();
  }
}

function watchLocalDeviceSetupOnJoin(
  call: Call,
  options: {
    context: string;
    enableMicrophone: boolean;
    enableCamera: boolean;
  },
): void {
  const CallingState = getCallingState();
  const subscription = call.state.callingState$.subscribe((state) => {
    if (state === CallingState.JOINED) {
      subscription.unsubscribe();
      ensureLocalDevices(call, options)
        .then(() => {
          applyCallMediaPreferences(call, options.context);
        })
        .catch((err) => {
          console.warn(`${TAG} Failed to prepare local devices after join:`, err);
        });
      return;
    }

    if (
      state === CallingState.LEFT ||
      state === CallingState.IDLE ||
      state === CallingState.RECONNECTING_FAILED
    ) {
      subscription.unsubscribe();
    }
  });
}

async function ensureLocalDevices(
  call: Call,
  options: {
    context: string;
    enableMicrophone: boolean;
    enableCamera: boolean;
  },
): Promise<void> {
  if (options.enableMicrophone) {
    try {
      await call.microphone.enable();
    } catch (err) {
      console.warn(`${TAG} microphone.enable failed:`, err);
    }
  }

  await applyPreferredCameraDirection(call, options.context);

  if (options.enableCamera) {
    try {
      await call.camera.enable();
    } catch (err) {
      console.warn(`${TAG} camera.enable failed:`, err);
    }
  }
}

function classifyCallError(err: any, phase: "create" | "join"): string {
  const raw = err?.message ?? String(err);
  const code = err?.code ?? "";

  if (code === "not-found" || raw.includes("not-found")) {
    return `Call setup failed: backend function unavailable (${phase}). Please update the app or try again later.`;
  }
  if (code === "unauthenticated" || raw.includes("unauthenticated")) {
    return "You must be logged in to make a call.";
  }
  if (code === "permission-denied" || raw.includes("permission-denied")) {
    return "You don't have permission to call this user.";
  }
  if (raw.includes("Microphone permission is required")) {
    return raw;
  }

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
    return phase === "join"
      ? "Connection failed while joining the call. Check your network and try again."
      : "Network error - check your connection and try again.";
  }

  return `Unable to ${phase === "create" ? "start" : "connect to"} call: ${raw}`;
}
