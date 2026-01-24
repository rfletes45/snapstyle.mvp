/**
 * GroupChatScreen
 * Phase 20: Group Chat Messaging
 * Phase H6: Reply-to Threading
 * Phase H8: Emoji Reactions
 * Phase H9: Mentions + notifyLevel
 * Phase H10: Multi-Attachment Support
 * Phase H11: Voice Messages
 * Phase H12: Link Previews
 *
 * Features:
 * - Send/receive messages in group
 * - Text and image messages
 * - System messages (join/leave)
 * - Real-time updates
 * - Message pagination
 * - Reply-to threading (H6)
 * - Emoji reactions on messages (H8)
 * - @mention autocomplete (H9)
 * - Multi-attachment support (H10)
 * - Voice messages (H11)
 * - Link previews (H12)
 */

import {
  AttachmentTray,
  CameraLongPressButton,
  LinkPreviewCard,
  MediaViewerModal,
  MessageActionsSheet,
  ReactionsSummary,
  ReplyPreviewBar,
  SwipeableGroupMessage,
  VoiceMessagePlayer,
  VoiceRecordButton,
} from "@/components/chat";
import { MentionAutocomplete } from "@/components/chat/MentionAutocomplete";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { useAttachmentPicker } from "@/hooks/useAttachmentPicker";
import { useMentionAutocomplete } from "@/hooks/useMentionAutocomplete";
import { useVoiceRecorder, VoiceRecording } from "@/hooks/useVoiceRecorder";
import {
  getGroup,
  getGroupMembers,
  isGroupMember,
  sendGroupMessage,
  subscribeToGroupMessages,
  updateLastRead,
} from "@/services/groups";
import { extractUrls, fetchPreview, hasUrls } from "@/services/linkPreview";
import {
  extractMentionsExact,
  MentionableMember,
} from "@/services/mentionParser";
import {
  ReactionSummary,
  subscribeToMultipleMessageReactions,
} from "@/services/reactions";
import { uploadGroupImage, uploadVoiceMessage } from "@/services/storage";
import { useAuth } from "@/store/AuthContext";
import {
  AttachmentV2,
  LinkPreviewV2,
  MessageV2,
  ReplyToMetadata,
} from "@/types/messaging";
import { Group, GroupMember, GroupMessage } from "@/types/models";
import { LIST_PERFORMANCE_PROPS } from "@/utils/listPerformance";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  TextInput as RNTextInput,
  StyleSheet,
  TextInputSelectionChangeEventData,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Appbar,
  IconButton,
  Snackbar,
  Text,
  useTheme,
} from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { AppColors } from "../../../constants/theme";

interface Props {
  route: any;
  navigation: any;
}

export default function GroupChatScreen({ route, navigation }: Props) {
  const { groupId, groupName: initialGroupName } = route.params;
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);

  // H10: Media viewer state
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [viewerAttachments, setViewerAttachments] = useState<AttachmentV2[]>(
    [],
  );
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [viewerSenderName, setViewerSenderName] = useState<string>("");
  const [viewerTimestamp, setViewerTimestamp] = useState<Date | undefined>();

  // H11: Voice recording states
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  // H12: Link previews cache (messageId -> preview)
  const [linkPreviews, setLinkPreviews] = useState<
    Map<string, LinkPreviewV2 | null>
  >(new Map());
  const [loadingPreviews, setLoadingPreviews] = useState<Set<string>>(
    new Set(),
  );

  // H7: Message actions state
  const [actionsSheetVisible, setActionsSheetVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<GroupMessage | null>(
    null,
  );
  const [userRole, setUserRole] = useState<
    "owner" | "admin" | "moderator" | "member"
  >("member");

  // H6: Reply-to state
  const [replyTo, setReplyTo] = useState<ReplyToMetadata | null>(null);

  // H8: Reactions state (messageId -> reactions array)
  const [messageReactions, setMessageReactions] = useState<
    Map<string, ReactionSummary[]>
  >(new Map());

  const flatListRef = useRef<FlatList>(null);
  const textInputRef = useRef<any>(null);

  // H10: Attachment picker hook
  const attachmentPicker = useAttachmentPicker({
    maxAttachments: 10,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ["image"],
  });

  // H11: Voice recorder hook
  const voiceRecorder = useVoiceRecorder({
    maxDuration: 60, // 60 seconds max
    onRecordingComplete: (recording) => {
      console.log("[GroupChatScreen] Voice recording complete:", recording);
    },
  });

  // Convert group members to mentionable format
  const mentionableMembers: MentionableMember[] = groupMembers.map((m) => ({
    uid: m.uid,
    displayName: m.displayName || "Unknown",
    username: m.username,
  }));

  // Mention autocomplete hook
  const mentionState = useMentionAutocomplete({
    members: mentionableMembers,
    excludeUids: uid ? [uid] : [], // Exclude self from suggestions
    maxSuggestions: 5,
  });

  // Load group and verify membership
  useEffect(() => {
    async function loadGroup() {
      if (!groupId || !uid) return;

      try {
        setLoading(true);
        setError(null);

        // Check membership
        const isMember = await isGroupMember(groupId, uid);
        if (!isMember) {
          setError("You are not a member of this group");
          return;
        }

        const groupData = await getGroup(groupId);
        if (!groupData) {
          setError("Group not found");
          return;
        }

        setGroup(groupData);
        navigation.setOptions({ title: groupData.name });

        // Load group members for mentions (H9)
        const members = await getGroupMembers(groupId);
        setGroupMembers(members);
      } catch (err: any) {
        console.error("Error loading group:", err);
        setError(err.message || "Failed to load group");
      } finally {
        setLoading(false);
      }
    }

    loadGroup();
  }, [groupId, uid, navigation]);

  // Subscribe to messages
  useEffect(() => {
    if (!groupId || !uid || error) return;

    const unsubscribe = subscribeToGroupMessages(groupId, (messagesData) => {
      setMessages(messagesData);
      setLoading(false);

      // Update last read timestamp
      updateLastRead(groupId, uid).catch(console.error);
    });

    return () => unsubscribe();
  }, [groupId, uid, error]);

  // Scroll to end when keyboard shows to keep latest messages visible
  useEffect(() => {
    const keyboardShowEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";

    const keyboardListener = Keyboard.addListener(keyboardShowEvent, () => {
      // Small delay to let layout adjust
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => keyboardListener.remove();
  }, []);

  // Hide tab bar when this screen is focused
  useFocusEffect(
    useCallback(() => {
      // Hide tab bar
      navigation.getParent()?.setOptions({
        tabBarStyle: { display: "none" },
      });

      // Restore tab bar when leaving
      return () => {
        navigation.getParent()?.setOptions({
          tabBarStyle: undefined,
        });
      };
    }, [navigation]),
  );

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Scroll to bottom when keyboard opens
  useEffect(() => {
    const keyboardShowEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";

    const keyboardShowListener = Keyboard.addListener(keyboardShowEvent, () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return () => {
      keyboardShowListener.remove();
    };
  }, []);

  // H12: Fetch link previews for text messages
  useEffect(() => {
    const fetchLinkPreviews = async () => {
      for (const message of messages) {
        // Skip non-text messages or already processed
        if (message.type !== "text") continue;
        if (linkPreviews.has(message.id)) continue;
        if (loadingPreviews.has(message.id)) continue;

        // Check if message has URLs
        if (!hasUrls(message.content)) continue;

        const urls = extractUrls(message.content);
        if (urls.length === 0) continue;

        // Mark as loading
        setLoadingPreviews((prev) => new Set([...prev, message.id]));

        try {
          // Fetch preview for first URL
          const preview = await fetchPreview(urls[0]);

          setLinkPreviews((prev) => {
            const newMap = new Map(prev);
            newMap.set(message.id, preview);
            return newMap;
          });
        } catch (error) {
          console.error(
            "[GroupChatScreen] Failed to fetch link preview:",
            error,
          );
          setLinkPreviews((prev) => {
            const newMap = new Map(prev);
            newMap.set(message.id, null);
            return newMap;
          });
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
  }, [messages, linkPreviews, loadingPreviews]);

  // H8: Subscribe to reactions for visible messages
  useEffect(() => {
    if (!groupId || !uid || messages.length === 0) return;

    // Get message IDs to subscribe to (limit to recent messages for performance)
    const messageIds = messages.slice(0, 50).map((m) => m.id);

    const unsubscribe = subscribeToMultipleMessageReactions(
      "group",
      groupId,
      messageIds,
      uid,
      (reactionsMap) => {
        setMessageReactions(reactionsMap);
      },
    );

    return () => unsubscribe();
  }, [groupId, uid, messages]);

  // Handle text input change with mention detection
  const handleTextChange = useCallback(
    (text: string) => {
      setMessageText(text);
      mentionState.onTextChange(text, cursorPosition);
    },
    [cursorPosition, mentionState],
  );

  // Handle cursor position changes
  const handleSelectionChange = useCallback(
    (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      const { selection } = event.nativeEvent;
      setCursorPosition(selection.end);
      mentionState.onTextChange(messageText, selection.end);
    },
    [messageText, mentionState],
  );

  // Handle mention selection from autocomplete
  const handleMentionSelect = useCallback(
    (member: MentionableMember) => {
      const result = mentionState.onSelectMember(
        member,
        messageText,
        cursorPosition,
      );
      setMessageText(result.newText);
      setCursorPosition(result.newCursorPosition);

      // Focus back to text input
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    },
    [mentionState, messageText, cursorPosition],
  );

  // H10: Handle opening media viewer
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

  // H7: Handle long press on message to show actions
  const handleMessageLongPress = useCallback((message: GroupMessage) => {
    setSelectedMessage(message);
    setActionsSheetVisible(true);
  }, []);

  // H7: Convert GroupMessage to MessageV2 format for actions sheet
  const selectedMessageAsV2: MessageV2 | null = selectedMessage
    ? {
        id: selectedMessage.id,
        scope: "group",
        conversationId: groupId,
        senderId: selectedMessage.sender,
        senderName: selectedMessage.senderDisplayName,
        kind: selectedMessage.type === "image" ? "media" : "text",
        text:
          selectedMessage.type === "text" ? selectedMessage.content : undefined,
        attachments:
          selectedMessage.type === "image"
            ? [
                {
                  id: selectedMessage.id,
                  kind: "image" as const,
                  mime: "image/jpeg",
                  url: selectedMessage.content,
                  path: selectedMessage.imagePath || "",
                  sizeBytes: 0,
                },
              ]
            : undefined,
        createdAt: selectedMessage.createdAt,
        serverReceivedAt: selectedMessage.createdAt,
        clientId: "",
        idempotencyKey: "",
      }
    : null;

  // H6: Handle reply from actions sheet
  const handleReply = useCallback((replyToData: ReplyToMetadata) => {
    setReplyTo(replyToData);
    // Focus the input after setting reply
    textInputRef.current?.focus();
  }, []);

  // H6: Cancel reply
  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  // H7: Handle message edited
  const handleMessageEdited = useCallback(
    (messageId: string, newText: string) => {
      // Update local state to reflect edit
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: newText } : m)),
      );
      setSnackbar({ visible: true, message: "Message edited" });
    },
    [],
  );

  // H7: Handle message deleted
  const handleMessageDeleted = useCallback(
    (messageId: string, forAll: boolean) => {
      if (forAll) {
        // Remove from local state
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
      setSnackbar({
        visible: true,
        message: forAll ? "Message deleted" : "Message hidden",
      });
    },
    [],
  );

  // H10: Send message with attachments
  const handleSendMessage = async () => {
    const hasText = messageText.trim().length > 0;
    const hasAttachments = attachmentPicker.attachments.length > 0;

    if (!uid || (!hasText && !hasAttachments) || sending) return;

    const text = messageText.trim();

    // Extract mentions from message (H9)
    const { mentionUids } = extractMentionsExact(text, mentionableMembers);

    // H6: Convert replyTo to GroupMessage format
    const replyToData = replyTo
      ? {
          messageId: replyTo.messageId,
          senderId: replyTo.senderId,
          senderName: replyTo.senderName || "Unknown",
          textSnippet: replyTo.textSnippet,
          attachmentKind: replyTo.attachmentPreview?.kind as
            | "image"
            | "voice"
            | undefined,
        }
      : undefined;

    // Clear inputs immediately for responsiveness
    setMessageText("");
    setReplyTo(null); // H6: Clear reply state
    mentionState.reset();
    setSending(true);

    try {
      // H10: If we have attachments, upload them first
      if (hasAttachments) {
        const basePath = `groups/${groupId}/attachments`;
        const { successful, failed } =
          await attachmentPicker.uploadAttachments(basePath);

        if (failed.length > 0) {
          console.warn(
            `[GroupChatScreen] ${failed.length} attachments failed to upload`,
          );
        }

        // Send each attachment as a separate image message (current group model)
        // Note: In future, sendGroupMessage can be enhanced to accept attachments[]
        for (const attachment of successful) {
          await sendGroupMessage(
            groupId,
            uid,
            attachment.url,
            "image",
            undefined,
            mentionUids,
            undefined,
            replyToData,
          );
        }

        // Clear attachments after sending
        attachmentPicker.clearAttachments();

        // Send text message separately if there's text
        if (hasText) {
          await sendGroupMessage(
            groupId,
            uid,
            text,
            "text",
            undefined,
            mentionUids,
            undefined,
            replyToData,
          );
        }
      } else {
        // Text-only message
        await sendGroupMessage(
          groupId,
          uid,
          text,
          "text",
          undefined,
          mentionUids,
          undefined,
          replyToData,
        );
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      if (hasText) {
        setMessageText(text); // Restore message on failure
      }
      setSnackbar({
        visible: true,
        message: error.message || "Failed to send message",
      });
    } finally {
      setSending(false);
    }
  };

  // H10: Add attachment from gallery using hook
  const handleAddAttachment = useCallback(async () => {
    await attachmentPicker.pickFromGallery();
  }, [attachmentPicker]);

  // H10: Capture from camera using hook
  const handleCaptureFromCamera = useCallback(async () => {
    await attachmentPicker.captureFromCamera();
  }, [attachmentPicker]);

  // Send image message (legacy single-image - keeping for compatibility)
  const handleSendImage = async () => {
    if (!uid || sending) return;

    try {
      // Request permission
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant photo library access");
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (result.canceled || !result.assets?.[0]) return;

      setSending(true);

      // Generate message ID for storage path
      const messageId = `${Date.now()}_${uid}`;

      // Upload image
      const imagePath = await uploadGroupImage(
        groupId,
        messageId,
        result.assets[0].uri,
      );

      // Send image message
      await sendGroupMessage(groupId, uid, imagePath, "image");
    } catch (error: any) {
      console.error("Error sending image:", error);
      setSnackbar({
        visible: true,
        message: error.message || "Failed to send image",
      });
    } finally {
      setSending(false);
    }
  };

  // H11: Handle voice recording completion
  const handleVoiceRecordingComplete = async (recording: VoiceRecording) => {
    if (!uid || sending) return;

    console.log(
      "[GroupChatScreen] Voice recording complete:",
      recording.durationMs,
      "ms",
    );
    setSending(true);

    try {
      // Generate message ID for storage path
      const messageId = `voice_${Date.now()}_${uid}`;

      // Upload voice message
      const result = await uploadVoiceMessage(groupId, messageId, recording);

      if (!result.success || !result.url) {
        throw new Error(result.error || "Voice upload failed");
      }

      // Send as audio message
      // We store the URL as content and duration as metadata
      await sendGroupMessage(groupId, uid, result.url, "voice", undefined, [], {
        durationMs: recording.durationMs,
        storagePath: result.path,
        sizeBytes: result.sizeBytes,
      });

      console.log("[GroupChatScreen] Voice message sent successfully");
    } catch (error: any) {
      console.error("[GroupChatScreen] Error sending voice message:", error);
      // Firebase errors have a 'message' property but it might be nested
      const errorMessage =
        error?.message ||
        error?.code ||
        (typeof error === "string" ? error : "Failed to send voice message");
      setSnackbar({
        visible: true,
        message: errorMessage,
      });
    } finally {
      setSending(false);
      setIsRecordingVoice(false);
    }
  };

  // H11: Handle voice recording cancelled
  const handleVoiceRecordingCancelled = () => {
    console.log("[GroupChatScreen] Voice recording cancelled");
    setIsRecordingVoice(false);
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Check if we should show sender info (different sender from previous message)
  const shouldShowSender = (index: number, message: GroupMessage) => {
    if (message.type === "system") return false;
    if (index === 0) return true;
    const prevMessage = messages[index - 1];
    if (prevMessage.type === "system") return true;
    return prevMessage.sender !== message.sender;
  };

  // Render message
  const renderMessage = ({
    item,
    index,
  }: {
    item: GroupMessage;
    index: number;
  }) => {
    const isOwnMessage = item.sender === uid;
    const showSender = shouldShowSender(index, item);

    // System message
    if (item.type === "system") {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemMessageText}>{item.content}</Text>
        </View>
      );
    }

    // H10: Convert image message to AttachmentV2 format for viewer
    const getAttachmentFromMessage = (
      msg: GroupMessage,
    ): AttachmentV2 | null => {
      if (msg.type !== "image") return null;
      return {
        id: msg.id,
        kind: "image",
        mime: "image/jpeg", // Default mime type
        url: msg.content,
        path: msg.imagePath || "",
        sizeBytes: 0,
      };
    };

    const handleImagePress = () => {
      const attachment = getAttachmentFromMessage(item);
      if (attachment) {
        handleOpenMediaViewer(
          [attachment],
          0,
          item.senderDisplayName,
          item.createdAt,
        );
      }
    };

    // System messages are already handled above with early return
    // enabled is always true here since we're past the system check
    return (
      <SwipeableGroupMessage
        message={item}
        onReply={handleReply}
        enabled={true}
        currentUid={uid}
      >
        <View
          style={[
            styles.messageContainer,
            isOwnMessage && styles.ownMessageContainer,
          ]}
        >
          {!isOwnMessage && showSender && (
            <Text style={[styles.senderName, { color: theme.colors.primary }]}>
              {item.senderDisplayName}
            </Text>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={item.type === "image" ? handleImagePress : undefined}
            onLongPress={() => handleMessageLongPress(item)}
            delayLongPress={300}
          >
            <View
              style={[
                styles.messageBubble,
                isOwnMessage
                  ? [
                      styles.ownMessage,
                      { backgroundColor: theme.colors.primary },
                    ]
                  : styles.otherMessage,
                item.type === "image" && styles.imageOnlyBubble,
                item.type === "voice" && styles.voiceBubble,
              ]}
            >
              {item.type === "image" ? (
                <Image
                  source={{ uri: item.content }}
                  style={styles.standaloneImage}
                  resizeMode="cover"
                />
              ) : item.type === "voice" ? (
                // H11: Voice message player
                <VoiceMessagePlayer
                  url={item.content}
                  durationMs={item.voiceMetadata?.durationMs || 0}
                  isOwn={isOwnMessage}
                />
              ) : item.type === "scorecard" && item.scorecard ? (
                <View style={styles.scorecardContent}>
                  <MaterialCommunityIcons
                    name="gamepad-variant"
                    size={24}
                    color={isOwnMessage ? "#000" : "#FFF"}
                  />
                  <Text
                    style={[
                      styles.scorecardGame,
                      isOwnMessage && styles.ownMessageText,
                    ]}
                  >
                    {item.scorecard.gameId === "reaction_tap"
                      ? "Reaction Tap"
                      : "Timed Tap"}
                  </Text>
                  <Text
                    style={[
                      styles.scorecardScore,
                      isOwnMessage && styles.ownMessageText,
                    ]}
                  >
                    {item.scorecard.gameId === "reaction_tap"
                      ? `${item.scorecard.score}ms`
                      : `${item.scorecard.score} taps`}
                  </Text>
                </View>
              ) : (
                <>
                  <Text
                    style={[
                      styles.messageText,
                      isOwnMessage && styles.ownMessageText,
                    ]}
                  >
                    {item.content}
                  </Text>
                  {/* H12: Link Preview */}
                  {hasUrls(item.content) && (
                    <LinkPreviewCard
                      preview={
                        linkPreviews.get(item.id) || {
                          url: extractUrls(item.content)[0] || "",
                          fetchedAt: Date.now(),
                        }
                      }
                      isOwn={isOwnMessage}
                      loading={loadingPreviews.has(item.id)}
                    />
                  )}
                </>
              )}
            </View>
          </TouchableOpacity>

          {/* H8: Reactions Summary (tap to open actions sheet) */}
          {(messageReactions.get(item.id) || []).length > 0 && (
            <ReactionsSummary
              reactionsSummary={Object.fromEntries(
                (messageReactions.get(item.id) || []).map((r) => [
                  r.emoji,
                  r.count,
                ]),
              )}
              userReactions={(messageReactions.get(item.id) || [])
                .filter((r) => r.hasReacted)
                .map((r) => r.emoji)}
              compact
              onPress={() => handleMessageLongPress(item)}
            />
          )}

          <Text
            style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}
          >
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </SwipeableGroupMessage>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <Appbar.Header style={styles.header}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={initialGroupName || "Group Chat"} />
        </Appbar.Header>
        <LoadingState message="Loading messages..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <Appbar.Header style={styles.header}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Error" />
        </Appbar.Header>
        <ErrorState
          message={error}
          onRetry={() => navigation.goBack()}
          retryLabel="Go Back"
        />
      </SafeAreaView>
    );
  }

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <Appbar.Header style={styles.header}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <TouchableOpacity
            style={styles.headerTitle}
            onPress={() => navigation.navigate("GroupChatInfo", { groupId })}
          >
            <View
              style={[
                styles.groupIcon,
                { backgroundColor: theme.colors.surfaceVariant },
              ]}
            >
              <MaterialCommunityIcons
                name="account-group"
                size={20}
                color={theme.colors.primary}
              />
            </View>
            <View>
              <Text style={styles.headerTitleText}>{group?.name}</Text>
              <Text style={styles.headerSubtitle}>
                {group?.memberCount} members
              </Text>
            </View>
          </TouchableOpacity>
          <Appbar.Action
            icon="information-outline"
            onPress={() => navigation.navigate("GroupChatInfo", { groupId })}
          />
        </Appbar.Header>

        <View style={styles.chatContainer}>
          {messages.length === 0 ? (
            <EmptyState
              icon="chat-outline"
              title="No Messages Yet"
              subtitle="Be the first to send a message!"
            />
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              {...LIST_PERFORMANCE_PROPS}
              style={styles.messagesList}
              contentContainerStyle={[
                styles.messagesContent,
                { paddingBottom: 16 },
              ]}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => {
                flatListRef.current?.scrollToEnd({ animated: false });
              }}
              maintainVisibleContentPosition={{
                minIndexForVisible: 0,
              }}
            />
          )}
        </View>

        {/* Message Input */}
        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: theme.dark ? "#000" : "#fff",
              paddingBottom: insets.bottom,
            },
          ]}
        >
          {/* H10: Attachment Tray */}
          {attachmentPicker.attachments.length > 0 && (
            <AttachmentTray
              attachments={attachmentPicker.attachments}
              uploadProgress={attachmentPicker.uploadProgress}
              onRemove={attachmentPicker.removeAttachment}
              onAdd={handleAddAttachment}
              maxAttachments={10}
            />
          )}

          {/* Mention Autocomplete (H9) */}
          <MentionAutocomplete
            visible={mentionState.isVisible}
            suggestions={mentionState.suggestions}
            query={mentionState.query}
            onSelect={handleMentionSelect}
            onDismiss={mentionState.onDismiss}
            bottomOffset={8}
          />

          {/* H6: Reply preview bar above input */}
          {replyTo && (
            <ReplyPreviewBar
              replyTo={replyTo}
              onCancel={handleCancelReply}
              isOwnMessage={replyTo.senderId === uid}
            />
          )}

          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: theme.dark ? "#000" : "#fff",
                borderTopColor: theme.dark ? "#222" : "#e0e0e0",
              },
            ]}
          >
            <CameraLongPressButton
              onShortPress={handleCaptureFromCamera}
              onLongPress={handleAddAttachment}
              disabled={sending || attachmentPicker.isMaxReached}
              size={40}
            />

            <RNTextInput
              ref={textInputRef as any}
              placeholder="Message..."
              value={messageText}
              onChangeText={handleTextChange}
              onSelectionChange={handleSelectionChange}
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.dark ? "#1A1A1A" : "#f0f0f0",
                  color: theme.dark ? "#FFF" : "#000",
                },
              ]}
              placeholderTextColor={theme.dark ? "#888" : "#999"}
              multiline
              maxLength={1000}
              textAlignVertical="center"
            />

            {sending || attachmentPicker.isUploading ? (
              <View style={styles.sendButtonContainer}>
                <ActivityIndicator size={24} color={theme.colors.primary} />
                {attachmentPicker.isUploading && (
                  <Text style={styles.uploadProgressText}>
                    {Math.round(attachmentPicker.totalProgress * 100)}%
                  </Text>
                )}
              </View>
            ) : messageText.trim() ||
              attachmentPicker.attachments.length > 0 ? (
              // Show send button when there's text or attachments
              <IconButton
                icon="send"
                size={24}
                iconColor={theme.colors.primary}
                onPress={handleSendMessage}
                style={styles.actionButton}
              />
            ) : voiceRecorder.isAvailable ? (
              // H11: Show voice record button when no text
              <VoiceRecordButton
                onRecordingComplete={handleVoiceRecordingComplete}
                onRecordingCancelled={handleVoiceRecordingCancelled}
                disabled={sending}
                size={40}
                maxDuration={60000}
              />
            ) : (
              // Fallback to disabled send button if voice not available
              <IconButton
                icon="send"
                size={24}
                iconColor={theme.colors.onSurfaceDisabled}
                disabled
                style={styles.actionButton}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* H10: Media Viewer Modal */}
      <MediaViewerModal
        visible={mediaViewerVisible}
        attachments={viewerAttachments}
        initialIndex={viewerInitialIndex}
        onClose={() => setMediaViewerVisible(false)}
        senderName={viewerSenderName}
        timestamp={viewerTimestamp}
      />

      {/* H7: Message Actions Sheet */}
      <MessageActionsSheet
        visible={actionsSheetVisible}
        message={selectedMessageAsV2}
        currentUid={uid || ""}
        userRole={userRole}
        onClose={() => setActionsSheetVisible(false)}
        onReply={handleReply}
        onEdited={handleMessageEdited}
        onDeleted={handleMessageDeleted}
        onReactionAdded={(emoji) => {
          console.log(
            `[GroupChatScreen] Reaction added via actions sheet: ${emoji}`,
          );
        }}
      />

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: "" })}
        duration={3000}
        style={styles.snackbar}
      >
        {snackbar.message}
      </Snackbar>
    </>
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
  headerTitle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginLeft: 8,
  },
  groupIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  headerSubtitle: {
    color: "#888",
    fontSize: 12,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: "80%",
    alignSelf: "flex-start",
  },
  ownMessageContainer: {
    alignSelf: "flex-end",
  },
  senderName: {
    color: AppColors.primary,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  ownMessage: {
    backgroundColor: AppColors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: "#1A1A1A",
    borderBottomLeftRadius: 4,
  },
  imageOnlyBubble: {
    padding: 0,
    backgroundColor: "transparent",
    borderRadius: 0,
  },
  voiceBubble: {
    padding: 8,
  },
  messageText: {
    color: "#FFF",
    fontSize: 15,
    lineHeight: 20,
  },
  ownMessageText: {
    color: "#000",
  },
  standaloneImage: {
    width: 200,
    height: 200,
    borderRadius: 16,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  scorecardContent: {
    alignItems: "center",
    padding: 8,
  },
  scorecardGame: {
    color: "#FFF",
    fontSize: 12,
    marginTop: 4,
  },
  scorecardScore: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 2,
  },
  messageTime: {
    color: "#666",
    fontSize: 10,
    marginTop: 4,
    marginLeft: 12,
  },
  ownMessageTime: {
    textAlign: "right",
    marginRight: 12,
  },
  systemMessage: {
    alignItems: "center",
    marginVertical: 12,
  },
  systemMessageText: {
    color: "#888",
    fontSize: 12,
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  inputWrapper: {
    // backgroundColor set inline based on theme
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    // borderTopColor and backgroundColor set inline based on theme
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    // backgroundColor and color set inline based on theme
  },
  actionButton: {
    margin: 0,
    width: 40,
    height: 40,
  },
  sendButton: {
    marginHorizontal: 8,
  },
  sendButtonContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: 40,
    height: 40,
    justifyContent: "center",
    gap: 4,
  },
  uploadProgressText: {
    color: "#888",
    fontSize: 10,
    fontWeight: "600",
  },
  snackbar: {
    backgroundColor: "#333",
  },
});
