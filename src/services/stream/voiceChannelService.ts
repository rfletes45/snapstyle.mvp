/**
 * Voice Channel Service
 *
 * Handles Discord-style shared voice rooms using Stream's `default` call type.
 * The app intentionally does not use `audio_room`, because Stream documents
 * `audio_room` as a backstage / request-to-speak flow rather than an open huddle.
 */

import type { Call } from "@stream-io/video-react-native-sdk";
import {
  forceRefreshMicrophoneCapture,
  schedulePostJoinMediaHealthCheck,
} from "./callMediaHealthCheck";
import {
  applyCallMediaPreferences,
  applyCallReconnectPolicy,
  joinCallWithRetry,
} from "./callRuntime";
import {
  reanchorAudioEndpoint,
  requestCallPermissions,
  startCallAudioSession,
  stopCallAudioSession,
} from "./callSessionManager";
import { sanitizeSettingsOverride } from "./callSettingsValidator";
import { getStreamClient } from "./streamClient";
import { ensureStreamUsersExist } from "./streamUserProvisioning";
import { getVoiceChannelId } from "./voiceChannelIds";

const VOICE_CHANNEL_TYPE = "default";
export { getVoiceChannelId } from "./voiceChannelIds";

const TAG = "[VoiceChannelService]";

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the most useful diagnostic string from a Stream SDK error.
 *
 * The SDK's `ErrorFromResponse` carries `code`, `status`, and the full Axios
 * `response` (including `response.data.message`, `response.data.more_info`,
 * and `response.data.details`). A bare `new Error(err.message)` loses all of
 * that. This helper preserves the critical bits in a single loggable string.
 */
function extractStreamErrorDetail(err: any): {
  /** Human-readable summary suitable for the user-facing toast / banner */
  userMessage: string;
  /** Verbose detail string written to the console for remote debugging */
  debugDetail: string;
} {
  const code: number | null = err?.code ?? err?.response?.data?.code ?? null;
  const status: number | null = err?.status ?? err?.response?.status ?? null;
  const apiMessage: string =
    err?.response?.data?.message ?? err?.message ?? "unknown error";
  const moreInfo: string = err?.response?.data?.more_info ?? "";
  const details: unknown = err?.response?.data?.details ?? null;
  const unrecoverable: boolean = err?.unrecoverable === true;

  const debugParts = [
    `message=${JSON.stringify(apiMessage)}`,
    code != null ? `code=${code}` : null,
    status != null ? `httpStatus=${status}` : null,
    moreInfo ? `more_info=${moreInfo}` : null,
    details ? `details=${JSON.stringify(details)}` : null,
    unrecoverable ? "unrecoverable=true" : null,
  ].filter(Boolean);

  return {
    userMessage: apiMessage,
    debugDetail: debugParts.join(", "),
  };
}

async function ensureVoiceChannelMembership(
  call: Call,
  userId?: string,
): Promise<void> {
  if (!userId) return;

  try {
    await call.updateCallMembers({
      update_members: [{ user_id: userId }],
    });
  } catch (err) {
    console.warn(
      `${TAG} Could not upsert current user as room member (non-fatal):`,
      err,
    );
  }
}

// ---------------------------------------------------------------------------
// Settings override for voice channels
// ---------------------------------------------------------------------------

function buildVoiceChannelSettingsOverride() {
  // Voice channels are audio-only. Do NOT include a `video` key here.
  // Stream's API defaults omitted target_resolution to {width:0, height:0}
  // when any video field is present, which fails validation (must be ≥ 240).
  return {
    audio: {
      access_request_enabled: true,
      default_device: "speaker" as const,
      mic_default_on: true,
      speaker_default_on: true,
    },
  };
}

// ---------------------------------------------------------------------------
// getOrCreate with a single retry (strips settings_override on retry)
// ---------------------------------------------------------------------------

async function getOrCreateVoiceChannel(
  call: Call,
  userId: string | undefined,
  groupId: string,
  groupName: string,
): Promise<void> {
  const channelId = call.id;
  const baseData = {
    ...(userId ? { members: [{ user_id: userId }] } : {}),
    custom: { groupId, groupName },
  };

  // Run sanitizeSettingsOverride as a safety net — it will log warnings
  // if any future change introduces video.target_resolution values < 240.
  const settingsOverride = buildVoiceChannelSettingsOverride();
  sanitizeSettingsOverride(settingsOverride as any);

  console.info(
    `${TAG} getOrCreate payload for ${channelId}:`,
    JSON.stringify({
      custom: baseData.custom,
      hasMembers: !!baseData.members,
      settingsOverride,
    }),
  );

  // First attempt: full payload including settings_override
  try {
    await call.getOrCreate({
      data: {
        ...baseData,
        settings_override: settingsOverride,
      },
    });
    return; // success
  } catch (firstErr: any) {
    const { userMessage, debugDetail } = extractStreamErrorDetail(firstErr);
    console.error(
      `${TAG} getOrCreate FAILED (attempt 1/2) for ${channelId}:`,
      debugDetail,
    );
    console.error(
      `${TAG} settings_override sent:`,
      JSON.stringify(settingsOverride),
    );

    // If the error is specifically a validation / bad-request error (code 4),
    // retry once WITHOUT settings_override. This handles the case where the
    // Stream Dashboard call-type config rejects one of the overrides.
    // Use Number() to handle both string and numeric code values from the SDK.
    const errCode = firstErr?.code ?? firstErr?.response?.data?.code;
    if (Number(errCode) === 4) {
      console.warn(
        `${TAG} Retrying getOrCreate WITHOUT settings_override (code 4 = validation error)`,
      );
      try {
        await call.getOrCreate({ data: baseData });
        console.info(
          `${TAG} getOrCreate succeeded on retry (no settings_override) for ${channelId}`,
        );
        return; // success on retry
      } catch (retryErr: any) {
        const retryDetail = extractStreamErrorDetail(retryErr);
        console.error(
          `${TAG} getOrCreate FAILED (attempt 2/2) for ${channelId}:`,
          retryDetail.debugDetail,
        );
        // Fall through to throw the retry error
        throw Object.assign(
          new Error(`Unable to open voice channel: ${retryDetail.userMessage}`),
          { streamCode: retryErr?.code ?? null, stage: "getOrCreate" },
        );
      }
    }

    // Non-code-4 errors: throw immediately with full detail
    throw Object.assign(
      new Error(`Unable to open voice channel: ${userMessage}`),
      { streamCode: errCode ?? null, stage: "getOrCreate" },
    );
  }
}

// ---------------------------------------------------------------------------
// Main join
// ---------------------------------------------------------------------------

export async function joinVoiceChannel(
  groupId: string,
  groupName: string,
  userId?: string,
): Promise<Call> {
  // ── Input validation ────────────────────────────────────────────────
  if (!groupId || typeof groupId !== "string" || groupId.trim().length === 0) {
    const msg = `${TAG} joinVoiceChannel called with invalid groupId: ${JSON.stringify(groupId)}`;
    console.error(msg);
    throw new Error("Cannot join voice channel: missing group identifier.");
  }
  if (!groupName || typeof groupName !== "string") {
    // Non-fatal: default to a safe placeholder so the API call can proceed
    console.warn(
      `${TAG} groupName missing or invalid (${JSON.stringify(groupName)}), using fallback`,
    );
    groupName = "Voice Channel";
  }

  console.info(
    `${TAG} joinVoiceChannel starting — groupId=${groupId}, groupName=${JSON.stringify(groupName)}, userId=${userId ?? "none"}`,
  );

  // ── Stream client ───────────────────────────────────────────────────
  let client;
  try {
    client = getStreamClient();
  } catch (err: any) {
    console.error(`${TAG} Stream client not available:`, err);
    throw new Error("Call system not initialized. Please try again.");
  }

  const channelId = getVoiceChannelId(groupId);
  console.info(
    `${TAG} Resolved channelId=${channelId}, callType=${VOICE_CHANNEL_TYPE}`,
  );

  // ── User provisioning (best-effort) ─────────────────────────────────
  if (userId) {
    try {
      await ensureStreamUsersExist([userId]);
    } catch (err) {
      console.warn(`${TAG} User provisioning failed (non-fatal):`, err);
    }
  }

  // ── Microphone permission ───────────────────────────────────────────
  console.info(`${TAG} Requesting microphone permission...`);
  try {
    await requestCallPermissions({ microphone: true });
  } catch (err) {
    console.warn(`${TAG} Permission request failed before room join:`, err);
    throw err;
  }

  // ── getOrCreate (with retry) ────────────────────────────────────────
  const call = client.call(VOICE_CHANNEL_TYPE, channelId);

  console.info(`${TAG} Creating/getting voice channel ${channelId}...`);
  await getOrCreateVoiceChannel(call, userId, groupId, groupName);
  await ensureVoiceChannelMembership(call, userId);

  applyCallReconnectPolicy(call, `voice channel ${channelId}`);

  // ── Audio session ───────────────────────────────────────────────────
  console.info(`${TAG} Starting audio session...`);
  try {
    await startCallAudioSession("speaker");
    await delay(250);
  } catch (err) {
    console.warn(`${TAG} callManager.start failed:`, err);
  }

  // ── Join (with SDK-level retry) ─────────────────────────────────────
  console.info(`${TAG} Joining call...`);
  try {
    await joinCallWithRetry(
      call,
      { create: false },
      `voice channel ${channelId}`,
    );

    // ── Post-join mic refresh ──────────────────────────────────────
    // The SDK's join() internally calls callManager.start() which runs
    // native setup() → adm.reset(), disconnecting the already-published
    // mic track from the audio capture. We must force a full mic restart
    // to create a fresh capture chain.
    console.info(
      `${TAG} Joined successfully. Force-refreshing microphone capture...`,
    );
    reanchorAudioEndpoint("speaker");
    const micResult = await forceRefreshMicrophoneCapture(
      call,
      `voice channel ${channelId}`,
    );
    if (!micResult.healthy) {
      console.error(
        `${TAG} Microphone failed to publish after join:`,
        micResult,
      );
      throw new Error(
        "Microphone could not be started for this voice room. Leave and try again.",
      );
    }
    console.info(`${TAG} Microphone publish verified for ${channelId}`);
    applyCallMediaPreferences(call, `voice channel ${channelId}`);

    // Schedule post-join health check to catch silent mic failures
    schedulePostJoinMediaHealthCheck(call, `voice channel ${channelId}`);
  } catch (err: any) {
    // ── Cleanup on join failure ─────────────────────────────────────
    try {
      await call.leave({ reject: false });
    } catch {
      // Best-effort cleanup only.
    }
    await stopCallAudioSession();

    const { userMessage, debugDetail } = extractStreamErrorDetail(err);
    console.error(`${TAG} join failed:`, debugDetail);

    const message = err?.message ?? userMessage;
    if (message.includes("Microphone permission is required")) {
      throw new Error(message);
    }
    throw Object.assign(
      new Error(`Unable to join voice channel: ${userMessage}`),
      { streamCode: err?.code ?? null, stage: "join" },
    );
  }

  console.info(`${TAG} joinVoiceChannel complete for ${channelId}`);
  return call;
}

export async function leaveVoiceChannel(call: Call): Promise<void> {
  try {
    // Disable media tracks first so the server sees the user as
    // fully inactive before the leave signal. Without this, other
    // participants may still see the user as "present-but-muted" for
    // a short window after the leave.
    try {
      await call.microphone.disable();
    } catch {
      // mic may already be off
    }
    try {
      await call.camera.disable();
    } catch {
      // camera may already be off
    }

    await call.leave({ reject: false });
  } finally {
    await stopCallAudioSession();
  }
}

export type VoiceChannelQueryResult =
  | {
      status: "active";
      state: {
        participants: {
          userId: string;
          name?: string;
          image?: string;
        }[];
      };
    }
  | { status: "no_room" }
  | { status: "error"; message: string };

/**
 * Query participant/occupancy info for a voice channel without joining.
 *
 * Stream documents `queryCalls()` for discovery, but the current RN SDK applies
 * device config while materializing queried `Call` objects. For read-only room
 * occupancy we intentionally hit the same `/calls` endpoint through the low-level
 * client to avoid touching camera/microphone state on iOS.
 */
export async function queryVoiceChannel(
  groupId: string,
): Promise<VoiceChannelQueryResult> {
  const channelId = getVoiceChannelId(groupId);
  let client;

  try {
    client = getStreamClient();
  } catch (err: any) {
    return {
      status: "error",
      message: err?.message ?? "Stream client not initialized.",
    };
  }

  try {
    const response = await client.streamClient.post<{
      calls: {
        call: {
          session?: {
            participants?: {
              user?: { id?: string; name?: string; image?: string };
              user_session_id?: string;
            }[];
          };
        };
      }[];
    }>("/calls", {
      filter_conditions: {
        cid: `${VOICE_CHANNEL_TYPE}:${channelId}`,
        ongoing: true,
      },
      limit: 1,
    });

    if (!response.calls || response.calls.length === 0) {
      return { status: "no_room" };
    }

    const participants =
      response.calls[0].call.session?.participants?.map((participant) => ({
        userId: participant.user?.id ?? participant.user_session_id ?? "",
        name: participant.user?.name ?? participant.user?.id ?? "",
        image: participant.user?.image ?? undefined,
      })) ?? [];

    if (participants.length === 0) {
      return { status: "no_room" };
    }

    return { status: "active", state: { participants } };
  } catch (err: any) {
    if (
      err?.message?.includes("not found") ||
      err?.status === 404 ||
      err?.message?.includes("was not found")
    ) {
      return { status: "no_room" };
    }

    console.warn(
      "[VoiceChannelService] queryVoiceChannel failed:",
      err?.message,
    );
    return { status: "error", message: err?.message ?? "Unknown error" };
  }
}
