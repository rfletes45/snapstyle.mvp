/**
 * Cart Renderer
 * Renders the cart with body and wheels using Skia
 */

import { Circle, Group, Rect, RoundedRect } from "@shopify/react-native-skia";
import React from "react";
import {
  CART_HEIGHT,
  CART_WIDTH,
  VISUAL_CONFIG,
  WHEEL_RADIUS,
} from "../data/constants";
import { CartEntity } from "../types/cartCourse.types";

// ============================================
// Cart Renderer Props
// ============================================

interface CartRendererProps {
  cart: CartEntity;
}

// ============================================
// Cart Renderer Component
// ============================================

export const CartRenderer: React.FC<CartRendererProps> = ({ cart }) => {
  if (!cart || !cart.body) {
    return null;
  }

  const { body, leftWheel, rightWheel } = cart;
  const { cart: cartColors } = VISUAL_CONFIG;

  // Get positions and angles from physics bodies
  const bodyX = body.position.x;
  const bodyY = body.position.y;
  const bodyAngle = body.angle;

  const leftWheelX = leftWheel.position.x;
  const leftWheelY = leftWheel.position.y;
  const leftWheelAngle = leftWheel.angle;

  const rightWheelX = rightWheel.position.x;
  const rightWheelY = rightWheel.position.y;
  const rightWheelAngle = rightWheel.angle;

  return (
    <Group>
      {/* Cart Body */}
      <Group
        transform={[
          { translateX: bodyX },
          { translateY: bodyY },
          { rotate: bodyAngle },
        ]}
      >
        {/* Main body rectangle */}
        <RoundedRect
          x={-CART_WIDTH / 2}
          y={-CART_HEIGHT / 2}
          width={CART_WIDTH}
          height={CART_HEIGHT}
          r={4}
          color={cartColors.bodyColor}
        />

        {/* Body highlight */}
        <Rect
          x={-CART_WIDTH / 2 + 2}
          y={-CART_HEIGHT / 2 + 2}
          width={CART_WIDTH - 4}
          height={4}
          color={cartColors.highlightColor}
        />

        {/* Axle bar */}
        <Rect
          x={-CART_WIDTH / 2 + WHEEL_RADIUS - 2}
          y={CART_HEIGHT / 2 - 3}
          width={CART_WIDTH - (WHEEL_RADIUS - 2) * 2}
          height={6}
          color={cartColors.axleColor}
        />
      </Group>

      {/* Left Wheel */}
      <Group
        transform={[
          { translateX: leftWheelX },
          { translateY: leftWheelY },
          { rotate: leftWheelAngle },
        ]}
      >
        {/* Wheel outer */}
        <Circle cx={0} cy={0} r={WHEEL_RADIUS} color={cartColors.wheelColor} />
        {/* Wheel inner (hub) */}
        <Circle
          cx={0}
          cy={0}
          r={WHEEL_RADIUS * 0.5}
          color={cartColors.axleColor}
        />
        {/* Wheel spoke (to show rotation) */}
        <Rect
          x={-1}
          y={-WHEEL_RADIUS + 2}
          width={2}
          height={WHEEL_RADIUS - 4}
          color={cartColors.highlightColor}
        />
      </Group>

      {/* Right Wheel */}
      <Group
        transform={[
          { translateX: rightWheelX },
          { translateY: rightWheelY },
          { rotate: rightWheelAngle },
        ]}
      >
        {/* Wheel outer */}
        <Circle cx={0} cy={0} r={WHEEL_RADIUS} color={cartColors.wheelColor} />
        {/* Wheel inner (hub) */}
        <Circle
          cx={0}
          cy={0}
          r={WHEEL_RADIUS * 0.5}
          color={cartColors.axleColor}
        />
        {/* Wheel spoke (to show rotation) */}
        <Rect
          x={-1}
          y={-WHEEL_RADIUS + 2}
          width={2}
          height={WHEEL_RADIUS - 4}
          color={cartColors.highlightColor}
        />
      </Group>
    </Group>
  );
};
