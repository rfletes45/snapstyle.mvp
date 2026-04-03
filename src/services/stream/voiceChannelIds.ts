/**
 * Shared voice-channel identifiers.
 *
 * Kept separate from the voice-room service so startup-safe UI code can derive
 * a channel ID without importing the Stream service layer.
 */

export function getVoiceChannelId(groupId: string): string {
  return `voice_channel_${groupId}`;
}
