/**
 * GroupChatCreateScreen
 *
 * Features:
 * - Enter group name
 * - Select friends to invite (multi-select)
 * - Create group and send invites
 */

import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { EmptyState, LoadingState } from "@/components/ui";
import { getFriends, getUserProfileByUid } from "@/services/friends";
import { createGroup } from "@/services/groups";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import { Friend, GROUP_LIMITS, User } from "@/types/models";
import { LIST_PERFORMANCE_PROPS } from "@/utils/listPerformance";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Appbar,
  Button,
  Checkbox,
  Searchbar,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/groups/GroupChatCreateScreen");
interface FriendWithProfile extends Friend {
  profile?: User;
}

interface SelectableFriend {
  uid: string;
  username: string;
  displayName: string;
  avatarConfig: User["avatarConfig"];
  profilePictureUrl?: string | null;
  decorationId?: string | null;
  selected: boolean;
}

export default function GroupChatCreateScreen({ navigation }: any) {
  const theme = useTheme();
  const { colors } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [groupName, setGroupName] = useState("");
  const [friends, setFriends] = useState<SelectableFriend[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<SelectableFriend[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  // Load friends
  useEffect(() => {
    async function loadFriends() {
      if (!uid) return;

      try {
        setLoading(true);
        const friendsData = await getFriends(uid);

        // Fetch profiles for each friend
        const friendsWithProfiles = await Promise.all(
          friendsData.map(async (friend): Promise<SelectableFriend | null> => {
            const friendUid = friend.users.find((u) => u !== uid);
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
              selected: false,
            };
          }),
        );

        // Filter out nulls
        const selectableFriends = friendsWithProfiles.filter(
          (f): f is SelectableFriend => f !== null,
        );

        setFriends(selectableFriends);
        setFilteredFriends(selectableFriends);
      } catch (error) {
        logger.error("Error loading friends:", error);
        Alert.alert("Error", "Failed to load friends");
      } finally {
        setLoading(false);
      }
    }

    loadFriends();
  }, [uid]);

  // Filter friends by search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFriends(friends);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = friends.filter(
      (f) =>
        f.displayName.toLowerCase().includes(query) ||
        f.username.toLowerCase().includes(query),
    );
    setFilteredFriends(filtered);
  }, [searchQuery, friends]);

  // Toggle friend selection
  const toggleFriend = useCallback((friendUid: string) => {
    setFriends((prev) =>
      prev.map((f) =>
        f.uid === friendUid ? { ...f, selected: !f.selected } : f,
      ),
    );
    setFilteredFriends((prev) =>
      prev.map((f) =>
        f.uid === friendUid ? { ...f, selected: !f.selected } : f,
      ),
    );
  }, []);

  // Get selected count
  const selectedCount = friends.filter((f) => f.selected).length;
  const totalMemberCount = selectedCount + 1; // Including creator

  // Validate form
  const isValid =
    groupName.trim().length > 0 &&
    groupName.length <= GROUP_LIMITS.MAX_NAME_LENGTH &&
    totalMemberCount >= GROUP_LIMITS.MIN_MEMBERS &&
    totalMemberCount <= GROUP_LIMITS.MAX_MEMBERS;

  // Create group
  const handleCreateGroup = async () => {
    if (!uid || !isValid) return;

    try {
      setCreating(true);

      const selectedUids = friends.filter((f) => f.selected).map((f) => f.uid);

      const group = await createGroup(uid, {
        name: groupName.trim(),
        memberUids: selectedUids,
      });

      setSnackbar({
        visible: true,
        message: `Group "${group.name}" created! Invites sent.`,
      });

      // Navigate to the group chat
      setTimeout(() => {
        navigation.replace("GroupChat", {
          groupId: group.id,
          groupName: group.name,
        });
      }, 500);
    } catch (error: any) {
      logger.error("Error creating group:", error);
      Alert.alert("Error", error.message || "Failed to create group");
      setCreating(false);
    }
  };

  // Render friend item
  const renderFriend = ({ item }: { item: SelectableFriend }) => (
    <TouchableOpacity
      style={[
        styles.friendItem,
        { backgroundColor: colors.surface },
        item.selected && [
          styles.friendItemSelected,
          {
            backgroundColor: colors.primaryContainer,
            borderColor: colors.primary,
          },
        ],
      ]}
      onPress={() => toggleFriend(item.uid)}
      activeOpacity={0.7}
    >
      <View style={styles.friendLeft}>
        <ProfilePictureWithDecoration
          pictureUrl={item.profilePictureUrl}
          name={item.displayName}
          decorationId={item.decorationId}
          size={40}
        />
        <View style={styles.friendInfo}>
          <Text style={[styles.friendName, { color: colors.text }]}>
            {item.displayName}
          </Text>
          <Text
            style={[styles.friendUsername, { color: colors.textSecondary }]}
          >
            @{item.username}
          </Text>
        </View>
      </View>
      <Checkbox
        status={item.selected ? "checked" : "unchecked"}
        onPress={() => toggleFriend(item.uid)}
        color={theme.colors.primary}
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["bottom"]}
      >
        <Appbar.Header style={{ backgroundColor: colors.background }}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Create Group" />
        </Appbar.Header>
        <LoadingState message="Loading friends..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["bottom"]}
    >
      <Appbar.Header style={{ backgroundColor: colors.background }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Create Group" />
      </Appbar.Header>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Group Name Input */}
        <View style={styles.nameSection}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>
            Group Name
          </Text>
          <TextInput
            mode="outlined"
            placeholder="Enter group name..."
            value={groupName}
            onChangeText={setGroupName}
            maxLength={GROUP_LIMITS.MAX_NAME_LENGTH}
            style={[styles.nameInput, { backgroundColor: colors.surface }]}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            textColor={theme.colors.onSurface}
          />
          <Text style={[styles.charCount, { color: colors.textSecondary }]}>
            {groupName.length}/{GROUP_LIMITS.MAX_NAME_LENGTH}
          </Text>
        </View>

        {/* Member Selection */}
        <View style={styles.membersSection}>
          <View style={styles.memberHeader}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>
              Select Members ({selectedCount} selected)
            </Text>
            <Text style={[styles.memberLimit, { color: colors.textSecondary }]}>
              {totalMemberCount}/{GROUP_LIMITS.MAX_MEMBERS}
            </Text>
          </View>

          {totalMemberCount < GROUP_LIMITS.MIN_MEMBERS && (
            <Text style={[styles.warningText, { color: colors.warning }]}>
              ⚠️ Groups need at least {GROUP_LIMITS.MIN_MEMBERS} members
              (including you)
            </Text>
          )}

          <Searchbar
            placeholder="Search friends..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchbar, { backgroundColor: colors.surface }]}
            inputStyle={{ color: colors.text }}
            iconColor={colors.textSecondary}
          />

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
              renderItem={renderFriend}
              keyExtractor={(item) => item.uid}
              {...LIST_PERFORMANCE_PROPS}
              style={styles.friendsList}
              contentContainerStyle={styles.friendsContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        {/* Create Button */}
        <View style={styles.footer}>
          <Button
            mode="contained"
            onPress={handleCreateGroup}
            disabled={!isValid || creating}
            loading={creating}
            style={styles.createButton}
            labelStyle={styles.createButtonLabel}
          >
            {creating ? "Creating..." : "Create Group"}
          </Button>
        </View>
      </KeyboardAvoidingView>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: "" })}
        duration={2000}
        style={styles.snackbar}
      >
        {snackbar.message}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  nameSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  nameInput: {},
  charCount: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 4,
  },
  membersSection: {
    flex: 1,
  },
  memberHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  memberLimit: {
    fontSize: 14,
  },
  warningText: {
    fontSize: 12,
    marginBottom: 12,
  },
  searchbar: {
    marginBottom: 12,
  },
  friendsList: {
    flex: 1,
  },
  friendsContent: {
    paddingBottom: 16,
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    overflow: "visible" as const,
    padding: 12,
    marginBottom: 8,
  },
  friendItemSelected: {
    borderWidth: 1,
  },
  friendLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  friendInfo: {
    marginLeft: 12,
  },
  friendName: {
    fontSize: 16,
    fontWeight: "500",
  },
  friendUsername: {
    fontSize: 13,
  },
  footer: {
    paddingVertical: 16,
  },
  createButton: {
    paddingVertical: 6,
    borderRadius: 24,
  },
  createButtonLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  snackbar: {},
});
