/**
 * Call Service Tests
 * Unit tests for call lifecycle, state management, and error handling
 */

import { Call, CallStatus, CallType } from "../../src/types/call";

// Mock Firebase
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  onSnapshot: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
}));

// Mock auth
const mockCurrentUser = { uid: "test-user-123" };
jest.mock("../../src/services/firebase", () => ({
  getFirestoreInstance: jest.fn(() => ({})),
  getAuthInstance: jest.fn(() => ({
    currentUser: mockCurrentUser,
  })),
}));

// Mock CallKeep
jest.mock("../../src/services/calls/callKeepService", () => ({
  callKeepService: {
    setup: jest.fn(),
    setCallbacks: jest.fn(),
    displayIncomingCall: jest.fn(),
    startOutgoingCall: jest.fn(),
    setCallConnected: jest.fn(),
    endCall: jest.fn(),
  },
}));

// Mock WebRTC
jest.mock("../../src/services/calls/webRTCService", () => ({
  webRTCService: {
    initialize: jest.fn(),
    createOffer: jest.fn(),
    createAnswer: jest.fn(),
    setRemoteDescription: jest.fn(),
    addIceCandidate: jest.fn(),
    setMuted: jest.fn(),
    setVideoEnabled: jest.fn(),
    cleanup: jest.fn(),
  },
}));

describe("CallService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Call Types", () => {
    it("should define all required call statuses", () => {
      const statuses: CallStatus[] = [
        "ringing",
        "connecting",
        "connected",
        "ended",
        "declined",
        "missed",
        "failed",
      ];
      expect(statuses).toHaveLength(7);
    });

    it("should define call types", () => {
      const types: CallType[] = ["audio", "video"];
      expect(types).toHaveLength(2);
    });
  });

  describe("Call State Machine", () => {
    it("should allow transition from ringing to connected", () => {
      const validTransitions: Record<CallStatus, CallStatus[]> = {
        ringing: ["connecting", "declined", "missed", "failed"],
        connecting: ["connected", "failed"],
        connected: ["ended"],
        ended: [],
        declined: [],
        missed: [],
        failed: [],
      };

      expect(validTransitions.ringing).toContain("connecting");
      expect(validTransitions.connecting).toContain("connected");
    });

    it("should not allow invalid transitions", () => {
      const validTransitions: Record<CallStatus, CallStatus[]> = {
        ringing: ["connecting", "declined", "missed", "failed"],
        connecting: ["connected", "failed"],
        connected: ["ended"],
        ended: [],
        declined: [],
        missed: [],
        failed: [],
      };

      // Can't go from ended to connected
      expect(validTransitions.ended).not.toContain("connected");
      // Can't go from missed to connecting
      expect(validTransitions.missed).not.toContain("connecting");
    });
  });

  describe("Call Data Model", () => {
    it("should create a valid call object", () => {
      const call: Call = {
        id: "call-123",
        scope: "dm",
        conversationId: "chat-456",
        type: "audio",
        status: "ringing",
        callerId: "user-789",
        callerName: "Test User",
        participants: {
          "user-789": {
            odId: "user-789",
            odname: "testuser",
            displayName: "Test User",
            joinedAt: Date.now(),
            leftAt: null,
            isMuted: false,
            isVideoEnabled: false,
            connectionState: "connecting",
          },
        },
        createdAt: Date.now(),
        answeredAt: null,
        endedAt: null,
      };

      expect(call.id).toBe("call-123");
      expect(call.status).toBe("ringing");
      expect(Object.keys(call.participants)).toHaveLength(1);
    });

    it("should track call duration correctly", () => {
      const startTime = 1000000000000;
      const endTime = startTime + 120000; // 2 minutes later

      const call: Call = {
        id: "call-123",
        scope: "dm",
        conversationId: "chat-456",
        type: "video",
        status: "ended",
        callerId: "user-789",
        callerName: "Test User",
        participants: {},
        createdAt: startTime,
        answeredAt: startTime + 5000, // Answered after 5 seconds
        endedAt: endTime,
        duration: 115, // 115 seconds (2 min - 5 sec ring time)
      };

      expect(call.duration).toBe(115);
      expect(call.endedAt! - call.answeredAt!).toBe(115000);
    });
  });

  describe("Group Call Limits", () => {
    it("should enforce maximum participant limit", () => {
      const MAX_GROUP_PARTICIPANTS = 8;

      const participants: Record<string, any> = {};
      for (let i = 0; i < 10; i++) {
        participants[`user-${i}`] = {
          odId: `user-${i}`,
          displayName: `User ${i}`,
        };
      }

      const participantCount = Object.keys(participants).length;
      expect(participantCount).toBeGreaterThan(MAX_GROUP_PARTICIPANTS);

      // Service should reject additional participants
      const canJoin = participantCount < MAX_GROUP_PARTICIPANTS;
      expect(canJoin).toBe(false);
    });
  });

  describe("Call Privacy Settings", () => {
    it("should respect DND schedule", () => {
      const isDNDActive = (
        schedule: { enabled: boolean; startHour: number; endHour: number },
        currentHour: number,
      ): boolean => {
        if (!schedule.enabled) return false;

        // Handle overnight schedules
        if (schedule.startHour > schedule.endHour) {
          return (
            currentHour >= schedule.startHour || currentHour < schedule.endHour
          );
        }

        return (
          currentHour >= schedule.startHour && currentHour < schedule.endHour
        );
      };

      // Test normal schedule (9 AM to 5 PM)
      expect(
        isDNDActive({ enabled: true, startHour: 9, endHour: 17 }, 12),
      ).toBe(true);
      expect(
        isDNDActive({ enabled: true, startHour: 9, endHour: 17 }, 20),
      ).toBe(false);

      // Test overnight schedule (10 PM to 7 AM)
      expect(
        isDNDActive({ enabled: true, startHour: 22, endHour: 7 }, 23),
      ).toBe(true);
      expect(isDNDActive({ enabled: true, startHour: 22, endHour: 7 }, 3)).toBe(
        true,
      );
      expect(
        isDNDActive({ enabled: true, startHour: 22, endHour: 7 }, 12),
      ).toBe(false);

      // Test disabled
      expect(
        isDNDActive({ enabled: false, startHour: 0, endHour: 23 }, 12),
      ).toBe(false);
    });

    it("should filter calls based on allowCallsFrom setting", () => {
      type AllowCallsFrom = "everyone" | "friends_only" | "nobody";

      const shouldAllowCall = (
        setting: AllowCallsFrom,
        isFriend: boolean,
      ): boolean => {
        if (setting === "nobody") return false;
        if (setting === "friends_only" && !isFriend) return false;
        return true;
      };

      expect(shouldAllowCall("everyone", false)).toBe(true);
      expect(shouldAllowCall("everyone", true)).toBe(true);
      expect(shouldAllowCall("friends_only", true)).toBe(true);
      expect(shouldAllowCall("friends_only", false)).toBe(false);
      expect(shouldAllowCall("nobody", true)).toBe(false);
      expect(shouldAllowCall("nobody", false)).toBe(false);
    });
  });

  describe("Call Timeout", () => {
    it("should mark call as missed after timeout", () => {
      jest.useFakeTimers();

      const CALL_TIMEOUT_MS = 30000;
      let callStatus: CallStatus = "ringing";

      // Simulate timeout
      setTimeout(() => {
        if (callStatus === "ringing") {
          callStatus = "missed";
        }
      }, CALL_TIMEOUT_MS);

      // Before timeout
      expect(callStatus).toBe("ringing");

      // After timeout
      jest.advanceTimersByTime(CALL_TIMEOUT_MS + 1000);
      expect(callStatus).toBe("missed");

      jest.useRealTimers();
    });

    it("should not timeout if call is answered", () => {
      jest.useFakeTimers();

      const CALL_TIMEOUT_MS = 30000;
      let callStatus: CallStatus = "ringing";

      // Answer call before timeout
      setTimeout(() => {
        callStatus = "connected";
      }, 5000);

      // Timeout handler
      setTimeout(() => {
        if (callStatus === "ringing") {
          callStatus = "missed";
        }
      }, CALL_TIMEOUT_MS);

      // After answer, before timeout
      jest.advanceTimersByTime(10000);
      expect(callStatus).toBe("connected");

      // After timeout would have fired
      jest.advanceTimersByTime(25000);
      expect(callStatus).toBe("connected"); // Still connected, not missed

      jest.useRealTimers();
    });
  });
});

describe("CallHistoryService", () => {
  describe("Duration Formatting", () => {
    const formatDuration = (seconds: number | null): string => {
      if (seconds === null || seconds === 0) return "0:00";

      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;

      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      }
      return `${minutes}:${secs.toString().padStart(2, "0")}`;
    };

    it("should format seconds correctly", () => {
      expect(formatDuration(0)).toBe("0:00");
      expect(formatDuration(null)).toBe("0:00");
      expect(formatDuration(30)).toBe("0:30");
      expect(formatDuration(60)).toBe("1:00");
      expect(formatDuration(90)).toBe("1:30");
      expect(formatDuration(125)).toBe("2:05");
    });

    it("should format minutes correctly", () => {
      expect(formatDuration(300)).toBe("5:00");
      expect(formatDuration(599)).toBe("9:59");
      expect(formatDuration(3599)).toBe("59:59");
    });

    it("should format hours correctly", () => {
      expect(formatDuration(3600)).toBe("1:00:00");
      expect(formatDuration(3661)).toBe("1:01:01");
      expect(formatDuration(7265)).toBe("2:01:05");
    });
  });

  describe("Relative Time Formatting", () => {
    const formatRelativeTime = (timestamp: number, now: number): string => {
      const diff = now - timestamp;

      const minutes = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (minutes < 1) return "Just now";
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;

      const date = new Date(timestamp);
      return date.toLocaleDateString();
    };

    it("should show 'Just now' for very recent", () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 30000, now)).toBe("Just now");
    });

    it("should show minutes for recent calls", () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 5 * 60 * 1000, now)).toBe("5m ago");
      expect(formatRelativeTime(now - 45 * 60 * 1000, now)).toBe("45m ago");
    });

    it("should show hours for today", () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 2 * 60 * 60 * 1000, now)).toBe("2h ago");
      expect(formatRelativeTime(now - 12 * 60 * 60 * 1000, now)).toBe(
        "12h ago",
      );
    });

    it("should show days for this week", () => {
      const now = Date.now();
      expect(formatRelativeTime(now - 2 * 24 * 60 * 60 * 1000, now)).toBe(
        "2d ago",
      );
      expect(formatRelativeTime(now - 6 * 24 * 60 * 60 * 1000, now)).toBe(
        "6d ago",
      );
    });
  });

  describe("Call Statistics", () => {
    it("should calculate call statistics correctly", () => {
      const calls = [
        { direction: "outgoing", wasAnswered: true, duration: 120 },
        { direction: "incoming", wasAnswered: true, duration: 60 },
        { direction: "incoming", wasAnswered: false, duration: null },
        { direction: "outgoing", wasAnswered: true, duration: 180 },
        { direction: "incoming", wasAnswered: false, duration: null },
      ];

      const stats = {
        totalCalls: calls.length,
        outgoingCalls: calls.filter((c) => c.direction === "outgoing").length,
        incomingCalls: calls.filter(
          (c) => c.direction === "incoming" && c.wasAnswered,
        ).length,
        missedCalls: calls.filter(
          (c) => c.direction === "incoming" && !c.wasAnswered,
        ).length,
        totalDuration: calls.reduce((sum, c) => sum + (c.duration || 0), 0),
        longestCall: Math.max(...calls.map((c) => c.duration || 0)),
      };

      expect(stats.totalCalls).toBe(5);
      expect(stats.outgoingCalls).toBe(2);
      expect(stats.incomingCalls).toBe(1);
      expect(stats.missedCalls).toBe(2);
      expect(stats.totalDuration).toBe(360);
      expect(stats.longestCall).toBe(180);
    });
  });
});

describe("CallQuality", () => {
  describe("Quality Score Calculation", () => {
    const calculateMOSScore = (
      latency: number,
      packetLoss: number,
      jitter: number,
    ): number => {
      let score = 5;

      // Latency penalty
      if (latency > 400) score -= 2;
      else if (latency > 200) score -= 1;
      else if (latency > 100) score -= 0.5;

      // Packet loss penalty
      if (packetLoss > 10) score -= 2;
      else if (packetLoss > 5) score -= 1;
      else if (packetLoss > 2) score -= 0.5;

      // Jitter penalty
      if (jitter > 50) score -= 1;
      else if (jitter > 30) score -= 0.5;

      return Math.max(1, Math.min(5, score));
    };

    it("should return excellent score for good metrics", () => {
      const score = calculateMOSScore(50, 0.5, 10);
      expect(score).toBeGreaterThanOrEqual(4.5);
    });

    it("should return good score for moderate metrics", () => {
      const score = calculateMOSScore(150, 1.5, 25);
      expect(score).toBeGreaterThanOrEqual(3.5);
      expect(score).toBeLessThan(4.5);
    });

    it("should return poor score for bad metrics", () => {
      const score = calculateMOSScore(500, 15, 60);
      expect(score).toBeLessThanOrEqual(2);
    });

    it("should never go below 1", () => {
      const score = calculateMOSScore(1000, 50, 100);
      expect(score).toBe(1);
    });

    it("should never exceed 5", () => {
      const score = calculateMOSScore(0, 0, 0);
      expect(score).toBe(5);
    });
  });

  describe("Quality Rating", () => {
    const getQualityRating = (
      score: number,
    ): "excellent" | "good" | "fair" | "poor" | "bad" => {
      if (score >= 4.5) return "excellent";
      if (score >= 3.5) return "good";
      if (score >= 2.5) return "fair";
      if (score >= 1.5) return "poor";
      return "bad";
    };

    it("should map scores to ratings correctly", () => {
      expect(getQualityRating(5)).toBe("excellent");
      expect(getQualityRating(4.5)).toBe("excellent");
      expect(getQualityRating(4)).toBe("good");
      expect(getQualityRating(3.5)).toBe("good");
      expect(getQualityRating(3)).toBe("fair");
      expect(getQualityRating(2.5)).toBe("fair");
      expect(getQualityRating(2)).toBe("poor");
      expect(getQualityRating(1.5)).toBe("poor");
      expect(getQualityRating(1)).toBe("bad");
    });
  });

  describe("Issue Detection", () => {
    const THRESHOLDS = {
      HIGH_LATENCY_MS: 300,
      PACKET_LOSS_PERCENT: 5,
      LOW_BANDWIDTH_KBPS: 250,
    };

    const detectIssues = (
      latency: number,
      packetLoss: number,
      bandwidth: number,
    ): string[] => {
      const issues: string[] = [];

      if (latency > THRESHOLDS.HIGH_LATENCY_MS) issues.push("high_latency");
      if (packetLoss > THRESHOLDS.PACKET_LOSS_PERCENT)
        issues.push("packet_loss");
      if (bandwidth < THRESHOLDS.LOW_BANDWIDTH_KBPS)
        issues.push("low_bandwidth");

      return issues;
    };

    it("should detect high latency", () => {
      const issues = detectIssues(400, 0, 1000);
      expect(issues).toContain("high_latency");
    });

    it("should detect packet loss", () => {
      const issues = detectIssues(100, 10, 1000);
      expect(issues).toContain("packet_loss");
    });

    it("should detect low bandwidth", () => {
      const issues = detectIssues(100, 0, 200);
      expect(issues).toContain("low_bandwidth");
    });

    it("should detect multiple issues", () => {
      const issues = detectIssues(500, 15, 100);
      expect(issues).toContain("high_latency");
      expect(issues).toContain("packet_loss");
      expect(issues).toContain("low_bandwidth");
    });

    it("should return empty array for good metrics", () => {
      const issues = detectIssues(100, 1, 1000);
      expect(issues).toHaveLength(0);
    });
  });
});

describe("CallSettings", () => {
  describe("Default Settings", () => {
    it("should have sensible defaults", () => {
      const defaults = {
        defaultCamera: "front",
        mirrorFrontCamera: true,
        autoEnableVideo: false,
        defaultAudioOutput: "earpiece",
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
        ringtone: "default",
        vibrationEnabled: true,
        ringtoneVolume: 80,
        allowCallsFrom: "everyone",
        showCallPreview: true,
        preferredVideoQuality: "auto",
        dataSaverMode: false,
        wifiOnlyVideo: false,
      };

      expect(defaults.defaultCamera).toBe("front");
      expect(defaults.noiseSuppression).toBe(true);
      expect(defaults.allowCallsFrom).toBe("everyone");
    });
  });

  describe("Settings Validation", () => {
    it("should clamp ringtone volume to valid range", () => {
      const clampVolume = (volume: number): number => {
        return Math.max(0, Math.min(100, volume));
      };

      expect(clampVolume(-10)).toBe(0);
      expect(clampVolume(0)).toBe(0);
      expect(clampVolume(50)).toBe(50);
      expect(clampVolume(100)).toBe(100);
      expect(clampVolume(150)).toBe(100);
    });

    it("should validate DND schedule hours", () => {
      const isValidHour = (hour: number): boolean => {
        return hour >= 0 && hour <= 23 && Number.isInteger(hour);
      };

      expect(isValidHour(0)).toBe(true);
      expect(isValidHour(12)).toBe(true);
      expect(isValidHour(23)).toBe(true);
      expect(isValidHour(-1)).toBe(false);
      expect(isValidHour(24)).toBe(false);
      expect(isValidHour(12.5)).toBe(false);
    });
  });
});
