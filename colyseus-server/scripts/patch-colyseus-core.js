/**
 * Patches @colyseus/core to fix Express 4.x compatibility.
 *
 * Express 4.x defines `app.router` as a getter that throws an error
 * ("app.router is deprecated"). @colyseus/core's `expressRootRoute()`
 * accesses `expressApp?.router?.stack` which triggers this throw.
 * Optional chaining (?.) does NOT catch thrown errors — only undefined.
 *
 * This patch wraps the access in a try-catch so the server can start.
 * Remove this once @colyseus/core fixes the issue upstream.
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@colyseus",
  "core",
  "build",
  "router",
  "index.cjs",
);

if (!fs.existsSync(filePath)) {
  console.log("[patch] @colyseus/core router file not found — skipping");
  process.exit(0);
}

let content = fs.readFileSync(filePath, "utf8");

const buggyPattern =
  "const stack = expressApp?._router?.stack ?? expressApp?.router?.stack;";
const fixedPattern = `let stack;
  try {
    stack = expressApp?._router?.stack ?? expressApp?.router?.stack;
  } catch (e) {
    // Express 4.x throws on app.router access — fall back to _router only
    stack = expressApp?._router?.stack;
  }`;

if (content.includes(buggyPattern)) {
  content = content.replace(
    `const stack = ${buggyPattern.slice(14)}`,
    fixedPattern,
  );
  fs.writeFileSync(filePath, content);
  console.log(
    "[patch] @colyseus/core: patched expressRootRoute for Express 4.x",
  );
} else if (content.includes("// Express 4.x throws on app.router access")) {
  console.log("[patch] @colyseus/core: already patched");
} else {
  console.warn(
    "[patch] @colyseus/core: could not find expected pattern — manual check needed",
  );
}
