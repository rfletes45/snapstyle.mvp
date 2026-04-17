/**
 * Call Media Health Check
 *
 * Post-join verification and self-healing for microphone/camera publish state.
 *
 * Problem this solves:
 * - The Stream SDK's `call.microphone.enable()` can appear to succeed (the
 *   optimistic `useMicrophoneState` returns "unmuted") while the actual WebRTC
 *   track is never published. This causes "false unmuted" (UI shows unmuted,
 *   but the other party hears nothing) and one-way audio.
 * - The root cause is a race between `callManager.start()` (native audio
 *   session), `call.join()`, and `call.microphone.enable()`. If the native
 *   audio capture pipeline isn't ready when the SDK enables the mic, the
 *   track publish silently fails.
 *
 * Solution:
 * - After joining, wait for the SDK state to stabilize, then inspect the
 *   actual mic publish status via `call.microphone.state.status`.
 * - If the intended state is "enabled/unmuted" but the actual status shows
 *   otherwise, force a disable→re-enable cycle to trigger a real publish.
 * - Log every phase for diagnostics.
 */

import type { Call } from "@stream-io/video-react-native-sdk";

const TAG = "[CallMediaHealthCheck]";

/** How long to wait after join before running the health check (ms). */
const HEALTH_CHECK_DELAY_MS = 2000;

/** Maximum number of recovery attempts. */
const MAX_RECOVERY_ATTEMPTS = 2;

/** Delay between recovery attempts (ms). */
const RECOVERY_RETRY_DELAY_MS = 1500;

export interface MediaHealthCheckResult {
  micIntendedEnabled: boolean;
  micActualStatus: string;
  micRecovered: boolean;
  micRecoveryAttempts: number;
  cameraIntendedEnabled: boolean;
  cameraActualStatus: string;
}

/**
 * Inspects the actual microphone publish state and reconciles if needed.
 *
 * Call this after the call reaches JOINED state and local devices have been
 * set up. The function will wait `delayMs` before checking, then attempt
 * recovery if the mic is expected to be enabled but is not actually publishing.
 *
 * @param call - The active Stream call object.
 * @param context - A human-readable label for logging (e.g. "outgoing direct call abc123").
 * @param delayMs - How long to wait before checking (default: 2000ms).
 * @returns A promise that resolves with the health check result.
 */
export async function runPostJoinMediaHealthCheck(
  call: Call,
  context: string,
  delayMs: number = HEALTH_CHECK_DELAY_MS,
): Promise<MediaHealthCheckResult> {
  // Wait for SDK state to stabilize after join
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));

  const micState = call.microphone?.state;
  const cameraState = call.camera?.state;

  // Determine intended vs actual mic state
  const micActualStatus = String(micState?.status ?? "unknown");
  const micOptimisticStatus = micState?.optimisticStatus; // 'enabled' | 'disabled' | undefined
  // If optimisticStatus is "enabled", the user intends the mic to be on
  const micIntendedEnabled = micOptimisticStatus === "enabled";

  const cameraActualStatus = String(cameraState?.status ?? "unknown");
  const cameraOptimisticStatus = cameraState?.optimisticStatus;
  const cameraIntendedEnabled = cameraOptimisticStatus === "enabled";

  console.info(`${TAG} [${context}] Post-join health check starting`, {
    micIntendedEnabled,
    micActualStatus,
    micOptimisticStatus,
    cameraIntendedEnabled,
    cameraActualStatus,
  });

  let micRecovered = false;
  let micRecoveryAttempts = 0;

  // Check if mic is in a desync state: UI says unmuted but track isn't actually enabled/publishing
  if (micIntendedEnabled && !isMicActuallyPublishing(micActualStatus)) {
    console.warn(
      `${TAG} [${context}] MIC DESYNC DETECTED — UI says unmuted but actual status is "${micActualStatus}". Attempting recovery.`,
    );

    for (let attempt = 1; attempt <= MAX_RECOVERY_ATTEMPTS; attempt++) {
      micRecoveryAttempts = attempt;
      try {
        // Force disable then re-enable to trigger a real publish cycle
        console.info(
          `${TAG} [${context}] Recovery attempt ${attempt}/${MAX_RECOVERY_ATTEMPTS}: disabling mic...`,
        );
        await call.microphone.disable();

        // Brief pause to let the SDK fully tear down the old track
        await new Promise<void>((resolve) => setTimeout(resolve, 300));

        console.info(
          `${TAG} [${context}] Recovery attempt ${attempt}/${MAX_RECOVERY_ATTEMPTS}: re-enabling mic...`,
        );
        await call.microphone.enable();

        // Wait for the new track to publish
        await new Promise<void>((resolve) =>
          setTimeout(resolve, RECOVERY_RETRY_DELAY_MS),
        );

        const newStatus = String(call.microphone?.state?.status ?? "unknown");
        console.info(
          `${TAG} [${context}] Recovery attempt ${attempt} result: mic status is now "${newStatus}"`,
        );

        if (isMicActuallyPublishing(newStatus)) {
          micRecovered = true;
          console.info(
            `${TAG} [${context}] MIC RECOVERY SUCCESSFUL on attempt ${attempt}.`,
          );
          break;
        }
      } catch (err) {
        console.warn(
          `${TAG} [${context}] Recovery attempt ${attempt} failed:`,
          err,
        );
      }
    }

    if (!micRecovered) {
      console.error(
        `${TAG} [${context}] MIC RECOVERY FAILED after ${MAX_RECOVERY_ATTEMPTS} attempts. User will need to manually toggle mute.`,
      );
    }
  } else if (micIntendedEnabled) {
    console.info(
      `${TAG} [${context}] Mic health check PASSED — mic is publishing as intended.`,
    );
  } else {
    console.info(
      `${TAG} [${context}] Mic intended muted — no recovery needed.`,
    );
  }

  const result: MediaHealthCheckResult = {
    micIntendedEnabled,
    micActualStatus,
    micRecovered,
    micRecoveryAttempts,
    cameraIntendedEnabled,
    cameraActualStatus,
  };

  console.info(`${TAG} [${context}] Health check complete:`, result);
  return result;
}

/**
 * Determines whether the mic status string indicates actual publishing.
 *
 * The Stream SDK reports status as "enabled", "disabled", "undefined", etc.
 * On RN, the mic status comes from the SFU track state. "enabled" means the
 * track is published and active.
 */
function isMicActuallyPublishing(status: string): boolean {
  // The SDK uses "enabled" when the track is live and publishing.
  // Anything else ("disabled", "undefined", "unknown", etc.) means it's not.
  return status === "enabled" || status === "true" || status === (true as any);
}

/**
 * Schedule a background health check that won't block the caller.
 * Swallows all errors so it's safe to call fire-and-forget.
 */
export function schedulePostJoinMediaHealthCheck(
  call: Call,
  context: string,
  delayMs?: number,
): void {
  runPostJoinMediaHealthCheck(call, context, delayMs).catch((err) => {
    console.warn(`${TAG} [${context}] Health check failed unexpectedly:`, err);
  });
}
