/**
 * ProfilePicture - Core profile picture display component
 *
 * Displays user's profile picture with fallback to InitialsAvatar.
 * Supports loading states and various sizes.
 *
 * @module components/profile/ProfilePicture/ProfilePicture
 */

import { AppImage } from "@/components/AppImage";
import { useColors } from "@/store/ThemeContext";
import { buildRemoteImageSource, normalizeRemoteImageUrl } from "@/utils/remoteImageSource";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View, ViewStyle } from "react-native";
import { InitialsAvatar } from "./InitialsAvatar";

/**
 * Delay (ms) before showing the loading spinner. Images that load from
 * the expo-image memory / disk cache resolve in <16 ms, so a short
 * grace period prevents the spinner from flashing for cached images.
 */
const LOADING_GRACE_MS = 150;

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
  const colors = useColors();
  const [hasLoaded, setHasLoaded] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const [hasError, setHasError] = useState(false);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine which URL to use
  const imageUrl = normalizeRemoteImageUrl(
    useThumbnail && thumbnailUrl ? thumbnailUrl : url,
  );
  const imageSource = buildRemoteImageSource(imageUrl);

  useEffect(() => {
    setHasLoaded(false);
    setShowSpinner(false);
    setHasError(false);
  }, [imageUrl]);

  // Start the grace timer on mount. If the image loads within LOADING_GRACE_MS
  // the spinner never appears. Otherwise we show it until onLoad fires.
  useEffect(() => {
    if (!imageUrl) return;
    if (hasLoaded) return;
    graceTimerRef.current = setTimeout(() => {
      setShowSpinner(true);
    }, LOADING_GRACE_MS);
    return () => {
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
    };
  }, [hasLoaded, imageUrl]);

  // Handle image load
  const handleLoad = () => {
    setHasLoaded(true);
    setShowSpinner(false);
    if (graceTimerRef.current) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
    onLoad?.();
  };

  // Handle image error
  const handleError = () => {
    setHasLoaded(true);
    setShowSpinner(false);
    if (graceTimerRef.current) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
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
      <AppImage
        source={imageSource}
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
        contentFit="cover"
        transition={0}
        debugLabel="ProfilePicture"
        priority="high"
      />

      {/* Loading overlay – only shown after grace period for non-cached images */}
      {showLoading && showSpinner && !hasLoaded && (
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
