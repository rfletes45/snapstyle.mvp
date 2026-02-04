/**
 * Safe Skia Renderer
 * Wraps SkiaRenderer with error handling, falls back to simple View-based renderer
 */

import React, { Component, ErrorInfo } from "react";
import { StyleSheet } from "react-native";
import { GameEntities } from "../types/cartCourse.types";
import { FallbackRenderer } from "./FallbackRenderer";
import { SkiaRenderer } from "./SkiaRenderer";

// ============================================
// Error Boundary State
// ============================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ============================================
// Safe Skia Renderer Props
// ============================================

interface SafeSkiaRendererProps {
  entities: GameEntities;
}

// ============================================
// Skia Error Boundary
// ============================================

class SkiaErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn(
      "[SafeSkiaRenderer] Skia rendering failed, using fallback:",
      error.message,
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ============================================
// Safe Skia Renderer Component
// ============================================

export const SafeSkiaRenderer: React.FC<SafeSkiaRendererProps> = ({
  entities,
}) => {
  if (!entities) {
    return null;
  }

  return (
    <SkiaErrorBoundary fallback={<FallbackRenderer entities={entities} />}>
      <SkiaRenderer entities={entities} />
    </SkiaErrorBoundary>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 14,
    textAlign: "center",
  },
});
