/**
 * ProfilePicture - Core profile picture display component
 *
 * Displays user's profile picture with fallback to InitialsAvatar.
 * Supports loading states and various sizes.
 *
 * @module components/profile/ProfilePicture/ProfilePicture
 */

import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useTheme } from "react-native-paper";
import { InitialsAvatar } from "./InitialsAvatar";

export interface ProfilePictureProps {
  /** Profile picture URL (null for fallback) */
  url: string | null | undefined;
  /** Thumbnail URL for faster loading (optional) */
  thumbnailUrl?: string | null;
  /** User's name for fallback initials */
  name: string;
  /** Size of the avatar */
  size?: number;
  /** Show loading indicator while image loads */
  showLoading?: boolean;
  /** Use thumbnail URL initially for faster loading */
  useThumbnail?: boolean;
  /** Additional container styles */
  style?: ViewStyle;
  /** Called when image finishes loading */
  onLoad?: () => void;
  /** Called when image fails to load */
  onError?: () => void;
}

export function ProfilePicture({
  url,
  thumbnailUrl,
  name,
  size = 64,
  showLoading = true,
  useThumbnail = false,
  style,
  onLoad,
  onError,
}: ProfilePictureProps) {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Determine which URL to use
  const imageUrl = useThumbnail && thumbnailUrl ? thumbnailUrl : url;

  // Handle image load
  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  // Handle image error
  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  // Show initials if no URL or error
  if (!imageUrl || hasError) {
    return <InitialsAvatar name={name} size={size} style={style} />;
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    >
      <Image
        source={{ uri: imageUrl }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
        onLoad={handleLoad}
        onError={handleError}
        resizeMode="cover"
      />

      {/* Loading overlay */}
      {showLoading && isLoading && (
        <View
          style={[
            styles.loadingOverlay,
            {
              backgroundColor: colors.surface + "80",
              borderRadius: size / 2,
            },
          ]}
        >
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    position: "relative",
  },
  image: {
    backgroundColor: "transparent",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ProfilePicture;
