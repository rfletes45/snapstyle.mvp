/**
 * Concurrent Call Manager - Web Stub
 * This is a no-op stub for web platform.
 */

export const concurrentCallManager = {
  initialize: async () => {
    console.warn("[concurrentCallManager] Not available on web");
  },
  cleanup: async () => {},
  addCall: async () => {},
  removeCall: async () => {},
  switchCall: async () => {},
  getActiveCalls: () => [],
  mergeCall: async () => {},
};
