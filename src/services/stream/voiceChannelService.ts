/**
 * Voice Channel Service
 *
 * Handles Discord-style shared voice rooms using Stream's `default` call type.
 * The app intentionally does not use `audio_room`, because Stream documents
 * `audio_room` as a backstage / request-to-speak flow rather than an open huddle.
 */

import type { Call } from "@stream-io/video-react-native-sdk";
import { schedulePostJoinMediaHealthCheck } from "./callMediaHealthCheck";
import {
  applyCallMediaPreferences,
  applyCallReconnectPolicy,
  joinCallWithRetry,
} from "./callRuntime";
import {
  requestCallPermissions,
  startCallAudioSession,
  stopCallAudioSession,
} from "./callSessionManager";
import { getStreamClient } from "./streamClient";
import { ensureStreamUsersExist } from "./streamUserProvisioning";
import { getVoiceChannelId } from "./voiceChannelIds";

const VOICE_CHANNEL_TYPE = "default";
export { getVoiceChannelId } from "./voiceChannelIds";

export async function joinVoiceChannel(
  groupId: string,
  groupName: string,
  userId?: string,
): Promise<Call> {
  const TAG = "[VoiceChannelService]";
  console.info(
    `${TAG} joinVoiceChannel starting — groupId=${groupId}, userId=${userId ?? "none"}`,
  );

  let client;
  try {
    client = getStreamClient();
  } catch (err: any) {
    console.error(`${TAG} Stream client not available:`, err);
    throw new Error("Call system not initialized. Please try again.");
  }

  const channelId = getVoiceChannelId(groupId);

  if (userId) {
    try {
      await ensureStreamUsersExist([userId]);
    } catch (err) {
      console.warn(`${TAG} User provisioning failed (non-fatal):`, err);
    }
  }

  console.info(`${TAG} Requesting microphone permission...`);
  try {
    await requestCallPermissions({ microphone: true });
  } catch (err) {
    console.warn(`${TAG} Permission request failed before room join:`, err);
    throw err;
  }

  const call = client.call(VOICE_CHANNEL_TYPE, channelId);

  console.info(`${TAG} Creating/getting voice channel ${channelId}...`);
  try {
    await call.getOrCreate({
      data: {
        custom: {
          groupId,
          groupName,
        },
      },
    });
  } catch (err: any) {
    console.error(`${TAG} getOrCreate failed:`, err);
    throw new Error(
      `Unable to open voice channel: ${err?.message ?? "unknown error"}`,
    );
  }

  applyCallReconnectPolicy(call, `voice channel ${channelId}`);

  console.info(`${TAG} Starting audio session...`);
  try {
    await startCallAudioSession("speaker");
  } catch (err) {
    console.warn(`${TAG} callManager.start failed:`, err);
  }

  console.info(`${TAG} Joining call...`);
  try {
    await joinCallWithRetry(
      call,
      { create: false },
      `voice channel ${channelId}`,
    );

    console.info(`${TAG} Joined successfully — enabling microphone...`);
    let micEnabled = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await call.microphone.enable();
        micEnabled = true;
        console.info(`${TAG} Microphone enable succeeded (attempt ${attempt})`);
        break;
      } catch (err) {
        console.warn(
          `${TAG} microphone.enable attempt ${attempt} failed:`,
          err,
        );
        if (attempt < 2) {
          await new Promise<void>((r) => setTimeout(r, 500));
        }
      }
    }
    if (!micEnabled) {
      console.error(
        `${TAG} Microphone enable failed after all attempts — user may have one-way audio`,
      );
    }

    applyCallMediaPreferences(call, `voice channel ${channelId}`);

    // Schedule post-join health check to catch silent mic failures
    schedulePostJoinMediaHealthCheck(call, `voice channel ${channelId}`);
  } catch (err: any) {
    await stopCallAudioSession();
    console.error(`${TAG} join failed:`, err);
    const message = err?.message ?? "unknown error";
    if (message.includes("Microphone permission is required")) {
      throw new Error(message);
    }
    throw new Error(`Unable to join voice channel: ${message}`);
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
