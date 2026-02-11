/**
 * ThreeInviteCard — 3D animated game invite card
 *
 * Renders a Three.js scene behind a game invite card with:
 *   - Spinning game-category gem/crystal
 *   - Floating particle effects
 *   - Pulsing glow ring around the icon
 *   - Smooth rotation on the gem based on game type
 *
 * Used as a visual enhancement layer inside CompactInviteCard
 * or GameInvitesBanner. Rendered behind the existing 2D UI with
 * position: absolute.
 *
 * @see docs/PLAY_SCREEN_OVERHAUL_PLAN.md — Phase 5
 */

import React, { memo, useCallback, useMemo } from "react";
import { Platform, StyleProp, StyleSheet, ViewStyle } from "react-native";
import {
  Color,
  DirectionalLight,
  Mesh,
  MeshPhongMaterial,
  PointLight,
  SphereGeometry,
} from "three";
import { ThreeCanvas, ThreeContext } from "./ThreeCanvas";
import {
  createGemMesh,
  createRingMesh,
  floatMesh,
  pulseMesh,
} from "./geometries";

// =============================================================================
// Types
// =============================================================================

export interface ThreeInviteCardProps {
  /** Accent color for the gem (derived from game category) */
  accentColor: string;
  /** Whether to animate. Default true. */
  isActive?: boolean;
  /** Container style (should match card dimensions) */
  style?: StyleProp<ViewStyle>;
  /** Test ID */
  testID?: string;
}

// =============================================================================
// Component
// =============================================================================

function ThreeInviteCardComponent({
  accentColor,
  isActive = true,
  style,
  testID,
}: ThreeInviteCardProps) {
  // Refs for meshes we'll animate
  const meshes = useMemo(
    () => ({
      gem: null as Mesh | null,
      ring: null as Mesh | null,
      glowOrb: null as Mesh | null,
    }),
    [],
  );

  const handleSceneReady = useCallback(
    (ctx: ThreeContext) => {
      const { scene, camera } = ctx;

      // Adjust camera for small card viewport
      camera.position.set(0, 0, 3);
      camera.lookAt(0, 0, 0);

      // Lighting
      const dirLight = new DirectionalLight(0xffffff, 1.5);
      dirLight.position.set(2, 3, 4);
      scene.add(dirLight);

      const pointLight = new PointLight(new Color(accentColor).getHex(), 2, 10);
      pointLight.position.set(0, 0, 2);
      scene.add(pointLight);

      // Gem (main focal piece)
      const gem = createGemMesh(accentColor, 0.4);
      gem.position.set(0, 0, 0);
      scene.add(gem);
      meshes.gem = gem;

      // Glow ring
      const ring = createRingMesh(accentColor, 0.55, 0.65);
      ring.position.set(0, 0, -0.1);
      scene.add(ring);
      meshes.ring = ring;

      // Small background glow orb
      const orbGeo = new SphereGeometry(0.15, 8, 8);
      const orbMat = new MeshPhongMaterial({
        color: accentColor,
        emissive: new Color(accentColor),
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.4,
      });
      const orb = new Mesh(orbGeo, orbMat);
      orb.position.set(0.6, 0.4, -0.5);
      scene.add(orb);
      meshes.glowOrb = orb;
    },
    [accentColor, meshes],
  );

  const handleFrame = useCallback(
    (_ctx: ThreeContext, delta: number) => {
      const time = Date.now() * 0.001;

      // Spin the gem
      if (meshes.gem) {
        meshes.gem.rotation.y += delta * 1.2;
        meshes.gem.rotation.x += delta * 0.3;
        floatMesh(meshes.gem, time, 0.08, 1.5);
      }

      // Pulse the ring
      if (meshes.ring) {
        meshes.ring.rotation.z += delta * 0.5;
        pulseMesh(meshes.ring, time, 1, 0.08, 1.2);
      }

      // Float the orb
      if (meshes.glowOrb) {
        floatMesh(meshes.glowOrb, time + 1, 0.12, 0.8, 0.4);
        meshes.glowOrb.rotation.y += delta * 0.8;
      }
    },
    [meshes],
  );

  // Don't render on web
  if (Platform.OS === "web") return null;

  return (
    <ThreeCanvas
      style={[styles.canvas, style]}
      backgroundColor={null}
      backgroundAlpha={0}
      onSceneReady={handleSceneReady}
      onFrame={handleFrame}
      isActive={isActive}
      cameraZ={3}
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
    borderRadius: 12,
  },
});

export const ThreeInviteCard = memo(ThreeInviteCardComponent);
export default ThreeInviteCard;
