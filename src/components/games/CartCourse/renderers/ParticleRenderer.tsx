/**
 * ParticleRenderer - Phase 7
 * Renders particle effects using Skia
 */

import {
  BlurMask,
  Circle,
  Group,
  Oval,
  Rect,
} from "@shopify/react-native-skia";
import React, { useMemo } from "react";
import { Particle } from "../systems/ParticleSystem";
import { Vector2D } from "../types/cartCourse.types";

// ============================================
// Particle Renderer Props
// ============================================

interface ParticleRendererProps {
  particles: Particle[];
  cameraOffset: Vector2D;
  scale: number;
}

// ============================================
// Individual Particle Shapes
// ============================================

interface ParticleShapeProps {
  particle: Particle;
  offsetX: number;
  offsetY: number;
}

/**
 * Dust particle - soft circular shape
 */
const DustParticle: React.FC<ParticleShapeProps> = ({
  particle,
  offsetX,
  offsetY,
}) => {
  const x = particle.position.x - offsetX;
  const y = particle.position.y - offsetY;

  return (
    <Group
      transform={[
        { translateX: x },
        { translateY: y },
        { rotate: particle.rotation },
        { scale: particle.scale },
      ]}
      opacity={particle.alpha}
    >
      <Circle cx={0} cy={0} r={3} color={particle.color}>
        <BlurMask blur={2} style="normal" />
      </Circle>
    </Group>
  );
};

/**
 * Spark particle - bright elongated shape
 */
const SparkParticle: React.FC<ParticleShapeProps> = ({
  particle,
  offsetX,
  offsetY,
}) => {
  const x = particle.position.x - offsetX;
  const y = particle.position.y - offsetY;

  // Calculate velocity direction for elongation
  const velMag = Math.sqrt(particle.velocity.x ** 2 + particle.velocity.y ** 2);
  const velAngle =
    velMag > 0.1
      ? Math.atan2(particle.velocity.y, particle.velocity.x)
      : particle.rotation;

  return (
    <Group
      transform={[
        { translateX: x },
        { translateY: y },
        { rotate: velAngle },
        { scale: particle.scale },
      ]}
      opacity={particle.alpha}
    >
      {/* Elongated spark shape */}
      <Oval x={-4} y={-1} width={8} height={2} color={particle.color} />
      {/* Bright center */}
      <Circle cx={0} cy={0} r={1} color="#ffffff" />
    </Group>
  );
};

/**
 * Trail particle - fading circle
 */
const TrailParticle: React.FC<ParticleShapeProps> = ({
  particle,
  offsetX,
  offsetY,
}) => {
  const x = particle.position.x - offsetX;
  const y = particle.position.y - offsetY;

  return (
    <Circle
      cx={x}
      cy={y}
      r={particle.scale}
      color={particle.color}
      opacity={particle.alpha * 0.5}
    >
      <BlurMask blur={3} style="normal" />
    </Circle>
  );
};

/**
 * Collect particle - star-like burst
 */
const CollectParticle: React.FC<ParticleShapeProps> = ({
  particle,
  offsetX,
  offsetY,
}) => {
  const x = particle.position.x - offsetX;
  const y = particle.position.y - offsetY;

  return (
    <Group
      transform={[
        { translateX: x },
        { translateY: y },
        { rotate: particle.rotation },
        { scale: particle.scale },
      ]}
      opacity={particle.alpha}
    >
      {/* Diamond shape */}
      <Rect x={-2} y={-1} width={4} height={2} color={particle.color} />
      <Rect x={-1} y={-2} width={2} height={4} color={particle.color} />
      {/* Glow */}
      <Circle cx={0} cy={0} r={2} color={particle.color}>
        <BlurMask blur={2} style="normal" />
      </Circle>
    </Group>
  );
};

/**
 * Coin particle - golden sparkle
 */
const CoinParticle: React.FC<ParticleShapeProps> = ({
  particle,
  offsetX,
  offsetY,
}) => {
  const x = particle.position.x - offsetX;
  const y = particle.position.y - offsetY;

  return (
    <Group
      transform={[
        { translateX: x },
        { translateY: y },
        { rotate: particle.rotation },
        { scale: particle.scale },
      ]}
      opacity={particle.alpha}
    >
      {/* Star shape using rotated rectangles */}
      <Rect x={-3} y={-1} width={6} height={2} color={particle.color} />
      <Rect x={-1} y={-3} width={2} height={6} color={particle.color} />
      <Group transform={[{ rotate: Math.PI / 4 }]}>
        <Rect x={-2} y={-0.5} width={4} height={1} color={particle.color} />
        <Rect x={-0.5} y={-2} width={1} height={4} color={particle.color} />
      </Group>
      {/* Bright center */}
      <Circle cx={0} cy={0} r={1.5} color="#ffffff" />
    </Group>
  );
};

/**
 * Crash particle - explosive debris
 */
const CrashParticle: React.FC<ParticleShapeProps> = ({
  particle,
  offsetX,
  offsetY,
}) => {
  const x = particle.position.x - offsetX;
  const y = particle.position.y - offsetY;

  return (
    <Group
      transform={[
        { translateX: x },
        { translateY: y },
        { rotate: particle.rotation },
        { scale: particle.scale },
      ]}
      opacity={particle.alpha}
    >
      {/* Irregular debris shape */}
      <Rect x={-2} y={-1.5} width={4} height={3} color={particle.color} />
      {/* Fire glow */}
      <Circle cx={0} cy={0} r={2} color={particle.color}>
        <BlurMask blur={3} style="normal" />
      </Circle>
    </Group>
  );
};

/**
 * Checkpoint particle - celebratory burst
 */
const CheckpointParticle: React.FC<ParticleShapeProps> = ({
  particle,
  offsetX,
  offsetY,
}) => {
  const x = particle.position.x - offsetX;
  const y = particle.position.y - offsetY;

  return (
    <Group
      transform={[
        { translateX: x },
        { translateY: y },
        { rotate: particle.rotation },
        { scale: particle.scale },
      ]}
      opacity={particle.alpha}
    >
      {/* Confetti-like rectangle */}
      <Rect x={-3} y={-1} width={6} height={2} color={particle.color} />
      {/* Subtle glow */}
      <Circle cx={0} cy={0} r={2} color={particle.color}>
        <BlurMask blur={1} style="normal" />
      </Circle>
    </Group>
  );
};

// ============================================
// Particle Shape Selector
// ============================================

const renderParticleByType = (
  particle: Particle,
  offsetX: number,
  offsetY: number,
): React.ReactNode => {
  const props = { particle, offsetX, offsetY };

  switch (particle.type) {
    case "dust":
      return <DustParticle key={particle.id} {...props} />;
    case "spark":
      return <SparkParticle key={particle.id} {...props} />;
    case "trail":
      return <TrailParticle key={particle.id} {...props} />;
    case "collect":
      return <CollectParticle key={particle.id} {...props} />;
    case "coin":
      return <CoinParticle key={particle.id} {...props} />;
    case "crash":
      return <CrashParticle key={particle.id} {...props} />;
    case "checkpoint":
      return <CheckpointParticle key={particle.id} {...props} />;
    default:
      return <DustParticle key={particle.id} {...props} />;
  }
};

// ============================================
// Main Particle Renderer
// ============================================

export const ParticleRenderer: React.FC<ParticleRendererProps> = ({
  particles,
  cameraOffset,
  scale,
}) => {
  // Filter visible particles
  const visibleParticles = useMemo(() => {
    return particles.filter((p) => p.isAlive && p.alpha > 0.01);
  }, [particles]);

  if (visibleParticles.length === 0) {
    return null;
  }

  return (
    <Group transform={[{ scale }]}>
      {visibleParticles.map((particle) =>
        renderParticleByType(particle, cameraOffset.x, cameraOffset.y),
      )}
    </Group>
  );
};

export default ParticleRenderer;
