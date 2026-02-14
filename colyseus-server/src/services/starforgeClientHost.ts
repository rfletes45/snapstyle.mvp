/**
 * Starforge client host — serves the built starforge-viewer bundle
 * as static assets co-located on the Colyseus Express server.
 *
 * Mount path defaults to /starforge.
 * Build with: cd starforge-viewer && npm run build
 */
import express from "express";
import fs from "fs";
import path from "path";
import type { Application, Request, Response } from "express";
import { createServerLogger } from "../utils/logger";

const log = createServerLogger("starforge-client-host");

const DEFAULT_MOUNT_PATH = "/starforge";

interface StarforgeClientHostOptions {
  mountPath?: string;
  distPath?: string;
}

function normalizeMountPath(value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    return DEFAULT_MOUNT_PATH;
  }
  const trimmed = value.trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function hasIndexFile(candidatePath: string): boolean {
  const indexPath = path.join(candidatePath, "index.html");
  try {
    return fs.existsSync(indexPath);
  } catch {
    return false;
  }
}

function resolveStarforgeDistPath(explicitPath?: string): string | null {
  const candidates = [
    explicitPath,
    process.env.STARFORGE_CLIENT_DIST,
    path.resolve(process.cwd(), "starforge-viewer", "dist"),
    path.resolve(process.cwd(), "..", "starforge-viewer", "dist"),
    path.resolve(__dirname, "../../../starforge-viewer/dist"),
  ].filter(
    (value): value is string => Boolean(value && value.trim().length > 0),
  );

  for (const candidate of candidates) {
    if (hasIndexFile(candidate)) {
      return candidate;
    }
  }
  return null;
}

function sendUnavailableMessage(res: Response): void {
  res
    .status(503)
    .type("text/plain")
    .send(
      [
        "Embedded Starforge client bundle not found.",
        "Build it once from repo root:",
        "  cd starforge-viewer && npm run build",
        "Then restart colyseus-server.",
      ].join("\n"),
    );
}

function sendStarforgeIndex(
  indexFilePath: string,
  _req: Request,
  res: Response,
): void {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(indexFilePath);
}

export function attachStarforgeClientRoutes(
  app: Application,
  options: StarforgeClientHostOptions = {},
): void {
  const mountPath = normalizeMountPath(options.mountPath);
  const distPath = resolveStarforgeDistPath(options.distPath);

  // Health endpoint for probing
  app.get(`${mountPath}/health`, (_req, res) => {
    res.json({
      ok: Boolean(distPath),
      mountPath,
      distPath,
      message: distPath
        ? "Embedded Starforge bundle is available."
        : "Embedded Starforge bundle missing. Build starforge-viewer/dist first.",
    });
  });

  if (!distPath) {
    log.warn(
      `Starforge bundle missing. Expected starforge-viewer/dist. Mount path ${mountPath} will return 503.`,
    );
    app.get(mountPath, (_req, res) => sendUnavailableMessage(res));
    app.get(`${mountPath}/*`, (_req, res) => sendUnavailableMessage(res));
    return;
  }

  const indexPath = path.join(distPath, "index.html");
  const assetsPath = path.join(distPath, "assets");

  // Serve /starforge/assets/* with immutable caching (hashed filenames)
  app.use(
    mountPath,
    express.static(distPath, {
      index: false,
      fallthrough: true,
      maxAge: "7d",
      immutable: true,
      setHeaders(res, filePath) {
        if (filePath.startsWith(assetsPath)) {
          res.setHeader(
            "Cache-Control",
            "public, max-age=31536000, immutable",
          );
        }
      },
    }),
  );

  // SPA fallback — all non-asset routes serve index.html
  app.get(mountPath, (req, res) => sendStarforgeIndex(indexPath, req, res));
  app.get(`${mountPath}/*`, (req, res) => {
    // Don't fallback for asset-looking requests that missed the static handler
    if (/\.(js|css|map|png|jpg|svg|woff2?|json|wasm|glb|gltf)$/i.test(req.path)) {
      res.status(404).end();
      return;
    }
    sendStarforgeIndex(indexPath, req, res);
  });

  log.info(
    `Starforge client bundle mounted at ${mountPath} from ${distPath}`,
  );
}
