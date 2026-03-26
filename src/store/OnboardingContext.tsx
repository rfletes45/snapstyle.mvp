/**
 * OnboardingContext
 *
 * Holds post-auth onboarding state (username, display name, photo, display style)
 * across the multi-step onboarding flow. Active only when AppGate is in
 * "needs_profile" state. Unmounted when profile setup completes.
 *
 * This ensures that moving back/forward between onboarding screens
 * does not wipe previously entered data.
 */

import {
  ConversationDisplayMode,
  DEFAULT_DISPLAY_MODE,
} from "@/chat/displayMode";
import type { ThemeMode } from "@/store/ThemeContext";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OnboardingState {
  username: string;
  displayName: string;
  photoUri: string | null;
  displayMode: ConversationDisplayMode;
  /** Theme mode chosen during onboarding (light / dark / auto) */
  themeMode: ThemeMode;
  /** Tracks whether username was confirmed available (from last check) */
  usernameAvailable: boolean | null;
}

interface OnboardingContextValue extends OnboardingState {
  setUsername: (username: string) => void;
  setDisplayName: (displayName: string) => void;
  setPhotoUri: (uri: string | null) => void;
  setDisplayMode: (mode: ConversationDisplayMode) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setUsernameAvailable: (available: boolean | null) => void;
  reset: () => void;
}

const INITIAL_STATE: OnboardingState = {
  username: "",
  displayName: "",
  photoUri: null,
  displayMode: DEFAULT_DISPLAY_MODE,
  themeMode: "light",
  usernameAvailable: null,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined,
);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);

  const setUsername = useCallback(
    (username: string) =>
      setState((s) => ({ ...s, username, usernameAvailable: null })),
    [],
  );
  const setDisplayName = useCallback(
    (displayName: string) => setState((s) => ({ ...s, displayName })),
    [],
  );
  const setPhotoUri = useCallback(
    (photoUri: string | null) => setState((s) => ({ ...s, photoUri })),
    [],
  );
  const setDisplayMode = useCallback(
    (displayMode: ConversationDisplayMode) =>
      setState((s) => ({ ...s, displayMode })),
    [],
  );
  const setThemeMode = useCallback(
    (themeMode: ThemeMode) => setState((s) => ({ ...s, themeMode })),
    [],
  );
  const setUsernameAvailable = useCallback(
    (usernameAvailable: boolean | null) =>
      setState((s) => ({ ...s, usernameAvailable })),
    [],
  );

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return (
    <OnboardingContext.Provider
      value={{
        ...state,
        setUsername,
        setDisplayName,
        setPhotoUri,
        setDisplayMode,
        setThemeMode,
        setUsernameAvailable,
        reset,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return ctx;
}
