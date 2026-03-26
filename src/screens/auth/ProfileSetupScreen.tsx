import {
  ConversationDisplayMode,
  DEFAULT_DISPLAY_MODE,
} from "@/chat/displayMode";
import { BorderRadius, Spacing } from "@/constants/theme";
import { uploadProfilePicture } from "@/services/profileService";
import { checkUsernameAvailable, setupNewUser } from "@/services/users";
import { useAuth } from "@/store/AuthContext";
import { useConversationDisplayMode } from "@/store/ConversationDisplayModeContext";
import { useUser } from "@/store/UserContext";
import { isValidDisplayName, isValidUsername } from "@/utils/validators";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
const logger = createLogger("screens/auth/ProfileSetupScreen");

// =============================================================================
// Chat Display Style Preview Data
// =============================================================================

interface DisplayStyleOption {
  mode: ConversationDisplayMode;
  label: string;
  description: string;
  icon: "chat" | "format-list-text";
  previewLines: { text: string; isMine: boolean }[];
}

const DISPLAY_STYLES: DisplayStyleOption[] = [
  {
    mode: "bubbles",
    label: "Bubbles",
    description: "Classic chat bubbles",
    icon: "chat",
    previewLines: [
      { text: "Hey, what's up?", isMine: false },
      { text: "Not much, you?", isMine: true },
      { text: "Let's hang out!", isMine: false },
    ],
  },
  {
    mode: "stacked",
    label: "Stacked",
    description: "Compact & dense view",
    icon: "format-list-text",
    previewLines: [
      { text: "Hey, what's up?", isMine: false },
      { text: "Not much, you?", isMine: true },
      { text: "Let's hang out!", isMine: false },
    ],
  },
];

// =============================================================================
// Component
// =============================================================================

export default function ProfileSetupScreen({ navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const { refreshProfile } = useUser();
  const { setDisplayMode: persistDisplayMode } = useConversationDisplayMode();

  // ── State ──────────────────────────────────────────────────────────────
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [selectedDisplayMode, setSelectedDisplayMode] =
    useState<ConversationDisplayMode>(DEFAULT_DISPLAY_MODE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usernameCheckLoading, setUsernameCheckLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null,
  );

  const avatarScale = useRef(new Animated.Value(1)).current;

  // ── Photo selection ────────────────────────────────────────────────────

  const animateAvatar = useCallback(() => {
    Animated.sequence([
      Animated.timing(avatarScale, {
        toValue: 0.9,
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
  }, [animateAvatar]);

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
  }, [animateAvatar]);

  // ── Username checking ──────────────────────────────────────────────────

  const handleUsernameChange = async (text: string) => {
    setUsername(text);
    setUsernameAvailable(null);
    if (error) setError("");

    if (!text || text.length < 3) return;

    setUsernameCheckLoading(true);
    try {
      const available = await checkUsernameAvailable(text);
      setUsernameAvailable(available);
    } catch (err) {
      logger.error("Error checking username:", err);
      setUsernameAvailable(false);
    } finally {
      setUsernameCheckLoading(false);
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────

  const canSubmit =
    !loading &&
    username.trim().length >= 3 &&
    isValidUsername(username) &&
    usernameAvailable === true &&
    displayName.trim().length > 0 &&
    isValidDisplayName(displayName);

  const handleSetupProfile = async () => {
    Keyboard.dismiss();
    setError("");

    if (!isValidUsername(username)) {
      setError("Username must be 3-20 characters (letters, numbers, _)");
      return;
    }
    if (!isValidDisplayName(displayName)) {
      setError("Display name must be 1-50 characters");
      return;
    }
    if (!usernameAvailable) {
      setError("That username is taken");
      return;
    }
    if (!currentFirebaseUser) {
      setError("Not authenticated — please restart the app");
      return;
    }

    setLoading(true);

    try {
      const result = await setupNewUser(
        currentFirebaseUser.uid,
        currentFirebaseUser.email || "",
        username.toLowerCase(),
        displayName,
      );

      if (!result) {
        setError("Failed to set up profile. Please try again.");
        setLoading(false);
        return;
      }

      // Upload photo if selected (non-blocking — profile is created first)
      if (photoUri) {
        setPhotoUploading(true);
        try {
          await uploadProfilePicture(currentFirebaseUser.uid, photoUri);
        } catch (photoErr) {
          logger.warn("Photo upload failed during setup:", photoErr);
          // Don't block onboarding for a photo upload failure
        } finally {
          setPhotoUploading(false);
        }
      }

      // Persist chosen display mode
      persistDisplayMode(selectedDisplayMode);

      // Refresh profile so AppGate detects completion
      await refreshProfile();
      setLoading(false);
    } catch (err: any) {
      logger.error("Profile setup error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────

  const renderDisplayStyleCard = (option: DisplayStyleOption) => {
    const isSelected = selectedDisplayMode === option.mode;
    return (
      <Pressable
        key={option.mode}
        onPress={() => setSelectedDisplayMode(option.mode)}
        style={[
          styles.styleCard,
          {
            borderColor: isSelected
              ? theme.colors.primary
              : theme.colors.outlineVariant,
            backgroundColor: isSelected
              ? theme.colors.primaryContainer
              : theme.colors.surface,
          },
        ]}
        disabled={loading}
      >
        {/* Mini preview */}
        <View
          style={[
            styles.previewBox,
            {
              backgroundColor: theme.dark
                ? "rgba(255,255,255,0.05)"
                : "rgba(0,0,0,0.03)",
            },
          ]}
        >
          {option.previewLines.map((line, i) => {
            if (option.mode === "bubbles") {
              return (
                <View
                  key={i}
                  style={[
                    styles.previewBubble,
                    line.isMine
                      ? {
                          alignSelf: "flex-end",
                          backgroundColor: theme.colors.primary,
                        }
                      : {
                          alignSelf: "flex-start",
                          backgroundColor: theme.colors.surfaceVariant,
                        },
                  ]}
                >
                  <Text
                    style={[
                      styles.previewText,
                      { color: line.isMine ? "#fff" : theme.colors.onSurface },
                    ]}
                    numberOfLines={1}
                  >
                    {line.text}
                  </Text>
                </View>
              );
            }
            // stacked
            return (
              <View key={i} style={styles.previewStacked}>
                <View
                  style={[
                    styles.previewDot,
                    {
                      backgroundColor: line.isMine
                        ? theme.colors.primary
                        : theme.colors.surfaceVariant,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.previewText,
                    { color: theme.colors.onSurface },
                  ]}
                  numberOfLines={1}
                >
                  {line.text}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Label row */}
        <View style={styles.styleLabelRow}>
          <MaterialCommunityIcons
            name={option.icon}
            size={18}
            color={
              isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant
            }
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.styleLabel,
                {
                  color: isSelected
                    ? theme.colors.primary
                    : theme.colors.onSurface,
                },
              ]}
            >
              {option.label}
            </Text>
            <Text
              style={[
                styles.styleDesc,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {option.description}
            </Text>
          </View>
          {isSelected && (
            <MaterialCommunityIcons
              name="check-circle"
              size={20}
              color={theme.colors.primary}
            />
          )}
        </View>
      </Pressable>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text
          variant="headlineLarge"
          style={[styles.title, { color: theme.colors.onBackground }]}
        >
          Set Up Your Profile
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
        >
          Add a photo and pick your username
        </Text>

        {/* ── Photo Picker ──────────────────────────────────────────── */}
        <View style={styles.photoSection}>
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
                  size={40}
                  color={theme.colors.onSurfaceVariant}
                />
              </View>
            )}
          </Animated.View>

          {/* Photo action buttons */}
          <View style={styles.photoButtons}>
            <Pressable
              onPress={handleTakePhoto}
              disabled={loading}
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
                size={18}
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
              disabled={loading}
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
                size={18}
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
            <Pressable
              onPress={() => {
                setPhotoUri(null);
                animateAvatar();
              }}
              hitSlop={8}
            >
              <Text style={[styles.removePhoto, { color: theme.colors.error }]}>
                Remove photo
              </Text>
            </Pressable>
          )}

          {!photoUri && (
            <Text
              style={[
                styles.photoHint,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              You can always add one later
            </Text>
          )}
        </View>

        {/* ── Username ──────────────────────────────────────────────── */}
        <View style={styles.inputGroup}>
          <TextInput
            label="Username"
            value={username}
            onChangeText={handleUsernameChange}
            mode="outlined"
            disabled={loading}
            style={styles.input}
            placeholder="@username"
            autoCapitalize="none"
            autoCorrect={false}
            left={<TextInput.Icon icon="at" />}
            right={
              usernameCheckLoading ? (
                <TextInput.Icon
                  icon={() => (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.primary}
                    />
                  )}
                />
              ) : usernameAvailable === true ? (
                <TextInput.Icon icon="check-circle" color="#4CAF50" />
              ) : usernameAvailable === false && username.length >= 3 ? (
                <TextInput.Icon
                  icon="close-circle"
                  color={theme.colors.error}
                />
              ) : null
            }
          />
          {usernameAvailable === false && username.length >= 3 && (
            <Text style={[styles.fieldHint, { color: theme.colors.error }]}>
              That username is taken
            </Text>
          )}
          <Text
            style={[styles.fieldHint, { color: theme.colors.onSurfaceVariant }]}
          >
            3-20 characters · letters, numbers, underscores
          </Text>
        </View>

        {/* ── Display Name ──────────────────────────────────────────── */}
        <View style={styles.inputGroup}>
          <TextInput
            label="Display Name"
            value={displayName}
            onChangeText={(t) => {
              setDisplayName(t);
              if (error) setError("");
            }}
            mode="outlined"
            disabled={loading}
            style={styles.input}
            placeholder="Your Name"
            left={<TextInput.Icon icon="account-outline" />}
          />
        </View>

        {/* ── Chat Display Style ────────────────────────────────────── */}
        <View style={styles.section}>
          <Text
            variant="titleMedium"
            style={[styles.sectionTitle, { color: theme.colors.onBackground }]}
          >
            Chat Display Style
          </Text>
          <Text
            variant="bodySmall"
            style={[
              styles.sectionSubtitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Choose how messages look on your screen
          </Text>
          <View style={styles.styleCards}>
            {DISPLAY_STYLES.map(renderDisplayStyleCard)}
          </View>
        </View>

        {/* ── Error ─────────────────────────────────────────────────── */}
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

        {/* ── Continue ──────────────────────────────────────────────── */}
        <Button
          mode="contained"
          onPress={handleSetupProfile}
          loading={loading}
          disabled={!canSubmit}
          style={styles.continueBtn}
          contentStyle={styles.continueBtnContent}
        >
          {loading
            ? photoUploading
              ? "Uploading photo…"
              : "Setting up…"
            : "Continue"}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.xl,
  },
  title: {
    fontWeight: "bold",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    marginBottom: Spacing.xxl,
  },

  // ── Photo ──
  photoSection: {
    alignItems: "center",
    marginBottom: Spacing.xxl,
  },
  avatarRing: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  avatarImage: {
    width: 126,
    height: 126,
    borderRadius: 63,
  },
  avatarPlaceholder: {
    width: 126,
    height: 126,
    borderRadius: 63,
    justifyContent: "center",
    alignItems: "center",
  },
  photoButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  photoBtnLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  removePhoto: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  photoHint: {
    fontSize: 13,
    marginTop: 2,
  },

  // ── Inputs ──
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  input: {
    marginBottom: 2,
  },
  fieldHint: {
    fontSize: 12,
    marginLeft: Spacing.xs,
    marginTop: 2,
  },

  // ── Chat display style ──
  section: {
    marginBottom: Spacing.xl,
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    fontWeight: "700",
    marginBottom: 2,
  },
  sectionSubtitle: {
    marginBottom: Spacing.md,
  },
  styleCards: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  styleCard: {
    flex: 1,
    borderWidth: 2,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  previewBox: {
    padding: 8,
    gap: 4,
    minHeight: 72,
    justifyContent: "center",
  },
  previewBubble: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    maxWidth: "80%",
  },
  previewStacked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  previewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  previewText: {
    fontSize: 9,
  },
  styleLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  styleLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  styleDesc: {
    fontSize: 11,
  },

  // ── Error ──
  errorBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  errorText: {
    textAlign: "center",
    fontSize: 14,
  },

  // ── Continue ──
  continueBtn: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  continueBtnContent: {
    paddingVertical: 6,
  },
});
