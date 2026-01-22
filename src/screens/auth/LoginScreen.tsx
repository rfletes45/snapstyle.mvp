/**
 * LoginScreen
 * Vibe branded sign-in screen
 */

import React, { useState } from "react";
import { StyleSheet, ScrollView, View } from "react-native";
import { TextInput, Button, Text, useTheme } from "react-native-paper";
import { login } from "@/services/auth";
import { isValidEmail } from "@/utils/validators";
import { Spacing, BorderRadius } from "../../../constants/theme";

export default function LoginScreen({ navigation }: any) {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Debug: State to trigger render-time error
  const [shouldThrowError, setShouldThrowError] = useState(false);

  const handleLogin = async () => {
    setError("");

    // Validation
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);

    // Sign in with Firebase Authentication
    console.log("🔵 [LoginScreen] Attempting to log in with", email);
    const result = await login(email.trim(), password);

    if (result.ok) {
      console.log("✅ [LoginScreen] Login successful");
      // Navigation will happen automatically via AuthContext when user state updates
    } else {
      console.log("❌ [LoginScreen] Login failed:", result.error.code);
      // Use the user-friendly error message from the error utility
      setError(result.error.userMessage);
    }

    setLoading(false);
  };

  // Debug: Throw error during render to test ErrorBoundary
  if (shouldThrowError) {
    throw new Error("🧪 Test render error - ErrorBoundary should catch this");
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text
        variant="headlineLarge"
        style={[styles.title, { color: theme.colors.onBackground }]}
      >
        Welcome back
      </Text>
      <Text
        variant="bodyMedium"
        style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
      >
        Sign in to continue to Vibe
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
        onPress={handleLogin}
        loading={loading}
        disabled={loading}
        style={styles.button}
      >
        Sign In
      </Button>

      <Button
        mode="text"
        onPress={() => navigation.navigate("Signup")}
        disabled={loading}
      >
        Don&apos;t have an account? Get started
      </Button>

      {/* Debug: Test ErrorBoundary - Remove after testing */}
      {__DEV__ && (
        <Button
          mode="outlined"
          onPress={() => setShouldThrowError(true)}
          style={styles.debugButton}
          textColor={theme.colors.error}
        >
          🧪 Test Error Boundary
        </Button>
      )}
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
  debugButton: {
    marginTop: Spacing.xl,
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
