/**
 * CallHistoryService - Manages call history storage and retrieval
 * Provides CRUD operations for call history entries with filtering and stats
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Unsubscribe,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  Call,
  CallHistoryEntry,
  CallHistoryFilter,
  CallHistoryStats,
} from "@/types/call";
import { formatDurationFull } from "@/utils/time";
import { getAuthInstance, getFirestoreInstance } from "@/services/firebase";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/calls/callHistoryService");
// Lazy getters to avoid accessing Firebase before initialization
const getDb = () => getFirestoreInstance();
const getAuth = () => getAuthInstance();

// Logging
const logInfo = (msg: string, data?: any) =>
  logger.info(`[CallHistoryService] ${msg}`, data ?? "");
const logError = (msg: string, error?: any) =>
  logger.error(`[CallHistoryService] ${msg}`, error ?? "");
const logDebug = (msg: string, data?: any) =>
  __DEV__ && logger.info(`[CallHistoryService] ${msg}`, data ?? "");

class CallHistoryService {
  private static instance: CallHistoryService;
  private historyCache: Map<string, CallHistoryEntry[]> = new Map();
  private subscription: Unsubscribe | null = null;

  private constructor() {}

  static getInstance(): CallHistoryService {
    if (!CallHistoryService.instance) {
      CallHistoryService.instance = new CallHistoryService();
    }
    return CallHistoryService.instance;
  }

  // ============================================================================
  // History Operations
  // ============================================================================

  /**
   * Get the current user's call history
   */
  async getCallHistory(
    filter?: CallHistoryFilter,
    maxResults: number = 50,
  ): Promise<CallHistoryEntry[]> {
    const userId = getAuth().currentUser?.uid;
    if (!userId) {
      logError("Cannot get call history - user not authenticated");
      return [];
    }

    try {
      const historyRef = collection(getDb(), "Users", userId, "CallHistory");
      let q = query(
        historyRef,
        orderBy("createdAt", "desc"),
        limit(maxResults),
      );

      // Apply filters if provided
      if (filter) {
        if (filter.type && filter.type !== "all") {
          q = query(q, where("type", "==", filter.type));
        }
        if (filter.scope && filter.scope !== "all") {
          q = query(q, where("scope", "==", filter.scope));
        }
        if (filter.direction && filter.direction !== "all") {
          if (filter.direction === "missed") {
            q = query(q, where("wasAnswered", "==", false));
          } else {
            q = query(q, where("direction", "==", filter.direction));
          }
        }
        if (filter.startDate) {
          q = query(q, where("createdAt", ">=", filter.startDate));
        }
        if (filter.endDate) {
          q = query(q, where("createdAt", "<=", filter.endDate));
        }
      }

      const snapshot = await getDocs(q);
      const entries: CallHistoryEntry[] = [];

      snapshot.forEach((docSnap) => {
        entries.push(docSnap.data() as CallHistoryEntry);
      });

      // Filter by contactId locally if specified (Firestore doesn't support array contains for nested objects)
      if (filter?.contactId) {
        return entries.filter((entry) =>
          entry.otherParticipants.some((p) => p.odId === filter.contactId),
        );
      }

      logDebug(`Fetched ${entries.length} call history entries`);
      return entries;
    } catch (error) {
      logError("Error fetching call history", error);
      throw error;
    }
  }

  /**
   * Get a single call history entry
   */
  async getCallHistoryEntry(callId: string): Promise<CallHistoryEntry | null> {
    const userId = getAuth().currentUser?.uid;
    if (!userId) return null;

    try {
      const docRef = doc(getDb(), "Users", userId, "CallHistory", callId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data() as CallHistoryEntry;
      }
      return null;
    } catch (error) {
      logError("Error fetching call history entry", error);
      return null;
    }
  }

  /**
   * Delete a call history entry
   */
  async deleteCallHistoryEntry(callId: string): Promise<void> {
    const userId = getAuth().currentUser?.uid;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    try {
      const docRef = doc(getDb(), "Users", userId, "CallHistory", callId);
      await deleteDoc(docRef);
      logInfo("Deleted call history entry", { callId });
    } catch (error) {
      logError("Error deleting call history entry", error);
      throw error;
    }
  }

  /**
   * Delete multiple call history entries
   */
  async deleteMultipleEntries(callIds: string[]): Promise<void> {
    const userId = getAuth().currentUser?.uid;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    try {
      const batch = writeBatch(getDb());

      for (const callId of callIds) {
        const docRef = doc(getDb(), "Users", userId, "CallHistory", callId);
        batch.delete(docRef);
      }

      await batch.commit();
      logInfo(`Deleted ${callIds.length} call history entries`);
    } catch (error) {
      logError("Error deleting multiple call history entries", error);
      throw error;
    }
  }

  /**
   * Clear all call history
   */
  async clearAllHistory(): Promise<void> {
    const userId = getAuth().currentUser?.uid;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    try {
      const historyRef = collection(getDb(), "Users", userId, "CallHistory");
      const snapshot = await getDocs(historyRef);

      const batch = writeBatch(getDb());
      snapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      await batch.commit();
      logInfo("Cleared all call history");
    } catch (error) {
      logError("Error clearing call history", error);
      throw error;
    }
  }

  /**
   * Add a call to history (called when call ends)
   * Note: This is typically handled by Cloud Functions, but can be called locally for immediate updates
   */
  async addToHistory(call: Call, userId: string): Promise<void> {
    try {
      const participant = call.participants[userId];
      if (!participant) {
        logError("User is not a participant in call");
        return;
      }

      const otherParticipants = Object.entries(call.participants)
        .filter(([id]) => id !== userId)
        .map(([, p]) => ({
          odId: p.odId,
          displayName: p.displayName,
          avatarConfig: p.avatarConfig,
        }));

      const duration =
        call.answeredAt && call.endedAt
          ? Math.floor((call.endedAt - call.answeredAt) / 1000)
          : null;

      const entry: CallHistoryEntry = {
        callId: call.id,
        odId: userId,
        otherParticipants,
        type: call.type,
        scope: call.scope,
        status: call.status,
        direction: userId === call.callerId ? "outgoing" : "incoming",
        createdAt: call.createdAt,
        duration,
        wasAnswered: call.answeredAt !== null,
      };

      const docRef = doc(getDb(), "Users", userId, "CallHistory", call.id);
      await setDoc(docRef, entry);

      logDebug("Added call to history", { callId: call.id });
    } catch (error) {
      logError("Error adding call to history", error);
    }
  }

  // ============================================================================
  // Real-time Subscriptions
  // ============================================================================

  /**
   * Subscribe to real-time call history updates
   */
  subscribeToHistory(
    onUpdate: (entries: CallHistoryEntry[]) => void,
    maxResults: number = 50,
  ): () => void {
    const userId = getAuth().currentUser?.uid;
    if (!userId) {
      logError("Cannot subscribe to history - user not authenticated");
      return () => {};
    }

    const historyRef = collection(getDb(), "Users", userId, "CallHistory");
    const q = query(
      historyRef,
      orderBy("createdAt", "desc"),
      limit(maxResults),
    );

    this.subscription = onSnapshot(
      q,
      (snapshot) => {
        const entries: CallHistoryEntry[] = [];
        snapshot.forEach((docSnap) => {
          entries.push(docSnap.data() as CallHistoryEntry);
        });
        this.historyCache.set(userId, entries);
        onUpdate(entries);
      },
      (error) => {
        logError("Error in history subscription", error);
      },
    );

    return () => {
      if (this.subscription) {
        this.subscription();
        this.subscription = null;
      }
    };
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get call statistics for the current user
   */
  async getCallStats(
    filter?: Pick<CallHistoryFilter, "startDate" | "endDate">,
  ): Promise<CallHistoryStats> {
    const history = await this.getCallHistory(
      { ...filter, type: "all", scope: "all", direction: "all" },
      1000, // Get more entries for stats
    );

    const stats: CallHistoryStats = {
      totalCalls: history.length,
      totalDuration: 0,
      incomingCalls: 0,
      outgoingCalls: 0,
      missedCalls: 0,
      averageDuration: 0,
      longestCall: 0,
    };

    const contactCallCount: Map<string, { name: string; count: number }> =
      new Map();

    for (const entry of history) {
      // Direction counts
      if (entry.direction === "incoming") {
        if (entry.wasAnswered) {
          stats.incomingCalls++;
        } else {
          stats.missedCalls++;
        }
      } else {
        stats.outgoingCalls++;
      }

      // Duration stats
      if (entry.duration) {
        stats.totalDuration += entry.duration;
        if (entry.duration > stats.longestCall) {
          stats.longestCall = entry.duration;
        }
      }

      // Contact frequency
      for (const participant of entry.otherParticipants) {
        const existing = contactCallCount.get(participant.odId);
        if (existing) {
          existing.count++;
        } else {
          contactCallCount.set(participant.odId, {
            name: participant.displayName,
            count: 1,
          });
        }
      }
    }

    // Calculate average
    const answeredCalls = history.filter((e) => e.wasAnswered);
    if (answeredCalls.length > 0) {
      stats.averageDuration = Math.floor(
        stats.totalDuration / answeredCalls.length,
      );
    }

    // Find most called contact
    let mostCalled: { odId: string; name: string; count: number } | null = null;
    for (const [odId, data] of contactCallCount.entries()) {
      if (!mostCalled || data.count > mostCalled.count) {
        mostCalled = { odId, ...data };
      }
    }

    if (mostCalled) {
      stats.mostCalledContact = {
        odId: mostCalled.odId,
        displayName: mostCalled.name,
        callCount: mostCalled.count,
      };
    }

    return stats;
  }

  /**
   * Get count of missed calls (for badge)
   */
  async getMissedCallCount(since?: number): Promise<number> {
    const userId = getAuth().currentUser?.uid;
    if (!userId) return 0;

    try {
      const historyRef = collection(getDb(), "Users", userId, "CallHistory");
      let q = query(
        historyRef,
        where("direction", "==", "incoming"),
        where("wasAnswered", "==", false),
      );

      if (since) {
        q = query(q, where("createdAt", ">=", since));
      }

      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      logError("Error getting missed call count", error);
      return 0;
    }
  }

  /**
   * Get recent calls with a specific contact
   */
  async getCallsWithContact(
    contactId: string,
    maxResults: number = 20,
  ): Promise<CallHistoryEntry[]> {
    const history = await this.getCallHistory({ contactId }, maxResults);
    return history;
  }

  // ============================================================================
  // Utility
  // ============================================================================

  /**
   * Mark missed calls as seen (clears badge)
   * This stores the timestamp of the last viewed missed call
   */
  async markMissedCallsSeen(): Promise<void> {
    const userId = getAuth().currentUser?.uid;
    if (!userId) return;

    try {
      const userRef = doc(getDb(), "Users", userId);
      await setDoc(
        userRef,
        { lastMissedCallSeenAt: Date.now() },
        { merge: true },
      );
      logDebug("Marked missed calls as seen");
    } catch (error) {
      logError("Error marking missed calls seen", error);
    }
  }

  /**
   * Get the last seen timestamp for missed calls
   */
  async getLastMissedCallSeenAt(): Promise<number> {
    const userId = getAuth().currentUser?.uid;
    if (!userId) return 0;

    try {
      const userRef = doc(getDb(), "Users", userId);
      const userSnap = await getDoc(userRef);
      return userSnap.data()?.lastMissedCallSeenAt || 0;
    } catch (error) {
      logError("Error getting last missed call seen timestamp", error);
      return 0;
    }
  }

  /**
   * Get count of unseen missed calls (for badge)
   */
  async getUnseenMissedCallCount(): Promise<number> {
    const lastSeen = await this.getLastMissedCallSeenAt();
    return this.getMissedCallCount(lastSeen);
  }

  /**
   * Format duration for display
   * @deprecated Use `formatDurationFull` from `@/utils/time` directly
   */
  formatDuration(seconds: number | null): string {
    return formatDurationFull(seconds);
  }

  /**
   * Format relative time for display
   */
  formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    // Return formatted date for older calls
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  }
}

export const callHistoryService = CallHistoryService.getInstance();
