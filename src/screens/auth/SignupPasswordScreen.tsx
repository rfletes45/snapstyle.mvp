/**
 * SignupPasswordScreen — Step 2 of signup
 *
 * Dedicated password creation screen with real-time strength validation.
 * Account is created via Firebase Auth on successful submission, then
 * AppGate transitions to the onboarding stack for profile setup.
 *
 * Password requirements (all must pass to proceed):
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one number
 *
 * Bonus for "strong" rating:
 * - At least one special character
 */

import OnboardingProgress from "@/components/onboarding/OnboardingProgress";
import { BorderRadius, Spacing } from "@/constants/theme";
import { signUp } from "@/services/auth";
import { useSignup } from "@/store/SignupContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  IconButton,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/auth/SignupPasswordScreen");

// ---------------------------------------------------------------------------
// Password strength
// ---------------------------------------------------------------------------

type PasswordStrength = "weak" | "good" | "strong";

interface StrengthResult {
  level: PasswordStrength;
  label: string;
  color: string;
  fraction: number;
}

interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
  required: boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  {
    label: "At least 8 characters",
    test: (pw) => pw.length >= 8,
    required: true,
  },
  {
    label: "An uppercase letter",
    test: (pw) => /[A-Z]/.test(pw),
    required: true,
  },
  { label: "A number", test: (pw) => /[0-9]/.test(pw), required: true },
  {
    label: "A special character",
    test: (pw) => /[^A-Za-z0-9]/.test(pw),
    required: false,
  },
];

function evaluateStrength(pw: string): StrengthResult {
  const requiredPassed = PASSWORD_RULES.filter(
    (r) => r.required && r.test(pw),
  ).length;
  const totalRequired = PASSWORD_RULES.filter((r) => r.required).length;
  const bonusPassed = PASSWORD_RULES.filter(
    (r) => !r.required && r.test(pw),
  ).length;

  if (requiredPassed < totalRequired) {
    const fraction = Math.max(0.1, requiredPassed / (totalRequired + 1));
    return { level: "weak", label: "Weak", color: "#d32f2f", fraction };
  }
  if (bonusPassed > 0) {
    return { level: "strong", label: "Strong", color: "#2E7D32", fraction: 1 };
  }
  return { level: "good", label: "Good", color: "#4CAF50", fraction: 0.75 };
}

const TOTAL_STEPS = 5;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SignupPasswordScreen({ navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    email,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    reset: resetSignup,
  } = useSignup();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const strength = useMemo(
    () => (password.length > 0 ? evaluateStrength(password) : null),
    [password],
  );

  const passwordAccepted =
    strength?.level === "good" || strength?.level === "strong";
  const passwordsMatch = password === confirmPassword;

  const canSubmit =
    !loading &&
    passwordAccepted &&
    confirmPassword.length > 0 &&
    passwordsMatch;

  const handleCreateAccount = async () => {
    Keyboard.dismiss();
    setError("");

    if (!passwordAccepted) {
      setError("Your password doesn't meet the requirements below");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    logger.info("🔵 Creating account for", email);

    const result = await signUp(email.trim(), password);

    if (result.ok) {
      logger.info("✅ Account created successfully");
      // AppGate will detect the new Firebase user with no profile
      // and switch to the OnboardingStack automatically.
      // Clear signup context state since we no longer need it.
      resetSignup();
    } else {
      logger.info("❌ Signup failed:", result.error.code);
      setError(result.error.userMessage);
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <IconButton
          icon="arrow-left"
          onPress={() => navigation.goBack()}
          iconColor={theme.colors.onBackground}
          disabled={loading}
        />
      </View>

      {/* Progress */}
      <OnboardingProgress
        currentStep={2}
        totalSteps={TOTAL_STEPS}
        label="Step 2 of 5"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text
            variant="headlineMedium"
            style={[styles.title, { color: theme.colors.onBackground }]}
          >
            Create a password
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            Make it strong to keep your account secure
          </Text>

          {/* Password input */}
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
            autoFocus
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={showPassword ? "eye-off" : "eye"}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
            style={styles.input}
          />

          {/* Strength indicator + rules */}
          {strength && (
            <View style={styles.strengthSection}>
              {/* Bar */}
              <View style={styles.strengthRow}>
                <View
                  style={[
                    styles.strengthBarBg,
                    { backgroundColor: theme.colors.outlineVariant },
                  ]}
                >
                  <View
                    style={[
                      styles.strengthBarFill,
                      {
                        width: `${strength.fraction * 100}%`,
                        backgroundColor: strength.color,
                      },
                    ]}
                  />
                </View>
                <Text
                  variant="labelSmall"
                  style={[styles.strengthLabel, { color: strength.color }]}
                >
                  {strength.label}
                </Text>
              </View>

              {/* Rules checklist */}
              <View style={styles.rulesContainer}>
                {PASSWORD_RULES.map((rule) => {
                  const passed = rule.test(password);
                  return (
                    <View key={rule.label} style={styles.ruleRow}>
                      <MaterialCommunityIcons
                        name={passed ? "check-circle" : "circle-outline"}
                        size={16}
                        color={
                          passed ? "#4CAF50" : theme.colors.onSurfaceVariant
                        }
                      />
                      <Text
                        variant="labelSmall"
                        style={[
                          styles.ruleText,
                          {
                            color: passed
                              ? "#4CAF50"
                              : theme.colors.onSurfaceVariant,
                          },
                        ]}
                      >
                        {rule.label}
                        {!rule.required && " (optional)"}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Confirm password */}
          <TextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (error) setError("");
            }}
            mode="outlined"
            secureTextEntry={!showConfirm}
            disabled={loading}
            left={<TextInput.Icon icon="lock-check-outline" />}
            right={
              <TextInput.Icon
                icon={showConfirm ? "eye-off" : "eye"}
                onPress={() => setShowConfirm(!showConfirm)}
              />
            }
            style={styles.input}
            error={confirmPassword.length > 0 && !passwordsMatch}
          />

          {confirmPassword.length > 0 && !passwordsMatch && (
            <Text
              variant="labelSmall"
              style={[styles.mismatchText, { color: theme.colors.error }]}
            >
              Passwords do not match
            </Text>
          )}

          {/* Error */}
          {error ? (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: theme.colors.errorContainer },
              ]}
            >
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {error}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View
        style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}
      >
        <Button
          mode="contained"
          onPress={handleCreateAccount}
          loading={loading}
          disabled={!canSubmit}
          style={styles.ctaBtn}
          contentStyle={styles.ctaBtnContent}
          labelStyle={styles.ctaLabel}
        >
          Create Account
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: Spacing.xs,
    alignItems: "flex-start",
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  title: {
    fontWeight: "bold",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    marginBottom: Spacing.xxl,
  },
  input: {
    marginBottom: Spacing.md,
  },
  strengthSection: {
    marginBottom: Spacing.lg,
    marginTop: -Spacing.xs,
    gap: Spacing.sm,
  },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  strengthBarBg: {
    flex: 1,
    height: 4,
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
  rulesContainer: {
    gap: 4,
    marginLeft: Spacing.xs,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  ruleText: {
    fontSize: 13,
  },
  mismatchText: {
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  errorBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  errorText: {
    textAlign: "center",
  },
  bottomSection: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  ctaBtn: {
    borderRadius: BorderRadius.md,
  },
  ctaBtnContent: {
    paddingVertical: 6,
  },
  ctaLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
});
