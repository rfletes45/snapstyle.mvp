/**
 * Golf Duels — Course Loader
 *
 * Loads and validates course data from JSON files.
 * Works in both Node.js (server) and browser (client) contexts.
 *
 * Provides deterministic hole selection via FNV-1a hash so that
 * server + client always agree on which hole is played for any
 * given (matchId, holeNumber) pair.
 *
 * Server usage:  loadCoursesFromDisk(coursesDir)
 * Client usage:  loadCoursesFromUrls(baseUrl)
 */

import { validateHole, validateManifest } from "./courseValidator";
import type { HoleData, Manifest } from "./types";
import { MATCH_RULES } from "./types";

// =============================================================================
// FNV-1a 32-bit Hash — deterministic, pure, no crypto dependency
// =============================================================================

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * FNV-1a 32-bit hash of an arbitrary string.
 * Returns unsigned 32-bit integer.
 */
export function fnv1a32(str: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0; // unsigned
}

/**
 * Deterministic hole selection.
 *
 * Given a tier, matchId, and 1-based holeNumber, returns the holeId that
 * should be played. The result is pure: same inputs always produce same output.
 *
 * Uses FNV-1a hash of `${matchId}:${holeNumber}` mod count-of-holes-in-tier.
 *
 * @param tier       Tier number (1-6)
 * @param matchId    Firestore document ID or room ID — unique per match
 * @param holeNumber 1-based hole number within the match
 * @param manifest   The course manifest (list of holes per tier)
 * @returns The selected holeId string (e.g. "T3-2")
 */
export function selectHoleId(
  tier: number,
  matchId: string,
  holeNumber: number,
  manifest: Manifest,
): string {
  const tierHoles = manifest.holes
    .filter((e) => e.tier === tier)
    .sort((a, b) => a.holeId.localeCompare(b.holeId)); // stable sort

  if (tierHoles.length === 0) {
    throw new Error(`No holes available for tier ${tier}`);
  }

  const hash = fnv1a32(`${matchId}:${holeNumber}`);
  const index = hash % tierHoles.length;
  return tierHoles[index].holeId;
}

/**
 * Get the tier for a given 1-based hole number.
 * Holes 1-5 → tiers 1-5. Holes 6+ → tier 6.
 */
export function getTierForHoleNumber(holeNumber: number): number {
  if (holeNumber <= 5) return holeNumber;
  return MATCH_RULES.OVERTIME_TIER;
}

// =============================================================================
// In-memory course cache
// =============================================================================

export class CourseLibrary {
  private manifest: Manifest;
  private holes: Map<string, HoleData> = new Map();

  constructor(manifest: Manifest, holes: Map<string, HoleData>) {
    this.manifest = manifest;
    this.holes = holes;
  }

  /** Get the full manifest */
  getManifest(): Manifest {
    return this.manifest;
  }

  /** Get a hole by its ID (e.g. "T1-1") */
  getHole(holeId: string): HoleData | undefined {
    return this.holes.get(holeId);
  }

  /** Get all holes for a specific tier */
  getHolesByTier(tier: number): HoleData[] {
    return this.manifest.holes
      .filter((e) => e.tier === tier)
      .map((e) => this.holes.get(e.holeId)!)
      .filter(Boolean);
  }

  /** Get all hole IDs */
  getAllHoleIds(): string[] {
    return this.manifest.holes.map((e) => e.holeId);
  }

  /** Get total number of holes */
  get count(): number {
    return this.holes.size;
  }

  /**
   * Deterministic hole sequence for a match.
   *
   * Match progression:
   * - Holes 1-5: one hole per tier 1-5 (deterministic via FNV-1a)
   * - Overtime holes 6+: tier 6 (deterministic via FNV-1a)
   *
   * Same matchId + holeNumber always produces the same hole choice.
   *
   * @param matchId  Unique match / room ID
   * @param maxHoles Maximum total holes to generate (default 15 safety cap)
   * @returns Array of HoleData in play order
   */
  generateMatchSequence(matchId: string, maxHoles: number = 15): HoleData[] {
    const sequence: HoleData[] = [];

    for (let h = 1; h <= maxHoles; h++) {
      const tier = getTierForHoleNumber(h);
      const holeId = selectHoleId(tier, matchId, h, this.manifest);
      const hole = this.holes.get(holeId);
      if (!hole) {
        throw new Error(`Hole ${holeId} not found in library`);
      }
      sequence.push(hole);
    }

    return sequence;
  }

  /**
   * Get the hole for a specific match + hole number (on-demand).
   * Useful when you don't want to pre-generate the full sequence.
   */
  getHoleForMatch(matchId: string, holeNumber: number): HoleData {
    const tier = getTierForHoleNumber(holeNumber);
    const holeId = selectHoleId(tier, matchId, holeNumber, this.manifest);
    const hole = this.holes.get(holeId);
    if (!hole) {
      throw new Error(`Hole ${holeId} not found in library`);
    }
    return hole;
  }
}

// =============================================================================
// Server-side: load from disk (Node.js fs)
// =============================================================================

/**
 * Load all course files from a directory on disk.
 * Used by the Colyseus server at startup.
 *
 * @param coursesDir Absolute path to the directory containing manifest.json and T*.json
 */
export async function loadCoursesFromDisk(
  coursesDir: string,
): Promise<CourseLibrary> {
  // Dynamic import for Node.js built-ins (keeps this module isomorphic)
  const fs = await import("fs");
  const path = await import("path");

  // Load manifest
  const manifestPath = path.join(coursesDir, "manifest.json");
  const manifestRaw = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const manifestResult = validateManifest(manifestRaw);
  if (!manifestResult.valid) {
    throw new Error(
      `Invalid manifest.json: ${manifestResult.errors.join("; ")}`,
    );
  }
  const manifest = manifestRaw as Manifest;

  // Load all holes
  const holes = new Map<string, HoleData>();
  const loadErrors: string[] = [];

  for (const entry of manifest.holes) {
    const holePath = path.join(coursesDir, entry.file);
    const holeRaw = JSON.parse(fs.readFileSync(holePath, "utf-8"));
    const holeResult = validateHole(holeRaw);

    if (!holeResult.valid) {
      loadErrors.push(`${entry.file}: ${holeResult.errors.join("; ")}`);
      continue;
    }

    const holeData = holeRaw as HoleData;
    if (holeData.holeId !== entry.holeId) {
      loadErrors.push(
        `${entry.file}: holeId mismatch — manifest says "${entry.holeId}", file says "${holeData.holeId}"`,
      );
      continue;
    }

    holes.set(entry.holeId, holeData);
  }

  if (loadErrors.length > 0) {
    throw new Error(`Course loading errors:\n${loadErrors.join("\n")}`);
  }

  if (holes.size !== manifest.count) {
    throw new Error(`Expected ${manifest.count} holes, loaded ${holes.size}`);
  }

  return new CourseLibrary(manifest, holes);
}

/**
 * Load courses from pre-loaded JSON objects.
 * Used when JSON is bundled (e.g., in the client via Vite import).
 */
export function loadCoursesFromObjects(
  manifestData: unknown,
  holeDataMap: Record<string, unknown>,
): CourseLibrary {
  const manifestResult = validateManifest(manifestData);
  if (!manifestResult.valid) {
    throw new Error(`Invalid manifest: ${manifestResult.errors.join("; ")}`);
  }
  const manifest = manifestData as Manifest;

  const holes = new Map<string, HoleData>();
  const loadErrors: string[] = [];

  for (const entry of manifest.holes) {
    const holeRaw = holeDataMap[entry.holeId];
    if (!holeRaw) {
      loadErrors.push(`Missing hole data for ${entry.holeId}`);
      continue;
    }

    const holeResult = validateHole(holeRaw);
    if (!holeResult.valid) {
      loadErrors.push(`${entry.holeId}: ${holeResult.errors.join("; ")}`);
      continue;
    }

    holes.set(entry.holeId, holeRaw as HoleData);
  }

  if (loadErrors.length > 0) {
    throw new Error(`Course loading errors:\n${loadErrors.join("\n")}`);
  }

  return new CourseLibrary(manifest, holes);
}
