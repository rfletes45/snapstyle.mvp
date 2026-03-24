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
  buildDirectCallEntry,
  buildVoiceRoomEntry,
  clearAllStreamCallHistory,
  deleteCallHistoryEntry,
  getStreamCallHistory,
  recordCallHistory,
  subscribeToStreamCallHistory,
  updateCallHistory,
} from "./streamCallHistoryService";
