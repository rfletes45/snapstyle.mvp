/**
 * Cold storage persistence for incremental game sessions.
 *
 * Stores serialized simulation snapshots in Firestore so that sessions
 * can survive server restarts and room disposal. Snapshots are keyed by
 * firestoreGameId (the GameInvite document id).
 *
 * Collection: ColyseusGameSnapshots/{firestoreGameId}
 */
import { getFirestoreDb } from "./firebase";
import { createServerLogger } from "../utils/logger";

const log = createServerLogger("coldStorage");

const COLLECTION = "ColyseusGameSnapshots";

export interface ColdStorageSnapshot {
  /** The game type key (e.g. "starforge_game"). */
  gameType: string;
  /** Serialized simulation state. */
  data: Record<string, unknown>;
  /** Unix timestamp (ms) when the snapshot was saved. */
  savedAt: number;
  /** The Colyseus room ID that last owned this session. */
  lastRoomId: string;
  /** Server tick at time of save. */
  tick: number;
}

/**
 * Save a simulation snapshot to Firestore.
 * Uses the firestoreGameId as the document key so that the same invite
 * always maps to the same snapshot.
 */
export async function saveSnapshot(
  firestoreGameId: string,
  gameType: string,
  roomId: string,
  data: Record<string, unknown>,
  tick: number,
): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) {
    log.warn("Firestore unavailable — snapshot not saved");
    return false;
  }

  try {
    const doc: ColdStorageSnapshot = {
      gameType,
      data,
      savedAt: Date.now(),
      lastRoomId: roomId,
      tick,
    };
    await db.collection(COLLECTION).doc(firestoreGameId).set(doc);
    log.info(
      `Snapshot saved for ${firestoreGameId} (type=${gameType}, tick=${tick})`,
    );
    return true;
  } catch (err) {
    log.error(`Failed to save snapshot for ${firestoreGameId}:`, err);
    return false;
  }
}

/**
 * Load a simulation snapshot from Firestore.
 * Returns null if no snapshot exists for the given firestoreGameId.
 */
export async function loadSnapshot(
  firestoreGameId: string,
): Promise<ColdStorageSnapshot | null> {
  const db = getFirestoreDb();
  if (!db) {
    log.warn("Firestore unavailable — no snapshot loaded");
    return null;
  }

  try {
    const docRef = db.collection(COLLECTION).doc(firestoreGameId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      log.debug(`No snapshot found for ${firestoreGameId}`);
      return null;
    }
    const snapshot = docSnap.data() as ColdStorageSnapshot;
    log.info(
      `Snapshot loaded for ${firestoreGameId} (tick=${snapshot.tick}, saved=${new Date(snapshot.savedAt).toISOString()})`,
    );
    return snapshot;
  } catch (err) {
    log.error(`Failed to load snapshot for ${firestoreGameId}:`, err);
    return null;
  }
}

/**
 * Delete a simulation snapshot from Firestore.
 * Called when a game session is explicitly ended/reset.
 */
export async function deleteSnapshot(
  firestoreGameId: string,
): Promise<boolean> {
  const db = getFirestoreDb();
  if (!db) {
    return false;
  }

  try {
    await db.collection(COLLECTION).doc(firestoreGameId).delete();
    log.info(`Snapshot deleted for ${firestoreGameId}`);
    return true;
  } catch (err) {
    log.error(`Failed to delete snapshot for ${firestoreGameId}:`, err);
    return false;
  }
}
