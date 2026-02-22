import { getFirestoreInstance } from "@/services/firebase";
import { User as AppUser } from "@/types/models";
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
export interface UserContextType {
  profile: AppUser | null;
  loading: boolean;
  /** True once profile has been fetched at least once (even if null) */
  isHydrated: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { currentFirebaseUser, isHydrated: authHydrated } = useAuth();
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!currentFirebaseUser) {
      setProfile(null);
      setIsHydrated(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const db = getFirestoreInstance();
      const userDoc = await getDoc(doc(db, "Users", currentFirebaseUser.uid));

      if (userDoc.exists()) {
        setProfile(userDoc.data() as AppUser);
      } else {
        setProfile(null);
      }
    } catch (err: any) {
      logger.error("[UserContext] Error fetching profile:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsHydrated(true);
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
      setIsHydrated(true);
      setLoading(false);
      previousUidRef.current = null;
    } else {
      const uidChanged = previousUidRef.current !== currentFirebaseUser.uid;
      previousUidRef.current = currentFirebaseUser.uid;

      if (uidChanged) {
        // Genuinely new user — show loading while we fetch their profile
        setIsHydrated(false);
      }
      // For same-user re-fires (e.g. refreshProfile identity changed),
      // we still refresh the data but do NOT reset hydration.
      refreshProfile();
    }
  }, [currentFirebaseUser, authHydrated, refreshProfile]);

  const value = useMemo(
    () => ({ profile, loading, isHydrated, error, refreshProfile }),
    [profile, loading, isHydrated, error, refreshProfile],
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
