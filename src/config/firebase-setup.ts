/**
 * FIREBASE SETUP & CONFIGURATION
 * Comprehensive Firestore schema, indexes, and rules documentation
 */

import { Timestamp } from "firebase/firestore";

/**
 * ============================================================================
 * FIRESTORE COLLECTIONS SCHEMA
 * ============================================================================
 */

/**
 * SNAPS COLLECTION
 *
 * /Snaps/{snapId}
 */
export interface SnapDocument {
  // Core metadata
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;

  // Media
  mediaUrl: string;
  mediaType: "photo" | "video";
  mediaDuration?: number; // in milliseconds
  thumbnailUrl: string;

  // Recipients
  recipientIds: string[];

  // Visibility
  isPrivate: boolean;
  storyVisible: boolean; // Visible to all friends as story
  allowReplies: boolean;
  allowReactions: boolean;

  // Effects applied
  filterApplied?: string;
  effectsApplied: string[];

  // Metadata
  caption?: string;
  location?: {
    latitude: number;
    longitude: number;
  };

  // Statistics
  viewCount: number;
  reactionCount: number;
  replyCount: number;

  // Privacy & Safety
  isReported: boolean;
  reportReason?: string;
}

/**
 * PICTURE VIEWS SUBCOLLECTION
 *
 * /Snaps/{snapId}/Views/{viewId}
 */
export interface SnapViewDocument {
  userId: string;
  viewedAt: Timestamp;
  duration: number; // in milliseconds
  screenshotTaken: boolean;
}

/**
 * PICTURE REACTIONS SUBCOLLECTION
 *
 * /Snaps/{snapId}/Reactions/{reactionId}
 */
export interface SnapReactionDocument {
  userId: string;
  userName: string;
  emoji: string;
  createdAt: Timestamp;
}

/**
 * PICTURE REPLIES SUBCOLLECTION
 *
 * /Snaps/{snapId}/Replies/{replyId}
 */
export interface SnapReplyDocument {
  userId: string;
  userName: string;
  userAvatar: string;
  message: string;
  createdAt: Timestamp;
  isMediaReply: boolean;
  mediaUrl?: string;
}

/**
 * USERS COLLECTION
 *
 * /Users/{userId}
 */
export interface UserDocument {
  id: string;
  email: string;
  username: string;
  displayName: string;
  profileImage: string;
  bio: string;

  // Account
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
  lastSeen: Timestamp;

  // Privacy
  isPrivateAccount: boolean;
  isPhoneVerified: boolean;

  // Statistics
  friendCount: number;
  followerCount: number;
  snapCount: number;

  // Settings
  notificationsEnabled: boolean;
  theme: "light" | "dark" | "system";
}

/**
 * CONVERSATIONS COLLECTION
 *
 * /Conversations/{conversationId}
 */
export interface ConversationDocument {
  id: string;
  participantIds: string[];
  participantNames: string[];
  isGroup: boolean;
  groupName?: string;
  groupImage?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMessage?: string;
  lastMessageAt?: Timestamp;
}

/**
 * MESSAGES SUBCOLLECTION
 *
 * /Conversations/{conversationId}/Messages/{messageId}
 */
export interface ChatMessageDocument {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;

  // Message content
  messageType: "text" | "picture" | "image" | "video" | "reaction";
  content: string;

  // Picture-specific fields
  snapId?: string;
  snapThumbnailUrl?: string;
  snapStatus?: "sent" | "viewed" | "expired";

  // Metadata
  createdAt: Timestamp;
  editedAt?: Timestamp;
  isEdited: boolean;

  // Reactions
  reactions: {
    emoji: string;
    userIds: string[];
  }[];
}

/**
 * NOTIFICATIONS COLLECTION
 *
 * /Notifications/{notificationId}
 */
export interface NotificationDocument {
  id: string;
  userId: string;

  // Notification type
  type:
    | "picture_received"
    | "picture_viewed"
    | "picture_screenshot"
    | "picture_reaction"
    | "picture_reply"
    | "message_received"
    | "friend_request"
    | "friend_accepted";

  // Related entity IDs
  senderId: string;
  senderName: string;
  senderImage: string;
  snapId?: string;
  conversationId?: string;

  // Content
  title: string;
  body: string;
  data?: Record<string, string>;

  // Status
  read: boolean;
  readAt?: Timestamp;
  createdAt: Timestamp;

  // Expiry
  expiresAt: Timestamp;
}

/**
 * STORIES COLLECTION (Photo Stories)
 *
 * /Stories/{storyId}
 */
export interface StoryDocument {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;

  // Story metadata
  title: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;

  // Privacy
  isPublic: boolean;
  allowedViewers: string[];

  // Statistics
  viewCount: number;
  itemCount: number;
}

/**
 * STORY ITEMS SUBCOLLECTION
 *
 * /Stories/{storyId}/Items/{itemId}
 */
export interface StoryItemDocument {
  id: string;
  mediaUrl: string;
  mediaType: "photo" | "video";
  caption?: string;
  createdAt: Timestamp;
  order: number;
}

/**
 * RELATIONSHIPS DOCUMENTS
 *
 * /Users/{userId}/Friends/{friendId}
 * /Users/{userId}/Blocked/{blockedId}
 */
export interface FriendDocument {
  id: string;
  userId: string;
  friendId: string;
  friendName: string;
  friendImage: string;
  addedAt: Timestamp;
  isFavorite: boolean;
}

export interface BlockedUserDocument {
  id: string;
  userId: string;
  blockedId: string;
  blockedName: string;
  blockedAt: Timestamp;
  reason?: string;
}

/**
 * ============================================================================
 * FIRESTORE INDEXES
 * ============================================================================
 *
 * The following composite indexes are required for efficient queries:
 *
 * 1. Snaps - Query by sender with sort by creation date
 *    Fields: senderId (ASC), createdAt (DESC)
 *
 * 2. Snaps - Query recipient snaps with expiry
 *    Fields: recipientIds (ASC), createdAt (DESC)
 *
 * 3. Snaps - Query story snaps with expiry
 *    Fields: storyVisible (ASC), expiresAt (ASC)
 *
 * 4. Snaps - Query user snaps with privacy
 *    Fields: senderId (ASC), isPrivate (ASC)
 *
 * 5. PictureViews - Query views by picture
 *    Fields: snapId (ASC), viewedAt (DESC)
 *
 * 6. PictureReplies - Query replies by picture
 *    Fields: snapId (ASC), createdAt (DESC)
 *
 * 7. ChatMessages - Query messages by conversation
 *    Fields: conversationId (ASC), createdAt (DESC)
 *
 * 8. PictureReactions - Query reactions by picture
 *    Fields: snapId (ASC), createdAt (DESC)
 */

/**
 * ============================================================================
 * SECURITY RULES
 * ============================================================================
 *
 * See: firestore.rules and storage.rules for complete security implementation
 *
 * Key principles:
 * 1. Users can only read/write their own data
 * 2. Picture access controlled by senderId, recipientIds, and storyVisible
 * 3. Chat messages accessible only to conversation participants
 * 4. Notifications only readable by recipient
 * 5. Storage files protected by Firestore document ownership
 */

/**
 * ============================================================================
 * BATCH OPERATIONS
 * ============================================================================
 */

/**
 * Example: Send picture to multiple recipients
 */
export async function sendSnapBatch(
  firebaseDb: any,
  snapId: string,
  recipientIds: string[],
  senderData: any,
) {
  const batch = firebaseDb.batch();

  // Create picture document
  const snapRef = firebaseDb.collection("Snaps").doc(snapId);
  batch.set(snapRef, {
    ...senderData,
    recipientIds,
    createdAt: new Date(),
    viewCount: 0,
    reactionCount: 0,
    replyCount: 0,
  });

  // Create notification for each recipient
  recipientIds.forEach((recipientId) => {
    const notifRef = firebaseDb.collection("Notifications").doc();
    batch.set(notifRef, {
      userId: recipientId,
      type: "picture_received",
      senderId: senderData.senderId,
      snapId,
      read: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });
  });

  return batch.commit();
}

/**
 * Example: Record picture view
 */
export async function recordSnapViewBatch(
  firebaseDb: any,
  snapId: string,
  viewerId: string,
) {
  const batch = firebaseDb.batch();

  // Add view document
  const viewRef = firebaseDb
    .collection("Snaps")
    .doc(snapId)
    .collection("Views")
    .doc();
  batch.set(viewRef, {
    userId: viewerId,
    viewedAt: new Date(),
    duration: 5000,
    screenshotTaken: false,
  });

  // Increment view count
  const snapRef = firebaseDb.collection("Snaps").doc(snapId);
  batch.update(snapRef, {
    viewCount: firebaseDb.FieldValue.increment(1),
  });

  return batch.commit();
}

/**
 * ============================================================================
 * QUERY EXAMPLES
 * ============================================================================
 */

/**
 * Get snaps for authenticated user
 * - Snaps sent to them
 * - Story snaps from friends
 * - Own snaps
 */
export function getSnapQueries(firebaseDb: any, userId: string) {
  const now = new Date();

  return {
    // Direct snaps sent to user
    directSnaps: firebaseDb
      .collection("Snaps")
      .where("recipientIds", "array-contains", userId)
      .where("expiresAt", ">", now)
      .orderBy("expiresAt", "asc")
      .orderBy("createdAt", "desc"),

    // Story snaps from friends
    storySnaps: firebaseDb
      .collection("Snaps")
      .where("storyVisible", "==", true)
      .where("expiresAt", ">", now)
      .orderBy("expiresAt", "asc")
      .orderBy("createdAt", "desc"),

    // User's own snaps
    ownSnaps: firebaseDb
      .collection("Snaps")
      .where("senderId", "==", userId)
      .orderBy("createdAt", "desc"),
  };
}

/**
 * ============================================================================
 * DATA RETENTION POLICIES
 * ============================================================================
 */

/**
 * Snaps expire and are deleted after expiresAt timestamp
 * Implement via:
 * 1. Cloud Function scheduled daily to delete expired snaps
 * 2. Client-side filtering of expired snaps
 * 3. Firestore TTL (when available)
 */

/**
 * Cloud Function: Delete Expired Snaps
 * Should run daily or every hour
 */
export async function deleteExpiredSnaps(firebaseDb: any) {
  const now = new Date();

  const expired = await firebaseDb
    .collection("Snaps")
    .where("expiresAt", "<", now)
    .get();

  const batch = firebaseDb.batch();
  let count = 0;

  expired.forEach((doc: any) => {
    batch.delete(doc.ref);
    count++;
  });

  if (count > 0) {
    await batch.commit();
    console.log(`Deleted ${count} expired snaps`);
  }

  return count;
}

/**
 * ============================================================================
 * DEPLOYMENT INSTRUCTIONS
 * ============================================================================
 *
 * 1. Install Firebase CLI:
 *    npm install -g firebase-tools
 *
 * 2. Login to Firebase:
 *    firebase login
 *
 * 3. Deploy Firestore indexes:
 *    firebase deploy --only firestore:indexes
 *
 * 4. Deploy Firestore rules:
 *    firebase deploy --only firestore:rules
 *
 * 5. Deploy Cloud Storage rules:
 *    firebase deploy --only storage:rules
 *
 * 6. Deploy Cloud Functions (if used):
 *    firebase deploy --only functions
 */
