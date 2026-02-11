/**
 * ForgotPasswordScreen
 * Allows users to request a password reset email.
 * Provides clear feedback and navigation back to Login.
 */

import { resetPassword } from "@/services/auth";
import { isValidEmail } from "@/utils/validators";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import {
  Button,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { BorderRadius, Spacing } from "@/constants/theme";

type ScreenState = "form" | "sent";

export default function ForgotPasswordScreen({ navigation }: any) {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [screenState, setScreenState] = useState<ScreenState>("form");

  const handleResetPassword = async () => {
    Keyboard.dismiss();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    if (!isValidEmail(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);

    const result = await resetPassword(email.trim());

    if (result.ok) {
      setScreenState("sent");
    } else {
      // Don't reveal whether the email exists for security
      // Firebase may throw user-not-found, but we still show success
      // to prevent account enumeration attacks
      setScreenState("sent");
    }

    setLoading(false);
  };

  if (screenState === "sent") {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        {/* Back button */}
        <View style={styles.topBar}>
          <IconButton
            icon="arrow-left"
            onPress={() => navigation.goBack()}
            iconColor={theme.colors.onBackground}
          />
        </View>

        <View style={styles.centeredContent}>
          {/* Success Icon */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <MaterialCommunityIcons
              name="email-check-outline"
              size={56}
              color={theme.colors.primary}
            />
          </View>

          <Text
            variant="headlineMedium"
            style={[styles.successTitle, { color: theme.colors.onBackground }]}
          >
            Check Your Email
          </Text>

          <Text
            variant="bodyLarge"
            style={[
              styles.successBody,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            We've sent a password reset link to{"\n"}
            <Text style={{ fontWeight: "bold", color: theme.colors.primary }}>
              {email.trim()}
            </Text>
          </Text>

          <Text
            variant="bodySmall"
            style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}
          >
            Didn't receive the email? Check your spam folder or try again.
          </Text>

          <Button
            mode="contained"
            onPress={() => navigation.navigate("Login")}
            style={styles.primaryBtn}
          >
            Back to Sign In
          </Button>

          <Button
            mode="text"
            onPress={() => {
              setScreenState("form");
              setEmail("");
              setError("");
            }}
          >
            Try a different email
          </Button>
        </View>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Back button */}
        <View style={styles.topBar}>
          <IconButton
            icon="arrow-left"
            onPress={() => navigation.goBack()}
            iconColor={theme.colors.onBackground}
          />
        </View>

        <View style={styles.centeredContent}>
          {/* Lock Icon */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <MaterialCommunityIcons
              name="lock-reset"
              size={56}
              color={theme.colors.primary}
            />
          </View>

          <Text
            variant="headlineMedium"
            style={[styles.title, { color: theme.colors.onBackground }]}
          >
            Forgot Password?
          </Text>

          <Text
            variant="bodyMedium"
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            No worries! Enter the email address associated with your account and
            we'll send you a link to reset your password.
          </Text>

          <TextInput
            label="Email address"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError("");
            }}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            disabled={loading}
            left={<TextInput.Icon icon="email-outline" />}
            style={styles.input}
            error={!!error}
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
            onPress={handleResetPassword}
            loading={loading}
            disabled={loading || !email.trim()}
            style={styles.primaryBtn}
            contentStyle={styles.btnContent}
          >
            Send Reset Link
          </Button>

          <Button
            mode="text"
            onPress={() => navigation.navigate("Login")}
            disabled={loading}
          >
            Back to Sign In
          </Button>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingTop: Platform.OS === "ios" ? 50 : 16,
    paddingHorizontal: Spacing.xs,
    alignItems: "flex-start",
  },
  centeredContent: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing.xxl,
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  input: {
    width: "100%",
    marginBottom: Spacing.lg,
  },
  primaryBtn: {
    width: "100%",
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  btnContent: {
    paddingVertical: 4,
  },
  errorContainer: {
    width: "100%",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  error: {
    textAlign: "center",
  },
  successTitle: {
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  successBody: {
    textAlign: "center",
    marginBottom: Spacing.lg,
    lineHeight: 24,
  },
  hint: {
    textAlign: "center",
    marginBottom: Spacing.xxl,
    lineHeight: 20,
  },
});
