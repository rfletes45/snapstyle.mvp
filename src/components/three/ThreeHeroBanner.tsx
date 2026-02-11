/**
 * ThreeHeroBanner — 3D animated hero banner for the Play screen
 *
 * A visually striking Three.js scene used behind the FeaturedGameBanner:
 *   - Animated grid of floating game pieces (gems, cubes, spheres)
 *   - Gentle camera sway for parallax depth
 *   - Color palette derived from the featured game's category
 *   - Particle field background
 *   - Responsive to banner dimensions
 *
 * Designed to sit behind FeaturedGameBanner as position: absolute
 * with the banner's content overlaid on top.
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md — Phase 4
 */

import React, { memo, useCallback, useMemo } from "react";
import { Platform, StyleProp, StyleSheet, ViewStyle } from "react-native";
import { Color, DirectionalLight, Group, Mesh, PointLight } from "three";
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

export interface ThreeHeroBannerProps {
  /** Primary accent color (from game/category) */
  primaryColor: string;
  /** Secondary accent color */
  secondaryColor?: string;
  /** Number of floating pieces. Default 8 */
  pieceCount?: number;
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

interface FloatingPiece {
  mesh: Mesh;
  baseY: number;
  speed: number;
  rotSpeed: { x: number; y: number; z: number };
  floatAmp: number;
  floatFreq: number;
  phase: number;
}

function ThreeHeroBannerComponent({
  primaryColor,
  secondaryColor,
  pieceCount = 8,
  isActive = true,
  style,
  testID,
}: ThreeHeroBannerProps) {
  const secondary = secondaryColor || primaryColor;

  const piecesRef = useMemo(
    () => ({ pieces: [] as FloatingPiece[], group: null as Group | null }),
    [],
  );

  const handleSceneReady = useCallback(
    (ctx: ThreeContext) => {
      const { scene, camera } = ctx;

      // Camera setup for wide banner
      camera.position.set(0, 0, 6);
      camera.lookAt(0, 0, 0);
      camera.fov = 50;
      camera.updateProjectionMatrix();

      // Lighting
      const dirLight = new DirectionalLight(0xffffff, 1.0);
      dirLight.position.set(3, 4, 5);
      scene.add(dirLight);

      const pointLight1 = new PointLight(
        new Color(primaryColor).getHex(),
        1.5,
        20,
      );
      pointLight1.position.set(-3, 2, 3);
      scene.add(pointLight1);

      const pointLight2 = new PointLight(
        new Color(secondary).getHex(),
        1.0,
        20,
      );
      pointLight2.position.set(3, -1, 2);
      scene.add(pointLight2);

      // Create floating pieces group
      const group = new Group();
      scene.add(group);
      piecesRef.group = group;

      const colors = [primaryColor, secondary, "#FFFFFF", "#E0E0E0"];
      const categories = [
        "quick_play",
        "puzzle",
        "multiplayer",
        "daily",
      ] as const;
      const creators = [
        () =>
          createGamePieceMesh(
            categories[Math.floor(Math.random() * 4)],
            colors[Math.floor(Math.random() * colors.length)],
            0.3,
          ),
        () =>
          createGemMesh(
            colors[Math.floor(Math.random() * colors.length)],
            0.25,
          ),
        () =>
          createDiceMesh(
            colors[Math.floor(Math.random() * colors.length)],
            0.25,
          ),
        () =>
          createTorusMesh(
            colors[Math.floor(Math.random() * colors.length)],
            0.2,
            0.06,
          ),
      ];

      for (let i = 0; i < pieceCount; i++) {
        const creator = creators[i % creators.length];
        const mesh = creator();

        // Distribute across the banner width
        const x = (Math.random() - 0.5) * 8;
        const y = (Math.random() - 0.5) * 3;
        const z = (Math.random() - 0.5) * 3 - 1;

        mesh.position.set(x, y, z);
        mesh.rotation.set(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
        );

        group.add(mesh);

        piecesRef.pieces.push({
          mesh,
          baseY: y,
          speed: 0.3 + Math.random() * 0.5,
          rotSpeed: {
            x: (Math.random() - 0.5) * 0.8,
            y: (Math.random() - 0.5) * 1.2,
            z: (Math.random() - 0.5) * 0.4,
          },
          floatAmp: 0.1 + Math.random() * 0.15,
          floatFreq: 0.5 + Math.random() * 1.0,
          phase: Math.random() * Math.PI * 2,
        });
      }
    },
    [primaryColor, secondary, pieceCount, piecesRef],
  );

  const handleFrame = useCallback(
    (ctx: ThreeContext, delta: number) => {
      const time = Date.now() * 0.001;

      // Animate each floating piece
      for (const piece of piecesRef.pieces) {
        piece.mesh.rotation.x += delta * piece.rotSpeed.x;
        piece.mesh.rotation.y += delta * piece.rotSpeed.y;
        piece.mesh.rotation.z += delta * piece.rotSpeed.z;

        piece.mesh.position.y =
          piece.baseY +
          Math.sin(time * piece.floatFreq + piece.phase) * piece.floatAmp;
      }

      // Gentle camera sway
      ctx.camera.position.x = Math.sin(time * 0.3) * 0.2;
      ctx.camera.position.y = Math.cos(time * 0.2) * 0.1;
      ctx.camera.lookAt(0, 0, 0);
    },
    [piecesRef],
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
      fov={50}
      cameraZ={6}
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
    borderRadius: 12,
  },
});

export const ThreeHeroBanner = memo(ThreeHeroBannerComponent);
export default ThreeHeroBanner;
