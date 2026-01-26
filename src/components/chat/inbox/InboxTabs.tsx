/**
 * InboxTabs Component
 *
 * Horizontal scrollable filter tabs for inbox:
 * - All: All conversations
 * - Unread: Conversations with unread messages (with badge)
 * - Groups: Group conversations only
 * - DMs: Direct messages only
 * - Requests: Friend/connection requests (with badge)
 *
 * @module components/chat/inbox/InboxTabs
 */

import type { InboxFilter } from "@/hooks/useInboxData";
import { useAppTheme } from "@/store/ThemeContext";
import * as haptics from "@/utils/haptics";
import React, { memo, useCallback } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Badge, Text } from "react-native-paper";
import { BorderRadius, Spacing } from "../../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

interface Tab {
  key: InboxFilter;
  label: string;
  badge?: number;
}

export interface InboxTabsProps {
  /** Currently active tab */
  activeTab: InboxFilter;
  /** Callback when tab changes */
  onTabChange: (tab: InboxFilter) => void;
  /** Total unread count for badge */
  unreadCount: number;
  /** Friend/connection requests count for badge */
  requestsCount: number;
}

// =============================================================================
// Component
// =============================================================================

export const InboxTabs = memo(function InboxTabs({
  activeTab,
  onTabChange,
  unreadCount,
  requestsCount,
}: InboxTabsProps) {
  const { colors } = useAppTheme();

  const handleTabChange = useCallback(
    (tab: InboxFilter) => {
      if (tab !== activeTab) {
        haptics.tabChange();
      }
      onTabChange(tab);
    },
    [activeTab, onTabChange],
  );

  const tabs: Tab[] = [
    { key: "all", label: "All" },
    {
      key: "unread",
      label: "Unread",
      badge: unreadCount > 0 ? 1 : undefined, // Will display as "!" in badge render
    },
    { key: "groups", label: "Groups" },
    { key: "dms", label: "DMs" },
    {
      key: "requests",
      label: "Requests",
      badge: requestsCount > 0 ? requestsCount : undefined,
    },
  ];

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                {
                  backgroundColor: isActive
                    ? colors.primary + "20"
                    : "transparent",
                },
              ]}
              onPress={() => handleTabChange(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label} tab${tab.badge ? `, ${tab.badge} items` : ""}`}
            >
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? colors.primary : colors.textSecondary,
                    fontWeight: isActive ? "600" : "500",
                  },
                ]}
              >
                {tab.label}
              </Text>
              {tab.badge !== undefined && (
                <Badge
                  size={18}
                  style={[
                    styles.badge,
                    {
                      backgroundColor: isActive
                        ? colors.primary
                        : colors.textSecondary,
                    },
                  ]}
                >
                  {tab.key === "unread"
                    ? "!"
                    : tab.badge > 99
                      ? "99+"
                      : tab.badge}
                </Badge>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  tabLabel: {
    fontSize: 14,
  },
  badge: {
    marginLeft: 2,
  },
});
