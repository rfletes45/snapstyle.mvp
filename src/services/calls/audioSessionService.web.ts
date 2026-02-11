import { createLogger } from "@/utils/log";
const logger = createLogger("services/calls/audioSessionService.web");
/**
 * Audio Session Service - Web Stub
 * This is a no-op stub for web platform.
 */

export const audioSessionService = {
  initialize: async () => {
    logger.warn("[audioSessionService] Not available on web");
  },
  cleanup: async () => {},
  setAudioRoute: async () => {},
  getAudioRoutes: async () => [],
  setAudioMode: async () => {},
};
