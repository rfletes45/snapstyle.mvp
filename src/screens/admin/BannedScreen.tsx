/**
 * Banned Screen
 *
 * Displays ban information and prevents access to the app
 */

import { logout } from "@/services/auth";
import { BAN_REASON_LABELS, formatBanDuration } from "@/services/moderation";
import type { Ban, BanReason } from "@/types/models";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/store/ThemeContext";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/admin/BannedScreen");
interface BannedScreenProps {
  ban: Ban;
}

export default function BannedScreen({ ban }: BannedScreenProps) {
  const colors = useColors();
  const isPermanent = ban.expiresAt === null;
  const reasonLabel = BAN_REASON_LABELS[ban.reason as BanReason] || ban.reason;

  const handleSignOut = async () => {
    try {
      const result = await logout();
      if (!result.ok) {
        logger.error("Error signing out:", result);
      }
    } catch (error) {
      logger.error("Error signing out:", error);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.content}>
        <MaterialCommunityIcons
          name="shield-alert"
          size={80}
          color="#F44336"
          style={styles.icon}
        />

        <Text style={[styles.title, { color: colors.error }]}>
          Account Suspended
        </Text>

        <Text style={[styles.message, { color: colors.textMuted }]}>
          Your account has been suspended for violating our community
          guidelines.
        </Text>

        <View style={[styles.infoBox, { backgroundColor: colors.surface }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              Reason:
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {reasonLabel}
            </Text>
          </View>

          {ban.reasonDetails && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                Details:
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {ban.reasonDetails}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              Duration:
            </Text>
            <Text
              style={[
                styles.infoValue,
                { color: colors.text },
                isPermanent && { color: colors.error },
              ]}
            >
              {formatBanDuration(ban)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              Banned on:
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {new Date(ban.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {!isPermanent && (
          <Text style={[styles.expiryNote, { color: colors.success }]}>
            Your suspension will automatically be lifted when the duration
            expires. Please review our community guidelines before returning.
          </Text>
        )}

        {isPermanent && (
          <Text style={[styles.permanentNote, { color: colors.warning }]}>
            This suspension is permanent. If you believe this was a mistake, you
            may contact support.
          </Text>
        )}

        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={handleSignOut}
            textColor="#888"
            style={[styles.signOutButton, { borderColor: colors.border }]}
          >
            Sign Out
          </Button>
        </View>

        <Text style={[styles.supportText, { color: colors.textSecondary }]}>
          Questions? Contact support@snapstyle.app
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  infoBox: {
    borderRadius: 12,
    padding: 20,
    width: "100%",
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
    marginLeft: 16,
  },
  permanentText: {},
  expiryNote: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  permanentNote: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  actions: {
    marginBottom: 24,
  },
  signOutButton: {},
  supportText: {
    fontSize: 12,
    textAlign: "center",
  },
});
