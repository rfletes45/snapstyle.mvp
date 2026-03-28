import { getFirestoreInstance } from "@/services/firebase";
import { User as AppUser } from "@/types/models";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc } from "firebase/firestore";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";

import { createLogger } from "@/utils/log";
const logger = createLogger("store/UserContext");

/**
 * Profile fetch status — distinguishes between different reasons profile may be null.
 *
 * - "idle"           — no fetch attempted yet
 * - "loading"        — fetch in progress
 * - "found"          — profile document exists in Firestore and was loaded
 * - "not_found"      — profile document does NOT exist (true new user)
 * - "error"          — fetch failed (network error, timeout, permissions, etc.)
 *
 * CRITICAL: Only "not_found" should trigger the onboarding flow.
 * "error" MUST stay on a loading/retry state — never route to onboarding.
 */
export type ProfileFetchStatus =
  | "idle"
  | "loading"
  | "found"
  | "not_found"
  | "error";

/** AsyncStorage key for cached profile (used as safety net on fetch failure) */
const PROFILE_CACHE_KEY = "@snapstyle/cached_profile";

export interface UserContextType {
  profile: AppUser | null;
  loading: boolean;
  /** True once profile has been fetched at least once (even if null) */
  isHydrated: boolean;
  error: string | null;
  /** Distinguishes why profile may be null — critical for routing safety */
  profileFetchStatus: ProfileFetchStatus;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * Persist profile to AsyncStorage so we can use it as a safety net
 * if a subsequent Firestore fetch fails on app relaunch.
 */
async function cacheProfile(profile: AppUser): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {
    // Non-critical — best-effort caching
  }
}

/** Load cached profile from AsyncStorage */
async function loadCachedProfile(): Promise<AppUser | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    if (raw) return JSON.parse(raw) as AppUser;
  } catch {
    // Non-critical
  }
  return null;
}

/** Clear cached profile (on logout) */
async function clearCachedProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // Non-critical
  }
}

/** Maximum number of automatic retries on fetch failure */
const MAX_RETRIES = 3;
/** Delay between retries (ms) — doubles each attempt */
const RETRY_BASE_DELAY_MS = 2000;

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { currentFirebaseUser, isHydrated: authHydrated } = useAuth();
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileFetchStatus, setProfileFetchStatus] =
    useState<ProfileFetchStatus>("idle");

  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!currentFirebaseUser) {
      setProfile(null);
      setProfileFetchStatus("idle");
      setIsHydrated(true);
      clearCachedProfile();
      return;
    }

    setLoading(true);
    setError(null);
    setProfileFetchStatus("loading");

    try {
      const db = getFirestoreInstance();
      const userDoc = await getDoc(doc(db, "Users", currentFirebaseUser.uid));

      if (userDoc.exists()) {
        const profileData = userDoc.data() as AppUser;
        setProfile(profileData);
        setProfileFetchStatus("found");
        // Cache for safety on next launch
        cacheProfile(profileData);
        retryCountRef.current = 0; // Reset retries on success
      } else {
        // Document genuinely does not exist — true new user
        setProfile(null);
        setProfileFetchStatus("not_found");
        retryCountRef.current = 0;
      }
      setLoading(false);
      setIsHydrated(true);
    } catch (err: any) {
      logger.error("[UserContext] Error fetching profile:", err);
      setError(err.message);

      // CRITICAL SAFETY: On fetch error, try to load cached profile.
      // This prevents an existing user from being misrouted to onboarding
      // just because Firestore was temporarily unavailable.
      const cached = await loadCachedProfile();
      if (cached && cached.uid === currentFirebaseUser.uid && cached.username) {
        logger.warn(
          "[UserContext] Using cached profile after fetch error — existing user protected",
        );
        setProfile(cached);
        setProfileFetchStatus("found");
        setLoading(false);
        setIsHydrated(true);
        return;
      }

      // No cache available — mark as error (NOT "not_found")
      // AppGate will keep showing loading/retry state, not route to onboarding
      setProfileFetchStatus("error");
      setLoading(false);
      setIsHydrated(true);

      // Auto-retry with exponential backoff
      if (retryCountRef.current < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCountRef.current);
        retryCountRef.current += 1;
        logger.warn(
          `[UserContext] Will retry profile fetch in ${delay}ms (attempt ${retryCountRef.current}/${MAX_RETRIES})`,
        );
        retryTimerRef.current = setTimeout(() => {
          refreshProfile();
        }, delay);
      } else {
        logger.error(
          "[UserContext] All profile fetch retries exhausted — staying in error state",
        );
      }
    }
  }, [currentFirebaseUser]);

  // Track previous UID so we only reset hydration when the actual user
  // identity changes — NOT when refreshProfile's reference changes due to
  // Firebase User object identity churn (token refresh, reconnect, etc.).
  // Resetting isHydrated mid-session unmounts the entire navigation tree
  // via AppGate, causing the tab navigator to remount at initialRouteName
  // ("Inbox") and losing the user's place.
  const previousUidRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // Only act once auth state is resolved
    if (!authHydrated) return;

    if (!currentFirebaseUser) {
      // User logged out
      setProfile(null);
      setProfileFetchStatus("idle");
      setIsHydrated(true);
      setLoading(false);
      previousUidRef.current = null;
      clearCachedProfile();
      // Clear any pending retries
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      retryCountRef.current = 0;
    } else {
      const uidChanged = previousUidRef.current !== currentFirebaseUser.uid;
      previousUidRef.current = currentFirebaseUser.uid;

      if (uidChanged) {
        // Genuinely new user — show loading while we fetch their profile
        setIsHydrated(false);
        setProfileFetchStatus("idle");
        retryCountRef.current = 0;
        // Clear any pending retries from previous user
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
      }
      // For same-user re-fires (e.g. refreshProfile identity changed),
      // we still refresh the data but do NOT reset hydration.
      refreshProfile();
    }
  }, [currentFirebaseUser, authHydrated, refreshProfile]);

  // Cleanup retry timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      profile,
      loading,
      isHydrated,
      error,
      profileFetchStatus,
      refreshProfile,
    }),
    [profile, loading, isHydrated, error, profileFetchStatus, refreshProfile],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
