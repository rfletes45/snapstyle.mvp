/**
 * AppGate Component
 *
 * Prevents navigating until:
 * - Auth state is resolved (not loading)
 * - Profile is loaded or **confirmed** missing (not just failed to load)
 * - ProfileSetup only shows for genuinely new accounts
 * - Ban status is checked
 *
 * CRITICAL SAFETY RULE:
 * If the profile fetch fails (network error, timeout, etc.), the user MUST
 * stay on a loading/retry screen. We NEVER route an authenticated user to
 * the onboarding/signup flow unless the profile document is **confirmed**
 * to not exist in Firestore (profileFetchStatus === "not_found").
 *
 * This prevents the catastrophic bug where an existing user's profile data
 * gets overwritten by the onboarding flow after a transient fetch failure.
 */

import LoadingScreen from "@/components/LoadingScreen";
import BannedScreen from "@/screens/admin/BannedScreen";
import { subscribeToUserBan } from "@/services/moderation";
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";
import type { Ban } from "@/types/models";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { createLogger } from "@/utils/log";
import {
  logStartupEvent,
  logStartupMount,
  logStartupUnmount,
} from "@/utils/startupTrace";
const logger = createLogger("components/AppGate");

/** Maximum time (ms) to wait for hydration before force-proceeding */
const HYDRATION_TIMEOUT_MS = 15_000;

/**
 * Hydration state machine states
 */
export type HydrationState =
  | "loading" // Still determining auth/profile state
  | "unauthenticated" // No user logged in
  | "needs_profile" // Logged in, profile doc CONFIRMED not to exist (true new user only)
  | "banned" // User is banned
  | "fetch_error" // Profile fetch failed — stay on safe loading/retry screen
  | "ready"; // Fully authenticated with complete profile

export interface AppGateState {
  hydrationState: HydrationState;
  isHydrated: boolean;
  isAuthenticated: boolean;
  hasCompleteProfile: boolean;
  isBanned: boolean;
  ban: Ban | null;
  loadingReason?: string;
  preservedFromHydrationState?: HydrationState;
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
    isHydrated: profileHydrated,
    profileFetchStatus,
  } = useUser();

  // Ban state
  const [ban, setBan] = useState<Ban | null>(null);
  const [banChecked, setBanChecked] = useState(false);

  // Hydration timeout — if auth/profile/ban takes too long, force-proceed
  // SAFETY: On timeout, we force-proceed but ONLY to "ready" (if profile is
  // cached/loaded) or "fetch_error" (if profile is unknown). We NEVER
  // fallthrough to "needs_profile" on timeout.
  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEnteredReadyRef = useRef(false);
  const lastReadyUidRef = useRef<string | null>(null);

  useEffect(() => {
    logStartupMount("AppGate");
    return () => {
      logStartupUnmount("AppGate", {
        lastReadyUid: lastReadyUidRef.current,
        hasEnteredReady: hasEnteredReadyRef.current,
      });
    };
  }, []);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setTimedOut(true);
      console.warn(
        "[AppGate] Hydration timed out after " +
          HYDRATION_TIMEOUT_MS +
          "ms — force-proceeding",
      );
    }, HYDRATION_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Clear timeout once hydrated
  useEffect(() => {
    if (authHydrated && profileHydrated && banChecked) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [authHydrated, profileHydrated, banChecked]);

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

  const rawState = useMemo<AppGateState>(() => {
    // Still loading auth (unless timed out)
    if ((authLoading || !authHydrated) && !timedOut) {
      return {
        hydrationState: "loading",
        isHydrated: false,
        isAuthenticated: false,
        hasCompleteProfile: false,
        isBanned: false,
        ban: null,
        loadingReason: authLoading ? "auth_loading" : "auth_not_hydrated",
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

    // User exists but profile never loaded yet, or ban not checked.
    // IMPORTANT: Once profileHydrated is true we do NOT fall back to
    // "loading" on a subsequent refreshProfile() call — that would unmount
    // the entire navigation tree and reset the user to the Inbox tab.
    // If timed out, skip waiting and proceed — but SAFELY (see below).
    if ((!profileHydrated || !banChecked) && !timedOut) {
      return {
        hydrationState: "loading",
        isHydrated: false,
        isAuthenticated: true,
        hasCompleteProfile: false,
        isBanned: false,
        ban: null,
        loadingReason: !profileHydrated
          ? "profile_not_hydrated"
          : "ban_not_checked",
      };
    }

    // ── CRITICAL SAFETY: Profile fetch error handling ──────────────
    // If profile fetch failed (network error, timeout, etc.), we MUST NOT
    // route to "needs_profile". That would send an existing user into
    // onboarding and potentially overwrite their profile data.
    //
    // Instead, we show a safe error/retry state.
    if (profileFetchStatus === "error") {
      logger.warn(
        "[AppGate] Profile fetch failed — showing safe error state, NOT routing to onboarding",
      );
      return {
        hydrationState: "fetch_error",
        isHydrated: true,
        isAuthenticated: true,
        hasCompleteProfile: false,
        isBanned: false,
        ban: null,
        loadingReason: "profile_fetch_error",
      };
    }

    // ── SAFETY: If timed out but profile status is not definitively
    // "found" or "not_found", treat as error — do NOT guess.
    if (
      timedOut &&
      profileFetchStatus !== "found" &&
      profileFetchStatus !== "not_found"
    ) {
      logger.warn(
        "[AppGate] Hydration timed out with uncertain profile status (" +
          profileFetchStatus +
          ") — showing safe error state",
      );
      return {
        hydrationState: "fetch_error",
        isHydrated: true,
        isAuthenticated: true,
        hasCompleteProfile: false,
        isBanned: false,
        ban: null,
        loadingReason: "hydration_timeout_uncertain_profile",
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

    // CRITICAL: Only route to "needs_profile" if the profile document is
    // CONFIRMED to not exist (profileFetchStatus === "not_found") OR
    // the profile exists but is genuinely incomplete (no username).
    //
    // This is the ONLY path to onboarding for authenticated users.
    if (!hasCompleteProfile) {
      if (profileFetchStatus === "not_found") {
        // True new user — profile doc does not exist in Firestore
        return {
          hydrationState: "needs_profile",
          isHydrated: true,
          isAuthenticated: true,
          hasCompleteProfile: false,
          isBanned: false,
          ban: null,
        };
      }

      if (profileFetchStatus === "found" && !profile?.username) {
        // Edge case: profile doc exists but has no username
        // (partially created account — safe to send to onboarding)
        return {
          hydrationState: "needs_profile",
          isHydrated: true,
          isAuthenticated: true,
          hasCompleteProfile: false,
          isBanned: false,
          ban: null,
        };
      }

      // Any other status (error, loading, idle) — DO NOT route to onboarding
      return {
        hydrationState: "fetch_error",
        isHydrated: true,
        isAuthenticated: true,
        hasCompleteProfile: false,
        isBanned: false,
        ban: null,
        loadingReason: "incomplete_profile_uncertain_status",
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
    profileHydrated,
    profile,
    profileFetchStatus,
    ban,
    banChecked,
    timedOut,
  ]);

  const shouldPreserveReady =
    hasEnteredReadyRef.current &&
    !!currentFirebaseUser?.uid &&
    lastReadyUidRef.current === currentFirebaseUser.uid &&
    !!profile?.username &&
    (rawState.hydrationState === "loading" ||
      rawState.hydrationState === "fetch_error");

  const state = useMemo<AppGateState>(() => {
    if (!shouldPreserveReady) return rawState;

    return {
      hydrationState: "ready",
      isHydrated: true,
      isAuthenticated: true,
      hasCompleteProfile: true,
      isBanned: false,
      ban: null,
      preservedFromHydrationState: rawState.hydrationState,
      loadingReason: rawState.loadingReason,
    };
  }, [rawState, shouldPreserveReady]);

  useEffect(() => {
    if (state.hydrationState === "ready" && currentFirebaseUser?.uid) {
      hasEnteredReadyRef.current = true;
      lastReadyUidRef.current = currentFirebaseUser.uid;
    } else if (state.hydrationState === "unauthenticated") {
      hasEnteredReadyRef.current = false;
      lastReadyUidRef.current = null;
    }
  }, [currentFirebaseUser?.uid, state.hydrationState]);

  useEffect(() => {
    if (!shouldPreserveReady) return;

    logStartupEvent("AppGate preserved ready navigation tree", {
      rawHydrationState: rawState.hydrationState,
      loadingReason: rawState.loadingReason ?? null,
      uid: currentFirebaseUser?.uid ?? null,
      profileFetchStatus,
      profileHydrated,
      banChecked,
    });
  }, [
    banChecked,
    currentFirebaseUser?.uid,
    profileFetchStatus,
    profileHydrated,
    rawState.hydrationState,
    rawState.loadingReason,
    shouldPreserveReady,
  ]);

  // Log state transitions for diagnosing routing issues
  useEffect(() => {
    logStartupEvent("AppGate state evaluated", {
      hydrationState: state.hydrationState,
      rawHydrationState: rawState.hydrationState,
      loadingReason: state.loadingReason ?? null,
      preservedFromHydrationState: state.preservedFromHydrationState ?? null,
      authHydrated,
      profileHydrated,
      profileFetchStatus,
      hasUsername: !!profile?.username,
      banChecked,
      uid: currentFirebaseUser?.uid ?? null,
    });
    logger.info(
      "[AppGate] State: " +
        state.hydrationState +
        " | authHydrated=" +
        authHydrated +
        " profileHydrated=" +
        profileHydrated +
        " profileFetchStatus=" +
        profileFetchStatus +
        " hasUsername=" +
        !!profile?.username +
        " banChecked=" +
        banChecked,
    );
  }, [
    authHydrated,
    banChecked,
    currentFirebaseUser?.uid,
    profile?.username,
    profileFetchStatus,
    profileHydrated,
    rawState.hydrationState,
    state.hydrationState,
    state.loadingReason,
    state.preservedFromHydrationState,
  ]);

  // Show loading screen during hydration
  if (!state.isHydrated) {
    return (
      <LoadingScreen
        message={loadingMessage}
        diagnosticReason={state.loadingReason ?? "appgate_not_hydrated"}
        diagnosticData={{
          hydrationState: state.hydrationState,
          rawHydrationState: rawState.hydrationState,
          authHydrated,
          profileHydrated,
          profileFetchStatus,
          banChecked,
          uid: currentFirebaseUser?.uid ?? null,
          hasPreviouslyEnteredReady: hasEnteredReadyRef.current,
          lastReadyUid: lastReadyUidRef.current,
        }}
      />
    );
  }

  // Show banned screen if user is banned
  if (state.isBanned && state.ban) {
    return <BannedScreen ban={state.ban} />;
  }

  // Show safe loading/retry screen if profile fetch failed
  // CRITICAL: Do NOT pass this through to children as "needs_profile"
  if (state.hydrationState === "fetch_error") {
    return (
      <LoadingScreen
        message="Having trouble loading your profile. Retrying..."
        diagnosticReason={state.loadingReason ?? "appgate_fetch_error"}
        diagnosticData={{
          hydrationState: state.hydrationState,
          rawHydrationState: rawState.hydrationState,
          authHydrated,
          profileHydrated,
          profileFetchStatus,
          banChecked,
          uid: currentFirebaseUser?.uid ?? null,
          hasPreviouslyEnteredReady: hasEnteredReadyRef.current,
          lastReadyUid: lastReadyUidRef.current,
        }}
      />
    );
  }

  // Render children with state
  return <>{children(state)}</>;
}

export default AppGate;
