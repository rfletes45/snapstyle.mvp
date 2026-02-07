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
import { Picture, Snap } from "../../types/camera";
import { getFirestoreInstance } from "../firebase";

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
 * Creates message document and links to snap
 */
export async function sendSnapToChat(
  picture: Picture,
  conversationId: string,
  userId: string,
  userName: string,
): Promise<SnapMessage> {
  try {
    console.log(
      `[Game Chat Service] Sending snap ${snap.id} to conversation ${conversationId}`,
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
      snapId: snap.id,
      snapThumbnailUrl: snap.mediaUrl, // Use mediaUrl as thumbnail fallback
      snapMediaUrl: snap.mediaUrl,
      snapStatus: "sent" as const,
      snapDuration: snap.duration ?? null,
      caption: snap.caption ?? "",
      createdAt: new Date(),
      expiresAt: snap.storyExpiresAt
        ? new Date(snap.storyExpiresAt)
        : new Date(Date.now() + 24 * 60 * 60 * 1000),
      allowReplies: snap.allowReplies,
      screenshotTaken: false,
      reactions: [],
    };

    const messageDocRef = await addDoc(messagesRef, messageData);

    // Update snap document to mark as sent to chat
    const snapRef = doc(db, "Pictures", snap.id);
    await updateDoc(snapRef, {
      sentToChat: true,
      chatMessageId: messageDocRef.id,
      chatConversationId: conversationId,
    });

    // Update conversation's last message
    const conversationRef = doc(db, "Conversations", conversationId);
    await updateDoc(conversationRef, {
      lastMessage: "📸 Snap",
      lastMessageAt: new Date(),
      lastMessageSenderId: userId,
    });

    console.log(
      `[Game Chat Service] Snap message created: ${messageDocRef.id}`,
    );

    return {
      id: messageDocRef.id,
      conversationId,
      messageId: messageDocRef.id,
      senderId: userId,
      senderName: userName,
      snapId: snap.id,
      snapThumbnailUrl: snap.mediaUrl,
      snapMediaUrl: snap.mediaUrl,
      snapStatus: "sent",
      snapDuration: snap.duration ?? undefined,
      caption: snap.caption,
      createdAt: new Date(),
      screenshotTaken: false,
      allowReplies: snap.allowReplies,
      expiresAt: snap.storyExpiresAt
        ? new Date(snap.storyExpiresAt)
        : new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  } catch (error) {
    console.error("[Game Chat Service] Failed to send snap to chat:", error);
    throw error;
  }
}

/**
 * Record snap view in chat
 */
export async function recordSnapViewInChat(
  conversationId: string,
  messageId: string,
  snapId: string,
  viewerId: string,
): Promise<void> {
  try {
    console.log(
      `[Game Chat Service] Recording snap view for message ${messageId}`,
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

    // Record view in snap document
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

    // Increment snap view count
    const snapRef = doc(db, "Pictures", snapId);
    await updateDoc(snapRef, {
      viewCount: increment(1),
    });

    console.log("[Game Chat Service] Snap view recorded");
  } catch (error) {
    console.error(
      "[Game Chat Service] Failed to record snap view in chat:",
      error,
    );
    throw error;
  }
}

/**
 * Mark snap as viewed from chat
 */
export async function markSnapAsViewedInChat(
  messageId: string,
  conversationId: string,
): Promise<void> {
  try {
    console.log(
      `[Game Chat Service] Marking snap message ${messageId} as viewed`,
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

    console.log("[Game Chat Service] Snap marked as viewed");
  } catch (error) {
    console.error("[Game Chat Service] Failed to mark snap as viewed:", error);
    throw error;
  }
}

/**
 * Record screenshot of snap in chat
 */
export async function recordSnapScreenshot(
  conversationId: string,
  messageId: string,
  snapId: string,
  userId: string,
): Promise<void> {
  try {
    console.log(
      `[Game Chat Service] Recording screenshot of snap message ${messageId}`,
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

    // Record screenshot in snap views
    const viewsRef = collection(db, "Pictures", snapId, "Views");
    await addDoc(viewsRef, {
      userId,
      screenshotTaken: true,
      viewedAt: new Date(),
      fromChat: true,
      messageId,
      conversationId,
    });

    console.log("[Game Chat Service] Screenshot recorded");
  } catch (error) {
    console.error("[Game Chat Service] Failed to record screenshot:", error);
    throw error;
  }
}

/**
 * Get snap messages in conversation
 */
export async function getSnapMessagesInConversation(
  conversationId: string,
  maxResults: number = 50,
): Promise<SnapMessage[]> {
  try {
    console.log(
      `[Game Chat Service] Fetching snap messages from conversation ${conversationId}`,
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
        snapId: data.snapId,
        snapThumbnailUrl: data.snapThumbnailUrl,
        snapMediaUrl: data.snapMediaUrl,
        snapStatus: data.snapStatus,
        snapDuration: data.snapDuration,
        caption: data.caption,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        viewedAt: data.viewedAt?.toDate?.(),
        screenshotTaken: data.screenshotTaken || false,
        allowReplies: data.allowReplies || false,
        expiresAt: data.expiresAt?.toDate?.() || new Date(),
      });
    });

    console.log(`[Game Chat Service] Fetched ${messages.length} snap messages`);
    return messages;
  } catch (error) {
    console.error("[Game Chat Service] Failed to get snap messages:", error);
    throw error;
  }
}

/**
 * Delete snap message from chat
 */
export async function deleteSnapMessageFromChat(
  conversationId: string,
  messageId: string,
): Promise<void> {
  try {
    console.log(
      `[Game Chat Service] Deleting snap message ${messageId} from chat`,
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

    console.log("[Game Chat Service] Snap message deleted");
  } catch (error) {
    console.error("[Game Chat Service] Failed to delete snap message:", error);
    throw error;
  }
}

/**
 * Add reaction to snap message
 */
export async function addReactionToSnapMessage(
  conversationId: string,
  messageId: string,
  emoji: string,
  userId: string,
): Promise<void> {
  try {
    console.log(
      `[Game Chat Service] Adding reaction ${emoji} to snap message ${messageId}`,
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

    console.log("[Game Chat Service] Reaction added to snap message");
  } catch (error) {
    console.error(
      "[Game Chat Service] Failed to add reaction to snap message:",
      error,
    );
    throw error;
  }
}

/**
 * Get snap metadata for chat display
 */
export async function getSnapMetadataForChat(
  snapId: string,
): Promise<Partial<SnapMessage> | null> {
  try {
    console.log(`[Game Chat Service] Fetching snap metadata for ${snapId}`);

    const db = getFirestoreInstance();

    const snapRef = doc(db, "Pictures", snapId);
    const snapDoc = await getDoc(snapRef);

    if (!snapDoc.exists()) {
      console.warn("[Game Chat Service] Snap not found");
      return null;
    }

    const data = snapDoc.data();

    return {
      snapId: data.id,
      snapThumbnailUrl: data.thumbnailUrl,
      snapMediaUrl: data.mediaUrl,
      snapDuration: data.mediaDuration,
      caption: data.caption,
      expiresAt: data.expiresAt?.toDate?.() || new Date(),
    };
  } catch (error) {
    console.error("[Game Chat Service] Failed to get snap metadata:", error);
    return null;
  }
}


