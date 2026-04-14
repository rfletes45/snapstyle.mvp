import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Vibe",
  slug: "snapstyle-mvp", // Must match EAS projectId slug
  version: "1.0.0",
  runtimeVersion: {
    policy: "appVersion",
  },
  orientation: "default",
  userInterfaceStyle: "automatic",
  icon: "./assets/images/icon.png",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.vibeapp.mobile",
    googleServicesFile: "./GoogleService-Info.plist",
    buildNumber: "37",
    infoPlist: {
      // Camera & Microphone permissions
      NSCameraUsageDescription: "Vibe needs camera access for video calls",
      NSMicrophoneUsageDescription: "Vibe needs microphone access for calls",
      // Photo library permission (required for App Store)
      NSPhotoLibraryUsageDescription:
        "Vibe needs photo library access to save and share photos",
      // Background modes used by Stream calls and notifications
      UIBackgroundModes: ["audio", "remote-notification", "fetch", "voip"],
    },
    entitlements: {
      "aps-environment": "production",
    },
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    googleServicesFile: "./google-services.json",
    adaptiveIcon: {
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
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
      // Vibration & wake
      "android.permission.VIBRATE",
      "android.permission.WAKE_LOCK",
      // Push notifications (Android 13+)
      "android.permission.POST_NOTIFICATIONS",
    ],
  },
  web: {
    output: "single",
    favicon: "./assets/images/favicon.png",
  },
  scheme: "vibe",
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  plugins: [
    "@react-native-community/datetimepicker",
    "./plugins/withVisionCameraFix",
    "./plugins/withFirebaseMessagingColorOverride",
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "16.0",
          useFrameworks: "static",
          forceStaticLinking: [
            "RNFBApp",
            "RNFBMessaging",
            "stream-react-native-webrtc",
          ],
        },
        android: {
          minSdkVersion: 26,
          compileSdkVersion: 35,
          targetSdkVersion: 35,
        },
      },
    ],
    "expo-audio",
    ["expo-sqlite", { enableFTS: true }],
    [
      "expo-notifications",
      {
        icon: "./assets/images/icon.png",
        color: "#ffffff",
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-screen-orientation",
      {
        initialOrientation: "PORTRAIT",
      },
    ],
    [
      "react-native-vision-camera",
      {
        cameraPermissionText:
          "Vibe needs camera access for photos, videos, and AR face effects",
        enableMicrophonePermission: true,
        microphonePermissionText:
          "Vibe needs microphone access for video recording",
        enableFrameProcessors: true,
      },
    ],
    // Stream Video SDK — ringing push notifications + CallKit/Notifee
    [
      "@stream-io/video-react-native-sdk",
      {
        // Screen share stays disabled in this build. The installed SDK/version
        // path in this repo still relies on native Stream screenshare setup,
        // and the app has not been configured for that end-to-end flow yet.
        // Native PiP and iOS multitasking camera access require a dev
        // build/native rebuild; this is not available in Expo Go.
        ringingPushNotifications: {
          disableVideoIos: false,
          includesCallsInRecentsIos: false,
          showWhenLockedAndroid: true,
        },
        androidKeepCallAlive: true,
        androidPictureInPicture: true,
        iOSEnableMultitaskingCameraAccess: true,
      },
    ],
    // Firebase messaging (Android push for incoming calls)
    "@react-native-firebase/app",
    "@react-native-firebase/messaging",
    // CallKeep (iOS CallKit integration)
    "@config-plugins/react-native-callkeep",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "a57e6af7-ac18-4751-90ee-3b9cda7ea645",
    },
    /**
     * Colyseus realtime game server URL.
     *
     * Resolution priority:
     * 1. COLYSEUS_URL env var (set via eas.json or CI)
     * 2. This value (for production builds)
     * 3. Auto-detect from Expo dev server host (dev client only)
     * 4. Fallback to localhost (dev only — never used in release)
     *
     * For production / TestFlight, set COLYSEUS_URL in your EAS build
     * secrets or eas.json env block to point to your deployed server:
     *   e.g. "wss://colyseus.yourdomain.com"
     */
    colyseusUrl: process.env.COLYSEUS_URL ?? undefined,
  },
  owner: "rfletes",
});
