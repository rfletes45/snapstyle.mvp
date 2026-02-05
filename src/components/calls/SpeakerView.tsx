/**
 * SpeakerView - Speaker-focused layout for group calls
 * Shows active speaker in large view with thumbnails of other participants
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { MediaStream, RTCView } from "react-native-webrtc";
import { AvatarConfig } from "../../types/models";
import Avatar from "../Avatar";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const THUMBNAIL_SIZE = 100;
const THUMBNAIL_GAP = 8;

interface SpeakerViewParticipant {
  odId: string;
  displayName: string;
  avatarConfig?: AvatarConfig;
  stream: MediaStream | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isActiveSpeaker?: boolean;
  raisedHand?: boolean;
  connectionState?: string;
  audioLevel?: number;
}

interface SpeakerViewProps {
  participants: SpeakerViewParticipant[];
  localParticipant: SpeakerViewParticipant | null;
  activeSpeakerId: string | null;
  pinnedParticipantId?: string | null;
  onParticipantPress?: (participantId: string) => void;
  onParticipantLongPress?: (participantId: string) => void;
  onUnpin?: () => void;
  containerStyle?: ViewStyle;
}

export function SpeakerView({
  participants,
  localParticipant,
  activeSpeakerId,
  pinnedParticipantId,
  onParticipantPress,
  onParticipantLongPress,
  onUnpin,
  containerStyle,
}: SpeakerViewProps) {
  // Combine all participants
  const allParticipants = useMemo(() => {
    if (!localParticipant) return participants;
    return [localParticipant, ...participants];
  }, [localParticipant, participants]);

  // Determine the featured participant (pinned > active speaker > first participant)
  const featuredParticipant = useMemo(() => {
    if (pinnedParticipantId) {
      return allParticipants.find((p) => p.odId === pinnedParticipantId);
    }
    if (activeSpeakerId) {
      return allParticipants.find((p) => p.odId === activeSpeakerId);
    }
    // Default to first non-local participant, or local if alone
    const nonLocalParticipants = allParticipants.filter(
      (p) => p.odId !== localParticipant?.odId,
    );
    return nonLocalParticipants[0] || localParticipant;
  }, [allParticipants, pinnedParticipantId, activeSpeakerId, localParticipant]);

  // Thumbnails are all participants except the featured one
  const thumbnailParticipants = useMemo(() => {
    return allParticipants.filter((p) => p.odId !== featuredParticipant?.odId);
  }, [allParticipants, featuredParticipant]);

  if (!featuredParticipant) {
    return (
      <View style={[styles.container, styles.emptyContainer, containerStyle]}>
        <Ionicons name="people-outline" size={64} color="#666" />
        <Text style={styles.emptyText}>Waiting for participants...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Main speaker view */}
      <FeaturedVideoTile
        participant={featuredParticipant}
        isLocal={featuredParticipant.odId === localParticipant?.odId}
        isPinned={featuredParticipant.odId === pinnedParticipantId}
        isActiveSpeaker={featuredParticipant.odId === activeSpeakerId}
        onPress={() => onParticipantPress?.(featuredParticipant.odId)}
        onLongPress={() => onParticipantLongPress?.(featuredParticipant.odId)}
        onUnpin={pinnedParticipantId ? onUnpin : undefined}
      />

      {/* Thumbnail strip */}
      {thumbnailParticipants.length > 0 && (
        <View style={styles.thumbnailStrip}>
          <FlatList
            horizontal
            data={thumbnailParticipants}
            keyExtractor={(item) => item.odId}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailList}
            renderItem={({ item }) => (
              <ThumbnailTile
                participant={item}
                isLocal={item.odId === localParticipant?.odId}
                isActiveSpeaker={item.odId === activeSpeakerId}
                onPress={() => onParticipantPress?.(item.odId)}
                onLongPress={() => onParticipantLongPress?.(item.odId)}
              />
            )}
          />
        </View>
      )}
    </View>
  );
}

interface FeaturedVideoTileProps {
  participant: SpeakerViewParticipant;
  isLocal: boolean;
  isPinned: boolean;
  isActiveSpeaker: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onUnpin?: () => void;
}

function FeaturedVideoTile({
  participant,
  isLocal,
  isPinned,
  isActiveSpeaker,
  onPress,
  onLongPress,
  onUnpin,
}: FeaturedVideoTileProps) {
  const hasVideo = participant.isVideoEnabled && participant.stream;
  const isConnecting = participant.connectionState === "connecting";
  const speakingPulse = useRef(new Animated.Value(1)).current;

  // Pulse animation when speaking
  useEffect(() => {
    if (isActiveSpeaker && !isPinned) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(speakingPulse, {
            toValue: 1.02,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(speakingPulse, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      speakingPulse.setValue(1);
    }
  }, [isActiveSpeaker, isPinned, speakingPulse]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.featuredContainer}
    >
      <Animated.View
        style={[
          styles.featuredTile,
          isActiveSpeaker && styles.activeSpeakerBorder,
          isPinned && styles.pinnedBorder,
          { transform: [{ scale: speakingPulse }] },
        ]}
      >
        {/* Video or Avatar */}
        {hasVideo ? (
          <RTCView
            streamURL={participant.stream!.toURL()}
            style={styles.featuredVideo}
            mirror={isLocal}
            objectFit="cover"
            zOrder={1}
          />
        ) : (
          <View style={styles.featuredAvatarContainer}>
            {participant.avatarConfig ? (
              <Avatar
                config={participant.avatarConfig}
                size={Math.min(SCREEN_WIDTH, SCREEN_HEIGHT - 250) * 0.5}
              />
            ) : (
              <View style={styles.placeholderAvatar}>
                <Text style={styles.placeholderInitial}>
                  {participant.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {/* Audio level indicator */}
            {participant.audioLevel !== undefined &&
              participant.audioLevel > 20 && (
                <View style={styles.audioLevelIndicator}>
                  <Ionicons name="volume-high" size={24} color="#4CAF50" />
                </View>
              )}
          </View>
        )}

        {/* Connecting overlay */}
        {isConnecting && (
          <View style={styles.connectingOverlay}>
            <Text style={styles.connectingText}>Connecting...</Text>
          </View>
        )}

        {/* Top indicators */}
        <View style={styles.featuredTopBar}>
          <View style={styles.topLeftIndicators}>
            {isPinned && (
              <View style={styles.pinnedBadge}>
                <Ionicons name="pin" size={16} color="#fff" />
                <Text style={styles.pinnedText}>Pinned</Text>
                {onUnpin && (
                  <Pressable onPress={onUnpin} style={styles.unpinButton}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </Pressable>
                )}
              </View>
            )}
            {isActiveSpeaker && !isPinned && (
              <View style={styles.speakingBadge}>
                <Ionicons name="volume-high" size={16} color="#fff" />
                <Text style={styles.speakingText}>Speaking</Text>
              </View>
            )}
          </View>
          {participant.raisedHand && (
            <View style={styles.handRaisedBadge}>
              <Text style={styles.handEmoji}>✋</Text>
            </View>
          )}
        </View>

        {/* Bottom bar */}
        <View style={styles.featuredBottomBar}>
          <View style={styles.nameContainer}>
            <Text style={styles.featuredName}>
              {isLocal ? "You" : participant.displayName}
            </Text>
          </View>
          <View style={styles.statusIcons}>
            {participant.isMuted && (
              <View style={styles.statusIcon}>
                <Ionicons name="mic-off" size={18} color="#ff4444" />
              </View>
            )}
            {!participant.isVideoEnabled && (
              <View style={styles.statusIcon}>
                <Ionicons name="videocam-off" size={18} color="#ff4444" />
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

interface ThumbnailTileProps {
  participant: SpeakerViewParticipant;
  isLocal: boolean;
  isActiveSpeaker: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

function ThumbnailTile({
  participant,
  isLocal,
  isActiveSpeaker,
  onPress,
  onLongPress,
}: ThumbnailTileProps) {
  const hasVideo = participant.isVideoEnabled && participant.stream;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.thumbnail,
        isActiveSpeaker && styles.activeSpeakerThumbnail,
      ]}
    >
      {hasVideo ? (
        <RTCView
          streamURL={participant.stream!.toURL()}
          style={styles.thumbnailVideo}
          mirror={isLocal}
          objectFit="cover"
          zOrder={1}
        />
      ) : (
        <View style={styles.thumbnailAvatarContainer}>
          {participant.avatarConfig ? (
            <Avatar config={participant.avatarConfig} size={50} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Text style={styles.thumbnailInitial}>
                {participant.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Indicators */}
      <View style={styles.thumbnailOverlay}>
        {/* Raised hand */}
        {participant.raisedHand && (
          <View style={styles.thumbnailHand}>
            <Text style={styles.smallHandEmoji}>✋</Text>
          </View>
        )}

        {/* Bottom bar */}
        <View style={styles.thumbnailBottomBar}>
          <Text style={styles.thumbnailName} numberOfLines={1}>
            {isLocal ? "You" : participant.displayName.split(" ")[0]}
          </Text>
          {participant.isMuted && (
            <Ionicons name="mic-off" size={10} color="#ff4444" />
          )}
        </View>
      </View>

      {/* Active speaker ring */}
      {isActiveSpeaker && <View style={styles.activeSpeakerRing} />}
    </Pressable>
  );
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

  // Featured tile
  featuredContainer: {
    flex: 1,
    padding: 8,
  },
  featuredTile: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    position: "relative",
  },
  activeSpeakerBorder: {
    borderWidth: 3,
    borderColor: "#4CAF50",
  },
  pinnedBorder: {
    borderWidth: 3,
    borderColor: "#2196F3",
  },
  featuredVideo: {
    flex: 1,
    backgroundColor: "#000",
  },
  featuredAvatarContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
  },
  placeholderAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#444",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderInitial: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "bold",
  },
  audioLevelIndicator: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 20,
    padding: 8,
  },
  connectingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  connectingText: {
    color: "#fff",
    fontSize: 16,
  },
  featuredTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 12,
  },
  topLeftIndicators: {
    flexDirection: "row",
    gap: 8,
  },
  pinnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(33, 150, 243, 0.8)",
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 4,
  },
  pinnedText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  unpinButton: {
    marginLeft: 4,
    padding: 2,
  },
  speakingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(76, 175, 80, 0.8)",
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 4,
  },
  speakingText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  handRaisedBadge: {
    backgroundColor: "rgba(255, 193, 7, 0.9)",
    borderRadius: 16,
    padding: 6,
  },
  handEmoji: {
    fontSize: 16,
  },
  featuredBottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  nameContainer: {
    flex: 1,
  },
  featuredName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  statusIcons: {
    flexDirection: "row",
    gap: 8,
  },
  statusIcon: {
    backgroundColor: "rgba(255, 68, 68, 0.3)",
    borderRadius: 14,
    padding: 4,
  },

  // Thumbnail strip
  thumbnailStrip: {
    height: THUMBNAIL_SIZE + 16,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  thumbnailList: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: THUMBNAIL_GAP,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#2a2a2a",
    marginRight: THUMBNAIL_GAP,
    position: "relative",
  },
  activeSpeakerThumbnail: {
    borderWidth: 2,
    borderColor: "#4CAF50",
  },
  thumbnailVideo: {
    flex: 1,
    backgroundColor: "#000",
  },
  thumbnailAvatarContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
  },
  thumbnailPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#444",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnailInitial: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  thumbnailHand: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(255, 193, 7, 0.9)",
    borderRadius: 10,
    padding: 2,
  },
  smallHandEmoji: {
    fontSize: 10,
  },
  thumbnailBottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 4,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  thumbnailName: {
    color: "#fff",
    fontSize: 10,
    flex: 1,
  },
  activeSpeakerRing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: "#4CAF50",
    borderRadius: 8,
    pointerEvents: "none",
  },
});
