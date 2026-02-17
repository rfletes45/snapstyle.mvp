/**
 * Patch for @expo/cli wrapFetchWithCache bug (Node 22 + undici)
 *
 * Bug: cache.set() consumes response.body via tee(), but if the subsequent
 * cache.get() round-trip returns undefined, the original response (with an
 * already-consumed body) is returned to the caller, causing:
 *   "TypeError: Body is unusable: Body has already been read"
 *
 * Fix: clone the response before handing it to cache.set so the fallback
 * path can return a readable response.
 *
 * This runs as a postinstall script so the patch survives npm install.
 */
const fs = require("fs");
const path = require("path");

const TARGET = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo",
  "node_modules",
  "@expo",
  "cli",
  "build",
  "src",
  "api",
  "rest",
  "cache",
  "wrapFetchWithCache.js",
);

// The exact string we need to replace (original buggy code)
const BUGGY = `            // Cache the response
            cachedResponse = await cache.set(cacheKey, {
                body: response.body,
                info: (0, _ResponseCache.getResponseInfo)(response)
            });
            // Warn through debug logs that caching failed
            if (!cachedResponse) {
                debug(\`Failed to cache response for: \${url}\`);
                await cache.remove(cacheKey);
                return response;
            }`;

// Patched replacement — clone before cache.set, return clone on fallback
const PATCHED = `            // Clone the response BEFORE handing the body to cache.set so the
            // original stays readable even if caching fails (Node 22 undici bug).
            const clonedResponse = response.clone();
            // Cache the response
            cachedResponse = await cache.set(cacheKey, {
                body: response.body,
                info: (0, _ResponseCache.getResponseInfo)(response)
            });
            // Warn through debug logs that caching failed
            if (!cachedResponse) {
                debug(\`Failed to cache response for: \${url}\`);
                await cache.remove(cacheKey);
                return clonedResponse;
            }`;

if (!fs.existsSync(TARGET)) {
  console.log("[patch-expo-cli-cache] Target file not found, skipping.");
  process.exit(0);
}

let content = fs.readFileSync(TARGET, "utf8");

if (content.includes("clonedResponse")) {
  console.log("[patch-expo-cli-cache] Already patched.");
  process.exit(0);
}

if (!content.includes(BUGGY)) {
  console.log(
    "[patch-expo-cli-cache] Could not find target code — @expo/cli may have been updated. Skipping.",
  );
  process.exit(0);
}

content = content.replace(BUGGY, PATCHED);
fs.writeFileSync(TARGET, content, "utf8");
console.log("[patch-expo-cli-cache] Patched successfully.");
