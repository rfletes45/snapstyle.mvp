/**
 * OnboardingPhotoScreen — Step 4 of signup (post-auth)
 *
 * Dedicated "Set up your profile photo" screen.
 * Photo is optional — the user can skip cleanly.
 * Premium, focused layout with prominent avatar area.
 */

import OnboardingProgress from "@/components/onboarding/OnboardingProgress";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useOnboarding } from "@/store/OnboardingContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useRef } from "react";
import {
  Alert,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TOTAL_STEPS = 5;

export default function OnboardingPhotoScreen({ navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { photoUri, setPhotoUri } = useOnboarding();

  const avatarScale = useRef(new Animated.Value(1)).current;

  const animateAvatar = useCallback(() => {
    Animated.sequence([
      Animated.timing(avatarScale, {
        toValue: 0.92,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(avatarScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, [avatarScale]);

  // ── Photo actions ──────────────────────────────────────────────────────

  const handleTakePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Camera Access Needed",
        "Allow camera access in your device settings to take a profile photo.",
        [{ text: "OK" }],
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      animateAvatar();
    }
  }, [setPhotoUri, animateAvatar]);

  const handleChoosePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Photo Library Access Needed",
        "Allow photo library access in your device settings to choose a profile photo.",
        [{ text: "OK" }],
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      animateAvatar();
    }
  }, [setPhotoUri, animateAvatar]);

  const handleRemovePhoto = () => {
    setPhotoUri(null);
    animateAvatar();
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.colors.onBackground}
          />
        </Pressable>
      </View>

      <OnboardingProgress
        currentStep={4}
        totalSteps={TOTAL_STEPS}
        label="Step 4 of 5 · Optional"
      />

      {/* Main content */}
      <View style={styles.content}>
        <Text
          variant="headlineMedium"
          style={[styles.title, { color: theme.colors.onBackground }]}
        >
          Add a profile photo
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
        >
          Help friends recognise you — or skip for now
        </Text>

        {/* Avatar */}
        <Animated.View
          style={[
            styles.avatarRing,
            {
              borderColor: photoUri
                ? theme.colors.primary
                : theme.colors.outlineVariant,
              transform: [{ scale: avatarScale }],
            },
          ]}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatarImage} />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <MaterialCommunityIcons
                name="camera-plus-outline"
                size={48}
                color={theme.colors.onSurfaceVariant}
              />
            </View>
          )}
        </Animated.View>

        {/* Action buttons */}
        <View style={styles.actionButtons}>
          <Pressable
            onPress={handleTakePhoto}
            style={({ pressed }) => [
              styles.photoBtn,
              {
                backgroundColor: pressed
                  ? theme.colors.primaryContainer
                  : theme.colors.surface,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="camera-outline"
              size={20}
              color={theme.colors.primary}
            />
            <Text
              style={[styles.photoBtnLabel, { color: theme.colors.primary }]}
            >
              Take Photo
            </Text>
          </Pressable>

          <Pressable
            onPress={handleChoosePhoto}
            style={({ pressed }) => [
              styles.photoBtn,
              {
                backgroundColor: pressed
                  ? theme.colors.primaryContainer
                  : theme.colors.surface,
                borderColor: theme.colors.outlineVariant,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="image-outline"
              size={20}
              color={theme.colors.primary}
            />
            <Text
              style={[styles.photoBtnLabel, { color: theme.colors.primary }]}
            >
              Choose Photo
            </Text>
          </Pressable>
        </View>

        {photoUri && (
          <Pressable onPress={handleRemovePhoto} hitSlop={8}>
            <Text style={[styles.removeLabel, { color: theme.colors.error }]}>
              Remove photo
            </Text>
          </Pressable>
        )}
      </View>

      {/* Bottom CTA */}
      <View
        style={[styles.bottomSection, { paddingBottom: insets.bottom + 16 }]}
      >
        <Button
          mode="contained"
          onPress={() => navigation.navigate("OnboardingDisplayStyle")}
          style={styles.ctaBtn}
          contentStyle={styles.ctaBtnContent}
          labelStyle={styles.ctaLabel}
        >
          {photoUri ? "Continue" : "Skip for Now"}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingHorizontal: Spacing.lg,
    alignItems: "flex-start",
  },
  backBtn: {
    padding: 8,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  title: {
    fontWeight: "bold",
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  subtitle: {
    marginBottom: Spacing.xxl,
    textAlign: "center",
  },
  avatarRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: Spacing.xl,
  },
  avatarImage: {
    width: 152,
    height: 152,
    borderRadius: 76,
  },
  avatarPlaceholder: {
    width: 152,
    height: 152,
    borderRadius: 76,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  photoBtnLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  removeLabel: {
    fontSize: 14,
    fontWeight: "500",
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
