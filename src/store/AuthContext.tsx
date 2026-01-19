import React, { createContext, useContext, useState, useEffect } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { getAuthInstance } from "@/services/firebase";

export interface AuthContextType {
  currentFirebaseUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentFirebaseUser, setCurrentFirebaseUser] =
    useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const auth = getAuthInstance();
      const unsubscribe = auth.onAuthStateChanged(
        (user: any) => {
          console.log(
            "AuthContext: User state changed",
            user?.email || "logged out",
          );
          setCurrentFirebaseUser(user);
          setLoading(false);
        },
        (err: any) => {
          console.warn(
            "Auth state change error (this is OK with placeholder config):",
            err.message,
          );
          setCurrentFirebaseUser(null);
          setLoading(false);
        },
      );

      return unsubscribe;
    } catch (error: any) {
      console.warn(
        "Failed to set up auth listener (this is OK with placeholder config):",
        error.message,
      );
      setLoading(false);
      return () => {}; // Return no-op unsubscribe
    }
  }, []);

  return (
    <AuthContext.Provider value={{ currentFirebaseUser, loading, error: null }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
