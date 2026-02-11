/**
 * Moments Screen
 * Displays connections' moments in a horizontal scrollable bar
 * Each moment shows thumbnail with view count
 * Users can tap to view fullscreen or post a new moment
 *
 * Features:
 * - Batch view status checking
 * - In-memory view cache
 * - Image preloading
 * - Moment expiration handling
 */

import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { getFriends } from "@/services/friends";
import {
  filterExpiredStories,
  getBatchViewedStories,
  getFriendsStories,
  getStoryTimeRemaining,
  preloadStoryImages,
} from "@/services/stories";
import { useAuth } from "@/store/AuthContext";
import { Story } from "@/types/models";
import {
  captureImageFromWebcam,
  pickImageFromWeb,
} from "@/utils/webImagePicker";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { FAB, Text, useTheme } from "react-native-paper";
import { BorderRadius, Spacing } from "@/constants/theme";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/stories/StoriesScreen");
// Story item dimensions for FlatList optimization
const STORY_ITEM_WIDTH = 88; // 80px thumbnail + 8px margin

interface StoriesScreenProps {
  navigation: any;
}

export default function StoriesScreen({ navigation }: StoriesScreenProps) {
  const { currentFirebaseUser } = useAuth();
  const theme = useTheme();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewedStories, setViewedStories] = useState<Set<string>>(new Set());
  const [postingStory, setPostingStory] = useState(false);

  // In-memory cache for viewed moments across screen visits
  const viewedCacheRef = useRef<Map<string, boolean>>(new Map());

  // Fetch stories and reset posting state when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (currentFirebaseUser) {
        loadStories();
      }
      // Reset posting state when returning to this screen
      setPostingStory(false);
    }, [currentFirebaseUser]),
  );

  const loadStories = async () => {
    if (!currentFirebaseUser) return;

    try {
      setError(null);

      // Only show loading spinner if cache is empty (first load)
      if (viewedCacheRef.current.size === 0) {
        setLoading(true);
      }

      // Get friends
      const friendsData = await getFriends(currentFirebaseUser.uid);

      // Get friend IDs
      const friendIds = friendsData
        .map((f) => f.users.find((u) => u !== currentFirebaseUser.uid))
        .filter((id): id is string => Boolean(id));

      // Fetch stories
      const fetchedStories = await getFriendsStories(
        currentFirebaseUser.uid,
        friendIds,
      );

      // Filter out expired stories client-side
      const validStories = filterExpiredStories(fetchedStories);

      // Check view cache first, only query uncached stories
      // Also re-query stories that were previously marked as "not viewed" to detect new views
      const uncachedStoryIds = validStories
        .map((s) => s.id)
        .filter((id) => {
          const cachedValue = viewedCacheRef.current.get(id);
          // Query if not in cache OR if it was previously unviewed (might have been viewed now)
          return cachedValue === undefined || cachedValue === false;
        });

      // Batch check viewed status (replaces N individual queries)
      let newViewedSet = new Set<string>();
      if (uncachedStoryIds.length > 0) {
        newViewedSet = await getBatchViewedStories(
          uncachedStoryIds,
          currentFirebaseUser.uid,
        );

        // Update cache with new results
        uncachedStoryIds.forEach((id) => {
          viewedCacheRef.current.set(id, newViewedSet.has(id));
        });
      }

      // Build final viewed set from cache
      const allViewed = new Set<string>();
      validStories.forEach((story) => {
        if (viewedCacheRef.current.get(story.id)) {
          allViewed.add(story.id);
        }
      });

      setViewedStories(allViewed);
      setStories(validStories);

      // Preload images for first few stories
      preloadStoryImages(validStories, 5);
    } catch (err) {
      logger.error("[MomentsScreen] Error loading moments:", err);
      setError("Couldn't load moments");
    } finally {
      setLoading(false);
    }
  };

  const handlePostStory = async () => {
    try {
      const permission = await requestMediaLibraryPermission();
      if (!permission) {
        Alert.alert("Permission Denied", "Please enable gallery access");
        return;
      }

      setPostingStory(true);

      // Show photo menu
      if (Platform.OS === "web") {
        // On web, use browser's native confirm for reliability
        const useCamera = window.confirm(
          "Post Moment\n\nClick OK to take a photo with camera, or Cancel to choose from gallery.",
        );

        if (useCamera) {
          await capturePhoto();
        } else {
          await selectPhoto();
        }
      } else if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ["Cancel", "Take Photo", "Choose from Gallery"],
            cancelButtonIndex: 0,
          },
          async (buttonIndex) => {
            if (buttonIndex === 1) {
              await capturePhoto();
            } else if (buttonIndex === 2) {
              await selectPhoto();
            } else {
              // User cancelled
              setPostingStory(false);
            }
          },
        );
      } else {
        // Android
        Alert.alert("Post Moment", "Choose an option", [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setPostingStory(false),
          },
          {
            text: "Take Photo",
            onPress: async () => {
              try {
                await capturePhoto();
              } catch (err) {
                logger.error("❌ [MomentsScreen] Capture error:", err);
              }
            },
          },
          {
            text: "Choose from Gallery",
            onPress: async () => {
              try {
                await selectPhoto();
              } catch (err) {
                logger.error("❌ [MomentsScreen] Select error:", err);
              }
            },
          },
        ]);
      }
    } catch (error) {
      logger.error("❌ [MomentsScreen] Error:", error);
      Alert.alert("Error", `Failed to post moment: ${String(error)}`);
      setPostingStory(false);
    }
  };

  const capturePhoto = async () => {
    try {
      logger.info("🔵 [capturePhoto] Starting capture");

      if (Platform.OS === "web") {
        logger.info("🔵 [capturePhoto] Using web camera capture");
        const imageUri = await captureImageFromWebcam();
        logger.info(
          "✅ [capturePhoto] Got image URI:",
          imageUri ? "success" : "null",
        );

        if (imageUri) {
          logger.info("🔵 [capturePhoto] Navigating to viewer");
          navigateToStoryViewer(imageUri);
        } else {
          logger.warn("⚠️  [capturePhoto] No image URI to navigate with");
        }
      } else {
        // On native platforms, navigate to built-in CameraScreen
        logger.info("🔵 [capturePhoto] Navigating to Camera screen");
        navigation.navigate("Camera", {
          mode: "full",
        });
      }
    } catch (error) {
      logger.error("❌ [capturePhoto] Camera error:", error);
      Alert.alert("Error", `Failed to capture photo: ${String(error)}`);
    } finally {
      setPostingStory(false);
    }
  };

  const selectPhoto = async () => {
    try {
      logger.info("🔵 [selectPhoto] Starting photo selection");
      let imageUri: string | null = null;

      if (Platform.OS === "web") {
        logger.info("🔵 [selectPhoto] Using web file picker");
        imageUri = await pickImageFromWeb();
        logger.info(
          "✅ [selectPhoto] Got image URI:",
          imageUri ? "success" : "null",
        );
      } else {
        logger.info("🔵 [selectPhoto] Using expo image library");
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: false,
          aspect: [1, 1],
          quality: 1,
        });

        if (!result.canceled && result.assets.length > 0) {
          imageUri = result.assets[0].uri;
          logger.info("✅ [selectPhoto] Got image from expo");
        } else {
          logger.info("ℹ️  [selectPhoto] User cancelled selection");
        }
      }

      if (imageUri) {
        logger.info("🔵 [selectPhoto] Navigating to viewer");
        navigateToStoryViewer(imageUri);
      } else {
        logger.warn("⚠️  [selectPhoto] No image URI to navigate with");
      }
    } catch (error) {
      logger.error("❌ [selectPhoto] Photo selection error:", error);
      Alert.alert("Error", `Failed to select photo: ${String(error)}`);
    } finally {
      setPostingStory(false);
    }
  };

  const navigateToStoryViewer = (imageUri: string) => {
    navigation.navigate("StoryViewer", {
      imageUri,
      isNewStory: true,
    });
  };

  const handleStoryPress = (story: Story) => {
    // Find the index of this story in the list
    const storyIndex = stories.findIndex((s) => s.id === story.id);
    navigation.navigate("StoryViewer", {
      storyId: story.id,
      authorId: story.authorId,
      // Pass all story IDs for navigation between stories
      allStoryIds: stories.map((s) => s.id),
      currentIndex: storyIndex >= 0 ? storyIndex : 0,
    });
  };

  const requestMediaLibraryPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === "granted";
  };

  if (loading) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <LoadingState message="Loading moments..." />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <ErrorState
          title="Something went wrong"
          message={error}
          onRetry={loadStories}
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View
        style={[
          styles.header,
          { borderBottomColor: theme.colors.outlineVariant },
        ]}
      >
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Moments
        </Text>
      </View>

      {stories.length === 0 ? (
        <EmptyState
          icon="camera-burst"
          title="No moments yet"
          subtitle="Connect with others and share moments with them"
          actionLabel="Post Moment"
          onAction={handlePostStory}
        />
      ) : (
        <FlatList
          data={stories}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.storiesScroll}
          contentContainerStyle={styles.scrollContent}
          keyExtractor={(item) => item.id}
          // Performance optimizations
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== "web"}
          getItemLayout={(_, index) => ({
            length: STORY_ITEM_WIDTH,
            offset: STORY_ITEM_WIDTH * (index + 1), // +1 for Add Moment button
            index,
          })}
          ListHeaderComponent={
            // Add Moment Button
            <TouchableOpacity
              style={[
                styles.addStoryCard,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
              onPress={handlePostStory}
              disabled={postingStory}
            >
              <View style={styles.addStoryContent}>
                <Text
                  style={[styles.addStoryIcon, { color: theme.colors.primary }]}
                >
                  +
                </Text>
                <Text
                  style={[
                    styles.addStoryText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  Add Moment
                </Text>
              </View>
            </TouchableOpacity>
          }
          renderItem={({ item: story }) => (
            <TouchableOpacity
              style={[
                styles.storyCard,
                { backgroundColor: theme.colors.surfaceVariant },
                !viewedStories.has(story.id) && [
                  styles.unviewedStoryCard,
                  { borderColor: theme.colors.primary },
                ],
              ]}
              onPress={() => handleStoryPress(story)}
            >
              <View style={styles.storyImageContainer}>
                {/* Placeholder for moment thumbnail - would need to fetch image */}
                <View
                  style={[
                    styles.storyImagePlaceholder,
                    { backgroundColor: theme.colors.surfaceDisabled },
                    !viewedStories.has(story.id) && {
                      backgroundColor: theme.colors.primaryContainer,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.storyInitial,
                      { color: theme.colors.onPrimaryContainer },
                    ]}
                  >
                    {story.authorId.charAt(0).toUpperCase()}
                  </Text>
                </View>

                {/* Viewed indicator */}
                {viewedStories.has(story.id) && (
                  <View
                    style={[
                      styles.viewedBadge,
                      { backgroundColor: theme.colors.tertiary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.viewedText,
                        { color: theme.colors.onTertiary },
                      ]}
                    >
                      ✓
                    </Text>
                  </View>
                )}

                {/* Time remaining badge */}
                <View style={styles.timeRemainingBadge}>
                  <Text style={styles.timeRemainingText}>
                    {getStoryTimeRemaining(story.expiresAt)}
                  </Text>
                </View>
              </View>

              {/* View count */}
              <Text
                style={[
                  styles.storyViewCount,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {story.viewCount} {story.viewCount === 1 ? "view" : "views"}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* FAB for adding moment */}
      <FAB
        icon="camera"
        label="Moment"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={handlePostStory}
        loading={postingStory}
        disabled={postingStory}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  storiesScroll: {
    flex: 1,
    paddingVertical: Spacing.md,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
  },
  addStoryCard: {
    width: 80,
    height: 120,
    marginHorizontal: Spacing.xs,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  addStoryContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  addStoryIcon: {
    fontSize: 32,
    fontWeight: "bold",
  },
  addStoryText: {
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  storyCard: {
    width: 80,
    height: 120,
    marginHorizontal: Spacing.xs,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  unviewedStoryCard: {
    borderWidth: 2,
  },
  storyImageContainer: {
    flex: 1,
    position: "relative",
  },
  storyImagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BorderRadius.md - 2,
  },
  storyInitial: {
    fontSize: 32,
    fontWeight: "bold",
  },
  viewedBadge: {
    position: "absolute",
    top: Spacing.xs,
    right: Spacing.xs,
    borderRadius: BorderRadius.full,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  viewedText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  timeRemainingBadge: {
    position: "absolute",
    bottom: Spacing.xs,
    left: Spacing.xs,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  timeRemainingText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "600",
  },
  storyViewCount: {
    fontSize: 10,
    padding: Spacing.xs,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    bottom: Spacing.md,
    right: Spacing.md,
  },
});
