/**
 * Battery Optimization Handler - Web Stub
 * This is a no-op stub for web platform.
 */

export const batteryOptimizationHandler = {
  initialize: async () => {
    console.warn("[batteryOptimizationHandler] Not available on web");
  },
  cleanup: async () => {},
  requestIgnoreBatteryOptimizations: async () => false,
  checkBatteryOptimizationStatus: async () => ({
    isIgnoringOptimizations: true,
  }),
};
