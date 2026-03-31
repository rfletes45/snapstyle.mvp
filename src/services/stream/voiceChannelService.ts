/**
 * Voice Channel Service
 *
 * Handles Discord-style voice channels using Stream Video.
 * Voice channels are non-ringing, joinable audio rooms tied to group IDs.
 *
 * Key behaviors:
 * - Deterministic channel IDs: `voice_channel_{groupId}`
 * - No ringing — users join/leave freely
 * - Audio-only by default (camera disabled via settings_override)
 * - Persistent room identity (room exists as a join target even when empty)
 * - Real-time participant/occupancy updates via Stream
 *
 * Uses the "default" call type rather than "audio_room" because:
 * - "audio_room" enables backstage by default and restricts SEND_AUDIO to hosts
 * - "default" grants send-audio to all participants with no backstage gate
 * - This matches a Discord-style free-talk model, not a Clubhouse-style moderated room
 */

import { callSettingsService } from "@/services/calls";
import type { Call } from "@stream-io/video-react-native-sdk";
import { getStreamClient } from "./streamClient";
import { ensureStreamUsersExist } from "./streamUserProvisioning";
import { toStreamDevice } from "./streamUtils";

/**
 * Stream call type for voice channels.
 * Uses "default" type — all participants can send audio without
 * host approval.  ("audio_room" restricts SEND_AUDIO to hosts and
 * requires goLive(), which is not what Discord-style channels want.)
 */
const VOICE_CHANNEL_TYPE = "default";

/**
 * Generate a deterministic voice channel ID for a group.
 */
export function getVoiceChannelId(groupId: string): string {
  return `voice_channel_${groupId}`;
}

/**
 * Join (or create) a voice channel for a group.
 *
 * If the channel doesn't exist yet, it is created.
 * If it already exists, the user simply joins.
 * No ringing occurs.
 *
 * @param groupId   The group/chat ID
 * @param groupName Display name for the channel
 * @param userId    The current user's ID (for Stream user provisioning)
 * @returns The Stream Call object
 */
export async function joinVoiceChannel(
  groupId: string,
  groupName: string,
  userId?: string,
): Promise<Call> {
  const client = getStreamClient();
  const channelId = getVoiceChannelId(groupId);

  // Ensure the joining user exists in Stream with up-to-date profile data.
  // Without this, participants show as "Participant" with a generic avatar.
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

  const call = client.call(VOICE_CHANNEL_TYPE, channelId);
  const config = callSettingsService.getCallConfig();

  // getOrCreate will create if missing, or return existing.
  // settings_override MUST go here (creation time), NOT in call.join().
  //
  // CRITICAL: When overriding ANY field in the video settings object,
  // Stream's API stores the ENTIRE video override as-is. Fields not
  // included (like target_resolution) fall back to {0, 0} internally,
  // which fails the API's own validation (min 240×240) during join().
  //
  // Fix: Disable video entirely for voice channels AND provide a valid
  // target_resolution as a safety net. This ensures:
  //   1. The SDK never attempts video negotiation for this call
  //   2. If the API still validates target_resolution, it passes
  //   3. Camera hardware is never touched (no iOS indicator)
  try {
    await call.getOrCreate({
      data: {
        custom: {
          groupId,
          groupName,
        },
        settings_override: {
          audio: {
            mic_default_on: true,
            default_device: toStreamDevice(config.audio.defaultOutput),
          },
          video: {
            enabled: false,
            camera_default_on: false,
            // Safety net: provide valid target_resolution so partial video
            // overrides never fail Stream's validation (min 240×240).
            target_resolution: { width: 1280, height: 720, bitrate: 3000000 },
          },
        },
      },
    });
  } catch (err: any) {
    console.error("[VoiceChannelService] getOrCreate failed:", err);
    throw new Error(
      `Unable to open voice channel: ${err?.message ?? "unknown error"}`,
    );
  }

  // Join without settings_override — settings were applied at creation.
  // camera_default_on: false in settings_override ensures the SDK will
  // NOT call camera.enable() after join, so camera hardware stays untouched.
  try {
    await call.join({ create: false });
  } catch (err: any) {
    console.error("[VoiceChannelService] join failed:", err);
    throw new Error(
      `Unable to join voice channel: ${err?.message ?? "unknown error"}`,
    );
  }

  // Do NOT call call.camera.disable() here — that touches the camera
  // hardware layer on iOS, activating the camera indicator even to turn
  // it off. The settings_override keeps it off without any hardware access.

  return call;
}

/**
 * Leave a voice channel. Does NOT end the channel for others.
 */
export async function leaveVoiceChannel(call: Call): Promise<void> {
  await call.leave();
}

/**
 * Query participant/occupancy info for a voice channel without joining.
 * Useful for showing who's in the channel from the group UI.
 *
 * IMPORTANT: Uses the raw HTTP API (client.streamClient.post) instead of
 * client.queryCalls() because queryCalls() creates Call objects that
 * initialize camera/mic device managers via applyDeviceConfig(). On iOS
 * this triggers the camera indicator even for read-only queries.
 * The raw API returns plain JSON — no Call objects, no device setup.
 *
 * @param groupId The group ID
 * @returns Lightweight occupancy data or null if the channel doesn't exist
 */
export async function queryVoiceChannel(groupId: string): Promise<{
  state: {
    participants: Array<{
      userId: string;
      name?: string;
      image?: string;
    }>;
  };
} | null> {
  const client = getStreamClient();
  if (!client) return null;
  const channelId = getVoiceChannelId(groupId);

  try {
    // Use the raw HTTP client to query calls without creating Call objects.
    // The coordinator endpoint POST /calls accepts the same filter format.
    const response = await client.streamClient.post<{
      calls: Array<{
        call: {
          session?: {
            participants?: Array<{
              user?: { id?: string; name?: string; image?: string };
              user_session_id?: string;
            }>;
          };
        };
      }>;
    }>("/calls", {
      filter_conditions: {
        cid: `${VOICE_CHANNEL_TYPE}:${channelId}`,
      },
      limit: 1,
    });

    if (!response.calls || response.calls.length === 0) {
      return null;
    }

    const callData = response.calls[0];
    const session = callData.call?.session;
    const participants =
      session?.participants?.map((p) => ({
        userId: p.user?.id ?? p.user_session_id ?? "",
        name: p.user?.name ?? p.user?.id ?? "",
        image: p.user?.image ?? undefined,
      })) ?? [];

    // Only return as "active" if there are actual participants
    if (participants.length === 0) {
      return null;
    }

    return { state: { participants } };
  } catch (err: any) {
    // Channel doesn't exist yet — that's fine
    if (
      err?.message?.includes("not found") ||
      err?.status === 404 ||
      err?.message?.includes("was not found")
    ) {
      return null;
    }
    // Swallow unexpected errors — occupancy queries should never block
    console.warn(
      "[VoiceChannelService] queryVoiceChannel failed:",
      err?.message,
    );
    return null;
  }
}
