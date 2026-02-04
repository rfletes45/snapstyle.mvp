/**
 * react-native-webrtc shim for web
 *
 * This module provides stub exports for react-native-webrtc
 * to prevent bundler errors on web platform.
 */

// Stub MediaStream class
export class MediaStream {
  id = "stub-stream";
  active = false;

  constructor() {
    console.warn("[react-native-webrtc shim] MediaStream not available on web");
  }

  getTracks() {
    return [];
  }
  getAudioTracks() {
    return [];
  }
  getVideoTracks() {
    return [];
  }
  addTrack() {}
  removeTrack() {}
  clone() {
    return new MediaStream();
  }
}

// Stub RTCPeerConnection class
export class RTCPeerConnection {
  constructor() {
    console.warn(
      "[react-native-webrtc shim] RTCPeerConnection not available on web",
    );
  }

  createOffer() {
    return Promise.resolve({});
  }
  createAnswer() {
    return Promise.resolve({});
  }
  setLocalDescription() {
    return Promise.resolve();
  }
  setRemoteDescription() {
    return Promise.resolve();
  }
  addIceCandidate() {
    return Promise.resolve();
  }
  addTrack() {}
  removeTrack() {}
  close() {}
  getStats() {
    return Promise.resolve([]);
  }

  get localDescription() {
    return null;
  }
  get remoteDescription() {
    return null;
  }
  get connectionState() {
    return "closed";
  }
  get iceConnectionState() {
    return "closed";
  }
  get signalingState() {
    return "closed";
  }
}

// Stub RTCSessionDescription
export class RTCSessionDescription {
  type = "";
  sdp = "";

  constructor(init) {
    if (init) {
      this.type = init.type || "";
      this.sdp = init.sdp || "";
    }
  }
}

// Stub RTCIceCandidate
export class RTCIceCandidate {
  candidate = "";
  sdpMid = "";
  sdpMLineIndex = 0;

  constructor(init) {
    if (init) {
      this.candidate = init.candidate || "";
      this.sdpMid = init.sdpMid || "";
      this.sdpMLineIndex = init.sdpMLineIndex || 0;
    }
  }
}

// Stub RTCView component
export const RTCView = ({ style }) => {
  // Return null - this should never render on web
  return null;
};

// Stub mediaDevices
export const mediaDevices = {
  getUserMedia: () => Promise.resolve(new MediaStream()),
  enumerateDevices: () => Promise.resolve([]),
};

// Stub registerGlobals
export function registerGlobals() {
  console.warn(
    "[react-native-webrtc shim] registerGlobals not available on web",
  );
}

// Default export
export default {
  MediaStream,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  RTCView,
  mediaDevices,
  registerGlobals,
};
