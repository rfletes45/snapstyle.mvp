import { createLogger } from "@/utils/log";
const logger = createLogger("services/calls/concurrentCallManager.web");
/**
 * Concurrent Call Manager - Web Stub
 * This is a no-op stub for web platform.
 */

export const concurrentCallManager = {
  initialize: async () => {
    logger.warn("[concurrentCallManager] Not available on web");
  },
  cleanup: async () => {},
  addCall: async () => {},
  removeCall: async () => {},
  switchCall: async () => {},
  getActiveCalls: () => [],
  mergeCall: async () => {},
};
