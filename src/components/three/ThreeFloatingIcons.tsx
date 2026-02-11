/**
 * ThreeFloatingIcons — Floating 3D game icons for the Play screen header
 *
 * A decorative Three.js scene that renders small floating/spinning
 * game-themed shapes behind the PlayHeader and category areas:
 *   - Per-category colored shapes
 *   - Very low intensity (background decoration only)
 *   - Minimal shapes to keep performance high
 *
 * Used in the Play screen as a subtle 3D background accent.
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md
 */

import React, { memo, useCallback, useMemo } from "react";
import { Platform, StyleProp, StyleSheet, ViewStyle } from "react-native";
import {
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PointLight,
} from "three";
import { ThreeCanvas, ThreeContext } from "./ThreeCanvas";
import {
  createDiceMesh,
  createGamePieceMesh,
  createGemMesh,
  createTorusMesh,
} from "./geometries";

// =============================================================================
// Types
// =============================================================================

export interface ThreeFloatingIconsProps {
  /** Colors to use for the icons */
  colors?: string[];
  /** Number of floating icons. Default 6. */
  count?: number;
  /** Whether to animate. Default true. */
  isActive?: boolean;
  /** Container style */
  style?: StyleProp<ViewStyle>;
  /** Test ID */
  testID?: string;
}

// =============================================================================
// Component
// =============================================================================

interface IconPiece {
  mesh: Mesh;
  baseY: number;
  baseX: number;
  rotSpeed: number;
  floatAmp: number;
  floatFreq: number;
  phase: number;
}

function ThreeFloatingIconsComponent({
  colors = ["#FF6B6B", "#4ECDC4", "#6C5CE7", "#FFD700", "#FF8E53", "#A29BFE"],
  count = 6,
  isActive = true,
  style,
  testID,
}: ThreeFloatingIconsProps) {
  const iconsRef = useMemo(() => ({ icons: [] as IconPiece[] }), []);

  const handleSceneReady = useCallback(
    (ctx: ThreeContext) => {
      const { scene, camera } = ctx;

      camera.position.set(0, 0, 5);
      camera.lookAt(0, 0, 0);
      camera.fov = 55;
      camera.updateProjectionMatrix();

      // Soft lighting
      const dir = new DirectionalLight(0xffffff, 0.8);
      dir.position.set(2, 3, 4);
      scene.add(dir);

      const accent = new PointLight(0x6c5ce7, 0.8, 15);
      accent.position.set(-2, 1, 3);
      scene.add(accent);

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
            0.3,
          ),
        (c: string) => createGemMesh(c, 0.22),
        (c: string) => createDiceMesh(c, 0.22),
        (c: string) => createTorusMesh(c, 0.18, 0.06),
      ];

      for (let i = 0; i < count; i++) {
        const color = colors[i % colors.length];
        const creator = creators[i % creators.length];
        const mesh = creator(color);

        const x = (Math.random() - 0.5) * 8;
        const y = (Math.random() - 0.5) * 4;
        const z = (Math.random() - 0.5) * 2 - 1;

        mesh.position.set(x, y, z);

        // Semi-transparent
        if (mesh.material instanceof MeshStandardMaterial) {
          mesh.material.transparent = true;
          mesh.material.opacity = 0.35;
        }

        scene.add(mesh);

        iconsRef.icons.push({
          mesh,
          baseX: x,
          baseY: y,
          rotSpeed: 0.3 + Math.random() * 0.5,
          floatAmp: 0.08 + Math.random() * 0.1,
          floatFreq: 0.3 + Math.random() * 0.6,
          phase: Math.random() * Math.PI * 2,
        });
      }
    },
    [colors, count, iconsRef],
  );

  const handleFrame = useCallback(
    (_ctx: ThreeContext, delta: number) => {
      const time = Date.now() * 0.001;

      for (const icon of iconsRef.icons) {
        icon.mesh.rotation.y += delta * icon.rotSpeed;
        icon.mesh.rotation.x += delta * icon.rotSpeed * 0.3;

        icon.mesh.position.y =
          icon.baseY +
          Math.sin(time * icon.floatFreq + icon.phase) * icon.floatAmp;
      }
    },
    [iconsRef],
  );

  if (Platform.OS === "web") return null;

  return (
    <ThreeCanvas
      style={[styles.canvas, style]}
      backgroundColor={null}
      backgroundAlpha={0}
      onSceneReady={handleSceneReady}
      onFrame={handleFrame}
      isActive={isActive}
      cameraZ={5}
      fov={55}
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
    opacity: 0.3,
  },
});

export const ThreeFloatingIcons = memo(ThreeFloatingIconsComponent);
export default ThreeFloatingIcons;
