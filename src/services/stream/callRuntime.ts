import { callSettingsService } from "@/services/calls";
import type { CallSettings } from "@/types/callSettings";
import type { Call } from "@stream-io/video-react-native-sdk";

type JoinOptions = NonNullable<Parameters<Call["join"]>[0]>;
type VideoResolution = { width: number; height: number };

export const CALL_JOIN_MAX_RETRIES = 4;
export const CALL_DISCONNECTION_TIMEOUT_SECONDS = 45;

const MIN_STREAM_RESOLUTION = 240;
const LOW_RESOLUTION: VideoResolution = { width: 426, height: 240 };
const MEDIUM_RESOLUTION: VideoResolution = { width: 854, height: 480 };
const HIGH_RESOLUTION: VideoResolution = { width: 1280, height: 720 };

/** Ensure both dimensions are at least 240 (Stream API minimum). */
function clampResolution(res: VideoResolution): VideoResolution {
  return {
    width: Math.max(res.width, MIN_STREAM_RESOLUTION),
    height: Math.max(res.height, MIN_STREAM_RESOLUTION),
  };
}

function getIncomingVideoResolution(
  settings: CallSettings = callSettingsService.getSettingsSync(),
): VideoResolution | undefined {
  if (settings.dataSaverMode) {
    return clampResolution(LOW_RESOLUTION);
  }

  switch (settings.preferredVideoQuality) {
    case "high":
      return clampResolution(HIGH_RESOLUTION);
    case "medium":
      return clampResolution(MEDIUM_RESOLUTION);
    case "low":
      return clampResolution(LOW_RESOLUTION);
    default:
      return undefined;
  }
}

export function applyCallReconnectPolicy(call: Call, context: string): void {
  try {
    call.setDisconnectionTimeout(CALL_DISCONNECTION_TIMEOUT_SECONDS);
  } catch (err) {
    console.warn(
      `[StreamCallRuntime] Failed to set disconnection timeout for ${context}:`,
      err,
    );
  }
}

export function applyCallMediaPreferences(call: Call, context: string): void {
  const settings = callSettingsService.getSettingsSync();
  const resolution = getIncomingVideoResolution(settings);

  console.info(
    `[StreamCallRuntime] Applying incoming video preferences for ${context}:`,
    resolution
      ? {
          mode: settings.dataSaverMode
            ? "data_saver"
            : settings.preferredVideoQuality,
          resolution,
        }
      : { mode: "auto", note: "no resolution cap applied" },
  );

  try {
    call.setPreferredIncomingVideoResolution(resolution);
  } catch (err) {
    console.warn(
      `[StreamCallRuntime] Failed to apply incoming video preferences for ${context}:`,
      err,
    );
  }
}

export async function applyPreferredCameraDirection(
  call: Call,
  context: string,
): Promise<void> {
  const settings = callSettingsService.getSettingsSync();
  const direction = settings.defaultCamera === "front" ? "front" : "back";

  try {
    await call.camera.selectDirection(direction, { enableCamera: false });
  } catch (err) {
    console.warn(
      `[StreamCallRuntime] Failed to apply preferred camera direction for ${context}:`,
      err,
    );
  }
}

export async function joinCallWithRetry(
  call: Call,
  options: JoinOptions | undefined,
  context: string,
): Promise<void> {
  console.info(
    `[StreamCallRuntime] Joining ${context} with maxJoinRetries=${CALL_JOIN_MAX_RETRIES}`,
  );

  await call.join({
    ...(options ?? {}),
    maxJoinRetries: CALL_JOIN_MAX_RETRIES,
  });
}
