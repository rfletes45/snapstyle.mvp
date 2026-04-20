/**
 * usePendingFriendRequestCount Hook
 *
 * Lightweight real-time count of incoming pending friend requests.
 * Uses a Firestore onSnapshot listener on the FriendRequests collection
 * but only tracks document count — no profile fetching overhead.
 *
 * Intended for tab badge indicators and other UI that only needs a count.
 *
 * @module hooks/usePendingFriendRequestCount
 */

import { getFirestoreInstance } from "@/services/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";

export function usePendingFriendRequestCount(uid: string | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!uid) {
      setCount(0);
      return;
    }

    const db = getFirestoreInstance();
    const q = query(
      collection(db, "FriendRequests"),
      where("to", "==", uid),
      where("status", "==", "pending"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => setCount(snapshot.size),
      () => setCount(0),
    );

    return unsubscribe;
  }, [uid]);

  return count;
}
