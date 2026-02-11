/**
 * Reporting Service
 */

import type { Report, ReportReason } from "@/types/models";
import { collection, doc, setDoc } from "firebase/firestore";
import { getFirestoreInstance } from "./firebase";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/reporting");
/**
 * Human-readable report reason labels
 */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam or scam",
  harassment: "Harassment or bullying",
  inappropriate_content: "Inappropriate content",
  fake_account: "Fake account or impersonation",
  other: "Other",
};

/**
 * Submit a report against a user
 */
export async function submitReport(
  reporterId: string,
  reportedUserId: string,
  reason: ReportReason,
  options?: {
    description?: string;
    relatedContent?: {
      type: "message" | "story" | "profile";
      contentId?: string;
    };
  },
): Promise<{ success: boolean; reportId?: string; error?: string }> {
  try {
    logger.info("🔵 [reporting] Submitting report:", {
      reporterId,
      reportedUserId,
      reason,
    });

    // Validate inputs
    if (!reporterId || !reportedUserId) {
      return { success: false, error: "Invalid user IDs" };
    }

    if (reporterId === reportedUserId) {
      return { success: false, error: "Cannot report yourself" };
    }

    const db = getFirestoreInstance();
    const reportsRef = collection(db, "Reports");
    const newReportRef = doc(reportsRef);

    const report: Report = {
      id: newReportRef.id,
      reporterId,
      reportedUserId,
      reason,
      description: options?.description,
      createdAt: Date.now(),
      status: "pending",
      relatedContent: options?.relatedContent,
    };

    await setDoc(newReportRef, report);

    logger.info("✅ [reporting] Report submitted:", newReportRef.id);
    return { success: true, reportId: newReportRef.id };
  } catch (error: any) {
    logger.error("❌ [reporting] Error submitting report:", error);
    return {
      success: false,
      error: error.message || "Failed to submit report",
    };
  }
}

/**
 * Report a user from their profile
 */
export async function reportUserProfile(
  reporterId: string,
  reportedUserId: string,
  reason: ReportReason,
  description?: string,
): Promise<{ success: boolean; reportId?: string; error?: string }> {
  return submitReport(reporterId, reportedUserId, reason, {
    description,
    relatedContent: {
      type: "profile",
    },
  });
}

/**
 * Report a specific message
 */
export async function reportMessage(
  reporterId: string,
  reportedUserId: string,
  messageId: string,
  reason: ReportReason,
  description?: string,
): Promise<{ success: boolean; reportId?: string; error?: string }> {
  return submitReport(reporterId, reportedUserId, reason, {
    description,
    relatedContent: {
      type: "message",
      contentId: messageId,
    },
  });
}

/**
 * Report a story
 */
export async function reportStory(
  reporterId: string,
  reportedUserId: string,
  storyId: string,
  reason: ReportReason,
  description?: string,
): Promise<{ success: boolean; reportId?: string; error?: string }> {
  return submitReport(reporterId, reportedUserId, reason, {
    description,
    relatedContent: {
      type: "story",
      contentId: storyId,
    },
  });
}
