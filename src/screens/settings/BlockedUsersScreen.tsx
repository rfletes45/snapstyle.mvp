/**
 * Blocked Users Screen
 */

import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { getBlockedUsersWithProfiles, unblockUser } from "@/services/blocking";
import { useAuth } from "@/store/AuthContext";
import type { BlockedUser } from "@/types/models";
import { LIST_PERFORMANCE_PROPS } from "@/utils/listPerformance";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Alert, FlatList, StyleSheet, View } from "react-native";
import { Button, Card, Text, useTheme } from "react-native-paper";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/settings/BlockedUsersScreen");
interface BlockedUserWithProfile extends BlockedUser {
  username?: string;
  displayName?: string;
}

export default function BlockedUsersScreen({ navigation }: any) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [blockedUsers, setBlockedUsers] = useState<BlockedUserWithProfile[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const loadBlockedUsers = async () => {
    if (!uid) return;

    try {
      setLoading(true);
      setError(null);
      const users = await getBlockedUsersWithProfiles(uid);
      setBlockedUsers(users);
    } catch (err) {
      logger.error("Error loading blocked users:", err);
      setError("Couldn't load blocked users");
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadBlockedUsers();
    }, [uid]),
  );

  const handleUnblock = (user: BlockedUserWithProfile) => {
    Alert.alert(
      "Unblock User",
      `Are you sure you want to unblock ${user.username || "this user"}? They will be able to send you friend requests again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: async () => {
            if (!uid) return;
            setUnblockingId(user.blockedUserId);
            const success = await unblockUser(uid, user.blockedUserId);
            setUnblockingId(null);
            if (success) {
              setBlockedUsers((prev) =>
                prev.filter((u) => u.blockedUserId !== user.blockedUserId),
              );
            } else {
              Alert.alert("Error", "Failed to unblock user. Please try again.");
            }
          },
        },
      ],
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const renderBlockedUser = ({ item }: { item: BlockedUserWithProfile }) => (
    <Card style={styles.card}>
      <Card.Content style={styles.cardContent}>
        <View style={styles.userInfo}>
          <Text variant="titleMedium">{item.username || "Unknown User"}</Text>
          {item.displayName && (
            <Text variant="bodySmall" style={styles.displayName}>
              {item.displayName}
            </Text>
          )}
          <Text variant="bodySmall" style={styles.blockedDate}>
            Blocked on {formatDate(item.blockedAt)}
          </Text>
          {item.reason && (
            <Text variant="bodySmall" style={styles.reason}>
              Reason: {item.reason}
            </Text>
          )}
        </View>
        <Button
          mode="outlined"
          onPress={() => handleUnblock(item)}
          loading={unblockingId === item.blockedUserId}
          disabled={unblockingId !== null}
          compact
        >
          Unblock
        </Button>
      </Card.Content>
    </Card>
  );

  if (loading) {
    return <LoadingState message="Loading blocked users..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Something went wrong"
        message={error}
        onRetry={loadBlockedUsers}
      />
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {blockedUsers.length === 0 ? (
        <EmptyState
          icon="account-check-outline"
          title="No Blocked Users"
          subtitle="You haven't blocked anyone yet. When you block someone, they'll appear here."
        />
      ) : (
        <>
          <Text variant="bodyMedium" style={styles.header}>
            {blockedUsers.length} blocked user
            {blockedUsers.length !== 1 ? "s" : ""}
          </Text>
          <FlatList
            data={blockedUsers}
            renderItem={renderBlockedUser}
            keyExtractor={(item) => item.blockedUserId}
            {...LIST_PERFORMANCE_PROPS}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    opacity: 0.7,
  },
  header: {
    padding: 16,
    opacity: 0.7,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    // Uses Paper Card default surface color
  },
  cardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  displayName: {
    opacity: 0.7,
    marginTop: 2,
  },
  blockedDate: {
    opacity: 0.5,
    marginTop: 4,
  },
  reason: {
    opacity: 0.6,
    fontStyle: "italic",
    marginTop: 4,
  },
  separator: {
    height: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    marginBottom: 12,
    textAlign: "center",
  },
  emptyText: {
    textAlign: "center",
    opacity: 0.7,
  },
});
