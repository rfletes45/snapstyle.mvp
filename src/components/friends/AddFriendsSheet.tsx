/**
 * AddFriendsSheet — Clean 3-tile Add Friends view in a DraggableBottomSheet.
 *
 * Tiles: Share Invite · QR Code · Quick Add
 * Below: Friend Recommendations carousel (if available).
 */

import { DraggableBottomSheet } from "@/components/chat/DraggableBottomSheet";
import { ProfilePictureWithDecoration } from "@/components/profile/ProfilePicture";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useFriendSuggestions } from "@/hooks/useFriendSuggestions";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AddFriendsSheetProps {
  open: boolean;
  onClose: () => void;
  onShareInvite: () => void;
  onQRCode: () => void;
  onQuickAdd: () => void;
  onSendRequest?: (username: string, uid: string) => void;
  onNavigateProfile?: (uid: string) => void;
}

// ---------------------------------------------------------------------------
// Tile data
// ---------------------------------------------------------------------------

interface TileConfig {
  key: string;
  icon: string;
  label: string;
  subtitle: string;
}

const TILES: TileConfig[] = [
  {
    key: "share",
    icon: "share-variant-outline",
    label: "Share Invite",
    subtitle: "Send a link to friends",
  },
  {
    key: "qr",
    icon: "qrcode",
    label: "QR Code",
    subtitle: "Show or scan a code",
  },
  {
    key: "quickadd",
    icon: "account-plus-outline",
    label: "Quick Add",
    subtitle: "Phone, email, or contacts",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AddFriendsSheet({
  open,
  onClose,
  onShareInvite,
  onQRCode,
  onQuickAdd,
  onSendRequest,
  onNavigateProfile,
}: AddFriendsSheetProps) {
  const { colors } = useTheme();
  const { suggestions, loading: sugLoading, dismiss } = useFriendSuggestions();

  const handlers: Record<string, () => void> = {
    share: onShareInvite,
    qr: onQRCode,
    quickadd: onQuickAdd,
  };

  const hasSuggestions = suggestions.length > 0;
  const snapHeight = hasSuggestions ? 0.62 : 0.42;

  const handleAdd = useCallback(
    (uid: string, username: string) => {
      onSendRequest?.(username, uid);
    },
    [onSendRequest],
  );

  return (
    <DraggableBottomSheet
      open={open}
      onClose={onClose}
      snapPoints={[snapHeight]}
      initialSnapIndex={0}
    >
      <View style={styles.content}>
        <Text
          variant="titleLarge"
          style={[styles.heading, { color: colors.onSurface }]}
        >
          Add Friends
        </Text>

        <View style={styles.tilesRow}>
          {TILES.map((tile) => (
            <TouchableOpacity
              key={tile.key}
              style={[styles.tile, { backgroundColor: colors.surfaceVariant }]}
              onPress={handlers[tile.key]}
              activeOpacity={0.7}
              accessibilityLabel={tile.label}
              accessibilityRole="button"
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: colors.primaryContainer },
                ]}
              >
                <MaterialCommunityIcons
                  name={tile.icon as any}
                  size={28}
                  color={colors.onPrimaryContainer}
                />
              </View>
              <Text
                variant="labelLarge"
                style={[styles.tileLabel, { color: colors.onSurface }]}
                numberOfLines={1}
              >
                {tile.label}
              </Text>
              <Text
                variant="bodySmall"
                style={[
                  styles.tileSubtitle,
                  { color: colors.onSurfaceVariant },
                ]}
                numberOfLines={1}
              >
                {tile.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Recommendations ────────────────────────────────── */}
        {(hasSuggestions || sugLoading) && (
          <View style={styles.recsSection}>
            <Text
              variant="titleSmall"
              style={[styles.recsHeading, { color: colors.onSurface }]}
            >
              Suggested Friends
            </Text>
            {sugLoading && suggestions.length === 0 ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginTop: Spacing.md }}
              />
            ) : (
              <FlatList
                data={suggestions}
                keyExtractor={(item) => item.uid}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recsScroll}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.recCard,
                      { backgroundColor: colors.surfaceVariant },
                    ]}
                    onPress={() => onNavigateProfile?.(item.uid)}
                    activeOpacity={0.7}
                  >
                    <TouchableOpacity
                      style={styles.recDismiss}
                      onPress={() => dismiss(item.uid)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialCommunityIcons
                        name="close"
                        size={14}
                        color={colors.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                    <ProfilePictureWithDecoration
                      pictureUrl={item.profilePictureUrl}
                      name={item.displayName || "?"}
                      decorationId={item.decorationId}
                      size={44}
                    />
                    <Text
                      variant="labelMedium"
                      style={[styles.recName, { color: colors.onSurface }]}
                      numberOfLines={1}
                    >
                      {item.username}
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={[
                        styles.recReason,
                        { color: colors.onSurfaceVariant },
                      ]}
                      numberOfLines={1}
                    >
                      {item.reasonLabel}
                    </Text>
                    <Button
                      mode="contained-tonal"
                      compact
                      onPress={() => handleAdd(item.uid, item.username)}
                      style={styles.recAddBtn}
                      labelStyle={styles.recAddBtnLabel}
                    >
                      Add
                    </Button>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        )}
      </View>
    </DraggableBottomSheet>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  heading: {
    fontWeight: "700",
    marginBottom: Spacing.lg,
  },
  tilesRow: {
    flexDirection: "row",
    gap: 12,
  },
  tile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  tileLabel: {
    fontWeight: "600",
    textAlign: "center",
  },
  tileSubtitle: {
    textAlign: "center",
    marginTop: 2,
    fontSize: 11,
  },

  /* Recommendations section */
  recsSection: {
    marginTop: Spacing.xl,
  },
  recsHeading: {
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  recsScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  recCard: {
    width: 120,
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      },
      android: {
        elevation: 1,
      },
    }),
  },
  recDismiss: {
    position: "absolute",
    top: 6,
    right: 6,
    zIndex: 1,
  },
  recName: {
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
  },
  recReason: {
    textAlign: "center",
    fontSize: 10,
    marginTop: 2,
  },
  recAddBtn: {
    marginTop: 8,
    borderRadius: BorderRadius.full,
    minWidth: 64,
    minHeight: 32,
    alignSelf: "center",
    justifyContent: "center",
  },
  recAddBtnLabel: {
    fontSize: 12,
    lineHeight: 16,
    marginVertical: 0,
    marginHorizontal: 12,
  },
});
