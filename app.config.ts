import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Vibe",
  slug: "snapstyle-mvp", // Must match EAS projectId slug
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.vibeapp.mobile",
    infoPlist: {
      // Camera & Microphone permissions
      NSCameraUsageDescription: "Vibe needs camera access for video calls",
      NSMicrophoneUsageDescription: "Vibe needs microphone access for calls",
      // Background modes for calls
      UIBackgroundModes: ["audio", "voip", "remote-notification", "fetch"],
      // CallKit configuration
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: ["vibe-call"],
        },
      ],
    },
    entitlements: {
      "aps-environment": "production",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: undefined, // Icon will be added later
      backgroundColor: "#eff1f5",
    },
    package: "com.vibeapp.mobile",
    permissions: [
      // Camera & Microphone
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.MODIFY_AUDIO_SETTINGS",
      // Network
      "android.permission.INTERNET",
      "android.permission.ACCESS_NETWORK_STATE",
      // Bluetooth audio
      "android.permission.BLUETOOTH",
      "android.permission.BLUETOOTH_CONNECT",
      // Foreground service for calls
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_PHONE_CALL",
      "android.permission.FOREGROUND_SERVICE_MICROPHONE",
      "android.permission.FOREGROUND_SERVICE_CAMERA",
      // CallKeep / Connection Service
      "android.permission.BIND_TELECOM_CONNECTION_SERVICE",
      "android.permission.READ_PHONE_STATE",
      "android.permission.CALL_PHONE",
      // Vibration & wake
      "android.permission.VIBRATE",
      "android.permission.WAKE_LOCK",
    ],
  },
  web: {
    favicon: "./src/assets/favicon.png",
  },
  scheme: "vibe",
  plugins: [
    "expo-audio",
    "expo-sqlite",
    // Note: react-native-webrtc and react-native-callkeep require
    // expo-dev-client for native module support. They don't have
    // Expo config plugins but work with bare workflow / dev client.
  ],
});
