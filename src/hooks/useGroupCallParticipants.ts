/**
 * useGroupCallParticipants - Hook for managing group call participants
 * Handles participant state, updates, and real-time sync
 */

import { doc, onSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { groupCallService } from "@/services/calls/groupCallService";
import { getFirestoreInstance } from "@/services/firebase";
import { Call, GroupCallParticipant, GroupCallRole } from "@/types/call";


import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/useGroupCallParticipants");
// Lazy getter to avoid Firebase initialization issues at module load time
const getDb = () => getFirestoreInstance();

interface UseGroupCallParticipantsOptions {
  callId: string | null;
  currentUserId: string | null;
}

interface UseGroupCallParticipantsReturn {
  // Participant lists
  participants: GroupCallParticipant[];
  activeParticipants: GroupCallParticipant[];
  participantsWithRaisedHands: GroupCallParticipant[];

  // Current user state
  isHost: boolean;
  isCoHost: boolean;
  canManageParticipants: boolean;
  currentUserParticipant: GroupCallParticipant | null;

  // Speaker/pin state
  activeSpeakerId: string | null;
  pinnedParticipantId: string | null;

  // Counts
  participantCount: number;
  activeParticipantCount: number;
  raisedHandCount: number;

  // Actions
  muteParticipant: (participantId: string, muted: boolean) => Promise<void>;
  removeParticipant: (participantId: string) => Promise<void>;
  promoteToCoHost: (participantId: string) => Promise<void>;
  demoteFromCoHost: (participantId: string) => Promise<void>;
  pinParticipant: (participantId: string | null) => Promise<void>;
  muteAll: () => Promise<void>;
  lowerAllHands: () => Promise<void>;

  // Loading state
  isLoading: boolean;
  error: string | null;
}

export function useGroupCallParticipants({
  callId,
  currentUserId,
}: UseGroupCallParticipantsOptions): UseGroupCallParticipantsReturn {
  const [call, setCall] = useState<Call | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to call updates
  useEffect(() => {
    if (!callId) {
      setCall(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      doc(getDb(), "Calls", callId),
      (snapshot) => {
        if (snapshot.exists()) {
          setCall(snapshot.data() as Call);
        } else {
          setCall(null);
          setError("Call not found");
        }
        setIsLoading(false);
      },
      (err) => {
        logger.error("[useGroupCallParticipants] Subscription error:", err);
        setError("Failed to subscribe to call updates");
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [callId]);

  // Derived participant data
  const participants = useMemo<GroupCallParticipant[]>(() => {
    if (!call?.participants) return [];
    return Object.values(call.participants) as GroupCallParticipant[];
  }, [call?.participants]);

  const activeParticipants = useMemo<GroupCallParticipant[]>(() => {
    return participants.filter((p) => p.joinedAt && !p.leftAt);
  }, [participants]);

  const participantsWithRaisedHands = useMemo<GroupCallParticipant[]>(() => {
    return activeParticipants
      .filter((p) => p.raisedHand)
      .sort((a, b) => (a.raisedHandAt || 0) - (b.raisedHandAt || 0));
  }, [activeParticipants]);

  const currentUserParticipant = useMemo<GroupCallParticipant | null>(() => {
    if (!currentUserId || !call?.participants) return null;
    return (call.participants[currentUserId] as GroupCallParticipant) || null;
  }, [currentUserId, call?.participants]);

  const isHost = useMemo(() => {
    if (!currentUserId || !call) return false;
    return call.hostId === currentUserId || call.callerId === currentUserId;
  }, [currentUserId, call]);

  const isCoHost = useMemo(() => {
    return currentUserParticipant?.role === "co-host";
  }, [currentUserParticipant]);

  const canManageParticipants = isHost || isCoHost;

  const activeSpeakerId = call?.activeSpeakerId || null;
  const pinnedParticipantId = call?.pinnedParticipantId || null;

  // Counts
  const participantCount = participants.length;
  const activeParticipantCount = activeParticipants.length;
  const raisedHandCount = participantsWithRaisedHands.length;

  // Actions
  const muteParticipant = useCallback(
    async (participantId: string, muted: boolean) => {
      if (!callId || !canManageParticipants) return;

      try {
        const docRef = doc(getDb(), "Calls", callId);
        // This could be moved to groupCallService for better encapsulation
        const { updateDoc } = await import("firebase/firestore");
        await updateDoc(docRef, {
          [`participants.${participantId}.isMuted`]: muted,
        });
      } catch (err) {
        logger.error(
          "[useGroupCallParticipants] Failed to mute participant:",
          err,
        );
        throw err;
      }
    },
    [callId, canManageParticipants],
  );

  const removeParticipant = useCallback(
    async (participantId: string) => {
      if (!callId || !canManageParticipants) return;
      await groupCallService.removeParticipant(callId, participantId);
    },
    [callId, canManageParticipants],
  );

  const promoteToCoHost = useCallback(
    async (participantId: string) => {
      if (!callId || !isHost) return;
      await groupCallService.promoteToCoHost(callId, participantId);
    },
    [callId, isHost],
  );

  const demoteFromCoHost = useCallback(
    async (participantId: string) => {
      if (!callId || !isHost) return;

      try {
        const docRef = doc(getDb(), "Calls", callId);
        const { updateDoc } = await import("firebase/firestore");
        await updateDoc(docRef, {
          [`participants.${participantId}.role`]:
            "participant" as GroupCallRole,
        });
      } catch (err) {
        logger.error(
          "[useGroupCallParticipants] Failed to demote participant:",
          err,
        );
        throw err;
      }
    },
    [callId, isHost],
  );

  const pinParticipant = useCallback(
    async (participantId: string | null) => {
      if (!callId) return;
      await groupCallService.pinParticipant(callId, participantId);
    },
    [callId],
  );

  const muteAll = useCallback(async () => {
    if (!callId || !canManageParticipants) return;
    await groupCallService.muteAllParticipants(callId);
  }, [callId, canManageParticipants]);

  const lowerAllHands = useCallback(async () => {
    if (!callId || !canManageParticipants) return;
    await groupCallService.lowerAllHands(callId);
  }, [callId, canManageParticipants]);

  return {
    participants,
    activeParticipants,
    participantsWithRaisedHands,
    isHost,
    isCoHost,
    canManageParticipants,
    currentUserParticipant,
    activeSpeakerId,
    pinnedParticipantId,
    participantCount,
    activeParticipantCount,
    raisedHandCount,
    muteParticipant,
    removeParticipant,
    promoteToCoHost,
    demoteFromCoHost,
    pinParticipant,
    muteAll,
    lowerAllHands,
    isLoading,
    error,
  };
}
