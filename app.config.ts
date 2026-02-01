import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Vibe",
  slug: "vibe-app",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.vibeapp.mobile",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: undefined, // Icon will be added later
      backgroundColor: "#eff1f5",
    },
    package: "com.vibeapp.mobile",
  },
  web: {
    favicon: "./src/assets/favicon.png",
  },
  scheme: "vibe",
  plugins: ["expo-audio", "expo-sqlite"],
});
