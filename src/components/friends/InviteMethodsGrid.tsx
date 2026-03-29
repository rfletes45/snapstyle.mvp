/**
 * InviteMethodsGrid — Horizontal tiles for invite/share actions
 *
 * - Share Invite Link
 * - Copy Link
 * - My QR Code
 * - Scan QR Code
 * - From Contacts
 * - Share Profile
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

interface InviteTile {
  key: string;
  icon: string;
  label: string;
  onPress: () => void;
}

interface InviteMethodsGridProps {
  tiles: InviteTile[];
}

export default React.memo(function InviteMethodsGrid({
  tiles,
}: InviteMethodsGridProps) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {tiles.map((tile) => (
        <TouchableOpacity
          key={tile.key}
          style={[styles.tile, { backgroundColor: colors.surfaceVariant }]}
          onPress={tile.onPress}
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
              size={22}
              color={colors.onPrimaryContainer}
            />
          </View>
          <Text
            variant="labelSmall"
            numberOfLines={2}
            style={[styles.label, { color: colors.onSurface }]}
          >
            {tile.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 10,
  },
  tile: {
    width: 80,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  label: {
    textAlign: "center",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "500",
  },
});
