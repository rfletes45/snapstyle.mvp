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
import { AppColors } from "../../../constants/theme";

interface BannedScreenProps {
  ban: Ban;
}

export default function BannedScreen({ ban }: BannedScreenProps) {
  const isPermanent = ban.expiresAt === null;
  const reasonLabel = BAN_REASON_LABELS[ban.reason as BanReason] || ban.reason;

  const handleSignOut = async () => {
    try {
      const result = await logout();
      if (!result.ok) {
        console.error("Error signing out:", result);
      }
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <MaterialCommunityIcons
          name="shield-alert"
          size={80}
          color="#F44336"
          style={styles.icon}
        />

        <Text style={styles.title}>Account Suspended</Text>

        <Text style={styles.message}>
          Your account has been suspended for violating our community
          guidelines.
        </Text>

        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Reason:</Text>
            <Text style={styles.infoValue}>{reasonLabel}</Text>
          </View>

          {ban.reasonDetails && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Details:</Text>
              <Text style={styles.infoValue}>{ban.reasonDetails}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Duration:</Text>
            <Text
              style={[styles.infoValue, isPermanent && styles.permanentText]}
            >
              {formatBanDuration(ban)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Banned on:</Text>
            <Text style={styles.infoValue}>
              {new Date(ban.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {!isPermanent && (
          <Text style={styles.expiryNote}>
            Your suspension will automatically be lifted when the duration
            expires. Please review our community guidelines before returning.
          </Text>
        )}

        {isPermanent && (
          <Text style={styles.permanentNote}>
            This suspension is permanent. If you believe this was a mistake, you
            may contact support.
          </Text>
        )}

        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={handleSignOut}
            textColor="#888"
            style={styles.signOutButton}
          >
            Sign Out
          </Button>
        </View>

        <Text style={styles.supportText}>
          Questions? Contact support@snapstyle.app
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
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
    color: AppColors.error,
    marginBottom: 16,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: AppColors.textMuted,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  infoBox: {
    backgroundColor: AppColors.surface,
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
    color: AppColors.textSecondary,
    fontSize: 14,
  },
  infoValue: {
    color: AppColors.textPrimary,
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
    marginLeft: 16,
  },
  permanentText: {
    color: AppColors.error,
  },
  expiryNote: {
    fontSize: 14,
    color: AppColors.success,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  permanentNote: {
    fontSize: 14,
    color: AppColors.warning,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  actions: {
    marginBottom: 24,
  },
  signOutButton: {
    borderColor: AppColors.border,
  },
  supportText: {
    fontSize: 12,
    color: AppColors.textSecondary,
    textAlign: "center",
  },
});
