/**
 * Stream Video Services
 *
 * Central exports for the Stream-based call system.
 */

export {
  destroyStreamClient,
  getStreamClient,
  getStreamClientOrNull,
  initStreamClient,
} from "./streamClient";

export {
  clearTokenCache,
  fetchStreamToken,
  getCachedApiKey,
  streamTokenProvider,
} from "./streamTokenProvider";

export {
  acceptDirectCall,
  endDirectCall,
  rejectDirectCall,
  startDirectCall,
} from "./directCallService";

export {
  getVoiceChannelId,
  joinVoiceChannel,
  leaveVoiceChannel,
  queryVoiceChannel,
} from "./voiceChannelService";

export {
  getStreamCallHistory,
  getStreamCallHistoryEntryById,
  subscribeToStreamCallHistory,
} from "./streamCallHistoryService";

export { ensureStreamUsersExist } from "./streamUserProvisioning";

export {
  sanitizeSettingsOverride,
  validateParticipantIds,
} from "./callSettingsValidator";

export {
  reanchorAudioEndpoint,
  requestCallPermissions,
  startCallAudioSession,
  stopCallAudioSession,
} from "./callSessionManager";

export {
  ensureMicrophonePublishing,
  forceRefreshMicrophoneCapture,
  getMicrophonePublishSnapshot,
  runPostJoinMediaHealthCheck,
  schedulePostJoinMediaHealthCheck,
} from "./callMediaHealthCheck";
