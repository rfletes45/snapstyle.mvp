/**
 * Stories Screen
 * Displays friends' stories in a horizontal scrollable bar
 * Each story shows thumbnail with view count
 * Users can tap to view fullscreen or post a new story
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  FlatList,
  ActionSheetIOS,
} from "react-native";
import { Text, FAB, Avatar } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "@/store/AuthContext";
import { getFriendsStories, hasUserViewedStory } from "@/services/stories";
import { getFriends } from "@/services/friends";
import { Story, Friend } from "@/types/models";
import * as ImagePicker from "expo-image-picker";
import {
  captureImageFromWebcam,
  pickImageFromWeb,
} from "@/utils/webImagePicker";
import { Platform } from "react-native";

interface StoriesScreenProps {
  navigation: any;
}

export default function StoriesScreen({ navigation }: StoriesScreenProps) {
  const { currentFirebaseUser } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewedStories, setViewedStories] = useState<Set<string>>(new Set());
  const [postingStory, setPostingStory] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);

  // Fetch stories when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (currentFirebaseUser) {
        loadStories();
      }
    }, [currentFirebaseUser]),
  );

  const loadStories = async () => {
    if (!currentFirebaseUser) return;

    try {
      console.log("🔵 [StoriesScreen] Loading stories");
      setLoading(true);

      // Get friends
      const friendsData = await getFriends(currentFirebaseUser.uid);
      setFriends(friendsData);

      // Get friend IDs
      const friendIds = friendsData
        .map((f) => f.users.find((u) => u !== currentFirebaseUser.uid))
        .filter((id): id is string => Boolean(id));

      // Fetch stories
      const fetchedStories = await getFriendsStories(
        currentFirebaseUser.uid,
        friendIds,
      );

      // Check which stories user has viewed
      const viewed = new Set<string>();
      for (const story of fetchedStories) {
        const hasViewed = await hasUserViewedStory(
          story.id,
          currentFirebaseUser.uid,
        );
        if (hasViewed) {
          viewed.add(story.id);
        }
      }

      setViewedStories(viewed);
      setStories(fetchedStories);
      console.log(
        "✅ [StoriesScreen] Loaded",
        fetchedStories.length,
        "stories",
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
        <ActivityIndicator size="large" color="#FFFC00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Stories</Text>
      </View>

      {stories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No stories yet</Text>
          <Text style={styles.emptySubtext}>
            Add friends and share stories with them
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.storiesScroll}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Add Story Button */}
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

          {/* Story Cards */}
          {stories.map((story) => (
            <TouchableOpacity
              key={story.id}
              style={styles.storyCard}
              onPress={() => handleStoryPress(story)}
            >
              <View style={styles.storyImageContainer}>
                {/* Placeholder for story thumbnail - would need to fetch image */}
                <View style={styles.storyImagePlaceholder}>
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
              </View>

              {/* View count */}
              <Text style={styles.storyViewCount}>
                {story.viewCount} {story.viewCount === 1 ? "view" : "views"}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
    width: 100,
    marginHorizontal: 8,
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
    width: 100,
    marginHorizontal: 8,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    overflow: "hidden",
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
    borderRadius: 12,
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
  storyViewCount: {
    fontSize: 11,
    color: "#666",
    padding: 6,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "#FFFC00",
  },
});
