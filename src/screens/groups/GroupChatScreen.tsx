/**
 * GroupChatScreen (UNI-06 - Refactored)
 *
 * Group chat screen using unified chat system abstractions.
 * Refactored from ~1,700 lines to ~600 lines using:
 * - useUnifiedChatScreen hook (combines useChat + useChatComposer)
 * - ChatComposer component (unified input area)
 * - ChatMessageList component (unified message display)
 *
 * Screen-specific features retained:
 * - Multi-attachment support (H10)
 * - Voice messages (H11)
 * - Link previews (H12)
 * - Emoji reactions (H8)
 * - @mention autocomplete (H9)
 * - Reply-to threading (H6)
 *
 * Enhanced Features:
 * - Message highlight animation when navigating to replied messages
 * - Jump-back button after scrolling to a reply target
 * - Group video/audio calls (Phase 3)
 *
 * @module screens/groups/GroupChatScreen
 */

import { AppImage } from "@/components/AppImage";
import { usePrefetch, usePrefetchChatImages } from "@/utils/imagePrefetch";
import {
  buildRemoteImageSource,
  normalizeRemoteImageUrl,
} from "@/utils/remoteImageSource";

const IMAGE_MAX_WIDTH = 240;
const IMAGE_MAX_HEIGHT = 320;
const IMAGE_MIN_WIDTH = 150;

function getImageBubbleSize(w?: number, h?: number) {
  if (!w || !h) return { width: IMAGE_MAX_WIDTH, height: IMAGE_MAX_WIDTH };
  const aspect = w / h;
  let bw = Math.min(w, IMAGE_MAX_WIDTH);
  let bh = bw / aspect;
  if (bh > IMAGE_MAX_HEIGHT) {
    bh = IMAGE_MAX_HEIGHT;
    bw = bh * aspect;
  }
  if (bw < IMAGE_MIN_WIDTH) {
    bw = IMAGE_MIN_WIDTH;
    bh = bw / aspect;
  }
  return { width: Math.round(bw), height: Math.round(bh) };
}

import { Ionicons } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  InteractionManager,
  Keyboard,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  ActivityIndicator,
  IconButton,
  Snackbar,
  Text,
} from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// Auth
import { useAuth } from "@/store/AuthContext";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";
import { useAppTheme } from "@/store/ThemeContext";
import { useUser } from "@/store/UserContext";
import { useFocusEffect } from "@react-navigation/native";

// Chat cosmetics
import {
  buildSenderStyle,
  resolveIncomingBubbleStyle,
  resolveOutgoingChatStyle,
} from "@/cosmetics/chatAppearanceResolver";

// Unified hooks
import { useAttachmentPicker } from "@/hooks/useAttachmentPicker";
import { useComposerToolbarLayout } from "@/hooks/useComposerToolbarLayout";
import { useTypingStatus } from "@/hooks/useTypingStatus";
import { useUnifiedChatScreen } from "@/hooks/useUnifiedChatScreen";
import { useVoiceRecorder, VoiceRecording } from "@/hooks/useVoiceRecorder";

// Chat components
import {
  AttachmentTray,
  CameraLongPressButton,
  ChatComposer,
  ChatHeader,
  ChatMessageList,
  LinkPreviewCard,
  MediaViewerModal,
  MentionAutocomplete,
  MessageActionsSheet,
  MessageHighlightOverlay,
  MessageWithMentions,
  ReactionPills,
  ReplyBubble,
  ScrollReturnButton,
  SwipeableMessage,
  SystemMessageChip,
  ThreadIndicator,
  TypingBar,
  TypingBubble,
  VoiceMessagePlayer,
  VoiceRecordButton,
} from "@/components/chat";
import { AnimatedMessageRow } from "@/components/chat/AnimatedMessageRow";
import type { ChatMessageListRef } from "@/components/chat/ChatMessageList";
import { ChatSkeleton } from "@/components/chat/ChatSkeleton";
import {
  SuspenseFullEmojiPicker,
  SuspenseScheduleMessageModal,
} from "@/components/chat/lazyChatComponents";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { ErrorState } from "@/components/ui";

// Services
import {
  sendAnimalSignalMessage,
  sendChatDraft,
  sendGifMessage,
  sendMediaAttachmentMessage,
  sendVoiceRecordingMessage,
} from "@/chat/sendDraft";
import {
  describeRemoteUrlForLog,
  getPreparedGroupChatData,
  rememberPreparedGroupChatData,
  traceGroupWallpaper,
} from "@/services/chat/groupWallpaperDebug";
import { safeSystemText } from "@/services/chat/normalizeMessage";
import {
  cachePreparedGroupMembers,
  getCachedBackgroundRef,
  getPreparedGroupMembers,
  prepareGroupThreadEntry,
  warmGroupIdentityAssets,
} from "@/services/chat/threadIdentityWarmup";
import { registerGifShare } from "@/services/gif/gifService";
import type { GifItem } from "@/services/gif/types";
import { getGroupMemberPrivate } from "@/services/groupMembers";
import {
  hydrateGroupMembersForDisplay,
  isGroupMember,
  subscribeToGroup,
  subscribeToGroupMembers,
} from "@/services/groups";
import { extractUrls, fetchPreview, hasUrls } from "@/services/linkPreview";
import {
  extractMentionsExact,
  MentionableMember,
} from "@/services/mentionParser";
import {
  applyOptimisticReaction,
  parseReactionsFromMessage,
  ReactionSummary,
  subscribeToMultipleMessageReactions,
  toggleReaction,
} from "@/services/reactions";
import { scheduleMessage } from "@/services/scheduledMessages";
import { registerStickerShare } from "@/services/sticker/stickerService";
import type { StickerItem } from "@/services/sticker/types";
import { markConversationNotificationsRead } from "@/services/userNotifications";

// Animal feature
import {
  buildTimeline,
  TimelineItem,
  timelineKeyExtractor,
} from "@/chat/buildTimeline";
import { AnimalBubble } from "@/components/chat/AnimalBubble";
import { DateDivider } from "@/components/chat/DateDivider";
import { GroupStackedMessageRenderer } from "@/components/chat/GroupStackedMessageRenderer";
import { createCardCornerWidthStore } from "@/components/chat/useGroupedCardLayout";
import { useComposerSheet } from "@/contexts/ComposerSheetContext";
import { useAnimalEntitlement } from "@/hooks/useAnimalEntitlement";
import { playAnimalSound } from "@/services/chat/animalSoundService";
import { useConversationDisplayMode } from "@/store/ConversationDisplayModeContext";

// Voice channels (Stream-powered)
import { VoiceRoomAvatarStack } from "@/components/stream/VoiceRoomAvatarStack";
import { useStreamCall } from "@/contexts/StreamCallContext";
import { useVoiceRoomOccupancy } from "@/hooks/useVoiceRoomOccupancy";
import { getVoiceChannelId } from "@/services/stream/voiceChannelIds";

// Types
import {
  CALL_FEATURES,
  GAMES_V4_ENABLED,
  GIF_PICKER_ENABLED,
  STICKER_PICKER_ENABLED,
} from "@/constants/featureFlags";
import type { GroupPermissionsConfig } from "@/permissions/groupPermissions";
import {
  AttachmentV2,
  LinkPreviewV2,
  MessageV2,
  ReplyToMetadata,
} from "@/types/messaging";
import { Group, GroupMember } from "@/types/models";

// Games V4
import { PinnedInviteBar } from "@/gamesV4/components/PinnedInviteBar";
import { createGameInvite } from "@/gamesV4/services/gameServiceV4";
import type { GameId } from "@/gamesV4/types";

import { clearLastOpenChat, saveLastOpenChat } from "@/services/lastOpenChat";
import { syncMessagesAroundTarget } from "@/services/sync/syncEngine";

// Keyboard-sync (KCSV + fallback animated container)
import {
  ChatFooterWrapper,
  ChatKeyboardContainer,
  KeyboardSafeAreaSpacer,
  setChatScrollViewConfig,
  useRenderChatScrollComponent,
} from "@/components/chat/ChatKeyboardScrollView";
import { SheetDismissLayer } from "@/components/chat/SheetDismissLayer";
import { useTwoPhaseListConfig } from "@/hooks/chat/useTwoPhaseListConfig";
import { chatPerf } from "@/utils/chatPerf";
import { createLogger } from "@/utils/log";
import { scheduleIdleWork } from "@/utils/scheduleIdleWork";
const logger = createLogger("screens/groups/GroupChatScreen");
// =============================================================================
// Constants
// =============================================================================

const NOOP = () => {};

/**
 * Stable empty array shared across all message cells that have no reactions.
 * Prevents React.memo on renderers from seeing a new `[]` reference every
 * render, which would force ALL visible cells to re-render on every update.
 */
const EMPTY_REACTIONS: ReactionSummary[] = [];
interface Props {
  route: any;
  navigation: any;
}

// =============================================================================
// GroupChatScreen Component
// =============================================================================

export default function GroupChatScreen({ route, navigation }: Props) {
  const renderStartRef = useRef(performance.now());
  const mountCountRef = useRef(0);
  mountCountRef.current++;
  if (mountCountRef.current === 1) {
    chatPerf.mark("group-chat-mount");
    chatPerf.trackMount("GroupChatScreen", route.params.groupId);
    chatPerf.beginEntryTrace("GroupChatScreen", route.params.groupId, true);
  }

  const {
    groupId,
    groupName: initialGroupName,
    targetMessageId,
    jumpRequestId,
    initialGroupData,
  } = route.params;
  const preparedGroupData = useMemo(
    () => getPreparedGroupChatData(groupId, "group-chat-screen-mount"),
    [groupId],
  );
  const seededGroupIdentity = useMemo(() => {
    const name =
      initialGroupData?.name ||
      preparedGroupData?.name ||
      initialGroupName ||
      "";
    const avatarUrl =
      normalizeRemoteImageUrl(
        initialGroupData?.avatarUrl ?? preparedGroupData?.avatarUrl,
      ) ?? null;
    const backgroundUrl =
      normalizeRemoteImageUrl(
        initialGroupData?.backgroundUrl ?? preparedGroupData?.backgroundUrl,
      ) ?? null;

    if (!name && !avatarUrl && !backgroundUrl) return null;

    return {
      name,
      avatarUrl,
      backgroundUrl,
    };
  }, [
    initialGroupData?.avatarUrl,
    initialGroupData?.backgroundUrl,
    initialGroupData?.name,
    initialGroupName,
    preparedGroupData?.avatarUrl,
    preparedGroupData?.backgroundUrl,
    preparedGroupData?.name,
  ]);

  // Two-phase FlatList: lightweight for first paint, full for steady-state
  const { listConfig } = useTwoPhaseListConfig(groupId);
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;
  const { setCurrentChatId } = useInAppNotifications();
  const { profile, refreshProfile } = useUser();
  const animalEntitlement = useAnimalEntitlement(
    uid,
    profile?.chatAppearance ?? null,
  );
  const { displayMode } = useConversationDisplayMode();
  const { width: windowWidth } = useWindowDimensions();

  // Customizable toolbar
  const toolbar = useComposerToolbarLayout(uid);

  // Voice room occupancy (Stream-powered)
  const voiceRoom = useVoiceRoomOccupancy(groupId);
  const { isBusy, activeSession } = useStreamCall();
  const voiceChannelId = groupId ? getVoiceChannelId(groupId) : "";
  const isCurrentUserInThisVoiceRoom =
    activeSession?.type === "voice_channel" &&
    activeSession.channelId === voiceChannelId;

  // Resolve outgoing chat cosmetics (bubble color, text color, font)
  const chatStyle = useMemo(
    () =>
      resolveOutgoingChatStyle({
        chatAppearance: profile?.chatAppearance ?? null,
        appearanceMode: isDark ? "dark" : "light",
      }),
    [profile?.chatAppearance, isDark],
  );

  // Build sender style snapshot for stamping on outgoing messages
  const senderStyle = useMemo(
    () => buildSenderStyle(profile?.chatAppearance ?? null),
    [profile?.chatAppearance],
  );

  // Track current group chat for notification suppression
  const focusCountRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      focusCountRef.current++;
      const isResume = focusCountRef.current > 1;
      chatPerf.mark("group-chat-focus");
      chatPerf.trackFocus("GroupChatScreen", groupId, isResume);
      if (groupId) {
        setCurrentChatId(groupId, "group");
      }
      // Persist this as the last open chat for resume-on-reopen
      saveLastOpenChat("GroupChat", {
        groupId,
        groupName: initialGroupName,
      });
      return () => {
        setCurrentChatId(null);
        clearLastOpenChat();
      };
    }, [groupId, initialGroupName, setCurrentChatId]),
  );

  // ==========================================================================
  // Screen State (No message state - uses unified hook)
  // ==========================================================================

  // Seed group state from navigation params for instant header + background rendering.
  // The full group data will overwrite this once Firestore responds.
  const [group, setGroup] = useState<Group | null>(() => {
    if (seededGroupIdentity) {
      return {
        id: groupId,
        name: seededGroupIdentity.name,
        avatarUrl: seededGroupIdentity.avatarUrl,
        backgroundUrl: seededGroupIdentity.backgroundUrl,
      } as Group;
    }
    return null;
  });
  const [groupLoading, setGroupLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>(
    () => getPreparedGroupMembers(groupId) ?? [],
  );
  const [memberBootstrapPending, setMemberBootstrapPending] = useState(
    () => (getPreparedGroupMembers(groupId) ?? []).length === 0,
  );
  const messageListRef = useRef<ChatMessageListRef>(null);
  const textInputRef = useRef<any>(null);

  // Media viewer state (H10)
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [viewerAttachments, setViewerAttachments] = useState<AttachmentV2[]>(
    [],
  );
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [viewerSenderName, setViewerSenderName] = useState<string>("");
  const [viewerTimestamp, setViewerTimestamp] = useState<Date | undefined>();

  // Link previews cache (H12)
  const [linkPreviews, setLinkPreviews] = useState<
    Map<string, LinkPreviewV2 | null>
  >(new Map());
  const [loadingPreviews, setLoadingPreviews] = useState<Set<string>>(
    new Set(),
  );

  // Message actions state (H7)
  const [actionsSheetVisible, setActionsSheetVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<MessageV2 | null>(
    null,
  );
  const [fullEmojiPickerOpen, setFullEmojiPickerOpen] = useState(false);
  const [userRole, setUserRole] = useState<
    "owner" | "admin" | "moderator" | "member"
  >("member");
  const [permissionsConfig, setPermissionsConfig] = useState<
    GroupPermissionsConfig | undefined
  >(undefined);

  // Reactions state (H8)
  const [messageReactions, setMessageReactions] = useState<
    Map<string, ReactionSummary[]>
  >(new Map());
  const optimisticIds = useRef<Set<string>>(new Set());
  const seededIdsRef = useRef<Set<string>>(new Set());

  // Scheduled messages state (UNI-09)
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [animalPickerVisible, setAnimalPickerVisible] = useState(false);

  // Games V4 state
  const [gameInviteCreating, setGameInviteCreating] = useState(false);

  // Reply navigation state (highlight + jump-back)
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [showReturnButton, setShowReturnButton] = useState(false);
  const returnIndexRef = useRef<number | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Clean up highlight timeout on unmount
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  // Show/hide other members' custom chat styles (viewer preference)
  const [showMemberChatStyles, setShowMemberChatStyles] = useState(true);

  useEffect(() => {
    rememberPreparedGroupChatData(
      groupId,
      {
        name: seededGroupIdentity?.name,
        avatarUrl:
          seededGroupIdentity?.avatarUrl === undefined
            ? undefined
            : seededGroupIdentity.avatarUrl,
        backgroundUrl:
          seededGroupIdentity?.backgroundUrl === undefined
            ? undefined
            : seededGroupIdentity.backgroundUrl,
      },
      "group-chat-screen-seed",
    );

    if (__DEV__) {
      traceGroupWallpaper(groupId, "group-chat-screen-seed", {
        routeBackgroundKey: describeRemoteUrlForLog(
          initialGroupData?.backgroundUrl,
        ).key,
        preparedBackgroundKey: describeRemoteUrlForLog(
          preparedGroupData?.backgroundUrl,
        ).key,
        seededBackgroundKey: describeRemoteUrlForLog(
          seededGroupIdentity?.backgroundUrl,
        ).key,
      });
    }
  }, [
    groupId,
    initialGroupData?.backgroundUrl,
    preparedGroupData?.backgroundUrl,
    seededGroupIdentity?.avatarUrl,
    seededGroupIdentity?.backgroundUrl,
    seededGroupIdentity?.name,
  ]);

  // Re-read on focus so toggling in ChatSettingsScreen takes effect immediately.
  // Deferred to idle to avoid competing with transition animation frames.
  useFocusEffect(
    useCallback(() => {
      if (!groupId || !uid) return;
      let cancelled = false;
      const cancel = scheduleIdleWork(() => {
        getGroupMemberPrivate(groupId, uid).then((priv) => {
          if (!cancelled && priv) {
            const newVal = priv.showMemberChatStyles !== false;
            setShowMemberChatStyles((prev) =>
              prev === newVal ? prev : newVal,
            );
          }
        });
      });
      return () => {
        cancelled = true;
        cancel();
      };
    }, [groupId, uid]),
  );

  // ==========================================================================
  // Mentionable Members
  // ==========================================================================

  const mentionableMembers: MentionableMember[] = useMemo(
    () =>
      groupMembers.map((m) => ({
        uid: m.uid,
        displayName: m.displayName || "Unknown",
        username: m.username,
      })),
    [groupMembers],
  );

  // ==========================================================================
  // Unified Hook (UNI-06)
  // ==========================================================================

  const screen = useUnifiedChatScreen({
    scope: "group",
    conversationId: groupId || "",
    currentUid: uid || "",
    currentUserName:
      profile?.displayName ||
      profile?.username ||
      currentFirebaseUser?.displayName ||
      "User",
    enableVoice: true,
    enableAttachments: true,
    enableMentions: true,
    enableScheduledMessages: true,
    onSchedulePress: () => setScheduleModalVisible(true),
    mentionableMembers,
    maxMentionSuggestions: 5,
    senderStyle,
  });

  // Messages come directly from the unified hook (SQLite-backed)
  const messages = screen.messages;

  // Keep ComposerSheetContext aware of the latest keyboard height
  const { setLastKeyboardHeight, sheetExtraPadding, dismissActiveSheet } =
    useComposerSheet();
  useEffect(() => {
    if (screen.keyboard.finalKeyboardHeight > 0) {
      setLastKeyboardHeight(screen.keyboard.finalKeyboardHeight);
    }
  }, [screen.keyboard.finalKeyboardHeight, setLastKeyboardHeight]);

  // Warm image cache for recent chat images
  usePrefetchChatImages(messages?.slice(0, 20));

  // Prefetch group member avatars for instant display
  const memberAvatarUrls = useMemo(
    () =>
      groupMembers
        .map((m) => m.profilePictureUrl)
        .filter((url): url is string => !!url),
    [groupMembers],
  );
  usePrefetch(memberAvatarUrls.length > 0 ? memberAvatarUrls : undefined);

  // Prefetch the group avatar for instant header rendering
  const resolvedGroupAvatarUrl = useMemo(
    () =>
      normalizeRemoteImageUrl(
        group?.avatarUrl ?? seededGroupIdentity?.avatarUrl,
      ) ?? null,
    [group?.avatarUrl, seededGroupIdentity?.avatarUrl],
  );
  const groupAvatarUrls = useMemo(
    () => (resolvedGroupAvatarUrl ? [resolvedGroupAvatarUrl] : undefined),
    [resolvedGroupAvatarUrl],
  );
  usePrefetch(groupAvatarUrls);

  // Prefetch the group background image for instant display.
  // Normalize the URL so the prefetch cache key matches what warmRemoteImage
  // uses (Image.loadAsync with normalizeRemoteImageUrl). Without this, the
  // prefetch and warmup can populate different cache entries and the render
  // misses the warm cache — the key reason backgrounds loaded slower than avatars.
  // Use the seed only before Firestore has responded (group still from seed).
  // Once group state comes from Firestore, trust its backgroundUrl — even if
  // null (explicitly removed). Using ?? here would fall through null to the
  // stale seed, keeping a removed background visible.
  const resolvedGroupBackgroundUrl = useMemo(
    () =>
      normalizeRemoteImageUrl(
        group ? group.backgroundUrl : seededGroupIdentity?.backgroundUrl,
      ) ?? null,
    [group, group?.backgroundUrl, seededGroupIdentity?.backgroundUrl],
  );
  const groupBackgroundUrls = useMemo(() => {
    return resolvedGroupBackgroundUrl
      ? [resolvedGroupBackgroundUrl]
      : undefined;
  }, [resolvedGroupBackgroundUrl]);
  usePrefetch(groupBackgroundUrls);
  const cachedBackgroundRef = useMemo(
    () => getCachedBackgroundRef(resolvedGroupBackgroundUrl),
    [resolvedGroupBackgroundUrl],
  );
  const wallpaperSource = useMemo(
    () =>
      cachedBackgroundRef ??
      buildRemoteImageSource(resolvedGroupBackgroundUrl ?? undefined),
    [cachedBackgroundRef, resolvedGroupBackgroundUrl],
  );
  const wallpaperSourceKind = cachedBackgroundRef
    ? "image-ref"
    : resolvedGroupBackgroundUrl
      ? "url"
      : "none";
  const wallpaperLoadStartRef = useRef<number | null>(null);
  const resolvedGroupName =
    group?.name ||
    seededGroupIdentity?.name ||
    initialGroupName ||
    "Group Chat";

  const handleWallpaperLoadStart = useCallback(() => {
    wallpaperLoadStartRef.current = performance.now();
    chatPerf.traceCheckpoint(
      "GroupChatScreen",
      groupId,
      "wallpaper-load-start",
    );
    if (__DEV__) {
      traceGroupWallpaper(groupId, "group-chat-screen-wallpaper-load-start", {
        sourceKind: wallpaperSourceKind,
        sinceMountMs: Math.round(performance.now() - renderStartRef.current),
        backgroundKey: describeRemoteUrlForLog(resolvedGroupBackgroundUrl).key,
      });
    }
  }, [groupId, resolvedGroupBackgroundUrl, wallpaperSourceKind]);

  const handleWallpaperLoad = useCallback(() => {
    chatPerf.traceCheckpoint("GroupChatScreen", groupId, "wallpaper-load");
    if (__DEV__) {
      traceGroupWallpaper(groupId, "group-chat-screen-wallpaper-load", {
        sourceKind: wallpaperSourceKind,
        sinceMountMs: Math.round(performance.now() - renderStartRef.current),
        sinceLoadStartMs:
          wallpaperLoadStartRef.current == null
            ? null
            : Math.round(performance.now() - wallpaperLoadStartRef.current),
      });
    }
  }, [groupId, wallpaperSourceKind]);

  const handleWallpaperDisplay = useCallback(() => {
    chatPerf.traceCheckpoint("GroupChatScreen", groupId, "wallpaper-display");
    if (__DEV__) {
      traceGroupWallpaper(groupId, "group-chat-screen-wallpaper-display", {
        sourceKind: wallpaperSourceKind,
        sinceMountMs: Math.round(performance.now() - renderStartRef.current),
        sinceLoadStartMs:
          wallpaperLoadStartRef.current == null
            ? null
            : Math.round(performance.now() - wallpaperLoadStartRef.current),
      });
    }
  }, [groupId, wallpaperSourceKind]);

  const handleWallpaperError = useCallback(
    (event: { error: string }) => {
      if (__DEV__) {
        traceGroupWallpaper(groupId, "group-chat-screen-wallpaper-error", {
          sourceKind: wallpaperSourceKind,
          backgroundKey: describeRemoteUrlForLog(resolvedGroupBackgroundUrl)
            .key,
          error: event.error,
        });
      }
    },
    [groupId, resolvedGroupBackgroundUrl, wallpaperSourceKind],
  );

  useEffect(() => {
    if (__DEV__) {
      traceGroupWallpaper(groupId, "group-chat-screen-background-source", {
        liveBackgroundKey: describeRemoteUrlForLog(group?.backgroundUrl).key,
        seededBackgroundKey: describeRemoteUrlForLog(
          seededGroupIdentity?.backgroundUrl,
        ).key,
        resolvedBackgroundKey: describeRemoteUrlForLog(
          resolvedGroupBackgroundUrl,
        ).key,
        sourceKind: wallpaperSourceKind,
        cachedRefHit: !!cachedBackgroundRef,
      });
    }
  }, [
    cachedBackgroundRef,
    group?.backgroundUrl,
    groupId,
    resolvedGroupBackgroundUrl,
    seededGroupIdentity?.backgroundUrl,
    wallpaperSourceKind,
  ]);

  useEffect(() => {
    if (!groupId || groupMembers.length > 0) return;

    prepareGroupThreadEntry(groupId, {
      groupAvatarUrl: resolvedGroupAvatarUrl,
      backgroundUrl: resolvedGroupBackgroundUrl,
    })
      .then((members) => {
        if (members.length > 0) {
          setGroupMembers((current) =>
            current.length > 0 ? current : members,
          );
        }
      })
      .catch((error) => {
        logger.debug("[GroupChatScreen] Warm-start member bootstrap failed", {
          error,
        });
      })
      .finally(() => {
        setMemberBootstrapPending(false);
      });
  }, [
    groupId,
    groupMembers.length,
    resolvedGroupAvatarUrl,
    resolvedGroupBackgroundUrl,
  ]);

  // Seed reactions from denormalized reactionsSummary for instant first render.
  // The real-time subscription will reconcile with full data (hasReacted, userIds).
  useEffect(() => {
    if (!uid || messages.length === 0) return;
    const seedMap = new Map<string, ReactionSummary[]>();
    let hasNew = false;
    for (const m of messages) {
      if (
        m.reactionsSummary &&
        Object.keys(m.reactionsSummary).length > 0 &&
        !seededIdsRef.current.has(m.id)
      ) {
        seededIdsRef.current.add(m.id);
        seedMap.set(m.id, parseReactionsFromMessage(m.reactionsSummary, uid));
        hasNew = true;
      }
    }
    if (hasNew) {
      setMessageReactions((prev) => {
        const next = new Map(prev);
        seedMap.forEach((reactions, id) => {
          if (!next.has(id) || next.get(id)!.length === 0) {
            next.set(id, reactions);
          }
        });
        return next;
      });
    }
  }, [uid, messages]);

  // ==========================================================================
  // Typing Indicator
  // ==========================================================================

  const typing = useTypingStatus({
    scope: "group",
    conversationId: groupId || "",
    currentUid: uid || "",
  });

  /** Resolve typing user UIDs to display names for the indicator */
  const typingUserNames = useMemo(() => {
    if (typing.typingUserIds.length === 0) return [];
    return typing.typingUserIds.map((typerUid) => {
      const member = groupMembers.find((m) => m.uid === typerUid);
      return member?.displayName || member?.username || "Someone";
    });
  }, [typing.typingUserIds, groupMembers]);

  // ==========================================================================
  // Attachment & Voice Hooks
  // ==========================================================================

  // Send an in-app camera capture directly as a media message (skip tray).
  const handleDirectCameraSend = useCallback(
    async (imageUri: string) => {
      if (!uid || screen.sending) return;
      const result = await sendMediaAttachmentMessage({
        chat: screen.chat,
        attachment: {
          id: `cam_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          uri: imageUri,
          kind: "image",
          mime: "image/jpeg",
        },
      });

      if (!result.success) {
        setSnackbar({
          visible: true,
          message: result.error || "Failed to send photo",
        });
      }
    },
    [uid, screen.chat, screen.sending],
  );

  // Send gallery-selected images directly as media messages (skip tray).
  const handleDirectGallerySend = useCallback(
    async (imageUris: string[]) => {
      if (!uid || screen.sending) return;
      for (const uri of imageUris) {
        const result = await sendMediaAttachmentMessage({
          chat: screen.chat,
          attachment: {
            id: `gal_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            uri,
            kind: "image",
            mime: "image/jpeg",
          },
        });

        if (!result.success) {
          setSnackbar({
            visible: true,
            message: result.error || "Failed to send photo",
          });
        }
      }
    },
    [uid, screen.chat, screen.sending],
  );

  // Send a GIF selected from the KLIPY-powered GIF picker.
  const handleGifSelected = useCallback(
    async (gif: GifItem) => {
      if (!uid || screen.sending) return;
      const result = await sendGifMessage({
        chat: screen.chat,
        gif: {
          id: `gif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          url: gif.fullUrl,
          width: gif.fullWidth,
          height: gif.fullHeight,
          mime: gif.mime ?? "image/gif",
        },
      });

      if (!result.success) {
        setSnackbar({
          visible: true,
          message: result.error || "Failed to send GIF",
        });
      }
      // Fire-and-forget: let KLIPY know this GIF was shared (analytics / ranking).
      registerGifShare(gif.id).catch(() => {});
    },
    [uid, screen.chat, screen.sending],
  );

  // Send a sticker selected from the KLIPY-powered sticker picker.
  const handleStickerSelected = useCallback(
    async (sticker: StickerItem) => {
      if (!uid || screen.sending) return;
      const result = await sendGifMessage({
        chat: screen.chat,
        gif: {
          id: `sticker_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          url: sticker.fullUrl,
          width: sticker.fullWidth,
          height: sticker.fullHeight,
          mime: sticker.mime ?? "image/gif",
        },
      });

      if (!result.success) {
        setSnackbar({
          visible: true,
          message: result.error || "Failed to send sticker",
        });
      }
      // Fire-and-forget: let KLIPY know this sticker was shared.
      registerStickerShare(sticker.slug).catch(() => {});
    },
    [uid, screen.chat, screen.sending],
  );

  const attachmentPicker = useAttachmentPicker({
    maxAttachments: 10,
    maxFileSize: 10 * 1024 * 1024,
    allowedTypes: ["image"],
    routeParams: route.params as Record<string, any>,
    returnRoute: "GroupChat",
    returnData: { groupId, groupName: initialGroupName },
    onCameraCapture: handleDirectCameraSend,
    onGalleryPick: handleDirectGallerySend,
  });

  const voiceRecorder = useVoiceRecorder({
    maxDuration: 60,
    onRecordingComplete: NOOP,
  });

  // ==========================================================================
  // Initialization (Group metadata only - messages via unified hook)
  // ==========================================================================

  useEffect(() => {
    if (!groupId || !uid) return;

    let cancelled = false;

    // OPTIMIZATION: Start the Firestore subscription immediately instead of
    // waiting for the isGroupMember check to complete. The subscription itself
    // will return null/error if the user isn't a member (Firestore rules),
    // so the membership check is a redundant gate that adds latency.
    async function initGroupSubscription() {
      try {
        setGroupLoading(true);
        setError(null);

        logger.debug("[GroupChatScreen] Subscribing to group doc", { groupId });

        const unsub = subscribeToGroup(groupId, (groupData) => {
          if (cancelled) return;

          if (!groupData) {
            setError("Group not found");
            setGroupLoading(false);
            return;
          }

          rememberPreparedGroupChatData(
            groupId,
            {
              name: groupData.name,
              avatarUrl: groupData.avatarUrl ?? null,
              backgroundUrl: groupData.backgroundUrl ?? null,
            },
            "group-chat-screen-subscription",
          );

          setGroup((current) => {
            if (__DEV__) {
              traceGroupWallpaper(
                groupId,
                "group-chat-screen-subscription-update",
                {
                  previousBackgroundKey: describeRemoteUrlForLog(
                    current?.backgroundUrl,
                  ).key,
                  nextBackgroundKey: describeRemoteUrlForLog(
                    groupData.backgroundUrl,
                  ).key,
                },
              );
            }
            return groupData;
          });
          setPermissionsConfig(groupData.permissionsConfig);
          setGroupLoading(false);
        });

        // Store the unsubscribe for cleanup
        unsubRef.current = unsub;

        // Deferred membership check — runs after subscription is already live.
        // If the user isn't a member, the subscription will also fail via
        // Firestore security rules, but this provides a cleaner error message.
        InteractionManager.runAfterInteractions(() => {
          if (cancelled) return;
          isGroupMember(groupId, uid!).then((isMember) => {
            if (!cancelled && !isMember) {
              setError("You are not a member of this group");
              unsubRef.current?.();
            }
          });
        });
      } catch (err: any) {
        if (cancelled) return;
        logger.error("Error initializing group subscription:", err);
        setError(err.message || "Failed to load group");
        setGroupLoading(false);
      }
    }

    const unsubRef = { current: null as (() => void) | null };
    initGroupSubscription();

    return () => {
      cancelled = true;
      if (unsubRef.current) {
        logger.debug("[GroupChatScreen] Unsubscribing from group doc", {
          groupId,
        });
        unsubRef.current();
      }
    };
  }, [groupId, uid]);

  useEffect(() => {
    if (!groupId) return;

    let active = true;
    const unsubscribe = subscribeToGroupMembers(groupId, (members) => {
      void hydrateGroupMembersForDisplay(members)
        .then((enrichedMembers) => {
          if (!active) return;

          cachePreparedGroupMembers(groupId, enrichedMembers);
          setGroupMembers(enrichedMembers);
          setMemberBootstrapPending(false);

          const currentMember = uid
            ? enrichedMembers.find((member) => member.uid === uid)
            : null;
          if (currentMember) {
            setUserRole(currentMember.role);
          }

          void warmGroupIdentityAssets({
            groupId,
            groupAvatarUrl: resolvedGroupAvatarUrl,
            backgroundUrl: resolvedGroupBackgroundUrl,
            members: enrichedMembers,
          });
        })
        .catch((error) => {
          logger.warn("[GroupChatScreen] Failed to hydrate group members", {
            error,
          });
          if (!active) return;
          setMemberBootstrapPending(false);
        });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [groupId, resolvedGroupAvatarUrl, resolvedGroupBackgroundUrl, uid]);

  useEffect(() => {
    if (!uid || !groupId) return;
    // Defer notification marking to idle — pure backend side-effect with no UI impact
    const cancel = scheduleIdleWork(() => {
      markConversationNotificationsRead(uid, groupId, "group").catch(
        (error) => {
          logger.warn("Failed to mark group notifications read:", error);
        },
      );
    });
    return cancel;
  }, [uid, groupId]);

  // NOTE: Tab bar visibility is now handled at the navigator level
  // in RootNavigator.tsx using getFocusedRouteNameFromRoute.
  // This eliminates flicker during navigation transitions.

  // ==========================================================================
  // Link Previews (H12)
  // ==========================================================================

  // Use refs to avoid cascading re-renders: the effect previously depended
  // on [messages, linkPreviews, loadingPreviews] — each fetch updated both
  // linkPreviews and loadingPreviews, re-triggering the entire effect.
  const linkPreviewsCacheRef = useRef(linkPreviews);
  linkPreviewsCacheRef.current = linkPreviews;
  const loadingPreviewsCacheRef = useRef(loadingPreviews);
  loadingPreviewsCacheRef.current = loadingPreviews;

  useEffect(() => {
    let cancelled = false;
    // Defer link preview fetching to idle to avoid competing with first-paint
    const cancel = scheduleIdleWork(() => {
      const fetchLinkPreviews = async () => {
        for (const message of messages) {
          if (cancelled) break;
          if (message.kind !== "text") continue;
          if (!message.text) continue;
          if (linkPreviewsCacheRef.current.has(message.id)) continue;
          if (loadingPreviewsCacheRef.current.has(message.id)) continue;
          if (!hasUrls(message.text)) continue;

          const urls = extractUrls(message.text);
          if (urls.length === 0) continue;

          setLoadingPreviews((prev) => new Set([...prev, message.id]));

          try {
            const preview = await fetchPreview(urls[0]);
            setLinkPreviews((prev) => new Map(prev).set(message.id, preview));
          } catch {
            setLinkPreviews((prev) => new Map(prev).set(message.id, null));
          } finally {
            setLoadingPreviews((prev) => {
              const newSet = new Set(prev);
              newSet.delete(message.id);
              return newSet;
            });
          }
        }
      };
      fetchLinkPreviews();
    });
    return () => {
      cancelled = true;
      cancel();
    };
    // Only re-run when messages change, not when preview state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // ==========================================================================
  // Reactions Subscription (H8)
  // ==========================================================================

  const handleOptimisticReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!uid) return;
      optimisticIds.current.add(messageId);
      setMessageReactions((prev) => {
        const next = new Map(prev);
        const current = next.get(messageId) || [];
        next.set(messageId, applyOptimisticReaction(current, emoji, uid));
        return next;
      });
    },
    [uid],
  );

  const handleSheetReaction = useCallback(
    (emoji: string) => {
      if (!selectedMessage || !groupId || !uid) return;
      const messageId = selectedMessage.id;
      handleOptimisticReaction(messageId, emoji);
      toggleReaction({
        scope: "group",
        conversationId: groupId,
        messageId,
        emoji,
        uid,
      })
        .then((result) => {
          if (!result.success) handleOptimisticReaction(messageId, emoji);
        })
        .catch(() => handleOptimisticReaction(messageId, emoji));
    },
    [selectedMessage, groupId, uid, handleOptimisticReaction],
  );

  // Open full emoji picker (from "+" in action sheet)
  const handleExpandReactions = useCallback(() => {
    setFullEmojiPickerOpen(true);
  }, []);

  // Handle emoji from full picker
  const handleFullEmojiReaction = useCallback(
    (emoji: string) => {
      setFullEmojiPickerOpen(false);
      if (!selectedMessage || !groupId || !uid) return;
      const messageId = selectedMessage.id;
      handleOptimisticReaction(messageId, emoji);
      toggleReaction({
        scope: "group",
        conversationId: groupId,
        messageId,
        emoji,
        uid,
      })
        .then((result) => {
          if (!result.success) handleOptimisticReaction(messageId, emoji);
        })
        .catch(() => handleOptimisticReaction(messageId, emoji));
    },
    [selectedMessage, groupId, uid, handleOptimisticReaction],
  );

  // Stabilize reaction subscription target IDs to avoid re-subscribing on
  // every message array change. Only re-subscribe when the actual set of
  // message IDs we care about has changed.
  const reactionTargetKey = useMemo(() => {
    if (!messages.length) return "";
    const baseIds = new Set(messages.slice(0, 50).map((m) => m.id));
    optimisticIds.current.forEach((id) => baseIds.add(id));
    return Array.from(baseIds).sort().join(",");
  }, [messages]);

  useEffect(() => {
    if (!groupId || !uid || !reactionTargetKey) return;

    const messageIds = reactionTargetKey.split(",");

    const unsubscribe = subscribeToMultipleMessageReactions(
      "group",
      groupId,
      messageIds,
      uid,
      (reactionsMap) => setMessageReactions(reactionsMap),
    );

    return () => unsubscribe();
  }, [groupId, uid, reactionTargetKey]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  // Voice Channel Handler (Stream-powered)
  const handleJoinVoiceChannel = useCallback(() => {
    if (!CALL_FEATURES.CALLS_ENABLED) return;
    if (!group || !groupId) return;

    const channelId = getVoiceChannelId(groupId);
    navigation.navigate("VoiceChannel" as any, {
      channelId,
      channelName: group.name || "Voice Channel",
      groupId,
    });
  }, [group, groupId, navigation]);

  // Games V4: handle game selection from picker
  const handleGameSelected = useCallback(
    async (gameId: GameId) => {
      if (!groupId || !uid || gameInviteCreating) return;
      setGameInviteCreating(true);
      try {
        const { inviteId } = await createGameInvite({
          conversationId: groupId,
          conversationScope: "group",
          gameId,
        });
        navigation.navigate("GameLobbyV4", { inviteId });
      } catch (err: any) {
        const msg =
          err?.code === "functions/not-found" || err?.message === "not-found"
            ? "Game service is not available. Please make sure Cloud Functions are deployed."
            : (err?.message ?? "Failed to create game invite");
        Alert.alert("Game Error", msg);
      } finally {
        setGameInviteCreating(false);
      }
    },
    [groupId, uid, navigation, gameInviteCreating],
  );

  const handleOpenMediaViewer = useCallback(
    (
      attachments: AttachmentV2[],
      index: number,
      senderName: string,
      timestamp: number,
    ) => {
      setViewerAttachments(attachments);
      setViewerInitialIndex(index);
      setViewerSenderName(senderName);
      setViewerTimestamp(new Date(timestamp));
      setMediaViewerVisible(true);
    },
    [],
  );

  /** Stable callback for stacked-mode thread navigation. */
  const handleStackedThreadPress = useCallback(
    (messageId: string) => {
      navigation.navigate("ThreadView", {
        conversationId: groupId,
        scope: "group" as const,
        rootMessageId: messageId,
      });
    },
    [navigation, groupId],
  );

  // ==========================================================================
  // Message Grouping + Timeline — moved above scrollToMessage for declaration order
  // ==========================================================================

  const MESSAGE_GROUP_THRESHOLD_MS = 2 * 60 * 1000;

  const areMessagesGrouped = useCallback(
    (msg1: MessageV2 | null, msg2: MessageV2 | null): boolean => {
      if (!msg1 || !msg2) return false;
      if (msg1.kind === "system" || msg2.kind === "system") return false;
      if (msg1.replyTo || msg2.replyTo) return false;
      if (msg1.senderId !== msg2.senderId) return false;
      return (
        Math.abs(msg1.createdAt - msg2.createdAt) < MESSAGE_GROUP_THRESHOLD_MS
      );
    },
    [],
  );

  /** Derive timeline items (messages + day dividers) from messages */
  const timelineData: TimelineItem<MessageV2>[] = useMemo(() => {
    const result = chatPerf.time("group-buildTimeline", () =>
      buildTimeline<MessageV2>(
        messages,
        (msg) => msg.createdAt,
        areMessagesGrouped,
      ),
    );
    chatPerf.traceCheckpoint("GroupChatScreen", groupId, "buildTimeline");
    return result;
  }, [messages, areMessagesGrouped, groupId]);

  const handleMessageLongPress = useCallback((message: MessageV2) => {
    Keyboard.dismiss();
    setSelectedMessage(message);
    setActionsSheetVisible(true);
  }, []);

  // Keep a live ref to timelineData so scrollToMessage can read the latest
  // value at call-time without forcing renderMessage to be recreated on every
  // message change.
  const timelineDataRef = useRef(timelineData);
  timelineDataRef.current = timelineData;

  // Lightweight shared store for corner-only width comparisons (no equalization)
  const cornerWidthStore = useMemo(() => createCardCornerWidthStore(), []);

  // ── Live refs for volatile data read inside renderMessage ──────────
  // By reading these from refs, renderMessage's dependency array stays small
  // and the callback reference stays stable across state changes.  This
  // prevents FlatList from seeing a new renderItem function on every reaction
  // update, highlight toggle, or link-preview fetch — which would otherwise
  // force a re-render diff of every visible cell.
  const messageReactionsRef = useRef(messageReactions);
  messageReactionsRef.current = messageReactions;
  const fallbackReactionsRef = useRef<Map<string, ReactionSummary[]>>(
    new Map(),
  );
  const linkPreviewsRef = useRef(linkPreviews);
  linkPreviewsRef.current = linkPreviews;
  const loadingPreviewsRef = useRef(loadingPreviews);
  loadingPreviewsRef.current = loadingPreviews;
  const highlightedMessageIdRef = useRef(highlightedMessageId);
  highlightedMessageIdRef.current = highlightedMessageId;
  const mentionableMembersRef = useRef(mentionableMembers);
  mentionableMembersRef.current = mentionableMembers;

  useEffect(() => {
    fallbackReactionsRef.current.clear();
  }, [messages, uid]);

  // Enhanced scroll-to-message with highlight animation
  const scrollToMessage = useCallback((messageId: string) => {
    const targetIndex = timelineDataRef.current.findIndex(
      (item) => item.type === "message" && item.data.id === messageId,
    );
    if (targetIndex === -1 || !messageListRef.current) return;

    // Clear any existing highlight timeout
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    // Store current position for return navigation
    returnIndexRef.current = 0;
    setShowReturnButton(true);

    // Scroll to target message
    messageListRef.current.scrollToIndex(targetIndex, true);

    requestAnimationFrame(() => {
      setHighlightedMessageId(messageId);

      // Auto-clear highlight after animation
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2100);
    });
  }, []);

  // Handle return button press
  const handleReturnToReply = useCallback(() => {
    const returnIndex = returnIndexRef.current;
    screen.chat.clearMessageAnchor();
    setShowReturnButton(false);
    returnIndexRef.current = null;
    if (returnIndex !== null && messageListRef.current) {
      requestAnimationFrame(() => {
        messageListRef.current?.scrollToIndex(returnIndex, true);
      });
    }
  }, [screen.chat]);

  // Auto-scroll to targetMessageId from navigation (deep jump)
  const hasScrolledToTargetRef = useRef(false);
  const deepJumpSyncingRef = useRef(false);

  // Reset deep-jump refs when targetMessageId changes (e.g. navigating back
  // from GroupInfo with a new target). Without this reset, a previous
  // successful jump would block all future jump attempts.
  const targetJumpKey = jumpRequestId ?? targetMessageId ?? null;
  const prevTargetJumpKeyRef = useRef(targetJumpKey);
  useEffect(() => {
    if (targetJumpKey !== prevTargetJumpKeyRef.current) {
      prevTargetJumpKeyRef.current = targetJumpKey;
      hasScrolledToTargetRef.current = false;
      deepJumpSyncingRef.current = false;
    }
  }, [targetJumpKey]);

  useEffect(() => {
    if (
      !targetMessageId ||
      !groupId ||
      hasScrolledToTargetRef.current ||
      deepJumpSyncingRef.current
    ) {
      return;
    }

    const targetIndex = timelineData.findIndex(
      (item) => item.type === "message" && item.data.id === targetMessageId,
    );
    if (targetIndex !== -1) {
      hasScrolledToTargetRef.current = true;
      requestAnimationFrame(() => {
        scrollToMessage(targetMessageId);
      });
      return;
    }

    if (screen.chat.loadAroundMessage(targetMessageId)) {
      return;
    }

    deepJumpSyncingRef.current = true;
    syncMessagesAroundTarget("group", groupId, targetMessageId, 30)
      .then((found) => {
        if (found) {
          if (!screen.chat.loadAroundMessage(targetMessageId)) {
            screen.chat.refresh();
          }
        } else {
          Alert.alert(
            "Message unavailable",
            "That message couldn't be found. It may have been deleted.",
          );
          logger.warn(
            `[GroupChat] Target message ${targetMessageId} not found on server`,
          );
        }
      })
      .catch((err) => {
        logger.warn("[GroupChat] syncMessagesAroundTarget failed:", err);
      })
      .finally(() => {
        deepJumpSyncingRef.current = false;
      });
  }, [
    targetMessageId,
    timelineData,
    scrollToMessage,
    screen.chat.loadAroundMessage,
    screen.chat.refresh,
    groupId,
  ]);
  // Auto-hide return button callback
  const handleReturnButtonAutoHide = useCallback(() => {
    setShowReturnButton(false);
    returnIndexRef.current = null;
  }, []);

  const handleReply = useCallback(
    (replyToData: ReplyToMetadata) => {
      screen.chat.setReplyTo(replyToData);
      textInputRef.current?.focus();
    },
    [screen.chat],
  );

  const handleCancelReply = useCallback(() => {
    screen.chat.clearReplyTo();
  }, [screen.chat]);

  const handleMessageEdited = useCallback(
    (_messageId: string, _newText: string) => {
      // Messages auto-refresh from SQLite via unified hook
      setSnackbar({ visible: true, message: "Message edited" });
    },
    [],
  );

  const handleMessageDeleted = useCallback(
    (_messageId: string, forAll: boolean) => {
      // Messages auto-refresh from SQLite via unified hook
      setSnackbar({
        visible: true,
        message: forAll ? "Message deleted" : "Message hidden",
      });
    },
    [],
  );

  // Animal button press handler — sends a structured animal signal message
  const handleAnimalPress = useCallback(async () => {
    if (!uid || !groupId) return;
    const { equippedAnimalId, canSend } = animalEntitlement;
    if (!canSend || !equippedAnimalId) return;

    try {
      await playAnimalSound(equippedAnimalId);
    } catch (e) {
      logger.warn("❌ [GroupChatScreen] Animal sound error:", e);
    }
    const result = await sendAnimalSignalMessage({
      chat: screen.chat,
      animalId: equippedAnimalId,
    });
    if (!result.success) {
      logger.error("❌ [GroupChatScreen] Animal send error:", result.error);
    }
  }, [uid, groupId, animalEntitlement, screen.chat]);

  // Animal picker equip handler — refresh profile so the button updates
  const handleAnimalEquipped = useCallback(
    (animalId: string) => {
      setAnimalPickerVisible(false);
      // Profile uses one-shot reads; must explicitly refresh so
      // useAnimalEntitlement picks up the new chatAppearance.animalThemeId
      refreshProfile();
    },
    [refreshProfile],
  );

  // ==========================================================================
  // Schedule Message (UNI-09)
  // ==========================================================================

  const handleScheduleMessage = useCallback(
    async (scheduledFor: Date) => {
      const text = screen.composer.text.trim();
      if (!uid || !groupId || !text) return;

      const { mentionUids } = extractMentionsExact(text, mentionableMembers);

      try {
        const result = await scheduleMessage({
          senderId: uid,
          chatId: groupId,
          scope: "group",
          content: text,
          type: "text",
          scheduledFor,
          mentionUids: mentionUids.length > 0 ? mentionUids : undefined,
        });

        if (result) {
          screen.composer.clearText();
          setScheduleModalVisible(false);
          Alert.alert(
            "Message Scheduled! ⏰",
            `Your message will be sent ${scheduledFor.toLocaleString()}`,
          );
        } else {
          Alert.alert("Error", "Failed to schedule message. Please try again.");
        }
      } catch (error) {
        logger.error("[GroupChatScreen] Schedule message error:", error);
        Alert.alert("Error", "Failed to schedule message.");
      }
    },
    [uid, groupId, screen.composer, mentionableMembers],
  );

  // ==========================================================================
  // Send Message (H10)
  // ==========================================================================

  const handleEmojiInsert = useCallback(
    (emoji: string) => {
      screen.composer.setText(screen.composer.text + emoji);
    },
    [screen.composer],
  );

  const handleTextChange = useCallback(
    (text: string) => {
      screen.composer.setText(text);
      typing.setTyping(text.length > 0);
    },
    [screen.composer, typing],
  );

  const handleSendMessage = useCallback(async () => {
    await sendChatDraft({
      currentUid: uid,
      conversationId: groupId,
      isSending: screen.sending,
      chat: screen.chat,
      composer: screen.composer,
      attachmentPicker,
      onBeforeSend: () => typing.setTyping(false),
      onError: (message) =>
        setSnackbar({
          visible: true,
          message,
        }),
      buildTextOptions: ({ text, replyTo }) => {
        const { mentionUids, mentionSpans } = extractMentionsExact(
          text,
          mentionableMembers,
        );

        return {
          replyTo: replyTo || undefined,
          mentionUids,
          mentionSpans: mentionSpans.length > 0 ? mentionSpans : undefined,
        };
      },
      buildAttachmentOptions: ({ text, replyTo }) => {
        const { mentionUids } = extractMentionsExact(text, mentionableMembers);
        return {
          replyTo: replyTo || undefined,
          mentionUids,
        };
      },
    });
  }, [
    uid,
    groupId,
    screen.chat,
    screen.composer,
    screen.sending,
    typing,
    attachmentPicker,
    mentionableMembers,
  ]);

  const handleAddAttachment = useCallback(async () => {
    dismissActiveSheet();
    await attachmentPicker.pickFromGallery();
  }, [attachmentPicker, dismissActiveSheet]);

  const handleCaptureFromCamera = useCallback(async () => {
    dismissActiveSheet();
    await attachmentPicker.captureFromCamera();
  }, [attachmentPicker, dismissActiveSheet]);

  const handleVoiceRecordingComplete = useCallback(
    async (recording: VoiceRecording) => {
      if (!uid || screen.sending) return;

      const result = await sendVoiceRecordingMessage({
        chat: screen.chat,
        currentUid: uid,
        recording,
      });

      if (!result.success) {
        setSnackbar({
          visible: true,
          message: result.error || "Failed to send voice",
        });
      }
    },
    [uid, screen.chat, screen.sending],
  );

  // ==========================================================================
  // Helpers (formatTime for bubble mode timestamps)
  // ==========================================================================

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // ==========================================================================
  // Get sender info from group members
  // ==========================================================================

  const groupMemberById = useMemo(
    () => new Map(groupMembers.map((member) => [member.uid, member])),
    [groupMembers],
  );

  const getSenderProfileInfo = useCallback(
    (senderId: string) => {
      const member = groupMemberById.get(senderId);
      return {
        displayName: member?.displayName || member?.username || "Unknown",
        profilePictureUrl: member?.profilePictureUrl || null,
        decorationId: member?.decorationId || null,
      };
    },
    [groupMemberById],
  );

  const getSenderDisplayName = useCallback(
    (message: MessageV2) => {
      if (message.senderName) return message.senderName;
      const member = groupMemberById.get(message.senderId);
      return member?.displayName || member?.username || "Unknown";
    },
    [groupMemberById],
  );

  // ==========================================================================
  // Render Message Item (MessageV2)
  // ==========================================================================

  const renderMessage = useCallback(
    ({
      item: timelineItem,
      index,
    }: {
      item: TimelineItem<MessageV2>;
      index: number;
    }) => {
      if (timelineItem.type === "date-divider") {
        return <DateDivider label={timelineItem.label} />;
      }

      const item = timelineItem.data;
      const isOwnMessage = item.senderId === uid;
      // Use precomputed grouping from buildTimeline
      const isGroupedWithPrev = timelineItem.isGroupedWithPrevious;
      const isGroupedWithNextMsg = timelineItem.isGroupedWithNext;

      // Neighbor IDs for width-aware right-side corners.
      // In the inverted FlatList (newest-first), "previous" (visually above)
      // lives at index + 1, and "next" (visually below) lives at index - 1.
      const aboveTl = timelineDataRef.current[index + 1];
      const groupPrevMsgId =
        isGroupedWithPrev && aboveTl?.type === "message"
          ? aboveTl.data.id
          : undefined;
      const belowTl = timelineDataRef.current[index - 1];
      const groupNextMsgId =
        isGroupedWithNextMsg && belowTl?.type === "message"
          ? belowTl.data.id
          : undefined;

      const showSender = !isGroupedWithPrev && item.kind !== "system";
      const showTS = !isGroupedWithNextMsg && item.kind !== "system";
      const showAvatar = !isGroupedWithNextMsg && item.kind !== "system";
      const isGrouped = isGroupedWithPrev;
      const senderDisplayName = getSenderDisplayName(item);
      const senderProfile = getSenderProfileInfo(item.senderId);
      const renderedReactions =
        messageReactionsRef.current.get(item.id) ??
        (() => {
          const cached = fallbackReactionsRef.current.get(item.id);
          if (cached) return cached;
          if (!uid || !item.reactionsSummary) return EMPTY_REACTIONS;
          const parsed = parseReactionsFromMessage(item.reactionsSummary, uid);
          fallbackReactionsRef.current.set(item.id, parsed);
          return parsed;
        })();

      // ── Stacked mode branch ─────────────────────────────────────────
      if (displayMode === "stacked" && item.kind !== "system") {
        const incomingStyleStacked = !isOwnMessage
          ? resolveIncomingBubbleStyle({
              senderStyle: showMemberChatStyles
                ? (item.senderStyle ?? null)
                : null,
              appearanceMode: isDark ? "dark" : "light",
              defaultBgColor: colors.surfaceVariant,
              defaultTextColor: colors.text,
            })
          : null;

        const txtColor = isOwnMessage
          ? chatStyle.bubbleTextColor
          : incomingStyleStacked!.bubbleTextColor;
        const fntFamily = isOwnMessage
          ? chatStyle.fontFamily
          : incomingStyleStacked!.fontFamily;
        const fntColorHex = isOwnMessage
          ? chatStyle.fontColorHex
          : incomingStyleStacked!.fontColorHex;

        return (
          <AnimatedMessageRow
            messageId={item.id}
            shouldAnimateOnMount={
              screen.chat.messageEnterAnimation.shouldAnimateOnMount
            }
          >
            <GroupStackedMessageRenderer
              item={item}
              uid={uid}
              groupId={groupId}
              isGroupedWithPrevious={isGroupedWithPrev}
              isGroupedWithNext={isGroupedWithNextMsg}
              hasReactions={renderedReactions.length > 0}
              hasReplyPreview={!!item.replyTo}
              hasThread={!!item.replyCount && item.replyCount > 0}
              senderDisplayName={senderDisplayName}
              senderProfilePictureUrl={senderProfile.profilePictureUrl}
              senderDecorationId={senderProfile.decorationId}
              bubbleTextColor={txtColor}
              bubbleFontFamily={fntFamily}
              fontColorHex={fntColorHex}
              isHighlighted={item.id === highlightedMessageIdRef.current}
              reactions={renderedReactions}
              linkPreview={
                linkPreviewsRef.current.get(item.id) ||
                (hasUrls(item.text || "")
                  ? {
                      url: extractUrls(item.text || "")[0] || "",
                      fetchedAt: Date.now(),
                    }
                  : undefined)
              }
              loadingPreview={loadingPreviewsRef.current.has(item.id)}
              mentionableMembers={mentionableMembersRef.current}
              colors={colors}
              onReply={handleReply}
              onMessageLongPress={handleMessageLongPress}
              onScrollToMessage={scrollToMessage}
              onImagePress={handleOpenMediaViewer}
              onOptimisticReaction={handleOptimisticReaction}
              onThreadPress={handleStackedThreadPress}
              cornerWidthStore={cornerWidthStore}
              groupPrevMessageId={groupPrevMsgId}
              groupNextMessageId={groupNextMsgId}
            />
          </AnimatedMessageRow>
        );
      }

      // ── Bubble mode (existing) ──────────────────────────────────────
      const showTimestamp = showTS;

      // Resolve incoming sender style (custom bubble color/font from sender)
      // When showMemberChatStyles is false, suppress sender styles → theme defaults
      const incomingStyle = !isOwnMessage
        ? resolveIncomingBubbleStyle({
            senderStyle: showMemberChatStyles
              ? (item.senderStyle ?? null)
              : null,
            appearanceMode: isDark ? "dark" : "light",
            defaultBgColor: colors.surfaceVariant,
            defaultTextColor: colors.text,
          })
        : null;

      // Unified style: outgoing uses viewer's chatStyle, incoming uses sender's stamped style
      const bubbleBgColor = isOwnMessage
        ? chatStyle.bubbleBgColor
        : incomingStyle!.bubbleBgColor;
      const bubbleTextColor = isOwnMessage
        ? chatStyle.bubbleTextColor
        : incomingStyle!.bubbleTextColor;
      const bubbleFontFamily = isOwnMessage
        ? chatStyle.fontFamily
        : incomingStyle!.fontFamily;
      // Custom font color overrides contrast-computed bubbleTextColor when set
      const bubbleFontColorHex = isOwnMessage
        ? chatStyle.fontColorHex
        : (incomingStyle?.fontColorHex ?? null);
      const resolvedBubbleTextColor = bubbleFontColorHex ?? bubbleTextColor;

      if (item.kind === "system") {
        return <SystemMessageChip text={safeSystemText(item.text)} />;
      }

      // Get image attachment if present
      const imageAttachment = item.attachments?.find((a) => a.kind === "image");
      const voiceAttachment = item.attachments?.find((a) => a.kind === "audio");

      const handleImagePress = () => {
        if (item.kind === "media" && imageAttachment) {
          handleOpenMediaViewer(
            [imageAttachment],
            0,
            senderDisplayName,
            item.createdAt,
          );
        }
      };

      return (
        <AnimatedMessageRow
          messageId={item.id}
          shouldAnimateOnMount={
            screen.chat.messageEnterAnimation.shouldAnimateOnMount
          }
        >
          <SwipeableMessage
            message={item}
            onReply={handleReply}
            enabled={true}
            currentUid={uid}
          >
            <View
              style={[
                styles.messageContainer,
                isOwnMessage && styles.ownMessageContainer,
                isGrouped && styles.groupedMessageContainer,
                isGroupedWithNextMsg && styles.groupedMessageContainerTight,
              ]}
            >
              {/* Highlight overlay for reply navigation */}
              <MessageHighlightOverlay
                isHighlighted={item.id === highlightedMessageIdRef.current}
              />

              {item.replyTo && (
                <View
                  style={!isOwnMessage ? styles.replyBubbleIndent : undefined}
                >
                  <ReplyBubble
                    replyTo={item.replyTo}
                    isSentByMe={isOwnMessage}
                    isReplyToMe={item.replyTo.senderId === uid}
                    onPress={() => scrollToMessage(item.replyTo!.messageId)}
                  />
                </View>
              )}

              <View
                style={[
                  styles.messageRow,
                  isOwnMessage
                    ? styles.ownMessageRow
                    : styles.receivedMessageRow,
                ]}
              >
                {/* Show avatar for received messages - only on last message of group */}
                {!isOwnMessage && (
                  <View style={styles.avatarColumn}>
                    {showAvatar ? (
                      <ProfilePictureWithDecoration
                        pictureUrl={senderProfile.profilePictureUrl}
                        name={senderDisplayName}
                        decorationId={senderProfile.decorationId}
                        size={32}
                      />
                    ) : (
                      <View style={styles.avatarSpacer} />
                    )}
                  </View>
                )}

                <View style={styles.bubbleColumn}>
                  {!isOwnMessage && showSender && (
                    <Text
                      style={[styles.senderName, { color: colors.primary }]}
                    >
                      {senderDisplayName}
                    </Text>
                  )}

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={
                      item.kind === "media" ? handleImagePress : undefined
                    }
                    onLongPress={() => handleMessageLongPress(item)}
                    delayLongPress={300}
                  >
                    {/* Animal message — render data-driven AnimalBubble */}
                    {(() => {
                      if (item.kind === "animal") {
                        return item.animalId ? (
                          <AnimalBubble
                            animalId={item.animalId}
                            isMine={isOwnMessage}
                          />
                        ) : (
                          <View
                            style={[
                              styles.messageBubble,
                              isOwnMessage
                                ? styles.ownMessage
                                : styles.otherMessage,
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontStyle: "italic",
                                opacity: 0.5,
                              }}
                            >
                              (Animal unavailable)
                            </Text>
                          </View>
                        );
                      }
                      return (
                        <View
                          style={[
                            styles.messageBubble,
                            isOwnMessage
                              ? [
                                  styles.ownMessage,
                                  { backgroundColor: bubbleBgColor },
                                ]
                              : [
                                  styles.otherMessage,
                                  {
                                    backgroundColor: bubbleBgColor,
                                  },
                                ],
                            item.kind === "media" && styles.imageOnlyBubble,
                            item.kind === "voice" && styles.voiceBubble,
                          ]}
                        >
                          {item.kind === "media" && imageAttachment ? (
                            <AppImage
                              source={{ uri: imageAttachment.url }}
                              style={[
                                styles.standaloneImage,
                                getImageBubbleSize(
                                  imageAttachment.width,
                                  imageAttachment.height,
                                ),
                              ]}
                              contentFit="cover"
                              debugLabel="GroupChatImage"
                            />
                          ) : item.kind === "voice" && voiceAttachment ? (
                            <VoiceMessagePlayer
                              url={voiceAttachment.url}
                              durationMs={voiceAttachment.durationMs || 0}
                              isOwn={isOwnMessage}
                            />
                          ) : (
                            <>
                              <MessageWithMentions
                                text={item.text || ""}
                                mentionSpans={
                                  item.mentionSpans ??
                                  ((item.mentionUids?.length ?? 0) > 0
                                    ? extractMentionsExact(
                                        item.text || "",
                                        mentionableMembersRef.current,
                                      ).mentionSpans
                                    : undefined)
                                }
                                currentUid={uid}
                                textStyle={[
                                  styles.messageText,
                                  {
                                    color: resolvedBubbleTextColor,
                                    ...(bubbleFontFamily
                                      ? { fontFamily: bubbleFontFamily }
                                      : {}),
                                  },
                                ]}
                              />
                              {hasUrls(item.text || "") && (
                                <LinkPreviewCard
                                  preview={
                                    linkPreviewsRef.current.get(item.id) || {
                                      url:
                                        extractUrls(item.text || "")[0] || "",
                                      fetchedAt: Date.now(),
                                    }
                                  }
                                  isOwn={isOwnMessage}
                                  loading={loadingPreviewsRef.current.has(
                                    item.id,
                                  )}
                                />
                              )}
                            </>
                          )}
                        </View>
                      );
                    })()}
                  </TouchableOpacity>

                  {showTimestamp && (
                    <View
                      style={[
                        styles.timestampRow,
                        isOwnMessage
                          ? styles.timestampRowSent
                          : styles.timestampRowReceived,
                      ]}
                      pointerEvents="none"
                    >
                      <View
                        style={[
                          styles.timestampPill,
                          { backgroundColor: colors.background },
                        ]}
                      >
                        <Text
                          style={[
                            styles.messageTime,
                            { color: colors.textMuted },
                          ]}
                        >
                          {formatTime(item.createdAt)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Reaction pills — anchored below the bubble, aligned to sender */}
              {(messageReactionsRef.current.get(item.id) ?? EMPTY_REACTIONS)
                .length > 0 && (
                <View style={!isOwnMessage ? { paddingLeft: 40 } : undefined}>
                  <ReactionPills
                    reactions={
                      messageReactionsRef.current.get(item.id) ??
                      EMPTY_REACTIONS
                    }
                    isOwnMessage={isOwnMessage}
                    scope="group"
                    conversationId={groupId}
                    messageId={item.id}
                    currentUid={uid || ""}
                    onOptimisticToggle={handleOptimisticReaction}
                  />
                </View>
              )}

              {/* Thread indicator — show when this message is the root of a thread */}
              {!!item.replyCount && item.replyCount > 0 && (
                <ThreadIndicator
                  replyCount={item.replyCount}
                  isOutgoing={isOwnMessage}
                  onPress={() =>
                    navigation.navigate("ThreadView", {
                      conversationId: groupId,
                      scope: "group" as const,
                      rootMessageId: item.id,
                    })
                  }
                />
              )}
            </View>
          </SwipeableMessage>
        </AnimatedMessageRow>
      );
    },
    [
      uid,
      colors,
      isDark,
      chatStyle,
      showMemberChatStyles,
      getSenderDisplayName,
      getSenderProfileInfo,
      handleReply,
      handleMessageLongPress,
      handleOpenMediaViewer,
      handleStackedThreadPress,
      scrollToMessage,
      handleOptimisticReaction,
      screen.chat.messageEnterAnimation,
      displayMode,
      navigation,
      groupId,
    ],
  );

  // ==========================================================================
  // Loading/Error States
  // ==========================================================================

  // OPTIMIZATION: Show skeleton instead of full-screen loading
  // Shell (header, composer) renders immediately to prevent flicker
  // Only show skeleton when we truly have no group data yet
  const showSkeleton =
    (groupLoading && !group && groupMembers.length === 0) ||
    (messages.length > 0 && memberBootstrapPending);

  // Keyboard-sync: configure KCSV and get stable renderScrollComponent
  // offset=0 because the footer (KSV) moves with the keyboard — KCSV needs
  // the full keyboard height as content inset to keep messages visible.
  // Wrapped in useMemo to avoid re-setting the module singleton on every render.
  useMemo(() => {
    setChatScrollViewConfig({
      offset: 0,
      keyboardLiftBehavior: "whenAtEnd",
      extraContentPadding: sheetExtraPadding,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetExtraPadding]);
  const renderScrollComponent = useRenderChatScrollComponent();
  const groupHeaderSubtitle = typing.isOtherUserTyping
    ? typingUserNames.length === 1
      ? `${typingUserNames[0]} is typing...`
      : `${typingUserNames.length} people are typing...`
    : `${groupMembers.length} ${groupMembers.length === 1 ? "member" : "members"}`;
  const groupHeaderSubtitleColor =
    typing.isOtherUserTyping && typing.typingIndicatorsEnabled
      ? colors.primary
      : undefined;
  const renderHeaderRight = useCallback(
    () => (
      <View style={styles.headerRightRow}>
        {CALL_FEATURES.CALLS_ENABLED && voiceRoom.isActive && (
          <VoiceRoomAvatarStack
            occupants={voiceRoom.occupants}
            onPress={handleJoinVoiceChannel}
          />
        )}
        {CALL_FEATURES.CALLS_ENABLED && (
          <TouchableOpacity
            onPress={handleJoinVoiceChannel}
            style={styles.callButton}
            accessibilityLabel={
              isCurrentUserInThisVoiceRoom
                ? "Return to voice room"
                : voiceRoom.isActive
                  ? "Join voice room"
                  : "Start voice room"
            }
            accessibilityRole="button"
          >
            <Ionicons
              name="headset"
              size={22}
              color={
                isCurrentUserInThisVoiceRoom
                  ? "#43A047"
                  : voiceRoom.isActive
                    ? colors.primary
                    : colors.textMuted
              }
            />
          </TouchableOpacity>
        )}
        <IconButton
          icon="dots-vertical"
          onPress={() => navigation.navigate("GroupChatInfo", { groupId })}
        />
      </View>
    ),
    [
      colors.primary,
      colors.textMuted,
      groupId,
      handleJoinVoiceChannel,
      isCurrentUserInThisVoiceRoom,
      navigation,
      voiceRoom.isActive,
      voiceRoom.occupants,
    ],
  );

  if (error) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={[]}
      >
        <ChatHeader
          onBack={() => navigation.goBack()}
          chatType="group"
          title={resolvedGroupName}
          subtitle="Unavailable"
          avatarUrl={resolvedGroupAvatarUrl}
          avatarFallbackName={resolvedGroupName}
        />
        <ErrorState
          message={error}
          onRetry={() => navigation.goBack()}
          retryLabel="Go Back"
        />
      </SafeAreaView>
    );
  }

  // ==========================================================================
  // Main Render
  // ==========================================================================

  return (
    <>
      <ChatKeyboardContainer
        style={[
          styles.container,
          {
            // When a group background image is expected, use a dark neutral
            // instead of the theme background (which may be white). This
            // eliminates the brief white flash visible while the image
            // loads from cache — the dark fallback is nearly imperceptible
            // behind any background image for the 1-3 frames before paint.
            backgroundColor: resolvedGroupBackgroundUrl
              ? "#121212"
              : colors.background,
          },
        ]}
        backgroundLayer={
          resolvedGroupBackgroundUrl && wallpaperSource ? (
            <AppImage
              source={wallpaperSource}
              style={styles.chatBackground}
              contentFit="cover"
              transition={0}
              cachePolicy="memory-disk"
              priority="high"
              onLoadStart={handleWallpaperLoadStart}
              onLoad={handleWallpaperLoad}
              onDisplay={handleWallpaperDisplay}
              onError={handleWallpaperError}
              debugLabel="GroupChatWallpaper"
            />
          ) : undefined
        }
      >
        <ChatHeader
          onBack={() => navigation.goBack()}
          chatType="group"
          title={resolvedGroupName}
          subtitle={groupHeaderSubtitle}
          subtitleColor={groupHeaderSubtitleColor}
          avatarUrl={resolvedGroupAvatarUrl}
          avatarFallbackName={resolvedGroupName}
          onTitlePress={() => navigation.navigate("GroupChatInfo", { groupId })}
          renderRight={renderHeaderRight}
        />

        {/* Games V4: Pinned invite bar at top of chat */}
        {GAMES_V4_ENABLED && groupId && (
          <PinnedInviteBar conversationId={groupId} scope="group" />
        )}

        {/* SheetDismissLayer: tap/scroll above composer dismisses active sheet */}
        <SheetDismissLayer>
          {/* OPTIMIZATION: Show skeleton during loading, messages when ready */}
          {showSkeleton ? (
            <ChatSkeleton bubbleCount={8} />
          ) : (
            <ChatMessageList
              ref={messageListRef}
              data={timelineData}
              renderItem={renderMessage}
              keyExtractor={(item) =>
                timelineKeyExtractor(item, (msg) => msg.id)
              }
              newestMessageId={messages[0]?.id}
              renderScrollComponent={renderScrollComponent}
              pillBottomOffset={12}
              isKeyboardOpen={screen.keyboard.isKeyboardOpen}
              ListHeaderComponent={
                screen.chat.pagination.isLoadingOlder ? (
                  <View style={styles.loadMoreContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyStateContainer}>
                  <Text
                    variant="titleMedium"
                    style={[styles.emptyTitle, { color: colors.text }]}
                  >
                    No messages yet
                  </Text>
                  <Text
                    variant="bodyMedium"
                    style={[
                      styles.emptySubtitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Be the first to send a message!
                  </Text>
                </View>
              }
              flatListProps={{
                onEndReached: screen.chat.loadOlder,
                onEndReachedThreshold: 0.5,
                windowSize: listConfig.windowSize,
                initialNumToRender: listConfig.initialNumToRender,
                maxToRenderPerBatch: listConfig.maxToRenderPerBatch,
                updateCellsBatchingPeriod: listConfig.updateCellsBatchingPeriod,
              }}
            />
          )}
        </SheetDismissLayer>

        {/* Keyboard-aware footer: typing indicator + composer */}
        <ChatFooterWrapper>
          {/* Typing Indicator — display-mode aware */}
          {displayMode === "stacked" ? (
            <TypingBar
              userName={typingUserNames}
              visible={
                typing.isOtherUserTyping && typing.typingIndicatorsEnabled
              }
            />
          ) : (
            <TypingBubble
              userName={typingUserNames}
              visible={
                typing.isOtherUserTyping && typing.typingIndicatorsEnabled
              }
            />
          )}

          <ChatComposer
            scope="group"
            value={screen.composer.text}
            onChangeText={handleTextChange}
            onCursorChange={screen.composer.setCursorPosition}
            onSend={handleSendMessage}
            hasAttachments={attachmentPicker.attachments.length > 0}
            sendDisabled={
              showSkeleton ||
              (!screen.composer.text.trim() &&
                attachmentPicker.attachments.length === 0) ||
              screen.sending ||
              attachmentPicker.isUploading
            }
            isSending={screen.sending || attachmentPicker.isUploading}
            placeholder="Message..."
            leftAccessory={
              <CameraLongPressButton
                onShortPress={handleCaptureFromCamera}
                onLongPress={handleAddAttachment}
                disabled={screen.sending || attachmentPicker.isMaxReached}
                size={40}
              />
            }
            headerContent={
              attachmentPicker.attachments.length > 0 ? (
                <AttachmentTray
                  attachments={attachmentPicker.attachments}
                  uploadProgress={attachmentPicker.uploadProgress}
                  onRemove={attachmentPicker.removeAttachment}
                  onAdd={handleAddAttachment}
                  maxAttachments={10}
                />
              ) : null
            }
            mentionAutocomplete={
              <MentionAutocomplete
                visible={screen.composer.mentions?.isVisible || false}
                suggestions={screen.composer.mentions?.suggestions || []}
                query={screen.composer.mentions?.query || ""}
                onSelect={(member) => screen.composer.insertMention(member)}
                onDismiss={() => screen.composer.mentions?.onDismiss()}
                bottomOffset={8}
              />
            }
            voiceButtonComponent={
              voiceRecorder.isAvailable &&
              !screen.composer.text.trim() &&
              attachmentPicker.attachments.length === 0 ? (
                <VoiceRecordButton
                  onRecordingComplete={handleVoiceRecordingComplete}
                  onRecordingCancelled={NOOP}
                  disabled={screen.sending}
                  size={32}
                  maxDuration={60000}
                />
              ) : undefined
            }
            additionalRightAccessory={
              screen.composer.text.trim() ? (
                <IconButton
                  icon="clock-outline"
                  size={22}
                  onPress={() => setScheduleModalVisible(true)}
                  disabled={screen.sending || attachmentPicker.isUploading}
                  style={styles.scheduleButton}
                />
              ) : null
            }
            replyTo={screen.chat.replyTo}
            onCancelReply={handleCancelReply}
            currentUid={uid}
            onGameSelected={GAMES_V4_ENABLED ? handleGameSelected : undefined}
            onAnimalPress={handleAnimalPress}
            animalThemeId={animalEntitlement.equippedAnimalId}
            animalLocked={
              !animalEntitlement.canSend && !animalEntitlement.loading
            }
            animalPickerVisible={animalPickerVisible}
            onAnimalLongPress={() => setAnimalPickerVisible(true)}
            onAnimalPickerClose={() => setAnimalPickerVisible(false)}
            currentUserId={uid}
            onAnimalEquipped={handleAnimalEquipped}
            textInputRef={textInputRef}
            // Customizable toolbar
            toolbarItems={toolbar.items}
            toolbarEditing={toolbar.isEditing}
            toolbarSaving={toolbar.saving}
            onToolbarEnterEdit={toolbar.enterEditMode}
            onToolbarSaveAndExit={toolbar.saveAndExit}
            onToolbarCancelEdit={toolbar.cancelEdit}
            onToolbarMoveItem={toolbar.moveItem}
            onToolbarAddItem={toolbar.addItem}
            onToolbarRemoveItem={toolbar.removeItem}
            onToolbarResetDefaults={toolbar.resetToDefaults}
            onEmojiSelected={handleEmojiInsert}
            onGifSelected={GIF_PICKER_ENABLED ? handleGifSelected : undefined}
            onStickerSelected={
              STICKER_PICKER_ENABLED ? handleStickerSelected : undefined
            }
            onSchedulePress={() => setScheduleModalVisible(true)}
            onImagesPicked={handleDirectGallerySend}
            imagePickerDisabled={screen.sending}
          />
          <KeyboardSafeAreaSpacer />
        </ChatFooterWrapper>

        {/* Jump-back button for reply navigation */}
        <ScrollReturnButton
          visible={showReturnButton}
          onPress={handleReturnToReply}
          onAutoHide={handleReturnButtonAutoHide}
          autoHideDelay={screen.chat.isMessageAnchorActive ? 0 : 5000}
        />
      </ChatKeyboardContainer>

      <MediaViewerModal
        visible={mediaViewerVisible}
        attachments={viewerAttachments}
        initialIndex={viewerInitialIndex}
        onClose={() => setMediaViewerVisible(false)}
        senderName={viewerSenderName}
        timestamp={viewerTimestamp}
      />

      <MessageActionsSheet
        visible={actionsSheetVisible}
        message={selectedMessage}
        currentUid={uid || ""}
        userRole={userRole}
        permissionsConfig={permissionsConfig}
        onClose={() => setActionsSheetVisible(false)}
        onReply={handleReply}
        onEdited={handleMessageEdited}
        onDeleted={handleMessageDeleted}
        onReactionAdded={handleSheetReaction}
        onExpandReactions={handleExpandReactions}
      />

      {fullEmojiPickerOpen && (
        <SuspenseFullEmojiPicker
          open={fullEmojiPickerOpen}
          onClose={() => setFullEmojiPickerOpen(false)}
          onEmojiSelected={handleFullEmojiReaction}
        />
      )}

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: "" })}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbar.message}
      </Snackbar>

      {scheduleModalVisible && (
        <SuspenseScheduleMessageModal
          visible={scheduleModalVisible}
          messagePreview={screen.composer.text}
          onSchedule={handleScheduleMessage}
          onClose={() => setScheduleModalVisible(false)}
        />
      )}

      {/* Games V4: Invite creation loading overlay */}
      {gameInviteCreating && (
        <View style={styles.gameInviteLoadingOverlay}>
          <View style={styles.gameInviteLoadingBox}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text
              style={[styles.gameInviteLoadingText, { color: colors.text }]}
            >
              Creating game invite...
            </Text>
          </View>
        </View>
      )}
    </>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  chatBackground: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
    zIndex: 0,
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  callButton: {
    padding: 8,
    marginRight: 4,
  },
  messageContainer: { marginBottom: 14, width: "100%" },
  groupedMessageContainer: {}, // Visual grouping (hides some elements) — no spacing change
  groupedMessageContainerTight: { marginBottom: 2 }, // Tight spacing when grouped with next
  ownMessageContainer: {},
  replyBubbleIndent: { marginLeft: 40 }, // 32px avatar + 8px margin
  messageRow: { maxWidth: "80%", flexDirection: "row", alignItems: "flex-end" },
  ownMessageRow: { alignSelf: "flex-end" },
  receivedMessageRow: { alignSelf: "flex-start" },
  avatarColumn: {
    marginRight: 8,
    marginBottom: 4,
  },
  bubbleColumn: { flexDirection: "column", flexShrink: 1 },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    marginLeft: 10,
  },
  messageBubble: { padding: 10, borderRadius: 20 },
  ownMessage: { borderBottomRightRadius: 6 },
  otherMessage: { borderBottomLeftRadius: 6 },
  imageOnlyBubble: {
    padding: 0,
    backgroundColor: "transparent",
    borderRadius: 0,
  },
  voiceBubble: { padding: 8 },
  messageText: { fontSize: 17, lineHeight: 25 },
  standaloneImage: { borderRadius: 16 },
  messageTime: { fontSize: 10 },
  timestampRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  timestampRowSent: { alignSelf: "flex-end", marginRight: 4 },
  timestampRowReceived: { alignSelf: "flex-start", marginLeft: 4 },
  timestampPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  loadMoreContainer: {
    alignItems: "center",
    paddingVertical: 16,
    marginBottom: 8,
  },
  snackbar: {},
  scheduleButton: {
    margin: 0,
    width: 40,
    height: 40,
  },
  emptyStateContainer: {
    transform: [{ scaleY: -1 }],
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 48,
  },
  emptyTitle: {
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 6,
  },
  emptySubtitle: {
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 260,
  },
  avatarSpacer: {
    width: 32,
    height: 32,
  },
  gameInviteLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 100,
  },
  gameInviteLoadingBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  gameInviteLoadingText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
