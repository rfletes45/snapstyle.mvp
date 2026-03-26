/**
 * FriendsScreen — Redesigned Friends Experience
 *
 * Unified friends list with inline requests, integrated search,
 * and modern gamified social styling.
 *
 * @module screens/friends/FriendsScreen
 */

import BlockUserModal from "@/components/BlockUserModal";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import ReportUserModal from "@/components/ReportUserModal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { BorderRadius, Spacing } from "@/constants/theme";
import { blockUser } from "@/services/blocking";
import { getFirestoreInstance } from "@/services/firebase";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  getFriends,
  getPendingRequests,
  getUserProfileByUid,
  removeFriend,
  sendFriendRequest,
} from "@/services/friends";
import { submitReport } from "@/services/reporting";
import { markNotificationsReadByTypes } from "@/services/userNotifications";
import { searchUsers, type UserSearchResult } from "@/services/users";
import { useAuth } from "@/store/AuthContext";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";
import {
  AvatarConfig,
  Friend,
  FriendRequest,
  ReportReason,
} from "@/types/models";
import * as haptics from "@/utils/haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
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
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import {
  Appbar,
  Button,
  Chip,
  Divider,
  IconButton,
  Menu,
  Searchbar,
  Snackbar,
  Text,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/friends/FriendsScreen");

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// =============================================================================
// Types
// =============================================================================

interface UserProfile {
  username: string;
  displayName: string;
  avatarConfig: AvatarConfig;
  profilePictureUrl?: string | null;
  decorationId?: string | null;
}

interface RequestWithProfile extends FriendRequest {
  otherUserProfile?: UserProfile;
}

interface FriendWithProfile extends Friend {
  otherUserProfile?: UserProfile;
}

type FriendsTab = "all" | "requests";

// =============================================================================
// Helpers
// =============================================================================

/** Normalize profile data from various shapes into a consistent UserProfile */
function extractProfile(profile: any): UserProfile | undefined {
  if (!profile) return undefined;
  return {
    username: profile.username,
    displayName: profile.displayName,
    avatarConfig: profile.avatarConfig,
    profilePictureUrl:
      profile.profilePicture?.url ?? profile.profilePictureUrl ?? null,
    decorationId:
      profile.avatarDecoration?.decorationId ?? profile.decorationId ?? null,
  };
}

// =============================================================================
// Subcomponents
// =============================================================================

/** Inline friend request card with accept/decline */
const RequestCard = React.memo(function RequestCard({
  request,
  type,
  uid,
  onAccept,
  onDecline,
  onCancel,
  onNavigateProfile,
  colors,
  isActionInProgress,
}: {
  request: RequestWithProfile;
  type: "received" | "sent";
  uid: string;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onCancel: (id: string) => void;
  onNavigateProfile: (userId: string) => void;
  colors: any;
  isActionInProgress: boolean;
}) {
  const otherUid = request.from === uid ? request.to : request.from;
  const profile = request.otherUserProfile;

  return (
    <TouchableOpacity
      style={[styles.friendRow, { backgroundColor: colors.surface }]}
      onPress={() => onNavigateProfile(otherUid)}
      activeOpacity={0.7}
      accessibilityLabel={`${profile?.username || "User"}, ${type === "received" ? "wants to be your friend" : "request sent"}`}
    >
      <ProfilePictureWithDecoration
        pictureUrl={profile?.profilePictureUrl}
        name={profile?.displayName || "?"}
        decorationId={profile?.decorationId}
        size={48}
      />
      <View style={styles.friendInfo}>
        <Text
          style={[styles.friendName, { color: colors.onSurface }]}
          numberOfLines={1}
        >
          {profile?.username || "Loading..."}
        </Text>
        <Text
          style={[styles.friendSubtitle, { color: colors.onSurfaceVariant }]}
          numberOfLines={1}
        >
          {type === "received" ? "Wants to be your friend" : "Request sent"}
        </Text>
      </View>
      <View style={styles.friendActions}>
        {type === "received" ? (
          <>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  backgroundColor: isActionInProgress
                    ? colors.surfaceVariant
                    : colors.primary,
                },
              ]}
              onPress={() => onAccept(request.id)}
              disabled={isActionInProgress}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel="Accept friend request"
              accessibilityRole="button"
            >
              {isActionInProgress ? (
                <ActivityIndicator size={14} color={colors.onSurfaceVariant} />
              ) : (
                <MaterialCommunityIcons name="check" size={18} color="#fff" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.declineBtn,
                { backgroundColor: colors.surfaceVariant },
              ]}
              onPress={() => onDecline(request.id)}
              disabled={isActionInProgress}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel="Decline friend request"
              accessibilityRole="button"
            >
              <MaterialCommunityIcons
                name="close"
                size={18}
                color={colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          </>
        ) : (
          <Button
            mode="text"
            onPress={() => onCancel(request.id)}
            compact
            disabled={isActionInProgress}
            loading={isActionInProgress}
            textColor={colors.onSurfaceVariant}
            labelStyle={{ fontSize: 13 }}
          >
            Cancel
          </Button>
        )}
      </View>
    </TouchableOpacity>
  );
});

/** Friend row with message action, streak badge, and overflow menu */
const FriendRow = React.memo(function FriendRow({
  friend,
  friendUid,
  menuVisible,
  onOpenMenu,
  onCloseMenu,
  onMessage,
  onNavigateProfile,
  onRemove,
  onBlock,
  onReport,
  colors,
}: {
  friend: FriendWithProfile;
  friendUid: string;
  menuVisible: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onMessage: () => void;
  onNavigateProfile: () => void;
  onRemove: () => void;
  onBlock: () => void;
  onReport: () => void;
  colors: any;
}) {
  const streakCount = friend.streakCount || 0;
  const profile = friend.otherUserProfile;

  return (
    <TouchableOpacity
      style={[styles.friendRow, { backgroundColor: colors.surface }]}
      onPress={onNavigateProfile}
      activeOpacity={0.7}
      accessibilityLabel={`${profile?.username || "Friend"}${streakCount > 0 ? `, ${streakCount} day streak` : ""}`}
    >
      <ProfilePictureWithDecoration
        pictureUrl={profile?.profilePictureUrl}
        name={profile?.displayName || "?"}
        decorationId={profile?.decorationId}
        size={48}
      />
      <View style={styles.friendInfo}>
        <View style={styles.nameRow}>
          <Text
            style={[styles.friendName, { color: colors.onSurface }]}
            numberOfLines={1}
          >
            {profile?.username || "Loading..."}
          </Text>
          {streakCount > 0 && (
            <View
              style={[
                styles.streakBadge,
                { backgroundColor: colors.tertiaryContainer || "#FF6B35" },
              ]}
            >
              <MaterialCommunityIcons
                name="fire"
                size={11}
                color={colors.onTertiaryContainer || "#fff"}
              />
              <Text
                style={[
                  styles.streakText,
                  { color: colors.onTertiaryContainer || "#fff" },
                ]}
              >
                {streakCount}
              </Text>
            </View>
          )}
        </View>
        {profile?.displayName && profile.displayName !== profile.username && (
          <Text
            style={[styles.friendSubtitle, { color: colors.onSurfaceVariant }]}
            numberOfLines={1}
          >
            {profile.displayName}
          </Text>
        )}
      </View>
      <View style={styles.friendActions}>
        <TouchableOpacity
          style={[
            styles.messageBtn,
            { backgroundColor: colors.primaryContainer },
          ]}
          onPress={onMessage}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Message ${profile?.username || "friend"}`}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons
            name="message-text-outline"
            size={18}
            color={colors.onPrimaryContainer}
          />
        </TouchableOpacity>
        <Menu
          visible={menuVisible}
          onDismiss={onCloseMenu}
          anchor={
            <IconButton
              icon="dots-vertical"
              size={20}
              onPress={onOpenMenu}
              style={{ margin: 0 }}
            />
          }
          contentStyle={{ backgroundColor: colors.surface }}
        >
          <Menu.Item
            onPress={() => {
              onCloseMenu();
              onRemove();
            }}
            title="Remove Friend"
            leadingIcon="account-remove-outline"
          />
          <Menu.Item
            onPress={() => {
              onCloseMenu();
              onBlock();
            }}
            title="Block"
            leadingIcon="block-helper"
            titleStyle={{ color: colors.error }}
          />
          <Menu.Item
            onPress={() => {
              onCloseMenu();
              onReport();
            }}
            title="Report"
            leadingIcon="flag-outline"
            titleStyle={{ color: colors.error }}
          />
        </Menu>
      </View>
    </TouchableOpacity>
  );
});

// =============================================================================
// Main Screen
// =============================================================================

export default function FriendsScreen({ navigation }: any) {
  const { currentFirebaseUser } = useAuth();
  const { setCurrentScreen } = useInAppNotifications();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const uid = currentFirebaseUser?.uid;
  const theme = useTheme();
  const { colors } = theme;

  // Suppress friend-related notifications while on this screen
  useFocusEffect(
    useCallback(() => {
      setCurrentScreen("Friends");
      return () => setCurrentScreen(null);
    }, [setCurrentScreen]),
  );

  // ── State ──────────────────────────────────────────────────────
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RequestWithProfile[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FriendsTab>(
    route.params?.tab === "requests" ? "requests" : "all",
  );

  // Add Friend modal
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [addFriendQuery, setAddFriendQuery] = useState("");
  const [addFriendResults, setAddFriendResults] = useState<UserSearchResult[]>(
    [],
  );
  const [addFriendSearching, setAddFriendSearching] = useState(false);
  const [addFriendSending, setAddFriendSending] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tracks which request ID is currently being acted on (accept/decline/cancel)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Snackbar (replaces Alert.alert for transient success/error)
  const [snackbar, setSnackbar] = useState<{
    visible: boolean;
    message: string;
    type?: "success" | "error";
  }>({ visible: false, message: "" });

  const showSnackbar = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setSnackbar({ visible: true, message, type });
    },
    [],
  );

  // Inline requests expanded state on "All" tab
  const [requestsExpanded, setRequestsExpanded] = useState(true);

  // Block/Report state
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    uid: string;
    username: string;
  } | null>(null);

  // ── Tab routing from nav params ────────────────────────────────
  useEffect(() => {
    if (route.params?.tab === "requests") {
      if (activeTab !== "requests") setActiveTab("requests");
      navigation.setParams({ tab: undefined });
    } else if (route.params?.tab === "all") {
      if (activeTab !== "all") setActiveTab("all");
      navigation.setParams({ tab: undefined });
    }
  }, [route.params?.tab, activeTab, navigation]);

  // ── Mark notifications read ────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      const types =
        activeTab === "requests"
          ? (["friend_request", "friend_request_accepted"] as const)
          : (["friend_request_accepted"] as const);

      markNotificationsReadByTypes(uid, [...types]).catch((err) => {
        logger.warn("Failed to mark social notifications read", err);
      });
    }, [uid, activeTab]),
  );

  // ── Data Loading ───────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!uid) return;

    try {
      setLoading(true);
      setError(null);
      const [friendsData, requestsData] = await Promise.all([
        getFriends(uid),
        getPendingRequests(uid),
      ]);

      // Fetch profiles for all requests
      const requestsWithProfiles: RequestWithProfile[] = await Promise.all(
        requestsData.map(async (request) => {
          const otherUserId = request.from === uid ? request.to : request.from;
          const profile = await getUserProfileByUid(otherUserId);
          return { ...request, otherUserProfile: extractProfile(profile) };
        }),
      );

      // Fetch profiles for all friends
      const friendsWithProfiles: FriendWithProfile[] = await Promise.all(
        friendsData.map(async (friend) => {
          const friendUid = friend.users.find((u) => u !== uid);
          if (!friendUid) return friend;
          const profile = await getUserProfileByUid(friendUid);
          return { ...friend, otherUserProfile: extractProfile(profile) };
        }),
      );

      setFriends(friendsWithProfiles);
      setPendingRequests(requestsWithProfiles);
    } catch (err) {
      logger.error("Error loading friends data:", err);
      setError("Couldn't load your friends");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  // ── Real-time Listeners ────────────────────────────────────────

  useEffect(() => {
    if (!uid) return;

    loadData();

    const db = getFirestoreInstance();

    // Friends listener — always fetches full profile (fixes PFP bug)
    const friendsQ = query(
      collection(db, "Friends"),
      where("users", "array-contains", uid),
    );

    const unsubFriends = onSnapshot(
      friendsQ,
      async (snapshot) => {
        const blockedRef = collection(db, "Users", uid, "blockedUsers");
        const blockedSnap = await getDocs(blockedRef);
        const blockedIds = new Set(blockedSnap.docs.map((d) => d.id));

        const data: Friend[] = [];
        snapshot.forEach((doc) => {
          const friend = { id: doc.id, ...doc.data() } as Friend;
          const otherUid = friend.users.find((u) => u !== uid);
          if (otherUid && !blockedIds.has(otherUid)) data.push(friend);
        });

        data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        const withProfiles: FriendWithProfile[] = await Promise.all(
          data.map(async (friend) => {
            const fUid = friend.users.find((u) => u !== uid);
            if (!fUid) return friend;
            const profile = await getUserProfileByUid(fUid);
            return { ...friend, otherUserProfile: extractProfile(profile) };
          }),
        );

        setFriends(withProfiles);
      },
      (err) => logger.error("Friends listener error:", err),
    );

    // Requests listeners — shared refresh function
    const refreshRequests = async () => {
      const data = await getPendingRequests(uid);
      const withProfiles: RequestWithProfile[] = await Promise.all(
        data.map(async (req) => {
          const otherUid = req.from === uid ? req.to : req.from;
          const profile = await getUserProfileByUid(otherUid);
          return { ...req, otherUserProfile: extractProfile(profile) };
        }),
      );
      setPendingRequests(withProfiles);
    };

    const toQ = query(
      collection(db, "FriendRequests"),
      where("to", "==", uid),
      where("status", "==", "pending"),
    );
    const fromQ = query(
      collection(db, "FriendRequests"),
      where("from", "==", uid),
      where("status", "==", "pending"),
    );

    const unsubTo = onSnapshot(
      toQ,
      () => refreshRequests(),
      (err) => logger.error("Requests (to) listener error:", err),
    );
    const unsubFrom = onSnapshot(
      fromQ,
      () => refreshRequests(),
      (err) => logger.error("Requests (from) listener error:", err),
    );

    return () => {
      unsubFriends();
      unsubTo();
      unsubFrom();
    };
  }, [uid]);

  // ── Refresh ────────────────────────────────────────────────────

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ── Add Friend Search ──────────────────────────────────────────

  const handleAddFriendQueryChange = useCallback(
    (text: string) => {
      setAddFriendQuery(text);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

      if (!text.trim()) {
        setAddFriendResults([]);
        setAddFriendSearching(false);
        return;
      }

      setAddFriendSearching(true);
      searchTimerRef.current = setTimeout(async () => {
        if (!uid) return;
        try {
          const results = await searchUsers(text, uid);
          setAddFriendResults(results);
        } catch {
          setAddFriendResults([]);
        } finally {
          setAddFriendSearching(false);
        }
      }, 250);
    },
    [uid],
  );

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const getFriendStatus = useCallback(
    (targetUid: string): "friends" | "requested" | "incoming" | "none" => {
      if (friends.some((f) => f.users.includes(targetUid))) return "friends";
      if (
        pendingRequests.find(
          (r) => r.from === uid && r.to === targetUid && r.status === "pending",
        )
      )
        return "requested";
      if (
        pendingRequests.find(
          (r) => r.to === uid && r.from === targetUid && r.status === "pending",
        )
      )
        return "incoming";
      return "none";
    },
    [friends, pendingRequests, uid],
  );

  const handleSendRequestFromSearch = useCallback(
    async (targetUsername: string, targetUid: string) => {
      if (!uid) return;
      try {
        setAddFriendSending(targetUid);
        await sendFriendRequest(uid, targetUsername);
        showSnackbar("Friend request sent!");
        await loadData();
      } catch (error: any) {
        showSnackbar(error.message || "Failed to send request", "error");
      } finally {
        setAddFriendSending(null);
      }
    },
    [uid, loadData, showSnackbar],
  );

  const handleCloseAddFriendModal = useCallback(() => {
    setAddFriendModalVisible(false);
    setAddFriendQuery("");
    setAddFriendResults([]);
    setAddFriendSearching(false);
  }, []);

  // ── Friend Request Actions ─────────────────────────────────────

  const handleAcceptRequest = useCallback(
    async (requestId: string) => {
      if (actionInProgress) return;
      setActionInProgress(requestId);
      haptics.buttonPress();
      try {
        await acceptFriendRequest(requestId);
        showSnackbar("Friend added! 🎉");
      } catch {
        showSnackbar("Failed to accept request", "error");
      } finally {
        setActionInProgress(null);
      }
    },
    [actionInProgress, showSnackbar],
  );

  const handleDeclineRequest = useCallback(
    async (requestId: string) => {
      if (actionInProgress) return;
      setActionInProgress(requestId);
      try {
        await declineFriendRequest(requestId);
        showSnackbar("Request declined");
      } catch {
        showSnackbar("Failed to decline request", "error");
      } finally {
        setActionInProgress(null);
      }
    },
    [actionInProgress, showSnackbar],
  );

  const handleCancelRequest = useCallback(
    async (requestId: string) => {
      if (actionInProgress) return;
      setActionInProgress(requestId);
      try {
        await cancelFriendRequest(requestId);
        showSnackbar("Request cancelled");
      } catch {
        showSnackbar("Failed to cancel request", "error");
      } finally {
        setActionInProgress(null);
      }
    },
    [actionInProgress, showSnackbar],
  );

  const handleRemoveFriend = useCallback(
    (friendUid: string) => {
      if (!uid) return;
      Alert.alert(
        "Remove Friend",
        "Are you sure you want to remove this friend?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await removeFriend(uid, friendUid);
                showSnackbar("Friend removed");
              } catch {
                showSnackbar("Failed to remove friend", "error");
              }
            },
          },
        ],
      );
    },
    [uid, showSnackbar],
  );

  // ── Block/Report ───────────────────────────────────────────────

  const handleOpenMenu = useCallback((userId: string) => {
    setMenuVisible(userId);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuVisible(null);
  }, []);

  const handleBlockPress = useCallback((userId: string, username: string) => {
    setMenuVisible(null);
    setTimeout(() => {
      setSelectedUser({ uid: userId, username });
      setBlockModalVisible(true);
    }, 150);
  }, []);

  const handleReportPress = useCallback((userId: string, username: string) => {
    setMenuVisible(null);
    setTimeout(() => {
      setSelectedUser({ uid: userId, username });
      setReportModalVisible(true);
    }, 150);
  }, []);

  const handleBlockConfirm = useCallback(
    async (reason?: string) => {
      if (!uid || !selectedUser) return;
      try {
        await blockUser(uid, selectedUser.uid, reason);
        setBlockModalVisible(false);
        setSelectedUser(null);
        showSnackbar(`${selectedUser.username} has been blocked`);
      } catch (error: any) {
        showSnackbar(error.message || "Failed to block user", "error");
      }
    },
    [uid, selectedUser, showSnackbar],
  );

  const handleReportComplete = useCallback(() => {
    setReportModalVisible(false);
    setSelectedUser(null);
  }, []);

  const handleReportSubmit = useCallback(
    async (reason: ReportReason, description?: string) => {
      if (!uid || !selectedUser) return;
      try {
        await submitReport(uid, selectedUser.uid, reason, {
          description,
          relatedContent: { type: "profile" },
        });
        showSnackbar("Report submitted. Thank you!");
        handleReportComplete();
      } catch (error: any) {
        showSnackbar(error.message || "Failed to submit report", "error");
      }
    },
    [uid, selectedUser, showSnackbar, handleReportComplete],
  );

  // ── Derived State ──────────────────────────────────────────────

  const receivedRequests = useMemo(
    () => pendingRequests.filter((r) => r.to === uid),
    [pendingRequests, uid],
  );
  const sentRequests = useMemo(
    () => pendingRequests.filter((r) => r.from === uid),
    [pendingRequests, uid],
  );

  const normalizedQuery = useMemo(
    () => searchQuery.trim().toLowerCase(),
    [searchQuery],
  );

  const filteredFriends = useMemo(() => {
    if (!normalizedQuery) return friends;
    return friends.filter((f) => {
      const name = f.otherUserProfile?.username?.toLowerCase() || "";
      const display = f.otherUserProfile?.displayName?.toLowerCase() || "";
      return (
        name.includes(normalizedQuery) || display.includes(normalizedQuery)
      );
    });
  }, [friends, normalizedQuery]);

  const filteredReceived = useMemo(() => {
    if (!normalizedQuery) return receivedRequests;
    return receivedRequests.filter((r) => {
      const name = r.otherUserProfile?.username?.toLowerCase() || "";
      const display = r.otherUserProfile?.displayName?.toLowerCase() || "";
      return (
        name.includes(normalizedQuery) || display.includes(normalizedQuery)
      );
    });
  }, [receivedRequests, normalizedQuery]);

  const filteredSent = useMemo(() => {
    if (!normalizedQuery) return sentRequests;
    return sentRequests.filter((r) => {
      const name = r.otherUserProfile?.username?.toLowerCase() || "";
      return name.includes(normalizedQuery);
    });
  }, [sentRequests, normalizedQuery]);

  const receivedCount = filteredReceived.length;
  const totalRequestCount = receivedCount + filteredSent.length;

  // ── Navigation ─────────────────────────────────────────────────

  const navigateToProfile = useCallback(
    (userId: string) => navigation.navigate("UserProfile", { userId }),
    [navigation],
  );

  const navigateToChat = useCallback(
    (friendUid: string) => navigation.navigate("ChatDetail", { friendUid }),
    [navigation],
  );

  // ── Toggle inline requests ─────────────────────────────────────

  const toggleRequests = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRequestsExpanded((prev) => !prev);
  }, []);

  // =========================================================================
  // Render
  // =========================================================================

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Appbar.Header style={{ backgroundColor: colors.surface }} elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Friends" />
        </Appbar.Header>
        <LoadingState message="Loading your friends..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Appbar.Header style={{ backgroundColor: colors.surface }} elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Friends" />
        </Appbar.Header>
        <ErrorState
          title="Something went wrong"
          message={error}
          onRetry={loadData}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <Appbar.Header style={{ backgroundColor: colors.surface }} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content
          title="Friends"
          subtitle={
            friends.length > 0
              ? `${friends.length} friend${friends.length !== 1 ? "s" : ""}`
              : undefined
          }
        />
        <Appbar.Action
          icon="account-plus-outline"
          onPress={() => setAddFriendModalVisible(true)}
          accessibilityLabel="Add friend"
        />
      </Appbar.Header>

      {/* ── Search ──────────────────────────────────────────────── */}
      <View
        style={[styles.searchContainer, { backgroundColor: colors.surface }]}
      >
        <Searchbar
          placeholder="Search friends..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={[styles.searchbar, { backgroundColor: colors.surfaceVariant }]}
          inputStyle={{ fontSize: 14, alignSelf: "center", paddingVertical: 0 }}
          elevation={0}
          accessibilityLabel="Search friends"
        />
      </View>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.outlineVariant,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "all" && {
              borderBottomColor: colors.primary,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => {
            haptics.tabChange();
            setActiveTab("all");
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "all" }}
          accessibilityLabel={`My Friends, ${filteredFriends.length}`}
        >
          <Text
            style={[
              styles.tabText,
              {
                color:
                  activeTab === "all"
                    ? colors.primary
                    : colors.onSurfaceVariant,
              },
            ]}
          >
            My Friends ({filteredFriends.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "requests" && {
              borderBottomColor: colors.primary,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => {
            haptics.tabChange();
            setActiveTab("requests");
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "requests" }}
          accessibilityLabel={`Requests${receivedCount > 0 ? `, ${receivedCount} new` : ""}`}
        >
          <View style={styles.tabWithBadge}>
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "requests"
                      ? colors.primary
                      : colors.onSurfaceVariant,
                },
              ]}
            >
              Requests
            </Text>
            {receivedCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.error }]}>
                <Text style={styles.badgeText}>{receivedCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Content: My Friends ─────────────────────────────────── */}
      {activeTab === "all" && (
        <FlatList
          data={filteredFriends}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            receivedCount > 0 ? (
              <View style={styles.requestsSectionHeader}>
                <TouchableOpacity
                  style={[
                    styles.requestsBanner,
                    { backgroundColor: colors.primaryContainer },
                  ]}
                  onPress={toggleRequests}
                  activeOpacity={0.7}
                >
                  <View style={styles.requestsBannerLeft}>
                    <MaterialCommunityIcons
                      name="account-clock-outline"
                      size={20}
                      color={colors.onPrimaryContainer}
                    />
                    <Text
                      style={[
                        styles.requestsBannerText,
                        { color: colors.onPrimaryContainer },
                      ]}
                    >
                      {receivedCount} friend request
                      {receivedCount !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={requestsExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={colors.onPrimaryContainer}
                  />
                </TouchableOpacity>

                {requestsExpanded &&
                  filteredReceived.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      type="received"
                      uid={uid || ""}
                      onAccept={handleAcceptRequest}
                      onDecline={handleDeclineRequest}
                      onCancel={handleCancelRequest}
                      onNavigateProfile={navigateToProfile}
                      colors={colors}
                      isActionInProgress={actionInProgress === request.id}
                    />
                  ))}

                {requestsExpanded && receivedCount > 0 && (
                  <Divider style={{ marginTop: 4 }} />
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="account-heart-outline"
              title="No friends yet"
              subtitle="Find people to play games and chat with!"
              actionLabel="Find Friends"
              onAction={() => setAddFriendModalVisible(true)}
            />
          }
          renderItem={({ item: friend }) => {
            const friendUid = friend.users.find((u) => u !== uid) || "";
            return (
              <FriendRow
                friend={friend}
                friendUid={friendUid}
                menuVisible={menuVisible === friendUid}
                onOpenMenu={() => handleOpenMenu(friendUid)}
                onCloseMenu={handleCloseMenu}
                onMessage={() => navigateToChat(friendUid)}
                onNavigateProfile={() => navigateToProfile(friendUid)}
                onRemove={() => handleRemoveFriend(friendUid)}
                onBlock={() =>
                  handleBlockPress(
                    friendUid,
                    friend.otherUserProfile?.username || "User",
                  )
                }
                onReport={() =>
                  handleReportPress(
                    friendUid,
                    friend.otherUserProfile?.username || "User",
                  )
                }
                colors={colors}
              />
            );
          }}
          ItemSeparatorComponent={() => <Divider style={{ marginLeft: 72 }} />}
        />
      )}

      {/* ── Content: Requests ──────────────────────────────────── */}
      {activeTab === "requests" && (
        <FlatList
          data={[
            ...filteredReceived.map((r) => ({
              ...r,
              _type: "received" as const,
            })),
            ...filteredSent.map((r) => ({
              ...r,
              _type: "sent" as const,
            })),
          ]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            filteredReceived.length > 0 ? (
              <View style={styles.sectionLabelWrap}>
                <Text
                  style={[
                    styles.sectionLabel,
                    { color: colors.onSurfaceVariant },
                  ]}
                >
                  Received ({filteredReceived.length})
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="email-open-outline"
              title="No requests"
              subtitle="When someone sends you a friend request, it'll show up here."
            />
          }
          renderItem={({ item, index }) => {
            const isFirstSent =
              item._type === "sent" && index === filteredReceived.length;

            return (
              <>
                {isFirstSent && (
                  <View style={styles.sectionLabelWrap}>
                    <Text
                      style={[
                        styles.sectionLabel,
                        { color: colors.onSurfaceVariant },
                      ]}
                    >
                      Sent ({filteredSent.length})
                    </Text>
                  </View>
                )}
                <RequestCard
                  request={item}
                  type={item._type}
                  uid={uid || ""}
                  onAccept={handleAcceptRequest}
                  onDecline={handleDeclineRequest}
                  onCancel={handleCancelRequest}
                  onNavigateProfile={navigateToProfile}
                  colors={colors}
                  isActionInProgress={actionInProgress === item.id}
                />
              </>
            );
          }}
          ItemSeparatorComponent={() => <Divider style={{ marginLeft: 72 }} />}
        />
      )}

      {/* ── Add Friend Modal ───────────────────────────────────── */}
      <Modal
        visible={addFriendModalVisible}
        onRequestClose={handleCloseAddFriendModal}
        transparent
        animationType="fade"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, Spacing.lg),
              },
            ]}
          >
            {/* Drag handle */}
            <View style={styles.dragHandle}>
              <View
                style={[
                  styles.dragHandleBar,
                  { backgroundColor: colors.outlineVariant },
                ]}
              />
            </View>
            {/* Header */}
            <View style={styles.modalHeaderRow}>
              <Text
                variant="headlineSmall"
                style={[styles.modalTitle, { color: colors.onSurface }]}
              >
                Add Friend
              </Text>
              <IconButton
                icon="close"
                size={22}
                onPress={handleCloseAddFriendModal}
                accessibilityLabel="Close"
              />
            </View>

            {/* Search */}
            <Searchbar
              placeholder="Search by username…"
              value={addFriendQuery}
              onChangeText={handleAddFriendQueryChange}
              style={[
                styles.modalSearchbar,
                { backgroundColor: colors.surfaceVariant },
              ]}
              elevation={0}
              autoFocus
            />

            {/* Results */}
            <View style={styles.modalResultsContainer}>
              {addFriendSearching && addFriendResults.length === 0 && (
                <View style={styles.modalLoadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text
                    variant="bodySmall"
                    style={{ color: colors.onSurfaceVariant, marginLeft: 8 }}
                  >
                    Searching…
                  </Text>
                </View>
              )}

              {!addFriendSearching &&
                addFriendQuery.trim().length > 0 &&
                addFriendResults.length === 0 && (
                  <View style={styles.modalEmptyContainer}>
                    <MaterialCommunityIcons
                      name="account-search-outline"
                      size={40}
                      color={colors.onSurfaceVariant}
                      style={{ marginBottom: 8 }}
                    />
                    <Text
                      variant="bodyMedium"
                      style={{
                        color: colors.onSurfaceVariant,
                        textAlign: "center",
                      }}
                    >
                      No users found for "{addFriendQuery.trim()}"
                    </Text>
                  </View>
                )}

              {addFriendQuery.trim().length === 0 && (
                <View style={styles.modalEmptyContainer}>
                  <MaterialCommunityIcons
                    name="account-search-outline"
                    size={40}
                    color={colors.onSurfaceVariant}
                    style={{ marginBottom: 8 }}
                  />
                  <Text
                    variant="bodyMedium"
                    style={{
                      color: colors.onSurfaceVariant,
                      textAlign: "center",
                    }}
                  >
                    Type a username to find people
                  </Text>
                </View>
              )}

              <FlatList
                data={addFriendResults}
                keyExtractor={(item) => item.uid}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const status = getFriendStatus(item.uid);
                  const isSending = addFriendSending === item.uid;
                  return (
                    <View
                      style={[
                        styles.searchResultRow,
                        { borderBottomColor: colors.outlineVariant },
                      ]}
                    >
                      <ProfilePictureWithDecoration
                        pictureUrl={item.profilePictureUrl}
                        name={item.displayName || item.username}
                        decorationId={item.decorationId}
                        size={40}
                      />
                      <View style={styles.searchResultInfo}>
                        <Text
                          variant="bodyMedium"
                          style={[
                            styles.searchResultName,
                            { color: colors.onSurface },
                          ]}
                          numberOfLines={1}
                        >
                          {item.displayName || item.username}
                        </Text>
                        <Text
                          variant="bodySmall"
                          style={{ color: colors.onSurfaceVariant }}
                          numberOfLines={1}
                        >
                          @{item.username}
                        </Text>
                      </View>
                      <View style={styles.searchResultAction}>
                        {isSending ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.primary}
                          />
                        ) : status === "friends" ? (
                          <Chip
                            compact
                            style={{
                              backgroundColor: colors.secondaryContainer,
                            }}
                            textStyle={{ fontSize: 11 }}
                          >
                            Friends
                          </Chip>
                        ) : status === "requested" ? (
                          <Chip
                            compact
                            style={{ backgroundColor: colors.surfaceVariant }}
                            textStyle={{ fontSize: 11 }}
                          >
                            Sent
                          </Chip>
                        ) : status === "incoming" ? (
                          <Button
                            mode="contained"
                            compact
                            labelStyle={{ fontSize: 11 }}
                            onPress={() => {
                              const req = pendingRequests.find(
                                (r) =>
                                  r.from === item.uid &&
                                  r.to === uid &&
                                  r.status === "pending",
                              );
                              if (req) handleAcceptRequest(req.id);
                            }}
                          >
                            Accept
                          </Button>
                        ) : (
                          <Button
                            mode="contained"
                            compact
                            labelStyle={{ fontSize: 11 }}
                            onPress={() =>
                              handleSendRequestFromSearch(
                                item.username,
                                item.uid,
                              )
                            }
                          >
                            Add
                          </Button>
                        )}
                      </View>
                    </View>
                  );
                }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Block/Report Modals ────────────────────────────────── */}
      <BlockUserModal
        visible={blockModalVisible}
        username={selectedUser?.username || ""}
        onCancel={() => {
          setBlockModalVisible(false);
          setSelectedUser(null);
        }}
        onConfirm={handleBlockConfirm}
      />

      {selectedUser && (
        <ReportUserModal
          visible={reportModalVisible}
          username={selectedUser.username}
          onSubmit={handleReportSubmit}
          onCancel={handleReportComplete}
        />
      )}

      {/* ── Snackbar ───────────────────────────────────────────── */}
      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar((s) => ({ ...s, visible: false }))}
        duration={3000}
        style={
          snackbar.type === "error"
            ? { backgroundColor: colors.errorContainer }
            : { backgroundColor: colors.inverseSurface }
        }
      >
        <Text
          style={{
            color:
              snackbar.type === "error"
                ? colors.onErrorContainer
                : colors.inverseOnSurface,
          }}
        >
          {snackbar.message}
        </Text>
      </Snackbar>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  /* Search */
  searchContainer: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  searchbar: {
    borderRadius: BorderRadius.md,
    minHeight: 42,
    justifyContent: "center",
  },

  /* Tab bar */
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tabWithBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },

  /* List */
  listContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },

  /* Friend row (shared between FriendRow + RequestCard) */
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  friendName: {
    fontSize: 15,
    fontWeight: "600",
  },
  friendSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  friendActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 2,
  },
  streakText: {
    fontSize: 11,
    fontWeight: "700",
  },
  messageBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtn: {
    marginLeft: 6,
  },

  /* Inline requests section on All tab */
  requestsSectionHeader: {
    paddingBottom: 4,
  },
  requestsBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  requestsBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  requestsBannerText: {
    fontSize: 14,
    fontWeight: "600",
  },

  /* Section labels for request tab */
  sectionLabelWrap: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    maxHeight: "85%",
    minHeight: 340,
  },
  dragHandle: {
    alignItems: "center",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  dragHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  modalTitle: {
    fontWeight: "600",
  },
  modalSearchbar: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    elevation: 0,
  },
  modalResultsContainer: {
    flex: 1,
    minHeight: 180,
  },
  modalLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
  },
  modalEmptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  searchResultName: {
    fontWeight: "500",
  },
  searchResultAction: {
    marginLeft: Spacing.sm,
    minWidth: 80,
    alignItems: "flex-end",
  },
});
