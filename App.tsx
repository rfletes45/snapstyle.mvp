import React from "react";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { PaperProvider } from "react-native-paper";
import { AuthProvider } from "@/store/AuthContext";
import { UserProvider } from "@/store/UserContext";
import RootNavigator from "@/navigation/RootNavigator";
import { initializeFirebase } from "@/services/firebase";
import { firebaseConfig } from "@/services/firebaseConfig.local";

// Initialize Firebase synchronously before rendering
initializeFirebase(firebaseConfig);

export default function App() {
  return (
    <PaperProvider>
      <AuthProvider>
        <UserProvider>
          <RootNavigator />
          <ExpoStatusBar style="dark" />
        </UserProvider>
      </AuthProvider>
    </PaperProvider>
  );
}
