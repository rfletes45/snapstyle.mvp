/**
 * Inbox Parity Telemetry
 *
 * Debug-only shadow comparison between fan-out and aggregated inbox modes.
 * When enabled, runs the aggregated mode in parallel with the active fan-out
 * mode and logs any divergences in conversation count, unread state, sort
 * order, and pin/archive/mute parity.
 *
 * Enable via: `__DEV__` or explicit `INBOX_PARITY_DEBUG = true`
 *
 * This does NOT affect the displayed UI — it only logs diagnostic data.
 *
 * @module services/chat/inboxParityTelemetry
 */

import type { InboxConversation } from "@/types/messaging";
import { createLogger } from "@/utils/log";

const log = createLogger("inboxParity");

const INBOX_PARITY_DEBUG = __DEV__;

interface ParityReport {
  fanoutCount: number;
  aggregatedCount: number;
  missingInAggregated: string[];
  missingInFanout: string[];
  unreadMismatches: Array<{
    id: string;
    fanoutUnread: number;
    aggregatedUnread: number;
  }>;
  sortOrderDrifts: Array<{
    id: string;
    fanoutIndex: number;
    aggregatedIndex: number;
  }>;
  pinMismatches: Array<{
    id: string;
    fanoutPinned: boolean;
    aggregatedPinned: boolean;
  }>;
  archiveMismatches: Array<{
    id: string;
    fanoutArchived: boolean;
    aggregatedArchived: boolean;
  }>;
  muteMismatches: Array<{
    id: string;
    fanoutMuted: boolean;
    aggregatedMuted: boolean;
  }>;
}

/**
 * Compare fan-out and aggregated inbox results and log divergences.
 * Safe to call frequently — short-circuits when debug is disabled.
 */
export function compareInboxParity(
  fanout: InboxConversation[],
  aggregated: InboxConversation[],
): ParityReport | null {
  if (!INBOX_PARITY_DEBUG) return null;

  const fanoutMap = new Map(fanout.map((c) => [c.id, c]));
  const aggregatedMap = new Map(aggregated.map((c) => [c.id, c]));

  const missingInAggregated = fanout
    .filter((c) => !aggregatedMap.has(c.id))
    .map((c) => c.id);
  const missingInFanout = aggregated
    .filter((c) => !fanoutMap.has(c.id))
    .map((c) => c.id);

  const unreadMismatches: ParityReport["unreadMismatches"] = [];
  const pinMismatches: ParityReport["pinMismatches"] = [];
  const archiveMismatches: ParityReport["archiveMismatches"] = [];
  const muteMismatches: ParityReport["muteMismatches"] = [];

  for (const fc of fanout) {
    const ac = aggregatedMap.get(fc.id);
    if (!ac) continue;

    if (fc.unreadCount !== ac.unreadCount) {
      unreadMismatches.push({
        id: fc.id,
        fanoutUnread: fc.unreadCount,
        aggregatedUnread: ac.unreadCount,
      });
    }

    const fPinned = !!fc.memberState.pinnedAt;
    const aPinned = !!ac.memberState.pinnedAt;
    if (fPinned !== aPinned) {
      pinMismatches.push({
        id: fc.id,
        fanoutPinned: fPinned,
        aggregatedPinned: aPinned,
      });
    }

    const fArchived = !!fc.memberState.archived;
    const aArchived = !!ac.memberState.archived;
    if (fArchived !== aArchived) {
      archiveMismatches.push({
        id: fc.id,
        fanoutArchived: fArchived,
        aggregatedArchived: aArchived,
      });
    }

    const fMuted = !!fc.memberState.mutedUntil;
    const aMuted = !!ac.memberState.mutedUntil;
    if (fMuted !== aMuted) {
      muteMismatches.push({
        id: fc.id,
        fanoutMuted: fMuted,
        aggregatedMuted: aMuted,
      });
    }
  }

  // Check sort order (compare position of first 20 items)
  const sortOrderDrifts: ParityReport["sortOrderDrifts"] = [];
  const aggregatedOrder = new Map(aggregated.map((c, i) => [c.id, i]));
  for (let i = 0; i < Math.min(fanout.length, 20); i++) {
    const id = fanout[i].id;
    const aggIdx = aggregatedOrder.get(id);
    if (aggIdx !== undefined && Math.abs(aggIdx - i) > 1) {
      sortOrderDrifts.push({
        id,
        fanoutIndex: i,
        aggregatedIndex: aggIdx,
      });
    }
  }

  const report: ParityReport = {
    fanoutCount: fanout.length,
    aggregatedCount: aggregated.length,
    missingInAggregated,
    missingInFanout,
    unreadMismatches,
    sortOrderDrifts,
    pinMismatches,
    archiveMismatches,
    muteMismatches,
  };

  const hasDrift =
    missingInAggregated.length > 0 ||
    missingInFanout.length > 0 ||
    unreadMismatches.length > 0 ||
    sortOrderDrifts.length > 0 ||
    pinMismatches.length > 0 ||
    archiveMismatches.length > 0 ||
    muteMismatches.length > 0;

  if (hasDrift) {
    log.warn("Inbox parity divergence detected", { data: report });
  } else {
    log.debug("Inbox parity OK", {
      data: {
        fanoutCount: report.fanoutCount,
        aggregatedCount: report.aggregatedCount,
      },
    });
  }

  return report;
}
