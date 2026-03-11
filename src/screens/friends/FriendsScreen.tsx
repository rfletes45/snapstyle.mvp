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
import { markNotificationsReadByTypes } from "@/services/userNotifications";
import { submitReport } from "@/services/reporting";
import { searchUsers, type UserSearchResult } from "@/services/users";
import { useAuth } from "@/store/AuthContext";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";
import { useUser } from "@/store/UserContext";
import {
  AvatarConfig,
  Friend,
  FriendRequest,
  ReportReason,
} from "@/types/models";
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
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
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
  Text,
  useTheme,
} from "react-native-paper";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/friends/FriendsScreen");

// =============================================================================
// Types
// =============================================================================

interface RequestWithUsername extends FriendRequest {
  otherUserUsername?: string;
  otherUserProfile?: {
    username: string;
    displayName: string;
    avatarConfig: AvatarConfig;
    profilePictureUrl?: string | null;
    decorationId?: string | null;
  };
}

interface FriendWithProfile extends Friend {
  otherUserProfile?: {
    username: string;
    displayName: string;
    avatarConfig: AvatarConfig;
    profilePictureUrl?: string | null;
    decorationId?: string | null;
  };
}

type ConnectionsTab = "all" | "requests";

// =============================================================================
// Subcomponents
// =============================================================================

/** Polished request card with accept/decline actions */
function RequestCard({
  request,
  type,
  uid,
  onAccept,
  onDecline,
  onCancel,
  onNavigateProfile,
  colors,
}: {
  request: RequestWithUsername;
  type: "received" | "sent";
  uid: string;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onCancel: (id: string) => void;
  onNavigateProfile: (userId: string) => void;
  colors: any;
}) {
  const otherUid = request.from === uid ? request.to : request.from;

  return (
    <TouchableOpacity
      style={[styles.connectionRow, { backgroundColor: colors.surface }]}
      onPress={() => onNavigateProfile(otherUid)}
      activeOpacity={0.7}
    >
      <ProfilePictureWithDecoration
        pictureUrl={request.otherUserProfile?.profilePictureUrl}
        name={request.otherUserProfile?.displayName || "?"}
        decorationId={request.otherUserProfile?.decorationId}
        size={48}
      />
      <View style={styles.connectionInfo}>
        <Text
          style={[styles.connectionName, { color: colors.onSurface }]}
          numberOfLines={1}
        >
          {request.otherUserProfile?.username ||
            request.otherUserUsername ||
            "Loading..."}
        </Text>
        <Text
          style={[
            styles.connectionSubtitle,
            { color: colors.onSurfaceVariant },
          ]}
          numberOfLines={1}
        >
          {type === "received" ? "Wants to connect" : "Pending request"}
        </Text>
      </View>
      <View style={styles.connectionActions}>
        {type === "received" ? (
          <>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.acceptButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={() => onAccept(request.id)}
            >
              <MaterialCommunityIcons name="check" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.declineButton,
                { backgroundColor: colors.surfaceVariant },
              ]}
              onPress={() => onDecline(request.id)}
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
            textColor={colors.onSurfaceVariant}
            labelStyle={{ fontSize: 13 }}
          >
            Cancel
          </Button>
        )}
      </View>
    </TouchableOpacity>
  );
}

/** Polished connection row with message + overflow menu */
function ConnectionRow({
  friend,
  friendUid,
  uid,
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
  uid: string;
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

  return (
    <TouchableOpacity
      style={[styles.connectionRow, { backgroundColor: colors.surface }]}
      onPress={onNavigateProfile}
      activeOpacity={0.7}
    >
      <ProfilePictureWithDecoration
        pictureUrl={friend.otherUserProfile?.profilePictureUrl}
        name={friend.otherUserProfile?.displayName || "?"}
        decorationId={friend.otherUserProfile?.decorationId}
        size={48}
      />
      <View style={styles.connectionInfo}>
        <View style={styles.nameRow}>
          <Text
            style={[styles.connectionName, { color: colors.onSurface }]}
            numberOfLines={1}
          >
            {friend.otherUserProfile?.username || "Loading..."}
          </Text>
          {streakCount > 0 && (
            <View style={[styles.streakBadge, { backgroundColor: "#FF6B35" }]}>
              <MaterialCommunityIcons name="fire" size={11} color="#fff" />
              <Text style={styles.streakBadgeText}>{streakCount}</Text>
            </View>
          )}
        </View>
        {friend.otherUserProfile?.displayName &&
          friend.otherUserProfile.displayName !==
            friend.otherUserProfile.username && (
            <Text
              style={[
                styles.connectionSubtitle,
                { color: colors.onSurfaceVariant },
              ]}
              numberOfLines={1}
            >
              {friend.otherUserProfile.displayName}
            </Text>
          )}
      </View>
      <View style={styles.connectionActions}>
        <TouchableOpacity
          style={[
            styles.messageBtn,
            { backgroundColor: colors.primaryContainer },
          ]}
          onPress={onMessage}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
            title="Remove"
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
}

// =============================================================================
// Main Screen
// =============================================================================

export default function FriendsScreen({ navigation }: any) {
  const { currentFirebaseUser } = useAuth();
  useUser();
  const { setCurrentScreen } = useInAppNotifications();
  const route = useRoute<any>();
  const uid = currentFirebaseUser?.uid;
  const theme = useTheme();
  const { colors } = theme;

  // Suppress friend request notifications while on this screen
  useFocusEffect(
    useCallback(() => {
      setCurrentScreen("Connections");
      return () => setCurrentScreen(null);
    }, [setCurrentScreen]),
  );

  // State management
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RequestWithUsername[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [addFriendQuery, setAddFriendQuery] = useState("");
  const [addFriendResults, setAddFriendResults] = useState<UserSearchResult[]>(
    [],
  );
  const [addFriendSearching, setAddFriendSearching] = useState(false);
  const [addFriendSending, setAddFriendSending] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ConnectionsTab>(
    route.params?.tab === "requests" ? "requests" : "all",
  );
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (route.params?.tab === "requests") {
      if (activeTab !== "requests") {
        setActiveTab("requests");
      }
      navigation.setParams({ tab: undefined });
    } else if (route.params?.tab === "all") {
      if (activeTab !== "all") {
        setActiveTab("all");
      }
      navigation.setParams({ tab: undefined });
    }
  }, [route.params?.tab, activeTab, navigation]);

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      const types =
        activeTab === "requests"
          ? (["friend_request", "friend_request_accepted"] as const)
          : (["friend_request_accepted"] as const);

      markNotificationsReadByTypes(uid, [...types]).catch((error) => {
        logger.warn("Failed to mark social notifications read", error);
      });
    }, [uid, activeTab]),
  );

  // Block/Report state
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    uid: string;
    username: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!uid) return;

    try {
      setLoading(true);
      setError(null);
      const [friendsData, requestsData] = await Promise.all([
        getFriends(uid),
        getPendingRequests(uid),
      ]);

      // Fetch user profiles for each request (especially for received requests)
      const requestsWithProfiles = await Promise.all(
        requestsData.map(async (request) => {
          // Determine whose profile to fetch (the other person in the request)
          const otherUserId = request.from === uid ? request.to : request.from;
          const profile = await getUserProfileByUid(otherUserId);
          return {
            ...request,
            otherUserUsername: profile?.username,
            otherUserProfile: profile
              ? {
                  username: profile.username,
                  displayName: profile.displayName,
                  avatarConfig: profile.avatarConfig,
                  profilePictureUrl: profile.profilePicture?.url ?? null,
                  decorationId: profile.avatarDecoration?.decorationId ?? null,
                }
              : undefined,
          };
        }),
      );

      // Fetch user profiles for friends
      const friendsWithProfiles = await Promise.all(
        friendsData.map(async (friend) => {
          const friendUid = friend.users.find((u) => u !== uid);
          if (!friendUid) return friend;

          const profile = await getUserProfileByUid(friendUid);
          return {
            ...friend,
            otherUserProfile: profile
              ? {
                  username: profile.username,
                  displayName: profile.displayName,
                  avatarConfig: profile.avatarConfig,
                  profilePictureUrl: profile.profilePicture?.url ?? null,
                  decorationId: profile.avatarDecoration?.decorationId ?? null,
                }
              : undefined,
          };
        }),
      );

      setFriends(friendsWithProfiles);
      setPendingRequests(requestsWithProfiles);
    } catch (err) {
      logger.error("Error loading connections data:", err);
      setError("Couldn't load connections");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  // Load friends and requests with real-time updates
  useEffect(() => {
    if (!uid) return;

    // Initial load
    loadData();

    // Set up real-time listener for Friends collection
    const db = getFirestoreInstance();
    const friendsRef = collection(db, "Friends");
    const friendsQuery = query(
      friendsRef,
      where("users", "array-contains", uid),
    );

    const unsubscribeFriends = onSnapshot(
      friendsQuery,
      async (snapshot) => {
        logger.info("🔵 [FriendsScreen] Real-time friends update received");

        // Get blocked users list
        const blockedUsersRef = collection(db, "Users", uid, "blockedUsers");
        const blockedSnapshot = await getDocs(blockedUsersRef);
        const blockedUserIds = new Set(
          blockedSnapshot.docs.map((doc) => doc.id),
        );

        // Process friends data
        const friendsData: Friend[] = [];
        snapshot.forEach((doc) => {
          const friend = {
            id: doc.id,
            ...doc.data(),
          } as Friend;

          // Get the other user's ID
          const otherUserId = friend.users.find((u) => u !== uid);

          // Only include if the other user is not blocked
          if (otherUserId && !blockedUserIds.has(otherUserId)) {
            friendsData.push(friend);
          }
        });

        // Sort by creation date
        friendsData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        // Fetch user profiles for friends
        const friendsWithProfiles = await Promise.all(
          friendsData.map(async (friend) => {
            const friendUid = friend.users.find((u) => u !== uid);
            if (!friendUid) return friend;

            const profile = await getUserProfileByUid(friendUid);
            return {
              ...friend,
              otherUserProfile: profile
                ? {
                    username: profile.username,
                    displayName: profile.displayName,
                    avatarConfig: profile.avatarConfig,
                  }
                : undefined,
            };
          }),
        );

        setFriends(friendsWithProfiles);
      },
      (error) => {
        logger.error("Error in friends listener:", error);
      },
    );

    // Set up real-time listener for FriendRequests
    const requestsRef = collection(db, "FriendRequests");

    // Query for requests TO the user
    const toQuery = query(
      requestsRef,
      where("to", "==", uid),
      where("status", "==", "pending"),
    );

    // Query for requests FROM the user
    const fromQuery = query(
      requestsRef,
      where("from", "==", uid),
      where("status", "==", "pending"),
    );

    const unsubscribeRequestsTo = onSnapshot(
      toQuery,
      async () => {
        logger.info("🔵 [FriendsScreen] Real-time requests update received");
        // Reload all requests when any change happens
        const requestsData = await getPendingRequests(uid);

        // Fetch user profiles for each request
        const requestsWithProfiles = await Promise.all(
          requestsData.map(async (request) => {
            const otherUserId =
              request.from === uid ? request.to : request.from;
            const profile = await getUserProfileByUid(otherUserId);
            return {
              ...request,
              otherUserUsername: profile?.username,
              otherUserProfile: profile
                ? {
                    username: profile.username,
                    displayName: profile.displayName,
                    avatarConfig: profile.avatarConfig,
                  }
                : undefined,
            };
          }),
        );

        setPendingRequests(requestsWithProfiles);
      },
      (error) => {
        logger.error("Error in requests (to) listener:", error);
      },
    );

    const unsubscribeRequestsFrom = onSnapshot(
      fromQuery,
      async () => {
        logger.info("🔵 [FriendsScreen] Real-time requests update received");
        // Reload all requests when any change happens
        const requestsData = await getPendingRequests(uid);

        // Fetch user profiles for each request
        const requestsWithProfiles = await Promise.all(
          requestsData.map(async (request) => {
            const otherUserId =
              request.from === uid ? request.to : request.from;
            const profile = await getUserProfileByUid(otherUserId);
            return {
              ...request,
              otherUserUsername: profile?.username,
              otherUserProfile: profile
                ? {
                    username: profile.username,
                    displayName: profile.displayName,
                    avatarConfig: profile.avatarConfig,
                  }
                : undefined,
            };
          }),
        );

        setPendingRequests(requestsWithProfiles);
      },
      (error) => {
        logger.error("Error in requests (from) listener:", error);
      },
    );

    // Cleanup listeners on unmount
    return () => {
      unsubscribeFriends();
      unsubscribeRequestsTo();
      unsubscribeRequestsFrom();
    };
  }, [uid]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ---- Add Friend autocomplete search ----
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
      }, 200);
    },
    [uid],
  );

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // Determine friend status for a given uid
  const getFriendStatus = useCallback(
    (targetUid: string): "friends" | "requested" | "incoming" | "none" => {
      // Already friends?
      const isFriend = friends.some((f) => f.users.includes(targetUid));
      if (isFriend) return "friends";

      // Sent request?
      const sentReq = pendingRequests.find(
        (r) => r.from === uid && r.to === targetUid && r.status === "pending",
      );
      if (sentReq) return "requested";

      // Incoming request?
      const inReq = pendingRequests.find(
        (r) => r.to === uid && r.from === targetUid && r.status === "pending",
      );
      if (inReq) return "incoming";

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
        await loadData();
      } catch (error: any) {
        Alert.alert(
          "Error",
          error.message || "Failed to send connection request",
        );
      } finally {
        setAddFriendSending(null);
      }
    },
    [uid, loadData],
  );

  const handleCloseAddFriendModal = useCallback(() => {
    setAddFriendModalVisible(false);
    setAddFriendQuery("");
    setAddFriendResults([]);
    setAddFriendSearching(false);
  }, []);

  const handleAcceptRequest = useCallback(
    async (requestId: string) => {
      try {
        await acceptFriendRequest(requestId);
        Alert.alert("Success", "Connection request accepted!");
        await loadData();
      } catch {
        Alert.alert("Error", "Failed to accept request");
      }
    },
    [loadData],
  );

  const handleDeclineRequest = useCallback(
    async (requestId: string) => {
      try {
        await declineFriendRequest(requestId);
        Alert.alert("Success", "Connection request declined");
        await loadData();
      } catch {
        Alert.alert("Error", "Failed to decline request");
      }
    },
    [loadData],
  );

  const handleCancelRequest = useCallback(
    async (requestId: string) => {
      try {
        await cancelFriendRequest(requestId);
        Alert.alert("Success", "Connection request canceled");
        await loadData();
      } catch {
        Alert.alert("Error", "Failed to cancel request");
      }
    },
    [loadData],
  );

  const handleRemoveFriend = useCallback(
    async (friendUid: string) => {
      if (!uid) return;

      // Confirm removal using Alert (works on both native and web)
      Alert.alert(
        "Remove Connection",
        "Are you sure you want to remove this connection?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await removeFriend(uid, friendUid);
                await loadData();
                Alert.alert("Success", "Connection removed");
              } catch {
                Alert.alert("Error", "Failed to remove connection");
              }
            },
          },
        ],
      );
    },
    [uid, loadData],
  );

  // Block/Report handlers
  const handleOpenMenu = useCallback((userId: string) => {
    setMenuVisible(userId);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuVisible(null);
  }, []);

  const handleBlockPress = useCallback((userId: string, username: string) => {
    handleCloseMenu();
    setSelectedUser({ uid: userId, username });
    setBlockModalVisible(true);
  }, []);

  const handleReportPress = useCallback((userId: string, username: string) => {
    handleCloseMenu();
    setSelectedUser({ uid: userId, username });
    setReportModalVisible(true);
  }, []);

  const handleBlockConfirm = async (reason?: string) => {
    if (!uid || !selectedUser) return;

    try {
      await blockUser(uid, selectedUser.uid, reason);
      setBlockModalVisible(false);
      setSelectedUser(null);
      Alert.alert("User Blocked", `${selectedUser.username} has been blocked.`);
      await loadData(); // Refresh to remove blocked user from list
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to block user");
    }
  };

  const handleReportComplete = () => {
    setReportModalVisible(false);
    setSelectedUser(null);
  };

  const handleReportSubmit = async (
    reason: ReportReason,
    description?: string,
  ) => {
    if (!uid || !selectedUser) return;

    try {
      await submitReport(uid, selectedUser.uid, reason, {
        description,
        relatedContent: { type: "profile" },
      });
      Alert.alert(
        "Report Submitted",
        "Thank you for helping keep our community safe.",
      );
      handleReportComplete();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit report");
    }
  };

  // Separate pending requests
  const receivedRequests = pendingRequests.filter((r) => r.to === uid);
  const sentRequests = pendingRequests.filter((r) => r.from === uid);

  // Filter friends and requests by search query
  const normalizedQuery = searchQuery.trim().toLowerCase();

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

  const filteredReceivedRequests = useMemo(() => {
    if (!normalizedQuery) return receivedRequests;
    return receivedRequests.filter((r) => {
      const name = r.otherUserProfile?.username?.toLowerCase() || "";
      const display = r.otherUserProfile?.displayName?.toLowerCase() || "";
      return (
        name.includes(normalizedQuery) || display.includes(normalizedQuery)
      );
    });
  }, [receivedRequests, normalizedQuery]);

  const filteredSentRequests = useMemo(() => {
    if (!normalizedQuery) return sentRequests;
    return sentRequests.filter((r) => {
      const name = (
        r.otherUserUsername ||
        r.otherUserProfile?.username ||
        ""
      ).toLowerCase();
      return name.includes(normalizedQuery);
    });
  }, [sentRequests, normalizedQuery]);

  // Total request count for tab badge
  const requestCount =
    filteredReceivedRequests.length + filteredSentRequests.length;

  // Navigation helpers
  const navigateToProfile = useCallback(
    (userId: string) => {
      navigation.navigate("UserProfile", { userId });
    },
    [navigation],
  );

  const navigateToChat = useCallback(
    (friendUid: string) => {
      navigation.navigate("ChatDetail", { friendUid });
    },
    [navigation],
  );

  // =========================================================================
  // Render
  // =========================================================================

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Appbar.Header style={{ backgroundColor: colors.surface }} elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Connections" />
        </Appbar.Header>
        <LoadingState message="Loading connections..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Appbar.Header style={{ backgroundColor: colors.surface }} elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Connections" />
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
        <Appbar.Content title="Connections" />
        <Appbar.Action
          icon="account-plus-outline"
          onPress={() => setAddFriendModalVisible(true)}
          accessibilityLabel="Add connection"
        />
      </Appbar.Header>

      {/* ── Search ──────────────────────────────────────────────── */}
      <View
        style={[styles.searchContainer, { backgroundColor: colors.surface }]}
      >
        <Searchbar
          placeholder="Search connections..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={[styles.searchbar, { backgroundColor: colors.surfaceVariant }]}
          inputStyle={{ fontSize: 14 }}
          elevation={0}
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
          onPress={() => setActiveTab("all")}
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
            All ({filteredFriends.length})
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
          onPress={() => setActiveTab("requests")}
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
            {requestCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.error }]}>
                <Text style={styles.badgeText}>{requestCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Content: All connections ────────────────────────────── */}
      {activeTab === "all" && (
        <FlatList
          data={filteredFriends}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            filteredReceivedRequests.length > 0 ? (
              <View style={styles.inlineRequestsBanner}>
                <TouchableOpacity
                  style={[
                    styles.requestsBannerBtn,
                    { backgroundColor: colors.tertiaryContainer },
                  ]}
                  onPress={() => setActiveTab("requests")}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="account-clock-outline"
                    size={20}
                    color={colors.onTertiaryContainer}
                  />
                  <Text
                    style={[
                      styles.requestsBannerText,
                      { color: colors.onTertiaryContainer },
                    ]}
                  >
                    {filteredReceivedRequests.length} pending request
                    {filteredReceivedRequests.length !== 1 ? "s" : ""}
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={colors.onTertiaryContainer}
                  />
                </TouchableOpacity>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="account-group-outline"
              title="No connections yet"
              subtitle="Connect with others to start chatting and building streaks!"
              actionLabel="Add Connection"
              onAction={() => setAddFriendModalVisible(true)}
            />
          }
          renderItem={({ item: friend }) => {
            const friendUid = friend.users.find((u) => u !== uid) || "";
            return (
              <ConnectionRow
                friend={friend}
                friendUid={friendUid}
                uid={uid || ""}
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
            ...filteredReceivedRequests.map((r) => ({
              ...r,
              _type: "received" as const,
            })),
            ...filteredSentRequests.map((r) => ({
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
            filteredReceivedRequests.length > 0 ||
            filteredSentRequests.length > 0 ? (
              <View style={styles.requestSectionLabels}>
                {filteredReceivedRequests.length > 0 && (
                  <Text
                    style={[
                      styles.sectionLabel,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    Received ({filteredReceivedRequests.length})
                  </Text>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="email-open-outline"
              title="No requests"
              subtitle="When someone sends you a connection request, it will appear here."
            />
          }
          renderItem={({ item, index }) => {
            const isFirstSent =
              item._type === "sent" &&
              (index === 0 ||
                (filteredReceivedRequests.length > 0 &&
                  index === filteredReceivedRequests.length));

            return (
              <>
                {isFirstSent && filteredReceivedRequests.length > 0 && (
                  <View style={styles.sentSectionLabelWrap}>
                    <Text
                      style={[
                        styles.sectionLabel,
                        { color: colors.onSurfaceVariant },
                      ]}
                    >
                      Sent ({filteredSentRequests.length})
                    </Text>
                  </View>
                )}
                {isFirstSent && filteredReceivedRequests.length === 0 && (
                  <View style={styles.sentSectionLabelWrap}>
                    <Text
                      style={[
                        styles.sectionLabel,
                        { color: colors.onSurfaceVariant },
                      ]}
                    >
                      Sent ({filteredSentRequests.length})
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
                />
              </>
            );
          }}
          ItemSeparatorComponent={() => <Divider style={{ marginLeft: 72 }} />}
        />
      )}

      {/* ── Add Connection Modal ───────────────────────────────── */}
      <Modal
        visible={addFriendModalVisible}
        onRequestClose={handleCloseAddFriendModal}
        transparent
        animationType="slide"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
          >
            {/* Header row */}
            <View style={styles.modalHeaderRow}>
              <Text
                variant="headlineSmall"
                style={[styles.modalTitle, { color: colors.onSurface }]}
              >
                Add Connection
              </Text>
              <IconButton
                icon="close"
                size={22}
                onPress={handleCloseAddFriendModal}
                accessibilityLabel="Close"
              />
            </View>

            {/* Search input */}
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

            {/* Results area */}
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
                    name="magnify"
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
                    <TouchableOpacity
                      style={[
                        styles.searchResultRow,
                        { borderBottomColor: colors.outlineVariant },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        if (status === "none") {
                          handleSendRequestFromSearch(item.username, item.uid);
                        }
                      }}
                      disabled={status !== "none" || isSending}
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
                            Requested
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
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Block User Modal */}
      <BlockUserModal
        visible={blockModalVisible}
        username={selectedUser?.username || ""}
        onCancel={() => {
          setBlockModalVisible(false);
          setSelectedUser(null);
        }}
        onConfirm={handleBlockConfirm}
      />

      {/* Report User Modal */}
      {selectedUser && (
        <ReportUserModal
          visible={reportModalVisible}
          username={selectedUser.username}
          onSubmit={handleReportSubmit}
          onCancel={handleReportComplete}
        />
      )}
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
    height: 42,
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

  /* Connection row (shared between ConnectionRow + RequestCard) */
  connectionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  connectionInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  connectionName: {
    fontSize: 15,
    fontWeight: "600",
  },
  connectionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  connectionActions: {
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
  streakBadgeText: {
    color: "#fff",
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
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButton: {},
  declineButton: {
    marginLeft: 6,
  },

  /* Inline requests banner on All tab */
  inlineRequestsBanner: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  requestsBannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    gap: 8,
  },
  requestsBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },

  /* Section labels for request tab */
  requestSectionLabels: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sentSectionLabelWrap: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 4,
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
    paddingBottom: Spacing.lg,
    maxHeight: "85%",
    minHeight: 340,
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
