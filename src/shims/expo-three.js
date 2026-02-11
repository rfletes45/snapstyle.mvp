/**
 * Shim for expo-three on web platform
 *
 * expo-three bridges Three.js with expo-gl's native GL context.
 * On web, this bridge is unnecessary since Three.js can use
 * standard HTMLCanvasElement directly.
 *
 * All Three.js components already guard with Platform.OS === "web"
 * and return null, so this shim is never actually called.
 */

class Renderer {
  constructor() {}
  setSize() {}
  setPixelRatio() {}
  setClearColor() {}
  render() {}
  dispose() {}
}

class TextureLoader {
  load() {
    return {};
  }
}

module.exports = {
  Renderer,
  TextureLoader,
  loadAsync: async () => ({}),
};
