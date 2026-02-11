/**
 * LoginScreen
 * Vibe branded sign-in screen with:
 * - Email / password login
 * - Password visibility toggle
 * - "Forgot Password?" link → ForgotPasswordScreen
 * - Google Sign-In button (UI-ready, pending SDK integration)
 * - Back navigation to WelcomeScreen
 * - OR-divider and link to Signup
 */

import { login } from "@/services/auth";
import { isValidEmail } from "@/utils/validators";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/auth/LoginScreen");
export default function LoginScreen({ navigation }: any) {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    Keyboard.dismiss();
    setError("");

    // Validation
    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }

    if (!isValidEmail(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);

    logger.info("🔵 [LoginScreen] Attempting to log in with", email);
    const result = await login(email.trim(), password);

    if (result.ok) {
      logger.info("✅ [LoginScreen] Login successful");
      // Navigation happens automatically via AuthContext
    } else {
      logger.info("❌ [LoginScreen] Login failed:", result.error.code);
      setError(result.error.userMessage);
    }

    setLoading(false);
  };

  const handleGoogleSignIn = () => {
    // NOTE: Integrate @react-native-google-signin/google-signin
    // For now, show a message that it's coming soon
    setError("Google Sign-In is coming soon!");
  };

  return (
    <TouchableWithoutFeedback
      onPress={Platform.OS === "web" ? undefined : Keyboard.dismiss}
      disabled={Platform.OS === "web"}
    >
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

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
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

          {/* Google Sign-In Button */}
          <Button
            mode="outlined"
            onPress={handleGoogleSignIn}
            disabled={loading}
            style={styles.googleBtn}
            contentStyle={styles.googleBtnContent}
            icon={({ size }) => (
              <MaterialCommunityIcons
                name="google"
                size={size}
                color={theme.colors.onBackground}
              />
            )}
            textColor={theme.colors.onBackground}
          >
            Continue with Google
          </Button>

          {/* OR Divider */}
          <View style={styles.dividerRow}>
            <View
              style={[
                styles.dividerLine,
                { backgroundColor: theme.colors.outlineVariant },
              ]}
            />
            <Text
              variant="labelMedium"
              style={[
                styles.dividerText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              OR
            </Text>
            <View
              style={[
                styles.dividerLine,
                { backgroundColor: theme.colors.outlineVariant },
              ]}
            />
          </View>

          {/* Email Input */}
          <TextInput
            label="Email"
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
          />

          {/* Password Input */}
          <TextInput
            label="Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (error) setError("");
            }}
            mode="outlined"
            secureTextEntry={!showPassword}
            disabled={loading}
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={showPassword ? "eye-off" : "eye"}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
            style={styles.input}
          />

          {/* Forgot Password Link */}
          <View style={styles.forgotRow}>
            <Button
              mode="text"
              compact
              onPress={() => navigation.navigate("ForgotPassword")}
              disabled={loading}
              labelStyle={styles.forgotLabel}
            >
              Forgot password?
            </Button>
          </View>

          {/* Error Message */}
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

          {/* Sign In Button */}
          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.signInBtn}
            contentStyle={styles.btnContent}
          >
            Sign In
          </Button>

          {/* Signup Link */}
          <View style={styles.bottomLinkRow}>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Don't have an account?{" "}
            </Text>
            <Button
              mode="text"
              compact
              onPress={() => navigation.navigate("Signup")}
              disabled={loading}
              labelStyle={styles.linkLabel}
            >
              Get started
            </Button>
          </View>
        </ScrollView>
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
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    flexGrow: 1,
    justifyContent: "center",
  },
  title: {
    fontWeight: "bold",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    marginBottom: Spacing.xxl,
  },
  googleBtn: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  googleBtnContent: {
    paddingVertical: 6,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
  },
  input: {
    marginBottom: Spacing.md,
  },
  forgotRow: {
    alignItems: "flex-end",
    marginBottom: Spacing.sm,
  },
  forgotLabel: {
    fontSize: 13,
  },
  errorContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  error: {
    textAlign: "center",
  },
  signInBtn: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  btnContent: {
    paddingVertical: 4,
  },
  bottomLinkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  linkLabel: {
    fontWeight: "bold",
  },
});
