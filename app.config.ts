import { ExpoConfig, ConfigContext } from "expo/config";

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
      foregroundImage: "./src/assets/icon.png",
      backgroundColor: "#eff1f5",
    },
    package: "com.vibeapp.mobile",
  },
  web: {
    favicon: "./src/assets/favicon.png",
  },
  scheme: "vibe",
});
