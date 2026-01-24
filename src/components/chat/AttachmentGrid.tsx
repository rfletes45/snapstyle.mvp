/**
 * AttachmentGrid Component
 * Phase H10: Multi-Attachment Support
 *
 * Displays message attachments in a responsive grid layout:
 * - 1 image: full width
 * - 2 images: side by side
 * - 3 images: 2 on top, 1 below
 * - 4+ images: 2x2 grid with "+N" overlay
 *
 * @module components/chat/AttachmentGrid
 */

import { AttachmentV2 } from "@/types/messaging";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "react-native-paper";

// =============================================================================
// Types
// =============================================================================

export interface AttachmentGridProps {
  /** List of attachments to display */
  attachments: AttachmentV2[];
  /** Called when an attachment is pressed */
  onPress?: (index: number) => void;
  /** Maximum width of the grid */
  maxWidth?: number;
  /** Whether this is the sender's message (affects styling) */
  isOwn?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_WIDTH = 280;
const GRID_GAP = 2;
const BORDER_RADIUS = 12;
const MAX_VISIBLE_ATTACHMENTS = 4;

// =============================================================================
// Helper Functions
// =============================================================================

function getGridLayout(count: number): { rows: number; cols: number } {
  if (count === 1) return { rows: 1, cols: 1 };
  if (count === 2) return { rows: 1, cols: 2 };
  if (count === 3) return { rows: 2, cols: 2 };
  return { rows: 2, cols: 2 };
}

function getItemSize(
  index: number,
  count: number,
  maxWidth: number,
): { width: number; height: number } {
  const gap = GRID_GAP;

  if (count === 1) {
    // Full width, aspect ratio maintained (default square-ish)
    return { width: maxWidth, height: maxWidth * 0.75 };
  }

  if (count === 2) {
    // Side by side
    const itemWidth = (maxWidth - gap) / 2;
    return { width: itemWidth, height: itemWidth };
  }

  if (count === 3) {
    // First row: 2 items, second row: 1 item full width
    const halfWidth = (maxWidth - gap) / 2;
    if (index < 2) {
      return { width: halfWidth, height: halfWidth };
    }
    return { width: maxWidth, height: halfWidth };
  }

  // 4+ items: 2x2 grid
  const itemWidth = (maxWidth - gap) / 2;
  return { width: itemWidth, height: itemWidth };
}

function getBorderRadius(
  index: number,
  count: number,
): {
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomLeftRadius?: number;
  borderBottomRightRadius?: number;
} {
  const r = BORDER_RADIUS;

  if (count === 1) {
    return {
      borderTopLeftRadius: r,
      borderTopRightRadius: r,
      borderBottomLeftRadius: r,
      borderBottomRightRadius: r,
    };
  }

  if (count === 2) {
    if (index === 0) {
      return { borderTopLeftRadius: r, borderBottomLeftRadius: r };
    }
    return { borderTopRightRadius: r, borderBottomRightRadius: r };
  }

  if (count === 3) {
    if (index === 0) return { borderTopLeftRadius: r };
    if (index === 1) return { borderTopRightRadius: r };
    return { borderBottomLeftRadius: r, borderBottomRightRadius: r };
  }

  // 4+ items
  if (index === 0) return { borderTopLeftRadius: r };
  if (index === 1) return { borderTopRightRadius: r };
  if (index === 2) return { borderBottomLeftRadius: r };
  if (index === 3) return { borderBottomRightRadius: r };
  return {};
}

// =============================================================================
// Sub-Components
// =============================================================================

interface GridItemProps {
  attachment: AttachmentV2;
  index: number;
  totalCount: number;
  displayCount: number;
  maxWidth: number;
  onPress?: () => void;
}

const GridItem = memo(function GridItem({
  attachment,
  index,
  totalCount,
  displayCount,
  maxWidth,
  onPress,
}: GridItemProps) {
  const theme = useTheme();
  const size = getItemSize(index, displayCount, maxWidth);
  const borderRadius = getBorderRadius(index, displayCount);

  const isLastVisible = index === displayCount - 1;
  const hasMore = totalCount > MAX_VISIBLE_ATTACHMENTS;
  const remainingCount = totalCount - MAX_VISIBLE_ATTACHMENTS;

  // Use thumbnail if available, otherwise main URL
  const imageUrl = attachment.thumbUrl || attachment.url;

  return (
    <TouchableOpacity
      style={[styles.gridItem, size, borderRadius]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: imageUrl }}
        style={[styles.gridImage, borderRadius]}
        resizeMode="cover"
      />

      {/* Video indicator */}
      {attachment.kind === "video" && (
        <View style={styles.videoIndicator}>
          <MaterialCommunityIcons name="play-circle" size={32} color="#FFF" />
        </View>
      )}

      {/* View-once indicator */}
      {attachment.viewOnce && (
        <View
          style={[
            styles.viewOnceOverlay,
            { backgroundColor: theme.colors.tertiary },
          ]}
        >
          <MaterialCommunityIcons name="eye-off" size={20} color="#FFF" />
          <Text style={styles.viewOnceText}>View Once</Text>
        </View>
      )}

      {/* "+N more" overlay */}
      {isLastVisible && hasMore && (
        <View style={styles.moreOverlay}>
          <Text style={styles.moreText}>+{remainingCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

// =============================================================================
// Main Component
// =============================================================================

export const AttachmentGrid = memo(function AttachmentGrid({
  attachments,
  onPress,
  maxWidth = DEFAULT_MAX_WIDTH,
  isOwn = false,
}: AttachmentGridProps) {
  const theme = useTheme();

  const handlePress = useCallback(
    (index: number) => {
      onPress?.(index);
    },
    [onPress],
  );

  if (!attachments || attachments.length === 0) {
    return null;
  }

  // Only display up to MAX_VISIBLE_ATTACHMENTS
  const displayCount = Math.min(attachments.length, MAX_VISIBLE_ATTACHMENTS);
  const displayAttachments = attachments.slice(0, displayCount);
  const layout = getGridLayout(displayCount);

  // Build grid rows
  const rows: AttachmentV2[][] = [];
  let currentRow: AttachmentV2[] = [];

  displayAttachments.forEach((att, idx) => {
    currentRow.push(att);

    // Special case for 3 items: first row has 2, second has 1
    if (displayCount === 3) {
      if (idx === 1 || idx === 2) {
        rows.push(currentRow);
        currentRow = [];
      }
    } else {
      // Normal 2-column layout
      if (currentRow.length === layout.cols || idx === displayCount - 1) {
        rows.push(currentRow);
        currentRow = [];
      }
    }
  });

  return (
    <View style={[styles.container, { maxWidth }]}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((attachment, colIndex) => {
            const globalIndex =
              rowIndex *
                (displayCount === 3 && rowIndex === 0 ? 2 : layout.cols) +
              colIndex;
            return (
              <GridItem
                key={attachment.id}
                attachment={attachment}
                index={globalIndex}
                totalCount={attachments.length}
                displayCount={displayCount}
                maxWidth={maxWidth}
                onPress={() => handlePress(globalIndex)}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
});

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  gridItem: {
    overflow: "hidden",
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  videoIndicator: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  viewOnceOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.9,
  },
  viewOnceText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  moreText: {
    color: "#FFF",
    fontSize: 24,
    fontWeight: "700",
  },
});

export default AttachmentGrid;
