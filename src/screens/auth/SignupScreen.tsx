/**
 * SignupScreen
 * Vibe branded account creation screen
 */

import React, { useState } from "react";
import { StyleSheet, ScrollView, View } from "react-native";
import { TextInput, Button, Text, useTheme } from "react-native-paper";
import { signUp } from "@/services/auth";
import { isValidEmail, isValidPassword } from "@/utils/validators";
import { Spacing, BorderRadius } from "../../../constants/theme";

export default function SignupScreen({ navigation }: any) {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async () => {
    setError("");

    // Validation
    if (!email || !password || !confirmPassword) {
      setError("All fields are required");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (!isValidPassword(password)) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    // Create user with Firebase Authentication
    console.log("🔵 [SignupScreen] Creating account for", email);
    const result = await signUp(email.trim(), password);

    if (result.ok) {
      console.log("✅ [SignupScreen] Account created successfully");
      // After signup, navigate to profile setup
      // User stays logged in so they can complete their profile
      navigation.navigate("ProfileSetup");
    } else {
      console.log("❌ [SignupScreen] Signup failed:", result.error.code);
      // Use the user-friendly error message from the error utility
      setError(result.error.userMessage);
    }

    setLoading(false);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text
        variant="headlineLarge"
        style={[styles.title, { color: theme.colors.onBackground }]}
      >
        Join Vibe
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
      >
        Create your account to get started
      </Text>

      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        mode="outlined"
        keyboardType="email-address"
        disabled={loading}
        style={styles.input}
        autoCapitalize="none"
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

      {error ? (
        <View
          style={[
            styles.errorContainer,
            { backgroundColor: theme.colors.errorContainer },
          ]}
        >
          <Text style={[styles.error, { color: theme.colors.error }]}>
            {error}
          </Text>
        </View>
      ) : null}

      <Button
        mode="contained"
        onPress={handleSignup}
        loading={loading}
        disabled={loading}
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
  },
  content: {
    padding: Spacing.xl,
    justifyContent: "center",
    minHeight: "100%",
  },
  title: {
    fontWeight: "bold",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    marginBottom: Spacing.xl,
  },
  input: {
    marginBottom: Spacing.lg,
  },
  button: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  errorContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  error: {
    textAlign: "center",
  },
});
