/**
 * ThreeGameTrophy — 3D animated trophy for victory screens
 *
 * Renders a spinning, glowing trophy with particle effects:
 *   - Gold trophy that rotates and floats
 *   - Celebratory particles burst outward
 *   - Pulsing halo ring
 *   - Star decorations orbiting the trophy
 *
 * Used in game-over / victory states across game screens.
 *
 * @see docs/GAME_SYSTEM_OVERHAUL_PLAN.md — Phase 7 (Achievements)
 */

import React, { memo, useCallback, useMemo } from "react";
import { Platform, StyleProp, StyleSheet, ViewStyle } from "react-native";
import {
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  PointLight,
  SphereGeometry,
} from "three";
import { ThreeCanvas, ThreeContext } from "./ThreeCanvas";
import { floatMesh, pulseMesh } from "./geometries";

// =============================================================================
// Types
// =============================================================================

export interface ThreeGameTrophyProps {
  /** Trophy color. Default gold. */
  color?: string;
  /** Whether it's a victory (adds particles). Default true. */
  isVictory?: boolean;
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

function ThreeGameTrophyComponent({
  color = "#FFD700",
  isVictory = true,
  isActive = true,
  style,
  testID,
}: ThreeGameTrophyProps) {
  const refs = useMemo(
    () => ({
      trophyGroup: null as Group | null,
      stars: [] as Mesh[],
      halo: null as Mesh | null,
    }),
    [],
  );

  const handleSceneReady = useCallback(
    (ctx: ThreeContext) => {
      const { scene, camera } = ctx;

      camera.position.set(0, 0.5, 4);
      camera.lookAt(0, 0, 0);

      // Lighting
      const dirLight = new DirectionalLight(0xffffff, 1.2);
      dirLight.position.set(2, 4, 3);
      scene.add(dirLight);

      const goldLight = new PointLight(new Color(color).getHex(), 2, 15);
      goldLight.position.set(0, 1, 3);
      scene.add(goldLight);

      const backLight = new PointLight(0x4488ff, 1.0, 10);
      backLight.position.set(-2, -1, -2);
      scene.add(backLight);

      // Trophy group
      const group = new Group();

      // Cup body
      const cupMat = new MeshStandardMaterial({
        color,
        metalness: 0.85,
        roughness: 0.15,
      });

      const cup = new Mesh(new CylinderGeometry(0.5, 0.3, 0.8, 12), cupMat);
      cup.position.y = 0.3;
      group.add(cup);

      // Stem
      const stem = new Mesh(new CylinderGeometry(0.08, 0.1, 0.4, 8), cupMat);
      stem.position.y = -0.3;
      group.add(stem);

      // Base
      const base = new Mesh(new CylinderGeometry(0.35, 0.35, 0.1, 12), cupMat);
      base.position.y = -0.55;
      group.add(base);

      scene.add(group);
      refs.trophyGroup = group;

      // Orbiting stars (if victory)
      if (isVictory) {
        const starMat = new MeshStandardMaterial({
          color: "#FFFFFF",
          emissive: new Color(color),
          emissiveIntensity: 0.6,
          metalness: 0.5,
          roughness: 0.3,
        });

        for (let i = 0; i < 5; i++) {
          const star = new Mesh(new OctahedronGeometry(0.08, 0), starMat);
          const angle = (i / 5) * Math.PI * 2;
          star.position.set(
            Math.cos(angle) * 1.2,
            0.2 + (i % 2) * 0.4,
            Math.sin(angle) * 1.2,
          );
          scene.add(star);
          refs.stars.push(star);
        }

        // Halo ring
        const haloGeo = new SphereGeometry(0.02, 32, 1);
        // Use a flat torus as halo
        const { TorusGeometry } = require("three");
        const haloRing = new Mesh(
          new TorusGeometry(1.0, 0.02, 8, 64),
          new MeshStandardMaterial({
            color,
            emissive: new Color(color),
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.5,
          }),
        );
        haloRing.rotation.x = Math.PI / 2;
        haloRing.position.y = 0.3;
        scene.add(haloRing);
        refs.halo = haloRing;
      }
    },
    [color, isVictory, refs],
  );

  const handleFrame = useCallback(
    (ctx: ThreeContext, delta: number) => {
      const time = Date.now() * 0.001;

      // Rotate and float the trophy
      if (refs.trophyGroup) {
        refs.trophyGroup.rotation.y += delta * 0.8;
        floatMesh(refs.trophyGroup as unknown as Mesh, time, 0.1, 1.0, 0);
      }

      // Orbit the stars
      for (let i = 0; i < refs.stars.length; i++) {
        const star = refs.stars[i];
        const angle = (i / refs.stars.length) * Math.PI * 2 + time * 0.8;
        const radius = 1.2 + Math.sin(time * 2 + i) * 0.1;
        star.position.x = Math.cos(angle) * radius;
        star.position.z = Math.sin(angle) * radius;
        star.position.y = 0.3 + Math.sin(time * 1.5 + i * 0.5) * 0.2;
        star.rotation.y += delta * 3;
        star.rotation.x += delta * 2;
      }

      // Pulse the halo
      if (refs.halo) {
        pulseMesh(refs.halo, time, 1, 0.05, 1.5);
        refs.halo.rotation.z += delta * 0.3;
      }
    },
    [refs],
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
      cameraZ={4}
      fov={45}
      testID={testID}
    />
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  canvas: {
    width: 200,
    height: 200,
  },
});

export const ThreeGameTrophy = memo(ThreeGameTrophyComponent);
export default ThreeGameTrophy;
