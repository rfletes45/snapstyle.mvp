/**
 * AdaptiveBitrateService - Manages video quality based on network and participant count
 * Implements adaptive bitrate for group calls to maintain quality across varying conditions
 */

// Bitrate configurations for different scenarios
const BITRATE_CONFIGS = {
  // HD quality for 1:1 calls or excellent network
  high: {
    maxVideoBitrate: 2500000, // 2.5 Mbps
    maxAudioBitrate: 64000, // 64 Kbps
    maxFrameRate: 30,
    maxWidth: 1280,
    maxHeight: 720,
  },
  // Standard quality for small groups or good network
  medium: {
    maxVideoBitrate: 1000000, // 1 Mbps
    maxAudioBitrate: 48000, // 48 Kbps
    maxFrameRate: 24,
    maxWidth: 640,
    maxHeight: 480,
  },
  // Low quality for large groups or fair network
  low: {
    maxVideoBitrate: 500000, // 500 Kbps
    maxAudioBitrate: 32000, // 32 Kbps
    maxFrameRate: 15,
    maxWidth: 480,
    maxHeight: 360,
  },
  // Minimal quality for poor network or many participants
  minimal: {
    maxVideoBitrate: 200000, // 200 Kbps
    maxAudioBitrate: 24000, // 24 Kbps
    maxFrameRate: 10,
    maxWidth: 320,
    maxHeight: 240,
  },
  // Audio only - disable video
  audioOnly: {
    maxVideoBitrate: 0,
    maxAudioBitrate: 48000,
    maxFrameRate: 0,
    maxWidth: 0,
    maxHeight: 0,
  },
} as const;

type BitrateQuality = keyof typeof BITRATE_CONFIGS;
type NetworkQuality = "excellent" | "good" | "fair" | "poor" | "unknown";

interface BitrateConfig {
  maxVideoBitrate: number;
  maxAudioBitrate: number;
  maxFrameRate: number;
  maxWidth: number;
  maxHeight: number;
}

interface AdaptiveBitrateState {
  currentQuality: BitrateQuality;
  participantCount: number;
  networkQuality: NetworkQuality;
  isVideoEnabled: boolean;
  config: BitrateConfig;
}

interface AdaptiveBitrateCallbacks {
  onQualityChanged?: (quality: BitrateQuality, config: BitrateConfig) => void;
  onVideoDisabled?: (reason: string) => void;
  onVideoEnabled?: () => void;
}

// Simple logging
const logInfo = (msg: string, data?: any) =>
  console.log(`[AdaptiveBitrate] ${msg}`, data ?? "");
const logDebug = (msg: string, data?: any) =>
  __DEV__ && console.log(`[AdaptiveBitrate] ${msg}`, data ?? "");

class AdaptiveBitrateService {
  private static instance: AdaptiveBitrateService;
  private state: AdaptiveBitrateState;
  private callbacks: AdaptiveBitrateCallbacks = {};
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private qualityCheckInterval: ReturnType<typeof setInterval> | null = null;
  private consecutivePoorQuality: number = 0;
  private videoDisabledReason: string | null = null;

  // Thresholds for quality decisions
  private readonly POOR_QUALITY_THRESHOLD = 3; // Consecutive poor readings before action
  private readonly PARTICIPANT_THRESHOLDS = {
    high: 2, // 1:1 or 2 participants
    medium: 4, // 3-4 participants
    low: 6, // 5-6 participants
    minimal: 8, // 7+ participants
  };

  private constructor() {
    this.state = {
      currentQuality: "high",
      participantCount: 1,
      networkQuality: "unknown",
      isVideoEnabled: true,
      config: { ...BITRATE_CONFIGS.high },
    };
  }

  static getInstance(): AdaptiveBitrateService {
    if (!AdaptiveBitrateService.instance) {
      AdaptiveBitrateService.instance = new AdaptiveBitrateService();
    }
    return AdaptiveBitrateService.instance;
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  setCallbacks(callbacks: AdaptiveBitrateCallbacks): void {
    this.callbacks = callbacks;
  }

  registerPeerConnection(peerId: string, pc: RTCPeerConnection): void {
    this.peerConnections.set(peerId, pc);
    this.updateParticipantCount();
  }

  unregisterPeerConnection(peerId: string): void {
    this.peerConnections.delete(peerId);
    this.updateParticipantCount();
  }

  // ============================================================================
  // Quality Control
  // ============================================================================

  /**
   * Start monitoring and adjusting bitrate
   */
  startMonitoring(): void {
    if (this.qualityCheckInterval) return;

    logInfo("Starting adaptive bitrate monitoring");

    this.qualityCheckInterval = setInterval(() => {
      this.checkAndAdjustQuality();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.qualityCheckInterval) {
      clearInterval(this.qualityCheckInterval);
      this.qualityCheckInterval = null;
    }
    this.consecutivePoorQuality = 0;
    logInfo("Stopped adaptive bitrate monitoring");
  }

  /**
   * Update network quality from external source
   */
  updateNetworkQuality(quality: NetworkQuality): void {
    if (this.state.networkQuality !== quality) {
      logDebug("Network quality changed", {
        from: this.state.networkQuality,
        to: quality,
      });
      this.state.networkQuality = quality;
      this.recalculateQuality();
    }
  }

  /**
   * Update participant count
   */
  updateParticipantCount(count?: number): void {
    const newCount = count ?? this.peerConnections.size + 1;
    if (this.state.participantCount !== newCount) {
      logDebug("Participant count changed", {
        from: this.state.participantCount,
        to: newCount,
      });
      this.state.participantCount = newCount;
      this.recalculateQuality();
    }
  }

  /**
   * Force set video enabled/disabled
   */
  setVideoEnabled(enabled: boolean): void {
    if (enabled && this.videoDisabledReason) {
      // Check if conditions allow re-enabling
      if (this.canEnableVideo()) {
        this.state.isVideoEnabled = true;
        this.videoDisabledReason = null;
        this.callbacks.onVideoEnabled?.();
        this.recalculateQuality();
      }
    } else if (!enabled) {
      this.state.isVideoEnabled = false;
    }
  }

  // ============================================================================
  // Quality Calculation
  // ============================================================================

  private recalculateQuality(): void {
    const newQuality = this.calculateOptimalQuality();

    if (newQuality !== this.state.currentQuality) {
      this.state.currentQuality = newQuality;
      this.state.config = { ...BITRATE_CONFIGS[newQuality] };

      logInfo("Quality changed", {
        quality: newQuality,
        config: this.state.config,
      });

      // Apply to all peer connections
      this.applyQualityToConnections();

      // Notify callback
      this.callbacks.onQualityChanged?.(newQuality, this.state.config);
    }
  }

  private calculateOptimalQuality(): BitrateQuality {
    const { participantCount, networkQuality, isVideoEnabled } = this.state;

    // If video is disabled, return audio only
    if (!isVideoEnabled) {
      return "audioOnly";
    }

    // Calculate base quality from participant count
    let baseQuality: BitrateQuality;
    if (participantCount <= this.PARTICIPANT_THRESHOLDS.high) {
      baseQuality = "high";
    } else if (participantCount <= this.PARTICIPANT_THRESHOLDS.medium) {
      baseQuality = "medium";
    } else if (participantCount <= this.PARTICIPANT_THRESHOLDS.low) {
      baseQuality = "low";
    } else {
      baseQuality = "minimal";
    }

    // Adjust based on network quality
    const qualityLevels: BitrateQuality[] = [
      "high",
      "medium",
      "low",
      "minimal",
      "audioOnly",
    ];
    const baseIndex = qualityLevels.indexOf(baseQuality);

    let adjustment = 0;
    switch (networkQuality) {
      case "excellent":
        adjustment = -1; // Can go one level up
        break;
      case "good":
        adjustment = 0;
        break;
      case "fair":
        adjustment = 1;
        break;
      case "poor":
        adjustment = 2;
        break;
      case "unknown":
        adjustment = 0;
        break;
    }

    const finalIndex = Math.max(
      0,
      Math.min(qualityLevels.length - 2, baseIndex + adjustment),
    );
    return qualityLevels[finalIndex];
  }

  private canEnableVideo(): boolean {
    const { networkQuality, participantCount } = this.state;

    // Don't enable video on poor network
    if (networkQuality === "poor") {
      return false;
    }

    // Don't enable video with many participants on fair network
    if (networkQuality === "fair" && participantCount > 4) {
      return false;
    }

    return true;
  }

  // ============================================================================
  // Quality Application
  // ============================================================================

  private async applyQualityToConnections(): Promise<void> {
    const { config } = this.state;

    for (const [peerId, pc] of this.peerConnections) {
      try {
        await this.applyQualityToPeerConnection(pc, config);
      } catch (error) {
        logDebug(`Failed to apply quality to peer ${peerId}`, { error });
      }
    }
  }

  private async applyQualityToPeerConnection(
    pc: RTCPeerConnection,
    config: BitrateConfig,
  ): Promise<void> {
    const senders = pc.getSenders();

    for (const sender of senders) {
      if (!sender.track) continue;

      const params = sender.getParameters();

      if (sender.track.kind === "video") {
        // Apply video bitrate constraints
        if (params.encodings && params.encodings.length > 0) {
          params.encodings[0].maxBitrate = config.maxVideoBitrate;
          // Note: maxFramerate may not be supported on all platforms
          (params.encodings[0] as any).maxFramerate = config.maxFrameRate;
        }
      } else if (sender.track.kind === "audio") {
        // Apply audio bitrate constraints
        if (params.encodings && params.encodings.length > 0) {
          params.encodings[0].maxBitrate = config.maxAudioBitrate;
        }
      }

      try {
        await sender.setParameters(params);
      } catch (error) {
        logDebug("Failed to set sender parameters", { error });
      }
    }
  }

  // ============================================================================
  // Quality Monitoring
  // ============================================================================

  private async checkAndAdjustQuality(): Promise<void> {
    // Get stats from all connections
    const allStats = await this.gatherConnectionStats();

    // Analyze stats
    const analysis = this.analyzeStats(allStats);

    // Update network quality based on analysis
    if (analysis.estimatedQuality !== this.state.networkQuality) {
      this.updateNetworkQuality(analysis.estimatedQuality);
    }

    // Handle poor quality
    if (analysis.isPoorQuality) {
      this.consecutivePoorQuality++;
      if (this.consecutivePoorQuality >= this.POOR_QUALITY_THRESHOLD) {
        this.handlePersistentPoorQuality();
      }
    } else {
      this.consecutivePoorQuality = 0;
    }

    // Log quality metrics
    logDebug("Quality check", {
      quality: this.state.currentQuality,
      network: this.state.networkQuality,
      participants: this.state.participantCount,
      stats: analysis,
    });
  }

  private async gatherConnectionStats(): Promise<Map<string, any>> {
    const stats = new Map<string, any>();

    for (const [peerId, pc] of this.peerConnections) {
      try {
        const report = await pc.getStats();
        const peerStats: any = {};

        report.forEach((stat: any) => {
          if (stat.type === "outbound-rtp" && stat.kind === "video") {
            peerStats.videoBytesSent = stat.bytesSent;
            peerStats.videoPacketsSent = stat.packetsSent;
            peerStats.videoFramesSent = stat.framesSent;
          } else if (stat.type === "outbound-rtp" && stat.kind === "audio") {
            peerStats.audioBytesSent = stat.bytesSent;
            peerStats.audioPacketsSent = stat.packetsSent;
          } else if (
            stat.type === "candidate-pair" &&
            stat.state === "succeeded"
          ) {
            peerStats.rtt = stat.currentRoundTripTime;
            peerStats.availableOutgoingBitrate = stat.availableOutgoingBitrate;
          }
        });

        stats.set(peerId, peerStats);
      } catch (error) {
        logDebug(`Failed to get stats for peer ${peerId}`, { error });
      }
    }

    return stats;
  }

  private analyzeStats(stats: Map<string, any>): {
    estimatedQuality: NetworkQuality;
    isPoorQuality: boolean;
    avgRtt: number;
    avgBitrate: number;
  } {
    let totalRtt = 0;
    let totalBitrate = 0;
    let validSamples = 0;

    stats.forEach((peerStats) => {
      if (peerStats.rtt !== undefined) {
        totalRtt += peerStats.rtt * 1000; // Convert to ms
        validSamples++;
      }
      if (peerStats.availableOutgoingBitrate !== undefined) {
        totalBitrate += peerStats.availableOutgoingBitrate;
      }
    });

    const avgRtt = validSamples > 0 ? totalRtt / validSamples : 0;
    const avgBitrate = validSamples > 0 ? totalBitrate / validSamples : 0;

    // Determine quality from RTT
    let estimatedQuality: NetworkQuality;
    if (avgRtt === 0) {
      estimatedQuality = "unknown";
    } else if (avgRtt < 50) {
      estimatedQuality = "excellent";
    } else if (avgRtt < 100) {
      estimatedQuality = "good";
    } else if (avgRtt < 200) {
      estimatedQuality = "fair";
    } else {
      estimatedQuality = "poor";
    }

    const isPoorQuality =
      avgRtt > 300 || (avgBitrate > 0 && avgBitrate < 200000);

    return { estimatedQuality, isPoorQuality, avgRtt, avgBitrate };
  }

  private handlePersistentPoorQuality(): void {
    logInfo("Persistent poor quality detected");

    // If on minimal quality and still poor, disable video
    if (this.state.currentQuality === "minimal" && this.state.isVideoEnabled) {
      this.state.isVideoEnabled = false;
      this.videoDisabledReason = "Poor network conditions";
      this.recalculateQuality();
      this.callbacks.onVideoDisabled?.(
        "Poor network conditions - switching to audio only",
      );
    }

    this.consecutivePoorQuality = 0;
  }

  // ============================================================================
  // Getters
  // ============================================================================

  getCurrentQuality(): BitrateQuality {
    return this.state.currentQuality;
  }

  getCurrentConfig(): BitrateConfig {
    return { ...this.state.config };
  }

  getState(): Readonly<AdaptiveBitrateState> {
    return { ...this.state };
  }

  isVideoEnabled(): boolean {
    return this.state.isVideoEnabled;
  }

  getVideoDisabledReason(): string | null {
    return this.videoDisabledReason;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  cleanup(): void {
    this.stopMonitoring();
    this.peerConnections.clear();
    this.state = {
      currentQuality: "high",
      participantCount: 1,
      networkQuality: "unknown",
      isVideoEnabled: true,
      config: { ...BITRATE_CONFIGS.high },
    };
    this.callbacks = {};
    this.videoDisabledReason = null;
    logDebug("Cleanup completed");
  }
}

export const adaptiveBitrateService = AdaptiveBitrateService.getInstance();
export type {
  AdaptiveBitrateCallbacks,
  BitrateConfig,
  BitrateQuality,
  NetworkQuality,
};
