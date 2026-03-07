import { getFunctions, httpsCallable } from "firebase/functions";
import { getAppInstance } from "@/services/firebase";
import { createLogger } from "@/utils/log";

const log = createLogger("services/chat/inboxAggregation");

interface MarkInboxReadResponse {
  success: boolean;
}

/**
 * Marks the aggregated inbox entry as read for the current user.
 * This keeps Users/{uid}/Inbox unreadCount aligned with member watermark reads.
 */
export async function markAggregatedInboxRead(
  scope: "dm" | "group",
  conversationId: string,
): Promise<void> {
  const app = getAppInstance();
  const functions = getFunctions(app);
  const callable = httpsCallable<{ threadId: string }, MarkInboxReadResponse>(
    functions,
    "markInboxRead",
  );

  const threadId = `${scope}:${conversationId}`;
  try {
    await callable({ threadId });
  } catch (error) {
    log.warn("Failed to mark aggregated inbox read", {
      data: { scope, conversationId, threadId, error },
    });
  }
}

