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
  background?: string;
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

/**
 * Message delivery status for optimistic UI updates
 * - sending: Message is being sent to server
 * - sent: Message successfully written to Firestore
 * - delivered: Message read by recipient (future: push notification confirmed)
 * - failed: Message failed to send (network error, etc.)
 */
export type MessageStatus = "sending" | "sent" | "delivered" | "failed";

export interface Message {
  id: string;
  sender: string;
  type: "text" | "image" | "scorecard";
  content: string; // text content or storage path or JSON for scorecard
  createdAt: number;
  expiresAt: number;
  read: boolean;
  readAt?: number;
  openedAt?: number;
  openedBy?: string;
  status?: MessageStatus;
  errorMessage?: string;
  isLocal?: boolean;
  clientMessageId?: string;
  // Scorecard data (for type: "scorecard")
  scorecard?: {
    gameId: GameType;
    score: number;
    playerName: string;
  };
}

export interface Story {
  id: string;
  authorId: string;
  createdAt: number;
  expiresAt: number;
  storagePath: string; // stories/{authorId}/{storyId}.jpg
  viewCount: number; // Aggregate view count
  recipientIds?: string[]; // Array of friend IDs (for query compatibility)
}

export interface StoryView {
  userId: string;
  viewedAt: number;
  viewed: boolean; // true (for querying convenience)
}

// Game Types - Original mini-games
export type GameType = "reaction_tap" | "timed_tap";

// Extended game types
// @see src/types/games.ts for full type definitions and metadata
export type SinglePlayerGameType =
  | "bounce_blitz"
  | "snap_2048"
  | "snap_snake"
  | "memory_snap"
  | "word_snap";

export type TurnBasedGameType =
  | "chess"
  | "checkers"
  | "crazy_eights"
  | "tic_tac_toe";

export type RealTimeGameType = "8ball_pool" | "air_hockey";

// All available game types
export type ExtendedGameType =
  | GameType
  | SinglePlayerGameType
  | TurnBasedGameType
  | RealTimeGameType;

export interface GameSession {
  id: string;
  gameId: GameType;
  playerId: string;
  score: number;
  playedAt: number; // Always converted to number in service layer
  // Anti-cheat metadata
  duration?: number; // Game duration in ms
  tapCount?: number; // Number of taps (for timed_tap)
  reactionTime?: number; // Reaction time in ms (for reaction_tap)
}

// Extended game session for new games
export interface ExtendedGameSession {
  id: string;
  gameId: ExtendedGameType;
  playerId: string;
  score: number;
  playedAt: number;
  duration?: number;
  // Game-specific metadata
  metadata?: {
    // Flappy Snap
    pipesCleared?: number;
    // Bounce Blitz
    blocksDestroyed?: number;
    ballsUsed?: number;
    // Snake
    applesEaten?: number;
    maxLength?: number;
    // Memory Snap
    movesUsed?: number;
    perfectMatches?: number;
    // Word Snap
    wordsFound?: number;
    longestWord?: string;
    // 2048
    highestTile?: number;
    movesUsed2048?: number;
  };
}

// Game score limits for anti-cheat validation
export const GAME_SCORE_LIMITS: Record<
  GameType,
  { minScore: number; maxScore: number; maxDuration?: number }
> = {
  reaction_tap: { minScore: 100, maxScore: 2000 }, // Reaction time in ms (lower is better)
  timed_tap: { minScore: 1, maxScore: 200, maxDuration: 10000 }, // Taps in 10 seconds
};

// Extended score limits for new games
// @see src/types/games.ts EXTENDED_GAME_SCORE_LIMITS for full configuration

// Cosmetics
export interface CosmeticItem {
  id: string;
  name: string;
  slot: "hat" | "glasses" | "background";
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

// =============================================================================
// Badge System (Profile Overhaul)
// =============================================================================

/**
 * User badge record stored in Users/{uid}/Badges/{badgeId}
 * @see src/types/profile.ts for full Badge definition
 */
export interface UserBadgeRecord {
  badgeId: string;
  earnedAt: number;
  featured: boolean;
  displayOrder?: number;
  earnedVia?: {
    achievementId?: string;
    eventId?: string;
    meta?: Record<string, unknown>;
  };
}

/**
 * User stats cache for profile display
 * Stored in Users/{uid}.statsCache
 */
export interface UserStatsCache {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  highestStreak: number;
  currentStreak: number;
  totalBadges: number;
  achievementProgress: number;
  friendCount: number;
  daysActive: number;
  lastUpdated: number;
}

/**
 * User level data
 * Stored in Users/{uid}.level
 */
export interface UserLevelData {
  current: number;
  xp: number;
  xpToNextLevel: number;
  totalXp: number;
}

// Blocked User (stored in Users/{userId}/blockedUsers/{blockedUserId})
export interface BlockedUser {
  blockedUserId: string;
  blockedAt: number;
  reason?: string;
}

// Report reasons
export type ReportReason =
  | "spam"
  | "harassment"
  | "inappropriate_content"
  | "fake_account"
  | "other";

// Report (stored in Reports collection)
export interface Report {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reason: ReportReason;
  description?: string;
  createdAt: number;
  status: "pending" | "reviewed" | "resolved" | "dismissed";
  relatedContent?: {
    type: "message" | "story" | "profile";
    contentId?: string;
  };
  // Admin review fields
  reviewedBy?: string; // Admin UID who reviewed
  reviewedAt?: number;
  resolution?: string; // Notes from admin
  actionTaken?: "none" | "warning" | "strike" | "ban";
}

// =============================================================================
// Trust & Safety - Bans, Strikes, Warnings, Rate Limiting
// =============================================================================

/**
 * Ban status for a user
 */
export type BanStatus = "active" | "expired" | "lifted";

/**
 * Warning status for tracking acknowledgment
 */
export type WarningStatus = "unread" | "read" | "acknowledged";

/**
 * Ban reasons for moderation (also used for warnings/strikes)
 */
export type BanReason =
  | "harassment"
  | "spam"
  | "inappropriate_content"
  | "underage"
  | "multiple_violations"
  | "fraud"
  | "other";

/**
 * User warning record
 * Collection: UserWarnings/{warningId}
 */
export interface UserWarning {
  id: string;
  uid: string; // User who received the warning
  reason: BanReason;
  details?: string; // Warning message/details
  issuedBy: string; // Admin UID
  issuedAt: number;
  reportId?: string; // Related report if any
  status: WarningStatus;
  readAt?: number;
  acknowledgedAt?: number;
}

/**
 * User ban record (admin-only writes)
 * Collection: Bans/{uid}
 */
export interface Ban {
  uid: string;
  status: BanStatus;
  reason: BanReason;
  reasonDetails?: string; // Additional context
  bannedBy: string; // Admin UID
  createdAt: number;
  expiresAt: number | null; // null = permanent ban
  liftedAt?: number;
  liftedBy?: string; // Admin who lifted the ban
}

/**
 * Strike record for tracking violations
 * Collection: UserStrikes/{uid}
 */
export interface UserStrike {
  uid: string;
  strikeCount: number;
  lastStrikeAt: number;
  lastStrikeReason?: BanReason;
  strikeHistory: StrikeRecord[];
}

/**
 * Individual strike record within history
 */
export interface StrikeRecord {
  reason: BanReason;
  details?: string;
  issuedBy: string; // Admin UID
  issuedAt: number;
  reportId?: string; // Related report if any
}

/**
 * Ban duration presets for admin UI
 */
export const BAN_DURATIONS = {
  ONE_DAY: 24 * 60 * 60 * 1000,
  THREE_DAYS: 3 * 24 * 60 * 60 * 1000,
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000,
  ONE_MONTH: 30 * 24 * 60 * 60 * 1000,
  PERMANENT: null,
} as const;

/**
 * Strike thresholds for automatic actions
 */
export const STRIKE_THRESHOLDS = {
  WARNING_AT: 1, // First strike = warning
  TEMP_BAN_AT: 2, // Second strike = 1 day ban
  LONG_BAN_AT: 3, // Third strike = 1 week ban
  PERM_BAN_AT: 5, // Fifth strike = permanent ban
} as const;

/**
 * Rate limit configuration for various actions
 */
export const RATE_LIMITS = {
  FRIEND_REQUESTS_PER_HOUR: 20,
  MESSAGES_PER_MINUTE: 30,
  REPORTS_PER_DAY: 10,
  GROUP_INVITES_PER_HOUR: 30,
} as const;

/**
 * Domain event for future migration/sync
 * Collection: Events/{eventId} (server-write only)
 */
export interface DomainEvent {
  id: string;
  type: EventType;
  uid: string; // User who triggered event
  createdAt: number;
  payload: Record<string, any>;
  version: number; // For schema versioning
  processed?: boolean; // For sync tracking
}

/**
 * Event types for domain events
 */
export type EventType =
  | "user_created"
  | "user_updated"
  | "user_deleted"
  | "friend_added"
  | "friend_removed"
  | "message_sent"
  | "story_posted"
  | "game_played"
  | "purchase_made"
  | "task_completed"
  | "achievement_earned"
  | "ban_applied"
  | "strike_issued"
  | "report_submitted"
  | "report_resolved";

/**
 * Helper to check if a ban is currently active
 */
export function isBanActive(ban: Ban | null): boolean {
  if (!ban) return false;
  if (ban.status !== "active") return false;
  if (ban.expiresAt === null) return true; // Permanent ban
  return Date.now() < ban.expiresAt;
}

/**
 * Helper to get ban time remaining in milliseconds
 */
export function getBanTimeRemaining(ban: Ban | null): number | null {
  if (!ban || ban.status !== "active") return null;
  if (ban.expiresAt === null) return null; // Permanent
  const remaining = ban.expiresAt - Date.now();
  return remaining > 0 ? remaining : 0;
}

// =============================================================================
// Scheduled Messages
// =============================================================================

/**
 * Status of a scheduled message
 * - pending: Waiting to be sent
 * - sent: Successfully delivered
 * - cancelled: User cancelled before sending
 * - failed: Delivery failed (blocked, chat deleted, etc.)
 */
export type ScheduledMessageStatus =
  | "pending"
  | "sent"
  | "cancelled"
  | "failed";

/**
 * A message scheduled to be sent at a future time
 */
export interface ScheduledMessage {
  id: string;
  senderId: string; // Who scheduled the message
  recipientId?: string; // Target recipient (DM only)
  chatId: string; // Target chat (DM chatId or Group groupId)
  scope: "dm" | "group"; // Whether this is for DM or Group chat
  content: string; // Message content (text or storage path)
  type: "text" | "image"; // Message type (scorecard not supported for scheduling)
  scheduledFor: number; // When to send (UTC timestamp)
  createdAt: number; // When the schedule was created
  status: ScheduledMessageStatus;
  sentAt?: number; // When actually sent (if status is 'sent')
  failReason?: string; // Why it failed (if status is 'failed')
  mentionUids?: string[]; // Mentioned users (groups only)
}

// =============================================================================
// Leaderboards + Achievements
// =============================================================================

/**
 * Achievement types based on what players can accomplish
 */
export type AchievementType =
  | "game_first_play" // First time playing any game
  | "game_reaction_master" // Reaction time under threshold
  | "game_speed_demon" // Tap count over threshold
  | "game_10_sessions" // Played 10 game sessions
  | "game_50_sessions" // Played 50 game sessions
  | "streak_3_days" // 3-day streak achieved
  | "streak_7_days" // 7-day streak achieved
  | "streak_30_days" // 30-day streak achieved
  | "streak_100_days" // 100-day streak achieved
  | "social_first_friend" // Added first friend
  | "social_10_friends" // Reached 10 friends
  | "social_first_snap" // Sent first snap
  | "social_100_snaps" // Sent 100 snaps
  | "social_first_story" // Posted first story
  | "collection_first_cosmetic" // Acquired first cosmetic
  | "collection_full_set"; // Acquired a complete set

/**
 * Achievement record for a user
 */
export interface Achievement {
  id: string; // Same as type for uniqueness
  uid: string; // User who earned it
  type: AchievementType;
  earnedAt: number; // When the achievement was earned
  meta?: {
    // Optional metadata about how it was earned
    score?: number;
    gameId?: GameType;
    streakCount?: number;
    friendCount?: number;
  };
}

/**
 * Achievement definition (static data)
 */
export interface AchievementDefinition {
  type: AchievementType;
  name: string;
  description: string;
  icon: string;
  category: "game" | "streak" | "social" | "collection";
  rarity: "common" | "rare" | "epic" | "legendary";
  threshold?: number; // Value needed to earn (e.g., reaction time, tap count)
}

/**
 * Leaderboard entry for a specific game + week
 */
export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  avatarConfig?: AvatarConfig; // Optional - may not be present for all players
  score: number;
  updatedAt: number;
  rank?: number; // Computed client-side or via function
}

/**
 * Week key format: "2026-W03" (ISO week)
 */
export type WeekKey = string;

/**
 * Helper to get current week key
 */
export function getCurrentWeekKey(): WeekKey {
  const now = new Date();
  const year = now.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const days = Math.floor(
    (now.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000),
  );
  const weekNum = Math.ceil((days + oneJan.getDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

// =============================================================================
// Economy (Wallet + Tokens)
// =============================================================================

/**
 * User's wallet containing soft currency (tokens)
 * Collection: Wallets/{uid}
 */
export interface Wallet {
  uid: string;
  tokensBalance: number;
  updatedAt: number;
  // Lifetime stats for achievements
  totalEarned?: number;
  totalSpent?: number;
}

/**
 * Transaction types for token economy
 */
export type TransactionType = "earn" | "spend";

/**
 * Reasons for token transactions
 */
export type TransactionReason =
  | "task_reward" // Completed a task
  | "achievement_reward" // Earned an achievement
  | "daily_bonus" // Daily login bonus
  | "streak_bonus" // Streak milestone bonus
  | "shop_purchase" // Bought item from shop
  | "admin_grant" // Admin manually granted tokens
  | "refund"; // Refund for failed purchase

/**
 * Transaction record for token movements
 * Collection: Transactions/{txId}
 */
export interface Transaction {
  id: string;
  uid: string;
  type: TransactionType;
  amount: number; // Positive for earn, positive for spend (type determines direction)
  reason: TransactionReason;
  createdAt: number;
  // Optional reference to related item
  refId?: string; // Task ID, achievement ID, shop item ID, etc.
  refType?: "task" | "achievement" | "shop_item" | "other";
  // Description for display
  description?: string;
}

// =============================================================================
// Daily Tasks / Challenges
// =============================================================================

/**
 * Task cadence - when tasks reset
 */
export type TaskCadence = "daily" | "weekly" | "one_time";

/**
 * Task types that determine how progress is tracked
 */
export type TaskType =
  | "send_message" // Send X messages
  | "send_snap" // Send X snaps (image messages)
  | "view_story" // View X stories
  | "post_story" // Post X stories
  | "play_game" // Play X games
  | "win_game" // Win X games (score threshold)
  | "maintain_streak" // Maintain streak for X days
  | "add_friend" // Add X friends
  | "login"; // Daily login

/**
 * Task definition (admin-created, stored in Tasks collection)
 * Collection: Tasks/{taskId}
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  icon: string; // MaterialCommunityIcon name
  cadence: TaskCadence;
  type: TaskType;
  target: number; // Target value to complete (e.g., send 5 messages)
  rewardTokens: number;
  rewardItemId?: string; // Optional cosmetic item reward
  active: boolean; // Whether task is currently available
  // Ordering
  sortOrder: number;
  // Time constraints (optional)
  availableFrom?: number; // Timestamp when task becomes available
  availableTo?: number; // Timestamp when task expires
}

/**
 * User's progress on a task
 * Collection: Users/{uid}/TaskProgress/{taskId}
 */
export interface TaskProgress {
  taskId: string;
  progress: number; // Current progress (e.g., 3 out of 5 messages sent)
  claimed: boolean; // Whether reward has been claimed
  dayKey: string; // Format: "2026-01-21" for daily tasks
  updatedAt: number;
  claimedAt?: number; // When reward was claimed
}

/**
 * Helper to get current day key for tasks (timezone-aware)
 * Default timezone: America/Indiana/Indianapolis (per guide)
 */
export function getCurrentDayKey(
  timezone = "America/Indiana/Indianapolis",
): string {
  const now = new Date();
  // Use Intl.DateTimeFormat to get timezone-aware date
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now); // Returns "YYYY-MM-DD"
}

/**
 * Task with progress combined for UI display
 */
export interface TaskWithProgress extends Task {
  progress: number;
  claimed: boolean;
  isCompleted: boolean;
  canClaim: boolean;
}

// =============================================================================
// Shop + Limited-Time Drops
// =============================================================================

/**
 * Shop item rarity determines visual styling and scarcity
 */
export type ShopItemRarity =
  | "common"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

/**
 * Shop item categories for filtering
 * Extended for Phase 6 to include new cosmetic types
 */
export type ShopCategory =
  | "hat"
  | "glasses"
  | "background"
  | "bundle"
  | "featured"
  // New Phase 6 categories
  | "profile_frame"
  | "chat_bubble"
  | "profile_theme"
  | "clothing"
  | "accessory"
  | "token_pack";

/**
 * Extended cosmetic slot types for shop items
 */
export type ShopItemSlot =
  | "hat"
  | "glasses"
  | "background"
  | "clothing_top"
  | "clothing_bottom"
  | "accessory_neck"
  | "accessory_ear"
  | "accessory_hand"
  | "profile_frame"
  | "profile_banner"
  | "profile_theme"
  | "chat_bubble"
  | "name_effect";

/**
 * Shop catalog item (admin-created, stored in ShopCatalog collection)
 * Collection: ShopCatalog/{itemId}
 */
export interface ShopItem {
  id: string;
  cosmeticId: string; // Reference to cosmetics.ts item ID
  name: string; // Display name
  description?: string;
  category: ShopCategory;
  slot: ShopItemSlot; // For equipping
  priceTokens: number; // Cost in tokens
  priceUSD?: number; // Real money price (optional)
  rarity: ShopItemRarity;
  imagePath: string; // Preview image path
  // Limited-time availability
  featured: boolean; // Show in featured section
  availableFrom?: number; // When item becomes available (timestamp)
  availableTo?: number; // When item expires (timestamp)
  // Stock management
  limitedQuantity?: number; // Max purchases (null = unlimited)
  purchaseCount: number; // How many have been purchased
  // Metadata
  active: boolean; // Whether item is visible in shop
  sortOrder: number;
  createdAt: number;
  // Phase 6 additions
  bundleItems?: string[]; // For bundles: array of cosmetic IDs included
  discountPercent?: number; // Bundle discount percentage
  originalPriceTokens?: number; // Original price before discount
}

/**
 * Purchase status
 */
export type PurchaseStatus = "completed" | "pending" | "failed" | "refunded";

/**
 * Purchase record for shop transactions
 * Collection: Purchases/{purchaseId}
 */
export interface Purchase {
  id: string;
  uid: string; // Who made the purchase
  itemId: string; // ShopCatalog item ID
  cosmeticId: string; // Cosmetic item received
  priceTokens: number; // Price at time of purchase
  status: PurchaseStatus;
  createdAt: number;
  // Transaction reference
  transactionId?: string; // Reference to Transactions collection
}

/**
 * Helper to check if a shop item is currently available
 */
export function isShopItemAvailable(item: ShopItem): boolean {
  if (!item.active) return false;

  const now = Date.now();
  if (item.availableFrom && now < item.availableFrom) return false;
  if (item.availableTo && now > item.availableTo) return false;
  if (item.limitedQuantity && item.purchaseCount >= item.limitedQuantity)
    return false;

  return true;
}

/**
 * Helper to get time remaining for a limited-time item
 * Returns milliseconds remaining, or null if not time-limited
 */
export function getShopItemTimeRemaining(item: ShopItem): number | null {
  if (!item.availableTo) return null;
  const remaining = item.availableTo - Date.now();
  return remaining > 0 ? remaining : 0;
}

/**
 * Shop item with availability status for UI display
 */
export interface ShopItemWithStatus extends ShopItem {
  isAvailable: boolean;
  timeRemaining: number | null;
  alreadyOwned: boolean;
}

// =============================================================================
// Group Chat
// =============================================================================

/**
 * Group role levels for permissions
 */
export type GroupRole = "owner" | "admin" | "member";

/**
 * Group chat entity
 * Collection: Groups/{groupId}
 */
export interface Group {
  id: string;
  name: string;
  ownerId: string; // User who created the group
  memberIds: string[]; // Array of member UIDs for efficient queries
  avatarPath?: string; // Optional group avatar path in Storage
  avatarUrl?: string; // Optional group avatar download URL
  memberCount: number; // Denormalized count for display
  createdAt: number;
  updatedAt: number;
  // Last message info for chat list display
  lastMessageText?: string;
  lastMessageAt?: number;
  lastMessageSenderId?: string;
}

/**
 * Group member record
 * Collection: Groups/{groupId}/Members/{uid}
 */
export interface GroupMember {
  uid: string;
  role: GroupRole;
  joinedAt: number;
  lastReadAt?: number; // For read receipts
  // Denormalized user info for display
  displayName: string;
  username: string;
  avatarConfig: AvatarConfig;
}

/**
 * Group invite status
 */
export type GroupInviteStatus = "pending" | "accepted" | "declined" | "expired";

/**
 * Group invite record
 * Collection: GroupInvites/{inviteId}
 */
export interface GroupInvite {
  id: string;
  groupId: string;
  groupName: string; // Denormalized for display
  fromUid: string;
  fromDisplayName: string; // Denormalized for display
  toUid: string;
  status: GroupInviteStatus;
  createdAt: number;
  respondedAt?: number;
  expiresAt: number; // Invites expire after 7 days
}

/**
 * Group message (similar to DM Message but with group-specific fields)
 * Collection: Groups/{groupId}/Messages/{messageId}
 */
export interface GroupMessage {
  id: string;
  groupId: string;
  sender: string;
  senderDisplayName: string; // Denormalized for display
  senderAvatarConfig?: AvatarConfig; // Avatar config for display in group chats
  type: "text" | "image" | "scorecard" | "system" | "voice"; // system for join/leave notifications, voice for H11
  content: string;
  createdAt: number;
  // For image messages
  imagePath?: string;
  // For scorecard messages
  scorecard?: {
    gameId: GameType;
    score: number;
    playerName: string;
  };
  // For system messages
  systemType?:
    | "member_joined"
    | "member_left"
    | "member_removed"
    | "group_created"
    | "role_changed";
  systemMeta?: {
    targetUid?: string;
    targetDisplayName?: string;
    newRole?: GroupRole;
  };
  // H11: For voice messages
  voiceMetadata?: {
    durationMs: number;
    storagePath?: string;
    sizeBytes?: number;
  };
  // H6: For reply-to threading
  replyTo?: {
    messageId: string;
    senderId: string;
    senderName: string;
    textSnippet?: string;
    attachmentKind?: "image" | "voice";
  };
  // H7: Delete support
  hiddenFor?: string[];
  deletedForAll?: {
    by: string;
    at: number;
  };
}

/**
 * Extended Chat type with group support
 * For ChatListScreen to display both DMs and groups
 */
export interface ChatListItem {
  id: string;
  chatType: "dm" | "group";
  // For DMs
  members?: [string, string];
  otherUid?: string;
  otherUserProfile?: {
    username: string;
    displayName: string;
    avatarConfig: AvatarConfig;
  };
  // For Groups
  groupId?: string;
  groupName?: string;
  groupAvatarPath?: string;
  memberCount?: number;
  // Common fields
  lastMessageText?: string;
  lastMessageAt?: number;
  lastMessageSenderId?: string;
  createdAt: number;
  // Unread indicator
  hasUnread?: boolean;
}

/**
 * Group creation input
 */
export interface CreateGroupInput {
  name: string;
  memberUids: string[]; // Initial members to invite (excluding creator)
}

/**
 * Group limits
 */
export const GROUP_LIMITS = {
  MIN_MEMBERS: 3, // Including creator
  MAX_MEMBERS: 20,
  MAX_NAME_LENGTH: 50,
  INVITE_EXPIRY_DAYS: 7,
} as const;
