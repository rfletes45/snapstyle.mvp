/**
 * Font Loader
 *
 * Loads custom fonts from the assets/fonts directory using expo-font.
 * Each key corresponds to a cosmetic catalog font ID's fontFamily value,
 * ensuring consistency across catalog → loader → renderer.
 *
 * Usage: call `loadCustomFonts()` during app startup (before first render).
 * On failure, logs a warning and continues — the resolver falls back to
 * platform defaults for any font that didn't load.
 *
 * @module fonts/fontLoader
 */

import * as Font from "expo-font";
import { Platform } from "react-native";

// =============================================================================
// Font Map
// =============================================================================

/**
 * Maps registered font key → asset require.
 * The key here MUST match the fontFamily string used in chatDefaults
 * CHAT_FONT_FAMILIES and chatCatalog metadata.
 *
 * NOTE: BellMT-Regular.ttf has a malformed cmap table (languageId != 0)
 * which causes OTS parsing failure in Chromium browsers.  We skip it on
 * web to avoid noisy console errors; native platforms handle it fine.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fontAssetsBase: Record<string, ReturnType<typeof require>> = {
  pf_agency: require("../../assets/fonts/AgencyFB-Regular.ttf"),
  pf_bradleyhand: require("../../assets/fonts/BradleyHand-Regular.ttf"),
  pf_bauhaus: require("../../assets/fonts/Bauhaus93-Regular.ttf"),
  pf_chiller: require("../../assets/fonts/Chiller-Regular.ttf"),
};

// BellMT has a broken cmap table — Chromium rejects it.
if (Platform.OS !== "web") {
  fontAssetsBase.pf_bellmt = require("../../assets/fonts/BellMT-Regular.ttf");
}
/* eslint-enable @typescript-eslint/no-require-imports */

const fontAssets = fontAssetsBase;

export const CUSTOM_FONT_MAP = fontAssets;

/**
 * All custom font keys registered in this module.
 * This can be used at runtime to verify whether a fontFamily string
 * refers to a custom-loaded font.
 */
export const CUSTOM_FONT_KEYS = Object.keys(CUSTOM_FONT_MAP);

// =============================================================================
// Loader
// =============================================================================

/** Whether fonts have been successfully loaded. */
let _fontsLoaded = false;

/**
 * Load all custom fonts. Safe to call multiple times — subsequent calls
 * are no-ops if fonts already loaded.
 *
 * @returns `true` if all fonts loaded successfully; `false` on error.
 */
export async function loadCustomFonts(): Promise<boolean> {
  if (_fontsLoaded) return true;

  try {
    await Font.loadAsync(CUSTOM_FONT_MAP);
    _fontsLoaded = true;

    if (__DEV__) {
      console.log(
        `[fontLoader] Loaded ${CUSTOM_FONT_KEYS.length} custom fonts:`,
        CUSTOM_FONT_KEYS.join(", "),
      );
    }

    return true;
  } catch (error) {
    console.error(
      "[fontLoader] Failed to load custom fonts. Falling back to system defaults.",
      error,
    );
    return false;
  }
}

/**
 * Check if a font key is a custom-loaded font (vs a platform built-in).
 */
export function isCustomFont(fontFamily: string | undefined): boolean {
  if (!fontFamily) return false;
  return fontFamily in CUSTOM_FONT_MAP;
}

/**
 * Whether custom fonts have finished loading.
 */
export function areFontsLoaded(): boolean {
  return _fontsLoaded;
}
