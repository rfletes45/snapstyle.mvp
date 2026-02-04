/**
 * Fallback Renderer
 * Simple React Native View-based renderer for when Skia is unavailable
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import {
  CART_HEIGHT,
  CART_WIDTH,
  VISUAL_CONFIG,
  WHEEL_RADIUS,
} from "../data/constants";
import { GameEntities } from "../types/cartCourse.types";

// ============================================
// Fallback Renderer Props
// ============================================

interface FallbackRendererProps {
  entities: GameEntities;
}

// ============================================
// Fallback Renderer Component
// ============================================

export const FallbackRenderer: React.FC<FallbackRendererProps> = ({
  entities,
}) => {
  if (!entities) {
    return null;
  }

  const { camera, cart, platforms, walls } = entities;
  const { colors } = VISUAL_CONFIG;

  // Calculate camera offset
  const cameraX = camera?.position?.x ?? 0;
  const cameraY = camera?.position?.y ?? 0;
  const zoom = camera?.zoom ?? 1;

  // Render cart
  const renderCart = () => {
    if (!cart?.body) return null;

    const bodyX = cart.body.position.x - cameraX;
    const bodyY = cart.body.position.y - cameraY;
    const bodyAngle = cart.body.angle * (180 / Math.PI);

    const leftWheelX = cart.leftWheel.position.x - cameraX;
    const leftWheelY = cart.leftWheel.position.y - cameraY;

    const rightWheelX = cart.rightWheel.position.x - cameraX;
    const rightWheelY = cart.rightWheel.position.y - cameraY;

    return (
      <View key="cart">
        {/* Cart Body */}
        <View
          style={[
            styles.cartBody,
            {
              left: bodyX - CART_WIDTH / 2,
              top: bodyY - CART_HEIGHT / 2,
              width: CART_WIDTH,
              height: CART_HEIGHT,
              transform: [{ rotate: `${bodyAngle}deg` }],
            },
          ]}
        />
        {/* Left Wheel */}
        <View
          style={[
            styles.wheel,
            {
              left: leftWheelX - WHEEL_RADIUS,
              top: leftWheelY - WHEEL_RADIUS,
              width: WHEEL_RADIUS * 2,
              height: WHEEL_RADIUS * 2,
              borderRadius: WHEEL_RADIUS,
            },
          ]}
        />
        {/* Right Wheel */}
        <View
          style={[
            styles.wheel,
            {
              left: rightWheelX - WHEEL_RADIUS,
              top: rightWheelY - WHEEL_RADIUS,
              width: WHEEL_RADIUS * 2,
              height: WHEEL_RADIUS * 2,
              borderRadius: WHEEL_RADIUS,
            },
          ]}
        />
      </View>
    );
  };

  // Render platforms
  const renderPlatforms = () => {
    if (!platforms) return null;

    return Array.from(platforms.values()).map((platform, index) => {
      if (!platform?.body) return null;

      const x = platform.body.position.x - cameraX;
      const y = platform.body.position.y - cameraY;
      const angle = platform.body.angle * (180 / Math.PI);
      const { width, height } = platform.size;

      return (
        <View
          key={`platform-${index}`}
          style={[
            styles.platform,
            {
              left: x - width / 2,
              top: y - height / 2,
              width,
              height,
              transform: [{ rotate: `${angle}deg` }],
            },
          ]}
        />
      );
    });
  };

  // Render walls
  const renderWalls = () => {
    if (!walls) return null;

    return Array.from(walls.values()).map((wall, index) => {
      if (!wall?.body) return null;

      const x = wall.body.position.x - cameraX;
      const y = wall.body.position.y - cameraY;
      const angle = wall.body.angle * (180 / Math.PI);
      const { width, height } = wall.size;

      return (
        <View
          key={`wall-${index}`}
          style={[
            styles.wall,
            {
              left: x - width / 2,
              top: y - height / 2,
              width,
              height,
              transform: [{ rotate: `${angle}deg` }],
            },
          ]}
        />
      );
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.gameWorld,
          {
            transform: [{ scale: zoom }],
          },
        ]}
      >
        {renderWalls()}
        {renderPlatforms()}
        {renderCart()}
      </View>
    </View>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  gameWorld: {
    flex: 1,
    position: "relative",
  },
  cartBody: {
    position: "absolute",
    backgroundColor: VISUAL_CONFIG.cart.bodyColor,
    borderRadius: 4,
  },
  wheel: {
    position: "absolute",
    backgroundColor: VISUAL_CONFIG.cart.wheelColor,
  },
  platform: {
    position: "absolute",
    backgroundColor: VISUAL_CONFIG.colors.platforms,
  },
  wall: {
    position: "absolute",
    backgroundColor: VISUAL_CONFIG.colors.walls,
  },
});
