/**
 * Games V4 — Conversation Picker Modal
 *
 * Bottom-sheet style modal that lets the user pick a DM or group chat
 * to send a game invite into. Used by the "Invite a Friend" flow
 * on multiplayer game detail pages.
 *
 * Fetches live data from Firestore (Chats & Groups collections) and
 * filters out deleted/hidden conversations via MembersPrivate checks.
 * Renders real profile pictures for DMs and group avatars for groups.
 *
 * @module gamesV4/components/ConversationPickerModal
 */

import { AppImage } from "@/components/AppImage";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { isDMVisible } from "@/services/chatMembers";
import { getFirestoreInstance } from "@/services/firebase";
import { getUserProfileByUid } from "@/services/friends";
import { isGroupVisible } from "@/services/groupMembers";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// =============================================================================
// Types
// =============================================================================

export interface ConversationPickerResult {
  conversationId: string;
  conversationScope: "dm" | "group";
  displayName: string;
}

interface ConversationPickerModalProps {
  visible: boolean;
  onSelect: (result: ConversationPickerResult) => void;
  onClose: () => void;
}

interface ResolvedConversation {
  id: string;
  scope: "dm" | "group";
  displayName: string;
  lastMessageAt: number | null;
  /** DM: other user's profile picture URL */
  profilePictureUrl?: string | null;
  /** DM: other user's avatar URL (fallback) */
  avatarUrl?: string | null;
  /** DM: other user's avatar decoration id */
  decorationId?: string | null;
  /** Group: group avatar URL */
  groupAvatarUrl?: string | null;
}

// =============================================================================
// Component
// =============================================================================

export function ConversationPickerModal({
  visible,
  onSelect,
  onClose,
}: ConversationPickerModalProps) {
  const { theme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [conversations, setConversations] = useState<ResolvedConversation[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");

  // ---------------------------------------------------------------------------
  // Fetch live conversations from Firestore on modal open
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!visible || !uid) return;
    let cancelled = false;

    setLoading(true);
    setSearchText("");

    (async () => {
      try {
        const db = getFirestoreInstance();
        const resolved: ResolvedConversation[] = [];

        // ---- DMs ----
        const dmQuery = query(
          collection(db, "Chats"),
          where("members", "array-contains", uid),
        );
        const dmSnap = await getDocs(dmQuery);

        // Resolve visibility + profile in parallel
        const dmPromises = dmSnap.docs.map(async (chatDoc) => {
          const chatId = chatDoc.id;
          const chatData = chatDoc.data();

          // Check MembersPrivate visibility
          const privateRef = doc(db, "Chats", chatId, "MembersPrivate", uid);
          const privateSnap = await getDoc(privateRef);
          const memberState = privateSnap.exists() ? privateSnap.data() : null;
          if (!isDMVisible(memberState as any)) return null;

          // Resolve the other user's profile
          const otherUid = (chatData.members as string[])?.find(
            (m) => m !== uid,
          );
          let displayName = "Unknown";
          let profilePictureUrl: string | null = null;
          let avatarUrl: string | null = null;
          let decorationId: string | null = null;

          if (otherUid) {
            try {
              const profile = await getUserProfileByUid(otherUid);
              if (profile) {
                displayName =
                  profile.displayName || profile.username || displayName;
                profilePictureUrl = profile.profilePicture?.url ?? null;
                decorationId =
                  profile.avatarDecoration?.equippedId ??
                  (profile.avatarDecoration as any)?.decorationId ??
                  null;
              }
            } catch {
              // fallback to "Unknown"
            }
          }

          const lastMsg = chatData.lastMessageAt;
          const lastMessageAt =
            typeof lastMsg === "number"
              ? lastMsg
              : (lastMsg?.toMillis?.() ?? null);

          return {
            id: chatId,
            scope: "dm" as const,
            displayName,
            lastMessageAt,
            profilePictureUrl,
            avatarUrl,
            decorationId,
          };
        });

        const dmResults = await Promise.all(dmPromises);
        for (const r of dmResults) {
          if (r) resolved.push(r);
        }

        // ---- Groups ----
        const groupQuery = query(
          collection(db, "Groups"),
          where("memberIds", "array-contains", uid),
        );
        const groupSnap = await getDocs(groupQuery);

        const groupPromises = groupSnap.docs.map(async (groupDoc) => {
          const groupId = groupDoc.id;
          const groupData = groupDoc.data();

          // Check MembersPrivate visibility
          const privateRef = doc(db, "Groups", groupId, "MembersPrivate", uid);
          const privateSnap = await getDoc(privateRef);
          const memberState = privateSnap.exists() ? privateSnap.data() : null;
          if (!isGroupVisible(memberState as any)) return null;

          const lastMsg = groupData.lastMessageAt;
          const lastMessageAt =
            typeof lastMsg === "number"
              ? lastMsg
              : (lastMsg?.toMillis?.() ?? null);

          return {
            id: groupId,
            scope: "group" as const,
            displayName: groupData.name || "Group Chat",
            lastMessageAt,
            groupAvatarUrl: groupData.avatarUrl ?? null,
          };
        });

        const groupResults = await Promise.all(groupPromises);
        for (const r of groupResults) {
          if (r) resolved.push(r);
        }

        // Sort by most recent activity
        resolved.sort(
          (a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0),
        );

        if (!cancelled) setConversations(resolved);
      } catch (err) {
        console.error("[ConversationPicker] Error loading conversations:", err);
        if (!cancelled) setConversations([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, uid]);

  // ---------------------------------------------------------------------------
  // Filter by search
  // ---------------------------------------------------------------------------
  const filtered = useMemo(() => {
    if (!searchText.trim()) return conversations;
    const lower = searchText.toLowerCase();
    return conversations.filter((c) =>
      c.displayName.toLowerCase().includes(lower),
    );
  }, [conversations, searchText]);

  const handleSelect = useCallback(
    (conv: ResolvedConversation) => {
      onSelect({
        conversationId: conv.id,
        conversationScope: conv.scope,
        displayName: conv.displayName,
      });
    },
    [onSelect],
  );

  // ---------------------------------------------------------------------------
  // Colors
  // ---------------------------------------------------------------------------
  const bgColor = theme.isDark ? "#1C1C1E" : "#FFFFFF";
  const overlayColor = "rgba(0,0,0,0.5)";
  const textColor = theme.isDark ? "#FFF" : "#000";
  const subtextColor = theme.isDark ? "#999" : "#666";
  const borderColor = theme.isDark ? "#333" : "#E0E0E0";
  const inputBg = theme.isDark ? "#2C2C2E" : "#F2F2F7";

  // ---------------------------------------------------------------------------
  // Row renderer
  // ---------------------------------------------------------------------------
  const renderAvatar = (item: ResolvedConversation) => {
    if (item.scope === "dm") {
      return (
        <ProfilePictureWithDecoration
          pictureUrl={item.profilePictureUrl || item.avatarUrl}
          name={item.displayName}
          decorationId={item.decorationId}
          size={44}
        />
      );
    }

    // Group with custom avatar
    if (item.groupAvatarUrl) {
      return (
        <AppImage
          source={{ uri: item.groupAvatarUrl }}
          style={styles.groupAvatar}
          debugLabel="ConversationPickerGroupAvatar"
        />
      );
    }

    // Group fallback icon
    return (
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: theme.isDark ? "#2C2C2E" : "#F0F0F0" },
        ]}
      >
        <MaterialCommunityIcons
          name="account-group"
          size={24}
          color={theme.colors.primary}
        />
      </View>
    );
  };

  const renderItem = ({ item }: { item: ResolvedConversation }) => (
    <TouchableOpacity
      style={[styles.conversationItem, { borderBottomColor: borderColor }]}
      onPress={() => handleSelect(item)}
      activeOpacity={0.6}
    >
      {renderAvatar(item)}
      <View style={styles.conversationInfo}>
        <Text
          style={[styles.conversationName, { color: textColor }]}
          numberOfLines={1}
        >
          {item.displayName}
        </Text>
        <Text style={[styles.conversationScope, { color: subtextColor }]}>
          {item.scope === "dm" ? "Direct Message" : "Group Chat"}
        </Text>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={20}
        color={subtextColor}
      />
    </TouchableOpacity>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.overlay, { backgroundColor: overlayColor }]}
        onPress={onClose}
      >
        <Pressable
          style={[styles.sheet, { backgroundColor: bgColor }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: textColor }]}>
              Choose a Chat
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={subtextColor}
              />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: subtextColor }]}>
            Select a conversation to send this game invite.
          </Text>

          {/* Search */}
          <View style={[styles.searchContainer, { backgroundColor: inputBg }]}>
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={subtextColor}
            />
            <TextInput
              style={[styles.searchInput, { color: textColor }]}
              placeholder="Search chats…"
              placeholderTextColor={subtextColor}
              value={searchText}
              onChangeText={setSearchText}
              autoCapitalize="none"
            />
          </View>

          {/* List */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.center}>
              <MaterialCommunityIcons
                name="chat-remove-outline"
                size={48}
                color={subtextColor}
              />
              <Text style={[styles.emptyText, { color: subtextColor }]}>
                {searchText
                  ? "No chats match your search"
                  : "No conversations found"}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.list}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "75%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34, // safe area
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  list: {
    paddingHorizontal: 12,
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  groupAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: "600",
  },
  conversationScope: {
    fontSize: 12,
    marginTop: 2,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
});
