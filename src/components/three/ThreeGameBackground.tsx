/**
 * ThreeGameBackground — 3D animated background for game screens
 *
 * A full-screen Three.js background layer with:
 *   - Floating geometric shapes themed to the game category
 *   - Subtle parallax-like camera movement
 *   - Dynamic color palette from theme
 *   - Performance-optimized: low poly count, capped FPS
 *
 * Sits behind the game UI as position: absolute with pointerEvents="none".
 *
 * @see docs/VISUAL_ENHANCEMENT_PACKAGES.md
 */

import React, { memo, useCallback, useMemo } from "react";
import { Platform, StyleProp, StyleSheet, ViewStyle } from "react-native";
import {
  Color,
  DirectionalLight,
  FogExp2,
  Mesh,
  MeshStandardMaterial,
  PointLight,
} from "three";
import { ThreeCanvas, ThreeContext } from "./ThreeCanvas";
import {
  createDiceMesh,
  createGamePieceMesh,
  createGemMesh,
  createKnotMesh,
  createTorusMesh,
} from "./geometries";

// =============================================================================
// Types
// =============================================================================

export type GameBackgroundTheme =
  | "quick_play"
  | "puzzle"
  | "multiplayer"
  | "daily"
  | "victory"
  | "defeat"
  | "neutral";

export interface ThreeGameBackgroundProps {
  /** Visual theme for the background */
  theme: GameBackgroundTheme;
  /** Primary color override */
  primaryColor?: string;
  /** Secondary color override */
  secondaryColor?: string;
  /** Background color (solid fill behind 3D scene) */
  backgroundColor?: string;
  /** Number of floating shapes. Default 12. */
  shapeCount?: number;
  /** Whether to animate. Default true. */
  isActive?: boolean;
  /** Opacity of the 3D layer. Controlled via View opacity. */
  opacity?: number;
  /** Container style */
  style?: StyleProp<ViewStyle>;
  /** Test ID */
  testID?: string;
}

// =============================================================================
// Color Palettes
// =============================================================================

const THEME_PALETTES: Record<
  GameBackgroundTheme,
  { primary: string; secondary: string; bg: string }
> = {
  quick_play: { primary: "#FF6B6B", secondary: "#FF8E53", bg: "#1a0a0a" },
  puzzle: { primary: "#4ECDC4", secondary: "#44B09E", bg: "#0a1a18" },
  multiplayer: { primary: "#6C5CE7", secondary: "#A29BFE", bg: "#0d0a1a" },
  daily: { primary: "#FFD700", secondary: "#FFA500", bg: "#1a1500" },
  victory: { primary: "#FFD700", secondary: "#4CAF50", bg: "#0a1a0a" },
  defeat: { primary: "#FF5252", secondary: "#B71C1C", bg: "#1a0505" },
  neutral: { primary: "#607D8B", secondary: "#90A4AE", bg: "#0a0f12" },
};

// =============================================================================
// Component
// =============================================================================

interface FloatingShape {
  mesh: Mesh;
  basePos: { x: number; y: number; z: number };
  rotSpeed: { x: number; y: number; z: number };
  floatAmp: number;
  floatFreq: number;
  phase: number;
}

function ThreeGameBackgroundComponent({
  theme,
  primaryColor,
  secondaryColor,
  backgroundColor,
  shapeCount = 12,
  isActive = true,
  opacity = 0.4,
  style,
  testID,
}: ThreeGameBackgroundProps) {
  const palette = THEME_PALETTES[theme] || THEME_PALETTES.neutral;
  const primary = primaryColor || palette.primary;
  const secondary = secondaryColor || palette.secondary;
  const bgColor = backgroundColor || palette.bg;

  const shapesRef = useMemo(() => ({ shapes: [] as FloatingShape[] }), []);

  const handleSceneReady = useCallback(
    (ctx: ThreeContext) => {
      const { scene, camera } = ctx;

      camera.position.set(0, 0, 8);
      camera.lookAt(0, 0, 0);

      // Add fog for depth
      scene.fog = new FogExp2(new Color(bgColor).getHex(), 0.08);
      scene.background = new Color(bgColor);

      // Lighting
      const dir = new DirectionalLight(0xffffff, 0.6);
      dir.position.set(3, 5, 4);
      scene.add(dir);

      const p1 = new PointLight(new Color(primary).getHex(), 1.5, 25);
      p1.position.set(-4, 3, 2);
      scene.add(p1);

      const p2 = new PointLight(new Color(secondary).getHex(), 1.0, 25);
      p2.position.set(4, -2, 3);
      scene.add(p2);

      // Create shapes
      const colors = [primary, secondary, "#FFFFFF", "#CCCCCC"];
      const categories = [
        "quick_play",
        "puzzle",
        "multiplayer",
        "daily",
      ] as const;

      const creators = [
        (c: string) =>
          createGamePieceMesh(
            categories[Math.floor(Math.random() * 4)],
            c,
            0.25,
          ),
        (c: string) => createGemMesh(c, 0.2),
        (c: string) => createDiceMesh(c, 0.2),
        (c: string) => createTorusMesh(c, 0.15, 0.05),
        (c: string) => createKnotMesh(c, 0.12),
      ];

      for (let i = 0; i < shapeCount; i++) {
        const color = colors[i % colors.length];
        const creator = creators[i % creators.length];
        const mesh = creator(color);

        const x = (Math.random() - 0.5) * 14;
        const y = (Math.random() - 0.5) * 10;
        const z = (Math.random() - 0.5) * 6 - 2;

        mesh.position.set(x, y, z);
        mesh.rotation.set(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
        );

        // Make shapes semi-transparent
        if (mesh.material instanceof MeshStandardMaterial) {
          mesh.material.transparent = true;
          mesh.material.opacity = 0.5 + Math.random() * 0.3;
        }

        scene.add(mesh);

        shapesRef.shapes.push({
          mesh,
          basePos: { x, y, z },
          rotSpeed: {
            x: (Math.random() - 0.5) * 0.4,
            y: (Math.random() - 0.5) * 0.6,
            z: (Math.random() - 0.5) * 0.3,
          },
          floatAmp: 0.2 + Math.random() * 0.3,
          floatFreq: 0.3 + Math.random() * 0.5,
          phase: Math.random() * Math.PI * 2,
        });
      }
    },
    [primary, secondary, bgColor, shapeCount, shapesRef],
  );

  const handleFrame = useCallback(
    (ctx: ThreeContext, delta: number) => {
      const time = Date.now() * 0.001;

      for (const shape of shapesRef.shapes) {
        shape.mesh.rotation.x += delta * shape.rotSpeed.x;
        shape.mesh.rotation.y += delta * shape.rotSpeed.y;
        shape.mesh.rotation.z += delta * shape.rotSpeed.z;

        shape.mesh.position.y =
          shape.basePos.y +
          Math.sin(time * shape.floatFreq + shape.phase) * shape.floatAmp;
        shape.mesh.position.x =
          shape.basePos.x +
          Math.cos(time * shape.floatFreq * 0.7 + shape.phase) *
            shape.floatAmp *
            0.3;
      }

      // Gentle camera breathing
      ctx.camera.position.x = Math.sin(time * 0.15) * 0.3;
      ctx.camera.position.y = Math.cos(time * 0.1) * 0.2;
      ctx.camera.lookAt(0, 0, 0);
    },
    [shapesRef],
  );

  if (Platform.OS === "web") return null;

  return (
    <ThreeCanvas
      style={[styles.canvas, { opacity }, style]}
      backgroundColor={bgColor}
      backgroundAlpha={1}
      onSceneReady={handleSceneReady}
      onFrame={handleFrame}
      isActive={isActive}
      cameraZ={8}
      fov={60}
      testID={testID}
    />
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  canvas: {
    ...StyleSheet.absoluteFillObject,
  },
});

export const ThreeGameBackground = memo(ThreeGameBackgroundComponent);
export default ThreeGameBackground;
