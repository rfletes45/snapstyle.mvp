/**
 * ChatDebugHUD (Segment 8)
 *
 * Dev-only overlay that shows real-time debugging information
 * for a chat conversation. Gated by CHAT_FEATURES.CHAT_DEBUG_HUD
 * (defaults to __DEV__).
 *
 * Displays:
 * - Trace IDs from recent sends
 * - Effective privacy settings for the current conversation
 * - Delivery / read watermark timestamps
 * - Outbox item count + state breakdown
 * - Active Firestore listener count
 * - Feature flag status
 * - Connection state
 *
 * Usage:
 * ```tsx
 * <ChatDebugHUD
 *   scope="dm"
 *   conversationId={chatId}
 *   effectiveSettings={effective}
 *   outboxItems={outboxItems}
 *   lastDeliveredAt={lastDeliveredAt}
 *   lastReadAt={lastReadAt}
 * />
 * ```
 *
 * @module components/chat/ChatDebugHUD
 */

import { CHAT_FEATURES } from "@/constants/featureFlags";
import {
  ChatErrorCode,
  DEFAULT_EFFECTIVE_SETTINGS,
  EffectiveChatSettings,
  OutboxItem,
} from "@/types/messaging";
import React, { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// =============================================================================
// Types
// =============================================================================

export interface ChatDebugHUDProps {
  /** Conversation scope */
  scope: "dm" | "group";

  /** Conversation ID (chatId or groupId) */
  conversationId: string;

  /** Resolved effective settings for this conversation */
  effectiveSettings?: EffectiveChatSettings;

  /** Current outbox items for this conversation */
  outboxItems?: OutboxItem[];

  /** Last delivered-at watermark (other user's, for DM) */
  lastDeliveredAt?: number | null;

  /** Last read-at watermark (other user's, for DM) */
  lastReadAt?: number | null;

  /** Number of active Firestore listeners (optional) */
  listenerCount?: number;

  /** Whether the device is online */
  isOnline?: boolean;

  /** Additional debug entries (key-value pairs) */
  extra?: Record<string, string | number | boolean | null>;
}

// =============================================================================
// Helpers
// =============================================================================

function formatTs(ts: number | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function outboxSummary(items: OutboxItem[]): string {
  if (items.length === 0) return "empty";
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.state] = (counts[item.state] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([k, v]) => `${k}:${v}`)
    .join(" ");
}

function flagStatus(): string[] {
  return Object.entries(CHAT_FEATURES).map(
    ([key, value]) => `${key.replace("CHAT_", "")}: ${value ? "ON" : "off"}`,
  );
}

function errorCodeLabel(code: ChatErrorCode | undefined): string {
  if (!code) return "—";
  return code;
}

// =============================================================================
// Component
// =============================================================================

/**
 * ChatDebugHUD — dev-only floating overlay.
 *
 * Renders nothing when CHAT_DEBUG_HUD is false.
 */
export const ChatDebugHUD: React.FC<ChatDebugHUDProps> = React.memo(
  ({
    scope,
    conversationId,
    effectiveSettings,
    outboxItems = [],
    lastDeliveredAt,
    lastReadAt,
    listenerCount,
    isOnline,
    extra,
  }) => {
    const [expanded, setExpanded] = useState(false);
    const toggle = useCallback(() => setExpanded((v) => !v), []);

    // -----------------------------------------------------------------------
    // Gate: only render in dev
    // -----------------------------------------------------------------------
    if (!CHAT_FEATURES.CHAT_DEBUG_HUD) {
      return null;
    }

    const settings = effectiveSettings ?? DEFAULT_EFFECTIVE_SETTINGS;

    // Recent trace IDs from outbox
    const traceIds = outboxItems
      .filter((i) => i.traceId)
      .slice(-5)
      .map((i) => ({
        traceId: i.traceId!,
        state: i.state,
        errorCode: i.lastErrorCode,
      }));

    // Recent errors
    const failedItems = outboxItems.filter((i) => i.state === "failed");

    return (
      <View style={styles.container} pointerEvents="box-none">
        <TouchableOpacity
          onPress={toggle}
          style={styles.toggleButton}
          activeOpacity={0.7}
        >
          <Text style={styles.toggleText}>
            {expanded ? "▼ DEBUG" : "▶ DEBUG"}
          </Text>
        </TouchableOpacity>

        {expanded && (
          <ScrollView
            style={styles.panel}
            contentContainerStyle={styles.panelContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <Text style={styles.sectionHeader}>Conversation</Text>
            <Row label="Scope" value={scope} />
            <Row label="ID" value={conversationId.substring(0, 16) + "…"} />
            <Row
              label="Online"
              value={
                isOnline === undefined
                  ? "unknown"
                  : isOnline
                    ? "✅ yes"
                    : "❌ no"
              }
            />
            {listenerCount !== undefined && (
              <Row label="Listeners" value={String(listenerCount)} />
            )}

            {/* Watermarks */}
            <Text style={styles.sectionHeader}>Watermarks</Text>
            <Row label="Delivered" value={formatTs(lastDeliveredAt)} />
            <Row label="Read" value={formatTs(lastReadAt)} />

            {/* Effective Settings */}
            <Text style={styles.sectionHeader}>Effective Settings</Text>
            <Row
              label="ReadReceipts"
              value={settings.publishReadReceipts ? "✅" : "❌"}
            />
            <Row
              label="DeliveryAcks"
              value={settings.publishDeliveryReceipts ? "✅" : "❌"}
            />
            <Row label="Typing" value={settings.publishTyping ? "✅" : "❌"} />
            <Row
              label="OnlineStatus"
              value={settings.publishOnlineStatus ? "✅" : "❌"}
            />
            <Row
              label="LastSeen"
              value={settings.publishLastSeen ? "✅" : "❌"}
            />
            <Row label="NotifPreview" value={settings.notificationPreview} />

            {/* Outbox */}
            <Text style={styles.sectionHeader}>Outbox</Text>
            <Row
              label="Count"
              value={`${outboxItems.length} (${outboxSummary(outboxItems)})`}
            />
            {failedItems.length > 0 && (
              <Row
                label="Failed"
                value={failedItems
                  .map(
                    (i) =>
                      `${i.messageId.substring(0, 6)}…: ${errorCodeLabel(i.lastErrorCode)}`,
                  )
                  .join("\n")}
              />
            )}

            {/* Trace IDs */}
            {traceIds.length > 0 && (
              <>
                <Text style={styles.sectionHeader}>Recent Traces</Text>
                {traceIds.map((t) => (
                  <Row
                    key={t.traceId}
                    label={t.traceId}
                    value={`${t.state}${t.errorCode ? ` (${t.errorCode})` : ""}`}
                  />
                ))}
              </>
            )}

            {/* Feature Flags */}
            <Text style={styles.sectionHeader}>Feature Flags</Text>
            {flagStatus().map((flag) => (
              <Text key={flag} style={styles.flagText}>
                {flag}
              </Text>
            ))}

            {/* Extra debug entries */}
            {extra && Object.keys(extra).length > 0 && (
              <>
                <Text style={styles.sectionHeader}>Extra</Text>
                {Object.entries(extra).map(([k, v]) => (
                  <Row key={k} label={k} value={String(v ?? "—")} />
                ))}
              </>
            )}
          </ScrollView>
        )}
      </View>
    );
  },
);

ChatDebugHUD.displayName = "ChatDebugHUD";

// =============================================================================
// Row Component
// =============================================================================

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={styles.rowValue} selectable>
      {value}
    </Text>
  </View>
);

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 9999,
    maxWidth: 320,
  },
  toggleButton: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomLeftRadius: 6,
  },
  toggleText: {
    color: "#0f0",
    fontSize: 10,
    fontFamily: "monospace",
    fontWeight: "700",
  },
  panel: {
    backgroundColor: "rgba(0,0,0,0.85)",
    borderBottomLeftRadius: 8,
    maxHeight: 400,
  },
  panelContent: {
    padding: 8,
    paddingTop: 4,
  },
  sectionHeader: {
    color: "#0ff",
    fontSize: 10,
    fontFamily: "monospace",
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1,
  },
  rowLabel: {
    color: "#aaa",
    fontSize: 9,
    fontFamily: "monospace",
    flex: 1,
    marginRight: 8,
  },
  rowValue: {
    color: "#0f0",
    fontSize: 9,
    fontFamily: "monospace",
    flex: 2,
    textAlign: "right",
  },
  flagText: {
    color: "#888",
    fontSize: 8,
    fontFamily: "monospace",
    paddingVertical: 0.5,
  },
});
