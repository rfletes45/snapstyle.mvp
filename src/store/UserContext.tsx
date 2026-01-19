import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { User as AppUser } from "@/types/models";
import { useAuth } from "./AuthContext";
import { getFirestoreInstance } from "@/services/firebase";
import { doc, getDoc } from "firebase/firestore";

export interface UserContextType {
  profile: AppUser | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { currentFirebaseUser } = useAuth();
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!currentFirebaseUser) {
      setProfile(null);
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentFirebaseUser]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  return (
    <UserContext.Provider value={{ profile, loading, error, refreshProfile }}>
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
