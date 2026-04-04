/**
 * Stream Call Context
 *
 * Unified call/session state for the live Stream integration.
 *
 * Architecture:
 * - One StreamVideoClient for the authenticated user
 * - Direct calls use Stream's ringing flow with unique call IDs
 * - Voice channels use deterministic room IDs on the `default` call type
 * - The provider owns session cleanup so screens don't have to guess lifecycle
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

const streamSDK = CALL_FEATURES.CALLS_ENABLED
  ? (require("@stream-io/video-react-native-sdk") as any)
  : null;
const streamSvc = CALL_FEATURES.CALLS_ENABLED
  ? (require("@/services/stream") as any)
  : null;

const CallingState = streamSDK?.CallingState;
const StreamVideo = streamSDK?.StreamVideo;

const startDirectCall = streamSvc?.startDirectCall;
const acceptDirectCall = streamSvc?.acceptDirectCall;
const rejectDirectCall = streamSvc?.rejectDirectCall;
const endDirectCall = streamSvc?.endDirectCall;
const joinVoiceChannel = streamSvc?.joinVoiceChannel;
const leaveVoiceChannel = streamSvc?.leaveVoiceChannel;
const initStreamClient = streamSvc?.initStreamClient;
const destroyStreamClient = streamSvc?.destroyStreamClient;
const clearTokenCache = streamSvc?.clearTokenCache;
const stopCallAudioSession = streamSvc?.stopCallAudioSession;

interface StreamCallContextType {
  isReady: boolean;
  activeSession: ActiveMediaSession;
  isBusy: boolean;
  startCall: (
    recipientId: string,
    mode: DirectCallMode,
    recipientName?: string,
  ) => Promise<string>;
  acceptCall: (call: Call) => Promise<void>;
  rejectCall: (
    call: Call,
    reason?: "decline" | "busy" | "cancel",
  ) => Promise<void>;
  endCall: () => Promise<void>;
  joinChannel: (groupId: string, groupName: string) => Promise<void>;
  leaveChannel: () => Promise<void>;
  wasChannelDeliberatelyLeft: (channelId: string) => boolean;
  clearDeliberateLeave: (channelId: string) => void;
  activeCall: Call | null;
}

const StreamCallContext = createContext<StreamCallContextType | undefined>(
  undefined,
);

function StreamCallInnerProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string;
}) {
  const [activeSession, setActiveSession] = useState<ActiveMediaSession>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const busyRef = useRef(false);
  const deliberatelyLeftChannelsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    busyRef.current = activeSession !== null;
  }, [activeSession]);

  useEffect(() => {
    const call = activeCallRef.current;
    if (!call) return;

    const subscription = call.state.callingState$.subscribe((state: any) => {
      if (
        state !== CallingState.LEFT &&
        state !== CallingState.IDLE &&
        state !== CallingState.RECONNECTING_FAILED
      ) {
        return;
      }

      if (activeCallRef.current !== call) return;

      activeCallRef.current = null;
      busyRef.current = false;
      setActiveCall(null);
      setActiveSession(null);
      stopCallAudioSession?.();
    });

    return () => subscription.unsubscribe();
  }, [activeCall]);

  const isBusy = activeSession !== null;

  const startCallAction = useCallback(
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
        return callId;
      } catch (err) {
        busyRef.current = false;
        throw err;
      }
    },
    [userId],
  );

  const acceptCallAction = useCallback(async (call: Call) => {
    if (busyRef.current) {
      await rejectDirectCall(call, "busy");
      return;
    }
    busyRef.current = true;

    try {
      const mode = (call.state.custom?.mode as DirectCallMode) ?? "audio";
      await acceptDirectCall(call, mode);

      activeCallRef.current = call;
      setActiveCall(call);
      setActiveSession({
        type: "direct_call",
        callId: call.id,
        recipientName: call.state.createdBy?.name,
        mode,
      });
    } catch (err) {
      busyRef.current = false;
      throw err;
    }
  }, []);

  const rejectCallAction = useCallback(
    async (call: Call, reason: "decline" | "busy" | "cancel" = "decline") => {
      await rejectDirectCall(call, reason);
    },
    [],
  );

  const endCallAction = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call) {
      busyRef.current = false;
      setActiveCall(null);
      setActiveSession(null);
      stopCallAudioSession?.();
      return;
    }

    activeCallRef.current = null;
    busyRef.current = false;
    setActiveCall(null);
    setActiveSession(null);

    try {
      await endDirectCall(call);
    } catch {
      // Best effort - the remote may have already ended the call.
    }
  }, []);

  const joinChannelAction = useCallback(
    async (groupId: string, groupName: string) => {
      if (busyRef.current) {
        throw new Error("Already in a call or voice channel.");
      }
      busyRef.current = true;

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
      busyRef.current = false;
      setActiveCall(null);
      setActiveSession(null);
      stopCallAudioSession?.();
      return;
    }

    deliberatelyLeftChannelsRef.current.add(call.id);

    // Leave the call FIRST while the SDK reference is still live.
    // Nulling the ref/state before the async leave previously caused the
    // callingState$ subscription to tear down mid-flight, preventing
    // proper server-side participant removal.
    try {
      await leaveVoiceChannel(call);
    } catch {
      // Best effort - the room may already be gone locally.
    }

    activeCallRef.current = null;
    busyRef.current = false;
    setActiveCall(null);
    setActiveSession(null);
  }, []);

  const wasChannelDeliberatelyLeft = useCallback((channelId: string) => {
    return deliberatelyLeftChannelsRef.current.has(channelId);
  }, []);

  const clearDeliberateLeave = useCallback((channelId: string) => {
    deliberatelyLeftChannelsRef.current.delete(channelId);
  }, []);

  const value = useMemo<StreamCallContextType>(
    () => ({
      isReady: true,
      activeSession,
      isBusy,
      startCall: startCallAction,
      acceptCall: acceptCallAction,
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
      startCallAction,
      acceptCallAction,
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

export function StreamCallProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentFirebaseUser } = useAuth();
  const { profile } = useUser();
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const currentUserId = currentFirebaseUser?.uid ?? null;

  useEffect(() => {
    if (!CALL_FEATURES.CALLS_ENABLED) return;

    if (!currentUserId) {
      const cleanup = async () => {
        try {
          await destroyStreamClient();
        } catch (err: any) {
          console.warn("[StreamCallProvider] destroyStreamClient failed:", err);
        }
        clearTokenCache();
        setClient(null);
      };
      cleanup();
      return;
    }

    if (!profile) return;

    let cancelled = false;

    const displayName = profile.displayName ?? undefined;
    const profilePicUrl =
      (profile as any)?.profilePicture?.url ??
      (profile as any)?.profilePicture?.thumbnailUrl ??
      undefined;

    initStreamClient(currentUserId, displayName, profilePicUrl)
      .then((nextClient: StreamVideoClient) => {
        if (!cancelled) setClient(nextClient);
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
  }, [currentUserId, profile]);

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

export function useStreamCall(): StreamCallContextType {
  const ctx = useContext(StreamCallContext);
  if (!ctx) {
    throw new Error("useStreamCall must be used within StreamCallProvider");
  }
  return ctx;
}
