/**
 * ConcurrentCallManager - Handles multiple simultaneous calls
 * Manages call waiting, call swapping, and busy states
 */

import { Call } from "../../types/call";
import { callKeepService } from "./callKeepService";

// Logging helpers
const logInfo = (msg: string, data?: any) =>
  console.log(`[ConcurrentCalls] ${msg}`, data ?? "");
const logError = (msg: string, error?: any) =>
  console.error(`[ConcurrentCalls] ${msg}`, error ?? "");
const logDebug = (msg: string, data?: any) =>
  __DEV__ && console.log(`[ConcurrentCalls] ${msg}`, data ?? "");

// Call states for concurrent management
export type ManagedCallState = "active" | "held" | "incoming" | "outgoing";

export interface ManagedCall {
  call: Call;
  state: ManagedCallState;
  holdStartTime: number | null;
  startTime: number;
}

// Configuration
export interface ConcurrentCallConfig {
  /** Maximum number of concurrent calls */
  maxCalls: number;
  /** Allow incoming calls while on a call */
  allowCallWaiting: boolean;
  /** Auto-reject incoming calls when on a call */
  autoRejectWhenBusy: boolean;
  /** Maximum hold time before auto-ending (ms) */
  maxHoldTime: number;
}

const DEFAULT_CONFIG: ConcurrentCallConfig = {
  maxCalls: 2,
  allowCallWaiting: true,
  autoRejectWhenBusy: false,
  maxHoldTime: 5 * 60 * 1000, // 5 minutes
};

// Events
export type ConcurrentCallEvent =
  | { type: "call_added"; call: ManagedCall }
  | { type: "call_removed"; callId: string }
  | { type: "call_state_changed"; callId: string; state: ManagedCallState }
  | { type: "call_swapped"; activeCallId: string; heldCallId: string }
  | { type: "busy_rejected"; callId: string };

type EventListener = (event: ConcurrentCallEvent) => void;

class ConcurrentCallManager {
  private static instance: ConcurrentCallManager;
  private calls: Map<string, ManagedCall> = new Map();
  private config: ConcurrentCallConfig = DEFAULT_CONFIG;
  private holdCheckInterval: ReturnType<typeof setInterval> | null = null;
  private eventListeners: Set<EventListener> = new Set();

  private constructor() {}

  static getInstance(): ConcurrentCallManager {
    if (!ConcurrentCallManager.instance) {
      ConcurrentCallManager.instance = new ConcurrentCallManager();
    }
    return ConcurrentCallManager.instance;
  }

  // ============================================================================
  // Call Management
  // ============================================================================

  /**
   * Add a new call to management
   */
  addCall(call: Call, initialState: ManagedCallState): boolean {
    // Check if we've reached max calls
    if (this.calls.size >= this.config.maxCalls) {
      logWarn("Max calls reached, rejecting new call", {
        maxCalls: this.config.maxCalls,
        current: this.calls.size,
      });
      return false;
    }

    // Check if call already exists
    if (this.calls.has(call.id)) {
      logDebug("Call already managed", { callId: call.id });
      return true;
    }

    const managedCall: ManagedCall = {
      call,
      state: initialState,
      holdStartTime: null,
      startTime: Date.now(),
    };

    this.calls.set(call.id, managedCall);
    logInfo("Call added to management", {
      callId: call.id,
      state: initialState,
    });

    // Start hold time checker if not running
    this.startHoldTimeChecker();

    // Emit event
    this.emit({ type: "call_added", call: managedCall });

    return true;
  }

  /**
   * Remove a call from management
   */
  removeCall(callId: string): void {
    if (!this.calls.has(callId)) {
      return;
    }

    this.calls.delete(callId);
    logInfo("Call removed from management", { callId });

    // Stop hold time checker if no more calls
    if (this.calls.size === 0) {
      this.stopHoldTimeChecker();
    }

    // Emit event
    this.emit({ type: "call_removed", callId });
  }

  /**
   * Update call state
   */
  updateCallState(callId: string, state: ManagedCallState): void {
    const managedCall = this.calls.get(callId);
    if (!managedCall) {
      return;
    }

    const previousState = managedCall.state;
    managedCall.state = state;

    // Track hold time
    if (state === "held") {
      managedCall.holdStartTime = Date.now();
    } else {
      managedCall.holdStartTime = null;
    }

    logInfo("Call state updated", { callId, from: previousState, to: state });

    // Emit event
    this.emit({ type: "call_state_changed", callId, state });
  }

  /**
   * Update the call object (when status changes from Firestore)
   */
  updateCall(call: Call): void {
    const managedCall = this.calls.get(call.id);
    if (managedCall) {
      managedCall.call = call;
    }
  }

  // ============================================================================
  // Incoming Call Handling
  // ============================================================================

  /**
   * Handle new incoming call
   * Returns true if call should be shown, false if rejected
   */
  handleIncomingCall(call: Call): boolean {
    logInfo("Handling incoming call", { callId: call.id });

    const activeCall = this.getActiveCall();

    // If no active call, accept normally
    if (!activeCall) {
      return this.addCall(call, "incoming");
    }

    // Check call waiting settings
    if (!this.config.allowCallWaiting) {
      logInfo("Call waiting disabled, rejecting");
      return false;
    }

    // Auto-reject if configured
    if (this.config.autoRejectWhenBusy) {
      logInfo("Auto-rejecting incoming call (busy)");
      this.emit({ type: "busy_rejected", callId: call.id });
      return false;
    }

    // Add as waiting call
    return this.addCall(call, "incoming");
  }

  // ============================================================================
  // Call Swapping / Hold
  // ============================================================================

  /**
   * Put current call on hold and switch to another
   */
  async swapCalls(
    holdCallId: string,
    activateCallId: string,
  ): Promise<boolean> {
    const callToHold = this.calls.get(holdCallId);
    const callToActivate = this.calls.get(activateCallId);

    if (!callToHold || !callToActivate) {
      logError("Cannot swap - calls not found", { holdCallId, activateCallId });
      return false;
    }

    logInfo("Swapping calls", {
      holding: holdCallId,
      activating: activateCallId,
    });

    try {
      // Put current call on hold
      callKeepService.setOnHold(holdCallId, true);
      this.updateCallState(holdCallId, "held");

      // Activate the other call
      callKeepService.setOnHold(activateCallId, false);
      this.updateCallState(activateCallId, "active");

      // Emit event
      this.emit({
        type: "call_swapped",
        activeCallId: activateCallId,
        heldCallId: holdCallId,
      });

      return true;
    } catch (error) {
      logError("Failed to swap calls", error);
      return false;
    }
  }

  /**
   * Put a call on hold
   */
  holdCall(callId: string): boolean {
    const managedCall = this.calls.get(callId);
    if (!managedCall || managedCall.state !== "active") {
      return false;
    }

    logInfo("Putting call on hold", { callId });

    callKeepService.setOnHold(callId, true);
    this.updateCallState(callId, "held");

    return true;
  }

  /**
   * Resume a held call
   */
  resumeCall(callId: string): boolean {
    const managedCall = this.calls.get(callId);
    if (!managedCall || managedCall.state !== "held") {
      return false;
    }

    // Check if there's another active call
    const activeCall = this.getActiveCall();
    if (activeCall) {
      // Put active call on hold first
      this.holdCall(activeCall.call.id);
    }

    logInfo("Resuming held call", { callId });

    callKeepService.setOnHold(callId, false);
    this.updateCallState(callId, "active");

    return true;
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Get the currently active call
   */
  getActiveCall(): ManagedCall | null {
    for (const call of this.calls.values()) {
      if (call.state === "active") {
        return call;
      }
    }
    return null;
  }

  /**
   * Get all held calls
   */
  getHeldCalls(): ManagedCall[] {
    return Array.from(this.calls.values()).filter((c) => c.state === "held");
  }

  /**
   * Get incoming/waiting calls
   */
  getIncomingCalls(): ManagedCall[] {
    return Array.from(this.calls.values()).filter(
      (c) => c.state === "incoming",
    );
  }

  /**
   * Get all managed calls
   */
  getAllCalls(): ManagedCall[] {
    return Array.from(this.calls.values());
  }

  /**
   * Get call by ID
   */
  getCall(callId: string): ManagedCall | null {
    return this.calls.get(callId) || null;
  }

  /**
   * Check if there's an active call
   */
  hasActiveCall(): boolean {
    return this.getActiveCall() !== null;
  }

  /**
   * Get count of all calls
   */
  getCallCount(): number {
    return this.calls.size;
  }

  /**
   * Check if a specific call is being managed
   */
  hasCall(callId: string): boolean {
    return this.calls.has(callId);
  }

  // ============================================================================
  // Hold Time Management
  // ============================================================================

  private startHoldTimeChecker(): void {
    if (this.holdCheckInterval) return;

    this.holdCheckInterval = setInterval(() => {
      const now = Date.now();

      for (const [callId, call] of this.calls.entries()) {
        if (call.state === "held" && call.holdStartTime) {
          const holdDuration = now - call.holdStartTime;

          if (holdDuration >= this.config.maxHoldTime) {
            logWarn("Hold time exceeded, ending call", {
              callId,
              holdDuration: holdDuration / 1000,
            });

            // End the held call
            callKeepService.endCall(callId);
            this.removeCall(callId);
          }
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private stopHoldTimeChecker(): void {
    if (this.holdCheckInterval) {
      clearInterval(this.holdCheckInterval);
      this.holdCheckInterval = null;
    }
  }

  // ============================================================================
  // Event Listeners
  // ============================================================================

  /**
   * Add event listener
   */
  addEventListener(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private emit(event: ConcurrentCallEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        logError("Event listener error", error);
      }
    });
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Configure concurrent call behavior
   */
  configure(config: Partial<ConcurrentCallConfig>): void {
    this.config = { ...this.config, ...config };
    logDebug("Configuration updated", this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): ConcurrentCallConfig {
    return { ...this.config };
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Clear all calls and stop management
   */
  clear(): void {
    logInfo("Clearing all managed calls");

    this.calls.clear();
    this.stopHoldTimeChecker();
  }
}

// Helper for logging warnings
const logWarn = (msg: string, data?: any) =>
  console.warn(`[ConcurrentCalls] ${msg}`, data ?? "");

export const concurrentCallManager = ConcurrentCallManager.getInstance();
