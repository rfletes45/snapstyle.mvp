/**
 * Avatar Deprecation Utilities
 *
 * Utilities for handling legacy avatar system deprecation,
 * user notifications, and migration prompts.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 8
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { trackAvatarMigration } from "./avatarAnalytics";

// =============================================================================
// TYPES
// =============================================================================

export interface DeprecationStatus {
  /** Whether the legacy system is deprecated */
  isDeprecated: boolean;
  /** Whether user has been warned about deprecation */
  hasBeenWarned: boolean;
  /** When the user was first warned */
  firstWarnedAt?: number;
  /** Number of times user has seen the warning */
  warningCount: number;
  /** Whether user has dismissed migration prompt */
  dismissedMigration: boolean;
  /** When user dismissed migration */
  dismissedAt?: number;
  /** Scheduled removal date (if any) */
  removalDate?: string;
  /** Days until removal */
  daysUntilRemoval?: number;
}

export interface MigrationPromptConfig {
  /** Prompt title */
  title: string;
  /** Prompt message */
  message: string;
  /** Primary action label */
  primaryAction: string;
  /** Secondary action label */
  secondaryAction: string;
  /** Show "Don't ask again" option */
  showDontAskAgain: boolean;
  /** Urgency level affects styling */
  urgency: "low" | "medium" | "high";
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEPRECATION_STORAGE_KEY = "@snapstyle/avatar_deprecation";
const MAX_WARNINGS_BEFORE_FORCE = 5;

// Default removal date (3 months from now for planning)
const DEFAULT_REMOVAL_DATE = (() => {
  const date = new Date();
  date.setMonth(date.getMonth() + 3);
  return date.toISOString().split("T")[0];
})();

// =============================================================================
// DEPRECATION STATUS
// =============================================================================

// In-memory cache
let deprecationStatusCache: DeprecationStatus | null = null;

/**
 * Load deprecation status from storage
 */
export async function loadDeprecationStatus(): Promise<DeprecationStatus> {
  if (deprecationStatusCache) return deprecationStatusCache;

  try {
    const data = await AsyncStorage.getItem(DEPRECATION_STORAGE_KEY);
    if (data) {
      deprecationStatusCache = JSON.parse(data);
    } else {
      deprecationStatusCache = getDefaultDeprecationStatus();
    }
  } catch (error) {
    console.warn("Failed to load deprecation status:", error);
    deprecationStatusCache = getDefaultDeprecationStatus();
  }

  // Ensure we have a valid status (TypeScript narrowing)
  const status = deprecationStatusCache ?? getDefaultDeprecationStatus();

  // Calculate days until removal
  if (status.removalDate) {
    const removal = new Date(status.removalDate);
    const now = new Date();
    const diffTime = removal.getTime() - now.getTime();
    status.daysUntilRemoval = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  deprecationStatusCache = status;
  return status;
}

/**
 * Save deprecation status to storage
 */
async function saveDeprecationStatus(status: DeprecationStatus): Promise<void> {
  deprecationStatusCache = status;
  try {
    await AsyncStorage.setItem(DEPRECATION_STORAGE_KEY, JSON.stringify(status));
  } catch (error) {
    console.error("Failed to save deprecation status:", error);
  }
}

/**
 * Get default deprecation status
 */
function getDefaultDeprecationStatus(): DeprecationStatus {
  return {
    isDeprecated: true, // Legacy is now deprecated
    hasBeenWarned: false,
    warningCount: 0,
    dismissedMigration: false,
    removalDate: DEFAULT_REMOVAL_DATE,
  };
}

// =============================================================================
// DEPRECATION WARNINGS
// =============================================================================

/**
 * Log a deprecation warning (for developers)
 */
export function logDeprecationWarning(
  component: string,
  message?: string,
): void {
  if (__DEV__) {
    const defaultMessage = `${component} is deprecated. Please migrate to the new digital avatar system.`;
    console.warn(
      `[DEPRECATED] ${message || defaultMessage}\n` +
        "See: docs/DIGITAL_AVATAR_SYSTEM_PLAN.md#migration",
    );
  }
}

/**
 * Mark that user has seen the deprecation warning
 */
export async function markWarningShown(): Promise<void> {
  const status = await loadDeprecationStatus();
  const updatedStatus: DeprecationStatus = {
    ...status,
    hasBeenWarned: true,
    firstWarnedAt: status.firstWarnedAt || Date.now(),
    warningCount: status.warningCount + 1,
  };
  await saveDeprecationStatus(updatedStatus);
}

/**
 * Check if we should show the migration prompt
 */
export async function shouldShowMigrationPrompt(): Promise<boolean> {
  const status = await loadDeprecationStatus();

  // Don't show if already dismissed and not urgent
  if (status.dismissedMigration) {
    // But show again if removal is imminent (< 7 days)
    if (status.daysUntilRemoval && status.daysUntilRemoval < 7) {
      return true;
    }
    return false;
  }

  // Show if deprecated and hasn't exceeded warning limit
  return status.isDeprecated && status.warningCount < MAX_WARNINGS_BEFORE_FORCE;
}

/**
 * Mark migration prompt as dismissed
 */
export async function dismissMigrationPrompt(
  dontAskAgain: boolean = false,
): Promise<void> {
  const status = await loadDeprecationStatus();
  const updatedStatus: DeprecationStatus = {
    ...status,
    dismissedMigration: dontAskAgain,
    dismissedAt: Date.now(),
  };
  await saveDeprecationStatus(updatedStatus);

  trackAvatarMigration("skipped", {
    dontAskAgain,
    warningCount: status.warningCount,
  });
}

/**
 * Reset dismissal (e.g., when removal date approaches)
 */
export async function resetDismissal(): Promise<void> {
  const status = await loadDeprecationStatus();
  const updatedStatus: DeprecationStatus = {
    ...status,
    dismissedMigration: false,
    dismissedAt: undefined,
  };
  await saveDeprecationStatus(updatedStatus);
}

// =============================================================================
// MIGRATION PROMPT CONFIGURATION
// =============================================================================

/**
 * Get migration prompt configuration based on urgency
 */
export async function getMigrationPromptConfig(): Promise<MigrationPromptConfig> {
  const status = await loadDeprecationStatus();
  const daysLeft = status.daysUntilRemoval || 90;

  // Urgent - less than 7 days
  if (daysLeft <= 7) {
    return {
      title: "Action Required: Update Your Avatar",
      message:
        `The classic avatar system will be removed in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. ` +
        "Please update to the new digital avatar to keep your customizations.",
      primaryAction: "Update Now",
      secondaryAction: "Remind Me Later",
      showDontAskAgain: false, // Can't dismiss when urgent
      urgency: "high",
    };
  }

  // Medium - less than 30 days
  if (daysLeft <= 30) {
    return {
      title: "Update Your Avatar",
      message:
        "The classic avatar system is being retired. " +
        "Upgrade to the new digital avatar for more customization options!",
      primaryAction: "Upgrade Now",
      secondaryAction: "Maybe Later",
      showDontAskAgain: true,
      urgency: "medium",
    };
  }

  // Low - more than 30 days
  return {
    title: "New Avatar System Available!",
    message:
      "Create a personalized digital avatar with tons of customization options. " +
      "Your current avatar will continue working, but the new system is much better!",
    primaryAction: "Try It Out",
    secondaryAction: "Not Now",
    showDontAskAgain: true,
    urgency: "low",
  };
}

// =============================================================================
// DEPRECATION TIMELINE
// =============================================================================

export interface DeprecationMilestone {
  date: string;
  event: string;
  description: string;
  completed: boolean;
}

/**
 * Get deprecation timeline milestones
 */
export function getDeprecationTimeline(): DeprecationMilestone[] {
  const now = new Date();

  return [
    {
      date: "2026-02-03",
      event: "Digital Avatar Released",
      description: "New digital avatar system available for all users",
      completed: true,
    },
    {
      date: "2026-02-17",
      event: "Migration Prompts Begin",
      description: "Users with legacy avatars see upgrade prompts",
      completed: new Date("2026-02-17") <= now,
    },
    {
      date: "2026-03-03",
      event: "Legacy Deprecation Notice",
      description: "Legacy avatar marked as deprecated in code",
      completed: new Date("2026-03-03") <= now,
    },
    {
      date: "2026-04-03",
      event: "Migration Reminders",
      description: "Increased frequency of migration reminders",
      completed: new Date("2026-04-03") <= now,
    },
    {
      date: "2026-05-03",
      event: "Legacy Avatar Removal",
      description:
        "Legacy avatar system removed, auto-migration for remaining users",
      completed: new Date("2026-05-03") <= now,
    },
  ];
}

// =============================================================================
// LEGACY USAGE TRACKING
// =============================================================================

/**
 * Track legacy avatar usage for analytics
 */
export function trackLegacyAvatarUsage(userId: string): void {
  if (!__DEV__) {
    // In production, send to analytics
    // analytics.track('legacy_avatar_rendered', { userId });
  }

  // Log in development
  if (__DEV__) {
    console.log("[LegacyAvatar] Rendered for user:", userId);
  }
}

/**
 * Check if user needs migration
 */
export function userNeedsMigration(userData: {
  avatarConfig?: { baseColor?: string };
  digitalAvatar?: { version?: number };
}): boolean {
  // Has legacy config but no digital avatar
  return (
    !!userData.avatarConfig?.baseColor &&
    (!userData.digitalAvatar || userData.digitalAvatar.version !== 2)
  );
}

// =============================================================================
// CLEANUP
// =============================================================================

/**
 * Clear all deprecation data (for testing)
 */
export async function clearDeprecationData(): Promise<void> {
  deprecationStatusCache = null;
  try {
    await AsyncStorage.removeItem(DEPRECATION_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear deprecation data:", error);
  }
}
