/**
 * MediaViewerModal Component
 * Phase H10: Multi-Attachment Support
 *
 * Fullscreen gallery viewer for message attachments.
 * Features:
 * - Swipe between attachments
 * - Pinch-to-zoom on images
 * - Double-tap to zoom
 * - Download button
 * - Index indicator
 * - Close button
 *
 * Note: Video support requires expo-av to be installed.
 * Currently images-only for H10 scope.
 *
 * @module components/chat/MediaViewerModal
 */

import { AttachmentV2 } from "@/types/messaging";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// =============================================================================
// Types
// =============================================================================

export interface MediaViewerModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** List of attachments to display */
  attachments: AttachmentV2[];
  /** Initial index to show */
  initialIndex?: number;
  /** Called when modal should close */
  onClose: () => void;
  /** Sender name for header */
  senderName?: string;
  /** Message timestamp */
  timestamp?: Date;
}

// =============================================================================
// Constants
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MIN_SCALE = 1;
const MAX_SCALE = 4;

// =============================================================================
// Sub-Components
// =============================================================================

interface ZoomableImageProps {
  uri: string;
  isActive: boolean;
}

const ZoomableImage = memo(function ZoomableImage({
  uri,
  isActive,
}: ZoomableImageProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Reset zoom when switching images
  React.useEffect(() => {
    if (!isActive) {
      scale.value = withTiming(1);
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  }, [isActive]);

  // Pinch gesture for zooming
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, savedScale.value * e.scale),
      );
      scale.value = newScale;
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) {
        scale.value = withSpring(MIN_SCALE);
        savedScale.value = MIN_SCALE;
      } else {
        savedScale.value = scale.value;
      }
      // Reset position if zoomed out
      if (scale.value <= 1) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  // Pan gesture for moving zoomed image
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Double tap to zoom
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.value > 1) {
        // Zoom out
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom in to 2x at tap location
        scale.value = withSpring(2);
        savedScale.value = 2;
      }
    });

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Race(doubleTapGesture, panGesture),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.mediaContainer, animatedStyle]}>
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
      </Animated.View>
    </GestureDetector>
  );
});

interface MediaItemProps {
  attachment: AttachmentV2;
  isActive: boolean;
}

const MediaItem = memo(function MediaItem({
  attachment,
  isActive,
}: MediaItemProps) {
  // Note: Video support requires expo-av to be installed.
  // For now, show a placeholder for videos.
  if (attachment.kind === "video") {
    return (
      <View style={styles.mediaContainer}>
        <View style={styles.videoPlaceholder}>
          <MaterialCommunityIcons name="video" size={64} color="#666" />
          <Text style={styles.videoPlaceholderText}>Video playback</Text>
          <Text style={styles.videoPlaceholderSubtext}>
            Install expo-av for video support
          </Text>
        </View>
      </View>
    );
  }

  return <ZoomableImage uri={attachment.url} isActive={isActive} />;
});

// =============================================================================
// Main Component
// =============================================================================

export const MediaViewerModal = memo(function MediaViewerModal({
  visible,
  attachments,
  initialIndex = 0,
  onClose,
  senderName,
  timestamp,
}: MediaViewerModalProps) {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [downloading, setDownloading] = useState(false);

  // Handle download/save image
  const handleDownload = useCallback(async () => {
    const attachment = attachments[currentIndex];
    if (!attachment?.url) return;

    try {
      setDownloading(true);

      if (Platform.OS === "web") {
        // Web: Open in new tab to allow save
        window.open(attachment.url, "_blank");
      } else {
        // Native: Open URL in browser to allow save
        const canOpen = await Linking.canOpenURL(attachment.url);
        if (canOpen) {
          await Linking.openURL(attachment.url);
        } else {
          Alert.alert("Error", "Cannot open image URL");
        }
      }
    } catch (error: any) {
      console.error("Download failed:", error);
      Alert.alert("Error", "Failed to open image");
    } finally {
      setDownloading(false);
    }
  }, [attachments, currentIndex]);

  // Reset to initial index when modal opens
  React.useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      // Scroll to initial index after a short delay
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: initialIndex,
          animated: false,
        });
      }, 100);
    }
  }, [visible, initialIndex]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.x;
      const index = Math.round(offset / SCREEN_WIDTH);
      if (index !== currentIndex && index >= 0 && index < attachments.length) {
        setCurrentIndex(index);
      }
    },
    [currentIndex, attachments.length],
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    [],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: AttachmentV2; index: number }) => (
      <MediaItem attachment={item} isActive={index === currentIndex} />
    ),
    [currentIndex],
  );

  const keyExtractor = useCallback((item: AttachmentV2) => item.id, []);

  if (!visible || attachments.length === 0) {
    return null;
  }

  const currentAttachment = attachments[currentIndex];
  const formattedTime = timestamp
    ? timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar backgroundColor="transparent" barStyle="light-content" />
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialCommunityIcons name="close" size={28} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            {senderName && <Text style={styles.senderName}>{senderName}</Text>}
            {formattedTime && (
              <Text style={styles.timestamp}>{formattedTime}</Text>
            )}
          </View>

          {/* Download button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleDownload}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <MaterialCommunityIcons name="download" size={26} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>

        {/* Media Gallery - wrap in GestureHandlerRootView for zoom gestures */}
        <GestureHandlerRootView style={styles.gallery}>
          <FlatList
            ref={flatListRef}
            data={attachments}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            getItemLayout={getItemLayout}
            initialScrollIndex={initialIndex}
          />
        </GestureHandlerRootView>

        {/* Footer with index and info */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          {/* Page indicator */}
          {attachments.length > 1 && (
            <View style={styles.pageIndicatorContainer}>
              <Text style={styles.pageIndicator}>
                {currentIndex + 1} / {attachments.length}
              </Text>
            </View>
          )}

          {/* Attachment info */}
          {currentAttachment && (
            <View style={styles.attachmentInfo}>
              {currentAttachment.caption && (
                <Text style={styles.caption} numberOfLines={3}>
                  {currentAttachment.caption}
                </Text>
              )}
              {currentAttachment.sizeBytes && (
                <Text style={styles.fileSize}>
                  {formatFileSize(currentAttachment.sizeBytes)}
                </Text>
              )}
            </View>
          )}

          {/* Dot indicators */}
          {attachments.length > 1 && attachments.length <= 10 && (
            <View style={styles.dotsContainer}>
              {attachments.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === currentIndex && styles.dotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
});

// =============================================================================
// Helpers
// =============================================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  headerInfo: {
    flex: 1,
    alignItems: "center",
  },
  senderName: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  timestamp: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 2,
  },
  gallery: {
    flex: 1,
  },
  mediaContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 200, // Leave room for header/footer
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: SCREEN_WIDTH,
    height: "100%",
  },
  video: {
    width: SCREEN_WIDTH,
    height: "100%",
  },
  videoPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    padding: 32,
    borderRadius: 16,
  },
  videoPlaceholderText: {
    color: "#888",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  videoPlaceholderSubtext: {
    color: "#666",
    fontSize: 12,
    marginTop: 4,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  pageIndicatorContainer: {
    alignItems: "center",
    marginBottom: 8,
  },
  pageIndicator: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "500",
  },
  attachmentInfo: {
    alignItems: "center",
    marginBottom: 12,
  },
  caption: {
    color: "#FFF",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 4,
  },
  fileSize: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  dotActive: {
    backgroundColor: "#FFF",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default MediaViewerModal;
