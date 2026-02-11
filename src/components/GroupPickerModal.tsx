/**
 * GroupPickerModal - Select a group to share a spectator invite with
 *
 * Mirrors FriendPickerModal but loads the user's groups instead of friends.
 */

import { getUserGroups } from "@/services/groups";
import { Group } from "@/types/models";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Searchbar, Text, useTheme } from "react-native-paper";
import { BorderRadius, Mocha, Spacing } from "@/constants/theme";


import { createLogger } from "@/utils/log";
const logger = createLogger("components/GroupPickerModal");
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GroupPickerItem {
  groupId: string;
  name: string;
  memberCount: number;
  avatarUrl?: string;
}

interface GroupPickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSelectGroup: (group: GroupPickerItem) => void;
  currentUserId: string;
  title?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GroupPickerModal({
  visible,
  onDismiss,
  onSelectGroup,
  currentUserId,
  title = "Share with Group",
}: GroupPickerModalProps) {
  const theme = useTheme();
  const [groups, setGroups] = useState<GroupPickerItem[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<GroupPickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Load groups when the modal becomes visible
  useEffect(() => {
    if (visible && currentUserId) {
      loadGroups();
    }
  }, [visible, currentUserId]);

  // Filter groups by search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredGroups(groups);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredGroups(groups.filter((g) => g.name.toLowerCase().includes(q)));
    }
  }, [searchQuery, groups]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const userGroups: Group[] = await getUserGroups(currentUserId);
      const items: GroupPickerItem[] = userGroups.map((g) => ({
        groupId: g.id,
        name: g.name,
        memberCount: g.memberCount ?? g.memberIds?.length ?? 0,
        avatarUrl: g.avatarUrl,
      }));
      setGroups(items);
      setFilteredGroups(items);
    } catch (error) {
      logger.error("[GroupPicker] Error loading groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (group: GroupPickerItem) => {
    onSelectGroup(group);
    setSearchQuery("");
  };

  // ------ Render helpers ----------------------------------------------------

  const renderGroupItem = ({ item }: { item: GroupPickerItem }) => (
    <TouchableOpacity
      style={[
        styles.groupItem,
        { backgroundColor: `${theme.colors.onSurface}08` },
      ]}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.groupAvatar,
          { backgroundColor: theme.colors.primaryContainer },
        ]}
      >
        <MaterialCommunityIcons
          name="account-group"
          size={22}
          color={theme.colors.onPrimaryContainer}
        />
      </View>

      <View style={styles.groupInfo}>
        <Text
          style={[styles.groupName, { color: theme.colors.onSurface }]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text
          style={[styles.groupMeta, { color: theme.colors.onSurfaceVariant }]}
        >
          {item.memberCount} member{item.memberCount !== 1 ? "s" : ""}
        </Text>
      </View>

      <MaterialCommunityIcons
        name="send"
        size={24}
        color={theme.colors.primary}
        style={styles.sendIcon}
      />
    </TouchableOpacity>
  );

  const renderEmpty = () => {
    if (loading) return null;
    if (groups.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="account-group-outline"
            size={48}
            color={theme.colors.onSurfaceDisabled}
          />
          <Text
            style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
          >
            No groups yet
          </Text>
          <Text
            style={[
              styles.emptySubtext,
              { color: theme.colors.onSurfaceDisabled },
            ]}
          >
            Create a group to share spectator invites!
          </Text>
        </View>
      );
    }
    if (filteredGroups.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="magnify"
            size={48}
            color={theme.colors.onSurfaceDisabled}
          />
          <Text
            style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
          >
            No matches found
          </Text>
        </View>
      );
    }
    return null;
  };

  // ------ Main render -------------------------------------------------------

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: Mocha.surface0 }]}>
          {/* Header */}
          <View
            style={[
              styles.header,
              { borderBottomColor: `${theme.colors.onSurface}15` },
            ]}
          >
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              {title}
            </Text>
            <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={theme.colors.onSurface}
              />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <Searchbar
            placeholder="Search groups..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={[
              styles.searchBar,
              { backgroundColor: `${theme.colors.onSurface}10` },
            ]}
            inputStyle={[styles.searchInput, { color: theme.colors.onSurface }]}
            iconColor={theme.colors.onSurfaceVariant}
            placeholderTextColor={theme.colors.onSurfaceDisabled}
          />

          {/* List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text
                style={[
                  styles.loadingText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Loading groups...
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredGroups}
              keyExtractor={(item) => item.groupId}
              renderItem={renderGroupItem}
              ListEmptyComponent={renderEmpty}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Cancel */}
          <Button
            mode="outlined"
            onPress={onDismiss}
            style={[
              styles.cancelButton,
              { borderColor: theme.colors.outlineVariant },
            ]}
            textColor={theme.colors.onSurface}
          >
            Cancel
          </Button>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  container: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "80%",
    paddingBottom: Spacing.xl * 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    paddingTop: Spacing.lg,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  closeButton: {
    padding: Spacing.xs,
  },
  searchBar: {
    margin: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  searchInput: {},
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    flexGrow: 1,
  },
  groupItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: "visible",
    marginBottom: Spacing.sm,
  },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  groupInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  groupName: {
    fontSize: 16,
    fontWeight: "600",
  },
  groupMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  sendIcon: {
    marginLeft: Spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.xl * 3,
  },
  loadingText: {
    marginTop: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.xl * 3,
  },
  emptyText: {
    fontSize: 16,
    marginTop: Spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  cancelButton: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
});
