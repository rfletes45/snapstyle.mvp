/**
 * WebRTCService - Handles WebRTC peer connections and media
 * Manages RTCPeerConnection, streams, and Firestore signaling for calls
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Unsubscribe,
  where,
} from "firebase/firestore";
import {
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from "react-native-webrtc";
import { v4 as uuidv4 } from "uuid";
import {
  DEFAULT_ICE_SERVERS,
  IceConfig,
  SignalingMessage,
} from "../../types/call";
import { getAuthInstance, getFirestoreInstance } from "../firebase";

// Firebase instances
const getDb = () => getFirestoreInstance();
const getAuth = () => getAuthInstance();

// Simple logging helpers
const logInfo = (msg: string, data?: any) =>
  console.log(`[WebRTCService] ${msg}`, data ?? "");
const logError = (msg: string, error?: any) =>
  console.error(`[WebRTCService] ${msg}`, error ?? "");
const logDebug = (msg: string, data?: any) =>
  __DEV__ && console.log(`[WebRTCService] ${msg}`, data ?? "");
const logWarn = (msg: string, data?: any) =>
  console.warn(`[WebRTCService] ${msg}`, data ?? "");

const LOG_TAG = "WebRTCService";

// Media constraints
const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

const VIDEO_CONSTRAINTS = {
  facingMode: "user",
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30 },
};

class WebRTCService {
  private static instance: WebRTCService;

  // Peer connections - one per remote participant
  private peerConnections: Map<string, RTCPeerConnection> = new Map();

  // Local media stream
  private localStream: MediaStream | null = null;

  // Remote streams - keyed by participant odId
  private remoteStreams: Map<string, MediaStream> = new Map();

  // Current call state
  private currentCallId: string | null = null;
  private currentUserId: string | null = null;
  private isVideoEnabled: boolean = false;
  private isMuted: boolean = false;
  private isSpeakerOn: boolean = false;
  private isFrontCamera: boolean = true;

  // Signaling subscription
  private signalingSubscription: Unsubscribe | null = null;

  // ICE configuration
  private iceConfig: IceConfig = {
    iceServers: DEFAULT_ICE_SERVERS,
  };

  // Callbacks
  private onRemoteStreamAdded?: (odId: string, stream: MediaStream) => void;
  private onRemoteStreamRemoved?: (odId: string) => void;
  private onConnectionStateChanged?: (
    odId: string,
    state: RTCPeerConnectionState,
  ) => void;

  private constructor() {}

  static getInstance(): WebRTCService {
    if (!WebRTCService.instance) {
      WebRTCService.instance = new WebRTCService();
    }
    return WebRTCService.instance;
  }

  // ============================================================================
  // Callbacks
  // ============================================================================

  setCallbacks(callbacks: {
    onRemoteStreamAdded?: (odId: string, stream: MediaStream) => void;
    onRemoteStreamRemoved?: (odId: string) => void;
    onConnectionStateChanged?: (
      odId: string,
      state: RTCPeerConnectionState,
    ) => void;
  }): void {
    this.onRemoteStreamAdded = callbacks.onRemoteStreamAdded;
    this.onRemoteStreamRemoved = callbacks.onRemoteStreamRemoved;
    this.onConnectionStateChanged = callbacks.onConnectionStateChanged;
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  async initialize(
    callId: string,
    userId: string,
    enableVideo: boolean,
  ): Promise<void> {
    logInfo("Initializing WebRTC", { callId, userId, enableVideo });

    this.currentCallId = callId;
    this.currentUserId = userId;
    this.isVideoEnabled = enableVideo;

    // Fetch TURN credentials if available
    await this.fetchTurnCredentials();

    // Get local media stream
    await this.initializeLocalStream(enableVideo);

    // Subscribe to signaling messages
    this.subscribeToSignaling(callId);
  }

  private async fetchTurnCredentials(): Promise<void> {
    try {
      // TODO: Implement Cloud Function call to get TURN credentials
      // const response = await httpsCallable(functions, 'getTurnCredentials')();
      // const { username, credential, urls } = response.data;
      // this.iceConfig.iceServers.push({ urls, username, credential });

      logDebug("Using default ICE servers (TURN credentials TODO)");
    } catch (error) {
      logWarn("Failed to fetch TURN credentials, using STUN only", {
        error,
      });
    }
  }

  // ============================================================================
  // Local Media
  // ============================================================================

  private async initializeLocalStream(enableVideo: boolean): Promise<void> {
    try {
      const constraints = {
        audio: AUDIO_CONSTRAINTS as any,
        video: enableVideo ? (VIDEO_CONSTRAINTS as any) : false,
      };

      this.localStream = await mediaDevices.getUserMedia(constraints);
      this.isVideoEnabled = enableVideo;

      logInfo("Got local media stream", {
        audioTracks: this.localStream.getAudioTracks().length,
        videoTracks: this.localStream.getVideoTracks().length,
      });
    } catch (error) {
      logError("Failed to get local media", { error });
      throw new Error("Failed to access camera/microphone");
    }
  }

  /**
   * Get the current local media stream
   */
  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get remote streams map
   */
  public getRemoteStreams(): Map<string, MediaStream> {
    return this.remoteStreams;
  }

  // ============================================================================
  // Peer Connection Management
  // ============================================================================

  private createPeerConnection(remoteUserId: string): RTCPeerConnection {
    logDebug("Creating peer connection", { remoteUserId });

    const pc = new RTCPeerConnection(this.iceConfig as any);

    // Add local tracks to connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle incoming tracks (react-native-webrtc uses addEventListener)
    (pc as any).addEventListener("track", (event: any) => {
      logDebug("Remote track received", {
        remoteUserId,
        kind: event.track?.kind,
      });

      // Get or create remote stream for this user
      let remoteStream = this.remoteStreams.get(remoteUserId);
      if (!remoteStream) {
        remoteStream = new MediaStream([]);
        this.remoteStreams.set(remoteUserId, remoteStream);
      }

      if (event.track) {
        remoteStream.addTrack(event.track);
      }

      this.onRemoteStreamAdded?.(remoteUserId, remoteStream);
    });

    // Handle ICE candidates
    (pc as any).addEventListener("icecandidate", (event: any) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: "ice-candidate",
          to: remoteUserId,
          payload: event.candidate.toJSON(),
        });
      }
    });

    // Handle connection state changes
    (pc as any).addEventListener("connectionstatechange", () => {
      const connectionState = (pc as any).connectionState;
      logDebug("Connection state changed", {
        remoteUserId,
        state: connectionState,
      });

      this.onConnectionStateChanged?.(remoteUserId, connectionState);

      if (connectionState === "connected") {
        // Reset reconnection attempts on successful connection
        this.resetReconnectionAttempts(remoteUserId);
      } else if (
        connectionState === "failed" ||
        connectionState === "disconnected"
      ) {
        this.handleConnectionFailure(remoteUserId);
      }
    });

    // Handle ICE connection state
    (pc as any).addEventListener("iceconnectionstatechange", () => {
      logDebug("ICE connection state changed", {
        remoteUserId,
        state: pc.iceConnectionState,
      });
    });

    this.peerConnections.set(remoteUserId, pc);
    return pc;
  }

  private getPeerConnection(remoteUserId: string): RTCPeerConnection {
    let pc = this.peerConnections.get(remoteUserId);
    if (!pc) {
      pc = this.createPeerConnection(remoteUserId);
    }
    return pc;
  }

  private handleConnectionFailure(remoteUserId: string): void {
    logWarn("Connection failed, attempting reconnect", {
      remoteUserId,
    });

    this.attemptReconnection(remoteUserId);
  }

  // ============================================================================
  // Reconnection Logic
  // ============================================================================

  private reconnectionAttempts: Map<string, number> = new Map();
  private maxReconnectionAttempts: number = 3;
  private reconnectionDelay: number = 2000; // 2 seconds

  /**
   * Attempt to reconnect to a peer after connection failure
   */
  private async attemptReconnection(remoteUserId: string): Promise<void> {
    const attempts = this.reconnectionAttempts.get(remoteUserId) || 0;

    if (attempts >= this.maxReconnectionAttempts) {
      logError("Max reconnection attempts reached", {
        remoteUserId,
        attempts,
      });
      this.reconnectionAttempts.delete(remoteUserId);
      // Notify about permanent failure
      this.onConnectionStateChanged?.(remoteUserId, "failed");
      return;
    }

    this.reconnectionAttempts.set(remoteUserId, attempts + 1);

    logInfo("Attempting reconnection", {
      remoteUserId,
      attempt: attempts + 1,
      maxAttempts: this.maxReconnectionAttempts,
    });

    // Wait before attempting reconnect
    await new Promise((resolve) =>
      setTimeout(resolve, this.reconnectionDelay * (attempts + 1)),
    );

    try {
      // Close existing peer connection
      const existingPc = this.peerConnections.get(remoteUserId);
      if (existingPc) {
        try {
          existingPc.close();
        } catch {
          // Ignore close errors
        }
        this.peerConnections.delete(remoteUserId);
      }

      // Create new peer connection
      const pc = this.createPeerConnection(remoteUserId);

      // Create and send new offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.isVideoEnabled,
      });
      await pc.setLocalDescription(offer);

      await this.sendSignalingMessage({
        type: "offer",
        to: remoteUserId,
        payload: offer,
      });

      logInfo("Reconnection offer sent", { remoteUserId });
    } catch (error) {
      logError("Reconnection attempt failed", { remoteUserId, error });
      // Try again after delay
      setTimeout(
        () => this.attemptReconnection(remoteUserId),
        this.reconnectionDelay,
      );
    }
  }

  /**
   * Reset reconnection attempts for a peer (call when connection is restored)
   */
  private resetReconnectionAttempts(remoteUserId: string): void {
    this.reconnectionAttempts.delete(remoteUserId);
  }

  /**
   * Handle ICE restart for network changes
   */
  async restartIce(remoteUserId?: string): Promise<void> {
    const userIds = remoteUserId
      ? [remoteUserId]
      : Array.from(this.peerConnections.keys());

    for (const userId of userIds) {
      const pc = this.peerConnections.get(userId);
      if (!pc) continue;

      logInfo("Restarting ICE", { remoteUserId: userId });

      try {
        // Create offer with ICE restart flag
        const offer = await pc.createOffer({
          iceRestart: true,
          offerToReceiveAudio: true,
          offerToReceiveVideo: this.isVideoEnabled,
        });
        await pc.setLocalDescription(offer);

        await this.sendSignalingMessage({
          type: "offer",
          to: userId,
          payload: offer,
        });
      } catch (error) {
        logError("Failed to restart ICE", { userId, error });
      }
    }
  }

  // ============================================================================
  // Signaling
  // ============================================================================

  private subscribeToSignaling(callId: string): void {
    if (!this.currentUserId) return;

    const signalsQuery = query(
      collection(getDb(), "CallSignaling", callId, "Signals"),
      where("to", "==", this.currentUserId),
      orderBy("createdAt", "asc"),
    );

    this.signalingSubscription = onSnapshot(
      signalsQuery,
      async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === "added") {
            const signal = change.doc.data() as SignalingMessage;
            await this.handleSignalingMessage(signal);

            // Delete processed signal
            await deleteDoc(change.doc.ref);
          }
        }
      },
      (error) => {
        logError("Signaling subscription error", { error });
      },
    );
  }

  private async sendSignalingMessage(
    message: Omit<SignalingMessage, "id" | "from" | "callId" | "createdAt">,
  ): Promise<void> {
    if (!this.currentCallId || !this.currentUserId) {
      logWarn("Cannot send signal - no active call");
      return;
    }

    const signalId = uuidv4();
    const signal: SignalingMessage = {
      id: signalId,
      type: message.type,
      from: this.currentUserId,
      to: message.to,
      callId: this.currentCallId,
      payload: message.payload,
      createdAt: Date.now(),
    };

    try {
      await setDoc(
        doc(getDb(), "CallSignaling", this.currentCallId, "Signals", signalId),
        signal,
      );
      logDebug("Sent signaling message", {
        type: message.type,
        to: message.to,
      });
    } catch (error) {
      logError("Failed to send signaling message", { error });
    }
  }

  private async handleSignalingMessage(
    signal: SignalingMessage,
  ): Promise<void> {
    logDebug("Handling signaling message", {
      type: signal.type,
      from: signal.from,
    });

    const pc = this.getPeerConnection(signal.from);

    try {
      switch (signal.type) {
        case "offer":
          await this.handleOffer(pc, signal);
          break;

        case "answer":
          await this.handleAnswer(pc, signal);
          break;

        case "ice-candidate":
          await this.handleIceCandidate(pc, signal);
          break;

        case "bye":
          this.handleBye(signal.from);
          break;
      }
    } catch (error) {
      logError("Error handling signaling message", {
        type: signal.type,
        error,
      });
    }
  }

  private async handleOffer(
    pc: RTCPeerConnection,
    signal: SignalingMessage,
  ): Promise<void> {
    if (!signal.payload) return;

    const sdp = signal.payload as { type: string; sdp: string };
    await pc.setRemoteDescription(
      new RTCSessionDescription({ type: sdp.type as any, sdp: sdp.sdp || "" }),
    );

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await this.sendSignalingMessage({
      type: "answer",
      to: signal.from,
      payload: answer,
    });
  }

  private async handleAnswer(
    pc: RTCPeerConnection,
    signal: SignalingMessage,
  ): Promise<void> {
    if (!signal.payload) return;

    const sdp = signal.payload as { type: string; sdp: string };
    await pc.setRemoteDescription(
      new RTCSessionDescription({ type: sdp.type as any, sdp: sdp.sdp || "" }),
    );
  }

  private async handleIceCandidate(
    pc: RTCPeerConnection,
    signal: SignalingMessage,
  ): Promise<void> {
    if (!signal.payload) return;

    try {
      await pc.addIceCandidate(
        new RTCIceCandidate(signal.payload as RTCIceCandidateInit),
      );
    } catch (error) {
      logWarn("Failed to add ICE candidate", { error });
    }
  }

  private handleBye(remoteUserId: string): void {
    logInfo("Received bye from", { remoteUserId });

    const pc = this.peerConnections.get(remoteUserId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(remoteUserId);
    }

    const remoteStream = this.remoteStreams.get(remoteUserId);
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStreams.delete(remoteUserId);
      this.onRemoteStreamRemoved?.(remoteUserId);
    }
  }

  // ============================================================================
  // Call Operations
  // ============================================================================

  async createOffer(remoteUserId: string): Promise<void> {
    logDebug("Creating offer for", { remoteUserId });

    const pc = this.getPeerConnection(remoteUserId);

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: this.isVideoEnabled,
    });

    await pc.setLocalDescription(offer);

    await this.sendSignalingMessage({
      type: "offer",
      to: remoteUserId,
      payload: offer,
    });
  }

  async processPendingSignals(callId: string): Promise<void> {
    if (!this.currentUserId) return;

    // Get any signals that arrived before we subscribed
    const signalsQuery = query(
      collection(getDb(), "CallSignaling", callId, "Signals"),
      where("to", "==", this.currentUserId),
      orderBy("createdAt", "asc"),
    );

    const snapshot = await getDocs(signalsQuery);
    for (const docSnap of snapshot.docs) {
      const signal = docSnap.data() as SignalingMessage;
      await this.handleSignalingMessage(signal);
      await deleteDoc(docSnap.ref);
    }
  }

  // ============================================================================
  // Media Controls
  // ============================================================================

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }

    logDebug("Mute toggled", { isMuted: this.isMuted });
    return this.isMuted;
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  toggleSpeaker(): boolean {
    this.isSpeakerOn = !this.isSpeakerOn;
    // Note: Speaker toggling is platform-specific
    // On iOS, use InCallManager or AVAudioSession
    // On Android, use AudioManager
    logDebug("Speaker toggled", { isSpeakerOn: this.isSpeakerOn });
    return this.isSpeakerOn;
  }

  toggleVideo(): boolean {
    this.isVideoEnabled = !this.isVideoEnabled;

    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = this.isVideoEnabled;
      });
    }

    logDebug("Video toggled", { isVideoEnabled: this.isVideoEnabled });
    return this.isVideoEnabled;
  }

  async switchCamera(): Promise<void> {
    if (!this.localStream) return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    this.isFrontCamera = !this.isFrontCamera;

    // Get new stream with switched camera
    try {
      const newStream = await mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...VIDEO_CONSTRAINTS,
          facingMode: this.isFrontCamera ? "user" : "environment",
        },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];

      // Replace track in all peer connections
      this.peerConnections.forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(
          (sender) => sender.track?.kind === "video",
        );
        if (videoSender) {
          videoSender.replaceTrack(newVideoTrack);
        }
      });

      // Replace in local stream
      this.localStream.removeTrack(videoTrack);
      videoTrack.stop();
      this.localStream.addTrack(newVideoTrack);

      logDebug("Camera switched", { isFrontCamera: this.isFrontCamera });
    } catch (error) {
      logError("Failed to switch camera", { error });
    }
  }

  // ============================================================================
  // State Getters
  // ============================================================================

  getIsMuted(): boolean {
    return this.isMuted;
  }

  getIsSpeakerOn(): boolean {
    return this.isSpeakerOn;
  }

  getIsVideoEnabled(): boolean {
    return this.isVideoEnabled;
  }

  getIsFrontCamera(): boolean {
    return this.isFrontCamera;
  }

  // ============================================================================
  // Connection Statistics
  // ============================================================================

  /**
   * Get connection statistics for a peer
   */
  async getConnectionStats(remoteUserId?: string): Promise<{
    roundTripTime: number | null;
    packetsLost: number;
    packetsReceived: number;
    bytesReceived: number;
    bytesSent: number;
    currentRoundTripTime: number | null;
    availableOutgoingBitrate: number | null;
    quality: "excellent" | "good" | "fair" | "poor" | "unknown";
  }> {
    const defaultStats: {
      roundTripTime: number | null;
      packetsLost: number;
      packetsReceived: number;
      bytesReceived: number;
      bytesSent: number;
      currentRoundTripTime: number | null;
      availableOutgoingBitrate: number | null;
      quality: "excellent" | "good" | "fair" | "poor" | "unknown";
    } = {
      roundTripTime: null,
      packetsLost: 0,
      packetsReceived: 0,
      bytesReceived: 0,
      bytesSent: 0,
      currentRoundTripTime: null,
      availableOutgoingBitrate: null,
      quality: "unknown",
    };

    const userIds = remoteUserId
      ? [remoteUserId]
      : Array.from(this.peerConnections.keys());

    if (userIds.length === 0) return defaultStats;

    const userId = userIds[0];
    const pc = this.peerConnections.get(userId);
    if (!pc) return defaultStats;

    try {
      const stats = await pc.getStats();
      const result = { ...defaultStats };

      stats.forEach((report: any) => {
        if (report.type === "candidate-pair" && report.nominated) {
          result.roundTripTime = report.currentRoundTripTime
            ? report.currentRoundTripTime * 1000
            : null;
          result.currentRoundTripTime = result.roundTripTime;
          result.availableOutgoingBitrate =
            report.availableOutgoingBitrate || null;
        }
        if (report.type === "inbound-rtp") {
          result.packetsLost += report.packetsLost || 0;
          result.packetsReceived += report.packetsReceived || 0;
          result.bytesReceived += report.bytesReceived || 0;
        }
        if (report.type === "outbound-rtp") {
          result.bytesSent += report.bytesSent || 0;
        }
      });

      // Determine quality based on stats
      result.quality = this.determineConnectionQuality(result);

      return result;
    } catch (error) {
      logError("Failed to get connection stats", { error });
      return defaultStats;
    }
  }

  /**
   * Determine connection quality based on statistics
   */
  private determineConnectionQuality(stats: {
    roundTripTime: number | null;
    packetsLost: number;
    packetsReceived: number;
  }): "excellent" | "good" | "fair" | "poor" | "unknown" {
    const { roundTripTime, packetsLost, packetsReceived } = stats;

    if (roundTripTime === null) return "unknown";

    const packetLossRate =
      packetsReceived > 0
        ? (packetsLost / (packetsLost + packetsReceived)) * 100
        : 0;

    // Quality thresholds
    // Excellent: RTT < 100ms, packet loss < 1%
    // Good: RTT < 200ms, packet loss < 3%
    // Fair: RTT < 400ms, packet loss < 5%
    // Poor: anything worse

    if (roundTripTime < 100 && packetLossRate < 1) {
      return "excellent";
    } else if (roundTripTime < 200 && packetLossRate < 3) {
      return "good";
    } else if (roundTripTime < 400 && packetLossRate < 5) {
      return "fair";
    } else {
      return "poor";
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async cleanup(): Promise<void> {
    logInfo("Cleaning up WebRTC");

    // Send bye to all peers
    for (const remoteUserId of Array.from(this.peerConnections.keys())) {
      await this.sendSignalingMessage({
        type: "bye",
        to: remoteUserId,
        payload: null,
      });
    }

    // Unsubscribe from signaling
    this.signalingSubscription?.();
    this.signalingSubscription = null;

    // Close all peer connections
    this.peerConnections.forEach((pc) => {
      pc.close();
    });
    this.peerConnections.clear();

    // Stop all remote streams
    this.remoteStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    this.remoteStreams.clear();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Reset state
    this.currentCallId = null;
    this.currentUserId = null;
    this.isVideoEnabled = false;
    this.isMuted = false;
    this.isSpeakerOn = false;
    this.isFrontCamera = true;

    logDebug("WebRTC cleanup completed");
  }
}

export const webRTCService = WebRTCService.getInstance();
