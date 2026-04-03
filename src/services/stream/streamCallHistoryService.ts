/**
 * Stream Call History Service
 *
 * Read-side access for server-authored Stream call history documents stored at
 * `Users/{uid}/StreamCallHistory/{entryId}`.
 */

import { getAuthInstance, getFirestoreInstance } from "@/services/firebase";
import type {
  StreamCallHistoryEntry,
  StreamCallHistoryFilter,
} from "@/types/streamCallHistory";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
  where,
} from "firebase/firestore";

const getDb = () => getFirestoreInstance();
const getAuth = () => getAuthInstance();

const COLLECTION = "StreamCallHistory";

function getUserHistoryRef() {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return null;
  return { ref: collection(getDb(), "Users", uid, COLLECTION) };
}

export async function getStreamCallHistory(
  filter?: StreamCallHistoryFilter,
): Promise<StreamCallHistoryEntry[]> {
  const ctx = getUserHistoryRef();
  if (!ctx) return [];

  const maxResults = filter?.maxResults ?? 50;

  let q = query(ctx.ref, orderBy("createdAt", "desc"), limit(maxResults));

  if (filter?.filterType === "missed") {
    q = query(
      ctx.ref,
      where("result", "==", "missed"),
      orderBy("createdAt", "desc"),
      limit(maxResults),
    );
  } else if (filter?.filterType === "direct") {
    q = query(
      ctx.ref,
      where("entryType", "in", ["direct_audio", "direct_video"]),
      orderBy("createdAt", "desc"),
      limit(maxResults),
    );
  } else if (filter?.filterType === "rooms") {
    q = query(
      ctx.ref,
      where("entryType", "==", "voice_room"),
      orderBy("createdAt", "desc"),
      limit(maxResults),
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => docSnap.data() as StreamCallHistoryEntry);
}

export function subscribeToStreamCallHistory(
  onUpdate: (entries: StreamCallHistoryEntry[]) => void,
  maxResults = 50,
  onError?: (err: Error) => void,
): Unsubscribe {
  const ctx = getUserHistoryRef();
  if (!ctx) {
    onUpdate([]);
    return () => {};
  }

  const q = query(ctx.ref, orderBy("createdAt", "desc"), limit(maxResults));

  return onSnapshot(
    q,
    (snapshot) => {
      const entries = snapshot.docs.map(
        (docSnap) => docSnap.data() as StreamCallHistoryEntry,
      );
      onUpdate(entries);
    },
    (err) => {
      console.error("[StreamCallHistory] Subscription error:", err);
      onError?.(err);
    },
  );
}
