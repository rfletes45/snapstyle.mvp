/**
 * ProfileThemeContext
 *
 * Context for managing profile theme inheritance.
 * Allows viewing other profiles in their theme or your own theme.
 *
 * Features:
 * - Load theme for current profile being viewed
 * - Support theme inheritance preference
 * - Smooth theme transitions
 *
 * @module contexts/ProfileThemeContext
 */

import { getThemeById, PROFILE_THEMES } from "@/data/profileThemes";
import { getEquippedTheme } from "@/services/profileThemes";
import type { ProfileTheme } from "@/types/profile";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";


import { createLogger } from "@/utils/log";
const logger = createLogger("contexts/ProfileThemeContext");
// =============================================================================
// Types
// =============================================================================

export type ThemePreference = "their_theme" | "my_theme";

export interface ProfileThemeContextValue {
  /** The effective theme to display (based on preference) */
  effectiveTheme: ProfileTheme;
  /** Whether using the profile owner's theme */
  usingOwnerTheme: boolean;
  /** The profile owner's theme */
  ownerTheme: ProfileTheme;
  /** The viewer's own theme */
  viewerTheme: ProfileTheme;
  /** Current theme preference */
  themePreference: ThemePreference;
  /** Whether theme is loading */
  isLoading: boolean;
  /** Switch to owner's theme */
  useOwnerTheme: () => void;
  /** Switch to viewer's theme */
  useViewerTheme: () => void;
  /** Toggle between themes */
  toggleTheme: () => void;
  /** Set theme preference */
  setThemePreference: (pref: ThemePreference) => void;
}

// Default theme if none found
const DEFAULT_THEME =
  PROFILE_THEMES.find((t) => t.id === "default") || PROFILE_THEMES[0];

// =============================================================================
// Context
// =============================================================================

const ProfileThemeContext = createContext<ProfileThemeContextValue | undefined>(
  undefined,
);

// =============================================================================
// Provider Props
// =============================================================================

export interface ProfileThemeProviderProps {
  /** The user ID whose profile is being viewed */
  profileUserId: string;
  /** The current viewer's user ID */
  viewerUserId?: string;
  /** Whether this is the viewer's own profile */
  isOwnProfile?: boolean;
  /** Initial theme preference */
  initialPreference?: ThemePreference;
  /** Children to render */
  children: React.ReactNode;
}

// =============================================================================
// Provider Component
// =============================================================================

export function ProfileThemeProvider({
  profileUserId,
  viewerUserId,
  isOwnProfile = false,
  initialPreference = "their_theme",
  children,
}: ProfileThemeProviderProps) {
  // State
  const [ownerThemeId, setOwnerThemeId] = useState<string | null>(null);
  const [viewerThemeId, setViewerThemeId] = useState<string | null>(null);
  const [themePreference, setThemePreference] =
    useState<ThemePreference>(initialPreference);
  const [isLoading, setIsLoading] = useState(true);

  // Load themes on mount
  useEffect(() => {
    loadThemes();
  }, [profileUserId, viewerUserId]);

  const loadThemes = async () => {
    setIsLoading(true);
    try {
      // Load profile owner's theme
      const ownerTheme = await getEquippedTheme(profileUserId);
      setOwnerThemeId(ownerTheme || "default");

      // Load viewer's theme if different user
      if (viewerUserId && viewerUserId !== profileUserId) {
        const viewerTheme = await getEquippedTheme(viewerUserId);
        setViewerThemeId(viewerTheme || "default");
      } else {
        // Same user, use same theme
        setViewerThemeId(ownerTheme || "default");
      }
    } catch (error) {
      logger.error("[ProfileThemeContext] Error loading themes:", error);
      setOwnerThemeId("default");
      setViewerThemeId("default");
    } finally {
      setIsLoading(false);
    }
  };

  // Resolve theme objects
  const ownerTheme = useMemo(() => {
    return getThemeById(ownerThemeId || "default") || DEFAULT_THEME;
  }, [ownerThemeId]);

  const viewerTheme = useMemo(() => {
    return getThemeById(viewerThemeId || "default") || DEFAULT_THEME;
  }, [viewerThemeId]);

  // Calculate effective theme based on preference
  const effectiveTheme = useMemo(() => {
    // If viewing own profile, always use own theme
    if (isOwnProfile) {
      return ownerTheme;
    }

    // Otherwise, respect preference
    return themePreference === "their_theme" ? ownerTheme : viewerTheme;
  }, [isOwnProfile, themePreference, ownerTheme, viewerTheme]);

  const usingOwnerTheme = effectiveTheme.id === ownerTheme.id;

  // Theme switching functions
  const useOwnerTheme = useCallback(() => {
    setThemePreference("their_theme");
  }, []);

  const useViewerTheme = useCallback(() => {
    setThemePreference("my_theme");
  }, []);

  const toggleTheme = useCallback(() => {
    setThemePreference((prev) =>
      prev === "their_theme" ? "my_theme" : "their_theme",
    );
  }, []);

  // Context value
  const contextValue = useMemo<ProfileThemeContextValue>(
    () => ({
      effectiveTheme,
      usingOwnerTheme,
      ownerTheme,
      viewerTheme,
      themePreference,
      isLoading,
      useOwnerTheme,
      useViewerTheme,
      toggleTheme,
      setThemePreference,
    }),
    [
      effectiveTheme,
      usingOwnerTheme,
      ownerTheme,
      viewerTheme,
      themePreference,
      isLoading,
      useOwnerTheme,
      useViewerTheme,
      toggleTheme,
    ],
  );

  return (
    <ProfileThemeContext.Provider value={contextValue}>
      {children}
    </ProfileThemeContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access profile theme context
 */
export function useProfileTheme(): ProfileThemeContextValue {
  const context = useContext(ProfileThemeContext);

  if (!context) {
    throw new Error(
      "useProfileTheme must be used within a ProfileThemeProvider",
    );
  }

  return context;
}

/**
 * Hook to get theme colors directly
 * Useful for styling components based on effective theme
 */
export function useProfileThemeColors() {
  const { effectiveTheme } = useProfileTheme();
  return effectiveTheme.colors;
}

// =============================================================================
// Export
// =============================================================================

export default ProfileThemeContext;
