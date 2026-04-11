/**
 * AppImage - Thin wrapper around expo-image providing:
 * - disk + memory caching by default
 * - subtle cross-dissolve transition
 *
 * Drop-in replacement for RN `<Image>` when rendering *remote* images.
 * Local `require()` assets should continue to use RN Image directly.
 *
 * @module components/AppImage
 */

import { Image, type ImageLoadEventData, type ImageProps } from "expo-image";
import React, { useCallback } from "react";

/** Default cross-dissolve duration in ms */
const DEFAULT_TRANSITION_MS = 200;

/** Default cache policy - keep in both memory and disk */
const DEFAULT_CACHE_POLICY: ImageProps["cachePolicy"] = "memory-disk";

export type AppImageProps = ImageProps & {
  /** Optional label retained for backwards-compatible call sites. */
  debugLabel?: string;
};

/**
 * Optimized image component backed by `expo-image`.
 *
 * Adds sensible caching and transitions.
 */
export function AppImage({
  cachePolicy = DEFAULT_CACHE_POLICY,
  transition = DEFAULT_TRANSITION_MS,
  contentFit = "cover",
  debugLabel: _debugLabel,
  onLoad,
  onError,
  ...rest
}: AppImageProps) {
  const handleLoadStart = useCallback(() => {
    rest.onLoadStart?.();
  }, [rest.onLoadStart]);

  const handleLoad = useCallback(
    (event: ImageLoadEventData) => {
      onLoad?.(event);
    },
    [onLoad],
  );

  const handleError = useCallback(
    (event: { error: string }) => {
      onError?.(event);
    },
    [onError],
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
