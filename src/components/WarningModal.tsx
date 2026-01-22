/**
 * Warning Modal Component
 * Phase 21: Trust & Safety - Display warnings to users
 *
 * Shows a modal when user has unread warnings that must be acknowledged
 * before continuing to use the app.
 */

import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Portal, Modal, Text, Button, Divider } from "react-native-paper";
import { AppColors, Spacing, BorderRadius } from "../../constants/theme";
import { useAuth } from "@/store/AuthContext";
import {
  getUnreadWarnings,
  acknowledgeWarning,
  BAN_REASON_LABELS,
} from "@/services/moderation";
import type { UserWarning, BanReason } from "@/types/models";

export default function WarningModal() {
  const { currentFirebaseUser } = useAuth();
  const [warnings, setWarnings] = useState<UserWarning[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [acknowledging, setAcknowledging] = useState(false);

  // Fetch unread warnings on mount and when user changes
  useEffect(() => {
    if (!currentFirebaseUser) {
      setWarnings([]);
      return;
    }

    const loadWarnings = async () => {
      try {
        const unreadWarnings = await getUnreadWarnings(currentFirebaseUser.uid);
        setWarnings(unreadWarnings);
        setCurrentIndex(0);
      } catch (error) {
        console.error("[WarningModal] Error loading warnings:", error);
      }
    };

    loadWarnings();
  }, [currentFirebaseUser]);

  const currentWarning = warnings[currentIndex];
  const hasWarnings = warnings.length > 0;

  const handleAcknowledge = async () => {
    if (!currentWarning) return;

    setAcknowledging(true);
    try {
      await acknowledgeWarning(currentWarning.id);

      // Move to next warning or close modal
      if (currentIndex < warnings.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // All warnings acknowledged
        setWarnings([]);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error("[WarningModal] Error acknowledging warning:", error);
    } finally {
      setAcknowledging(false);
    }
  };

  if (!hasWarnings) {
    return null;
  }

  return (
    <Portal>
      <Modal
        visible={hasWarnings}
        dismissable={false}
        contentContainerStyle={styles.modalContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.title}>Warning</Text>
          </View>

          <Text style={styles.countText}>
            {warnings.length > 1
              ? `Warning ${currentIndex + 1} of ${warnings.length}`
              : "You have received a warning"}
          </Text>

          <Divider style={styles.divider} />

          <View style={styles.reasonSection}>
            <Text style={styles.sectionLabel}>Reason</Text>
            <Text style={styles.reasonText}>
              {BAN_REASON_LABELS[currentWarning.reason as BanReason] ||
                currentWarning.reason}
            </Text>
          </View>

          {currentWarning.details && (
            <View style={styles.detailsSection}>
              <Text style={styles.sectionLabel}>Details</Text>
              <View style={styles.detailsBox}>
                <Text style={styles.detailsText}>{currentWarning.details}</Text>
              </View>
            </View>
          )}

          <View style={styles.dateSection}>
            <Text style={styles.dateText}>
              Issued on:{" "}
              {new Date(currentWarning.issuedAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>

          <Divider style={styles.divider} />

          <Text style={styles.infoText}>
            This warning has been added to your account record. Continued
            violations may result in strikes or a ban from the platform.
          </Text>

          <Text style={styles.infoText}>
            Please review our Community Guidelines to ensure you understand
            acceptable behavior.
          </Text>

          <Button
            mode="contained"
            onPress={handleAcknowledge}
            loading={acknowledging}
            disabled={acknowledging}
            style={styles.acknowledgeButton}
            buttonColor={AppColors.primary}
          >
            {warnings.length > 1 && currentIndex < warnings.length - 1
              ? "Acknowledge & Continue"
              : "I Understand"}
          </Button>
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: AppColors.surface,
    margin: 20,
    borderRadius: BorderRadius.lg,
    maxHeight: "80%",
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  warningIcon: {
    fontSize: 32,
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FF9800", // Orange warning color
  },
  countText: {
    fontSize: 14,
    color: AppColors.textSecondary,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  divider: {
    backgroundColor: AppColors.divider,
    marginVertical: Spacing.md,
  },
  reasonSection: {
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: AppColors.textSecondary,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 16,
    fontWeight: "600",
    color: AppColors.textPrimary,
  },
  detailsSection: {
    marginBottom: Spacing.md,
  },
  detailsBox: {
    backgroundColor: AppColors.surfaceVariant,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  detailsText: {
    fontSize: 14,
    color: AppColors.textPrimary,
    lineHeight: 20,
  },
  dateSection: {
    marginBottom: Spacing.sm,
  },
  dateText: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
  infoText: {
    fontSize: 14,
    color: AppColors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  acknowledgeButton: {
    marginTop: Spacing.md,
  },
});
