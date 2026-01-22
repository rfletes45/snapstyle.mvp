/**
 * Moderation Service
 * Phase 21: Trust & Safety - Ban checking, strike tracking, warnings
 *
 * Note: Write operations (banning, striking, warning) are admin-only via Cloud Functions
 * This service handles client-side reads and enforcement
 */

import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirestoreInstance, getFunctionsInstance } from "./firebase";
import type {
  Ban,
  UserStrike,
  UserWarning,
  Report,
  BanReason,
} from "@/types/models";

// =============================================================================
// BAN CHECKING
// =============================================================================

/**
 * Get the current ban status for a user
 * Returns null if user is not banned
 */
export async function getUserBan(uid: string): Promise<Ban | null> {
  try {
    const db = getFirestoreInstance();
    const banDoc = await getDoc(doc(db, "Bans", uid));

    if (!banDoc.exists()) {
      return null;
    }

    const ban = banDoc.data() as Ban;

    // Check if ban is still active
    if (ban.status === "active") {
      // Check expiration
      if (ban.expiresAt !== null && Date.now() >= ban.expiresAt) {
        // Ban has expired - will be updated by server, but treat as inactive
        console.log(`[moderation] Ban for ${uid} has expired`);
        return { ...ban, status: "expired" };
      }
      return ban;
    }

    return ban;
  } catch (error: any) {
    console.error("[moderation] Error fetching ban:", error);
    // If permission denied, user is not banned (or rules need updating)
    if (error.code === "permission-denied") {
      return null;
    }
    throw error;
  }
}

/**
 * Subscribe to ban status changes for a user
 * Used for real-time enforcement
 */
export function subscribeToUserBan(
  uid: string,
  onUpdate: (ban: Ban | null) => void,
): Unsubscribe {
  const db = getFirestoreInstance();

  return onSnapshot(
    doc(db, "Bans", uid),
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(null);
        return;
      }

      const ban = snapshot.data() as Ban;

      // Check expiration
      if (
        ban.status === "active" &&
        ban.expiresAt !== null &&
        Date.now() >= ban.expiresAt
      ) {
        onUpdate({ ...ban, status: "expired" });
        return;
      }

      onUpdate(ban);
    },
    (error) => {
      // Permission errors mean no ban exists for this user
      if (error.code === "permission-denied") {
        onUpdate(null);
      } else {
        console.error("[moderation] Error subscribing to ban:", error);
      }
    },
  );
}

/**
 * Check if a user is currently banned (quick check)
 */
export async function isUserBanned(uid: string): Promise<boolean> {
  const ban = await getUserBan(uid);
  if (!ban) return false;
  if (ban.status !== "active") return false;
  if (ban.expiresAt === null) return true; // Permanent ban
  return Date.now() < ban.expiresAt;
}

// =============================================================================
// WARNINGS
// =============================================================================

/**
 * Get all warnings for a user (ordered by most recent)
 */
export async function getUserWarnings(uid: string): Promise<UserWarning[]> {
  try {
    const db = getFirestoreInstance();
    const warningsQuery = query(
      collection(db, "UserWarnings"),
      where("uid", "==", uid),
      orderBy("issuedAt", "desc"),
    );

    const snapshot = await getDocs(warningsQuery);
    return snapshot.docs.map((doc) => doc.data() as UserWarning);
  } catch (error: any) {
    console.error("[moderation] Error fetching warnings:", error);
    if (error.code === "permission-denied") {
      return [];
    }
    throw error;
  }
}

/**
 * Get unread warnings for a user
 */
export async function getUnreadWarnings(uid: string): Promise<UserWarning[]> {
  try {
    const db = getFirestoreInstance();
    const warningsQuery = query(
      collection(db, "UserWarnings"),
      where("uid", "==", uid),
      where("status", "==", "unread"),
      orderBy("issuedAt", "desc"),
    );

    const snapshot = await getDocs(warningsQuery);
    return snapshot.docs.map((doc) => doc.data() as UserWarning);
  } catch (error: any) {
    console.error("[moderation] Error fetching unread warnings:", error);
    if (error.code === "permission-denied") {
      return [];
    }
    throw error;
  }
}

/**
 * Subscribe to unread warnings for a user (real-time)
 */
export function subscribeToUnreadWarnings(
  uid: string,
  onUpdate: (warnings: UserWarning[]) => void,
): Unsubscribe {
  const db = getFirestoreInstance();

  const warningsQuery = query(
    collection(db, "UserWarnings"),
    where("uid", "==", uid),
    where("status", "==", "unread"),
    orderBy("issuedAt", "desc"),
  );

  return onSnapshot(
    warningsQuery,
    (snapshot) => {
      const warnings = snapshot.docs.map((doc) => doc.data() as UserWarning);
      onUpdate(warnings);
    },
    (error) => {
      if (error.code === "permission-denied") {
        onUpdate([]);
      } else {
        console.error("[moderation] Error subscribing to warnings:", error);
      }
    },
  );
}

/**
 * Mark a warning as read
 */
export async function markWarningRead(warningId: string): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const warningRef = doc(db, "UserWarnings", warningId);
    await updateDoc(warningRef, {
      status: "read",
      readAt: Date.now(),
    });
    console.log("[moderation] Marked warning as read:", warningId);
  } catch (error: any) {
    console.error("[moderation] Error marking warning read:", error);
    throw error;
  }
}

/**
 * Acknowledge a warning (user confirms they've seen it)
 */
export async function acknowledgeWarning(warningId: string): Promise<void> {
  try {
    const db = getFirestoreInstance();
    const warningRef = doc(db, "UserWarnings", warningId);
    await updateDoc(warningRef, {
      status: "acknowledged",
      acknowledgedAt: Date.now(),
    });
    console.log("[moderation] Warning acknowledged:", warningId);
  } catch (error: any) {
    console.error("[moderation] Error acknowledging warning:", error);
    throw error;
  }
}

// =============================================================================
// STRIKE TRACKING
// =============================================================================

/**
 * Get strike record for a user
 */
export async function getUserStrikes(uid: string): Promise<UserStrike | null> {
  try {
    const db = getFirestoreInstance();
    const strikeDoc = await getDoc(doc(db, "UserStrikes", uid));

    if (!strikeDoc.exists()) {
      return null;
    }

    return strikeDoc.data() as UserStrike;
  } catch (error: any) {
    console.error("[moderation] Error fetching strikes:", error);
    if (error.code === "permission-denied") {
      return null;
    }
    throw error;
  }
}

// =============================================================================
// ADMIN FUNCTIONS (Via Cloud Functions)
// =============================================================================

/**
 * Admin: Apply a ban to a user
 * Requires admin custom claim
 */
export async function adminSetBan(
  targetUid: string,
  reason: BanReason,
  durationMs: number | null, // null = permanent
  details?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const functions = getFunctionsInstance();
    const setBan = httpsCallable(functions, "adminSetBan");

    const result = await setBan({
      targetUid,
      reason,
      durationMs,
      details,
    });

    const data = result.data as { success: boolean; error?: string };
    console.log("[moderation] adminSetBan result:", data);
    return data;
  } catch (error: any) {
    console.error("[moderation] Error setting ban:", error);
    return {
      success: false,
      error: error.message || "Failed to set ban",
    };
  }
}

/**
 * Admin: Lift a ban
 * Requires admin custom claim
 */
export async function adminLiftBan(
  targetUid: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const functions = getFunctionsInstance();
    const liftBan = httpsCallable(functions, "adminLiftBan");

    const result = await liftBan({ targetUid });
    const data = result.data as { success: boolean; error?: string };
    console.log("[moderation] adminLiftBan result:", data);
    return data;
  } catch (error: any) {
    console.error("[moderation] Error lifting ban:", error);
    return {
      success: false,
      error: error.message || "Failed to lift ban",
    };
  }
}

/**
 * Admin: Apply a warning to a user
 * Requires admin custom claim
 */
export async function adminApplyWarning(
  targetUid: string,
  reason: BanReason,
  details?: string,
  reportId?: string,
): Promise<{ success: boolean; warningId?: string; error?: string }> {
  try {
    const functions = getFunctionsInstance();
    const applyWarning = httpsCallable(functions, "adminApplyWarning");

    const result = await applyWarning({
      targetUid,
      reason,
      details,
      reportId,
    });

    const data = result.data as {
      success: boolean;
      warningId?: string;
      error?: string;
    };
    console.log("[moderation] adminApplyWarning result:", data);
    return data;
  } catch (error: any) {
    console.error("[moderation] Error applying warning:", error);
    return {
      success: false,
      error: error.message || "Failed to apply warning",
    };
  }
}

/**
 * Admin: Apply a strike to a user
 * Requires admin custom claim
 */
export async function adminApplyStrike(
  targetUid: string,
  reason: BanReason,
  details?: string,
  reportId?: string,
): Promise<{ success: boolean; strikeCount?: number; error?: string }> {
  try {
    const functions = getFunctionsInstance();
    const applyStrike = httpsCallable(functions, "adminApplyStrike");

    const result = await applyStrike({
      targetUid,
      reason,
      details,
      reportId,
    });

    const data = result.data as {
      success: boolean;
      strikeCount?: number;
      error?: string;
    };
    console.log("[moderation] adminApplyStrike result:", data);
    return data;
  } catch (error: any) {
    console.error("[moderation] Error applying strike:", error);
    return {
      success: false,
      error: error.message || "Failed to apply strike",
    };
  }
}

/**
 * Admin: Resolve a report
 * Requires admin custom claim
 */
export async function adminResolveReport(
  reportId: string,
  resolution: string,
  actionTaken: "none" | "warning" | "strike" | "ban",
): Promise<{ success: boolean; error?: string }> {
  try {
    const functions = getFunctionsInstance();
    const resolveReport = httpsCallable(functions, "adminResolveReport");

    const result = await resolveReport({
      reportId,
      resolution,
      actionTaken,
    });

    const data = result.data as { success: boolean; error?: string };
    console.log("[moderation] adminResolveReport result:", data);
    return data;
  } catch (error: any) {
    console.error("[moderation] Error resolving report:", error);
    return {
      success: false,
      error: error.message || "Failed to resolve report",
    };
  }
}

// =============================================================================
// ADMIN QUERIES (For Admin Queue Screen)
// =============================================================================

/**
 * Admin: Get pending reports
 * Requires admin custom claim
 */
export async function getPendingReports(
  limitCount: number = 50,
): Promise<Report[]> {
  try {
    const db = getFirestoreInstance();
    const reportsQuery = query(
      collection(db, "Reports"),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc"),
      limit(limitCount),
    );

    const snapshot = await getDocs(reportsQuery);
    return snapshot.docs.map((doc) => doc.data() as Report);
  } catch (error: any) {
    console.error("[moderation] Error fetching pending reports:", error);
    throw error;
  }
}

/**
 * Admin: Get all reports for a specific user
 */
export async function getReportsForUser(targetUid: string): Promise<Report[]> {
  try {
    const db = getFirestoreInstance();
    const reportsQuery = query(
      collection(db, "Reports"),
      where("reportedUserId", "==", targetUid),
      orderBy("createdAt", "desc"),
    );

    const snapshot = await getDocs(reportsQuery);
    return snapshot.docs.map((doc) => doc.data() as Report);
  } catch (error: any) {
    console.error("[moderation] Error fetching user reports:", error);
    throw error;
  }
}

/**
 * Admin: Subscribe to pending reports for real-time updates
 */
export function subscribeToPendingReports(
  onUpdate: (reports: Report[]) => void,
  limitCount: number = 50,
): Unsubscribe {
  const db = getFirestoreInstance();

  const reportsQuery = query(
    collection(db, "Reports"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    limit(limitCount),
  );

  return onSnapshot(
    reportsQuery,
    (snapshot) => {
      const reports = snapshot.docs.map((doc) => doc.data() as Report);
      onUpdate(reports);
    },
    (error) => {
      console.error("[moderation] Error subscribing to reports:", error);
    },
  );
}

// =============================================================================
// BAN DISPLAY HELPERS
// =============================================================================

/**
 * Format ban reason for display
 */
export const BAN_REASON_LABELS: Record<BanReason, string> = {
  harassment: "Harassment or bullying",
  spam: "Spam or scam",
  inappropriate_content: "Inappropriate content",
  underage: "Underage user",
  multiple_violations: "Multiple policy violations",
  fraud: "Fraudulent activity",
  other: "Policy violation",
};

/**
 * Format ban duration for display
 */
export function formatBanDuration(ban: Ban): string {
  if (ban.expiresAt === null) {
    return "Permanent";
  }

  const now = Date.now();
  if (now >= ban.expiresAt) {
    return "Expired";
  }

  const remainingMs = ban.expiresAt - now;
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""} remaining`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""} remaining`;
  }
  const minutes = Math.floor(remainingMs / (1000 * 60));
  return `${minutes} minute${minutes > 1 ? "s" : ""} remaining`;
}
