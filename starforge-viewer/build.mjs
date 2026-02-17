/**
 * Starforge Viewer — esbuild bundler script.
 *
 * Replaces Vite for production builds and watch-mode development.
 * Output goes to dist/ which the Colyseus server serves at /starforge.
 *
 * Usage:
 *   node build.mjs          # one-shot production build (minified)
 *   node build.mjs --watch  # rebuild on changes (dev)
 */
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");
const outdir = resolve(__dirname, "dist");

// ── Prepare output directory ──────────────────────────────────────────────────

mkdirSync(resolve(outdir, "assets"), { recursive: true });

// Copy public/ assets (starforge_modules_v1.json) to dist/
cpSync(resolve(__dirname, "public"), outdir, { recursive: true, force: true });

// ── Generate index.html ───────────────────────────────────────────────────────

const srcHtml = readFileSync(resolve(__dirname, "index.html"), "utf-8");
const distHtml = srcHtml.replace(
  /<script type="module" src="\/src\/main\.ts"><\/script>/,
  '<link rel="stylesheet" href="./assets/index.css">\n    <script type="module" src="./assets/index.js"></script>',
);
writeFileSync(resolve(outdir, "index.html"), distHtml);

// ── esbuild config ───────────────────────────────────────────────────────────

/** @type {import("esbuild").BuildOptions} */
const config = {
  entryPoints: [resolve(__dirname, "src/main.ts")],
  bundle: true,
  format: "esm",
  outdir: resolve(outdir, "assets"),
  entryNames: "index",
  minify: !watch,
  sourcemap: watch,
  target: "es2020",
  logLevel: "info",
};

// ── Run ───────────────────────────────────────────────────────────────────────

if (watch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log("[starforge-viewer] watching for changes...");
} else {
  await esbuild.build(config);
  console.log("[starforge-viewer] build complete → dist/");
}
