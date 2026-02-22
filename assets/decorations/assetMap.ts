/**
 * Decoration Asset Map — BACK-COMPAT SHIM
 *
 * This file now delegates to the unified cosmetics asset registry.
 * All existing imports of DECORATION_ASSETS / getDecorationAsset /
 * hasDecorationAsset continue to work unchanged.
 *
 * TODO: Remove this file after all consumers migrate to @/cosmetics/assetRegistry
 *
 * @deprecated Use `@/cosmetics/assetRegistry` directly for new code.
 */

import { ImageSourcePropType } from "react-native";
import {
  decorationAssets,
  getCosmeticAsset,
  getLoadedIds,
  hasCosmeticAsset,
} from "../../src/cosmetics/assetRegistry";

/**
 * @deprecated Use `decorationAssets` from `@/cosmetics/assetRegistry`.
 */
export const DECORATION_ASSETS: Record<string, ImageSourcePropType | null> =
  decorationAssets as Record<string, ImageSourcePropType | null>;

/**
 * @deprecated Use `getCosmeticAsset("decoration", id)`.
 */
export function getDecorationAsset(
  decorationId: string,
): ImageSourcePropType | null {
  return getCosmeticAsset(
    "decoration",
    decorationId,
  ) as ImageSourcePropType | null;
}

/**
 * @deprecated Use `hasCosmeticAsset("decoration", id)`.
 */
export function hasDecorationAsset(decorationId: string): boolean {
  return hasCosmeticAsset("decoration", decorationId);
}

/**
 * @deprecated Use `getLoadedIds("decoration")`.
 */
export function getLoadedDecorationIds(): string[] {
  return getLoadedIds("decoration");
}
