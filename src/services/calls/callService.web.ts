import { createLogger } from "@/utils/log";
const logger = createLogger("services/calls/callService.web");
/**
 * Call Service - Web Stub
 * This is a no-op stub for web platform where native call modules aren't available.
 */

export const callService = {
  initialize: async () => {
    logger.warn("[callService] Not available on web");
  },
  cleanup: async () => {},
  startCall: async () => null,
  answerCall: async () => {},
  endCall: async () => {},
  rejectCall: async () => {},
  holdCall: async () => {},
  resumeCall: async () => {},
  muteCall: async () => {},
  unmuteCall: async () => {},
};
