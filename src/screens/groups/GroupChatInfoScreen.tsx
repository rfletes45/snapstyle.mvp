/**
 * GroupChatInfoScreen — V2 Redesign
 *
 * Modern group hub with:
 * - Compact hero with settings gear in header
 * - Live voice room module
 * - Shared content browser entry
 * - Collapsible members preview
 * - Clean danger zone
 *
 * Architecture:
 * - Real-time subscriptions for group + members
 * - useGroupPermissions for reactive capability checks
 * - useVoiceRoomOccupancy for live room state
 * - Modular card-based layout
 */

import { AppImage } from "@/components/AppImage";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { ProfilePicture } from "@/components/profile/ProfilePicture/ProfilePicture";
import { ErrorState, LoadingState } from "@/components/ui";
import { CALL_FEATURES } from "@/constants/featureFlags";
import {
  BorderRadius,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/theme";
import { useStreamCall } from "@/contexts/StreamCallContext";
import {
  useGroupContentBrowser,
  type ContentTab,
} from "@/hooks/useGroupContentBrowser";
import { useGroupPermissions } from "@/hooks/useGroupPermissions";
import { useVoiceRoomOccupancy } from "@/hooks/useVoiceRoomOccupancy";
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
import { getVoiceChannelId } from "@/services/stream/voiceChannelIds";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useColors } from "@/store/ThemeContext";
import { Group, GROUP_LIMITS, GroupMember, GroupRole } from "@/types/models";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { StackActions } from "@react-navigation/native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Linking,
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
  Searchbar,
  Text,
  TextInput,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/groups/GroupChatInfoScreen");

const MEMBER_PREVIEW_LIMIT = 5;

type InfoTab = "members" | ContentTab;

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_COLUMNS = 3;
const GRID_GAP = 2;
const GRID_ITEM_SIZE =
  (SCREEN_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

const INFO_TABS: { key: InfoTab; label: string; icon: string }[] = [
  { key: "members", label: "Members", icon: "account-group" },
  { key: "media", label: "Media", icon: "image-multiple" },
  { key: "messages", label: "Messages", icon: "message-text" },
  { key: "links", label: "Links", icon: "link-variant" },
];

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

  // ─── Members expansion ────────────────────────────────────────────────
  const [membersExpanded, setMembersExpanded] = useState(false);

  // ─── Info tab state (Members / Media / Messages / Links) ──────────────
  const [activeInfoTab, setActiveInfoTab] = useState<InfoTab>("members");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const browser = useGroupContentBrowser(groupId);

  // ─── Permissions (reactive) ───────────────────────────────────────────
  const {
    can,
    canOverTarget,
    role: userRole,
    loading: permLoading,
  } = useGroupPermissions(groupId);

  // ─── Voice Room ───────────────────────────────────────────────────────
  const voiceRoom = useVoiceRoomOccupancy(groupId);
  const { activeSession, isBusy, joinChannel } = CALL_FEATURES.CALLS_ENABLED
    ? useStreamCall()
    : { activeSession: null, isBusy: false, joinChannel: async () => {} };
  const channelId = getVoiceChannelId(groupId);
  const isCurrentUserInRoom =
    activeSession?.type === "voice_channel" &&
    activeSession.channelId === channelId;

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

  // Pulse animation for live voice indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (voiceRoom.isActive) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [voiceRoom.isActive]);

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

  const visibleMembers = useMemo(() => {
    if (membersExpanded) return members;
    return members.slice(0, MEMBER_PREVIEW_LIMIT);
  }, [members, membersExpanded]);

  const hiddenMemberCount = memberCount - MEMBER_PREVIEW_LIMIT;

  // Search-filtered members
  const filteredMembers = useMemo(() => {
    if (!memberSearchQuery.trim())
      return membersExpanded ? members : visibleMembers;
    const q = memberSearchQuery.toLowerCase().trim();
    return members.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.username?.toLowerCase().includes(q),
    );
  }, [members, memberSearchQuery, membersExpanded, visibleMembers]);

  // =====================================================================
  // ACTION HANDLERS
  // =====================================================================

  /** Pick and upload a group photo from camera or library */
  const processPhoto = useCallback(
    async (picker: () => Promise<ImagePicker.ImagePickerResult>) => {
      if (actionLockRef.current) return;
      try {
        const result = await picker();
        if (result.canceled || !result.assets?.[0]) return;

        actionLockRef.current = true;
        setUploadingPhoto(true);
        logger.debug("[GroupInfo] Uploading group photo", { groupId });

        const imageUri = result.assets[0].uri;
        const downloadUrl = await uploadGroupAvatarImage(groupId, imageUri);

        logger.debug("[GroupInfo] Upload complete, updating group doc", {
          groupId,
        });
        await updateGroupPhoto(groupId, uid!, downloadUrl);

        showSuccess("Group photo updated");
        logger.debug("[GroupInfo] Group photo updated successfully", {
          groupId,
        });
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
    },
    [uid, groupId, showSuccess, showErrorWithRetry],
  );

  /** Change group photo — permission-gated, popup to choose camera or library */
  const handleChangePhoto = useCallback(() => {
    if (!uid || !can(GroupPermission.EDIT_GROUP_PHOTO)) {
      showError("You don't have permission to change the group photo");
      return;
    }
    if (actionLockRef.current) return;

    const pickerOpts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    };

    Alert.alert("Change Group Photo", "Choose an option", [
      {
        text: "Take Photo",
        onPress: () =>
          processPhoto(() => ImagePicker.launchCameraAsync(pickerOpts)),
      },
      {
        text: "Choose from Library",
        onPress: () =>
          processPhoto(() => ImagePicker.launchImageLibraryAsync(pickerOpts)),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [uid, can, showError, processPhoto]);

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

  const handleJoinVoiceChannel = useCallback(() => {
    if (!group) return;
    navigation.navigate("VoiceChannel", {
      channelId,
      channelName: `${group.name} Voice`,
      groupId,
    });
  }, [navigation, channelId, group, groupId]);

  const navigateToGroupMessage = useCallback(
    (messageId: string) => {
      navigation.dispatch(
        StackActions.popTo(
          "GroupChat",
          {
            groupId,
            targetMessageId: messageId,
            jumpRequestId: `${messageId}:${Date.now()}`,
          },
          { merge: true },
        ),
      );
    },
    [groupId, navigation],
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
      edges={["top", "bottom"]}
    >
      {/* ── Compact header with circular icon buttons ──────────────── */}
      <View
        style={[styles.compactHeader, { backgroundColor: colors.background }]}
      >
        <TouchableOpacity
          style={[
            styles.headerCircle,
            { backgroundColor: colors.surfaceVariant },
          ]}
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={20}
            color={colors.text}
          />
        </TouchableOpacity>

        <View style={styles.headerRight}>
          {can(GroupPermission.MANAGE_PERMISSIONS) && (
            <TouchableOpacity
              style={[
                styles.headerCircle,
                { backgroundColor: colors.surfaceVariant },
              ]}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate("GroupPermissions", { groupId })
              }
              accessibilityLabel="Admin permissions"
            >
              <MaterialCommunityIcons
                name="shield-key-outline"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.headerCircle,
              { backgroundColor: colors.surfaceVariant },
            ]}
            activeOpacity={0.7}
            onPress={() =>
              navigation.navigate("ChatSettings", {
                groupId,
                chatType: "group",
                chatName: group.name,
              })
            }
            accessibilityLabel="Group settings"
          >
            <MaterialCommunityIcons
              name="cog-outline"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

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
          <View style={styles.heroCard}>
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
           *  VOICE ROOM MODULE
           * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {CALL_FEATURES.CALLS_ENABLED && (
            <View>
              <View style={styles.voiceHeader}>
                <View style={styles.voiceHeaderLeft}>
                  <MaterialCommunityIcons
                    name="headphones"
                    size={20}
                    color={
                      voiceRoom.isActive ? colors.success : colors.textSecondary
                    }
                  />
                  <Text style={[styles.voiceTitle, { color: colors.text }]}>
                    Voice Room
                  </Text>
                  {voiceRoom.isActive && (
                    <Animated.View
                      style={[
                        styles.liveDot,
                        {
                          backgroundColor: colors.success,
                          opacity: pulseAnim,
                        },
                      ]}
                    />
                  )}
                </View>
                {voiceRoom.isActive && (
                  <Text
                    style={[styles.voiceCount, { color: colors.textSecondary }]}
                  >
                    {voiceRoom.occupants.length}{" "}
                    {voiceRoom.occupants.length === 1 ? "person" : "people"}
                  </Text>
                )}
              </View>

              {voiceRoom.isActive ? (
                <>
                  {/* Occupant avatars */}
                  <View style={styles.voiceOccupants}>
                    {voiceRoom.occupants.slice(0, 6).map((occupant) => (
                      <View
                        key={occupant.userId}
                        style={styles.voiceOccupantItem}
                      >
                        <ProfilePicture
                          url={occupant.image ?? null}
                          name={occupant.name}
                          size={36}
                          showLoading={false}
                        />
                        <Text
                          style={[
                            styles.voiceOccupantName,
                            { color: colors.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {occupant.userId === uid
                            ? "You"
                            : occupant.name.split(" ")[0]}
                        </Text>
                      </View>
                    ))}
                    {voiceRoom.occupants.length > 6 && (
                      <View style={styles.voiceOccupantItem}>
                        <View
                          style={[
                            styles.voiceOverflowCircle,
                            { backgroundColor: colors.surfaceVariant },
                          ]}
                        >
                          <Text
                            style={[
                              styles.voiceOverflowText,
                              { color: colors.textSecondary },
                            ]}
                          >
                            +{voiceRoom.occupants.length - 6}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Join / Return button */}
                  <TouchableOpacity
                    style={[
                      styles.voiceJoinButton,
                      {
                        backgroundColor: isCurrentUserInRoom
                          ? colors.success + "18"
                          : colors.success,
                      },
                    ]}
                    activeOpacity={0.7}
                    onPress={handleJoinVoiceChannel}
                    disabled={isBusy && !isCurrentUserInRoom}
                  >
                    <MaterialCommunityIcons
                      name="headphones"
                      size={18}
                      color={isCurrentUserInRoom ? colors.success : "#FFF"}
                    />
                    <Text
                      style={[
                        styles.voiceJoinText,
                        {
                          color: isCurrentUserInRoom ? colors.success : "#FFF",
                        },
                      ]}
                    >
                      {isCurrentUserInRoom
                        ? "Return to Room"
                        : isBusy
                          ? "In Another Call"
                          : "Join Voice Room"}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text
                    style={[styles.voiceEmptyText, { color: colors.textMuted }]}
                  >
                    No one is in the voice room right now
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.voiceStartButton,
                      { borderColor: colors.border },
                    ]}
                    activeOpacity={0.7}
                    onPress={handleJoinVoiceChannel}
                    disabled={isBusy}
                  >
                    <MaterialCommunityIcons
                      name="headphones"
                      size={18}
                      color={isBusy ? colors.textMuted : colors.primary}
                    />
                    <Text
                      style={[
                        styles.voiceStartText,
                        {
                          color: isBusy ? colors.textMuted : colors.primary,
                        },
                      ]}
                    >
                      {isBusy ? "In Another Call" : "Start Voice Room"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           *  UNIFIED CONTENT SECTION (Members / Media / Messages / Links)
           * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <View
            style={[
              styles.contentSectionFullWidth,
              { borderTopColor: colors.border },
            ]}
          >
            {/* Tab bar */}
            <View
              style={[styles.infoTabBar, { borderBottomColor: colors.border }]}
            >
              {INFO_TABS.map((tab) => {
                const isActive = activeInfoTab === tab.key;
                const count =
                  tab.key === "members"
                    ? memberCount
                    : (browser.counts[tab.key as keyof typeof browser.counts] ??
                      0);
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.infoTab,
                      isActive && {
                        borderBottomColor: colors.primary,
                        borderBottomWidth: 2,
                      },
                    ]}
                    onPress={() => {
                      setActiveInfoTab(tab.key);
                      if (tab.key !== "members") {
                        browser.setActiveTab(
                          tab.key as "media" | "messages" | "links",
                        );
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={tab.icon as any}
                      size={16}
                      color={isActive ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.infoTabLabel,
                        {
                          color: isActive
                            ? colors.primary
                            : colors.textSecondary,
                          fontWeight: isActive
                            ? FontWeights.semibold
                            : FontWeights.regular,
                        },
                      ]}
                    >
                      {tab.label}
                    </Text>
                    {count > 0 && (
                      <Text
                        style={[
                          styles.infoTabCount,
                          {
                            color: isActive ? colors.primary : colors.textMuted,
                          },
                        ]}
                      >
                        {count > 999 ? "999+" : count}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Search bar */}
            <View style={styles.infoSearchContainer}>
              <Searchbar
                placeholder={
                  activeInfoTab === "members"
                    ? "Search members..."
                    : `Search ${activeInfoTab}...`
                }
                onChangeText={
                  activeInfoTab === "members"
                    ? setMemberSearchQuery
                    : browser.setSearchQuery
                }
                value={
                  activeInfoTab === "members"
                    ? memberSearchQuery
                    : browser.searchQuery
                }
                style={[
                  styles.infoSearchBar,
                  { backgroundColor: colors.background },
                ]}
                inputStyle={[styles.infoSearchInput, { color: colors.text }]}
                iconColor={colors.textSecondary}
                placeholderTextColor={colors.textMuted}
                elevation={0}
              />
            </View>

            {/* Divider after search bar */}
            <View
              style={[
                styles.infoSearchDivider,
                { backgroundColor: colors.border },
              ]}
            />

            {/* ─── Members tab content ───────────────────────────────── */}
            {activeInfoTab === "members" && (
              <View>
                {/* Invite button */}
                {can(GroupPermission.MANAGE_INVITES) &&
                  memberCount < GROUP_LIMITS.MAX_MEMBERS && (
                    <TouchableOpacity
                      style={styles.inviteRow}
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
                      <Text
                        style={[styles.inviteText, { color: colors.primary }]}
                      >
                        Invite Friends
                      </Text>
                    </TouchableOpacity>
                  )}

                {/* Member list */}
                {filteredMembers.map(renderMember)}

                {/* See all / collapse (only when not searching) */}
                {!memberSearchQuery.trim() &&
                  memberCount > MEMBER_PREVIEW_LIMIT && (
                    <TouchableOpacity
                      style={[
                        styles.seeAllRow,
                        { borderTopColor: colors.border },
                      ]}
                      activeOpacity={0.6}
                      onPress={() => setMembersExpanded(!membersExpanded)}
                    >
                      <Text
                        style={[styles.seeAllText, { color: colors.primary }]}
                      >
                        {membersExpanded
                          ? "Show less"
                          : `See all ${memberCount} members`}
                      </Text>
                      <MaterialCommunityIcons
                        name={membersExpanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  )}

                {/* Empty state for member search */}
                {memberSearchQuery.trim() && filteredMembers.length === 0 && (
                  <View style={styles.inlineEmptyContainer}>
                    <MaterialCommunityIcons
                      name="account-search-outline"
                      size={40}
                      color={colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.inlineEmptyText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      No members match "{memberSearchQuery}"
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ─── Media tab content ─────────────────────────────────── */}
            {activeInfoTab === "media" && (
              <View>
                {browser.loading ? (
                  <View style={styles.inlineLoadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                ) : browser.mediaItems.length === 0 ? (
                  <View style={styles.inlineEmptyContainer}>
                    <MaterialCommunityIcons
                      name={
                        browser.searchQuery.trim()
                          ? "image-search-outline"
                          : "image-off-outline"
                      }
                      size={40}
                      color={colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.inlineEmptyText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {browser.searchQuery.trim()
                        ? "No media found"
                        : "No shared media yet"}
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.mediaGrid}>
                      {browser.mediaItems.map((item) => {
                        const imageSource =
                          item.thumbUrl || item.remoteUrl || item.localUri;
                        const isVideo = item.kind === "video";
                        return (
                          <TouchableOpacity
                            key={item.attachmentId}
                            style={[
                              styles.mediaGridItem,
                              {
                                backgroundColor: colors.surfaceVariant,
                              },
                            ]}
                            activeOpacity={0.8}
                            onPress={() =>
                              navigateToGroupMessage(item.messageId)
                            }
                          >
                            {imageSource ? (
                              <AppImage
                                source={{ uri: imageSource }}
                                style={styles.mediaGridImage}
                                debugLabel="GroupMediaThumb"
                              />
                            ) : (
                              <View
                                style={[
                                  styles.mediaGridPlaceholder,
                                  {
                                    backgroundColor: colors.surfaceVariant,
                                  },
                                ]}
                              >
                                <MaterialCommunityIcons
                                  name={
                                    isVideo ? "video-outline" : "image-outline"
                                  }
                                  size={24}
                                  color={colors.textMuted}
                                />
                              </View>
                            )}
                            {isVideo && (
                              <View style={styles.mediaVideoBadge}>
                                <MaterialCommunityIcons
                                  name="play-circle"
                                  size={20}
                                  color="#FFF"
                                />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {browser.hasMore && (
                      <TouchableOpacity
                        style={[
                          styles.loadMoreRow,
                          { borderTopColor: colors.border },
                        ]}
                        activeOpacity={0.6}
                        onPress={browser.loadMore}
                      >
                        {browser.loadingMore ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.primary}
                          />
                        ) : (
                          <Text
                            style={[
                              styles.loadMoreText,
                              { color: colors.primary },
                            ]}
                          >
                            Load more media
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}

            {/* ─── Messages tab content ──────────────────────────────── */}
            {activeInfoTab === "messages" && (
              <View>
                {browser.loading ? (
                  <View style={styles.inlineLoadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                ) : browser.messageItems.length === 0 ? (
                  <View style={styles.inlineEmptyContainer}>
                    <MaterialCommunityIcons
                      name={
                        browser.searchQuery.trim()
                          ? "message-off-outline"
                          : "message-off-outline"
                      }
                      size={40}
                      color={colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.inlineEmptyText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {browser.searchQuery.trim()
                        ? "No messages found"
                        : "No messages yet"}
                    </Text>
                  </View>
                ) : (
                  <>
                    {browser.messageItems.map((item) => {
                      const timeStr = formatRelativeTime(item.timestamp);
                      const snippet =
                        item.text.length > 200
                          ? item.text.slice(0, 200) + "…"
                          : item.text;
                      return (
                        <TouchableOpacity
                          key={item.messageId}
                          style={[
                            styles.inlineMessageRow,
                            { borderBottomColor: colors.border },
                          ]}
                          activeOpacity={0.6}
                          onPress={() =>
                            navigateToGroupMessage(item.messageId)
                          }
                        >
                          <View style={styles.inlineMessageContent}>
                            <View style={styles.inlineMessageHeader}>
                              <Text
                                style={[
                                  styles.inlineMessageSender,
                                  { color: colors.text },
                                ]}
                                numberOfLines={1}
                              >
                                {item.senderName || "Unknown"}
                              </Text>
                              <Text
                                style={[
                                  styles.inlineMessageTime,
                                  { color: colors.textMuted },
                                ]}
                              >
                                {timeStr}
                              </Text>
                            </View>
                            <Text
                              style={[
                                styles.inlineMessageText,
                                { color: colors.textSecondary },
                              ]}
                              numberOfLines={3}
                            >
                              {snippet}
                            </Text>
                          </View>
                          <MaterialCommunityIcons
                            name="chevron-right"
                            size={16}
                            color={colors.textMuted}
                          />
                        </TouchableOpacity>
                      );
                    })}
                    {browser.hasMore && (
                      <TouchableOpacity
                        style={[
                          styles.loadMoreRow,
                          { borderTopColor: colors.border },
                        ]}
                        activeOpacity={0.6}
                        onPress={browser.loadMore}
                      >
                        {browser.loadingMore ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.primary}
                          />
                        ) : (
                          <Text
                            style={[
                              styles.loadMoreText,
                              { color: colors.primary },
                            ]}
                          >
                            Load more messages
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}

            {/* ─── Links tab content ─────────────────────────────────── */}
            {activeInfoTab === "links" && (
              <View>
                {browser.loading ? (
                  <View style={styles.inlineLoadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                ) : browser.linkItems.length === 0 ? (
                  <View style={styles.inlineEmptyContainer}>
                    <MaterialCommunityIcons
                      name={
                        browser.searchQuery.trim() ? "link-off" : "link-off"
                      }
                      size={40}
                      color={colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.inlineEmptyText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {browser.searchQuery.trim()
                        ? "No links found"
                        : "No shared links yet"}
                    </Text>
                  </View>
                ) : (
                  <>
                    {browser.linkItems.map((item) => {
                      const timeStr = formatRelativeTime(item.timestamp);
                      let displayUrl = item.url;
                      try {
                        const parsed = new URL(item.url);
                        displayUrl =
                          parsed.hostname +
                          (parsed.pathname !== "/" ? parsed.pathname : "");
                      } catch {
                        // keep raw
                      }
                      return (
                        <TouchableOpacity
                          key={`${item.messageId}-${item.url}`}
                          style={[
                            styles.inlineLinkRow,
                            { borderBottomColor: colors.border },
                          ]}
                          activeOpacity={0.6}
                          onPress={() => {
                            Linking.openURL(item.url).catch(() => {});
                          }}
                        >
                          <View
                            style={[
                              styles.inlineLinkIcon,
                              {
                                backgroundColor: colors.primary + "15",
                              },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name="link-variant"
                              size={18}
                              color={colors.primary}
                            />
                          </View>
                          <View style={styles.inlineLinkContent}>
                            <Text
                              style={[
                                styles.inlineLinkUrl,
                                { color: colors.primary },
                              ]}
                              numberOfLines={1}
                            >
                              {displayUrl}
                            </Text>
                            <Text
                              style={[
                                styles.inlineLinkMeta,
                                { color: colors.textMuted },
                              ]}
                              numberOfLines={1}
                            >
                              {item.senderName || "Unknown"} • {timeStr}
                            </Text>
                          </View>
                          <MaterialCommunityIcons
                            name="open-in-new"
                            size={14}
                            color={colors.textMuted}
                          />
                        </TouchableOpacity>
                      );
                    })}
                    {browser.hasMore && (
                      <TouchableOpacity
                        style={[
                          styles.loadMoreRow,
                          { borderTopColor: colors.border },
                        ]}
                        activeOpacity={0.6}
                        onPress={browser.loadMore}
                      >
                        {browser.loadingMore ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.primary}
                          />
                        ) : (
                          <Text
                            style={[
                              styles.loadMoreText,
                              { color: colors.primary },
                            ]}
                          >
                            Load more links
                          </Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}
          </View>

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           *  DANGER ZONE
           * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <View style={styles.dangerCard}>
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
// HELPERS
// =============================================================================

function formatRelativeTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;

  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < day * 7) return `${Math.floor(diff / day)}d ago`;

  const date = new Date(ts);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Compact Header ──────────────────────────────────────────────────
  compactHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },

  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: Spacing.lg,
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
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  heroAvatarContainer: {
    position: "relative",
    marginBottom: Spacing.md,
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
  contentSectionFullWidth: {
    marginHorizontal: -Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    flex: 1,
  },
  sectionBadge: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },

  // ── Voice Room Module ───────────────────────────────────────────────
  voiceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  voiceHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  voiceTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  voiceCount: {
    fontSize: FontSizes.sm,
  },
  voiceOccupants: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  voiceOccupantItem: {
    alignItems: "center",
    width: 48,
  },
  voiceOccupantName: {
    fontSize: 10,
    marginTop: 3,
    textAlign: "center",
  },
  voiceOverflowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceOverflowText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
  },
  voiceJoinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    marginTop: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  voiceJoinText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  voiceEmptyText: {
    fontSize: FontSizes.sm,
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  voiceStartButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    marginTop: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  voiceStartText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
  },

  // ── Inline Content Tab Bar ───────────────────────────────────────
  infoTabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  infoTabLabel: {
    fontSize: FontSizes.xs,
  },
  infoTabCount: {
    fontSize: FontSizes.xs - 1,
  },

  // ── Inline Search ──────────────────────────────────────────────────
  infoSearchContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  infoSearchBar: {
    borderRadius: BorderRadius.md,
    height: 36,
  },
  infoSearchInput: {
    fontSize: FontSizes.sm,
    minHeight: 0,
  },
  infoSearchDivider: {
    height: StyleSheet.hairlineWidth,
  },

  // ── Inline Media Grid ──────────────────────────────────────────────
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  mediaGridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    overflow: "hidden",
  },
  mediaGridImage: {
    width: "100%",
    height: "100%",
  },
  mediaGridPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaVideoBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
  },

  // ── Inline Message/Link Rows ───────────────────────────────────────
  inlineMessageRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inlineMessageContent: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  inlineMessageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  inlineMessageSender: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    flex: 1,
    marginRight: Spacing.sm,
  },
  inlineMessageTime: {
    fontSize: FontSizes.xs,
  },
  inlineMessageText: {
    fontSize: FontSizes.sm,
    lineHeight: 18,
  },
  inlineLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  inlineLinkIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineLinkContent: {
    flex: 1,
  },
  inlineLinkUrl: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  inlineLinkMeta: {
    fontSize: FontSizes.xs,
    marginTop: 1,
  },

  // ── Inline Empty / Loading / Load More ─────────────────────────────
  inlineEmptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxxl,
    gap: Spacing.md,
  },
  inlineEmptyText: {
    fontSize: FontSizes.sm,
    textAlign: "center",
  },
  inlineLoadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxxl,
  },
  loadMoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  loadMoreText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },

  // ── Invite Row ──────────────────────────────────────────────────────
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
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

  // ── See All / Collapse ──────────────────────────────────────────────
  seeAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  seeAllText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },

  // ── Danger Zone ─────────────────────────────────────────────────────
  dangerCard: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
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
