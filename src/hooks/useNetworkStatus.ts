/**
 * useNetworkStatus Hook
 *
 * Monitors network connectivity and provides:
 * - Current online/offline state
 * - A banner-ready flag for UI display
 * - Automatic dismissal when back online
 *
 * Uses expo-network with polling (expo-network doesn't have event listeners).
 *
 * @module hooks/useNetworkStatus
 */

import { createLogger } from "@/utils/log";
import * as Network from "expo-network";
import { useCallback, useEffect, useRef, useState } from "react";

const log = createLogger("useNetworkStatus");

// =============================================================================
// Types
// =============================================================================

export interface NetworkStatusConfig {
  /**
   * Polling interval (ms) for checking connectivity.
   * @default 5000
   */
  pollInterval?: number;

  /**
   * Delay (ms) before showing the offline banner.
   * Prevents flash for momentary connectivity blips.
   * @default 2000
   */
  offlineDelay?: number;

  /**
   * Delay (ms) before hiding the "back online" banner.
   * @default 3000
   */
  onlineDismissDelay?: number;

  /** Enable debug logging */
  debug?: boolean;
}

export interface NetworkStatusState {
  /** Whether the device currently has internet connectivity */
  isConnected: boolean;

  /** Whether to show the offline banner in the UI */
  showOfflineBanner: boolean;

  /** Whether to show the "back online" banner (brief confirmation) */
  showOnlineBanner: boolean;

  /** Human-readable status text */
  statusText: string;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useNetworkStatus(
  config: NetworkStatusConfig = {},
): NetworkStatusState {
  const {
    pollInterval = 5000,
    offlineDelay = 2000,
    onlineDismissDelay = 3000,
    debug = false,
  } = config;

  const [isConnected, setIsConnected] = useState(true);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [showOnlineBanner, setShowOnlineBanner] = useState(false);

  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOfflineRef = useRef(false);
  const prevConnectedRef = useRef(true);

  const checkNetwork = useCallback(async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      const connected = state.isConnected ?? true;

      if (debug) {
        log.debug("Network check", {
          operation: "poll",
          data: { isConnected: connected, type: state.type },
        });
      }

      // Only process if connectivity changed
      if (connected === prevConnectedRef.current) return;
      prevConnectedRef.current = connected;
      setIsConnected(connected);

      if (!connected) {
        // Going offline — delay showing banner to filter blips
        if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
        if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current);

        offlineTimerRef.current = setTimeout(() => {
          setShowOfflineBanner(true);
          setShowOnlineBanner(false);
          wasOfflineRef.current = true;
        }, offlineDelay);
      } else {
        // Coming back online
        if (offlineTimerRef.current) {
          clearTimeout(offlineTimerRef.current);
          offlineTimerRef.current = null;
        }

        setShowOfflineBanner(false);

        // Show "back online" banner only if we were previously offline
        if (wasOfflineRef.current) {
          setShowOnlineBanner(true);
          wasOfflineRef.current = false;

          // Auto-dismiss "back online" banner
          if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current);
          onlineTimerRef.current = setTimeout(() => {
            setShowOnlineBanner(false);
          }, onlineDismissDelay);
        }
      }
    } catch (error) {
      if (debug) log.error("Network check failed:", error);
    }
  }, [offlineDelay, onlineDismissDelay, debug]);

  useEffect(() => {
    // Initial check
    checkNetwork();

    // Poll for changes (expo-network doesn't support event listeners)
    const interval = setInterval(checkNetwork, pollInterval);

    return () => {
      clearInterval(interval);
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current);
    };
  }, [checkNetwork, pollInterval]);

  const statusText = showOfflineBanner
    ? "You're offline — messages will send when reconnected"
    : showOnlineBanner
      ? "Back online"
      : "";

  return {
    isConnected,
    showOfflineBanner,
    showOnlineBanner,
    statusText,
  };
}
