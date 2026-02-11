/**
 * Shim for expo-gl on web platform
 *
 * expo-gl provides native OpenGL context via GLView which is not
 * available on web. This shim provides a no-op stub so imports
 * resolve without errors at bundle time.
 *
 * All Three.js components already guard with Platform.OS === "web"
 * and return null, so this shim is never actually called.
 */

const GLView = () => null;
GLView.createContextAsync = async () => ({});

module.exports = {
  GLView,
  ExpoWebGLRenderingContext: {},
};
