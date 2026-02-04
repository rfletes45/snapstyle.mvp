/**
 * CallAnalyticsService - Tracks call metrics and events
 * Collects quality data, usage patterns, and error information
 */

import * as Application from "expo-application";
import * as Device from "expo-device";
import * as Network from "expo-network";
import { doc, setDoc } from "firebase/firestore";
import { Platform } from "react-native";

import {
  Call,
  CallAnalyticsEvent,
  CallQualityIssue,
  CallQualityMetrics,
  CallQualityReport,
  CallType,
  DetailedCallAnalyticsEvent,
} from "../../types/call";
import { getAuthInstance, getFirestoreInstance } from "../firebase";

// Lazy getters to avoid accessing Firebase before initialization
const getDb = () => getFirestoreInstance();
const getAuth = () => getAuthInstance();

// Logging
const logInfo = (msg: string, data?: any) =>
  console.log(`[CallAnalyticsService] ${msg}`, data ?? "");
const logError = (msg: string, error?: any) =>
  console.error(`[CallAnalyticsService] ${msg}`, error ?? "");
const logDebug = (msg: string, data?: any) =>
  __DEV__ && console.log(`[CallAnalyticsService] ${msg}`, data ?? "");

// Thresholds for quality issues
const QUALITY_THRESHOLDS = {
  HIGH_LATENCY_MS: 300,
  PACKET_LOSS_PERCENT: 5,
  LOW_BANDWIDTH_KBPS: 250,
  JITTER_MS: 50,
};

// MOS score calculation weights
const MOS_WEIGHTS = {
  latency: 0.3,
  packetLoss: 0.35,
  jitter: 0.2,
  bandwidth: 0.15,
};

class CallAnalyticsService {
  private static instance: CallAnalyticsService;
  private currentCallMetrics: CallQualityMetrics[] = [];
  private currentCallIssues: CallQualityIssue[] = [];
  private metricsInterval: ReturnType<typeof setInterval> | null = null;
  private currentCallId: string | null = null;
  private userActions = {
    mutedDuringCall: false,
    cameraToggledCount: 0,
    speakerToggledCount: 0,
    cameraFlippedCount: 0,
  };

  private constructor() {}

  static getInstance(): CallAnalyticsService {
    if (!CallAnalyticsService.instance) {
      CallAnalyticsService.instance = new CallAnalyticsService();
    }
    return CallAnalyticsService.instance;
  }

  // ============================================================================
  // Event Tracking
  // ============================================================================

  /**
   * Track a call event
   */
  async trackCallEvent(
    event: CallAnalyticsEvent["event"],
    call: Call,
    additionalData?: Partial<DetailedCallAnalyticsEvent>,
  ): Promise<void> {
    try {
      const userId = getAuth().currentUser?.uid;
      if (!userId) return;

      // Get device and network info
      const deviceInfo = await this.getDeviceInfo();
      const networkInfo = await this.getNetworkInfo();

      const analyticsEvent: DetailedCallAnalyticsEvent = {
        // Base event
        event,
        callId: call.id,
        callType: call.type,
        scope: call.scope,
        duration:
          call.answeredAt && call.endedAt
            ? Math.floor((call.endedAt - call.answeredAt) / 1000)
            : undefined,
        participants: Object.keys(call.participants).length,

        // Device info
        ...deviceInfo,

        // Network info
        ...networkInfo,

        // Quality metrics
        averageQualityScore: this.calculateAverageQuality(),
        peakPacketLoss: this.getPeakMetric("packetLoss"),
        peakLatency: this.getPeakMetric("roundTripTime"),

        // Timing
        ringDuration:
          call.answeredAt && call.createdAt
            ? call.answeredAt - call.createdAt
            : undefined,

        // User actions
        ...this.userActions,

        // Error tracking
        iceConnectionFailures: 0,
        mediaStreamErrors: 0,
        reconnectionAttempts: 0,

        // Additional data
        ...additionalData,
      };

      // Save to Firestore
      const docRef = doc(
        getDb(),
        "Analytics",
        "calls",
        "events",
        `${call.id}_${event}_${Date.now()}`,
      );
      await setDoc(docRef, {
        ...analyticsEvent,
        userId,
        timestamp: Date.now(),
      });

      logDebug(`Tracked event: ${event}`, { callId: call.id });
    } catch (error) {
      logError("Error tracking call event", error);
    }
  }

  /**
   * Track call initiated
   */
  async trackCallInitiated(call: Call): Promise<void> {
    this.currentCallId = call.id;
    this.resetCallState();
    await this.trackCallEvent("call_initiated", call);
  }

  /**
   * Track call answered
   */
  async trackCallAnswered(call: Call): Promise<void> {
    await this.trackCallEvent("call_answered", call, {
      ringDuration: call.answeredAt
        ? call.answeredAt - call.createdAt
        : undefined,
    });

    // Start metrics collection
    this.startMetricsCollection(call.id);
  }

  /**
   * Track call ended
   */
  async trackCallEnded(call: Call): Promise<void> {
    // Stop metrics collection
    this.stopMetricsCollection();

    await this.trackCallEvent("call_ended", call);

    // Generate and save quality report
    await this.saveQualityReport(call);

    // Reset state
    this.resetCallState();
  }

  /**
   * Track call declined
   */
  async trackCallDeclined(call: Call): Promise<void> {
    await this.trackCallEvent("call_declined", call);
    this.resetCallState();
  }

  /**
   * Track call failed
   */
  async trackCallFailed(call: Call, reason?: string): Promise<void> {
    this.stopMetricsCollection();
    await this.trackCallEvent("call_failed", call, { failureReason: reason });
    this.resetCallState();
  }

  /**
   * Track call missed
   */
  async trackCallMissed(call: Call): Promise<void> {
    await this.trackCallEvent("call_missed", call);
  }

  // ============================================================================
  // User Action Tracking
  // ============================================================================

  trackMuteToggle(muted: boolean): void {
    if (muted) {
      this.userActions.mutedDuringCall = true;
    }
  }

  trackCameraToggle(): void {
    this.userActions.cameraToggledCount++;
  }

  trackSpeakerToggle(): void {
    this.userActions.speakerToggledCount++;
  }

  trackCameraFlip(): void {
    this.userActions.cameraFlippedCount++;
  }

  // ============================================================================
  // Quality Metrics Collection
  // ============================================================================

  /**
   * Start collecting quality metrics
   */
  private startMetricsCollection(callId: string): void {
    if (this.metricsInterval) return;

    this.currentCallId = callId;

    // Collect metrics every 5 seconds
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 5000);
  }

  /**
   * Stop collecting metrics
   */
  private stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Collect current metrics
   */
  private async collectMetrics(): Promise<void> {
    if (!this.currentCallId) return;

    try {
      // Get WebRTC stats (this would come from webRTCService in production)
      const stats = await this.getWebRTCStats();

      const metrics: CallQualityMetrics = {
        callId: this.currentCallId,
        timestamp: Date.now(),

        // Network metrics
        roundTripTime: stats.roundTripTime,
        jitter: stats.jitter,
        packetLoss: stats.packetLoss,
        bandwidth: stats.bandwidth,

        // Audio metrics
        audioLevel: stats.audioLevel,
        audioCodec: stats.audioCodec,
        audioSampleRate: stats.audioSampleRate,

        // Video metrics
        videoWidth: stats.videoWidth,
        videoHeight: stats.videoHeight,
        videoFrameRate: stats.videoFrameRate,
        videoCodec: stats.videoCodec,
        videoBitrate: stats.videoBitrate,

        // Quality score
        qualityScore: this.calculateMOSScore(stats),
        qualityRating: this.getQualityRating(this.calculateMOSScore(stats)),
      };

      this.currentCallMetrics.push(metrics);

      // Check for quality issues
      this.checkForIssues(metrics);

      logDebug("Collected metrics", { quality: metrics.qualityRating });
    } catch (error) {
      logError("Error collecting metrics", error);
    }
  }

  /**
   * Get WebRTC stats (simplified - real implementation would query RTCPeerConnection)
   */
  private async getWebRTCStats(): Promise<any> {
    // In production, this would get real stats from RTCPeerConnection.getStats()
    // For now, return simulated data
    return {
      roundTripTime: Math.random() * 200 + 50, // 50-250ms
      jitter: Math.random() * 30, // 0-30ms
      packetLoss: Math.random() * 3, // 0-3%
      bandwidth: {
        upload: Math.random() * 1500 + 500, // 500-2000 kbps
        download: Math.random() * 1500 + 500,
      },
      audioLevel: Math.random() * 100,
      audioCodec: "opus",
      audioSampleRate: 48000,
      videoWidth: 1280,
      videoHeight: 720,
      videoFrameRate: 30,
      videoCodec: "VP8",
      videoBitrate: Math.random() * 1500 + 500,
    };
  }

  /**
   * Calculate MOS (Mean Opinion Score) like quality score
   */
  private calculateMOSScore(stats: any): number {
    // Simplified MOS calculation (1-5 scale)
    let score = 5;

    // Latency penalty
    if (stats.roundTripTime > 400) score -= 2;
    else if (stats.roundTripTime > 200) score -= 1;
    else if (stats.roundTripTime > 100) score -= 0.5;

    // Packet loss penalty
    if (stats.packetLoss > 10) score -= 2;
    else if (stats.packetLoss > 5) score -= 1;
    else if (stats.packetLoss > 2) score -= 0.5;

    // Jitter penalty
    if (stats.jitter > 50) score -= 1;
    else if (stats.jitter > 30) score -= 0.5;

    return Math.max(1, Math.min(5, score));
  }

  /**
   * Get quality rating from score
   */
  private getQualityRating(
    score: number,
  ): "excellent" | "good" | "fair" | "poor" | "bad" {
    if (score >= 4.5) return "excellent";
    if (score >= 3.5) return "good";
    if (score >= 2.5) return "fair";
    if (score >= 1.5) return "poor";
    return "bad";
  }

  /**
   * Check for quality issues
   */
  private checkForIssues(metrics: CallQualityMetrics): void {
    const now = Date.now();

    // High latency
    if (metrics.roundTripTime > QUALITY_THRESHOLDS.HIGH_LATENCY_MS) {
      this.addIssue({
        timestamp: now,
        type: "high_latency",
        severity: metrics.roundTripTime > 500 ? "severe" : "moderate",
        duration: 5000,
        details: `RTT: ${Math.round(metrics.roundTripTime)}ms`,
      });
    }

    // Packet loss
    if (metrics.packetLoss > QUALITY_THRESHOLDS.PACKET_LOSS_PERCENT) {
      this.addIssue({
        timestamp: now,
        type: "packet_loss",
        severity: metrics.packetLoss > 15 ? "severe" : "moderate",
        duration: 5000,
        details: `Loss: ${metrics.packetLoss.toFixed(1)}%`,
      });
    }

    // Low bandwidth
    if (metrics.bandwidth.download < QUALITY_THRESHOLDS.LOW_BANDWIDTH_KBPS) {
      this.addIssue({
        timestamp: now,
        type: "low_bandwidth",
        severity: metrics.bandwidth.download < 150 ? "severe" : "moderate",
        duration: 5000,
        details: `Bandwidth: ${Math.round(metrics.bandwidth.download)} kbps`,
      });
    }
  }

  /**
   * Add an issue (avoiding duplicates within time window)
   */
  private addIssue(issue: CallQualityIssue): void {
    const recentIssue = this.currentCallIssues.find(
      (i) => i.type === issue.type && issue.timestamp - i.timestamp < 10000,
    );

    if (!recentIssue) {
      this.currentCallIssues.push(issue);
    }
  }

  // ============================================================================
  // Quality Reports
  // ============================================================================

  /**
   * Save quality report for completed call
   */
  private async saveQualityReport(call: Call): Promise<void> {
    if (this.currentCallMetrics.length === 0) return;

    try {
      const userId = getAuth().currentUser?.uid;
      if (!userId) return;

      const report: CallQualityReport = {
        callId: call.id,
        userId,
        callType: call.type,
        callDuration:
          call.answeredAt && call.endedAt
            ? Math.floor((call.endedAt - call.answeredAt) / 1000)
            : 0,
        averageQualityScore: this.calculateAverageQuality(),
        metrics: this.currentCallMetrics,
        issues: this.currentCallIssues,
      };

      const docRef = doc(getDb(), "CallQualityReports", call.id);
      await setDoc(docRef, {
        ...report,
        createdAt: Date.now(),
      });

      logInfo("Saved quality report", { callId: call.id });
    } catch (error) {
      logError("Error saving quality report", error);
    }
  }

  /**
   * Submit user feedback for call
   */
  async submitCallFeedback(
    callId: string,
    rating: number,
    reportedIssues: string[],
    comment?: string,
  ): Promise<void> {
    try {
      const docRef = doc(getDb(), "CallQualityReports", callId);
      await setDoc(
        docRef,
        {
          userFeedback: {
            rating,
            reportedIssues,
            comment,
            submittedAt: Date.now(),
          },
        },
        { merge: true },
      );

      logInfo("Submitted call feedback", { callId, rating });
    } catch (error) {
      logError("Error submitting feedback", error);
      throw error;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Calculate average quality score
   */
  private calculateAverageQuality(): number {
    if (this.currentCallMetrics.length === 0) return 0;

    const sum = this.currentCallMetrics.reduce(
      (acc, m) => acc + m.qualityScore,
      0,
    );
    return sum / this.currentCallMetrics.length;
  }

  /**
   * Get peak metric value
   */
  private getPeakMetric(metric: "packetLoss" | "roundTripTime"): number {
    if (this.currentCallMetrics.length === 0) return 0;

    return Math.max(...this.currentCallMetrics.map((m) => m[metric]));
  }

  /**
   * Reset call state
   */
  private resetCallState(): void {
    this.currentCallId = null;
    this.currentCallMetrics = [];
    this.currentCallIssues = [];
    this.userActions = {
      mutedDuringCall: false,
      cameraToggledCount: 0,
      speakerToggledCount: 0,
      cameraFlippedCount: 0,
    };
  }

  /**
   * Get device info
   */
  private async getDeviceInfo(): Promise<
    Pick<
      DetailedCallAnalyticsEvent,
      "platform" | "osVersion" | "appVersion" | "deviceModel"
    >
  > {
    return {
      platform: Platform.OS as "ios" | "android",
      osVersion: Platform.Version.toString(),
      appVersion: Application.nativeApplicationVersion || "unknown",
      deviceModel: Device.modelName || "unknown",
    };
  }

  /**
   * Get network info
   */
  private async getNetworkInfo(): Promise<
    Pick<DetailedCallAnalyticsEvent, "connectionType" | "cellularGeneration">
  > {
    try {
      const networkState = await Network.getNetworkStateAsync();

      let connectionType: DetailedCallAnalyticsEvent["connectionType"] =
        "unknown";
      let cellularGeneration:
        | DetailedCallAnalyticsEvent["cellularGeneration"]
        | undefined;

      if (networkState.type === Network.NetworkStateType.WIFI) {
        connectionType = "wifi";
      } else if (networkState.type === Network.NetworkStateType.CELLULAR) {
        connectionType = "cellular";
        // expo-network doesn't provide cellular generation directly
        // We leave it undefined as it requires platform-specific APIs
      } else if (networkState.type === Network.NetworkStateType.ETHERNET) {
        connectionType = "ethernet";
      }

      return { connectionType, cellularGeneration };
    } catch (error) {
      return { connectionType: "unknown" };
    }
  }

  /**
   * Get analytics summary for dashboard
   */
  async getAnalyticsSummary(
    startDate: number,
    endDate: number,
  ): Promise<{
    totalCalls: number;
    successRate: number;
    averageQuality: number;
    averageDuration: number;
    callsByType: Record<CallType, number>;
    issuesByType: Record<string, number>;
  }> {
    // This would query Firestore in production
    // For now, return placeholder data
    return {
      totalCalls: 0,
      successRate: 0,
      averageQuality: 0,
      averageDuration: 0,
      callsByType: { audio: 0, video: 0 },
      issuesByType: {},
    };
  }
}

export const callAnalyticsService = CallAnalyticsService.getInstance();
