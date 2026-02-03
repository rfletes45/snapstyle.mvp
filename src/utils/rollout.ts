/**
 * Rollout Utilities
 *
 * Utilities for gradual feature rollouts, A/B testing, and beta user management.
 * Supports percentage-based rollouts with consistent user bucketing.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 8
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// =============================================================================
// TYPES
// =============================================================================

export interface RolloutConfig {
  /** Feature identifier */
  featureId: string;
  /** Percentage of users to enable (0-100) */
  percentage: number;
  /** List of user IDs always included (beta testers) */
  betaUsers?: string[];
  /** List of user IDs always excluded */
  excludedUsers?: string[];
  /** Start date for the rollout (ISO string) */
  startDate?: string;
  /** End date for the rollout (ISO string) */
  endDate?: string;
  /** Minimum app version required */
  minVersion?: string;
  /** Whether the feature is completely disabled */
  disabled?: boolean;
}

export interface RolloutCheckResult {
  enabled: boolean;
  reason:
    | "percentage"
    | "beta"
    | "excluded"
    | "date"
    | "version"
    | "disabled"
    | "unknown";
}

export interface BetaUserConfig {
  userId: string;
  enrolledAt: number;
  features: string[];
  feedbackEnabled: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const BETA_USERS_STORAGE_KEY = "@snapstyle/beta_users";
const ROLLOUT_OVERRIDES_KEY = "@snapstyle/rollout_overrides";

/**
 * Default rollout configurations
 * These can be overridden by Firebase Remote Config
 */
export const DEFAULT_ROLLOUTS: Record<string, RolloutConfig> = {
  digital_avatar: {
    featureId: "digital_avatar",
    percentage: 0, // Start at 0%, increase gradually
    betaUsers: [],
    disabled: false,
  },
  avatar_customizer: {
    featureId: "avatar_customizer",
    percentage: 0,
    betaUsers: [],
    disabled: false,
  },
  avatar_animations: {
    featureId: "avatar_animations",
    percentage: 100, // Enabled for everyone by default
    disabled: false,
  },
  premium_avatar_items: {
    featureId: "premium_avatar_items",
    percentage: 0,
    disabled: false,
  },
};

// =============================================================================
// HASHING UTILITIES
// =============================================================================

/**
 * Simple hash function for consistent user bucketing
 * Uses djb2 algorithm for fast, consistent hashing
 */
export function hashUserId(userId: string, salt: string = ""): number {
  const str = `${userId}:${salt}`;
  let hash = 5381;

  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }

  // Return positive integer between 0-99
  return Math.abs(hash) % 100;
}

/**
 * Check if a user falls within a percentage bucket
 * Uses consistent hashing so same user always gets same result
 */
export function isUserInPercentage(
  userId: string,
  percentage: number,
  featureId: string,
): boolean {
  if (percentage <= 0) return false;
  if (percentage >= 100) return true;

  // Use feature ID as salt for independent bucketing per feature
  const bucket = hashUserId(userId, featureId);
  return bucket < percentage;
}

// =============================================================================
// ROLLOUT CHECKING
// =============================================================================

/**
 * Check if a feature is enabled for a specific user
 *
 * @param featureId - The feature identifier
 * @param userId - The user ID to check
 * @param config - Optional custom rollout config (defaults to DEFAULT_ROLLOUTS)
 * @returns RolloutCheckResult with enabled status and reason
 */
export function isFeatureEnabled(
  featureId: string,
  userId: string,
  config?: RolloutConfig,
): RolloutCheckResult {
  const rolloutConfig = config || DEFAULT_ROLLOUTS[featureId];

  // No config found - default to disabled
  if (!rolloutConfig) {
    return { enabled: false, reason: "unknown" };
  }

  // Check if feature is completely disabled
  if (rolloutConfig.disabled) {
    return { enabled: false, reason: "disabled" };
  }

  // Check if user is explicitly excluded
  if (rolloutConfig.excludedUsers?.includes(userId)) {
    return { enabled: false, reason: "excluded" };
  }

  // Check if user is a beta tester
  if (rolloutConfig.betaUsers?.includes(userId)) {
    return { enabled: true, reason: "beta" };
  }

  // Check date range
  const now = new Date();
  if (rolloutConfig.startDate && new Date(rolloutConfig.startDate) > now) {
    return { enabled: false, reason: "date" };
  }
  if (rolloutConfig.endDate && new Date(rolloutConfig.endDate) < now) {
    return { enabled: false, reason: "date" };
  }

  // Check percentage-based rollout
  const inPercentage = isUserInPercentage(
    userId,
    rolloutConfig.percentage,
    featureId,
  );

  return { enabled: inPercentage, reason: "percentage" };
}

/**
 * Check multiple features at once
 */
export function checkFeatures(
  featureIds: string[],
  userId: string,
): Record<string, RolloutCheckResult> {
  const results: Record<string, RolloutCheckResult> = {};

  for (const featureId of featureIds) {
    results[featureId] = isFeatureEnabled(featureId, userId);
  }

  return results;
}

// =============================================================================
// BETA USER MANAGEMENT
// =============================================================================

// In-memory cache for beta users
let betaUsersCache: Set<string> | null = null;

/**
 * Load beta users from storage
 */
export async function loadBetaUsers(): Promise<Set<string>> {
  if (betaUsersCache) return betaUsersCache;

  try {
    const data = await AsyncStorage.getItem(BETA_USERS_STORAGE_KEY);
    if (data) {
      const userIds = JSON.parse(data) as string[];
      betaUsersCache = new Set(userIds);
    } else {
      betaUsersCache = new Set();
    }
  } catch (error) {
    console.warn("Failed to load beta users:", error);
    betaUsersCache = new Set();
  }

  return betaUsersCache;
}

/**
 * Check if a user is a beta tester
 */
export async function isBetaUser(userId: string): Promise<boolean> {
  const betaUsers = await loadBetaUsers();
  return betaUsers.has(userId);
}

/**
 * Add a user to the beta program
 */
export async function addBetaUser(userId: string): Promise<void> {
  const betaUsers = await loadBetaUsers();
  betaUsers.add(userId);
  betaUsersCache = betaUsers;

  try {
    await AsyncStorage.setItem(
      BETA_USERS_STORAGE_KEY,
      JSON.stringify([...betaUsers]),
    );
  } catch (error) {
    console.error("Failed to save beta users:", error);
  }
}

/**
 * Remove a user from the beta program
 */
export async function removeBetaUser(userId: string): Promise<void> {
  const betaUsers = await loadBetaUsers();
  betaUsers.delete(userId);
  betaUsersCache = betaUsers;

  try {
    await AsyncStorage.setItem(
      BETA_USERS_STORAGE_KEY,
      JSON.stringify([...betaUsers]),
    );
  } catch (error) {
    console.error("Failed to save beta users:", error);
  }
}

/**
 * Get all beta users
 */
export async function getBetaUsers(): Promise<string[]> {
  const betaUsers = await loadBetaUsers();
  return [...betaUsers];
}

// =============================================================================
// LOCAL OVERRIDES (for testing)
// =============================================================================

// In-memory cache for local overrides
let overridesCache: Record<string, boolean> | null = null;

/**
 * Load local feature overrides (for development/testing)
 */
export async function loadLocalOverrides(): Promise<Record<string, boolean>> {
  if (overridesCache) return overridesCache;

  try {
    const data = await AsyncStorage.getItem(ROLLOUT_OVERRIDES_KEY);
    overridesCache = data ? JSON.parse(data) : {};
  } catch (error) {
    console.warn("Failed to load rollout overrides:", error);
    overridesCache = {};
  }

  // Ensure we return a valid object (TypeScript narrowing)
  const result = overridesCache ?? {};
  overridesCache = result;
  return result;
}

/**
 * Set a local override for a feature (testing only)
 */
export async function setLocalOverride(
  featureId: string,
  enabled: boolean | null,
): Promise<void> {
  const overrides = await loadLocalOverrides();

  if (enabled === null) {
    delete overrides[featureId];
  } else {
    overrides[featureId] = enabled;
  }

  overridesCache = overrides;

  try {
    await AsyncStorage.setItem(
      ROLLOUT_OVERRIDES_KEY,
      JSON.stringify(overrides),
    );
  } catch (error) {
    console.error("Failed to save rollout override:", error);
  }
}

/**
 * Get local override for a feature
 */
export async function getLocalOverride(
  featureId: string,
): Promise<boolean | undefined> {
  const overrides = await loadLocalOverrides();
  return overrides[featureId];
}

/**
 * Clear all local overrides
 */
export async function clearLocalOverrides(): Promise<void> {
  overridesCache = {};
  try {
    await AsyncStorage.removeItem(ROLLOUT_OVERRIDES_KEY);
  } catch (error) {
    console.error("Failed to clear rollout overrides:", error);
  }
}

// =============================================================================
// ROLLOUT PERCENTAGE UTILITIES
// =============================================================================

/**
 * Calculate the percentage of users in a bucket
 * Useful for analytics and monitoring rollout progress
 */
export function calculateBucketDistribution(
  userIds: string[],
  featureId: string,
): Record<number, number> {
  const distribution: Record<number, number> = {};

  // Initialize all buckets
  for (let i = 0; i < 100; i++) {
    distribution[i] = 0;
  }

  // Count users in each bucket
  for (const userId of userIds) {
    const bucket = hashUserId(userId, featureId);
    distribution[bucket]++;
  }

  return distribution;
}

/**
 * Estimate the number of users that would be affected by a rollout percentage
 */
export function estimateAffectedUsers(
  totalUsers: number,
  percentage: number,
): number {
  return Math.round(totalUsers * (percentage / 100));
}

// =============================================================================
// ROLLOUT STAGES
// =============================================================================

export type RolloutStage =
  | "disabled"
  | "internal"
  | "beta"
  | "canary"
  | "gradual"
  | "general"
  | "full";

export interface RolloutStageConfig {
  stage: RolloutStage;
  percentage: number;
  description: string;
}

/**
 * Predefined rollout stages for consistent rollout strategy
 */
export const ROLLOUT_STAGES: Record<RolloutStage, RolloutStageConfig> = {
  disabled: {
    stage: "disabled",
    percentage: 0,
    description: "Feature is completely disabled",
  },
  internal: {
    stage: "internal",
    percentage: 0, // Beta users only
    description: "Internal testing only",
  },
  beta: {
    stage: "beta",
    percentage: 5,
    description: "Beta testers + 5% of users",
  },
  canary: {
    stage: "canary",
    percentage: 10,
    description: "10% of users (canary release)",
  },
  gradual: {
    stage: "gradual",
    percentage: 50,
    description: "50% of users (gradual rollout)",
  },
  general: {
    stage: "general",
    percentage: 90,
    description: "90% of users (general availability)",
  },
  full: {
    stage: "full",
    percentage: 100,
    description: "100% of users (full rollout)",
  },
};

/**
 * Get the current rollout stage based on percentage
 */
export function getRolloutStage(percentage: number): RolloutStage {
  if (percentage <= 0) return "disabled";
  if (percentage <= 5) return "beta";
  if (percentage <= 10) return "canary";
  if (percentage <= 50) return "gradual";
  if (percentage <= 90) return "general";
  return "full";
}
