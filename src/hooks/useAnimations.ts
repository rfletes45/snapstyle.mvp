/**
 * Animation Hooks
 *
 * Phase 7 of Profile Screen Overhaul
 *
 * Utility hooks for triggering and managing animations:
 * - useProfileAnimations: Central state for profile animations
 * - useBadgeEarnAnimation: Trigger badge earn celebrations
 * - useLevelUpAnimation: Trigger level up celebrations
 * - useAnimationQueue: Queue multiple animations
 *
 * @see docs/PROFILE_SCREEN_OVERHAUL_PLAN.md Phase 7
 */

import {
  invalidateCacheForEvent,
  subscribeToCacheInvalidation,
  type CacheInvalidationEvent,
} from "@/services/profileCache";
import type { Badge } from "@/types/profile";
import { useCallback, useEffect, useRef, useState } from "react";

// =============================================================================
// Types
// =============================================================================

export interface BadgeEarnAnimationState {
  visible: boolean;
  badge: Badge | null;
}

export interface LevelUpAnimationState {
  visible: boolean;
  previousLevel: number;
  newLevel: number;
  xpGained: number;
  rewards: Array<{ type: string; name: string; icon: string }>;
}

export interface AnimationQueueItem {
  type: "badge_earn" | "level_up";
  data: any;
  priority: number;
  timestamp: number;
}

export interface ProfileAnimationsState {
  badgeEarn: BadgeEarnAnimationState;
  levelUp: LevelUpAnimationState;
  isAnimating: boolean;
}

// =============================================================================
// useBadgeEarnAnimation
// =============================================================================

/**
 * Hook for managing badge earn animation state
 */
export function useBadgeEarnAnimation() {
  const [state, setState] = useState<BadgeEarnAnimationState>({
    visible: false,
    badge: null,
  });

  /**
   * Show the badge earn animation
   */
  const showAnimation = useCallback((badge: Badge) => {
    setState({
      visible: true,
      badge,
    });
  }, []);

  /**
   * Hide the badge earn animation
   */
  const hideAnimation = useCallback(() => {
    setState({
      visible: false,
      badge: null,
    });
  }, []);

  /**
   * Handle animation completion
   */
  const handleComplete = useCallback(() => {
    hideAnimation();
  }, [hideAnimation]);

  return {
    ...state,
    showAnimation,
    hideAnimation,
    handleComplete,
  };
}

// =============================================================================
// useLevelUpAnimation
// =============================================================================

/**
 * Hook for managing level up animation state
 */
export function useLevelUpAnimation() {
  const [state, setState] = useState<LevelUpAnimationState>({
    visible: false,
    previousLevel: 1,
    newLevel: 1,
    xpGained: 0,
    rewards: [],
  });

  /**
   * Show the level up animation
   */
  const showAnimation = useCallback(
    (
      previousLevel: number,
      newLevel: number,
      xpGained: number = 0,
      rewards: Array<{ type: string; name: string; icon: string }> = [],
    ) => {
      setState({
        visible: true,
        previousLevel,
        newLevel,
        xpGained,
        rewards,
      });
    },
    [],
  );

  /**
   * Hide the level up animation
   */
  const hideAnimation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      visible: false,
    }));
  }, []);

  /**
   * Handle animation completion
   */
  const handleComplete = useCallback(() => {
    hideAnimation();
  }, [hideAnimation]);

  return {
    ...state,
    showAnimation,
    hideAnimation,
    handleComplete,
  };
}

// =============================================================================
// useAnimationQueue
// =============================================================================

/**
 * Hook for queuing and playing animations sequentially
 */
export function useAnimationQueue() {
  const queueRef = useRef<AnimationQueueItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentItem, setCurrentItem] = useState<AnimationQueueItem | null>(
    null,
  );

  /**
   * Add an item to the animation queue
   */
  const enqueue = useCallback((item: Omit<AnimationQueueItem, "timestamp">) => {
    queueRef.current.push({
      ...item,
      timestamp: Date.now(),
    });

    // Sort by priority (higher first), then by timestamp (older first)
    queueRef.current.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });
  }, []);

  /**
   * Play the next animation in the queue
   */
  const playNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      setIsPlaying(false);
      setCurrentItem(null);
      return;
    }

    const nextItem = queueRef.current.shift()!;
    setCurrentItem(nextItem);
    setIsPlaying(true);
  }, []);

  /**
   * Mark current animation as complete and play next
   */
  const onAnimationComplete = useCallback(() => {
    playNext();
  }, [playNext]);

  /**
   * Start playing the queue if not already playing
   */
  const startQueue = useCallback(() => {
    if (!isPlaying && queueRef.current.length > 0) {
      playNext();
    }
  }, [isPlaying, playNext]);

  /**
   * Clear all pending animations
   */
  const clearQueue = useCallback(() => {
    queueRef.current = [];
    setIsPlaying(false);
    setCurrentItem(null);
  }, []);

  /**
   * Get queue length
   */
  const queueLength = queueRef.current.length;

  return {
    currentItem,
    isPlaying,
    queueLength,
    enqueue,
    playNext,
    startQueue,
    clearQueue,
    onAnimationComplete,
  };
}

// =============================================================================
// useProfileAnimations
// =============================================================================

/**
 * Central hook for managing all profile-related animations
 * Integrates with cache invalidation to trigger animations automatically
 */
export function useProfileAnimations(uid: string | null) {
  const badgeEarn = useBadgeEarnAnimation();
  const levelUp = useLevelUpAnimation();
  const queue = useAnimationQueue();

  // Track previous values for change detection
  const previousLevelRef = useRef<number | null>(null);
  const earnedBadgesRef = useRef<Set<string>>(new Set());

  /**
   * Queue a badge earn animation
   */
  const queueBadgeEarn = useCallback(
    (badge: Badge) => {
      // Prevent duplicate animations for same badge
      if (earnedBadgesRef.current.has(badge.id)) {
        return;
      }
      earnedBadgesRef.current.add(badge.id);

      queue.enqueue({
        type: "badge_earn",
        data: { badge },
        priority: 1, // Normal priority
      });
      queue.startQueue();
    },
    [queue],
  );

  /**
   * Queue a level up animation
   */
  const queueLevelUp = useCallback(
    (
      previousLevel: number,
      newLevel: number,
      xpGained?: number,
      rewards?: Array<{ type: string; name: string; icon: string }>,
    ) => {
      queue.enqueue({
        type: "level_up",
        data: { previousLevel, newLevel, xpGained, rewards },
        priority: 2, // Higher priority than badge earn
      });
      queue.startQueue();
    },
    [queue],
  );

  /**
   * Check for level changes and trigger animation
   */
  const checkLevelChange = useCallback(
    (newLevel: number, xpGained?: number) => {
      const prevLevel = previousLevelRef.current;

      if (prevLevel !== null && newLevel > prevLevel) {
        queueLevelUp(prevLevel, newLevel, xpGained);
      }

      previousLevelRef.current = newLevel;
    },
    [queueLevelUp],
  );

  /**
   * Check for new badges and trigger animation
   */
  const checkNewBadges = useCallback(
    (badges: Badge[], userBadgeIds: Set<string>) => {
      for (const badge of badges) {
        if (
          userBadgeIds.has(badge.id) &&
          !earnedBadgesRef.current.has(badge.id)
        ) {
          // This is a newly earned badge
          queueBadgeEarn(badge);
        }
      }
    },
    [queueBadgeEarn],
  );

  // Process animation queue
  useEffect(() => {
    if (queue.currentItem) {
      switch (queue.currentItem.type) {
        case "badge_earn":
          badgeEarn.showAnimation(queue.currentItem.data.badge);
          break;
        case "level_up":
          levelUp.showAnimation(
            queue.currentItem.data.previousLevel,
            queue.currentItem.data.newLevel,
            queue.currentItem.data.xpGained,
            queue.currentItem.data.rewards,
          );
          break;
      }
    }
  }, [queue.currentItem, badgeEarn, levelUp]);

  // Handle animation completion
  const handleBadgeEarnComplete = useCallback(() => {
    badgeEarn.handleComplete();
    queue.onAnimationComplete();
  }, [badgeEarn, queue]);

  const handleLevelUpComplete = useCallback(() => {
    levelUp.handleComplete();
    queue.onAnimationComplete();
  }, [levelUp, queue]);

  // Subscribe to cache invalidation events
  useEffect(() => {
    if (!uid) return;

    const unsubscribe = subscribeToCacheInvalidation(uid, (event) => {
      // Could trigger animations based on cache events
      // For now, animations are triggered by checking data changes
    });

    return unsubscribe;
  }, [uid]);

  /**
   * Invalidate cache for specific events
   */
  const invalidateForEvent = useCallback(
    async (event: CacheInvalidationEvent) => {
      if (uid) {
        await invalidateCacheForEvent(uid, event);
      }
    },
    [uid],
  );

  return {
    // Badge earn animation state
    badgeEarnState: {
      visible: badgeEarn.visible,
      badge: badgeEarn.badge,
    },
    showBadgeEarn: badgeEarn.showAnimation,
    hideBadgeEarn: badgeEarn.hideAnimation,
    onBadgeEarnComplete: handleBadgeEarnComplete,

    // Level up animation state
    levelUpState: {
      visible: levelUp.visible,
      previousLevel: levelUp.previousLevel,
      newLevel: levelUp.newLevel,
      xpGained: levelUp.xpGained,
      rewards: levelUp.rewards,
    },
    showLevelUp: levelUp.showAnimation,
    hideLevelUp: levelUp.hideAnimation,
    onLevelUpComplete: handleLevelUpComplete,

    // Queue management
    queueBadgeEarn,
    queueLevelUp,
    isAnimating: queue.isPlaying,
    queueLength: queue.queueLength,
    clearAnimationQueue: queue.clearQueue,

    // Data change detection
    checkLevelChange,
    checkNewBadges,

    // Cache integration
    invalidateForEvent,
  };
}

// =============================================================================
// useAnimatedValue
// =============================================================================

/**
 * Simple hook for animating number values
 * Useful for XP counters, stats, etc.
 */
export function useAnimatedValue(
  targetValue: number,
  options: {
    duration?: number;
    delay?: number;
    onComplete?: () => void;
  } = {},
) {
  const { duration = 500, delay = 0, onComplete } = options;
  const [displayValue, setDisplayValue] = useState(0);
  const animationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const startValueRef = useRef<number>(0);

  useEffect(() => {
    // Clear any existing animation
    if (animationRef.current) {
      clearInterval(animationRef.current);
    }

    const startAnimation = () => {
      startTimeRef.current = Date.now();
      startValueRef.current = displayValue;

      const animate = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const easedProgress = 1 - Math.pow(1 - progress, 3);

        const currentValue = Math.round(
          startValueRef.current +
            (targetValue - startValueRef.current) * easedProgress,
        );

        setDisplayValue(currentValue);

        if (progress >= 1) {
          if (animationRef.current) {
            clearInterval(animationRef.current);
            animationRef.current = null;
          }
          onComplete?.();
        }
      };

      animationRef.current = setInterval(animate, 16); // ~60fps
    };

    const timeoutId = setTimeout(startAnimation, delay);

    return () => {
      clearTimeout(timeoutId);
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [targetValue, duration, delay]);

  return displayValue;
}

// =============================================================================
// Export
// =============================================================================

export default useProfileAnimations;
