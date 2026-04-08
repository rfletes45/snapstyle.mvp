/**
 * SignupEmailScreen — Step 1 of signup
 *
 * Collects the user's email address and TOS acceptance.
 * One focused purpose: establish the account identifier.
 */

import OnboardingProgress from "@/components/onboarding/OnboardingProgress";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useSignup } from "@/store/SignupContext";
import { isValidEmail } from "@/utils/validators";
import React, { useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Total visible signup steps (Email → Password → Username → Photo → Style) */
const TOTAL_STEPS = 5;

export default function SignupEmailScreen({ navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { email, setEmail, tosAccepted, setTosAccepted } = useSignup();
  const [localError, setLocalError] = useState("");
  const inputRef = useRef<any>(null);

  const emailValid = email.trim().length > 0 && isValidEmail(email.trim());

  const canContinue = emailValid && tosAccepted;

  const handleContinue = () => {
    Keyboard.dismiss();
    setLocalError("");

    if (!email.trim()) {
      setLocalError("Please enter your email address");
      return;
    }
    if (!isValidEmail(email.trim())) {
      setLocalError("Please enter a valid email address");
      return;
    }
    if (!tosAccepted) {
      setLocalError("Please accept the Terms of Service to continue");
      return;
    }

    navigation.navigate("SignupPassword");
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
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <IconButton
            icon="arrow-left"
            onPress={() => navigation.goBack()}
            iconColor={theme.colors.onBackground}
          />
        </View>

        {/* Progress */}
        <OnboardingProgress
          currentStep={1}
          totalSteps={TOTAL_STEPS}
          label="Step 1 of 5"
        />

        {/* Content */}
        <View style={styles.content}>
          <Text
            variant="headlineMedium"
            style={[styles.title, { color: theme.colors.onBackground }]}
          >
            What&apos;s your email?
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            We&apos;ll use this to create your account
          </Text>

          <TextInput
            ref={inputRef}
            label="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (localError) setLocalError("");
            }}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoFocus
            returnKeyType="next"
            onSubmitEditing={handleContinue}
            left={<TextInput.Icon icon="email-outline" />}
            right={
              emailValid ? (
                <TextInput.Icon icon="check-circle" color="#4CAF50" />
              ) : null
            }
            style={styles.input}
            error={!!localError && localError.includes("email")}
          />

          {/* TOS */}
          <TouchableWithoutFeedback
            onPress={() => setTosAccepted(!tosAccepted)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: tosAccepted }}
            accessibilityLabel="I agree to the Terms of Service and Privacy Policy"
          >
            <View style={styles.tosRow}>
              <View
                style={[
                  styles.tosCheckbox,
                  {
                    borderColor: tosAccepted
                      ? theme.colors.primary
                      : theme.colors.onSurfaceVariant,
                    backgroundColor: tosAccepted
                      ? theme.colors.primary
                      : "transparent",
                  },
                ]}
              >
                {tosAccepted && (
                  <Text
                    style={{
                      color: theme.colors.onPrimary,
                      fontSize: 14,
                      lineHeight: 16,
                    }}
                  >
                    ✓
                  </Text>
                )}
              </View>
              <Text
                variant="bodySmall"
                style={[
                  styles.tosText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                I agree to the{" "}
                <Text
                  style={{ color: theme.colors.primary, fontWeight: "600" }}
                >
                  Terms of Service
                </Text>{" "}
                and{" "}
                <Text
                  style={{ color: theme.colors.primary, fontWeight: "600" }}
                >
                  Privacy Policy
                </Text>
              </Text>
            </View>
          </TouchableWithoutFeedback>

          {/* Error */}
          {localError ? (
            <View
              style={[
                styles.errorBox,
                { backgroundColor: theme.colors.errorContainer },
              ]}
            >
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {localError}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Bottom CTA */}
        <View
          style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}
        >
          <Button
            mode="contained"
            onPress={handleContinue}
            disabled={!canContinue}
            style={styles.ctaBtn}
            contentStyle={styles.ctaBtnContent}
            labelStyle={styles.ctaLabel}
          >
            Continue
          </Button>

          <View style={styles.linkRow}>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Already have an account?{" "}
            </Text>
            <Button
              mode="text"
              compact
              onPress={() => navigation.navigate("Login")}
              labelStyle={styles.linkLabel}
            >
              Sign in
            </Button>
          </View>
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
    paddingHorizontal: Spacing.xs,
    alignItems: "flex-start",
  },
  content: {
    flex: 1,
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
    marginBottom: Spacing.lg,
  },
  tosRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    marginBottom: Spacing.md,
  },
  tosCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  tosText: {
    flex: 1,
    lineHeight: 20,
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
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  linkLabel: {
    fontSize: 14,
  },
});
