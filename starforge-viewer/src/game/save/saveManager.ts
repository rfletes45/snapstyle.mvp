/**
 * Save manager — localStorage persistence with dirty-flag debounce.
 * Imports DOM (localStorage), but no Three.js.
 */
import type { SimStateV1 } from "../sim/types";
import type { SaveFileV1 } from "./saveTypes";

const STORAGE_KEY = "starforge_save_v1";
const DEBOUNCE_MS = 500;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Public API ──────────────────────────────────────────────

/**
 * Try to load saved state from localStorage.
 * Migrates old PR#1 saves missing new fields.
 * Returns null if nothing stored or data is invalid.
 */
export function loadSave(): SimStateV1 | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: SaveFileV1 = JSON.parse(raw);
    if (parsed.schemaVersion !== "starforge.save.v1") return null;
    if (parsed.simState?.version !== 1) return null;

    const s = parsed.simState;
    // Migrate PR#1/PR#2 saves that lack new fields
    const migrated: SimStateV1 = {
      ...s,
      resources: {
        flux: s.resources?.flux ?? 0,
        alloy: (s.resources as unknown as Record<string, number>)?.alloy ?? 0,
        signal: (s.resources as unknown as Record<string, number>)?.signal ?? 0,
      },
      capsMicro: s.capsMicro ?? { flux: 10000, alloy: 5000, signal: 3000 },
      machines: s.machines ?? {},
      upgradesPurchased: s.upgradesPurchased ?? [],
      upgradesPurchasedV2: s.upgradesPurchasedV2 ?? {},
      contracts: s.contracts ?? {
        active: null,
        revealed: [],
        completed: [],
        lastRevealRollTick: 0,
      },
      events: s.events ?? {
        activeEvent: null,
        lastSpawnRollTick: 0,
        prodBoosts: [],
        capBoosts: [],
      },
      milestones: s.milestones ?? {
        claimed: [],
        pendingToast: [],
      },
      stats: {
        totalFluxEarned: s.stats?.totalFluxEarned ?? 0,
        totalTaps: s.stats?.totalTaps ?? 0,
        overflowLost:
          (s.stats as unknown as Record<string, number>)?.overflowLost ?? 0,
      },
      flags: { dirty: false },

      // ── PR#5+: cutter-dock / wreck-spawn / runStats ──
      cutterDock: s.cutterDock ?? {
        status: "empty",
        wreckId: null,
        reservedWreckId: null,
      },
      runStats: s.runStats ?? {
        totalCutTaps: 0,
        totalFluxEarnedMicro: 0,
        wrecksDestroyedTotal: 0,
        wrecksDestroyedByRarity: {
          common: 0,
          uncommon: 0,
          rare: 0,
          epic: 0,
          ancient: 0,
        },
      },
      wreckSpawn: s.wreckSpawn ?? { nextSpawnTick: 100 },
      wrecks: s.wrecks ?? { active: {}, nextId: 1, lastSpawnRollTick: 0 },

      // ── PR#4: meta field ──
      meta: (() => {
        const raw = (s as unknown as Record<string, unknown>).meta as
          | SimStateV1["meta"]
          | undefined;
        return {
          rebirthCount: raw?.rebirthCount ?? 0,
          coreShards: raw?.coreShards ?? 0,
          branchUnlocked: raw?.branchUnlocked ?? {},
          rebirthTreePurchased: raw?.rebirthTreePurchased ?? {},
          lifetime: raw?.lifetime ?? {
            totalWrecksDestroyed: 0,
            totalFluxEarnedMicro: 0,
          },
        };
      })(),
    };
    return migrated;
  } catch {
    return null;
  }
}

/**
 * Persist state to localStorage (debounced).
 * Only writes if flags.dirty is true; resets dirty after write.
 * Returns a reference to the (possibly mutated) state with dirty cleared.
 */
export function requestSave(state: SimStateV1): SimStateV1 {
  if (!state.flags.dirty) return state;

  if (debounceTimer !== null) clearTimeout(debounceTimer);

  // Snapshot the state to save (cleared dirty flag)
  const toSave: SimStateV1 = { ...state, flags: { dirty: false } };

  debounceTimer = setTimeout(() => {
    const file: SaveFileV1 = {
      schemaVersion: "starforge.save.v1",
      simState: toSave,
      lastSavedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
    } catch (e) {
      console.warn("Save failed:", e);
    }
    debounceTimer = null;
  }, DEBOUNCE_MS);

  return toSave;
}

/**
 * Immediately clear saved data.
 */
export function clearSave(): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  localStorage.removeItem(STORAGE_KEY);
}
