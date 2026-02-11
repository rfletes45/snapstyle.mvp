/**
 * SignupScreen
 * Vibe branded account creation screen with:
 * - Email / password signup
 * - Password visibility toggle
 * - Real-time password strength indicator
 * - Terms of Service / Privacy Policy acknowledgement
 * - Google Sign-Up button (UI-ready, pending SDK integration)
 * - Back navigation to WelcomeScreen
 * - OR-divider and link to Login
 */

import { signUp } from "@/services/auth";
import { isValidEmail, isValidPassword } from "@/utils/validators";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
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
  Checkbox,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { BorderRadius, Spacing } from "@/constants/theme";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/auth/SignupScreen");
// =============================================================================
// Password strength utility
// =============================================================================

type PasswordStrength = "weak" | "fair" | "good" | "strong";

interface StrengthResult {
  level: PasswordStrength;
  label: string;
  color: string;
  /** 0-1 fraction for progress bar */
  fraction: number;
}

function evaluatePasswordStrength(pw: string): StrengthResult {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1)
    return { level: "weak", label: "Weak", color: "#d32f2f", fraction: 0.25 };
  if (score === 2)
    return { level: "fair", label: "Fair", color: "#f9a825", fraction: 0.5 };
  if (score === 3)
    return { level: "good", label: "Good", color: "#4CAF50", fraction: 0.75 };
  return { level: "strong", label: "Strong", color: "#2E7D32", fraction: 1 };
}

// =============================================================================
// Component
// =============================================================================

export default function SignupScreen({ navigation }: any) {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const passwordStrength = useMemo(
    () => (password.length > 0 ? evaluatePasswordStrength(password) : null),
    [password],
  );

  const handleSignup = async () => {
    Keyboard.dismiss();
    setError("");

    // Validation
    if (!email.trim() || !password || !confirmPassword) {
      setError("All fields are required");
      return;
    }

    if (!isValidEmail(email.trim())) {
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

    if (!tosAccepted) {
      setError("Please accept the Terms of Service to continue");
      return;
    }

    setLoading(true);

    logger.info("🔵 [SignupScreen] Creating account for", email);
    const result = await signUp(email.trim(), password);

    if (result.ok) {
      logger.info("✅ [SignupScreen] Account created successfully");
      navigation.navigate("ProfileSetup");
    } else {
      logger.info("❌ [SignupScreen] Signup failed:", result.error.code);
      setError(result.error.userMessage);
    }

    setLoading(false);
  };

  const handleGoogleSignUp = () => {
    // NOTE: Integrate @react-native-google-signin/google-signin
    setError("Google Sign-Up is coming soon!");
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
            Join Vibe
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            Create your account to get started
          </Text>

          {/* Google Sign-Up Button */}
          <Button
            mode="outlined"
            onPress={handleGoogleSignUp}
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

          {/* Password Strength Indicator */}
          {passwordStrength && (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBarBg}>
                <View
                  style={[
                    styles.strengthBarFill,
                    {
                      width: `${passwordStrength.fraction * 100}%`,
                      backgroundColor: passwordStrength.color,
                    },
                  ]}
                />
              </View>
              <Text
                variant="labelSmall"
                style={[
                  styles.strengthLabel,
                  { color: passwordStrength.color },
                ]}
              >
                {passwordStrength.label}
              </Text>
            </View>
          )}

          {/* Confirm Password Input */}
          <TextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (error) setError("");
            }}
            mode="outlined"
            secureTextEntry={!showConfirmPassword}
            disabled={loading}
            left={<TextInput.Icon icon="lock-check-outline" />}
            right={
              <TextInput.Icon
                icon={showConfirmPassword ? "eye-off" : "eye"}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            }
            style={styles.input}
            error={confirmPassword.length > 0 && password !== confirmPassword}
          />
          {confirmPassword.length > 0 && password !== confirmPassword && (
            <Text
              variant="labelSmall"
              style={[styles.mismatchText, { color: theme.colors.error }]}
            >
              Passwords do not match
            </Text>
          )}

          {/* Terms of Service Checkbox */}
          <View style={styles.tosRow}>
            <Checkbox
              status={tosAccepted ? "checked" : "unchecked"}
              onPress={() => setTosAccepted(!tosAccepted)}
              disabled={loading}
            />
            <Text
              variant="bodySmall"
              style={[styles.tosText, { color: theme.colors.onSurfaceVariant }]}
            >
              I agree to the{" "}
              <Text style={{ color: theme.colors.primary, fontWeight: "600" }}>
                Terms of Service
              </Text>{" "}
              and{" "}
              <Text style={{ color: theme.colors.primary, fontWeight: "600" }}>
                Privacy Policy
              </Text>
            </Text>
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

          {/* Create Account Button */}
          <Button
            mode="contained"
            onPress={handleSignup}
            loading={loading}
            disabled={loading}
            style={styles.createBtn}
            contentStyle={styles.btnContent}
          >
            Create Account
          </Button>

          {/* Login Link */}
          <View style={styles.bottomLinkRow}>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Already have an account?{" "}
            </Text>
            <Button
              mode="text"
              compact
              onPress={() => navigation.navigate("Login")}
              disabled={loading}
              labelStyle={styles.linkLabel}
            >
              Sign in
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
  },
  title: {
    fontWeight: "bold",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    marginBottom: Spacing.xl,
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
  strengthContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    marginTop: -Spacing.xs,
  },
  strengthBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: "#E0E0E0",
    borderRadius: 2,
    overflow: "hidden",
  },
  strengthBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  strengthLabel: {
    fontWeight: "bold",
    width: 50,
    textAlign: "right",
  },
  mismatchText: {
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  tosRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    marginLeft: -Spacing.sm,
  },
  tosText: {
    flex: 1,
    lineHeight: 20,
  },
  errorContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  error: {
    textAlign: "center",
  },
  createBtn: {
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
