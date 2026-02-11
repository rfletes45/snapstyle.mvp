import { createLogger } from "@/utils/log";
const logger = createLogger("services/calls/voipPushService.web");
/**
 * VoIP Push Service - Web Stub
 * This is a no-op stub for web platform.
 */

export const voipPushService = {
  initialize: async () => {
    logger.warn("[voipPushService] Not available on web");
  },
  cleanup: async () => {},
  registerForPushNotifications: async () => {},
  handleIncomingPush: async () => {},
};
