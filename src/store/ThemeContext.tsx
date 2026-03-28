/**
 * Theme Context - Multi-Theme Support
 * Provides theme state and selection functionality throughout the app
 *
 * Supports:
 * - 30+ beautiful themes (light, dark, AMOLED, pastel, vibrant)
 * - Theme mode: Light / Dark / Auto (follows device)
 * - Persisted theme preference via AsyncStorage
 * - Stable theme across auth & onboarding flows
 * - Quick toggle between light/dark variants
 */

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
import { getAuthInstance, getFirestoreInstance } from "@/services/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, updateDoc } from "firebase/firestore";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useColorScheme } from "react-native";

import { createLogger } from "@/utils/log";
const logger = createLogger("store/ThemeContext");
// Storage key prefix — suffixed with UID for per-account isolation
const THEME_STORAGE_PREFIX = "@vibe_theme_id_";

// Default themes for system preference (Auto mode)
const DEFAULT_LIGHT_THEME: ThemeId = "catppuccin-latte";
const DEFAULT_DARK_THEME: ThemeId = "catppuccin-mocha";

/** Theme mode controls how the active theme is determined */
export type ThemeMode = "light" | "dark" | "auto";

interface ThemeContextValue {
  /** The current theme object with all tokens */
  theme: AppTheme;
  /** Current theme ID */
  themeId: ThemeId;
  /** Current theme mode (light / dark / auto) */
  themeMode: ThemeMode;
  /** Whether to follow system preference (alias for themeMode === 'auto') */
  useSystemTheme: boolean;
  /** Whether dark mode is currently active */
  isDark: boolean;
  /** The current color tokens */
  colors: ThemeColors;
  /** All available themes */
  availableThemes: ThemeMeta[];
  /** Set a specific theme by ID */
  setTheme: (themeId: ThemeId) => void;
  /** Set the theme mode (light / dark / auto) */
  setThemeMode: (mode: ThemeMode) => void;
  /** Toggle system theme following */
  setUseSystemTheme: (use: boolean) => void;
  /** Quick toggle between light and dark variants */
  toggleDarkMode: () => void;
  /** Get themes filtered by category */
  getThemesByCategory: (category: ThemeMeta["category"]) => ThemeMeta[];
  /** Signal that the user's profile is ready (enables stored-pref loading) */
  markProfileReady: () => void;
  /** Sync theme from Firestore profile data (authoritative remote source) */
  syncProfileTheme: (
    profile: { themeId?: string; useSystemTheme?: boolean } | null,
  ) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  /** Initial theme ID, defaults to light theme */
  initialThemeId?: ThemeId;
}

// Default theme for pre-login & onboarding (light for clean first impression)
const DEFAULT_LOGGED_OUT_THEME: ThemeId = "catppuccin-latte";

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
  // Track the current user's UID for scoping theme storage
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  // profileReady gates when stored preferences are loaded.
  // This prevents the theme from flipping mid-onboarding when a fresh
  // Firebase auth is detected but the user hasn't completed profile setup.
  const [profileReady, setProfileReady] = useState(false);
  // Track whether stored prefs have been loaded (gates persistence to avoid overwriting)
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Helper: get the per-user storage key
  const getStorageKey = useCallback(
    (uid?: string | null) => {
      const id = uid ?? currentUid;
      return id ? `${THEME_STORAGE_PREFIX}${id}` : null;
    },
    [currentUid],
  );

  // Ref to track current UID for the persist effect without stale closures
  const currentUidRef = useRef<string | null>(null);
  useEffect(() => {
    currentUidRef.current = currentUid;
  }, [currentUid]);

  // Listen to Firebase auth state
  useEffect(() => {
    try {
      const auth = getAuthInstance();
      const unsubscribe = auth.onAuthStateChanged(async (user: any) => {
        const wasAuthenticated = isAuthenticated;
        const nowAuthenticated = !!user;
        setIsAuthenticated(nowAuthenticated);

        if (!nowAuthenticated && wasAuthenticated) {
          // User signed out → revert to default light theme
          setCurrentUid(null);
          setThemeId(DEFAULT_LOGGED_OUT_THEME);
          setUseSystemThemeState(false);
          setProfileReady(false);
          setPrefsLoaded(false);
        } else if (nowAuthenticated) {
          // User signed in — store UID and reset prefs-loaded flag so the
          // correct user's prefs will be read once profileReady is set.
          const uid = user.uid;
          setCurrentUid(uid);
          setPrefsLoaded(false);
        }
        // NOTE: We deliberately do NOT load stored prefs here on login.
        // Prefs are loaded only once profileReady is set (see effect below).
        // This prevents a jarring theme switch during onboarding step 3.
      });
      return unsubscribe;
    } catch {
      // Firebase not initialized yet — that's fine
      return undefined;
    }
  }, [isAuthenticated]);

  // Initial loading flag — resolved quickly on mount
  useEffect(() => {
    setIsLoading(false);
  }, []);

  // Apply stored prefs when profileReady becomes true (exactly once per session)
  useEffect(() => {
    if (!profileReady || prefsLoaded || !currentUid) return;

    (async () => {
      try {
        const key = `${THEME_STORAGE_PREFIX}${currentUid}`;
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.themeId && THEME_METADATA[parsed.themeId as ThemeId]) {
            const isAuto = parsed.useSystemTheme ?? false;
            if (isAuto) {
              setUseSystemThemeState(true);
              const resolved =
                systemColorScheme === "dark"
                  ? DEFAULT_DARK_THEME
                  : DEFAULT_LIGHT_THEME;
              setThemeId(resolved);
            } else {
              setThemeId(parsed.themeId);
              setUseSystemThemeState(false);
            }
          }
        }
      } catch {
        // Ignore storage read errors
      } finally {
        // Mark loaded AFTER the async read so the persist effect doesn't
        // overwrite saved prefs before they're read.
        setPrefsLoaded(true);
      }
    })();
  }, [profileReady, prefsLoaded, currentUid, systemColorScheme]);

  // Persist theme changes (only after stored prefs have been loaded)
  useEffect(() => {
    const uid = currentUidRef.current;
    if (!isLoading && profileReady && prefsLoaded && uid) {
      const key = `${THEME_STORAGE_PREFIX}${uid}`;
      const payload = JSON.stringify({ themeId, useSystemTheme });

      // Write to per-user AsyncStorage (instant)
      AsyncStorage.setItem(key, payload).catch((error) =>
        logger.warn("Failed to save theme preference:", error),
      );

      // Write to Firestore for cross-device sync (background)
      try {
        const db = getFirestoreInstance();
        updateDoc(doc(db, "Users", uid), {
          themeId,
          useSystemTheme,
        }).catch((e) => logger.warn("Failed to sync theme to Firestore:", e));
      } catch {
        // Firestore not ready — skip
      }
    }
  }, [themeId, useSystemTheme, isLoading, profileReady, prefsLoaded]);

  // Handle system theme changes (Auto mode)
  useEffect(() => {
    if (useSystemTheme) {
      const newThemeId =
        systemColorScheme === "dark" ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
      setThemeId(newThemeId);
    }
  }, [systemColorScheme, useSystemTheme]);

  // Get the full theme object
  const theme = useMemo(() => getThemeById(themeId), [themeId]);

  // Derive the current theme mode from state
  const themeMode: ThemeMode = useSystemTheme
    ? "auto"
    : theme.isDark
      ? "dark"
      : "light";

  // Convenience accessors
  const isDark = theme.isDark;
  const colors = theme.colors;

  // Set a specific theme
  const setTheme = useCallback((newThemeId: ThemeId) => {
    setThemeId(newThemeId);
    setUseSystemThemeState(false);
  }, []);

  // Set theme mode: light / dark / auto
  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      if (mode === "auto") {
        setUseSystemThemeState(true);
        const resolved =
          systemColorScheme === "dark"
            ? DEFAULT_DARK_THEME
            : DEFAULT_LIGHT_THEME;
        setThemeId(resolved);
      } else if (mode === "light") {
        setUseSystemThemeState(false);
        setThemeId(DEFAULT_LIGHT_THEME);
      } else {
        setUseSystemThemeState(false);
        setThemeId(DEFAULT_DARK_THEME);
      }
    },
    [systemColorScheme],
  );

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

  // Signal that the user's profile is ready (returning user or after onboarding)
  const markProfileReady = useCallback(() => {
    setProfileReady(true);
  }, []);

  // Sync theme from Firestore profile data (authoritative remote source).
  // Called by ProfileReadySignal when profile loads. If the profile has a
  // saved themeId, it overrides the local cache (same pattern as displayMode).
  const syncProfileTheme = useCallback(
    (profile: { themeId?: string; useSystemTheme?: boolean } | null) => {
      if (!profile) return;
      const remoteThemeId = profile.themeId as ThemeId | undefined;
      if (remoteThemeId && THEME_METADATA[remoteThemeId]) {
        const remoteUseSystem = profile.useSystemTheme ?? false;
        if (remoteUseSystem) {
          setUseSystemThemeState(true);
          const resolved =
            systemColorScheme === "dark"
              ? DEFAULT_DARK_THEME
              : DEFAULT_LIGHT_THEME;
          setThemeId(resolved);
        } else {
          setThemeId(remoteThemeId);
          setUseSystemThemeState(false);
        }
        // Keep local cache in sync with remote authoritative value
        const uid = currentUidRef.current;
        if (uid) {
          AsyncStorage.setItem(
            `${THEME_STORAGE_PREFIX}${uid}`,
            JSON.stringify({
              themeId: remoteThemeId,
              useSystemTheme: remoteUseSystem,
            }),
          ).catch(() => {});
        }
      }
    },
    [systemColorScheme],
  );

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
      themeMode,
      useSystemTheme,
      isDark,
      colors,
      availableThemes,
      setTheme,
      setThemeMode,
      setUseSystemTheme,
      toggleDarkMode,
      getThemesByCategory: getThemesByCategoryFn,
      markProfileReady,
      syncProfileTheme,
    }),
    [
      theme,
      themeId,
      themeMode,
      useSystemTheme,
      isDark,
      colors,
      availableThemes,
      setTheme,
      setThemeMode,
      setUseSystemTheme,
      toggleDarkMode,
      getThemesByCategoryFn,
      markProfileReady,
      syncProfileTheme,
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
