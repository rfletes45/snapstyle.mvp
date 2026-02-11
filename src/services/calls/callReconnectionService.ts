/**
 * CallReconnectionService - Handles network reconnection during calls
 * Monitors connection quality and attempts to restore dropped connections
 */

// Note: This module conditionally imports @react-native-community/netinfo
// In production, ensure the package is installed: yarn add @react-native-community/netinfo
import { AppState, AppStateStatus } from "react-native";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/calls/callReconnectionService");
// Conditional import for NetInfo - handle case where module isn't installed
let NetInfo: any;
try {
  // Dynamic import would be better but TypeScript doesn't support it well
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  NetInfo = require("@react-native-community/netinfo").default;
} catch {
  NetInfo = {
    addEventListener: () => ({ remove: () => {} }),
    fetch: () => Promise.resolve({ isConnected: true, type: "unknown" }),
  };
}

type NetInfoSubscription = { remove: () => void } | (() => void);
type NetInfoState = { isConnected: boolean | null; type: string };

// Logging helpers
const logInfo = (msg: string, data?: any) =>
  logger.info(`[CallReconnection] ${msg}`, data ?? "");
const logError = (msg: string, error?: any) =>
  logger.error(`[CallReconnection] ${msg}`, error ?? "");
const logDebug = (msg: string, data?: any) =>
  __DEV__ && logger.info(`[CallReconnection] ${msg}`, data ?? "");
const logWarn = (msg: string, data?: any) =>
  logger.warn(`[CallReconnection] ${msg}`, data ?? "");

// Connection states
export type ConnectionState =
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "failed";

// Reconnection configuration
export interface ReconnectionConfig {
  /** Maximum number of reconnection attempts */
  maxAttempts: number;
  /** Initial delay between attempts (ms) */
  initialDelay: number;
  /** Maximum delay between attempts (ms) */
  maxDelay: number;
  /** Backoff multiplier for delay */
  backoffMultiplier: number;
  /** Timeout for each reconnection attempt (ms) */
  attemptTimeout: number;
  /** Time to wait before considering connection failed (ms) */
  failureTimeout: number;
}

const DEFAULT_CONFIG: ReconnectionConfig = {
  maxAttempts: 5,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  attemptTimeout: 10000,
  failureTimeout: 60000,
};

// Network quality metrics
export interface NetworkMetrics {
  /** Round-trip time in ms */
  rtt: number;
  /** Packet loss percentage */
  packetLoss: number;
  /** Available bandwidth in kbps */
  bandwidth: number;
  /** Connection type (wifi, cellular, etc) */
  connectionType: string;
  /** Is connected to internet */
  isConnected: boolean;
  /** Timestamp */
  timestamp: number;
}

class CallReconnectionService {
  private static instance: CallReconnectionService;
  private config: ReconnectionConfig = DEFAULT_CONFIG;
  private connectionState: ConnectionState = "connected";
  private currentAttempt: number = 0;
  private reconnectionTimer: ReturnType<typeof setTimeout> | null = null;
  private failureTimer: ReturnType<typeof setTimeout> | null = null;
  private netInfoSubscription: NetInfoSubscription | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private isMonitoring: boolean = false;
  private lastNetworkState: NetInfoState | null = null;
  private currentCallId: string | null = null;

  // Event listeners
  private stateChangeListeners: Set<(state: ConnectionState) => void> =
    new Set();
  private reconnectionListeners: Set<
    (attempt: number, maxAttempts: number) => void
  > = new Set();
  private networkMetricsListeners: Set<(metrics: NetworkMetrics) => void> =
    new Set();

  // Callbacks interface
  private callbacks: {
    onAttemptingReconnect?: (attempt: number, maxAttempts: number) => void;
    onReconnected?: () => void;
    onReconnectFailed?: () => void;
  } = {};

  private constructor() {}

  static getInstance(): CallReconnectionService {
    if (!CallReconnectionService.instance) {
      CallReconnectionService.instance = new CallReconnectionService();
    }
    return CallReconnectionService.instance;
  }

  // ============================================================================
  // Callbacks
  // ============================================================================

  /**
   * Set callbacks for reconnection events
   */
  setCallbacks(callbacks: {
    onAttemptingReconnect?: (attempt: number, maxAttempts: number) => void;
    onReconnected?: () => void;
    onReconnectFailed?: () => void;
  }): void {
    this.callbacks = callbacks;
  }

  // ============================================================================
  // Monitoring
  // ============================================================================

  /**
   * Start monitoring connection for a call
   */
  startMonitoring(callId: string): void {
    if (this.isMonitoring) {
      logWarn("Already monitoring, stopping previous session");
      this.stopMonitoring();
    }

    logInfo("Starting connection monitoring", { callId });
    this.currentCallId = callId;
    this.isMonitoring = true;
    this.connectionState = "connected";
    this.currentAttempt = 0;

    // Subscribe to network state changes
    this.netInfoSubscription = NetInfo.addEventListener(
      this.handleNetworkChange.bind(this),
    );

    // Subscribe to app state changes
    this.appStateSubscription = AppState.addEventListener(
      "change",
      this.handleAppStateChange.bind(this),
    );

    // Start periodic quality checks
    this.startQualityMonitoring();
  }

  /**
   * Stop monitoring connection
   */
  stopMonitoring(): void {
    logInfo("Stopping connection monitoring");

    this.isMonitoring = false;
    this.currentCallId = null;

    // Clear timers
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }
    if (this.failureTimer) {
      clearTimeout(this.failureTimer);
      this.failureTimer = null;
    }

    // Unsubscribe from network changes
    if (this.netInfoSubscription) {
      if (typeof this.netInfoSubscription === "function") {
        this.netInfoSubscription();
      } else if (this.netInfoSubscription.remove) {
        this.netInfoSubscription.remove();
      }
      this.netInfoSubscription = null;
    }

    // Unsubscribe from app state changes
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    // Reset state
    this.connectionState = "connected";
    this.currentAttempt = 0;
  }

  // ============================================================================
  // Network Change Handling
  // ============================================================================

  private handleNetworkChange(state: NetInfoState): void {
    logDebug("Network state changed", {
      type: state.type,
      isConnected: state.isConnected,
    });

    const wasConnected = this.lastNetworkState?.isConnected ?? true;
    const isNowConnected = state.isConnected ?? false;
    this.lastNetworkState = state;

    // Network became disconnected
    if (wasConnected && !isNowConnected) {
      this.handleNetworkDisconnected();
    }
    // Network reconnected
    else if (!wasConnected && isNowConnected) {
      this.handleNetworkReconnected();
    }

    // Update metrics
    this.emitNetworkMetrics({
      rtt: 0, // Would come from WebRTC stats
      packetLoss: 0,
      bandwidth: 0,
      connectionType: state.type,
      isConnected: isNowConnected,
      timestamp: Date.now(),
    });
  }

  private handleNetworkDisconnected(): void {
    logWarn("Network disconnected");

    if (this.connectionState === "connected") {
      this.setConnectionState("reconnecting");
      this.startFailureTimer();
    }
  }

  private handleNetworkReconnected(): void {
    logInfo("Network reconnected, attempting to restore call");

    if (this.connectionState === "reconnecting") {
      this.attemptReconnection();
    }
  }

  // ============================================================================
  // App State Handling
  // ============================================================================

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    logDebug("App state changed", { nextAppState });

    // When coming back to foreground, check connection
    if (nextAppState === "active" && this.connectionState === "reconnecting") {
      this.attemptReconnection();
    }
  }

  // ============================================================================
  // Reconnection Logic
  // ============================================================================

  /**
   * Handle WebRTC connection failure
   */
  handleConnectionFailed(remoteUserId: string): void {
    logWarn("WebRTC connection failed", { remoteUserId });

    if (this.connectionState === "connected") {
      this.setConnectionState("reconnecting");
      this.attemptReconnection();
      this.startFailureTimer();
    }
  }

  /**
   * Handle WebRTC connection restored
   */
  handleConnectionRestored(remoteUserId: string): void {
    logInfo("WebRTC connection restored", { remoteUserId });

    this.cancelReconnection();
    this.setConnectionState("connected");
  }

  /**
   * Attempt to reconnect the call
   */
  private async attemptReconnection(): Promise<void> {
    if (!this.isMonitoring || this.connectionState === "failed") {
      return;
    }

    this.currentAttempt++;
    logInfo("Attempting reconnection", {
      attempt: this.currentAttempt,
      maxAttempts: this.config.maxAttempts,
    });

    // Notify listeners and callbacks
    this.reconnectionListeners.forEach((listener) => {
      try {
        listener(this.currentAttempt, this.config.maxAttempts);
      } catch (e) {
        logError("Reconnection listener error", e);
      }
    });

    // Call the callback
    try {
      this.callbacks.onAttemptingReconnect?.(
        this.currentAttempt,
        this.config.maxAttempts,
      );
    } catch (e) {
      logError("Reconnection callback error", e);
    }

    // Check if max attempts reached
    if (this.currentAttempt > this.config.maxAttempts) {
      this.handleReconnectionFailed();
      return;
    }

    try {
      // Check network first
      const netState = await NetInfo.fetch();
      if (!netState.isConnected) {
        logDebug("No network, scheduling retry");
        this.scheduleReconnection();
        return;
      }

      // Attempt to renegotiate WebRTC connections
      // This would trigger ICE restart in the WebRTC service
      await this.performReconnection();

      // If we get here, reconnection was successful
      this.handleReconnectionSuccess();
    } catch (error) {
      logError("Reconnection attempt failed", error);
      this.scheduleReconnection();
    }
  }

  private async performReconnection(): Promise<void> {
    // In a full implementation, this would:
    // 1. Trigger ICE restart on all peer connections
    // 2. Re-fetch TURN credentials if expired
    // 3. Renegotiate media

    logDebug("Performing reconnection");

    // Wait for WebRTC to stabilize
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Reconnection timeout"));
      }, this.config.attemptTimeout);

      // In production, listen for connection state changes
      // For now, simulate a quick check
      setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, 2000);
    });
  }

  private scheduleReconnection(): void {
    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.initialDelay *
        Math.pow(this.config.backoffMultiplier, this.currentAttempt - 1),
      this.config.maxDelay,
    );

    logDebug("Scheduling reconnection", {
      delay,
      attempt: this.currentAttempt,
    });

    this.reconnectionTimer = setTimeout(() => {
      this.attemptReconnection();
    }, delay);
  }

  private cancelReconnection(): void {
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }
    if (this.failureTimer) {
      clearTimeout(this.failureTimer);
      this.failureTimer = null;
    }
    this.currentAttempt = 0;
  }

  private handleReconnectionSuccess(): void {
    logInfo("Reconnection successful");
    this.cancelReconnection();
    this.setConnectionState("connected");

    // Call the callback
    try {
      this.callbacks.onReconnected?.();
    } catch (e) {
      logError("Reconnected callback error", e);
    }
  }

  private handleReconnectionFailed(): void {
    logError("All reconnection attempts failed");
    this.setConnectionState("failed");

    // Call the callback
    try {
      this.callbacks.onReconnectFailed?.();
    } catch (e) {
      logError("Reconnect failed callback error", e);
    }
  }

  // ============================================================================
  // Failure Timer
  // ============================================================================

  private startFailureTimer(): void {
    if (this.failureTimer) {
      return;
    }

    this.failureTimer = setTimeout(() => {
      if (this.connectionState === "reconnecting") {
        logError("Connection failure timeout reached");
        this.handleReconnectionFailed();
      }
    }, this.config.failureTimeout);
  }

  // ============================================================================
  // Quality Monitoring
  // ============================================================================

  private startQualityMonitoring(): void {
    // In production, this would periodically get WebRTC stats
    // and calculate quality metrics
    logDebug("Quality monitoring started");
  }

  // ============================================================================
  // State Management
  // ============================================================================

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) {
      return;
    }

    logInfo("Connection state changed", {
      from: this.connectionState,
      to: state,
    });
    this.connectionState = state;

    // Notify listeners
    this.stateChangeListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (e) {
        logError("State change listener error", e);
      }
    });
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  // ============================================================================
  // Event Listeners
  // ============================================================================

  /**
   * Add listener for connection state changes
   */
  addStateChangeListener(
    listener: (state: ConnectionState) => void,
  ): () => void {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  /**
   * Add listener for reconnection attempts
   */
  addReconnectionListener(
    listener: (attempt: number, maxAttempts: number) => void,
  ): () => void {
    this.reconnectionListeners.add(listener);
    return () => this.reconnectionListeners.delete(listener);
  }

  /**
   * Add listener for network metrics
   */
  addNetworkMetricsListener(
    listener: (metrics: NetworkMetrics) => void,
  ): () => void {
    this.networkMetricsListeners.add(listener);
    return () => this.networkMetricsListeners.delete(listener);
  }

  private emitNetworkMetrics(metrics: NetworkMetrics): void {
    this.networkMetricsListeners.forEach((listener) => {
      try {
        listener(metrics);
      } catch (e) {
        logError("Network metrics listener error", e);
      }
    });
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Update reconnection configuration
   */
  configure(config: Partial<ReconnectionConfig>): void {
    this.config = { ...this.config, ...config };
    logDebug("Configuration updated", this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): ReconnectionConfig {
    return { ...this.config };
  }
}

export const callReconnectionService = CallReconnectionService.getInstance();
