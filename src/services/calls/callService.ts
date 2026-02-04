/**
 * CallService - Main business logic for voice/video calls
 * Handles call lifecycle, Firestore operations, and coordinates with WebRTC/CallKeep
 */

import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import {
  Call,
  CALL_TIMEOUT_MS,
  CallEndReason,
  CallEvent,
  CallEventHandler,
  CallHistoryEntry,
  CallParticipant,
  CallStatus,
  MAX_GROUP_PARTICIPANTS,
  StartCallParams,
} from "../../types/call";
import { getAuthInstance, getFirestoreInstance } from "../firebase";

// Lazy getters to avoid Firebase initialization issues at module load time
const getDb = () => getFirestoreInstance();
const getAuth = () => getAuthInstance();

// Import sibling services
import { callKeepService } from "./callKeepService";
import { webRTCService } from "./webRTCService";

// Simple logging helpers
const logInfo = (msg: string, data?: any) =>
  console.log(`[CallService] ${msg}`, data ?? "");
const logError = (msg: string, error?: any) =>
  console.error(`[CallService] ${msg}`, error ?? "");
const logDebug = (msg: string, data?: any) =>
  __DEV__ && console.log(`[CallService] ${msg}`, data ?? "");

const LOG_TAG = "CallService";

class CallService {
  private static instance: CallService;
  private currentCallId: string | null = null;
  private callSubscription: Unsubscribe | null = null;
  private incomingCallSubscription: Unsubscribe | null = null;
  private eventHandlers: Set<CallEventHandler> = new Set();
  private callTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private constructor() {
    // Setup CallKeep callbacks
    this.setupCallKeepCallbacks();
  }

  static getInstance(): CallService {
    if (!CallService.instance) {
      CallService.instance = new CallService();
    }
    return CallService.instance;
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  addEventListener(handler: CallEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emitEvent(event: CallEvent): void {
    this.eventHandlers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        logError("Error in event handler", { error });
      }
    });
  }

  // ============================================================================
  // CallKeep Integration
  // ============================================================================

  private setupCallKeepCallbacks(): void {
    callKeepService.setCallbacks({
      onAnswerCall: async (callId: string) => {
        logInfo("CallKeep answer call", { callId });
        await this.answerCall(callId);
      },
      onEndCall: async (callId: string) => {
        logInfo("CallKeep end call", { callId });
        await this.endCall(callId);
      },
      onMuteCall: (callId: string, muted: boolean) => {
        logInfo("CallKeep mute call", { callId, muted });
        webRTCService.setMuted(muted);
      },
      onHoldCall: (callId: string, hold: boolean) => {
        logInfo("CallKeep hold call", { callId, hold });
        // TODO: Implement hold functionality
      },
    });
  }

  async initialize(): Promise<void> {
    logInfo("Initializing CallService");
    await callKeepService.setup();
    await this.subscribeToIncomingCalls();
  }

  // ============================================================================
  // Start Call
  // ============================================================================

  async startCall(params: StartCallParams): Promise<string> {
    const { conversationId, participantIds, type, scope } = params;

    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    if (this.currentCallId) {
      throw new Error("Already in a call");
    }

    const callerId = currentUser.uid;
    const callerDoc = await getDoc(doc(getDb(), "Users", callerId));
    const callerData = callerDoc.data();

    const callId = uuidv4();
    const now = Date.now();

    // Build participants map
    const participants: Record<string, CallParticipant> = {
      [callerId]: {
        odId: callerId,
        odname: callerData?.odname || "",
        displayName: callerData?.displayName || callerData?.odname || "Unknown",
        avatarConfig: callerData?.avatarConfig,
        joinedAt: now,
        leftAt: null,
        isMuted: false,
        isVideoEnabled: type === "video",
        connectionState: "connecting",
      },
    };

    // Add other participants
    for (const odId of participantIds) {
      const userDoc = await getDoc(doc(getDb(), "Users", odId));
      const userData = userDoc.data();
      participants[odId] = {
        odId,
        odname: userData?.odname || "",
        displayName: userData?.displayName || userData?.odname || "Unknown",
        avatarConfig: userData?.avatarConfig,
        joinedAt: null, // Not joined until they answer
        leftAt: null,
        isMuted: false,
        isVideoEnabled: type === "video",
        connectionState: "connecting",
      };
    }

    // Create call document
    const call: Call = {
      id: callId,
      scope,
      conversationId,
      type,
      status: "ringing",
      callerId,
      callerName: callerData?.displayName || callerData?.odname || "Unknown",
      participants,
      createdAt: now,
      answeredAt: null,
      endedAt: null,
      maxParticipants: scope === "group" ? MAX_GROUP_PARTICIPANTS : 2,
    };

    try {
      // Save to Firestore (triggers Cloud Function to send push notifications)
      await setDoc(doc(getDb(), "Calls", callId), call);

      this.currentCallId = callId;

      // Subscribe to call updates
      this.subscribeToCall(callId);

      // Initialize WebRTC
      await webRTCService.initialize(callId, callerId, type === "video");

      // Create offer for each participant
      for (const odId of participantIds) {
        await webRTCService.createOffer(odId);
      }

      // Report outgoing call to CallKeep
      const recipientName =
        participantIds.length === 1
          ? participants[participantIds[0]].displayName
          : `Group Call (${participantIds.length + 1})`;

      callKeepService.startOutgoingCall(
        callId,
        recipientName,
        participantIds[0],
        type === "video",
      );

      // Set timeout for unanswered call
      this.startCallTimeout(callId);

      this.emitEvent({ type: "call_started", call });

      logInfo("Call started", { callId, type, scope });

      return callId;
    } catch (error) {
      logError("Failed to start call", { error });
      await this.cleanup();
      throw error;
    }
  }

  // ============================================================================
  // Answer Call
  // ============================================================================

  async answerCall(callId: string): Promise<void> {
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    const userId = currentUser.uid;

    try {
      // Get call document
      const callDoc = await getDoc(doc(getDb(), "Calls", callId));
      if (!callDoc.exists()) {
        throw new Error("Call not found");
      }

      const call = callDoc.data() as Call;

      if (call.status !== "ringing") {
        throw new Error(`Cannot answer call with status: ${call.status}`);
      }

      if (!(userId in call.participants)) {
        throw new Error("Not a participant in this call");
      }

      this.currentCallId = callId;

      // Clear timeout
      this.clearCallTimeout();

      // Update call status
      const now = Date.now();
      await updateDoc(doc(getDb(), "Calls", callId), {
        status: "connecting" as CallStatus,
        answeredAt: now,
        [`participants.${userId}.joinedAt`]: now,
        [`participants.${userId}.connectionState`]: "connecting",
      });

      // Subscribe to call updates
      this.subscribeToCall(callId);

      // Initialize WebRTC
      await webRTCService.initialize(callId, userId, call.type === "video");

      // Process any pending offers/answers
      await webRTCService.processPendingSignals(callId);

      // Notify CallKeep
      callKeepService.setCallConnected(callId);

      // Update status to connected once WebRTC is ready
      await updateDoc(doc(getDb(), "Calls", callId), {
        status: "connected" as CallStatus,
        [`participants.${userId}.connectionState`]: "connected",
      });

      const updatedCallDoc = await getDoc(doc(getDb(), "Calls", callId));
      const updatedCall = updatedCallDoc.data() as Call;

      this.emitEvent({ type: "call_answered", call: updatedCall });

      logInfo("Call answered", { callId });
    } catch (error) {
      logError("Failed to answer call", { error });
      await this.cleanup();
      throw error;
    }
  }

  // ============================================================================
  // Decline Call
  // ============================================================================

  async declineCall(callId: string): Promise<void> {
    if (!getAuth().currentUser) {
      throw new Error("User not authenticated");
    }

    try {
      const callDoc = await getDoc(doc(getDb(), "Calls", callId));
      if (!callDoc.exists()) {
        throw new Error("Call not found");
      }

      const call = callDoc.data() as Call;

      // Update call status
      await updateDoc(doc(getDb(), "Calls", callId), {
        status: "declined" as CallStatus,
        endedAt: Date.now(),
        endReason: "declined" as CallEndReason,
      });

      // Notify CallKeep
      callKeepService.reportEndCall(callId, 5); // DECLINED_ELSEWHERE

      this.emitEvent({
        type: "call_ended",
        call: { ...call, status: "declined" },
        reason: "declined",
      });

      logInfo("Call declined", { callId });
    } catch (error) {
      logError("Failed to decline call", { error });
      throw error;
    }
  }

  // ============================================================================
  // End Call
  // ============================================================================

  async endCall(callId?: string): Promise<void> {
    const targetCallId = callId || this.currentCallId;
    if (!targetCallId) {
      logDebug("No active call to end");
      return;
    }

    try {
      const callDoc = await getDoc(doc(getDb(), "Calls", targetCallId));
      if (!callDoc.exists()) {
        logDebug("Call document not found", { callId: targetCallId });
        await this.cleanup();
        return;
      }

      const call = callDoc.data() as Call;
      const now = Date.now();
      const duration = call.answeredAt
        ? Math.floor((now - call.answeredAt) / 1000)
        : null;

      // Update call status
      await updateDoc(doc(getDb(), "Calls", targetCallId), {
        status: "ended" as CallStatus,
        endedAt: now,
        endReason: "completed" as CallEndReason,
        duration,
      });

      // Notify CallKeep
      callKeepService.endCall(targetCallId);

      this.emitEvent({
        type: "call_ended",
        call: { ...call, status: "ended" },
        reason: "completed",
      });

      logInfo("Call ended", { callId: targetCallId, duration });
    } catch (error) {
      logError("Failed to end call", { error });
    } finally {
      await this.cleanup();
    }
  }

  // ============================================================================
  // Media Controls
  // ============================================================================

  toggleMute(): boolean {
    const newMuted = webRTCService.toggleMute();
    const currentUser = getAuth().currentUser;
    if (this.currentCallId && currentUser) {
      updateDoc(doc(getDb(), "Calls", this.currentCallId), {
        [`participants.${currentUser.uid}.isMuted`]: newMuted,
      }).catch((error) => logError("Failed to update mute state", { error }));
      callKeepService.setMuted(this.currentCallId, newMuted);
    }
    return newMuted;
  }

  toggleSpeaker(): boolean {
    return webRTCService.toggleSpeaker();
  }

  toggleVideo(): boolean {
    const newEnabled = webRTCService.toggleVideo();
    const currentUser = getAuth().currentUser;
    if (this.currentCallId && currentUser) {
      updateDoc(doc(getDb(), "Calls", this.currentCallId), {
        [`participants.${currentUser.uid}.isVideoEnabled`]: newEnabled,
      }).catch((error) => logError("Failed to update video state", { error }));
    }
    return newEnabled;
  }

  async switchCamera(): Promise<void> {
    await webRTCService.switchCamera();
  }

  // ============================================================================
  // Call Subscriptions
  // ============================================================================

  private subscribeToCall(callId: string): void {
    this.callSubscription?.();

    this.callSubscription = onSnapshot(
      doc(getDb(), "Calls", callId),
      (snapshot) => {
        if (!snapshot.exists()) {
          logDebug("Call document deleted", { callId });
          this.cleanup();
          return;
        }

        const call = snapshot.data() as Call;

        // Handle call status changes
        if (call.status === "ended" || call.status === "failed") {
          this.emitEvent({
            type: "call_ended",
            call,
            reason: call.endReason || "completed",
          });
          this.cleanup();
        } else if (call.status === "declined") {
          this.emitEvent({
            type: "call_ended",
            call,
            reason: "declined",
          });
          this.cleanup();
        } else if (call.status === "missed") {
          this.emitEvent({
            type: "call_ended",
            call,
            reason: "missed",
          });
          this.cleanup();
        }
      },
      (error) => {
        logError("Call subscription error", { error });
      },
    );
  }

  private async subscribeToIncomingCalls(): Promise<void> {
    const currentUser = getAuth().currentUser;
    if (!currentUser) return;

    const userId = currentUser.uid;

    // Query for ringing calls where current user is a participant
    const callsQuery = query(
      collection(getDb(), "Calls"),
      where("status", "==", "ringing"),
      where(`participants.${userId}`, "!=", null),
      orderBy("createdAt", "desc"),
      limit(1),
    );

    this.incomingCallSubscription = onSnapshot(
      callsQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const call = change.doc.data() as Call;

            // Skip if we're the caller
            if (call.callerId === userId) return;

            // Skip if we already have an active call
            if (this.currentCallId) return;

            logInfo("Incoming call detected", { callId: call.id });

            // Display incoming call via CallKeep
            const callerParticipant = call.participants[call.callerId];
            callKeepService.displayIncomingCall(
              call.id,
              callerParticipant?.displayName || "Unknown",
              call.callerId,
              call.type === "video",
            );

            this.emitEvent({ type: "call_started", call });
          }
        });
      },
      (error) => {
        logError("Incoming calls subscription error", { error });
      },
    );
  }

  // ============================================================================
  // Call Timeout
  // ============================================================================

  private startCallTimeout(callId: string): void {
    this.clearCallTimeout();

    this.callTimeoutId = setTimeout(async () => {
      logInfo("Call timeout reached", { callId });

      try {
        const callDoc = await getDoc(doc(getDb(), "Calls", callId));
        if (!callDoc.exists()) return;

        const call = callDoc.data() as Call;
        if (call.status !== "ringing") return;

        // Mark as missed
        await updateDoc(doc(getDb(), "Calls", callId), {
          status: "missed" as CallStatus,
          endedAt: Date.now(),
          endReason: "missed" as CallEndReason,
        });

        callKeepService.reportEndCall(callId, 6); // MISSED

        this.emitEvent({
          type: "call_ended",
          call: { ...call, status: "missed" },
          reason: "missed",
        });

        await this.cleanup();
      } catch (error) {
        logError("Error handling call timeout", { error });
      }
    }, CALL_TIMEOUT_MS);
  }

  private clearCallTimeout(): void {
    if (this.callTimeoutId) {
      clearTimeout(this.callTimeoutId);
      this.callTimeoutId = null;
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  private async cleanup(): Promise<void> {
    this.clearCallTimeout();

    this.callSubscription?.();
    this.callSubscription = null;

    await webRTCService.cleanup();

    this.currentCallId = null;

    logDebug("Call cleanup completed");
  }

  // ============================================================================
  // Getters
  // ============================================================================

  getCurrentCallId(): string | null {
    return this.currentCallId;
  }

  hasActiveCall(): boolean {
    return this.currentCallId !== null;
  }

  // ============================================================================
  // Call History
  // ============================================================================

  async getCallHistory(
    userId: string,
    limitCount: number = 50,
  ): Promise<CallHistoryEntry[]> {
    const historyQuery = query(
      collection(getDb(), "Users", userId, "CallHistory"),
      orderBy("createdAt", "desc"),
      limit(limitCount),
    );

    const snapshot = await getDoc(doc(getDb(), "Users", userId));
    // This would need actual implementation to query the CallHistory subcollection
    // For now, return empty array
    return [];
  }
}

export const callService = CallService.getInstance();
