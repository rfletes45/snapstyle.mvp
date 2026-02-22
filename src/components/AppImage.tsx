/**
 * AppImage – Thin wrapper around expo-image providing:
 * - disk + memory caching by default
 * - subtle cross-dissolve transition
 * - dev-only load-time instrumentation
 *
 * Drop-in replacement for RN `<Image>` when rendering *remote* images.
 * Local `require()` assets should continue to use RN Image directly.
 *
 * @module components/AppImage
 */

import { Image, type ImageLoadEventData, type ImageProps } from "expo-image";
import React, { useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default cross-dissolve duration in ms */
const DEFAULT_TRANSITION_MS = 200;

/** Default cache policy – keep in both memory and disk */
const DEFAULT_CACHE_POLICY: ImageProps["cachePolicy"] = "memory-disk";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type AppImageProps = ImageProps & {
  /** Optional label used in dev instrumentation logs */
  debugLabel?: string;
};

/**
 * Optimised image component backed by `expo-image`.
 *
 * Adds sensible caching, transitions, and load-time logging.
 */
export function AppImage({
  cachePolicy = DEFAULT_CACHE_POLICY,
  transition = DEFAULT_TRANSITION_MS,
  contentFit = "cover",
  debugLabel,
  onLoad,
  onError,
  ...rest
}: AppImageProps) {
  const loadStart = useRef<number>(0);

  const handleLoadStart = useCallback(() => {
    loadStart.current = performance.now();
    rest.onLoadStart?.();
  }, [rest.onLoadStart]);

  const handleLoad = useCallback(
    (event: ImageLoadEventData) => {
      if (__DEV__ && loadStart.current > 0) {
        const elapsed = (performance.now() - loadStart.current).toFixed(0);
        const src =
          typeof rest.source === "object" &&
          rest.source !== null &&
          "uri" in rest.source
            ? (rest.source as { uri?: string }).uri?.slice(0, 80)
            : "local";
        console.log(
          `[AppImage] ${debugLabel ?? "img"} loaded in ${elapsed}ms ` +
            `(cache: ${event.cacheType}) src=${src}…`,
        );
      }
      onLoad?.(event);
    },
    [debugLabel, onLoad, rest.source],
  );

  const handleError = useCallback(
    (event: { error: string }) => {
      if (__DEV__) {
        console.warn(
          `[AppImage] ${debugLabel ?? "img"} failed:`,
          event.error,
          typeof rest.source === "object" &&
            rest.source !== null &&
            "uri" in rest.source
            ? (rest.source as { uri?: string }).uri?.slice(0, 120)
            : rest.source,
        );
      }
      onError?.(event);
    },
    [debugLabel, onError, rest.source],
  );

  return (
    <Image
      cachePolicy={cachePolicy}
      transition={transition}
      contentFit={contentFit}
      onLoadStart={handleLoadStart}
      onLoad={handleLoad}
      onError={handleError}
      {...rest}
    />
  );
}

export default AppImage;
