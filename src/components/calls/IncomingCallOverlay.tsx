/**
 * IncomingCallOverlay - Full-screen overlay for incoming calls
 * Includes ringtone and vibration handling
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { JSX, useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallContext } from "@/contexts/CallContext";
import { ringtoneService } from "@/services/calls/ringtoneService";
import { useColors } from "@/store/ThemeContext";
import Avatar from "@/components/Avatar";


import { createLogger } from "@/utils/log";
const logger = createLogger("components/calls/IncomingCallOverlay");
const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface IncomingCallOverlayProps {
  /** Whether to show the overlay */
  visible?: boolean;
}

export function IncomingCallOverlay({
  visible: visibleProp,
}: IncomingCallOverlayProps): JSX.Element | null {
  const insets = useSafeAreaInsets();
  const {
    incomingCall,
    showIncomingCallUI,
    answerCall,
    declineCall,
    dismissIncomingCall,
  } = useCallContext();

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const isVisible = visibleProp ?? showIncomingCallUI;

  // Animation and ringtone effects
  useEffect(() => {
    if (isVisible && incomingCall) {
      // Start ringtone
      ringtoneService.playIncomingRingtone().catch((error) => {
        logger.warn("Failed to play ringtone:", error);
      });

      // Slide in and fade in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Pulse animation for avatar
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();

      return () => {
        pulse.stop();
        // Stop ringtone when overlay is dismissed
        ringtoneService.stopRingtone().catch(() => {});
      };
    } else {
      // Reset animations
      slideAnim.setValue(0);
      opacityAnim.setValue(0);
      pulseAnim.setValue(1);
    }
  }, [isVisible, incomingCall, slideAnim, opacityAnim, pulseAnim]);

  // Handle answer
  const handleAnswer = async () => {
    if (incomingCall) {
      try {
        // Stop ringtone immediately when answering
        await ringtoneService.stopRingtone();
        await answerCall(incomingCall.id);
      } catch (error) {
        logger.error("Failed to answer call:", error);
      }
    }
  };

  // Handle decline
  const handleDecline = async () => {
    if (incomingCall) {
      try {
        // Stop ringtone when declining
        await ringtoneService.stopRingtone();
        await declineCall(incomingCall.id);
      } catch (error) {
        logger.error("Failed to decline call:", error);
      }
    }
  };

  // Don't render if not visible or no incoming call
  if (!isVisible || !incomingCall) {
    return null;
  }

  // Get caller info
  const callerParticipant = incomingCall.participants[incomingCall.callerId];
  const callerName = callerParticipant?.displayName || "Unknown Caller";
  const isVideoCall = incomingCall.type === "video";
  const colors = useColors();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
        },
      ]}
    >
      <LinearGradient
        colors={["rgba(0,0,0,0.95)", "rgba(30,30,30,0.98)"]}
        style={styles.gradientContainer}
      >
        <Animated.View
          style={[
            styles.content,
            {
              paddingTop: insets.top + 40,
              paddingBottom: insets.bottom + 40,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Call Type Indicator */}
          <View style={styles.callTypeContainer}>
            <Ionicons
              name={isVideoCall ? "videocam" : "call"}
              size={20}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.callTypeText, { color: colors.textSecondary }]}
            >
              Incoming {isVideoCall ? "Video" : "Voice"} Call
            </Text>
          </View>

          {/* Caller Avatar */}
          <Animated.View
            style={[
              styles.avatarContainer,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <View style={styles.avatarRing}>
              {callerParticipant?.avatarConfig ? (
                <Avatar config={callerParticipant.avatarConfig} size={120} />
              ) : (
                <View
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    backgroundColor: colors.primary,
                  }}
                />
              )}
            </View>
          </Animated.View>

          {/* Caller Name */}
          <Text style={styles.callerName}>{callerName}</Text>

          {/* Spacer */}
          <View style={styles.spacer} />

          {/* Action Buttons */}
          <View style={styles.actions}>
            {/* Decline Button */}
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.error }]}
              onPress={handleDecline}
              activeOpacity={0.8}
              accessibilityLabel="Decline call"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={32} color="#fff" />
              <Text style={styles.actionText}>Decline</Text>
            </TouchableOpacity>

            {/* Answer Button */}
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.success }]}
              onPress={handleAnswer}
              activeOpacity={0.8}
              accessibilityLabel={
                isVideoCall ? "Answer with video" : "Answer call"
              }
              accessibilityRole="button"
            >
              <Ionicons
                name={isVideoCall ? "videocam" : "call"}
                size={32}
                color="#fff"
              />
              <Text style={styles.actionText}>
                {isVideoCall ? "Answer" : "Accept"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Swipe hint (optional) */}
          <Text style={styles.hintText}>Tap to answer or decline</Text>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  gradientContainer: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 24,
  },
  callTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 40,
  },
  callTypeText: {
    fontSize: 16,
    marginLeft: 8,
    fontWeight: "500",
  },
  avatarContainer: {
    marginBottom: 24,
  },
  avatarRing: {
    padding: 8,
    borderRadius: 80,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  callerName: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  spacer: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 60,
    marginBottom: 32,
  },
  actionButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  actionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  hintText: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.5)",
    textAlign: "center",
  },
});
