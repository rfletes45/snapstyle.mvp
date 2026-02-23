/**
 * Animal Theme Asset Registry
 *
 * Static require() mappings for animal theme images and sounds.
 * Each animal has:
 *   - image: displayed in composer button + message bubble + shop/customization
 *   - sound: played on button press
 *
 * IMPORTANT: All require() calls must be at module top-level
 * so Metro can statically resolve and bundle the files.
 *
 * @module cosmetics/animalAssets
 */

import type { ImageSourcePropType } from "react-native";

// =============================================================================
// Image Assets
// =============================================================================

export const animalImages: Record<string, ImageSourcePropType> = {
  animal_duck: require("../../assets/animals/duck.jpeg"),
  animal_bear: require("../../assets/animals/bear.png"),
  animal_wolf: require("../../assets/animals/wolf.png"),
  animal_turtle: require("../../assets/animals/turtle.png"),
} as const;

// =============================================================================
// Sound Assets
// =============================================================================

export const animalSounds: Record<string, number> = {
  animal_duck: require("../../assets/animals/duck_quack.mp3"),
  animal_bear: require("../../assets/animals/bear_growl.mp3"),
  animal_wolf: require("../../assets/animals/wolf_howl.mp3"),
  animal_turtle: require("../../assets/animals/turtle_splish.mp3"),
} as const;

// =============================================================================
// Lookup Helpers
// =============================================================================

/** Default animal theme ID (used when nothing is equipped). */
export const DEFAULT_ANIMAL_THEME_ID = "animal_duck";

/**
 * Get the image source for an animal theme.
 * Falls back to duck if the ID is unknown.
 */
export function getAnimalImage(animalId: string | null): ImageSourcePropType {
  return (
    animalImages[animalId ?? DEFAULT_ANIMAL_THEME_ID] ??
    animalImages[DEFAULT_ANIMAL_THEME_ID]
  );
}

/**
 * Get the sound asset for an animal theme.
 * Falls back to duck if the ID is unknown.
 */
export function getAnimalSound(animalId: string | null): number {
  return (
    animalSounds[animalId ?? DEFAULT_ANIMAL_THEME_ID] ??
    animalSounds[DEFAULT_ANIMAL_THEME_ID]
  );
}

/**
 * Check whether an animal image asset exists for a given ID.
 */
export function hasAnimalImage(animalId: string): boolean {
  return animalId in animalImages;
}

/**
 * Get all available animal theme IDs.
 */
export function getAnimalThemeIds(): string[] {
  return Object.keys(animalImages);
}
