/**
 * ContactsPermissionCard — Pre-permission explainer for contacts access
 *
 * Shows a friendly explainer before requesting contacts permission.
 * Only shown when user has not yet granted/denied.
 */

import { BorderRadius, Spacing } from "@/constants/theme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";

interface ContactsPermissionCardProps {
  onRequestPermission: () => void;
  onDismiss: () => void;
  loading?: boolean;
}

export default React.memo(function ContactsPermissionCard({
  onRequestPermission,
  onDismiss,
  loading,
}: ContactsPermissionCardProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceVariant }]}>
      <View
        style={[styles.iconWrap, { backgroundColor: colors.primaryContainer }]}
      >
        <MaterialCommunityIcons
          name="contacts-outline"
          size={32}
          color={colors.onPrimaryContainer}
        />
      </View>

      <Text
        variant="titleMedium"
        style={[styles.title, { color: colors.onSurface }]}
      >
        Find people you already know
      </Text>

      <Text
        variant="bodySmall"
        style={[styles.description, { color: colors.onSurfaceVariant }]}
      >
        We'll check your contacts to find friends already on SnapStyle and help
        you invite others. Your contacts are only used for matching — never
        stored or shared.
      </Text>

      <View style={styles.bulletRow}>
        <MaterialCommunityIcons
          name="shield-check-outline"
          size={16}
          color={colors.primary}
        />
        <Text
          variant="bodySmall"
          style={[styles.bulletText, { color: colors.onSurfaceVariant }]}
        >
          You can deny and still share links, QR codes, or add manually
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          mode="contained"
          onPress={onRequestPermission}
          loading={loading}
          disabled={loading}
          style={styles.primaryBtn}
        >
          Find Friends
        </Button>
        <Button
          mode="text"
          onPress={onDismiss}
          textColor={colors.onSurfaceVariant}
          compact
        >
          Not now
        </Button>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  description: {
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  bulletText: {
    flex: 1,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  primaryBtn: {
    minWidth: 120,
  },
});
