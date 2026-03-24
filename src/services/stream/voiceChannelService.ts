/**
 * Voice Channel Service
 *
 * Handles Discord-style voice channels using Stream Video.
 * Voice channels are non-ringing, joinable audio rooms tied to group IDs.
 *
 * Key behaviors:
 * - Deterministic channel IDs: `voice_channel_{groupId}`
 * - No ringing — users join/leave freely
 * - Audio-only by default
 * - Persistent room identity (room exists as a join target even when empty)
 * - Real-time participant/occupancy updates via Stream
 */

import type { Call } from "@stream-io/video-react-native-sdk";
import { getStreamClient } from "./streamClient";

/**
 * Stream call type for voice channels.
 * Uses "audio_room" type which is non-ringing, audio-only.
 */
const VOICE_CHANNEL_TYPE = "audio_room";

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
 * @returns The Stream Call object
 */
export async function joinVoiceChannel(
  groupId: string,
  groupName: string,
): Promise<Call> {
  const client = getStreamClient();
  const channelId = getVoiceChannelId(groupId);
  const call = client.call(VOICE_CHANNEL_TYPE, channelId);

  // getOrCreate will create if missing, or return existing
  await call.getOrCreate({
    data: {
      custom: {
        groupId,
        groupName,
      },
    },
  });

  // Join with mic on, no video, no ringing
  await call.join({
    create: false,
    data: {
      settings_override: {
        audio: { mic_default_on: true, default_device: "speaker" },
        video: { camera_default_on: false },
      },
    },
  });

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
 * @param groupId The group ID
 * @returns Call object with state (inspect call.state.participants)
 */
export async function queryVoiceChannel(groupId: string): Promise<Call | null> {
  const client = getStreamClient();
  const channelId = getVoiceChannelId(groupId);
  const call = client.call(VOICE_CHANNEL_TYPE, channelId);

  try {
    await call.get();
    return call;
  } catch (err: any) {
    // Channel doesn't exist yet — that's fine
    if (err?.message?.includes("not found") || err?.status === 404) {
      return null;
    }
    // Re-throw unexpected errors so callers can handle them
    throw err;
  }
}
