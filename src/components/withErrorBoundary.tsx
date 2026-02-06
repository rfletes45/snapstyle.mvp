/**
 * withErrorBoundary Higher-Order Component
 *
 * Wraps a screen component with an ErrorBoundary to catch render errors
 * and display a fallback UI instead of crashing the entire app.
 *
 * @module components/withErrorBoundary
 */

import React, { ComponentType } from "react";
import { ErrorBoundary } from "./ErrorBoundary";

/**
 * Wrap a screen component with an ErrorBoundary.
 * The return type uses `any` for props to satisfy React Navigation's
 * ScreenComponentType which expects components accepting any/no props.
 *
 * @example
 * const SafeChessScreen = withErrorBoundary(ChessGameScreen);
 * // Use in navigator: <Stack.Screen component={SafeChessScreen} />
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  displayName?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): ComponentType<any> {
  const ComponentWithBoundary = (props: P) => (
    <ErrorBoundary>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithBoundary.displayName = `withErrorBoundary(${displayName || WrappedComponent.displayName || WrappedComponent.name || "Component"})`;

  return ComponentWithBoundary as ComponentType<any>;
}
