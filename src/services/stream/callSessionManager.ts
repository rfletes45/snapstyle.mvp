/**
 * Shared Stream call session helpers.
 *
 * Centralizes native audio-session lifecycle and explicit media-permission
 * prompts so call services can follow the documented Stream RN flow.
 */

import { CALL_FEATURES } from "@/constants/featureFlags";
import {
  requestCameraPermission,
  requestMicrophonePermission,
} from "@/utils/permissions";

export type CallAudioDeviceEndpoint = "speaker" | "earpiece";

function getCallManager(): any {
  if (!CALL_FEATURES.CALLS_ENABLED) {
    return null;
  }

  try {
    return require("@stream-io/video-react-native-sdk").callManager;
  } catch {
    return null;
  }
}

export async function requestCallPermissions(options: {
  microphone?: boolean;
  camera?: boolean;
}): Promise<{
  microphoneGranted: boolean;
  cameraGranted: boolean;
}> {
  const needsMicrophone = options.microphone === true;
  const needsCamera = options.camera === true;

  let microphoneGranted = !needsMicrophone;
  let cameraGranted = !needsCamera;

  if (needsMicrophone) {
    microphoneGranted = await requestMicrophonePermission();
    if (!microphoneGranted) {
      throw new Error("Microphone permission is required to join calls.");
    }
  }

  if (needsCamera) {
    cameraGranted = await requestCameraPermission();
  }

  return { microphoneGranted, cameraGranted };
}

export async function startCallAudioSession(
  deviceEndpointType: CallAudioDeviceEndpoint,
): Promise<void> {
  const callManager = getCallManager();
  if (!callManager?.start) {
    console.warn(
      "[CallSessionManager] callManager.start unavailable - audio routing may be limited",
    );
    return;
  }

  await callManager.start({
    audioRole: "communicator",
    deviceEndpointType,
  });
}

export async function stopCallAudioSession(): Promise<void> {
  const callManager = getCallManager();
  if (!callManager?.stop) return;

  try {
    await callManager.stop();
  } catch (err) {
    console.warn("[CallSessionManager] callManager.stop failed:", err);
  }
}

/**
 * Re-apply the audio output endpoint (speaker / earpiece) **without**
 * restarting the native audio session.
 *
 * Use this after `call.join()` returns to ensure the correct audio route
 * is active. The Stream SDK's internal `callManager.start()` during join
 * may have changed the route, and calling `startCallAudioSession()` again
 * would trigger another `adm.reset()` on iOS.
 */
export function reanchorAudioEndpoint(
  deviceEndpointType: CallAudioDeviceEndpoint,
): void {
  const callManager = getCallManager();
  if (!callManager?.speaker?.setForceSpeakerphoneOn) {
    return;
  }

  const wantsSpeaker = deviceEndpointType === "speaker";
  callManager.speaker.setForceSpeakerphoneOn(wantsSpeaker);
  console.info(
    `[CallSessionManager] Re-anchored audio endpoint to ${deviceEndpointType}`,
  );
}
