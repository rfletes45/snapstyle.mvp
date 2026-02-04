/**
 * VoIP Push Service - Web Stub
 * This is a no-op stub for web platform.
 */

export const voipPushService = {
  initialize: async () => {
    console.warn("[voipPushService] Not available on web");
  },
  cleanup: async () => {},
  registerForPushNotifications: async () => {},
  handleIncomingPush: async () => {},
};
