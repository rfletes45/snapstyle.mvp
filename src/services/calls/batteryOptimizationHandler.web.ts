import { createLogger } from "@/utils/log";
const logger = createLogger("services/calls/batteryOptimizationHandler.web");
/**
 * Battery Optimization Handler - Web Stub
 * This is a no-op stub for web platform.
 */

export const batteryOptimizationHandler = {
  initialize: async () => {
    logger.warn("[batteryOptimizationHandler] Not available on web");
  },
  cleanup: async () => {},
  requestIgnoreBatteryOptimizations: async () => false,
  checkBatteryOptimizationStatus: async () => ({
    isIgnoringOptimizations: true,
  }),
};
