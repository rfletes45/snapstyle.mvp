import React, { useState } from "react";
import { StyleSheet, ScrollView } from "react-native";
import { TextInput, Button, Text } from "react-native-paper";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { getAuthInstance } from "@/services/firebase";

export default function SignupScreen({ navigation }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async () => {
    setError("");

    if (!email || !password || !confirmPassword) {
      setError("All fields are required");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const auth = getAuthInstance();
      await createUserWithEmailAndPassword(auth, email, password);
      // After signup, navigate to profile setup
      navigation.navigate("ProfileSetup");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        mode="outlined"
        keyboardType="email-address"
        disabled={loading}
        style={styles.input}
      />

      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        mode="outlined"
        secureTextEntry
        disabled={loading}
        style={styles.input}
      />

      <TextInput
        label="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        mode="outlined"
        secureTextEntry
        disabled={loading}
        style={styles.input}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        mode="contained"
        onPress={handleSignup}
        loading={loading}
        disabled={loading}
        buttonColor="#FFFC00"
        textColor="#000"
        style={styles.button}
      >
        Create Account
      </Button>

      <Button
        mode="text"
        onPress={() => navigation.navigate("Login")}
        disabled={loading}
      >
        Already have an account? Sign in
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
    marginBottom: 20,
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
