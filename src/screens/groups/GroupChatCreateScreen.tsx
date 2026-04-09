/**
 * GroupChatCreateScreen — Full Overhaul
 *
 * Two-step group creation flow:
 *   Step 1: Select members from friend list
 *   Step 2: Group details — name, mandatory avatar, preview, create
 *
 * Features:
 * - Mandatory group avatar upload with compression
 * - Member chips with remove affordance
 * - Group preview card showing name, avatar, and members
 * - Double-tap prevention and creation guard
 * - Atomic batch write with avatar URL included
 * - Post-creation conversation row sync
 * - Structured logging at every stage
 * - Clean error states and inline validation
 */

import { AppImage } from "@/components/AppImage";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { EmptyState, LoadingState } from "@/components/ui";
import { getFriends, getUserProfileByUid } from "@/services/friends";
import { createGroup } from "@/services/groups";
import { uploadGroupAvatarImage } from "@/services/storage";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import { Friend, GROUP_LIMITS, User } from "@/types/models";
import { LIST_PERFORMANCE_PROPS } from "@/utils/listPerformance";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Appbar, Button, Searchbar, Text, TextInput } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/groups/GroupChatCreateScreen");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SelectableFriend {
  uid: string;
  username: string;
  displayName: string;
  avatarConfig: User["avatarConfig"];
  profilePictureUrl?: string | null;
  decorationId?: string | null;
}

type Step = "members" | "details";

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function GroupChatCreateScreen({ navigation }: any) {
  const { colors } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  // ── Shared State ────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("members");
  const [friends, setFriends] = useState<SelectableFriend[]>([]);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Details State ───────────────────────────────────────────────────────
  const [groupName, setGroupName] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const creationGuardRef = useRef(false);

  // ── Derived ─────────────────────────────────────────────────────────────
  const selectedCount = selectedUids.size;
  const totalMemberCount = selectedCount + 1; // creator included
  const selectedFriends = useMemo(
    () => friends.filter((f) => selectedUids.has(f.uid)),
    [friends, selectedUids],
  );

  // Step 1 valid: at least MIN_MEMBERS - 1 friends selected
  const isMemberStepValid =
    totalMemberCount >= GROUP_LIMITS.MIN_MEMBERS &&
    totalMemberCount <= GROUP_LIMITS.MAX_MEMBERS;

  // Step 2 valid: name + avatar
  const isDetailsValid =
    groupName.trim().length > 0 &&
    groupName.length <= GROUP_LIMITS.MAX_NAME_LENGTH &&
    avatarUri !== null;

  const canCreate = isMemberStepValid && isDetailsValid;

  // ── Load Friends ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadFriends() {
      if (!uid) return;
      logger.info("[loadFriends] Loading friend list");
      try {
        setLoading(true);
        const friendsData = await getFriends(uid);

        const profiles = await Promise.all(
          friendsData.map(
            async (friend: Friend): Promise<SelectableFriend | null> => {
              const friendUid = friend.users.find((u: string) => u !== uid);
              if (!friendUid) return null;

              const profile = await getUserProfileByUid(friendUid);
              if (!profile) return null;

              return {
                uid: friendUid,
                username: profile.username,
                displayName: profile.displayName,
                avatarConfig: profile.avatarConfig,
                profilePictureUrl: profile.profilePicture?.url ?? null,
                decorationId: profile.avatarDecoration?.decorationId ?? null,
              };
            },
          ),
        );

        if (cancelled) return;

        const result = profiles.filter(
          (p): p is SelectableFriend => p !== null,
        );
        setFriends(result);
        logger.info(`[loadFriends] Loaded ${result.length} friends`);
      } catch (error) {
        logger.error("[loadFriends] Failed:", error);
        if (!cancelled)
          setErrorMessage("Failed to load friends. Pull down to retry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFriends();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  // ── Filtered friends ────────────────────────────────────────────────────
  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const q = searchQuery.toLowerCase();
    return friends.filter(
      (f) =>
        f.displayName.toLowerCase().includes(q) ||
        f.username.toLowerCase().includes(q),
    );
  }, [friends, searchQuery]);

  // ── Selection ───────────────────────────────────────────────────────────
  const toggleFriend = useCallback((friendUid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(friendUid)) {
        next.delete(friendUid);
      } else {
        // Enforce max members
        if (next.size + 1 + 1 > GROUP_LIMITS.MAX_MEMBERS) return prev; // +1 creator
        next.add(friendUid);
      }
      return next;
    });
  }, []);

  const removeMember = useCallback((friendUid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      next.delete(friendUid);
      return next;
    });
  }, []);

  // ── Avatar Picker ───────────────────────────────────────────────────────
  const handlePickAvatar = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setAvatarUri(result.assets[0].uri);
      setErrorMessage(null);
      logger.info("[handlePickAvatar] Avatar image selected");
    } catch (error) {
      logger.error("[handlePickAvatar] Failed:", error);
      setErrorMessage("Failed to select image. Please try again.");
    }
  }, []);

  // ── Create Group ────────────────────────────────────────────────────────
  const handleCreateGroup = useCallback(async () => {
    if (!uid || !canCreate || creationGuardRef.current) return;
    creationGuardRef.current = true;
    setCreating(true);
    setErrorMessage(null);

    const memberUids = Array.from(selectedUids);
    const trimmedName = groupName.trim();

    logger.info(
      `[handleCreateGroup] Starting creation: name="${trimmedName}", members=${memberUids.length}, hasAvatar=${!!avatarUri}`,
    );

    try {
      // Step 1: Pre-generate a group ID so the avatar can be uploaded to the correct path
      const { doc, collection } = await import("firebase/firestore");
      const { getFirestoreInstance } = await import("@/services/firebase");
      const db = getFirestoreInstance();
      const preGeneratedRef = doc(collection(db, "Groups"));
      const groupId = preGeneratedRef.id;

      logger.info(`[handleCreateGroup] Pre-generated groupId: ${groupId}`);

      // Step 2: Upload avatar
      let avatarUrl: string;
      try {
        logger.info("[handleCreateGroup] Uploading avatar...");
        avatarUrl = await uploadGroupAvatarImage(groupId, avatarUri!);
        logger.info(`[handleCreateGroup] Avatar uploaded: ${avatarUrl}`);
      } catch (uploadError) {
        logger.error("[handleCreateGroup] Avatar upload failed:", uploadError);
        setErrorMessage("Failed to upload group picture. Please try again.");
        setCreating(false);
        creationGuardRef.current = false;
        return;
      }

      // Step 3: Create group with avatar and the pre-generated ID
      logger.info("[handleCreateGroup] Creating group document...");
      const group = await createGroup(uid, {
        name: trimmedName,
        memberUids,
        avatarUrl,
        groupId,
      });
      logger.info(
        `[handleCreateGroup] Group created: ${group.id} "${group.name}"`,
      );

      // Step 4: Create local conversation row for immediate inbox sync
      try {
        const { getOrCreateGroupConversation } =
          await import("@/services/database/conversationRepository");
        getOrCreateGroupConversation(group.id, group.name);
        logger.info("[handleCreateGroup] Local conversation row created");
      } catch (convError) {
        // Non-fatal — the chat screen will create it on open
        logger.warn(
          "[handleCreateGroup] Local conversation row creation failed (non-fatal):",
          convError,
        );
      }

      // Step 5: Navigate to the new group
      logger.info("[handleCreateGroup] Navigating to GroupChat");
      navigation.replace("GroupChat", {
        groupId: group.id,
        groupName: group.name,
      });
    } catch (error: any) {
      logger.error("[handleCreateGroup] Creation failed:", error);
      setErrorMessage(
        error.message || "Failed to create group. Please try again.",
      );
      setCreating(false);
      creationGuardRef.current = false;
    }
  }, [uid, canCreate, selectedUids, groupName, avatarUri, navigation]);

  // ── Reset creation guard when going back ────────────────────────────────
  useEffect(() => {
    return () => {
      creationGuardRef.current = false;
    };
  }, []);

  // ── Loading State ───────────────────────────────────────────────────────
  if (loading) {
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
            title="New Group"
            titleStyle={[styles.headerTitle, { color: colors.text }]}
          />
        </Appbar.Header>
        <LoadingState message="Loading friends..." />
      </SafeAreaView>
    );
  }

  // ====================================================================
  // STEP 1 — Member Selection
  // ====================================================================
  if (step === "members") {
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
            title="Add Members"
            titleStyle={[styles.headerTitle, { color: colors.text }]}
          />
          <Button
            onPress={() => setStep("details")}
            disabled={!isMemberStepValid}
            labelStyle={[
              styles.headerAction,
              {
                color: isMemberStepValid
                  ? colors.primary
                  : colors.textSecondary,
              },
            ]}
          >
            Next
          </Button>
        </Appbar.Header>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* ── Selected Members Chips ─────────────────────────────── */}
          {selectedCount > 0 && (
            <View style={styles.chipsContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
                keyboardShouldPersistTaps="handled"
              >
                {selectedFriends.map((f) => (
                  <View
                    key={f.uid}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.primaryContainer },
                    ]}
                  >
                    <ProfilePictureWithDecoration
                      pictureUrl={f.profilePictureUrl}
                      name={f.displayName}
                      decorationId={f.decorationId}
                      size={24}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        { color: colors.onPrimaryContainer },
                      ]}
                      numberOfLines={1}
                    >
                      {f.displayName}
                    </Text>
                    <TouchableOpacity
                      onPress={() => removeMember(f.uid)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={colors.onPrimaryContainer}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              <Text
                style={[styles.chipCountLabel, { color: colors.textSecondary }]}
              >
                {totalMemberCount}/{GROUP_LIMITS.MAX_MEMBERS} members
              </Text>
            </View>
          )}

          {/* ── Minimum Members Warning ───────────────────────────── */}
          {selectedCount > 0 && totalMemberCount < GROUP_LIMITS.MIN_MEMBERS && (
            <View
              style={[
                styles.inlineWarning,
                { backgroundColor: colors.warningContainer },
              ]}
            >
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={colors.warning}
              />
              <Text
                style={[styles.inlineWarningText, { color: colors.warning }]}
              >
                Select at least {GROUP_LIMITS.MIN_MEMBERS - 1} friend
                {GROUP_LIMITS.MIN_MEMBERS - 1 > 1 ? "s" : ""} to continue
              </Text>
            </View>
          )}

          {/* ── Search Bar ────────────────────────────────────────── */}
          <View style={styles.searchContainer}>
            <Searchbar
              placeholder="Search friends..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[
                styles.searchbar,
                { backgroundColor: colors.surfaceVariant },
              ]}
              inputStyle={{ color: colors.text }}
              iconColor={colors.textSecondary}
              placeholderTextColor={colors.inputPlaceholder}
            />
          </View>

          {/* ── Friend List ───────────────────────────────────────── */}
          {friends.length === 0 ? (
            <EmptyState
              icon="account-group-outline"
              title="No Friends Yet"
              subtitle="Add some friends first to create a group chat"
            />
          ) : filteredFriends.length === 0 ? (
            <EmptyState
              icon="magnify"
              title="No Results"
              subtitle="No friends match your search"
            />
          ) : (
            <FlatList
              data={filteredFriends}
              renderItem={({ item }) => {
                const isSelected = selectedUids.has(item.uid);
                return (
                  <TouchableOpacity
                    style={[
                      styles.friendRow,
                      {
                        backgroundColor: isSelected
                          ? colors.primaryContainer
                          : colors.surface,
                      },
                      isSelected && {
                        borderColor: colors.primary,
                        borderWidth: 1,
                      },
                    ]}
                    onPress={() => toggleFriend(item.uid)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.friendLeft}>
                      <ProfilePictureWithDecoration
                        pictureUrl={item.profilePictureUrl}
                        name={item.displayName}
                        decorationId={item.decorationId}
                        size={44}
                      />
                      <View style={styles.friendInfo}>
                        <Text
                          style={[
                            styles.friendDisplayName,
                            { color: colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {item.displayName}
                        </Text>
                        <Text
                          style={[
                            styles.friendUsername,
                            { color: colors.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          @{item.username}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.selectionIndicator,
                        {
                          backgroundColor: isSelected
                            ? colors.primary
                            : "transparent",
                          borderColor: isSelected
                            ? colors.primary
                            : colors.outline,
                        },
                      ]}
                    >
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={colors.onPrimary}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              keyExtractor={(item) => item.uid}
              {...LIST_PERFORMANCE_PROPS}
              style={styles.friendsList}
              contentContainerStyle={styles.friendsListContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ====================================================================
  // STEP 2 — Group Details
  // ====================================================================
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
          onPress={() => setStep("members")}
          iconColor={colors.text}
        />
        <Appbar.Content
          title="Group Details"
          titleStyle={[styles.headerTitle, { color: colors.text }]}
        />
      </Appbar.Header>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.detailsContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Avatar Upload ─────────────────────────────────────── */}
          <View style={styles.avatarSection}>
            <Pressable
              onPress={handlePickAvatar}
              style={styles.avatarTouchable}
            >
              {avatarUri ? (
                <AppImage
                  source={{ uri: avatarUri }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.avatarPlaceholder,
                    { backgroundColor: colors.surfaceVariant },
                  ]}
                >
                  <Ionicons
                    name="camera-outline"
                    size={36}
                    color={colors.textSecondary}
                  />
                </View>
              )}
              <View
                style={[
                  styles.avatarBadge,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.background,
                  },
                ]}
              >
                <Ionicons
                  name={avatarUri ? "pencil" : "add"}
                  size={16}
                  color={colors.onPrimary}
                />
              </View>
            </Pressable>
            <Text style={[styles.avatarLabel, { color: colors.textSecondary }]}>
              {avatarUri ? "Tap to change" : "Add group photo"}
            </Text>
            {!avatarUri && (
              <Text style={[styles.avatarRequired, { color: colors.error }]}>
                A group photo is required
              </Text>
            )}
          </View>

          {/* ── Group Name Input ──────────────────────────────────── */}
          <View style={styles.nameSection}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>
              Group Name
            </Text>
            <TextInput
              mode="outlined"
              placeholder="Enter a group name..."
              value={groupName}
              onChangeText={(text) => {
                setGroupName(text);
                setErrorMessage(null);
              }}
              maxLength={GROUP_LIMITS.MAX_NAME_LENGTH}
              style={[styles.nameInput, { backgroundColor: colors.surface }]}
              outlineColor={colors.outline}
              activeOutlineColor={colors.primary}
              textColor={colors.text}
              placeholderTextColor={colors.inputPlaceholder}
            />
            <Text style={[styles.charCount, { color: colors.textSecondary }]}>
              {groupName.length}/{GROUP_LIMITS.MAX_NAME_LENGTH}
            </Text>
          </View>

          {/* ── Member Preview ────────────────────────────────────── */}
          <View style={styles.memberPreviewSection}>
            <View style={styles.memberPreviewHeader}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>
                Members ({totalMemberCount})
              </Text>
              <TouchableOpacity onPress={() => setStep("members")}>
                <Text style={[styles.editLink, { color: colors.primary }]}>
                  Edit
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.memberPreviewScroll}
            >
              {/* Creator (you) */}
              <View style={styles.memberPreviewItem}>
                <View
                  style={[
                    styles.memberPreviewAvatarBorder,
                    { borderColor: colors.primary },
                  ]}
                >
                  <Ionicons name="person" size={20} color={colors.primary} />
                </View>
                <Text
                  style={[
                    styles.memberPreviewName,
                    { color: colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  You
                </Text>
              </View>

              {selectedFriends.map((f) => (
                <View key={f.uid} style={styles.memberPreviewItem}>
                  <ProfilePictureWithDecoration
                    pictureUrl={f.profilePictureUrl}
                    name={f.displayName}
                    decorationId={f.decorationId}
                    size={44}
                  />
                  <Text
                    style={[
                      styles.memberPreviewName,
                      { color: colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {f.displayName.split(" ")[0]}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* ── Group Preview Card ────────────────────────────────── */}
          {(groupName.trim().length > 0 || avatarUri) && (
            <View
              style={[
                styles.previewCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.outline,
                },
              ]}
            >
              <Text
                style={[styles.previewLabel, { color: colors.textSecondary }]}
              >
                Preview
              </Text>
              <View style={styles.previewRow}>
                {avatarUri ? (
                  <AppImage
                    source={{ uri: avatarUri }}
                    style={styles.previewAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.previewAvatarPlaceholder,
                      { backgroundColor: colors.surfaceVariant },
                    ]}
                  >
                    <Ionicons
                      name="people"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </View>
                )}
                <View style={styles.previewInfo}>
                  <Text
                    style={[styles.previewName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {groupName.trim() || "Group Name"}
                  </Text>
                  <Text
                    style={[
                      styles.previewMeta,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {totalMemberCount} member{totalMemberCount !== 1 ? "s" : ""}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Error Message ─────────────────────────────────────── */}
          {errorMessage && (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: colors.errorContainer },
              ]}
            >
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={[styles.errorBannerText, { color: colors.error }]}>
                {errorMessage}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* ── Create Button ───────────────────────────────────────── */}
        <View style={[styles.createFooter, { borderTopColor: colors.divider }]}>
          <Button
            mode="contained"
            onPress={handleCreateGroup}
            disabled={!canCreate || creating}
            loading={creating}
            style={[
              styles.createButton,
              {
                backgroundColor:
                  canCreate && !creating
                    ? colors.primary
                    : colors.surfaceVariant,
              },
            ]}
            labelStyle={[
              styles.createButtonLabel,
              {
                color:
                  canCreate && !creating
                    ? colors.onPrimary
                    : colors.textSecondary,
              },
            ]}
            contentStyle={styles.createButtonContent}
          >
            {creating ? "Creating Group..." : "Create Group"}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ==========================================================================
// Styles
// ==========================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerAction: {
    fontSize: 16,
    fontWeight: "600",
  },

  // ── Chips (selected members bar) ──────────────────────────────────────
  chipsContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  chipsScroll: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 10,
    borderRadius: 20,
    gap: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    maxWidth: 100,
  },
  chipCountLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 6,
  },

  // ── Inline warning ────────────────────────────────────────────────────
  inlineWarning: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  inlineWarningText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },

  // ── Search ────────────────────────────────────────────────────────────
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchbar: {
    borderRadius: 12,
    elevation: 0,
  },

  // ── Friend List ───────────────────────────────────────────────────────
  friendsList: {
    flex: 1,
  },
  friendsListContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    overflow: "visible" as const,
    padding: 12,
    marginBottom: 6,
  },
  friendLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  friendInfo: {
    marginLeft: 12,
    flex: 1,
  },
  friendDisplayName: {
    fontSize: 15,
    fontWeight: "600",
  },
  friendUsername: {
    fontSize: 13,
    marginTop: 1,
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Details Step ──────────────────────────────────────────────────────
  detailsContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  // ── Avatar ────────────────────────────────────────────────────────────
  avatarSection: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 28,
  },
  avatarTouchable: {
    position: "relative",
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
  },
  avatarLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 10,
  },
  avatarRequired: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
  },

  // ── Group Name ────────────────────────────────────────────────────────
  nameSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  nameInput: {
    fontSize: 15,
  },
  charCount: {
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },

  // ── Member Preview ────────────────────────────────────────────────────
  memberPreviewSection: {
    marginBottom: 24,
  },
  memberPreviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  editLink: {
    fontSize: 14,
    fontWeight: "600",
  },
  memberPreviewScroll: {
    gap: 16,
    paddingRight: 8,
  },
  memberPreviewItem: {
    alignItems: "center",
    width: 56,
  },
  memberPreviewAvatarBorder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  memberPreviewName: {
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },

  // ── Preview Card ──────────────────────────────────────────────────────
  previewCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  previewAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  previewInfo: {
    marginLeft: 14,
    flex: 1,
  },
  previewName: {
    fontSize: 16,
    fontWeight: "700",
  },
  previewMeta: {
    fontSize: 13,
    marginTop: 2,
  },

  // ── Error Banner ──────────────────────────────────────────────────────
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },

  // ── Create Footer ────────────────────────────────────────────────────
  createFooter: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  createButton: {
    borderRadius: 24,
  },
  createButtonContent: {
    paddingVertical: 6,
  },
  createButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
});
