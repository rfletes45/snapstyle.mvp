/**
 * Avatar Rollout Hook
 *
 * React hook for managing avatar system rollout state,
 * feature flags, and user-specific rollout decisions.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 8
 */

import { avatarAnalytics } from "@/services/avatarAnalytics";
import {
  shouldShowMigrationPrompt,
  userNeedsMigration,
} from "@/services/avatarDeprecation";
import { getAuthInstance } from "@/services/firebase";
import {
  getLocalOverride,
  getRolloutStage,
  isBetaUser,
  isFeatureEnabled,
  type RolloutCheckResult,
  type RolloutStage,
} from "@/utils/rollout";
import { useCallback, useEffect, useState } from "react";
import { AVATAR_FEATURES } from "../../constants/featureFlags";

// =============================================================================
// TYPES
// =============================================================================

export interface AvatarRolloutState {
  /** Whether digital avatars are enabled for this user */
  isDigitalAvatarEnabled: boolean;
  /** Whether avatar customizer is enabled for this user */
  isCustomizerEnabled: boolean;
  /** Whether avatar animations are enabled */
  isAnimationsEnabled: boolean;
  /** Whether user is a beta tester */
  isBetaUser: boolean;
  /** Current rollout stage for digital avatars */
  rolloutStage: RolloutStage;
  /** Whether user needs to migrate from legacy avatar */
  needsMigration: boolean;
  /** Whether to show migration prompt */
  shouldShowMigrationPrompt: boolean;
  /** Whether rollout state has finished loading */
  isLoaded: boolean;
  /** Reason for feature enable/disable */
  enableReason: RolloutCheckResult["reason"] | null;
}

export interface UseAvatarRolloutReturn extends AvatarRolloutState {
  /** Refresh rollout state */
  refresh: () => Promise<void>;
  /** Check if a specific feature is enabled */
  isFeatureEnabled: (featureId: string) => boolean;
  /** Get feature flag value */
  getFeatureFlag: <K extends keyof typeof AVATAR_FEATURES>(
    key: K,
  ) => (typeof AVATAR_FEATURES)[K];
}

// =============================================================================
// DEFAULT STATE
// =============================================================================

const defaultState: AvatarRolloutState = {
  isDigitalAvatarEnabled: false,
  isCustomizerEnabled: false,
  isAnimationsEnabled: AVATAR_FEATURES.AVATAR_ANIMATIONS,
  isBetaUser: false,
  rolloutStage: "disabled",
  needsMigration: false,
  shouldShowMigrationPrompt: false,
  isLoaded: false,
  enableReason: null,
};

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for managing avatar rollout state
 *
 * @param userData - Optional user data for migration checking
 * @returns Rollout state and helper functions
 */
export function useAvatarRollout(
  userData?: {
    avatarConfig?: { baseColor?: string };
    digitalAvatar?: { version?: number };
  } | null,
): UseAvatarRolloutReturn {
  const [state, setState] = useState<AvatarRolloutState>(defaultState);

  /**
   * Load rollout state
   */
  const loadRolloutState = useCallback(async () => {
    try {
      const auth = getAuthInstance();
      const userId = auth.currentUser?.uid;

      if (!userId) {
        // No user - use default feature flags only
        setState({
          isDigitalAvatarEnabled: AVATAR_FEATURES.DIGITAL_AVATAR_ENABLED,
          isCustomizerEnabled: AVATAR_FEATURES.AVATAR_CUSTOMIZER,
          isAnimationsEnabled: AVATAR_FEATURES.AVATAR_ANIMATIONS,
          isBetaUser: false,
          rolloutStage: AVATAR_FEATURES.DIGITAL_AVATAR_ENABLED
            ? "full"
            : "disabled",
          needsMigration: false,
          shouldShowMigrationPrompt: false,
          isLoaded: true,
          enableReason: "percentage",
        });
        return;
      }

      // Check local override first (for testing)
      const localOverride = await getLocalOverride("digital_avatar");
      if (localOverride !== undefined) {
        setState((prev) => ({
          ...prev,
          isDigitalAvatarEnabled: localOverride,
          isLoaded: true,
          enableReason: "beta", // Local override treated as beta
        }));
        return;
      }

      // Check beta status
      const betaStatus = await isBetaUser(userId);

      // Check feature rollout status
      const digitalAvatarCheck = isFeatureEnabled("digital_avatar", userId);
      const customizerCheck = isFeatureEnabled("avatar_customizer", userId);

      // Check migration needs
      const needsMigration = userData ? userNeedsMigration(userData) : false;
      const showMigrationPrompt =
        needsMigration && (await shouldShowMigrationPrompt());

      // Determine final enabled state
      // Feature flags take precedence, then rollout
      const isEnabled =
        AVATAR_FEATURES.DIGITAL_AVATAR_ENABLED ||
        digitalAvatarCheck.enabled ||
        betaStatus;

      // Track rollout check
      avatarAnalytics.trackRolloutCheck(
        "digital_avatar",
        isEnabled,
        digitalAvatarCheck.reason,
      );

      setState({
        isDigitalAvatarEnabled: isEnabled,
        isCustomizerEnabled:
          AVATAR_FEATURES.AVATAR_CUSTOMIZER || customizerCheck.enabled,
        isAnimationsEnabled: AVATAR_FEATURES.AVATAR_ANIMATIONS,
        isBetaUser: betaStatus,
        rolloutStage: getRolloutStage(
          isEnabled ? 100 : 0, // Simplified - use actual percentage in production
        ),
        needsMigration,
        shouldShowMigrationPrompt: showMigrationPrompt,
        isLoaded: true,
        enableReason: digitalAvatarCheck.reason,
      });
    } catch (error) {
      console.error("Error loading avatar rollout state:", error);
      // Fall back to feature flags
      setState({
        isDigitalAvatarEnabled: AVATAR_FEATURES.DIGITAL_AVATAR_ENABLED,
        isCustomizerEnabled: AVATAR_FEATURES.AVATAR_CUSTOMIZER,
        isAnimationsEnabled: AVATAR_FEATURES.AVATAR_ANIMATIONS,
        isBetaUser: false,
        rolloutStage: "disabled",
        needsMigration: false,
        shouldShowMigrationPrompt: false,
        isLoaded: true,
        enableReason: "unknown",
      });
    }
  }, [userData]);

  // Load on mount
  useEffect(() => {
    loadRolloutState();
  }, [loadRolloutState]);

  /**
   * Check if a specific feature is enabled
   */
  const checkFeatureEnabled = useCallback((featureId: string): boolean => {
    const auth = getAuthInstance();
    const userId = auth.currentUser?.uid;

    if (!userId) {
      // No user - check feature flags only
      const featureKey =
        featureId.toUpperCase() as keyof typeof AVATAR_FEATURES;
      const flagValue = AVATAR_FEATURES[featureKey];
      // Handle boolean flags only, skip number values
      return typeof flagValue === "boolean" ? flagValue : false;
    }

    const result = isFeatureEnabled(featureId, userId);
    return result.enabled;
  }, []);

  /**
   * Get feature flag value
   */
  const getFeatureFlag = useCallback(
    <K extends keyof typeof AVATAR_FEATURES>(
      key: K,
    ): (typeof AVATAR_FEATURES)[K] => {
      return AVATAR_FEATURES[key];
    },
    [],
  );

  return {
    ...state,
    refresh: loadRolloutState,
    isFeatureEnabled: checkFeatureEnabled,
    getFeatureFlag,
  };
}

// =============================================================================
// SIMPLER HOOKS FOR SPECIFIC CHECKS
// =============================================================================

/**
 * Simple hook to check if digital avatars are enabled
 */
export function useIsDigitalAvatarEnabled(): boolean {
  const { isDigitalAvatarEnabled, isLoaded } = useAvatarRollout();

  // Return feature flag while loading
  if (!isLoaded) {
    return AVATAR_FEATURES.DIGITAL_AVATAR_ENABLED;
  }

  return isDigitalAvatarEnabled;
}

/**
 * Simple hook to check if avatar customizer is enabled
 */
export function useIsCustomizerEnabled(): boolean {
  const { isCustomizerEnabled, isLoaded } = useAvatarRollout();

  if (!isLoaded) {
    return AVATAR_FEATURES.AVATAR_CUSTOMIZER;
  }

  return isCustomizerEnabled;
}

/**
 * Simple hook to check if user needs migration
 */
export function useNeedsMigration(
  userData?: {
    avatarConfig?: { baseColor?: string };
    digitalAvatar?: { version?: number };
  } | null,
): boolean {
  const { needsMigration, isLoaded } = useAvatarRollout(userData);

  if (!isLoaded) {
    return false;
  }

  return needsMigration;
}

// =============================================================================
// CONTEXT (for provider pattern)
// =============================================================================

import { createContext, useContext, type ReactNode } from "react";

const AvatarRolloutContext = createContext<UseAvatarRolloutReturn | null>(null);

interface AvatarRolloutProviderProps {
  children: ReactNode;
  userData?: {
    avatarConfig?: { baseColor?: string };
    digitalAvatar?: { version?: number };
  } | null;
}

/**
 * Provider component for avatar rollout context
 */
export function AvatarRolloutProvider({
  children,
  userData,
}: AvatarRolloutProviderProps): React.ReactElement {
  const rollout = useAvatarRollout(userData);

  return (
    <AvatarRolloutContext.Provider value={rollout}>
      {children}
    </AvatarRolloutContext.Provider>
  );
}

/**
 * Hook to use avatar rollout context
 */
export function useAvatarRolloutContext(): UseAvatarRolloutReturn {
  const context = useContext(AvatarRolloutContext);

  if (!context) {
    throw new Error(
      "useAvatarRolloutContext must be used within AvatarRolloutProvider",
    );
  }

  return context;
}

export default useAvatarRollout;
