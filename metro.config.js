/**
 * Metro configuration for React Native/Expo
 * Excludes the firebase-backend folder from bundling
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

module.exports = config;
