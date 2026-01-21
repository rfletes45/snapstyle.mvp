/**
 * Stories Screen
 * Displays friends' stories in a horizontal scrollable bar
 * Each story shows thumbnail with view count
 * Users can tap to view fullscreen or post a new story
 *
 * Phase 13: Performance optimizations
 * - Batch view status checking (replaces N+1 queries)
 * - In-memory view cache
 * - Image preloading
 * - Story expiration handling
 */

import React, { useState, useCallback, useRef } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActionSheetIOS,
  Platform,
} from "react-native";
import { Text, FAB } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/store/AuthContext";
import {
  getFriendsStories,
  getBatchViewedStories,
  preloadStoryImages,
  filterExpiredStories,
  getStoryTimeRemaining,
} from "@/services/stories";
import { getFriends } from "@/services/friends";
import { Story } from "@/types/models";
import * as ImagePicker from "expo-image-picker";
import {
  captureImageFromWebcam,
  pickImageFromWeb,
} from "@/utils/webImagePicker";
import { LoadingState, EmptyState } from "@/components/ui";
import { AppColors } from "../../../constants/theme";

// Phase 13: Story item dimensions for FlatList optimization
const STORY_ITEM_WIDTH = 88; // 80px thumbnail + 8px margin

interface StoriesScreenProps {
  navigation: any;
}

export default function StoriesScreen({ navigation }: StoriesScreenProps) {
  const { currentFirebaseUser } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewedStories, setViewedStories] = useState<Set<string>>(new Set());
  const [postingStory, setPostingStory] = useState(false);

  // Phase 13: In-memory cache for viewed stories across screen visits
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
      console.log("🔵 [StoriesScreen] Loading stories (Phase 13 optimized)");
      const startTime = Date.now();
      setLoading(true);

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

      // Phase 13: Filter out expired stories client-side
      const validStories = filterExpiredStories(fetchedStories);

      // Phase 13: Check view cache first, only query uncached stories
      const uncachedStoryIds = validStories
        .map((s) => s.id)
        .filter((id) => !viewedCacheRef.current.has(id));

      // Phase 13: Batch check viewed status (replaces N individual queries)
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

      // Phase 13: Preload images for first few stories
      preloadStoryImages(validStories, 5);

      const duration = Date.now() - startTime;
      console.log(
        "✅ [StoriesScreen] Loaded",
        validStories.length,
        "stories in",
        duration,
        "ms",
      );
    } catch (error) {
      console.error("❌ [StoriesScreen] Error loading stories:", error);
      Alert.alert("Error", "Failed to load stories");
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

      console.log("🔵 [StoriesScreen] Posting story...");
      setPostingStory(true);

      // Show photo menu
      if (Platform.OS === "web") {
        // On web, use browser's native confirm for reliability
        console.log("🔵 [StoriesScreen] Using web-specific menu");

        const useCamera = window.confirm(
          "Post Story\n\nClick OK to take a photo with camera, or Cancel to choose from gallery.",
        );

        console.log(
          "🔵 [StoriesScreen] User choice:",
          useCamera ? "camera" : "gallery",
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
        Alert.alert("Post Story", "Choose an option", [
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
                console.error("❌ [StoriesScreen] Capture error:", err);
              }
            },
          },
          {
            text: "Choose from Gallery",
            onPress: async () => {
              try {
                await selectPhoto();
              } catch (err) {
                console.error("❌ [StoriesScreen] Select error:", err);
              }
            },
          },
        ]);
      }
    } catch (error) {
      console.error("❌ [StoriesScreen] Error:", error);
      Alert.alert("Error", `Failed to post story: ${String(error)}`);
      setPostingStory(false);
    }
  };

  const capturePhoto = async () => {
    try {
      console.log("🔵 [capturePhoto] Starting capture");
      let imageUri: string | null = null;

      if (Platform.OS === "web") {
        console.log("🔵 [capturePhoto] Using web camera capture");
        imageUri = await captureImageFromWebcam();
        console.log(
          "✅ [capturePhoto] Got image URI:",
          imageUri ? "success" : "null",
        );
      } else {
        console.log("🔵 [capturePhoto] Using expo camera");
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          aspect: [1, 1],
          quality: 1,
        });

        if (!result.canceled && result.assets.length > 0) {
          imageUri = result.assets[0].uri;
          console.log("✅ [capturePhoto] Got image from expo");
        } else {
          console.log("ℹ️  [capturePhoto] User cancelled capture");
        }
      }

      if (imageUri) {
        console.log("🔵 [capturePhoto] Navigating to viewer");
        navigateToStoryViewer(imageUri);
      } else {
        console.warn("⚠️  [capturePhoto] No image URI to navigate with");
      }
    } catch (error) {
      console.error("❌ [capturePhoto] Camera error:", error);
      Alert.alert("Error", `Failed to capture photo: ${String(error)}`);
    } finally {
      setPostingStory(false);
    }
  };

  const selectPhoto = async () => {
    try {
      console.log("🔵 [selectPhoto] Starting photo selection");
      let imageUri: string | null = null;

      if (Platform.OS === "web") {
        console.log("🔵 [selectPhoto] Using web file picker");
        imageUri = await pickImageFromWeb();
        console.log(
          "✅ [selectPhoto] Got image URI:",
          imageUri ? "success" : "null",
        );
      } else {
        console.log("🔵 [selectPhoto] Using expo image library");
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          aspect: [1, 1],
          quality: 1,
        });

        if (!result.canceled && result.assets.length > 0) {
          imageUri = result.assets[0].uri;
          console.log("✅ [selectPhoto] Got image from expo");
        } else {
          console.log("ℹ️  [selectPhoto] User cancelled selection");
        }
      }

      if (imageUri) {
        console.log("🔵 [selectPhoto] Navigating to viewer");
        navigateToStoryViewer(imageUri);
      } else {
        console.warn("⚠️  [selectPhoto] No image URI to navigate with");
      }
    } catch (error) {
      console.error("❌ [selectPhoto] Photo selection error:", error);
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
    navigation.navigate("StoryViewer", {
      storyId: story.id,
      authorId: story.authorId,
    });
  };

  const requestMediaLibraryPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === "granted";
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LoadingState message="Loading stories..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Stories</Text>
      </View>

      {stories.length === 0 ? (
        <EmptyState
          icon="camera-burst"
          title="No stories yet"
          subtitle="Add friends and share stories with them"
          actionLabel="Post Story"
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
          // Phase 13: Performance optimizations
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== "web"}
          getItemLayout={(_, index) => ({
            length: STORY_ITEM_WIDTH,
            offset: STORY_ITEM_WIDTH * (index + 1), // +1 for Add Story button
            index,
          })}
          ListHeaderComponent={
            // Add Story Button
            <TouchableOpacity
              style={styles.addStoryCard}
              onPress={handlePostStory}
              disabled={postingStory}
            >
              <View style={styles.addStoryContent}>
                <Text style={styles.addStoryIcon}>+</Text>
                <Text style={styles.addStoryText}>Add Story</Text>
              </View>
            </TouchableOpacity>
          }
          renderItem={({ item: story }) => (
            <TouchableOpacity
              style={[
                styles.storyCard,
                !viewedStories.has(story.id) && styles.unviewedStoryCard,
              ]}
              onPress={() => handleStoryPress(story)}
            >
              <View style={styles.storyImageContainer}>
                {/* Placeholder for story thumbnail - would need to fetch image */}
                <View
                  style={[
                    styles.storyImagePlaceholder,
                    !viewedStories.has(story.id) &&
                      styles.unviewedImagePlaceholder,
                  ]}
                >
                  <Text style={styles.storyInitial}>
                    {story.authorId.charAt(0).toUpperCase()}
                  </Text>
                </View>

                {/* Viewed indicator */}
                {viewedStories.has(story.id) && (
                  <View style={styles.viewedBadge}>
                    <Text style={styles.viewedText}>✓</Text>
                  </View>
                )}

                {/* Phase 13: Time remaining badge */}
                <View style={styles.timeRemainingBadge}>
                  <Text style={styles.timeRemainingText}>
                    {getStoryTimeRemaining(story.expiresAt)}
                  </Text>
                </View>
              </View>

              {/* View count */}
              <Text style={styles.storyViewCount}>
                {story.viewCount} {story.viewCount === 1 ? "view" : "views"}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* FAB for adding story */}
      <FAB
        icon="camera"
        label="Story"
        style={styles.fab}
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
    backgroundColor: "#fff",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  storiesScroll: {
    flex: 1,
    paddingVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 12,
  },
  addStoryCard: {
    width: 80,
    height: 120,
    marginHorizontal: 4,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
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
    color: "#FFFC00",
  },
  addStoryText: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  storyCard: {
    width: 80,
    height: 120,
    marginHorizontal: 4,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    overflow: "hidden",
  },
  unviewedStoryCard: {
    borderWidth: 2,
    borderColor: AppColors.primary,
  },
  storyImageContainer: {
    flex: 1,
    position: "relative",
  },
  storyImagePlaceholder: {
    flex: 1,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  unviewedImagePlaceholder: {
    backgroundColor: AppColors.primary + "30", // 30% opacity
  },
  storyInitial: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
  },
  viewedBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#4CAF50",
    borderRadius: 50,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  viewedText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "bold",
  },
  timeRemainingBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  timeRemainingText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "600",
  },
  storyViewCount: {
    fontSize: 10,
    color: "#666",
    padding: 4,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "#FFFC00",
  },
});
