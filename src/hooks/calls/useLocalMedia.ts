/**
 * useLocalMedia - Hook for managing local media (camera/microphone)
 */

import { useMemo } from "react";
import { useCallContext } from "../../contexts/CallContext";

// Use 'any' type for MediaStream to avoid importing react-native-webrtc
// The actual type is provided by CallContext which handles platform checks
type MediaStreamType = any;

export interface UseLocalMediaReturn {
  // State
  localStream: MediaStreamType | null;
  hasAudio: boolean;
  hasVideo: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isFrontCamera: boolean;

  // Actions
  toggleMute: () => void;
  toggleVideo: () => void;
  switchCamera: () => Promise<void>;
}

export function useLocalMedia(): UseLocalMediaReturn {
  const {
    localStream,
    isMuted,
    isVideoEnabled,
    toggleMute,
    toggleVideo,
    switchCamera,
  } = useCallContext();

  // Check if we have audio/video tracks
  const hasAudio = useMemo(
    () => (localStream?.getAudioTracks().length ?? 0) > 0,
    [localStream],
  );

  const hasVideo = useMemo(
    () => (localStream?.getVideoTracks().length ?? 0) > 0,
    [localStream],
  );

  // Note: isFrontCamera state is managed in WebRTCService
  // For now, we'll assume front camera by default
  const isFrontCamera = true;

  return {
    localStream,
    hasAudio,
    hasVideo,
    isMuted,
    isVideoEnabled,
    isFrontCamera,
    toggleMute,
    toggleVideo,
    switchCamera,
  };
}
