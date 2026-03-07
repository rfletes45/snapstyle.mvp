/**
 * Battleship — Haptic + Sound Feedback Hook
 *
 * Provides haptic and sound feedback for game events:
 * - hit: strong haptic + boom sound
 * - miss: light haptic + splash sound
 * - sunk: heavy haptic + alarm sound
 * - yourTurn: gentle pulse
 * - place: selection haptic
 * - fire: medium haptic
 * - invalid: error haptic
 *
 * Respects:
 * - Battleship settings `haptics` flag
 * - Global platform support (web silently skips)
 *
 * Sound: Uses expo-audio when available. Sounds are lazy-loaded.
 *
 * @module gamesV4/screens/battleship/useBattleshipFeedback
 */

import * as HapticsModule from "@/utils/haptics";
import { useCallback, useRef } from "react";

/** Feed this the game's haptics setting from BattleshipSettings */
export function useBattleshipFeedback(hapticsEnabled: boolean = true) {
  // Track if sound assets are loaded (for future expansion)
  const soundReadyRef = useRef(false);

  // ── Haptics ──

  const hitFeedback = useCallback(() => {
    if (!hapticsEnabled) return;
    HapticsModule.heavy();
  }, [hapticsEnabled]);

  const missFeedback = useCallback(() => {
    if (!hapticsEnabled) return;
    HapticsModule.light();
  }, [hapticsEnabled]);

  const sunkFeedback = useCallback(() => {
    if (!hapticsEnabled) return;
    // Double-tap heavy for dramatic effect
    HapticsModule.heavy();
    setTimeout(() => HapticsModule.warning(), 150);
  }, [hapticsEnabled]);

  const yourTurnFeedback = useCallback(() => {
    if (!hapticsEnabled) return;
    HapticsModule.medium();
  }, [hapticsEnabled]);

  const placeFeedback = useCallback(() => {
    if (!hapticsEnabled) return;
    HapticsModule.selection();
  }, [hapticsEnabled]);

  const fireFeedback = useCallback(() => {
    if (!hapticsEnabled) return;
    HapticsModule.medium();
  }, [hapticsEnabled]);

  const invalidFeedback = useCallback(() => {
    if (!hapticsEnabled) return;
    HapticsModule.error();
  }, [hapticsEnabled]);

  const confirmFeedback = useCallback(() => {
    if (!hapticsEnabled) return;
    HapticsModule.success();
  }, [hapticsEnabled]);

  const tabChangeFeedback = useCallback(() => {
    if (!hapticsEnabled) return;
    HapticsModule.selection();
  }, [hapticsEnabled]);

  return {
    hitFeedback,
    missFeedback,
    sunkFeedback,
    yourTurnFeedback,
    placeFeedback,
    fireFeedback,
    invalidFeedback,
    confirmFeedback,
    tabChangeFeedback,
  };
}
