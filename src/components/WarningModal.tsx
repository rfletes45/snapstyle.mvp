/**
 * Warning Modal Component
 *
 * Shows a modal when user has unread warnings that must be acknowledged
 * before continuing to use the app.
 */

import {
  acknowledgeWarning,
  BAN_REASON_LABELS,
  getUnreadWarnings,
} from "@/services/moderation";
import { useAuth } from "@/store/AuthContext";
import type { BanReason, UserWarning } from "@/types/models";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Divider, Modal, Portal, Text } from "react-native-paper";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useColors } from "@/store/ThemeContext";


import { createLogger } from "@/utils/log";
const logger = createLogger("components/WarningModal");
export default function WarningModal() {
  const { currentFirebaseUser } = useAuth();
  const colors = useColors();
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
        logger.error("[WarningModal] Error loading warnings:", error);
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
      logger.error("[WarningModal] Error acknowledging warning:", error);
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
        contentContainerStyle={[
          styles.modalContainer,
          { backgroundColor: colors.surface },
        ]}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.title}>Warning</Text>
          </View>

          <Text style={[styles.countText, { color: colors.textSecondary }]}>
            {warnings.length > 1
              ? `Warning ${currentIndex + 1} of ${warnings.length}`
              : "You have received a warning"}
          </Text>

          <Divider
            style={[styles.divider, { backgroundColor: colors.divider }]}
          />

          <View style={styles.reasonSection}>
            <Text
              style={[styles.sectionLabel, { color: colors.textSecondary }]}
            >
              Reason
            </Text>
            <Text style={[styles.reasonText, { color: colors.text }]}>
              {BAN_REASON_LABELS[currentWarning.reason as BanReason] ||
                currentWarning.reason}
            </Text>
          </View>

          {currentWarning.details && (
            <View style={styles.detailsSection}>
              <Text
                style={[styles.sectionLabel, { color: colors.textSecondary }]}
              >
                Details
              </Text>
              <View
                style={[
                  styles.detailsBox,
                  { backgroundColor: colors.surfaceVariant },
                ]}
              >
                <Text
                  style={[styles.detailsText, { color: colors.text }]}
                >
                  {currentWarning.details}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.dateSection}>
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>
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

          <Divider
            style={[styles.divider, { backgroundColor: colors.divider }]}
          />

          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            This warning has been added to your account record. Continued
            violations may result in strikes or a ban from the platform.
          </Text>

          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Please review our Community Guidelines to ensure you understand
            acceptable behavior.
          </Text>

          <Button
            mode="contained"
            onPress={handleAcknowledge}
            loading={acknowledging}
            disabled={acknowledging}
            style={styles.acknowledgeButton}
            buttonColor={colors.primary}
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
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  divider: {
    marginVertical: Spacing.md,
  },
  reasonSection: {
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  detailsSection: {
    marginBottom: Spacing.md,
  },
  detailsBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  detailsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  dateSection: {
    marginBottom: Spacing.sm,
  },
  dateText: {
    fontSize: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  acknowledgeButton: {
    marginTop: Spacing.md,
  },
});
