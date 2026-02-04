/**
 * useCallQuality - Hook for monitoring call quality in real-time
 * Provides quality metrics, indicators, and issue detection
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type NetworkQuality = "excellent" | "good" | "fair" | "poor" | "unknown";

export interface CallQualityState {
  // Overall quality
  quality: NetworkQuality;
  score: number; // 1-5

  // Network metrics
  latency: number; // ms
  jitter: number; // ms
  packetLoss: number; // percentage
  bandwidth: {
    upload: number; // kbps
    download: number; // kbps
  };

  // Audio quality
  audioLevel: number; // 0-100

  // Video quality
  videoFrameRate: number;
  videoResolution: { width: number; height: number };

  // Issues
  hasIssues: boolean;
  currentIssues: string[];

  // Status
  isCollecting: boolean;
}

const DEFAULT_STATE: CallQualityState = {
  quality: "unknown",
  score: 0,
  latency: 0,
  jitter: 0,
  packetLoss: 0,
  bandwidth: { upload: 0, download: 0 },
  audioLevel: 0,
  videoFrameRate: 0,
  videoResolution: { width: 0, height: 0 },
  hasIssues: false,
  currentIssues: [],
  isCollecting: false,
};

interface UseCallQualityOptions {
  callId: string | null;
  isActive: boolean;
  updateInterval?: number; // ms, default 5000
}

export function useCallQuality({
  callId,
  isActive,
  updateInterval = 5000,
}: UseCallQualityOptions) {
  const [state, setState] = useState<CallQualityState>(DEFAULT_STATE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calculate quality from metrics
  const calculateQuality = useCallback(
    (latency: number, packetLoss: number, jitter: number): NetworkQuality => {
      // Simple heuristic for quality rating
      const score = calculateScore(latency, packetLoss, jitter);

      if (score >= 4.5) return "excellent";
      if (score >= 3.5) return "good";
      if (score >= 2.5) return "fair";
      if (score >= 1) return "poor";
      return "unknown";
    },
    [],
  );

  // Calculate numeric score
  const calculateScore = (
    latency: number,
    packetLoss: number,
    jitter: number,
  ): number => {
    let score = 5;

    // Latency impact
    if (latency > 400) score -= 2;
    else if (latency > 200) score -= 1;
    else if (latency > 100) score -= 0.5;

    // Packet loss impact
    if (packetLoss > 10) score -= 2;
    else if (packetLoss > 5) score -= 1;
    else if (packetLoss > 2) score -= 0.5;

    // Jitter impact
    if (jitter > 50) score -= 1;
    else if (jitter > 30) score -= 0.5;

    return Math.max(1, Math.min(5, score));
  };

  // Detect current issues
  const detectIssues = useCallback(
    (latency: number, packetLoss: number, bandwidth: number): string[] => {
      const issues: string[] = [];

      if (latency > 300) issues.push("High latency");
      if (packetLoss > 5) issues.push("Packet loss");
      if (bandwidth < 250) issues.push("Low bandwidth");

      return issues;
    },
    [],
  );

  // Update metrics (simulated - real implementation would use RTCPeerConnection.getStats())
  const updateMetrics = useCallback(async () => {
    if (!callId || !isActive) return;

    try {
      // In production, this would get real stats from WebRTC
      // For now, simulate reasonable values
      const latency = Math.random() * 150 + 50; // 50-200ms
      const jitter = Math.random() * 25; // 0-25ms
      const packetLoss = Math.random() * 2; // 0-2%
      const uploadBandwidth = Math.random() * 1500 + 500; // 500-2000 kbps
      const downloadBandwidth = Math.random() * 1500 + 500;
      const audioLevel = Math.random() * 100;
      const videoFrameRate = 30 - Math.random() * 5; // 25-30 fps

      const quality = calculateQuality(latency, packetLoss, jitter);
      const score = calculateScore(latency, packetLoss, jitter);
      const issues = detectIssues(latency, packetLoss, downloadBandwidth);

      setState({
        quality,
        score,
        latency,
        jitter,
        packetLoss,
        bandwidth: {
          upload: uploadBandwidth,
          download: downloadBandwidth,
        },
        audioLevel,
        videoFrameRate,
        videoResolution: { width: 1280, height: 720 },
        hasIssues: issues.length > 0,
        currentIssues: issues,
        isCollecting: true,
      });
    } catch (error) {
      console.error("Error updating call quality metrics:", error);
    }
  }, [callId, isActive, calculateQuality, detectIssues]);

  // Start/stop metrics collection
  useEffect(() => {
    if (isActive && callId) {
      // Initial update
      updateMetrics();

      // Start interval
      intervalRef.current = setInterval(updateMetrics, updateInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setState(DEFAULT_STATE);
      };
    } else {
      // Reset state when inactive
      setState(DEFAULT_STATE);
    }
  }, [isActive, callId, updateInterval, updateMetrics]);

  // Get quality color for UI
  const getQualityColor = useCallback((): string => {
    switch (state.quality) {
      case "excellent":
        return "#22c55e"; // green
      case "good":
        return "#84cc16"; // lime
      case "fair":
        return "#eab308"; // yellow
      case "poor":
        return "#ef4444"; // red
      default:
        return "#9ca3af"; // gray
    }
  }, [state.quality]);

  // Get quality icon name
  const getQualityIcon = useCallback((): string => {
    switch (state.quality) {
      case "excellent":
        return "wifi";
      case "good":
        return "wifi";
      case "fair":
        return "wifi-outline";
      case "poor":
        return "warning";
      default:
        return "help-circle";
    }
  }, [state.quality]);

  // Get signal bars (1-4)
  const getSignalBars = useCallback((): number => {
    if (state.score >= 4.5) return 4;
    if (state.score >= 3.5) return 3;
    if (state.score >= 2.5) return 2;
    if (state.score >= 1) return 1;
    return 0;
  }, [state.score]);

  // Format latency for display
  const formatLatency = useCallback((): string => {
    if (state.latency === 0) return "--";
    return `${Math.round(state.latency)}ms`;
  }, [state.latency]);

  // Format bandwidth for display
  const formatBandwidth = useCallback((): string => {
    const mbps = state.bandwidth.download / 1000;
    if (mbps >= 1) {
      return `${mbps.toFixed(1)} Mbps`;
    }
    return `${Math.round(state.bandwidth.download)} kbps`;
  }, [state.bandwidth.download]);

  return {
    ...state,
    getQualityColor,
    getQualityIcon,
    getSignalBars,
    formatLatency,
    formatBandwidth,
  };
}

export default useCallQuality;
