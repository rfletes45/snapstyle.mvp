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

type FishingJoinMode = "join" | "game" | "spectate";

export interface FishingLaunchParams {
  firestoreGameId?: string;
  inviteCode?: string;
  roomId?: string;
  inviteId?: string;
  mode?: FishingJoinMode;
  source?: string;
  embedded?: boolean;
  baseUrl?: string;
}

const PROD_FISHING_URL = "https://fishing.yourdomain.com";
const DEV_FISHING_PORT = 5173;
const DEV_COLYSEUS_PORT = 2567;
const COLOCATED_FISHING_PATH = "/fishing";
const DEV_CANDIDATE_FALLBACKS = ["localhost", "127.0.0.1", "10.0.2.2"];

function parseHostCandidate(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  // Handles inputs like:
  // - "192.168.1.10:8081"
  // - "exp://192.168.1.10:8081"
  // - "https://example.com:1234/path"
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
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const normalized = /^[a-zA-Z]+:\/\//.test(trimmed)
      ? trimmed
      : `http://${trimmed}`;
    return new URL(normalized);
  } catch {
    return null;
  }
}

function toFishingUrlOnColyseusHost(host: string): string {
  return `http://${host}:${DEV_COLYSEUS_PORT}${COLOCATED_FISHING_PATH}`;
}

function toFishingUrlFromColyseusBase(raw: string | undefined): string | null {
  const parsed = parseUrlCandidate(raw);
  if (!parsed) {
    return null;
  }
  const protocol =
    parsed.protocol === "wss:" || parsed.protocol === "https:"
      ? "https:"
      : "http:";
  const port = parsed.port ? `:${parsed.port}` : "";
  return `${protocol}//${parsed.hostname}${port}${COLOCATED_FISHING_PATH}`;
}

function addCandidate(
  candidates: string[],
  candidate: string | null | undefined,
): void {
  if (!candidate) {
    return;
  }
  const normalized = candidate.replace(/\/+$/, "");
  if (!normalized) {
    return;
  }
  if (!candidates.includes(normalized)) {
    candidates.push(normalized);
  }
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
  return `http://${host}:${DEV_FISHING_PORT}`;
}

export function getFishingGameBaseUrl(): string {
  const [first] = getFishingGameBaseUrlCandidates();
  return first ?? PROD_FISHING_URL;
}

export function getFishingGameBaseUrlCandidates(): string[] {
  const envUrl = process.env.EXPO_PUBLIC_FISHING_GAME_URL?.trim();
  if (envUrl) {
    return [envUrl.replace(/\/+$/, "")];
  }

  if (__DEV__) {
    const candidates: string[] = [];
    const primary = getDevHost();

    // Primary path: fishing bundle served by the existing Colyseus host.
    addCandidate(
      candidates,
      toFishingUrlFromColyseusBase(process.env.EXPO_PUBLIC_COLYSEUS_URL),
    );
    addCandidate(
      candidates,
      toFishingUrlFromColyseusBase(
        process.env.EXPO_PUBLIC_COLYSEUS_SERVER_URL,
      ),
    );
    addCandidate(candidates, toFishingUrlOnColyseusHost(primary));
    for (const host of DEV_CANDIDATE_FALLBACKS) {
      addCandidate(candidates, toFishingUrlOnColyseusHost(host));
    }

    // Secondary path: standalone Vite host (still supported for local iteration).
    addCandidate(candidates, toDedicatedDevBaseUrl(primary));
    for (const host of DEV_CANDIDATE_FALLBACKS) {
      addCandidate(candidates, toDedicatedDevBaseUrl(host));
    }

    return candidates;
  }

  return [PROD_FISHING_URL];
}

export function buildFishingGameUrl(params: FishingLaunchParams = {}): string {
  const baseUrl = params.baseUrl ?? getFishingGameBaseUrl();
  const query: string[] = [];

  if (params.mode) {
    query.push(`mode=${encodeURIComponent(params.mode)}`);
  }
  if (params.firestoreGameId) {
    query.push(`firestoreGameId=${encodeURIComponent(params.firestoreGameId)}`);
  }
  if (params.inviteCode) {
    query.push(`inviteCode=${encodeURIComponent(params.inviteCode)}`);
  }
  if (params.roomId) {
    query.push(`roomId=${encodeURIComponent(params.roomId)}`);
  }
  if (params.inviteId) {
    query.push(`inviteId=${encodeURIComponent(params.inviteId)}`);
  }
  if (params.source) {
    query.push(`source=${encodeURIComponent(params.source)}`);
  }
  if (params.embedded) {
    query.push("embedded=1");
  }

  if (query.length === 0) {
    return baseUrl;
  }

  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}${query.join("&")}`;
}

export function getFishingGameOrigin(): string | null {
  try {
    return new URL(getFishingGameBaseUrl()).origin;
  } catch {
    return null;
  }
}

export function getFishingGameOriginFromBaseUrl(baseUrl: string): string | null {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return null;
  }
}
