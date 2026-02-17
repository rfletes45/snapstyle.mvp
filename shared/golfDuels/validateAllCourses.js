#!/usr/bin/env node
/**
 * validateAllCourses.js
 *
 * Standalone bulk validator — reads every H##.json in courses/ directory,
 * wraps each into a synthetic CourseConfig, and validates.
 *
 * Usage:
 *   node shared/golfDuels/validateAllCourses.js
 */

const fs = require("fs");
const path = require("path");

const COURSES_DIR = path.resolve(__dirname, "courses");
const COURSE_FORMAT_VERSION = 2;

// ─── Inline validator (mirrors courseValidator.ts logic) ─────────────────────

function isVec2(v) {
  return (
    v &&
    typeof v === "object" &&
    typeof v.x === "number" &&
    typeof v.y === "number"
  );
}

function isPositiveInt(n) {
  return typeof n === "number" && Number.isInteger(n) && n > 0;
}

function assertInBounds(pt, bounds, label, errors) {
  if (pt.x < 0 || pt.x > bounds.width) {
    errors.push(`${label}.x=${pt.x} outside [0, ${bounds.width}].`);
  }
  if (pt.y < 0 || pt.y > bounds.height) {
    errors.push(`${label}.y=${pt.y} outside [0, ${bounds.height}].`);
  }
}

function validateHole(hole, prefix, errors) {
  // id
  if (typeof hole.id !== "string" || hole.id.length === 0) {
    errors.push(`${prefix}.id must be a non-empty string.`);
  }

  // par / maxStrokes
  if (!isPositiveInt(hole.par)) {
    errors.push(`${prefix}.par must be a positive integer.`);
  }
  if (!isPositiveInt(hole.maxStrokes)) {
    errors.push(`${prefix}.maxStrokes must be a positive integer.`);
  }

  // bounds
  const bounds = hole.bounds;
  if (
    !bounds ||
    typeof bounds.width !== "number" ||
    typeof bounds.height !== "number" ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    errors.push(`${prefix}.bounds must have positive width and height.`);
    return;
  }

  // tee / cup
  if (!isVec2(hole.tee)) {
    errors.push(`${prefix}.tee must be {x, y}.`);
  } else {
    assertInBounds(hole.tee, bounds, `${prefix}.tee`, errors);
  }
  if (!isVec2(hole.cup)) {
    errors.push(`${prefix}.cup must be {x, y}.`);
  } else {
    assertInBounds(hole.cup, bounds, `${prefix}.cup`, errors);
  }

  // tee != cup
  if (
    isVec2(hole.tee) &&
    isVec2(hole.cup) &&
    hole.tee.x === hole.cup.x &&
    hole.tee.y === hole.cup.y
  ) {
    errors.push(`${prefix}: tee and cup must not be the same point.`);
  }

  // cupRadius
  if (typeof hole.cupRadius !== "number" || hole.cupRadius <= 0) {
    errors.push(`${prefix}.cupRadius must be a positive number.`);
  }

  // walls
  if (!Array.isArray(hole.walls)) {
    errors.push(`${prefix}.walls must be an array.`);
  } else {
    hole.walls.forEach((poly, j) => {
      const wp = `${prefix}.walls[${j}]`;
      if (!Array.isArray(poly) || poly.length < 2) {
        errors.push(`${wp} must be a polyline with >= 2 points.`);
      } else {
        poly.forEach((pt, k) => {
          if (!isVec2(pt)) {
            errors.push(`${wp}[${k}] must be {x, y}.`);
          }
        });
      }
    });
  }

  // surfaces
  if (hole.surfaces && Array.isArray(hole.surfaces)) {
    hole.surfaces.forEach((s, j) => {
      const sp = `${prefix}.surfaces[${j}]`;
      if (!["sand", "ice"].includes(s.type)) {
        errors.push(`${sp}.type must be "sand" or "ice".`);
      }
      if (!Array.isArray(s.poly) || s.poly.length < 3) {
        errors.push(`${sp}.poly must have >= 3 points.`);
      }
      if (typeof s.frictionMul !== "number" || s.frictionMul <= 0) {
        errors.push(`${sp}.frictionMul must be a positive number.`);
      }
    });
  }

  // hazards
  if (hole.hazards && Array.isArray(hole.hazards)) {
    hole.hazards.forEach((h, j) => {
      const hp = `${prefix}.hazards[${j}]`;
      if (!["water", "oob"].includes(h.type)) {
        errors.push(`${hp}.type must be "water" or "oob".`);
      }
      if (!Array.isArray(h.poly) || h.poly.length < 3) {
        errors.push(`${hp}.poly must have >= 3 points.`);
      }
    });
  }

  // obstacles
  if (hole.obstacles && Array.isArray(hole.obstacles)) {
    hole.obstacles.forEach((o, j) => {
      const op = `${prefix}.obstacles[${j}]`;
      if (!["bumper", "spinner", "moving_gate"].includes(o.type)) {
        errors.push(
          `${op}.type must be "bumper", "spinner", or "moving_gate".`,
        );
      }
      if (!isVec2(o.position)) {
        errors.push(`${op}.position must be {x, y}.`);
      }
      if (o.type === "bumper") {
        if (typeof o.radius !== "number" || o.radius <= 0) {
          errors.push(`${op}.radius must be a positive number.`);
        }
      } else {
        if (
          !o.size ||
          typeof o.size !== "object" ||
          typeof o.size.width !== "number" ||
          typeof o.size.height !== "number"
        ) {
          errors.push(`${op}.size must be { width, height }.`);
        }
        if (typeof o.speed !== "number") {
          errors.push(`${op}.speed must be a number.`);
        }
      }
    });
  }

  // portals
  if (hole.portals && Array.isArray(hole.portals)) {
    const portalIds = new Set(hole.portals.map((p) => p.id));
    hole.portals.forEach((p, j) => {
      const pp = `${prefix}.portals[${j}]`;
      if (typeof p.id !== "string" || p.id.length === 0) {
        errors.push(`${pp}.id must be a non-empty string.`);
      }
      if (!isVec2(p.position)) {
        errors.push(`${pp}.position must be {x, y}.`);
      }
      if (typeof p.radius !== "number" || p.radius <= 0) {
        errors.push(`${pp}.radius must be a positive number.`);
      }
      if (typeof p.targetId !== "string" || !portalIds.has(p.targetId)) {
        errors.push(
          `${pp}.targetId "${p.targetId}" not found in this hole's portals.`,
        );
      }
      if (p.targetId === p.id) {
        errors.push(`${pp}: portal cannot target itself.`);
      }
    });
  }

  // slopes
  if (hole.slopes && Array.isArray(hole.slopes)) {
    hole.slopes.forEach((s, j) => {
      const sp = `${prefix}.slopes[${j}]`;
      if (typeof s.id !== "string" || s.id.length === 0) {
        errors.push(`${sp}.id must be a non-empty string.`);
      }
      if (!Array.isArray(s.poly) || s.poly.length < 3) {
        errors.push(`${sp}.poly must have >= 3 points.`);
      }
      if (!isVec2(s.direction)) {
        errors.push(`${sp}.direction must be {x, y}.`);
      }
      if (typeof s.strength !== "number" || s.strength <= 0) {
        errors.push(`${sp}.strength must be a positive number.`);
      }
    });
  }

  // difficulty
  if (hole.difficulty !== undefined) {
    if (
      typeof hole.difficulty !== "number" ||
      !Number.isInteger(hole.difficulty) ||
      hole.difficulty < 1 ||
      hole.difficulty > 5
    ) {
      errors.push(`${prefix}.difficulty must be an integer 1-5.`);
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const files = fs
    .readdirSync(COURSES_DIR)
    .filter((f) => /^H\d{2}\.json$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.error("No H##.json files found in", COURSES_DIR);
    process.exit(1);
  }

  let totalErrors = 0;
  const passed = [];
  const failed = [];

  // Feature counters
  let waterCount = 0;
  let sandCount = 0;
  let iceCount = 0;
  let bumperCount = 0;
  let spinnerCount = 0;
  let gateCount = 0;
  let portalHoles = 0;
  let multiPortalHoles = 0;
  let slopeHoles = 0;

  for (const file of files) {
    const filePath = path.join(COURSES_DIR, file);
    let hole;
    try {
      hole = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (err) {
      console.error(`  PARSE ERROR  ${file}: ${err.message}`);
      failed.push(file);
      totalErrors++;
      continue;
    }

    const errors = [];
    validateHole(hole, file, errors);

    if (errors.length > 0) {
      console.error(`  FAIL  ${file}`);
      errors.forEach((e) => console.error(`        └─ ${e}`));
      failed.push(file);
      totalErrors += errors.length;
    } else {
      passed.push(file);
    }

    // Count features
    if (hole.hazards) {
      waterCount += hole.hazards.filter((h) => h.type === "water").length;
    }
    if (hole.surfaces) {
      sandCount += hole.surfaces.filter((s) => s.type === "sand").length;
      iceCount += hole.surfaces.filter((s) => s.type === "ice").length;
    }
    if (hole.obstacles) {
      bumperCount += hole.obstacles.filter((o) => o.type === "bumper").length;
      spinnerCount += hole.obstacles.filter((o) => o.type === "spinner").length;
      gateCount += hole.obstacles.filter(
        (o) => o.type === "moving_gate",
      ).length;
    }
    if (hole.portals && hole.portals.length > 0) {
      portalHoles++;
      if (hole.portals.length > 2) multiPortalHoles++;
    }
    if (hole.slopes && hole.slopes.length > 0) {
      slopeHoles++;
    }
  }

  console.log("");
  console.log("=".repeat(60));
  console.log(
    `Validation: ${passed.length} passed, ${failed.length} failed out of ${files.length} holes`,
  );
  if (failed.length > 0) {
    console.log("Failed files:", failed.join(", "));
  }
  console.log("");
  console.log("Feature Summary:");
  console.log(`  Water hazards:     ${waterCount}  (target >= 6)`);
  console.log(
    `  Sand zones:        ${sandCount}  (target: part of 6 sand/ice)`,
  );
  console.log(`  Ice zones:         ${iceCount}  (target: part of 6 sand/ice)`);
  console.log(
    `  Bumper obstacles:  ${bumperCount}  (target >= 6 holes w/ bumpers)`,
  );
  console.log(
    `  Spinners:          ${spinnerCount}  (target: part of 8 spin/gate)`,
  );
  console.log(
    `  Moving gates:      ${gateCount}  (target: part of 8 spin/gate)`,
  );
  console.log(`  Portal holes:      ${portalHoles}  (target >= 5)`);
  console.log(`  Multi-portal:      ${multiPortalHoles}  (target >= 2)`);
  console.log(`  Slope holes:       ${slopeHoles}  (target >= 4)`);
  console.log("=".repeat(60));

  process.exit(totalErrors > 0 ? 1 : 0);
}

main();
