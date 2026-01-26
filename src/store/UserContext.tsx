import { getFirestoreInstance } from "@/services/firebase";
import { User as AppUser } from "@/types/models";
import { doc, getDoc } from "firebase/firestore";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "./AuthContext";

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
      console.error("[UserContext] Error fetching profile:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsHydrated(true);
    }
  }, [currentFirebaseUser]);

  // Reset hydration when auth changes (user logs in/out)
  useEffect(() => {
    // Only reset if auth is hydrated
    if (authHydrated) {
      // If user logged out, mark as hydrated with null profile
      if (!currentFirebaseUser) {
        setProfile(null);
        setIsHydrated(true);
        setLoading(false);
      } else {
        // User logged in - need to fetch profile
        setIsHydrated(false);
        refreshProfile();
      }
    }
  }, [currentFirebaseUser, authHydrated, refreshProfile]);

  return (
    <UserContext.Provider
      value={{ profile, loading, isHydrated, error, refreshProfile }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
