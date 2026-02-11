/**
 * PrivacySettingsScreen
 *
 * Comprehensive privacy controls for user profile.
 * Allows granular control over who can see profile sections,
 * activity data, and who can contact the user.
 *
 * @module screens/settings/PrivacySettingsScreen
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Chip,
  Divider,
  List,
  Surface,
  Switch,
  Text,
  useTheme,
} from "react-native-paper";
import Animated, { FadeIn, FadeInDown, Layout } from "react-native-reanimated";

import { BorderRadius, Spacing } from "@/constants/theme";
import { useFullProfileData } from "@/hooks/useFullProfileData";
import { updateFullPrivacySettings } from "@/services/profileService";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import {
  DEFAULT_PRIVACY_SETTINGS,
  PRIVACY_PRESETS,
  PrivacyVisibility,
  ProfilePrivacySettings,
} from "@/types/userProfile";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/settings/PrivacySettingsScreen");
// =============================================================================
// Types
// =============================================================================

type Props = NativeStackScreenProps<any, "PrivacySettings">;

/** Preset key type derived from PRIVACY_PRESETS */
type PrivacyPresetKey = keyof typeof PRIVACY_PRESETS;

interface VisibilityOption {
  value: PrivacyVisibility;
  label: string;
  icon: string;
  description: string;
}

interface SettingItem {
  key: keyof ProfilePrivacySettings;
  title: string;
  description: string;
  icon: string;
  type: "visibility" | "boolean";
}

interface SettingSection {
  title: string;
  icon: string;
  settings: SettingItem[];
}

// =============================================================================
// Constants
// =============================================================================

const VISIBILITY_OPTIONS: VisibilityOption[] = [
  {
    value: "everyone",
    label: "Everyone",
    icon: "earth",
    description: "Visible to all users",
  },
  {
    value: "friends",
    label: "Friends",
    icon: "account-group",
    description: "Only your friends can see",
  },
  {
    value: "nobody",
    label: "No One",
    icon: "eye-off",
    description: "Hidden from everyone",
  },
];

const SETTING_SECTIONS: SettingSection[] = [
  {
    title: "Profile Visibility",
    icon: "account-circle",
    settings: [
      {
        key: "profileVisibility",
        title: "Full Profile",
        description: "Who can see your complete profile",
        icon: "account",
        type: "visibility",
      },
      {
        key: "showProfilePicture",
        title: "Profile Picture",
        description: "Who can see your profile picture",
        icon: "image",
        type: "visibility",
      },
      {
        key: "showBio",
        title: "Bio",
        description: "Who can see your bio/about me",
        icon: "text",
        type: "visibility",
      },
      {
        key: "showStatus",
        title: "Status/Mood",
        description: "Who can see your current status",
        icon: "emoticon",
        type: "visibility",
      },
    ],
  },
  {
    title: "Activity Visibility",
    icon: "chart-line",
    settings: [
      {
        key: "showGameScores",
        title: "Game Scores",
        description: "Who can see your game high scores",
        icon: "trophy",
        type: "visibility",
      },
      {
        key: "showBadges",
        title: "Badges & Achievements",
        description: "Who can see your earned badges",
        icon: "medal",
        type: "visibility",
      },
      {
        key: "showLastActive",
        title: "Last Active",
        description: "Who can see when you were last online",
        icon: "clock-outline",
        type: "visibility",
      },
      {
        key: "showOnlineStatus",
        title: "Online Status",
        description: "Who can see if you're currently online",
        icon: "circle",
        type: "visibility",
      },
      {
        key: "showFriendshipInfo",
        title: "Friendship Info",
        description: "Who can see friendship anniversary info",
        icon: "heart",
        type: "visibility",
      },
    ],
  },
  {
    title: "Social Visibility",
    icon: "account-multiple",
    settings: [
      {
        key: "showFriendsList",
        title: "Friends List",
        description: "Who can see your friends",
        icon: "account-group",
        type: "visibility",
      },
      {
        key: "showMutualFriends",
        title: "Show Mutual Friends",
        description: "Display mutual friends on profiles",
        icon: "account-multiple-check",
        type: "boolean",
      },
      {
        key: "showFriendCount",
        title: "Show Friend Count",
        description: "Display your total friend count",
        icon: "counter",
        type: "boolean",
      },
    ],
  },
  {
    title: "Contact Permissions",
    icon: "phone",
    settings: [
      {
        key: "allowFriendRequests",
        title: "Friend Requests",
        description: "Who can send you friend requests",
        icon: "account-plus",
        type: "visibility",
      },
      {
        key: "allowMessages",
        title: "Direct Messages",
        description: "Who can send you messages",
        icon: "message",
        type: "visibility",
      },
      {
        key: "allowCalls",
        title: "Calls",
        description: "Who can call you",
        icon: "phone",
        type: "visibility",
      },
      {
        key: "allowGameInvites",
        title: "Game Invites",
        description: "Who can invite you to games",
        icon: "gamepad-variant",
        type: "visibility",
      },
    ],
  },
  {
    title: "Discovery",
    icon: "magnify",
    settings: [
      {
        key: "appearInSearch",
        title: "Appear in Search",
        description: "Allow your profile to be found via search",
        icon: "magnify",
        type: "boolean",
      },
      {
        key: "allowProfileSharing",
        title: "Allow Profile Sharing",
        description: "Allow others to share your profile",
        icon: "share",
        type: "boolean",
      },
      {
        key: "allowSuggestions",
        title: "Allow Suggestions",
        description: "Show your profile in friend suggestions",
        icon: "account-question",
        type: "boolean",
      },
      {
        key: "trackProfileViews",
        title: "Track Profile Views",
        description: "Count and display profile view count",
        icon: "eye",
        type: "boolean",
      },
    ],
  },
];

const PRESET_INFO: Record<
  PrivacyPresetKey,
  { name: string; icon: string; color: string }
> = {
  public: { name: "Public", icon: "earth", color: "#4CAF50" },
  friendsOnly: {
    name: "Friends Only",
    icon: "account-group",
    color: "#2196F3",
  },
  private: { name: "Private", icon: "shield-lock", color: "#FF9800" },
};

// =============================================================================
// Visibility Selector Component
// =============================================================================

interface VisibilitySelectorProps {
  value: PrivacyVisibility;
  onChange: (value: PrivacyVisibility) => void;
}

const VisibilitySelector = React.memo(function VisibilitySelector({
  value,
  onChange,
}: VisibilitySelectorProps) {
  const theme = useTheme();

  return (
    <View style={styles.visibilitySelector}>
      {VISIBILITY_OPTIONS.map((option) => (
        <Chip
          key={option.value}
          selected={value === option.value}
          onPress={() => onChange(option.value)}
          mode={value === option.value ? "flat" : "outlined"}
          icon={option.icon}
          style={[
            styles.visibilityChip,
            value === option.value && {
              backgroundColor: theme.colors.primaryContainer,
            },
          ]}
          textStyle={
            value === option.value
              ? { color: theme.colors.onPrimaryContainer }
              : undefined
          }
        >
          {option.label}
        </Chip>
      ))}
    </View>
  );
});

// =============================================================================
// Setting Row Component
// =============================================================================

interface SettingRowProps {
  setting: SettingItem;
  value: PrivacyVisibility | boolean;
  onChange: (value: PrivacyVisibility | boolean) => void;
  index: number;
}

const SettingRow = React.memo(function SettingRow({
  setting,
  value,
  onChange,
  index,
}: SettingRowProps) {
  const theme = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      layout={Layout.springify()}
    >
      <Surface
        style={[
          styles.settingRow,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
        elevation={1}
      >
        <View style={styles.settingHeader}>
          <MaterialCommunityIcons
            name={setting.icon as keyof typeof MaterialCommunityIcons.glyphMap}
            size={20}
            color={theme.colors.primary}
          />
          <View style={styles.settingText}>
            <Text
              style={[styles.settingTitle, { color: theme.colors.onSurface }]}
            >
              {setting.title}
            </Text>
            <Text
              style={[
                styles.settingDescription,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {setting.description}
            </Text>
          </View>
        </View>

        {setting.type === "visibility" ? (
          <VisibilitySelector
            value={value as PrivacyVisibility}
            onChange={(v) => onChange(v)}
          />
        ) : (
          <View style={styles.booleanToggle}>
            <Switch
              value={value as boolean}
              onValueChange={(v) => onChange(v)}
              color={theme.colors.primary}
            />
          </View>
        )}
      </Surface>
    </Animated.View>
  );
});

// =============================================================================
// Preset Selector Component
// =============================================================================

interface PresetSelectorProps {
  currentPreset: PrivacyPresetKey | null;
  onSelectPreset: (preset: PrivacyPresetKey) => void;
}

const PresetSelector = React.memo(function PresetSelector({
  currentPreset,
  onSelectPreset,
}: PresetSelectorProps) {
  const theme = useTheme();

  return (
    <Animated.View entering={FadeIn} style={styles.presetContainer}>
      <Text style={[styles.presetTitle, { color: theme.colors.onSurface }]}>
        Quick Presets
      </Text>
      <Text
        style={[
          styles.presetSubtitle,
          { color: theme.colors.onSurfaceVariant },
        ]}
      >
        Choose a preset or customize individual settings below
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.presetList}
      >
        {(Object.keys(PRESET_INFO) as PrivacyPresetKey[]).map((preset) => {
          const info = PRESET_INFO[preset];
          const isSelected = currentPreset === preset;

          return (
            <Surface
              key={preset}
              style={[
                styles.presetCard,
                isSelected && { borderColor: info.color, borderWidth: 2 },
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
              elevation={isSelected ? 3 : 1}
            >
              <Button
                mode={isSelected ? "contained" : "outlined"}
                onPress={() => onSelectPreset(preset)}
                icon={info.icon}
                buttonColor={isSelected ? info.color : undefined}
                style={styles.presetButton}
              >
                {info.name}
              </Button>
            </Surface>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
});

// =============================================================================
// Main Component
// =============================================================================

export default function PrivacySettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const { showSuccess, showError } = useSnackbar();

  // Get full profile data with privacy settings
  const {
    profile,
    isLoading: profileLoading,
    refresh: refreshProfile,
  } = useFullProfileData({
    userId: currentFirebaseUser?.uid || "",
  });

  const [settings, setSettings] = useState<ProfilePrivacySettings>(
    DEFAULT_PRIVACY_SETTINGS,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize settings when profile loads
  useEffect(() => {
    if (profile?.privacy) {
      setSettings(profile.privacy);
    }
  }, [profile?.privacy]);

  // Detect current preset (if settings match any preset exactly)
  const currentPreset = useMemo((): PrivacyPresetKey | null => {
    for (const [presetKey, presetData] of Object.entries(PRIVACY_PRESETS)) {
      const presetSettings = presetData.settings;
      const matches = Object.keys(presetSettings).every(
        (key) =>
          settings[key as keyof ProfilePrivacySettings] ===
          presetSettings[key as keyof ProfilePrivacySettings],
      );
      if (matches) return presetKey as PrivacyPresetKey;
    }
    return null;
  }, [settings]);

  // Check for changes
  useEffect(() => {
    if (!profile?.privacy) {
      setHasChanges(false);
      return;
    }

    const originalSettings = profile.privacy;
    const changed = Object.keys(settings).some(
      (key) =>
        settings[key as keyof ProfilePrivacySettings] !==
        originalSettings[key as keyof ProfilePrivacySettings],
    );
    setHasChanges(changed);
  }, [settings, profile?.privacy]);

  // Handle setting change
  const handleSettingChange = useCallback(
    (key: keyof ProfilePrivacySettings, value: PrivacyVisibility | boolean) => {
      setSettings((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    [],
  );

  // Handle preset selection
  const handlePresetSelect = useCallback((preset: PrivacyPresetKey) => {
    const presetData = PRIVACY_PRESETS[preset];
    setSettings((prev) => ({
      ...prev,
      ...presetData.settings,
    }));
  }, []);

  // Save settings
  const handleSave = useCallback(async () => {
    if (!currentFirebaseUser?.uid) {
      showError("Not logged in");
      return;
    }

    setIsSaving(true);
    try {
      await updateFullPrivacySettings(currentFirebaseUser.uid, settings);
      await refreshProfile();
      showSuccess("Privacy settings saved!");
      setHasChanges(false);
    } catch (error) {
      logger.error("Failed to save privacy settings:", error);
      showError("Failed to save settings. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [
    currentFirebaseUser?.uid,
    settings,
    refreshProfile,
    showSuccess,
    showError,
  ]);

  // Reset to original
  const handleReset = useCallback(() => {
    if (profile?.privacy) {
      setSettings(profile.privacy);
    } else {
      setSettings(DEFAULT_PRIVACY_SETTINGS);
    }
  }, [profile?.privacy]);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Preset Selector */}
        <PresetSelector
          currentPreset={currentPreset}
          onSelectPreset={handlePresetSelect}
        />

        <Divider style={styles.divider} />

        {/* Setting Sections */}
        {SETTING_SECTIONS.map((section) => (
          <Animated.View key={section.title} entering={FadeIn}>
            <List.Section>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons
                  name={section.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                  size={20}
                  color={theme.colors.primary}
                />
                <List.Subheader style={styles.sectionTitle}>
                  {section.title}
                </List.Subheader>
              </View>

              {section.settings.map((setting, index) => (
                <SettingRow
                  key={setting.key}
                  setting={setting}
                  value={settings[setting.key]}
                  onChange={(value) => handleSettingChange(setting.key, value)}
                  index={index}
                />
              ))}
            </List.Section>
          </Animated.View>
        ))}
      </ScrollView>

      {/* Action Buttons */}
      {hasChanges && (
        <Animated.View
          entering={FadeIn}
          style={[styles.actionBar, { backgroundColor: theme.colors.surface }]}
        >
          <Button
            mode="outlined"
            onPress={handleReset}
            disabled={isSaving}
            style={styles.actionButton}
          >
            Reset
          </Button>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={isSaving}
            disabled={isSaving}
            style={styles.actionButton}
          >
            Save Changes
          </Button>
        </Animated.View>
      )}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  presetContainer: {
    padding: Spacing.md,
  },
  presetTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  presetSubtitle: {
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  presetList: {
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  presetCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "transparent",
  },
  presetButton: {
    borderRadius: BorderRadius.md,
  },
  divider: {
    marginVertical: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  settingRow: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  settingHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  settingDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  visibilitySelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  visibilityChip: {
    marginRight: 0,
  },
  booleanToggle: {
    alignItems: "flex-end",
  },
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.1)",
  },
  actionButton: {
    minWidth: 100,
  },
});
