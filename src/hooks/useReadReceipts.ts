/**
 * useReadReceipts Hook
 *
 * Manages read receipt display and sending for DM conversations.
 * Respects both users' privacy settings.
 *
 * ## Privacy Model
 *
 * Read receipts are reciprocal:
 * - If YOU disable `showReadReceipts`, you won't SEND read receipts (others can't see you've read)
 * - If YOU disable `showReadReceipts`, you also won't SEE others' read receipts
 *
 * This matches WhatsApp/iMessage behavior where disabling read receipts
 * is a two-way street.
 *
 * @module hooks/useReadReceipts
 */

import { CHAT_FEATURES } from "@/constants/featureFlags";
import {
  subscribeToDeliveryReceipt,
  subscribeToReadReceipt,
} from "@/services/chatMembers";
import { subscribeToInboxSettings } from "@/services/inboxSettings";
import { resolveFromInboxSettings } from "@/services/messaging/resolveChatSettings";
import { DEFAULT_INBOX_SETTINGS, InboxSettings } from "@/types/messaging";
import { createLogger } from "@/utils/log";
import { useCallback, useEffect, useMemo, useState } from "react";

const log = createLogger("useReadReceipts");

interface UseReadReceiptsConfig {
  /** Chat/conversation ID */
  chatId: string;
  /** Current user's UID */
  currentUid: string;
  /** Other user's UID (the person you're chatting with) */
  otherUid: string;
  /** Enable debug logging */
  debug?: boolean;
}

interface UseReadReceiptsReturn {
  /**
   * The other user's read watermark timestamp (ms).
   * Messages with serverReceivedAt <= this value have been read.
   * null if unknown or receipts are disabled.
   */
  otherUserReadWatermark: number | null;

  /**
   * The other user's delivery watermark timestamp (ms).
   * Messages with serverReceivedAt <= this value have been delivered.
   * null if unknown or delivery acks are disabled.
   */
  otherUserDeliveredWatermark: number | null;

  /**
   * Whether to show read receipts in the UI.
   * False if the current user has disabled receipts (reciprocal).
   */
  shouldShowReadReceipts: boolean;

  /**
   * Whether to send read receipts when viewing messages.
   * False if the current user has disabled receipts.
   */
  shouldSendReadReceipts: boolean;

  /**
   * Check if a specific message has been read by the other user.
   * @param messageServerReceivedAt - The message's serverReceivedAt timestamp
   */
  isMessageRead: (messageServerReceivedAt: number) => boolean;

  /**
   * Check if a specific message has been delivered to the other user.
   * @param messageServerReceivedAt - The message's serverReceivedAt timestamp
   */
  isMessageDelivered: (messageServerReceivedAt: number) => boolean;

  /**
   * Get the display status for a message based on read receipts.
   * @param messageServerReceivedAt - The message's serverReceivedAt timestamp
   * @param currentStatus - The current status (sending, sent, delivered, failed)
   */
  getMessageStatus: (
    messageServerReceivedAt: number,
    currentStatus?: "sending" | "sent" | "delivered" | "failed",
  ) => "sending" | "sent" | "delivered" | "read" | "failed";
}

/**
 * Hook to manage read receipts in DM conversations
 *
 * @example
 * ```tsx
 * const readReceipts = useReadReceipts({
 *   chatId,
 *   currentUid: user.uid,
 *   otherUid: friendUid,
 * });
 *
 * // In message rendering
 * const status = readReceipts.getMessageStatus(
 *   message.serverReceivedAt,
 *   message.status
 * );
 *
 * // Check if specific message was read
 * if (readReceipts.isMessageRead(message.serverReceivedAt)) {
 *   // Show blue checkmarks
 * }
 * ```
 */
export function useReadReceipts(
  config: UseReadReceiptsConfig,
): UseReadReceiptsReturn {
  const { chatId, currentUid, otherUid, debug = false } = config;

  // State
  const [otherUserReadWatermark, setOtherUserReadWatermark] = useState<
    number | null
  >(null);
  const [otherUserDeliveredWatermark, setOtherUserDeliveredWatermark] =
    useState<number | null>(null);
  const [mySettings, setMySettings] = useState<InboxSettings>(
    DEFAULT_INBOX_SETTINGS,
  );

  // Resolve effective settings via the V3 resolver
  const effective = useMemo(
    () => resolveFromInboxSettings(mySettings),
    [mySettings],
  );

  // Subscribe to my own settings
  useEffect(() => {
    if (!currentUid) return;

    const unsubscribe = subscribeToInboxSettings(currentUid, (settings) => {
      setMySettings(settings);
      if (debug) {
        log.debug("My settings updated", {
          operation: "settings",
          data: { showReadReceipts: settings.showReadReceipts },
        });
      }
    });

    return unsubscribe;
  }, [currentUid, debug]);

  // Subscribe to other user's read watermark (only if I have receipts enabled)
  useEffect(() => {
    if (!chatId || !otherUid) return;

    // If I've disabled read receipts, don't subscribe to the other user's
    // (reciprocal: if you don't send, you don't receive)
    if (!effective.publishReadReceipts) {
      setOtherUserReadWatermark(null);
      return;
    }

    if (debug) {
      log.debug("Subscribing to read receipts", {
        operation: "subscribe",
        data: { chatId, otherUid },
      });
    }

    const unsubscribe = subscribeToReadReceipt(
      chatId,
      otherUid,
      (watermark) => {
        if (debug) {
          log.debug("Read watermark updated", {
            operation: "watermark",
            data: { chatId, otherUid, watermark },
          });
        }
        setOtherUserReadWatermark(watermark);
      },
    );

    return unsubscribe;
  }, [chatId, otherUid, effective.publishReadReceipts, debug]);

  // Subscribe to other user's delivery watermark (Segment 2)
  useEffect(() => {
    if (!CHAT_FEATURES.CHAT_DELIVERY_ACKS) return;
    if (!chatId || !otherUid) return;

    // Delivery receipts are independent of read receipts — we show
    // "Delivered" even if read receipts are off, as long as delivery acks flag
    // is on. But if publishDeliveryReceipts is off, skip.
    if (!effective.publishDeliveryReceipts) {
      setOtherUserDeliveredWatermark(null);
      return;
    }

    if (debug) {
      log.debug("Subscribing to delivery receipts", {
        operation: "subscribe-delivery",
        data: { chatId, otherUid },
      });
    }

    const unsubscribe = subscribeToDeliveryReceipt(
      chatId,
      otherUid,
      (watermark) => {
        if (debug) {
          log.debug("Delivery watermark updated", {
            operation: "delivery-watermark",
            data: { chatId, otherUid, watermark },
          });
        }
        setOtherUserDeliveredWatermark(watermark);
      },
    );

    return unsubscribe;
  }, [chatId, otherUid, effective.publishDeliveryReceipts, debug]);

  // Derived values — use resolved effective settings
  const shouldShowReadReceipts = effective.publishReadReceipts;
  const shouldSendReadReceipts = effective.publishReadReceipts;

  // Check if a message has been read
  const isMessageRead = useCallback(
    (messageServerReceivedAt: number): boolean => {
      if (!shouldShowReadReceipts || otherUserReadWatermark === null) {
        return false;
      }
      return messageServerReceivedAt <= otherUserReadWatermark;
    },
    [shouldShowReadReceipts, otherUserReadWatermark],
  );

  // Check if a message has been delivered
  const isMessageDelivered = useCallback(
    (messageServerReceivedAt: number): boolean => {
      if (!CHAT_FEATURES.CHAT_DELIVERY_ACKS) return false;
      if (otherUserDeliveredWatermark === null) return false;
      return messageServerReceivedAt <= otherUserDeliveredWatermark;
    },
    [otherUserDeliveredWatermark],
  );

  // Get the display status for a message
  const getMessageStatus = useCallback(
    (
      messageServerReceivedAt: number,
      currentStatus?: "sending" | "sent" | "delivered" | "failed",
    ): "sending" | "sent" | "delivered" | "read" | "failed" => {
      // Failed and sending status always takes precedence
      if (currentStatus === "failed") return "failed";
      if (currentStatus === "sending") return "sending";

      // Check if the message has been read
      if (isMessageRead(messageServerReceivedAt)) {
        return "read";
      }

      // Check delivered via delivery watermark (Segment 2)
      if (isMessageDelivered(messageServerReceivedAt)) {
        return "delivered";
      }

      // If we have a read watermark but message isn't read, it's at least delivered
      if (shouldShowReadReceipts && otherUserReadWatermark !== null) {
        return "delivered";
      }

      // Fall back to current status or default to sent
      return currentStatus || "sent";
    },
    [
      isMessageRead,
      isMessageDelivered,
      shouldShowReadReceipts,
      otherUserReadWatermark,
    ],
  );

  return {
    otherUserReadWatermark,
    otherUserDeliveredWatermark,
    shouldShowReadReceipts,
    shouldSendReadReceipts,
    isMessageRead,
    isMessageDelivered,
    getMessageStatus,
  };
}
