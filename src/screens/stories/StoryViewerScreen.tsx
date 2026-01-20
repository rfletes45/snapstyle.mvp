/**
 * Story Viewer Screen
 * Fullscreen display of stories
 * Can be used to:
 * 1. View existing stories from friends
 * 2. Preview and post new stories (isNewStory mode)
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
import { Text } from "react-native-paper";
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
} from "@/services/stories";
import { Story } from "@/types/models";

interface StoryViewerScreenProps {
  route: any;
  navigation: any;
}

export default function StoryViewerScreen({
  route,
  navigation,
}: StoryViewerScreenProps) {
  const { currentFirebaseUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { imageUri, storyId, isNewStory } = route.params;

  const [displayImage, setDisplayImage] = useState<string | null>(
    isNewStory ? imageUri : null,
  );
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(!isNewStory);
  const [error, setError] = useState<string | null>(null);
  const [viewCount, setViewCount] = useState(0);
  const [posting, setPosting] = useState(false);

  // Load existing story
  useEffect(() => {
    if (!isNewStory && storyId) {
      loadStory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId, isNewStory]);

  // Mark as viewed when loaded (for existing stories)
  useEffect(() => {
    if (story && currentFirebaseUser && !isNewStory) {
      markAsViewed();
      loadViewCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, currentFirebaseUser]);

  const loadStory = async () => {
    if (!storyId) return;

    try {
      console.log("🔵 [StoryViewerScreen] Loading story:", storyId);
      setLoading(true);
      setError(null);

      const fetchedStory = await getStory(storyId);
      if (!fetchedStory) {
        setError("Story not found or has expired");
        return;
      }

      setStory(fetchedStory);

      // Download and display image
      const uri = await downloadSnapImage(fetchedStory.storagePath);
      setDisplayImage(uri);
      console.log("✅ [StoryViewerScreen] Story loaded successfully");
    } catch (err: any) {
      console.error("❌ [StoryViewerScreen] Failed to load story:", err);
      setError(err.message || "Failed to load story");
    } finally {
      setLoading(false);
    }
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

    Alert.alert("Delete Story", "Are you sure you want to delete this story?", [
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
            console.error("❌ [StoryViewerScreen] Error deleting story:", err);
            Alert.alert("Error", `Failed to delete story: ${String(err)}`);
          }
        },
      },
    ]);
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
          <Text style={{ color: "#FFFC00", fontSize: 14 }}>Go Back</Text>
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
        <ActivityIndicator size="large" color="#FFFC00" />
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={{
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
      onPress={() => !isNewStory && navigation.goBack()}
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
            <Pressable
              onPress={handleDeleteStory}
              style={styles.deleteButton}
            >
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: 0,
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
    backgroundColor: "#FFFC00",
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
