/**
 * Stream Call Context
 *
 * Replaces the legacy CallContext. Provides unified state management
 * for both direct calls and voice channels using Stream Video SDK.
 *
 * Architecture:
 * - One StreamVideoClient, initialized on auth and torn down on logout
 * - Direct calls: uses Stream ringing flow (unique call IDs)
 * - Voice channels: uses Stream audio_room (deterministic IDs per group)
 * - Busy policy: user can only be in one active media session at a time
 */

import { CALL_FEATURES } from "@/constants/featureFlags";
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";
import type { ActiveMediaSession, DirectCallMode } from "@/types/streamCall";
import { generateUUID } from "@/utils/uuid";
import type {
  Call,
  StreamVideoClient,
} from "@stream-io/video-react-native-sdk";
import * as Crypto from "expo-crypto";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

function uuidv4(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    return generateUUID();
  }
}

// ---------------------------------------------------------------------------
// Lazy imports — prevents native module crash in Expo Go.
// These modules are only loaded when CALLS_ENABLED is true.
// ---------------------------------------------------------------------------
const streamSDK = CALL_FEATURES.CALLS_ENABLED
  ? (require("@stream-io/video-react-native-sdk") as any)
  : null;
const streamSvc = CALL_FEATURES.CALLS_ENABLED
  ? (require("@/services/stream") as any)
  : null;

const CallingState = streamSDK?.CallingState;
const StreamVideo = streamSDK?.StreamVideo;
const StreamVideoRN = streamSDK?.StreamVideoRN;

const startDirectCall = streamSvc?.startDirectCall;
const acceptDirectCall = streamSvc?.acceptDirectCall;
const rejectDirectCall = streamSvc?.rejectDirectCall;
const endDirectCall = streamSvc?.endDirectCall;
const joinVoiceChannel = streamSvc?.joinVoiceChannel;
const leaveVoiceChannel = streamSvc?.leaveVoiceChannel;
const initStreamClient = streamSvc?.initStreamClient;
const destroyStreamClient = streamSvc?.destroyStreamClient;
const clearTokenCache = streamSvc?.clearTokenCache;

// Lazy-load history recording
const streamHistorySvc = CALL_FEATURES.CALLS_ENABLED
  ? (require("@/services/stream/streamCallHistoryService") as typeof import("@/services/stream/streamCallHistoryService"))
  : null;

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

interface StreamCallContextType {
  /** Whether the Stream client is initialized and ready */
  isReady: boolean;

  /** The current active media session (direct call or voice channel), or null */
  activeSession: ActiveMediaSession;

  /** Whether the user is currently busy (in any call/channel) */
  isBusy: boolean;

  // Direct call actions
  /** Start an outgoing 1:1 call */
  startCall: (
    recipientId: string,
    mode: DirectCallMode,
    recipientName?: string,
  ) => Promise<string>;
  /** Accept an incoming ringing call */
  acceptCall: (call: Call) => Promise<void>;
  /** Reject/decline an incoming ringing call */
  rejectCall: (call: Call) => Promise<void>;
  /** End/leave the current direct call */
  endCall: () => Promise<void>;

  // Voice channel actions
  /** Join a voice channel for a group */
  joinChannel: (groupId: string, groupName: string) => Promise<void>;
  /** Leave the current voice channel */
  leaveChannel: () => Promise<void>;

  /** Check if a channel was deliberately left (prevents auto-rejoin) */
  wasChannelDeliberatelyLeft: (channelId: string) => boolean;
  /** Clear the deliberate-leave flag for a channel (for manual rejoin) */
  clearDeliberateLeave: (channelId: string) => void;

  /** The currently active Stream Call object (direct or voice), if any */
  activeCall: Call | null;
}

const StreamCallContext = createContext<StreamCallContextType | undefined>(
  undefined,
);

// ---------------------------------------------------------------------------
// Inner provider — requires StreamVideo wrapper to be present
// ---------------------------------------------------------------------------

function StreamCallInnerProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string;
}) {
  const [activeSession, setActiveSession] = useState<ActiveMediaSession>(null);
  const activeCallRef = useRef<Call | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const busyRef = useRef(false);

  // Tracks channel IDs the user deliberately left. Prevents auto-rejoin
  // when VoiceChannelScreen remounts before navigation fully resolves.
  const deliberatelyLeftChannelsRef = useRef<Set<string>>(new Set());

  // Track metadata for history recording
  const sessionMetaRef = useRef<{
    mode?: "audio" | "video";
    recipientId?: string;
    recipientName?: string;
    recipientAvatar?: string | null;
    groupId?: string;
    groupName?: string;
    startedAt: number;
    isOutgoing: boolean;
  } | null>(null);

  // Keep busyRef in sync with activeSession
  useEffect(() => {
    busyRef.current = activeSession !== null;
  }, [activeSession]);

  // Record history for the ended session
  const recordSessionHistory = useCallback(
    (
      result: "completed" | "missed" | "declined" | "canceled" | "left",
      callOverride?: Call | null,
    ) => {
      const meta = sessionMetaRef.current;
      if (!meta || !streamHistorySvc) return;
      sessionMetaRef.current = null;

      const now = Date.now();
      const callForHistory = callOverride ?? activeCallRef.current;

      try {
        if (meta.groupId) {
          // Voice room
          const callId = callForHistory?.id ?? `voice_channel_${meta.groupId}`;
          const participantCount =
            callForHistory?.state?.participants?.length ?? 0;
          const entry = streamHistorySvc.buildVoiceRoomEntry({
            callId,
            groupId: meta.groupId,
            groupName: meta.groupName ?? "Voice Room",
            startedAt: meta.startedAt,
            endedAt: now,
            participantCount,
            initiatedBy: userId,
            currentUserId: userId,
          });
          streamHistorySvc.recordCallHistory(entry).catch(() => {});
        } else if (meta.recipientId) {
          // Direct call — try to get avatar from the active call's remote participant
          const callId = callForHistory?.id ?? uuidv4();
          const remoteParticipant =
            callForHistory?.state?.participants?.find(
              (p: any) => p.userId !== userId,
            );
          const avatarUrl =
            remoteParticipant?.image ?? meta.recipientAvatar ?? null;
          const displayName =
            remoteParticipant?.name ?? meta.recipientName ?? "Unknown";
          const entry = streamHistorySvc.buildDirectCallEntry({
            callId,
            mode: meta.mode ?? "audio",
            direction: meta.isOutgoing ? "outgoing" : "incoming",
            result,
            startedAt: meta.startedAt,
            endedAt: now,
            otherUserId: meta.recipientId,
            otherUserName: displayName,
            otherUserAvatar: avatarUrl,
            initiatedBy: meta.isOutgoing ? userId : meta.recipientId,
          });
          streamHistorySvc.recordCallHistory(entry).catch(() => {});
        }
      } catch {
        // Swallow — history recording should never block
      }
    },
    [userId],
  );

  const resolveDirectCallEndResult = useCallback((call: Call) => {
    const meta = sessionMetaRef.current;
    if (call.state.callingState === CallingState.RINGING && meta?.isOutgoing) {
      return "canceled" as const;
    }
    return "completed" as const;
  }, []);

  // Track active session from the call's calling state.
  // This subscription is the AUTHORITATIVE cleanup path — when Stream
  // reports LEFT/IDLE, we reset state. The explicit endCall/leaveChannel
  // actions also reset state, so we guard with activeCallRef to avoid
  // redundant updates (which would cause extra re-renders and potentially
  // rapid <StreamCall> mount/unmount cycles).
  useEffect(() => {
    const call = activeCallRef.current;
    if (!call) return;

    const sub = call.state.callingState$.subscribe((state) => {
      if (state === CallingState.LEFT || state === CallingState.IDLE) {
        // Only reset if this call is still the active call. The explicit
        // endCall/leaveChannel actions null out activeCallRef BEFORE
        // triggering call.leave(), so if we get here and ref is already
        // null, the explicit action already handled cleanup.
        if (activeCallRef.current !== call) return;
        recordSessionHistory("completed", call);
        activeCallRef.current = null;
        setActiveCall(null);
        setActiveSession(null);
      }
    });

    return () => sub.unsubscribe();
  }, [activeCall, recordSessionHistory]);

  const isBusy = activeSession !== null;

  // ── Direct call actions ─────────────────────────────────────────────────

  const startCall = useCallback(
    async (
      recipientId: string,
      mode: DirectCallMode,
      recipientName?: string,
    ): Promise<string> => {
      if (busyRef.current) {
        throw new Error("Already in a call or voice channel.");
      }
      busyRef.current = true;

      const callId = uuidv4();
      try {
        const call = await startDirectCall(callId, userId, recipientId, mode);
        activeCallRef.current = call;
        setActiveCall(call);
        setActiveSession({
          type: "direct_call",
          callId,
          recipientName: recipientName ?? recipientId,
          mode,
        });
        sessionMetaRef.current = {
          mode,
          recipientId,
          recipientName,
          recipientAvatar: null,
          startedAt: Date.now(),
          isOutgoing: true,
        };
        return callId;
      } catch (err) {
        busyRef.current = false;
        throw err;
      }
    },
    [userId],
  );

  const acceptCall = useCallback(async (call: Call) => {
    if (busyRef.current) {
      // Auto-reject if already in a session
      await rejectDirectCall(call);
      return;
    }
    busyRef.current = true;

    try {
      const mode = (call.state.custom?.mode as DirectCallMode) ?? "audio";
      const wasAlreadyAccepted =
        call.state.callingState === CallingState.JOINING ||
        call.state.callingState === CallingState.JOINED;
      if (!wasAlreadyAccepted) {
        await acceptDirectCall(call, mode);
      }

      // Set metadata BEFORE state updates so useEffect subscription has it
      sessionMetaRef.current = {
        mode,
        recipientId: call.state.createdBy?.id,
        recipientName: call.state.createdBy?.name,
        recipientAvatar: call.state.createdBy?.image ?? null,
        startedAt: Date.now(),
        isOutgoing: false,
      };
      activeCallRef.current = call;
      setActiveCall(call);
      setActiveSession({
        type: "direct_call",
        callId: call.id,
        recipientName: call.state.createdBy?.name,
        mode,
      });
      if (wasAlreadyAccepted) {
        console.log(
          "[StreamCallContext] Adopted already-accepted incoming call",
          call.id,
        );
      }
    } catch (err) {
      busyRef.current = false;
      throw err;
    }
  }, []);

  const rejectCallAction = useCallback(async (call: Call) => {
    // Record as declined in local history
    if (streamHistorySvc) {
      const callerId = call.state.createdBy?.id ?? "";
      const callerName = call.state.createdBy?.name ?? "Unknown";
      const callerAvatar = call.state.createdBy?.image ?? null;
      const mode = (call.state.custom?.mode as DirectCallMode) ?? "audio";
      const entry = streamHistorySvc.buildDirectCallEntry({
        callId: call.id,
        mode,
        direction: "incoming",
        result: "declined",
        startedAt: Date.now(),
        endedAt: Date.now(),
        otherUserId: callerId,
        otherUserName: callerName,
        otherUserAvatar: callerAvatar,
        initiatedBy: callerId,
      });
      streamHistorySvc.recordCallHistory(entry).catch(() => {});
    }
    sessionMetaRef.current = null;
    await rejectDirectCall(call);
  }, []);

  const endCallAction = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call) {
      // Already cleaned up — just ensure state is consistent
      busyRef.current = false;
      setActiveCall(null);
      setActiveSession(null);
      return;
    }

    // Null the ref FIRST so the callingState$ subscription (which fires
    // when call.endCall/leave triggers LEFT) won't double-reset state.
    const historyResult = resolveDirectCallEndResult(call);
    activeCallRef.current = null;
    busyRef.current = false;

    // Record history before clearing session (needs activeSession type)
    if (activeSession?.type === "direct_call") {
      recordSessionHistory(historyResult, call);
    }

    // CRITICAL: Set state to null BEFORE the async endDirectCall.
    // endDirectCall transitions the call object (callingState → LEFT,
    // media tracks dispose, observables error). If child components
    // (<DirectCallContent>) are still mounted during that transition,
    // SDK hooks read half-disposed state → TypeError thrown mid-render
    // after only N hooks → React error recovery re-renders → all hooks
    // run → "Rendered more hooks than during the previous render".
    setActiveCall(null);
    setActiveSession(null);

    try {
      await endDirectCall(call);
    } catch {
      // Best-effort — call may already be ended by remote
    }
  }, [activeSession, recordSessionHistory, resolveDirectCallEndResult]);

  // ── Voice channel actions ───────────────────────────────────────────────

  const joinChannelAction = useCallback(
    async (groupId: string, groupName: string) => {
      if (busyRef.current) {
        throw new Error("Already in a call or voice channel.");
      }
      busyRef.current = true;

      // Clear any deliberate-leave flag for this channel — user is
      // explicitly joining, so they intend to be in the room.
      const channelId = `voice_channel_${groupId}`;
      deliberatelyLeftChannelsRef.current.delete(channelId);

      try {
        const call = await joinVoiceChannel(groupId, groupName, userId);
        activeCallRef.current = call;
        setActiveCall(call);
        setActiveSession({
          type: "voice_channel",
          channelId: call.id,
          channelName: groupName,
          groupId,
        });
        sessionMetaRef.current = {
          groupId,
          groupName,
          startedAt: Date.now(),
          isOutgoing: true,
        };
      } catch (err) {
        busyRef.current = false;
        throw err;
      }
    },
    [userId],
  );

  const leaveChannelAction = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call) {
      // Already cleaned up — just ensure state is consistent
      busyRef.current = false;
      setActiveCall(null);
      setActiveSession(null);
      return;
    }

    // Mark this channel as deliberately left BEFORE any cleanup.
    // This prevents VoiceChannelScreen's auto-join effect from
    // re-joining if the screen remounts during the async leave flow.
    const channelId = call.id;
    deliberatelyLeftChannelsRef.current.add(channelId);

    // Null the ref FIRST so the callingState$ subscription won't
    // double-reset state when leaveVoiceChannel triggers LEFT.
    activeCallRef.current = null;
    busyRef.current = false;

    // Record history before clearing session (needs activeSession type)
    if (activeSession?.type === "voice_channel") {
      recordSessionHistory("left", call);
    }

    // Leave the call on the SDK side FIRST so the server knows we've
    // disconnected. This prevents the SDK from auto-reconnecting.
    try {
      await leaveVoiceChannel(call);
    } catch {
      // Best-effort — channel may already be left
    }

    // THEN clear state. Components will unmount cleanly after the SDK
    // has fully released the call resources.
    setActiveCall(null);
    setActiveSession(null);
  }, [activeSession, recordSessionHistory]);

  // ── Deliberate-leave helpers ─────────────────────────────────────────

  const wasChannelDeliberatelyLeft = useCallback((channelId: string) => {
    return deliberatelyLeftChannelsRef.current.has(channelId);
  }, []);

  const clearDeliberateLeave = useCallback((channelId: string) => {
    deliberatelyLeftChannelsRef.current.delete(channelId);
  }, []);

  // ── Context value ───────────────────────────────────────────────────────

  const value = useMemo<StreamCallContextType>(
    () => ({
      isReady: true,
      activeSession,
      isBusy,
      startCall,
      acceptCall,
      rejectCall: rejectCallAction,
      endCall: endCallAction,
      joinChannel: joinChannelAction,
      leaveChannel: leaveChannelAction,
      wasChannelDeliberatelyLeft,
      clearDeliberateLeave,
      activeCall,
    }),
    [
      activeSession,
      isBusy,
      startCall,
      acceptCall,
      rejectCallAction,
      endCallAction,
      joinChannelAction,
      leaveChannelAction,
      wasChannelDeliberatelyLeft,
      clearDeliberateLeave,
      activeCall,
    ],
  );

  return (
    <StreamCallContext.Provider value={value}>
      {children}
    </StreamCallContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Outer provider — handles client init/teardown based on auth
// ---------------------------------------------------------------------------

export function StreamCallProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const [client, setClient] = useState<StreamVideoClient | null>(null);

  useEffect(() => {
    if (!CALL_FEATURES.CALLS_ENABLED) return;

    const user = currentFirebaseUser;
    if (!user) {
      // Destroy client on logout and clear push notification state
      const cleanup = async () => {
        try {
          await destroyStreamClient();
        } catch (err: any) {
          console.warn("[StreamCallProvider] destroyStreamClient failed:", err);
        }
        try {
          StreamVideoRN?.onPushLogout();
        } catch (err: any) {
          console.warn("[StreamCallProvider] onPushLogout failed:", err);
        }
        clearTokenCache();
        setClient(null);
      };
      cleanup();
      return;
    }

    // Wait for Firestore profile so we can pass real displayName/image to
    // the Stream SDK.  initStreamClient short-circuits on same userId, so
    // the first call wins — we must not call it with undefined name/image
    // when the real profile is about to arrive.
    // UserContext hydrates from AsyncStorage cache nearly instantly, so this
    // adds negligible delay.
    if (!profile) return;

    let cancelled = false;

    // Use Firestore profile data (displayName, profilePicture) instead of
    // Firebase Auth fields which are typically null in this app.
    // The profile picture is at profilePicture.url on the raw Firestore doc,
    // even though the narrow TypeScript User type doesn't declare it.
    const displayName = profile.displayName ?? undefined;
    const profilePicUrl =
      (profile as any)?.profilePicture?.url ??
      (profile as any)?.profilePicture?.thumbnailUrl ??
      undefined;

    initStreamClient(user.uid, displayName, profilePicUrl)
      .then((c: StreamVideoClient) => {
        if (!cancelled) setClient(c);
      })
      .catch((err: any) => {
        console.error(
          "[StreamCallProvider] Failed to init Stream client:",
          err,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [currentFirebaseUser?.uid, profile]);

  // If calls are disabled, client not ready, or user logged out, render noop
  if (!CALL_FEATURES.CALLS_ENABLED || !client || !currentFirebaseUser?.uid) {
    const noopValue: StreamCallContextType = {
      isReady: false,
      activeSession: null,
      isBusy: false,
      startCall: async () => {
        throw new Error("Calls not available");
      },
      acceptCall: async () => {},
      rejectCall: async () => {},
      endCall: async () => {},
      joinChannel: async () => {
        throw new Error("Calls not available");
      },
      leaveChannel: async () => {},
      wasChannelDeliberatelyLeft: () => false,
      clearDeliberateLeave: () => {},
      activeCall: null,
    };

    return (
      <StreamCallContext.Provider value={noopValue}>
        {children}
      </StreamCallContext.Provider>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCallInnerProvider userId={currentFirebaseUser.uid}>
        {children}
      </StreamCallInnerProvider>
    </StreamVideo>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStreamCall(): StreamCallContextType {
  const ctx = useContext(StreamCallContext);
  if (!ctx) {
    throw new Error("useStreamCall must be used within StreamCallProvider");
  }
  return ctx;
}
