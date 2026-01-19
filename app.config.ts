import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "SnapStyle",
  slug: "snapstyle-mvp",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./src/assets/icon.png",
      backgroundColor: "#ffffff",
    },
  },
  web: {
    favicon: "./src/assets/favicon.png",
  },
});
