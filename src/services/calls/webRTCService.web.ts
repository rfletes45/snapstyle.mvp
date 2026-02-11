import { createLogger } from "@/utils/log";
const logger = createLogger("services/calls/webRTCService.web");
/**
 * WebRTC Service - Web Stub
 * This is a no-op stub for web platform where WebRTC native modules aren't available.
 */

// Export empty/stub implementations
export const webRTCService = {
  initialize: async () => {
    logger.warn("[webRTCService] Not available on web");
  },
  cleanup: async () => {},
  createLocalStream: async () => null,
  createPeerConnection: async () => null,
  createOffer: async () => null,
  createAnswer: async () => null,
  setLocalDescription: async () => {},
  setRemoteDescription: async () => {},
  addIceCandidate: async () => {},
  closeConnection: async () => {},
  toggleMute: () => {},
  toggleVideo: () => {},
  switchCamera: async () => {},
};
