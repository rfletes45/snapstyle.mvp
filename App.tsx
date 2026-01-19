import React, { useEffect } from "react";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { PaperProvider } from "react-native-paper";
import { AuthProvider } from "@/store/AuthContext";
import { UserProvider } from "@/store/UserContext";
import RootNavigator from "@/navigation/RootNavigator";
import { initializeFirebase } from "@/services/firebase";

// TODO: Replace with actual Firebase config from firebaseConfig.local.ts
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

export default function App() {
  useEffect(() => {
    initializeFirebase(firebaseConfig);
  }, []);

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
