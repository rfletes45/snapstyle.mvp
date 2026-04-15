/**
 * Incoming Call Handler
 *
 * Replaces the legacy IncomingCallOverlay. Listens for incoming ringing calls
 * from Stream and presents the incoming call UI. This component is rendered
 * at the app root level.
 */

import { CALL_FEATURES } from "@/constants/featureFlags";
import { useStreamCall } from "@/contexts/StreamCallContext";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Call } from "@stream-io/video-react-native-sdk";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Lazy-load SDK hooks/enums to avoid native module crash in Expo Go
const streamSDK = CALL_FEATURES.CALLS_ENABLED
  ? (require("@stream-io/video-react-native-sdk") as any)
  : null;
const useCalls: () => Call[] = streamSDK?.useCalls ?? (() => []);
const CallingState = streamSDK?.CallingState;

// Lazy-load ringtone service for incoming call sound
const ringtoneService = CALL_FEATURES.CALLS_ENABLED
  ? (require("@/services/calls/ringtoneService") as typeof import("@/services/calls/ringtoneService"))
  : null;

// Lazy-load call settings for DND / privacy gating
const callSettingsSvc = CALL_FEATURES.CALLS_ENABLED
  ? (require("@/services/calls") as { callSettingsService: any })
      .callSettingsService
  : null;

// Lazy-load profile service for friendship check
const profileSvc = CALL_FEATURES.CALLS_ENABLED
  ? (require("@/services/profileService") as {
      getRelationship: (a: string, b: string) => Promise<{ type: string }>;
    })
  : null;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface IncomingCallHandlerProps {
  /** Callback to navigate to the active call screen after accepting */
  onNavigateToCall?: (callId: string, mode: "audio" | "video") => void;
}

/**
 * Outer guard: only render the inner handler when the Stream client is
 * connected (i.e. `<StreamVideo>` is above us in the tree). Without this,
 * the real `useCalls()` hook would throw on the first render frame because
 * the client hasn't initialized yet.
 */
export default function IncomingCallHandler(props: IncomingCallHandlerProps) {
  const { isReady } = useStreamCall();
  if (!isReady) return null;
  return <IncomingCallHandlerInner {...props} />;
}

function IncomingCallHandlerInner({
  onNavigateToCall,
}: IncomingCallHandlerProps) {
  const { acceptCall, rejectCall, isBusy, activeSession } = useStreamCall();
  const { currentFirebaseUser } = useAuth();
  const { colors } = useAppTheme();

  // Get incoming ringing calls from Stream
  const allCalls = useCalls();
  const incomingCalls = allCalls.filter(
    (c) => c.state.callingState === CallingState.RINGING && !c.isCreatedByMe,
  );

  const mostRecentIncomingCall = useMemo(() => {
    if (incomingCalls.length === 0) return null;
    return incomingCalls.reduce((latest, call) => {
      const latestCreatedAt = latest.state.createdAt?.getTime?.() ?? 0;
      const callCreatedAt = call.state.createdAt?.getTime?.() ?? 0;
      return callCreatedAt > latestCreatedAt ? call : latest;
    });
  }, [incomingCalls]);

  const [pendingCall, setPendingCall] = useState<Call | null>(null);
  // null = checking, true = allowed, false = rejected (auto-handled)
  const [callAllowed, setCallAllowed] = useState<boolean | null>(null);

  // Track which call ID the permission check corresponds to
  const checkedCallIdRef = useRef<string | null>(null);

  // Guard: prevents the auto-reject effect from rejecting a call that is
  // currently being accepted. Without this, the accept flow sets
  // isBusy=true (via context state) BEFORE setPendingCall(null) runs,
  // causing the auto-reject effect to fire and reject the call we just accepted.
  const acceptingRef = useRef(false);

  // ── Native accept adoption ───────────────────────────────────────────
  // When the user answers a call via CallKit (iOS) or notification action
  // (Android), the Stream SDK processes the accept natively. By the time the
  // React tree renders, the call is already in JOINING or JOINED state.
  // We detect this and adopt the call into our context, then navigate to
  // the active call screen — without showing a second in-app accept sheet.
  //
  // On iOS terminated state: VoIP push wakes the app → CallKit shows the
  // native call UI → user taps Accept → SDK joins the call → the JS bridge
  // initializes → this effect picks up the JOINED call and adopts it.
  useEffect(() => {
    const acceptedDirectCalls = allCalls.filter(
      (c) =>
        !c.isCreatedByMe &&
        typeof c.state.custom?.mode === "string" &&
        (c.state.callingState === CallingState.JOINED ||
          c.state.callingState === CallingState.JOINING),
    );
    const alreadyAcceptedCall =
      acceptedDirectCalls.length === 0
        ? undefined
        : acceptedDirectCalls.reduce((latest, call) => {
            const latestCreatedAt = latest.state.createdAt?.getTime?.() ?? 0;
            const callCreatedAt = call.state.createdAt?.getTime?.() ?? 0;
            return callCreatedAt > latestCreatedAt ? call : latest;
          });

    if (
      alreadyAcceptedCall &&
      !isBusy &&
      !acceptingRef.current &&
      !(
        activeSession?.type === "direct_call" &&
        activeSession.callId === alreadyAcceptedCall.id
      )
    ) {
      const callToAdopt = alreadyAcceptedCall;
      const mode =
        (callToAdopt.state.custom?.mode as "audio" | "video") ?? "audio";
      console.info(
        `[IncomingCallHandler] Adopting natively-accepted call ${callToAdopt.id} (${mode}, state=${callToAdopt.state.callingState})`,
      );
      acceptingRef.current = true;
      setPendingCall(null);
      setCallAllowed(null);

      acceptCall(callToAdopt)
        .then(() => {
          console.info(
            `[IncomingCallHandler] Native-accept adoption complete — navigating to call ${callToAdopt.id}`,
          );
          onNavigateToCall?.(callToAdopt.id, mode);
        })
        .catch((err) => {
          console.error(
            "[IncomingCallHandler] Native accept adoption failed:",
            err,
          );
        })
        .finally(() => {
          acceptingRef.current = false;
        });
    }
  }, [allCalls, isBusy, activeSession, acceptCall, onNavigateToCall]);

  // Always show the most recent incoming call. Watching only the length can
  // miss call replacement when one ringing call disappears and another takes
  // its place in the same render frame.
  useEffect(() => {
    if (mostRecentIncomingCall) {
      const newCall = mostRecentIncomingCall;
      setPendingCall(newCall);
      if (checkedCallIdRef.current !== newCall.id) {
        setCallAllowed(null);
        checkedCallIdRef.current = null;
      }
    } else {
      setPendingCall(null);
      setCallAllowed(null);
      checkedCallIdRef.current = null;
    }
  }, [mostRecentIncomingCall]);

  // Check DND / privacy settings when a new incoming call is detected
  useEffect(() => {
    if (!pendingCall || isBusy || !callSettingsSvc) return;
    // Already checked this call
    if (checkedCallIdRef.current === pendingCall.id) return;

    const callerId = pendingCall.state.createdBy?.id;
    if (!callerId) {
      // Can't determine caller — allow through (fail open)
      setCallAllowed(true);
      checkedCallIdRef.current = pendingCall.id;
      return;
    }

    let cancelled = false;
    const currentUid = currentFirebaseUser?.uid;

    (async () => {
      try {
        // Determine friendship status
        let isFriend = false;
        if (profileSvc?.getRelationship && currentUid) {
          const rel = await profileSvc.getRelationship(currentUid, callerId);
          if (cancelled) return;
          isFriend = rel.type === "friend";
        }

        const { allowed, reason } = await callSettingsSvc.shouldAllowCall(
          callerId,
          isFriend,
        );
        if (cancelled) return;

        if (!allowed) {
          console.info(`[IncomingCallHandler] Auto-rejecting call: ${reason}`);
          await rejectCall(pendingCall, "decline");
          setPendingCall(null);
          setCallAllowed(null);
        } else {
          setCallAllowed(true);
          checkedCallIdRef.current = pendingCall.id;
        }
      } catch (err) {
        // On error, allow the call through (fail open)
        if (!cancelled) {
          console.warn(
            "[IncomingCallHandler] shouldAllowCall check failed:",
            err,
          );
          setCallAllowed(true);
          checkedCallIdRef.current = pendingCall.id;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingCall, isBusy, currentFirebaseUser?.uid, rejectCall]);

  const handleAccept = useCallback(async () => {
    if (!pendingCall) return;

    const mode =
      (pendingCall.state.custom?.mode as "audio" | "video") ?? "audio";
    const callToAccept = pendingCall;

    // Set the accepting guard BEFORE any async work. This prevents the
    // auto-reject effect from firing between the moment acceptCall commits
    // isBusy=true and when we clear pendingCall below.
    acceptingRef.current = true;
    setPendingCall(null);

    try {
      await acceptCall(callToAccept);
      onNavigateToCall?.(callToAccept.id, mode);
    } catch (err) {
      console.error("[IncomingCallHandler] Accept failed:", err);
      // Restore the pending call so the user can retry or decline.
      // Only restore if the call is still ringing — if it moved to another
      // state (e.g. the caller hung up), Stream's useCalls() will handle it.
      if (callToAccept.state.callingState === CallingState.RINGING) {
        setPendingCall(callToAccept);
        setCallAllowed(true);
        checkedCallIdRef.current = callToAccept.id;
      }
    } finally {
      acceptingRef.current = false;
    }
  }, [pendingCall, acceptCall, onNavigateToCall]);

  const handleDecline = useCallback(async () => {
    if (!pendingCall) return;

    try {
      await rejectCall(pendingCall, "decline");
      setPendingCall(null);
    } catch (err) {
      console.error("[IncomingCallHandler] Decline failed:", err);
    }
  }, [pendingCall, rejectCall]);

  // Auto-reject incoming calls when user is already busy, but NOT when
  // we are in the middle of accepting a call (acceptingRef guards this).
  useEffect(() => {
    if (acceptingRef.current) return;
    if (isBusy && activeSession && pendingCall) {
      rejectCall(pendingCall, "busy").catch((err) =>
        console.warn("[IncomingCallHandler] Auto-reject failed:", err),
      );
      setPendingCall(null);
    }
  }, [isBusy, activeSession, pendingCall, rejectCall]);

  // ── Incoming ringtone + vibration ──────────────────────────────────────
  // Play the incoming call ringtone while the call overlay is displayed.
  // Stops automatically when the call is answered, declined, or disappears.
  useEffect(() => {
    if (!pendingCall || callAllowed !== true || isBusy) {
      ringtoneService?.stopRingtone();
      return;
    }

    ringtoneService?.startRingtone("incoming", true, true);

    return () => {
      ringtoneService?.stopRingtone();
    };
  }, [pendingCall, callAllowed, isBusy]);

  if (!pendingCall) return null;

  // Don't show incoming UI while busy (effect above handles rejection)
  if (isBusy && activeSession) return null;

  // Wait for shouldAllowCall check to complete before showing UI
  if (callAllowed !== true) return null;

  // Derive caller info from the call state
  const callerName =
    pendingCall.state.createdBy?.name ??
    pendingCall.state.createdBy?.id ??
    "Unknown";
  const mode = (pendingCall.state.custom?.mode as "audio" | "video") ?? "audio";
  const isVideo = mode === "video";

  return (
    <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.85)" }]}>
      <View style={styles.content}>
        {/* Caller Info */}
        <View style={styles.callerSection}>
          <View
            style={[styles.avatarCircle, { backgroundColor: colors.primary }]}
          >
            <MaterialCommunityIcons
              name={isVideo ? "video" : "phone"}
              size={40}
              color="#fff"
            />
          </View>
          <Text style={styles.callerName}>{callerName}</Text>
          <Text style={styles.callType}>
            Incoming {isVideo ? "Video" : "Audio"} Call
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.declineButton]}
            onPress={handleDecline}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="phone-hangup"
              size={32}
              color="#fff"
            />
            <Text style={styles.actionLabel}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={handleAccept}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="phone" size={32} color="#fff" />
            <Text style={styles.actionLabel}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  content: {
    width: SCREEN_WIDTH * 0.85,
    alignItems: "center",
    paddingVertical: 40,
  },
  callerSection: {
    alignItems: "center",
    marginBottom: 60,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  callerName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  callType: {
    fontSize: 16,
    color: "rgba(255,255,255,0.7)",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    paddingHorizontal: 40,
  },
  actionButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  declineButton: {
    backgroundColor: "#E53935",
  },
  acceptButton: {
    backgroundColor: "#43A047",
  },
  actionLabel: {
    color: "#fff",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
});
