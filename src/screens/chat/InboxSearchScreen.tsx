/**
 * InboxSearchScreen
 *
 * Enhanced search screen for finding conversations, messages, and people:
 * - Search by conversation name
 * - Search by message content
 * - Filter by type (all/people/groups/messages/media)
 * - Text highlighting in search results
 * - Recent searches with clear functionality
 * - Result count display
 *
 * @module screens/chat/InboxSearchScreen
 */

import { ConversationItem } from "@/components/chat/inbox";
import { useInboxData } from "@/hooks/useInboxData";
import {
  addRecentSearch,
  clearRecentSearches,
  getInboxSettings,
  updateInboxSettings,
} from "@/services/inboxSettings";
import { useAuth } from "@/store/AuthContext";
import { useAppTheme } from "@/store/ThemeContext";
import type { InboxConversation } from "@/types/messaging";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Keyboard,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Appbar, Chip, IconButton, Searchbar, Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BorderRadius, Spacing } from "../../../constants/theme";

// =============================================================================
// Types
// =============================================================================

type SearchFilter = "all" | "people" | "groups" | "messages" | "media";

interface SearchResult {
  conversation: InboxConversation;
  matchType: "name" | "message" | "media";
  matchedText?: string;
}

// =============================================================================
// Component
// =============================================================================

export default function InboxSearchScreen() {
  const { colors } = useAppTheme();
  const { currentFirebaseUser } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const uid = currentFirebaseUser?.uid ?? "";

  // Get all conversations from inbox (unfiltered for search)
  const { allConversations } = useInboxData(uid);

  // State
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);

  // =============================================================================
  // Load Recent Searches
  // =============================================================================

  useEffect(() => {
    if (!uid) return;

    getInboxSettings(uid).then((settings) => {
      setRecentSearches(settings.recentSearches || []);
    });
  }, [uid]);

  // =============================================================================
  // Search Logic
  // =============================================================================

  const performSearch = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        return;
      }

      setSearching(true);
      const normalizedQuery = searchQuery.toLowerCase().trim();

      // Filter conversations
      let filtered = allConversations.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(normalizedQuery);
        const messageMatch = c.lastMessage?.text
          ?.toLowerCase()
          .includes(normalizedQuery);
        const hasMedia =
          c.lastMessage?.type === "image" ||
          c.lastMessage?.type === "voice" ||
          c.lastMessage?.type === "attachment";

        // Filter-specific logic
        switch (filter) {
          case "people":
            // People filter: only DMs, match name or message
            return c.type === "dm" && (nameMatch || messageMatch);

          case "groups":
            // Groups filter: only groups, match name or message
            return c.type === "group" && (nameMatch || messageMatch);

          case "messages":
            // Messages filter: only conversations where message content matches
            return messageMatch;

          case "media":
            // Media filter: conversations with media AND name/message match
            return hasMedia && (nameMatch || messageMatch);

          case "all":
          default:
            // All: match name or message
            return nameMatch || messageMatch;
        }
      });

      // Build results with match info
      const searchResults: SearchResult[] = filtered.map((c) => {
        const nameMatch = c.name.toLowerCase().includes(normalizedQuery);
        const messageMatch = c.lastMessage?.text
          ?.toLowerCase()
          .includes(normalizedQuery);
        const hasMedia =
          c.lastMessage?.type === "image" ||
          c.lastMessage?.type === "voice" ||
          c.lastMessage?.type === "attachment";

        // Determine match type for display priority
        let matchType: "name" | "message" | "media" = "name";
        if (!nameMatch && messageMatch) {
          matchType = "message";
        } else if (hasMedia && filter === "media") {
          matchType = "media";
        }

        return {
          conversation: c,
          matchType,
          matchedText: messageMatch ? c.lastMessage?.text : undefined,
        };
      });

      setResults(searchResults);
      setSearching(false);
    },
    [allConversations, filter],
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  // =============================================================================
  // Handlers
  // =============================================================================

  const handleSubmit = useCallback(async () => {
    if (!uid || !query.trim()) return;

    Keyboard.dismiss();
    await addRecentSearch(uid, query.trim());
    setRecentSearches((prev) => {
      const updated = [query.trim(), ...prev.filter((s) => s !== query.trim())];
      return updated.slice(0, 10);
    });
  }, [uid, query]);

  const handleRecentSearchTap = useCallback((term: string) => {
    setQuery(term);
  }, []);

  const handleClearRecent = useCallback(
    async (term: string) => {
      const updated = recentSearches.filter((s) => s !== term);
      setRecentSearches(updated);

      if (uid) {
        // Update in Firestore
        await updateInboxSettings(uid, { recentSearches: updated });
      }
    },
    [uid, recentSearches],
  );

  const handleClearAllRecent = useCallback(async () => {
    setRecentSearches([]);
    if (uid) {
      await clearRecentSearches(uid);
    }
  }, [uid]);

  const handleConversationPress = useCallback(
    (conversation: InboxConversation) => {
      // Save search term before navigating
      if (query.trim()) {
        handleSubmit();
      }

      if (conversation.type === "dm") {
        navigation.navigate("ChatDetail", {
          friendUid: conversation.otherUserId,
        });
      } else {
        navigation.navigate("GroupChat", {
          groupId: conversation.id,
          groupName: conversation.name,
        });
      }
    },
    [navigation, query, handleSubmit],
  );

  // =============================================================================
  // Render Functions
  // =============================================================================

  const renderSearchResult = useCallback(
    ({ item }: { item: SearchResult }) => (
      <ConversationItem
        conversation={item.conversation}
        onPress={() => handleConversationPress(item.conversation)}
        onAvatarPress={() => {}}
        onLongPress={() => {}}
        highlightText={query.trim()}
      />
    ),
    [handleConversationPress, query],
  );

  const renderRecentSearch = useCallback(
    (term: string, index: number) => (
      <TouchableOpacity
        key={`${term}-${index}`}
        style={[styles.recentItem, { borderBottomColor: colors.border }]}
        onPress={() => handleRecentSearchTap(term)}
      >
        <View style={styles.recentItemLeft}>
          <IconButton
            icon="history"
            size={20}
            iconColor={colors.textSecondary}
            style={styles.recentIcon}
          />
          <Text style={[styles.recentText, { color: colors.text }]}>
            {term}
          </Text>
        </View>
        <IconButton
          icon="close"
          size={18}
          iconColor={colors.textSecondary}
          onPress={() => handleClearRecent(term)}
        />
      </TouchableOpacity>
    ),
    [colors, handleRecentSearchTap, handleClearRecent],
  );

  // =============================================================================
  // Filter Chips
  // =============================================================================

  const filters: Array<{ key: SearchFilter; label: string; icon?: string }> = [
    { key: "all", label: "All" },
    { key: "people", label: "People", icon: "account" },
    { key: "groups", label: "Groups", icon: "account-group" },
    { key: "messages", label: "Messages", icon: "message-text" },
    { key: "media", label: "Media", icon: "image" },
  ];

  // =============================================================================
  // Main Render
  // =============================================================================

  const showRecent = query.trim() === "" && recentSearches.length > 0;
  const showResults = query.trim() !== "";
  const showEmpty = showResults && results.length === 0 && !searching;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with Search */}
      <Appbar.Header style={{ backgroundColor: colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Searchbar
          placeholder="Search conversations..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSubmit}
          style={[styles.searchbar, { backgroundColor: colors.surfaceVariant }]}
          inputStyle={{ color: colors.text }}
          iconColor={colors.textSecondary}
          autoFocus
        />
      </Appbar.Header>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filtersContainer, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.filtersContent}
      >
        {filters.map((f) => (
          <Chip
            key={f.key}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
            icon={f.icon}
            style={[
              styles.chip,
              filter === f.key && { backgroundColor: colors.primary + "20" },
            ]}
            textStyle={{
              color: filter === f.key ? colors.primary : colors.textSecondary,
              fontSize: 13,
            }}
          >
            {f.label}
          </Chip>
        ))}
      </ScrollView>

      {/* Recent Searches */}
      {showRecent && (
        <View style={styles.recentContainer}>
          <View style={styles.recentHeader}>
            <Text
              style={[styles.sectionTitle, { color: colors.textSecondary }]}
            >
              RECENT SEARCHES
            </Text>
            <TouchableOpacity onPress={handleClearAllRecent}>
              <Text style={[styles.clearAll, { color: colors.primary }]}>
                Clear All
              </Text>
            </TouchableOpacity>
          </View>
          {recentSearches.map((term, index) => renderRecentSearch(term, index))}
        </View>
      )}

      {/* Search Results */}
      {showResults && (
        <FlatList
          data={results}
          renderItem={renderSearchResult}
          keyExtractor={(item) =>
            `${item.conversation.type}-${item.conversation.id}`
          }
          contentContainerStyle={{ paddingBottom: insets.bottom }}
          ListHeaderComponent={
            results.length > 0 ? (
              <View style={styles.resultsHeader}>
                <Text
                  style={[styles.resultsCount, { color: colors.textSecondary }]}
                >
                  {results.length} result{results.length !== 1 ? "s" : ""}{" "}
                  {filter !== "all" && `in ${filter}`}
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            showEmpty ? (
              <View style={styles.emptyContainer}>
                <IconButton
                  icon={
                    filter === "media"
                      ? "image-off"
                      : filter === "messages"
                        ? "message-text-outline"
                        : "magnify"
                  }
                  size={48}
                  iconColor={colors.textSecondary}
                />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {filter === "media"
                    ? "No media found"
                    : filter === "messages"
                      ? "No messages found"
                      : "No results found"}
                </Text>
                <Text
                  style={[
                    styles.emptySubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  {filter === "media"
                    ? "Try searching in a different filter"
                    : filter === "messages"
                      ? "No messages match your search"
                      : "Try a different search term or filter"}
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Initial State */}
      {!showRecent && !showResults && (
        <View style={styles.initialContainer}>
          <IconButton
            icon="magnify"
            size={48}
            iconColor={colors.textSecondary}
          />
          <Text style={[styles.initialText, { color: colors.textSecondary }]}>
            Search for conversations, people, or messages
          </Text>
        </View>
      )}
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchbar: {
    flex: 1,
    marginRight: Spacing.md,
    elevation: 0,
  },
  filtersContainer: {
    borderBottomWidth: 1,
  },
  filtersContent: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  chip: {
    borderRadius: BorderRadius.full,
    height: 32,
  },
  recentContainer: {
    flex: 1,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  clearAll: {
    fontSize: 13,
    fontWeight: "500",
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  recentIcon: {
    margin: 0,
  },
  recentText: {
    fontSize: 15,
  },
  resultsHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.xxxl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: Spacing.xs,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
  initialContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  initialText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
});
