/**
 * Picker Preload Registry
 *
 * Caches dynamic import promises for picker components so they can be
 * triggered ahead of time (e.g. on chat screen mount) rather than on
 * first tap. Each getter returns the same promise on subsequent calls,
 * making them safe to use directly in React.lazy() factories.
 *
 * Resolved component references are also cached so that buttons can
 * bypass React.lazy() + Suspense entirely once the import has settled,
 * eliminating the 1-frame fallback flash that React.lazy always produces.
 *
 * @module components/chat/pickerPreload
 */

import type React from "react";

import type { ComposerToolbarItemId } from "./ComposerToolbar/types";

// ---------------------------------------------------------------------------
// Cached import promises
// ---------------------------------------------------------------------------

let gifPickerPromise: Promise<typeof import("./GifPicker")> | null = null;
let emojiPickerPromise: Promise<typeof import("./FullEmojiPicker")> | null =
  null;
let stickerPickerPromise: Promise<typeof import("./StickerPicker")> | null =
  null;
let gamePickerPromise: ReturnType<typeof startGamePickerImport> | null = null;
let gifStickerPickerPromise: Promise<
  typeof import("./GifStickerPicker")
> | null = null;

// ---------------------------------------------------------------------------
// Resolved component cache — set once the import promise settles
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let resolvedGifPicker: React.ComponentType<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let resolvedEmojiPicker: React.ComponentType<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let resolvedStickerPicker: React.ComponentType<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let resolvedGamePicker: React.ComponentType<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let resolvedGifStickerPicker: React.ComponentType<any> | null = null;

// ---------------------------------------------------------------------------
// Getters — start the import if not already in flight, return cached promise
// ---------------------------------------------------------------------------

function startGamePickerImport() {
  return import("@/gamesV4/components/GamePickerModal").then((m) => ({
    default: m.GamePickerModal,
  }));
}

export function getGifPickerImport() {
  if (!gifPickerPromise) {
    gifPickerPromise = import("./GifPicker");
    gifPickerPromise.then((m) => {
      resolvedGifPicker = m.default;
    });
  }
  return gifPickerPromise;
}

export function getEmojiPickerImport() {
  if (!emojiPickerPromise) {
    emojiPickerPromise = import("./FullEmojiPicker");
    emojiPickerPromise.then((m) => {
      resolvedEmojiPicker = m.default;
    });
  }
  return emojiPickerPromise;
}

export function getStickerPickerImport() {
  if (!stickerPickerPromise) {
    stickerPickerPromise = import("./StickerPicker");
    stickerPickerPromise.then((m) => {
      resolvedStickerPicker = m.default;
    });
  }
  return stickerPickerPromise;
}

export function getGamePickerImport() {
  if (!gamePickerPromise) {
    gamePickerPromise = startGamePickerImport();
    gamePickerPromise.then((m) => {
      resolvedGamePicker = m.default;
    });
  }
  return gamePickerPromise;
}

export function getGifStickerPickerImport() {
  if (!gifStickerPickerPromise) {
    gifStickerPickerPromise = import("./GifStickerPicker");
    gifStickerPickerPromise.then((m) => {
      resolvedGifStickerPicker = m.default;
    });
  }
  return gifStickerPickerPromise;
}

// ---------------------------------------------------------------------------
// Resolved getters — return the component synchronously if already loaded
// ---------------------------------------------------------------------------

export function getResolvedGifPicker() {
  return resolvedGifPicker;
}
export function getResolvedEmojiPicker() {
  return resolvedEmojiPicker;
}
export function getResolvedStickerPicker() {
  return resolvedStickerPicker;
}
export function getResolvedGamePicker() {
  return resolvedGamePicker;
}
export function getResolvedGifStickerPicker() {
  return resolvedGifStickerPicker;
}

// ---------------------------------------------------------------------------
// Toolbar → preload mapping
// ---------------------------------------------------------------------------

const PRELOAD_MAP: Partial<Record<ComposerToolbarItemId, () => void>> = {
  gif: getGifPickerImport,
  emoji: getEmojiPickerImport,
  sticker: getStickerPickerImport,
  game: getGamePickerImport,
  "gif-sticker": getGifStickerPickerImport,
};

/**
 * Preload picker modules for the given toolbar item IDs.
 * Idempotent — safe to call multiple times.
 */
export function preloadPickersForToolbar(itemIds: ComposerToolbarItemId[]) {
  for (const id of itemIds) {
    PRELOAD_MAP[id]?.();
  }
}
