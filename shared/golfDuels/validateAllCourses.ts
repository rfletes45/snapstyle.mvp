#!/usr/bin/env node
/**
 * validateAllCourses.js
 *
 * Bulk validator — reads every H##.json in shared/golfDuels/courses/,
 * wraps each into a synthetic CourseConfig, and runs validateCourse().
 *
 * Usage:
 *   npx ts-node shared/golfDuels/validateAllCourses.ts
 *   — or —
 *   node -e "require('ts-node').register(); require('./shared/golfDuels/validateAllCourses')"
 */

import * as fs from "fs";
import * as path from "path";
import { COURSE_FORMAT_VERSION } from "./courseTypes";
import { validateCourse } from "./courseValidator";

const COURSES_DIR = path.resolve(__dirname, "courses");

function main(): void {
  const files = fs
    .readdirSync(COURSES_DIR)
    .filter((f) => /^H\d{2}\.json$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.error("No H##.json files found in", COURSES_DIR);
    process.exit(1);
  }

  let totalErrors = 0;
  const passed: string[] = [];
  const failed: string[] = [];

  for (const file of files) {
    const filePath = path.join(COURSES_DIR, file);
    let hole: unknown;
    try {
      hole = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (err) {
      console.error(`  PARSE ERROR  ${file}: ${(err as Error).message}`);
      failed.push(file);
      totalErrors++;
      continue;
    }

    // Wrap single HoleConfig into a minimal valid CourseConfig
    const syntheticCourse = {
      version: COURSE_FORMAT_VERSION,
      packId: "bulk-validate",
      name: "Bulk Validation Pack",
      holes: [hole],
    };

    const errors = validateCourse(syntheticCourse);
    if (errors.length > 0) {
      console.error(`  FAIL  ${file}`);
      errors.forEach((e) => console.error(`        └─ ${e}`));
      failed.push(file);
      totalErrors += errors.length;
    } else {
      passed.push(file);
    }
  }

  console.log("");
  console.log("=".repeat(60));
  console.log(
    `Results: ${passed.length} passed, ${failed.length} failed out of ${files.length} holes`,
  );
  if (failed.length > 0) {
    console.log("Failed files:", failed.join(", "));
  }
  console.log("=".repeat(60));
  process.exit(totalErrors > 0 ? 1 : 0);
}

main();
