/**
 * Expo config plugin that resolves the Android manifest conflict between
 * expo-notifications and @react-native-firebase/messaging for
 * `com.google.firebase.messaging.default_notification_color`.
 *
 * Expo writes the app's chosen notification color into the main manifest,
 * while RN Firebase Messaging contributes the same metadata key with its own
 * default. The Android manifest merger requires an explicit override.
 */
const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");

const META_DATA_NAME =
  "com.google.firebase.messaging.default_notification_color";
const NOTIFICATION_COLOR_RESOURCE = "@color/notification_icon_color";

function mergeToolsReplaceValue(existingValue, requiredValue) {
  const values = new Set(
    String(existingValue || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  values.add(requiredValue);
  return Array.from(values).join(",");
}

module.exports = function withFirebaseMessagingColorOverride(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = AndroidConfig.Manifest.ensureToolsAvailable(
      config.modResults,
    );
    const mainApplication =
      AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    let metaDataIndex = AndroidConfig.Manifest.findMetaDataItem(
      mainApplication,
      META_DATA_NAME,
    );

    if (metaDataIndex === -1) {
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        mainApplication,
        META_DATA_NAME,
        NOTIFICATION_COLOR_RESOURCE,
        "resource",
      );
      metaDataIndex = AndroidConfig.Manifest.findMetaDataItem(
        mainApplication,
        META_DATA_NAME,
      );
    }

    const metaDataItem = mainApplication["meta-data"]?.[metaDataIndex];
    if (metaDataItem?.$) {
      metaDataItem.$["android:resource"] = NOTIFICATION_COLOR_RESOURCE;
      metaDataItem.$["tools:replace"] = mergeToolsReplaceValue(
        metaDataItem.$["tools:replace"],
        "android:resource",
      );
    }

    config.modResults = manifest;
    return config;
  });
};
