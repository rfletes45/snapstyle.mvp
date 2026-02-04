/**
 * Call Screens - Barrel Export
 *
 * IMPORTANT: VideoCallScreen and GroupCallScreen require react-native-webrtc
 * which only works on native platforms with development builds.
 * On web and Expo Go, stub screens are provided.
 */

import Constants from "expo-constants";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

// Platform detection
const isWeb = Platform.OS === "web";
const isExpoGo = Constants.appOwnership === "expo";
const areNativeCallsAvailable = !isWeb && !isExpoGo;

// Platform-agnostic screens (no native dependencies)
export { AudioCallScreen } from "./AudioCallScreen";
export { CallHistoryScreen } from "./CallHistoryScreen";
export { CallSettingsScreen } from "./CallSettingsScreen";

// Stub component for unavailable screens - using React.createElement to avoid JSX in .ts file
const UnavailableScreen = ({ screenName }: { screenName: string }) =>
  React.createElement(
    View,
    { style: styles.container },
    React.createElement(Text, { style: styles.title }, "Not Available"),
    React.createElement(
      Text,
      { style: styles.message },
      `${screenName} requires a development build and is not available on ${isWeb ? "web" : "Expo Go"}.`,
    ),
    React.createElement(
      Text,
      { style: styles.hint },
      "Please run the app on a device with a development build to use video calls.",
    ),
  );

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#1a1a2e",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: "#cccccc",
    textAlign: "center",
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: "#888888",
    textAlign: "center",
  },
});

// Native-dependent screens - export stubs on unsupported platforms
let VideoCallScreen: React.ComponentType<any>;
let GroupCallScreen: React.ComponentType<any>;

if (areNativeCallsAvailable) {
  // Only require native modules on supported platforms
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  VideoCallScreen = require("./VideoCallScreen").VideoCallScreen;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  GroupCallScreen = require("./GroupCallScreen").GroupCallScreen;
} else {
  // Provide stub screens for web/Expo Go
  VideoCallScreen = () =>
    React.createElement(UnavailableScreen, { screenName: "Video Calls" });
  GroupCallScreen = () =>
    React.createElement(UnavailableScreen, { screenName: "Group Calls" });
}

export { GroupCallScreen, VideoCallScreen };
