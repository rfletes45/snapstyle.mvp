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
import * as HapticsUtil from "@/utils/haptics";
import {
  logStartupError,
  logStartupEvent,
  logStartupMount,
  logStartupUnmount,
} from "@/utils/startupTrace";
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

let ringtoneService: typeof import("@/services/calls/ringtoneService") | null =
  null;
try {
  ringtoneService = require("@/services/calls/ringtoneService");
} catch {
  // Not available
}

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

const CALLS_INITIALIZING_MESSAGE =
  "Calls are still initializing. Please try again in a moment.";

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
  /** Start joining a voice channel without throwing — updates voiceRoomJoinState.
   *  Designed for the inline group-chat join flow. */
  joinChannelInline: (groupId: string, groupName: string) => void;
  leaveChannel: () => Promise<void>;
  wasChannelDeliberatelyLeft: (channelId: string) => boolean;
  clearDeliberateLeave: (channelId: string) => void;
  activeCall: Call | null;
  /** Current state of an inline voice-room join attempt */
  voiceRoomJoinState: "idle" | "joining" | "joined" | "error";
  /** Error message when voiceRoomJoinState === "error" */
  voiceRoomJoinError: string | null;
  /** The groupId of the voice room being joined inline */
  voiceRoomJoinGroupId: string | null;
  /** Clear the voice room join error and reset to idle */
  clearVoiceRoomJoinError: () => void;
}

const StreamCallContext = createContext<StreamCallContextType | undefined>(
  undefined,
);

const StreamVideoClientContext = createContext<StreamVideoClient | null>(null);

function StreamCallInnerProvider({
  children,
  userId,
  isReady,
}: {
  children: React.ReactNode;
  userId: string | null;
  isReady: boolean;
}) {
  const [activeSession, setActiveSession] = useState<ActiveMediaSession>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const busyRef = useRef(false);
  const deliberatelyLeftChannelsRef = useRef<Set<string>>(new Set());

  // Inline voice-room join state (for the group-chat join flow)
  const [voiceRoomJoinState, setVoiceRoomJoinState] = useState<
    "idle" | "joining" | "joined" | "error"
  >("idle");
  const [voiceRoomJoinError, setVoiceRoomJoinError] = useState<string | null>(
    null,
  );
  const [voiceRoomJoinGroupId, setVoiceRoomJoinGroupId] = useState<
    string | null
  >(null);

  const clearVoiceRoomJoinError = useCallback(() => {
    setVoiceRoomJoinState("idle");
    setVoiceRoomJoinError(null);
    setVoiceRoomJoinGroupId(null);
  }, []);

  useEffect(() => {
    busyRef.current = activeSession !== null;
  }, [activeSession]);

  const clearActiveState = useCallback(() => {
    activeCallRef.current = null;
    busyRef.current = false;
    setActiveCall(null);
    setActiveSession(null);
    // Reset inline join state when the session ends
    setVoiceRoomJoinState("idle");
    setVoiceRoomJoinError(null);
    setVoiceRoomJoinGroupId(null);
  }, []);

  useEffect(() => {
    if (userId) return;

    deliberatelyLeftChannelsRef.current.clear();
    clearActiveState();
  }, [clearActiveState, userId]);

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

      console.info(
        "[StreamCallContext] Active call transitioning to terminal state — clearing session",
        {
          callId: call.id,
          state,
          sessionType: activeSession?.type ?? "unknown",
        },
      );

      if (state === CallingState.RECONNECTING_FAILED) {
        console.error(
          "[StreamCallContext] Reconnection failed, clearing active session:",
          {
            callId: call.id,
            sessionType: activeSession?.type ?? "unknown",
          },
        );
      }

      clearActiveState();
      stopCallAudioSession?.();
    });

    return () => subscription.unsubscribe();
  }, [activeCall, activeSession?.type, clearActiveState]);

  const isBusy = activeSession !== null;

  const startCallAction = useCallback(
    async (
      recipientId: string,
      mode: DirectCallMode,
      recipientName?: string,
    ): Promise<string> => {
      const readyUserId = userId;
      if (!isReady || !readyUserId) {
        throw new Error(CALLS_INITIALIZING_MESSAGE);
      }

      if (busyRef.current) {
        throw new Error("Already in a call or voice channel.");
      }
      busyRef.current = true;

      const callId = uuidv4();
      try {
        const call = await startDirectCall(
          callId,
          readyUserId,
          recipientId,
          mode,
        );
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
    [isReady, userId],
  );

  const acceptCallAction = useCallback(
    async (call: Call) => {
      if (!isReady) {
        throw new Error(CALLS_INITIALIZING_MESSAGE);
      }

      if (busyRef.current) {
        await rejectDirectCall(call, "busy");
        return;
      }

      // ── Acceptability guard ────────────────────────────────────────────
      // Reject calls that have already been ended/expired/left by the time
      // the accept reaches the context. This is the single canonical gate
      // that prevents DirectCallScreen from ever being mounted against a
      // dead call object (the cause of the "empty ghost call" bug when a
      // stale CallKit accept is processed after server-side expiry).
      const preAcceptState = call.state.callingState;
      const endedAt = (call.state as any).endedAt as Date | undefined | null;
      const isEndedState =
        preAcceptState === CallingState.LEFT ||
        preAcceptState === CallingState.IDLE ||
        preAcceptState === CallingState.RECONNECTING_FAILED;
      if (endedAt || isEndedState) {
        console.warn(
          "[StreamCallContext] acceptCall refused — call no longer acceptable",
          {
            callId: call.id,
            callingState: preAcceptState,
            hasEndedAt: !!endedAt,
          },
        );
        // Best-effort local cleanup so the SDK doesn't hold a zombie call.
        try {
          await call.leave();
        } catch {
          // ignored — call may already be fully gone
        }
        throw new Error("Call is no longer active");
      }

      busyRef.current = true;

      try {
        const mode = (call.state.custom?.mode as DirectCallMode) ?? "audio";
        await acceptDirectCall(call, mode);

        // Re-verify after the async join — the call could have ended while
        // acceptDirectCall() was in flight.
        const postAcceptState = call.state.callingState;
        if (
          postAcceptState === CallingState.LEFT ||
          postAcceptState === CallingState.IDLE ||
          postAcceptState === CallingState.RECONNECTING_FAILED
        ) {
          console.warn(
            "[StreamCallContext] acceptCall: call ended during join — not adopting",
            { callId: call.id, callingState: postAcceptState },
          );
          busyRef.current = false;
          throw new Error("Call ended before it could be joined");
        }

        activeCallRef.current = call;
        setActiveCall(call);
        setActiveSession({
          type: "direct_call",
          callId: call.id,
          recipientName: call.state.createdBy?.name,
          mode,
        });
        console.info("[StreamCallContext] acceptCall adopted", {
          callId: call.id,
          callingState: postAcceptState,
          mode,
        });
      } catch (err) {
        busyRef.current = false;
        throw err;
      }
    },
    [isReady],
  );

  const rejectCallAction = useCallback(
    async (call: Call, reason: "decline" | "busy" | "cancel" = "decline") => {
      await rejectDirectCall(call, reason);
    },
    [],
  );

  const endingRef = useRef(false);

  const endCallAction = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;

    const call = activeCallRef.current;
    if (!call) {
      clearActiveState();
      stopCallAudioSession?.();
      endingRef.current = false;
      return;
    }

    clearActiveState();

    try {
      await endDirectCall(call);
    } catch {
      // Best effort - the remote may have already ended the call.
    } finally {
      endingRef.current = false;
    }
  }, [clearActiveState]);

  const joinChannelAction = useCallback(
    async (groupId: string, groupName: string) => {
      const readyUserId = userId;
      if (!isReady || !readyUserId) {
        throw new Error(CALLS_INITIALIZING_MESSAGE);
      }

      if (busyRef.current) {
        throw new Error("Already in a call or voice channel.");
      }
      busyRef.current = true;

      const channelId = `voice_channel_${groupId}`;
      deliberatelyLeftChannelsRef.current.delete(channelId);

      console.info(
        `[StreamCallContext] joinChannelAction starting — groupId=${groupId}, channelId=${channelId}, userId=${readyUserId}, busyRef=true`,
      );

      // Defensive: if a stale call object lingers from a previous session,
      // clear it before starting a new join to avoid impossible states.
      if (activeCallRef.current) {
        console.warn(
          "[StreamCallContext] Clearing stale activeCall before voice channel join:",
          activeCallRef.current.id,
        );
        activeCallRef.current = null;
        setActiveCall(null);
        setActiveSession(null);
      }

      try {
        const call = await joinVoiceChannel(groupId, groupName, readyUserId);

        // Guard: verify the call object is valid after the async join
        if (!call || !call.id) {
          busyRef.current = false;
          throw new Error("joinVoiceChannel returned an invalid call object.");
        }

        console.info(
          `[StreamCallContext] joinChannelAction succeeded — callId=${call.id}`,
        );

        activeCallRef.current = call;
        setActiveCall(call);
        setActiveSession({
          type: "voice_channel",
          channelId: call.id,
          channelName: groupName,
          groupId,
        });
        // Mark inline join as successful
        setVoiceRoomJoinState("joined");
      } catch (err: any) {
        console.error("[StreamCallContext] joinChannelAction failed:", {
          groupId,
          channelId,
          userId: readyUserId,
          errorMessage: err?.message,
          stage: err?.stage ?? "unknown",
          streamCode: err?.streamCode ?? err?.code ?? null,
        });
        busyRef.current = false;
        throw err;
      }
    },
    [isReady, userId],
  );

  const joinChannelInlineAction = useCallback(
    (groupId: string, groupName: string) => {
      if (!isReady || !userId) {
        console.warn(
          "[StreamCallContext] joinChannelInline rejected: not ready",
          { isReady, hasUserId: !!userId },
        );
        setVoiceRoomJoinState("error");
        setVoiceRoomJoinError(CALLS_INITIALIZING_MESSAGE);
        setVoiceRoomJoinGroupId(groupId);
        return;
      }

      // Pre-flight: already busy?
      if (busyRef.current) {
        console.warn("[StreamCallContext] joinChannelInline rejected: busy", {
          activeSessionType: activeSession?.type ?? "none",
          activeCallId: activeCallRef.current?.id ?? "none",
        });
        setVoiceRoomJoinState("error");
        setVoiceRoomJoinError(
          "You're already in a call. Leave it first to join this voice channel.",
        );
        setVoiceRoomJoinGroupId(groupId);
        return;
      }

      // Pre-flight: already joining this exact group?
      if (
        voiceRoomJoinState === "joining" &&
        voiceRoomJoinGroupId === groupId
      ) {
        console.warn(
          "[StreamCallContext] joinChannelInline called while already joining same group — ignoring duplicate",
        );
        return;
      }

      console.info(
        `[StreamCallContext] joinChannelInline starting — groupId=${groupId}`,
      );

      // Set joining state immediately so UI can react
      setVoiceRoomJoinState("joining");
      setVoiceRoomJoinError(null);
      setVoiceRoomJoinGroupId(groupId);

      // Delegate to the existing joinChannel which handles busyRef,
      // deliberatelyLeftChannels, SDK join, and activeSession setup.
      joinChannelAction(groupId, groupName).catch((err: any) => {
        const errorMsg = err?.message || "Failed to join voice channel";
        console.error("[StreamCallContext] joinChannelInline failed:", {
          groupId,
          errorMessage: errorMsg,
          stage: err?.stage ?? "unknown",
          streamCode: err?.streamCode ?? err?.code ?? null,
        });
        setVoiceRoomJoinState("error");
        setVoiceRoomJoinError(errorMsg);
      });
    },
    [
      activeSession,
      isReady,
      joinChannelAction,
      userId,
      voiceRoomJoinGroupId,
      voiceRoomJoinState,
    ],
  );

  const leaveChannelAction = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call) {
      clearActiveState();
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

    clearActiveState();
  }, [clearActiveState]);

  const wasChannelDeliberatelyLeft = useCallback((channelId: string) => {
    return deliberatelyLeftChannelsRef.current.has(channelId);
  }, []);

  const clearDeliberateLeave = useCallback((channelId: string) => {
    deliberatelyLeftChannelsRef.current.delete(channelId);
  }, []);

  // Play the local join sound when join succeeds.
  // Fires on both the inline flow ("joining" → "joined") and the direct
  // VoiceChannelScreen flow ("idle" → "joined").
  const prevJoinStateRef = useRef(voiceRoomJoinState);
  useEffect(() => {
    const prev = prevJoinStateRef.current;
    prevJoinStateRef.current = voiceRoomJoinState;
    if (
      voiceRoomJoinState === "joined" &&
      (prev === "joining" || prev === "idle")
    ) {
      // Haptic on successful local join — fires exactly once per transition
      HapticsUtil.success();
      setTimeout(() => {
        ringtoneService?.playSoundEffect("room_join");
      }, 300);
    }
  }, [voiceRoomJoinState]);

  // Remote participant join sound — plays globally while in a voice channel,
  // regardless of which screen is mounted. Subscribes to the Stream SDK's
  // participants$ observable on the active call.
  useEffect(() => {
    const call = activeCallRef.current;
    if (!call || activeSession?.type !== "voice_channel") return;

    let prevCount: number | null = null;
    let settled = false;

    const subscription = call.state.participants$.subscribe(
      (participants: any[]) => {
        const count = participants?.length ?? 0;

        if (prevCount === null) {
          // First snapshot — baseline from initial room hydration.
          // Record it but don't play any sound.
          prevCount = count;
          settled = true;
          return;
        }

        // Only play sound for genuine remote joins after the baseline
        if (count > prevCount && settled) {
          setTimeout(() => {
            ringtoneService?.playSoundEffect("room_join");
          }, 300);
        }

        prevCount = count;
      },
    );

    return () => subscription.unsubscribe();
  }, [activeCall, activeSession?.type]);

  const value = useMemo<StreamCallContextType>(
    () => ({
      isReady,
      activeSession,
      isBusy,
      startCall: startCallAction,
      acceptCall: acceptCallAction,
      rejectCall: rejectCallAction,
      endCall: endCallAction,
      joinChannel: joinChannelAction,
      joinChannelInline: joinChannelInlineAction,
      leaveChannel: leaveChannelAction,
      wasChannelDeliberatelyLeft,
      clearDeliberateLeave,
      activeCall,
      voiceRoomJoinState,
      voiceRoomJoinError,
      voiceRoomJoinGroupId,
      clearVoiceRoomJoinError,
    }),
    [
      isReady,
      activeSession,
      isBusy,
      startCallAction,
      acceptCallAction,
      rejectCallAction,
      endCallAction,
      joinChannelAction,
      joinChannelInlineAction,
      leaveChannelAction,
      wasChannelDeliberatelyLeft,
      clearDeliberateLeave,
      activeCall,
      voiceRoomJoinState,
      voiceRoomJoinError,
      voiceRoomJoinGroupId,
      clearVoiceRoomJoinError,
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
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    logStartupMount("StreamCallProvider", {
      callsEnabled: CALL_FEATURES.CALLS_ENABLED,
    });
    return () => {
      logStartupUnmount("StreamCallProvider");
    };
  }, []);

  useEffect(() => {
    logStartupEvent("StreamCall provider state changed", {
      currentUserId,
      hasProfile: !!profile,
      hasClient: !!client,
    });
  }, [client, currentUserId, profile]);

  useEffect(() => {
    if (!CALL_FEATURES.CALLS_ENABLED) return;

    if (!currentUserId) {
      logStartupEvent("StreamCall client clearing", {
        reason: "no_authenticated_user",
      });
      const cleanup = async () => {
        // Privacy-first: wipe any locally stored transcripts for the
        // signed-out user. This matches the "local-only, not a cloud
        // archive" story for call transcripts.
        const signedOutUid = previousUserIdRef.current;
        if (signedOutUid) {
          try {
            const { wipeTranscriptsForOwner } =
              await import("@/services/calls/callTranscriptDb");
            await wipeTranscriptsForOwner(signedOutUid);
          } catch (err) {
            console.warn(
              "[StreamCallProvider] wipeTranscriptsForOwner failed:",
              err,
            );
          }
        }
        try {
          await destroyStreamClient();
        } catch (err: any) {
          logStartupError("StreamCall client destroy failed", err, {
            reason: "no_authenticated_user",
          });
          console.warn("[StreamCallProvider] destroyStreamClient failed:", err);
        }
        clearTokenCache();
        setClient(null);
      };
      cleanup();
      previousUserIdRef.current = null;
      return;
    }

    previousUserIdRef.current = currentUserId;

    if (!profile) {
      logStartupEvent("StreamCall client init deferred", {
        reason: "profile_not_ready",
        currentUserId,
      });
      return;
    }

    let cancelled = false;

    const displayName = profile.displayName ?? undefined;
    const profilePicUrl =
      (profile as any)?.profilePicture?.url ??
      (profile as any)?.profilePicture?.thumbnailUrl ??
      undefined;

    logStartupEvent("StreamCall client init started", {
      currentUserId,
      hasDisplayName: !!displayName,
      hasProfilePicUrl: !!profilePicUrl,
    });

    initStreamClient(currentUserId, displayName, profilePicUrl)
      .then((nextClient: StreamVideoClient) => {
        if (!cancelled) {
          setClient(nextClient);
          logStartupEvent("StreamCall client init completed", {
            currentUserId,
          });
        }
      })
      .catch((err: any) => {
        logStartupError("StreamCall client init failed", err, {
          currentUserId,
        });
        console.error(
          "[StreamCallProvider] Failed to init Stream client:",
          err,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId, profile]);

  return (
    <StreamVideoClientContext.Provider value={client}>
      <StreamCallInnerProvider
        userId={currentUserId}
        isReady={!!client && !!currentUserId}
      >
        {children}
      </StreamCallInnerProvider>
    </StreamVideoClientContext.Provider>
  );
}

/**
 * Wraps children in <StreamVideo> when the client is ready.
 *
 * IMPORTANT: This provider MUST remain an ancestor of every component that
 * renders ParticipantView or any other Stream Video SDK UI component.
 * The SDK's <StreamVideo> provides StreamTheme (ThemeContext) which
 * ParticipantView requires — removing this wrapper or moving it lower in
 * the tree will cause an immediate crash:
 *   "useThemeContext hook was called outside the ThemeContext Provider"
 *
 * When the client is not yet initialised (logged-out state, app boot) this
 * renders children WITHOUT the <StreamVideo> wrapper so the rest of the UI
 * is never blocked. Call-related UI that depends on the client should use
 * its own isReady / activeCall guard to avoid rendering prematurely.
 */
export function StreamVideoEffectsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = useContext(StreamVideoClientContext);

  if (!CALL_FEATURES.CALLS_ENABLED || !client || !StreamVideo) {
    // Always render children — never return null. The rest of the UI must
    // not be blocked while the Stream client initialises.
    return <>{children}</>;
  }

  return <StreamVideo client={client}>{children}</StreamVideo>;
}

export function useStreamCall(): StreamCallContextType {
  const ctx = useContext(StreamCallContext);
  if (!ctx) {
    throw new Error("useStreamCall must be used within StreamCallProvider");
  }
  return ctx;
}
