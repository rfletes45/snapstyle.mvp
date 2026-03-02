/**
 * InvitePickerModal — Unified game invite picker with two tabs:
 *   • Friends  — list of connections (DM invites)
 *   • Groups   — list of group chats (group invites)
 *
 * Replaces separate FriendPickerModal + GroupPickerModal for game invites.
 */

import { BorderRadius, Mocha, Spacing } from "@/constants/theme";
import { getFriendDetails, getFriends } from "@/services/friends";
import { getUserGroups } from "@/services/groups";
import { AvatarConfig, Group } from "@/types/models";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Searchbar, Text, useTheme } from "react-native-paper";
import { ProfilePictureWithDecoration } from "./profile/ProfilePicture";

import { createLogger } from "@/utils/log";
const logger = createLogger("components/InvitePickerModal");

// =============================================================================
// Types
// =============================================================================

export interface FriendItem {
  friendUid: string;
  username: string;
  displayName: string;
  avatarConfig: AvatarConfig;
  profilePictureUrl?: string | null;
  decorationId?: string | null;
}

export interface GroupItem {
  groupId: string;
  name: string;
  memberCount: number;
  avatarUrl?: string;
  /** All member UIDs — needed for group invite eligibleUserIds. */
  memberIds: string[];
}

type TabKey = "friends" | "groups";

interface InvitePickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSelectFriend: (friend: FriendItem) => void;
  onSelectGroup: (group: GroupItem) => void;
  currentUserId: string;
  title?: string;
}

// =============================================================================
// Component
// =============================================================================

export default function InvitePickerModal({
  visible,
  onDismiss,
  onSelectFriend,
  onSelectGroup,
  currentUserId,
  title = "Send Invite",
}: InvitePickerModalProps) {
  const theme = useTheme();

  // ── Tab state ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>("friends");
  const [searchQuery, setSearchQuery] = useState("");

  // ── Friends data ──────────────────────────────────────────────────
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);

  // ── Groups data ───────────────────────────────────────────────────
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  // ── Load data when modal opens ────────────────────────────────────
  useEffect(() => {
    if (visible && currentUserId) {
      loadFriends();
      loadGroups();
      setSearchQuery("");
      setActiveTab("friends");
    }
  }, [visible, currentUserId]);

  const loadFriends = async () => {
    setFriendsLoading(true);
    try {
      const friendships = await getFriends(currentUserId);
      const friendItems: FriendItem[] = [];
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
    } catch (error) {
      logger.error("[InvitePicker] Error loading friends:", error);
    } finally {
      setFriendsLoading(false);
    }
  };

  const loadGroups = async () => {
    setGroupsLoading(true);
    try {
      const userGroups: Group[] = await getUserGroups(currentUserId);
      const items: GroupItem[] = userGroups.map((g) => ({
        groupId: g.id,
        name: g.name,
        memberCount: g.memberCount ?? g.memberIds?.length ?? 0,
        avatarUrl: g.avatarUrl,
        memberIds: g.memberIds ?? [],
      }));
      setGroups(items);
    } catch (error) {
      logger.error("[InvitePicker] Error loading groups:", error);
    } finally {
      setGroupsLoading(false);
    }
  };

  // ── Filtered data ─────────────────────────────────────────────────
  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const q = searchQuery.toLowerCase();
    return friends.filter(
      (f) =>
        f.username.toLowerCase().includes(q) ||
        f.displayName.toLowerCase().includes(q),
    );
  }, [friends, searchQuery]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, searchQuery]);

  // ── Handlers ──────────────────────────────────────────────────────
  const handleSelectFriend = useCallback(
    (friend: FriendItem) => {
      onSelectFriend(friend);
      setSearchQuery("");
    },
    [onSelectFriend],
  );

  const handleSelectGroup = useCallback(
    (group: GroupItem) => {
      onSelectGroup(group);
      setSearchQuery("");
    },
    [onSelectGroup],
  );

  // ── Render: Friend row ────────────────────────────────────────────
  const renderFriendItem = useCallback(
    ({ item }: { item: FriendItem }) => (
      <TouchableOpacity
        style={[
          styles.itemRow,
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
        <View style={styles.itemInfo}>
          <Text
            style={[styles.itemName, { color: theme.colors.onSurface }]}
            numberOfLines={1}
          >
            {item.displayName}
          </Text>
          <Text
            style={[styles.itemMeta, { color: theme.colors.onSurfaceVariant }]}
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
    ),
    [theme, handleSelectFriend],
  );

  // ── Render: Group row ─────────────────────────────────────────────
  const renderGroupItem = useCallback(
    ({ item }: { item: GroupItem }) => (
      <TouchableOpacity
        style={[
          styles.itemRow,
          { backgroundColor: `${theme.colors.onSurface}08` },
        ]}
        onPress={() => handleSelectGroup(item)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.groupAvatar,
            { backgroundColor: theme.colors.primaryContainer },
          ]}
        >
          <MaterialCommunityIcons
            name="account-group"
            size={22}
            color={theme.colors.onPrimaryContainer}
          />
        </View>
        <View style={styles.itemInfo}>
          <Text
            style={[styles.itemName, { color: theme.colors.onSurface }]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text
            style={[styles.itemMeta, { color: theme.colors.onSurfaceVariant }]}
          >
            {item.memberCount} member{item.memberCount !== 1 ? "s" : ""}
          </Text>
        </View>
        <MaterialCommunityIcons
          name="send"
          size={24}
          color={theme.colors.primary}
          style={styles.sendIcon}
        />
      </TouchableOpacity>
    ),
    [theme, handleSelectGroup],
  );

  // ── Render: Empty state ───────────────────────────────────────────
  const renderEmpty = useCallback(
    (type: TabKey) => {
      const isLoading = type === "friends" ? friendsLoading : groupsLoading;
      if (isLoading) return null;

      const rawData = type === "friends" ? friends : groups;
      const filtered = type === "friends" ? filteredFriends : filteredGroups;

      if (rawData.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name={
                type === "friends"
                  ? "account-group-outline"
                  : "account-group-outline"
              }
              size={48}
              color={theme.colors.onSurfaceDisabled}
            />
            <Text
              style={[
                styles.emptyText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {type === "friends" ? "No connections yet" : "No groups yet"}
            </Text>
            <Text
              style={[
                styles.emptySubtext,
                { color: theme.colors.onSurfaceDisabled },
              ]}
            >
              {type === "friends"
                ? "Add connections to invite them to games!"
                : "Create or join a group to send group invites!"}
            </Text>
          </View>
        );
      }

      if (filtered.length === 0) {
        return (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="magnify"
              size={48}
              color={theme.colors.onSurfaceDisabled}
            />
            <Text
              style={[
                styles.emptyText,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              No matches found
            </Text>
          </View>
        );
      }

      return null;
    },
    [
      friends,
      groups,
      filteredFriends,
      filteredGroups,
      friendsLoading,
      groupsLoading,
      theme,
    ],
  );

  // ── Loading state ─────────────────────────────────────────────────
  const isLoading = activeTab === "friends" ? friendsLoading : groupsLoading;

  // ── Main render ───────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
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

          {/* Tabs */}
          <View style={styles.tabBar}>
            <Pressable
              style={[
                styles.tab,
                activeTab === "friends" && {
                  borderBottomColor: theme.colors.primary,
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => {
                setActiveTab("friends");
                setSearchQuery("");
              }}
            >
              <MaterialCommunityIcons
                name="account"
                size={18}
                color={
                  activeTab === "friends"
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant
                }
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color:
                      activeTab === "friends"
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant,
                    fontWeight: activeTab === "friends" ? "700" : "500",
                  },
                ]}
              >
                Friends
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.tab,
                activeTab === "groups" && {
                  borderBottomColor: theme.colors.primary,
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => {
                setActiveTab("groups");
                setSearchQuery("");
              }}
            >
              <MaterialCommunityIcons
                name="account-group"
                size={18}
                color={
                  activeTab === "groups"
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant
                }
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color:
                      activeTab === "groups"
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant,
                    fontWeight: activeTab === "groups" ? "700" : "500",
                  },
                ]}
              >
                Groups
              </Text>
            </Pressable>
          </View>

          {/* Search */}
          <Searchbar
            placeholder={
              activeTab === "friends"
                ? "Search connections..."
                : "Search groups..."
            }
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

          {/* List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text
                style={[
                  styles.loadingText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {activeTab === "friends"
                  ? "Loading connections..."
                  : "Loading groups..."}
              </Text>
            </View>
          ) : activeTab === "friends" ? (
            <FlatList
              data={filteredFriends}
              keyExtractor={(item) => item.friendUid}
              renderItem={renderFriendItem}
              ListEmptyComponent={() => renderEmpty("friends")}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <FlatList
              data={filteredGroups}
              keyExtractor={(item) => item.groupId}
              renderItem={renderGroupItem}
              ListEmptyComponent={() => renderEmpty("groups")}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Cancel */}
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
    maxHeight: "85%",
    paddingBottom: Spacing.xl * 2,
  },
  // ── Header ────────────────────────────────────────────────────────
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
  // ── Tab bar ───────────────────────────────────────────────────────
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabLabel: {
    fontSize: 15,
  },
  // ── Search ────────────────────────────────────────────────────────
  searchBar: {
    margin: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  searchInput: {},
  // ── List ──────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    flexGrow: 1,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: "visible" as const,
    marginBottom: Spacing.sm,
  },
  itemInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
  },
  itemMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: {
    marginLeft: Spacing.sm,
  },
  // ── Loading ───────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.xl * 3,
  },
  loadingText: {
    marginTop: Spacing.md,
  },
  // ── Empty ─────────────────────────────────────────────────────────
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
    textAlign: "center",
  },
  // ── Cancel ────────────────────────────────────────────────────────
  cancelButton: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
});
