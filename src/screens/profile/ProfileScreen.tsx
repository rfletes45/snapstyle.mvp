import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, Button } from "react-native-paper";
import { signOut } from "firebase/auth";
import { getAuthInstance } from "@/services/firebase";
import { useAuth } from "@/store/AuthContext";

export default function ProfileScreen() {
  const { currentFirebaseUser } = useAuth();

  const handleSignOut = async () => {
    try {
      const auth = getAuthInstance();
      await signOut(auth);
    } catch (error: any) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      {currentFirebaseUser && (
        <Text style={styles.email}>{currentFirebaseUser.email}</Text>
      )}
      <Text style={styles.placeholder}>Profile features coming in Phase 1</Text>

      <Button
        mode="contained"
        onPress={handleSignOut}
        buttonColor="#d32f2f"
        textColor="#fff"
        style={styles.signOutButton}
      >
        Sign Out
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
  },
  email: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
  },
  placeholder: {
    fontSize: 16,
    color: "#999",
    marginBottom: 32,
  },
  signOutButton: {
    marginTop: 16,
    width: "100%",
  },
});
