import React, { useState } from "react";
import { StyleSheet, ScrollView } from "react-native";
import { TextInput, Button, Text } from "react-native-paper";

export default function ProfileSetupScreen({ navigation }: any) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSetupProfile = async () => {
    setError("");

    if (!username || !displayName) {
      setError("All fields are required");
      return;
    }

    setLoading(true);

    // TODO: Implement profile setup with Firestore in Phase 1
    // For now, just navigate to app
    setTimeout(() => {
      setLoading(false);
      // Navigation will happen automatically when user doc is created
    }, 500);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Set Up Your Profile</Text>
      <Text style={styles.subtitle}>Choose a username and display name</Text>

      <TextInput
        label="Username"
        value={username}
        onChangeText={setUsername}
        mode="outlined"
        disabled={loading}
        style={styles.input}
        placeholder="@username"
      />

      <TextInput
        label="Display Name"
        value={displayName}
        onChangeText={setDisplayName}
        mode="outlined"
        disabled={loading}
        style={styles.input}
        placeholder="Your Name"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        mode="contained"
        onPress={handleSetupProfile}
        loading={loading}
        disabled={loading}
        buttonColor="#FFFC00"
        textColor="#000"
        style={styles.button}
      >
        Continue
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 20,
    justifyContent: "center",
    minHeight: "100%",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    paddingVertical: 6,
  },
  error: {
    color: "#d32f2f",
    marginBottom: 12,
  },
});
