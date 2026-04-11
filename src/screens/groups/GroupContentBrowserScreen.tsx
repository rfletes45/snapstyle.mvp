/**
 * GroupContentBrowserScreen
 *
 * Full-screen content browser for a specific group chat.
 * Supports tabbed browsing: Media, Messages, Links.
 * Each tab has search, pagination, and proper empty/loading states.
 *
 * @module screens/groups/GroupContentBrowserScreen
 */

import { AppImage } from "@/components/AppImage";
import {
  BorderRadius,
  FontSizes,
  FontWeights,
  Spacing,
} from "@/constants/theme";
import {
  useGroupContentBrowser,
  type ContentTab,
  type LinkItem,
  type MediaItem,
  type MessageItem,
} from "@/hooks/useGroupContentBrowser";
import { useColors } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Appbar, Searchbar, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<MainStackParamList, "GroupContentBrowser">;

const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_COLUMNS = 3;
const GRID_GAP = 2;
const GRID_ITEM_SIZE =
  (SCREEN_WIDTH - GRID_GAP * (GRID_COLUMNS + 1)) / GRID_COLUMNS;

// =============================================================================
// Tab Configuration
// =============================================================================

const TABS: { key: ContentTab; label: string; icon: string }[] = [
  { key: "media", label: "Media", icon: "image-multiple" },
  { key: "messages", label: "Messages", icon: "message-text" },
  { key: "links", label: "Links", icon: "link-variant" },
];

// =============================================================================
// Main Component
// =============================================================================

export default function GroupContentBrowserScreen({
  route,
  navigation,
}: Props) {
  const { groupId, groupName, initialTab } = route.params;
  const colors = useColors();

  const browser = useGroupContentBrowser(groupId);

  // Set initial tab from params
  React.useEffect(() => {
    if (initialTab && ["media", "messages", "links"].includes(initialTab)) {
      browser.setActiveTab(initialTab as ContentTab);
    }
  }, []);

  // =========================================================================
  // Tab Bar
  // =========================================================================

  const renderTabBar = useCallback(() => {
    return (
      <View
        style={[
          styles.tabBar,
          {
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        {TABS.map((tab) => {
          const isActive = browser.activeTab === tab.key;
          const count =
            browser.counts[tab.key as keyof typeof browser.counts] ?? 0;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                isActive && {
                  borderBottomColor: colors.primary,
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => browser.setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={tab.icon as any}
                size={18}
                color={isActive ? colors.primary : colors.textSecondary}
                style={styles.tabIcon}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? colors.primary : colors.textSecondary,
                    fontWeight: isActive
                      ? FontWeights.semibold
                      : FontWeights.regular,
                  },
                ]}
              >
                {tab.label}
              </Text>
              {count > 0 && (
                <Text
                  style={[
                    styles.tabCount,
                    {
                      color: isActive ? colors.primary : colors.textMuted,
                    },
                  ]}
                >
                  {count > 999 ? "999+" : count}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }, [browser.activeTab, browser.counts, colors]);

  // =========================================================================
  // Media Grid
  // =========================================================================

  const renderMediaItem = useCallback(
    ({ item }: { item: MediaItem }) => {
      const imageSource = item.thumbUrl || item.remoteUrl || item.localUri;
      const isVideo = item.kind === "video";
      return (
        <TouchableOpacity
          style={[styles.gridItem, { backgroundColor: colors.surfaceVariant }]}
          activeOpacity={0.8}
          onPress={() => {
            // Navigate to the message in chat if possible
            navigation.navigate("GroupChat", {
              groupId,
              targetMessageId: item.messageId,
            });
          }}
        >
          {imageSource ? (
            <AppImage
              source={{ uri: imageSource }}
              style={styles.gridImage}
              debugLabel="GroupMediaThumb"
            />
          ) : (
            <View
              style={[
                styles.gridPlaceholder,
                { backgroundColor: colors.surfaceVariant },
              ]}
            >
              <MaterialCommunityIcons
                name={isVideo ? "video-outline" : "image-outline"}
                size={28}
                color={colors.textMuted}
              />
            </View>
          )}
          {isVideo && (
            <View style={styles.videoBadge}>
              <MaterialCommunityIcons
                name="play-circle"
                size={24}
                color="#FFF"
              />
              {item.durationMs ? (
                <Text style={styles.videoDuration}>
                  {formatDuration(item.durationMs)}
                </Text>
              ) : null}
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [colors, groupId, navigation],
  );

  // =========================================================================
  // Message Row
  // =========================================================================

  const renderMessageItem = useCallback(
    ({ item }: { item: MessageItem }) => {
      const timeStr = formatRelativeTime(item.timestamp);
      const snippet =
        item.text.length > 200 ? item.text.slice(0, 200) + "…" : item.text;

      return (
        <TouchableOpacity
          style={[styles.messageRow, { borderBottomColor: colors.border }]}
          activeOpacity={0.6}
          onPress={() => {
            navigation.navigate("GroupChat", {
              groupId,
              targetMessageId: item.messageId,
            });
          }}
        >
          <View style={styles.messageContent}>
            <View style={styles.messageHeader}>
              <Text
                style={[styles.messageSender, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.senderName || "Unknown"}
              </Text>
              <Text style={[styles.messageTime, { color: colors.textMuted }]}>
                {timeStr}
              </Text>
            </View>
            <Text
              style={[styles.messageText, { color: colors.textSecondary }]}
              numberOfLines={3}
            >
              {snippet}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={18}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      );
    },
    [colors, groupId, navigation],
  );

  // =========================================================================
  // Link Row
  // =========================================================================

  const renderLinkItem = useCallback(
    ({ item }: { item: LinkItem }) => {
      const timeStr = formatRelativeTime(item.timestamp);
      let displayUrl = item.url;
      try {
        const parsed = new URL(item.url);
        displayUrl =
          parsed.hostname + (parsed.pathname !== "/" ? parsed.pathname : "");
      } catch {
        // keep raw
      }

      return (
        <TouchableOpacity
          style={[styles.linkRow, { borderBottomColor: colors.border }]}
          activeOpacity={0.6}
          onPress={() => {
            Linking.openURL(item.url).catch(() => {});
          }}
          onLongPress={() => {
            navigation.navigate("GroupChat", {
              groupId,
              targetMessageId: item.messageId,
            });
          }}
        >
          <View
            style={[
              styles.linkIcon,
              { backgroundColor: colors.primary + "15" },
            ]}
          >
            <MaterialCommunityIcons
              name="link-variant"
              size={20}
              color={colors.primary}
            />
          </View>
          <View style={styles.linkContent}>
            <Text
              style={[styles.linkUrl, { color: colors.primary }]}
              numberOfLines={1}
            >
              {displayUrl}
            </Text>
            <Text
              style={[styles.linkMeta, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {item.senderName || "Unknown"} • {timeStr}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="open-in-new"
            size={16}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      );
    },
    [colors, groupId, navigation],
  );

  // =========================================================================
  // Empty States
  // =========================================================================

  const emptyState = useMemo(() => {
    const isSearching = browser.searchQuery.trim().length > 0;
    const emptyConfig: Record<
      ContentTab,
      { icon: string; title: string; subtitle: string }
    > = {
      media: {
        icon: "image-off-outline",
        title: isSearching ? "No media found" : "No shared media yet",
        subtitle: isSearching
          ? "Try a different search term"
          : "Photos and videos shared in this group will appear here",
      },
      messages: {
        icon: "message-off-outline",
        title: isSearching ? "No messages found" : "No messages yet",
        subtitle: isSearching
          ? "Try a different search term"
          : "Text messages in this group will appear here",
      },
      links: {
        icon: "link-off",
        title: isSearching ? "No links found" : "No shared links yet",
        subtitle: isSearching
          ? "Try a different search term"
          : "Links shared in this group will appear here",
      },
    };
    return emptyConfig[browser.activeTab];
  }, [browser.activeTab, browser.searchQuery]);

  const renderEmpty = useCallback(() => {
    if (browser.loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name={emptyState.icon as any}
          size={56}
          color={colors.textMuted}
        />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {emptyState.title}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          {emptyState.subtitle}
        </Text>
      </View>
    );
  }, [browser.loading, emptyState, colors]);

  // =========================================================================
  // Footer Loading
  // =========================================================================

  const renderFooter = useCallback(() => {
    if (!browser.loadingMore) return null;
    return (
      <View style={styles.footerLoading}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }, [browser.loadingMore, colors]);

  // =========================================================================
  // Current data
  // =========================================================================

  const currentData =
    browser.activeTab === "media"
      ? browser.mediaItems
      : browser.activeTab === "messages"
        ? browser.messageItems
        : browser.linkItems;

  const keyExtractor = useCallback(
    (item: any) =>
      item.attachmentId || item.messageId || `${item.messageId}-${item.url}`,
    [],
  );

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["bottom"]}
    >
      {/* Header */}
      <Appbar.Header
        style={{ backgroundColor: colors.background }}
        elevated={false}
      >
        <Appbar.BackAction
          onPress={() => navigation.goBack()}
          iconColor={colors.text}
        />
        <Appbar.Content
          title={groupName ? `${groupName}` : "Shared Content"}
          titleStyle={[styles.headerTitle, { color: colors.text }]}
        />
      </Appbar.Header>

      {/* Search Bar */}
      <View
        style={[styles.searchContainer, { backgroundColor: colors.background }]}
      >
        <Searchbar
          placeholder={`Search ${browser.activeTab}...`}
          onChangeText={browser.setSearchQuery}
          value={browser.searchQuery}
          style={[styles.searchBar, { backgroundColor: colors.surface }]}
          inputStyle={[styles.searchInput, { color: colors.text }]}
          iconColor={colors.textSecondary}
          placeholderTextColor={colors.textMuted}
          elevation={0}
        />
      </View>

      {/* Tab Bar */}
      {renderTabBar()}

      {/* Content */}
      {browser.loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : browser.activeTab === "media" ? (
        <FlatList
          data={browser.mediaItems}
          renderItem={renderMediaItem}
          keyExtractor={(item) => item.attachmentId}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={
            browser.mediaItems.length === 0
              ? styles.emptyListContent
              : styles.gridContent
          }
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={browser.loadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={currentData}
          renderItem={
            browser.activeTab === "messages"
              ? (renderMessageItem as any)
              : (renderLinkItem as any)
          }
          keyExtractor={keyExtractor}
          contentContainerStyle={
            currentData.length === 0
              ? styles.emptyListContent
              : styles.listContent
          }
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={browser.loadMore}
          onEndReachedThreshold={0.3}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function formatRelativeTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;

  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < day * 7) return `${Math.floor(diff / day)}d ago`;

  const date = new Date(ts);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
  },

  // Search
  searchContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  searchBar: {
    borderRadius: BorderRadius.xl,
    height: 40,
  },
  searchInput: {
    fontSize: FontSizes.sm,
    minHeight: 40,
  },

  // Tab Bar
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    gap: 4,
  },
  tabIcon: {
    marginRight: 2,
  },
  tabLabel: {
    fontSize: FontSizes.sm,
  },
  tabCount: {
    fontSize: FontSizes.xs,
    marginLeft: 2,
  },

  // Grid (Media)
  gridContent: {
    paddingTop: GRID_GAP,
  },
  gridRow: {
    gap: GRID_GAP,
    paddingHorizontal: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    borderRadius: 2,
    overflow: "hidden",
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  gridPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  videoBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  videoDuration: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // List (Messages / Links)
  listContent: {
    paddingTop: Spacing.xs,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  messageContent: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  messageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  messageSender: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    flex: 1,
  },
  messageTime: {
    fontSize: FontSizes.xs,
    marginLeft: Spacing.sm,
  },
  messageText: {
    fontSize: FontSizes.sm,
    lineHeight: 18,
  },

  // Links
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  linkContent: {
    flex: 1,
  },
  linkUrl: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  linkMeta: {
    fontSize: FontSizes.xs,
    marginTop: 1,
  },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxxl * 2,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: FontSizes.sm,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyListContent: {
    flexGrow: 1,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footerLoading: {
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
});
