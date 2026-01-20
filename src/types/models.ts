// User model
export interface User {
  uid: string;
  usernameLower: string;
  username: string;
  displayName: string;
  avatarConfig: AvatarConfig;
  expoPushToken?: string;
  createdAt: number;
  lastActive: number;
}

export interface AvatarConfig {
  baseColor: string;
  hat?: string;
  glasses?: string;
}

// Friend request
export interface FriendRequest {
  id: string;
  from: string;
  to: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
  respondedAt: number | null;
}

// Friend relationship
export interface Friend {
  id: string;
  users: [string, string];
  createdAt: number;
  streakCount: number;
  streakUpdatedDay: string; // YYYY-MM-DD
  lastSentDay_uid1?: string;
  lastSentDay_uid2?: string;
  blockedBy?: string | null;
}

// Chat and Message
export interface Chat {
  id: string;
  members: [string, string];
  createdAt: number;
  lastMessageText?: string;
  lastMessageAt?: number;
}

export interface Message {
  id: string;
  sender: string;
  type: "text" | "image";
  content: string; // text content or storage path
  createdAt: number;
  expiresAt: number;
  read: boolean;
  readAt?: number;
  openedAt?: number;
  openedBy?: string;
}

// Story (Phase 5)
export interface Story {
  id: string;
  authorId: string;
  createdAt: number;
  expiresAt: number;
  storagePath: string;        // stories/{authorId}/{storyId}.jpg
  viewCount: number;          // Aggregate view count
  recipientIds?: string[];    // Array of friend IDs (for query compatibility)
}

export interface StoryView {
  userId: string;
  viewedAt: number;
  viewed: boolean;            // true (for querying convenience)
}

// Game
export interface GameSession {
  id: string;
  gameId: string;
  playerId: string;
  score: number;
  playedAt: number;
}

// Cosmetics
export interface CosmeticItem {
  id: string;
  name: string;
  slot: "hat" | "glasses" | "other";
  imagePath: string;
  rarity: "common" | "rare" | "epic";
  unlock: {
    type: "free" | "milestone" | "starter";
    value?: string; // milestone name like "streak_3"
  };
}

export interface InventoryItem {
  itemId: string;
  acquiredAt: number;
}

// Report
export interface Report {
  id: string;
  reporterId: string;
  reportedUserId: string;
  context: string;
  createdAt: number;
}
