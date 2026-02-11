import { createLogger } from "@/utils/log";
const logger = createLogger("services/calls/callReconnectionService.web");
/**
 * Call Reconnection Service - Web Stub
 * This is a no-op stub for web platform.
 */

export const callReconnectionService = {
  initialize: async () => {
    logger.warn("[callReconnectionService] Not available on web");
  },
  cleanup: async () => {},
  startReconnection: async () => {},
  stopReconnection: async () => {},
  onReconnected: () => {},
  onReconnectionFailed: () => {},
};
