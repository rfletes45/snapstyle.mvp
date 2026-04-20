/**
 * Picker Preload Registry
 *
 * Caches dynamic import promises for picker components so they can be
 * triggered ahead of time rather than on first tap. Resolved component
 * references are exposed synchronously so buttons can bypass React.lazy()
 * once a preload has completed.
 *
 * The registry also exposes an observable load state. Toolbar buttons use it
 * to clear their loading overlay as soon as an import resolves, rejects, or is
 * retried.
 *
 * @module components/chat/pickerPreload
 */

import { createLogger, isDebugEnabled } from "@/utils/log";
import { useSyncExternalStore } from "react";
import type React from "react";

import type { ComposerToolbarItemId } from "./ComposerToolbar/types";

type PickerPreloadableId = Extract<
  ComposerToolbarItemId,
  "gif" | "emoji" | "sticker" | "game" | "gif-sticker"
>;

export type PickerPreloadStatus = "idle" | "loading" | "ready" | "failed";

export interface PickerPreloadSnapshot {
  id: PickerPreloadableId;
  status: PickerPreloadStatus;
  startedAt?: number;
  resolvedAt?: number;
  error?: string;
}

type AnyPickerComponent = React.ComponentType<any>;
type PickerModule = { default: AnyPickerComponent };

const log = createLogger("chat:pickerPreload");
const PICKER_IDS: PickerPreloadableId[] = [
  "gif",
  "emoji",
  "sticker",
  "game",
  "gif-sticker",
];
const PICKER_ID_SET = new Set<ComposerToolbarItemId>(PICKER_IDS);

// ---------------------------------------------------------------------------
// Observable preload state
// ---------------------------------------------------------------------------

const snapshots = new Map<PickerPreloadableId, PickerPreloadSnapshot>();
const listeners = new Map<PickerPreloadableId, Set<() => void>>();

for (const id of PICKER_IDS) {
  snapshots.set(id, { id, status: "idle" });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function trace(event: string, data?: Record<string, unknown>) {
  if (!isDebugEnabled("PICKER_PRELOAD")) return;
  log.debug(event, { data });
}

function setSnapshot(
  id: PickerPreloadableId,
  next: Omit<PickerPreloadSnapshot, "id">,
) {
  snapshots.set(id, { id, ...next });
  listeners.get(id)?.forEach((listener) => listener());
}

export function getPickerPreloadSnapshot(
  id: PickerPreloadableId,
): PickerPreloadSnapshot {
  return snapshots.get(id) ?? { id, status: "idle" };
}

export function subscribePickerPreload(
  id: PickerPreloadableId,
  listener: () => void,
) {
  const current = listeners.get(id) ?? new Set<() => void>();
  current.add(listener);
  listeners.set(id, current);

  return () => {
    current.delete(listener);
    if (current.size === 0) {
      listeners.delete(id);
    }
  };
}

export function usePickerPreloadStatus(
  id: PickerPreloadableId,
): PickerPreloadSnapshot {
  return useSyncExternalStore(
    (listener) => subscribePickerPreload(id, listener),
    () => getPickerPreloadSnapshot(id),
    () => getPickerPreloadSnapshot(id),
  );
}

function markLoading(id: PickerPreloadableId) {
  const startedAt = Date.now();
  setSnapshot(id, { status: "loading", startedAt });
  trace("preload-start", { id, startedAt });
  return startedAt;
}

function markReady(id: PickerPreloadableId, startedAt?: number) {
  const resolvedAt = Date.now();
  setSnapshot(id, { status: "ready", startedAt, resolvedAt });
  trace("preload-resolved", {
    id,
    elapsedMs: startedAt ? resolvedAt - startedAt : undefined,
  });
}

function markFailed(
  id: PickerPreloadableId,
  error: unknown,
  startedAt?: number,
) {
  const resolvedAt = Date.now();
  setSnapshot(id, {
    status: "failed",
    startedAt,
    resolvedAt,
    error: getErrorMessage(error),
  });
  trace("preload-failed", {
    id,
    elapsedMs: startedAt ? resolvedAt - startedAt : undefined,
    error: getErrorMessage(error),
  });
}

// ---------------------------------------------------------------------------
// Cached import promises
// ---------------------------------------------------------------------------

let gifPickerPromise: Promise<typeof import("./GifPicker")> | null = null;
let emojiPickerPromise: Promise<typeof import("./FullEmojiPicker")> | null =
  null;
let stickerPickerPromise: Promise<typeof import("./StickerPicker")> | null =
  null;
let gamePickerPromise: Promise<PickerModule> | null = null;
let gifStickerPickerPromise: Promise<
  typeof import("./GifStickerPicker")
> | null = null;

// ---------------------------------------------------------------------------
// Resolved component cache
// ---------------------------------------------------------------------------

let resolvedGifPicker: AnyPickerComponent | null = null;
let resolvedEmojiPicker: AnyPickerComponent | null = null;
let resolvedStickerPicker: AnyPickerComponent | null = null;
let resolvedGamePicker: AnyPickerComponent | null = null;
let resolvedGifStickerPicker: AnyPickerComponent | null = null;

// ---------------------------------------------------------------------------
// Data warmup promises
// ---------------------------------------------------------------------------

let gifDataWarmPromise: Promise<void> | null = null;
let stickerDataWarmPromise: Promise<void> | null = null;

async function assertAllSettled(
  id: PickerPreloadableId,
  results: PromiseSettledResult<unknown>[],
) {
  const rejected = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );

  if (rejected) {
    trace("data-preload-partial-failure", {
      id,
      error: getErrorMessage(rejected.reason),
    });
    throw rejected.reason;
  }
}

function warmGifPickerData() {
  if (gifDataWarmPromise) return gifDataWarmPromise;

  const startedAt = Date.now();
  trace("data-preload-start", { id: "gif", startedAt });

  gifDataWarmPromise = import("@/services/gif/gifService")
    .then(async ({ fetchTrending, getCategories }) => {
      const results = await Promise.allSettled([
        fetchTrending({ limit: 30 }),
        getCategories(),
      ]);
      await assertAllSettled("gif", results);
    })
    .then(() => {
      trace("data-preload-resolved", {
        id: "gif",
        elapsedMs: Date.now() - startedAt,
      });
    })
    .catch((error) => {
      gifDataWarmPromise = null;
      trace("data-preload-failed", {
        id: "gif",
        elapsedMs: Date.now() - startedAt,
        error: getErrorMessage(error),
      });
      throw error;
    })
    .finally(() => {
      gifDataWarmPromise = null;
    });

  return gifDataWarmPromise;
}

function warmStickerPickerData() {
  if (stickerDataWarmPromise) return stickerDataWarmPromise;

  const startedAt = Date.now();
  trace("data-preload-start", { id: "sticker", startedAt });

  stickerDataWarmPromise = import("@/services/sticker/stickerService")
    .then(async ({ fetchTrendingStickers }) => {
      const results = await Promise.allSettled([
        fetchTrendingStickers({ limit: 30 }),
      ]);
      await assertAllSettled("sticker", results);
    })
    .then(() => {
      trace("data-preload-resolved", {
        id: "sticker",
        elapsedMs: Date.now() - startedAt,
      });
    })
    .catch((error) => {
      stickerDataWarmPromise = null;
      trace("data-preload-failed", {
        id: "sticker",
        elapsedMs: Date.now() - startedAt,
        error: getErrorMessage(error),
      });
      throw error;
    })
    .finally(() => {
      stickerDataWarmPromise = null;
    });

  return stickerDataWarmPromise;
}

function warmDataForPicker(id: PickerPreloadableId) {
  switch (id) {
    case "gif":
      return warmGifPickerData();
    case "sticker":
      return warmStickerPickerData();
    case "gif-sticker":
      return Promise.allSettled([
        warmGifPickerData(),
        warmStickerPickerData(),
      ]).then(() => undefined);
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Getters - start import if not already in flight, return cached promise
// ---------------------------------------------------------------------------

function startGamePickerImport(): Promise<PickerModule> {
  return import("@/gamesV4/components/GamePickerModal").then((m) => ({
    default: m.GamePickerModal,
  }));
}

export function getGifPickerImport() {
  if (!gifPickerPromise) {
    const startedAt = markLoading("gif");
    gifPickerPromise = import("./GifPicker")
      .then((m) => {
        resolvedGifPicker = m.default;
        markReady("gif", startedAt);
        return m;
      })
      .catch((error) => {
        gifPickerPromise = null;
        markFailed("gif", error, startedAt);
        throw error;
      });
  }
  return gifPickerPromise;
}

export function getEmojiPickerImport() {
  if (!emojiPickerPromise) {
    const startedAt = markLoading("emoji");
    emojiPickerPromise = import("./FullEmojiPicker")
      .then((m) => {
        resolvedEmojiPicker = m.default;
        markReady("emoji", startedAt);
        return m;
      })
      .catch((error) => {
        emojiPickerPromise = null;
        markFailed("emoji", error, startedAt);
        throw error;
      });
  }
  return emojiPickerPromise;
}

export function getStickerPickerImport() {
  if (!stickerPickerPromise) {
    const startedAt = markLoading("sticker");
    stickerPickerPromise = import("./StickerPicker")
      .then((m) => {
        resolvedStickerPicker = m.default;
        markReady("sticker", startedAt);
        return m;
      })
      .catch((error) => {
        stickerPickerPromise = null;
        markFailed("sticker", error, startedAt);
        throw error;
      });
  }
  return stickerPickerPromise;
}

export function getGamePickerImport() {
  if (!gamePickerPromise) {
    const startedAt = markLoading("game");
    gamePickerPromise = startGamePickerImport()
      .then((m) => {
        resolvedGamePicker = m.default;
        markReady("game", startedAt);
        return m;
      })
      .catch((error) => {
        gamePickerPromise = null;
        markFailed("game", error, startedAt);
        throw error;
      });
  }
  return gamePickerPromise;
}

export function getGifStickerPickerImport() {
  if (!gifStickerPickerPromise) {
    const startedAt = markLoading("gif-sticker");
    gifStickerPickerPromise = import("./GifStickerPicker")
      .then((m) => {
        resolvedGifStickerPicker = m.default;
        markReady("gif-sticker", startedAt);
        return m;
      })
      .catch((error) => {
        gifStickerPickerPromise = null;
        markFailed("gif-sticker", error, startedAt);
        throw error;
      });
  }
  return gifStickerPickerPromise;
}

// ---------------------------------------------------------------------------
// Resolved getters - return the component synchronously if already loaded
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
// Toolbar -> preload mapping
// ---------------------------------------------------------------------------

const MODULE_PRELOAD_MAP: Partial<
  Record<PickerPreloadableId, () => Promise<unknown>>
> = {
  gif: getGifPickerImport,
  emoji: getEmojiPickerImport,
  sticker: getStickerPickerImport,
  game: getGamePickerImport,
  "gif-sticker": getGifStickerPickerImport,
};

/**
 * Preload one picker module and its first-open data when applicable.
 * Idempotent while in flight and retryable after failures.
 */
export function preloadPickerById(id: ComposerToolbarItemId) {
  if (!PICKER_ID_SET.has(id)) return undefined;

  const pickerId = id as PickerPreloadableId;
  const modulePromise = MODULE_PRELOAD_MAP[pickerId]?.();
  const dataPromise = warmDataForPicker(pickerId);

  if (modulePromise) {
    void modulePromise.catch(() => {
      // The observable preload state records the failure. Callers can retry by
      // invoking preloadPickerById again.
    });
  }

  if (dataPromise) {
    void dataPromise.catch(() => {
      // Data warm failures are non-terminal. The picker will show its normal
      // retry/error state if the user opens it before a later warm succeeds.
    });
  }

  return modulePromise;
}

/**
 * Preload picker modules for the given toolbar item IDs.
 * Idempotent and safe to call multiple times.
 */
export function preloadPickersForToolbar(itemIds: ComposerToolbarItemId[]) {
  for (const id of itemIds) {
    preloadPickerById(id);
  }
}
