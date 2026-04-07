/**
 * Floating Video Overlay
 *
 * Shows a small draggable window with the remote participant's video when
 * the user minimizes (navigates away from) an active video call. The overlay
 * persists across navigation without interrupting touch handling on the
 * underlying screens.
 *
 * Uses PanResponder for drag, and renders in a portal-like absolute
 * positioned view at the app root level.
 */

import { useStreamCall } from "@/contexts/StreamCallContext";
import { navigate } from "@/services/navigationRef";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

// Lazy-load Stream SDK components
let ParticipantView: any = null;
let useCallStateHooks: any = null;
let useIsInPiPMode: () => boolean = () => false;
let CallingState: any = null;
let hasVideo: any = null;
let StreamCall: any = null;
try {
  const sdk = require("@stream-io/video-react-native-sdk");
  ParticipantView = sdk.ParticipantView;
  useCallStateHooks = sdk.useCallStateHooks;
  useIsInPiPMode = sdk.useIsInPiPMode ?? useIsInPiPMode;
  CallingState = sdk.CallingState;
  StreamCall = sdk.StreamCall;
  hasVideo = require("@stream-io/video-client").hasVideo;
} catch {
  // Not available
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const PIP_WIDTH = 140;
const PIP_HEIGHT = 200;
const MARGIN = 12;

// Default position: bottom-right corner
const DEFAULT_X = SCREEN_W - PIP_WIDTH - MARGIN;
const DEFAULT_Y = SCREEN_H - PIP_HEIGHT - 120; // Above tab bar

interface FloatingVideoOverlayProps {
  /** Whether the user is currently on the DirectCallScreen */
  isOnCallScreen: boolean;
}

export function FloatingVideoOverlay({
  isOnCallScreen,
}: FloatingVideoOverlayProps) {
  const { activeCall, activeSession } = useStreamCall();
  const isInPiPMode = useIsInPiPMode();

  const isDirectCall = activeSession?.type === "direct_call";
  const isVideoCall = isDirectCall && activeSession.mode === "video";
  const isAudioCall = isDirectCall && activeSession.mode === "audio";

  // Show for any active direct call when NOT on the call screen
  const shouldShow =
    !isInPiPMode && !isOnCallScreen && isDirectCall && !!activeCall;

  if (!shouldShow || !activeCall) return null;

  // Audio calls: show a compact "Return to call" banner (no Stream video needed)
  if (isAudioCall) {
    return (
      <FloatingAudioBanner
        activeCall={activeCall}
        activeSession={activeSession}
      />
    );
  }

  // Video calls: wrap in StreamCall for video rendering
  if (!StreamCall) return null;
  return (
    <StreamCall call={activeCall}>
      <FloatingVideoContent activeCall={activeCall} />
    </StreamCall>
  );
}

/**
 * FloatingAudioBanner — draggable pill for minimized audio/phone calls.
 * Tap to navigate back to the DirectCall screen.
 */
function FloatingAudioBanner({
  activeCall,
  activeSession,
}: {
  activeCall: any;
  activeSession: NonNullable<ReturnType<typeof useStreamCall>["activeSession"]>;
}) {
  const { colors } = useAppTheme();

  const handleRestoreCall = useCallback(() => {
    navigate("DirectCall", {
      callId: activeCall.id,
      recipientName:
        activeSession.type === "direct_call"
          ? (activeSession.recipientName ?? "")
          : "",
      mode: "audio",
      isOutgoing: !!activeCall.isCreatedByMe,
    });
  }, [activeCall.id, activeCall.isCreatedByMe, activeSession]);

  // Pan responder for drag
  const pan = useRef(
    new Animated.ValueXY({ x: DEFAULT_X, y: DEFAULT_Y }),
  ).current;
  const lastOffset = useRef({ x: DEFAULT_X, y: DEFAULT_Y });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {
        pan.setOffset(lastOffset.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();

        const currentX = lastOffset.current.x + gestureState.dx;
        const currentY = lastOffset.current.y + gestureState.dy;

        const snapX =
          currentX < SCREEN_W / 2 ? MARGIN : SCREEN_W - PIP_WIDTH - MARGIN;
        const snapY = Math.max(
          MARGIN + 50,
          Math.min(currentY, SCREEN_H - PIP_HEIGHT - 120),
        );

        lastOffset.current = { x: snapX, y: snapY };

        Animated.spring(pan, {
          toValue: { x: snapX, y: snapY },
          useNativeDriver: false,
          friction: 7,
        }).start();
      },
    }),
  ).current;

  return (
    <Animated.View
      style={[
        styles.minimizedPill,
        {
          backgroundColor: colors.primary,
          transform: pan.getTranslateTransform(),
        },
      ]}
      {...panResponder.panHandlers}
    >
      <Pressable
        onPress={handleRestoreCall}
        hitSlop={8}
        style={styles.minimizedPillInner}
      >
        <MaterialCommunityIcons name="phone" size={20} color="#fff" />
        <Text style={styles.minimizedText}>Return to call</Text>
      </Pressable>
    </Animated.View>
  );
}

function FloatingVideoContent({ activeCall }: { activeCall: any }) {
  const { colors } = useAppTheme();
  const { useCallCallingState, useParticipants } = useCallStateHooks();

  const callingState = useCallCallingState();
  const participants = useParticipants();
  const isJoined = callingState === CallingState.JOINED;
  const callMode =
    activeCall?.state?.custom?.mode === "video" ? "video" : "audio";

  // Find remote participant with video
  const remoteWithVideo = participants.find(
    (p: any) => !p.isLocalParticipant && hasVideo(p),
  );

  const [minimized, setMinimized] = useState(false);
  const handleRestoreCall = useCallback(() => {
    navigate("DirectCall", {
      callId: activeCall.id,
      recipientName: "",
      mode: callMode,
      isOutgoing: !!activeCall.isCreatedByMe,
    });
  }, [activeCall.id, activeCall.isCreatedByMe, callMode]);

  // Pan responder for drag
  const pan = useRef(
    new Animated.ValueXY({ x: DEFAULT_X, y: DEFAULT_Y }),
  ).current;
  const lastOffset = useRef({ x: DEFAULT_X, y: DEFAULT_Y });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5,
      onPanResponderGrant: () => {
        pan.setOffset(lastOffset.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();

        // Snap to nearest edge
        const currentX = lastOffset.current.x + gestureState.dx;
        const currentY = lastOffset.current.y + gestureState.dy;

        const snapX =
          currentX < SCREEN_W / 2 ? MARGIN : SCREEN_W - PIP_WIDTH - MARGIN;
        const snapY = Math.max(
          MARGIN + 50, // Below status bar
          Math.min(currentY, SCREEN_H - PIP_HEIGHT - 120),
        );

        lastOffset.current = { x: snapX, y: snapY };

        Animated.spring(pan, {
          toValue: { x: snapX, y: snapY },
          useNativeDriver: false,
          friction: 7,
        }).start();
      },
    }),
  ).current;

  // Don't render if not joined or no remote video
  if (!isJoined || !remoteWithVideo) return null;

  if (minimized) {
    return (
      <Animated.View
        style={[
          styles.minimizedPill,
          {
            backgroundColor: colors.primary,
            transform: pan.getTranslateTransform(),
          },
        ]}
        {...panResponder.panHandlers}
      >
        <Pressable
          onPress={handleRestoreCall}
          hitSlop={8}
          style={styles.minimizedPillInner}
        >
          <MaterialCommunityIcons name="video" size={20} color="#fff" />
          <Text style={styles.minimizedText}>Return to call</Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: "#000",
          transform: pan.getTranslateTransform(),
        },
      ]}
      {...panResponder.panHandlers}
    >
      <Pressable style={styles.videoPressable} onPress={handleRestoreCall}>
        <ParticipantView
          participant={remoteWithVideo}
          trackType="videoTrack"
          style={styles.video}
          objectFit="cover"
          ParticipantLabel={null}
          ParticipantReaction={null}
          ParticipantNetworkQualityIndicator={null}
        />
      </Pressable>

      {/* Controls overlay */}
      <View style={styles.controls}>
        <Pressable
          onPress={() => setMinimized(true)}
          hitSlop={8}
          style={styles.controlButton}
        >
          <MaterialCommunityIcons name="minus" size={16} color="#fff" />
        </Pressable>
      </View>

      {/* Remote name label */}
      <View style={styles.nameLabel}>
        <Text style={styles.nameText} numberOfLines={1}>
          {remoteWithVideo.name || "Participant"}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    width: PIP_WIDTH,
    height: PIP_HEIGHT,
    borderRadius: 16,
    overflow: "hidden",
    zIndex: 9998,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  videoPressable: {
    flex: 1,
  },
  video: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  controls: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    gap: 4,
  },
  controlButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  nameLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  nameText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  minimizedPill: {
    position: "absolute",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 9998,
    elevation: 12,
  },
  minimizedPillInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  minimizedText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
