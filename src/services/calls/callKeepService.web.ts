import { createLogger } from "@/utils/log";
const logger = createLogger("services/calls/callKeepService.web");
/**
 * CallKeep Service - Web Stub
 * This is a no-op stub for web platform where CallKeep isn't available.
 */

export const callKeepService = {
  initialize: async () => {
    logger.warn("[callKeepService] Not available on web");
  },
  cleanup: async () => {},
  displayIncomingCall: async () => {},
  reportCallEnded: async () => {},
  reportCallConnected: async () => {},
  reportCallHeld: async () => {},
  setCallActive: async () => {},
  endAllCalls: async () => {},
};
