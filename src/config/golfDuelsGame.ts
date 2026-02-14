/**
 * Golf Duels game URL configuration.
 *
 * The golf-duels-client web client runs as a Vite app (port 5175 dev) and can
 * be co-located behind the Colyseus server at /golf (production) or accessed
 * directly during development.
 *
 * URL params consumed by the client:
 *   ?server=ws://host:2567  — Colyseus WebSocket endpoint
 *   &room=golf_duels        — room name
 *   &firestoreGameId=...    — invite match id
 *   &role=player|spectator  — player role
 *   &embedded=1             — signals WebView embedding
 *   &displayName=...        — player display name
 *   &token=...              — Firebase ID token
 *   &uid=...                — Firebase uid (dev fallback)
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

export interface GolfDuelsLaunchParams {
  firestoreGameId?: string;
  displayName?: string;
  role?: "player" | "spectator";
  token?: string;
  uid?: string;
  embedded?: boolean;
  baseUrl?: string;
}

const PROD_GOLF_URL = "https://golf.yourdomain.com";
const DEV_GOLF_PORT = 5175;
const DEV_COLYSEUS_PORT = 2567;
const COLOCATED_GOLF_PATH = "/golf";
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

function toGolfUrlOnColyseusHost(host: string): string {
  return `http://${host}:${DEV_COLYSEUS_PORT}${COLOCATED_GOLF_PATH}`;
}

function toGolfUrlFromColyseusBase(raw: string | undefined): string | null {
  const parsed = parseUrlCandidate(raw);
  if (!parsed) return null;
  const protocol =
    parsed.protocol === "wss:" || parsed.protocol === "https:"
      ? "https:"
      : "http:";
  const port = parsed.port ? `:${parsed.port}` : "";
  return `${protocol}//${parsed.hostname}${port}${COLOCATED_GOLF_PATH}`;
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
  return `http://${host}:${DEV_GOLF_PORT}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getGolfDuelsBaseUrlCandidates(): string[] {
  const envUrl = process.env.EXPO_PUBLIC_GOLF_DUELS_GAME_URL?.trim();
  if (envUrl) {
    return [envUrl.replace(/\/+$/, "")];
  }

  if (__DEV__) {
    const candidates: string[] = [];
    const primary = getDevHost();

    // Primary: co-located on Colyseus server at /golf
    addCandidate(
      candidates,
      toGolfUrlFromColyseusBase(process.env.EXPO_PUBLIC_COLYSEUS_URL),
    );
    addCandidate(
      candidates,
      toGolfUrlFromColyseusBase(process.env.EXPO_PUBLIC_COLYSEUS_SERVER_URL),
    );
    addCandidate(candidates, toGolfUrlOnColyseusHost(primary));
    for (const host of DEV_CANDIDATE_FALLBACKS) {
      addCandidate(candidates, toGolfUrlOnColyseusHost(host));
    }

    // Secondary: standalone Vite dev server at port 5175
    addCandidate(candidates, toDedicatedDevBaseUrl(primary));
    for (const host of DEV_CANDIDATE_FALLBACKS) {
      addCandidate(candidates, toDedicatedDevBaseUrl(host));
    }

    return candidates;
  }

  return [PROD_GOLF_URL];
}

export function getGolfDuelsBaseUrl(): string {
  const [first] = getGolfDuelsBaseUrlCandidates();
  return first ?? PROD_GOLF_URL;
}

export function deriveColyseusWsUrl(baseUrl: string): string {
  try {
    const parsed = new URL(baseUrl);
    const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    const port = parsed.pathname.includes(COLOCATED_GOLF_PATH)
      ? parsed.port || (parsed.protocol === "https:" ? "443" : "80")
      : String(DEV_COLYSEUS_PORT);
    return `${wsProtocol}//${parsed.hostname}:${port}`;
  } catch {
    return `ws://localhost:${DEV_COLYSEUS_PORT}`;
  }
}

export function buildGolfDuelsGameUrl(
  params: GolfDuelsLaunchParams = {},
): string {
  const baseUrl = params.baseUrl ?? getGolfDuelsBaseUrl();
  const query: string[] = [];

  const wsUrl = deriveColyseusWsUrl(baseUrl);
  query.push(`server=${encodeURIComponent(wsUrl)}`);
  query.push("room=golf_duels");

  if (params.firestoreGameId) {
    query.push(`firestoreGameId=${encodeURIComponent(params.firestoreGameId)}`);
  }
  if (params.displayName) {
    query.push(`displayName=${encodeURIComponent(params.displayName)}`);
  }
  if (params.role) {
    query.push(`role=${encodeURIComponent(params.role)}`);
  }
  if (params.token) {
    query.push(`token=${encodeURIComponent(params.token)}`);
  }
  if (params.uid) {
    query.push(`uid=${encodeURIComponent(params.uid)}`);
  }
  if (params.embedded) {
    query.push("embedded=1");
  }

  const normalizedBase = baseUrl.replace(/\/+$/, "") + "/";
  return `${normalizedBase}?${query.join("&")}`;
}

export function getGolfDuelsOriginFromBaseUrl(baseUrl: string): string | null {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return null;
  }
}
