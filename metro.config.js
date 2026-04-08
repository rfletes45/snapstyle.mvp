/**
 * Metro configuration for React Native/Expo
 * Excludes the firebase-backend folder from bundling
 * Provides platform-specific resolution for native modules
 */
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Exclude the firebase and firebase-backend folders from being bundled (server-side code)
const firebaseBackendPath = path.resolve(__dirname, "firebase-backend");
const firebasePath = path.resolve(__dirname, "firebase");
config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  new RegExp(`${firebaseBackendPath.replace(/\\/g, "\\\\")}`),
  new RegExp(`${firebasePath.replace(/\\/g, "\\\\")}`),
];

// Prioritize .web.ts/.web.tsx files on web platform
// This ensures native-only modules get web stubs
config.resolver.sourceExts = [...(config.resolver.sourceExts || [])];

// Expo SQLite's experimental web runtime loads a wasm worker bundle.
// Adding `wasm` here keeps Metro aligned with Expo's current web setup.
config.resolver.assetExts = [
  ...new Set([...(config.resolver.assetExts || []), "wasm"]),
];

// Add platform-specific extensions for web
// Metro will automatically prefer .web.ts over .ts on web platform
config.resolver.resolverMainFields = ["react-native", "browser", "main"];

// Set condition names so package.json "exports" maps resolve correctly.
// This ensures packages that offer both Node.js and browser entry points
// resolve to the browser/RN build (which avoids importing 'https', 'http',
// 'url' - unavailable in React Native).
// NOTE: "default" is used instead of "import" to avoid pulling ESM-only
// entry points for CJS helpers like @babel/runtime/helpers/* - using
// "import" causes `_interopRequireDefault is not a function (it is Object)`.
config.resolver.unstable_conditionNames = [
  "react-native",
  "browser",
  "require",
  "default",
];

// Provide shims for native modules on web
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Only apply shims on web platform
  if (platform === "web") {
    // Shim tslib to fix ESM interop issues with react-remove-scroll and other packages
    // This fixes: "Cannot destructure property '__extends' of 'tslib.default' as it is undefined"
    if (moduleName === "tslib") {
      return {
        filePath: path.resolve(__dirname, "src/shims/tslib.js"),
        type: "sourceFile",
      };
    }

    // Shim react-native-webrtc on web
    if (moduleName === "react-native-webrtc") {
      return {
        filePath: path.resolve(__dirname, "src/shims/react-native-webrtc.js"),
        type: "sourceFile",
      };
    }

    // Shim @shopify/react-native-skia on web
    if (moduleName === "@shopify/react-native-skia") {
      return {
        filePath: path.resolve(__dirname, "src/shims/react-native-skia.js"),
        type: "sourceFile",
      };
    }
  }

  // Use default resolver for everything else
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
