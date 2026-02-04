/**
 * useCall - Main hook for call functionality
 * Provides simplified API for call operations
 */

import { useCallback, useMemo } from "react";
import { useCallContext } from "../../contexts/CallContext";
import { CallType, StartCallParams } from "../../types/call";

export interface UseCallReturn {
  // State
  hasActiveCall: boolean;
  isRinging: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  callType: CallType | null;
  callDuration: number;

  // Actions
  startAudioCall: (
    conversationId: string,
    participantId: string,
  ) => Promise<string>;
  startVideoCall: (
    conversationId: string,
    participantId: string,
  ) => Promise<string>;
  startGroupCall: (
    conversationId: string,
    participantIds: string[],
    type: CallType,
  ) => Promise<string>;
  answerCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleVideo: () => void;
  switchCamera: () => Promise<void>;

  // Media state
  isMuted: boolean;
  isSpeakerOn: boolean;
  isVideoEnabled: boolean;
}

export function useCall(): UseCallReturn {
  const {
    currentCall,
    incomingCall,
    isConnecting,
    isConnected,
    isMuted,
    isSpeakerOn,
    isVideoEnabled,
    callDuration,
    startCall,
    answerCall: answerCallContext,
    declineCall: declineCallContext,
    endCall: endCallContext,
    toggleMute,
    toggleSpeaker,
    toggleVideo,
    switchCamera,
  } = useCallContext();

  // Derived state
  const hasActiveCall = useMemo(
    () => currentCall !== null || incomingCall !== null,
    [currentCall, incomingCall],
  );

  const isRinging = useMemo(
    () =>
      incomingCall?.status === "ringing" || currentCall?.status === "ringing",
    [incomingCall, currentCall],
  );

  const callType = useMemo(
    () => currentCall?.type || incomingCall?.type || null,
    [currentCall, incomingCall],
  );

  // Start 1:1 audio call
  const startAudioCall = useCallback(
    async (conversationId: string, participantId: string): Promise<string> => {
      const params: StartCallParams = {
        conversationId,
        participantIds: [participantId],
        type: "audio",
        scope: "dm",
      };
      return startCall(params);
    },
    [startCall],
  );

  // Start 1:1 video call
  const startVideoCall = useCallback(
    async (conversationId: string, participantId: string): Promise<string> => {
      const params: StartCallParams = {
        conversationId,
        participantIds: [participantId],
        type: "video",
        scope: "dm",
      };
      return startCall(params);
    },
    [startCall],
  );

  // Start group call
  const startGroupCall = useCallback(
    async (
      conversationId: string,
      participantIds: string[],
      type: CallType,
    ): Promise<string> => {
      const params: StartCallParams = {
        conversationId,
        participantIds,
        type,
        scope: "group",
      };
      return startCall(params);
    },
    [startCall],
  );

  // Answer incoming call
  const answerCall = useCallback(async (): Promise<void> => {
    if (incomingCall) {
      await answerCallContext(incomingCall.id);
    }
  }, [incomingCall, answerCallContext]);

  // Decline incoming call
  const declineCall = useCallback(async (): Promise<void> => {
    if (incomingCall) {
      await declineCallContext(incomingCall.id);
    }
  }, [incomingCall, declineCallContext]);

  // End current call
  const endCall = useCallback(async (): Promise<void> => {
    await endCallContext();
  }, [endCallContext]);

  return {
    // State
    hasActiveCall,
    isRinging,
    isConnecting,
    isConnected,
    callType,
    callDuration,

    // Actions
    startAudioCall,
    startVideoCall,
    startGroupCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    toggleVideo,
    switchCamera,

    // Media state
    isMuted,
    isSpeakerOn,
    isVideoEnabled,
  };
}
