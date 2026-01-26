/**
 * PinnedSection Component
 *
 * Displays pinned conversations at the top of the inbox list.
 * Shows a header with pin icon and count, followed by pinned items.
 *
 * Features:
 * - Collapsible section header
 * - Condensed conversation items
 * - Quick unpin action
 *
 * @module components/chat/inbox/PinnedSection
 */

import { useAppTheme } from "@/store/ThemeContext";
import type { InboxConversation } from "@/types/messaging";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback, useState } from "react";
import {
  LayoutAnimation,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Divider, Text } from "react-native-paper";
import { Spacing } from "../../../../constants/theme";
import { ConversationItem } from "./ConversationItem";

// =============================================================================
// Types
// =============================================================================

export interface PinnedSectionProps {
  /** List of pinned conversations */
  conversations: InboxConversation[];
  /** Called when a conversation is pressed */
  onConversationPress: (conversation: InboxConversation) => void;
  /** Called when avatar is pressed */
  onAvatarPress: (conversation: InboxConversation) => void;
  /** Called when long pressed with optional position */
  onLongPress?: (
    conversation: InboxConversation,
    event?: { pageX: number; pageY: number },
  ) => void;
}

// =============================================================================
// Component
// =============================================================================

export const PinnedSection = memo(function PinnedSection({
  conversations,
  onConversationPress,
  onAvatarPress,
  onLongPress,
}: PinnedSectionProps) {
  const { colors } = useAppTheme();
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapsed = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((prev) => !prev);
  }, []);

  if (conversations.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <TouchableOpacity
        style={[styles.header, { backgroundColor: colors.surfaceVariant }]}
        onPress={toggleCollapsed}
        accessibilityRole="button"
        accessibilityLabel={`Pinned conversations, ${conversations.length} items. ${collapsed ? "Expand" : "Collapse"}`}
      >
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons
            name="pin"
            size={16}
            color={colors.primary}
            style={styles.pinIcon}
          />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Pinned
          </Text>
          <Text style={[styles.headerCount, { color: colors.textSecondary }]}>
            {conversations.length}
          </Text>
        </View>

        <MaterialCommunityIcons
          name={collapsed ? "chevron-down" : "chevron-up"}
          size={20}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {/* Pinned Conversations */}
      {!collapsed && (
        <View style={styles.list}>
          {conversations.map((conversation) => (
            <ConversationItem
              key={`${conversation.type}-${conversation.id}`}
              conversation={conversation}
              onPress={() => onConversationPress(conversation)}
              onAvatarPress={() => onAvatarPress(conversation)}
              onLongPress={(event) => onLongPress?.(conversation, event)}
            />
          ))}
        </View>
      )}

      {/* Divider */}
      <Divider style={[styles.divider, { backgroundColor: colors.border }]} />
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  pinIcon: {
    marginRight: Spacing.xs,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  headerCount: {
    fontSize: 13,
    marginLeft: Spacing.xs,
  },
  list: {
    // No extra styling needed
  },
  divider: {
    height: 1,
  },
});
