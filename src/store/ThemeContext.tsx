/**
 * Theme Context
 * Provides theme state and toggle functionality throughout the app
 *
 * Supports:
 * - System preference detection
 * - Manual light/dark toggle
 * - Persisted preference (TODO: AsyncStorage)
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import {
  AppTheme,
  getTheme,
  LightColors,
  DarkColors,
  ThemeColors,
} from "../../constants/theme";

type ThemeMode = "system" | "light" | "dark";

interface ThemeContextValue {
  /** The current theme object with all tokens */
  theme: AppTheme;
  /** Current theme mode setting */
  mode: ThemeMode;
  /** Whether dark mode is currently active */
  isDark: boolean;
  /** The current color tokens */
  colors: ThemeColors;
  /** Set theme mode */
  setMode: (mode: ThemeMode) => void;
  /** Toggle between light and dark (ignores system) */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  /** Initial theme mode, defaults to "system" */
  initialMode?: ThemeMode;
}

export function ThemeProvider({
  children,
  initialMode = "system",
}: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  // Determine if dark mode is active
  const isDark = useMemo(() => {
    if (mode === "system") {
      return systemColorScheme === "dark";
    }
    return mode === "dark";
  }, [mode, systemColorScheme]);

  // Get the full theme object
  const theme = useMemo(() => getTheme(isDark), [isDark]);

  // Get just colors for convenience
  const colors = useMemo(() => (isDark ? DarkColors : LightColors), [isDark]);

  // Toggle function
  const toggle = () => {
    setMode((current) => {
      if (current === "system") {
        return systemColorScheme === "dark" ? "light" : "dark";
      }
      return current === "dark" ? "light" : "dark";
    });
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      mode,
      isDark,
      colors,
      setMode,
      toggle,
    }),
    [theme, mode, isDark, colors],
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
