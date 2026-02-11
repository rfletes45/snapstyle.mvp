/**
 * ThreeCanvas — Foundation component for Three.js rendering in React Native
 *
 * Wraps expo-gl's GLView and expo-three's Renderer into a reusable canvas
 * that manages the Three.js scene lifecycle:
 *   - Creates WebGL context via GLView
 *   - Instantiates THREE.WebGLRenderer via expo-three
 *   - Provides scene, camera, renderer refs to children via context
 *   - Manages animation loop with requestAnimationFrame
 *   - Handles cleanup on unmount
 *   - Supports transparent backgrounds for overlay usage
 *
 * Usage:
 *   <ThreeCanvas
 *     style={{ width: 300, height: 200 }}
 *     onSceneReady={(ctx) => { ... setup meshes ... }}
 *     onFrame={(ctx, dt) => { ... animate ... }}
 *   />
 *
 * @see docs/VISUAL_ENHANCEMENT_PACKAGES.md
 */

import { ExpoWebGLRenderingContext, GLView } from "expo-gl";
import { Renderer } from "expo-three";
import React, { memo, useCallback, useEffect, useRef } from "react";
import { Platform, StyleProp, StyleSheet, ViewStyle } from "react-native";
import {
  AmbientLight,
  Clock,
  Color,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";

// =============================================================================
// Types
// =============================================================================

export interface ThreeContext {
  gl: ExpoWebGLRenderingContext;
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  width: number;
  height: number;
}

export interface ThreeCanvasProps {
  /** Called once when the GL context and scene are ready */
  onSceneReady?: (ctx: ThreeContext) => void;
  /** Called every frame with delta time in seconds */
  onFrame?: (ctx: ThreeContext, delta: number) => void;
  /** Background color (hex). Use null for transparent. */
  backgroundColor?: string | null;
  /** Background alpha (0-1). Default 1. */
  backgroundAlpha?: number;
  /** Camera field of view. Default 75. */
  fov?: number;
  /** Camera near plane. Default 0.1. */
  near?: number;
  /** Camera far plane. Default 1000. */
  far?: number;
  /** Camera z position. Default 5. */
  cameraZ?: number;
  /** Whether to add default ambient light. Default true. */
  addAmbientLight?: boolean;
  /** Ambient light intensity. Default 1. */
  ambientIntensity?: number;
  /** Whether animation loop is active. Default true. */
  isActive?: boolean;
  /** Container style */
  style?: StyleProp<ViewStyle>;
  /** MSAA samples for iOS. Default 4. */
  msaaSamples?: number;
  /** Test ID */
  testID?: string;
}

// =============================================================================
// Component
// =============================================================================

function ThreeCanvasComponent({
  onSceneReady,
  onFrame,
  backgroundColor = "#000000",
  backgroundAlpha = 1,
  fov = 75,
  near = 0.1,
  far = 1000,
  cameraZ = 5,
  addAmbientLight = true,
  ambientIntensity = 1,
  isActive = true,
  style,
  msaaSamples = 4,
  testID,
}: ThreeCanvasProps) {
  const ctxRef = useRef<ThreeContext | null>(null);
  const clockRef = useRef(new Clock());
  const frameIdRef = useRef<number | null>(null);
  const isActiveRef = useRef(isActive);
  const onFrameRef = useRef(onFrame);

  // Keep refs current without re-triggering effects
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  // Animation loop
  const animate = useCallback(() => {
    if (!isActiveRef.current || !ctxRef.current) return;

    const delta = clockRef.current.getDelta();
    const ctx = ctxRef.current;

    // Call user's frame callback
    if (onFrameRef.current) {
      onFrameRef.current(ctx, delta);
    }

    // Render the scene
    ctx.renderer.render(ctx.scene, ctx.camera);

    // Signal expo-gl that the frame is ready
    ctx.gl.endFrameEXP();

    // Schedule next frame
    frameIdRef.current = requestAnimationFrame(animate);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
      if (ctxRef.current) {
        ctxRef.current.renderer.dispose();
        ctxRef.current = null;
      }
    };
  }, []);

  // GL context creation handler
  const handleContextCreate = useCallback(
    (gl: ExpoWebGLRenderingContext) => {
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;

      // Create renderer
      const renderer = new Renderer({ gl }) as unknown as WebGLRenderer;
      renderer.setSize(width, height);
      renderer.setPixelRatio(1); // expo-gl handles pixel ratio

      if (backgroundColor === null) {
        renderer.setClearColor(new Color(0x000000), 0);
      } else {
        renderer.setClearColor(new Color(backgroundColor), backgroundAlpha);
      }

      // Create scene
      const scene = new Scene();
      if (backgroundColor !== null) {
        scene.background = new Color(backgroundColor);
      }

      // Create camera
      const camera = new PerspectiveCamera(fov, width / height, near, far);
      camera.position.z = cameraZ;

      // Add default ambient light
      if (addAmbientLight) {
        const ambient = new AmbientLight(0xffffff, ambientIntensity);
        scene.add(ambient);
      }

      // Store context
      const ctx: ThreeContext = { gl, renderer, scene, camera, width, height };
      ctxRef.current = ctx;

      // Notify consumer
      if (onSceneReady) {
        onSceneReady(ctx);
      }

      // Start render loop
      clockRef.current.start();
      frameIdRef.current = requestAnimationFrame(animate);
    },
    [
      backgroundColor,
      backgroundAlpha,
      fov,
      near,
      far,
      cameraZ,
      addAmbientLight,
      ambientIntensity,
      onSceneReady,
      animate,
    ],
  );

  // On web, GLView may not be supported — render nothing gracefully
  if (Platform.OS === "web") {
    return null;
  }

  return (
    <GLView
      style={[styles.canvas, style]}
      onContextCreate={handleContextCreate}
      msaaSamples={msaaSamples}
      testID={testID}
    />
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
});

// =============================================================================
// Export
// =============================================================================

export const ThreeCanvas = memo(ThreeCanvasComponent);
export default ThreeCanvas;
