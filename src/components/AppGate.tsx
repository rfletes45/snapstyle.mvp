/**
 * AppGate Component
 *
 * Prevents navigating until:
 * - Auth state is resolved (not loading)
 * - Profile is loaded or determined missing
 * - ProfileSetup only shows when actually incomplete
 * - Ban status is checked
 *
 * This component ensures no screen flickers due to async state changes.
 */

import LoadingScreen from "@/components/LoadingScreen";
import BannedScreen from "@/screens/admin/BannedScreen";
import { subscribeToUserBan } from "@/services/moderation";
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";
import type { Ban } from "@/types/models";
import React, { useEffect, useMemo, useState } from "react";

/**
 * Hydration state machine states
 */
export type HydrationState =
  | "loading" // Still determining auth/profile state
  | "unauthenticated" // No user logged in
  | "needs_profile" // Logged in but profile incomplete
  | "banned" // User is banned
  | "ready"; // Fully authenticated with complete profile

export interface AppGateState {
  hydrationState: HydrationState;
  isHydrated: boolean;
  isAuthenticated: boolean;
  hasCompleteProfile: boolean;
  isBanned: boolean;
  ban: Ban | null;
}

export interface AppGateProps {
  children: (state: AppGateState) => React.ReactNode;
  loadingMessage?: string;
}

/**
 * AppGate component that manages hydration state
 * Renders loading screen until auth + profile are resolved
 * Shows BannedScreen if user is banned
 */
export function AppGate({
  children,
  loadingMessage = "Loading...",
}: AppGateProps) {
  const {
    currentFirebaseUser,
    loading: authLoading,
    isHydrated: authHydrated,
  } = useAuth();
  const {
    profile,
    loading: profileLoading,
    isHydrated: profileHydrated,
  } = useUser();

  // Ban state
  const [ban, setBan] = useState<Ban | null>(null);
  const [banChecked, setBanChecked] = useState(false);

  // Subscribe to ban status when user is authenticated
  useEffect(() => {
    if (!currentFirebaseUser?.uid) {
      setBan(null);
      setBanChecked(true);
      return;
    }

    setBanChecked(false);

    const unsubscribe = subscribeToUserBan(
      currentFirebaseUser.uid,
      (userBan) => {
        setBan(userBan);
        setBanChecked(true);
      },
    );

    return () => unsubscribe();
  }, [currentFirebaseUser?.uid]);

  const state = useMemo<AppGateState>(() => {
    // Still loading auth
    if (authLoading || !authHydrated) {
      return {
        hydrationState: "loading",
        isHydrated: false,
        isAuthenticated: false,
        hasCompleteProfile: false,
        isBanned: false,
        ban: null,
      };
    }

    // No user - we're unauthenticated
    if (!currentFirebaseUser) {
      return {
        hydrationState: "unauthenticated",
        isHydrated: true,
        isAuthenticated: false,
        hasCompleteProfile: false,
        isBanned: false,
        ban: null,
      };
    }

    // User exists but profile still loading or ban not checked
    if (profileLoading || !profileHydrated || !banChecked) {
      return {
        hydrationState: "loading",
        isHydrated: false,
        isAuthenticated: true,
        hasCompleteProfile: false,
        isBanned: false,
        ban: null,
      };
    }

    // Check if user is banned
    const isBanned =
      ban?.status === "active" &&
      (ban.expiresAt === null || Date.now() < ban.expiresAt);

    if (isBanned) {
      return {
        hydrationState: "banned",
        isHydrated: true,
        isAuthenticated: true,
        hasCompleteProfile: !!profile?.username,
        isBanned: true,
        ban,
      };
    }

    // Profile loaded - check if complete (has username)
    const hasCompleteProfile = !!profile?.username;

    if (!hasCompleteProfile) {
      return {
        hydrationState: "needs_profile",
        isHydrated: true,
        isAuthenticated: true,
        hasCompleteProfile: false,
        isBanned: false,
        ban: null,
      };
    }

    // Fully ready
    return {
      hydrationState: "ready",
      isHydrated: true,
      isAuthenticated: true,
      hasCompleteProfile: true,
      isBanned: false,
      ban: null,
    };
  }, [
    authLoading,
    authHydrated,
    currentFirebaseUser,
    profileLoading,
    profileHydrated,
    profile,
    ban,
    banChecked,
  ]);

  // Show loading screen during hydration
  if (!state.isHydrated) {
    return <LoadingScreen message={loadingMessage} />;
  }

  // Show banned screen if user is banned
  if (state.isBanned && state.ban) {
    return <BannedScreen ban={state.ban} />;
  }

  // Render children with state
  return <>{children(state)}</>;
}

export default AppGate;
