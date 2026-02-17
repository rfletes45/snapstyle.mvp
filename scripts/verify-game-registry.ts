#!/usr/bin/env npx tsx
/**
 * verify-game-registry.ts  — Game Registry Completeness Checker
 * Segment 10: QA / Smoke Test Harness
 *
 * Validates that every game type in ExtendedGameType has all required
 * registry entries:
 *   1. GAME_METADATA entry (src/types/games.ts)
 *   2. GAME_SCREEN_MAP entry (src/config/gameCategories.ts)
 *   3. EXTENDED_GAME_SCORE_LIMITS entry (src/types/games.ts)
 *   4. Colyseus room mapping if multiplayer (src/config/colyseus.ts)
 *   5. Default invite settings if multiplayer (src/services/gameInvites.ts)
 *
 * Usage:
 *   npx tsx scripts/verify-game-registry.ts
 *   npm run verify:registry
 *
 * Exit code 0 = all checks pass, 1 = failures found.
 */

import { COLYSEUS_ROOM_NAMES, GAME_CATEGORY_MAP } from "../src/config/colyseus";
import { GAME_SCREEN_MAP } from "../src/config/gameCategories";
import { getDefaultInviteSettings } from "../src/services/gameInvites";
import {
  EXTENDED_GAME_SCORE_LIMITS,
  GAME_METADATA,
  type ExtendedGameType,
} from "../src/types/games";

// =============================================================================
// Helpers
// =============================================================================

interface CheckResult {
  gameType: string;
  check: string;
  status: "pass" | "fail" | "skip";
  detail?: string;
}

const results: CheckResult[] = [];

function pass(gameType: string, check: string, detail?: string): void {
  results.push({ gameType, check, status: "pass", detail });
}

function fail(gameType: string, check: string, detail?: string): void {
  results.push({ gameType, check, status: "fail", detail });
}

function skip(gameType: string, check: string, detail?: string): void {
  results.push({ gameType, check, status: "skip", detail });
}

/**
 * Try multiple key patterns that resolveColyseusRoomName uses:
 *   1. Direct key (e.g. "minigolf_duels")
 *   2. With _game suffix (e.g. "chess_game")
 */
function hasColyseusMapping(gameType: string): boolean {
  if (COLYSEUS_ROOM_NAMES[gameType]) return true;
  if (COLYSEUS_ROOM_NAMES[`${gameType}_game`]) return true;
  // Also check GAME_CATEGORY_MAP (same key patterns)
  if (GAME_CATEGORY_MAP[gameType]) return true;
  if (GAME_CATEGORY_MAP[`${gameType}_game`]) return true;
  return false;
}

// =============================================================================
// Gather all game types
// =============================================================================

const allGameTypes = Object.keys(GAME_METADATA) as ExtendedGameType[];

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║   SnapStyle Game Registry Verification              ║");
console.log("╠══════════════════════════════════════════════════════╣");
console.log(`║   Games found: ${String(allGameTypes.length).padEnd(38)}║`);
console.log("╚══════════════════════════════════════════════════════╝\n");

// =============================================================================
// Run checks
// =============================================================================

for (const gameType of allGameTypes) {
  const meta = GAME_METADATA[gameType];

  // 1. GAME_METADATA — already guaranteed by iteration, but check fields
  if (meta && meta.id && meta.name && meta.icon && meta.category != null) {
    pass(gameType, "GAME_METADATA", `${meta.name} (${meta.category})`);
  } else {
    fail(gameType, "GAME_METADATA", "Missing or incomplete fields");
  }

  // 2. GAME_SCREEN_MAP
  const screenName = (GAME_SCREEN_MAP as Record<string, string>)[gameType];
  if (screenName) {
    pass(gameType, "GAME_SCREEN_MAP", screenName);
  } else {
    fail(gameType, "GAME_SCREEN_MAP", "No screen mapping found");
  }

  // 3. EXTENDED_GAME_SCORE_LIMITS
  const scoreLimits = EXTENDED_GAME_SCORE_LIMITS[gameType];
  if (scoreLimits && scoreLimits.maxScore != null) {
    pass(
      gameType,
      "SCORE_LIMITS",
      `${scoreLimits.minScore}–${scoreLimits.maxScore} (${scoreLimits.scoreDirection})`,
    );
  } else {
    fail(gameType, "SCORE_LIMITS", "No score limits defined");
  }

  // 4. Colyseus mapping (multiplayer only)
  if (meta.isMultiplayer) {
    if (hasColyseusMapping(gameType)) {
      const roomName =
        COLYSEUS_ROOM_NAMES[gameType] ||
        COLYSEUS_ROOM_NAMES[`${gameType}_game`] ||
        "(via category map)";
      pass(gameType, "COLYSEUS_MAPPING", `→ ${roomName}`);
    } else {
      fail(
        gameType,
        "COLYSEUS_MAPPING",
        "Multiplayer game missing Colyseus room mapping",
      );
    }
  } else {
    skip(gameType, "COLYSEUS_MAPPING", "Single-player — not required");
  }

  // 5. Default invite settings (multiplayer only)
  if (meta.isMultiplayer) {
    try {
      const settings = getDefaultInviteSettings(gameType as any);
      if (settings) {
        pass(
          gameType,
          "INVITE_SETTINGS",
          `rated=${settings.isRated}, chat=${settings.chatEnabled}`,
        );
      } else {
        fail(
          gameType,
          "INVITE_SETTINGS",
          "getDefaultInviteSettings returned null",
        );
      }
    } catch {
      fail(
        gameType,
        "INVITE_SETTINGS",
        "getDefaultInviteSettings threw — no default settings",
      );
    }
  } else {
    skip(gameType, "INVITE_SETTINGS", "Single-player — not required");
  }
}

// =============================================================================
// Cross-check: GAME_SCREEN_MAP keys not in GAME_METADATA
// =============================================================================

const screenMapKeys = Object.keys(GAME_SCREEN_MAP);
for (const key of screenMapKeys) {
  if (!allGameTypes.includes(key as ExtendedGameType)) {
    fail(
      key,
      "ORPHAN_SCREEN_MAP",
      "Key in GAME_SCREEN_MAP but not in GAME_METADATA",
    );
  }
}

// Cross-check: COLYSEUS_ROOM_NAMES keys not in any game type
const colyseusKeys = Object.keys(COLYSEUS_ROOM_NAMES);
for (const key of colyseusKeys) {
  // Strip _game suffix for comparison
  const normalized = key.replace(/_game$/, "");
  if (
    !allGameTypes.includes(key as ExtendedGameType) &&
    !allGameTypes.includes(normalized as ExtendedGameType)
  ) {
    fail(
      key,
      "ORPHAN_COLYSEUS_KEY",
      "Key in COLYSEUS_ROOM_NAMES not traceable to any game type",
    );
  }
}

// =============================================================================
// Report
// =============================================================================

const failures = results.filter((r) => r.status === "fail");
const passes = results.filter((r) => r.status === "pass");
const skips = results.filter((r) => r.status === "skip");

console.log(
  "┌────────────────────┬──────────────────┬────────┬──────────────────────────────────┐",
);
console.log(
  "│ Game Type          │ Check            │ Status │ Detail                           │",
);
console.log(
  "├────────────────────┼──────────────────┼────────┼──────────────────────────────────┤",
);

for (const r of results) {
  const icon = r.status === "pass" ? "✅" : r.status === "fail" ? "❌" : "⏭️ ";
  const gt = r.gameType.padEnd(18);
  const ck = r.check.padEnd(16);
  const st = icon.padEnd(4);
  const dt = (r.detail ?? "").slice(0, 32).padEnd(32);
  console.log(`│ ${gt} │ ${ck} │ ${st}  │ ${dt} │`);
}

console.log(
  "└────────────────────┴──────────────────┴────────┴──────────────────────────────────┘",
);
console.log(
  `\nResults: ${passes.length} pass, ${failures.length} fail, ${skips.length} skip`,
);

if (failures.length > 0) {
  console.log("\n❌ FAILURES:");
  for (const f of failures) {
    console.log(`  • ${f.gameType} / ${f.check}: ${f.detail}`);
  }
  process.exit(1);
} else {
  console.log("\n✅ All game registry checks passed!");
  process.exit(0);
}
