/**
 * Application Entry Point
 *
 * Configures Stream push notification handling BEFORE the React tree mounts.
 * This is critical because the app may be launched from a terminated state
 * by an incoming call push notification, and the SDK needs its config
 * available immediately on JS bridge init.
 */

require("react-native-gesture-handler");

function runOptionalBootstrapTask(name, task) {
  try {
    task();
  } catch (error) {
    console.warn(`[BOOT] Optional bootstrap task "${name}" failed:`, error);
  }
}

// 1. Configure Stream Video push notification handlers
runOptionalBootstrapTask("setPushConfig", () => {
  require("./src/utils/setPushConfig").setPushConfig();
});

// 2. Register Firebase/Notifee message listeners (Android only — iOS is a no-op)
runOptionalBootstrapTask("setFirebaseListeners", () => {
  require("./src/utils/setFirebaseListeners").setFirebaseListeners();
});

const { StyleSheet } = require("react-native");
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#10131a",
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 32,
  },
  title: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
  },
  subtitle: {
    color: "#c8d1e1",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  message: {
    color: "#ffb4ab",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  stackContainer: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#171c26",
  },
  stackContent: {
    padding: 16,
  },
  stack: {
    color: "#d7dfef",
    fontSize: 12,
    lineHeight: 18,
  },
});

function createBootFailureScreen(error) {
  const React = require("react");
  const { ScrollView, Text, View } = require("react-native");

  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const stack =
    error && typeof error === "object" && "stack" in error
      ? String(error.stack)
      : null;

  return function BootFailureScreen() {
    return React.createElement(
      View,
      { style: styles.container },
      React.createElement(Text, { style: styles.title }, "App failed to start"),
      React.createElement(
        Text,
        { style: styles.subtitle },
        "Expo Go registered the app, but a startup module threw before the main UI could load.",
      ),
      React.createElement(Text, { style: styles.message }, message),
      stack
        ? React.createElement(
            ScrollView,
            {
              style: styles.stackContainer,
              contentContainerStyle: styles.stackContent,
            },
            React.createElement(Text, { style: styles.stack }, stack),
          )
        : null,
    );
  };
}

const { registerRootComponent } = require("expo");

let RootComponent;
try {
  RootComponent = require("./App").default;
} catch (error) {
  console.error("[BOOT] Failed to load App.tsx:", error);
  RootComponent = createBootFailureScreen(error);
}

registerRootComponent(RootComponent);
