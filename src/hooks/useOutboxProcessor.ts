import { processPendingMessages } from "@/services/chatV2";
import { useAuth } from "@/store/AuthContext";
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";


import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/useOutboxProcessor");
/**
 * Hook to automatically process pending outbox messages.
 *
 * Triggers processing:
 * - On mount (after user is authenticated)
 * - When app transitions to foreground ("active" state)
 *
 * This ensures failed messages are retried automatically without user intervention.
 *
 * @example
 * // In your root app component (inside AuthProvider):
 * function AppContent() {
 *   useOutboxProcessor();
 *   return <Navigation />;
 * }
 */
export function useOutboxProcessor(): void {
  const { currentFirebaseUser } = useAuth();
  const isProcessing = useRef(false);
  const lastProcessTime = useRef(0);

  // Minimum interval between processing attempts (5 seconds)
  const MIN_PROCESS_INTERVAL = 5000;

  const processIfNeeded = async () => {
    // Guard: must be authenticated
    if (!currentFirebaseUser) return;

    // Guard: prevent concurrent processing
    if (isProcessing.current) return;

    // Guard: throttle processing attempts
    const now = Date.now();
    if (now - lastProcessTime.current < MIN_PROCESS_INTERVAL) {
      return;
    }

    isProcessing.current = true;
    lastProcessTime.current = now;

    try {
      const result = await processPendingMessages();

      // Only log if there was work to do
      if (result.sent > 0 || result.failed > 0) {
        logger.info(
          `[OutboxProcessor] Processed: ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`,
        );
      }
    } catch (error) {
      logger.error("[OutboxProcessor] Error processing outbox:", error);
    } finally {
      isProcessing.current = false;
    }
  };

  // Effect 1: Process on mount when user becomes available
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (currentFirebaseUser) {
      // Small delay to let auth state settle
      timer = setTimeout(() => {
        void processIfNeeded();
      }, 1000);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [currentFirebaseUser?.uid]);

  // Effect 2: Process when app comes to foreground
  useEffect(() => {
    if (!currentFirebaseUser) return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        logger.info("[OutboxProcessor] App became active, checking outbox...");
        processIfNeeded();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription?.remove();
    };
  }, [currentFirebaseUser?.uid]);
}
