/**
 * ActiveCallBanner
 *
 * Floating pill shown at the top of the app when the user is in an active
 * call or voice channel but has navigated away from the call screen.
 * Tapping it returns to the active call screen.
 *
 * This is rendered at the root navigator level, above all screens.
 */

import { CALL_FEATURES } from "@/constants/featureFlags";
import { useStreamCall } from "@/contexts/StreamCallContext";
import { navigationRef } from "@/services/navigationRef";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function ActiveCallBanner() {
  if (!CALL_FEATURES.CALLS_ENABLED) return null;

  return <ActiveCallBannerInner />;
}

function ActiveCallBannerInner() {
  const { activeSession, isBusy } = useStreamCall();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  // Track elapsed time
  const [elapsed, setElapsed] = useState(0);

  // Track current route name using the global navigationRef
  // (useNavigationState requires being inside a navigator; this component
  // is rendered as a sibling of the navigator, so we use the ref instead)
  const [currentRouteName, setCurrentRouteName] = useState("");

  const updateRouteName = useCallback(() => {
    if (navigationRef.isReady()) {
      setCurrentRouteName(navigationRef.getCurrentRoute()?.name ?? "");
    }
  }, []);

  useEffect(() => {
    // Set initial route name
    updateRouteName();

    // Listen for navigation state changes
    const unsubscribe = navigationRef.addListener(
      "state" as any,
      updateRouteName,
    );
    return unsubscribe;
  }, [updateRouteName]);

  // The banner is visible when: user is in a call AND not currently on a call screen
  const isOnCallScreen =
    currentRouteName === "DirectCall" || currentRouteName === "VoiceChannel";
  const isVisible = isBusy && !isOnCallScreen;

  // Timer for elapsed display
  useEffect(() => {
    if (!isBusy) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [isBusy]);

  if (!isVisible) return null;

  const isVoiceRoom = activeSession?.type === "voice_channel";
  const timeStr = `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, "0")}`;

  const handlePress = () => {
    if (!navigationRef.isReady()) return;

    if (activeSession?.type === "direct_call") {
      navigationRef.navigate("DirectCall" as any, {
        callId: activeSession.callId,
        recipientName: activeSession.recipientName ?? "",
        mode: activeSession.mode ?? "audio",
        isOutgoing: true,
      });
    } else if (activeSession?.type === "voice_channel") {
      navigationRef.navigate("VoiceChannel" as any, {
        channelId: activeSession.channelId,
        channelName: activeSession.channelName ?? "Voice Room",
        groupId: activeSession.groupId ?? "",
      });
    }
  };

  return (
    <View
      style={[styles.wrapper, { top: insets.top }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.banner,
          {
            backgroundColor: isVoiceRoom ? "#43A047" : colors.primary,
          },
          pressed && styles.bannerPressed,
        ]}
        accessibilityLabel={`Return to active ${isVoiceRoom ? "voice room" : "call"}`}
        accessibilityRole="button"
      >
        <View style={styles.dot} />
        <MaterialCommunityIcons
          name={isVoiceRoom ? "headphones" : "phone"}
          size={16}
          color="#fff"
        />
        <Text style={styles.bannerText}>
          {isVoiceRoom ? "Voice Room" : "In Call"} · {timeStr}
        </Text>
        <Text style={styles.tapHint}>Tap to return</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: "center",
    pointerEvents: "box-none",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  bannerPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
    opacity: 0.8,
  },
  bannerText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  tapHint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "500",
    marginLeft: 4,
  },
});
