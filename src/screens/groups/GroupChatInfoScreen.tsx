/**
 * GroupChatInfoScreen
 *
 * Features:
 * - View group details (name, members)
 * - Manage members (for owners/admins)
 * - Leave group
 * - Invite new members
 * - Role management (owner only)
 */

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { ErrorState, LoadingState } from "@/components/ui";
import { getFriends, getUserProfileByUid } from "@/services/friends";
import {
  changeMemberRole,
  deleteGroup,
  getGroup,
  getUserRole,
  leaveGroup,
  removeMember,
  sendGroupInvite,
  subscribeToGroupMembers,
  updateGroupName,
  updateGroupPhoto,
} from "@/services/groups";
import { useAuth } from "@/store/AuthContext";
import { Group, GROUP_LIMITS, GroupMember, GroupRole } from "@/types/models";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Appbar,
  Button,
  Divider,
  IconButton,
  Menu,
  Modal,
  Portal,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/store/ThemeContext";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/groups/GroupChatInfoScreen");
export default function GroupChatInfoScreen({ route, navigation }: any) {
  const { groupId } = route.params;
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;
  const colors = useColors();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [userRole, setUserRole] = useState<GroupRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [invitableFriends, setInvitableFriends] = useState<any[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const [removeConfirmVisible, setRemoveConfirmVisible] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(
    null,
  );
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Handle group photo change
  const handleChangePhoto = async () => {
    if (!uid || (userRole !== "owner" && userRole !== "admin")) {
      Alert.alert(
        "Permission Denied",
        "Only admins can change the group photo",
      );
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      setUploadingPhoto(true);
      logger.info("🔵 [GroupChatInfo] Starting photo upload...");

      const imageUri = result.assets[0].uri;

      // Import storage service dynamically to avoid circular deps
      const { uploadGroupImage } = await import("@/services/storage");

      // Upload to storage - use "avatar" as the messageId for avatar images
      logger.info("🔵 [GroupChatInfo] Uploading image to storage...");
      const downloadUrl = await uploadGroupImage(groupId, "avatar", imageUri);
      logger.info("✅ [GroupChatInfo] Image uploaded, URL:", downloadUrl);

      // Update group document
      logger.info("🔵 [GroupChatInfo] Updating group document...");
      await updateGroupPhoto(groupId, uid, downloadUrl);
      logger.info("✅ [GroupChatInfo] Group document updated");

      // Update local state
      setGroup((prev) => (prev ? { ...prev, avatarUrl: downloadUrl } : prev));
      setSnackbar({ visible: true, message: "Group photo updated!" });
      logger.info("✅ [GroupChatInfo] Photo change complete");
    } catch (err: any) {
      logger.error("❌ [GroupChatInfo] Failed to update group photo:", err);
      Alert.alert("Error", err.message || "Failed to update group photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Load group data
  useEffect(() => {
    async function loadGroup() {
      if (!groupId || !uid) return;

      try {
        setLoading(true);
        setError(null);

        const [groupData, role] = await Promise.all([
          getGroup(groupId),
          getUserRole(groupId, uid),
        ]);

        if (!groupData) {
          setError("Group not found");
          return;
        }

        if (!role) {
          setError("You are not a member of this group");
          return;
        }

        setGroup(groupData);
        setUserRole(role);
        setNewGroupName(groupData.name);
      } catch (err: any) {
        logger.error("Error loading group:", err);
        setError(err.message || "Failed to load group");
      } finally {
        setLoading(false);
      }
    }

    loadGroup();
  }, [groupId, uid]);

  // Subscribe to members
  useEffect(() => {
    if (!groupId) return;

    const unsubscribe = subscribeToGroupMembers(
      groupId,
      async (membersData) => {
        // Enrich members missing profile picture data
        const enriched = await Promise.all(
          membersData.map(async (member) => {
            if (
              member.profilePictureUrl !== undefined &&
              member.profilePictureUrl !== null
            ) {
              return member;
            }
            try {
              const profile = await getUserProfileByUid(member.uid);
              if (profile) {
                return {
                  ...member,
                  profilePictureUrl: profile.profilePicture?.url || null,
                  decorationId: profile.avatarDecoration?.equippedId || null,
                };
              }
            } catch {
              // Fall back to initials
            }
            return member;
          }),
        );

        // Sort: owner first, then admins, then members
        const sorted = [...enriched].sort((a, b) => {
          const roleOrder: Record<GroupRole, number> = {
            owner: 0,
            admin: 1,
            member: 2,
          };
          return roleOrder[a.role] - roleOrder[b.role];
        });
        setMembers(sorted);
      },
    );

    return () => unsubscribe();
  }, [groupId]);

  // Load invitable friends
  const loadInvitableFriends = useCallback(async () => {
    if (!uid) return;

    setInviteLoading(true);

    try {
      const friendsData = await getFriends(uid);
      const memberUids = new Set(members.map((m) => m.uid));

      // Fetch profiles for each friend
      const friendsWithProfiles = await Promise.all(
        friendsData.map(async (friend) => {
          const friendUid = friend.users.find((u) => u !== uid);
          if (!friendUid || memberUids.has(friendUid)) return null;

          const profile = await getUserProfileByUid(friendUid);
          if (!profile) return null;

          return {
            uid: friendUid,
            displayName: profile.displayName,
            username: profile.username,
            avatarConfig: profile.avatarConfig,
            profilePictureUrl: profile.profilePicture?.url || null,
            decorationId: profile.avatarDecoration?.equippedId || null,
          };
        }),
      );

      // Filter out nulls
      const invitable = friendsWithProfiles.filter(
        (f): f is NonNullable<typeof f> => f !== null,
      );

      setInvitableFriends(invitable);
    } catch (error) {
      logger.error("[GroupChatInfo] Error loading friends:", error);
    } finally {
      setInviteLoading(false);
    }
  }, [uid, members]);

  // Handle leave group
  const handleLeaveGroup = () => {
    setLeaveConfirmVisible(true);
  };

  const confirmLeaveGroup = async () => {
    setLeaveConfirmVisible(false);
    try {
      setActionLoading(true);
      await leaveGroup(groupId, uid!);
      navigation.navigate("ChatList");
    } catch (error: any) {
      setSnackbar({
        visible: true,
        message: error.message || "Failed to leave group",
      });
      setActionLoading(false);
    }
  };

  // Handle delete group (owner only)
  const handleDeleteGroup = () => {
    logger.info("🗑️ handleDeleteGroup called", {
      groupId,
      uid,
      userRole,
      actionLoading,
    });
    setDeleteConfirmVisible(true);
  };

  const confirmDeleteGroup = async () => {
    logger.info("🗑️ Delete confirmed by user");
    setDeleteConfirmVisible(false);
    try {
      setActionLoading(true);
      logger.info("🗑️ Calling deleteGroup service...");
      await deleteGroup(groupId, uid!);
      logger.info("🗑️ Delete successful, navigating to ChatList");
      navigation.navigate("ChatList");
    } catch (error: any) {
      logger.error("🗑️ Delete failed:", error);
      setSnackbar({
        visible: true,
        message: error.message || "Failed to delete group",
      });
      setActionLoading(false);
    }
  };

  // Handle remove member
  const handleRemoveMember = (member: GroupMember) => {
    setMemberToRemove(member);
    setRemoveConfirmVisible(true);
    setMenuVisible(null);
  };

  // Confirm remove member
  const confirmRemoveMember = async () => {
    if (!memberToRemove || !uid) return;

    setActionLoading(true);
    try {
      await removeMember(groupId, uid, memberToRemove.uid);
      setSnackbar({
        visible: true,
        message: `${memberToRemove.displayName} removed from group`,
      });
      setRemoveConfirmVisible(false);
      setMemberToRemove(null);
    } catch (error: any) {
      setSnackbar({
        visible: true,
        message: error.message || "Failed to remove member",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle role change
  const handleChangeRole = async (member: GroupMember, newRole: GroupRole) => {
    try {
      await changeMemberRole(groupId, uid!, member.uid, newRole);
      setSnackbar({
        visible: true,
        message: `${member.displayName} is now ${newRole === "admin" ? "an admin" : "a member"}`,
      });
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to change role");
    }
    setMenuVisible(null);
  };

  // Handle update group name
  const handleUpdateName = async () => {
    if (!newGroupName.trim()) return;

    try {
      setActionLoading(true);
      await updateGroupName(groupId, uid!, newGroupName.trim());
      setGroup((prev) =>
        prev ? { ...prev, name: newGroupName.trim() } : prev,
      );
      setEditNameVisible(false);
      setSnackbar({ visible: true, message: "Group name updated" });
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update group name");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle invite friend
  const handleInviteFriend = async (friend: any) => {
    try {
      await sendGroupInvite(groupId, group!.name, uid!, friend.uid);
      setSnackbar({
        visible: true,
        message: `Invite sent to ${friend.displayName}`,
      });
      // Remove from invitable list
      setInvitableFriends((prev) => prev.filter((f) => f.uid !== friend.uid));
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send invite");
    }
  };

  // Render member item
  const renderMember = (member: GroupMember) => {
    const isCurrentUser = member.uid === uid;
    const canManage =
      (userRole === "owner" || userRole === "admin") &&
      !isCurrentUser &&
      member.role !== "owner";

    return (
      <View key={member.uid} style={styles.memberItem}>
        <View style={styles.memberLeft}>
          <ProfilePictureWithDecoration
            pictureUrl={member.profilePictureUrl}
            name={member.displayName}
            decorationId={member.decorationId}
            size={40}
          />
          <View style={styles.memberInfo}>
            <View style={styles.memberNameRow}>
              <Text style={styles.memberName}>
                {member.displayName}
                {isCurrentUser && <Text style={styles.youLabel}> (You)</Text>}
              </Text>
            </View>
            <Text style={styles.memberUsername}>@{member.username}</Text>
          </View>
        </View>

        <View style={styles.memberRight}>
          {member.role !== "member" && (
            <View
              style={[
                styles.roleBadge,
                member.role === "owner" && [
                  styles.ownerBadge,
                  { backgroundColor: colors.primary },
                ],
                member.role === "admin" && styles.adminBadge,
              ]}
            >
              <Text style={styles.roleBadgeText}>
                {member.role === "owner" ? "Owner" : "Admin"}
              </Text>
            </View>
          )}

          {canManage && (
            <Menu
              visible={menuVisible === member.uid}
              onDismiss={() => setMenuVisible(null)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  size={20}
                  iconColor="#888"
                  onPress={() => setMenuVisible(member.uid)}
                />
              }
              contentStyle={{ backgroundColor: theme.colors.surface }}
            >
              {userRole === "owner" && (
                <>
                  {member.role === "admin" ? (
                    <Menu.Item
                      title="Remove Admin"
                      leadingIcon="shield-remove"
                      onPress={() => handleChangeRole(member, "member")}
                    />
                  ) : (
                    <Menu.Item
                      title="Make Admin"
                      leadingIcon="shield-account"
                      onPress={() => handleChangeRole(member, "admin")}
                    />
                  )}
                  <Divider />
                </>
              )}
              <Menu.Item
                title="Remove"
                leadingIcon="account-remove"
                onPress={() => handleRemoveMember(member)}
                titleStyle={{ color: "#F44336" }}
              />
            </Menu>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <Appbar.Header style={styles.header}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Group Info" />
        </Appbar.Header>
        <LoadingState message="Loading group info..." />
      </SafeAreaView>
    );
  }

  if (error || !group) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <Appbar.Header style={styles.header}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Group Info" />
        </Appbar.Header>
        <ErrorState
          message={error || "Group not found"}
          onRetry={() => navigation.goBack()}
          retryLabel="Go Back"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Group Info" />
        {(userRole === "owner" || userRole === "admin") && (
          <Appbar.Action
            icon="pencil"
            onPress={() => setEditNameVisible(true)}
          />
        )}
      </Appbar.Header>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Group Header */}
        <View style={styles.groupHeader}>
          <TouchableOpacity
            onPress={handleChangePhoto}
            disabled={
              uploadingPhoto || (userRole !== "owner" && userRole !== "admin")
            }
            style={styles.groupAvatarContainer}
          >
            {group.avatarUrl ? (
              <Image
                source={{ uri: group.avatarUrl }}
                style={styles.groupAvatarImage}
              />
            ) : (
              <View
                style={[
                  styles.groupAvatar,
                  { backgroundColor: theme.colors.surfaceVariant },
                ]}
              >
                <MaterialCommunityIcons
                  name="account-group"
                  size={48}
                  color={theme.colors.primary}
                />
              </View>
            )}
            {(userRole === "owner" || userRole === "admin") && (
              <View
                style={[
                  styles.editAvatarBadge,
                  { backgroundColor: colors.primary },
                ]}
              >
                {uploadingPhoto ? (
                  <MaterialCommunityIcons
                    name="loading"
                    size={16}
                    color="#FFF"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="camera"
                    size={16}
                    color="#FFF"
                  />
                )}
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.memberCount}>
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
          </Text>
        </View>

        {/* Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members</Text>
            {(userRole === "owner" || userRole === "admin") &&
              members.length < GROUP_LIMITS.MAX_MEMBERS && (
                <TouchableOpacity
                  onPress={() => {
                    loadInvitableFriends();
                    setInviteModalVisible(true);
                  }}
                  style={styles.addButton}
                >
                  <MaterialCommunityIcons
                    name="account-plus"
                    size={20}
                    color={theme.colors.primary}
                  />
                  <Text
                    style={[styles.addButtonText, { color: colors.primary }]}
                  >
                    Invite
                  </Text>
                </TouchableOpacity>
              )}
          </View>

          {members.map(renderMember)}
        </View>

        {/* Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          {/* Chat Settings - H13 */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              navigation.navigate("ChatSettings", {
                groupId,
                chatType: "group",
                chatName: group.name,
              })
            }
          >
            <MaterialCommunityIcons
              name="bell-cog-outline"
              size={24}
              color={theme.colors.primary}
            />
            <Text style={styles.actionButtonText}>
              Notifications & Settings
            </Text>
          </TouchableOpacity>

          {userRole !== "owner" && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleLeaveGroup}
              disabled={actionLoading}
            >
              <MaterialCommunityIcons
                name="exit-run"
                size={24}
                color="#F44336"
              />
              <Text style={styles.actionButtonTextDanger}>Leave Group</Text>
            </TouchableOpacity>
          )}

          {userRole === "owner" && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                logger.info("🗑️ Delete button pressed!");
                logger.info("🔍 Actions section state", {
                  userRole,
                  showDelete: userRole === "owner",
                  showLeave: userRole !== "owner",
                  actionLoading,
                });
                handleDeleteGroup();
              }}
              disabled={actionLoading}
            >
              <MaterialCommunityIcons name="delete" size={24} color="#F44336" />
              <Text style={styles.actionButtonTextDanger}>Delete Group</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Edit Name Modal */}
      <Portal>
        <Modal
          visible={editNameVisible}
          onDismiss={() => setEditNameVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Edit Group Name</Text>
          <TextInput
            mode="outlined"
            value={newGroupName}
            onChangeText={setNewGroupName}
            maxLength={GROUP_LIMITS.MAX_NAME_LENGTH}
            style={styles.modalInput}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            textColor={theme.colors.onSurface}
          />
          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={() => setEditNameVisible(false)}
              textColor={theme.colors.onSurfaceDisabled}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleUpdateName}
              loading={actionLoading}
              disabled={!newGroupName.trim() || actionLoading}
            >
              Save
            </Button>
          </View>
        </Modal>

        {/* Invite Modal */}
        <Modal
          visible={inviteModalVisible}
          onDismiss={() => setInviteModalVisible(false)}
          contentContainerStyle={styles.inviteModalContent}
        >
          <Text style={styles.inviteModalTitle}>Invite Friends</Text>
          {inviteLoading ? (
            <View style={styles.inviteLoadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.inviteLoadingText}>Loading friends...</Text>
            </View>
          ) : invitableFriends.length === 0 ? (
            <Text style={styles.noFriendsText}>
              No friends available to invite
            </Text>
          ) : (
            <View style={styles.inviteFriendsContainer}>
              {invitableFriends.map((item) => (
                <View key={item.uid} style={styles.inviteFriendItem}>
                  <View style={styles.inviteFriendLeft}>
                    <ProfilePictureWithDecoration
                      pictureUrl={item.profilePictureUrl}
                      name={item.displayName}
                      decorationId={item.decorationId}
                      size={40}
                    />
                    <Text style={styles.inviteFriendName} numberOfLines={1}>
                      {item.displayName}
                    </Text>
                  </View>
                  <Button
                    mode="contained"
                    onPress={() => handleInviteFriend(item)}
                    buttonColor={theme.colors.primary}
                    textColor="#FFF"
                    style={styles.inviteButton}
                    labelStyle={{ fontWeight: "600", fontSize: 14 }}
                    compact
                  >
                    Invite
                  </Button>
                </View>
              ))}
            </View>
          )}
          <Button
            mode="text"
            onPress={() => setInviteModalVisible(false)}
            textColor="#666"
            style={styles.closeButton}
            labelStyle={{ fontSize: 15 }}
          >
            Close
          </Button>
        </Modal>

        {/* Leave Confirmation Modal */}
        <Modal
          visible={leaveConfirmVisible}
          onDismiss={() => setLeaveConfirmVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Leave Group</Text>
          <Text style={styles.modalMessage}>
            Are you sure you want to leave this group? You will need a new
            invite to rejoin.
          </Text>
          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={() => setLeaveConfirmVisible(false)}
              textColor="#888"
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={confirmLeaveGroup}
              buttonColor="#F44336"
              textColor="#FFF"
              loading={actionLoading}
              disabled={actionLoading}
            >
              Leave
            </Button>
          </View>
        </Modal>

        {/* Remove Member Confirmation Modal */}
        <Modal
          visible={removeConfirmVisible}
          onDismiss={() => {
            setRemoveConfirmVisible(false);
            setMemberToRemove(null);
          }}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Remove Member</Text>
          <Text style={styles.modalMessage}>
            {memberToRemove
              ? `Remove ${memberToRemove.displayName} from the group?`
              : "Remove this member from the group?"}
          </Text>
          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={() => {
                setRemoveConfirmVisible(false);
                setMemberToRemove(null);
              }}
              textColor="#888"
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={confirmRemoveMember}
              buttonColor="#F44336"
              textColor="#FFF"
              loading={actionLoading}
              disabled={actionLoading}
            >
              Remove
            </Button>
          </View>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          visible={deleteConfirmVisible}
          onDismiss={() => setDeleteConfirmVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Delete Group</Text>
          <Text style={styles.modalMessage}>
            Are you sure you want to delete this group? This cannot be undone.
            All messages and members will be removed.
          </Text>
          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={() => setDeleteConfirmVisible(false)}
              textColor="#888"
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={confirmDeleteGroup}
              buttonColor="#F44336"
              textColor="#FFF"
              loading={actionLoading}
              disabled={actionLoading}
            >
              Delete
            </Button>
          </View>
        </Modal>
      </Portal>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: "" })}
        duration={2000}
        style={styles.snackbar}
      >
        <Text style={{ color: "#FFF" }}>{snackbar.message}</Text>
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    backgroundColor: "#000",
  },
  content: {
    flex: 1,
  },
  groupHeader: {
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  groupAvatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  groupAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  groupAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  editAvatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  groupName: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
    textAlign: "center",
  },
  memberCount: {
    color: "#888",
    fontSize: 14,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  memberLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  memberInfo: {
    marginLeft: 12,
    flex: 1,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  memberName: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "500",
  },
  youLabel: {
    color: "#888",
    fontWeight: "normal",
  },
  memberUsername: {
    color: "#888",
    fontSize: 13,
    marginTop: 2,
  },
  memberRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#333",
  },
  ownerBadge: {},
  adminBadge: {
    backgroundColor: "#4CAF50",
  },
  roleBadgeText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "600",
  },
  menuContent: {
    backgroundColor: "#1A1A1A",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  actionButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "500",
  },
  actionButtonTextDanger: {
    color: "#F44336",
    fontSize: 16,
    fontWeight: "500",
  },
  modalContent: {
    backgroundColor: "#1A1A1A",
    margin: 24,
    padding: 24,
    borderRadius: 16,
  },
  modalTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  inviteModalTitle: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: "#000",
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  inviteModalContent: {
    backgroundColor: "#1A1A1A",
    marginHorizontal: 20,
    marginVertical: 60,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    borderRadius: 20,
    maxHeight: "80%",
  },
  inviteLoadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  inviteLoadingText: {
    color: "#888",
    marginTop: 16,
    fontSize: 15,
  },
  inviteFriendsContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  inviteFriendsList: {
    maxHeight: 300,
  },
  inviteFriendItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  inviteFriendLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  inviteFriendName: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  inviteButton: {
    borderRadius: 20,
    borderWidth: 1.5,
  },
  noFriendsText: {
    color: "#888",
    textAlign: "center",
    marginVertical: 32,
    fontSize: 15,
  },
  closeButton: {
    marginTop: 12,
    alignSelf: "center",
  },
  snackbar: {
    backgroundColor: "#333",
  },
  modalMessage: {
    color: "#CCC",
    fontSize: 15,
    lineHeight: 22,
    marginVertical: 16,
  },
});
