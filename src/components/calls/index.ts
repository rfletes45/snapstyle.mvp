/**
 * Call Components - Barrel Export
 *
 * IMPORTANT: Some components (VideoGrid, SpeakerView) require react-native-webrtc
 * which only works on native platforms with development builds.
 * These are NOT exported here to prevent crashes on web/Expo Go.
 *
 * To use VideoGrid or SpeakerView, import them directly and ensure
 * you only render them on supported platforms.
 */

import Constants from "expo-constants";
import { Platform } from "react-native";

// Platform detection
const isWeb = Platform.OS === "web";
const isExpoGo = Constants.appOwnership === "expo";
export const areNativeCallsAvailable = !isWeb && !isExpoGo;

// Safe components (no native dependencies)
export { CallButton, CallButtonGroup } from "./CallButton";
export { CallControls, MinimalCallControls } from "./CallControls";
export {
  BandwidthStatsDisplay,
  CallQualityIndicator,
  ConnectionStatusIndicator,
} from "./CallQualityIndicator";
export type { BandwidthStats, NetworkQuality } from "./CallQualityIndicator";
export { IncomingCallOverlay } from "./IncomingCallOverlay";
export { MissedCallBadge, useMissedCallCount } from "./MissedCallBadge";
export { ParticipantListOverlay } from "./ParticipantListOverlay";

// Native-only components - import directly with platform checks
// export { VideoGrid } from "./VideoGrid"; // Requires react-native-webrtc
// export { SpeakerView } from "./SpeakerView"; // Requires react-native-webrtc
