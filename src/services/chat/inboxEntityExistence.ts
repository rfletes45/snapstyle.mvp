import { getFirestoreInstance } from "@/services/firebase";
import type { InboxConversation } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import {
  collection,
  documentId,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

const log = createLogger("inboxEntityExistence");
const FIRESTORE_IN_LIMIT = 30;

type EntityKind = "users" | "chats" | "groups";
type EntityData = Record<string, unknown> | null;

function chunkIds(ids: string[]): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += FIRESTORE_IN_LIMIT) {
    chunks.push(ids.slice(index, index + FIRESTORE_IN_LIMIT));
  }
  return chunks;
}

function getConversationKey(conversation: InboxConversation): string {
  return `${conversation.type}:${conversation.id}`;
}

function unionChunkDocs(
  chunkResults: Map<string, Map<string, EntityData>>,
  kind: EntityKind,
): Map<string, EntityData> {
  const found = new Map<string, EntityData>();
  for (const [chunkKey, docs] of chunkResults) {
    if (!chunkKey.startsWith(`${kind}:`)) continue;
    for (const [id, data] of docs) found.set(id, data);
  }
  return found;
}

function includesMember(
  data: EntityData | undefined,
  fieldName: "members" | "memberIds",
  uid: string,
): boolean {
  if (!data) return true;
  const value = data[fieldName];
  if (!Array.isArray(value)) return true;
  return value.includes(uid);
}

export function subscribeToMissingInboxEntities(
  currentUserId: string,
  conversations: InboxConversation[],
  onChange: (missingConversationKeys: Set<string>) => void,
): () => void {
  const dmUserIds = Array.from(
    new Set(
      conversations
        .filter((conversation) => conversation.type === "dm")
        .map((conversation) => conversation.otherUserId)
        .filter((userId): userId is string => !!userId),
    ),
  );
  const dmChatIds = Array.from(
    new Set(
      conversations
        .filter((conversation) => conversation.type === "dm")
        .map((conversation) => conversation.id),
    ),
  );
  const groupIds = Array.from(
    new Set(
      conversations
        .filter((conversation) => conversation.type === "group")
        .map((conversation) => conversation.id),
    ),
  );

  if (
    dmUserIds.length === 0 &&
    dmChatIds.length === 0 &&
    groupIds.length === 0
  ) {
    onChange(new Set());
    return () => {};
  }

  const db = getFirestoreInstance();
  const chunkResults = new Map<string, Map<string, EntityData>>();
  const deliveredChunks = new Set<string>();
  const chunkKeys: string[] = [];
  const unsubscribers: (() => void)[] = [];
  let disposed = false;

  const recompute = () => {
    if (disposed || deliveredChunks.size < chunkKeys.length) return;

    const foundUsers = unionChunkDocs(chunkResults, "users");
    const foundChats = unionChunkDocs(chunkResults, "chats");
    const foundGroups = unionChunkDocs(chunkResults, "groups");
    const missing = new Set<string>();

    for (const conversation of conversations) {
      if (conversation.type === "dm") {
        const otherUserId = conversation.otherUserId;
        const chatData = foundChats.get(conversation.id);
        const userExists = otherUserId ? foundUsers.has(otherUserId) : false;
        const chatExists = foundChats.has(conversation.id);
        const currentUserStillMember = includesMember(
          chatData,
          "members",
          currentUserId,
        );
        const otherUserStillMember = otherUserId
          ? includesMember(chatData, "members", otherUserId)
          : false;

        if (
          !userExists ||
          !chatExists ||
          !currentUserStillMember ||
          !otherUserStillMember
        ) {
          missing.add(getConversationKey(conversation));
        }
        continue;
      }

      const groupData = foundGroups.get(conversation.id);
      if (
        !foundGroups.has(conversation.id) ||
        !includesMember(groupData, "memberIds", currentUserId)
      ) {
        missing.add(getConversationKey(conversation));
      }
    }

    onChange(missing);
  };

  const subscribeChunks = (
    kind: EntityKind,
    collectionName: "Users" | "Chats" | "Groups",
    ids: string[],
  ) => {
    chunkIds(ids).forEach((chunk, index) => {
      const chunkKey = `${kind}:${index}`;
      chunkKeys.push(chunkKey);

      const unsubscribe = onSnapshot(
        query(collection(db, collectionName), where(documentId(), "in", chunk)),
        (snapshot) => {
          const docs = new Map<string, EntityData>();
          snapshot.docs.forEach((docSnap) => {
            docs.set(docSnap.id, docSnap.data() as EntityData);
          });
          chunkResults.set(chunkKey, docs);
          deliveredChunks.add(chunkKey);
          recompute();
        },
        (error) => {
          log.warn("entity existence listener failed", {
            data: { kind, count: chunk.length, error },
          });
          chunkResults.set(chunkKey, new Map(chunk.map((id) => [id, null])));
          deliveredChunks.add(chunkKey);
          recompute();
        },
      );

      unsubscribers.push(unsubscribe);
    });
  };

  subscribeChunks("users", "Users", dmUserIds);
  subscribeChunks("chats", "Chats", dmChatIds);
  subscribeChunks("groups", "Groups", groupIds);

  return () => {
    disposed = true;
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}
