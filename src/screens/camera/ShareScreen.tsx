/**
 * SHARE SCREEN
 * Select recipients, set captions, and publish snaps.
 * Uses CameraContext for state (no Redux).
 */

import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  useSnapSharing,
  useSnapUpload,
} from "@/hooks/camera/useCameraHooks";
import { useAuth } from "@/store/AuthContext";
import { useSnapState } from "@/store/CameraContext";
import type { Snap } from "@/types/camera";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/camera/ShareScreen");
const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Friend {
  id: string;
  name: string;
  avatar?: string;
}

const ShareScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { currentFirebaseUser } = useAuth();

  // Context-based snap state
  const {
    currentShareSnap,
    uploading,
    uploadProgress,
    startUpload,
    uploadError,
  } = useSnapState();

  // Upload hook
  const { uploadSnap } = useSnapUpload();

  // Sharing hook
  const {
    selectedRecipients,
    shareToStory,
    caption,
    allowReplies,
    allowReactions,
    addRecipient: addRecipientToShare,
    removeRecipient: removeRecipientFromShare,
    setCaption,
    setAllowReplies,
    setAllowReactions,
  } = useSnapSharing();

  // Local state
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showingStory, setShowingStory] = useState(shareToStory);

  // Load friends on mount
  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      // Would fetch from Firestore
      const mockFriends: Friend[] = [
        { id: "1", name: "Alice" },
        { id: "2", name: "Bob" },
        { id: "3", name: "Charlie" },
        { id: "4", name: "Diana" },
        { id: "5", name: "Eve" },
      ];
      setFriends(mockFriends);
    } catch (error) {
      logger.error("[Share Screen] Failed to load friends:", error);
    }
  }, []);

  // Filter friends by search
  const filteredFriends = friends.filter((friend) =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Toggle friend selection
  const handleToggleFriend = (friendId: string) => {
    const isSelected = selectedRecipients.some((id: string) => id === friendId);
    if (isSelected) {
      removeRecipientFromShare(friendId);
    } else {
      addRecipientToShare(friendId);
    }
  };

  // Handle publish
  const handlePublish = async () => {
    try {
      if (!currentShareSnap) {
        logger.error("No snap to publish");
        return;
      }

      const recipients = selectedRecipients.map((userId: string) => ({
        userId,
        addedAt: Date.now(),
        recipientType: "direct" as const,
      }));

      const snap: Snap = {
        id: `snap-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        senderId: currentFirebaseUser?.uid || "",
        senderDisplayName: currentFirebaseUser?.displayName || "Unknown",
        mediaType: currentShareSnap.mediaType || "photo",
        mediaUrl: currentShareSnap.mediaUrl,
        duration: currentShareSnap.duration,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        recipients,
        storyVisible: showingStory,
        storyExpiresAt: showingStory ? Date.now() + 86400000 : undefined,
        caption: caption || "",
        filters: currentShareSnap.filters || [],
        overlayElements: currentShareSnap.overlayElements || [],
        viewedBy: [],
        reactions: [],
        replies: [],
        allowReplies,
        allowReactions,
        viewOnceOnly: true,
        screenshotNotification: true,
        uploadStatus: "pending" as const,
        uploadProgress: 0,
      };

      const response = await fetch(currentShareSnap.mediaUrl);
      const mediaBlob = await response.blob();

      startUpload();
      const snapId = await uploadSnap(snap, mediaBlob);

      logger.info("[Share Screen] Snap published:", snapId);
      navigation.navigate("Camera");
    } catch (error) {
      logger.error("[Share Screen] Publish failed:", error);
      uploadError(error instanceof Error ? error.message : "Failed to publish");
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with preview */}
      <View style={styles.previewSection}>
        {currentShareSnap && (
          <Image
            source={{ uri: currentShareSnap.mediaUrl }}
            style={styles.snapPreview}
            resizeMode="cover"
          />
        )}
      </View>

      {/* Recipients & Settings */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Recipients */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send To</Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Search friends..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <FlatList
            scrollEnabled={false}
            data={filteredFriends}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View style={styles.emptyFriendsState}>
                <Text style={styles.emptyFriendsText}>
                  {searchQuery.trim().length > 0
                    ? "No friends match your search."
                    : "No friends available yet."}
                </Text>
              </View>
            }
            renderItem={({ item: friend }) => (
              <TouchableOpacity
                style={styles.friendItem}
                onPress={() => handleToggleFriend(friend.id)}
              >
                <View style={styles.friendInfo}>
                  <View style={styles.friendAvatar}>
                    <Text style={styles.avatarText}>
                      {friend.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.friendName}>{friend.name}</Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    selectedRecipients.some((id: string) => id === friend.id) &&
                      styles.checkboxChecked,
                  ]}
                >
                  {selectedRecipients.some(
                    (id: string) => id === friend.id,
                  ) && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Story Share */}
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Share to Story</Text>
              <Text style={styles.settingDescription}>
                Visible for 24 hours
              </Text>
            </View>
            <Switch
              value={showingStory}
              onValueChange={setShowingStory}
              trackColor={{ false: "#555", true: "#81C784" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Caption */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Caption (Optional)</Text>
          <TextInput
            style={styles.captionInput}
            placeholder="Add a caption..."
            placeholderTextColor="#999"
            value={caption}
            onChangeText={setCaption}
            maxLength={300}
            multiline
          />
          <Text style={styles.charCount}>{caption.length}/300</Text>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Allow Replies</Text>
            <Switch
              value={allowReplies}
              onValueChange={setAllowReplies}
              trackColor={{ false: "#555", true: "#81C784" }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Allow Reactions</Text>
            <Switch
              value={allowReactions}
              onValueChange={setAllowReactions}
              trackColor={{ false: "#555", true: "#81C784" }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Screenshot Notification</Text>
            <Switch
              value={true}
              onValueChange={() => {}}
              trackColor={{ false: "#555", true: "#81C784" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Upload Progress */}
      {uploading && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${uploadProgress}%` }]}
            />
          </View>
          <Text style={styles.progressText}>{Math.round(uploadProgress)}%</Text>
        </View>
      )}

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.cancelButton]}
          onPress={() => navigation.goBack()}
          disabled={uploading}
        >
          <Text style={styles.actionButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.sendButton,
            (uploading || selectedRecipients.length === 0) &&
              styles.sendButtonDisabled,
          ]}
          onPress={handlePublish}
          disabled={uploading || selectedRecipients.length === 0}
        >
          <Text style={styles.actionButtonText}>
            {uploading ? "Uploading..." : "Send"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },

  // Preview
  previewSection: {
    height: 200,
    backgroundColor: "#111",
    overflow: "hidden",
  },
  snapPreview: {
    width: "100%",
    height: "100%",
  },

  // Content
  content: {
    flex: 1,
  },

  // Section
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },

  // Search
  searchInput: {
    backgroundColor: "#222",
    color: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  emptyFriendsState: {
    paddingVertical: 18,
    alignItems: "center",
  },
  emptyFriendsText: {
    color: "#999",
    fontSize: 13,
  },

  // Friend Item
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 8,
  },
  friendInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  friendName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#666",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },

  // Settings
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  settingLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  settingDescription: {
    color: "#999",
    fontSize: 12,
    marginTop: 4,
  },

  // Caption
  captionInput: {
    backgroundColor: "#222",
    color: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 80,
  },
  charCount: {
    color: "#999",
    fontSize: 12,
    marginTop: 6,
    textAlign: "right",
  },

  // Progress
  progressContainer: {
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  progressBar: {
    height: 4,
    backgroundColor: "#333",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#007AFF",
  },
  progressText: {
    color: "#999",
    fontSize: 12,
    textAlign: "center",
  },

  // Bottom Actions
  bottomActions: {
    flexDirection: "row",
    height: 60,
    backgroundColor: "rgba(0,0,0,0.9)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  actionButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 10,
    marginVertical: 10,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  sendButton: {
    backgroundColor: "#007AFF",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ShareScreen;
