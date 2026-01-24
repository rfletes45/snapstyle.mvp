/**
 * Story Viewer Screen
 * Fullscreen display of stories
 * Can be used to:
 * 1. View existing stories from friends
 * 2. Preview and post new stories (isNewStory mode)
 *
 * Phase 13: Performance optimizations
 * - Uses preloaded images if available
 * - Shows time remaining progress bar
 * - Handles expired stories gracefully
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Image,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/store/AuthContext";
import { downloadSnapImage, compressImage } from "@/services/storage";
import {
  getStory,
  markStoryViewed,
  deleteStory,
  hasUserViewedStory,
  getStoryViewCount,
  postStory,
  getPreloadedImageUrl,
  getStoryTimeRemaining,
} from "@/services/stories";
import { Story } from "@/types/models";
import { AppColors } from "../../../constants/theme";

interface StoryViewerScreenProps {
  route: any;
  navigation: any;
}

export default function StoryViewerScreen({
  route,
  navigation,
}: StoryViewerScreenProps) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { imageUri, storyId, isNewStory, allStoryIds, currentIndex } =
    route.params;

  // Current story index for multi-story navigation
  const [storyIndex, setStoryIndex] = useState(currentIndex || 0);
  const [currentStoryId, setCurrentStoryId] = useState(storyId);

  // Phase 13: Try to use preloaded image first
  const preloadedImage = currentStoryId
    ? getPreloadedImageUrl(currentStoryId)
    : null;

  const [displayImage, setDisplayImage] = useState<string | null>(
    isNewStory ? imageUri : preloadedImage,
  );
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(!isNewStory);
  const [error, setError] = useState<string | null>(null);
  const [viewCount, setViewCount] = useState(0);
  const [posting, setPosting] = useState(false);

  // Load existing story
  useEffect(() => {
    if (!isNewStory && currentStoryId) {
      loadStory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStoryId, isNewStory]);

  // Mark as viewed when loaded (for existing stories)
  useEffect(() => {
    if (story && currentFirebaseUser && !isNewStory) {
      markAsViewed();
      loadViewCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, currentFirebaseUser]);

  // Phase 13: Update time remaining every minute
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    if (!story || isNewStory) return;

    const updateTimeRemaining = () => {
      setTimeRemaining(getStoryTimeRemaining(story.expiresAt));
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [story, isNewStory]);

  // Phase 13: Calculate expiration progress (0 to 1)
  const getExpirationProgress = (): number => {
    if (!story) return 1;
    const totalDuration = 24 * 60 * 60 * 1000; // 24 hours
    const elapsed = Date.now() - story.createdAt;
    const progress = Math.max(0, Math.min(1, 1 - elapsed / totalDuration));

    // Debug log
    console.log("🔵 [StoryViewer] Progress calculation:", {
      elapsed: Math.floor(elapsed / 1000 / 60),
      totalMinutes: Math.floor(totalDuration / 1000 / 60),
      progress: progress.toFixed(2),
      timeRemaining,
    });

    return progress;
  };

  const loadStory = async () => {
    if (!currentStoryId) return;

    try {
      console.log("🔵 [StoryViewerScreen] Loading story:", currentStoryId);

      // Phase 13: If we have preloaded image, skip loading state
      const currentPreloadedImage = getPreloadedImageUrl(currentStoryId);
      if (currentPreloadedImage) {
        console.log("✅ [StoryViewerScreen] Using preloaded image");
        setDisplayImage(currentPreloadedImage);
        setLoading(false);
      } else {
        setLoading(true);
      }

      setError(null);

      const fetchedStory = await getStory(currentStoryId);
      if (!fetchedStory) {
        setError("Story not found or has expired");
        setLoading(false);
        return;
      }

      // Phase 13: Check if story expired while loading
      if (fetchedStory.expiresAt < Date.now()) {
        setError("This story has expired");
        setLoading(false);
        return;
      }

      setStory(fetchedStory);

      // Phase 13: Only download if not already preloaded
      if (!currentPreloadedImage) {
        const uri = await downloadSnapImage(fetchedStory.storagePath);
        setDisplayImage(uri);
      }

      console.log("✅ [StoryViewerScreen] Story loaded successfully");
    } catch (err: any) {
      console.error("❌ [StoryViewerScreen] Failed to load story:", err);
      setError(err.message || "Failed to load story");
    } finally {
      setLoading(false);
    }
  };

  // Navigate to next story
  const goToNextStory = () => {
    if (!allStoryIds || storyIndex >= allStoryIds.length - 1) {
      // No more stories, go back
      navigation.goBack();
      return;
    }
    const nextIndex = storyIndex + 1;
    setStoryIndex(nextIndex);
    setCurrentStoryId(allStoryIds[nextIndex]);
    setStory(null);
    setDisplayImage(null);
  };

  // Navigate to previous story
  const goToPrevStory = () => {
    if (!allStoryIds || storyIndex <= 0) {
      // Already at first story
      return;
    }
    const prevIndex = storyIndex - 1;
    setStoryIndex(prevIndex);
    setCurrentStoryId(allStoryIds[prevIndex]);
    setStory(null);
    setDisplayImage(null);
  };

  // Handle tap on story (left side = prev, right side = next)
  const handleStoryTap = (event: any) => {
    if (isNewStory) {
      return; // Don't navigate when posting new story
    }

    const { locationX } = event.nativeEvent;
    const screenWidth = event.nativeEvent.target?.clientWidth || 300; // Fallback width
    const tapPosition = locationX / screenWidth;

    if (tapPosition < 0.3) {
      // Left 30% of screen - go to previous
      goToPrevStory();
    } else if (tapPosition > 0.7) {
      // Right 30% of screen - go to next
      goToNextStory();
    }
    // Middle 40% does nothing (allows interaction with controls)
  };

  const markAsViewed = async () => {
    if (!story || !currentFirebaseUser) return;

    try {
      console.log("🔵 [StoryViewerScreen] Marking story as viewed");
      const alreadyViewed = await hasUserViewedStory(
        story.id,
        currentFirebaseUser.uid,
      );

      if (!alreadyViewed) {
        await markStoryViewed(story.id, currentFirebaseUser.uid);
        console.log("✅ [StoryViewerScreen] Story marked as viewed");
      }
    } catch (err: any) {
      console.error("❌ [StoryViewerScreen] Error marking viewed:", err);
    }
  };

  const loadViewCount = async () => {
    if (!story) return;

    try {
      const count = await getStoryViewCount(story.id);
      setViewCount(count);
    } catch (err) {
      console.error("❌ [StoryViewerScreen] Error loading view count:", err);
    }
  };

  const handlePostStory = async () => {
    if (!currentFirebaseUser || !displayImage) {
      Alert.alert("Error", "Missing required data");
      return;
    }

    try {
      console.log("🔵 [StoryViewerScreen] Posting new story");
      setPosting(true);

      // Compress image
      const compressedUri = await compressImage(displayImage);
      console.log("✅ [StoryViewerScreen] Image compressed");

      // Post story using service (handles upload + Firestore doc creation)
      const storyId = await postStory(currentFirebaseUser.uid, compressedUri);
      console.log("✅ [StoryViewerScreen] Story posted with ID:", storyId);

      Alert.alert("Success", "Story posted successfully!");
      navigation.goBack();
    } catch (error: any) {
      console.error("❌ [StoryViewerScreen] Error posting story:", error);
      Alert.alert("Error", `Failed to post story: ${String(error)}`);
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteStory = async () => {
    if (!story || !currentFirebaseUser) {
      console.error(
        "❌ [StoryViewerScreen] Cannot delete: story or user is null",
      );
      return;
    }

    console.log(
      "🔵 [StoryViewerScreen] Delete button pressed for story:",
      story.id,
    );

    // Use window.confirm on web, Alert.alert on native
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Are you sure you want to delete this story?",
      );
      if (!confirmed) {
        return;
      }

      try {
        console.log("🔵 [StoryViewerScreen] Deleting story:", story.id);
        await deleteStory(story.id, story.storagePath);
        console.log("✅ [StoryViewerScreen] Story deleted");
        window.alert("Story deleted");
        navigation.goBack();
      } catch (err: any) {
        console.error("❌ [StoryViewerScreen] Error deleting story:", err);
        window.alert(`Failed to delete story: ${String(err)}`);
      }
    } else {
      // Native platform: use Alert.alert
      Alert.alert(
        "Delete Story",
        "Are you sure you want to delete this story?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                console.log("🔵 [StoryViewerScreen] Deleting story:", story.id);
                await deleteStory(story.id, story.storagePath);
                console.log("✅ [StoryViewerScreen] Story deleted");
                Alert.alert("Success", "Story deleted");
                navigation.goBack();
              } catch (err: any) {
                console.error(
                  "❌ [StoryViewerScreen] Error deleting story:",
                  err,
                );
                Alert.alert("Error", `Failed to delete story: ${String(err)}`);
              }
            },
          },
        ],
      );
    }
  };

  const isAuthor = story && currentFirebaseUser?.uid === story.authorId;

  // Debug logging for delete button visibility
  React.useEffect(() => {
    console.log("🔵 [StoryViewerScreen] Delete button state:", {
      isNewStory,
      hasStory: !!story,
      currentUserUid: currentFirebaseUser?.uid,
      authorId: story?.authorId,
      isAuthor,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, currentFirebaseUser, isNewStory]);

  if (error && !isNewStory) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          justifyContent: "center",
          alignItems: "center",
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16, textAlign: "center" }}>
          {error}
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginTop: 16 }}
        >
          <Text style={{ color: theme.colors.primary, fontSize: 14 }}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          justifyContent: "center",
          alignItems: "center",
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Pressable
      style={{
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
      onPress={handleStoryTap}
    >
      {displayImage && (
        <Image
          source={{ uri: displayImage }}
          style={{
            width: "100%",
            height: "100%",
            resizeMode: "contain",
          }}
        />
      )}

      {/* Phase 13: Time Remaining Progress Bar */}
      {!isNewStory && story && (
        <View style={styles.progressContainer}>
          {/* Custom progress bar using nested Views for better control */}
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${getExpirationProgress() * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.timeRemainingLabel}>
            {timeRemaining || "..."} left
          </Text>
        </View>
      )}

      {/* Header Overlay */}
      <View style={styles.header}>
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>

        {/* View Count or Post Button */}
        {isNewStory ? (
          <TouchableOpacity
            onPress={handlePostStory}
            disabled={posting}
            style={styles.postButton}
          >
            <Text style={styles.postButtonText}>
              {posting ? "Posting..." : "Post"}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.viewInfo}>
            <Text style={styles.viewCount}>
              {viewCount} {viewCount === 1 ? "view" : "views"}
            </Text>
          </View>
        )}
      </View>

      {/* Footer Actions */}
      {!isNewStory && isAuthor && (
        <View style={styles.footer}>
          {Platform.OS === "web" ? (
            <Pressable onPress={handleDeleteStory} style={styles.deleteButton}>
              <Text style={styles.deleteButtonText}>Delete Story</Text>
            </Pressable>
          ) : (
            <TouchableOpacity
              onPress={handleDeleteStory}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteButtonText}>Delete Story</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Phase 13: Progress bar for time remaining
  progressContainer: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    zIndex: 11,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  progressBarBackground: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: AppColors.primary,
    borderRadius: 3,
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  timeRemainingLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    minWidth: 65,
    textAlign: "right",
  },
  header: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 10,
  },
  headerButton: {
    padding: 8,
  },
  backButton: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  postButton: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "bold",
  },
  viewInfo: {
    padding: 8,
  },
  viewCount: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  deleteButton: {
    backgroundColor: "#ff4444",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
