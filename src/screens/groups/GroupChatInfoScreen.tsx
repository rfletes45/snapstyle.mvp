/**
 * GroupChatInfoScreen — Overhauled
 *
 * Full group info, management, and editing screen.
 * Real-time subscriptions for group data and members.
 * Permission-aware UI with card-based modern layout.
 *
 * Architecture:
 * - Subscribes to group doc + members in real time
 * - Uses useGroupPermissions hook for reactive capabilities
 * - Uses app-wide SnackbarContext for feedback
 * - Card-based layout with clear section hierarchy
 */

import { AppImage } from "@/components/AppImage";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { ErrorState, LoadingState } from "@/components/ui";
import {
  BorderRadius,
  Elevation,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/theme";
import { useGroupPermissions } from "@/hooks/useGroupPermissions";
import { GroupPermission } from "@/permissions/groupPermissions";
import { getFriends, getUserProfileByUid } from "@/services/friends";
import {
  changeMemberRole,
  deleteGroup,
  hydrateGroupMembersForDisplay,
  leaveGroup,
  migrateGroupPermissions,
  removeMember,
  sendGroupInvite,
  subscribeToGroup,
  subscribeToGroupMembers,
  updateGroupName,
  updateGroupPhoto,
} from "@/services/groups";
import { uploadGroupAvatarImage } from "@/services/storage";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useColors } from "@/store/ThemeContext";
import { Group, GROUP_LIMITS, GroupMember, GroupRole } from "@/types/models";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
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
  Text,
  TextInput,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/groups/GroupChatInfoScreen");

// =============================================================================
// Main Component
// =============================================================================

export default function GroupChatInfoScreen({ route, navigation }: any) {
  const { groupId } = route.params;
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;
  const colors = useColors();
  const { showSuccess, showError, showErrorWithRetry } = useSnackbar();
  const { height: windowHeight } = useWindowDimensions();

  // ─── Core state ───────────────────────────────────────────────────────
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Action state ─────────────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const actionLockRef = useRef(false); // Prevent double-tap
  const isDismissingRef = useRef(false); // Guard subscription during leave/delete

  // ─── Modal state ──────────────────────────────────────────────────────
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [invitableFriends, setInvitableFriends] = useState<any[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [removeConfirmVisible, setRemoveConfirmVisible] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(
    null,
  );
  const [menuVisible, setMenuVisible] = useState<string | null>(null);

  // ─── Permissions (reactive) ───────────────────────────────────────────
  const {
    can,
    canOverTarget,
    role: userRole,
    loading: permLoading,
  } = useGroupPermissions(groupId);

  // ─── Animations ───────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading && group) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, group]);

  // ─── Real-time group subscription ─────────────────────────────────────
  useEffect(() => {
    if (!groupId || !uid) return;

    logger.debug("[GroupInfo] Subscribing to group doc", { groupId });

    const unsubGroup = subscribeToGroup(groupId, async (groupData) => {
      if (!groupData) {
        // If we're actively leaving/deleting, don't set error — navigation is in flight
        if (isDismissingRef.current) return;
        setError("Group not found or has been deleted");
        setLoading(false);
        return;
      }

      // Lazy-migrate permissions for legacy groups
      if (!groupData.permissionsConfig?.schemaVersion) {
        try {
          const config = await migrateGroupPermissions(groupId);
          groupData.permissionsConfig = config;
          logger.debug("[GroupInfo] Migrated legacy permissions", { groupId });
        } catch (err) {
          logger.error("[GroupInfo] Permission migration failed", err);
        }
      }

      setGroup(groupData);
      setError(null);
      setLoading(false);
    });

    return () => {
      logger.debug("[GroupInfo] Unsubscribing from group doc", { groupId });
      unsubGroup();
    };
  }, [groupId, uid]);

  // ─── Real-time members subscription ───────────────────────────────────
  useEffect(() => {
    if (!groupId) return;

    logger.debug("[GroupInfo] Subscribing to group members", { groupId });

    const unsubMembers = subscribeToGroupMembers(
      groupId,
      async (rawMembers) => {
        try {
          const enriched = await hydrateGroupMembersForDisplay(rawMembers);

          // Sort: owner → admin → member, then alphabetically
          const sorted = [...enriched].sort((a, b) => {
            const roleOrder: Record<GroupRole, number> = {
              owner: 0,
              admin: 1,
              member: 2,
            };
            const roleDiff = roleOrder[a.role] - roleOrder[b.role];
            if (roleDiff !== 0) return roleDiff;
            return a.displayName.localeCompare(b.displayName);
          });

          setMembers(sorted);
        } catch (err) {
          logger.error("[GroupInfo] Failed to hydrate members", err);
          // Still show raw members without hydration
          setMembers(rawMembers);
        }
      },
    );

    return () => {
      logger.debug("[GroupInfo] Unsubscribing from members", { groupId });
      unsubMembers();
    };
  }, [groupId]);

  // ─── Derived state ────────────────────────────────────────────────────
  const isOwner = userRole === "owner";
  const memberCount = members.length;
  const createdDate = useMemo(() => {
    if (!group?.createdAt) return null;
    return new Date(group.createdAt).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [group?.createdAt]);

  // =====================================================================
  // ACTION HANDLERS
  // =====================================================================

  /** Change group photo — permission-gated, with upload + DB write */
  const handleChangePhoto = useCallback(async () => {
    if (!uid || !can(GroupPermission.EDIT_GROUP_PHOTO)) {
      showError("You don't have permission to change the group photo");
      return;
    }
    if (actionLockRef.current) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      actionLockRef.current = true;
      setUploadingPhoto(true);
      logger.debug("[GroupInfo] Uploading group photo", { groupId });

      const imageUri = result.assets[0].uri;
      const downloadUrl = await uploadGroupAvatarImage(groupId, imageUri);

      logger.debug("[GroupInfo] Upload complete, updating group doc", {
        groupId,
      });
      await updateGroupPhoto(groupId, uid, downloadUrl);

      // No need to setGroup — real-time subscription will pick it up
      showSuccess("Group photo updated");
      logger.debug("[GroupInfo] Group photo updated successfully", { groupId });
    } catch (err: any) {
      logger.error("[GroupInfo] Failed to update group photo", {
        groupId,
        error: err.message,
      });
      showErrorWithRetry(
        err.message || "Failed to update group photo",
        handleChangePhoto,
      );
    } finally {
      setUploadingPhoto(false);
      actionLockRef.current = false;
    }
  }, [uid, groupId, can, showSuccess, showErrorWithRetry]);

  /** Update group name */
  const handleUpdateName = useCallback(async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed || !uid) return;
    if (actionLockRef.current) return;

    actionLockRef.current = true;
    setActionLoading(true);

    try {
      logger.debug("[GroupInfo] Updating group name", {
        groupId,
        newName: trimmed,
      });
      await updateGroupName(groupId, uid, trimmed);
      setEditNameVisible(false);
      showSuccess("Group name updated");
    } catch (err: any) {
      logger.error("[GroupInfo] Failed to update name", {
        groupId,
        error: err.message,
      });
      showError(err.message || "Failed to update group name");
    } finally {
      setActionLoading(false);
      actionLockRef.current = false;
    }
  }, [newGroupName, uid, groupId, showSuccess, showError]);

  /** Leave group (non-owners) */
  const confirmLeaveGroup = useCallback(async () => {
    if (actionLockRef.current || !uid) return;

    actionLockRef.current = true;
    setLeaveConfirmVisible(false);
    setActionLoading(true);

    try {
      logger.debug("[GroupInfo] Leaving group", { groupId, uid });
      isDismissingRef.current = true;
      await leaveGroup(groupId, uid);
      showSuccess("You left the group");
      navigation.navigate("MainTabs", {
        screen: "Messages",
        params: { screen: "ChatList" },
      });
    } catch (err: any) {
      logger.error("[GroupInfo] Failed to leave group", {
        groupId,
        error: err.message,
      });
      showError(err.message || "Failed to leave group");
      setActionLoading(false);
    } finally {
      actionLockRef.current = false;
    }
  }, [groupId, uid, navigation, showSuccess, showError]);

  /** Delete group (owner only) */
  const confirmDeleteGroup = useCallback(async () => {
    if (actionLockRef.current || !uid) return;

    actionLockRef.current = true;
    setDeleteConfirmVisible(false);
    setActionLoading(true);

    try {
      logger.debug("[GroupInfo] Deleting group", { groupId, uid });
      isDismissingRef.current = true;
      await deleteGroup(groupId, uid);
      showSuccess("Group deleted");
      navigation.navigate("MainTabs", {
        screen: "Messages",
        params: { screen: "ChatList" },
      });
    } catch (err: any) {
      logger.error("[GroupInfo] Failed to delete group", {
        groupId,
        error: err.message,
      });
      showError(err.message || "Failed to delete group");
      setActionLoading(false);
    } finally {
      actionLockRef.current = false;
    }
  }, [groupId, uid, navigation, showSuccess, showError]);

  /** Remove a member */
  const confirmRemoveMember = useCallback(async () => {
    if (!memberToRemove || !uid || actionLockRef.current) return;

    actionLockRef.current = true;
    setActionLoading(true);

    try {
      logger.debug("[GroupInfo] Removing member", {
        groupId,
        target: memberToRemove.uid,
      });
      await removeMember(groupId, uid, memberToRemove.uid);
      showSuccess(`${memberToRemove.displayName} removed from group`);
      setRemoveConfirmVisible(false);
      setMemberToRemove(null);
    } catch (err: any) {
      logger.error("[GroupInfo] Failed to remove member", {
        groupId,
        target: memberToRemove.uid,
        error: err.message,
      });
      showError(err.message || "Failed to remove member");
    } finally {
      setActionLoading(false);
      actionLockRef.current = false;
    }
  }, [memberToRemove, uid, groupId, showSuccess, showError]);

  /** Change member role */
  const handleChangeRole = useCallback(
    async (member: GroupMember, newRole: GroupRole) => {
      if (!uid || actionLockRef.current) return;

      actionLockRef.current = true;
      setMenuVisible(null);

      try {
        logger.debug("[GroupInfo] Changing role", {
          groupId,
          target: member.uid,
          newRole,
        });
        await changeMemberRole(groupId, uid, member.uid, newRole);
        showSuccess(
          `${member.displayName} is now ${newRole === "admin" ? "an admin" : "a member"}`,
        );
      } catch (err: any) {
        logger.error("[GroupInfo] Failed to change role", {
          groupId,
          target: member.uid,
          error: err.message,
        });
        showError(err.message || "Failed to change role");
      } finally {
        actionLockRef.current = false;
      }
    },
    [uid, groupId, showSuccess, showError],
  );

  /** Load friends eligible for invitation */
  const loadInvitableFriends = useCallback(async () => {
    if (!uid) return;

    setInviteLoading(true);
    try {
      const friendsData = await getFriends(uid);
      const memberUids = new Set(members.map((m) => m.uid));

      const friendsWithProfiles = await Promise.all(
        friendsData.map(async (friend) => {
          const friendUid = friend.users.find((u: string) => u !== uid);
          if (!friendUid || memberUids.has(friendUid)) return null;

          const profile = await getUserProfileByUid(friendUid);
          if (!profile) return null;

          return {
            uid: friendUid,
            displayName: profile.displayName,
            username: profile.username,
            avatarConfig: profile.avatarConfig,
            profilePictureUrl: profile.profilePicture?.url || null,
            decorationId: profile.avatarDecoration?.decorationId || null,
          };
        }),
      );

      setInvitableFriends(
        friendsWithProfiles.filter(
          (f): f is NonNullable<typeof f> => f !== null,
        ),
      );
    } catch (err) {
      logger.error("[GroupInfo] Error loading invitable friends", err);
      showError("Failed to load friends");
    } finally {
      setInviteLoading(false);
    }
  }, [uid, members, showError]);

  /** Send invite to a friend */
  const handleInviteFriend = useCallback(
    async (friend: any) => {
      if (!uid || !group) return;

      try {
        await sendGroupInvite(groupId, group.name, uid, friend.uid);
        showSuccess(`Invite sent to ${friend.displayName}`);
        setInvitableFriends((prev) => prev.filter((f) => f.uid !== friend.uid));
      } catch (err: any) {
        logger.error("[GroupInfo] Failed to send invite", {
          target: friend.uid,
          error: err.message,
        });
        showError(err.message || "Failed to send invite");
      }
    },
    [uid, group, groupId, showSuccess, showError],
  );

  // =====================================================================
  // MEMBER ROW RENDER
  // =====================================================================

  const renderMember = useCallback(
    (member: GroupMember) => {
      const isCurrentUser = member.uid === uid;
      const canKick =
        !isCurrentUser &&
        member.role !== "owner" &&
        canOverTarget(member.role, GroupPermission.KICK_MEMBERS);
      const canChangeRoles =
        !isCurrentUser &&
        member.role !== "owner" &&
        canOverTarget(member.role, GroupPermission.MANAGE_ROLES);
      const canManage = canKick || canChangeRoles;

      return (
        <Pressable
          key={member.uid}
          style={({ pressed }) => [
            styles.memberItem,
            {
              backgroundColor: pressed ? colors.surfaceVariant : "transparent",
            },
          ]}
          onPress={() => {
            if (!isCurrentUser) {
              navigation.navigate("UserProfile", { userId: member.uid });
            }
          }}
        >
          <View style={styles.memberLeft}>
            <ProfilePictureWithDecoration
              pictureUrl={member.profilePictureUrl}
              name={member.displayName}
              decorationId={member.decorationId}
              size={44}
            />
            <View style={styles.memberInfo}>
              <View style={styles.memberNameRow}>
                <Text
                  style={[styles.memberName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {member.displayName}
                </Text>
                {isCurrentUser && (
                  <Text
                    style={[styles.youLabel, { color: colors.textSecondary }]}
                  >
                    {" "}
                    (You)
                  </Text>
                )}
              </View>
              <Text
                style={[styles.memberUsername, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                @{member.username}
              </Text>
            </View>
          </View>

          <View style={styles.memberRight}>
            {member.role !== "member" && (
              <View
                style={[
                  styles.roleBadge,
                  member.role === "owner"
                    ? { backgroundColor: colors.primary + "20" }
                    : { backgroundColor: colors.success + "20" },
                ]}
              >
                <MaterialCommunityIcons
                  name={member.role === "owner" ? "crown" : "shield-account"}
                  size={12}
                  color={
                    member.role === "owner" ? colors.primary : colors.success
                  }
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.roleBadgeText,
                    {
                      color:
                        member.role === "owner"
                          ? colors.primary
                          : colors.success,
                    },
                  ]}
                >
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
                    iconColor={colors.textSecondary}
                    onPress={() => setMenuVisible(member.uid)}
                  />
                }
                contentStyle={{
                  backgroundColor: colors.surface,
                  borderRadius: BorderRadius.md,
                }}
              >
                {canChangeRoles && (
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
                {canKick && (
                  <Menu.Item
                    title="Remove from Group"
                    leadingIcon="account-remove"
                    titleStyle={{ color: colors.error }}
                    onPress={() => {
                      setMemberToRemove(member);
                      setRemoveConfirmVisible(true);
                      setMenuVisible(null);
                    }}
                  />
                )}
              </Menu>
            )}
          </View>
        </Pressable>
      );
    },
    [uid, colors, menuVisible, canOverTarget, navigation, handleChangeRole],
  );

  // =====================================================================
  // LOADING & ERROR STATES
  // =====================================================================

  if (loading || permLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["bottom"]}
      >
        <Appbar.Header
          style={{ backgroundColor: colors.background }}
          elevated={false}
        >
          <Appbar.BackAction
            onPress={() => navigation.goBack()}
            iconColor={colors.text}
          />
          <Appbar.Content
            title="Group Info"
            titleStyle={{ color: colors.text }}
          />
        </Appbar.Header>
        <LoadingState message="Loading group info..." />
      </SafeAreaView>
    );
  }

  if (error || !group) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["bottom"]}
      >
        <Appbar.Header
          style={{ backgroundColor: colors.background }}
          elevated={false}
        >
          <Appbar.BackAction
            onPress={() => navigation.goBack()}
            iconColor={colors.text}
          />
          <Appbar.Content
            title="Group Info"
            titleStyle={{ color: colors.text }}
          />
        </Appbar.Header>
        <ErrorState
          message={error || "Group not found"}
          onRetry={() => navigation.goBack()}
          retryLabel="Go Back"
        />
      </SafeAreaView>
    );
  }

  // =====================================================================
  // MAIN RENDER
  // =====================================================================

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["bottom"]}
    >
      {/* ── Header ──────────────────────────────────────────────────── */}
      <Appbar.Header
        style={{ backgroundColor: colors.background }}
        elevated={false}
      >
        <Appbar.BackAction
          onPress={() => navigation.goBack()}
          iconColor={colors.text}
        />
        <Appbar.Content
          title="Group Info"
          titleStyle={{ color: colors.text }}
        />
      </Appbar.Header>

      {/* ── Action loading overlay ──────────────────────────────────── */}
      {actionLoading && (
        <View style={styles.actionOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           *  HERO SECTION — Group identity
           * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <View
            style={[
              styles.heroCard,
              { backgroundColor: colors.surface },
              Elevation.sm,
            ]}
          >
            {/* Group Avatar */}
            <TouchableOpacity
              onPress={handleChangePhoto}
              disabled={
                uploadingPhoto || !can(GroupPermission.EDIT_GROUP_PHOTO)
              }
              activeOpacity={0.7}
              style={styles.heroAvatarContainer}
            >
              {group.avatarUrl ? (
                <AppImage
                  source={{ uri: group.avatarUrl }}
                  style={styles.heroAvatarImage}
                  debugLabel="GroupInfoHeroAvatar"
                />
              ) : (
                <View
                  style={[
                    styles.heroAvatarFallback,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="account-group"
                    size={56}
                    color={colors.primary}
                  />
                </View>
              )}
              {uploadingPhoto && (
                <View style={styles.heroAvatarOverlay}>
                  <ActivityIndicator size="small" color="#FFF" />
                </View>
              )}
              {can(GroupPermission.EDIT_GROUP_PHOTO) && !uploadingPhoto && (
                <View
                  style={[
                    styles.editPhotoBadge,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="camera"
                    size={18}
                    color="#FFF"
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* Group Name + Edit */}
            <View style={styles.heroNameRow}>
              <Text style={[styles.heroName, { color: colors.text }]}>
                {group.name}
              </Text>
              {can(GroupPermission.EDIT_GROUP_NAME) && (
                <IconButton
                  icon="pencil"
                  size={18}
                  iconColor={colors.textSecondary}
                  onPress={() => {
                    setNewGroupName(group.name);
                    setEditNameVisible(true);
                  }}
                  style={styles.editNameButton}
                />
              )}
            </View>

            {/* Meta info */}
            <Text style={[styles.heroMeta, { color: colors.textSecondary }]}>
              {memberCount} {memberCount === 1 ? "member" : "members"}
              {createdDate && `  •  Created ${createdDate}`}
            </Text>
          </View>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           *  QUICK ACTIONS
           * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: colors.surface },
              Elevation.sm,
            ]}
          >
            <TouchableOpacity
              style={styles.actionRow}
              activeOpacity={0.6}
              onPress={() =>
                navigation.navigate("ChatSettings", {
                  groupId,
                  chatType: "group",
                  chatName: group.name,
                })
              }
            >
              <View
                style={[
                  styles.actionIconContainer,
                  { backgroundColor: colors.primary + "15" },
                ]}
              >
                <MaterialCommunityIcons
                  name="bell-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <Text style={[styles.actionRowText, { color: colors.text }]}>
                Notifications & Settings
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={colors.textSecondary}
              />
            </TouchableOpacity>

            {can(GroupPermission.MANAGE_PERMISSIONS) && (
              <>
                <View
                  style={[
                    styles.actionDivider,
                    { backgroundColor: colors.border },
                  ]}
                />
                <TouchableOpacity
                  style={styles.actionRow}
                  activeOpacity={0.6}
                  onPress={() =>
                    navigation.navigate("GroupPermissions", { groupId })
                  }
                >
                  <View
                    style={[
                      styles.actionIconContainer,
                      { backgroundColor: colors.primary + "15" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="shield-key-outline"
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={[styles.actionRowText, { color: colors.text }]}>
                    Admin Permissions
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={22}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           *  MEMBERS SECTION
           * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: colors.surface },
              Elevation.sm,
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Members
              </Text>
              <Text
                style={[styles.sectionBadge, { color: colors.textSecondary }]}
              >
                {memberCount}
              </Text>
            </View>

            {/* Invite button */}
            {can(GroupPermission.MANAGE_INVITES) &&
              memberCount < GROUP_LIMITS.MAX_MEMBERS && (
                <TouchableOpacity
                  style={[
                    styles.inviteRow,
                    { borderBottomColor: colors.border },
                  ]}
                  activeOpacity={0.6}
                  onPress={() => {
                    loadInvitableFriends();
                    setInviteModalVisible(true);
                  }}
                >
                  <View
                    style={[
                      styles.inviteIconContainer,
                      { backgroundColor: colors.primary + "15" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="account-plus"
                      size={22}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={[styles.inviteText, { color: colors.primary }]}>
                    Invite Friends
                  </Text>
                </TouchableOpacity>
              )}

            {/* Member list */}
            {members.map(renderMember)}
          </View>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           *  DANGER ZONE
           * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <View
            style={[
              styles.sectionCard,
              styles.dangerCard,
              { backgroundColor: colors.surface },
              Elevation.sm,
            ]}
          >
            {!isOwner && (
              <TouchableOpacity
                style={styles.dangerRow}
                activeOpacity={0.6}
                onPress={() => setLeaveConfirmVisible(true)}
                disabled={actionLoading}
              >
                <MaterialCommunityIcons
                  name="logout"
                  size={22}
                  color={colors.error}
                />
                <Text style={[styles.dangerRowText, { color: colors.error }]}>
                  Leave Group
                </Text>
              </TouchableOpacity>
            )}

            {isOwner && (
              <>
                {/* Owners can't leave, but add visual separation if delete is present */}
                <TouchableOpacity
                  style={styles.dangerRow}
                  activeOpacity={0.6}
                  onPress={() => setDeleteConfirmVisible(true)}
                  disabled={actionLoading}
                >
                  <MaterialCommunityIcons
                    name="delete-outline"
                    size={22}
                    color={colors.error}
                  />
                  <Text style={[styles.dangerRowText, { color: colors.error }]}>
                    Delete Group
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Bottom spacer */}
          <View style={{ height: Spacing.xxl }} />
        </ScrollView>
      </Animated.View>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       *  MODALS
       * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Portal>
        {/* Edit Name Modal */}
        <Modal
          visible={editNameVisible}
          onDismiss={() => setEditNameVisible(false)}
          contentContainerStyle={[
            styles.modalCard,
            { backgroundColor: colors.surface },
          ]}
        >
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            Edit Group Name
          </Text>
          <TextInput
            mode="outlined"
            value={newGroupName}
            onChangeText={setNewGroupName}
            maxLength={GROUP_LIMITS.MAX_NAME_LENGTH}
            style={[styles.modalInput, { backgroundColor: colors.background }]}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            textColor={colors.text}
            autoFocus
          />
          <Text style={[styles.charCount, { color: colors.textSecondary }]}>
            {newGroupName.length}/{GROUP_LIMITS.MAX_NAME_LENGTH}
          </Text>
          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={() => setEditNameVisible(false)}
              textColor={colors.textSecondary}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleUpdateName}
              loading={actionLoading}
              disabled={
                !newGroupName.trim() ||
                newGroupName.trim() === group.name ||
                actionLoading
              }
              buttonColor={colors.primary}
              textColor={colors.textOnPrimary}
            >
              Save
            </Button>
          </View>
        </Modal>

        {/* Invite Friends Modal */}
        <Modal
          visible={inviteModalVisible}
          onDismiss={() => setInviteModalVisible(false)}
          contentContainerStyle={[
            styles.inviteModalCard,
            {
              backgroundColor: colors.surface,
              maxHeight: windowHeight * 0.75,
            },
          ]}
        >
          {/* Fixed header */}
          <View style={styles.inviteModalHeader}>
            <Text style={[styles.inviteModalTitle, { color: colors.text }]}>
              Invite Friends
            </Text>
            <Text
              style={[
                styles.inviteModalSubtitle,
                { color: colors.textSecondary },
              ]}
            >
              {memberCount}/{GROUP_LIMITS.MAX_MEMBERS} members
            </Text>
          </View>

          {/* Divider below header */}
          <View
            style={[
              styles.inviteHeaderDivider,
              { backgroundColor: colors.border },
            ]}
          />

          {/* Content area — flexes to fill available space */}
          {inviteLoading ? (
            <View style={styles.inviteLoadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                style={[
                  styles.inviteLoadingText,
                  { color: colors.textSecondary },
                ]}
              >
                Loading friends...
              </Text>
            </View>
          ) : invitableFriends.length === 0 ? (
            <View style={styles.emptyInviteContainer}>
              <MaterialCommunityIcons
                name="account-search"
                size={48}
                color={colors.textSecondary}
              />
              <Text
                style={[
                  styles.emptyInviteText,
                  { color: colors.textSecondary },
                ]}
              >
                No friends available to invite
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.inviteFriendsList}
              contentContainerStyle={styles.inviteFriendsListContent}
              showsVerticalScrollIndicator={true}
              bounces={false}
            >
              {invitableFriends.map((item) => (
                <View
                  key={item.uid}
                  style={[
                    styles.inviteFriendItem,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <View style={styles.inviteFriendLeft}>
                    <ProfilePictureWithDecoration
                      pictureUrl={item.profilePictureUrl}
                      name={item.displayName}
                      decorationId={item.decorationId}
                      size={40}
                    />
                    <View style={styles.inviteFriendInfo}>
                      <Text
                        style={[
                          styles.inviteFriendName,
                          { color: colors.text },
                        ]}
                        numberOfLines={1}
                      >
                        {item.displayName}
                      </Text>
                      <Text
                        style={[
                          styles.inviteFriendUsername,
                          { color: colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        @{item.username}
                      </Text>
                    </View>
                  </View>
                  <Button
                    mode="contained"
                    onPress={() => handleInviteFriend(item)}
                    buttonColor={colors.primary}
                    textColor={colors.textOnPrimary}
                    style={styles.inviteButton}
                    labelStyle={styles.inviteButtonLabel}
                    compact
                  >
                    Invite
                  </Button>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Fixed footer */}
          <View
            style={[
              styles.inviteFooterDivider,
              { backgroundColor: colors.border },
            ]}
          />
          <Button
            mode="text"
            onPress={() => setInviteModalVisible(false)}
            textColor={colors.textSecondary}
            style={styles.closeModalButton}
          >
            Close
          </Button>
        </Modal>

        {/* Leave Confirmation */}
        <Modal
          visible={leaveConfirmVisible}
          onDismiss={() => setLeaveConfirmVisible(false)}
          contentContainerStyle={[
            styles.modalCard,
            { backgroundColor: colors.surface },
          ]}
        >
          <View style={styles.confirmIconContainer}>
            <MaterialCommunityIcons
              name="logout"
              size={32}
              color={colors.error}
            />
          </View>
          <Text
            style={[
              styles.modalTitle,
              styles.modalTitleCenter,
              { color: colors.text },
            ]}
          >
            Leave Group?
          </Text>
          <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
            You will no longer receive messages from this group. You'll need a
            new invite to rejoin.
          </Text>
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setLeaveConfirmVisible(false)}
              textColor={colors.textSecondary}
              style={[
                styles.modalButtonOutlined,
                { borderColor: colors.border },
              ]}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={confirmLeaveGroup}
              buttonColor={colors.error}
              textColor="#FFF"
              loading={actionLoading}
              disabled={actionLoading}
              style={styles.modalButtonFilled}
            >
              Leave
            </Button>
          </View>
        </Modal>

        {/* Remove Member Confirmation */}
        <Modal
          visible={removeConfirmVisible}
          onDismiss={() => {
            setRemoveConfirmVisible(false);
            setMemberToRemove(null);
          }}
          contentContainerStyle={[
            styles.modalCard,
            { backgroundColor: colors.surface },
          ]}
        >
          <View style={styles.confirmIconContainer}>
            <MaterialCommunityIcons
              name="account-remove"
              size={32}
              color={colors.error}
            />
          </View>
          <Text
            style={[
              styles.modalTitle,
              styles.modalTitleCenter,
              { color: colors.text },
            ]}
          >
            Remove Member?
          </Text>
          <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
            {memberToRemove
              ? `${memberToRemove.displayName} will be removed from the group and won't be able to see new messages.`
              : "This member will be removed from the group."}
          </Text>
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setRemoveConfirmVisible(false);
                setMemberToRemove(null);
              }}
              textColor={colors.textSecondary}
              style={[
                styles.modalButtonOutlined,
                { borderColor: colors.border },
              ]}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={confirmRemoveMember}
              buttonColor={colors.error}
              textColor="#FFF"
              loading={actionLoading}
              disabled={actionLoading}
              style={styles.modalButtonFilled}
            >
              Remove
            </Button>
          </View>
        </Modal>

        {/* Delete Group Confirmation */}
        <Modal
          visible={deleteConfirmVisible}
          onDismiss={() => setDeleteConfirmVisible(false)}
          contentContainerStyle={[
            styles.modalCard,
            { backgroundColor: colors.surface },
          ]}
        >
          <View style={styles.confirmIconContainer}>
            <MaterialCommunityIcons
              name="delete-alert"
              size={32}
              color={colors.error}
            />
          </View>
          <Text
            style={[
              styles.modalTitle,
              styles.modalTitleCenter,
              { color: colors.text },
            ]}
          >
            Delete Group?
          </Text>
          <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
            This action cannot be undone. All messages, members, and group data
            will be permanently removed.
          </Text>
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setDeleteConfirmVisible(false)}
              textColor={colors.textSecondary}
              style={[
                styles.modalButtonOutlined,
                { borderColor: colors.border },
              ]}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={confirmDeleteGroup}
              buttonColor={colors.error}
              textColor="#FFF"
              loading={actionLoading}
              disabled={actionLoading}
              style={styles.modalButtonFilled}
            >
              Delete Forever
            </Button>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },

  // ── Action overlay ──────────────────────────────────────────────────
  actionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Hero Card ───────────────────────────────────────────────────────
  heroCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  heroAvatarContainer: {
    position: "relative",
    marginBottom: Spacing.lg,
  },
  heroAvatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  heroAvatarFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  heroAvatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 60,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  editPhotoBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    borderRadius: BorderRadius.full,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  heroNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  heroName: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    textAlign: "center",
    flexShrink: 1,
  },
  editNameButton: {
    marginLeft: Spacing.xs,
    marginRight: -Spacing.sm,
  },
  heroMeta: {
    fontSize: FontSizes.sm,
    textAlign: "center",
  },

  // ── Section Cards ───────────────────────────────────────────────────
  sectionCard: {
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    flex: 1,
  },
  sectionBadge: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },

  // ── Action Rows ─────────────────────────────────────────────────────
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
  },
  actionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  actionRowText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
    flex: 1,
  },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.lg + 36 + Spacing.md,
    marginRight: Spacing.lg,
  },

  // ── Invite Row ──────────────────────────────────────────────────────
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inviteIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  inviteText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },

  // ── Member Items ────────────────────────────────────────────────────
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  memberLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  memberInfo: {
    marginLeft: Spacing.md,
    flex: 1,
    minWidth: 0,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  memberName: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    flexShrink: 1,
  },
  youLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.regular,
  },
  memberUsername: {
    fontSize: FontSizes.sm,
    marginTop: 1,
  },
  memberRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  roleBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
  },

  // ── Danger Zone ─────────────────────────────────────────────────────
  dangerCard: {
    marginTop: Spacing.sm,
  },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  dangerRowText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },

  // ── Modals ──────────────────────────────────────────────────────────
  modalCard: {
    marginHorizontal: Spacing.xl,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    marginBottom: Spacing.lg,
  },
  modalTitleCenter: {
    textAlign: "center",
  },
  modalInput: {
    marginBottom: Spacing.xs,
  },
  charCount: {
    fontSize: FontSizes.xs,
    textAlign: "right",
    marginBottom: Spacing.md,
  },
  modalMessage: {
    fontSize: FontSizes.md,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.md,
  },
  modalButtonOutlined: {
    flex: 1,
    borderRadius: BorderRadius.md,
  },
  modalButtonFilled: {
    flex: 1,
    borderRadius: BorderRadius.md,
  },
  confirmIconContainer: {
    alignSelf: "center",
    marginBottom: Spacing.lg,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Invite Modal ────────────────────────────────────────────────────
  inviteModalCard: {
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  inviteModalHeader: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  inviteModalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  inviteModalSubtitle: {
    fontSize: FontSizes.sm,
    textAlign: "center",
  },
  inviteHeaderDivider: {
    height: StyleSheet.hairlineWidth,
  },
  inviteLoadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  inviteLoadingText: {
    marginTop: Spacing.lg,
    fontSize: FontSizes.md,
  },
  emptyInviteContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyInviteText: {
    fontSize: FontSizes.md,
    textAlign: "center",
  },
  inviteFriendsList: {
    flexGrow: 0,
    flexShrink: 1,
  },
  inviteFriendsListContent: {
    paddingHorizontal: Spacing.lg,
  },
  inviteFriendItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inviteFriendLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    gap: Spacing.md,
  },
  inviteFriendInfo: {
    flex: 1,
    minWidth: 0,
  },
  inviteFriendName: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  inviteFriendUsername: {
    fontSize: FontSizes.sm,
    marginTop: 1,
  },
  inviteButton: {
    borderRadius: BorderRadius.xl,
    marginLeft: Spacing.sm,
  },
  inviteButtonLabel: {
    fontWeight: FontWeights.semibold,
    fontSize: FontSizes.sm,
  },
  inviteFooterDivider: {
    height: StyleSheet.hairlineWidth,
  },
  closeModalButton: {
    paddingVertical: Spacing.sm,
    alignSelf: "center",
  },
});
