#!/usr/bin/env ts-node
/**
 * syncCourses.ts — Copies shared course JSON into client and server targets.
 *
 * Usage:
 *   npx ts-node tools/minigolf/syncCourses.ts
 *   npm run sync:minigolf
 *
 * Source: shared/games/minigolf/courses/<pack>/*.json
 * Targets:
 *   - src/games/minigolf/courses/<pack>.json       (client — single JSON file per pack)
 *   - colyseus-server/src/games/minigolf/courses/<pack>.json  (server)
 *
 * Each target pack JSON is a CourseConfig with { packId, name, holes: [...] }.
 */

import * as fs from "fs";
import * as path from "path";

// =============================================================================
// Constants
// =============================================================================

const SHARED_DIR = path.resolve(
  __dirname,
  "../../shared/games/minigolf/courses",
);
const CLIENT_DIR = path.resolve(__dirname, "../../src/games/minigolf/courses");
const SERVER_DIR = path.resolve(
  __dirname,
  "../../colyseus-server/src/games/minigolf/courses",
);

// Pack display names
const PACK_NAMES: Record<string, string> = {
  tutorial: "Tutorial",
  neon: "Neon Lights",
  garden: "Garden Party",
  toybox: "Toybox",
  default: "Classic Course",
};

// =============================================================================
// Helpers
// =============================================================================

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function buildPackJson(packId: string, packDir: string): object {
  const files = fs
    .readdirSync(packDir)
    .filter((f) => f.endsWith(".json"))
    .sort(); // ensure consistent ordering

  const holes = files.map((f) => {
    const raw = fs.readFileSync(path.join(packDir, f), "utf8");
    return JSON.parse(raw);
  });

  return {
    packId,
    name: PACK_NAMES[packId] || packId,
    holes,
  };
}

// =============================================================================
// Main
// =============================================================================

function main() {
  if (!fs.existsSync(SHARED_DIR)) {
    console.error(`ERROR: Source directory not found: ${SHARED_DIR}`);
    process.exit(1);
  }

  ensureDir(CLIENT_DIR);
  ensureDir(SERVER_DIR);

  const packs = fs
    .readdirSync(SHARED_DIR)
    .filter((d) => fs.statSync(path.join(SHARED_DIR, d)).isDirectory());

  if (packs.length === 0) {
    console.error("ERROR: No course packs found.");
    process.exit(1);
  }

  let totalHoles = 0;

  for (const pack of packs) {
    const packDir = path.join(SHARED_DIR, pack);
    const packJson = buildPackJson(pack, packDir);
    const holeCount = (packJson as any).holes.length;
    totalHoles += holeCount;

    const jsonStr = JSON.stringify(packJson, null, 2) + "\n";

    // Write to client
    const clientPath = path.join(CLIENT_DIR, `${pack}.json`);
    fs.writeFileSync(clientPath, jsonStr, "utf8");

    // Write to server
    const serverPath = path.join(SERVER_DIR, `${pack}.json`);
    fs.writeFileSync(serverPath, jsonStr, "utf8");

    console.log(`  ✓ ${pack}: ${holeCount} holes → client + server`);
  }

  console.log(`\n✅ Synced ${totalHoles} holes across ${packs.length} packs.`);
}

main();
