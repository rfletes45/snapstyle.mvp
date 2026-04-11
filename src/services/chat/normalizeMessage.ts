import type {
  AttachmentRow,
  MessageRow,
  MessageSyncStatus,
} from "@/types/database";
import { intToBool, parseJsonColumn } from "@/types/database";
import type { MessageV2, ReplyToMetadata } from "@/types/messaging";

// Keep this as a shared, explicit rule so all runtimes (SQLite-first and
// Firestore-first) produce stable ordering.
//
// Uses `createdAt` as the primary sort key because it is set once at message
// creation and **never changes**.  `serverReceivedAt` is only available after
// the Cloud Function round-trip, and during rapid burst-sends the first synced
// message's `serverReceivedAt` is larger than all remaining pending messages'
// `createdAt` — which causes the synced message to leap to the newest position
// and visually teleport in the UI.  Sorting by `createdAt` eliminates this
// discontinuity while preserving the user's intended send order.
export function getCanonicalMessageTimestamp(message: MessageV2): number {
  return message.createdAt || message.serverReceivedAt || 0;
}

/**
 * Safely extract display text for system messages.
 *
 * Older builds stored JSON-encoded metadata in the `text` column for system
 * messages (e.g. `{"type":"system","systemType":"groupCreated", ...}`).
 * This helper detects that pattern and returns the embedded `displayText`
 * (or `content`) instead, so serialized JSON never leaks to the UI.
 */
export function safeSystemText(raw: string | undefined | null): string {
  if (!raw) return "";
  if (!raw.startsWith("{")) return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed.displayText ?? parsed.content ?? parsed.text ?? "";
  } catch {
    return raw;
  }
}

export function compareMessagesCanonicalDesc(
  a: MessageV2,
  b: MessageV2,
): number {
  // Primary: createdAt (stable — set once, never mutated)
  const aPrimary = getCanonicalMessageTimestamp(a);
  const bPrimary = getCanonicalMessageTimestamp(b);
  if (aPrimary !== bPrimary) return bPrimary - aPrimary;

  // Secondary: serverReceivedAt (tie-breaks cross-device messages with identical createdAt)
  const aServer = a.serverReceivedAt || 0;
  const bServer = b.serverReceivedAt || 0;
  if (aServer !== bServer) return bServer - aServer;

  // Tertiary: lexicographic ID for full determinism
  return b.id.localeCompare(a.id);
}

export function getMessageStatusFromSync(
  syncStatus: MessageSyncStatus,
): MessageV2["status"] {
  if (syncStatus === "pending") return "sending";
  if (syncStatus === "failed") return "failed";
  return "sent";
}

function normalizeAttachmentFromRow(
  row: AttachmentRow,
): NonNullable<MessageV2["attachments"]>[number] {
  return {
    id: row.id,
    kind: row.kind,
    mime: row.mime,
    url: row.local_uri || row.remote_url || "",
    path: row.remote_path || "",
    sizeBytes: row.size_bytes || 0,
    width: row.width || undefined,
    height: row.height || undefined,
    durationMs: row.duration_ms || undefined,
    thumbUrl: row.thumb_local_uri || row.thumb_remote_url || undefined,
    caption: row.caption || undefined,
    viewOnce: intToBool(row.view_once),
    expiresAt: row.expires_at || undefined,
  };
}

export function normalizeMessageFromLocalRow(
  row: MessageRow & { attachments: AttachmentRow[] },
  currentUid: string,
): MessageV2 | null {
  const hiddenFor = parseJsonColumn<string[]>(row.hidden_for_json, []);
  if (hiddenFor.includes(currentUid)) return null;

  const senderStyle = parseJsonColumn(row.sender_style_json, undefined);
  const deletedForAll = row.deleted_for_all
    ? {
        by: row.deleted_by || "unknown",
        at: row.deleted_at || Date.now(),
      }
    : undefined;

  return {
    id: row.id,
    scope: row.scope,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: row.sender_name || undefined,
    kind: row.kind,
    text:
      row.kind === "animal"
        ? undefined
        : row.kind === "system"
          ? safeSystemText(row.text) || undefined
          : row.text || undefined,
    animalId: row.kind === "animal" ? row.text || undefined : undefined,
    attachments: row.attachments.map(normalizeAttachmentFromRow),
    createdAt: row.created_at,
    serverReceivedAt: row.server_received_at || row.created_at,
    editedAt: row.edited_at || undefined,
    replyTo: row.reply_to_preview
      ? parseJsonColumn<ReplyToMetadata>(
          row.reply_to_preview,
          undefined as unknown as ReplyToMetadata,
        )
      : undefined,
    threadRootId: row.thread_root_id || undefined,
    replyCount: row.reply_count || undefined,
    lastReplyAt: row.last_reply_at || undefined,
    mentionUids: parseJsonColumn<string[]>(
      row.mentions_json,
      undefined as unknown as string[],
    ),
    reactionsSummary: parseJsonColumn<Record<string, number>>(
      row.reactions_json,
      undefined as unknown as Record<string, number>,
    ),
    deletedForAll,
    hiddenFor: hiddenFor.length > 0 ? hiddenFor : undefined,
    linkPreview: parseJsonColumn(row.link_preview_json, undefined),
    senderStyle,
    clientId: "",
    idempotencyKey: row.id,
    status: getMessageStatusFromSync(row.sync_status),
  };
}

function toMillis(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value) {
    const maybeTimestamp = value as {
      toMillis?: () => number;
      seconds?: unknown;
      nanoseconds?: unknown;
    };

    // Firestore Timestamp#toMillis depends on instance context.
    // Call it as a bound method to avoid `this` being undefined.
    if (typeof maybeTimestamp.toMillis === "function") {
      try {
        return maybeTimestamp.toMillis();
      } catch {
        // Fall through to plain-object timestamp handling below.
      }
    }

    if (typeof maybeTimestamp.seconds === "number") {
      const nanos =
        typeof maybeTimestamp.nanoseconds === "number"
          ? maybeTimestamp.nanoseconds
          : 0;
      return maybeTimestamp.seconds * 1000 + Math.floor(nanos / 1_000_000);
    }
  }
  return undefined;
}

export interface FirestoreMessageNormalizationInput {
  id: string;
  data: Record<string, unknown>;
  scopeHint: "dm" | "group";
  conversationIdHint: string;
}

export function normalizeMessageFromFirestoreDoc(
  input: FirestoreMessageNormalizationInput,
): MessageV2 {
  const { id, data, scopeHint, conversationIdHint } = input;
  const createdAt = toMillis(data.createdAt) || Date.now();
  const serverReceivedAt = toMillis(data.serverReceivedAt) || createdAt;
  const editedAt = toMillis(data.editedAt);

  return {
    id,
    scope: (data.scope as MessageV2["scope"] | undefined) || scopeHint,
    conversationId:
      (data.conversationId as string | undefined) || conversationIdHint,
    senderId:
      (data.senderId as string | undefined) || (data.sender as string) || "",
    senderName:
      (data.senderName as string | undefined) ||
      (data.senderDisplayName as string | undefined) ||
      undefined,
    senderAvatarConfig:
      data.senderAvatarConfig as MessageV2["senderAvatarConfig"],
    kind:
      (data.kind as MessageV2["kind"] | undefined) ||
      (data.type as MessageV2["kind"] | undefined) ||
      "text",
    text:
      (data.text as string | undefined) ||
      (data.content as string | undefined) ||
      undefined,
    animalId: data.animalId as string | undefined,
    createdAt,
    serverReceivedAt,
    editedAt,
    deletedForAll: data.deletedForAll as MessageV2["deletedForAll"],
    hiddenFor: data.hiddenFor as string[] | undefined,
    replyTo: data.replyTo as ReplyToMetadata | undefined,
    threadRootId: data.threadRootId as string | undefined,
    replyCount: data.replyCount as number | undefined,
    lastReplyAt: toMillis(data.lastReplyAt),
    attachments: data.attachments as MessageV2["attachments"],
    mentionUids: data.mentionUids as string[] | undefined,
    mentionSpans: data.mentionSpans as MessageV2["mentionSpans"],
    reactionsSummary: data.reactionsSummary as
      | Record<string, number>
      | undefined,
    linkPreview: data.linkPreview as MessageV2["linkPreview"],
    clientId: (data.clientId as string | undefined) || "",
    idempotencyKey: (data.idempotencyKey as string | undefined) || id,
    senderStyle: data.senderStyle as MessageV2["senderStyle"],
    status: (data.status as MessageV2["status"] | undefined) || "sent",
  };
}

function isOptimisticMessage(message: MessageV2): boolean {
  return message.status === "sending" || message.status === "failed";
}

function choosePreferredMessage(a: MessageV2, b: MessageV2): MessageV2 {
  const aTime = getCanonicalMessageTimestamp(a);
  const bTime = getCanonicalMessageTimestamp(b);
  if (aTime !== bTime) return aTime > bTime ? a : b;

  // Prefer the confirmed server version when it ties with an optimistic row.
  if (isOptimisticMessage(a) && !isOptimisticMessage(b)) {
    return b;
  }
  if (isOptimisticMessage(b) && !isOptimisticMessage(a)) {
    return a;
  }

  // For duplicate server records (e.g. modified snapshot arriving twice),
  // prefer the one with the more recent serverReceivedAt — it carries the
  // most up-to-date payload (edited text, reactions, etc.).
  const aServer = a.serverReceivedAt || 0;
  const bServer = b.serverReceivedAt || 0;
  if (aServer !== bServer) return aServer > bServer ? a : b;

  return a;
}

export function dedupeAndSortMessages(messages: MessageV2[]): MessageV2[] {
  const byId = new Map<string, MessageV2>();

  for (const message of messages) {
    const existing = byId.get(message.id);
    if (!existing) {
      byId.set(message.id, message);
      continue;
    }
    byId.set(message.id, choosePreferredMessage(existing, message));
  }

  return Array.from(byId.values()).sort(compareMessagesCanonicalDesc);
}

export function mergeMessageCollections(
  existing: MessageV2[],
  incoming: MessageV2[],
): MessageV2[] {
  return dedupeAndSortMessages([...existing, ...incoming]);
}
