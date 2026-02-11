/**
 * LinkPreviewCard Component
 *
 * Displays Open Graph metadata for URLs in chat messages.
 *
 * Features:
 * - Title, description, site name display
 * - Preview image with loading state
 * - Tap to open URL in browser
 * - Compact design for chat bubbles
 * - Error/fallback state
 *
 * @module components/chat/LinkPreviewCard
 */

import {
  getDomainFromUrl,
  isDisplayablePreview,
  truncatePreviewText,
} from "@/services/linkPreview";
import { LinkPreviewV2 } from "@/types/messaging";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "react-native-paper";


import { createLogger } from "@/utils/log";
const logger = createLogger("components/chat/LinkPreviewCard");
// =============================================================================
// Types
// =============================================================================

export interface LinkPreviewCardProps {
  /** Link preview data */
  preview: LinkPreviewV2;
  /** Whether this is the sender's message */
  isOwn?: boolean;
  /** Whether the preview is loading */
  loading?: boolean;
  /** Callback when card is pressed */
  onPress?: () => void;
  /** Maximum width of the card */
  maxWidth?: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_WIDTH = 280;
const IMAGE_HEIGHT = 140;

// =============================================================================
// Component
// =============================================================================

export const LinkPreviewCard = memo(function LinkPreviewCard({
  preview,
  isOwn = false,
  loading = false,
  onPress,
  maxWidth = DEFAULT_MAX_WIDTH,
}: LinkPreviewCardProps) {
  const theme = useTheme();
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const domain = getDomainFromUrl(preview.url);
  const hasImage = preview.imageUrl && !imageError;
  const hasDisplayableContent = isDisplayablePreview(preview);

  // Open URL in browser
  const handlePress = useCallback(async () => {
    if (onPress) {
      onPress();
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(preview.url);
      if (canOpen) {
        await Linking.openURL(preview.url);
      }
    } catch (error) {
      logger.error("[LinkPreviewCard] Failed to open URL:", error);
    }
  }, [preview.url, onPress]);

  // Loading state
  if (loading) {
    return (
      <View
        style={[
          styles.container,
          styles.loadingContainer,
          { maxWidth, borderColor: isOwn ? "rgba(0,0,0,0.1)" : "#333" },
        ]}
      >
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: isOwn ? "#000" : "#888" }]}>
          Loading preview...
        </Text>
      </View>
    );
  }

  // Minimal fallback if no displayable content
  if (!hasDisplayableContent) {
    return (
      <TouchableOpacity
        style={[
          styles.container,
          styles.minimalContainer,
          { maxWidth, borderColor: isOwn ? "rgba(0,0,0,0.1)" : "#333" },
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="link-variant"
          size={16}
          color={isOwn ? "rgba(0,0,0,0.6)" : "#888"}
        />
        <Text
          style={[
            styles.minimalDomain,
            { color: isOwn ? "rgba(0,0,0,0.6)" : "#888" },
          ]}
          numberOfLines={1}
        >
          {domain}
        </Text>
        <MaterialCommunityIcons
          name="open-in-new"
          size={14}
          color={isOwn ? "rgba(0,0,0,0.4)" : "#666"}
        />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          maxWidth,
          backgroundColor: isOwn ? "rgba(0,0,0,0.08)" : "#1A1A1A",
          borderColor: isOwn ? "rgba(0,0,0,0.1)" : "#333",
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Preview Image */}
      {hasImage && (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: preview.imageUrl }}
            style={styles.image}
            resizeMode="cover"
            onLoadStart={() => setImageLoading(true)}
            onLoadEnd={() => setImageLoading(false)}
            onError={() => {
              setImageError(true);
              setImageLoading(false);
            }}
          />
          {imageLoading && (
            <View style={styles.imagePlaceholder}>
              <ActivityIndicator size="small" color="#666" />
            </View>
          )}
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {/* Site Name */}
        <View style={styles.siteRow}>
          <MaterialCommunityIcons
            name="web"
            size={12}
            color={isOwn ? "rgba(0,0,0,0.5)" : "#666"}
          />
          <Text
            style={[
              styles.siteName,
              { color: isOwn ? "rgba(0,0,0,0.5)" : "#666" },
            ]}
            numberOfLines={1}
          >
            {preview.siteName || domain}
          </Text>
        </View>

        {/* Title */}
        {preview.title && (
          <Text
            style={[styles.title, { color: isOwn ? "#000" : "#FFF" }]}
            numberOfLines={2}
          >
            {preview.title}
          </Text>
        )}

        {/* Description */}
        {preview.description && (
          <Text
            style={[
              styles.description,
              { color: isOwn ? "rgba(0,0,0,0.7)" : "#AAA" },
            ]}
            numberOfLines={3}
          >
            {truncatePreviewText(preview.description, 120)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 8,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
  },
  minimalContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 6,
  },
  minimalDomain: {
    flex: 1,
    fontSize: 13,
  },
  imageContainer: {
    height: IMAGE_HEIGHT,
    width: "100%",
    backgroundColor: "#222",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#222",
  },
  content: {
    padding: 12,
    gap: 4,
  },
  siteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  siteName: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 2,
  },
  description: {
    fontSize: 13,
    lineHeight: 17,
    marginTop: 2,
  },
});

export default LinkPreviewCard;
