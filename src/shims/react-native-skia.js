/**
 * @shopify/react-native-skia shim for web
 *
 * This module provides stub exports for react-native-skia
 * to prevent bundler errors on web platform.
 */

import React from "react";
import { View } from "react-native";

// Stub Canvas component
export const Canvas = ({ children, style, ...props }) => {
  console.warn(
    "[react-native-skia shim] Canvas not available on web, rendering fallback",
  );
  return React.createElement(View, { style, ...props }, children);
};

// Stub drawing components - return null or simple views
const createStubComponent = (name) => {
  const Component = ({ children, ...props }) => {
    return children || null;
  };
  Component.displayName = name;
  return Component;
};

// Basic shapes
export const Rect = createStubComponent("Rect");
export const RoundedRect = createStubComponent("RoundedRect");
export const Circle = createStubComponent("Circle");
export const Line = createStubComponent("Line");
export const Path = createStubComponent("Path");
export const Group = createStubComponent("Group");
export const Image = createStubComponent("Image");
export const Text = createStubComponent("Text");

// Effects
export const Shadow = createStubComponent("Shadow");
export const Blur = createStubComponent("Blur");
export const ColorMatrix = createStubComponent("ColorMatrix");
export const BlendColor = createStubComponent("BlendColor");

// Gradients
export const LinearGradient = createStubComponent("LinearGradient");
export const RadialGradient = createStubComponent("RadialGradient");
export const SweepGradient = createStubComponent("SweepGradient");

// Paint
export const Paint = createStubComponent("Paint");

// Utility functions
export const vec = (x = 0, y = 0) => ({ x, y });
export const point = (x = 0, y = 0) => ({ x, y });
export const rect = (x = 0, y = 0, width = 0, height = 0) => ({
  x,
  y,
  width,
  height,
});
export const rrect = (r, rx = 0, ry = 0) => ({ rect: r, rx, ry });

// Skia value types
export const useValue = (initialValue) => {
  const [value, setValue] = React.useState(initialValue);
  return { current: value, value, setValue };
};

export const useTiming = () => ({ current: 0 });
export const useSpring = () => ({ current: 0 });
export const useLoop = () => ({ current: 0 });
export const useDerivedValue = (fn) => ({ current: fn() });
export const useComputedValue = (fn) => ({ current: fn() });
export const useSharedValueEffect = () => {};
export const runTiming = () => {};
export const runSpring = () => {};
export const runDecay = () => {};

// Font and text
export const useFont = () => null;
export const useFonts = () => ({});
export const matchFont = () => null;

// Image
export const useImage = () => null;

// Skia
export const Skia = {
  Color: (color) => color,
  Path: {
    Make: () => ({
      moveTo: () => {},
      lineTo: () => {},
      quadTo: () => {},
      cubicTo: () => {},
      close: () => {},
      reset: () => {},
    }),
  },
  Matrix: () => [1, 0, 0, 0, 1, 0, 0, 0, 1],
  Paint: () => ({
    setColor: () => {},
    setStrokeWidth: () => {},
    setStyle: () => {},
    setAntiAlias: () => {},
  }),
  PaintStyle: {
    Fill: 0,
    Stroke: 1,
  },
  BlendMode: {
    Clear: 0,
    Src: 1,
    Dst: 2,
    SrcOver: 3,
    DstOver: 4,
    Multiply: 5,
  },
  FilterMode: {
    Nearest: 0,
    Linear: 1,
  },
  MipmapMode: {
    None: 0,
    Nearest: 1,
    Linear: 2,
  },
  TileMode: {
    Clamp: 0,
    Repeat: 1,
    Mirror: 2,
    Decal: 3,
  },
};

// Export types (these are just placeholders)
export const PaintStyle = Skia.PaintStyle;
export const BlendMode = Skia.BlendMode;
export const FilterMode = Skia.FilterMode;
export const MipmapMode = Skia.MipmapMode;
export const TileMode = Skia.TileMode;

// Default export
export default {
  Canvas,
  Rect,
  RoundedRect,
  Circle,
  Line,
  Path,
  Group,
  Image,
  Text,
  Shadow,
  Blur,
  ColorMatrix,
  BlendColor,
  LinearGradient,
  RadialGradient,
  SweepGradient,
  Paint,
  vec,
  point,
  rect,
  rrect,
  useValue,
  useTiming,
  useSpring,
  useLoop,
  useDerivedValue,
  useComputedValue,
  useSharedValueEffect,
  runTiming,
  runSpring,
  runDecay,
  useFont,
  useFonts,
  matchFont,
  useImage,
  Skia,
  PaintStyle,
  BlendMode,
  FilterMode,
  MipmapMode,
  TileMode,
};
