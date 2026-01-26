/**
 * Game Analytics Service
 *
 * Tracks game events for analytics and monitoring.
 * Integrates with Firebase Analytics or similar service.
 */

import { Platform } from "react-native";

// ============================================================================
// Types
// ============================================================================

export type GameType =
  | "flappy_snap"
  | "memory_snap"
  | "bounce_blitz"
  | "snap_2048"
  | "timed_tap"
  | "reaction_tap"
  | "chess"
  | "checkers"
  | "tic_tac_toe"
  | "pool"
  | "crazy_eights";

export type GameResult = "win" | "lose" | "draw" | "forfeit" | "timeout";

export interface GameStartedEvent {
  game_type: GameType;
  is_multiplayer: boolean;
  opponent_id?: string;
  is_rematch?: boolean;
  is_daily_challenge?: boolean;
  matchmaking_type?: "friend" | "random" | "ranked";
}

export interface GameCompletedEvent {
  game_type: GameType;
  is_multiplayer: boolean;
  result: GameResult;
  duration_seconds: number;
  score?: number;
  moves_count?: number;
  opponent_id?: string;
  rating_change?: number;
  is_personal_best?: boolean;
}

export interface AchievementEarnedEvent {
  achievement_id: string;
  achievement_name: string;
  game_type?: GameType;
  coins_awarded?: number;
  xp_awarded?: number;
}

export interface InviteEvent {
  game_type: GameType;
  recipient_id?: string;
  action: "sent" | "accepted" | "declined" | "expired";
  response_time_seconds?: number;
}

export interface MatchmakingEvent {
  game_type: GameType;
  action: "started" | "completed" | "cancelled" | "timeout";
  wait_time_seconds?: number;
  rating?: number;
  opponent_rating?: number;
}

export interface GameErrorEvent {
  game_type: GameType;
  error_type: string;
  error_message: string;
  screen?: string;
  is_fatal: boolean;
}

export interface PerformanceEvent {
  game_type: GameType;
  avg_fps: number;
  min_fps: number;
  dropped_frames: number;
  session_duration_seconds: number;
  device_model?: string;
}

// ============================================================================
// Analytics Service
// ============================================================================

class GameAnalytics {
  private isEnabled: boolean = true;
  private userId: string | null = null;
  private sessionId: string;
  private eventQueue: Array<{ name: string; params: Record<string, unknown> }> =
    [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.startFlushInterval();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private startFlushInterval(): void {
    // Flush events every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000);
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  setUserId(userId: string | null): void {
    this.userId = userId;
  }

  // ============================================================================
  // Event Tracking
  // ============================================================================

  private track(eventName: string, params: object): void {
    if (!this.isEnabled) return;

    const enrichedParams = {
      ...params,
      session_id: this.sessionId,
      user_id: this.userId,
      timestamp: Date.now(),
      platform: Platform.OS,
    };

    this.eventQueue.push({ name: eventName, params: enrichedParams });

    // Log in development
    if (__DEV__) {
      console.log(`[Analytics] ${eventName}:`, enrichedParams);
    }
  }

  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    // In production, this would send to Firebase Analytics or similar
    // analytics().logEvent(event.name, event.params);

    if (__DEV__) {
      console.log(`[Analytics] Flushing ${events.length} events`);
    }
  }

  // ============================================================================
  // Game Events
  // ============================================================================

  gameStarted(params: GameStartedEvent): void {
    this.track("game_started", params);
  }

  gameCompleted(params: GameCompletedEvent): void {
    this.track("game_completed", params);

    // Track conversion metrics
    if (params.is_personal_best) {
      this.track("personal_best_achieved", {
        game_type: params.game_type,
        score: params.score,
      });
    }
  }

  gamePaused(gameType: GameType): void {
    this.track("game_paused", { game_type: gameType });
  }

  gameResumed(gameType: GameType): void {
    this.track("game_resumed", { game_type: gameType });
  }

  // ============================================================================
  // Achievement Events
  // ============================================================================

  achievementEarned(params: AchievementEarnedEvent): void {
    this.track("achievement_earned", params);
  }

  achievementProgress(
    achievementId: string,
    progress: number,
    total: number,
  ): void {
    this.track("achievement_progress", {
      achievement_id: achievementId,
      progress,
      total,
      percentage: Math.round((progress / total) * 100),
    });
  }

  // ============================================================================
  // Social Events
  // ============================================================================

  inviteSent(params: Omit<InviteEvent, "action">): void {
    this.track("game_invite", { ...params, action: "sent" });
  }

  inviteAccepted(params: Omit<InviteEvent, "action">): void {
    this.track("game_invite", { ...params, action: "accepted" });
  }

  inviteDeclined(params: Omit<InviteEvent, "action">): void {
    this.track("game_invite", { ...params, action: "declined" });
  }

  inviteExpired(params: Omit<InviteEvent, "action">): void {
    this.track("game_invite", { ...params, action: "expired" });
  }

  // ============================================================================
  // Matchmaking Events
  // ============================================================================

  matchmakingStarted(gameType: GameType, rating?: number): void {
    this.track("matchmaking", {
      game_type: gameType,
      action: "started",
      rating,
    });
  }

  matchmakingCompleted(params: Omit<MatchmakingEvent, "action">): void {
    this.track("matchmaking", { ...params, action: "completed" });
  }

  matchmakingCancelled(gameType: GameType, waitTimeSeconds: number): void {
    this.track("matchmaking", {
      game_type: gameType,
      action: "cancelled",
      wait_time_seconds: waitTimeSeconds,
    });
  }

  matchmakingTimeout(gameType: GameType, waitTimeSeconds: number): void {
    this.track("matchmaking", {
      game_type: gameType,
      action: "timeout",
      wait_time_seconds: waitTimeSeconds,
    });
  }

  // ============================================================================
  // Error Events
  // ============================================================================

  gameError(params: GameErrorEvent): void {
    this.track("game_error", params);
  }

  // ============================================================================
  // Performance Events
  // ============================================================================

  performanceReport(params: PerformanceEvent): void {
    this.track("game_performance", params);

    // Track poor performance separately
    if (params.avg_fps < 30) {
      this.track("poor_performance_detected", {
        game_type: params.game_type,
        avg_fps: params.avg_fps,
        device_model: params.device_model,
      });
    }
  }

  // ============================================================================
  // Navigation Events
  // ============================================================================

  screenViewed(screenName: string, params?: Record<string, unknown>): void {
    this.track("screen_view", {
      screen_name: screenName,
      ...params,
    });
  }

  gamesHubViewed(activeTab?: string): void {
    this.track("games_hub_viewed", { active_tab: activeTab });
  }

  // ============================================================================
  // Economy Events
  // ============================================================================

  coinsEarned(amount: number, source: string, gameType?: GameType): void {
    this.track("coins_earned", {
      amount,
      source,
      game_type: gameType,
    });
  }

  coinsSpent(amount: number, item: string): void {
    this.track("coins_spent", {
      amount,
      item,
    });
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const gameAnalytics = new GameAnalytics();

// ============================================================================
// React Hook
// ============================================================================

import { useCallback, useEffect } from "react";

export function useGameAnalytics(gameType: GameType) {
  useEffect(() => {
    // Track screen view on mount
    gameAnalytics.screenViewed(`game_${gameType}`);
  }, [gameType]);

  const trackStarted = useCallback(
    (params: Omit<GameStartedEvent, "game_type">) => {
      gameAnalytics.gameStarted({ ...params, game_type: gameType });
    },
    [gameType],
  );

  const trackCompleted = useCallback(
    (params: Omit<GameCompletedEvent, "game_type">) => {
      gameAnalytics.gameCompleted({ ...params, game_type: gameType });
    },
    [gameType],
  );

  const trackError = useCallback(
    (errorType: string, errorMessage: string, isFatal: boolean = false) => {
      gameAnalytics.gameError({
        game_type: gameType,
        error_type: errorType,
        error_message: errorMessage,
        is_fatal: isFatal,
      });
    },
    [gameType],
  );

  const trackPerformance = useCallback(
    (params: Omit<PerformanceEvent, "game_type">) => {
      gameAnalytics.performanceReport({ ...params, game_type: gameType });
    },
    [gameType],
  );

  return {
    trackStarted,
    trackCompleted,
    trackError,
    trackPerformance,
  };
}

export default gameAnalytics;
