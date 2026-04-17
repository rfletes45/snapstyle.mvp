/**
 * Call Media Health Check
 *
 * Post-join verification and self-healing for microphone publish state.
 *
 * The important distinction here is "microphone enabled" versus "audio track
 * published to the SFU". Stream's device manager can optimistically report an
 * enabled microphone, and subsequent enable() calls can no-op, while the local
 * participant still has no AUDIO entry in publishedTracks. Remote users then
 * truthfully see the participant as muted and hear nothing.
 */

import { hasAudio, OwnCapability, SfuModels } from "@stream-io/video-client";
import type { Call } from "@stream-io/video-react-native-sdk";

const TAG = "[CallMediaHealthCheck]";

const HEALTH_CHECK_DELAY_MS = 2000;
const RECOVERY_RETRY_DELAY_MS = 900;
const DIRECT_REPUBLISH_SETTLE_MS = 500;
const FORCE_RESTART_SETTLE_MS = 350;

export interface MicrophonePublishSnapshot {
  micIntendedEnabled: boolean;
  micActualStatus: string;
  micOptimisticStatus: string;
  canSendAudio: boolean;
  localPublishedAudio: boolean;
  publishedTracks: unknown[];
  hasMediaStream: boolean;
  hasLiveAudioTrack: boolean;
  healthy: boolean;
}

export interface EnsureMicrophonePublishingOptions {
  settleMs?: number;
  recoveryAttempts?: number;
  forceEnable?: boolean;
}

export interface MediaHealthCheckResult extends MicrophonePublishSnapshot {
  micRecovered: boolean;
  micRecoveryAttempts: number;
  cameraIntendedEnabled: boolean;
  cameraActualStatus: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAudioTracks(mediaStream: unknown): MediaStreamTrack[] {
  const stream = mediaStream as { getAudioTracks?: () => MediaStreamTrack[] };
  return stream?.getAudioTracks?.() ?? [];
}

function getMicrophoneMediaStream(call: Call): MediaStream | undefined {
  return call.microphone?.state?.mediaStream as MediaStream | undefined;
}

export function getMicrophonePublishSnapshot(
  call: Call,
): MicrophonePublishSnapshot {
  const micState = call.microphone?.state;
  const localParticipant = call.state.localParticipant;
  const mediaStream = getMicrophoneMediaStream(call);
  const audioTracks = getAudioTracks(mediaStream);
  const micActualStatus = String(micState?.status ?? "unknown");
  const micOptimisticStatus = String(micState?.optimisticStatus ?? "unknown");
  const micIntendedEnabled = micState?.optimisticStatus === "enabled";
  const canSendAudio = !!call.state.ownCapabilities?.includes(
    OwnCapability.SEND_AUDIO,
  );
  const localPublishedAudio = localParticipant ? hasAudio(localParticipant) : false;
  const publishedTracks = [...(localParticipant?.publishedTracks ?? [])];
  const hasMediaStream = !!mediaStream;
  const hasLiveAudioTrack = audioTracks.some(
    (track) => track.readyState === "live" && track.enabled !== false,
  );

  return {
    micIntendedEnabled,
    micActualStatus,
    micOptimisticStatus,
    canSendAudio,
    localPublishedAudio,
    publishedTracks,
    hasMediaStream,
    hasLiveAudioTrack,
    healthy:
      canSendAudio &&
      micActualStatus === "enabled" &&
      hasLiveAudioTrack &&
      localPublishedAudio,
  };
}

async function waitForSettledDeviceState(call: Call): Promise<void> {
  try {
    await call.microphone?.statusChangeSettled?.();
  } catch (err) {
    console.warn(`${TAG} microphone status settle wait failed:`, err);
  }
}

async function tryDirectAudioRepublish(
  call: Call,
  context: string,
): Promise<boolean> {
  const mediaStream = getMicrophoneMediaStream(call);
  if (!mediaStream || getAudioTracks(mediaStream).length === 0) return false;

  try {
    console.warn(
      `${TAG} [${context}] Mic is enabled but audio is not published. Republish attempt starting.`,
    );
    await call.publish(mediaStream, SfuModels.TrackType.AUDIO);
    await delay(DIRECT_REPUBLISH_SETTLE_MS);
    return true;
  } catch (err) {
    console.warn(`${TAG} [${context}] Direct audio republish failed:`, err);
    return false;
  }
}

async function forceMicrophoneRestart(
  call: Call,
  context: string,
  attempt: number,
  maxAttempts: number,
): Promise<void> {
  console.warn(
    `${TAG} [${context}] Mic publish recovery ${attempt}/${maxAttempts}: restarting capture and publish.`,
  );
  await call.microphone.disable({ forceStop: true });
  await delay(FORCE_RESTART_SETTLE_MS);
  await call.microphone.enable();
  await waitForSettledDeviceState(call);
  await delay(RECOVERY_RETRY_DELAY_MS);
}

export async function ensureMicrophonePublishing(
  call: Call,
  context: string,
  options: EnsureMicrophonePublishingOptions = {},
): Promise<MicrophonePublishSnapshot & {
  recovered: boolean;
  recoveryAttempts: number;
}> {
  const settleMs = options.settleMs ?? 0;
  const recoveryAttempts = options.recoveryAttempts ?? 2;
  if (settleMs > 0) await delay(settleMs);

  let snapshot = getMicrophonePublishSnapshot(call);
  console.info(`${TAG} [${context}] Mic publish snapshot:`, snapshot);

  if (!snapshot.micIntendedEnabled) {
    if (!options.forceEnable) {
      return { ...snapshot, recovered: false, recoveryAttempts: 0 };
    }

    try {
      console.info(
        `${TAG} [${context}] Microphone is not requested enabled. Enabling for join/setup path.`,
      );
      await call.microphone.enable();
      await waitForSettledDeviceState(call);
      await delay(RECOVERY_RETRY_DELAY_MS);
      snapshot = getMicrophonePublishSnapshot(call);
    } catch (err) {
      console.warn(`${TAG} [${context}] Forced microphone enable failed:`, err);
    }
  }

  if (!snapshot.canSendAudio) {
    console.error(
      `${TAG} [${context}] Current user does not have send-audio capability.`,
      snapshot,
    );
    return { ...snapshot, recovered: false, recoveryAttempts: 0 };
  }

  if (snapshot.healthy) {
    return { ...snapshot, recovered: false, recoveryAttempts: 0 };
  }

  let recovered = false;
  let attemptsUsed = 0;

  if (
    snapshot.micActualStatus === "enabled" &&
    snapshot.hasMediaStream &&
    snapshot.hasLiveAudioTrack &&
    !snapshot.localPublishedAudio
  ) {
    const republishAttempted = await tryDirectAudioRepublish(call, context);
    if (republishAttempted) {
      snapshot = getMicrophonePublishSnapshot(call);
      recovered = snapshot.healthy;
      if (recovered) {
        console.info(`${TAG} [${context}] Audio republish restored mic publish.`);
        return { ...snapshot, recovered, recoveryAttempts: attemptsUsed };
      }
    }
  }

  for (let attempt = 1; attempt <= recoveryAttempts; attempt++) {
    attemptsUsed = attempt;
    try {
      await forceMicrophoneRestart(call, context, attempt, recoveryAttempts);
    } catch (err) {
      console.warn(
        `${TAG} [${context}] Mic restart attempt ${attempt} failed:`,
        err,
      );
    }

    snapshot = getMicrophonePublishSnapshot(call);
    console.info(
      `${TAG} [${context}] Mic publish snapshot after recovery ${attempt}:`,
      snapshot,
    );
    if (snapshot.healthy) {
      recovered = true;
      break;
    }
  }

  if (!snapshot.healthy) {
    console.error(
      `${TAG} [${context}] Mic publish recovery failed. Remote participants will see this user as muted until audio publishes.`,
      snapshot,
    );
  }

  return { ...snapshot, recovered, recoveryAttempts: attemptsUsed };
}

export async function runPostJoinMediaHealthCheck(
  call: Call,
  context: string,
  delayMs: number = HEALTH_CHECK_DELAY_MS,
): Promise<MediaHealthCheckResult> {
  await delay(delayMs);

  const cameraState = call.camera?.state;
  const cameraActualStatus = String(cameraState?.status ?? "unknown");
  const cameraIntendedEnabled = cameraState?.optimisticStatus === "enabled";

  const micResult = await ensureMicrophonePublishing(call, context, {
    settleMs: 0,
    recoveryAttempts: 2,
  });

  const result: MediaHealthCheckResult = {
    micIntendedEnabled: micResult.micIntendedEnabled,
    micActualStatus: micResult.micActualStatus,
    micOptimisticStatus: micResult.micOptimisticStatus,
    canSendAudio: micResult.canSendAudio,
    localPublishedAudio: micResult.localPublishedAudio,
    publishedTracks: micResult.publishedTracks,
    hasMediaStream: micResult.hasMediaStream,
    hasLiveAudioTrack: micResult.hasLiveAudioTrack,
    healthy: micResult.healthy,
    micRecovered: micResult.recovered,
    micRecoveryAttempts: micResult.recoveryAttempts,
    cameraIntendedEnabled,
    cameraActualStatus,
  };

  console.info(`${TAG} [${context}] Health check complete:`, result);
  return result;
}

export function schedulePostJoinMediaHealthCheck(
  call: Call,
  context: string,
  delayMs?: number,
): void {
  runPostJoinMediaHealthCheck(call, context, delayMs).catch((err) => {
    console.warn(`${TAG} [${context}] Health check failed unexpectedly:`, err);
  });
}
