/**
 * Theme Context - Multi-Theme Support
 * Provides theme state and selection functionality throughout the app
 *
 * Supports:
 * - 14 beautiful themes (light, dark, AMOLED, pastel, vibrant)
 * - System preference detection for auto theme
 * - Persisted theme preference via AsyncStorage
 * - Quick toggle between light/dark variants
 */

import { getAuthInstance } from "@/services/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import {
  AppTheme,
  getAllThemes,
  getThemeById,
  getThemesByCategory,
  THEME_METADATA,
  ThemeColors,
  ThemeId,
  ThemeMeta,
} from "@/constants/theme";


import { createLogger } from "@/utils/log";
const logger = createLogger("store/ThemeContext");
// Storage key for persisted theme
const THEME_STORAGE_KEY = "@vibe_theme_id";

// Default themes for system preference
const DEFAULT_LIGHT_THEME: ThemeId = "catppuccin-latte";
const DEFAULT_DARK_THEME: ThemeId = "catppuccin-mocha";

interface ThemeContextValue {
  /** The current theme object with all tokens */
  theme: AppTheme;
  /** Current theme ID */
  themeId: ThemeId;
  /** Whether to follow system preference */
  useSystemTheme: boolean;
  /** Whether dark mode is currently active */
  isDark: boolean;
  /** The current color tokens */
  colors: ThemeColors;
  /** All available themes */
  availableThemes: ThemeMeta[];
  /** Set a specific theme by ID */
  setTheme: (themeId: ThemeId) => void;
  /** Toggle system theme following */
  setUseSystemTheme: (use: boolean) => void;
  /** Quick toggle between light and dark variants */
  toggleDarkMode: () => void;
  /** Get themes filtered by category */
  getThemesByCategory: (category: ThemeMeta["category"]) => ThemeMeta[];
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  /** Initial theme ID, defaults to system preference */
  initialThemeId?: ThemeId;
}

// Default theme when not logged in (always catppuccin-mocha)
const DEFAULT_LOGGED_OUT_THEME: ThemeId = "catppuccin-mocha";

export function ThemeProvider({
  children,
  initialThemeId,
}: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const [themeId, setThemeId] = useState<ThemeId>(
    initialThemeId || DEFAULT_LOGGED_OUT_THEME,
  );
  const [useSystemTheme, setUseSystemThemeState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Listen to Firebase auth state to know when to apply user theme
  useEffect(() => {
    try {
      const auth = getAuthInstance();
      const unsubscribe = auth.onAuthStateChanged(async (user: any) => {
        const wasAuthenticated = isAuthenticated;
        const nowAuthenticated = !!user;
        setIsAuthenticated(nowAuthenticated);

        if (nowAuthenticated && !wasAuthenticated) {
          // User just logged in → load their stored theme preference
          try {
            const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
            if (stored) {
              const parsed = JSON.parse(stored);
              if (parsed.themeId && THEME_METADATA[parsed.themeId as ThemeId]) {
                setThemeId(parsed.themeId);
                setUseSystemThemeState(parsed.useSystemTheme ?? false);
              }
            }
          } catch {
            // Ignore storage read errors
          }
        } else if (!nowAuthenticated && wasAuthenticated) {
          // User signed out → revert to default
          setThemeId(DEFAULT_LOGGED_OUT_THEME);
          setUseSystemThemeState(false);
        }
      });
      return unsubscribe;
    } catch {
      // Firebase not initialized yet — that's fine
      return undefined;
    }
  }, [isAuthenticated]);

  // Load persisted theme on mount — but only apply if user is authenticated
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.themeId && THEME_METADATA[parsed.themeId as ThemeId]) {
            // Only apply stored theme if user is currently authenticated
            try {
              const auth = getAuthInstance();
              if (auth.currentUser) {
                setThemeId(parsed.themeId);
                setUseSystemThemeState(parsed.useSystemTheme ?? false);
              }
            } catch {
              // Firebase not ready — skip applying stored theme
            }
          }
        }
      } catch (error) {
        logger.warn("Failed to load theme preference:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadTheme();
  }, []);

  // Persist theme changes (only when authenticated)
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      AsyncStorage.setItem(
        THEME_STORAGE_KEY,
        JSON.stringify({ themeId, useSystemTheme }),
      ).catch((error) =>
        logger.warn("Failed to save theme preference:", error),
      );
    }
  }, [themeId, useSystemTheme, isLoading, isAuthenticated]);

  // Handle system theme changes (only when authenticated and using system theme)
  useEffect(() => {
    if (useSystemTheme && isAuthenticated) {
      const newThemeId =
        systemColorScheme === "dark" ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
      setThemeId(newThemeId);
    }
  }, [systemColorScheme, useSystemTheme, isAuthenticated]);

  // Get the full theme object
  const theme = useMemo(() => getThemeById(themeId), [themeId]);

  // Convenience accessors
  const isDark = theme.isDark;
  const colors = theme.colors;

  // Set a specific theme
  const setTheme = useCallback((newThemeId: ThemeId) => {
    setThemeId(newThemeId);
    setUseSystemThemeState(false);
  }, []);

  // Toggle system theme following
  const setUseSystemTheme = useCallback(
    (use: boolean) => {
      setUseSystemThemeState(use);
      if (use) {
        const newThemeId =
          systemColorScheme === "dark"
            ? DEFAULT_DARK_THEME
            : DEFAULT_LIGHT_THEME;
        setThemeId(newThemeId);
      }
    },
    [systemColorScheme],
  );

  // Quick toggle between light and dark variants
  const toggleDarkMode = useCallback(() => {
    setUseSystemThemeState(false);
    setThemeId((current) => {
      const currentMeta = THEME_METADATA[current];
      if (currentMeta.isDark) {
        // Find a light theme - prefer same family or category
        if (current === "catppuccin-mocha") return "catppuccin-latte";
        if (current === "amoled") return "catppuccin-latte";
        if (current === "neo-tokyo") return "rose-garden";
        if (current === "retro-wave") return "lavender-dream";
        if (current === "dracula") return "solarized-light";
        if (current === "nord") return "ocean-breeze";
        if (current === "gruvbox-dark") return "sunset-glow";
        return DEFAULT_LIGHT_THEME;
      } else {
        // Find a dark theme - prefer same family or category
        if (current === "catppuccin-latte") return "catppuccin-mocha";
        if (current === "rose-garden") return "neo-tokyo";
        if (current === "ocean-breeze") return "nord";
        if (current === "mint-fresh") return "dracula";
        if (current === "sunset-glow") return "gruvbox-dark";
        if (current === "lavender-dream") return "retro-wave";
        if (current === "solarized-light") return "dracula";
        return DEFAULT_DARK_THEME;
      }
    });
  }, []);

  // Get all available themes
  const availableThemes = useMemo(() => getAllThemes(), []);

  // Get themes by category helper
  const getThemesByCategoryFn = useCallback(
    (category: ThemeMeta["category"]) => getThemesByCategory(category),
    [],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      themeId,
      useSystemTheme,
      isDark,
      colors,
      availableThemes,
      setTheme,
      setUseSystemTheme,
      toggleDarkMode,
      getThemesByCategory: getThemesByCategoryFn,
    }),
    [
      theme,
      themeId,
      useSystemTheme,
      isDark,
      colors,
      availableThemes,
      setTheme,
      setUseSystemTheme,
      toggleDarkMode,
      getThemesByCategoryFn,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * Hook to access theme values
 * Must be used within a ThemeProvider
 */
export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within a ThemeProvider");
  }
  return context;
}

/**
 * Hook to get just the colors (convenience)
 */
export function useColors(): ThemeColors {
  const { colors } = useAppTheme();
  return colors;
}

/**
 * Hook to check if dark mode is active
 */
export function useIsDark(): boolean {
  const { isDark } = useAppTheme();
  return isDark;
}

/**
 * Hook to get the current theme ID
 */
export function useThemeId(): ThemeId {
  const { themeId } = useAppTheme();
  return themeId;
}

// Re-export for convenience
export type { AppTheme, ThemeColors, ThemeId, ThemeMeta };
