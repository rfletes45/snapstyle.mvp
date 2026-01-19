import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, View, FlatList, Alert, Modal } from "react-native";
import {
  Text,
  Searchbar,
  Card,
  Button,
  ActivityIndicator,
  Chip,
} from "react-native-paper";
import { useAuth } from "@/store/AuthContext";
import { useUser } from "@/store/UserContext";
import {
  sendFriendRequest,
  getPendingRequests,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  getFriends,
  removeFriend,
  getUsernameByUid,
  getUserProfileByUid,
} from "@/services/friends";
import { Friend, FriendRequest, AvatarConfig } from "@/types/models";

interface RequestWithUsername extends FriendRequest {
  otherUserUsername?: string;
  otherUserProfile?: {
    username: string;
    displayName: string;
    avatarConfig: AvatarConfig;
  };
}

interface FriendWithProfile extends Friend {
  otherUserProfile?: {
    username: string;
    displayName: string;
    avatarConfig: AvatarConfig;
  };
}

export default function FriendsScreen({ navigation }: any) {
  const { currentFirebaseUser } = useAuth();
  useUser(); // Ensure user context is available
  const uid = currentFirebaseUser?.uid;

  // State management
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RequestWithUsername[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [addFriendUsername, setAddFriendUsername] = useState("");
  const [addFriendLoading, setAddFriendLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!uid) return;

    try {
      setLoading(true);
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
                }
              : undefined,
          };
        }),
      );

      setFriends(friendsWithProfiles);
      setPendingRequests(requestsWithProfiles);
    } catch (error) {
      console.error("Error loading friends data:", error);
      Alert.alert("Error", "Failed to load friends. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  // Load friends and requests
  useEffect(() => {
    if (uid) {
      loadData();
    }
  }, [uid, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAddFriend = async () => {
    if (!uid || !addFriendUsername.trim()) {
      Alert.alert("Error", "Please enter a username");
      return;
    }

    try {
      setAddFriendLoading(true);
      await sendFriendRequest(uid, addFriendUsername.trim());
      Alert.alert("Success", "Friend request sent!");
      setAddFriendUsername("");
      setAddFriendModalVisible(false);
      await loadData();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to send friend request");
    } finally {
      setAddFriendLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await acceptFriendRequest(requestId);
      Alert.alert("Success", "Friend request accepted!");
      await loadData();
    } catch {
      Alert.alert("Error", "Failed to accept request");
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await declineFriendRequest(requestId);
      Alert.alert("Success", "Friend request declined");
      await loadData();
    } catch {
      Alert.alert("Error", "Failed to decline request");
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      await cancelFriendRequest(requestId);
      Alert.alert("Success", "Friend request canceled");
      await loadData();
    } catch {
      Alert.alert("Error", "Failed to cancel request");
    }
  };

  const handleRemoveFriend = async (friendUid: string) => {
    if (!uid) return;

    // Confirm removal
    const confirmed = confirm("Are you sure you want to remove this friend?");
    if (!confirmed) return;

    try {
      await removeFriend(uid, friendUid);
      await loadData();
      Alert.alert("Success", "Friend removed");
    } catch (error) {
      Alert.alert("Error", "Failed to remove friend");
    }
  };

  // Get request preview (show username or initials of other user)
  const getRequestUserPreview = (request: FriendRequest) => {
    const otherUid = request.from === uid ? request.to : request.from;
    return otherUid.substring(0, 8).toUpperCase();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator animating={true} size="large" />
        <Text style={styles.loadingText}>Loading friends...</Text>
      </View>
    );
  }

  // Separate pending requests
  const receivedRequests = pendingRequests.filter((r) => r.to === uid);
  const sentRequests = pendingRequests.filter((r) => r.from === uid);

  return (
    <View style={styles.container}>
      {/* Header with Add Friend Button */}
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>
          Friends
        </Text>
        <Button
          mode="contained"
          onPress={() => setAddFriendModalVisible(true)}
          style={styles.addButton}
        >
          Add Friend
        </Button>
      </View>

      {/* Search Bar */}
      <Searchbar
        placeholder="Search friends..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      {/* Main Content */}
      <FlatList
        data={[]}
        renderItem={() => null}
        ListEmptyComponent={
          <View>
            {/* Received Requests Section */}
            {receivedRequests.length > 0 && (
              <View style={styles.section}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Friend Requests ({receivedRequests.length})
                </Text>
                {receivedRequests.map((request) => (
                  <Card key={request.id} style={styles.requestCard}>
                    <Card.Content style={styles.cardContent}>
                      <View style={styles.requestHeader}>
                        <View
                          style={[
                            styles.avatar,
                            {
                              backgroundColor:
                                request.otherUserProfile?.avatarConfig
                                  ?.baseColor || "#6200EE",
                            },
                          ]}
                        >
                          <Text style={styles.avatarText}>
                            {request.otherUserProfile?.username
                              ?.charAt(0)
                              .toUpperCase() || "?"}
                          </Text>
                        </View>
                        <View style={styles.requestInfo}>
                          <Text
                            variant="bodyMedium"
                            style={styles.requestUsername}
                          >
                            {request.otherUserProfile?.username || "Loading..."}
                          </Text>
                          <Text
                            variant="bodySmall"
                            style={styles.requestSubtitle}
                          >
                            Friend Request
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

            {/* Friends List Section */}
            {friends.length > 0 ? (
              <View style={styles.section}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Friends ({friends.length})
                </Text>
                {friends.map((friend) => {
                  const friendUid = friend.users.find((u) => u !== uid);
                  const streakCount = friend.streakCount || 0;

                  return (
                    <Card key={friend.id} style={styles.friendCard}>
                      <Card.Content style={styles.cardContent}>
                        <View style={styles.friendHeader}>
                          <View style={styles.friendInfo}>
                            <View
                              style={[
                                styles.avatar,
                                {
                                  backgroundColor:
                                    friend.otherUserProfile?.avatarConfig
                                      ?.baseColor || "#6200EE",
                                },
                              ]}
                            >
                              <Text style={styles.avatarText}>
                                {friend.otherUserProfile?.username
                                  ?.charAt(0)
                                  .toUpperCase() || "?"}
                              </Text>
                            </View>
                            <View style={styles.nameContainer}>
                              <Text
                                variant="bodyMedium"
                                style={styles.friendName}
                              >
                                {friend.otherUserProfile?.username ||
                                  "Loading..."}
                              </Text>
                              {streakCount > 0 && (
                                <Chip
                                  style={styles.streakChip}
                                  textStyle={styles.streakText}
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
                            <Button
                              mode="text"
                              onPress={() => {
                                if (friendUid) {
                                  handleRemoveFriend(friendUid);
                                }
                              }}
                              compact
                            >
                              Remove
                            </Button>
                          </View>
                        </View>
                      </Card.Content>
                    </Card>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text variant="bodyLarge" style={styles.emptyText}>
                  No friends yet
                </Text>
                <Text variant="bodySmall" style={styles.emptySubtext}>
                  Add friends to get started!
                </Text>
              </View>
            )}

            {/* Sent Requests Section */}
            {sentRequests.length > 0 && (
              <View style={styles.section}>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  Sent Requests ({sentRequests.length})
                </Text>
                {sentRequests.map((request) => (
                  <Card key={request.id} style={styles.sentRequestCard}>
                    <Card.Content style={styles.cardContent}>
                      <View style={styles.sentRequestHeader}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>⏳</Text>
                        </View>
                        <View style={styles.sentRequestInfo}>
                          <Text
                            variant="bodySmall"
                            style={styles.sentRequestText}
                          >
                            {request.otherUserUsername || "Loading..."}
                          </Text>
                          <Text
                            variant="labelSmall"
                            style={styles.sentRequestSubtext}
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
        refreshing={refreshing}
        onRefresh={onRefresh}
      />

      {/* Add Friend Modal */}
      <Modal
        visible={addFriendModalVisible}
        onDismiss={() => setAddFriendModalVisible(false)}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalInner}>
              <Text variant="headlineSmall" style={styles.modalTitle}>
                Add Friend
              </Text>
              <Text variant="bodySmall" style={styles.modalSubtitle}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 12,
    color: "#666",
  },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    fontWeight: "600",
  },

  addButton: {
    borderRadius: 20,
  },

  searchbar: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 8,
  },

  section: {
    paddingHorizontal: 16,
    marginVertical: 12,
  },

  sectionTitle: {
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },

  requestCard: {
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: "#fff9f0",
    borderLeftWidth: 4,
    borderLeftColor: "#ff9800",
  },

  friendCard: {
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: "#f0f9ff",
    borderLeftWidth: 4,
    borderLeftColor: "#2196f3",
  },

  sentRequestCard: {
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    opacity: 0.7,
  },

  cardContent: {
    padding: 12,
  },

  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
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
    color: "#333",
    marginBottom: 2,
  },

  requestSubtitle: {
    color: "#999",
  },

  requestActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
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
    marginBottom: 4,
  },

  streakChip: {
    backgroundColor: "#ff6b6b",
    alignSelf: "flex-start",
  },

  streakText: {
    fontSize: 10,
    color: "#fff",
  },

  buttonGroup: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },

  messageButton: {
    marginRight: 4,
  },

  sentRequestHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sentRequestInfo: {
    flex: 1,
    marginLeft: 12,
  },

  sentRequestText: {
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },

  sentRequestSubtext: {
    color: "#999",
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },

  emptyText: {
    fontWeight: "500",
    marginBottom: 8,
  },

  emptySubtext: {
    color: "#999",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalContent: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 12,
    width: "85%",
    minHeight: 250,
  },

  modalInner: {
    flex: 1,
    justifyContent: "center",
  },

  modalTitle: {
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },

  modalSubtitle: {
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
  },

  modalInput: {
    marginBottom: 20,
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
});
