/**
 * Avatar Decorations Asset Index
 *
 * Central export for all decoration asset utilities.
 * Assets are managed via assetMap.ts — uncomment require() lines there
 * as you add image files to the category subfolders.
 *
 * @see assetMap.ts for the full asset registry
 * @see README.md for asset specifications
 */

export {
  DECORATION_ASSETS,
  getDecorationAsset,
  getLoadedDecorationIds,
  hasDecorationAsset,
} from "./assetMap";

/**
 * Whether decoration assets have been added and the system is ready.
 * This flips to true automatically when at least one asset is loaded.
 */
export { getLoadedDecorationIds as _checkLoaded } from "./assetMap";
