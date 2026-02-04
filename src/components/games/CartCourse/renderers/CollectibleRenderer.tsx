/**
 * CollectibleRenderer - Phase 7
 * Renders bananas and coins with glow effects and animations
 */

import {
  BlurMask,
  Circle,
  Group,
  Oval,
  Path,
  RoundedRect,
  Skia,
} from "@shopify/react-native-skia";
import React, { useMemo } from "react";
import { Collectible, Vector2D } from "../types/cartCourse.types";

// ============================================
// Collectible Visual Config
// ============================================

export const COLLECTIBLE_VISUAL_CONFIG = {
  banana: {
    color: "#FFD700", // Golden yellow
    highlightColor: "#FFEC8B",
    shadowColor: "#DAA520",
    glowColor: "rgba(255, 215, 0, 0.4)",
    size: { width: 16, height: 24 },
    glowRadius: 20,
    bobAmplitude: 4,
    bobSpeed: 2,
    rotateSpeed: 0,
  },
  coin: {
    color: "#FFD700", // Gold
    highlightColor: "#FFFFFF",
    shadowColor: "#B8860B",
    glowColor: "rgba(255, 215, 0, 0.6)",
    size: { width: 20, height: 20 },
    glowRadius: 24,
    bobAmplitude: 3,
    bobSpeed: 3,
    rotateSpeed: 2,
  },
};

// ============================================
// Collectible Renderer Props
// ============================================

interface CollectibleRendererProps {
  collectibles: Collectible[];
  collectedIds: Set<string>;
  cameraOffset: Vector2D;
  scale: number;
  gameTime: number; // For animations
}

interface SingleCollectibleProps {
  collectible: Collectible;
  isCollected: boolean;
  offsetX: number;
  offsetY: number;
  gameTime: number;
}

// ============================================
// Banana Renderer
// ============================================

const BananaRenderer: React.FC<SingleCollectibleProps> = ({
  collectible,
  isCollected,
  offsetX,
  offsetY,
  gameTime,
}) => {
  if (isCollected) return null;

  const config = COLLECTIBLE_VISUAL_CONFIG.banana;
  const x = collectible.position.x - offsetX;
  const y = collectible.position.y - offsetY;

  // Bob animation
  const bobOffset =
    Math.sin(gameTime * config.bobSpeed * 0.001) * config.bobAmplitude;

  // Create banana path (curved shape)
  const bananaPath = useMemo(() => {
    const path = Skia.Path.Make();
    // Simplified banana shape
    path.moveTo(-6, 8);
    path.quadTo(-8, 0, -4, -8);
    path.quadTo(0, -12, 4, -8);
    path.quadTo(8, 0, 6, 8);
    path.quadTo(3, 10, 0, 9);
    path.quadTo(-3, 10, -6, 8);
    path.close();
    return path;
  }, []);

  return (
    <Group
      transform={[{ translateX: x }, { translateY: y + bobOffset }]}
      opacity={1}
    >
      {/* Outer glow */}
      <Circle cx={0} cy={0} r={config.glowRadius} color={config.glowColor}>
        <BlurMask blur={8} style="normal" />
      </Circle>

      {/* Banana body */}
      <Path path={bananaPath} color={config.color} />

      {/* Highlight */}
      <Oval
        x={-4}
        y={-6}
        width={6}
        height={8}
        color={config.highlightColor}
        opacity={0.4}
      />

      {/* Stem */}
      <RoundedRect x={-1} y={-12} width={3} height={4} r={1} color="#8B4513" />
    </Group>
  );
};

// ============================================
// Coin Renderer
// ============================================

const CoinRenderer: React.FC<SingleCollectibleProps> = ({
  collectible,
  isCollected,
  offsetX,
  offsetY,
  gameTime,
}) => {
  if (isCollected) return null;

  const config = COLLECTIBLE_VISUAL_CONFIG.coin;
  const x = collectible.position.x - offsetX;
  const y = collectible.position.y - offsetY;

  // Bob and rotate animation
  const bobOffset =
    Math.sin(gameTime * config.bobSpeed * 0.001) * config.bobAmplitude;
  const rotation = (gameTime * config.rotateSpeed * 0.001) % (Math.PI * 2);

  // Squash based on rotation (3D effect)
  const scaleX = Math.abs(Math.cos(rotation)) * 0.7 + 0.3;

  return (
    <Group
      transform={[{ translateX: x }, { translateY: y + bobOffset }, { scaleX }]}
      opacity={1}
    >
      {/* Outer glow */}
      <Circle cx={0} cy={0} r={config.glowRadius} color={config.glowColor}>
        <BlurMask blur={10} style="normal" />
      </Circle>

      {/* Coin body (outer) */}
      <Circle cx={0} cy={0} r={10} color={config.color} />

      {/* Coin inner ring */}
      <Circle cx={0} cy={0} r={8} color={config.shadowColor} />

      {/* Coin center */}
      <Circle cx={0} cy={0} r={6} color={config.color} />

      {/* Dollar sign or star pattern */}
      <Group>
        {/* Vertical line */}
        <RoundedRect
          x={-1}
          y={-5}
          width={2}
          height={10}
          r={1}
          color={config.shadowColor}
        />
        {/* Horizontal lines */}
        <RoundedRect
          x={-4}
          y={-2}
          width={8}
          height={2}
          r={1}
          color={config.shadowColor}
        />
        <RoundedRect
          x={-4}
          y={1}
          width={8}
          height={2}
          r={1}
          color={config.shadowColor}
        />
      </Group>

      {/* Highlight */}
      <Circle
        cx={-3}
        cy={-3}
        r={3}
        color={config.highlightColor}
        opacity={0.5}
      />

      {/* Sparkle effect (rotating) */}
      <Group transform={[{ rotate: rotation * 2 }]}>
        <RoundedRect
          x={-8}
          y={-0.5}
          width={16}
          height={1}
          r={0.5}
          color={config.highlightColor}
          opacity={0.3}
        />
        <RoundedRect
          x={-0.5}
          y={-8}
          width={1}
          height={16}
          r={0.5}
          color={config.highlightColor}
          opacity={0.3}
        />
      </Group>
    </Group>
  );
};

// ============================================
// Collection Animation Renderer
// ============================================

interface CollectionAnimationProps {
  position: Vector2D;
  type: "banana" | "coin";
  progress: number; // 0-1
  offsetX: number;
  offsetY: number;
}

export const CollectionAnimation: React.FC<CollectionAnimationProps> = ({
  position,
  type,
  progress,
  offsetX,
  offsetY,
}) => {
  const x = position.x - offsetX;
  const y = position.y - offsetY;

  const config = COLLECTIBLE_VISUAL_CONFIG[type];

  // Scale up and fade out
  const scale = 1 + progress * 0.5;
  const opacity = 1 - progress;

  // Move upward
  const yOffset = -progress * 30;

  return (
    <Group
      transform={[{ translateX: x }, { translateY: y + yOffset }, { scale }]}
      opacity={opacity}
    >
      {/* Expanding ring */}
      <Circle
        cx={0}
        cy={0}
        r={config.glowRadius * (1 + progress)}
        color={config.glowColor}
        style="stroke"
        strokeWidth={2}
      >
        <BlurMask blur={4} style="normal" />
      </Circle>

      {/* Score popup text indicator */}
      <Circle cx={0} cy={0} r={8} color={config.color} opacity={opacity} />
    </Group>
  );
};

// ============================================
// Main Collectible Renderer
// ============================================

export const CollectibleRenderer: React.FC<CollectibleRendererProps> = ({
  collectibles,
  collectedIds,
  cameraOffset,
  scale,
  gameTime,
}) => {
  // Filter to only uncollected items
  const visibleCollectibles = useMemo(() => {
    return collectibles.filter((c) => !collectedIds.has(c.id));
  }, [collectibles, collectedIds]);

  if (visibleCollectibles.length === 0) {
    return null;
  }

  return (
    <Group transform={[{ scale }]}>
      {visibleCollectibles.map((collectible) => {
        const isCollected = collectedIds.has(collectible.id);
        const props = {
          collectible,
          isCollected,
          offsetX: cameraOffset.x,
          offsetY: cameraOffset.y,
          gameTime,
        };

        if (collectible.type === "banana") {
          return <BananaRenderer key={collectible.id} {...props} />;
        } else if (collectible.type === "coin") {
          return <CoinRenderer key={collectible.id} {...props} />;
        }

        return null;
      })}
    </Group>
  );
};

// ============================================
// Collectible Preview (for UI/menus)
// ============================================

interface CollectiblePreviewProps {
  type: "banana" | "coin";
  size?: number;
  animated?: boolean;
  gameTime?: number;
}

export const CollectiblePreview: React.FC<CollectiblePreviewProps> = ({
  type,
  size = 32,
  animated = true,
  gameTime = 0,
}) => {
  const scale = size / 24; // Base size is 24

  const collectible: Collectible = {
    id: "preview",
    type,
    position: { x: 0, y: 0 },
    areaIndex: 0,
  };

  const props = {
    collectible,
    isCollected: false,
    offsetX: -size / 2,
    offsetY: -size / 2,
    gameTime: animated ? gameTime : 0,
  };

  return (
    <Group transform={[{ scale }]}>
      {type === "banana" ? (
        <BananaRenderer {...props} />
      ) : (
        <CoinRenderer {...props} />
      )}
    </Group>
  );
};

export default CollectibleRenderer;
