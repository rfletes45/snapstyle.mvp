/**
 * InboxTabs Component (Redesigned — Snapchat-inspired)
 *
 * Horizontal scrollable filter tabs for the Messages screen:
 * - All: All conversations
 * - Unread: Conversations with unread messages (with badge)
 * - Groups: Group conversations only
 * - DMs: Direct messages only
 * - Requests: Friend requests (with badge)
 *
 * Unified background color matching the Messages screen for visual cohesion.
 * Clean pill-style tabs with subtle active state.
 *
 * @module components/chat/inbox/InboxTabs
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import type { InboxFilter } from "@/hooks/useInboxData";
import { useAppTheme } from "@/store/ThemeContext";
import * as haptics from "@/utils/haptics";
import React, { memo, useCallback } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Badge, Text } from "react-native-paper";

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
  /** Friend requests count for badge */
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
  const { colors, isDark } = useAppTheme();
  const inactiveTabBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";

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
      badge: unreadCount > 0 ? 1 : undefined,
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
                    ? colors.primary + "18"
                    : inactiveTabBg,
                  borderColor: isActive ? colors.primary + "40" : "transparent",
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
                  size={16}
                  style={[
                    styles.badge,
                    {
                      backgroundColor: isActive
                        ? colors.primary
                        : colors.textMuted,
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
    marginTop: 6,
    // No border — unified continuous surface with the header and list
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  tabLabel: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
  badge: {
    marginLeft: 2,
  },
});
