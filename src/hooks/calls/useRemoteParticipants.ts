/**
 * useRemoteParticipants - Hook for managing remote participant streams
 */

import { useCallContext } from "@/contexts/CallContext";
import { getAuthInstance } from "@/services/firebase";
import { AvatarConfig } from "@/types/models";
import { useMemo } from "react";

// Use 'any' type for MediaStream to avoid importing react-native-webrtc
type MediaStreamType = any;

export interface RemoteParticipantInfo {
  odId: string;
  displayName: string;
  avatarConfig?: AvatarConfig;
  stream: MediaStreamType | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  connectionState: string;
}

export interface UseRemoteParticipantsReturn {
  participants: RemoteParticipantInfo[];
  getParticipantStream: (odId: string) => MediaStreamType | undefined;
  participantCount: number;
}

export function useRemoteParticipants(): UseRemoteParticipantsReturn {
  const { currentCall, remoteStreams } = useCallContext();

  // Build participant info with streams
  // Remote = everyone except the current (local) user
  const participants = useMemo((): RemoteParticipantInfo[] => {
    if (!currentCall) return [];

    const currentUserId = getAuthInstance().currentUser?.uid;

    return Object.values(currentCall.participants)
      .filter((p) => p.odId !== currentUserId)
      .map((participant) => ({
        odId: participant.odId,
        displayName: participant.displayName,
        avatarConfig: participant.avatarConfig,
        stream: remoteStreams.get(participant.odId) || null,
        isMuted: participant.isMuted,
        isVideoEnabled: participant.isVideoEnabled,
        connectionState: participant.connectionState,
      }));
  }, [currentCall, remoteStreams]);

  // Get stream for specific participant
  const getParticipantStream = (odId: string): MediaStream | undefined => {
    return remoteStreams.get(odId);
  };

  const participantCount = participants.length;

  return {
    participants,
    getParticipantStream,
    participantCount,
  };
}
