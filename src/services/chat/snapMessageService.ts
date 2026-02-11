/**
 * CHAT SYSTEM - PICTURE MESSAGE SERVICE
 * Integration of pictures into the chat system
 * Allows sending pictures as direct messages
 *
 * Uses Firebase Web SDK v12 modular API
 */

import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  limit as firestoreLimit,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { Picture } from "@/types/camera";
import { getFirestoreInstance } from "@/services/firebase";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/chat/snapMessageService");
/**
 * Picture message type in chat
 */
export interface PictureMessage {
  id: string;
  conversationId: string;
  messageId: string;
  senderId: string;
  senderName: string;
  pictureId: string;
  pictureThumbnailUrl: string;
  pictureMediaUrl: string;
  pictureStatus: "sent" | "viewed" | "expired";
  pictureDuration?: number;
  caption?: string;
  createdAt: Date;
  viewedAt?: Date;
  screenshotTaken: boolean;
  allowReplies: boolean;
  expiresAt: Date;
}

// Backwards compatibility alias
export type SnapMessage = PictureMessage;

/**
 * Send picture to chat conversation
 * Creates message document and links to picture
 */
export async function sendSnapToChat(
  picture: Picture,
  conversationId: string,
  userId: string,
  userName: string,
): Promise<SnapMessage> {
  try {
    logger.info(
      `[Game Chat Service] Sending picture ${picture.id} to conversation ${conversationId}`,
    );

    const db = getFirestoreInstance();

    // Create message document in chat
    const messagesRef = collection(
      db,
      "Conversations",
      conversationId,
      "Messages",
    );

    const messageData = {
      conversationId,
      messageType: "snap" as const,
      senderId: userId,
      senderName: userName,
      snapId: picture.id,
      snapThumbnailUrl: picture.mediaUrl, // Use mediaUrl as thumbnail fallback
      snapMediaUrl: picture.mediaUrl,
      snapStatus: "sent" as const,
      snapDuration: picture.duration ?? null,
      caption: picture.caption ?? "",
      createdAt: new Date(),
      expiresAt: picture.storyExpiresAt
        ? new Date(picture.storyExpiresAt)
        : new Date(Date.now() + 24 * 60 * 60 * 1000),
      allowReplies: picture.allowReplies,
      screenshotTaken: false,
      reactions: [],
    };

    const messageDocRef = await addDoc(messagesRef, messageData);

    // Update picture document to mark as sent to chat
    const pictureRef = doc(db, "Pictures", picture.id);
    await updateDoc(pictureRef, {
      sentToChat: true,
      chatMessageId: messageDocRef.id,
      chatConversationId: conversationId,
    });

    // Update conversation's last message
    const conversationRef = doc(db, "Conversations", conversationId);
    await updateDoc(conversationRef, {
      lastMessage: "📸 Picture",
      lastMessageAt: new Date(),
      lastMessageSenderId: userId,
    });

    logger.info(
      `[Game Chat Service] Picture message created: ${messageDocRef.id}`,
    );

    return {
      id: messageDocRef.id,
      conversationId,
      messageId: messageDocRef.id,
      senderId: userId,
      senderName: userName,
      pictureId: picture.id,
      pictureThumbnailUrl: picture.mediaUrl,
      pictureMediaUrl: picture.mediaUrl,
      pictureStatus: "sent",
      pictureDuration: picture.duration ?? undefined,
      caption: picture.caption,
      createdAt: new Date(),
      screenshotTaken: false,
      allowReplies: picture.allowReplies,
      expiresAt: picture.storyExpiresAt
        ? new Date(picture.storyExpiresAt)
        : new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  } catch (error) {
    logger.error("[Game Chat Service] Failed to send picture to chat:", error);
    throw error;
  }
}

/**
 * Record picture view in chat
 */
export async function recordSnapViewInChat(
  conversationId: string,
  messageId: string,
  snapId: string,
  viewerId: string,
): Promise<void> {
  try {
    logger.info(
      `[Game Chat Service] Recording picture view for message ${messageId}`,
    );

    const db = getFirestoreInstance();

    // Update message status
    const messageRef = doc(
      db,
      "Conversations",
      conversationId,
      "Messages",
      messageId,
    );
    await updateDoc(messageRef, {
      snapStatus: "viewed",
      viewedAt: new Date(),
    });

    // Record view in picture document
    const viewsRef = collection(db, "Pictures", snapId, "Views");
    await addDoc(viewsRef, {
      userId: viewerId,
      viewedAt: new Date(),
      duration: 0,
      screenshotTaken: false,
      fromChat: true,
      messageId,
      conversationId,
    });

    // Increment picture view count
    const snapRef = doc(db, "Pictures", snapId);
    await updateDoc(snapRef, {
      viewCount: increment(1),
    });

    logger.info("[Game Chat Service] Picture view recorded");
  } catch (error) {
    logger.error(
      "[Game Chat Service] Failed to record picture view in chat:",
      error,
    );
    throw error;
  }
}

/**
 * Mark picture as viewed from chat
 */
export async function markSnapAsViewedInChat(
  messageId: string,
  conversationId: string,
): Promise<void> {
  try {
    logger.info(
      `[Game Chat Service] Marking picture message ${messageId} as viewed`,
    );

    const db = getFirestoreInstance();

    const messageRef = doc(
      db,
      "Conversations",
      conversationId,
      "Messages",
      messageId,
    );
    await updateDoc(messageRef, {
      snapStatus: "viewed",
      viewedAt: new Date(),
    });

    logger.info("[Game Chat Service] Picture marked as viewed");
  } catch (error) {
    logger.error(
      "[Game Chat Service] Failed to mark picture as viewed:",
      error,
    );
    throw error;
  }
}

/**
 * Record screenshot of picture in chat
 */
export async function recordSnapScreenshot(
  conversationId: string,
  messageId: string,
  snapId: string,
  userId: string,
): Promise<void> {
  try {
    logger.info(
      `[Game Chat Service] Recording screenshot of picture message ${messageId}`,
    );

    const db = getFirestoreInstance();

    // Update message to indicate screenshot
    const messageRef = doc(
      db,
      "Conversations",
      conversationId,
      "Messages",
      messageId,
    );
    await updateDoc(messageRef, {
      screenshotTaken: true,
    });

    // Record screenshot in picture views
    const viewsRef = collection(db, "Pictures", snapId, "Views");
    await addDoc(viewsRef, {
      userId,
      screenshotTaken: true,
      viewedAt: new Date(),
      fromChat: true,
      messageId,
      conversationId,
    });

    logger.info("[Game Chat Service] Screenshot recorded");
  } catch (error) {
    logger.error("[Game Chat Service] Failed to record screenshot:", error);
    throw error;
  }
}

/**
 * Get picture messages in conversation
 */
export async function getSnapMessagesInConversation(
  conversationId: string,
  maxResults: number = 50,
): Promise<SnapMessage[]> {
  try {
    logger.info(
      `[Game Chat Service] Fetching picture messages from conversation ${conversationId}`,
    );

    const db = getFirestoreInstance();

    const messagesRef = collection(
      db,
      "Conversations",
      conversationId,
      "Messages",
    );
    const q = query(
      messagesRef,
      where("messageType", "==", "snap"),
      orderBy("createdAt", "desc"),
      firestoreLimit(maxResults),
    );
    const snapshot = await getDocs(q);

    const messages: SnapMessage[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      messages.push({
        id: docSnap.id,
        conversationId: data.conversationId,
        messageId: docSnap.id,
        senderId: data.senderId,
        senderName: data.senderName,
        pictureId: data.snapId,
        pictureThumbnailUrl: data.snapThumbnailUrl,
        pictureMediaUrl: data.snapMediaUrl,
        pictureStatus: data.snapStatus,
        pictureDuration: data.snapDuration,
        caption: data.caption,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        viewedAt: data.viewedAt?.toDate?.(),
        screenshotTaken: data.screenshotTaken || false,
        allowReplies: data.allowReplies || false,
        expiresAt: data.expiresAt?.toDate?.() || new Date(),
      });
    });

    logger.info(
      `[Game Chat Service] Fetched ${messages.length} picture messages`,
    );
    return messages;
  } catch (error) {
    logger.error("[Game Chat Service] Failed to get picture messages:", error);
    throw error;
  }
}

/**
 * Delete picture message from chat
 */
export async function deleteSnapMessageFromChat(
  conversationId: string,
  messageId: string,
): Promise<void> {
  try {
    logger.info(
      `[Game Chat Service] Deleting picture message ${messageId} from chat`,
    );

    const db = getFirestoreInstance();

    const messageRef = doc(
      db,
      "Conversations",
      conversationId,
      "Messages",
      messageId,
    );
    await deleteDoc(messageRef);

    logger.info("[Game Chat Service] Picture message deleted");
  } catch (error) {
    logger.error(
      "[Game Chat Service] Failed to delete picture message:",
      error,
    );
    throw error;
  }
}

/**
 * Add reaction to picture message
 */
export async function addReactionToSnapMessage(
  conversationId: string,
  messageId: string,
  emoji: string,
  userId: string,
): Promise<void> {
  try {
    logger.info(
      `[Game Chat Service] Adding reaction ${emoji} to picture message ${messageId}`,
    );

    const db = getFirestoreInstance();

    const messageRef = doc(
      db,
      "Conversations",
      conversationId,
      "Messages",
      messageId,
    );

    await updateDoc(messageRef, {
      [`reactions.${emoji}`]: arrayUnion(userId),
    });

    logger.info("[Game Chat Service] Reaction added to picture message");
  } catch (error) {
    logger.error(
      "[Game Chat Service] Failed to add reaction to picture message:",
      error,
    );
    throw error;
  }
}

/**
 * Get picture metadata for chat display
 */
export async function getSnapMetadataForChat(
  snapId: string,
): Promise<Partial<SnapMessage> | null> {
  try {
    logger.info(`[Game Chat Service] Fetching picture metadata for ${snapId}`);

    const db = getFirestoreInstance();

    const snapRef = doc(db, "Pictures", snapId);
    const snapDoc = await getDoc(snapRef);

    if (!snapDoc.exists()) {
      logger.warn("[Game Chat Service] Picture not found");
      return null;
    }

    const data = snapDoc.data();

    return {
      pictureId: data.id,
      pictureThumbnailUrl: data.thumbnailUrl,
      pictureMediaUrl: data.mediaUrl,
      pictureDuration: data.mediaDuration,
      caption: data.caption,
      expiresAt: data.expiresAt?.toDate?.() || new Date(),
    };
  } catch (error) {
    logger.error("[Game Chat Service] Failed to get picture metadata:", error);
    return null;
  }
}
