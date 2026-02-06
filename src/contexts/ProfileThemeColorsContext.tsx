/**
 * ProfileThemeColorsContext
 *
 * Context for providing profile theme colors to child components.
 * This allows components within a profile screen to use the equipped
 * profile theme colors instead of the global app theme.
 *
 * Features:
 * - Provides profile theme colors (text, surface, primary, etc.)
 * - Falls back to app theme when no profile theme is active
 * - Works with both own profile and viewing other profiles
 *
 * @module contexts/ProfileThemeColorsContext
 */

import type { GradientConfig, ProfileTheme } from "@/types/profile";
import React, { createContext, useContext, useMemo } from "react";
import { useTheme } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

/**
 * Profile theme colors interface
 * Matches the colors object from ProfileTheme but ensures all values are strings
 */
export interface ProfileThemeColors {
  /** Main background color (resolved from gradient if needed) */
  background: string;
  /** Surface color for cards, containers */
  surface: string;
  /** Variant surface for secondary containers */
  surfaceVariant: string;
  /** Primary brand/accent color */
  primary: string;
  /** Secondary accent color */
  secondary: string;
  /** Main text color */
  text: string;
  /** Secondary/muted text color */
  textSecondary: string;
  /** Outline/border color */
  outline: string;
  /** Error color (from app theme) */
  error: string;
  /** On-error text color */
  onError: string;
  /** Whether this is using profile theme (true) or fallback app theme (false) */
  isProfileTheme: boolean;
}

export interface ProfileThemeColorsContextValue {
  /** Profile theme colors for styling */
  colors: ProfileThemeColors;
  /** The original profile theme (may be null) */
  theme: ProfileTheme | null;
}

// =============================================================================
// Context
// =============================================================================

const ProfileThemeColorsContext = createContext<
  ProfileThemeColorsContextValue | undefined
>(undefined);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract the primary color from a background that may be a gradient
 */
function resolveBackgroundColor(
  background: string | GradientConfig | undefined,
): string {
  if (!background) return "#1a1a2e";

  if (typeof background === "string") {
    return background;
  }

  // For gradients, use the first color
  if (background.colors && background.colors.length > 0) {
    return background.colors[0];
  }

  return "#1a1a2e";
}

/**
 * Generate a lighter/darker variant for outline color
 */
function generateOutlineColor(surfaceVariant: string, isDark: boolean): string {
  // Simple heuristic - if surface is dark, use a lighter outline, vice versa
  // This is a fallback since profile themes don't define outline
  return isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.12)";
}

/**
 * Determine if a color is dark based on luminance
 */
function isColorDark(hexColor: string): boolean {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

// =============================================================================
// Provider Component
// =============================================================================

export interface ProfileThemeColorsProviderProps {
  /** The profile theme to use (null for app theme fallback) */
  theme: ProfileTheme | null | undefined;
  /** Children to render */
  children: React.ReactNode;
}

export function ProfileThemeColorsProvider({
  theme,
  children,
}: ProfileThemeColorsProviderProps) {
  const appTheme = useTheme();

  // Extract only the error colors we need from appTheme to avoid unnecessary re-renders
  const errorColor = appTheme.colors.error;
  const onErrorColor = appTheme.colors.onError;

  const value = useMemo<ProfileThemeColorsContextValue>(() => {
    // If no profile theme, use app theme colors
    if (!theme) {
      return {
        colors: {
          background: appTheme.colors.background,
          surface: appTheme.colors.surface,
          surfaceVariant: appTheme.colors.surfaceVariant,
          primary: appTheme.colors.primary,
          secondary: appTheme.colors.secondary,
          text: appTheme.colors.onSurface,
          textSecondary: appTheme.colors.onSurfaceVariant,
          outline: appTheme.colors.outline,
          error: errorColor,
          onError: onErrorColor,
          isProfileTheme: false,
        },
        theme: null,
      };
    }

    // Use profile theme colors
    const backgroundColor = resolveBackgroundColor(theme.colors.background);
    const isDark = isColorDark(backgroundColor);

    return {
      colors: {
        background: backgroundColor,
        surface: theme.colors.surface,
        surfaceVariant: theme.colors.surfaceVariant,
        primary: theme.colors.primary,
        secondary: theme.colors.secondary,
        text: theme.colors.text,
        textSecondary: theme.colors.textSecondary,
        outline: generateOutlineColor(theme.colors.surfaceVariant, isDark),
        error: errorColor, // Always use app theme for error
        onError: onErrorColor, // Always use app theme for onError
        isProfileTheme: true,
      },
      theme,
    };
  }, [theme, appTheme, errorColor, onErrorColor]);

  return (
    <ProfileThemeColorsContext.Provider value={value}>
      {children}
    </ProfileThemeColorsContext.Provider>
  );
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to access profile theme colors
 * Falls back to app theme if not within a ProfileThemeColorsProvider
 */
export function useProfileThemeColors(): ProfileThemeColors {
  const context = useContext(ProfileThemeColorsContext);
  const appTheme = useTheme();

  // If not in context, return app theme colors
  if (!context) {
    return {
      background: appTheme.colors.background,
      surface: appTheme.colors.surface,
      surfaceVariant: appTheme.colors.surfaceVariant,
      primary: appTheme.colors.primary,
      secondary: appTheme.colors.secondary,
      text: appTheme.colors.onSurface,
      textSecondary: appTheme.colors.onSurfaceVariant,
      outline: appTheme.colors.outline,
      error: appTheme.colors.error,
      onError: appTheme.colors.onError,
      isProfileTheme: false,
    };
  }

  return context.colors;
}

/**
 * Hook to access full profile theme context
 */
export function useProfileThemeContext(): ProfileThemeColorsContextValue | null {
  return useContext(ProfileThemeColorsContext) ?? null;
}

/**
 * Hook to check if profile theme is active
 */
export function useIsProfileThemeActive(): boolean {
  const context = useContext(ProfileThemeColorsContext);
  return context?.colors.isProfileTheme ?? false;
}

// =============================================================================
// Export
// =============================================================================

export default ProfileThemeColorsContext;
