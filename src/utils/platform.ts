/**
 * Platform Utilities
 * Provides helpers for platform detection and capability checking
 */

import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Check if running on web platform
 */
export const isWeb = Platform.OS === "web";

/**
 * Check if running on iOS
 */
export const isIOS = Platform.OS === "ios";

/**
 * Check if running on Android
 */
export const isAndroid = Platform.OS === "android";

/**
 * Check if running in Expo Go (managed workflow without native modules)
 * This is important because native modules like react-native-webrtc
 * and react-native-callkeep don't work in Expo Go
 */
export const isExpoGo = Constants.appOwnership === "expo";

/**
 * Check if running in a development build (bare workflow with native modules)
 * In SDK 52+, AppOwnership only contains "expo" - null means bare/standalone
 */
export const isDevBuild =
  Constants.appOwnership === null || Constants.executionEnvironment === "bare";

/**
 * Check if native call features are available
 * Native calls require:
 * 1. Not running on web
 * 2. Not running in Expo Go (needs development build)
 */
export const areNativeCallsAvailable = !isWeb && !isExpoGo;

/**
 * Check if WebRTC is available
 * WebRTC native module only works on iOS/Android with dev builds
 */
export const isWebRTCAvailable = areNativeCallsAvailable;

/**
 * Check if CallKeep (native call UI) is available
 */
export const isCallKeepAvailable = areNativeCallsAvailable;

/**
 * Log platform info for debugging
 */
export function logPlatformInfo(): void {
  console.log("[Platform] Info:", {
    os: Platform.OS,
    version: Platform.Version,
    isWeb,
    isExpoGo,
    isDevBuild,
    areNativeCallsAvailable,
    appOwnership: Constants.appOwnership,
    executionEnvironment: Constants.executionEnvironment,
  });
}
