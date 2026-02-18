/**
 * useMessageRequests Hook (Segment 5)
 *
 * Subscribes to the current user's MessageRequests subcollection and
 * provides helpers to accept / decline requests.
 *
 * Activated only when `CHAT_FEATURES.CHAT_MESSAGE_REQUESTS` is true.
 * When the flag is off, returns an empty list and no-op actions.
 *
 * @module hooks/useMessageRequests
 */

import { CHAT_FEATURES } from "@/constants/featureFlags";
import { getFirestoreInstance } from "@/services/firebase";
import {
  decodeMessageRequest,
  isMessageRequestResponse,
  MessageRequest,
} from "@/types/messaging";
import { createLogger } from "@/utils/log";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useCallback, useEffect, useMemo, useState } from "react";

const log = createLogger("useMessageRequests");

// =============================================================================
// Types
// =============================================================================

export interface UseMessageRequestsResult {
  /** Pending message requests */
  requests: MessageRequest[];
  /** Total pending count (badge number) */
  pendingCount: number;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Accept a request */
  accept: (chatId: string) => Promise<void>;
  /** Decline a request (optionally block) */
  decline: (chatId: string, blockRequester?: boolean) => Promise<void>;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Subscribe to pending message requests for the current user.
 *
 * @param uid Current user ID
 */
export function useMessageRequests(uid: string): UseMessageRequestsResult {
  const [requests, setRequests] = useState<MessageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const enabled = CHAT_FEATURES.CHAT_MESSAGE_REQUESTS;

  // Subscribe to Users/{uid}/MessageRequests where status == "pending"
  useEffect(() => {
    if (!uid || !enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const db = getFirestoreInstance();
    const reqRef = collection(db, "Users", uid, "MessageRequests");
    const q = query(
      reqRef,
      where("status", "==", "pending"),
      orderBy("createdAt", "desc"),
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        try {
          const items: MessageRequest[] = snapshot.docs
            .map((docSnap) => decodeMessageRequest(docSnap.data(), docSnap.id))
            .filter((item): item is MessageRequest => item !== null);
          setRequests(items);
          setError(null);
        } catch (e) {
          log.error("Error processing message requests", {
            data: { error: e },
          });
          setError(e instanceof Error ? e : new Error(String(e)));
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        log.error("Message requests snapshot error", { data: { error: err } });
        setError(err);
        setLoading(false);
      },
    );

    return unsub;
  }, [uid, enabled]);

  // Memoised pending count
  const pendingCount = useMemo(() => requests.length, [requests]);

  // Accept callable
  const accept = useCallback(async (chatId: string) => {
    try {
      const fns = getFunctions();
      const callable = httpsCallable(fns, "acceptMessageRequest");
      const response = await callable({ chatId });
      if (!isMessageRequestResponse(response.data) || !response.data.success) {
        throw new Error("acceptMessageRequest returned an invalid response");
      }
      log.info("Accepted message request", { data: { chatId } });
    } catch (e) {
      log.error("Failed to accept message request", { data: { error: e } });
      throw e;
    }
  }, []);

  // Decline callable
  const decline = useCallback(
    async (chatId: string, blockRequester = false) => {
      try {
        const fns = getFunctions();
        const callable = httpsCallable(fns, "declineMessageRequest");
        const response = await callable({ chatId, blockRequester });
        if (!isMessageRequestResponse(response.data) || !response.data.success) {
          throw new Error("declineMessageRequest returned an invalid response");
        }
        log.info("Declined message request", {
          data: { chatId, blockRequester },
        });
      } catch (e) {
        log.error("Failed to decline message request", { data: { error: e } });
        throw e;
      }
    },
    [],
  );

  return {
    requests,
    pendingCount,
    loading,
    error,
    accept,
    decline,
  };
}
