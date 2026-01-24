/**
 * Message Edit/Delete Service (H7)
 *
 * Client-side service for editing and deleting messages.
 * Calls server-side Cloud Functions for validation.
 *
 * @module services/messageActions
 */

import { getFunctions, httpsCallable } from "firebase/functions";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { getFirestoreInstance, getAppInstance } from "./firebase";

// Lazy initialization - don't call at module load time
const getDb = () => getFirestoreInstance();
import {
  MessageV2,
  EDIT_WINDOW_MS,
  canEdit,
  isDeletedForAll,
} from "@/types/messaging";
import { createLogger } from "@/utils/log";

const log = createLogger("messageActions");

// =============================================================================
// Types
// =============================================================================

interface EditMessageParams {
  scope: "dm" | "group";
  conversationId: string;
  messageId: string;
  newText: string;
}

interface DeleteMessageParams {
  scope: "dm" | "group";
  conversationId: string;
  messageId: string;
}

interface ActionResponse {
  success: boolean;
  error?: string;
  editedAt?: number;
  deletedAt?: number;
}

// =============================================================================
// Cloud Function Setup
// =============================================================================

let functionsInstance: ReturnType<typeof getFunctions> | null = null;

function getFunctionsInstance() {
  if (!functionsInstance) {
    const app = getAppInstance();
    functionsInstance = getFunctions(app);
  }
  return functionsInstance;
}

// =============================================================================
// Edit Message
// =============================================================================

/**
 * Edit a message (own messages only, within edit window)
 *
 * @param params - Edit parameters
 * @returns Success status with editedAt timestamp
 *
 * Rules:
 * - Can only edit own messages
 * - Must be within EDIT_WINDOW_MS (15 minutes)
 * - Cannot edit deleted messages
 * - Text kind only (no attachment edits)
 */
export async function editMessage(
  params: EditMessageParams,
): Promise<ActionResponse> {
  log.info("Editing message", {
    operation: "editMessage",
    data: {
      scope: params.scope,
      conversationId: params.conversationId,
      messageId: params.messageId,
    },
  });

  try {
    const callable = httpsCallable<
      EditMessageParams,
      { success: boolean; editedAt?: number; error?: string }
    >(getFunctionsInstance(), "editMessageV2");
    const result = await callable(params);

    if (result.data.success) {
      log.info("Message edited successfully", {
        operation: "editMessage",
        data: { messageId: params.messageId, editedAt: result.data.editedAt },
      });
      return { success: true, editedAt: result.data.editedAt };
    } else {
      log.warn("Edit failed", {
        operation: "editMessage",
        data: { error: result.data.error },
      });
      return { success: false, error: result.data.error || "Edit failed" };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("editMessage error", error);
    return { success: false, error: errorMessage };
  }
}

// =============================================================================
// Delete Message For All
// =============================================================================

/**
 * Delete a message for all participants
 *
 * @param params - Delete parameters
 * @returns Success status with deletedAt timestamp
 *
 * Rules:
 * - Sender can delete within edit window
 * - Group admins/mods can delete any message
 * - Sets deletedForAll = true, clears text/attachments
 */
export async function deleteMessageForAll(
  params: DeleteMessageParams,
): Promise<ActionResponse> {
  log.info("Deleting message for all", {
    operation: "deleteMessageForAll",
    data: {
      scope: params.scope,
      conversationId: params.conversationId,
      messageId: params.messageId,
    },
  });

  try {
    const callable = httpsCallable<
      DeleteMessageParams,
      { success: boolean; deletedAt?: number; error?: string }
    >(getFunctionsInstance(), "deleteMessageForAllV2");
    const result = await callable(params);

    if (result.data.success) {
      log.info("Message deleted for all successfully", {
        operation: "deleteMessageForAll",
        data: { messageId: params.messageId, deletedAt: result.data.deletedAt },
      });
      return { success: true, deletedAt: result.data.deletedAt };
    } else {
      log.warn("Delete for all failed", {
        operation: "deleteMessageForAll",
        data: { error: result.data.error },
      });
      return { success: false, error: result.data.error || "Delete failed" };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("deleteMessageForAll error", error);
    return { success: false, error: errorMessage };
  }
}

// =============================================================================
// Delete Message For Me
// =============================================================================

/**
 * Delete a message for self only (hide from own view)
 *
 * @param params - Delete parameters
 * @param currentUid - Current user's ID
 * @returns Success status
 *
 * This is a client-side operation:
 * - Adds uid to hiddenFor array
 * - Message still visible to others
 */
export async function deleteMessageForMe(
  params: DeleteMessageParams,
  currentUid: string,
): Promise<ActionResponse> {
  log.info("Deleting message for me", {
    operation: "deleteMessageForMe",
    data: {
      scope: params.scope,
      conversationId: params.conversationId,
      messageId: params.messageId,
    },
  });

  try {
    // This can be done client-side since user can only modify their own entry in hiddenFor
    const collectionPath = params.scope === "dm" ? "Chats" : "Groups";
    const messageRef = doc(
      getDb(),
      collectionPath,
      params.conversationId,
      "Messages",
      params.messageId,
    );

    await updateDoc(messageRef, {
      hiddenFor: arrayUnion(currentUid),
    });

    log.info("Message hidden from view successfully", {
      operation: "deleteMessageForMe",
      data: { messageId: params.messageId },
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("deleteMessageForMe failed", error);
    return { success: false, error: errorMessage };
  }
}

// =============================================================================
// Client-side Validation Helpers
// =============================================================================

/**
 * Check if message can be edited (client-side validation)
 */
export function canEditMessage(
  message: MessageV2,
  currentUid: string,
): { canEdit: boolean; reason?: string } {
  // Must be sender
  if (message.senderId !== currentUid) {
    return { canEdit: false, reason: "Can only edit your own messages" };
  }

  // Cannot edit deleted messages
  if (isDeletedForAll(message)) {
    return { canEdit: false, reason: "Message has been deleted" };
  }

  // Must be text message
  if (message.kind !== "text") {
    return { canEdit: false, reason: "Can only edit text messages" };
  }

  // Check edit window
  if (!canEdit(message, currentUid)) {
    return { canEdit: false, reason: "Edit window has expired (15 minutes)" };
  }

  return { canEdit: true };
}

/**
 * Check if message can be deleted for all
 */
export function canDeleteForAll(
  message: MessageV2,
  currentUid: string,
  userRole?: "owner" | "admin" | "moderator" | "member",
): { canDelete: boolean; reason?: string } {
  // Already deleted
  if (isDeletedForAll(message)) {
    return { canDelete: false, reason: "Message already deleted" };
  }

  // Sender can delete within window
  if (message.senderId === currentUid) {
    if (canEdit(message, currentUid)) {
      return { canDelete: true };
    }

    // For groups, check if admin
    if (
      message.scope === "group" &&
      (userRole === "owner" || userRole === "admin" || userRole === "moderator")
    ) {
      return { canDelete: true };
    }

    return { canDelete: false, reason: "Delete window has expired" };
  }

  // Group admins/mods can delete any message
  if (message.scope === "group") {
    if (
      userRole === "owner" ||
      userRole === "admin" ||
      userRole === "moderator"
    ) {
      return { canDelete: true };
    }
  }

  return { canDelete: false, reason: "Cannot delete others' messages" };
}

/**
 * Check if message can be deleted for self
 */
export function canDeleteForMe(
  message: MessageV2,
  currentUid: string,
): { canDelete: boolean; reason?: string } {
  // Already hidden from this user
  if (message.hiddenFor?.includes(currentUid)) {
    return { canDelete: false, reason: "Already hidden from your view" };
  }

  // Can always delete for self
  return { canDelete: true };
}

// =============================================================================
// Edit History (Stub)
// =============================================================================

/**
 * Get edit history for a message
 *
 * @param scope - "dm" or "group"
 * @param conversationId - Chat/Group ID
 * @param messageId - Message ID
 *
 * TODO: Implement in H7 (requires storing edit history)
 */
export async function getEditHistory(
  scope: "dm" | "group",
  conversationId: string,
  messageId: string,
): Promise<Array<{ text: string; editedAt: number; editedBy: string }>> {
  log.warn("getEditHistory: Not yet implemented (H7)");

  // TODO: Implement edit history subcollection or field
  return [];
}
