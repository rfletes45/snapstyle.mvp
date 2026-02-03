/**
 * Avatar Analytics
 *
 * Analytics tracking for avatar system usage, rollout monitoring,
 * and user behavior insights.
 *
 * @see docs/DIGITAL_AVATAR_SYSTEM_PLAN.md - Phase 8
 */

import { AVATAR_FEATURES } from "../../constants/featureFlags";

// =============================================================================
// TYPES
// =============================================================================

export type AvatarEventType =
  // Rendering events
  | "avatar_rendered"
  | "avatar_render_error"
  | "avatar_fallback_used"
  // Customization events
  | "customizer_opened"
  | "customizer_closed"
  | "customizer_saved"
  | "customizer_cancelled"
  | "customizer_reset"
  // Feature usage
  | "feature_changed"
  | "preset_applied"
  | "random_avatar_generated"
  // Migration events
  | "migration_started"
  | "migration_completed"
  | "migration_skipped"
  | "migration_failed"
  // Rollout events
  | "rollout_checked"
  | "rollout_enabled"
  | "rollout_disabled"
  // Legacy events
  | "legacy_avatar_rendered"
  | "legacy_config_detected";

export interface AvatarEventData {
  eventType: AvatarEventType;
  userId?: string;
  timestamp: number;
  properties?: Record<string, unknown>;
}

export interface AvatarAnalyticsConfig {
  /** Enable analytics tracking */
  enabled: boolean;
  /** Log events to console in development */
  debugLogging: boolean;
  /** Batch events before sending */
  batchEvents: boolean;
  /** Batch size before flushing */
  batchSize: number;
  /** Flush interval in milliseconds */
  flushInterval: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_CONFIG: AvatarAnalyticsConfig = {
  enabled: true,
  debugLogging: __DEV__,
  batchEvents: true,
  batchSize: 10,
  flushInterval: 30000, // 30 seconds
};

// =============================================================================
// ANALYTICS SERVICE
// =============================================================================

class AvatarAnalyticsService {
  private config: AvatarAnalyticsConfig;
  private eventQueue: AvatarEventData[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private sessionStats: {
    avatarsRendered: number;
    legacyAvatarsRendered: number;
    customizerOpened: number;
    featureChanges: number;
  } = {
    avatarsRendered: 0,
    legacyAvatarsRendered: 0,
    customizerOpened: 0,
    featureChanges: 0,
  };

  constructor(config: Partial<AvatarAnalyticsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    if (this.config.batchEvents && this.config.flushInterval > 0) {
      this.startFlushTimer();
    }
  }

  /**
   * Track an avatar-related event
   */
  track(
    eventType: AvatarEventType,
    properties?: Record<string, unknown>,
  ): void {
    if (!this.config.enabled) return;

    const event: AvatarEventData = {
      eventType,
      timestamp: Date.now(),
      properties: {
        ...properties,
        // Include feature flag states for context
        digitalAvatarEnabled: AVATAR_FEATURES.DIGITAL_AVATAR_ENABLED,
        avatarAnimationsEnabled: AVATAR_FEATURES.AVATAR_ANIMATIONS,
      },
    };

    // Update session stats
    this.updateSessionStats(eventType);

    // Debug logging
    if (this.config.debugLogging) {
      console.log("[AvatarAnalytics]", eventType, properties);
    }

    // Batch or send immediately
    if (this.config.batchEvents) {
      this.eventQueue.push(event);
      if (this.eventQueue.length >= this.config.batchSize) {
        this.flush();
      }
    } else {
      this.sendEvent(event);
    }
  }

  /**
   * Track avatar render event
   */
  trackRender(options: {
    isDigital: boolean;
    size: number;
    showBody?: boolean;
    renderTime?: number;
  }): void {
    const eventType = options.isDigital
      ? "avatar_rendered"
      : "legacy_avatar_rendered";

    this.track(eventType, {
      isDigital: options.isDigital,
      size: options.size,
      showBody: options.showBody,
      renderTime: options.renderTime,
    });
  }

  /**
   * Track customizer events
   */
  trackCustomizer(
    action: "opened" | "closed" | "saved" | "cancelled" | "reset",
    properties?: Record<string, unknown>,
  ): void {
    const eventMap: Record<string, AvatarEventType> = {
      opened: "customizer_opened",
      closed: "customizer_closed",
      saved: "customizer_saved",
      cancelled: "customizer_cancelled",
      reset: "customizer_reset",
    };

    this.track(eventMap[action], properties);
  }

  /**
   * Track feature change in customizer
   */
  trackFeatureChange(
    category: string,
    feature: string,
    oldValue: unknown,
    newValue: unknown,
  ): void {
    this.track("feature_changed", {
      category,
      feature,
      oldValue,
      newValue,
    });
  }

  /**
   * Track preset application
   */
  trackPresetApplied(presetId: string): void {
    this.track("preset_applied", { presetId });
  }

  /**
   * Track migration events
   */
  trackMigration(
    status: "started" | "completed" | "skipped" | "failed",
    properties?: Record<string, unknown>,
  ): void {
    const eventMap: Record<string, AvatarEventType> = {
      started: "migration_started",
      completed: "migration_completed",
      skipped: "migration_skipped",
      failed: "migration_failed",
    };

    this.track(eventMap[status], properties);
  }

  /**
   * Track rollout check
   */
  trackRolloutCheck(featureId: string, enabled: boolean, reason: string): void {
    this.track("rollout_checked", {
      featureId,
      enabled,
      reason,
    });

    // Also track the specific enable/disable event
    this.track(enabled ? "rollout_enabled" : "rollout_disabled", {
      featureId,
      reason,
    });
  }

  /**
   * Track render error
   */
  trackRenderError(error: Error, context?: Record<string, unknown>): void {
    this.track("avatar_render_error", {
      error: error.message,
      stack: error.stack?.slice(0, 500), // Limit stack trace size
      ...context,
    });
  }

  /**
   * Get session statistics
   */
  getSessionStats(): typeof this.sessionStats {
    return { ...this.sessionStats };
  }

  /**
   * Reset session statistics
   */
  resetSessionStats(): void {
    this.sessionStats = {
      avatarsRendered: 0,
      legacyAvatarsRendered: 0,
      customizerOpened: 0,
      featureChanges: 0,
    };
  }

  /**
   * Flush pending events immediately
   */
  flush(): void {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    // Send events to analytics backend
    this.sendEvents(events);
  }

  /**
   * Stop the analytics service
   */
  dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private updateSessionStats(eventType: AvatarEventType): void {
    switch (eventType) {
      case "avatar_rendered":
        this.sessionStats.avatarsRendered++;
        break;
      case "legacy_avatar_rendered":
        this.sessionStats.legacyAvatarsRendered++;
        break;
      case "customizer_opened":
        this.sessionStats.customizerOpened++;
        break;
      case "feature_changed":
        this.sessionStats.featureChanges++;
        break;
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private sendEvent(event: AvatarEventData): void {
    this.sendEvents([event]);
  }

  private sendEvents(events: AvatarEventData[]): void {
    // In a real implementation, this would send to your analytics backend
    // For now, we just log in development
    if (this.config.debugLogging) {
      console.log("[AvatarAnalytics] Flushing", events.length, "events");
    }

    // TODO: Integrate with actual analytics service
    // Examples:
    // - Firebase Analytics: logEvent()
    // - Amplitude: track()
    // - Mixpanel: track()
    // - Custom backend: POST /api/analytics/avatar
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const avatarAnalytics = new AvatarAnalyticsService();

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Track an avatar event (convenience function)
 */
export function trackAvatarEvent(
  eventType: AvatarEventType,
  properties?: Record<string, unknown>,
): void {
  avatarAnalytics.track(eventType, properties);
}

/**
 * Track avatar render (convenience function)
 */
export function trackAvatarRender(options: {
  isDigital: boolean;
  size: number;
  showBody?: boolean;
  renderTime?: number;
}): void {
  avatarAnalytics.trackRender(options);
}

/**
 * Track customizer action (convenience function)
 */
export function trackCustomizerAction(
  action: "opened" | "closed" | "saved" | "cancelled" | "reset",
  properties?: Record<string, unknown>,
): void {
  avatarAnalytics.trackCustomizer(action, properties);
}

/**
 * Track feature change (convenience function)
 */
export function trackAvatarFeatureChange(
  category: string,
  feature: string,
  oldValue: unknown,
  newValue: unknown,
): void {
  avatarAnalytics.trackFeatureChange(category, feature, oldValue, newValue);
}

/**
 * Track migration event (convenience function)
 */
export function trackAvatarMigration(
  status: "started" | "completed" | "skipped" | "failed",
  properties?: Record<string, unknown>,
): void {
  avatarAnalytics.trackMigration(status, properties);
}

// =============================================================================
// METRICS HELPERS
// =============================================================================

/**
 * Calculate digital avatar adoption rate
 */
export function calculateAdoptionRate(
  digitalRendered: number,
  legacyRendered: number,
): number {
  const total = digitalRendered + legacyRendered;
  if (total === 0) return 0;
  return Math.round((digitalRendered / total) * 100);
}

/**
 * Generate session summary for debugging
 */
export function getSessionSummary(): {
  stats: ReturnType<typeof avatarAnalytics.getSessionStats>;
  adoptionRate: number;
} {
  const stats = avatarAnalytics.getSessionStats();
  const adoptionRate = calculateAdoptionRate(
    stats.avatarsRendered,
    stats.legacyAvatarsRendered,
  );

  return { stats, adoptionRate };
}
