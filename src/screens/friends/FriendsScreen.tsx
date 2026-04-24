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
import FriendInviteConfirmModal from "@/components/friends/FriendInviteConfirmModal";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import ReportUserModal from "@/components/ReportUserModal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { CALL_FEATURES } from "@/constants/featureFlags";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useStreamCall } from "@/contexts/StreamCallContext";
import { blockUser } from "@/services/blocking";
import { getOrCreateChat } from "@/services/chat";
import { prepareDmThreadEntry } from "@/services/chat/threadIdentityWarmup";
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
import {
  parseInviteUrl,
  shareInviteLink,
  shareProfileLink,
  type ParsedInvite,
} from "@/services/invites";
import { submitReport } from "@/services/reporting";
import { markNotificationsReadByTypes } from "@/services/userNotifications";
import { useAuth } from "@/store/AuthContext";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";
import { useIsDark } from "@/store/ThemeContext";
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
  Dimensions,
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
const HEADER_EXPANDED = HEADER_ROW_HEIGHT + SEARCH_ROW_HEIGHT;
const HEADER_COLLAPSED = HEADER_ROW_HEIGHT;
const SEARCH_BAR_HEIGHT = 32;
// SCROLL_RANGE must match the search bar's actual travel distance so
// the bar and the 1:1-scrolling content stay visually synchronized.
// Travel = searchExpandedTop − searchCollapsedTop
//        = (HEADER_ROW_HEIGHT + (SEARCH_ROW_HEIGHT − SEARCH_BAR_HEIGHT) / 2)
//          − ((HEADER_ROW_HEIGHT − SEARCH_BAR_HEIGHT) / 2)
//        = SEARCH_ROW_HEIGHT  (= 38 + a small centering remainder = 43)
const SCROLL_RANGE =
  HEADER_ROW_HEIGHT +
  (SEARCH_ROW_HEIGHT - SEARCH_BAR_HEIGHT) / 2 -
  (HEADER_ROW_HEIGHT - SEARCH_BAR_HEIGHT) / 2;
// Horizontal space reserved for back / add-friends IconButtons.
// react-native-paper IconButton default touch target is 48.
const ICON_BTN_WIDTH = 48;

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
  onCall,
  callEnabled,
  callDisabled,
  messageLoading,
  callLoading,
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
  onCall: () => void;
  callEnabled: boolean;
  callDisabled: boolean;
  messageLoading: boolean;
  callLoading: boolean;
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
          {callEnabled && (
            <TouchableOpacity
              style={[
                styles.callBtn,
                { backgroundColor: colors.primaryContainer },
                (callDisabled || callLoading) && styles.actionBtnDisabled,
              ]}
              onPress={onCall}
              disabled={callDisabled || callLoading}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={`Call ${friend.otherUserProfile?.username || "friend"}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: callDisabled || callLoading }}
            >
              {callLoading ? (
                <ActivityIndicator
                  size="small"
                  color={colors.onPrimaryContainer}
                />
              ) : (
                <MaterialCommunityIcons
                  name="phone-outline"
                  size={18}
                  color={colors.onPrimaryContainer}
                />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.messageBtn,
              { backgroundColor: colors.primaryContainer },
              messageLoading && styles.actionBtnDisabled,
            ]}
            onPress={onMessage}
            disabled={messageLoading}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={`Message ${friend.otherUserProfile?.username || "friend"}`}
            accessibilityRole="button"
            accessibilityState={{ disabled: messageLoading }}
          >
            {messageLoading ? (
              <ActivityIndicator
                size="small"
                color={colors.onPrimaryContainer}
              />
            ) : (
              <MaterialCommunityIcons
                name="message-text-outline"
                size={18}
                color={colors.onPrimaryContainer}
              />
            )}
          </TouchableOpacity>
          <Menu
            key={menuVisible ? "open" : "closed"}
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
  const isDark = useIsDark();
  // ── Friends-screen header/search surfaces ─────────────────────
  // Keep the header/page on the theme background. In light mode this makes the
  // header white like the other primary screens, while the search pill gets a
  // softer grey treatment below.
  const colors = theme.colors;
  const searchBackground = isDark ? colors.surface : colors.surfaceVariant;
  const sectionListRef = useRef<SectionList>(null);
  const insets = useSafeAreaInsets();

  // ── Scroll-driven header animation ─────────────────────────────
  const scrollY = useSharedValue(0);
  const { width: screenWidth } = Dimensions.get("window");
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = Math.max(0, event.contentOffset.y);
    },
  });

  // ── ANIMATION ARCHITECTURE (jitter-free) ────────────────────
  // • Header has a FIXED layout height (HEADER_EXPANDED).  NO animated
  //   height or translateY on the header itself.
  // • The back/add-friends buttons NEVER move.
  // • The search bar is ABSOLUTELY POSITIONED inside the header so
  //   its position/size changes don’t affect any sibling layout.
  //   It animates from row-2 (full-width) to row-1 (narrower, between
  //   the back and add-friends buttons).
  // • The list has a STATIC negative marginTop of -SEARCH_ROW_HEIGHT,
  //   so it overlaps the header’s empty row-2 area.  As the user
  //   scrolls, list content covers that space naturally.
  // • The title text fades out as the search bar takes its place.

  // -- Header background slide-up --
  // The header has a fixed layout height but the visible background
  // surface needs to shrink as the search bar moves into row 1.
  // An absolutely-positioned background view translates up to pull
  // the bottom edge with the search bar.  The headerOuter clips it.
  const headerBgStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, SCROLL_RANGE],
          [0, -SEARCH_ROW_HEIGHT],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // -- Title fade --
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

  // -- Search bar position/size --
  // Expanded: row 2, full width (inset by Spacing.sm = 8 on each side)
  // Collapsed: row 1, narrower (between the two 48px icon buttons)
  const searchExpandedTop =
    HEADER_ROW_HEIGHT + (SEARCH_ROW_HEIGHT - SEARCH_BAR_HEIGHT) / 2;
  const searchCollapsedTop = (HEADER_ROW_HEIGHT - SEARCH_BAR_HEIGHT) / 2;
  const searchExpandedLeft = Spacing.sm; // 8
  const searchCollapsedLeft = ICON_BTN_WIDTH;
  const searchExpandedRight = Spacing.sm; // 8
  const searchCollapsedRight = ICON_BTN_WIDTH;

  const searchBarAnimStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      scrollY.value,
      [0, SCROLL_RANGE],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      top: interpolate(
        progress,
        [0, 1],
        [searchExpandedTop, searchCollapsedTop],
      ),
      left: interpolate(
        progress,
        [0, 1],
        [searchExpandedLeft, searchCollapsedLeft],
      ),
      right: interpolate(
        progress,
        [0, 1],
        [searchExpandedRight, searchCollapsedRight],
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

  // Friend-invite confirmation (shared by QR scan + inbound deep links)
  const [pendingInvite, setPendingInvite] = useState<ParsedInvite>(null);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);

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

  // ── Auto-open Add Friends sheet from nav params ────────────────
  useEffect(() => {
    if (route.params?.openAddFriends) {
      setAddFriendsOpen(true);
      navigation.setParams({ openAddFriends: undefined });
    }
  }, [route.params?.openAddFriends, navigation]);

  // ── Inbound friend-invite payload (deep link) ──────────────────
  // Triggered when a user taps a `vibe://invite/{code}` link or the
  // equivalent legacy https:// form. The RootNavigator's URL listener
  // parses the URL and navigates here with `pendingInvite` set. We then
  // open the shared confirmation modal and clear the param so it doesn't
  // re-trigger on every re-render.
  useEffect(() => {
    const incoming = route.params?.pendingInvite;
    if (!incoming) return;
    setAddFriendsOpen(false);
    setQrModalVisible(false);
    setPendingInvite(incoming);
    setInviteModalVisible(true);
    navigation.setParams({ pendingInvite: undefined });
  }, [route.params?.pendingInvite, navigation]);

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
    // Fully unmount the previous Menu modal before opening a new one. If
    // we just call setMenuVisible(userId) directly, react-native-paper's
    // Menu can get stuck mid-dismissal-animation after a prior outside-tap:
    // the new `visible=true` arrives before the exit animation has
    // completed, and the Menu immediately runs its dismissal again,
    // producing the "briefly appears then disappears" behavior. Forcing
    // a null-first render guarantees a clean remount of the Menu modal.
    setMenuVisible(null);
    requestAnimationFrame(() => {
      setMenuVisible(userId);
    });
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuVisible(null);
  }, []);

  const handleBlockPress = useCallback((userId: string, username: string) => {
    setMenuVisible(null);
    // Defer modal open until after Menu's dismissal animation completes
    // so the Menu doesn't contend with a new Modal backdrop for focus.
    setTimeout(() => {
      setSelectedUser({ uid: userId, username });
      setBlockModalVisible(true);
    }, 220);
  }, []);

  const handleReportPress = useCallback((userId: string, username: string) => {
    setMenuVisible(null);
    setTimeout(() => {
      setSelectedUser({ uid: userId, username });
      setReportModalVisible(true);
    }, 220);
  }, []);

  const handleBlockConfirm = useCallback(
    async (reason?: string) => {
      if (!uid || !selectedUser) return;
      const success = await blockUser(uid, selectedUser.uid, reason);
      setBlockModalVisible(false);
      setSelectedUser(null);
      if (success) {
        showSnackbar(`${selectedUser.username} has been blocked`);
      } else {
        showSnackbar("Failed to block user. Please try again.", "error");
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
      const parsed = parseInviteUrl(data);
      if (!parsed) {
        showSnackbar("Unrecognized QR code", "error");
        return;
      }
      // Close the scanner and hand off to the shared confirmation UI so
      // invite-code and profile-URL QR codes funnel through one flow.
      setQrModalVisible(false);
      setPendingInvite(parsed);
      setInviteModalVisible(true);
    },
    [showSnackbar],
  );

  const handleQrShare = useCallback(async () => {
    if (!uid || !currentUsername) return;
    await shareProfileLink(uid, currentUsername);
  }, [uid, currentUsername]);

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

  // ── Messaging & Calling ────────────────────────────────────────
  // Fix for the Friends→Message ownership bug: before navigating into a DM
  // we explicitly call getOrCreateChat() here. This materializes the
  // canonical Chats/{chatId} doc BEFORE the ChatDetail screen mounts, so
  // the useInboxData subscription (onSnapshot over Chats where members
  // array-contains uid) picks up the new conversation and it appears on
  // the main Messages screen — even if the user never sends a message
  // and backs out immediately. We also pass the resolved chatId +
  // cached profile data via initialData for instant first-paint, and
  // warm the avatar/decoration assets via prepareDmThreadEntry, matching
  // the pattern used by ChatListScreenV2 and SearchSheet.
  const {
    startCall,
    isBusy: callIsBusy,
    isReady: callIsReady,
  } = useStreamCall();
  const callsUiEnabled =
    CALL_FEATURES.CALLS_ENABLED && CALL_FEATURES.DIRECT_CALLS_ENABLED;
  const [messagingUid, setMessagingUid] = useState<string | null>(null);
  const [callingUid, setCallingUid] = useState<string | null>(null);

  const handleMessagePress = useCallback(
    async (friend: FriendWithProfile, friendUid: string) => {
      if (!uid || !friendUid) return;
      if (messagingUid) return; // duplicate-tap guard
      const profile = friend.otherUserProfile;
      const friendAvatar = profile?.profilePictureUrl || null;
      // Opportunistic asset warmup (fire-and-forget)
      prepareDmThreadEntry({
        avatarUrl: friendAvatar,
        decorationId: profile?.decorationId,
      }).catch(() => {});

      setMessagingUid(friendUid);
      try {
        const chatId = await getOrCreateChat(uid, friendUid);
        navigation.navigate("ChatDetail", {
          friendUid,
          initialData: {
            chatId,
            friendName: profile?.username || profile?.displayName || "",
            friendAvatar,
            friendAvatarConfig: profile?.avatarConfig,
            friendDecorationId: profile?.decorationId || null,
          },
        });
      } catch (error: any) {
        const msg: string = error?.message || "";
        if (msg.includes("Cannot chat with this user")) {
          showSnackbar("You can't message this user", "error");
        } else {
          logger.error("Failed to open DM from Friends:", error);
          showSnackbar("Couldn't open conversation", "error");
        }
      } finally {
        setMessagingUid(null);
      }
    },
    [uid, navigation, messagingUid, showSnackbar],
  );

  const handleCallPress = useCallback(
    (friend: FriendWithProfile, friendUid: string) => {
      if (!uid || !friendUid) return;
      if (callingUid) return; // duplicate-tap guard
      if (!callsUiEnabled) return;
      if (!callIsReady) {
        Alert.alert(
          "Calls unavailable",
          "Calls are still initializing. Please try again in a moment.",
        );
        return;
      }
      if (callIsBusy) {
        Alert.alert(
          "Already in a call",
          "Please end your current call before starting a new one.",
        );
        return;
      }
      const profile = friend.otherUserProfile;
      const displayName = profile?.username || profile?.displayName || "Friend";

      const launch = async (mode: "audio" | "video") => {
        if (callingUid) return;
        setCallingUid(friendUid);
        try {
          const callId = await startCall(friendUid, mode, displayName);
          navigation.navigate("DirectCall" as any, {
            callId,
            recipientName: displayName,
            mode,
            isOutgoing: true,
          });
        } catch (err: any) {
          Alert.alert(
            "Call Failed",
            err?.message || "Unable to start call. Please try again.",
          );
        } finally {
          setCallingUid(null);
        }
      };

      Alert.alert(
        `Call ${displayName}`,
        "Choose a call type",
        [
          {
            text: "Audio call",
            onPress: () => {
              void launch("audio");
            },
          },
          {
            text: "Video call",
            onPress: () => {
              void launch("video");
            },
          },
          { text: "Cancel", style: "cancel" },
        ],
        { cancelable: true },
      );
    },
    [
      uid,
      callingUid,
      callsUiEnabled,
      callIsReady,
      callIsBusy,
      startCall,
      navigation,
    ],
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

  // NOTE: We intentionally do NOT gate the render with `if (loading)` or
  // `if (error)` early returns.  Doing so would unmount the
  // AnimatedSectionList and its Reanimated scroll handler.  On iOS the
  // native animated-node connection is not fully established on the very
  // first gesture after a fresh mount, which causes the header-collapse
  // animation to "stick" on the first scroll.  By always rendering the
  // animated header + list, the scroll handler stays connected from the
  // first frame.  Loading / error states are shown inside
  // ListEmptyComponent instead.

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
      {/* ── Header ─────────────────────────────────────────────── */}
      {/* Safe-area strip stays fixed; the content below it pulls up
          on scroll via translateY to visually shrink the header.
          Header surface matches the page `background` (not `surface`) so
          the friend islands (which use `surface`) sit on the page as
          clearly elevated cards — matching the Calls screen header
          treatment and the light-mode reference hierarchy. */}
      <View
        style={[
          styles.headerSafeArea,
          { backgroundColor: colors.background, height: insets.top },
        ]}
      />
      <View style={[styles.headerOuter]}>
        {/* Animated background surface — slides up so the bottom
            edge rises to meet the collapsed search bar position. */}
        <Animated.View
          style={[
            styles.headerBg,
            {
              backgroundColor: colors.background,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.outlineVariant ?? colors.outline,
            },
            headerBgStyle,
          ]}
        />
        <View style={styles.headerContainer}>
          {/* Top row: back arrow (if navigable) | title | add friend */}
          <View style={styles.headerTopRow}>
            {navigation.canGoBack() ? (
              <IconButton
                icon="arrow-left"
                size={24}
                onPress={() => navigation.goBack()}
                style={styles.headerBtn}
                accessibilityLabel="Go back"
              />
            ) : (
              <View style={{ width: ICON_BTN_WIDTH }} />
            )}
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

          {/* Search bar — absolutely positioned so its movement
              doesn't affect sibling layout (no jitter). Uses `surface`
              so the pill reads as an elevated pill on top of the header,
              consistent with friend cards which also sit on `surface`. */}
          <Animated.View
            style={[
              styles.searchAbsolute,
              { backgroundColor: searchBackground },
              searchBarAnimStyle,
            ]}
          >
            <Searchbar
              placeholder="Search friends..."
              onChangeText={setSearchQuery}
              value={searchQuery}
              style={styles.searchbar}
              inputStyle={styles.searchInput}
              elevation={0}
              accessibilityLabel="Search friends"
            />
          </Animated.View>
        </View>
      </View>

      {/* ── Main Content — Alphabetical SectionList ─────────────── */}
      {/* Static negative marginTop overlaps the header’s search row.
          When the header translateY pulls up, the visual gap closes.
          paddingTop on content offsets the overlap so items start
          at the correct visual position.  */}
      <View style={styles.listWrapper}>
        <AnimatedSectionList
          ref={sectionListRef as any}
          sections={alphaSections}
          keyExtractor={(item: FriendWithProfile) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: SEARCH_ROW_HEIGHT },
          ]}
          stickySectionHeadersEnabled
          scrollIndicatorInsets={{ top: 0 }}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          // iOS scroll-handler stabilisation: prevent the system from
          // injecting automatic content-inset adjustments that can cause
          // the first scroll gesture to report wrong offsets.
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustsScrollIndicatorInsets={false}
          onScrollToIndexFailed={() => {}}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            normalizedQuery || loading ? null : renderRequestsHeader
          }
          ListEmptyComponent={
            loading ? (
              <LoadingState message="Loading your friends..." />
            ) : error ? (
              <ErrorState
                title="Something went wrong"
                message={error}
                onRetry={loadData}
              />
            ) : normalizedQuery ? (
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
                onMessage={() => handleMessagePress(friend, friendUid)}
                onCall={() => handleCallPress(friend, friendUid)}
                callEnabled={callsUiEnabled}
                callDisabled={!callIsReady || callIsBusy}
                messageLoading={messagingUid === friendUid}
                callLoading={callingUid === friendUid}
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
        uid={uid || ""}
        username={myUsername}
        displayName={myDisplayName}
        onShare={handleQrShare}
        onScan={handleQrScan}
        onClose={() => setQrModalVisible(false)}
        onSwitchMode={setQrMode}
      />

      {/* ── Friend Invite Confirmation (shared QR + deep-link flow) ── */}
      <FriendInviteConfirmModal
        visible={inviteModalVisible}
        invite={pendingInvite}
        onDismiss={() => {
          setInviteModalVisible(false);
          setPendingInvite(null);
        }}
        onSent={() => {
          loadData();
        }}
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

  /* Header safe-area strip (non-animated, stays fixed at top) */
  headerSafeArea: {
    zIndex: 11,
  },
  /* Header */
  headerOuter: {
    zIndex: 10,
    elevation: 4,
    overflow: "hidden",
  },
  headerBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_EXPANDED,
  },
  headerContainer: {
    height: HEADER_EXPANDED,
    // No overflow:hidden here — the search bar is absolutely positioned
    // inside and needs to move freely.  The headerOuter clips instead.
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

  /* Search bar — absolutely positioned so movement doesn't affect layout */
  searchAbsolute: {
    position: "absolute",
    height: SEARCH_BAR_HEIGHT,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    overflow: "hidden",
  },
  searchbar: {
    borderRadius: BorderRadius.full,
    flex: 1,
    justifyContent: "center",
    height: SEARCH_BAR_HEIGHT,
    minHeight: 0,
    backgroundColor: "transparent",
    elevation: 0,
  },
  searchInput: {
    fontSize: 13,
    alignSelf: "center",
    paddingVertical: 0,
    minHeight: 0,
  },

  /* List wrapper — negative marginTop makes the list overlap the
     header's search-bar row.  The header's zIndex ensures its content
     renders on top.  When the search bar slides up, the list content
     peeks through.  */
  listWrapper: {
    flex: 1,
    marginTop: -SEARCH_ROW_HEIGHT,
  },
  listContent: {
    flexGrow: 1,
    // paddingTop is also set inline ({ paddingTop: SEARCH_ROW_HEIGHT })
    // to offset the negative marginTop so items start at the correct
    // visual position when scrollY = 0.
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
  callBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
  },
  actionBtnDisabled: {
    opacity: 0.45,
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
