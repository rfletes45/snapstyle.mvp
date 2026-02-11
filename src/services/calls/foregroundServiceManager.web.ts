import { createLogger } from "@/utils/log";
const logger = createLogger("services/calls/foregroundServiceManager.web");
/**
 * Foreground Service Manager - Web Stub
 * This is a no-op stub for web platform.
 */

export const foregroundServiceManager = {
  initialize: async () => {
    logger.warn("[foregroundServiceManager] Not available on web");
  },
  cleanup: async () => {},
  startForegroundService: async () => {},
  stopForegroundService: async () => {},
  updateNotification: async () => {},
};
