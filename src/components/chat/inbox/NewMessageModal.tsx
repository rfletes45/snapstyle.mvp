/**
 * NewMessageModal
 *
 * Compose flow for starting one-on-one chats and lightweight group chats
 * directly from the Messages screen.
 */

import { AppImage } from "@/components/AppImage";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { BorderRadius, Spacing } from "@/constants/theme";
import { getOrCreateChat } from "@/services/chat";
import { emitOptimisticInboxConversationSeed } from "@/services/chat/inboxOptimisticUpdates";
import { prepareDmThreadEntry } from "@/services/chat/threadIdentityWarmup";
import { getFriends, getUserProfileByUid } from "@/services/friends";
import { createGroup } from "@/services/groups";
import { uploadGroupAvatarImage } from "@/services/storage";
import { useAuth } from "@/store/AuthContext";
import { useSnackbar } from "@/store/SnackbarContext";
import { useAppTheme } from "@/store/ThemeContext";
import { GROUP_LIMITS, type AvatarConfig, type Friend } from "@/types/models";
import type { MainStackParamList } from "@/types/navigation";
import * as haptics from "@/utils/haptics";
import { createLogger } from "@/utils/log";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import React, {
  memo,
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
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Button,
  IconButton,
  Searchbar,
  Text,
  TextInput,
} from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const logger = createLogger("components/chat/inbox/NewMessageModal");

type ComposeMode = "message" | "group";

interface ComposeFriend {
  uid: string;
  username: string;
  displayName: string;
  avatarConfig: AvatarConfig;
  profilePictureUrl?: string | null;
  decorationId?: string | null;
  friendshipCreatedAt: number;
}

export interface NewMessageModalProps {
  visible: boolean;
  onDismiss: () => void;
}

const MIN_SELECTED_FRIENDS_FOR_GROUP = GROUP_LIMITS.MIN_MEMBERS - 1;
const RECENT_FRIEND_LIMIT = 6;
const MODAL_ENTER_MS = 220;
const MODAL_EXIT_MS = 160;

function getOtherFriendUid(
  friendship: Friend,
  currentUid: string,
): string | null {
  return friendship.users.find((memberUid) => memberUid !== currentUid) ?? null;
}

function normalizeProfileName(profile: any, fallbackUid: string) {
  const username =
    typeof profile?.username === "string" && profile.username.trim().length > 0
      ? profile.username.trim()
      : "snapstyle";
  const displayName =
    typeof profile?.displayName === "string" &&
    profile.displayName.trim().length > 0
      ? profile.displayName.trim()
      : username || `Friend ${fallbackUid.slice(0, 4)}`;

  return { username, displayName };
}

function getFriendlyErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  const normalized = `${code} ${message}`.toLowerCase();

  if (normalized.includes("cannot chat")) return "You can't message this user";
  if (normalized.includes("permission")) {
    return "You do not have permission to do that right now";
  }
  if (normalized.includes("network") || normalized.includes("unavailable")) {
    return "Network issue. Please try again.";
  }
  return fallback;
}

export const NewMessageModal = memo(function NewMessageModal({
  visible,
  onDismiss,
}: NewMessageModalProps) {
  const { colors, isDark } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const { showError } = useSnackbar();
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const currentUid = currentFirebaseUser?.uid ?? "";
  const isWideWeb = Platform.OS === "web" && width >= 768;
  const animationProgress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const renderedRef = useRef(visible);

  const [rendered, setRendered] = useState(visible);
  const [openingSettled, setOpeningSettled] = useState(visible);
  const [mode, setMode] = useState<ComposeMode>("message");
  const [friends, setFriends] = useState<ComposeFriend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");
  const [groupAvatarUri, setGroupAvatarUri] = useState<string | null>(null);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [startingDmUid, setStartingDmUid] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadRequestRef = useRef(0);
  const creatingGroupRef = useRef(false);

  const setRenderedState = useCallback((nextRendered: boolean) => {
    renderedRef.current = nextRendered;
    setRendered(nextRendered);
  }, []);

  const selectedFriends = useMemo(
    () => friends.filter((friend) => selectedUids.has(friend.uid)),
    [friends, selectedUids],
  );
  const selectedCount = selectedFriends.length;
  const groupMemberCount = selectedCount + 1;
  const busy = creatingGroup || !!startingDmUid;

  const resetState = useCallback(() => {
    setMode("message");
    setOpeningSettled(false);
    setFriends([]);
    setLoadingFriends(false);
    setLoadError(null);
    setSearchQuery("");
    setSelectedUids(new Set());
    setGroupName("");
    setGroupAvatarUri(null);
    setValidationAttempted(false);
    setCreatingGroup(false);
    setStartingDmUid(null);
    setActionError(null);
    creatingGroupRef.current = false;
  }, []);

  const loadFriends = useCallback(async () => {
    if (!currentUid) {
      setLoadError("Sign in to start a message.");
      setLoadingFriends(false);
      return;
    }

    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    setLoadingFriends(true);
    setLoadError(null);
    setActionError(null);

    try {
      const friendships = await getFriends(currentUid);
      const friendProfiles = await Promise.all(
        friendships.map(async (friendship): Promise<ComposeFriend | null> => {
          const friendUid = getOtherFriendUid(friendship, currentUid);
          if (!friendUid) return null;

          const profile = await getUserProfileByUid(friendUid);
          if (!profile) return null;

          const { username, displayName } = normalizeProfileName(
            profile,
            friendUid,
          );

          return {
            uid: friendUid,
            username,
            displayName,
            avatarConfig: profile.avatarConfig ?? { baseColor: colors.primary },
            profilePictureUrl: profile.profilePicture?.url ?? null,
            decorationId: profile.avatarDecoration?.decorationId ?? null,
            friendshipCreatedAt: friendship.createdAt || 0,
          };
        }),
      );

      if (loadRequestRef.current !== requestId) return;

      setFriends(
        friendProfiles.filter(
          (friend): friend is ComposeFriend => friend !== null,
        ),
      );
    } catch (error) {
      logger.error("Failed to load compose friends", error);
      if (loadRequestRef.current !== requestId) return;
      setLoadError(getFriendlyErrorMessage(error, "Could not load friends."));
    } finally {
      if (loadRequestRef.current === requestId) {
        setLoadingFriends(false);
      }
    }
  }, [colors.primary, currentUid]);

  useEffect(() => {
    let frame: ReturnType<typeof requestAnimationFrame> | null = null;
    let animation: Animated.CompositeAnimation | null = null;

    if (visible) {
      setOpeningSettled(false);
      setRenderedState(true);
      animationProgress.stopAnimation();
      animationProgress.setValue(0);
      frame = requestAnimationFrame(() => {
        animation = Animated.timing(animationProgress, {
          toValue: 1,
          duration: MODAL_ENTER_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });
        animation.start(({ finished }) => {
          if (finished) setOpeningSettled(true);
        });
      });
    } else if (renderedRef.current) {
      setOpeningSettled(false);
      animationProgress.stopAnimation();
      animation = Animated.timing(animationProgress, {
        toValue: 0,
        duration: MODAL_EXIT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      });
      animation.start(({ finished }) => {
        if (!finished) return;
        setRenderedState(false);
        loadRequestRef.current += 1;
        resetState();
      });
    }

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      animation?.stop();
    };
  }, [animationProgress, resetState, setRenderedState, visible]);

  useEffect(() => {
    if (!visible || !openingSettled) return;
    void loadFriends();
  }, [loadFriends, openingSettled, visible]);

  const sortedFriends = useMemo(
    () =>
      [...friends].sort((firstFriend, secondFriend) => {
        const firstName = firstFriend.displayName || firstFriend.username;
        const secondName = secondFriend.displayName || secondFriend.username;
        return firstName.localeCompare(secondName);
      }),
    [friends],
  );

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredFriends = useMemo(() => {
    if (!normalizedSearchQuery) return sortedFriends;
    return sortedFriends.filter((friend) => {
      const displayName = friend.displayName.toLowerCase();
      const username = friend.username.toLowerCase();
      return (
        displayName.includes(normalizedSearchQuery) ||
        username.includes(normalizedSearchQuery)
      );
    });
  }, [normalizedSearchQuery, sortedFriends]);

  const recentFriends = useMemo(
    () =>
      [...friends]
        .sort(
          (firstFriend, secondFriend) =>
            secondFriend.friendshipCreatedAt - firstFriend.friendshipCreatedAt,
        )
        .slice(0, RECENT_FRIEND_LIMIT),
    [friends],
  );

  const trimmedGroupName = groupName.trim();
  const hasGroupName = trimmedGroupName.length > 0;
  const hasGroupAvatar = !!groupAvatarUri;
  const isMemberSelectionValid =
    selectedCount >= MIN_SELECTED_FRIENDS_FOR_GROUP &&
    groupMemberCount <= GROUP_LIMITS.MAX_MEMBERS;
  const isGroupNameValid =
    hasGroupName && groupName.length <= GROUP_LIMITS.MAX_NAME_LENGTH;
  const canCreateGroup =
    mode === "group" &&
    isMemberSelectionValid &&
    isGroupNameValid &&
    hasGroupAvatar &&
    !creatingGroup;

  const groupCreateHint = useMemo(() => {
    if (mode !== "group") return null;
    if (selectedCount < MIN_SELECTED_FRIENDS_FOR_GROUP) {
      return `Select at least ${MIN_SELECTED_FRIENDS_FOR_GROUP} friend${
        MIN_SELECTED_FRIENDS_FOR_GROUP === 1 ? "" : "s"
      }`;
    }
    if (!hasGroupAvatar) return "Add a group photo";
    if (!hasGroupName) return "Name your group";
    return null;
  }, [hasGroupAvatar, hasGroupName, mode, selectedCount]);

  const handleClose = useCallback(() => {
    if (busy) return;
    Keyboard.dismiss();
    onDismiss();
  }, [busy, onDismiss]);

  const navigateAfterClose = useCallback(
    (navigateAction: () => void) => {
      Keyboard.dismiss();
      onDismiss();
      setTimeout(
        navigateAction,
        Platform.OS === "web" ? 0 : MODAL_EXIT_MS + 40,
      );
    },
    [onDismiss],
  );

  const switchMode = useCallback((nextMode: ComposeMode) => {
    haptics.buttonPress();
    setMode(nextMode);
    setActionError(null);
    if (nextMode === "message") {
      setSelectedUids(new Set());
      setGroupName("");
      setGroupAvatarUri(null);
      setValidationAttempted(false);
    }
  }, []);

  const toggleFriendSelection = useCallback(
    (friend: ComposeFriend) => {
      if (creatingGroup) return;
      haptics.buttonPress();
      setActionError(null);
      setSelectedUids((previousSelectedUids) => {
        const nextSelectedUids = new Set(previousSelectedUids);
        if (nextSelectedUids.has(friend.uid)) {
          nextSelectedUids.delete(friend.uid);
          return nextSelectedUids;
        }

        if (nextSelectedUids.size + 1 + 1 > GROUP_LIMITS.MAX_MEMBERS) {
          const message = `Groups can have at most ${GROUP_LIMITS.MAX_MEMBERS} members.`;
          setActionError(message);
          showError(message);
          return previousSelectedUids;
        }

        nextSelectedUids.add(friend.uid);
        return nextSelectedUids;
      });
    },
    [creatingGroup, showError],
  );

  const removeSelectedFriend = useCallback((friendUid: string) => {
    haptics.buttonPress();
    setActionError(null);
    setSelectedUids((previousSelectedUids) => {
      const nextSelectedUids = new Set(previousSelectedUids);
      nextSelectedUids.delete(friendUid);
      return nextSelectedUids;
    });
  }, []);

  const clearSelection = useCallback(() => {
    haptics.buttonPress();
    setSelectedUids(new Set());
    setActionError(null);
  }, []);

  const pickGroupAvatarFromSource = useCallback(
    async (source: "camera" | "library") => {
      if (creatingGroup) return;

      try {
        if (Platform.OS !== "web") {
          const { status } =
            source === "camera"
              ? await ImagePicker.requestCameraPermissionsAsync()
              : await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") {
            const message =
              source === "camera"
                ? "Camera access is needed to take a group photo."
                : "Photo library access is needed to choose a group photo.";
            setActionError(message);
            showError(message);
            return;
          }
        }

        const pickerOptions: ImagePicker.ImagePickerOptions = {
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.9,
          exif: false,
        };

        const result =
          source === "camera"
            ? await ImagePicker.launchCameraAsync(pickerOptions)
            : await ImagePicker.launchImageLibraryAsync(pickerOptions);

        if (result.canceled || !result.assets?.[0]?.uri) return;

        setGroupAvatarUri(result.assets[0].uri);
        setActionError(null);
      } catch (error) {
        logger.error("Failed to select group avatar", error);
        const message =
          source === "camera"
            ? "Could not take that photo. Please try again."
            : "Could not choose that photo. Please try again.";
        setActionError(message);
        showError(message);
      }
    },
    [creatingGroup, showError],
  );

  const pickGroupAvatar = useCallback(() => {
    if (creatingGroup) return;
    haptics.buttonPress();
    Alert.alert("Group Photo", "Choose an option", [
      {
        text: "Take Picture",
        onPress: () => void pickGroupAvatarFromSource("camera"),
      },
      {
        text: "Add Photo",
        onPress: () => void pickGroupAvatarFromSource("library"),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [creatingGroup, pickGroupAvatarFromSource]);

  const startDm = useCallback(
    async (friend: ComposeFriend) => {
      if (!currentUid || startingDmUid || creatingGroup) return;

      haptics.buttonPress();
      setStartingDmUid(friend.uid);
      setActionError(null);

      prepareDmThreadEntry({
        avatarUrl: friend.profilePictureUrl,
        decorationId: friend.decorationId,
      }).catch(() => {});

      try {
        const chatId = await getOrCreateChat(currentUid, friend.uid);
        const friendName = friend.displayName || friend.username;
        const timestamp = Date.now();
        emitOptimisticInboxConversationSeed({
          ownerUid: currentUid,
          scope: "dm",
          conversationId: chatId,
          name: friendName,
          avatarUrl: friend.profilePictureUrl ?? null,
          profilePictureUrl: friend.profilePictureUrl ?? null,
          avatarConfig: friend.avatarConfig,
          decorationId: friend.decorationId ?? null,
          otherUserId: friend.uid,
          participantCount: 2,
          createdAt: timestamp,
          lastActivityAt: timestamp,
        });

        try {
          const { getOrCreateDMConversation } =
            await import("@/services/database/conversationRepository");
          getOrCreateDMConversation(chatId, friend.uid);
        } catch (conversationError) {
          logger.warn(
            "Local DM conversation row creation failed",
            conversationError,
          );
        }

        setStartingDmUid(null);
        navigateAfterClose(() => {
          navigation.navigate("ChatDetail", {
            friendUid: friend.uid,
            initialData: {
              chatId,
              friendName,
              friendAvatar: friend.profilePictureUrl ?? null,
              friendAvatarConfig: friend.avatarConfig,
              friendDecorationId: friend.decorationId ?? null,
            },
          });
        });
      } catch (error) {
        logger.error("Failed to start DM from compose modal", error);
        const message = getFriendlyErrorMessage(
          error,
          "Could not open conversation.",
        );
        setActionError(message);
        showError(message);
        setStartingDmUid(null);
      }
    },
    [
      creatingGroup,
      currentUid,
      navigateAfterClose,
      navigation,
      showError,
      startingDmUid,
    ],
  );

  const handleFriendPress = useCallback(
    (friend: ComposeFriend) => {
      if (mode === "group") {
        toggleFriendSelection(friend);
        return;
      }
      void startDm(friend);
    },
    [mode, startDm, toggleFriendSelection],
  );

  const handleCreateGroup = useCallback(async () => {
    if (!currentUid || creatingGroupRef.current) return;

    setValidationAttempted(true);
    if (!canCreateGroup || !groupAvatarUri) {
      const message = groupCreateHint ?? "Complete the group details first.";
      setActionError(message);
      showError(message);
      return;
    }

    creatingGroupRef.current = true;
    setCreatingGroup(true);
    setActionError(null);
    haptics.buttonPress();

    const memberUids = selectedFriends.map((friend) => friend.uid);

    try {
      const { doc, collection } = await import("firebase/firestore");
      const { getFirestoreInstance } = await import("@/services/firebase");
      const db = getFirestoreInstance();
      const groupRef = doc(collection(db, "Groups"));
      const groupId = groupRef.id;
      const avatarUrl = await uploadGroupAvatarImage(groupId, groupAvatarUri);

      const group = await createGroup(currentUid, {
        name: trimmedGroupName,
        memberUids,
        avatarUrl,
        groupId,
      });
      const resolvedAvatarUrl = group.avatarUrl ?? avatarUrl;
      const timestamp = Date.now();

      emitOptimisticInboxConversationSeed({
        ownerUid: currentUid,
        scope: "group",
        conversationId: group.id,
        name: group.name,
        avatarUrl: resolvedAvatarUrl,
        participantCount: groupMemberCount,
        createdAt: timestamp,
        lastActivityAt: timestamp,
      });

      try {
        const { getOrCreateGroupConversation } =
          await import("@/services/database/conversationRepository");
        getOrCreateGroupConversation(group.id, group.name);
      } catch (conversationError) {
        logger.warn(
          "Local group conversation row creation failed",
          conversationError,
        );
      }

      setCreatingGroup(false);
      creatingGroupRef.current = false;
      navigateAfterClose(() => {
        navigation.navigate("GroupChat", {
          groupId: group.id,
          groupName: group.name,
          initialGroupData: {
            name: group.name,
            avatarUrl: resolvedAvatarUrl,
            backgroundUrl: group.backgroundUrl ?? null,
            backgroundTrusted: false,
          },
        });
      });
    } catch (error) {
      logger.error("Failed to create group from compose modal", error);
      const message = getFriendlyErrorMessage(error, "Could not create group.");
      setActionError(message);
      showError(message);
      setCreatingGroup(false);
      creatingGroupRef.current = false;
    }
  }, [
    canCreateGroup,
    currentUid,
    groupAvatarUri,
    groupCreateHint,
    groupMemberCount,
    navigateAfterClose,
    navigation,
    selectedFriends,
    showError,
    trimmedGroupName,
  ]);

  const renderRecentFriend = useCallback(
    (friend: ComposeFriend) => {
      const isStarting = startingDmUid === friend.uid;
      return (
        <TouchableOpacity
          key={friend.uid}
          style={styles.recentFriend}
          onPress={() => void startDm(friend)}
          disabled={busy}
          activeOpacity={0.76}
        >
          <View style={styles.recentAvatarWrap}>
            <ProfilePictureWithDecoration
              pictureUrl={friend.profilePictureUrl}
              name={friend.displayName}
              decorationId={friend.decorationId}
              size={52}
            />
            {isStarting && (
              <View
                style={[
                  styles.recentLoadingBadge,
                  { backgroundColor: colors.surfaceElevated },
                ]}
              >
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </View>
          <Text
            style={[styles.recentName, { color: colors.text }]}
            numberOfLines={1}
          >
            {friend.displayName}
          </Text>
        </TouchableOpacity>
      );
    },
    [
      busy,
      colors.primary,
      colors.surfaceElevated,
      colors.text,
      startDm,
      startingDmUid,
    ],
  );

  const renderFriendItem = useCallback(
    ({ item }: { item: ComposeFriend }) => {
      const selected = selectedUids.has(item.uid);
      const isStarting = startingDmUid === item.uid;
      const disabled = busy && !isStarting;

      return (
        <TouchableOpacity
          style={[
            styles.friendRow,
            {
              backgroundColor:
                mode === "group" && selected
                  ? colors.primaryContainer
                  : colors.surface,
              borderColor:
                mode === "group" && selected ? colors.primary : colors.border,
              opacity: disabled ? 0.56 : 1,
            },
          ]}
          onPress={() => handleFriendPress(item)}
          disabled={disabled}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel={
            mode === "group"
              ? `${selected ? "Remove" : "Select"} ${item.displayName}`
              : `Message ${item.displayName}`
          }
        >
          <ProfilePictureWithDecoration
            pictureUrl={item.profilePictureUrl}
            name={item.displayName}
            decorationId={item.decorationId}
            size={46}
          />

          <View style={styles.friendText}>
            <Text
              style={[styles.friendName, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.displayName}
            </Text>
            <Text
              style={[styles.friendUsername, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              @{item.username}
            </Text>
          </View>

          {mode === "group" ? (
            <View
              style={[
                styles.selectionIndicator,
                {
                  backgroundColor: selected ? colors.primary : "transparent",
                  borderColor: selected ? colors.primary : colors.outline,
                },
              ]}
            >
              {selected && (
                <MaterialCommunityIcons
                  name="check"
                  size={15}
                  color={colors.onPrimary}
                />
              )}
            </View>
          ) : isStarting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialCommunityIcons
              name="message-text-outline"
              size={22}
              color={colors.primary}
            />
          )}
        </TouchableOpacity>
      );
    },
    [
      busy,
      colors.border,
      colors.onPrimary,
      colors.outline,
      colors.primary,
      colors.primaryContainer,
      colors.surface,
      colors.text,
      colors.textSecondary,
      handleFriendPress,
      mode,
      selectedUids,
      startingDmUid,
    ],
  );

  const renderEmptyState = () => {
    if (!openingSettled || loadingFriends) return null;
    if (friends.length === 0) {
      return (
        <StatePanel
          icon="account-heart-outline"
          title="No friends yet"
          subtitle="Friends you add will appear here."
        />
      );
    }
    return (
      <StatePanel
        icon="magnify-close"
        title="No matches"
        subtitle="Try a different name or username."
      />
    );
  };

  const selectedPreview = mode === "group" && selectedFriends.length > 0;
  const showRecent =
    openingSettled &&
    mode === "message" &&
    !normalizedSearchQuery &&
    recentFriends.length > 0;
  const showFriendsLoading = !openingSettled || loadingFriends;
  const modalRootAnimatedStyle = useMemo(
    () => ({ opacity: animationProgress }),
    [animationProgress],
  );
  const sheetAnimatedStyle = useMemo(
    () => ({
      opacity: animationProgress,
      transform: [
        {
          translateY: animationProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [24, 0],
          }),
        },
      ],
    }),
    [animationProgress],
  );

  function ModeButton({
    active,
    icon,
    label,
    onPress,
  }: {
    active: boolean;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    label: string;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.modeButton,
          active && { backgroundColor: colors.surfaceElevated },
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <MaterialCommunityIcons
          name={icon}
          size={18}
          color={active ? colors.primary : colors.textSecondary}
        />
        <Text
          style={[
            styles.modeButtonText,
            { color: active ? colors.text : colors.textSecondary },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  function StatePanel({
    icon,
    title,
    subtitle,
    actionLabel,
    onAction,
  }: {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    title: string;
    subtitle: string;
    actionLabel?: string;
    onAction?: () => void;
  }) {
    return (
      <View style={styles.stateContainer}>
        <View
          style={[styles.stateIcon, { backgroundColor: colors.surfaceVariant }]}
        >
          <MaterialCommunityIcons
            name={icon}
            size={34}
            color={colors.primary}
          />
        </View>
        <Text style={[styles.stateTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.stateSubtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
        {actionLabel && onAction && (
          <Button
            mode="contained"
            onPress={onAction}
            style={styles.stateButton}
          >
            {actionLabel}
          </Button>
        )}
      </View>
    );
  }

  if (!rendered) return null;

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View
        style={[
          styles.modalRoot,
          {
            backgroundColor: isWideWeb ? colors.overlay : colors.background,
          },
          isWideWeb && styles.webBackdrop,
          modalRootAnimatedStyle,
        ]}
      >
        <KeyboardAvoidingView
          style={[
            styles.keyboardAvoider,
            isWideWeb && styles.webKeyboardAvoider,
          ]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Animated.View
            style={[
              styles.sheetMotion,
              isWideWeb && styles.webSheetMotion,
              sheetAnimatedStyle,
            ]}
          >
            <SafeAreaView
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
                isWideWeb && [
                  styles.webSheet,
                  {
                    width: Math.min(720, width - Spacing.xxl),
                    height: Math.min(820, height - Spacing.xxl),
                  },
                ],
              ]}
              edges={["top", "bottom"]}
            >
              <View
                style={[styles.header, { borderBottomColor: colors.border }]}
              >
                <IconButton
                  icon="close"
                  iconColor={colors.textSecondary}
                  size={23}
                  onPress={handleClose}
                  disabled={busy}
                  accessibilityLabel="Close new message"
                  style={styles.headerIcon}
                />
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                  New Message
                </Text>
                <View style={styles.headerIcon} />
              </View>

              <View style={styles.content}>
                <View
                  style={[
                    styles.modeSwitch,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                >
                  <ModeButton
                    active={mode === "message"}
                    icon="message-text-outline"
                    label="Message"
                    onPress={() => switchMode("message")}
                  />
                  <ModeButton
                    active={mode === "group"}
                    icon="account-group-outline"
                    label="Group"
                    onPress={() => switchMode("group")}
                  />
                </View>

                {mode === "group" && (
                  <View
                    style={[
                      styles.groupSetupPanel,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.groupSetupRow}>
                      <Pressable
                        onPress={pickGroupAvatar}
                        disabled={creatingGroup}
                        style={styles.groupAvatarButton}
                        accessibilityRole="button"
                        accessibilityLabel={
                          groupAvatarUri
                            ? "Change group photo"
                            : "Add group photo"
                        }
                      >
                        {groupAvatarUri ? (
                          <AppImage
                            source={{ uri: groupAvatarUri }}
                            style={styles.groupAvatarImage}
                            contentFit="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.groupAvatarPlaceholder,
                              { backgroundColor: colors.surfaceVariant },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name="camera-plus-outline"
                              size={30}
                              color={colors.textSecondary}
                            />
                          </View>
                        )}
                        <View
                          style={[
                            styles.groupAvatarBadge,
                            {
                              backgroundColor: colors.primary,
                              borderColor: colors.surface,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={groupAvatarUri ? "pencil" : "plus"}
                            size={14}
                            color={colors.onPrimary}
                          />
                        </View>
                      </Pressable>

                      <View style={styles.groupNameBlock}>
                        <TextInput
                          mode="outlined"
                          label="Group name"
                          value={groupName}
                          onChangeText={(text) => {
                            setGroupName(text);
                            setActionError(null);
                          }}
                          maxLength={GROUP_LIMITS.MAX_NAME_LENGTH}
                          style={[
                            styles.groupNameInput,
                            { backgroundColor: colors.surface },
                          ]}
                          textColor={colors.text}
                          placeholderTextColor={
                            colors.inputPlaceholder ?? colors.textMuted
                          }
                          outlineColor={
                            validationAttempted && !hasGroupName
                              ? colors.error
                              : colors.border
                          }
                          activeOutlineColor={colors.primary}
                          disabled={creatingGroup}
                          left={
                            <TextInput.Icon
                              icon="pencil-outline"
                              color={colors.textSecondary}
                            />
                          }
                        />
                        <Text
                          style={[
                            styles.groupNameMeta,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {groupName.length}/{GROUP_LIMITS.MAX_NAME_LENGTH}
                        </Text>
                      </View>
                    </View>

                    {validationAttempted &&
                      (!hasGroupAvatar || !hasGroupName) && (
                        <View style={styles.groupRequiredRow}>
                          {!hasGroupAvatar && (
                            <Text
                              style={[
                                styles.groupRequiredText,
                                { color: colors.error },
                              ]}
                            >
                              Group photo required
                            </Text>
                          )}
                          {!hasGroupName && (
                            <Text
                              style={[
                                styles.groupRequiredText,
                                { color: colors.error },
                              ]}
                            >
                              Group name required
                            </Text>
                          )}
                        </View>
                      )}

                    {(groupAvatarUri || hasGroupName || selectedCount > 0) && (
                      <View
                        style={[
                          styles.groupPreviewRow,
                          { borderTopColor: colors.border },
                        ]}
                      >
                        {groupAvatarUri ? (
                          <AppImage
                            source={{ uri: groupAvatarUri }}
                            style={styles.groupPreviewAvatar}
                            contentFit="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.groupPreviewAvatarPlaceholder,
                              { backgroundColor: colors.surfaceVariant },
                            ]}
                          >
                            <MaterialCommunityIcons
                              name="account-group-outline"
                              size={18}
                              color={colors.textSecondary}
                            />
                          </View>
                        )}
                        <View style={styles.groupPreviewText}>
                          <Text
                            style={[
                              styles.groupPreviewName,
                              { color: colors.text },
                            ]}
                            numberOfLines={1}
                          >
                            {trimmedGroupName || "New group"}
                          </Text>
                          <Text
                            style={[
                              styles.groupPreviewMeta,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {groupMemberCount} member
                            {groupMemberCount === 1 ? "" : "s"}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                <Searchbar
                  placeholder="Search friends"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                  style={[
                    styles.searchBar,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                  inputStyle={[styles.searchInput, { color: colors.text }]}
                  iconColor={colors.textSecondary}
                  placeholderTextColor={
                    colors.inputPlaceholder ?? colors.textMuted
                  }
                  keyboardAppearance={
                    Platform.OS === "ios"
                      ? isDark
                        ? "dark"
                        : "light"
                      : undefined
                  }
                />

                {selectedPreview && (
                  <View style={styles.selectedSection}>
                    <View style={styles.selectedHeader}>
                      <Text
                        style={[
                          styles.sectionLabel,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Selected
                      </Text>
                      <TouchableOpacity onPress={clearSelection} hitSlop={8}>
                        <Text
                          style={[styles.clearText, { color: colors.primary }]}
                        >
                          Clear
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.selectedChipsContent}
                      keyboardShouldPersistTaps="handled"
                    >
                      {selectedFriends.map((friend) => (
                        <View
                          key={friend.uid}
                          style={[
                            styles.selectedChip,
                            {
                              backgroundColor: colors.primaryContainer,
                              borderColor: colors.primary,
                            },
                          ]}
                        >
                          <ProfilePictureWithDecoration
                            pictureUrl={friend.profilePictureUrl}
                            name={friend.displayName}
                            decorationId={friend.decorationId}
                            size={28}
                          />
                          <Text
                            style={[
                              styles.selectedChipText,
                              { color: colors.onPrimaryContainer },
                            ]}
                            numberOfLines={1}
                          >
                            {friend.displayName}
                          </Text>
                          <TouchableOpacity
                            onPress={() => removeSelectedFriend(friend.uid)}
                            hitSlop={8}
                            accessibilityLabel={`Remove ${friend.displayName}`}
                          >
                            <MaterialCommunityIcons
                              name="close-circle"
                              size={18}
                              color={colors.onPrimaryContainer}
                            />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {actionError && (
                  <View
                    style={[
                      styles.errorBanner,
                      { backgroundColor: colors.errorContainer },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="alert-circle-outline"
                      size={18}
                      color={colors.error}
                    />
                    <Text style={[styles.errorText, { color: colors.error }]}>
                      {actionError}
                    </Text>
                  </View>
                )}

                {showRecent && (
                  <View style={styles.recentSection}>
                    <Text
                      style={[
                        styles.sectionLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Recent
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.recentContent}
                      keyboardShouldPersistTaps="handled"
                    >
                      {recentFriends.map(renderRecentFriend)}
                    </ScrollView>
                  </View>
                )}

                <View style={styles.listHeaderRow}>
                  <Text
                    style={[
                      styles.sectionLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Friends
                  </Text>
                  {mode === "group" && (
                    <Text
                      style={[
                        styles.memberCountText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {groupMemberCount}/{GROUP_LIMITS.MAX_MEMBERS} members
                    </Text>
                  )}
                </View>

                {showFriendsLoading ? (
                  <View style={styles.stateContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text
                      style={[
                        styles.stateSubtitle,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Loading friends
                    </Text>
                  </View>
                ) : loadError ? (
                  <StatePanel
                    icon="alert-circle-outline"
                    title="Could not load friends"
                    subtitle={loadError}
                    actionLabel="Try Again"
                    onAction={loadFriends}
                  />
                ) : (
                  <FlatList
                    data={filteredFriends}
                    renderItem={renderFriendItem}
                    keyExtractor={(friend) => friend.uid}
                    ListEmptyComponent={renderEmptyState}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[
                      styles.listContent,
                      mode === "group" && styles.listContentWithFooter,
                      { paddingBottom: Math.max(insets.bottom, Spacing.lg) },
                    ]}
                  />
                )}
              </View>

              {mode === "group" && (
                <View
                  style={[
                    styles.footer,
                    {
                      borderTopColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                >
                  <Button
                    mode="contained"
                    icon="account-multiple-plus-outline"
                    onPress={handleCreateGroup}
                    disabled={!canCreateGroup}
                    loading={creatingGroup}
                    style={styles.createButton}
                    contentStyle={styles.createButtonContent}
                  >
                    {creatingGroup ? "Creating Group" : "Create Group"}
                  </Button>
                  {groupCreateHint && !creatingGroup && (
                    <Text
                      style={[
                        styles.footerHint,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {groupCreateHint}
                    </Text>
                  )}
                </View>
              )}
            </SafeAreaView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  webBackdrop: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  keyboardAvoider: {
    flex: 1,
  },
  webKeyboardAvoider: {
    flex: 0,
  },
  sheetMotion: {
    flex: 1,
  },
  webSheetMotion: {
    flex: 0,
  },
  sheet: {
    flex: 1,
    borderWidth: 0,
  },
  webSheet: {
    flex: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    ...Platform.select({
      web: {
        boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
      } as any,
      default: {},
    }),
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.sm,
  },
  headerIcon: {
    width: 44,
    height: 44,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  modeSwitch: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    padding: 3,
    marginBottom: Spacing.md,
  },
  modeButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  searchBar: {
    borderRadius: BorderRadius.lg,
    elevation: 0,
    marginBottom: Spacing.md,
  },
  searchInput: {
    fontSize: 15,
    minHeight: 0,
  },
  groupSetupPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  groupSetupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  groupAvatarButton: {
    width: 76,
    height: 76,
    position: "relative",
  },
  groupAvatarImage: {
    width: 76,
    height: 76,
    borderRadius: 24,
  },
  groupAvatarPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  groupAvatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  groupNameBlock: {
    flex: 1,
  },
  selectedSection: {
    marginBottom: Spacing.md,
  },
  selectedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  selectedChipsContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  selectedChip: {
    maxWidth: 190,
    minHeight: 38,
    borderRadius: BorderRadius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingLeft: 5,
    paddingRight: Spacing.sm,
  },
  selectedChipText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  clearText: {
    fontSize: 13,
    fontWeight: "700",
  },
  groupNameInput: {
    marginBottom: 0,
  },
  groupNameMeta: {
    alignSelf: "flex-end",
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
  },
  groupRequiredRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  groupRequiredText: {
    fontSize: 12,
    fontWeight: "700",
  },
  groupPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
  },
  groupPreviewAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
  },
  groupPreviewAvatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  groupPreviewText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  groupPreviewName: {
    fontSize: 15,
    fontWeight: "800",
  },
  groupPreviewMeta: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  recentSection: {
    marginBottom: Spacing.lg,
  },
  recentContent: {
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  recentFriend: {
    width: 72,
    alignItems: "center",
  },
  recentAvatarWrap: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  recentLoadingBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  recentName: {
    marginTop: Spacing.xs,
    width: 72,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  listHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  memberCountText: {
    fontSize: 12,
    fontWeight: "700",
  },
  listContent: {
    gap: Spacing.sm,
  },
  listContentWithFooter: {
    paddingBottom: Spacing.xxl,
  },
  friendRow: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    overflow: "visible",
  },
  friendText: {
    flex: 1,
    marginLeft: Spacing.md,
    marginRight: Spacing.md,
  },
  friendName: {
    fontSize: 16,
    fontWeight: "700",
  },
  friendUsername: {
    fontSize: 13,
    marginTop: 2,
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
  },
  stateIcon: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  stateSubtitle: {
    marginTop: Spacing.sm,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  stateButton: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  createButton: {
    borderRadius: BorderRadius.lg,
  },
  createButtonContent: {
    minHeight: 46,
  },
  footerHint: {
    marginTop: Spacing.xs,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
  },
});

export default NewMessageModal;
