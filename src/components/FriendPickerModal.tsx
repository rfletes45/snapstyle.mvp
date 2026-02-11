/**
 * FriendPickerModal - Select a connection to share scorecard with
 */

import { getFriendDetails, getFriends } from "@/services/friends";
import { AvatarConfig } from "@/types/models";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Searchbar, Text, useTheme } from "react-native-paper";
import { BorderRadius, Mocha, Spacing } from "@/constants/theme";
import { ProfilePictureWithDecoration } from "./profile/ProfilePicture";


import { createLogger } from "@/utils/log";
const logger = createLogger("components/FriendPickerModal");
// =============================================================================
// Types
// =============================================================================

interface FriendItem {
  friendUid: string;
  username: string;
  displayName: string;
  avatarConfig: AvatarConfig;
  profilePictureUrl?: string | null;
  decorationId?: string | null;
}

interface FriendPickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSelectFriend: (friend: FriendItem) => void;
  currentUserId: string;
  title?: string;
}

// =============================================================================
// Component
// =============================================================================

export default function FriendPickerModal({
  visible,
  onDismiss,
  onSelectFriend,
  currentUserId,
  title = "Share with Connection",
}: FriendPickerModalProps) {
  const theme = useTheme();
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Load friends list when modal opens
  useEffect(() => {
    if (visible && currentUserId) {
      loadFriends();
    }
  }, [visible, currentUserId]);

  // Filter friends when search query changes
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredFriends(friends);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredFriends(
        friends.filter(
          (f) =>
            f.username.toLowerCase().includes(query) ||
            f.displayName.toLowerCase().includes(query),
        ),
      );
    }
  }, [searchQuery, friends]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const friendships = await getFriends(currentUserId);
      const friendItems: FriendItem[] = [];

      // Load details for each friend
      for (const friendship of friendships) {
        const details = await getFriendDetails(friendship.id, currentUserId);
        if (details && details.friendProfile) {
          friendItems.push({
            friendUid: details.friendUid,
            username: details.friendProfile.username || "Unknown",
            displayName: details.friendProfile.displayName || "Unknown",
            avatarConfig: details.friendProfile.avatarConfig || {
              baseColor: theme.colors.primary,
            },
            profilePictureUrl:
              details.friendProfile.profilePicture?.url ?? null,
            decorationId:
              details.friendProfile.avatarDecoration?.decorationId ?? null,
          });
        }
      }

      setFriends(friendItems);
      setFilteredFriends(friendItems);
    } catch (error) {
      logger.error("[FriendPicker] Error loading friends:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFriend = (friend: FriendItem) => {
    onSelectFriend(friend);
    setSearchQuery("");
  };

  const renderFriendItem = ({ item }: { item: FriendItem }) => (
    <TouchableOpacity
      style={[
        styles.friendItem,
        { backgroundColor: `${theme.colors.onSurface}08` },
      ]}
      onPress={() => handleSelectFriend(item)}
      activeOpacity={0.7}
    >
      <ProfilePictureWithDecoration
        pictureUrl={item.profilePictureUrl}
        name={item.displayName}
        decorationId={item.decorationId}
        size={40}
      />
      <View style={styles.friendInfo}>
        <Text
          style={[styles.friendDisplayName, { color: theme.colors.onSurface }]}
        >
          {item.displayName}
        </Text>
        <Text
          style={[
            styles.friendUsername,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          @{item.username}
        </Text>
      </View>
      <MaterialCommunityIcons
        name="send"
        size={24}
        color={theme.colors.primary}
        style={styles.sendIcon}
      />
    </TouchableOpacity>
  );

  const renderEmpty = () => {
    if (loading) return null;

    if (friends.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="account-group-outline"
            size={48}
            color={theme.colors.onSurfaceDisabled}
          />
          <Text
            style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
          >
            No connections yet
          </Text>
          <Text
            style={[
              styles.emptySubtext,
              { color: theme.colors.onSurfaceDisabled },
            ]}
          >
            Add connections to share your scores!
          </Text>
        </View>
      );
    }

    if (filteredFriends.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="magnify"
            size={48}
            color={theme.colors.onSurfaceDisabled}
          />
          <Text
            style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
          >
            No matches found
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: Mocha.surface0 }]}>
          {/* Header */}
          <View
            style={[
              styles.header,
              { borderBottomColor: `${theme.colors.onSurface}15` },
            ]}
          >
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              {title}
            </Text>
            <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={theme.colors.onSurface}
              />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <Searchbar
            placeholder="Search connections..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={[
              styles.searchBar,
              { backgroundColor: `${theme.colors.onSurface}10` },
            ]}
            inputStyle={[styles.searchInput, { color: theme.colors.onSurface }]}
            iconColor={theme.colors.onSurfaceVariant}
            placeholderTextColor={theme.colors.onSurfaceDisabled}
          />

          {/* Connections List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text
                style={[
                  styles.loadingText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Loading connections...
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredFriends}
              keyExtractor={(item) => item.friendUid}
              renderItem={renderFriendItem}
              ListEmptyComponent={renderEmpty}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Cancel Button */}
          <Button
            mode="outlined"
            onPress={onDismiss}
            style={[
              styles.cancelButton,
              { borderColor: theme.colors.outlineVariant },
            ]}
            textColor={theme.colors.onSurface}
          >
            Cancel
          </Button>
        </View>
      </View>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  container: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "80%",
    paddingBottom: Spacing.xl * 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    paddingTop: Spacing.lg,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  closeButton: {
    padding: Spacing.xs,
  },
  searchBar: {
    margin: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  searchInput: {
    // Color applied inline
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    flexGrow: 1,
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: "visible" as const,
    marginBottom: Spacing.sm,
  },
  friendInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  friendDisplayName: {
    fontSize: 16,
    fontWeight: "600",
  },
  friendUsername: {
    fontSize: 13,
    marginTop: 2,
  },
  sendIcon: {
    marginLeft: Spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.xl * 3,
  },
  loadingText: {
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.xl * 3,
  },
  emptyText: {
    fontSize: 16,
    marginTop: Spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  cancelButton: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
});
