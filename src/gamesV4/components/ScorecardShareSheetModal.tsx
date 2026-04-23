/**
 * Games V4 — Share Scorecard Sheet.
 *
 * Multi-select bottom sheet used by `GameOverScreenV4` to send a game
 * scorecard into one or more of the user's chats (DMs and/or groups).
 *
 * This is the in-app replacement for the OS share sheet. The scorecard
 * is sent as a normal `kind: "text"` message whose body is the sentinel
 * wire format (`[SCORECARD_V1]{json}\n{fallback}`). Both the DM and
 * group chat renderers decode the sentinel and mount the existing
 * `<GameScorecard />` component, so the shared message looks identical
 * to the backend-posted auto-scorecard in the originating group chat.
 *
 * Design decisions:
 *  - Send as the user's own `text` message (not `system`) so the row
 *    shows "You" / the user's avatar and flows through the existing
 *    outbox, rate limiter, block check, and optimistic pipeline.
 *  - Multi-select: one tap queues a conversation; confirming sends to
 *    all queued conversations in parallel with per-target error capture.
 *  - `sending` flag disables the confirm button to prevent double sends.
 *  - Data is loaded using the same Firestore query pattern as the
 *    single-select `ConversationPickerModal` (source of truth for how
 *    we discover visible DMs + groups for a user).
 *
 * @module gamesV4/components/ScorecardShareSheetModal
 */

import { AppImage } from "@/components/AppImage";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { SCORECARD_VISIBLE_TEXT } from "@/gamesV4/services/scorecardWire";
import type { GameScorecardPayload } from "@/gamesV4/types";
import { isDMVisible } from "@/services/chatMembers";
import { getFirestoreInstance } from "@/services/firebase";
import { getUserProfileByUid } from "@/services/friends";
import { isGroupVisible } from "@/services/groupMembers";
import { sendMessage } from "@/services/messaging/send";
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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

export interface ScorecardShareSheetModalProps {
  visible: boolean;
  payload: GameScorecardPayload | null;
  /** Pre-rendered human fallback line (inbox preview + old clients). */
  fallbackText: string;
  onClose: () => void;
  /**
   * Fired after the user confirmed and every target attempted to send.
   * `successes` and `failures` count the selected targets. Used for
   * snackbar/alert feedback.
   */
  onComplete?: (result: { successes: number; failures: number }) => void;
}

interface ResolvedConversation {
  id: string;
  scope: "dm" | "group";
  displayName: string;
  lastMessageAt: number | null;
  profilePictureUrl?: string | null;
  avatarUrl?: string | null;
  decorationId?: string | null;
  groupAvatarUrl?: string | null;
}

// =============================================================================
// Component
// =============================================================================

export function ScorecardShareSheetModal({
  visible,
  payload,
  fallbackText,
  onClose,
  onComplete,
}: ScorecardShareSheetModalProps) {
  const { theme } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [conversations, setConversations] = useState<ResolvedConversation[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  // Guard against parallel sends when the user double-taps Send.
  const sendingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Load conversations when opened.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!visible || !uid) return;
    let cancelled = false;

    setLoading(true);
    setSearchText("");
    setSelected(new Set());

    (async () => {
      try {
        const db = getFirestoreInstance();
        const resolved: ResolvedConversation[] = [];

        // ---- DMs ----
        const dmSnap = await getDocs(
          query(
            collection(db, "Chats"),
            where("members", "array-contains", uid),
          ),
        );

        const dmPromises = dmSnap.docs.map(async (chatDoc) => {
          const chatId = chatDoc.id;
          const chatData = chatDoc.data();

          const privateSnap = await getDoc(
            doc(db, "Chats", chatId, "MembersPrivate", uid),
          );
          const memberState = privateSnap.exists() ? privateSnap.data() : null;
          if (!isDMVisible(memberState as any)) return null;

          const otherUid = (chatData.members as string[])?.find(
            (m) => m !== uid,
          );
          let displayName = "Unknown";
          let profilePictureUrl: string | null = null;
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
              /* fall through */
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
            decorationId,
          };
        });

        for (const r of await Promise.all(dmPromises)) {
          if (r) resolved.push(r);
        }

        // ---- Groups ----
        const groupSnap = await getDocs(
          query(
            collection(db, "Groups"),
            where("memberIds", "array-contains", uid),
          ),
        );

        const groupPromises = groupSnap.docs.map(async (groupDoc) => {
          const groupId = groupDoc.id;
          const groupData = groupDoc.data();

          const privateSnap = await getDoc(
            doc(db, "Groups", groupId, "MembersPrivate", uid),
          );
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

        for (const r of await Promise.all(groupPromises)) {
          if (r) resolved.push(r);
        }

        resolved.sort(
          (a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0),
        );

        if (!cancelled) setConversations(resolved);
      } catch (err) {
        console.error(
          "[ScorecardShareSheet] Error loading conversations:",
          err,
        );
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
  // Search + selection helpers
  // ---------------------------------------------------------------------------
  const filtered = useMemo(() => {
    if (!searchText.trim()) return conversations;
    const lower = searchText.toLowerCase();
    return conversations.filter((c) =>
      c.displayName.toLowerCase().includes(lower),
    );
  }, [conversations, searchText]);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Send flow
  // ---------------------------------------------------------------------------
  const handleSend = useCallback(async () => {
    if (!payload || sendingRef.current) return;
    if (selected.size === 0) return;

    const targets = conversations.filter((c) => selected.has(c.id));

    sendingRef.current = true;
    setSending(true);

    // Structured payload — the server validates the shape, stamps a
    // trusted `server-share:{uid}` clientId, and rebuilds the wire
    // text itself. The `text` field we pass here is only the generic
    // visible label; the server overrides it on accept.
    const outcomes = await Promise.all(
      targets.map(async (target) => {
        try {
          const handle = await sendMessage({
            scope: target.scope,
            conversationId: target.id,
            kind: "text",
            text: SCORECARD_VISIBLE_TEXT,
            scorecardPayload: payload,
          });
          // Outbox-backed send: the inner promise resolves to {success}. If
          // we don't await it here the UI would dismiss before the network
          // round-trip, which can hide permission errors from the user.
          const res = await handle.sendPromise;
          return res.success;
        } catch (err) {
          console.warn("[ScorecardShareSheet] send failed for", target.id, err);
          return false;
        }
      }),
    );

    const successes = outcomes.filter(Boolean).length;
    const failures = outcomes.length - successes;

    sendingRef.current = false;
    setSending(false);
    onComplete?.({ successes, failures });
    onClose();
  }, [payload, conversations, selected, onComplete, onClose]);

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
    if (item.groupAvatarUrl) {
      return (
        <AppImage
          source={{ uri: item.groupAvatarUrl }}
          style={styles.groupAvatar}
          debugLabel="ScorecardShareSheetGroupAvatar"
        />
      );
    }
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

  const renderItem = ({ item }: { item: ResolvedConversation }) => {
    const isSelected = selected.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: borderColor }]}
        onPress={() => toggleSelect(item.id)}
        activeOpacity={0.6}
        disabled={sending}
      >
        {renderAvatar(item)}
        <View style={styles.rowInfo}>
          <Text
            style={[styles.rowName, { color: textColor }]}
            numberOfLines={1}
          >
            {item.displayName}
          </Text>
          <Text style={[styles.rowScope, { color: subtextColor }]}>
            {item.scope === "dm" ? "Direct Message" : "Group Chat"}
          </Text>
        </View>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: isSelected ? theme.colors.primary : borderColor,
              backgroundColor: isSelected
                ? theme.colors.primary
                : "transparent",
            },
          ]}
        >
          {isSelected ? (
            <MaterialCommunityIcons name="check" size={16} color="#FFF" />
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const sendLabel =
    selected.size === 0
      ? "Send"
      : selected.size === 1
        ? "Send to 1 chat"
        : `Send to ${selected.size} chats`;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={sending ? undefined : onClose}
    >
      <Pressable
        style={[styles.overlay, { backgroundColor: overlayColor }]}
        onPress={sending ? undefined : onClose}
      >
        <Pressable
          style={[styles.sheet, { backgroundColor: bgColor }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: textColor }]}>
              Share Scorecard
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              disabled={sending}
            >
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={subtextColor}
              />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: subtextColor }]}>
            Select one or more chats to send this scorecard to.
          </Text>

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
              editable={!sending}
            />
          </View>

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
              keyboardShouldPersistTaps="handled"
            />
          )}

          <View style={[styles.footer, { borderTopColor: borderColor }]}>
            <TouchableOpacity
              style={[
                styles.sendButton,
                {
                  backgroundColor:
                    selected.size > 0 && !sending
                      ? theme.colors.primary
                      : theme.isDark
                        ? "#2C2C2E"
                        : "#E5E5EA",
                },
              ]}
              onPress={handleSend}
              disabled={selected.size === 0 || sending || !payload}
              activeOpacity={0.8}
              testID="scorecard-share-confirm"
            >
              {sending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="send"
                    size={18}
                    color={selected.size > 0 ? "#FFF" : subtextColor}
                  />
                  <Text
                    style={[
                      styles.sendButtonText,
                      {
                        color: selected.size > 0 ? "#FFF" : subtextColor,
                      },
                    ]}
                  >
                    {sendLabel}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default ScorecardShareSheetModal;

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "85%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
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
  closeButton: { padding: 4 },
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
    paddingBottom: 12,
  },
  row: {
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
  rowInfo: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: "600" },
  rowScope: { fontSize: 12, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: { fontSize: 14 },
});
