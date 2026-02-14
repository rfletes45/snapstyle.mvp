/**
 * Starforge game URL configuration.
 *
 * The starforge-viewer web client runs as a Vite app (port 5174 dev) and can be
 * co-located behind the Colyseus server at /starforge (production) or accessed
 * directly during development.
 *
 * URL params consumed by the viewer:
 *   ?server=ws://host:2567  — Colyseus WebSocket endpoint
 *   &room=starforge          — room name
 *   &name=Alice              — display name
 *   &role=player|spectator   — player role
 *   &firestoreGameId=...     — invite match id
 *   &embedded=1              — signals WebView embedding
 */
import Constants from "expo-constants";
import { Platform } from "react-native";

interface ExpoConstantsLegacyManifest {
  debuggerHost?: string;
}

interface ExpoConstantsManifest2 {
  extra?: {
    expoGo?: {
      debuggerHost?: string;
    };
  };
}

export type StarforgeLaunchMode = "game" | "join" | "spectate";

export interface StarforgeLaunchParams {
  /** Firestore GameInvite document id — used for Colyseus filterBy */
  firestoreGameId?: string;
  /** Player display name */
  playerName?: string;
  /** Player role (player or spectator) */
  role?: "player" | "spectator";
  /** Navigation entry point */
  source?: string;
  /** Whether embedded inside RN WebView */
  embedded?: boolean;
  /** Override base URL */
  baseUrl?: string;
  /** Launch mode */
  mode?: StarforgeLaunchMode;
  /** Force solo mode (no Colyseus connection) */
  soloOnly?: boolean;
}

const PROD_STARFORGE_URL = "https://starforge.yourdomain.com";
const DEV_STARFORGE_PORT = 5174;
const DEV_COLYSEUS_PORT = 2567;
const COLOCATED_STARFORGE_PATH = "/starforge";
const DEV_CANDIDATE_FALLBACKS = ["localhost", "127.0.0.1", "10.0.2.2"];

// ─── Host resolution helpers ──────────────────────────────────────────────────

function parseHostCandidate(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const normalized = /^[a-zA-Z]+:\/\//.test(trimmed)
      ? trimmed
      : `http://${trimmed}`;
    const parsed = new URL(normalized);
    const host = parsed.hostname.trim();
    return host.length > 0 ? host : null;
  } catch {
    const hostOnly = trimmed.replace(/^[a-zA-Z]+:\/\//, "").split("/")[0];
    const host = hostOnly.split(":")[0]?.trim() ?? "";
    return host.length > 0 ? host : null;
  }
}

function parseUrlCandidate(raw: string | undefined): URL | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const normalized = /^[a-zA-Z]+:\/\//.test(trimmed)
      ? trimmed
      : `http://${trimmed}`;
    return new URL(normalized);
  } catch {
    return null;
  }
}

function addCandidate(
  candidates: string[],
  candidate: string | null | undefined,
): void {
  if (!candidate) return;
  const normalized = candidate.replace(/\/+$/, "");
  if (!normalized) return;
  if (!candidates.includes(normalized)) {
    candidates.push(normalized);
  }
}

function toStarforgeUrlOnColyseusHost(host: string): string {
  return `http://${host}:${DEV_COLYSEUS_PORT}${COLOCATED_STARFORGE_PATH}`;
}

function toStarforgeUrlFromColyseusBase(
  raw: string | undefined,
): string | null {
  const parsed = parseUrlCandidate(raw);
  if (!parsed) return null;
  const protocol =
    parsed.protocol === "wss:" || parsed.protocol === "https:"
      ? "https:"
      : "http:";
  const port = parsed.port ? `:${parsed.port}` : "";
  return `${protocol}//${parsed.hostname}${port}${COLOCATED_STARFORGE_PATH}`;
}

function getDevHost(): string {
  const legacyConstants = Constants as typeof Constants & {
    manifest?: ExpoConstantsLegacyManifest;
    manifest2?: ExpoConstantsManifest2;
  };

  const debuggerHost =
    Constants.expoConfig?.hostUri ??
    legacyConstants.manifest?.debuggerHost ??
    legacyConstants.manifest2?.extra?.expoGo?.debuggerHost;

  const parsedHost = parseHostCandidate(debuggerHost);
  if (parsedHost) {
    const host = parsedHost.toLowerCase();
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return parsedHost;
    }
  }

  return Platform.select({
    android: "10.0.2.2",
    default: "localhost",
  })!;
}

function toDedicatedDevBaseUrl(host: string): string {
  return `http://${host}:${DEV_STARFORGE_PORT}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getStarforgeBaseUrlCandidates(): string[] {
  const envUrl = process.env.EXPO_PUBLIC_STARFORGE_GAME_URL?.trim();
  if (envUrl) {
    return [envUrl.replace(/\/+$/, "")];
  }

  if (__DEV__) {
    const candidates: string[] = [];
    const primary = getDevHost();

    // Primary: co-located on Colyseus server at /starforge
    addCandidate(
      candidates,
      toStarforgeUrlFromColyseusBase(process.env.EXPO_PUBLIC_COLYSEUS_URL),
    );
    addCandidate(
      candidates,
      toStarforgeUrlFromColyseusBase(
        process.env.EXPO_PUBLIC_COLYSEUS_SERVER_URL,
      ),
    );
    addCandidate(candidates, toStarforgeUrlOnColyseusHost(primary));
    for (const host of DEV_CANDIDATE_FALLBACKS) {
      addCandidate(candidates, toStarforgeUrlOnColyseusHost(host));
    }

    // Secondary: standalone Vite dev server (starforge-viewer/vite at port 5174)
    addCandidate(candidates, toDedicatedDevBaseUrl(primary));
    for (const host of DEV_CANDIDATE_FALLBACKS) {
      addCandidate(candidates, toDedicatedDevBaseUrl(host));
    }

    return candidates;
  }

  return [PROD_STARFORGE_URL];
}

export function getStarforgeBaseUrl(): string {
  const [first] = getStarforgeBaseUrlCandidates();
  return first ?? PROD_STARFORGE_URL;
}

/**
 * Derive the WebSocket endpoint for the Colyseus server from the resolved
 * base URL of the starforge viewer. This is needed because the viewer's
 * `?server=` param expects the WS URL, not the HTTP URL.
 */
export function deriveColyseusWsUrl(baseUrl: string): string {
  try {
    const parsed = new URL(baseUrl);
    const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    // If the viewer is co-located, the Colyseus WS endpoint shares the same host:port
    // If standalone, default to port 2567 on the same host
    const port = parsed.pathname.includes(COLOCATED_STARFORGE_PATH)
      ? parsed.port || (parsed.protocol === "https:" ? "443" : "80")
      : String(DEV_COLYSEUS_PORT);
    return `${wsProtocol}//${parsed.hostname}:${port}`;
  } catch {
    return `ws://localhost:${DEV_COLYSEUS_PORT}`;
  }
}

export function buildStarforgeGameUrl(
  params: StarforgeLaunchParams = {},
): string {
  const baseUrl = params.baseUrl ?? getStarforgeBaseUrl();
  const query: string[] = [];

  // Only add server connection params if not in solo-only mode
  if (!params.soloOnly) {
    // The viewer uses ?server=ws://... to connect to Colyseus
    const wsUrl = deriveColyseusWsUrl(baseUrl);
    query.push(`server=${encodeURIComponent(wsUrl)}`);
    query.push("room=starforge");
  }

  if (params.firestoreGameId) {
    query.push(`firestoreGameId=${encodeURIComponent(params.firestoreGameId)}`);
  }
  if (params.playerName) {
    query.push(`name=${encodeURIComponent(params.playerName)}`);
  }
  if (params.role) {
    query.push(`role=${encodeURIComponent(params.role)}`);
  }
  if (params.mode) {
    query.push(`mode=${encodeURIComponent(params.mode)}`);
  }
  if (params.source) {
    query.push(`source=${encodeURIComponent(params.source)}`);
  }
  if (params.embedded) {
    query.push("embedded=1");
  }

  // Ensure trailing slash before query string so that relative asset paths
  // in the Vite build (e.g. ./assets/index.js) resolve correctly when served
  // from a sub-path like /starforge.
  const normalizedBase = baseUrl.replace(/\/+$/, "") + "/";
  return `${normalizedBase}?${query.join("&")}`;
}

export function getStarforgeOriginFromBaseUrl(baseUrl: string): string | null {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return null;
  }
}
