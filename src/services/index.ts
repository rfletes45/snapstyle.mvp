/**
 * Services barrel export
 *
 * Due to overlapping function names across service modules, this barrel
 * only exports non-conflicting modules. For modules with naming conflicts,
 * import directly from the specific service file.
 *
 * Modules with conflicts (import directly):
 * - chatMembers vs chat (hasUnreadMessages)
 * - storage vs attachments (getImageDimensions)
 * - messageList vs chatV2 (subscribeToGroupMessages)
 * - groups vs groupMembers (subscribeToGroupMembers)
 * - shop vs cosmetics (getRarityColor)
 * - groups vs gameInvites vs turnBasedGames (getPendingInvites, sendGameInvite)
 * - gameStats vs leaderboards (getPlayerRank)
 * - achievements vs gameAchievements (checkStreakAchievements, getAchievementsByCategory)
 */

// Core Firebase services
export * from "./auth";
export * from "./firebase";

// User and profile services
export * from "./blocking";
export * from "./friends";
export * from "./users";

// Social features
export * from "./moderation";
export * from "./notifications";
export * from "./reporting";
export * from "./snaps";
export * from "./stories";

// Economy
export * from "./economy";

// Tasks
export * from "./tasks";

// Badge service (Profile Overhaul)
export * from "./badges";

// Profile Frames service (Profile Overhaul Phase 4)
export * from "./profileFrames";

// Profile Themes service (Profile Overhaul Phase 5)
export * from "./profileThemes";

// Chat Bubbles service (Profile Overhaul Phase 5)
export * from "./chatBubbles";

// IAP and Bundles service (Profile Overhaul Phase 6)
export * from "./bundles";
export * from "./iap";

// Avatar service (Digital Avatar System Phase 6)
export * from "./avatarService";

// Avatar analytics and deprecation (Digital Avatar System Phase 8)
export * from "./avatarAnalytics";
export * from "./avatarDeprecation";

// Shop services (Shop Overhaul)
// Note: Import pointsShop and premiumShop directly due to potential naming conflicts
// export * from "./pointsShop";
// export * from "./premiumShop";
