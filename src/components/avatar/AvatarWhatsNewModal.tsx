/**
 * What's New Modal for Avatar System
 *
 * Shows users what's new in the digital avatar system
 * after updates or first-time feature access.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 8
 */

import { LightColors } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

// Use a simple theme reference for styles
const theme = {
  colors: {
    primary: LightColors.primary,
    background: LightColors.background,
    surface: LightColors.surface,
    text: LightColors.text,
  },
};

// =============================================================================
// TYPES
// =============================================================================

interface WhatsNewFeature {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor?: string;
}

interface WhatsNewRelease {
  version: string;
  date: string;
  title: string;
  subtitle?: string;
  features: WhatsNewFeature[];
}

interface AvatarWhatsNewModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Force show even if already seen */
  forceShow?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const WHATS_NEW_STORAGE_KEY = "@snapstyle/avatar_whats_new_seen";
const CURRENT_VERSION = "2.0.0";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * Release notes for the avatar system
 */
const AVATAR_RELEASES: WhatsNewRelease[] = [
  {
    version: "2.0.0",
    date: "February 2026",
    title: "Digital Avatar System",
    subtitle: "Create your unique digital identity",
    features: [
      {
        id: "customization",
        title: "Full Customization",
        description:
          "Customize every detail - face shape, eyes, nose, mouth, hair, and more!",
        icon: "tune-vertical",
        iconColor: "#8B5CF6",
      },
      {
        id: "skin_tones",
        title: "Diverse Skin Tones",
        description:
          "Choose from 12 beautiful skin tones to represent yourself.",
        icon: "palette",
        iconColor: "#EC4899",
      },
      {
        id: "hairstyles",
        title: "50+ Hairstyles",
        description:
          "Express yourself with a huge variety of hairstyles and colors.",
        icon: "content-cut",
        iconColor: "#F59E0B",
      },
      {
        id: "clothing",
        title: "Wardrobe Options",
        description:
          "Dress your avatar with tops, bottoms, and complete outfits.",
        icon: "tshirt-crew",
        iconColor: "#10B981",
      },
      {
        id: "accessories",
        title: "Accessories",
        description:
          "Add hats, glasses, earrings, necklaces, and more accessories.",
        icon: "sunglasses",
        iconColor: "#3B82F6",
      },
      {
        id: "presets",
        title: "Quick Start Presets",
        description:
          "Choose a preset to start, then customize to make it yours.",
        icon: "lightning-bolt",
        iconColor: "#F97316",
      },
    ],
  },
];

// =============================================================================
// STORAGE HELPERS
// =============================================================================

async function hasSeenWhatsNew(version: string): Promise<boolean> {
  try {
    const data = await AsyncStorage.getItem(WHATS_NEW_STORAGE_KEY);
    if (!data) return false;
    const seenVersions = JSON.parse(data) as string[];
    return seenVersions.includes(version);
  } catch {
    return false;
  }
}

async function markWhatsNewSeen(version: string): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(WHATS_NEW_STORAGE_KEY);
    const seenVersions = data ? (JSON.parse(data) as string[]) : [];
    if (!seenVersions.includes(version)) {
      seenVersions.push(version);
      await AsyncStorage.setItem(
        WHATS_NEW_STORAGE_KEY,
        JSON.stringify(seenVersions),
      );
    }
  } catch (error) {
    console.warn("Failed to mark what's new as seen:", error);
  }
}

// =============================================================================
// FEATURE CARD COMPONENT
// =============================================================================

function FeatureCard({ feature }: { feature: WhatsNewFeature }) {
  return (
    <Animated.View entering={FadeIn.delay(100)} style={styles.featureCard}>
      <View
        style={[
          styles.featureIcon,
          {
            backgroundColor: (feature.iconColor || theme.colors.primary) + "20",
          },
        ]}
      >
        <MaterialCommunityIcons
          name={feature.icon}
          size={24}
          color={feature.iconColor || theme.colors.primary}
        />
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{feature.title}</Text>
        <Text style={styles.featureDescription}>{feature.description}</Text>
      </View>
    </Animated.View>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AvatarWhatsNewModal({
  visible,
  onClose,
  forceShow = false,
}: AvatarWhatsNewModalProps): React.ReactElement | null {
  const [currentPage, setCurrentPage] = useState(0);
  const release = AVATAR_RELEASES[0]; // Latest release

  useEffect(() => {
    if (visible) {
      markWhatsNewSeen(CURRENT_VERSION);
    }
  }, [visible]);

  const handleClose = () => {
    setCurrentPage(0);
    onClose();
  };

  const handleGetStarted = () => {
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={theme.colors.text}
            />
          </Pressable>
        </View>

        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons
              name="account-star"
              size={80}
              color={theme.colors.primary}
            />
          </View>
          <Text style={styles.heroTitle}>{release.title}</Text>
          {release.subtitle && (
            <Text style={styles.heroSubtitle}>{release.subtitle}</Text>
          )}
          <Text style={styles.version}>Version {release.version}</Text>
        </View>

        {/* Features List */}
        <FlatList
          data={release.features}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FeatureCard feature={item} />}
          contentContainerStyle={styles.featuresList}
          showsVerticalScrollIndicator={false}
        />

        {/* Get Started Button */}
        <View style={styles.footer}>
          <Pressable style={styles.getStartedButton} onPress={handleGetStarted}>
            <Text style={styles.getStartedText}>Get Started</Text>
            <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// HOOK FOR MANAGING WHAT'S NEW
// =============================================================================

export interface UseWhatsNewReturn {
  /** Whether there's new content to show */
  hasNewContent: boolean;
  /** Show the what's new modal */
  show: () => void;
  /** Hide the what's new modal */
  hide: () => void;
  /** Whether modal is currently visible */
  isVisible: boolean;
  /** Mark content as seen without showing */
  markSeen: () => Promise<void>;
}

export function useAvatarWhatsNew(): UseWhatsNewReturn {
  const [hasNewContent, setHasNewContent] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    hasSeenWhatsNew(CURRENT_VERSION).then((seen) => {
      setHasNewContent(!seen);
    });
  }, []);

  return {
    hasNewContent,
    show: () => setIsVisible(true),
    hide: () => setIsVisible(false),
    isVisible,
    markSeen: () => markWhatsNewSeen(CURRENT_VERSION),
  };
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
  },
  hero: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  heroIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: theme.colors.text + "99",
    textAlign: "center",
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: "600",
  },
  featuresList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: theme.colors.text + "99",
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    paddingBottom: 34,
  },
  getStartedButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  getStartedText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});

export default AvatarWhatsNewModal;
