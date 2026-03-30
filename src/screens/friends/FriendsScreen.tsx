/**
 * FriendsScreen — Clean alphabetical friends list with letter dividers.
 *
 * Two-stage architecture:
 * - Stage 1 (this screen): Alphabetical friends list, pending requests,
 *   search bar, "Add Friends" header button.
 * - Stage 2 (AddFriendsSheet): 3-tile bottom sheet (Share Invite, QR Code,
 *   Quick Add) opened via header button.
 *
 * @module screens/friends/FriendsScreen
 */

import BlockUserModal from "@/components/BlockUserModal";
import {
  QRCodeSheet,
  QuickAddSheet,
  SectionHeader,
} from "@/components/friends";
import AddFriendsSheet from "@/components/friends/AddFriendsSheet";
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
import { shareInviteLink, shareProfileLink } from "@/services/invites";
import { submitReport } from "@/services/reporting";
import { markNotificationsReadByTypes } from "@/services/userNotifications";
import { useAuth } from "@/store/AuthContext";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";
import {
  AvatarConfig,
  Friend,
  FriendRequest,
  ReportReason,
} from "@/types/models";
import * as haptics from "@/utils/haptics";
import { createLogger } from "@/utils/log";
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
  LayoutAnimation,
  Platform,
  RefreshControl,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import {
  Button,
  Divider,
  IconButton,
  Menu,
  Searchbar,
  Snackbar,
  Text,
  useTheme,
} from "react-native-paper";
// Appbar removed — header is now custom Animated.View with safe area insets
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { shareInviteToContact } from "@/services/invites";

const logger = createLogger("screens/friends/FriendsScreen");

const AnimatedSectionList = Animated.createAnimatedComponent(
  SectionList<FriendWithProfile, AlphaSection>,
);

// Header animation constants
const HEADER_ROW_HEIGHT = 48;
const SEARCH_ROW_HEIGHT = 38;
const HEADER_EXPANDED = HEADER_ROW_HEIGHT + SEARCH_ROW_HEIGHT; // content height (excl. inset)
const HEADER_COLLAPSED = HEADER_ROW_HEIGHT; // content height (excl. inset)
const SCROLL_RANGE = 60; // scroll distance over which the transition occurs
const SEARCH_BAR_HEIGHT_EXPANDED = 32;
const SEARCH_BAR_HEIGHT_COLLAPSED = 30;

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

interface AlphaSection {
  title: string;
  data: FriendWithProfile[];
}

// =============================================================================
// Helpers
// =============================================================================

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

/** Group friends alphabetically by first letter of username. */
function groupAlphabetically(
  friends: FriendWithProfile[],
  uid?: string,
): AlphaSection[] {
  const sorted = [...friends].sort((a, b) => {
    const aName = (a.otherUserProfile?.username || "").toLowerCase();
    const bName = (b.otherUserProfile?.username || "").toLowerCase();
    return aName.localeCompare(bName);
  });

  const map = new Map<string, FriendWithProfile[]>();
  for (const friend of sorted) {
    const firstChar = (friend.otherUserProfile?.username ||
      "?")[0].toUpperCase();
    const letter = /[A-Z]/.test(firstChar) ? firstChar : "#";
    if (!map.has(letter)) map.set(letter, []);
    map.get(letter)!.push(friend);
  }

  return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
}

// =============================================================================
// Subcomponents — Request Card
// =============================================================================

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
    <View style={styles.cardWrapper}>
      <TouchableOpacity
        style={[styles.friendCard, { backgroundColor: colors.surface }]}
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
                  <ActivityIndicator
                    size={14}
                    color={colors.onSurfaceVariant}
                  />
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
    </View>
  );
});

// =============================================================================
// Subcomponents — Friend Row
// =============================================================================

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
    <View style={styles.cardWrapper}>
      <TouchableOpacity
        style={[styles.friendCard, { backgroundColor: colors.surface }]}
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
              style={[
                styles.friendSubtitle,
                { color: colors.onSurfaceVariant },
              ]}
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
    </View>
  );
});

// =============================================================================
// Main Screen
// =============================================================================

// =============================================================================
// Subcomponents — Alphabet Rail
// =============================================================================

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

const AlphabetRail = React.memo(function AlphabetRail({
  availableLetters,
  onSelect,
  colors,
}: {
  availableLetters: Set<string>;
  onSelect: (letter: string) => void;
  colors: any;
}) {
  return (
    <View style={styles.railContainer} pointerEvents="box-none">
      {ALPHABET.map((letter) => {
        const exists = availableLetters.has(letter);
        return (
          <TouchableOpacity
            key={letter}
            onPress={() => exists && onSelect(letter)}
            hitSlop={{ left: 8, right: 8 }}
            style={styles.railLetter}
            activeOpacity={exists ? 0.5 : 1}
          >
            <Text
              style={[
                styles.railLetterText,
                {
                  color: exists ? colors.primary : colors.outlineVariant,
                  fontWeight: exists ? "700" : "400",
                },
              ]}
            >
              {letter}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

// =============================================================================
// Main Screen
// =============================================================================

export default function FriendsScreen({ navigation }: any) {
  const { currentFirebaseUser } = useAuth();
  const { setCurrentScreen } = useInAppNotifications();
  const route = useRoute<any>();
  const uid = currentFirebaseUser?.uid;
  const theme = useTheme();
  const { colors } = theme;
  const sectionListRef = useRef<SectionList>(null);
  const insets = useSafeAreaInsets();

  // ── Scroll-driven header animation ─────────────────────────────
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const safeTop = insets.top;
  const headerAnimStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollY.value,
      [0, SCROLL_RANGE],
      [safeTop + HEADER_EXPANDED, safeTop + HEADER_COLLAPSED],
      Extrapolation.CLAMP,
    ),
  }));

  const titleAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, SCROLL_RANGE * 0.5],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, SCROLL_RANGE * 0.5],
          [0, -6],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const searchBarAnimStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollY.value,
      [0, SCROLL_RANGE],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        {
          translateY: interpolate(progress, [0, 1], [0, -SEARCH_ROW_HEIGHT]),
        },
      ],
      marginHorizontal: interpolate(progress, [0, 1], [Spacing.sm, 48]),
      height: interpolate(
        progress,
        [0, 1],
        [SEARCH_BAR_HEIGHT_EXPANDED, SEARCH_BAR_HEIGHT_COLLAPSED],
      ),
    };
  });

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

  // Request action in progress
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Snackbar
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

  // Section collapse
  const [requestsExpanded, setRequestsExpanded] = useState(true);

  // Add Friends sheet
  const [addFriendsOpen, setAddFriendsOpen] = useState(false);

  // QR modal
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrMode, setQrMode] = useState<"myCode" | "scan">("myCode");

  // Quick Add
  const [quickAddVisible, setQuickAddVisible] = useState(false);

  // Block/Report
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
      setRequestsExpanded(true);
      navigation.setParams({ tab: undefined });
    }
  }, [route.params?.tab, navigation]);

  // ── Mark notifications read ────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      markNotificationsReadByTypes(uid, [
        "friend_request",
        "friend_request_accepted",
      ]).catch((err) => {
        logger.warn("Failed to mark social notifications read", err);
      });
    }, [uid]),
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

      const requestsWithProfiles: RequestWithProfile[] = await Promise.all(
        requestsData.map(async (request) => {
          const otherUserId = request.from === uid ? request.to : request.from;
          const profile = await getUserProfileByUid(otherUserId);
          return { ...request, otherUserProfile: extractProfile(profile) };
        }),
      );

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

    // Friends listener
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

    // Requests listeners
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

  // ── Friend Request Actions ─────────────────────────────────────

  const handleSendRequest = useCallback(
    async (targetUsername: string, targetUid?: string) => {
      if (!uid) return;
      try {
        await sendFriendRequest(uid, targetUsername);
        haptics.buttonPress();
        showSnackbar("Friend request sent!");
        await loadData();
      } catch (error: any) {
        showSnackbar(error.message || "Failed to send request", "error");
      }
    },
    [uid, loadData, showSnackbar],
  );

  const handleAcceptRequest = useCallback(
    async (requestId: string) => {
      if (actionInProgress) return;
      setActionInProgress(requestId);
      haptics.buttonPress();
      try {
        await acceptFriendRequest(requestId);
        showSnackbar("Friend added!");
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

  // ── Add Friends Sheet Actions ──────────────────────────────────

  const currentUsername = currentFirebaseUser?.displayName || "user";

  const handleShareInvite = useCallback(async () => {
    if (!uid) return;
    setAddFriendsOpen(false);
    const result = await shareInviteLink(uid, currentUsername);
    if (result === "shared") showSnackbar("Invite shared!");
    else if (result === "error") showSnackbar("Failed to share", "error");
  }, [uid, currentUsername, showSnackbar]);

  const handleOpenQR = useCallback(() => {
    setAddFriendsOpen(false);
    setQrMode("myCode");
    setQrModalVisible(true);
  }, []);

  const handleOpenQuickAdd = useCallback(() => {
    setAddFriendsOpen(false);
    setQuickAddVisible(true);
  }, []);

  // ── QR Actions ─────────────────────────────────────────────────

  const handleQrScan = useCallback(
    (data: string) => {
      const profileMatch = data.match(/\/u\/([^/?\s]+)/);
      const inviteMatch = data.match(/\/invite\/([^/?\s]+)/);

      if (profileMatch) {
        const username = profileMatch[1];
        setQrModalVisible(false);
        handleSendRequest(username);
        showSnackbar(`Found user: @${username}`);
      } else if (inviteMatch) {
        setQrModalVisible(false);
        showSnackbar("Invite code scanned!");
      } else {
        showSnackbar("Unrecognized QR code", "error");
      }
    },
    [handleSendRequest, showSnackbar],
  );

  const handleQrShare = useCallback(async () => {
    if (!currentUsername) return;
    await shareProfileLink(currentUsername);
  }, [currentUsername]);

  // ── Quick Add Actions ──────────────────────────────────────────

  const handleQuickAddUser = useCallback(
    (targetUid: string, username: string) => {
      setQuickAddVisible(false);
      handleSendRequest(username, targetUid);
    },
    [handleSendRequest],
  );

  const handleQuickAddInvite = useCallback(
    async (contactInfo: string) => {
      if (!uid) return;
      await shareInviteToContact(uid, contactInfo);
    },
    [uid],
  );

  const handleQuickAddSearchUsername = useCallback(
    (usernameQuery: string) => {
      setQuickAddVisible(false);
      handleSendRequest(usernameQuery);
    },
    [handleSendRequest],
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

  const alphaSections = useMemo(
    () => groupAlphabetically(filteredFriends, uid),
    [filteredFriends, uid],
  );

  const availableLetters = useMemo(
    () => new Set(alphaSections.map((s) => s.title)),
    [alphaSections],
  );

  const scrollToSection = useCallback(
    (letter: string) => {
      const idx = alphaSections.findIndex((s) => s.title === letter);
      if (idx < 0 || !sectionListRef.current) return;
      sectionListRef.current.scrollToLocation({
        sectionIndex: idx,
        itemIndex: 0,
        viewOffset: 0,
        animated: true,
      });
    },
    [alphaSections],
  );

  const receivedCount = receivedRequests.length;
  const totalRequestCount = receivedCount + sentRequests.length;

  // ── Navigation ─────────────────────────────────────────────────

  const navigateToProfile = useCallback(
    (userId: string) => navigation.navigate("UserProfile", { userId }),
    [navigation],
  );

  const navigateToChat = useCallback(
    (friendUid: string) => navigation.navigate("ChatDetail", { friendUid }),
    [navigation],
  );

  // ── Toggle sections ────────────────────────────────────────────

  const toggleRequests = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRequestsExpanded((prev) => !prev);
  }, []);

  // ── Get current user's profile for QR ──────────────────────────

  const myUsername = currentFirebaseUser?.displayName || "user";
  const myDisplayName = currentFirebaseUser?.displayName || "";

  // =========================================================================
  // Render
  // =========================================================================

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.staticHeader,
            { backgroundColor: colors.surface, paddingTop: insets.top },
          ]}
        >
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
          />
          <Text
            variant="titleLarge"
            style={[styles.headerTitle, { color: colors.onSurface, flex: 1 }]}
          >
            Friends
          </Text>
        </View>
        <LoadingState message="Loading your friends..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.staticHeader,
            { backgroundColor: colors.surface, paddingTop: insets.top },
          ]}
        >
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
          />
          <Text
            variant="titleLarge"
            style={[styles.headerTitle, { color: colors.onSurface, flex: 1 }]}
          >
            Friends
          </Text>
        </View>
        <ErrorState
          title="Something went wrong"
          message={error}
          onRetry={loadData}
        />
      </View>
    );
  }

  // ---------- Requests header rendered in SectionList ----------

  const renderRequestsHeader = () => {
    if (totalRequestCount === 0) return null;
    return (
      <>
        <SectionHeader
          title="Pending Requests"
          icon="account-clock-outline"
          count={receivedCount}
          collapsed={!requestsExpanded}
          onToggle={toggleRequests}
        />
        {requestsExpanded && (
          <>
            {receivedRequests.map((request) => (
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
            {sentRequests.length > 0 && (
              <View style={styles.sentLabel}>
                <Text
                  variant="labelSmall"
                  style={{ color: colors.onSurfaceVariant }}
                >
                  Sent ({sentRequests.length})
                </Text>
              </View>
            )}
            {sentRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                type="sent"
                uid={uid || ""}
                onAccept={handleAcceptRequest}
                onDecline={handleDeclineRequest}
                onCancel={handleCancelRequest}
                onNavigateProfile={navigateToProfile}
                colors={colors}
                isActionInProgress={actionInProgress === request.id}
              />
            ))}
            <Divider style={{ marginTop: Spacing.sm }} />
          </>
        )}
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Animated Header ─────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.headerContainer,
          { backgroundColor: colors.surface, paddingTop: insets.top },
          headerAnimStyle,
        ]}
      >
        {/* Top row: back arrow | title | add friend */}
        <View style={styles.headerTopRow}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
            accessibilityLabel="Go back"
          />
          <Animated.View style={[styles.titleContainer, titleAnimStyle]}>
            <Text
              variant="titleLarge"
              style={[styles.headerTitle, { color: colors.onSurface }]}
              numberOfLines={1}
            >
              Friends
            </Text>
            {friends.length > 0 && (
              <Text
                variant="bodySmall"
                style={{ color: colors.onSurfaceVariant }}
              >
                {friends.length} friend{friends.length !== 1 ? "s" : ""}
              </Text>
            )}
          </Animated.View>
          <IconButton
            icon="account-plus-outline"
            size={24}
            onPress={() => setAddFriendsOpen(true)}
            style={styles.headerBtn}
            accessibilityLabel="Add friends"
          />
        </View>

        {/* Search bar — animates from row 2 up into row 1 */}
        <Animated.View style={[styles.searchAnimWrapper, searchBarAnimStyle]}>
          <Searchbar
            placeholder="Search friends..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={[
              styles.searchbar,
              { backgroundColor: colors.surfaceVariant },
            ]}
            inputStyle={styles.searchInput}
            elevation={0}
            accessibilityLabel="Search friends"
          />
        </Animated.View>
      </Animated.View>

      {/* ── Main Content — Alphabetical SectionList ─────────────── */}
      <View style={{ flex: 1 }}>
        <AnimatedSectionList
          ref={sectionListRef as any}
          sections={alphaSections}
          keyExtractor={(item: FriendWithProfile) => item.id}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          onScrollToIndexFailed={() => {}}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={normalizedQuery ? null : renderRequestsHeader}
          ListEmptyComponent={
            normalizedQuery ? (
              <EmptyState
                icon="account-search-outline"
                title="No matches"
                subtitle={`No friends matching "${searchQuery.trim()}"`}
              />
            ) : friends.length === 0 ? (
              <EmptyState
                icon="account-heart-outline"
                title="No friends yet"
                subtitle="Tap + to find people to play games and chat with!"
                actionLabel="Add Friends"
                onAction={() => setAddFriendsOpen(true)}
              />
            ) : null
          }
          renderSectionHeader={({
            section: { title },
          }: {
            section: AlphaSection;
          }) => (
            <View
              style={[
                styles.sectionHeader,
                { backgroundColor: colors.background },
              ]}
            >
              <Text
                variant="labelLarge"
                style={[styles.sectionLetter, { color: colors.primary }]}
              >
                {title}
              </Text>
            </View>
          )}
          renderItem={({ item: friend }: { item: FriendWithProfile }) => {
            const friendUid = friend.users.find((u: string) => u !== uid) || "";
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
        />
        {alphaSections.length > 1 && (
          <AlphabetRail
            availableLetters={availableLetters}
            onSelect={scrollToSection}
            colors={colors}
          />
        )}
      </View>

      {/* ── Add Friends Sheet ──────────────────────────────────── */}
      <AddFriendsSheet
        open={addFriendsOpen}
        onClose={() => setAddFriendsOpen(false)}
        onShareInvite={handleShareInvite}
        onQRCode={handleOpenQR}
        onQuickAdd={handleOpenQuickAdd}
        onSendRequest={(username, targetUid) => {
          setAddFriendsOpen(false);
          handleSendRequest(username, targetUid);
        }}
        onNavigateProfile={(userId) => {
          setAddFriendsOpen(false);
          navigateToProfile(userId);
        }}
      />

      {/* ── QR Code Modal ──────────────────────────────────────── */}
      <QRCodeSheet
        visible={qrModalVisible}
        mode={qrMode}
        username={myUsername}
        displayName={myDisplayName}
        onShare={handleQrShare}
        onScan={handleQrScan}
        onClose={() => setQrModalVisible(false)}
        onSwitchMode={setQrMode}
      />

      {/* ── Quick Add Modal ────────────────────────────────────── */}
      <QuickAddSheet
        visible={quickAddVisible}
        currentUid={uid || ""}
        onClose={() => setQuickAddVisible(false)}
        onAddUser={handleQuickAddUser}
        onInviteContact={handleQuickAddInvite}
        onSearchUsername={handleQuickAddSearchUsername}
      />

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

  /* Animated header */
  headerContainer: {
    overflow: "hidden",
  },
  headerTopRow: {
    height: HEADER_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
  },
  headerBtn: {
    margin: 0,
  },
  titleContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontWeight: "700",
  },

  /* Static header (loading / error states) */
  staticHeader: {
    flexDirection: "row",
    alignItems: "center",
    height: HEADER_ROW_HEIGHT,
    paddingHorizontal: 4,
  },

  /* Animated search bar */
  searchAnimWrapper: {
    height: SEARCH_BAR_HEIGHT_EXPANDED,
    justifyContent: "center",
    marginHorizontal: Spacing.sm,
  },
  searchbar: {
    borderRadius: BorderRadius.full,
    flex: 1,
    justifyContent: "center",
    height: SEARCH_BAR_HEIGHT_EXPANDED,
    minHeight: 0,
  },
  searchInput: {
    fontSize: 13,
    alignSelf: "center",
    paddingVertical: 0,
    minHeight: 0,
  },

  /* List */
  listContent: {
    flexGrow: 1,
    paddingBottom: 32,
    paddingRight: 20,
  },

  /* Section header (letter divider) */
  sectionHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  sectionLetter: {
    fontWeight: "700",
    fontSize: 14,
  },

  /* Friend card */
  cardWrapper: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 1 },
      },
      android: {
        elevation: 1,
      },
    }),
  },

  /* Alphabet rail */
  railContainer: {
    position: "absolute",
    right: 2,
    top: 0,
    bottom: 0,
    width: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  railLetter: {
    paddingVertical: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  railLetterText: {
    fontSize: 10,
    lineHeight: 14,
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

  /* Sent label in requests */
  sentLabel: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 2,
  },
});
