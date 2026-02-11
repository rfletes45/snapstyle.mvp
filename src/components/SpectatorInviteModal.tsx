/**
 * SpectatorInviteModal – Combined Friend + Group picker for spectator invites
 *
 * Shows two tabs: "Friends" and "Groups". Selecting either sends a spectator
 * invite via DM (friend) or group message (group).  This replaces the plain
 * FriendPickerModal that was previously used for spectator invites.
 */

import { getFriendDetails, getFriends } from "@/services/friends";
import {
  sendGroupSpectatorInvite,
  sendSpectatorInvite,
  SentInviteRef,
  SpectatorInviteData,
} from "@/services/games";
import { getUserGroups } from "@/services/groups";
import { AvatarConfig, Group } from "@/types/models";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import { BorderRadius, Mocha, Spacing } from "@/constants/theme";
import { ProfilePictureWithDecoration } from "./profile/ProfilePicture";


import { createLogger } from "@/utils/log";
const logger = createLogger("components/SpectatorInviteModal");
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FriendItem {
  friendUid: string;
  username: string;
  displayName: string;
  avatarConfig: AvatarConfig;
  profilePictureUrl?: string | null;
  decorationId?: string | null;
}

interface GroupItem {
  groupId: string;
  name: string;
  memberCount: number;
}

type Tab = "friends" | "groups";

export interface SpectatorInviteModalProps {
  visible: boolean;
  onDismiss: () => void;
  currentUserId: string;
  /** Data needed to construct the invite message */
  inviteData: SpectatorInviteData | null;
  /** Called after a successful send (so the game screen can show toast) */
  onSent?: (targetName: string) => void;
  /** Called on failure */
  onError?: (msg: string) => void;
  /** Called with the sent invite ref so the caller can track and update it later */
  onInviteRef?: (ref: SentInviteRef) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SpectatorInviteModal({
  visible,
  onDismiss,
  currentUserId,
  inviteData,
  onSent,
  onError,
  onInviteRef,
}: SpectatorInviteModalProps) {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>("friends");

  // Friends
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);

  // Groups
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  const [sending, setSending] = useState(false);

  // ---- Data loading --------------------------------------------------------

  useEffect(() => {
    if (visible && currentUserId) {
      loadFriends();
      loadGroups();
    }
  }, [visible, currentUserId]);

  const loadFriends = async () => {
    setLoadingFriends(true);
    try {
      const friendships = await getFriends(currentUserId);
      const items: FriendItem[] = [];
      for (const f of friendships) {
        const details = await getFriendDetails(f.id, currentUserId);
        if (details?.friendProfile) {
          items.push({
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
      setFriends(items);
    } catch (err) {
      logger.error("[SpectatorInviteModal] loadFriends error:", err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const userGroups: Group[] = await getUserGroups(currentUserId);
      setGroups(
        userGroups.map((g) => ({
          groupId: g.id,
          name: g.name,
          memberCount: g.memberCount ?? g.memberIds?.length ?? 0,
        })),
      );
    } catch (err) {
      logger.error("[SpectatorInviteModal] loadGroups error:", err);
    } finally {
      setLoadingGroups(false);
    }
  };

  // ---- Handlers ------------------------------------------------------------

  const handleSelectFriend = useCallback(
    async (friend: FriendItem) => {
      if (!inviteData || sending) return;
      setSending(true);
      try {
        const ref = await sendSpectatorInvite(
          currentUserId,
          friend.friendUid,
          inviteData,
        );
        if (ref) {
          onInviteRef?.(ref);
          onSent?.(friend.displayName);
        } else {
          onError?.("Failed to send invite");
        }
      } catch {
        onError?.("Failed to send invite");
      } finally {
        setSending(false);
        onDismiss();
      }
    },
    [
      currentUserId,
      inviteData,
      sending,
      onSent,
      onError,
      onDismiss,
      onInviteRef,
    ],
  );

  const handleSelectGroup = useCallback(
    async (group: GroupItem) => {
      if (!inviteData || sending) return;
      setSending(true);
      try {
        const ref = await sendGroupSpectatorInvite(
          currentUserId,
          group.groupId,
          inviteData,
        );
        if (ref) {
          onInviteRef?.(ref);
          onSent?.(group.name);
        } else {
          onError?.("Failed to send invite");
        }
      } catch {
        onError?.("Failed to send invite");
      } finally {
        setSending(false);
        onDismiss();
      }
    },
    [
      currentUserId,
      inviteData,
      sending,
      onSent,
      onError,
      onDismiss,
      onInviteRef,
    ],
  );

  // ---- Renderers -----------------------------------------------------------

  const renderFriendItem = ({ item }: { item: FriendItem }) => (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: `${theme.colors.onSurface}08` }]}
      onPress={() => handleSelectFriend(item)}
      activeOpacity={0.7}
      disabled={sending}
    >
      <ProfilePictureWithDecoration
        pictureUrl={item.profilePictureUrl}
        name={item.displayName}
        decorationId={item.decorationId}
        size={40}
      />
      <View style={styles.rowInfo}>
        <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>
          {item.displayName}
        </Text>
        <Text style={[styles.rowSub, { color: theme.colors.onSurfaceVariant }]}>
          @{item.username}
        </Text>
      </View>
      <MaterialCommunityIcons
        name="send"
        size={24}
        color={theme.colors.primary}
      />
    </TouchableOpacity>
  );

  const renderGroupItem = ({ item }: { item: GroupItem }) => (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: `${theme.colors.onSurface}08` }]}
      onPress={() => handleSelectGroup(item)}
      activeOpacity={0.7}
      disabled={sending}
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
      <View style={styles.rowInfo}>
        <Text
          style={[styles.rowTitle, { color: theme.colors.onSurface }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text style={[styles.rowSub, { color: theme.colors.onSurfaceVariant }]}>
          {item.memberCount} member{item.memberCount !== 1 ? "s" : ""}
        </Text>
      </View>
      <MaterialCommunityIcons
        name="send"
        size={24}
        color={theme.colors.primary}
      />
    </TouchableOpacity>
  );

  const renderEmpty = (loading: boolean, label: string) => {
    if (loading) return null;
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
          No {label} yet
        </Text>
      </View>
    );
  };

  const isLoading = tab === "friends" ? loadingFriends : loadingGroups;

  // ---- Main render ---------------------------------------------------------

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
              Invite to Watch 👀
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
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[
                styles.tab,
                tab === "friends" && {
                  borderBottomColor: theme.colors.primary,
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => setTab("friends")}
            >
              <MaterialCommunityIcons
                name="account"
                size={18}
                color={
                  tab === "friends"
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant
                }
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color:
                      tab === "friends"
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant,
                  },
                ]}
              >
                Friends
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tab,
                tab === "groups" && {
                  borderBottomColor: theme.colors.primary,
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => setTab("groups")}
            >
              <MaterialCommunityIcons
                name="account-group"
                size={18}
                color={
                  tab === "groups"
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant
                }
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color:
                      tab === "groups"
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant,
                  },
                ]}
              >
                Groups
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text
                style={[
                  styles.loadingText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Loading...
              </Text>
            </View>
          ) : tab === "friends" ? (
            <FlatList
              data={friends}
              keyExtractor={(item) => item.friendUid}
              renderItem={renderFriendItem}
              ListEmptyComponent={() => renderEmpty(false, "friends")}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <FlatList
              data={groups}
              keyExtractor={(item) => item.groupId}
              renderItem={renderGroupItem}
              ListEmptyComponent={() => renderEmpty(false, "groups")}
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
  tabs: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm + 2,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    flexGrow: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  rowInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  rowSub: {
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
  cancelButton: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
});
