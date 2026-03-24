/**
 * Incoming Call Handler
 *
 * Replaces the legacy IncomingCallOverlay. Listens for incoming ringing calls
 * from Stream and presents the incoming call UI. This component is rendered
 * at the app root level.
 */

import { CALL_FEATURES } from "@/constants/featureFlags";
import { useStreamCall } from "@/contexts/StreamCallContext";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { Call } from "@stream-io/video-react-native-sdk";
import React, { useCallback, useEffect, useState } from "react";
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface IncomingCallHandlerProps {
  /** Callback to navigate to the active call screen after accepting */
  onNavigateToCall?: (callId: string, mode: "audio" | "video") => void;
}

export default function IncomingCallHandler({
  onNavigateToCall,
}: IncomingCallHandlerProps) {
  const { acceptCall, rejectCall, isBusy, activeSession } = useStreamCall();
  const { colors } = useAppTheme();

  // Get incoming ringing calls from Stream
  const allCalls = useCalls();
  const incomingCalls = allCalls.filter(
    (c) => c.state.callingState === CallingState.RINGING && !c.isCreatedByMe,
  );

  const [pendingCall, setPendingCall] = useState<Call | null>(null);

  // Always show the most recent incoming call
  useEffect(() => {
    if (incomingCalls.length > 0) {
      setPendingCall(incomingCalls[0]);
    } else {
      setPendingCall(null);
    }
  }, [incomingCalls.length]);

  const handleAccept = useCallback(async () => {
    if (!pendingCall) return;

    const mode =
      (pendingCall.state.custom?.mode as "audio" | "video") ?? "audio";

    try {
      await acceptCall(pendingCall);
      setPendingCall(null);
      onNavigateToCall?.(pendingCall.id, mode);
    } catch (err) {
      console.error("[IncomingCallHandler] Accept failed:", err);
    }
  }, [pendingCall, acceptCall, onNavigateToCall]);

  const handleDecline = useCallback(async () => {
    if (!pendingCall) return;

    try {
      await rejectCall(pendingCall);
      setPendingCall(null);
    } catch (err) {
      console.error("[IncomingCallHandler] Decline failed:", err);
    }
  }, [pendingCall, rejectCall]);

  if (!pendingCall) return null;

  // If user is already busy, auto-reject incoming calls
  if (isBusy && activeSession) {
    if (pendingCall) {
      rejectCall(pendingCall).catch((err) =>
        console.warn("[IncomingCallHandler] Auto-reject failed:", err),
      );
    }
    return null;
  }

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
