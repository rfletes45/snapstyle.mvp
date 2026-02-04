/**
 * CallHistoryScreen - Display recent calls with filtering and actions
 * Supports call from history, delete, and filter by type/direction
 */

import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Avatar from "@/components/Avatar";
import { theme } from "@/constants/theme";
import {
  CallHistoryEntry,
  CallHistoryFilter,
  CallHistoryStats,
  CallType,
} from "@/types/call";
import { useColors } from "../../store/ThemeContext";

import {
  areNativeCallsAvailable,
  callHistoryService,
  getCallService,
} from "@/services/calls";

// Filter options
type FilterOption =
  | "all"
  | "incoming"
  | "outgoing"
  | "missed"
  | "video"
  | "audio";

const FILTER_OPTIONS: { key: FilterOption; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "list" },
  { key: "missed", label: "Missed", icon: "call-outline" },
  { key: "incoming", label: "Incoming", icon: "arrow-down" },
  { key: "outgoing", label: "Outgoing", icon: "arrow-up" },
  { key: "video", label: "Video", icon: "videocam" },
  { key: "audio", label: "Audio", icon: "call" },
];

export function CallHistoryScreen() {
  const navigation = useNavigation<any>();
  const colors = useColors();

  // State
  const [history, setHistory] = useState<CallHistoryEntry[]>([]);
  const [stats, setStats] = useState<CallHistoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Load call history
  const loadHistory = useCallback(async () => {
    try {
      const filter: CallHistoryFilter = {};

      // Map filter option to CallHistoryFilter
      switch (activeFilter) {
        case "missed":
          filter.direction = "missed";
          break;
        case "incoming":
          filter.direction = "incoming";
          break;
        case "outgoing":
          filter.direction = "outgoing";
          break;
        case "video":
          filter.type = "video";
          break;
        case "audio":
          filter.type = "audio";
          break;
      }

      const [entries, callStats] = await Promise.all([
        callHistoryService.getCallHistory(filter, 100),
        callHistoryService.getCallStats(),
      ]);

      setHistory(entries);
      setStats(callStats);
    } catch (error) {
      console.error("Error loading call history:", error);
      Alert.alert("Error", "Failed to load call history");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeFilter]);

  // Initial load and filter change
  useEffect(() => {
    setIsLoading(true);
    loadHistory();
  }, [loadHistory]);

  // Mark missed calls as seen when screen opens
  useEffect(() => {
    callHistoryService.markMissedCallsSeen();
  }, []);

  // Pull to refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadHistory();
  }, [loadHistory]);

  // Call from history
  const handleCallFromHistory = useCallback(
    async (entry: CallHistoryEntry, callType?: CallType) => {
      // Check if native calls are available
      if (!areNativeCallsAvailable) {
        Alert.alert(
          "Not Available",
          "Video and audio calls require a development build and are not available on this platform.",
        );
        return;
      }

      const otherParticipant = entry.otherParticipants[0];
      if (!otherParticipant) return;

      const type = callType || entry.type;

      try {
        const callService = await getCallService();
        if (!callService) {
          Alert.alert("Error", "Call service not available");
          return;
        }

        const callId = await callService.startCall({
          conversationId:
            entry.scope === "dm" ? otherParticipant.odId : entry.callId,
          participantIds: [otherParticipant.odId],
          type,
          scope: entry.scope,
        });

        navigation.navigate(type === "video" ? "VideoCall" : "AudioCall", {
          callId,
          isOutgoing: true,
        });
      } catch (error: any) {
        Alert.alert("Error", error.message || "Failed to start call");
      }
    },
    [navigation],
  );

  // Delete single entry
  const handleDeleteEntry = useCallback((callId: string) => {
    Alert.alert("Delete Call", "Are you sure you want to delete this call?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await callHistoryService.deleteCallHistoryEntry(callId);
            setHistory((prev) => prev.filter((e) => e.callId !== callId));
          } catch (error) {
            Alert.alert("Error", "Failed to delete call");
          }
        },
      },
    ]);
  }, []);

  // Delete selected entries
  const handleDeleteSelected = useCallback(() => {
    if (selectedItems.size === 0) return;

    Alert.alert(
      "Delete Calls",
      `Are you sure you want to delete ${selectedItems.size} call(s)?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await callHistoryService.deleteMultipleEntries(
                Array.from(selectedItems),
              );
              setHistory((prev) =>
                prev.filter((e) => !selectedItems.has(e.callId)),
              );
              setSelectedItems(new Set());
              setIsSelectionMode(false);
            } catch (error) {
              Alert.alert("Error", "Failed to delete calls");
            }
          },
        },
      ],
    );
  }, [selectedItems]);

  // Clear all history
  const handleClearAll = useCallback(() => {
    Alert.alert(
      "Clear All History",
      "Are you sure you want to delete all call history? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await callHistoryService.clearAllHistory();
              setHistory([]);
            } catch (error) {
              Alert.alert("Error", "Failed to clear history");
            }
          },
        },
      ],
    );
  }, []);

  // Toggle selection
  const handleToggleSelection = useCallback((callId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(callId)) {
        newSet.delete(callId);
      } else {
        newSet.add(callId);
      }
      return newSet;
    });
  }, []);

  // Long press to enter selection mode
  const handleLongPress = useCallback((callId: string) => {
    setIsSelectionMode(true);
    setSelectedItems(new Set([callId]));
  }, []);

  // Cancel selection mode
  const handleCancelSelection = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedItems(new Set());
  }, []);

  // Render filter chips
  const renderFilters = () => (
    <View style={styles.filterContainer}>
      <FlatList
        horizontal
        data={FILTER_OPTIONS}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              activeFilter === item.key && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter(item.key)}
          >
            <Ionicons
              name={item.icon as any}
              size={16}
              color={activeFilter === item.key ? "#fff" : colors.textSecondary}
            />
            <Text
              style={[
                styles.filterChipText,
                activeFilter === item.key && styles.filterChipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  // Render stats summary
  const renderStats = () => {
    if (!stats) return null;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalCalls}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.missedCalls}</Text>
          <Text style={styles.statLabel}>Missed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {callHistoryService.formatDuration(stats.totalDuration)}
          </Text>
          <Text style={styles.statLabel}>Total Time</Text>
        </View>
      </View>
    );
  };

  // Render call history item
  const renderCallItem = ({ item }: { item: CallHistoryEntry }) => {
    const otherParticipant = item.otherParticipants[0];
    const isSelected = selectedItems.has(item.callId);
    const isMissed = !item.wasAnswered && item.direction === "incoming";

    return (
      <TouchableOpacity
        style={[styles.callItem, isSelected && styles.callItemSelected]}
        onPress={() => {
          if (isSelectionMode) {
            handleToggleSelection(item.callId);
          } else {
            // Navigate to call info or start call
            handleCallFromHistory(item);
          }
        }}
        onLongPress={() => handleLongPress(item.callId)}
        activeOpacity={0.7}
      >
        {/* Selection checkbox */}
        {isSelectionMode && (
          <View style={styles.checkboxContainer}>
            <View
              style={[styles.checkbox, isSelected && styles.checkboxSelected]}
            >
              {isSelected && (
                <Ionicons name="checkmark" size={16} color="#fff" />
              )}
            </View>
          </View>
        )}

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {otherParticipant?.avatarConfig ? (
            <Avatar config={otherParticipant.avatarConfig} size={50} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={24} color={colors.textSecondary} />
            </View>
          )}

          {/* Call type icon overlay */}
          <View style={styles.callTypeOverlay}>
            <Ionicons
              name={item.type === "video" ? "videocam" : "call"}
              size={12}
              color="#fff"
            />
          </View>
        </View>

        {/* Call info */}
        <View style={styles.callInfo}>
          <Text
            style={[styles.callerName, isMissed && styles.missedCallText]}
            numberOfLines={1}
          >
            {item.otherParticipants.length > 1
              ? `${otherParticipant?.displayName} +${item.otherParticipants.length - 1}`
              : otherParticipant?.displayName || "Unknown"}
          </Text>

          <View style={styles.callMeta}>
            {/* Direction arrow */}
            <Ionicons
              name={
                isMissed
                  ? "call-outline"
                  : item.direction === "incoming"
                    ? "arrow-down"
                    : "arrow-up"
              }
              size={14}
              color={isMissed ? colors.error : colors.textSecondary}
            />

            {/* Time */}
            <Text style={styles.callTime}>
              {callHistoryService.formatRelativeTime(item.createdAt)}
            </Text>

            {/* Duration */}
            {item.duration !== null && item.duration > 0 && (
              <>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.callDuration}>
                  {callHistoryService.formatDuration(item.duration)}
                </Text>
              </>
            )}

            {/* Missed badge */}
            {isMissed && (
              <View style={styles.missedBadge}>
                <Text style={styles.missedBadgeText}>Missed</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action buttons */}
        {!isSelectionMode && (
          <View style={styles.actionButtons}>
            {/* Audio call button */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleCallFromHistory(item, "audio")}
            >
              <Ionicons name="call" size={22} color={colors.primary} />
            </TouchableOpacity>

            {/* Video call button */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleCallFromHistory(item, "video")}
            >
              <Ionicons name="videocam" size={22} color={colors.primary} />
            </TouchableOpacity>

            {/* More options */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteEntry(item.callId)}
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="call-outline" size={64} color={colors.textSecondary} />
      <Text style={styles.emptyTitle}>No Calls Yet</Text>
      <Text style={styles.emptySubtitle}>
        {activeFilter === "all"
          ? "Your call history will appear here"
          : `No ${activeFilter} calls found`}
      </Text>
    </View>
  );

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isSelectionMode ? `${selectedItems.size} selected` : "Calls"}
        </Text>

        <View style={styles.headerActions}>
          {isSelectionMode ? (
            <>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleDeleteSelected}
              >
                <Ionicons name="trash" size={22} color={colors.error} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleCancelSelection}
              >
                <Text style={[styles.cancelText, { color: colors.primary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleClearAll}
            >
              <Ionicons
                name="trash-outline"
                size={22}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stats */}
      {renderStats()}

      {/* Filters */}
      {renderFilters()}

      {/* Call list */}
      <FlatList
        data={history}
        keyExtractor={(item) => item.callId}
        renderItem={renderCallItem}
        contentContainerStyle={[
          styles.listContent,
          history.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.text,
    marginLeft: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: "500",
  },

  // Stats
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: theme.colors.border,
  },

  // Filters
  filterContainer: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    marginRight: 8,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.textSecondary,
  },
  filterChipTextActive: {
    color: "#fff",
  },

  // List
  listContent: {
    paddingVertical: 8,
  },
  emptyListContent: {
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 76,
  },

  // Call item
  callItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
  },
  callItemSelected: {
    backgroundColor: theme.colors.primaryContainer,
  },

  // Checkbox
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },

  // Avatar
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  callTypeOverlay: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.colors.background,
  },

  // Call info
  callInfo: {
    flex: 1,
  },
  callerName: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.text,
    marginBottom: 4,
  },
  missedCallText: {
    color: theme.colors.error,
  },
  callMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  callTime: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  metaDot: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  callDuration: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  missedBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: theme.colors.errorContainer,
  },
  missedBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.error,
  },

  // Action buttons
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: theme.colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
  },
});

export default CallHistoryScreen;
