/**
 * Sync Services Export
 *
 * @file src/services/sync/index.ts
 */

export {
  cancelMessage,
  fullSyncConversation,
  getActiveSubscriptionCount,
  getConversationsWithPending,
  getSyncCursor,
  // State management
  getSyncState,
  hasActiveSubscription,
  isBackgroundSyncRunning,
  // Pull sync (download)
  pullMessages,
  refreshPendingCount,
  resetSyncCursor,
  // Utilities
  retryMessage,
  setOnlineStatus,
  // Background sync
  startBackgroundSync,
  stopBackgroundSync,
  subscribeSyncState,
  // Real-time subscriptions
  subscribeToConversation,
  // Push sync (upload)
  syncPendingMessages,
  unsubscribeAll,
  unsubscribeFromConversation,
  // Types
  type SyncState,
} from "./syncEngine";
