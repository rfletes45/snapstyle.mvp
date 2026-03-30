/**
 * CallHistoryScreen - Display recent calls with filtering and actions
 *
 * Uses the Stream-based call history system (Users/{uid}/StreamCallHistory).
 * Supports filtering, deletion, and redial.
 */

import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
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

import { useStreamCall } from "@/contexts/StreamCallContext";
import { useStreamCallHistory } from "@/hooks/useStreamCallHistory";
import {
  clearAllStreamCallHistory,
  deleteCallHistoryEntry,
} from "@/services/stream/streamCallHistoryService";
import { useAppTheme } from "@/store/ThemeContext";
import type {
  CallHistoryFilterType,
  StreamCallHistoryEntry,
} from "@/types/streamCallHistory";
import { formatDurationFull } from "@/utils/time";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/calls/CallHistoryScreen");

// Map UI filter keys to StreamCallHistory filter types
type FilterOption = "all" | "missed" | "direct" | "rooms";

const FILTER_OPTIONS: { key: FilterOption; label: string; icon: string }[] = [
  { key: "all", label: "All", icon: "list" },
  { key: "missed", label: "Missed", icon: "call-outline" },
  { key: "direct", label: "Direct", icon: "call" },
  { key: "rooms", label: "Rooms", icon: "people" },
];

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function CallHistoryScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { startCall } = useStreamCall();

  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Real-time call history from Firestore
  const {
    entries,
    loading: isLoading,
    error,
    errorMessage,
    refresh,
  } = useStreamCallHistory(activeFilter as CallHistoryFilterType, 100);

  // Compute stats from current entries
  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const totalCalls = entries.length;
    const missedCalls = entries.filter((e) => e.result === "missed").length;
    const totalDuration = entries.reduce(
      (sum, e) => sum + (e.durationSeconds ?? 0),
      0,
    );
    return { totalCalls, missedCalls, totalDuration };
  }, [entries]);

  // Call from history (Stream-powered)
  const handleCallFromHistory = useCallback(
    async (entry: StreamCallHistoryEntry, forceMode?: "audio" | "video") => {
      if (!entry.otherUserId) return;

      const mode =
        forceMode ?? (entry.entryType === "direct_video" ? "video" : "audio");

      try {
        const callId = await startCall(entry.otherUserId, mode);
        navigation.navigate("DirectCall", {
          callId,
          recipientName: entry.otherUserName || "User",
          mode,
          isOutgoing: true,
        });
      } catch (err: any) {
        Alert.alert(
          "Call Failed",
          err?.message || "Unable to start call. Please try again.",
        );
      }
    },
    [navigation, startCall],
  );

  // Delete single entry
  const handleDeleteEntry = useCallback((entryId: string) => {
    Alert.alert("Delete Call", "Are you sure you want to delete this call?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCallHistoryEntry(entryId);
          } catch (err) {
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
              for (const id of selectedItems) {
                await deleteCallHistoryEntry(id);
              }
              setSelectedItems(new Set());
              setIsSelectionMode(false);
            } catch (err) {
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
              await clearAllStreamCallHistory();
            } catch (err) {
              Alert.alert("Error", "Failed to clear history");
            }
          },
        },
      ],
    );
  }, []);

  // Toggle selection
  const handleToggleSelection = useCallback((entryId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  }, []);

  // Long press to enter selection mode
  const handleLongPress = useCallback((entryId: string) => {
    setIsSelectionMode(true);
    setSelectedItems(new Set([entryId]));
  }, []);

  // Cancel selection mode
  const handleCancelSelection = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedItems(new Set());
  }, []);

  // Render filter chips
  const renderFilters = () => (
    <View
      style={[
        styles.filterContainer,
        { backgroundColor: colors.surface, borderBottomColor: colors.border },
      ]}
    >
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
              { backgroundColor: colors.background },
              activeFilter === item.key && { backgroundColor: colors.primary },
            ]}
            onPress={() => setActiveFilter(item.key)}
          >
            <Ionicons
              name={item.icon as keyof typeof Ionicons.glyphMap}
              size={16}
              color={activeFilter === item.key ? "#fff" : colors.textSecondary}
            />
            <Text
              style={[
                styles.filterChipText,
                { color: colors.textSecondary },
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
      <View
        style={[
          styles.statsContainer,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {stats.totalCalls}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Total
          </Text>
        </View>
        <View
          style={[styles.statDivider, { backgroundColor: colors.border }]}
        />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {stats.missedCalls}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Missed
          </Text>
        </View>
        <View
          style={[styles.statDivider, { backgroundColor: colors.border }]}
        />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatDurationFull(stats.totalDuration)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Total Time
          </Text>
        </View>
      </View>
    );
  };

  // Render call history item
  const renderCallItem = ({ item }: { item: StreamCallHistoryEntry }) => {
    const isSelected = selectedItems.has(item.id);
    const isMissed = item.result === "missed";
    const isVoiceRoom = item.entryType === "voice_room";
    const displayName = isVoiceRoom
      ? item.groupName || "Voice Room"
      : item.otherUserName || "Unknown";
    const isVideo = item.entryType === "direct_video";

    return (
      <TouchableOpacity
        style={[
          styles.callItem,
          { backgroundColor: colors.background },
          isSelected && { backgroundColor: colors.primaryContainer },
        ]}
        onPress={() => {
          if (isSelectionMode) {
            handleToggleSelection(item.id);
          } else if (!isVoiceRoom) {
            handleCallFromHistory(item);
          }
        }}
        onLongPress={() => handleLongPress(item.id)}
        activeOpacity={0.7}
      >
        {/* Selection checkbox */}
        {isSelectionMode && (
          <View style={styles.checkboxContainer}>
            <View
              style={[
                styles.checkbox,
                { borderColor: colors.border },
                isSelected && {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                },
              ]}
            >
              {isSelected && (
                <Ionicons name="checkmark" size={16} color="#fff" />
              )}
            </View>
          </View>
        )}

        {/* Avatar placeholder */}
        <View style={styles.avatarContainer}>
          <View
            style={[
              styles.avatarPlaceholder,
              { backgroundColor: colors.surface },
            ]}
          >
            <Ionicons
              name={isVoiceRoom ? "people" : "person"}
              size={24}
              color={colors.textSecondary}
            />
          </View>

          {/* Call type icon overlay */}
          <View
            style={[
              styles.callTypeOverlay,
              {
                backgroundColor: colors.primary,
                borderColor: colors.background,
              },
            ]}
          >
            <Ionicons
              name={isVoiceRoom ? "people" : isVideo ? "videocam" : "call"}
              size={12}
              color="#fff"
            />
          </View>
        </View>

        {/* Call info */}
        <View style={styles.callInfo}>
          <Text
            style={[
              styles.callerName,
              { color: colors.text },
              isMissed && { color: colors.error },
            ]}
            numberOfLines={1}
          >
            {displayName}
          </Text>

          <View style={styles.callMeta}>
            {/* Direction arrow */}
            <Ionicons
              name={
                isMissed
                  ? "call-outline"
                  : item.direction === "incoming"
                    ? "arrow-down"
                    : item.direction === "joined"
                      ? "enter-outline"
                      : "arrow-up"
              }
              size={14}
              color={isMissed ? colors.error : colors.textSecondary}
            />

            {/* Time */}
            <Text style={[styles.callTime, { color: colors.textSecondary }]}>
              {formatRelativeTime(item.createdAt)}
            </Text>

            {/* Duration */}
            {item.durationSeconds != null && item.durationSeconds > 0 && (
              <>
                <Text style={[styles.metaDot, { color: colors.textSecondary }]}>
                  •
                </Text>
                <Text
                  style={[styles.callDuration, { color: colors.textSecondary }]}
                >
                  {formatDurationFull(item.durationSeconds)}
                </Text>
              </>
            )}

            {/* Missed badge */}
            {isMissed && (
              <View
                style={[
                  styles.missedBadge,
                  { backgroundColor: colors.errorContainer },
                ]}
              >
                <Text style={[styles.missedBadgeText, { color: colors.error }]}>
                  Missed
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Action buttons (direct calls only) */}
        {!isSelectionMode && !isVoiceRoom && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleCallFromHistory(item, "audio")}
            >
              <Ionicons name="call" size={22} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleCallFromHistory(item, "video")}
            >
              <Ionicons name="videocam" size={22} color={colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteEntry(item.id)}
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}

        {/* Delete button for voice rooms */}
        {!isSelectionMode && isVoiceRoom && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteEntry(item.id)}
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
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No Calls Yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {activeFilter === "all"
          ? "Your call history will appear here"
          : `No ${activeFilter} calls found`}
      </Text>
    </View>
  );

  // Error state — distinguish permission denied from transient errors
  if (error && !isLoading) {
    const isPermissionError = errorMessage?.includes("permission");
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Calls
          </Text>
          <View style={styles.headerActions} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons
            name={
              isPermissionError
                ? "lock-closed-outline"
                : "cloud-offline-outline"
            }
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {isPermissionError
              ? "Couldn\u2019t load history"
              : "Something went wrong"}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {isPermissionError
              ? "Please sign out and sign in again."
              : "Check your connection and try again."}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={refresh}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderCallItem}
        contentContainerStyle={[
          styles.listContent,
          entries.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
        ItemSeparatorComponent={() => (
          <View
            style={[styles.separator, { backgroundColor: colors.border }]}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
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
    fontWeight: "500",
  },

  // Stats
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
  },

  // Filters
  filterContainer: {
    borderBottomWidth: 1,
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
    marginRight: 8,
    gap: 6,
  },
  filterChipActive: {},
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
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
    marginLeft: 76,
  },

  // Call item
  callItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  callItemSelected: {},

  // Checkbox
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {},

  // Avatar
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },

  // Call info
  callInfo: {
    flex: 1,
  },
  callerName: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  missedCallText: {},
  callMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  callTime: {
    fontSize: 13,
    marginLeft: 4,
  },
  metaDot: {
    fontSize: 13,
  },
  callDuration: {
    fontSize: 13,
  },
  missedBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  missedBadgeText: {
    fontSize: 11,
    fontWeight: "600",
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
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});

export default CallHistoryScreen;
