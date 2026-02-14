import express from "express";
import fs from "fs";
import path from "path";
import type { Application, Request, Response } from "express";
import { createServerLogger } from "../utils/logger";

const log = createServerLogger("fishing-client-host");

const DEFAULT_MOUNT_PATH = "/fishing";

interface FishingClientHostOptions {
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

function resolveFishingDistPath(explicitPath?: string): string | null {
  const candidates = [
    explicitPath,
    process.env.FISHING_CLIENT_DIST,
    path.resolve(process.cwd(), "client", "dist"),
    path.resolve(process.cwd(), "..", "client", "dist"),
    path.resolve(__dirname, "../../../client/dist"),
  ].filter((value): value is string => Boolean(value && value.trim().length > 0));

  for (const candidate of candidates) {
    if (hasIndexFile(candidate)) {
      return candidate;
    }
  }
  return null;
}

function sendUnavailableMessage(res: Response): void {
  res.status(503).type("text/plain").send(
    [
      "Embedded fishing client bundle not found.",
      "Build it once from repo root:",
      "  cd client && npm run build",
      "Then restart colyseus-server.",
    ].join("\n"),
  );
}

function sendFishingIndex(indexFilePath: string, _req: Request, res: Response): void {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(indexFilePath);
}

export function attachFishingClientRoutes(
  app: Application,
  options: FishingClientHostOptions = {},
): void {
  const mountPath = normalizeMountPath(options.mountPath);
  const distPath = resolveFishingDistPath(options.distPath);

  app.get(`${mountPath}/health`, (_req, res) => {
    res.json({
      ok: Boolean(distPath),
      mountPath,
      distPath,
      message: distPath
        ? "Embedded fishing bundle is available."
        : "Embedded fishing bundle missing. Build client/dist first.",
    });
  });

  if (!distPath) {
    log.warn(
      `Fishing bundle missing. Expected client/dist. Mount path ${mountPath} will return 503.`,
    );
    app.get(mountPath, (_req, res) => sendUnavailableMessage(res));
    app.get(`${mountPath}/*`, (_req, res) => sendUnavailableMessage(res));
    return;
  }

  const indexPath = path.join(distPath, "index.html");
  const assetsPath = path.join(distPath, "assets");

  app.use(
    mountPath,
    express.static(distPath, {
      index: false,
      fallthrough: true,
      maxAge: "1h",
    }),
  );

  // Vite defaults to absolute asset URLs ("/assets/*"), so serve assets there too.
  if (fs.existsSync(assetsPath)) {
    app.use(
      "/assets",
      express.static(assetsPath, {
        fallthrough: true,
        maxAge: "1h",
      }),
    );
  }

  app.get(mountPath, (req, res) => sendFishingIndex(indexPath, req, res));
  app.get(`${mountPath}/*`, (req, res) => sendFishingIndex(indexPath, req, res));

  log.info(`Serving embedded fishing client from ${distPath} at ${mountPath}`);
}
