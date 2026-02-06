/**
 * Skia Renderer
 * Main renderer component for the Cart Course game using @shopify/react-native-skia
 */

import { Canvas, Group } from "@shopify/react-native-skia";
import React from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import {
  AutoRotateMechanism,
  ConveyorMechanism,
  FanPlatformMechanism,
  GameEntities,
  JoystickGearMechanism,
  LauncherPlatformMechanism,
  LiftPlatformMechanism,
  MechanismType,
  RotatingGearMechanism,
} from "../types/cartCourse.types";
import { AutoRotateRenderer } from "./AutoRotateRenderer";
import { BackgroundRenderer } from "./BackgroundRenderer";
import { CartRenderer } from "./CartRenderer";
import { ConveyorRenderer } from "./ConveyorRenderer";
import { FanPlatformRenderer } from "./FanPlatformRenderer";
import { JoystickGearRenderer } from "./JoystickGearRenderer";
import { LauncherPlatformRenderer } from "./LauncherPlatformRenderer";
import { LiftPlatformRenderer } from "./LiftPlatformRenderer";
import { PlatformRenderer } from "./PlatformRenderer";
import { RotatingGearRenderer } from "./RotatingGearRenderer";
import { WallRenderer } from "./WallRenderer";

// ============================================
// Skia Renderer Props
// ============================================

interface SkiaRendererProps {
  entities: GameEntities;
}

// ============================================
// Skia Renderer Component
// ============================================

export const SkiaRenderer: React.FC<SkiaRendererProps> = ({ entities }) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  if (!entities) {
    return null;
  }

  const { camera, cart, platforms, walls, mechanisms } = entities;

  // Calculate camera transform
  const cameraOffsetX = screenWidth / 2 - (camera?.position?.x ?? 0);
  const cameraOffsetY = screenHeight / 2 - (camera?.position?.y ?? 0);
  const zoom = camera?.zoom ?? 1;

  // Camera offset for mechanism renderers
  const cameraOffset = {
    x: camera?.position?.x ?? 0,
    y: camera?.position?.y ?? 0,
  };

  // Helper to render mechanisms
  const renderMechanism = (
    mechanism: GameEntities["mechanisms"] extends Map<string, infer T>
      ? T
      : never,
    id: string,
  ) => {
    switch (mechanism.type) {
      case MechanismType.L_ROTATING_GEAR:
      case MechanismType.R_ROTATING_GEAR:
        return (
          <RotatingGearRenderer
            key={id}
            mechanism={mechanism as RotatingGearMechanism}
            cameraOffset={cameraOffset}
            scale={zoom}
          />
        );
      case MechanismType.L_LIFT_PLATFORM:
      case MechanismType.R_LIFT_PLATFORM:
        return (
          <LiftPlatformRenderer
            key={id}
            mechanism={mechanism as LiftPlatformMechanism}
            cameraOffset={cameraOffset}
            scale={zoom}
          />
        );
      case MechanismType.LEFT_STICK_GEAR:
      case MechanismType.RIGHT_STICK_GEAR:
        return (
          <JoystickGearRenderer
            key={id}
            mechanism={mechanism as JoystickGearMechanism}
            cameraOffset={cameraOffset}
            scale={zoom}
          />
        );
      // Phase 4 Mechanisms
      case MechanismType.R_LAUNCHER:
        return (
          <LauncherPlatformRenderer
            key={id}
            mechanism={mechanism as LauncherPlatformMechanism}
            cameraOffset={cameraOffset}
            scale={zoom}
          />
        );
      case MechanismType.FAN_PLATFORM:
        return (
          <FanPlatformRenderer
            key={id}
            mechanism={mechanism as FanPlatformMechanism}
            cameraOffset={cameraOffset}
            scale={zoom}
          />
        );
      case MechanismType.AUTO_ROTATE:
        return (
          <AutoRotateRenderer
            key={id}
            mechanism={mechanism as AutoRotateMechanism}
            cameraOffset={cameraOffset}
            scale={zoom}
          />
        );
      case MechanismType.CONVEYOR:
        return (
          <ConveyorRenderer
            key={id}
            mechanism={mechanism as ConveyorMechanism}
            cameraOffset={cameraOffset}
            scale={zoom}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <Canvas style={styles.canvas}>
        {/* Camera transform group */}
        <Group
          transform={[
            { translateX: screenWidth / 2 },
            { translateY: screenHeight / 2 },
            { scale: zoom },
            { translateX: -screenWidth / 2 },
            { translateY: -screenHeight / 2 },
            { translateX: cameraOffsetX },
            { translateY: cameraOffsetY },
          ]}
        >
          {/* Background */}
          <BackgroundRenderer
            screenWidth={screenWidth}
            screenHeight={screenHeight}
            cameraPosition={camera?.position ?? { x: 0, y: 0 }}
          />

          {/* Walls */}
          {walls &&
            Array.from(walls.values()).map((wall, index) => (
              <WallRenderer key={`wall-${index}`} wall={wall} />
            ))}

          {/* Platforms */}
          {platforms &&
            Array.from(platforms.values()).map((platform, index) => (
              <PlatformRenderer key={`platform-${index}`} platform={platform} />
            ))}

          {/* Mechanisms */}
          {mechanisms &&
            Array.from(mechanisms.entries()).map(([id, mechanism]) =>
              renderMechanism(mechanism, id),
            )}

          {/* Cart */}
          {cart && <CartRenderer cart={cart} />}
        </Group>
      </Canvas>
    </View>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  canvas: {
    flex: 1,
  },
});
