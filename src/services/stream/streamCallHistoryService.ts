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
import { createLogger } from "@/utils/log";
import {
  collection,
  doc,
  getDoc,
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
const logger = createLogger("services/streamCallHistory");

const COLLECTION = "StreamCallHistory";
const RETRY_DELAYS_MS = [500, 1000, 2000];

function isPermissionDelayError(error: unknown): boolean {
  const code = (error as { code?: string } | undefined)?.code ?? "";
  return (
    code === "permission-denied" ||
    String(error).includes("Missing or insufficient permissions")
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map(
        (docSnap) => docSnap.data() as StreamCallHistoryEntry,
      );
    } catch (error) {
      if (
        !isPermissionDelayError(error) ||
        attempt === RETRY_DELAYS_MS.length
      ) {
        throw error;
      }

      const delayMs = RETRY_DELAYS_MS[attempt];
      logger.warn(
        `[StreamCallHistory] getDocs permission delay, retrying in ${delayMs}ms`,
        {
          data: {
            attempt: attempt + 1,
            filterType: filter?.filterType ?? "all",
          },
        },
      );
      await delay(delayMs);
    }
  }

  return [];
}

export async function getStreamCallHistoryEntryById(
  entryId: string,
): Promise<StreamCallHistoryEntry | null> {
  try {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return null;
    const ref = doc(getDb(), "Users", uid, COLLECTION, entryId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as StreamCallHistoryEntry;
  } catch (err) {
    logger.warn("[StreamCallHistory] getEntryById failed", { data: { err } });
    return null;
  }
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

  let cancelled = false;
  let currentUnsubscribe: Unsubscribe | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const attach = () => {
    if (cancelled) return;

    currentUnsubscribe = onSnapshot(
      q,
      (snapshot) => {
        attempt = 0;
        const entries = snapshot.docs.map(
          (docSnap) => docSnap.data() as StreamCallHistoryEntry,
        );
        onUpdate(entries);
      },
      (err) => {
        console.error("[StreamCallHistory] Subscription error:", err);

        if (isPermissionDelayError(err) && attempt < RETRY_DELAYS_MS.length) {
          const delayMs = RETRY_DELAYS_MS[attempt] ?? 2000;
          attempt += 1;
          currentUnsubscribe = null;
          logger.warn(
            `[StreamCallHistory] Subscription permission delay, retrying in ${delayMs}ms`,
            {
              data: {
                attempt,
                maxResults,
              },
            },
          );
          retryTimer = setTimeout(attach, delayMs);
          return;
        }

        onError?.(err);
      },
    );
  };

  attach();

  return () => {
    cancelled = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
    }
    currentUnsubscribe?.();
  };
}
