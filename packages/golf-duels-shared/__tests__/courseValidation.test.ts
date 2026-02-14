/**
 * Golf Duels — Course Validation Tests
 *
 * Validates all 30 course JSON files against the Zod schema.
 */

import fs from "fs";
import path from "path";
import { CourseLibrary, loadCoursesFromDisk } from "../src/courseLoader";
import { validateHole, validateManifest } from "../src/courseValidator";

const COURSES_DIR = path.resolve(__dirname, "../courses");

describe("Course Validation", () => {
  describe("manifest.json", () => {
    it("should validate the manifest", () => {
      const raw = JSON.parse(
        fs.readFileSync(path.join(COURSES_DIR, "manifest.json"), "utf-8"),
      );
      const result = validateManifest(raw);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should contain exactly 30 hole entries", () => {
      const raw = JSON.parse(
        fs.readFileSync(path.join(COURSES_DIR, "manifest.json"), "utf-8"),
      );
      expect(raw.count).toBe(30);
      expect(raw.holes.length).toBe(30);
    });

    it("should have 5 holes per tier (1-6)", () => {
      const raw = JSON.parse(
        fs.readFileSync(path.join(COURSES_DIR, "manifest.json"), "utf-8"),
      );
      for (let tier = 1; tier <= 6; tier++) {
        const tierHoles = raw.holes.filter(
          (h: { tier: number }) => h.tier === tier,
        );
        expect(tierHoles.length).toBe(5);
      }
    });
  });

  describe("Individual hole files", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(COURSES_DIR, "manifest.json"), "utf-8"),
    );

    for (const entry of manifest.holes) {
      it(`should validate ${entry.holeId} (${entry.file})`, () => {
        const raw = JSON.parse(
          fs.readFileSync(path.join(COURSES_DIR, entry.file), "utf-8"),
        );
        const result = validateHole(raw);
        expect(result.valid).toBe(true);
        if (!result.valid) {
          console.error(
            `Validation errors for ${entry.holeId}:`,
            result.errors,
          );
        }
      });

      it(`${entry.holeId} holeId should match manifest entry`, () => {
        const raw = JSON.parse(
          fs.readFileSync(path.join(COURSES_DIR, entry.file), "utf-8"),
        );
        expect(raw.holeId).toBe(entry.holeId);
      });

      it(`${entry.holeId} tier should match manifest entry`, () => {
        const raw = JSON.parse(
          fs.readFileSync(path.join(COURSES_DIR, entry.file), "utf-8"),
        );
        expect(raw.tier).toBe(entry.tier);
      });
    }
  });

  describe("CourseLibrary loading", () => {
    let library: CourseLibrary;

    beforeAll(async () => {
      library = await loadCoursesFromDisk(COURSES_DIR);
    });

    it("should load all 30 holes", () => {
      expect(library.count).toBe(30);
    });

    it("should retrieve holes by ID", () => {
      const hole = library.getHole("T1-1");
      expect(hole).toBeDefined();
      expect(hole!.holeId).toBe("T1-1");
      expect(hole!.tier).toBe(1);
    });

    it("should retrieve holes by tier", () => {
      for (let tier = 1; tier <= 6; tier++) {
        const holes = library.getHolesByTier(tier);
        expect(holes.length).toBe(5);
        holes.forEach((h) => expect(h.tier).toBe(tier));
      }
    });

    it("should generate a deterministic match sequence of at least 5 holes", () => {
      const seq = library.generateMatchSequence("test-match-id-123");
      expect(seq.length).toBeGreaterThanOrEqual(5);
      // First 5 holes should be tiers 1-5
      for (let i = 0; i < 5; i++) {
        expect(seq[i].tier).toBe(i + 1);
      }
      // Overtime holes should be tier 6
      for (let i = 5; i < seq.length; i++) {
        expect(seq[i].tier).toBe(6);
      }
    });

    it("should produce the same sequence for the same matchId", () => {
      const seq1 = library.generateMatchSequence("determinism-test");
      const seq2 = library.generateMatchSequence("determinism-test");
      expect(seq1.map((h) => h.holeId)).toEqual(seq2.map((h) => h.holeId));
    });

    it("should produce different sequences for different matchIds", () => {
      const seq1 = library.generateMatchSequence("match-A");
      const seq2 = library.generateMatchSequence("match-B");
      // Extremely unlikely to be identical across all 15 holes
      const ids1 = seq1.map((h) => h.holeId);
      const ids2 = seq2.map((h) => h.holeId);
      expect(ids1).not.toEqual(ids2);
    });

    it("should return all 30 hole IDs", () => {
      const ids = library.getAllHoleIds();
      expect(ids.length).toBe(30);
    });
  });
});
