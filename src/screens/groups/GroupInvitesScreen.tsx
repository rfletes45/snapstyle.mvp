/**
 * GroupInvitesScreen
 * Phase 20: Group Chat Invites Management
 *
 * Features:
 * - View pending group invites
 * - Accept or decline invites
 * - Real-time updates
 */

import React, { useState, useEffect } from "react";
import { View, StyleSheet, FlatList, RefreshControl } from "react-native";
import {
  Text,
  Button,
  Appbar,
  Card,
  Snackbar,
  useTheme,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/store/AuthContext";
import {
  subscribeToPendingInvites,
  acceptGroupInvite,
  declineGroupInvite,
} from "@/services/groups";
import { GroupInvite } from "@/types/models";
import { LoadingState, EmptyState } from "@/components/ui";

export default function GroupInvitesScreen({ navigation }: any) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid;

  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  // Subscribe to invites
  useEffect(() => {
    if (!uid) return;

    const unsubscribe = subscribeToPendingInvites(uid, (invitesData) => {
      setInvites(invitesData);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, [uid]);

  // Handle accept
  const handleAccept = async (invite: GroupInvite) => {
    if (!uid || processingId) return;

    setProcessingId(invite.id);

    try {
      await acceptGroupInvite(invite.id, uid);
      setSnackbar({
        visible: true,
        message: `Joined ${invite.groupName}!`,
      });

      // Navigate to the group chat
      setTimeout(() => {
        navigation.navigate("GroupChat", {
          groupId: invite.groupId,
          groupName: invite.groupName,
        });
      }, 500);
    } catch (error: any) {
      console.error("Error accepting invite:", error);
      setSnackbar({
        visible: true,
        message: error.message || "Failed to accept invite",
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Handle decline
  const handleDecline = async (invite: GroupInvite) => {
    if (!uid || processingId) return;

    setProcessingId(invite.id);

    try {
      await declineGroupInvite(invite.id, uid);
      setSnackbar({
        visible: true,
        message: "Invite declined",
      });
    } catch (error: any) {
      console.error("Error declining invite:", error);
      setSnackbar({
        visible: true,
        message: error.message || "Failed to decline invite",
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  // Calculate time remaining
  const getExpiryText = (expiresAt: number) => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return "Expired";

    const days = Math.floor(remaining / 86400000);
    const hours = Math.floor((remaining % 86400000) / 3600000);

    if (days > 0) return `Expires in ${days}d`;
    if (hours > 0) return `Expires in ${hours}h`;
    return "Expires soon";
  };

  // Render invite
  const renderInvite = ({ item }: { item: GroupInvite }) => {
    const isProcessing = processingId === item.id;

    return (
      <Card
        style={[
          styles.inviteCard,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
        mode="contained"
      >
        <Card.Content>
          <View style={styles.inviteHeader}>
            <View
              style={[
                styles.groupIcon,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <MaterialCommunityIcons
                name="account-group"
                size={24}
                color={theme.colors.primary}
              />
            </View>
            <View style={styles.inviteInfo}>
              <Text
                style={[styles.groupName, { color: theme.colors.onSurface }]}
              >
                {item.groupName}
              </Text>
              <Text
                style={[
                  styles.inviteFrom,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Invited by {item.fromDisplayName}
              </Text>
              <Text style={styles.inviteTime}>
                {formatTimeAgo(item.createdAt)} •{" "}
                {getExpiryText(item.expiresAt)}
              </Text>
            </View>
          </View>

          <View style={styles.inviteActions}>
            <Button
              mode="outlined"
              onPress={() => handleDecline(item)}
              disabled={isProcessing}
              loading={isProcessing && processingId === item.id}
              style={styles.declineButton}
              textColor="#888"
            >
              Decline
            </Button>
            <Button
              mode="contained"
              onPress={() => handleAccept(item)}
              disabled={isProcessing}
              loading={isProcessing && processingId === item.id}
              style={styles.acceptButton}
            >
              Accept
            </Button>
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={["bottom"]}
      >
        <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Group Invites" />
        </Appbar.Header>
        <LoadingState message="Loading invites..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["bottom"]}
    >
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Group Invites" />
      </Appbar.Header>

      {invites.length === 0 ? (
        <EmptyState
          icon="email-open-outline"
          title="No Pending Invites"
          subtitle="You don't have any group invites right now"
        />
      ) : (
        <FlatList
          data={invites}
          renderItem={renderInvite}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => setRefreshing(true)}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        />
      )}

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: "" })}
        duration={2000}
        style={styles.snackbar}
      >
        {snackbar.message}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    backgroundColor: "#000",
  },
  listContent: {
    padding: 16,
  },
  inviteCard: {
    backgroundColor: "#1A1A1A",
    marginBottom: 12,
    borderRadius: 16,
  },
  inviteHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
  },
  inviteInfo: {
    flex: 1,
    marginLeft: 12,
  },
  groupName: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  inviteFrom: {
    color: "#CCC",
    fontSize: 13,
    marginTop: 2,
  },
  inviteTime: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  inviteActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  declineButton: {
    borderColor: "#444",
  },
  acceptButton: {
    minWidth: 100,
  },
  snackbar: {
    backgroundColor: "#333",
  },
});
