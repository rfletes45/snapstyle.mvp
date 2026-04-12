/**
 * CallsScreen — Top-level Calls tab
 *
 * Combines:
 * A. Active Rooms section — live voice rooms across user's groups
 * B. Call History section — past calls and voice room sessions
 *
 * Uses Stream live data for active rooms and Firestore for durable history.
 */

import {
  FilterChips,
  type FilterChipOption,
} from "@/components/shared/FilterChips";
import ActiveRoomCard from "@/components/stream/ActiveRoomCard";
import CallHistoryRow from "@/components/stream/CallHistoryRow";
import { CALL_FEATURES } from "@/constants/featureFlags";
import type { ActiveVoiceRoom } from "@/hooks/useActiveVoiceRooms";
import { useActiveVoiceRooms } from "@/hooks/useActiveVoiceRooms";
import { useStreamCallHistory } from "@/hooks/useStreamCallHistory";
import { prepareGroupChatNavigation } from "@/services/chat/threadIdentityWarmup";
import { useAppTheme } from "@/store/ThemeContext";
import type { MainStackParamList } from "@/types/navigation/root";
import type {
  CallHistoryFilterType,
  StreamCallHistoryEntry,
} from "@/types/streamCallHistory";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Filter chips
// ---------------------------------------------------------------------------

const FILTER_OPTIONS: FilterChipOption<CallHistoryFilterType>[] = [
  { key: "all", label: "All" },
  { key: "missed", label: "Missed" },
  { key: "direct", label: "Direct" },
  { key: "rooms", label: "Rooms" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CallsScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  const [activeFilter, setActiveFilter] =
    useState<CallHistoryFilterType>("all");
  const {
    rooms,
    loading: roomsLoading,
    refresh: refreshRooms,
  } = useActiveVoiceRooms();
  const {
    entries,
    loading: historyLoading,
    error: historyError,
    errorMessage: historyErrorMessage,
    refresh: refreshHistory,
  } = useStreamCallHistory(activeFilter);

  const [refreshing, setRefreshing] = useState(false);

  const callsEnabled = CALL_FEATURES.CALLS_ENABLED;

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshRooms(), refreshHistory()]);
    setRefreshing(false);
  }, [refreshRooms, refreshHistory]);

  // Join an active voice room
  const handleJoinRoom = useCallback(
    (room: ActiveVoiceRoom) => {
      navigation.navigate("VoiceChannel", {
        channelId: room.channelId,
        channelName: `${room.groupName} Voice`,
        groupId: room.groupId,
      });
    },
    [navigation],
  );

  // Tap a history row
  const handleHistoryPress = useCallback(
    (entry: StreamCallHistoryEntry) => {
      if (entry.entryType === "voice_room" && entry.groupId) {
        // Navigate to the group chat (user can join from there)
        void (async () => {
          const navParams = await prepareGroupChatNavigation({
            groupId: entry.groupId!,
            groupName: entry.groupName ?? undefined,
            groupAvatarUrl: entry.groupAvatar ?? null,
          });
          navigation.navigate("GroupChat", navParams);
        })();
      } else if (entry.otherUserId) {
        // Navigate to the DM / user profile
        navigation.navigate("ChatDetail", {
          friendUid: entry.otherUserId,
          friendName: entry.otherUserName ?? undefined,
        });
      }
    },
    [navigation],
  );

  // Navigate to settings
  const handleSettings = useCallback(() => {
    navigation.navigate("CallSettings");
  }, [navigation]);

  // Active rooms section header + cards
  const activeRoomsSection = useMemo(() => {
    if (!callsEnabled || (rooms.length === 0 && !roomsLoading)) return null;

    return (
      <View>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Active Rooms
          </Text>
          {roomsLoading && rooms.length === 0 && (
            <ActivityIndicator size="small" color={colors.primary} />
          )}
        </View>

        {rooms.length === 0 && roomsLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Checking voice rooms…
            </Text>
          </View>
        ) : (
          rooms.map((room) => (
            <ActiveRoomCard
              key={room.groupId}
              room={room}
              onJoin={handleJoinRoom}
            />
          ))
        )}

        {/* Separator */}
        <View
          style={[styles.sectionDivider, { borderBottomColor: colors.border }]}
        />
      </View>
    );
  }, [callsEnabled, rooms, roomsLoading, colors, handleJoinRoom]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Disabled state — native call modules are not available in this build
  if (!callsEnabled) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[styles.header, { paddingTop: Math.max(insets.top, 8) + 8 }]}
        >
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Calls
          </Text>
        </View>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="phone-outline"
            size={48}
            color={colors.textMuted}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Calls Coming Soon
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Audio and video calling is not available in this build.{"\n"}
            Check back for updates!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            borderBottomColor: colors.border,
            paddingTop: Math.max(insets.top, 8) + 8,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.text }]}>Calls</Text>
        <TouchableOpacity
          onPress={handleSettings}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons
            name="cog-outline"
            size={22}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Filter chips — uses shared component matching Messages screen */}
      <FilterChips
        options={FILTER_OPTIONS}
        activeKey={activeFilter}
        onSelect={setActiveFilter}
      />

      {/* Content */}
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CallHistoryRow entry={item} onPress={handleHistoryPress} />
        )}
        ListHeaderComponent={activeRoomsSection}
        ListEmptyComponent={
          historyLoading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : historyError ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={48}
                color={colors.error}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Couldn&apos;t load history
              </Text>
              <Text
                style={[styles.emptySubtitle, { color: colors.textSecondary }]}
              >
                {historyErrorMessage || "Pull down to try again."}
              </Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name={
                  activeFilter === "missed"
                    ? "phone-missed"
                    : activeFilter === "rooms"
                      ? "account-group"
                      : "phone-outline"
                }
                size={48}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {activeFilter === "missed"
                  ? "No missed calls"
                  : activeFilter === "direct"
                    ? "No direct calls yet"
                    : activeFilter === "rooms"
                      ? "No voice room sessions"
                      : "No call history"}
              </Text>
              <Text
                style={[styles.emptySubtitle, { color: colors.textSecondary }]}
              >
                {activeFilter === "all"
                  ? "Your calls and voice room sessions will appear here."
                  : "Nothing to show for this filter."}
              </Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={
          entries.length === 0 ? styles.emptyList : undefined
        }
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyList: {
    flexGrow: 1,
  },
});
