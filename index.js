/**
 * Application Entry Point
 *
 * Configures Stream push notification handling BEFORE the React tree mounts.
 * This is critical because the app may be launched from a terminated state
 * by an incoming call push notification, and the SDK needs its config
 * available immediately on JS bridge init.
 */

// 1. Configure Stream Video push notification handlers
require("./src/utils/setPushConfig").setPushConfig();

// 2. Register Firebase/Notifee message listeners (Android only — iOS is a no-op)
require("./src/utils/setFirebaseListeners").setFirebaseListeners();

// 3. Hand off to Expo's default AppEntry which registers App as the root component
require("expo/AppEntry");
