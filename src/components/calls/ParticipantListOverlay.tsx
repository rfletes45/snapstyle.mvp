/**
 * ParticipantListOverlay - Overlay showing all participants with management controls
 * Displays participant status, roles, and provides host controls
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { GroupCallParticipant } from "@/types/call";
import Avatar from "@/components/Avatar";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ParticipantListOverlayProps {
  visible: boolean;
  onClose: () => void;
  participants: GroupCallParticipant[];
  currentUserId: string;
  isHost: boolean;
  isCoHost: boolean;
  activeSpeakerId?: string | null;
  pinnedParticipantId?: string | null;
  onMuteParticipant?: (participantId: string, muted: boolean) => Promise<void>;
  onRemoveParticipant?: (participantId: string) => Promise<void>;
  onPinParticipant?: (participantId: string | null) => Promise<void>;
  onPromoteToCoHost?: (participantId: string) => Promise<void>;
  onDemoteFromCoHost?: (participantId: string) => Promise<void>;
  onMuteAll?: () => Promise<void>;
  onLowerAllHands?: () => Promise<void>;
  onInviteMore?: () => void;
  containerStyle?: ViewStyle;
}

export function ParticipantListOverlay({
  visible,
  onClose,
  participants,
  currentUserId,
  isHost,
  isCoHost,
  activeSpeakerId,
  pinnedParticipantId,
  onMuteParticipant,
  onRemoveParticipant,
  onPinParticipant,
  onPromoteToCoHost,
  onDemoteFromCoHost,
  onMuteAll,
  onLowerAllHands,
  onInviteMore,
  containerStyle,
}: ParticipantListOverlayProps) {
  const [selectedParticipant, setSelectedParticipant] =
    useState<GroupCallParticipant | null>(null);
  const [isActionMenuVisible, setIsActionMenuVisible] = useState(false);

  const canManageParticipants = isHost || isCoHost;
  const activeParticipants = participants.filter(
    (p) => p.joinedAt && !p.leftAt,
  );
  const raisedHandsCount = activeParticipants.filter(
    (p) => p.raisedHand,
  ).length;

  const handleParticipantPress = useCallback(
    (participant: GroupCallParticipant) => {
      if (participant.odId === currentUserId) return;
      if (!canManageParticipants) {
        // Allow anyone to pin
        onPinParticipant?.(
          pinnedParticipantId === participant.odId ? null : participant.odId,
        );
        return;
      }
      setSelectedParticipant(participant);
      setIsActionMenuVisible(true);
    },
    [
      currentUserId,
      canManageParticipants,
      pinnedParticipantId,
      onPinParticipant,
    ],
  );

  const handleMuteAll = useCallback(async () => {
    try {
      await onMuteAll?.();
    } catch (error) {
      Alert.alert("Error", "Failed to mute all participants");
    }
  }, [onMuteAll]);

  const handleLowerAllHands = useCallback(async () => {
    try {
      await onLowerAllHands?.();
    } catch (error) {
      Alert.alert("Error", "Failed to lower all hands");
    }
  }, [onLowerAllHands]);

  const handleMute = useCallback(async () => {
    if (!selectedParticipant) return;
    try {
      await onMuteParticipant?.(
        selectedParticipant.odId,
        !selectedParticipant.isMuted,
      );
    } catch (error) {
      Alert.alert("Error", "Failed to mute participant");
    }
    setIsActionMenuVisible(false);
  }, [selectedParticipant, onMuteParticipant]);

  const handleRemove = useCallback(async () => {
    if (!selectedParticipant) return;
    Alert.alert(
      "Remove Participant",
      `Are you sure you want to remove ${selectedParticipant.displayName} from the call?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await onRemoveParticipant?.(selectedParticipant.odId);
            } catch (error) {
              Alert.alert("Error", "Failed to remove participant");
            }
            setIsActionMenuVisible(false);
          },
        },
      ],
    );
  }, [selectedParticipant, onRemoveParticipant]);

  const handlePin = useCallback(async () => {
    if (!selectedParticipant) return;
    try {
      const newPinnedId =
        pinnedParticipantId === selectedParticipant.odId
          ? null
          : selectedParticipant.odId;
      await onPinParticipant?.(newPinnedId);
    } catch (error) {
      Alert.alert("Error", "Failed to pin participant");
    }
    setIsActionMenuVisible(false);
  }, [selectedParticipant, pinnedParticipantId, onPinParticipant]);

  const handlePromote = useCallback(async () => {
    if (!selectedParticipant || !isHost) return;
    try {
      if (selectedParticipant.role === "co-host") {
        await onDemoteFromCoHost?.(selectedParticipant.odId);
      } else {
        await onPromoteToCoHost?.(selectedParticipant.odId);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to change participant role");
    }
    setIsActionMenuVisible(false);
  }, [selectedParticipant, isHost, onPromoteToCoHost, onDemoteFromCoHost]);

  const renderParticipant = useCallback(
    ({ item }: { item: GroupCallParticipant }) => {
      const isCurrentUser = item.odId === currentUserId;
      const isActive = item.joinedAt && !item.leftAt;
      const isSpeaking = item.odId === activeSpeakerId;
      const isPinned = item.odId === pinnedParticipantId;

      return (
        <Pressable
          onPress={() => handleParticipantPress(item)}
          style={[
            styles.participantItem,
            isSpeaking && styles.speakingItem,
            !isActive && styles.inactiveItem,
          ]}
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            {item.avatarConfig ? (
              <Avatar config={item.avatarConfig} size={44} />
            ) : (
              <View style={styles.placeholderAvatar}>
                <Text style={styles.placeholderInitial}>
                  {item.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {/* Speaking indicator */}
            {isSpeaking && <View style={styles.speakingDot} />}
          </View>

          {/* Info */}
          <View style={styles.infoSection}>
            <View style={styles.nameRow}>
              <Text style={styles.participantName} numberOfLines={1}>
                {item.displayName}
                {isCurrentUser && " (You)"}
              </Text>
              {/* Role badge */}
              {item.role === "host" && (
                <View style={[styles.roleBadge, styles.hostBadge]}>
                  <Text style={styles.roleText}>Host</Text>
                </View>
              )}
              {item.role === "co-host" && (
                <View style={[styles.roleBadge, styles.coHostBadge]}>
                  <Text style={styles.roleText}>Co-host</Text>
                </View>
              )}
            </View>
            <View style={styles.statusRow}>
              {!isActive && (
                <Text style={styles.statusText}>Connecting...</Text>
              )}
              {isActive && item.raisedHand && (
                <View style={styles.raisedHandIndicator}>
                  <Text style={styles.handEmoji}>✋</Text>
                  <Text style={styles.raisedHandText}>Hand raised</Text>
                </View>
              )}
            </View>
          </View>

          {/* Status icons */}
          <View style={styles.iconsSection}>
            {isPinned && <Ionicons name="pin" size={16} color="#2196F3" />}
            {item.isMuted ? (
              <Ionicons name="mic-off" size={18} color="#ff4444" />
            ) : (
              <Ionicons name="mic" size={18} color="#4CAF50" />
            )}
            {item.isVideoEnabled ? (
              <Ionicons name="videocam" size={18} color="#4CAF50" />
            ) : (
              <Ionicons name="videocam-off" size={18} color="#ff4444" />
            )}
          </View>
        </Pressable>
      );
    },
    [
      currentUserId,
      activeSpeakerId,
      pinnedParticipantId,
      handleParticipantPress,
    ],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sheet, containerStyle]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              Participants ({activeParticipants.length})
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>

          {/* Host controls */}
          {canManageParticipants && (
            <View style={styles.hostControls}>
              <Pressable style={styles.hostButton} onPress={handleMuteAll}>
                <Ionicons name="mic-off" size={18} color="#fff" />
                <Text style={styles.hostButtonText}>Mute All</Text>
              </Pressable>

              {raisedHandsCount > 0 && (
                <Pressable
                  style={styles.hostButton}
                  onPress={handleLowerAllHands}
                >
                  <Text style={styles.handEmoji}>✋</Text>
                  <Text style={styles.hostButtonText}>
                    Lower All ({raisedHandsCount})
                  </Text>
                </Pressable>
              )}

              {onInviteMore && (
                <Pressable style={styles.hostButton} onPress={onInviteMore}>
                  <Ionicons name="person-add" size={18} color="#fff" />
                  <Text style={styles.hostButtonText}>Invite</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Participant list */}
          <FlatList
            data={activeParticipants}
            keyExtractor={(item) => item.odId}
            renderItem={renderParticipant}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>

        {/* Action menu for selected participant */}
        <Modal
          visible={isActionMenuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsActionMenuVisible(false)}
        >
          <Pressable
            style={styles.actionMenuBackdrop}
            onPress={() => setIsActionMenuVisible(false)}
          >
            <View style={styles.actionMenu}>
              {selectedParticipant && (
                <>
                  <Text style={styles.actionMenuTitle}>
                    {selectedParticipant.displayName}
                  </Text>

                  <Pressable style={styles.actionItem} onPress={handlePin}>
                    <Ionicons
                      name={
                        pinnedParticipantId === selectedParticipant.odId
                          ? "pin-outline"
                          : "pin"
                      }
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.actionText}>
                      {pinnedParticipantId === selectedParticipant.odId
                        ? "Unpin"
                        : "Pin Video"}
                    </Text>
                  </Pressable>

                  {canManageParticipants && (
                    <>
                      <Pressable style={styles.actionItem} onPress={handleMute}>
                        <Ionicons
                          name={selectedParticipant.isMuted ? "mic" : "mic-off"}
                          size={20}
                          color="#fff"
                        />
                        <Text style={styles.actionText}>
                          {selectedParticipant.isMuted ? "Unmute" : "Mute"}
                        </Text>
                      </Pressable>

                      {isHost && selectedParticipant.role !== "host" && (
                        <Pressable
                          style={styles.actionItem}
                          onPress={handlePromote}
                        >
                          <Ionicons
                            name={
                              selectedParticipant.role === "co-host"
                                ? "remove-circle-outline"
                                : "shield-checkmark"
                            }
                            size={20}
                            color="#fff"
                          />
                          <Text style={styles.actionText}>
                            {selectedParticipant.role === "co-host"
                              ? "Remove Co-host"
                              : "Make Co-host"}
                          </Text>
                        </Pressable>
                      )}

                      {selectedParticipant.role !== "host" && (
                        <Pressable
                          style={[styles.actionItem, styles.removeAction]}
                          onPress={handleRemove}
                        >
                          <Ionicons
                            name="person-remove"
                            size={20}
                            color="#ff4444"
                          />
                          <Text style={[styles.actionText, styles.removeText]}>
                            Remove from Call
                          </Text>
                        </Pressable>
                      )}
                    </>
                  )}
                </>
              )}
            </View>
          </Pressable>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sheet: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.7,
    paddingBottom: 34, // Safe area
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  closeButton: {
    padding: 4,
  },
  hostControls: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  hostButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  hostButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  listContent: {
    padding: 8,
  },
  participantItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#252525",
  },
  speakingItem: {
    backgroundColor: "rgba(76, 175, 80, 0.15)",
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  inactiveItem: {
    opacity: 0.5,
  },
  avatarSection: {
    position: "relative",
    marginRight: 12,
  },
  placeholderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#444",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderInitial: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  speakingDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "#1a1a1a",
  },
  infoSection: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  participantName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
    flexShrink: 1,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hostBadge: {
    backgroundColor: "rgba(255, 193, 7, 0.3)",
  },
  coHostBadge: {
    backgroundColor: "rgba(33, 150, 243, 0.3)",
  },
  roleText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  statusText: {
    color: "#888",
    fontSize: 12,
  },
  raisedHandIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  handEmoji: {
    fontSize: 12,
  },
  raisedHandText: {
    color: "#FFC107",
    fontSize: 12,
  },
  iconsSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  separator: {
    height: 4,
  },

  // Action menu
  actionMenuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionMenu: {
    backgroundColor: "#2a2a2a",
    borderRadius: 16,
    padding: 16,
    width: "80%",
    maxWidth: 300,
  },
  actionMenuTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  actionText: {
    color: "#fff",
    fontSize: 15,
  },
  removeAction: {
    borderTopWidth: 1,
    borderTopColor: "#444",
    marginTop: 8,
    paddingTop: 16,
  },
  removeText: {
    color: "#ff4444",
  },
});
