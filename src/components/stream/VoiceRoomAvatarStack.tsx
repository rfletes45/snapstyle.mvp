/**
 * VoiceRoomAvatarStack
 *
 * Compact, width-aware stacked avatar row for group chat header.
 * Shows who's in the voice room with overlapping circular avatars
 * and a +N overflow bubble when space is limited.
 *
 * Features:
 * - Stacked avatars with leftward overlap
 * - Width-aware: measures available space via onLayout
 * - +N overflow bubble replaces hidden avatars
 * - Stable participant ordering (no jitter)
 * - Accessibility labels
 * - Tappable — triggers join/return to voice room
 *
 * @module components/stream/VoiceRoomAvatarStack
 */

import { ProfilePicture } from "@/components/profile/ProfilePicture/ProfilePicture";
import type { VoiceRoomOccupant } from "@/hooks/useVoiceRoomOccupancy";
import { useAppTheme } from "@/store/ThemeContext";
import React, { useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const AVATAR_SIZE = 26;
const AVATAR_BORDER = 2;
const AVATAR_TOTAL = AVATAR_SIZE + AVATAR_BORDER * 2; // 30
const OVERLAP = 10; // px each avatar overlaps the previous
const OVERFLOW_BUBBLE_WIDTH = 28;
const MIN_VISIBLE = 1; // Always show at least 1 avatar

interface VoiceRoomAvatarStackProps {
  occupants: VoiceRoomOccupant[];
  onPress: () => void;
}

export function VoiceRoomAvatarStack({
  occupants,
  onPress,
}: VoiceRoomAvatarStackProps) {
  const { colors } = useAppTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  // Calculate how many avatars fit
  const { visible, overflow } = useMemo(() => {
    if (containerWidth === 0 || occupants.length === 0) {
      return { visible: occupants, overflow: 0 };
    }

    // Width for N avatars: first is full width, each subsequent adds (AVATAR_TOTAL - OVERLAP)
    // Plus overflow bubble if needed
    const step = AVATAR_TOTAL - OVERLAP; // 20px per additional avatar
    const maxWithoutOverflow = Math.max(
      MIN_VISIBLE,
      Math.floor((containerWidth - AVATAR_TOTAL) / step) + 1,
    );

    if (occupants.length <= maxWithoutOverflow) {
      return { visible: occupants, overflow: 0 };
    }

    // Reserve space for overflow bubble
    const maxWithOverflow = Math.max(
      MIN_VISIBLE,
      Math.floor(
        (containerWidth - AVATAR_TOTAL - OVERFLOW_BUBBLE_WIDTH) / step,
      ) + 1,
    );

    const visibleCount = Math.min(maxWithOverflow, occupants.length);
    return {
      visible: occupants.slice(0, visibleCount),
      overflow: occupants.length - visibleCount,
    };
  }, [containerWidth, occupants]);

  if (occupants.length === 0) return null;

  const accessibilityLabel = `${occupants.length} ${occupants.length === 1 ? "person" : "people"} in voice room`;

  return (
    <TouchableOpacity
      onPress={onPress}
      onLayout={handleLayout}
      style={styles.container}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint="Tap to join voice room"
    >
      <View style={styles.avatarRow}>
        {overflow > 0 && (
          <View
            style={[
              styles.overflowBubble,
              {
                backgroundColor: colors.surfaceVariant,
                borderColor: colors.background,
                zIndex: visible.length + 1,
              },
            ]}
          >
            <Text
              style={[styles.overflowText, { color: colors.text }]}
              numberOfLines={1}
            >
              +{overflow}
            </Text>
          </View>
        )}
        {visible.map((occupant, index) => (
          <View
            key={occupant.userId}
            style={[
              styles.avatarWrapper,
              {
                marginLeft: overflow > 0 || index > 0 ? -OVERLAP : 0,
                zIndex: visible.length - index,
                borderColor: colors.background,
              },
            ]}
          >
            <ProfilePicture
              url={occupant.image ?? null}
              name={occupant.name}
              size={AVATAR_SIZE}
              showLoading={false}
            />
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexShrink: 1,
    justifyContent: "center",
    paddingLeft: 4,
    paddingRight: 2,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrapper: {
    width: AVATAR_TOTAL,
    height: AVATAR_TOTAL,
    borderRadius: AVATAR_TOTAL / 2,
    borderWidth: AVATAR_BORDER,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  overflowBubble: {
    width: OVERFLOW_BUBBLE_WIDTH,
    height: AVATAR_TOTAL,
    borderRadius: AVATAR_TOTAL / 2,
    borderWidth: AVATAR_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  overflowText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
