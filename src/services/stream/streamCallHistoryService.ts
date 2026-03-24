/**
 * Stream Call History Service
 *
 * Normalized call history for the Stream-based calling system.
 * Stores entries in Firestore at Users/{uid}/StreamCallHistory/{id}
 *
 * This replaces the legacy callHistoryService for Stream-based calls.
 */

import { getAuthInstance, getFirestoreInstance } from "@/services/firebase";
import type {
  CallDirection,
  CallResult,
  StreamCallHistoryEntry,
  StreamCallHistoryFilter,
} from "@/types/streamCallHistory";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";

const getDb = () => getFirestoreInstance();
const getAuth = () => getAuthInstance();

const COLLECTION = "StreamCallHistory";

function getUserHistoryRef() {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return null;
  return { ref: collection(getDb(), "Users", uid, COLLECTION), uid };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Record a call history entry for the current user.
 */
export async function recordCallHistory(
  entry: Omit<StreamCallHistoryEntry, "userId" | "createdAt">,
): Promise<void> {
  const ctx = getUserHistoryRef();
  if (!ctx) return;

  const full: StreamCallHistoryEntry = {
    ...entry,
    userId: ctx.uid,
    createdAt: Date.now(),
  };

  await setDoc(doc(ctx.ref, entry.id), full);
}

/**
 * Update an existing history entry (e.g. when a call finishes).
 */
export async function updateCallHistory(
  entryId: string,
  patch: Partial<
    Pick<
      StreamCallHistoryEntry,
      "result" | "endedAt" | "durationSeconds" | "participantCount"
    >
  >,
): Promise<void> {
  const ctx = getUserHistoryRef();
  if (!ctx) return;

  await setDoc(doc(ctx.ref, entryId), patch, { merge: true });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Fetch call history with optional filters.
 */
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
  return snapshot.docs.map((d) => d.data() as StreamCallHistoryEntry);
}

/**
 * Subscribe to real-time call history updates.
 */
export function subscribeToStreamCallHistory(
  onUpdate: (entries: StreamCallHistoryEntry[]) => void,
  maxResults = 50,
): Unsubscribe {
  const ctx = getUserHistoryRef();
  if (!ctx) return () => {};

  const q = query(ctx.ref, orderBy("createdAt", "desc"), limit(maxResults));

  return onSnapshot(
    q,
    (snapshot) => {
      const entries = snapshot.docs.map(
        (d) => d.data() as StreamCallHistoryEntry,
      );
      onUpdate(entries);
    },
    () => {
      // Swallow subscription errors
    },
  );
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteCallHistoryEntry(entryId: string): Promise<void> {
  const ctx = getUserHistoryRef();
  if (!ctx) return;
  await deleteDoc(doc(ctx.ref, entryId));
}

export async function clearAllStreamCallHistory(): Promise<void> {
  const ctx = getUserHistoryRef();
  if (!ctx) return;

  const snapshot = await getDocs(ctx.ref);
  const batch = writeBatch(getDb());
  snapshot.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Build helpers (used by StreamCallContext to create entries)
// ---------------------------------------------------------------------------

export function buildDirectCallEntry(params: {
  callId: string;
  mode: "audio" | "video";
  direction: CallDirection;
  result: CallResult;
  startedAt: number;
  endedAt: number | null;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar?: string | null;
  initiatedBy: string;
}): Omit<StreamCallHistoryEntry, "userId" | "createdAt"> {
  const duration =
    params.endedAt && params.startedAt
      ? Math.round((params.endedAt - params.startedAt) / 1000)
      : null;

  return {
    id: params.callId,
    callId: params.callId,
    entryType: params.mode === "video" ? "direct_video" : "direct_audio",
    direction: params.direction,
    result: params.result,
    startedAt: params.startedAt,
    endedAt: params.endedAt,
    durationSeconds: duration,
    otherUserId: params.otherUserId,
    otherUserName: params.otherUserName,
    otherUserAvatar: params.otherUserAvatar ?? null,
    groupId: null,
    groupName: null,
    groupAvatar: null,
    participantCount: null,
    initiatedBy: params.initiatedBy,
  };
}

export function buildVoiceRoomEntry(params: {
  callId: string;
  groupId: string;
  groupName: string;
  groupAvatar?: string | null;
  startedAt: number;
  endedAt: number | null;
  participantCount: number;
  initiatedBy: string;
  currentUserId: string;
}): Omit<StreamCallHistoryEntry, "userId" | "createdAt"> {
  const duration =
    params.endedAt && params.startedAt
      ? Math.round((params.endedAt - params.startedAt) / 1000)
      : null;

  return {
    id: `${params.callId}_${params.currentUserId}`,
    callId: params.callId,
    entryType: "voice_room",
    direction: "joined",
    result: params.endedAt ? "left" : "ongoing",
    startedAt: params.startedAt,
    endedAt: params.endedAt,
    durationSeconds: duration,
    otherUserId: null,
    otherUserName: null,
    otherUserAvatar: null,
    groupId: params.groupId,
    groupName: params.groupName,
    groupAvatar: params.groupAvatar ?? null,
    participantCount: params.participantCount,
    initiatedBy: params.initiatedBy,
  };
}
