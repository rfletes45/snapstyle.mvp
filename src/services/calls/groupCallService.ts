/**
 * GroupCallService - Extended functionality for group video/audio calls
 * Handles multi-participant calls, host controls, and group-specific features
 */

import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  Unsubscribe,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import {
  Call,
  CallEndReason,
  CallEvent,
  CallEventHandler,
  CallParticipant,
  CallStatus,
  CallType,
  GroupCallInvite,
  GroupCallLayout,
  GroupCallParticipant,
  GroupCallRole,
  GroupCallSettings,
  MAX_GROUP_PARTICIPANTS,
} from "@/types/call";
import { getAuthInstance, getFirestoreInstance } from "@/services/firebase";
import { callKeepService } from "./callKeepService";
import { webRTCService } from "./webRTCService";


import { createLogger } from "@/utils/log";
const logger = createLogger("services/calls/groupCallService");
// Lazy getters to avoid Firebase initialization issues at module load time
const getDb = () => getFirestoreInstance();
const getAuth = () => getAuthInstance();

// Simple logging helpers
const logInfo = (msg: string, data?: any) =>
  logger.info(`[GroupCallService] ${msg}`, data ?? "");
const logError = (msg: string, error?: any) =>
  logger.error(`[GroupCallService] ${msg}`, error ?? "");
const logDebug = (msg: string, data?: any) =>
  __DEV__ && logger.info(`[GroupCallService] ${msg}`, data ?? "");

// Default group call settings
const DEFAULT_GROUP_CALL_SETTINGS: GroupCallSettings = {
  maxParticipants: MAX_GROUP_PARTICIPANTS,
  allowScreenShare: true,
  muteOnJoin: false,
  videoOffOnJoin: false,
  allowParticipantsToUnmute: true,
  hostOnlyInvite: false,
  recordingEnabled: false,
};

// Voice activity detection threshold (0-100)
const VOICE_ACTIVITY_THRESHOLD = 30;
const ACTIVE_SPEAKER_DEBOUNCE_MS = 1500;

class GroupCallService {
  private static instance: GroupCallService;
  private callSubscription: Unsubscribe | null = null;
  private participantsSubscription: Unsubscribe | null = null;
  private eventHandlers: Set<CallEventHandler> = new Set();
  private currentGroupCallId: string | null = null;
  private activeSpeakerTimeout: ReturnType<typeof setTimeout> | null = null;
  private voiceActivityListeners: Map<string, () => void> = new Map();
  private currentLayout: GroupCallLayout = "grid";
  private pinnedParticipantId: string | null = null;

  private constructor() {}

  static getInstance(): GroupCallService {
    if (!GroupCallService.instance) {
      GroupCallService.instance = new GroupCallService();
    }
    return GroupCallService.instance;
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
  // Start Group Call
  // ============================================================================

  async startGroupCall(
    groupId: string,
    groupName: string,
    memberIds: string[],
    type: CallType = "video",
    settings: Partial<GroupCallSettings> = {},
  ): Promise<string> {
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    if (memberIds.length > MAX_GROUP_PARTICIPANTS - 1) {
      throw new Error(
        `Group call cannot exceed ${MAX_GROUP_PARTICIPANTS} participants`,
      );
    }

    const callerId = currentUser.uid;
    const callerDoc = await getDoc(doc(getDb(), "Users", callerId));
    const callerData = callerDoc.data();

    const callId = uuidv4();
    const now = Date.now();
    const mergedSettings = { ...DEFAULT_GROUP_CALL_SETTINGS, ...settings };

    // Build participants map with the caller as host
    const participants: Record<string, GroupCallParticipant> = {
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
        role: "host",
        raisedHand: false,
        audioLevel: 0,
      },
    };

    // Add other members as invited participants
    for (const odId of memberIds) {
      if (odId === callerId) continue;
      const userDoc = await getDoc(doc(getDb(), "Users", odId));
      const userData = userDoc.data();
      participants[odId] = {
        odId,
        odname: userData?.odname || "",
        displayName: userData?.displayName || userData?.odname || "Unknown",
        avatarConfig: userData?.avatarConfig,
        joinedAt: null,
        leftAt: null,
        isMuted: mergedSettings.muteOnJoin,
        isVideoEnabled: type === "video" && !mergedSettings.videoOffOnJoin,
        connectionState: "connecting",
        role: "participant",
        raisedHand: false,
        audioLevel: 0,
      };
    }

    // Create call document
    const call: Call = {
      id: callId,
      scope: "group",
      conversationId: groupId,
      type,
      status: "ringing",
      callerId,
      callerName: callerData?.displayName || callerData?.odname || "Unknown",
      participants,
      createdAt: now,
      answeredAt: null,
      endedAt: null,
      maxParticipants: mergedSettings.maxParticipants,
      hostId: callerId,
      isLocked: false,
      activeSpeakerId: undefined,
      pinnedParticipantId: undefined,
    };

    try {
      // Save to Firestore
      await setDoc(doc(getDb(), "Calls", callId), call);

      // Save call settings
      await setDoc(
        doc(getDb(), "Calls", callId, "Settings", "config"),
        mergedSettings,
      );

      this.currentGroupCallId = callId;

      // Subscribe to call updates
      this.subscribeToGroupCall(callId);

      // Initialize WebRTC
      await webRTCService.initialize(callId, callerId, type === "video");

      // Report outgoing call to CallKeep
      callKeepService.startOutgoingCall(
        callId,
        `${groupName} (Group Call)`,
        memberIds[0],
        type === "video",
      );

      this.emitEvent({ type: "call_started", call });

      logInfo("Group call started", {
        callId,
        groupId,
        participantCount: memberIds.length + 1,
      });

      return callId;
    } catch (error) {
      logError("Failed to start group call", { error });
      await this.cleanup();
      throw error;
    }
  }

  // ============================================================================
  // Join Group Call (Mid-Call Join)
  // ============================================================================

  async joinGroupCall(callId: string): Promise<void> {
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    const userId = currentUser.uid;

    try {
      const callDoc = await getDoc(doc(getDb(), "Calls", callId));
      if (!callDoc.exists()) {
        throw new Error("Call not found");
      }

      const call = callDoc.data() as Call;

      // Check if call is locked
      if (call.isLocked) {
        throw new Error("This call is locked. You cannot join.");
      }

      // Check participant limit
      const activeParticipants = Object.values(call.participants).filter(
        (p) => p.joinedAt && !p.leftAt,
      ).length;

      if (
        activeParticipants >= (call.maxParticipants || MAX_GROUP_PARTICIPANTS)
      ) {
        throw new Error("Call has reached maximum participants");
      }

      // Check if already in call
      const existingParticipant = call.participants[userId];
      if (existingParticipant?.joinedAt && !existingParticipant.leftAt) {
        throw new Error("Already in this call");
      }

      // Get current user data
      const userDoc = await getDoc(doc(getDb(), "Users", userId));
      const userData = userDoc.data();

      // Get call settings
      const settingsDoc = await getDoc(
        doc(getDb(), "Calls", callId, "Settings", "config"),
      );
      const settings = settingsDoc.exists()
        ? (settingsDoc.data() as GroupCallSettings)
        : DEFAULT_GROUP_CALL_SETTINGS;

      const now = Date.now();
      const newParticipant: GroupCallParticipant = {
        odId: userId,
        odname: userData?.odname || "",
        displayName: userData?.displayName || userData?.odname || "Unknown",
        avatarConfig: userData?.avatarConfig,
        joinedAt: now,
        leftAt: null,
        isMuted: settings.muteOnJoin,
        isVideoEnabled: call.type === "video" && !settings.videoOffOnJoin,
        connectionState: "connecting",
        role: "participant",
        raisedHand: false,
        audioLevel: 0,
      };

      // Update call document
      await updateDoc(doc(getDb(), "Calls", callId), {
        [`participants.${userId}`]: newParticipant,
        status: "connected" as CallStatus,
      });

      this.currentGroupCallId = callId;

      // Subscribe to call updates
      this.subscribeToGroupCall(callId);

      // Initialize WebRTC
      await webRTCService.initialize(callId, userId, call.type === "video");

      // Create peer connections with all existing connected participants
      const connectedParticipants = Object.values(call.participants).filter(
        (p) => p.joinedAt && !p.leftAt && p.odId !== userId,
      );

      for (const participant of connectedParticipants) {
        await webRTCService.createOffer(participant.odId);
      }

      // Process any pending signals
      await webRTCService.processPendingSignals(callId);

      // Update connection state
      await updateDoc(doc(getDb(), "Calls", callId), {
        [`participants.${userId}.connectionState`]: "connected",
      });

      // Emit participant joined event
      this.emitEvent({
        type: "participant_joined",
        callId,
        participant: newParticipant,
      });

      logInfo("Joined group call", { callId, userId });
    } catch (error) {
      logError("Failed to join group call", { error });
      throw error;
    }
  }

  // ============================================================================
  // Leave Group Call
  // ============================================================================

  async leaveGroupCall(callId?: string): Promise<void> {
    const targetCallId = callId || this.currentGroupCallId;
    const currentUser = getAuth().currentUser;
    if (!targetCallId || !currentUser) {
      return;
    }

    const userId = currentUser.uid;

    try {
      const callDoc = await getDoc(doc(getDb(), "Calls", targetCallId));
      if (!callDoc.exists()) {
        await this.cleanup();
        return;
      }

      const call = callDoc.data() as Call;
      const now = Date.now();

      // Check if user is the host
      const isHost = call.hostId === userId || call.callerId === userId;

      // Count remaining participants
      const remainingParticipants = Object.values(call.participants).filter(
        (p) => p.joinedAt && !p.leftAt && p.odId !== userId,
      );

      if (remainingParticipants.length === 0) {
        // End the call if no one else is in it
        await this.endGroupCall(targetCallId);
      } else if (isHost && remainingParticipants.length > 0) {
        // Transfer host role to first participant
        const newHost = remainingParticipants[0];
        await updateDoc(doc(getDb(), "Calls", targetCallId), {
          hostId: newHost.odId,
          [`participants.${userId}.leftAt`]: now,
          [`participants.${userId}.connectionState`]: "disconnected",
          [`participants.${newHost.odId}.role`]: "host",
        });

        this.emitEvent({
          type: "participant_role_changed",
          callId: targetCallId,
          odId: newHost.odId,
          role: "host",
        });
      } else {
        // Just mark as left
        await updateDoc(doc(getDb(), "Calls", targetCallId), {
          [`participants.${userId}.leftAt`]: now,
          [`participants.${userId}.connectionState`]: "disconnected",
        });
      }

      // Emit participant left event
      this.emitEvent({
        type: "participant_left",
        callId: targetCallId,
        odId: userId,
      });

      callKeepService.endCall(targetCallId);
      await this.cleanup();

      logInfo("Left group call", { callId: targetCallId });
    } catch (error) {
      logError("Failed to leave group call", { error });
      await this.cleanup();
    }
  }

  // ============================================================================
  // End Group Call (Host Only)
  // ============================================================================

  async endGroupCall(callId?: string): Promise<void> {
    const targetCallId = callId || this.currentGroupCallId;
    if (!targetCallId) {
      return;
    }

    try {
      const callDoc = await getDoc(doc(getDb(), "Calls", targetCallId));
      if (!callDoc.exists()) {
        await this.cleanup();
        return;
      }

      const call = callDoc.data() as Call;
      const now = Date.now();
      const duration = call.answeredAt
        ? Math.floor((now - call.answeredAt) / 1000)
        : null;

      // Update all participants as left
      const participantUpdates: Record<string, any> = {};
      Object.keys(call.participants).forEach((odId) => {
        participantUpdates[`participants.${odId}.leftAt`] = now;
        participantUpdates[`participants.${odId}.connectionState`] =
          "disconnected";
      });

      await updateDoc(doc(getDb(), "Calls", targetCallId), {
        ...participantUpdates,
        status: "ended" as CallStatus,
        endedAt: now,
        endReason: "completed" as CallEndReason,
        duration,
      });

      callKeepService.endCall(targetCallId);

      this.emitEvent({
        type: "call_ended",
        call: { ...call, status: "ended" },
        reason: "completed",
      });

      await this.cleanup();

      logInfo("Group call ended", { callId: targetCallId, duration });
    } catch (error) {
      logError("Failed to end group call", { error });
      await this.cleanup();
    }
  }

  // ============================================================================
  // Host Controls
  // ============================================================================

  async muteAllParticipants(callId: string): Promise<void> {
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    const userId = currentUser.uid;

    const callDoc = await getDoc(doc(getDb(), "Calls", callId));
    if (!callDoc.exists()) {
      throw new Error("Call not found");
    }

    const call = callDoc.data() as Call;

    // Verify host/co-host permissions
    if (!this.hasHostPermissions(call, userId)) {
      throw new Error("Only host or co-host can mute all participants");
    }

    // Mute all participants except the host
    const muteUpdates: Record<string, any> = {};
    Object.keys(call.participants).forEach((odId) => {
      if (odId !== userId) {
        muteUpdates[`participants.${odId}.isMuted`] = true;
      }
    });

    await updateDoc(doc(getDb(), "Calls", callId), muteUpdates);

    this.emitEvent({
      type: "all_muted",
      callId,
      byHostId: userId,
    });

    logInfo("All participants muted", { callId, byHostId: userId });
  }

  async removeParticipant(
    callId: string,
    participantId: string,
  ): Promise<void> {
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    const userId = currentUser.uid;

    const callDoc = await getDoc(doc(getDb(), "Calls", callId));
    if (!callDoc.exists()) {
      throw new Error("Call not found");
    }

    const call = callDoc.data() as Call;

    // Verify host/co-host permissions
    if (!this.hasHostPermissions(call, userId)) {
      throw new Error("Only host or co-host can remove participants");
    }

    // Cannot remove yourself or another host
    if (participantId === userId) {
      throw new Error("Cannot remove yourself");
    }

    const participant = call.participants[
      participantId
    ] as GroupCallParticipant;
    if (participant?.role === "host") {
      throw new Error("Cannot remove the host");
    }

    // Mark participant as removed
    await updateDoc(doc(getDb(), "Calls", callId), {
      [`participants.${participantId}.leftAt`]: Date.now(),
      [`participants.${participantId}.connectionState`]: "disconnected",
    });

    this.emitEvent({
      type: "participant_removed",
      callId,
      odId: participantId,
      byHostId: userId,
    });

    logInfo("Participant removed", { callId, participantId, byHostId: userId });
  }

  async promoteToCoHost(callId: string, participantId: string): Promise<void> {
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    const userId = currentUser.uid;

    const callDoc = await getDoc(doc(getDb(), "Calls", callId));
    if (!callDoc.exists()) {
      throw new Error("Call not found");
    }

    const call = callDoc.data() as Call;

    // Only host can promote
    if (call.hostId !== userId) {
      throw new Error("Only host can promote to co-host");
    }

    await updateDoc(doc(getDb(), "Calls", callId), {
      [`participants.${participantId}.role`]: "co-host" as GroupCallRole,
    });

    this.emitEvent({
      type: "participant_role_changed",
      callId,
      odId: participantId,
      role: "co-host",
    });

    logInfo("Participant promoted to co-host", { callId, participantId });
  }

  async lockCall(callId: string, locked: boolean): Promise<void> {
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    const userId = currentUser.uid;

    const callDoc = await getDoc(doc(getDb(), "Calls", callId));
    if (!callDoc.exists()) {
      throw new Error("Call not found");
    }

    const call = callDoc.data() as Call;

    if (!this.hasHostPermissions(call, userId)) {
      throw new Error("Only host or co-host can lock/unlock the call");
    }

    await updateDoc(doc(getDb(), "Calls", callId), {
      isLocked: locked,
    });

    this.emitEvent({
      type: "call_locked",
      callId,
      locked,
    });

    logInfo(`Call ${locked ? "locked" : "unlocked"}`, { callId });
  }

  // ============================================================================
  // Participant Features
  // ============================================================================

  async raiseHand(callId: string, raised: boolean): Promise<void> {
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    const userId = currentUser.uid;

    await updateDoc(doc(getDb(), "Calls", callId), {
      [`participants.${userId}.raisedHand`]: raised,
      [`participants.${userId}.raisedHandAt`]: raised ? Date.now() : null,
    });

    this.emitEvent({
      type: "hand_raised",
      callId,
      odId: userId,
      raised,
    });

    logDebug(`Hand ${raised ? "raised" : "lowered"}`, { callId, userId });
  }

  async lowerAllHands(callId: string): Promise<void> {
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    const userId = currentUser.uid;

    const callDoc = await getDoc(doc(getDb(), "Calls", callId));
    if (!callDoc.exists()) {
      throw new Error("Call not found");
    }

    const call = callDoc.data() as Call;

    if (!this.hasHostPermissions(call, userId)) {
      throw new Error("Only host or co-host can lower all hands");
    }

    const handUpdates: Record<string, any> = {};
    Object.keys(call.participants).forEach((odId) => {
      handUpdates[`participants.${odId}.raisedHand`] = false;
      handUpdates[`participants.${odId}.raisedHandAt`] = null;
    });

    await updateDoc(doc(getDb(), "Calls", callId), handUpdates);

    logInfo("All hands lowered", { callId });
  }

  // ============================================================================
  // Layout & View
  // ============================================================================

  setLayout(layout: GroupCallLayout): void {
    this.currentLayout = layout;
    if (this.currentGroupCallId) {
      this.emitEvent({
        type: "layout_changed",
        callId: this.currentGroupCallId,
        layout,
      });
    }
    logDebug("Layout changed", { layout });
  }

  getLayout(): GroupCallLayout {
    return this.currentLayout;
  }

  async pinParticipant(
    callId: string,
    participantId: string | null,
  ): Promise<void> {
    this.pinnedParticipantId = participantId;

    await updateDoc(doc(getDb(), "Calls", callId), {
      pinnedParticipantId: participantId,
    });

    this.emitEvent({
      type: "participant_pinned",
      callId,
      odId: participantId,
    });

    logDebug("Participant pinned", { callId, participantId });
  }

  getPinnedParticipantId(): string | null {
    return this.pinnedParticipantId;
  }

  // ============================================================================
  // Voice Activity Detection (Active Speaker)
  // ============================================================================

  async updateActiveSpeaker(
    callId: string,
    speakerId: string | null,
  ): Promise<void> {
    // Debounce active speaker updates
    if (this.activeSpeakerTimeout) {
      clearTimeout(this.activeSpeakerTimeout);
    }

    this.activeSpeakerTimeout = setTimeout(async () => {
      try {
        await updateDoc(doc(getDb(), "Calls", callId), {
          activeSpeakerId: speakerId,
        });

        this.emitEvent({
          type: "active_speaker_changed",
          callId,
          odId: speakerId,
        });
      } catch (error) {
        logError("Failed to update active speaker", { error });
      }
    }, ACTIVE_SPEAKER_DEBOUNCE_MS);
  }

  async updateAudioLevel(
    callId: string,
    participantId: string,
    level: number,
  ): Promise<void> {
    try {
      await updateDoc(doc(getDb(), "Calls", callId), {
        [`participants.${participantId}.audioLevel`]: Math.round(level),
      });

      // If level exceeds threshold, consider as active speaker
      if (level > VOICE_ACTIVITY_THRESHOLD) {
        await this.updateActiveSpeaker(callId, participantId);
      }
    } catch (error) {
      // Silently fail for audio level updates (too frequent)
    }
  }

  // ============================================================================
  // Invite More Participants
  // ============================================================================

  async inviteToCall(callId: string, inviteeIds: string[]): Promise<void> {
    const currentUser = getAuth().currentUser;
    if (!currentUser) {
      throw new Error("User not authenticated");
    }

    const userId = currentUser.uid;

    const callDoc = await getDoc(doc(getDb(), "Calls", callId));
    if (!callDoc.exists()) {
      throw new Error("Call not found");
    }

    const call = callDoc.data() as Call;

    // Check settings for host-only invite
    const settingsDoc = await getDoc(
      doc(getDb(), "Calls", callId, "Settings", "config"),
    );
    const settings = settingsDoc.exists()
      ? (settingsDoc.data() as GroupCallSettings)
      : DEFAULT_GROUP_CALL_SETTINGS;

    if (settings.hostOnlyInvite && !this.hasHostPermissions(call, userId)) {
      throw new Error("Only host or co-host can invite participants");
    }

    // Check participant limit
    const currentParticipantCount = Object.values(call.participants).filter(
      (p) => p.joinedAt && !p.leftAt,
    ).length;

    const newInviteCount = inviteeIds.filter(
      (id) => !call.participants[id],
    ).length;

    if (
      currentParticipantCount + newInviteCount >
      (call.maxParticipants || MAX_GROUP_PARTICIPANTS)
    ) {
      throw new Error("Would exceed maximum participant limit");
    }

    // Get inviter data
    const inviterDoc = await getDoc(doc(getDb(), "Users", userId));
    const inviterData = inviterDoc.data();

    // Get group name if available
    const groupDoc = await getDoc(
      doc(getDb(), "GroupChats", call.conversationId),
    );
    const groupName = groupDoc.exists() ? groupDoc.data()?.name : "Group Call";

    const batch = writeBatch(getDb());
    const now = Date.now();

    for (const inviteeId of inviteeIds) {
      // Skip if already a participant
      if (call.participants[inviteeId]) {
        continue;
      }

      // Get invitee data
      const inviteeDoc = await getDoc(doc(getDb(), "Users", inviteeId));
      const inviteeData = inviteeDoc.data();

      // Create invite document
      const inviteId = uuidv4();
      const invite: GroupCallInvite = {
        callId,
        inviterId: userId,
        inviterName:
          inviterData?.displayName || inviterData?.odname || "Unknown",
        inviteeId,
        groupId: call.conversationId,
        groupName,
        callType: call.type,
        createdAt: now,
        expiresAt: now + 60000, // 1 minute expiry
        status: "pending",
      };

      batch.set(doc(getDb(), "GroupCallInvites", inviteId), invite);

      // Add as pending participant
      const pendingParticipant: GroupCallParticipant = {
        odId: inviteeId,
        odname: inviteeData?.odname || "",
        displayName:
          inviteeData?.displayName || inviteeData?.odname || "Unknown",
        avatarConfig: inviteeData?.avatarConfig,
        joinedAt: null,
        leftAt: null,
        isMuted: settings.muteOnJoin,
        isVideoEnabled: call.type === "video" && !settings.videoOffOnJoin,
        connectionState: "connecting",
        role: "participant",
        raisedHand: false,
        audioLevel: 0,
      };

      batch.update(doc(getDb(), "Calls", callId), {
        [`participants.${inviteeId}`]: pendingParticipant,
      });
    }

    await batch.commit();

    logInfo("Invites sent", { callId, inviteeCount: inviteeIds.length });
  }

  // ============================================================================
  // Subscriptions
  // ============================================================================

  private subscribeToGroupCall(callId: string): void {
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
        }

        // Update pinned participant
        if (call.pinnedParticipantId !== this.pinnedParticipantId) {
          this.pinnedParticipantId = call.pinnedParticipantId || null;
          this.emitEvent({
            type: "participant_pinned",
            callId,
            odId: this.pinnedParticipantId,
          });
        }

        // Handle active speaker changes
        if (call.activeSpeakerId) {
          this.emitEvent({
            type: "active_speaker_changed",
            callId,
            odId: call.activeSpeakerId,
          });
        }
      },
      (error) => {
        logError("Group call subscription error", { error });
      },
    );
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private hasHostPermissions(call: Call, userId: string): boolean {
    if (call.hostId === userId) return true;
    if (call.callerId === userId) return true;

    const participant = call.participants[userId] as GroupCallParticipant;
    return participant?.role === "host" || participant?.role === "co-host";
  }

  isGroupCall(call: Call | null): boolean {
    return call?.scope === "group";
  }

  getActiveParticipants(call: Call): CallParticipant[] {
    return Object.values(call.participants).filter(
      (p) => p.joinedAt && !p.leftAt,
    );
  }

  getActiveParticipantCount(call: Call): number {
    return this.getActiveParticipants(call).length;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  private async cleanup(): Promise<void> {
    if (this.activeSpeakerTimeout) {
      clearTimeout(this.activeSpeakerTimeout);
      this.activeSpeakerTimeout = null;
    }

    this.callSubscription?.();
    this.callSubscription = null;

    this.participantsSubscription?.();
    this.participantsSubscription = null;

    this.voiceActivityListeners.forEach((cleanup) => cleanup());
    this.voiceActivityListeners.clear();

    this.currentGroupCallId = null;
    this.pinnedParticipantId = null;
    this.currentLayout = "grid";

    await webRTCService.cleanup();

    logDebug("Group call cleanup completed");
  }

  // ============================================================================
  // Getters
  // ============================================================================

  getCurrentGroupCallId(): string | null {
    return this.currentGroupCallId;
  }

  hasActiveGroupCall(): boolean {
    return this.currentGroupCallId !== null;
  }
}

export const groupCallService = GroupCallService.getInstance();
