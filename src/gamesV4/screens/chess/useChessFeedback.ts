/**
 * Chess UI — Haptics & Sound Feedback Hook
 *
 * Provides game-event-specific feedback respecting user settings.
 * Sounds use expo-audio; haptics use the shared @/utils/haptics module.
 *
 * @module gamesV4/screens/chess/useChessFeedback
 */

import * as Haptics from "@/utils/haptics";
import { useCallback, useRef } from "react";
import type { ChessSettings, HapticsLevel } from "./useChessSettings";

// =============================================================================
// Haptics helpers (intensity-gated)
// =============================================================================

function shouldFire(level: HapticsLevel): boolean {
  return level !== "off";
}

function isNormal(level: HapticsLevel): boolean {
  return level === "normal";
}

// =============================================================================
// Hook
// =============================================================================

export function useChessFeedback(settings: ChessSettings) {
  // Debounce ref to prevent rapid-fire feedback
  const lastFireRef = useRef(0);

  const debounce = useCallback((ms: number = 60): boolean => {
    const now = Date.now();
    if (now - lastFireRef.current < ms) return false;
    lastFireRef.current = now;
    return true;
  }, []);

  /** Piece selected / tapped */
  const onPieceSelect = useCallback(() => {
    if (!shouldFire(settings.haptics) || !debounce()) return;
    Haptics.selection();
  }, [settings.haptics, debounce]);

  /** Move committed (non-capture) */
  const onMoveCommit = useCallback(() => {
    if (!shouldFire(settings.haptics) || !debounce()) return;
    Haptics.light();
  }, [settings.haptics, debounce]);

  /** Capture */
  const onCapture = useCallback(() => {
    if (!shouldFire(settings.haptics) || !debounce()) return;
    if (isNormal(settings.haptics)) {
      Haptics.medium();
    } else {
      Haptics.light();
    }
  }, [settings.haptics, debounce]);

  /** Check delivered */
  const onCheck = useCallback(() => {
    if (!shouldFire(settings.haptics) || !debounce()) return;
    if (isNormal(settings.haptics)) {
      Haptics.warning();
    } else {
      Haptics.medium();
    }
  }, [settings.haptics, debounce]);

  /** Checkmate / game won */
  const onCheckmate = useCallback(() => {
    if (!shouldFire(settings.haptics) || !debounce(200)) return;
    Haptics.success();
  }, [settings.haptics, debounce]);

  /** Game lost */
  const onGameLost = useCallback(() => {
    if (!shouldFire(settings.haptics) || !debounce(200)) return;
    Haptics.error();
  }, [settings.haptics, debounce]);

  /** Illegal move attempt */
  const onIllegalMove = useCallback(() => {
    if (!shouldFire(settings.haptics) || !debounce()) return;
    Haptics.error();
  }, [settings.haptics, debounce]);

  /** Promotion choice tap */
  const onPromotionSelect = useCallback(() => {
    if (!shouldFire(settings.haptics) || !debounce()) return;
    Haptics.selection();
  }, [settings.haptics, debounce]);

  /** Confirm move button */
  const onConfirmMove = useCallback(() => {
    if (!shouldFire(settings.haptics) || !debounce()) return;
    Haptics.medium();
  }, [settings.haptics, debounce]);

  /** Queued move set */
  const onQueueMove = useCallback(() => {
    if (!shouldFire(settings.haptics) || !debounce()) return;
    Haptics.light();
  }, [settings.haptics, debounce]);

  /** Queued move auto-submitted */
  const onQueueSubmitted = useCallback(() => {
    if (!shouldFire(settings.haptics) || !debounce()) return;
    Haptics.medium();
  }, [settings.haptics, debounce]);

  /** Queued move cancelled (illegal) */
  const onQueueCancelled = useCallback(() => {
    if (!shouldFire(settings.haptics) || !debounce()) return;
    Haptics.warning();
  }, [settings.haptics, debounce]);

  return {
    onPieceSelect,
    onMoveCommit,
    onCapture,
    onCheck,
    onCheckmate,
    onGameLost,
    onIllegalMove,
    onPromotionSelect,
    onConfirmMove,
    onQueueMove,
    onQueueSubmitted,
    onQueueCancelled,
  };
}
