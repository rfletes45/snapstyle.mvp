/**
 * Admin Reports Queue Screen
 *
 * Features:
 * - View pending reports
 * - Take actions (dismiss, warn, strike, ban)
 * - View user history
 *
 * Access: Gated by admin custom claim
 */

import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import {
  adminApplyStrike,
  adminApplyWarning,
  adminResolveReport,
  adminSetBan,
  BAN_REASON_LABELS,
  getPendingReports,
  getUserStrikes,
  subscribeToPendingReports,
} from "@/services/moderation";
import { REPORT_REASON_LABELS } from "@/services/reporting";
import { getUserProfile } from "@/services/users";
import { useAuth } from "@/store/AuthContext";
import type { BanReason, Report, User, UserStrike } from "@/types/models";
import { LIST_PERFORMANCE_PROPS } from "@/utils/listPerformance";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  Modal,
  Portal,
  RadioButton,
  Snackbar,
  Text,
  TextInput,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "../../store/ThemeContext";

// Ban duration options for the modal
const BAN_DURATION_OPTIONS = [
  { label: "1 Day", value: 24 * 60 * 60 * 1000 },
  { label: "3 Days", value: 3 * 24 * 60 * 60 * 1000 },
  { label: "1 Week", value: 7 * 24 * 60 * 60 * 1000 },
  { label: "1 Month", value: 30 * 24 * 60 * 60 * 1000 },
  { label: "Permanent", value: null },
];

export default function AdminReportsQueueScreen({ navigation }: any) {
  const { currentFirebaseUser, customClaims } = useAuth();
  const colors = useColors();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Action modal state
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedAction, setSelectedAction] = useState<
    "none" | "warning" | "strike" | "ban"
  >("none");
  const [resolution, setResolution] = useState("");
  const [banDuration, setBanDuration] = useState<number | null>(
    24 * 60 * 60 * 1000,
  );
  const [actionLoading, setActionLoading] = useState(false);

  // User info modal
  const [userInfoModalVisible, setUserInfoModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserStrikes, setSelectedUserStrikes] =
    useState<UserStrike | null>(null);
  const [userInfoLoading, setUserInfoLoading] = useState(false);

  // Snackbar
  const [snackbar, setSnackbar] = useState({ visible: false, message: "" });

  // Check admin access
  const isAdmin = customClaims?.admin === true;

  // Load reports
  useEffect(() => {
    if (!currentFirebaseUser) return;

    const unsubscribe = subscribeToPendingReports((newReports) => {
      setReports(newReports);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentFirebaseUser]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const freshReports = await getPendingReports();
      setReports(freshReports);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // View user info
  const handleViewUser = async (uid: string) => {
    setUserInfoLoading(true);
    setUserInfoModalVisible(true);

    try {
      const [profile, strikes] = await Promise.all([
        getUserProfile(uid),
        getUserStrikes(uid),
      ]);

      setSelectedUser(profile);
      setSelectedUserStrikes(strikes);
    } catch (err: any) {
      console.error("Error loading user info:", err);
    } finally {
      setUserInfoLoading(false);
    }
  };

  // Open action modal for a report
  const handleOpenActionModal = (report: Report) => {
    setSelectedReport(report);
    setSelectedAction("none");
    setResolution("");
    setBanDuration(24 * 60 * 60 * 1000);
    setActionModalVisible(true);
  };

  // Submit action
  const handleSubmitAction = async () => {
    if (!selectedReport) return;

    setActionLoading(true);
    try {
      // Apply warning if selected
      if (selectedAction === "warning") {
        await adminApplyWarning(
          selectedReport.reportedUserId,
          selectedReport.reason as BanReason,
          resolution,
          selectedReport.id,
        );
      }

      // Apply strike if selected
      if (selectedAction === "strike") {
        await adminApplyStrike(
          selectedReport.reportedUserId,
          selectedReport.reason as BanReason,
          resolution,
          selectedReport.id,
        );
      }

      // Apply ban if selected
      if (selectedAction === "ban") {
        await adminSetBan(
          selectedReport.reportedUserId,
          selectedReport.reason as BanReason,
          banDuration,
          resolution,
        );
      }

      // Resolve the report
      await adminResolveReport(selectedReport.id, resolution, selectedAction);

      setSnackbar({
        visible: true,
        message:
          selectedAction === "none"
            ? "Report dismissed"
            : `Action taken: ${selectedAction}`,
      });

      setActionModalVisible(false);
    } catch (err: any) {
      if (Platform.OS === "web") {
        setSnackbar({
          visible: true,
          message: err.message || "Failed to process action",
        });
      } else {
        Alert.alert("Error", err.message || "Failed to process action");
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Render a report card
  const renderReportCard = ({ item: report }: { item: Report }) => (
    <Card style={[styles.reportCard, { backgroundColor: colors.surface }]}>
      <Card.Content>
        <View style={styles.reportHeader}>
          <Chip
            mode="flat"
            style={[
              styles.reasonChip,
              { backgroundColor: getReasonColor(report.reason) },
            ]}
            textStyle={{ color: "#FFFFFF", fontSize: 12 }}
          >
            {REPORT_REASON_LABELS[report.reason]}
          </Chip>
          <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
            {new Date(report.createdAt).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.userRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Reported User:
          </Text>
          <Button
            mode="text"
            compact
            onPress={() => handleViewUser(report.reportedUserId)}
            textColor={colors.primary}
          >
            View Profile
          </Button>
        </View>

        <View style={styles.userRow}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Reporter:
          </Text>
          <Button
            mode="text"
            compact
            onPress={() => handleViewUser(report.reporterId)}
            textColor={colors.secondary}
          >
            View Profile
          </Button>
        </View>

        {report.description && (
          <View
            style={[
              styles.descriptionBox,
              { backgroundColor: colors.surfaceVariant },
            ]}
          >
            <Text
              style={[styles.descriptionLabel, { color: colors.textSecondary }]}
            >
              Description:
            </Text>
            <Text
              style={[styles.descriptionText, { color: colors.textPrimary }]}
            >
              {report.description}
            </Text>
          </View>
        )}

        {report.relatedContent && (
          <Chip mode="outlined" style={styles.contentChip}>
            Related: {report.relatedContent.type}
          </Chip>
        )}
      </Card.Content>

      <Card.Actions style={styles.cardActions}>
        <Button
          mode="outlined"
          onPress={() => handleOpenActionModal(report)}
          textColor={colors.primary}
        >
          Take Action
        </Button>
      </Card.Actions>
    </Card>
  );

  // Get color based on report reason
  const getReasonColor = (reason: string): string => {
    switch (reason) {
      case "harassment":
        return "#F44336";
      case "spam":
        return "#FF9800";
      case "inappropriate_content":
        return "#E91E63";
      case "fake_account":
        return "#9C27B0";
      default:
        return "#607D8B";
    }
  };

  // Non-admin view
  if (!isAdmin) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ErrorState
          title="Access Denied"
          message="You don't have permission to access this page."
          onRetry={() => navigation.goBack()}
          retryLabel="Go Back"
        />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <LoadingState message="Loading reports..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ErrorState message={error} onRetry={handleRefresh} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <IconButton
          icon="arrow-left"
          onPress={() => navigation.goBack()}
          iconColor={colors.textPrimary}
        />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Reports Queue
        </Text>
        <View style={[styles.headerBadge, { backgroundColor: colors.primary }]}>
          <Text
            style={[styles.headerBadgeText, { color: colors.textOnPrimary }]}
          >
            {reports.length}
          </Text>
        </View>
      </View>

      {reports.length === 0 ? (
        <EmptyState
          icon="check-circle"
          title="All Clear!"
          subtitle="No pending reports to review."
        />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderReportCard}
          {...LIST_PERFORMANCE_PROPS}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* Action Modal */}
      <Portal>
        <Modal
          visible={actionModalVisible}
          onDismiss={() => setActionModalVisible(false)}
          contentContainerStyle={[
            styles.modalContent,
            { backgroundColor: colors.surface },
          ]}
        >
          <ScrollView>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Take Action
            </Text>

            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
              Action
            </Text>
            <RadioButton.Group
              value={selectedAction}
              onValueChange={(v) =>
                setSelectedAction(v as "none" | "warning" | "strike" | "ban")
              }
            >
              <RadioButton.Item
                label="Dismiss (No action)"
                value="none"
                labelStyle={[styles.radioLabel, { color: colors.textPrimary }]}
              />
              <RadioButton.Item
                label="Warning"
                value="warning"
                labelStyle={[styles.radioLabel, { color: colors.textPrimary }]}
              />
              <RadioButton.Item
                label="Issue Strike"
                value="strike"
                labelStyle={[styles.radioLabel, { color: colors.textPrimary }]}
              />
              <RadioButton.Item
                label="Ban User"
                value="ban"
                labelStyle={[styles.radioLabel, { color: colors.textPrimary }]}
              />
            </RadioButton.Group>

            {selectedAction === "ban" && (
              <>
                <Divider
                  style={[styles.divider, { backgroundColor: colors.divider }]}
                />
                <Text
                  style={[styles.sectionLabel, { color: colors.textPrimary }]}
                >
                  Ban Duration
                </Text>
                {BAN_DURATION_OPTIONS.map((option) => (
                  <RadioButton.Item
                    key={option.label}
                    label={option.label}
                    value={String(option.value)}
                    status={
                      banDuration === option.value ? "checked" : "unchecked"
                    }
                    onPress={() => setBanDuration(option.value)}
                    labelStyle={[
                      styles.radioLabel,
                      { color: colors.textPrimary },
                    ]}
                  />
                ))}
              </>
            )}

            <Divider
              style={[styles.divider, { backgroundColor: colors.divider }]}
            />

            <TextInput
              label="Resolution Notes"
              value={resolution}
              onChangeText={setResolution}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.notesInput}
              placeholder="Add notes about your decision..."
            />

            <View style={styles.modalActions}>
              <Button
                mode="text"
                onPress={() => setActionModalVisible(false)}
                textColor={colors.textSecondary}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmitAction}
                loading={actionLoading}
                disabled={actionLoading}
                buttonColor={
                  selectedAction === "ban"
                    ? "#F44336"
                    : selectedAction === "strike"
                      ? "#FF9800"
                      : colors.primary
                }
              >
                {selectedAction === "none" ? "Dismiss" : "Apply Action"}
              </Button>
            </View>
          </ScrollView>
        </Modal>

        {/* User Info Modal */}
        <Modal
          visible={userInfoModalVisible}
          onDismiss={() => setUserInfoModalVisible(false)}
          contentContainerStyle={[
            styles.modalContent,
            { backgroundColor: colors.surface },
          ]}
        >
          {userInfoLoading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <ScrollView>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                User Info
              </Text>

              {selectedUser && (
                <>
                  <View style={styles.userInfoRow}>
                    <Text
                      style={[
                        styles.userInfoLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Username:
                    </Text>
                    <Text
                      style={[
                        styles.userInfoValue,
                        { color: colors.textPrimary },
                      ]}
                    >
                      @{selectedUser.username}
                    </Text>
                  </View>
                  <View style={styles.userInfoRow}>
                    <Text
                      style={[
                        styles.userInfoLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Display Name:
                    </Text>
                    <Text
                      style={[
                        styles.userInfoValue,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {selectedUser.displayName}
                    </Text>
                  </View>
                  <View style={styles.userInfoRow}>
                    <Text
                      style={[
                        styles.userInfoLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      UID:
                    </Text>
                    <Text
                      style={[
                        styles.userInfoValueSmall,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {selectedUser.uid}
                    </Text>
                  </View>
                  <View style={styles.userInfoRow}>
                    <Text
                      style={[
                        styles.userInfoLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Joined:
                    </Text>
                    <Text
                      style={[
                        styles.userInfoValue,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {new Date(selectedUser.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </>
              )}

              <Divider
                style={[styles.divider, { backgroundColor: colors.divider }]}
              />

              <Text
                style={[styles.sectionLabel, { color: colors.textPrimary }]}
              >
                Strike History
              </Text>
              {selectedUserStrikes ? (
                <>
                  <Chip
                    mode="flat"
                    style={[
                      styles.strikeChip,
                      {
                        backgroundColor:
                          selectedUserStrikes.strikeCount >= 3
                            ? "#F44336"
                            : selectedUserStrikes.strikeCount >= 2
                              ? "#FF9800"
                              : "#4CAF50",
                      },
                    ]}
                  >
                    {selectedUserStrikes.strikeCount} Strike
                    {selectedUserStrikes.strikeCount !== 1 ? "s" : ""}
                  </Chip>

                  {selectedUserStrikes.strikeHistory.map((strike, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.strikeItem,
                        { backgroundColor: colors.surfaceVariant },
                      ]}
                    >
                      <Text
                        style={[
                          styles.strikeReason,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {BAN_REASON_LABELS[strike.reason as BanReason] ||
                          strike.reason}
                      </Text>
                      <Text
                        style={[
                          styles.strikeDate,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {new Date(strike.issuedAt).toLocaleDateString()}
                      </Text>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={[styles.noStrikes, { color: colors.success }]}>
                  No strikes on record
                </Text>
              )}

              <Button
                mode="text"
                onPress={() => setUserInfoModalVisible(false)}
                style={styles.closeButton}
              >
                Close
              </Button>
            </ScrollView>
          )}
        </Modal>
      </Portal>

      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar({ visible: false, message: "" })}
        duration={3000}
      >
        {snackbar.message}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
  },
  headerBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  headerBadgeText: {
    fontWeight: "bold",
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  reportCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  reasonChip: {
    borderRadius: 16,
  },
  timestamp: {
    fontSize: 12,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
  },
  descriptionBox: {
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  descriptionLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
  },
  contentChip: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
  cardActions: {
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  modalContent: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 8,
  },
  radioLabel: {},
  divider: {
    marginVertical: 16,
  },
  notesInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  userInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  userInfoLabel: {
    fontSize: 14,
  },
  userInfoValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  userInfoValueSmall: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  strikeChip: {
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  strikeItem: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  strikeReason: {
    fontSize: 14,
    fontWeight: "500",
  },
  strikeDate: {
    fontSize: 12,
    marginTop: 4,
  },
  noStrikes: {
    fontSize: 14,
    fontStyle: "italic",
  },
  closeButton: {
    marginTop: 16,
  },
});
