/**
 * OnboardingUsernameScreen — Step 3 of signup (post-auth)
 *
 * Dedicated screen for choosing a unique username and display name.
 * Clear separation between username (unique handle) and display name (visible name).
 * Live availability checking with debounce.
 */

import OnboardingProgress from "@/components/onboarding/OnboardingProgress";
import { BorderRadius, Spacing } from "@/constants/theme";
import { checkUsernameAvailable } from "@/services/users";
import { useOnboarding } from "@/store/OnboardingContext";
import { isValidDisplayName, isValidUsername } from "@/utils/validators";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/onboarding/OnboardingUsernameScreen");

const TOTAL_STEPS = 5;
const DEBOUNCE_MS = 400;

export default function OnboardingUsernameScreen({ navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const {
    username,
    setUsername: setCtxUsername,
    displayName,
    setDisplayName: setCtxDisplayName,
    usernameAvailable,
    setUsernameAvailable,
  } = useOnboarding();

  const [checking, setChecking] = useState(false);
  const [localError, setLocalError] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayNameRef = useRef<any>(null);

  // ── Debounced availability check ──────────────────────────────────────
  const checkAvailability = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      const normalized = text.trim();
      if (normalized.length < 3 || !isValidUsername(normalized)) {
        setUsernameAvailable(null);
        setChecking(false);
        return;
      }

      setChecking(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const available = await checkUsernameAvailable(normalized);
          setUsernameAvailable(available);
        } catch (err) {
          logger.error("Username check error:", err);
          setUsernameAvailable(false);
        } finally {
          setChecking(false);
        }
      }, DEBOUNCE_MS);
    },
    [setUsernameAvailable],
  );

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleUsernameChange = (text: string) => {
    setCtxUsername(text);
    if (localError) setLocalError("");
    checkAvailability(text);
  };

  const usernameValid = isValidUsername(username) && usernameAvailable === true;
  const displayNameValid = isValidDisplayName(displayName.trim());

  const canContinue = usernameValid && displayNameValid && !checking;

  const handleContinue = () => {
    Keyboard.dismiss();
    setLocalError("");

    if (!isValidUsername(username)) {
      setLocalError("Username must be 3–20 characters (letters, numbers, _)");
      return;
    }
    if (!usernameAvailable) {
      setLocalError("That username isn't available");
      return;
    }
    if (!displayNameValid) {
      setLocalError("Please enter a display name");
      return;
    }

    navigation.navigate("OnboardingPhoto");
  };

  // ── Username status icon ───────────────────────────────────────────────
  const renderUsernameRight = () => {
    if (checking) {
      return (
        <TextInput.Icon
          icon={() => (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          )}
        />
      );
    }
    if (usernameAvailable === true && username.length >= 3) {
      return <TextInput.Icon icon="check-circle" color="#4CAF50" />;
    }
    if (usernameAvailable === false && username.length >= 3) {
      return <TextInput.Icon icon="close-circle" color={theme.colors.error} />;
    }
    return null;
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Top bar — no back in onboarding step 1 (username is first post-auth screen) */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={{ width: 48 }} />
      </View>

      <OnboardingProgress
        currentStep={3}
        totalSteps={TOTAL_STEPS}
        label="Step 3 of 5"
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
            Choose your identity
          </Text>
          <Text
            variant="bodyMedium"
            style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            Pick a unique username and how you'd like to be called
          </Text>

          {/* Username */}
          <View style={styles.inputGroup}>
            <TextInput
              label="Username"
              value={username}
              onChangeText={handleUsernameChange}
              mode="outlined"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => displayNameRef.current?.focus()}
              placeholder="@username"
              left={<TextInput.Icon icon="at" />}
              right={renderUsernameRight()}
              style={styles.input}
            />
            {usernameAvailable === false &&
              username.length >= 3 &&
              !checking && (
                <Text style={[styles.hint, { color: theme.colors.error }]}>
                  That username is taken — try another
                </Text>
              )}
            <Text
              style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}
            >
              3–20 characters · letters, numbers, underscores
            </Text>
          </View>

          {/* Display Name */}
          <View style={styles.inputGroup}>
            <TextInput
              ref={displayNameRef}
              label="Display Name"
              value={displayName}
              onChangeText={(text) => {
                setCtxDisplayName(text);
                if (localError) setLocalError("");
              }}
              mode="outlined"
              returnKeyType="done"
              onSubmitEditing={canContinue ? handleContinue : undefined}
              placeholder="Your Name"
              left={<TextInput.Icon icon="account-outline" />}
              style={styles.input}
            />
            <Text
              style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}
            >
              This is the name others will see
            </Text>
          </View>

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
      </ScrollView>

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
      </View>
    </KeyboardAvoidingView>
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
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  input: {
    marginBottom: 2,
  },
  hint: {
    fontSize: 12,
    marginLeft: Spacing.xs,
    marginTop: 2,
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
