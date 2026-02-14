/**
 * Golf Duels client host — serves the built golf-duels-client bundle
 * as static assets co-located on the Colyseus Express server.
 *
 * Mount path defaults to /golf.
 * Build with: cd golf-duels-client && npm run build
 */
import type { Application, Request, Response } from "express";
import express from "express";
import fs from "fs";
import path from "path";
import { createServerLogger } from "../utils/logger";

const log = createServerLogger("golf-client-host");

const DEFAULT_MOUNT_PATH = "/golf";

interface GolfClientHostOptions {
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

function resolveGolfDistPath(explicitPath?: string): string | null {
  const candidates = [
    explicitPath,
    process.env.GOLF_CLIENT_DIST,
    path.resolve(process.cwd(), "golf-duels-client", "dist"),
    path.resolve(process.cwd(), "..", "golf-duels-client", "dist"),
    path.resolve(__dirname, "../../../golf-duels-client/dist"),
  ].filter((value): value is string =>
    Boolean(value && value.trim().length > 0),
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
        "Embedded Golf Duels client bundle not found.",
        "Build it once from repo root:",
        "  cd golf-duels-client && npm run build",
        "Then restart colyseus-server.",
      ].join("\n"),
    );
}

function sendGolfIndex(
  indexFilePath: string,
  _req: Request,
  res: Response,
): void {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(indexFilePath);
}

export function attachGolfClientRoutes(
  app: Application,
  options: GolfClientHostOptions = {},
): void {
  const mountPath = normalizeMountPath(options.mountPath);
  const distPath = resolveGolfDistPath(options.distPath);

  if (!distPath) {
    log.warn(`Golf client dist not found. Mount ${mountPath} will return 503.`);
    app.use(mountPath, (_req: Request, res: Response) => {
      sendUnavailableMessage(res);
    });
    return;
  }

  const indexFilePath = path.join(distPath, "index.html");

  log.info(`Serving Golf client from ${distPath} at ${mountPath}`);

  // Serve static assets
  app.use(
    mountPath,
    express.static(distPath, {
      index: false,
      maxAge: "1d",
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-store");
        }
      },
    }),
  );

  // SPA fallback — serve index.html for all unmatched routes
  app.get(`${mountPath}/*`, (req: Request, res: Response) => {
    sendGolfIndex(indexFilePath, req, res);
  });

  // Also handle the mount path itself
  app.get(mountPath, (req: Request, res: Response) => {
    sendGolfIndex(indexFilePath, req, res);
  });
}
