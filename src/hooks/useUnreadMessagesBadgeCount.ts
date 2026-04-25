import { getFirestoreInstance } from "@/services/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

function countUnreadInboxDocs(snapshotDocs: Array<{ data: () => any }>): number {
  return snapshotDocs.reduce((total, docSnap) => {
    const data = docSnap.data();
    const archived = !!data.archived;
    const hidden = !!(data.deletedAt && data.hiddenUntilNewMessage);
    if (archived || hidden) return total;

    const unreadCount =
      typeof data.unreadCount === "number" && data.unreadCount > 0
        ? data.unreadCount
        : 0;
    const manuallyUnread = !!data.lastMarkedUnreadAt;
    return total + Math.max(unreadCount, manuallyUnread ? 1 : 0);
  }, 0);
}

/**
 * Lightweight unread-message count for navigation badges.
 *
 * This intentionally reads only the server-managed Inbox docs instead of
 * mounting the full Messages data hook in the tab navigator.
 */
export function useUnreadMessagesBadgeCount(uid: string | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!uid) {
      setCount(0);
      return;
    }

    const db = getFirestoreInstance();
    const inboxRef = collection(db, "Users", uid, "Inbox");
    const unsubscribe = onSnapshot(
      inboxRef,
      (snapshot) => setCount(countUnreadInboxDocs(snapshot.docs)),
      () => setCount(0),
    );

    return unsubscribe;
  }, [uid]);

  return count;
}

