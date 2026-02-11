/**
 * Local Storage Debug Screen
 *
 * Comprehensive debugging interface for testing the SQLite-based
 * local storage system (Phases 1-6 of the migration plan).
 *
 * Features tested:
 * - Database initialization and stats
 * - Message CRUD operations
 * - Media cache status
 * - Sync engine status
 * - Maintenance utilities
 * - Feature flags
 *
 * @file src/screens/debug/LocalStorageDebugScreen.tsx
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
  IconButton,
  List,
  SegmentedButtons,
  Snackbar,
  Text,
  useTheme,
} from "react-native-paper";

// Services
import { getDatabase } from "@/services/database";
import { getOrCreateDMConversation } from "@/services/database/conversationRepository";
import {
  clearPendingMessages,
  exportDatabaseForDebug,
  getDatabaseStats,
  pruneOldMessages,
  resetLocalData,
  vacuumDatabase,
} from "@/services/database/maintenance";
import {
  getMessagesByStatus,
  getMessagesForConversation,
  insertMessage,
  MessageWithAttachments,
} from "@/services/database/messageRepository";
import {
  CacheStats,
  clearMediaCache,
  getCacheSize,
  getCacheStats,
  initializeMediaCache,
} from "@/services/mediaCache";
import {
  getActiveSubscriptionCount,
  getSyncState,
  isBackgroundSyncRunning,
  setOnlineStatus,
  startBackgroundSync,
  stopBackgroundSync,
  subscribeSyncState,
  syncPendingMessages,
  SyncState,
} from "@/services/sync/syncEngine";

// Feature flags
import { USE_LOCAL_STORAGE } from "@/constants/featureFlags";

// Theme
import { BorderRadius, Spacing } from "@/constants/theme";

// Auth
import { useAuth } from "@/store/AuthContext";


import { createLogger } from "@/utils/log";
const logger = createLogger("screens/debug/LocalStorageDebugScreen");
// =============================================================================
// Types
// =============================================================================

type TabValue = "database" | "sync" | "media" | "maintenance";

interface TestResult {
  name: string;
  status: "pending" | "running" | "success" | "error";
  message?: string;
  duration?: number;
}

// =============================================================================
// Component
// =============================================================================

export default function LocalStorageDebugScreen({ navigation }: any) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();
  const uid = currentFirebaseUser?.uid || "test-user";

  // Tab state
  const [activeTab, setActiveTab] = useState<TabValue>("database");

  // Loading states
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Data states
  const [dbStats, setDbStats] = useState<Record<string, number> | null>(null);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [cacheSize, setCacheSize] = useState<number | null>(null);
  const [recentMessages, setRecentMessages] = useState<
    MessageWithAttachments[]
  >([]);
  const [pendingMessages, setPendingMessages] = useState<
    MessageWithAttachments[]
  >([]);
  const [backgroundSyncActive, setBackgroundSyncActive] = useState(false);

  // Test results
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Snackbar
  const [snackbar, setSnackbar] = useState<{
    visible: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({ visible: false, message: "", type: "info" });

  // =============================================================================
  // Data Loading
  // =============================================================================

  const loadAllData = useCallback(async () => {
    try {
      // First, verify database is accessible
      logger.info("[Debug] loadAllData: Checking database access...");
      try {
        const db = getDatabase();
        logger.info("[Debug] loadAllData: Database accessed successfully");
      } catch (dbError: any) {
        logger.error("[Debug] loadAllData: Database access failed:", dbError);
        showSnackbar(`Database error: ${dbError.message}`, "error");
        return;
      }

      // Database stats
      logger.info("[Debug] loadAllData: Getting database stats...");
      const stats = getDatabaseStats();
      setDbStats(stats);
      logger.info("[Debug] loadAllData: Stats:", stats);

      // Sync state
      const sync = getSyncState();
      setSyncState(sync);

      // Cache stats
      try {
        const cache = await getCacheStats();
        setCacheStats(cache);
        const size = await getCacheSize();
        setCacheSize(size);
      } catch (e) {
        logger.info("[Debug] Cache not initialized yet");
      }

      // Recent messages (first conversation or test)
      try {
        const messages = getMessagesForConversation(
          "test-conversation",
          "dm",
          10,
        );
        setRecentMessages(messages);
      } catch (e) {
        setRecentMessages([]);
      }

      // Pending messages
      try {
        const pending = getMessagesByStatus("pending", 10);
        setPendingMessages(pending);
      } catch (e) {
        setPendingMessages([]);
      }

      // Background sync status
      setBackgroundSyncActive(isBackgroundSyncRunning());
    } catch (error: any) {
      logger.error("[Debug] Error loading data:", error);
      Alert.alert(
        "Data Loading Error",
        `Failed to load debug data:\n\n${error.message}\n\nStack: ${error.stack}`,
        [{ text: "OK" }],
      );
      showSnackbar("Error loading data", "error");
    }
  }, []);

  // Initial load and sync state subscription
  useEffect(() => {
    loadAllData();

    const unsubscribe = subscribeSyncState((state) => {
      setSyncState(state);
    });

    return () => {
      unsubscribe();
    };
  }, [loadAllData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  }, [loadAllData]);

  // =============================================================================
  // Helpers
  // =============================================================================

  const showSnackbar = (
    message: string,
    type: "success" | "error" | "info",
  ) => {
    setSnackbar({ visible: true, message, type });
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatTimestamp = (ts: number | null): string => {
    if (!ts) return "Never";
    return new Date(ts).toLocaleTimeString();
  };

  // =============================================================================
  // Actions
  // =============================================================================

  const handleInsertTestMessage = async () => {
    setActionLoading("insert");
    try {
      logger.info("[Debug] Starting test message insert...");
      logger.info("[Debug] User ID:", uid);

      // Ensure test conversation exists first (required for foreign key constraint)
      logger.info("[Debug] Creating/getting test conversation...");
      let conversation;
      try {
        conversation = getOrCreateDMConversation("test-conversation");
        logger.info(
          "[Debug] Conversation result:",
          JSON.stringify(conversation),
        );
      } catch (convError: any) {
        logger.error("[Debug] Failed to create conversation:", convError);
        Alert.alert(
          "Conversation Creation Failed",
          `Error: ${convError.message}\n\nStack: ${convError.stack}`,
          [{ text: "OK" }],
        );
        throw convError;
      }

      logger.info("[Debug] Inserting message...");
      let message;
      try {
        // Use skipSync: true so test messages don't try to sync to Firebase
        // (the "test-conversation" doesn't exist in Firebase)
        message = insertMessage({
          conversationId: "test-conversation",
          scope: "dm",
          senderId: uid,
          senderName: "Test User",
          kind: "text",
          text: `Test message at ${new Date().toLocaleTimeString()}`,
          skipSync: true, // Local-only test message
        });
        logger.info("[Debug] Message inserted successfully:", message.id);
      } catch (insertError: any) {
        logger.error("[Debug] Failed to insert message:", insertError);
        Alert.alert(
          "Message Insert Failed",
          `Error: ${insertError.message}\n\nStack: ${insertError.stack}`,
          [{ text: "OK" }],
        );
        throw insertError;
      }

      showSnackbar(
        `Inserted message: ${message.id.substring(0, 8)}...`,
        "success",
      );
      await loadAllData();
    } catch (error: any) {
      logger.error("[Debug] Insert failed with error:", error);
      logger.error("[Debug] Error name:", error.name);
      logger.error("[Debug] Error message:", error.message);
      logger.error("[Debug] Error stack:", error.stack);
      showSnackbar(`Insert failed: ${error.message}`, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncNow = async () => {
    setActionLoading("sync");
    try {
      await syncPendingMessages();
      showSnackbar("Sync completed", "success");
      await loadAllData();
    } catch (error: any) {
      showSnackbar(`Sync failed: ${error.message}`, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleBackgroundSync = () => {
    if (backgroundSyncActive) {
      stopBackgroundSync();
      setBackgroundSyncActive(false);
      showSnackbar("Background sync stopped", "info");
    } else {
      startBackgroundSync(30000);
      setBackgroundSyncActive(true);
      showSnackbar("Background sync started (30s interval)", "success");
    }
  };

  const handleToggleOnline = () => {
    if (syncState) {
      setOnlineStatus(!syncState.isOnline);
      showSnackbar(
        `Simulated ${!syncState.isOnline ? "online" : "offline"} mode`,
        "info",
      );
    }
  };

  const handleExportDatabase = async () => {
    setActionLoading("export");
    try {
      const path = await exportDatabaseForDebug();
      showSnackbar(`Exported to: ${path}`, "success");
    } catch (error: any) {
      showSnackbar(`Export failed: ${error.message}`, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearPending = async () => {
    Alert.alert(
      "Clear Pending Messages",
      "This will delete all pending/failed messages. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setActionLoading("clearPending");
            try {
              const count = clearPendingMessages();
              showSnackbar(`Cleared ${count} pending messages`, "success");
              await loadAllData();
            } catch (error: any) {
              showSnackbar(`Clear failed: ${error.message}`, "error");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  const handlePruneOld = async () => {
    Alert.alert(
      "Prune Old Messages",
      "Delete synced messages older than 90 days?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Prune",
          onPress: async () => {
            setActionLoading("prune");
            try {
              const count = pruneOldMessages(90);
              showSnackbar(`Pruned ${count} old messages`, "success");
              await loadAllData();
            } catch (error: any) {
              showSnackbar(`Prune failed: ${error.message}`, "error");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  const handleVacuum = async () => {
    setActionLoading("vacuum");
    try {
      vacuumDatabase();
      showSnackbar("Database vacuumed", "success");
    } catch (error: any) {
      showSnackbar(`Vacuum failed: ${error.message}`, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetAll = async () => {
    Alert.alert(
      "⚠️ Reset All Local Data",
      "This will DELETE all local messages, conversations, and cached media. A backup will be created first. This cannot be undone!",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset Everything",
          style: "destructive",
          onPress: async () => {
            setActionLoading("reset");
            try {
              const result = await resetLocalData(true);
              showSnackbar(
                `Reset complete. Backup at: ${result.exportDirectory || "none"}`,
                "success",
              );
              await loadAllData();
            } catch (error: any) {
              showSnackbar(`Reset failed: ${error.message}`, "error");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ],
    );
  };

  const handleClearMediaCache = async () => {
    Alert.alert("Clear Media Cache", "Delete all cached images and videos?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          setActionLoading("clearMedia");
          try {
            await clearMediaCache();
            showSnackbar("Media cache cleared", "success");
            await loadAllData();
          } catch (error: any) {
            showSnackbar(`Clear failed: ${error.message}`, "error");
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };

  const handleInitMediaCache = async () => {
    setActionLoading("initMedia");
    try {
      await initializeMediaCache();
      showSnackbar("Media cache initialized", "success");
      await loadAllData();
    } catch (error: any) {
      showSnackbar(`Init failed: ${error.message}`, "error");
    } finally {
      setActionLoading(null);
    }
  };

  // =============================================================================
  // Integration Tests
  // =============================================================================

  const runAllTests = async () => {
    setIsRunningTests(true);
    const results: TestResult[] = [];

    const runTest = async (
      name: string,
      testFn: () => Promise<string>,
    ): Promise<void> => {
      const index = results.length;
      results.push({ name, status: "running" });
      setTestResults([...results]);

      const startTime = Date.now();
      try {
        const message = await testFn();
        results[index] = {
          name,
          status: "success",
          message,
          duration: Date.now() - startTime,
        };
      } catch (error: any) {
        results[index] = {
          name,
          status: "error",
          message: error.message,
          duration: Date.now() - startTime,
        };
      }
      setTestResults([...results]);
    };

    // Test 1: Database initialization
    await runTest("Database Init", async () => {
      const db = getDatabase();
      if (!db) throw new Error("Database not initialized");
      return "Database opened successfully";
    });

    // Test 2: Insert message
    await runTest("Insert Message", async () => {
      const msg = insertMessage({
        conversationId: "integration-test",
        scope: "dm",
        senderId: uid,
        kind: "text",
        text: `Integration test ${Date.now()}`,
      });
      if (!msg.id) throw new Error("No message ID returned");
      return `Created message ${msg.id.substring(0, 8)}...`;
    });

    // Test 3: Query messages
    await runTest("Query Messages", async () => {
      const messages = getMessagesForConversation("integration-test", "dm", 10);
      return `Found ${messages.length} messages`;
    });

    // Test 4: Get database stats
    await runTest("Database Stats", async () => {
      const stats = getDatabaseStats();
      return `${stats.messages} messages, ${stats.conversations} conversations`;
    });

    // Test 5: Sync state
    await runTest("Sync State", async () => {
      const state = getSyncState();
      return `Online: ${state.isOnline}, Pending: ${state.pendingCount}`;
    });

    // Test 6: Media cache init
    await runTest("Media Cache Init", async () => {
      await initializeMediaCache();
      return "Media directories ready";
    });

    // Test 7: Cache stats
    await runTest("Cache Stats", async () => {
      const stats = await getCacheStats();
      return `${stats.imageCount} images, ${stats.videoCount} videos`;
    });

    // Test 8: Feature flag
    await runTest("Feature Flag", async () => {
      if (USE_LOCAL_STORAGE !== true && USE_LOCAL_STORAGE !== false) {
        throw new Error("Invalid flag value");
      }
      return `USE_LOCAL_STORAGE = ${USE_LOCAL_STORAGE}`;
    });

    setIsRunningTests(false);
    showSnackbar(
      `Tests complete: ${results.filter((r) => r.status === "success").length}/${results.length} passed`,
      results.every((r) => r.status === "success") ? "success" : "error",
    );
  };

  // =============================================================================
  // Render Helpers
  // =============================================================================

  const renderStatRow = (label: string, value: string | number | null) => (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value ?? "—"}</Text>
    </View>
  );

  const renderActionButton = (
    label: string,
    icon: string,
    onPress: () => void,
    actionKey: string,
    color?: string,
  ) => (
    <Button
      mode="outlined"
      icon={icon}
      onPress={onPress}
      loading={actionLoading === actionKey}
      disabled={actionLoading !== null}
      style={styles.actionButton}
      textColor={color}
    >
      {label}
    </Button>
  );

  // =============================================================================
  // Tab Content
  // =============================================================================

  const renderDatabaseTab = () => (
    <View>
      {/* Stats Card */}
      <Card style={styles.card}>
        <Card.Title
          title="📊 Database Statistics"
          right={() => <IconButton icon="refresh" onPress={onRefresh} />}
        />
        <Card.Content>
          {dbStats ? (
            <>
              {renderStatRow("Conversations", dbStats.conversations)}
              {renderStatRow("Messages", dbStats.messages)}
              {renderStatRow("Pending Messages", dbStats.pendingMessages)}
              {renderStatRow("Failed Messages", dbStats.failedMessages)}
              {renderStatRow("Attachments", dbStats.attachments)}
              {renderStatRow("Reactions", dbStats.reactions)}
            </>
          ) : (
            <ActivityIndicator />
          )}
        </Card.Content>
      </Card>

      {/* Feature Flag */}
      <Card style={styles.card}>
        <Card.Title title="🚩 Feature Flags" />
        <Card.Content>
          <View style={styles.chipRow}>
            <Chip
              icon={USE_LOCAL_STORAGE ? "check" : "close"}
              style={[
                styles.chip,
                {
                  backgroundColor: USE_LOCAL_STORAGE
                    ? theme.colors.primaryContainer
                    : theme.colors.errorContainer,
                },
              ]}
            >
              USE_LOCAL_STORAGE: {USE_LOCAL_STORAGE ? "ON" : "OFF"}
            </Chip>
          </View>
          <Text variant="bodySmall" style={styles.hint}>
            Toggle in constants/featureFlags.ts to rollback
          </Text>
        </Card.Content>
      </Card>

      {/* Test Message */}
      <Card style={styles.card}>
        <Card.Title title="🧪 Test Operations" />
        <Card.Content>
          <Button
            mode="outlined"
            icon="database-check"
            onPress={() => {
              try {
                logger.info("[Debug] Testing database connection...");
                const db = getDatabase();
                const result = db.getFirstSync<{ test: number }>(
                  "SELECT 1 as test",
                );
                logger.info("[Debug] Database test result:", result);
                Alert.alert(
                  "Database Test",
                  `✅ Database is working!\n\nTest query returned: ${JSON.stringify(result)}`,
                  [{ text: "OK" }],
                );
              } catch (error: any) {
                logger.error("[Debug] Database test failed:", error);
                Alert.alert(
                  "Database Test Failed",
                  `❌ Error: ${error.message}\n\nStack: ${error.stack}`,
                  [{ text: "OK" }],
                );
              }
            }}
            style={styles.actionButton}
          >
            Test Database Connection
          </Button>
          {renderActionButton(
            "Insert Test Message",
            "plus",
            handleInsertTestMessage,
            "insert",
          )}
          {renderActionButton(
            "Export Database",
            "export",
            handleExportDatabase,
            "export",
          )}
        </Card.Content>
      </Card>

      {/* Recent Messages */}
      <Card style={styles.card}>
        <Card.Title title="📝 Recent Test Messages" />
        <Card.Content>
          {recentMessages.length === 0 ? (
            <Text style={styles.emptyText}>No messages yet</Text>
          ) : (
            recentMessages.slice(0, 5).map((msg) => (
              <View key={msg.id} style={styles.messageItem}>
                <Text variant="bodySmall" numberOfLines={1}>
                  {msg.text || `[${msg.kind}]`}
                </Text>
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.outline }}
                >
                  Conv: {msg.conversation_id?.substring(0, 12)}... | {msg.scope}
                </Text>
                {msg.sync_error && (
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.error }}
                  >
                    Error: {msg.sync_error}
                  </Text>
                )}
                <View style={styles.messageMetaRow}>
                  <Chip
                    compact
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor:
                          msg.sync_status === "synced"
                            ? theme.colors.primaryContainer
                            : msg.sync_status === "failed"
                              ? theme.colors.errorContainer
                              : theme.colors.surfaceVariant,
                      },
                    ]}
                  >
                    {msg.sync_status}{" "}
                    {msg.retry_count > 0 ? `(${msg.retry_count})` : ""}
                  </Chip>
                  <Text variant="labelSmall">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card.Content>
      </Card>
    </View>
  );

  const renderSyncTab = () => (
    <View>
      {/* Sync Status */}
      <Card style={styles.card}>
        <Card.Title
          title="🔄 Sync Engine Status"
          right={() => (
            <Chip
              icon={syncState?.isOnline ? "wifi" : "wifi-off"}
              style={{
                backgroundColor: syncState?.isOnline
                  ? theme.colors.primaryContainer
                  : theme.colors.errorContainer,
              }}
            >
              {syncState?.isOnline ? "Online" : "Offline"}
            </Chip>
          )}
        />
        <Card.Content>
          {syncState ? (
            <>
              {renderStatRow("Is Syncing", syncState.isSyncing ? "Yes" : "No")}
              {renderStatRow("Pending Count", syncState.pendingCount)}
              {renderStatRow(
                "Last Sync",
                formatTimestamp(syncState.lastSyncAt),
              )}
              {renderStatRow("Error", syncState.error || "None")}
              {renderStatRow(
                "Active Subscriptions",
                getActiveSubscriptionCount(),
              )}
              {renderStatRow(
                "Background Sync",
                backgroundSyncActive ? "Running" : "Stopped",
              )}
            </>
          ) : (
            <ActivityIndicator />
          )}
        </Card.Content>
      </Card>

      {/* Sync Actions */}
      <Card style={styles.card}>
        <Card.Title title="⚡ Sync Actions" />
        <Card.Content>
          {renderActionButton("Sync Now", "sync", handleSyncNow, "sync")}
          {renderActionButton(
            backgroundSyncActive
              ? "Stop Background Sync"
              : "Start Background Sync",
            backgroundSyncActive ? "stop" : "play",
            handleToggleBackgroundSync,
            "bgSync",
          )}
          {renderActionButton(
            syncState?.isOnline ? "Simulate Offline" : "Simulate Online",
            syncState?.isOnline ? "wifi-off" : "wifi",
            handleToggleOnline,
            "online",
          )}
        </Card.Content>
      </Card>

      {/* Pending Messages */}
      <Card style={styles.card}>
        <Card.Title
          title="⏳ Pending/Failed Messages"
          subtitle={`${pendingMessages.length} messages waiting`}
        />
        <Card.Content>
          {pendingMessages.length === 0 ? (
            <Text style={styles.emptyText}>All messages synced!</Text>
          ) : (
            pendingMessages.slice(0, 10).map((msg) => (
              <View key={msg.id} style={styles.messageItem}>
                <Text variant="bodySmall" numberOfLines={1}>
                  {msg.text || `[${msg.kind}]`}
                </Text>
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.outline }}
                >
                  ID: {msg.id.substring(0, 8)} | Conv:{" "}
                  {msg.conversation_id?.substring(0, 8)}
                </Text>
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.outline }}
                >
                  Scope: {msg.scope} | Sender: {msg.sender_id?.substring(0, 8)}
                </Text>
                {msg.sync_error && (
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.error }}
                  >
                    Error: {msg.sync_error}
                  </Text>
                )}
                <Chip
                  compact
                  style={{
                    backgroundColor:
                      msg.sync_status === "failed"
                        ? theme.colors.errorContainer
                        : theme.colors.surfaceVariant,
                    marginTop: 4,
                  }}
                >
                  {msg.sync_status} | Retries: {msg.retry_count}
                </Chip>
              </View>
            ))
          )}
        </Card.Content>
      </Card>
    </View>
  );

  const renderMediaTab = () => (
    <View>
      {/* Cache Stats */}
      <Card style={styles.card}>
        <Card.Title
          title="🖼️ Media Cache"
          subtitle={cacheSize ? formatBytes(cacheSize) : "Unknown size"}
        />
        <Card.Content>
          {cacheStats ? (
            <>
              {renderStatRow("Total Size", formatBytes(cacheStats.totalSize))}
              {renderStatRow("Images", cacheStats.imageCount)}
              {renderStatRow("Videos", cacheStats.videoCount)}
              {renderStatRow("Audio Files", cacheStats.audioCount)}
              {renderStatRow("Other Files", cacheStats.fileCount)}
            </>
          ) : (
            <Text style={styles.emptyText}>
              Cache not initialized. Tap "Initialize" below.
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* Media Actions */}
      <Card style={styles.card}>
        <Card.Title title="🔧 Cache Actions" />
        <Card.Content>
          {renderActionButton(
            "Initialize Cache",
            "folder-plus",
            handleInitMediaCache,
            "initMedia",
          )}
          {renderActionButton(
            "Clear Media Cache",
            "delete",
            handleClearMediaCache,
            "clearMedia",
            theme.colors.error,
          )}
        </Card.Content>
      </Card>
    </View>
  );

  const renderMaintenanceTab = () => (
    <View>
      {/* Quick Actions */}
      <Card style={styles.card}>
        <Card.Title title="🛠️ Maintenance Actions" />
        <Card.Content>
          {renderActionButton(
            "Clear Pending/Failed",
            "broom",
            handleClearPending,
            "clearPending",
          )}
          {renderActionButton(
            "Prune Old Messages (90d)",
            "calendar-remove",
            handlePruneOld,
            "prune",
          )}
          {renderActionButton(
            "Vacuum Database",
            "package-down",
            handleVacuum,
            "vacuum",
          )}
        </Card.Content>
      </Card>

      {/* Danger Zone */}
      <Card style={[styles.card, { borderColor: theme.colors.error }]}>
        <Card.Title
          title="⚠️ Danger Zone"
          titleStyle={{ color: theme.colors.error }}
        />
        <Card.Content>
          {renderActionButton(
            "Reset All Local Data",
            "delete-forever",
            handleResetAll,
            "reset",
            theme.colors.error,
          )}
          <Text variant="bodySmall" style={styles.hint}>
            Creates a backup before reset. Use for troubleshooting only.
          </Text>
        </Card.Content>
      </Card>

      {/* Integration Tests */}
      <Card style={styles.card}>
        <Card.Title
          title="🧪 Integration Tests"
          right={() => (
            <Button
              mode="contained"
              onPress={runAllTests}
              disabled={isRunningTests}
              loading={isRunningTests}
            >
              Run All
            </Button>
          )}
        />
        <Card.Content>
          {testResults.length === 0 ? (
            <Text style={styles.emptyText}>
              Tap "Run All" to test the storage system
            </Text>
          ) : (
            testResults.map((result, index) => (
              <List.Item
                key={index}
                title={result.name}
                description={result.message}
                left={() => (
                  <View style={styles.testIcon}>
                    {result.status === "running" ? (
                      <ActivityIndicator size="small" />
                    ) : result.status === "success" ? (
                      <Text style={{ color: theme.colors.primary }}>✓</Text>
                    ) : result.status === "error" ? (
                      <Text style={{ color: theme.colors.error }}>✗</Text>
                    ) : (
                      <Text>○</Text>
                    )}
                  </View>
                )}
                right={() =>
                  result.duration ? (
                    <Text variant="labelSmall">{result.duration}ms</Text>
                  ) : null
                }
              />
            ))
          )}
        </Card.Content>
      </Card>
    </View>
  );

  // =============================================================================
  // Main Render
  // =============================================================================

  // expo-sqlite doesn't work on web
  if (Platform.OS === "web") {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <Card style={styles.card}>
          <Card.Title title="⚠️ Web Platform Not Supported" />
          <Card.Content>
            <Text variant="bodyMedium">
              The SQLite-based local storage system (expo-sqlite) does not work
              on the web platform. Please test this screen on iOS or Android
              using Expo Go or a development build.
            </Text>
            <View style={{ marginTop: Spacing.md }}>
              <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                Options:
              </Text>
              <Text variant="bodySmall">
                • Scan the QR code with Expo Go on your phone
              </Text>
              <Text variant="bodySmall">
                • Press "a" in the terminal for Android emulator
              </Text>
              <Text variant="bodySmall">
                • Press "i" in the terminal for iOS simulator
              </Text>
            </View>
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TabValue)}
          buttons={[
            { value: "database", label: "DB", icon: "database" },
            { value: "sync", label: "Sync", icon: "sync" },
            { value: "media", label: "Media", icon: "image" },
            { value: "maintenance", label: "Maint", icon: "wrench" },
          ]}
        />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === "database" && renderDatabaseTab()}
        {activeTab === "sync" && renderSyncTab()}
        {activeTab === "media" && renderMediaTab()}
        {activeTab === "maintenance" && renderMaintenanceTab()}
      </ScrollView>

      {/* Snackbar */}
      <Snackbar
        visible={snackbar.visible}
        onDismiss={() => setSnackbar((s) => ({ ...s, visible: false }))}
        duration={3000}
        style={{
          backgroundColor:
            snackbar.type === "error"
              ? theme.colors.errorContainer
              : snackbar.type === "success"
                ? theme.colors.primaryContainer
                : theme.colors.surfaceVariant,
        }}
      >
        <Text
          style={{
            color:
              snackbar.type === "error"
                ? theme.colors.onErrorContainer
                : snackbar.type === "success"
                  ? theme.colors.onPrimaryContainer
                  : theme.colors.onSurfaceVariant,
          }}
        >
          {snackbar.message}
        </Text>
      </Snackbar>
    </View>
  );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  card: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  statLabel: {
    opacity: 0.7,
  },
  statValue: {
    fontWeight: "600",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  chip: {
    marginRight: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  statusChip: {
    height: 24,
  },
  actionButton: {
    marginBottom: Spacing.sm,
  },
  hint: {
    opacity: 0.6,
    marginTop: Spacing.xs,
  },
  emptyText: {
    opacity: 0.5,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: Spacing.md,
  },
  messageItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  messageMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  testIcon: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
});
