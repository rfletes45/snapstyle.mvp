import type { MessageRow } from "@/types/database";
import type { MessageV2 } from "@/types/messaging";

export interface CreatedAtMessageCursor {
  createdAt: number;
  messageId: string;
}

export interface ServerReceivedMessageCursor {
  serverReceivedAt: number;
  messageId: string;
}

export type MessagePageCursor =
  | CreatedAtMessageCursor
  | ServerReceivedMessageCursor;

export function isCreatedAtCursor(
  cursor: MessagePageCursor,
): cursor is CreatedAtMessageCursor {
  return "createdAt" in cursor;
}

export function isServerReceivedCursor(
  cursor: MessagePageCursor,
): cursor is ServerReceivedMessageCursor {
  return "serverReceivedAt" in cursor;
}

export function normalizeCreatedAtCursor(
  cursor: number | CreatedAtMessageCursor,
  fallbackMessageId: string = "",
): CreatedAtMessageCursor {
  if (typeof cursor === "number") {
    return { createdAt: cursor, messageId: fallbackMessageId };
  }
  return cursor;
}

export function normalizeServerReceivedCursor(
  cursor: number | ServerReceivedMessageCursor,
  fallbackMessageId: string = "",
): ServerReceivedMessageCursor {
  if (typeof cursor === "number") {
    return { serverReceivedAt: cursor, messageId: fallbackMessageId };
  }
  return cursor;
}

export function createdAtCursorFromRow(
  row: Pick<MessageRow, "id" | "created_at" | "server_received_at">,
): CreatedAtMessageCursor {
  return {
    createdAt: row.created_at || row.server_received_at || Date.now(),
    messageId: row.id,
  };
}

export function serverReceivedCursorFromMessage(
  message: Pick<MessageV2, "id" | "serverReceivedAt" | "createdAt">,
): ServerReceivedMessageCursor {
  return {
    serverReceivedAt: message.serverReceivedAt || message.createdAt,
    messageId: message.id,
  };
}

export function compareCreatedAtDesc(
  a: Pick<MessageRow, "id" | "created_at">,
  b: Pick<MessageRow, "id" | "created_at">,
): number {
  if (a.created_at !== b.created_at) {
    return b.created_at - a.created_at;
  }
  return b.id.localeCompare(a.id);
}

export function isCreatedAtAfterCursor(
  value: CreatedAtMessageCursor,
  cursor: CreatedAtMessageCursor | null,
): boolean {
  if (!cursor) return true;
  return (
    value.createdAt > cursor.createdAt ||
    (value.createdAt === cursor.createdAt &&
      value.messageId > cursor.messageId)
  );
}

export function isCreatedAtBeforeCursor(
  value: CreatedAtMessageCursor,
  cursor: CreatedAtMessageCursor,
): boolean {
  return (
    value.createdAt < cursor.createdAt ||
    (value.createdAt === cursor.createdAt &&
      value.messageId < cursor.messageId)
  );
}
