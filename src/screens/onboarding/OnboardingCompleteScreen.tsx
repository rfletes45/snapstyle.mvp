/**
 * OnboardingCompleteScreen — Final step of onboarding
 *
 * Performs all final writes:
 *  1. setupNewUser() — creates Firestore profile + reserves username
 *  2. uploadProfilePicture() — if the user selected a photo (non-blocking)
 *  3. persistDisplayMode() — saves chat style preference
 *  4. refreshProfile() — signals AppGate that profile is complete
 *
 * Shows a polished completion state then transitions seamlessly into the app.
 */

import { Spacing } from "@/constants/theme";
import { uploadProfilePicture } from "@/services/profileService";
import { getUserProfile, setupNewUser } from "@/services/users";
import { useAuth } from "@/store/AuthContext";
import { useConversationDisplayMode } from "@/store/ConversationDisplayModeContext";
import { useOnboarding } from "@/store/OnboardingContext";
import { useAppTheme } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/onboarding/OnboardingCompleteScreen");

type Phase = "saving" | "done" | "error";

export default function OnboardingCompleteScreen({ navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const { refreshProfile } = useUser();
  const { setDisplayMode: persistDisplayMode } = useConversationDisplayMode();
  const { setThemeMode: applyThemeMode } = useAppTheme();
  const { username, displayName, photoUri, displayMode, themeMode, reset } =
    useOnboarding();

  const [phase, setPhase] = useState<Phase>("saving");
  const [statusText, setStatusText] = useState("Setting up your profile…");
  const [error, setError] = useState("");
  const checkScale = useRef(new Animated.Value(0)).current;
  const hasRun = useRef(false);

  // ── Run setup on mount (exactly once) ─────────────────────────────────
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    (async () => {
      try {
        if (!currentFirebaseUser) {
          throw new Error("Not authenticated — please restart the app");
        }

        // ── CRITICAL SAFETY: Check if user already has a complete profile ──
        // If an existing user was incorrectly routed here (e.g. due to a
        // transient profile fetch failure), we MUST NOT overwrite their data.
        // Instead, just refresh and let AppGate route them to the main app.
        setStatusText("Verifying account…");
        const existingProfile = await getUserProfile(currentFirebaseUser.uid);
        if (existingProfile && existingProfile.username) {
          logger.error(
            "[ACCOUNT SAFETY] OnboardingCompleteScreen mounted for user who " +
              "already has a profile! Username: " +
              existingProfile.username +
              ". Skipping onboarding writes and routing to main app.",
          );
          // Skip all writes — just refresh profile and let AppGate handle it
          await refreshProfile();
          setPhase("done");
          setStatusText("Welcome back!");
          Animated.spring(checkScale, {
            toValue: 1,
            friction: 5,
            useNativeDriver: true,
          }).start();
          reset();
          return;
        }

        // 1. Create user profile + reserve username
        setStatusText("Creating your profile…");
        const user = await setupNewUser(
          currentFirebaseUser.uid,
          currentFirebaseUser.email || "",
          username.toLowerCase(),
          displayName.trim(),
        );

        if (!user) {
          throw new Error("Failed to create profile. Please try again.");
        }

        // 2. Upload photo if selected (non-blocking for UX)
        if (photoUri) {
          setStatusText("Uploading your photo…");
          try {
            await uploadProfilePicture(currentFirebaseUser.uid, photoUri);
          } catch (photoErr) {
            logger.warn("Photo upload failed during onboarding:", photoErr);
            // Don't block completion for photo failure
          }
        }

        // 3. Persist chosen display mode
        persistDisplayMode(displayMode);

        // 4. Apply chosen theme mode (Light / Dark / Auto)
        applyThemeMode(themeMode);

        // 5. Refresh profile → AppGate will detect username → "ready"
        setStatusText("Almost there…");
        await refreshProfile();

        // 5. Show success briefly before AppGate transitions
        setPhase("done");
        setStatusText("You're all set!");

        Animated.spring(checkScale, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true,
        }).start();

        // Clean up onboarding state
        reset();

        // AppGate will automatically switch to MainStack once profile loads.
        // This screen will be unmounted by the navigation tree swap.
      } catch (err: any) {
        logger.error("Onboarding completion error:", err);
        setPhase("error");
        setError(err.message || "Something went wrong. Please try again.");
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = () => {
    hasRun.current = false;
    setPhase("saving");
    setError("");
    // Re-trigger the effect
    hasRun.current = false;
    // Force re-mount by navigating away and back
    navigation.replace("OnboardingComplete");
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.background, paddingTop: insets.top },
      ]}
    >
      <View style={styles.centerContent}>
        {phase === "saving" && (
          <>
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
              style={styles.indicator}
            />
            <Text
              variant="titleMedium"
              style={[styles.statusText, { color: theme.colors.onBackground }]}
            >
              {statusText}
            </Text>
          </>
        )}

        {phase === "done" && (
          <>
            <Animated.View
              style={[
                styles.checkCircle,
                {
                  backgroundColor: theme.colors.primaryContainer,
                  transform: [{ scale: checkScale }],
                },
              ]}
            >
              <MaterialCommunityIcons
                name="check"
                size={48}
                color={theme.colors.primary}
              />
            </Animated.View>
            <Text
              variant="headlineSmall"
              style={[
                styles.statusText,
                { color: theme.colors.onBackground, fontWeight: "bold" },
              ]}
            >
              {statusText}
            </Text>
            <Text
              variant="bodyMedium"
              style={[
                styles.subStatusText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              Welcome to the app
            </Text>
          </>
        )}

        {phase === "error" && (
          <>
            <View
              style={[
                styles.errorCircle,
                { backgroundColor: theme.colors.errorContainer },
              ]}
            >
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={48}
                color={theme.colors.error}
              />
            </View>
            <Text
              variant="titleMedium"
              style={[styles.statusText, { color: theme.colors.error }]}
            >
              Something went wrong
            </Text>
            <Text
              variant="bodyMedium"
              style={[
                styles.subStatusText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {error}
            </Text>
            <Button
              mode="contained"
              onPress={handleRetry}
              style={styles.retryBtn}
            >
              Try Again
            </Button>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  indicator: {
    marginBottom: Spacing.xl,
  },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  errorCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  statusText: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subStatusText: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  retryBtn: {
    marginTop: Spacing.md,
    minWidth: 140,
  },
});
