/**
 * syncPricingTable.js
 *
 * Pre-build step: copies the canonical shopPricingTable.json from
 * shared/cosmetics/ into firebase-backend/functions/src/ so the
 * Cloud Functions can import it (their tsconfig rootDir is ./src).
 *
 * Run via: npm run build → "node scripts/syncPricingTable.js && tsc"
 */

const fs = require("fs");
const path = require("path");

const SRC = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "shared",
  "cosmetics",
  "shopPricingTable.json",
);
const DEST = path.resolve(__dirname, "..", "src", "shopPricingTable.json");

try {
  if (!fs.existsSync(SRC)) {
    console.error(
      `[syncPricingTable] Source not found: ${SRC}\n` +
        `  Make sure shared/cosmetics/shopPricingTable.json exists.`,
    );
    process.exit(1);
  }

  fs.copyFileSync(SRC, DEST);
  console.log(`[syncPricingTable] Copied pricing table → ${DEST}`);
} catch (err) {
  console.error("[syncPricingTable] Failed:", err.message);
  process.exit(1);
}
