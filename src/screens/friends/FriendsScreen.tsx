import BlockUserModal from "@/components/BlockUserModal";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import ReportUserModal from "@/components/ReportUserModal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { BorderRadius, Spacing } from "@/constants/theme";
import { blockUser } from "@/services/blocking";
import { getFirestoreInstance } from "@/services/firebase";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  getFriends,
  getPendingRequests,
  getUserProfileByUid,
  removeFriend,
  sendFriendRequest,
} from "@/services/friends";
import { submitReport } from "@/services/reporting";
import { useAuth } from "@/store/AuthContext";
import { useInAppNotifications } from "@/store/InAppNotificationsContext";
import { useUser } from "@/store/UserContext";
import { AvatarConfig, Friend, FriendRequest, ReportReason } from "@/types/models";
import { useFocusEffect } from "@react-navigation/native";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  Chip,
  IconButton,
  Menu,
  Searchbar,
  Text,
  useTheme,
} from "react-native-paper";

import { createLogger } from "@/utils/log";
const logger = createLogger("screens/friends/FriendsScreen");
interface RequestWithUsername extends FriendRequest {
  otherUserUsername?: string;
  otherUserProfile?: {
    username: string;
    displayName: string;
    avatarConfig: AvatarConfig;
    profilePictureUrl?: string | null;
    decorationId?: string | null;
  };
}

interface FriendWithProfile extends Friend {
  otherUserProfile?: {
    username: string;
    displayName: string;
    avatarConfig: AvatarConfig;
    profilePictureUrl?: string | null;
    decorationId?: string | null;
  };
}

export default function FriendsScreen({ navigation }: any) {
  const { currentFirebaseUser } = useAuth();
  useUser(); // Ensure user context is available
  const { setCurrentScreen } = useInAppNotifications();
  const uid = currentFirebaseUser?.uid;
  const theme = useTheme();

  // Suppress friend request notifications while on this screen
  useFocusEffect(
    useCallback(() => {
      setCurrentScreen("Connections");
      return () => setCurrentScreen(null);
    }, [setCurrentScreen]),
  );

  // State management
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RequestWithUsername[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [addFriendUsername, setAddFriendUsername] = useState("");
  const [addFriendLoading, setAddFriendLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Block/Report state
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    uid: string;
    username: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!uid) return;

    try {
      setLoading(true);
      setError(null);
      const [friendsData, requestsData] = await Promise.all([
        getFriends(uid),
        getPendingRequests(uid),
      ]);

      // Fetch user profiles for each request (especially for received requests)
      const requestsWithProfiles = await Promise.all(
        requestsData.map(async (request) => {
          // Determine whose profile to fetch (the other person in the request)
          const otherUserId = request.from === uid ? request.to : request.from;
          const profile = await getUserProfileByUid(otherUserId);
          return {
            ...request,
            otherUserUsername: profile?.username,
            otherUserProfile: profile
              ? {
                  username: profile.username,
                  displayName: profile.displayName,
                  avatarConfig: profile.avatarConfig,
                  profilePictureUrl: profile.profilePicture?.url ?? null,
                  decorationId: profile.avatarDecoration?.decorationId ?? null,
                }
              : undefined,
          };
        }),
      );

      // Fetch user profiles for friends
      const friendsWithProfiles = await Promise.all(
        friendsData.map(async (friend) => {
          const friendUid = friend.users.find((u) => u !== uid);
          if (!friendUid) return friend;

          const profile = await getUserProfileByUid(friendUid);
          return {
            ...friend,
            otherUserProfile: profile
              ? {
                  username: profile.username,
                  displayName: profile.displayName,
                  avatarConfig: profile.avatarConfig,
                  profilePictureUrl: profile.profilePicture?.url ?? null,
                  decorationId: profile.avatarDecoration?.decorationId ?? null,
                }
              : undefined,
          };
        }),
      );

      setFriends(friendsWithProfiles);
      setPendingRequests(requestsWithProfiles);
    } catch (err) {
      logger.error("Error loading connections data:", err);
      setError("Couldn't load connections");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  // Load friends and requests with real-time updates
  useEffect(() => {
    if (!uid) return;

    // Initial load
    loadData();

    // Set up real-time listener for Friends collection
    const db = getFirestoreInstance();
    const friendsRef = collection(db, "Friends");
    const friendsQuery = query(
      friendsRef,
      where("users", "array-contains", uid),
    );

    const unsubscribeFriends = onSnapshot(
      friendsQuery,
      async (snapshot) => {
        logger.info("🔵 [FriendsScreen] Real-time friends update received");

        // Get blocked users list
        const blockedUsersRef = collection(db, "Users", uid, "blockedUsers");
        const blockedSnapshot = await getDocs(blockedUsersRef);
        const blockedUserIds = new Set(
          blockedSnapshot.docs.map((doc) => doc.id),
        );

        // Process friends data
        const friendsData: Friend[] = [];
        snapshot.forEach((doc) => {
          const friend = {
            id: doc.id,
            ...doc.data(),
          } as Friend;

          // Get the other user's ID
          const otherUserId = friend.users.find((u) => u !== uid);

          // Only include if the other user is not blocked
          if (otherUserId && !blockedUserIds.has(otherUserId)) {
            friendsData.push(friend);
          }
        });

        // Sort by creation date
        friendsData.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        // Fetch user profiles for friends
        const friendsWithProfiles = await Promise.all(
          friendsData.map(async (friend) => {
            const friendUid = friend.users.find((u) => u !== uid);
            if (!friendUid) return friend;

            const profile = await getUserProfileByUid(friendUid);
            return {
              ...friend,
              otherUserProfile: profile
                ? {
                    username: profile.username,
                    displayName: profile.displayName,
                    avatarConfig: profile.avatarConfig,
                  }
                : undefined,
            };
          }),
        );

        setFriends(friendsWithProfiles);
      },
      (error) => {
        logger.error("Error in friends listener:", error);
      },
    );

    // Set up real-time listener for FriendRequests
    const requestsRef = collection(db, "FriendRequests");

    // Query for requests TO the user
    const toQuery = query(
      requestsRef,
      where("to", "==", uid),
      where("status", "==", "pending"),
    );

    // Query for requests FROM the user
    const fromQuery = query(
      requestsRef,
      where("from", "==", uid),
      where("status", "==", "pending"),
    );

    const unsubscribeRequestsTo = onSnapshot(
      toQuery,
      async () => {
        logger.info("🔵 [FriendsScreen] Real-time requests update received");
        // Reload all requests when any change happens
        const requestsData = await getPendingRequests(uid);

        // Fetch user profiles for each request
        const requestsWithProfiles = await Promise.all(
          requestsData.map(async (request) => {
            const otherUserId =
              request.from === uid ? request.to : request.from;
            const profile = await getUserProfileByUid(otherUserId);
            return {
              ...request,
              otherUserUsername: profile?.username,
              otherUserProfile: profile
                ? {
                    username: profile.username,
                    displayName: profile.displayName,
                    avatarConfig: profile.avatarConfig,
                  }
                : undefined,
            };
          }),
        );

        setPendingRequests(requestsWithProfiles);
      },
      (error) => {
        logger.error("Error in requests (to) listener:", error);
      },
    );

    const unsubscribeRequestsFrom = onSnapshot(
      fromQuery,
      async () => {
        logger.info("🔵 [FriendsScreen] Real-time requests update received");
        // Reload all requests when any change happens
        const requestsData = await getPendingRequests(uid);

        // Fetch user profiles for each request
        const requestsWithProfiles = await Promise.all(
          requestsData.map(async (request) => {
            const otherUserId =
              request.from === uid ? request.to : request.from;
            const profile = await getUserProfileByUid(otherUserId);
            return {
              ...request,
              otherUserUsername: profile?.username,
              otherUserProfile: profile
                ? {
                    username: profile.username,
                    displayName: profile.displayName,
                    avatarConfig: profile.avatarConfig,
                  }
                : undefined,
            };
          }),
        );

        setPendingRequests(requestsWithProfiles);
      },
      (error) => {
        logger.error("Error in requests (from) listener:", error);
      },
    );

    // Cleanup listeners on unmount
    return () => {
      unsubscribeFriends();
      unsubscribeRequestsTo();
      unsubscribeRequestsFrom();
    };
  }, [uid]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleAddFriend = useCallback(async () => {
    if (!uid || !addFriendUsername.trim()) {
      Alert.alert("Error", "Please enter a username");
      return;
    }

    try {
      setAddFriendLoading(true);
      await sendFriendRequest(uid, addFriendUsername.trim());
      Alert.alert("Success", "Connection request sent!");
      setAddFriendUsername("");
      setAddFriendModalVisible(false);
      await loadData();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "Failed to send connection request",
      );
    } finally {
      setAddFriendLoading(false);
    }
  }, [uid, addFriendUsername, loadData]);

  const handleAcceptRequest = useCallback(async (requestId: string) => {
    try {
      await acceptFriendRequest(requestId);
      Alert.alert("Success", "Connection request accepted!");
      await loadData();
    } catch {
      Alert.alert("Error", "Failed to accept request");
    }
  }, [loadData]);

  const handleDeclineRequest = useCallback(async (requestId: string) => {
    try {
      await declineFriendRequest(requestId);
      Alert.alert("Success", "Connection request declined");
      await loadData();
    } catch {
      Alert.alert("Error", "Failed to decline request");
    }
  }, [loadData]);

  const handleCancelRequest = useCallback(async (requestId: string) => {
    try {
      await cancelFriendRequest(requestId);
      Alert.alert("Success", "Connection request canceled");
      await loadData();
    } catch {
      Alert.alert("Error", "Failed to cancel request");
    }
  }, [loadData]);

  const handleRemoveFriend = useCallback(async (friendUid: string) => {
    if (!uid) return;

    // Confirm removal using Alert (works on both native and web)
    Alert.alert(
      "Remove Connection",
      "Are you sure you want to remove this connection?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await removeFriend(uid, friendUid);
              await loadData();
              Alert.alert("Success", "Connection removed");
            } catch {
              Alert.alert("Error", "Failed to remove connection");
            }
          },
        },
      ],
    );
  }, [uid, loadData]);

  // Block/Report handlers
  const handleOpenMenu = useCallback((userId: string) => {
    setMenuVisible(userId);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuVisible(null);
  }, []);

  const handleBlockPress = useCallback((userId: string, username: string) => {
    handleCloseMenu();
    setSelectedUser({ uid: userId, username });
    setBlockModalVisible(true);
  }, []);

  const handleReportPress = useCallback((userId: string, username: string) => {
    handleCloseMenu();
    setSelectedUser({ uid: userId, username });
    setReportModalVisible(true);
  }, []);

  const handleBlockConfirm = async (reason?: string) => {
    if (!uid || !selectedUser) return;

    try {
      await blockUser(uid, selectedUser.uid, reason);
      setBlockModalVisible(false);
      setSelectedUser(null);
      Alert.alert("User Blocked", `${selectedUser.username} has been blocked.`);
      await loadData(); // Refresh to remove blocked user from list
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to block user");
    }
  };

  const handleReportComplete = () => {
    setReportModalVisible(false);
    setSelectedUser(null);
  };

  const handleReportSubmit = async (
    reason: ReportReason,
    description?: string,
  ) => {
    if (!uid || !selectedUser) return;

    try {
      await submitReport(uid, selectedUser.uid, reason, {
        description,
        relatedContent: { type: "profile" },
      });
      Alert.alert(
        "Report Submitted",
        "Thank you for helping keep our community safe.",
      );
      handleReportComplete();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit report");
    }
  };

  if (loading) {
    return <LoadingState message="Loading connections..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Something went wrong"
        message={error}
        onRetry={loadData}
      />
    );
  }

  // Separate pending requests
  const receivedRequests = pendingRequests.filter((r) => r.to === uid);
  const sentRequests = pendingRequests.filter((r) => r.from === uid);

  // Filter friends and requests by search query
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredFriends = useMemo(() => {
    if (!normalizedQuery) return friends;
    return friends.filter((f) => {
      const name = f.otherUserProfile?.username?.toLowerCase() || "";
      const display = f.otherUserProfile?.displayName?.toLowerCase() || "";
      return (
        name.includes(normalizedQuery) || display.includes(normalizedQuery)
      );
    });
  }, [friends, normalizedQuery]);

  const filteredReceivedRequests = useMemo(() => {
    if (!normalizedQuery) return receivedRequests;
    return receivedRequests.filter((r) => {
      const name = r.otherUserProfile?.username?.toLowerCase() || "";
      const display = r.otherUserProfile?.displayName?.toLowerCase() || "";
      return (
        name.includes(normalizedQuery) || display.includes(normalizedQuery)
      );
    });
  }, [receivedRequests, normalizedQuery]);

  const filteredSentRequests = useMemo(() => {
    if (!normalizedQuery) return sentRequests;
    return sentRequests.filter((r) => {
      const name = (
        r.otherUserUsername ||
        r.otherUserProfile?.username ||
        ""
      ).toLowerCase();
      return name.includes(normalizedQuery);
    });
  }, [sentRequests, normalizedQuery]);

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Header with Add Connection Button */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.outlineVariant,
          },
        ]}
      >
        <Text
          variant="headlineSmall"
          style={[styles.title, { color: theme.colors.onSurface }]}
        >
          Connections
        </Text>
        <Button
          mode="contained"
          onPress={() => setAddFriendModalVisible(true)}
          style={styles.addButton}
        >
          Add Connection
        </Button>
      </View>

      {/* Search Bar */}
      <Searchbar
        placeholder="Search connections..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={[styles.searchbar, { backgroundColor: theme.colors.surface }]}
      />

      {/* Main Content */}
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View>
            {/* Received Requests Section */}
            {filteredReceivedRequests.length > 0 && (
              <View style={styles.section}>
                <Text
                  variant="titleMedium"
                  style={[
                    styles.sectionTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Connection Requests ({filteredReceivedRequests.length})
                </Text>
                {filteredReceivedRequests.map((request) => (
                  <Card
                    key={request.id}
                    style={[
                      styles.requestCard,
                      {
                        backgroundColor: theme.colors.tertiaryContainer,
                        borderLeftColor: theme.colors.tertiary,
                      },
                    ]}
                  >
                    <Card.Content style={styles.cardContent}>
                      <View style={styles.requestHeader}>
                        <ProfilePictureWithDecoration
                          pictureUrl={
                            request.otherUserProfile?.profilePictureUrl
                          }
                          name={request.otherUserProfile?.displayName || "?"}
                          decorationId={request.otherUserProfile?.decorationId}
                          size={44}
                        />
                        <View style={styles.requestInfo}>
                          <Text
                            variant="bodyMedium"
                            style={[
                              styles.requestUsername,
                              { color: theme.colors.onSurface },
                            ]}
                          >
                            {request.otherUserProfile?.username || "Loading..."}
                          </Text>
                          <Text
                            variant="bodySmall"
                            style={[
                              styles.requestSubtitle,
                              { color: theme.colors.onSurfaceVariant },
                            ]}
                          >
                            Connection Request
                          </Text>
                        </View>
                      </View>
                      <View style={styles.requestActions}>
                        <Button
                          mode="contained"
                          onPress={() => handleAcceptRequest(request.id)}
                          style={styles.acceptButton}
                          labelStyle={styles.buttonLabel}
                        >
                          Accept
                        </Button>
                        <Button
                          mode="outlined"
                          onPress={() => handleDeclineRequest(request.id)}
                          style={styles.declineButton}
                          labelStyle={styles.buttonLabel}
                        >
                          Decline
                        </Button>
                      </View>
                    </Card.Content>
                  </Card>
                ))}
              </View>
            )}

            {/* Connections List Section */}
            {filteredFriends.length > 0 ? (
              <View style={styles.section}>
                <Text
                  variant="titleMedium"
                  style={[
                    styles.sectionTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Connections ({filteredFriends.length})
                </Text>
                {filteredFriends.map((friend) => {
                  const friendUid = friend.users.find((u) => u !== uid);
                  const streakCount = friend.streakCount || 0;

                  return (
                    <Card
                      key={friend.id}
                      style={[
                        styles.friendCard,
                        {
                          backgroundColor: theme.colors.secondaryContainer,
                          borderLeftColor: theme.colors.primary,
                        },
                      ]}
                    >
                      <Card.Content style={styles.cardContent}>
                        <View style={styles.friendHeader}>
                          <View style={styles.friendInfo}>
                            <ProfilePictureWithDecoration
                              pictureUrl={
                                friend.otherUserProfile?.profilePictureUrl
                              }
                              name={friend.otherUserProfile?.displayName || "?"}
                              decorationId={
                                friend.otherUserProfile?.decorationId
                              }
                              size={44}
                            />
                            <View style={styles.nameContainer}>
                              <Text
                                variant="bodyMedium"
                                style={[
                                  styles.friendName,
                                  { color: theme.colors.onSurface },
                                ]}
                              >
                                {friend.otherUserProfile?.username ||
                                  "Loading..."}
                              </Text>
                              {streakCount > 0 && (
                                <Chip
                                  style={[
                                    styles.streakChip,
                                    { backgroundColor: theme.colors.error },
                                  ]}
                                  textStyle={[
                                    styles.streakText,
                                    { color: theme.colors.onError },
                                  ]}
                                  icon="fire"
                                  compact
                                >
                                  {streakCount}
                                </Chip>
                              )}
                            </View>
                          </View>
                          <View style={styles.buttonGroup}>
                            <Button
                              mode="contained"
                              onPress={() => {
                                if (friendUid) {
                                  navigation.navigate("Chats", {
                                    screen: "ChatDetail",
                                    params: { friendUid },
                                  });
                                }
                              }}
                              compact
                              style={styles.messageButton}
                            >
                              Message
                            </Button>
                            <Menu
                              visible={menuVisible === friendUid}
                              onDismiss={handleCloseMenu}
                              anchor={
                                <IconButton
                                  icon="dots-vertical"
                                  size={24}
                                  onPress={() =>
                                    friendUid && handleOpenMenu(friendUid)
                                  }
                                />
                              }
                              contentStyle={{
                                backgroundColor: theme.colors.surface,
                              }}
                            >
                              <Menu.Item
                                onPress={() => {
                                  if (friendUid) {
                                    handleRemoveFriend(friendUid);
                                    handleCloseMenu();
                                  }
                                }}
                                title="Remove Connection"
                                leadingIcon="account-remove"
                              />
                              <Menu.Item
                                onPress={() => {
                                  if (friendUid) {
                                    handleBlockPress(
                                      friendUid,
                                      friend.otherUserProfile?.username ||
                                        "User",
                                    );
                                  }
                                }}
                                title="Block User"
                                leadingIcon="block-helper"
                              />
                              <Menu.Item
                                onPress={() => {
                                  if (friendUid) {
                                    handleReportPress(
                                      friendUid,
                                      friend.otherUserProfile?.username ||
                                        "User",
                                    );
                                  }
                                }}
                                title="Report User"
                                leadingIcon="flag"
                              />
                            </Menu>
                          </View>
                        </View>
                      </Card.Content>
                    </Card>
                  );
                })}
              </View>
            ) : (
              <EmptyState
                icon="account-group-outline"
                title="No connections yet"
                subtitle="Connect with others to start chatting and build rituals together!"
                actionLabel="Add Connection"
                onAction={() => setAddFriendModalVisible(true)}
              />
            )}

            {/* Sent Requests Section */}
            {filteredSentRequests.length > 0 && (
              <View style={styles.section}>
                <Text
                  variant="titleMedium"
                  style={[
                    styles.sectionTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Sent Requests ({filteredSentRequests.length})
                </Text>
                {filteredSentRequests.map((request) => (
                  <Card
                    key={request.id}
                    style={[
                      styles.sentRequestCard,
                      { backgroundColor: theme.colors.surfaceVariant },
                    ]}
                  >
                    <Card.Content style={styles.cardContent}>
                      <View style={styles.sentRequestHeader}>
                        <ProfilePictureWithDecoration
                          pictureUrl={
                            request.otherUserProfile?.profilePictureUrl
                          }
                          name={request.otherUserProfile?.displayName || "?"}
                          decorationId={request.otherUserProfile?.decorationId}
                          size={44}
                        />
                        <View style={styles.sentRequestInfo}>
                          <View
                            style={styles.sentRequestRow}
                          >
                            <Text
                              variant="bodySmall"
                              style={[
                                styles.sentRequestText,
                                { color: theme.colors.onSurface },
                              ]}
                            >
                              {request.otherUserUsername || "Loading..."}
                            </Text>
                            <Text style={styles.pendingEmoji}>⏳</Text>
                          </View>
                          <Text
                            variant="labelSmall"
                            style={[
                              styles.sentRequestSubtext,
                              { color: theme.colors.onSurfaceVariant },
                            ]}
                          >
                            Pending Request
                          </Text>
                        </View>
                        <Button
                          mode="text"
                          onPress={() => handleCancelRequest(request.id)}
                          compact
                        >
                          Cancel
                        </Button>
                      </View>
                    </Card.Content>
                  </Card>
                ))}
              </View>
            )}
          </View>
        }
      </ScrollView>

      {/* Add Connection Modal */}
      <Modal
        visible={addFriendModalVisible}
        onRequestClose={() => setAddFriendModalVisible(false)}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <View style={styles.modalInner}>
              <Text
                variant="headlineSmall"
                style={[styles.modalTitle, { color: theme.colors.onSurface }]}
              >
                Add Connection
              </Text>
              <Text
                variant="bodySmall"
                style={[
                  styles.modalSubtitle,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Enter their username
              </Text>

              <Searchbar
                placeholder="Username..."
                value={addFriendUsername}
                onChangeText={setAddFriendUsername}
                style={styles.modalInput}
                editable={!addFriendLoading}
              />

              <View style={styles.modalActions}>
                <Button
                  mode="text"
                  onPress={() => setAddFriendModalVisible(false)}
                  disabled={addFriendLoading}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleAddFriend}
                  loading={addFriendLoading}
                  disabled={addFriendLoading || !addFriendUsername.trim()}
                >
                  Send Request
                </Button>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Block User Modal */}
      <BlockUserModal
        visible={blockModalVisible}
        username={selectedUser?.username || ""}
        onCancel={() => {
          setBlockModalVisible(false);
          setSelectedUser(null);
        }}
        onConfirm={handleBlockConfirm}
      />

      {/* Report User Modal */}
      {selectedUser && (
        <ReportUserModal
          visible={reportModalVisible}
          username={selectedUser.username}
          onSubmit={handleReportSubmit}
          onCancel={handleReportComplete}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: Spacing.md,
  },

  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    fontWeight: "600",
  },

  addButton: {
    borderRadius: BorderRadius.full,
  },

  searchbar: {
    margin: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
  },

  section: {
    paddingHorizontal: Spacing.md,
    marginVertical: Spacing.md,
  },

  sectionTitle: {
    fontWeight: "600",
    marginBottom: Spacing.md,
  },

  requestCard: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 4,
    // borderLeftColor set dynamically with theme
  },

  friendCard: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 4,
    // borderLeftColor set dynamically with theme
  },

  sentRequestCard: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    opacity: 0.7,
  },

  cardContent: {
    padding: Spacing.md,
  },

  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },

  avatarText: {
    fontSize: 20,
    fontWeight: "bold",
  },

  requestInfo: {
    flex: 1,
  },

  requestUsername: {
    fontWeight: "600",
    marginBottom: 2,
  },

  requestSubtitle: {
    // Color applied inline
  },

  requestActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },

  acceptButton: {
    flex: 1,
  },

  declineButton: {
    flex: 1,
  },

  buttonLabel: {
    fontSize: 11,
  },

  friendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  friendInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  nameContainer: {
    flex: 1,
  },

  friendName: {
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },

  streakChip: {
    alignSelf: "flex-start",
  },

  streakText: {
    fontSize: 10,
  },

  buttonGroup: {
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
  },

  messageButton: {
    marginRight: Spacing.xs,
  },

  sentRequestHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sentRequestRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  pendingEmoji: {
    fontSize: 18,
  },

  sentRequestInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },

  sentRequestText: {
    fontWeight: "600",
    marginBottom: 2,
  },

  sentRequestSubtext: {
    // Color applied inline
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl * 2,
  },

  emptyText: {
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },

  emptySubtext: {
    // Color applied inline
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalContent: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    width: "85%",
    minHeight: 250,
  },

  modalInner: {
    flex: 1,
    justifyContent: "center",
  },

  modalTitle: {
    fontWeight: "600",
    marginBottom: Spacing.sm,
    textAlign: "center",
  },

  modalSubtitle: {
    marginBottom: Spacing.md,
    textAlign: "center",
  },

  modalInput: {
    marginBottom: Spacing.lg,
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
  },
});
