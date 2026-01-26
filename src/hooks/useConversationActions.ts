/**
 * useConversationActions Hook
 *
 * Provides action handlers for inbox conversation items:
 * - Pin/Unpin
 * - Archive/Unarchive
 * - Mute/Unmute
 * - Delete (soft delete)
 * - Mark as Read/Unread
 *
 * All actions include optimistic updates, error handling,
 * and user feedback via snackbar.
 *
 * @module hooks/useConversationActions
 */

import { useSnackbar } from "@/store/SnackbarContext";
import { InboxConversation } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { useCallback, useState } from "react";

// DM services
import {
  markDMAsRead,
  markAsUnread as markDMAsUnread,
  setArchived as setDMArchived,
  setMuted as setDMMuted,
  setDMPinned,
  softDeleteDM,
} from "@/services/chatMembers";

// Group services
import {
  leaveAndDeleteGroup,
  markGroupAsRead,
  markGroupAsUnread,
  setGroupArchived,
  setGroupMuted,
  setGroupPinned,
} from "@/services/groupMembers";

// Settings service
import { getInboxSettings } from "@/services/inboxSettings";

const log = createLogger("useConversationActions");

// =============================================================================
// Types
// =============================================================================

/** Mute duration options */
export type MuteDuration = "1hour" | "8hours" | "1day" | "1week" | "forever";

/** Options for useConversationActions hook */
export interface UseConversationActionsOptions {
  /** Callback fired after any action completes (success or failure) */
  onActionComplete?: () => void;
}

/** Return type for useConversationActions hook */
export interface UseConversationActionsResult {
  /** Pin or unpin a conversation */
  togglePin: (conversation: InboxConversation) => Promise<void>;

  /** Archive or unarchive a conversation */
  toggleArchive: (conversation: InboxConversation) => Promise<void>;

  /** Mute a conversation for a duration */
  mute: (
    conversation: InboxConversation,
    duration: MuteDuration,
  ) => Promise<void>;

  /** Unmute a conversation */
  unmute: (conversation: InboxConversation) => Promise<void>;

  /** Delete (soft delete) a conversation */
  deleteConversation: (conversation: InboxConversation) => Promise<void>;

  /** Mark a conversation as unread */
  markUnread: (conversation: InboxConversation) => Promise<void>;

  /** Mark a conversation as read */
  markRead: (conversation: InboxConversation) => Promise<void>;

  /** Whether an action is currently in progress */
  loading: boolean;

  /** The current action being performed (for UI feedback) */
  currentAction: string | null;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Calculate mute until timestamp from duration
 */
function getMuteUntil(duration: MuteDuration): number | null {
  const now = Date.now();

  switch (duration) {
    case "1hour":
      return now + 60 * 60 * 1000;
    case "8hours":
      return now + 8 * 60 * 60 * 1000;
    case "1day":
      return now + 24 * 60 * 60 * 1000;
    case "1week":
      return now + 7 * 24 * 60 * 60 * 1000;
    case "forever":
      return -1; // Special value for "muted forever"
    default:
      return null;
  }
}

/**
 * Format mute duration for display
 */
function formatMuteDuration(duration: MuteDuration): string {
  switch (duration) {
    case "1hour":
      return "1 hour";
    case "8hours":
      return "8 hours";
    case "1day":
      return "1 day";
    case "1week":
      return "1 week";
    case "forever":
      return "forever";
    default:
      return "";
  }
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Conversation actions hook
 *
 * Provides all the action handlers needed for inbox conversation items.
 * Handles both DM and Group conversations with appropriate service calls.
 *
 * @param uid - Current user's ID
 * @param options - Optional configuration including onActionComplete callback
 * @returns Action handlers and loading state
 */
export function useConversationActions(
  uid: string,
  options?: UseConversationActionsOptions,
): UseConversationActionsResult {
  const [loading, setLoading] = useState(false);
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const { showSuccess, showError, showInfo } = useSnackbar();
  const onActionComplete = options?.onActionComplete;

  // =============================================================================
  // Pin/Unpin
  // =============================================================================

  const togglePin = useCallback(
    async (conversation: InboxConversation) => {
      if (!uid) return;

      const isPinned = !!conversation.memberState.pinnedAt;
      const action = isPinned ? "Unpinning" : "Pinning";

      try {
        setLoading(true);
        setCurrentAction(action);

        // Check max pinned limit before pinning
        if (!isPinned) {
          const settings = await getInboxSettings(uid);
          // Note: We'd need to count current pinned here
          // For now, we'll let the UI handle this validation
        }

        if (conversation.type === "dm") {
          await setDMPinned(conversation.id, uid, !isPinned);
        } else {
          await setGroupPinned(conversation.id, uid, !isPinned);
        }

        showSuccess(isPinned ? "Conversation unpinned" : "Conversation pinned");
        log.info(`${action} conversation`, {
          operation: action.toLowerCase(),
          data: { conversationId: conversation.id, type: conversation.type },
        });
      } catch (error) {
        log.error(`Failed to ${action.toLowerCase()} conversation`, { error });
        showError(`Failed to ${action.toLowerCase()} conversation`);
        throw error;
      } finally {
        setLoading(false);
        setCurrentAction(null);
        onActionComplete?.();
      }
    },
    [uid, showSuccess, showError, onActionComplete],
  );

  // =============================================================================
  // Archive/Unarchive
  // =============================================================================

  const toggleArchive = useCallback(
    async (conversation: InboxConversation) => {
      if (!uid) return;

      const isArchived = conversation.memberState.archived;
      const action = isArchived ? "Unarchiving" : "Archiving";

      try {
        setLoading(true);
        setCurrentAction(action);

        if (conversation.type === "dm") {
          await setDMArchived(conversation.id, uid, !isArchived);
        } else {
          await setGroupArchived(conversation.id, uid, !isArchived);
        }

        showSuccess(
          isArchived ? "Conversation unarchived" : "Conversation archived",
        );
        log.info(`${action} conversation`, {
          operation: action.toLowerCase(),
          data: { conversationId: conversation.id, type: conversation.type },
        });
      } catch (error) {
        log.error(`Failed to ${action.toLowerCase()} conversation`, { error });
        showError(`Failed to ${action.toLowerCase()} conversation`);
        throw error;
      } finally {
        setLoading(false);
        setCurrentAction(null);
        onActionComplete?.();
      }
    },
    [uid, showSuccess, showError, onActionComplete],
  );

  // =============================================================================
  // Mute/Unmute
  // =============================================================================

  const mute = useCallback(
    async (conversation: InboxConversation, duration: MuteDuration) => {
      if (!uid) return;

      try {
        setLoading(true);
        setCurrentAction("Muting");

        const muteUntil = getMuteUntil(duration);

        if (conversation.type === "dm") {
          await setDMMuted(conversation.id, uid, muteUntil);
        } else {
          await setGroupMuted(
            conversation.id,
            uid,
            true,
            muteUntil === -1 ? undefined : (muteUntil ?? undefined),
          );
        }

        const durationText = formatMuteDuration(duration);
        showSuccess(`Muted for ${durationText}`);
        log.info("Muted conversation", {
          operation: "mute",
          data: {
            conversationId: conversation.id,
            type: conversation.type,
            duration,
          },
        });
      } catch (error) {
        log.error("Failed to mute conversation", { error });
        showError("Failed to mute conversation");
        throw error;
      } finally {
        setLoading(false);
        setCurrentAction(null);
        onActionComplete?.();
      }
    },
    [uid, showSuccess, showError, onActionComplete],
  );

  const unmute = useCallback(
    async (conversation: InboxConversation) => {
      if (!uid) return;

      try {
        setLoading(true);
        setCurrentAction("Unmuting");

        if (conversation.type === "dm") {
          await setDMMuted(conversation.id, uid, null);
        } else {
          await setGroupMuted(conversation.id, uid, false);
        }

        showSuccess("Conversation unmuted");
        log.info("Unmuted conversation", {
          operation: "unmute",
          data: { conversationId: conversation.id, type: conversation.type },
        });
      } catch (error) {
        log.error("Failed to unmute conversation", { error });
        showError("Failed to unmute conversation");
        throw error;
      } finally {
        setLoading(false);
        setCurrentAction(null);
        onActionComplete?.();
      }
    },
    [uid, showSuccess, showError, onActionComplete],
  );

  // =============================================================================
  // Delete (Soft Delete)
  // =============================================================================

  const deleteConversation = useCallback(
    async (conversation: InboxConversation) => {
      if (!uid) return;

      try {
        setLoading(true);
        setCurrentAction("Deleting");

        if (conversation.type === "dm") {
          await softDeleteDM(conversation.id, uid);
          showSuccess("Conversation deleted");
        } else {
          await leaveAndDeleteGroup(conversation.id, uid);
          showSuccess("Left and deleted group");
        }

        log.info("Deleted conversation", {
          operation: "delete",
          data: { conversationId: conversation.id, type: conversation.type },
        });
      } catch (error: any) {
        log.error("Failed to delete conversation", { error });

        // Handle specific error for group owners
        if (error.message?.includes("transfer ownership")) {
          showError("You must transfer ownership before leaving");
        } else {
          showError("Failed to delete conversation");
        }
        throw error;
      } finally {
        setLoading(false);
        setCurrentAction(null);
        onActionComplete?.();
      }
    },
    [uid, showSuccess, showError, onActionComplete],
  );

  // =============================================================================
  // Mark as Read/Unread
  // =============================================================================

  const markUnread = useCallback(
    async (conversation: InboxConversation) => {
      if (!uid) return;

      try {
        setLoading(true);
        setCurrentAction("Marking unread");

        if (conversation.type === "dm") {
          await markDMAsUnread(conversation.id, uid);
        } else {
          await markGroupAsUnread(conversation.id, uid);
        }

        showInfo("Marked as unread");
        log.info("Marked conversation as unread", {
          operation: "markUnread",
          data: { conversationId: conversation.id, type: conversation.type },
        });
      } catch (error) {
        log.error("Failed to mark as unread", { error });
        showError("Failed to mark as unread");
        throw error;
      } finally {
        setLoading(false);
        setCurrentAction(null);
        onActionComplete?.();
      }
    },
    [uid, showInfo, showError, onActionComplete],
  );

  const markRead = useCallback(
    async (conversation: InboxConversation) => {
      if (!uid) return;

      try {
        setLoading(true);
        setCurrentAction("Marking read");

        if (conversation.type === "dm") {
          await markDMAsRead(conversation.id, uid);
        } else {
          await markGroupAsRead(conversation.id, uid);
        }

        log.debug("[Actions] Marked conversation read", {
          data: { conversationId: conversation.id, type: conversation.type },
        });
      } catch (error) {
        log.error("Failed to mark as read", { error });
        // Don't show snackbar for read - it's a background operation
      } finally {
        setLoading(false);
        setCurrentAction(null);
        // NOTE: Don't call onActionComplete here - marking as read is handled
        // optimistically in the UI. Calling refresh would cause a re-subscription
        // that could temporarily show stale data before Firestore syncs.
      }
    },
    [uid],
  );

  return {
    togglePin,
    toggleArchive,
    mute,
    unmute,
    deleteConversation,
    markUnread,
    markRead,
    loading,
    currentAction,
  };
}
