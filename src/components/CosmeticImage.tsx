/**
 * CosmeticImage — High-performance image component for cosmetic assets.
 *
 * Uses expo-image under the hood for native-side decoding, memory+disk
 * caching, and efficient recycling in scrollable lists.  Replaces RN
 * `<Image>` for all cosmetic asset rendering (backgrounds, badges,
 * decorations, animals) to eliminate multi-second decode times caused
 * by feeding multi-MB PNG sources into RN's JS-side image pipeline.
 *
 * Features:
 *  - Native-side image decoding (avoids JS thread blocking)
 *  - Memory + disk cache (instant re-render of previously seen images)
 *  - `recyclingKey` support for FlatList item recycling
 *  - Dev-only load-time + cache-hit metrics
 *  - Memoised to prevent unnecessary re-renders
 *
 * @module components/CosmeticImage
 */

import { Image, type ImageLoadEventData, type ImageProps } from "expo-image";
import React, { useCallback, useRef } from "react";
import type { ImageSourcePropType, ImageStyle, StyleProp } from "react-native";

// ---------------------------------------------------------------------------
// Metrics store (dev only, never shipped)
// ---------------------------------------------------------------------------

type CacheType = "none" | "memory" | "disk" | "unknown";

interface LoadMetric {
  label: string;
  durationMs: number;
  cacheType: CacheType;
  timestamp: number;
}

/** Ring buffer of recent load metrics (dev only). */
const _metrics: LoadMetric[] = [];
const MAX_METRICS = 200;

let _cacheHits = 0;
let _cacheMisses = 0;
let _totalLoads = 0;

/**
 * Returns a snapshot of dev metrics.  Safe to call in production (returns
 * zeroed values).
 */
export function getCosmeticImageMetrics() {
  if (!__DEV__)
    return {
      totalLoads: 0,
      cacheHits: 0,
      cacheMisses: 0,
      hitRate: 0,
      recent: [],
    };
  return {
    totalLoads: _totalLoads,
    cacheHits: _cacheHits,
    cacheMisses: _cacheMisses,
    hitRate: _totalLoads > 0 ? Math.round((_cacheHits / _totalLoads) * 100) : 0,
    recent: _metrics.slice(-20),
  };
}

/** Reset metrics (dev only). */
export function resetCosmeticImageMetrics() {
  _metrics.length = 0;
  _cacheHits = 0;
  _cacheMisses = 0;
  _totalLoads = 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface CosmeticImageProps {
  /** The image source — typically from `getCosmeticAsset()` or `getAnimalImage()`. */
  source: ImageSourcePropType | null | undefined;
  /** Style applied to the image. */
  style?: StyleProp<ImageStyle>;
  /** How the image fits the container. Defaults to `"cover"`. */
  contentFit?: ImageProps["contentFit"];
  /** Stable key for recycling inside FlatList/FlashList. */
  recyclingKey?: string;
  /** Dev label for metrics logging. */
  debugLabel?: string;
  /** Override transition duration (ms).  Set to 0 to disable. */
  transition?: number;
}

/**
 * Optimised cosmetic image renderer backed by expo-image.
 *
 * Drop-in replacement for `<Image source={getCosmeticAsset(…)} … />`.
 */
export const CosmeticImage = React.memo(function CosmeticImage({
  source,
  style,
  contentFit = "cover",
  recyclingKey,
  debugLabel,
  transition = 150,
}: CosmeticImageProps) {
  const loadStart = useRef(0);

  const handleLoadStart = useCallback(() => {
    loadStart.current = performance.now();
  }, []);

  const handleLoad = useCallback(
    (event: ImageLoadEventData) => {
      if (__DEV__ && loadStart.current > 0) {
        const elapsed = performance.now() - loadStart.current;
        const cacheType: CacheType =
          (event.cacheType as CacheType) ?? "unknown";

        _totalLoads++;
        if (cacheType === "memory" || cacheType === "disk") {
          _cacheHits++;
        } else {
          _cacheMisses++;
        }

        const entry: LoadMetric = {
          label: debugLabel ?? "cosmetic",
          durationMs: Math.round(elapsed),
          cacheType,
          timestamp: Date.now(),
        };
        _metrics.push(entry);
        if (_metrics.length > MAX_METRICS) _metrics.shift();

        if (elapsed > 500) {
          console.warn(
            `[CosmeticImage] SLOW ${entry.label}: ${entry.durationMs}ms (cache: ${cacheType})`,
          );
        }
      }
    },
    [debugLabel],
  );

  if (!source) return null;

  return (
    <Image
      source={source}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      transition={transition}
      recyclingKey={recyclingKey}
      onLoadStart={handleLoadStart}
      onLoad={handleLoad}
    />
  );
});

export default CosmeticImage;
