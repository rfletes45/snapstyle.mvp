/**
 * Message Edit/Delete Service (H7)
 *
 * Client-side service for editing and deleting messages.
 * Calls server-side Cloud Functions for validation.
 *
 * @module services/messageActions
 */

import { MessageV2, canEdit, isDeletedForAll } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAppInstance, getFirestoreInstance } from "./firebase";

// Lazy initialization - don't call at module load time
const getDb = () => getFirestoreInstance();

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
 * Check if message can be deleted for all.
 * Uses the new capability-based permission system when permissionsConfig is available.
 * Falls back to role-based check for backward compatibility.
 */
export function canDeleteForAll(
  message: MessageV2,
  currentUid: string,
  userRole?: "owner" | "admin" | "moderator" | "member",
  permissionsConfig?:
    | import("@/permissions/groupPermissions").GroupPermissionsConfig
    | null,
  messageSenderRole?: import("@/types/models").GroupRole | null,
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

    // For groups, check deleteOwnMessages permission
    if (message.scope === "group") {
      // Use new permission system
      const {
        hasPermission,
        GroupPermission,
      } = require("@/permissions/groupPermissions");
      const mappedRole = userRole === "moderator" ? "admin" : userRole;
      if (
        hasPermission(
          mappedRole,
          GroupPermission.DELETE_OWN_MESSAGES,
          permissionsConfig,
        )
      ) {
        return { canDelete: true };
      }
    }

    return { canDelete: false, reason: "Delete window has expired" };
  }

  // Group admins/mods can delete any message — use new permission system
  if (message.scope === "group") {
    const {
      hasPermissionOverTarget,
      GroupPermission,
    } = require("@/permissions/groupPermissions");
    const mappedActorRole = userRole === "moderator" ? "admin" : userRole;
    const mappedTargetRole = messageSenderRole ?? "member"; // Fallback for unknown senders

    if (
      hasPermissionOverTarget(
        mappedActorRole,
        mappedTargetRole,
        GroupPermission.DELETE_ANY_MESSAGE,
        permissionsConfig,
      )
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
