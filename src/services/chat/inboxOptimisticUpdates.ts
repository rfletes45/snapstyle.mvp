import { USE_LOCAL_STORAGE } from "@/constants/featureFlags";
import {
  getDatabaseUnavailableReason,
  isDatabaseRuntimeAvailable,
} from "@/services/database";
import {
  getMessagesByStatus,
  type MessageWithAttachments,
} from "@/services/database/messageRepository";
import type { InboxConversation, MessageKind } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getDefaultMemberState,
  mapMessageKindToPreviewType,
  normalizeInboxTimestamp,
} from "./normalizeInboxRow";

const log = createLogger("inboxOptimisticUpdates");
const RECENT_UPDATE_TTL_MS = 60_000;
const RECENT_SEED_TTL_MS = 24 * 60 * 60 * 1000;
const CONVERSATION_SEED_CACHE_KEY = "@optimistic_inbox_conversation_seeds:";

export interface OptimisticInboxUpdate {
  scope: "dm" | "group";
  conversationId: string;
  messageId: string;
  messageKind: MessageKind;
  previewText: string;
  senderId: string;
  senderName?: string | null;
  timestamp: number;
  persisted?: boolean;
}

export interface OptimisticInboxConversationSeed {
  ownerUid: string;
  scope: "dm" | "group";
  conversationId: string;
  name: string;
  avatarUrl?: string | null;
  profilePictureUrl?: string | null;
  avatarConfig?: InboxConversation["avatarConfig"];
  decorationId?: string | null;
  otherUserId?: string;
  participantCount?: number;
  createdAt?: number;
  lastActivityAt?: number;
}

type Listener = (update: OptimisticInboxUpdate) => void;
type SeedListener = (seed: OptimisticInboxConversationSeed) => void;

const listeners = new Set<Listener>();
const seedListeners = new Set<SeedListener>();
const recentUpdates = new Map<string, OptimisticInboxUpdate>();
const recentSeeds = new Map<string, OptimisticInboxConversationSeed>();

function getUpdateKey(update: OptimisticInboxUpdate): string {
  return `${update.scope}:${update.conversationId}`;
}

function getSeedKey(seed: OptimisticInboxConversationSeed): string {
  return `${seed.ownerUid}:${seed.scope}:${seed.conversationId}`;
}

function getConversationSeedCacheKey(ownerUid: string): string {
  return `${CONVERSATION_SEED_CACHE_KEY}${ownerUid}`;
}

function getRecentSeedsForOwner(
  ownerUid: string,
): OptimisticInboxConversationSeed[] {
  return Array.from(recentSeeds.values()).filter(
    (seed) => seed.ownerUid === ownerUid,
  );
}

function isOptimisticInboxConversationSeed(
  value: unknown,
): value is OptimisticInboxConversationSeed {
  if (!value || typeof value !== "object") return false;
  const seed = value as Partial<OptimisticInboxConversationSeed>;
  return (
    typeof seed.ownerUid === "string" &&
    typeof seed.conversationId === "string" &&
    typeof seed.name === "string" &&
    (seed.scope === "dm" || seed.scope === "group")
  );
}

function notifySeedListeners(seed: OptimisticInboxConversationSeed): void {
  for (const listener of seedListeners) {
    try {
      listener(seed);
    } catch (error) {
      log.warn("optimistic inbox seed listener failed", { data: { error } });
    }
  }
}

async function persistConversationSeeds(ownerUid: string): Promise<void> {
  try {
    const seeds = getRecentSeedsForOwner(ownerUid);
    const key = getConversationSeedCacheKey(ownerUid);
    if (seeds.length === 0) {
      await AsyncStorage.removeItem(key);
      return;
    }
    await AsyncStorage.setItem(key, JSON.stringify(seeds));
  } catch (error) {
    log.warn("failed to persist optimistic inbox seeds", { data: { error } });
  }
}

function pruneRecentUpdates(now = Date.now()): void {
  for (const [key, update] of recentUpdates) {
    if (update.persisted) continue;
    if (now - update.timestamp > RECENT_UPDATE_TTL_MS) {
      recentUpdates.delete(key);
    }
  }
}

function pruneRecentSeeds(now = Date.now()): void {
  const prunedOwnerUids = new Set<string>();
  for (const [key, seed] of recentSeeds) {
    const timestamp = seed.lastActivityAt ?? seed.createdAt ?? 0;
    if (timestamp && now - timestamp > RECENT_SEED_TTL_MS) {
      recentSeeds.delete(key);
      prunedOwnerUids.add(seed.ownerUid);
    }
  }
  for (const ownerUid of prunedOwnerUids) {
    void persistConversationSeeds(ownerUid);
  }
}

function messageRowToOptimisticInboxUpdate(
  message: MessageWithAttachments,
): OptimisticInboxUpdate | null {
  if (!message.conversation_id || !message.scope) return null;

  return {
    scope: message.scope,
    conversationId: message.conversation_id,
    messageId: message.id,
    messageKind: message.kind,
    previewText: buildOptimisticPreviewText(message.kind, message.text),
    senderId: message.sender_id,
    senderName: message.sender_name,
    timestamp: message.created_at,
    persisted: true,
  };
}

export function getPersistedLocalInboxUpdates(): OptimisticInboxUpdate[] {
  if (!USE_LOCAL_STORAGE) return [];
  if (!isDatabaseRuntimeAvailable()) {
    log.debug("local inbox activity skipped", {
      data: { reason: getDatabaseUnavailableReason() },
    });
    return [];
  }

  try {
    const messages = [
      ...getMessagesByStatus("pending", 200),
      ...getMessagesByStatus("failed", 200),
    ];
    const byConversation = new Map<string, OptimisticInboxUpdate>();

    for (const message of messages) {
      const update = messageRowToOptimisticInboxUpdate(message);
      if (!update) continue;

      const key = getUpdateKey(update);
      const existing = byConversation.get(key);
      if (!existing || existing.timestamp < update.timestamp) {
        byConversation.set(key, update);
      }
    }

    return Array.from(byConversation.values());
  } catch (error) {
    log.warn("failed to load local inbox activity", { data: { error } });
    return [];
  }
}

export function buildOptimisticPreviewText(
  kind: MessageKind,
  text?: string | null,
): string {
  if (kind === "text") return text?.trim() || "";
  if (kind === "media") return "Photo";
  if (kind === "voice") return "Voice message";
  if (kind === "file") return "Attachment";
  if (kind === "animal") return text?.trim() || "Animal message";
  return text?.trim() || "";
}

export function emitOptimisticInboxUpdate(update: OptimisticInboxUpdate): void {
  if (!update.conversationId || !update.scope) return;

  pruneRecentUpdates();
  recentUpdates.set(getUpdateKey(update), update);

  log.debug("optimistic inbox activity", {
    data: {
      scope: update.scope,
      conversationId: update.conversationId,
      messageKind: update.messageKind,
      timestamp: update.timestamp,
      listenerCount: listeners.size,
    },
  });

  for (const listener of listeners) {
    try {
      listener(update);
    } catch (error) {
      log.warn("optimistic inbox listener failed", { data: { error } });
    }
  }
}

export function subscribeToOptimisticInboxUpdates(
  listener: Listener,
): () => void {
  listeners.add(listener);
  pruneRecentUpdates();
  for (const update of recentUpdates.values()) {
    try {
      listener(update);
    } catch (error) {
      log.warn("optimistic inbox replay failed", { data: { error } });
    }
  }
  return () => {
    listeners.delete(listener);
  };
}

export function emitOptimisticInboxConversationSeed(
  seed: OptimisticInboxConversationSeed,
): void {
  if (!seed.ownerUid || !seed.conversationId || !seed.scope) return;

  const timestamp = seed.lastActivityAt ?? seed.createdAt ?? Date.now();
  const normalizedSeed = {
    ...seed,
    createdAt: seed.createdAt ?? timestamp,
    lastActivityAt: timestamp,
  };

  pruneRecentSeeds();
  recentSeeds.set(getSeedKey(normalizedSeed), normalizedSeed);
  void persistConversationSeeds(normalizedSeed.ownerUid);

  log.debug("optimistic inbox conversation seed", {
    data: {
      ownerUid: normalizedSeed.ownerUid,
      scope: normalizedSeed.scope,
      conversationId: normalizedSeed.conversationId,
      listenerCount: seedListeners.size,
    },
  });

  notifySeedListeners(normalizedSeed);
}

export async function hydrateOptimisticInboxConversationSeeds(
  ownerUid: string,
): Promise<void> {
  if (!ownerUid) return;

  try {
    const raw = await AsyncStorage.getItem(
      getConversationSeedCacheKey(ownerUid),
    );
    if (!raw) return;

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;

    const now = Date.now();
    let hydratedCount = 0;
    for (const maybeSeed of parsed) {
      if (!isOptimisticInboxConversationSeed(maybeSeed)) continue;
      if (maybeSeed.ownerUid !== ownerUid) continue;

      const timestamp =
        maybeSeed.lastActivityAt ?? maybeSeed.createdAt ?? Date.now();
      if (now - timestamp > RECENT_SEED_TTL_MS) continue;

      const seed: OptimisticInboxConversationSeed = {
        ...maybeSeed,
        createdAt: maybeSeed.createdAt ?? timestamp,
        lastActivityAt: timestamp,
      };
      recentSeeds.set(getSeedKey(seed), seed);
      notifySeedListeners(seed);
      hydratedCount += 1;
    }

    if (hydratedCount > 0) {
      void persistConversationSeeds(ownerUid);
    }
  } catch (error) {
    log.warn("failed to hydrate optimistic inbox seeds", { data: { error } });
  }
}

export function getOptimisticInboxConversationSeeds(
  ownerUid: string,
): OptimisticInboxConversationSeed[] {
  pruneRecentSeeds();
  return getRecentSeedsForOwner(ownerUid);
}

export function removeOptimisticInboxConversationSeeds(
  ownerUid: string,
  refs: Array<{ scope: "dm" | "group"; conversationId: string }>,
): void {
  if (!ownerUid || refs.length === 0) return;

  let removed = false;
  for (const ref of refs) {
    const key = `${ownerUid}:${ref.scope}:${ref.conversationId}`;
    if (recentSeeds.delete(key)) removed = true;
  }

  if (removed) {
    void persistConversationSeeds(ownerUid);
  }
}

export function subscribeToOptimisticInboxConversationSeeds(
  listener: SeedListener,
): () => void {
  seedListeners.add(listener);
  pruneRecentSeeds();
  for (const seed of recentSeeds.values()) {
    try {
      listener(seed);
    } catch (error) {
      log.warn("optimistic inbox seed replay failed", { data: { error } });
    }
  }
  return () => {
    seedListeners.delete(listener);
  };
}

export function optimisticSeedToInboxConversation(
  seed: OptimisticInboxConversationSeed,
  currentUserId: string,
): InboxConversation {
  const timestamp = seed.lastActivityAt ?? seed.createdAt ?? Date.now();
  const memberState = {
    ...getDefaultMemberState(currentUserId),
    lastSeenAtPrivate: timestamp,
  };

  return {
    id: seed.conversationId,
    type: seed.scope,
    name: seed.name,
    avatarUrl: seed.avatarUrl ?? null,
    profilePictureUrl: seed.profilePictureUrl ?? null,
    avatarConfig: seed.avatarConfig,
    decorationId: seed.decorationId ?? null,
    otherUserId: seed.otherUserId,
    memberState,
    unreadCount: 0,
    hasMentions: false,
    createdAt: seed.createdAt ?? timestamp,
    lastActivityAt: timestamp,
    lastMessage: null,
    participantCount: seed.participantCount,
  };
}

export function mergeOptimisticInboxConversationSeeds(
  conversations: InboxConversation[],
  seeds: OptimisticInboxConversationSeed[],
  currentUserId: string,
): InboxConversation[] {
  if (seeds.length === 0) return conversations;

  const existingKeys = new Set(
    conversations.map(
      (conversation) => `${conversation.type}:${conversation.id}`,
    ),
  );
  const seededConversations = seeds
    .filter((seed) => !existingKeys.has(`${seed.scope}:${seed.conversationId}`))
    .map((seed) => optimisticSeedToInboxConversation(seed, currentUserId));

  if (seededConversations.length === 0) return conversations;
  return [...conversations, ...seededConversations];
}

export function applyOptimisticInboxUpdate(
  conversation: InboxConversation,
  update: OptimisticInboxUpdate,
  currentUserId?: string,
): InboxConversation {
  if (conversation.id !== update.conversationId) return conversation;
  if (conversation.type !== update.scope) return conversation;

  const currentTimestamp =
    normalizeInboxTimestamp(conversation.lastActivityAt) ||
    normalizeInboxTimestamp(conversation.lastMessage?.timestamp) ||
    normalizeInboxTimestamp(conversation.createdAt);
  if (currentTimestamp >= update.timestamp) return conversation;

  const isSender = currentUserId && update.senderId === currentUserId;

  return {
    ...conversation,
    lastMessage: {
      text: update.previewText,
      senderName: update.scope === "group" ? update.senderName || "" : "",
      timestamp: update.timestamp,
      type: mapMessageKindToPreviewType(update.messageKind),
    },
    lastActivityAt: update.timestamp,
    unreadCount: isSender ? 0 : conversation.unreadCount,
    memberState: isSender
      ? {
          ...conversation.memberState,
          lastSeenAtPrivate: Math.max(
            conversation.memberState.lastSeenAtPrivate || 0,
            update.timestamp,
          ),
          lastMarkedUnreadAt: undefined,
        }
      : conversation.memberState,
  };
}
