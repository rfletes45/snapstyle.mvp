import { createLogger } from "@/utils/log";
import { normalizeRemoteImageUrl } from "@/utils/remoteImageSource";

const log = createLogger("groupWallpaper");

const PREPARED_GROUP_CACHE_TTL_MS = 10 * 60 * 1000;

export interface PreparedGroupChatData {
  name: string;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  preparedAt: number;
  source: string;
}

type PreparedGroupChatSeed = Partial<
  Pick<PreparedGroupChatData, "name" | "avatarUrl" | "backgroundUrl">
>;

const preparedGroupCache = new Map<string, PreparedGroupChatData>();

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function readPreparedGroupChatData(groupId: string): PreparedGroupChatData | null {
  const cached = preparedGroupCache.get(groupId);
  if (!cached) return null;
  if (Date.now() - cached.preparedAt > PREPARED_GROUP_CACHE_TTL_MS) {
    preparedGroupCache.delete(groupId);
    return null;
  }
  return cached;
}

export function describeRemoteUrlForLog(
  url: string | null | undefined,
): {
  normalized: string | null;
  present: boolean;
  key: string;
} {
  const normalized = normalizeRemoteImageUrl(url);
  return {
    normalized,
    present: !!normalized,
    key: normalized ? hashString(normalized) : "none",
  };
}

export function traceGroupWallpaper(
  groupId: string,
  stage: string,
  data?: Record<string, unknown>,
): void {
  if (!__DEV__) return;
  log.info(`[${groupId}] ${stage}`, { data });
}

export function rememberPreparedGroupChatData(
  groupId: string,
  seed: PreparedGroupChatSeed,
  source: string,
): PreparedGroupChatData | null {
  if (!groupId) return null;

  const existing = readPreparedGroupChatData(groupId);
  const next: PreparedGroupChatData = {
    name: existing?.name ?? "",
    avatarUrl: existing?.avatarUrl ?? null,
    backgroundUrl: existing?.backgroundUrl ?? null,
    preparedAt: Date.now(),
    source,
  };

  if ("name" in seed) {
    next.name =
      typeof seed.name === "string" && seed.name.trim().length > 0
        ? seed.name
        : seed.name === null
          ? ""
          : next.name;
  }

  if ("avatarUrl" in seed) {
    next.avatarUrl = normalizeRemoteImageUrl(seed.avatarUrl) ?? null;
  }

  if ("backgroundUrl" in seed) {
    next.backgroundUrl = normalizeRemoteImageUrl(seed.backgroundUrl) ?? null;
  }

  preparedGroupCache.set(groupId, next);

  if (__DEV__) {
    traceGroupWallpaper(groupId, "prepared-cache-set", {
      source,
      avatarKey: describeRemoteUrlForLog(next.avatarUrl).key,
      backgroundKey: describeRemoteUrlForLog(next.backgroundUrl).key,
      cacheSize: preparedGroupCache.size,
    });
  }

  return next;
}

export function getPreparedGroupChatData(
  groupId: string,
  traceReason?: string,
): PreparedGroupChatData | null {
  if (!groupId) return null;
  const cached = readPreparedGroupChatData(groupId);

  if (__DEV__ && traceReason) {
    traceGroupWallpaper(groupId, "prepared-cache-read", {
      reason: traceReason,
      hit: !!cached,
      source: cached?.source ?? null,
      avatarKey: describeRemoteUrlForLog(cached?.avatarUrl).key,
      backgroundKey: describeRemoteUrlForLog(cached?.backgroundUrl).key,
    });
  }

  return cached;
}
