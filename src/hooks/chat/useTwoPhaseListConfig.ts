/**
 * useTwoPhaseListConfig
 *
 * Provides a two-phase FlatList configuration for chat entry:
 *
 * Phase 1 (cold entry): Lightweight config optimized for fast first paint.
 *   - windowSize: 11 (5 screens above + 1 + 5 below)
 *   - initialNumToRender: 15
 *   - maxToRenderPerBatch: 10
 *
 * Phase 2 (steady state): Full config for fast-scroll resilience.
 *   - windowSize: 101 (50 screens above + 1 + 50 below)
 *   - maxToRenderPerBatch: 50
 *   - updateCellsBatchingPeriod: 16
 *
 * Promotion happens after InteractionManager completes + a short idle delay,
 * ensuring the transition animation is fully done before we increase the
 * render window.
 *
 * @module hooks/chat/useTwoPhaseListConfig
 */

import { chatPerf } from "@/utils/chatPerf";
import { startTransition, useEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";

interface FlatListPhaseConfig {
  windowSize: number;
  initialNumToRender: number;
  maxToRenderPerBatch: number;
  updateCellsBatchingPeriod: number;
}

const PHASE_1_CONFIG: FlatListPhaseConfig = {
  windowSize: 11,
  initialNumToRender: 15,
  maxToRenderPerBatch: 10,
  updateCellsBatchingPeriod: 50,
};

const PHASE_2_CONFIG: FlatListPhaseConfig = {
  windowSize: 101,
  initialNumToRender: 15,
  maxToRenderPerBatch: 50,
  updateCellsBatchingPeriod: 16,
};

/** Delay (ms) after interactions complete before promoting to Phase 2 */
const PROMOTION_DELAY_MS = 300;

export function useTwoPhaseListConfig(conversationId: string): {
  listConfig: FlatListPhaseConfig;
  isPromoted: boolean;
} {
  const [promoted, setPromoted] = useState(false);
  const promotedRef = useRef(false);

  // Reset on conversation change
  useEffect(() => {
    promotedRef.current = false;
    setPromoted(false);
  }, [conversationId]);

  useEffect(() => {
    if (promotedRef.current) return;

    const mountTime = performance.now();
    chatPerf.mark(`phase2:${conversationId}`);

    const task = InteractionManager.runAfterInteractions(() => {
      const interactionDone = performance.now();
      chatPerf.measure(
        `phase2:${conversationId}`,
        `interactions-done (${Math.round(interactionDone - mountTime)}ms from mount)`,
      );

      // Additional delay to let first paint settle
      const timer = setTimeout(() => {
        if (!promotedRef.current) {
          promotedRef.current = true;
          const totalMs = Math.round(performance.now() - mountTime);
          chatPerf.measure(
            `phase2:${conversationId}`,
            `promoted (${totalMs}ms from mount)`,
          );
          startTransition(() => setPromoted(true));
        }
      }, PROMOTION_DELAY_MS);

      // Store for cleanup
      (task as any)._timer = timer;
    });

    return () => {
      task.cancel();
      if ((task as any)._timer) {
        clearTimeout((task as any)._timer);
      }
    };
  }, [conversationId]);

  return {
    listConfig: promoted ? PHASE_2_CONFIG : PHASE_1_CONFIG,
    isPromoted: promoted,
  };
}
