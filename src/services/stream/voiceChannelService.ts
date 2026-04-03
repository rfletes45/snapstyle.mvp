/**
 * Voice Channel Service
 *
 * Handles Discord-style shared voice rooms using Stream's `default` call type.
 * The app intentionally does not use `audio_room`, because Stream documents
 * `audio_room` as a backstage / request-to-speak flow rather than an open huddle.
 */

import type { Call } from "@stream-io/video-react-native-sdk";
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
  const client = getStreamClient();
  const channelId = getVoiceChannelId(groupId);

  if (userId) {
    try {
      await ensureStreamUsersExist([userId]);
    } catch (err) {
      console.warn(
        "[VoiceChannelService] User provisioning failed (non-fatal):",
        err,
      );
    }
  }

  await requestCallPermissions({ microphone: true });

  const call = client.call(VOICE_CHANNEL_TYPE, channelId);

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
    console.error("[VoiceChannelService] getOrCreate failed:", err);
    throw new Error(
      `Unable to open voice channel: ${err?.message ?? "unknown error"}`,
    );
  }

  try {
    await startCallAudioSession("speaker");
    console.log("[VoiceChannelService] callManager.start succeeded (speaker)");
  } catch (err) {
    console.warn("[VoiceChannelService] callManager.start failed:", err);
  }

  try {
    await call.join({ create: false });
    try {
      await call.microphone.enable();
    } catch (err) {
      console.warn("[VoiceChannelService] microphone.enable failed:", err);
    }
  } catch (err: any) {
    await stopCallAudioSession();
    console.error("[VoiceChannelService] join failed:", err);
    throw new Error(
      `Unable to join voice channel: ${err?.message ?? "unknown error"}`,
    );
  }

  return call;
}

export async function leaveVoiceChannel(call: Call): Promise<void> {
  try {
    await call.leave();
  } finally {
    await stopCallAudioSession();
  }
}

/**
 * Query participant/occupancy info for a voice channel without joining.
 *
 * Stream documents `queryCalls()` for discovery, but the current RN SDK applies
 * device config while materializing queried `Call` objects. For read-only room
 * occupancy we intentionally hit the same `/calls` endpoint through the low-level
 * client to avoid touching camera/microphone state on iOS.
 */
export async function queryVoiceChannel(groupId: string): Promise<{
  state: {
    participants: {
      userId: string;
      name?: string;
      image?: string;
    }[];
  };
} | null> {
  const client = getStreamClient();
  const channelId = getVoiceChannelId(groupId);

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
      return null;
    }

    const participants =
      response.calls[0].call.session?.participants?.map((participant) => ({
        userId: participant.user?.id ?? participant.user_session_id ?? "",
        name: participant.user?.name ?? participant.user?.id ?? "",
        image: participant.user?.image ?? undefined,
      })) ?? [];

    if (participants.length === 0) {
      return null;
    }

    return { state: { participants } };
  } catch (err: any) {
    if (
      err?.message?.includes("not found") ||
      err?.status === 404 ||
      err?.message?.includes("was not found")
    ) {
      return null;
    }

    console.warn(
      "[VoiceChannelService] queryVoiceChannel failed:",
      err?.message,
    );
    return null;
  }
}
