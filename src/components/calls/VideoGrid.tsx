/**
 * VideoGrid - Grid layout for multiple video streams in group calls
 * Automatically adjusts grid based on participant count
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { MediaStream, RTCView } from "react-native-webrtc";
import { AvatarConfig } from "../../types/avatar";
import Avatar from "../Avatar";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface VideoGridParticipant {
  odId: string;
  displayName: string;
  avatarConfig?: AvatarConfig;
  stream: MediaStream | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isActiveSpeaker?: boolean;
  isPinned?: boolean;
  raisedHand?: boolean;
  connectionState?: string;
}

interface VideoGridProps {
  participants: VideoGridParticipant[];
  localParticipant: VideoGridParticipant | null;
  activeSpeakerId?: string | null;
  pinnedParticipantId?: string | null;
  onParticipantPress?: (participantId: string) => void;
  onParticipantLongPress?: (participantId: string) => void;
  showNames?: boolean;
  containerStyle?: ViewStyle;
}

export function VideoGrid({
  participants,
  localParticipant,
  activeSpeakerId,
  pinnedParticipantId,
  onParticipantPress,
  onParticipantLongPress,
  showNames = true,
  containerStyle,
}: VideoGridProps) {
  // Combine local participant with remote participants
  const allParticipants = useMemo(() => {
    if (!localParticipant) return participants;
    return [localParticipant, ...participants];
  }, [localParticipant, participants]);

  // Calculate grid layout based on participant count
  const gridLayout = useMemo(() => {
    return calculateGridLayout(allParticipants.length);
  }, [allParticipants.length]);

  if (allParticipants.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer, containerStyle]}>
        <Ionicons name="people-outline" size={64} color="#666" />
        <Text style={styles.emptyText}>Waiting for participants...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.grid, { flexDirection: gridLayout.direction }]}>
        {gridLayout.rows.map((rowCount, rowIndex) => (
          <View
            key={`row-${rowIndex}`}
            style={[
              styles.row,
              {
                height: gridLayout.rowHeight,
                flexDirection:
                  gridLayout.direction === "column" ? "row" : "column",
              },
            ]}
          >
            {allParticipants
              .slice(
                rowIndex * gridLayout.maxPerRow,
                rowIndex * gridLayout.maxPerRow + rowCount,
              )
              .map((participant, index) => (
                <VideoTile
                  key={participant.odId}
                  participant={participant}
                  width={gridLayout.tileWidth}
                  height={gridLayout.rowHeight}
                  isLocal={participant.odId === localParticipant?.odId}
                  isActiveSpeaker={participant.odId === activeSpeakerId}
                  isPinned={participant.odId === pinnedParticipantId}
                  showName={showNames}
                  onPress={() => onParticipantPress?.(participant.odId)}
                  onLongPress={() => onParticipantLongPress?.(participant.odId)}
                />
              ))}
          </View>
        ))}
      </View>
    </View>
  );
}

interface VideoTileProps {
  participant: VideoGridParticipant;
  width: number;
  height: number;
  isLocal: boolean;
  isActiveSpeaker: boolean;
  isPinned: boolean;
  showName: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

function VideoTile({
  participant,
  width,
  height,
  isLocal,
  isActiveSpeaker,
  isPinned,
  showName,
  onPress,
  onLongPress,
}: VideoTileProps) {
  const hasVideo = participant.isVideoEnabled && participant.stream;
  const isConnecting = participant.connectionState === "connecting";

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.tile,
        {
          width: width - 4,
          height: height - 4,
        },
        isActiveSpeaker && styles.activeSpeakerTile,
        isPinned && styles.pinnedTile,
      ]}
    >
      {/* Video or Avatar */}
      {hasVideo ? (
        <RTCView
          streamURL={participant.stream!.toURL()}
          style={styles.video}
          mirror={isLocal}
          objectFit="cover"
          zOrder={1}
        />
      ) : (
        <View style={styles.avatarContainer}>
          {participant.avatarConfig ? (
            <Avatar
              config={participant.avatarConfig}
              size={Math.min(width, height) * 0.5}
            />
          ) : (
            <View style={styles.placeholderAvatar}>
              <Text style={styles.placeholderInitial}>
                {participant.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Overlay indicators */}
      <View style={styles.overlay}>
        {/* Connection state */}
        {isConnecting && (
          <View style={styles.connectingOverlay}>
            <Text style={styles.connectingText}>Connecting...</Text>
          </View>
        )}

        {/* Top indicators */}
        <View style={styles.topIndicators}>
          {isPinned && (
            <View style={styles.indicatorBadge}>
              <Ionicons name="pin" size={12} color="#fff" />
            </View>
          )}
          {participant.raisedHand && (
            <View style={[styles.indicatorBadge, styles.handRaisedBadge]}>
              <Text style={styles.handEmoji}>✋</Text>
            </View>
          )}
        </View>

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          {/* Name */}
          {showName && (
            <View style={styles.nameContainer}>
              <Text style={styles.name} numberOfLines={1}>
                {isLocal ? "You" : participant.displayName}
              </Text>
              {isLocal && <Text style={styles.localBadge}>(You)</Text>}
            </View>
          )}

          {/* Status icons */}
          <View style={styles.statusIcons}>
            {participant.isMuted && (
              <View style={styles.mutedIcon}>
                <Ionicons name="mic-off" size={14} color="#ff4444" />
              </View>
            )}
            {!participant.isVideoEnabled && (
              <View style={styles.videoOffIcon}>
                <Ionicons name="videocam-off" size={14} color="#ff4444" />
              </View>
            )}
          </View>
        </View>

        {/* Active speaker indicator */}
        {isActiveSpeaker && <View style={styles.activeSpeakerBorder} />}
      </View>
    </Pressable>
  );
}

// Calculate optimal grid layout based on participant count
function calculateGridLayout(count: number): {
  rows: number[];
  maxPerRow: number;
  rowHeight: number;
  tileWidth: number;
  direction: "row" | "column";
} {
  const availableHeight = SCREEN_HEIGHT - 150; // Account for controls
  const availableWidth = SCREEN_WIDTH;

  if (count === 0) {
    return {
      rows: [],
      maxPerRow: 0,
      rowHeight: 0,
      tileWidth: 0,
      direction: "column",
    };
  }

  if (count === 1) {
    return {
      rows: [1],
      maxPerRow: 1,
      rowHeight: availableHeight,
      tileWidth: availableWidth,
      direction: "column",
    };
  }

  if (count === 2) {
    // Side by side or stacked based on orientation
    const isPortrait = availableHeight > availableWidth;
    return {
      rows: isPortrait ? [1, 1] : [2],
      maxPerRow: isPortrait ? 1 : 2,
      rowHeight: isPortrait ? availableHeight / 2 : availableHeight,
      tileWidth: isPortrait ? availableWidth : availableWidth / 2,
      direction: isPortrait ? "column" : "row",
    };
  }

  if (count <= 4) {
    // 2x2 grid
    return {
      rows: [2, count - 2 > 0 ? count - 2 : 0].filter((r) => r > 0),
      maxPerRow: 2,
      rowHeight: availableHeight / 2,
      tileWidth: availableWidth / 2,
      direction: "column",
    };
  }

  if (count <= 6) {
    // 3x2 grid
    const firstRowCount = Math.min(3, count);
    const secondRowCount = count - firstRowCount;
    return {
      rows: [firstRowCount, secondRowCount].filter((r) => r > 0),
      maxPerRow: 3,
      rowHeight: availableHeight / 2,
      tileWidth: availableWidth / 3,
      direction: "column",
    };
  }

  if (count <= 9) {
    // 3x3 grid
    const rows: number[] = [];
    let remaining = count;
    while (remaining > 0) {
      rows.push(Math.min(3, remaining));
      remaining -= 3;
    }
    return {
      rows,
      maxPerRow: 3,
      rowHeight: availableHeight / rows.length,
      tileWidth: availableWidth / 3,
      direction: "column",
    };
  }

  // For more than 9, use 4 columns (shouldn't happen with 8 max)
  const rows: number[] = [];
  let remaining = count;
  while (remaining > 0) {
    rows.push(Math.min(4, remaining));
    remaining -= 4;
  }
  return {
    rows,
    maxPerRow: 4,
    rowHeight: availableHeight / rows.length,
    tileWidth: availableWidth / 4,
    direction: "column",
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#666",
    fontSize: 16,
    marginTop: 16,
  },
  grid: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  tile: {
    margin: 2,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    position: "relative",
  },
  activeSpeakerTile: {
    borderWidth: 2,
    borderColor: "#4CAF50",
  },
  pinnedTile: {
    borderWidth: 2,
    borderColor: "#2196F3",
  },
  video: {
    flex: 1,
    backgroundColor: "#000",
  },
  avatarContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
  },
  placeholderAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#444",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderInitial: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  connectingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  connectingText: {
    color: "#fff",
    fontSize: 14,
  },
  topIndicators: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 8,
    gap: 4,
  },
  indicatorBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 12,
    padding: 4,
  },
  handRaisedBadge: {
    backgroundColor: "rgba(255, 193, 7, 0.8)",
  },
  handEmoji: {
    fontSize: 12,
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  name: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  localBadge: {
    color: "#888",
    fontSize: 10,
    marginLeft: 4,
  },
  statusIcons: {
    flexDirection: "row",
    gap: 4,
  },
  mutedIcon: {
    backgroundColor: "rgba(255, 68, 68, 0.3)",
    borderRadius: 10,
    padding: 2,
  },
  videoOffIcon: {
    backgroundColor: "rgba(255, 68, 68, 0.3)",
    borderRadius: 10,
    padding: 2,
  },
  activeSpeakerBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: "#4CAF50",
    borderRadius: 8,
    pointerEvents: "none",
  },
});
