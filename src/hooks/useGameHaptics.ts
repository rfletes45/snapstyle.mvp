/**
 * useGameHaptics Hook
 *
 * Provides consistent haptic feedback across all games.
 * Centralizes haptic patterns for common game events.
 *
 * @see docs/GAMES_IMPLEMENTATION_PLAN.md
 */

import * as Haptics from "expo-haptics";
import { Platform } from "react-native";


import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/useGameHaptics");
// =============================================================================
// Types
// =============================================================================

export type HapticFeedbackType =
  | "selection" // Light tap for UI selections
  | "success" // Success feedback (win, achievement)
  | "error" // Error/failure feedback
  | "warning" // Warning feedback
  | "impact_light" // Light impact (move, tap)
  | "impact_medium" // Medium impact (piece capture, tile merge)
  | "impact_heavy" // Heavy impact (game over, checkmate)
  | "move" // Piece/tile move
  | "capture" // Capturing opponent piece
  | "merge" // Tiles merging (2048)
  | "eat" // Snake eating food
  | "game_over" // Game over sequence
  | "win" // Win celebration
  | "lose" // Loss notification
  | "turn_change" // Turn changed
  | "card_play" // Playing a card
  | "card_draw" // Drawing a card
  | "check" // King in check
  | "special_move" // Special moves (castling, en passant)
  // New single-player game haptics
  | "tile_slide" // Tile sliding in puzzle
  | "brick_hit" // Ball hitting a brick
  | "brick_destroy" // Brick destroyed
  | "powerup_collect" // Power-up collected
  | "path_complete" // Path/course completed
  | "ball_launch" // Ball launched
  | "combo"; // Combo achieved

// =============================================================================
// Hook
// =============================================================================

export function useGameHaptics() {
  const isHapticsAvailable = Platform.OS !== "web";

  /**
   * Trigger haptic feedback based on game event type
   */
  const trigger = async (type: HapticFeedbackType) => {
    if (!isHapticsAvailable) return;

    try {
      switch (type) {
        // Basic selections
        case "selection":
          await Haptics.selectionAsync();
          break;

        // Success states
        case "success":
        case "win":
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          break;

        // Error states
        case "error":
        case "lose":
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Error,
          );
          break;

        // Warning states
        case "warning":
        case "check":
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning,
          );
          break;

        // Light impacts
        case "impact_light":
        case "move":
        case "card_draw":
        case "turn_change":
        case "tile_slide":
        case "brick_hit":
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;

        // Medium impacts
        case "impact_medium":
        case "capture":
        case "merge":
        case "eat":
        case "card_play":
        case "special_move":
        case "brick_destroy":
        case "combo":
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;

        // Heavy impacts
        case "impact_heavy":
        case "game_over":
        case "ball_launch":
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;

        // Path complete uses success notification
        case "path_complete":
        case "powerup_collect":
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success,
          );
          break;

        default:
          await Haptics.selectionAsync();
      }
    } catch (error) {
      // Silently fail if haptics not supported
      logger.debug("Haptics not available:", error);
    }
  };

  /**
   * Play a celebration pattern for winning
   */
  const celebrationPattern = async () => {
    if (!isHapticsAvailable) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      logger.debug("Haptics celebration failed:", error);
    }
  };

  /**
   * Play a game over pattern
   */
  const gameOverPattern = async (didWin: boolean) => {
    if (!isHapticsAvailable) return;

    try {
      if (didWin) {
        await celebrationPattern();
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        await new Promise((resolve) => setTimeout(resolve, 150));
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      logger.debug("Haptics game over failed:", error);
    }
  };

  /**
   * Play a quick double tap pattern
   */
  const doubleTap = async () => {
    if (!isHapticsAvailable) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await new Promise((resolve) => setTimeout(resolve, 80));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      logger.debug("Haptics double tap failed:", error);
    }
  };

  /**
   * Play an escalating pattern (good for combos/chains)
   */
  const escalatingPattern = async (count: number) => {
    if (!isHapticsAvailable) return;

    try {
      const styles = [
        Haptics.ImpactFeedbackStyle.Light,
        Haptics.ImpactFeedbackStyle.Medium,
        Haptics.ImpactFeedbackStyle.Heavy,
      ];

      for (let i = 0; i < Math.min(count, 3); i++) {
        await Haptics.impactAsync(styles[i]);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      logger.debug("Haptics escalating failed:", error);
    }
  };

  /**
   * Play a combo multiplier pattern for Hex Collapse and similar games
   * Intensity scales with combo count (1-5+)
   */
  const comboPattern = async (comboCount: number) => {
    if (!isHapticsAvailable) return;

    try {
      const baseDelay = 80;
      const pulses = Math.min(comboCount, 5);

      for (let i = 0; i < pulses; i++) {
        const style =
          i < 2
            ? Haptics.ImpactFeedbackStyle.Light
            : i < 4
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Heavy;
        await Haptics.impactAsync(style);
        await new Promise((resolve) => setTimeout(resolve, baseDelay - i * 10));
      }

      if (comboCount >= 3) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      }
    } catch (error) {
      logger.debug("Haptics combo pattern failed:", error);
    }
  };

  /**
   * Play a brick break cascade pattern for Brick Breaker
   * Used when multiple bricks are destroyed in quick succession
   */
  const brickCascadePattern = async (brickCount: number) => {
    if (!isHapticsAvailable) return;

    try {
      const bursts = Math.min(brickCount, 4);
      for (let i = 0; i < bursts; i++) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (brickCount >= 3) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      logger.debug("Haptics brick cascade failed:", error);
    }
  };

  /**
   * Play a puzzle solved pattern for Tile Slide and Color Flow
   * Satisfying completion feedback
   */
  const puzzleSolvedPattern = async () => {
    if (!isHapticsAvailable) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await new Promise((resolve) => setTimeout(resolve, 80));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await new Promise((resolve) => setTimeout(resolve, 80));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      logger.debug("Haptics puzzle solved failed:", error);
    }
  };

  /**
   * Play a level complete pattern with escalating intensity
   */
  const levelCompletePattern = async () => {
    if (!isHapticsAvailable) return;

    try {
      // Quick ascending taps
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await new Promise((resolve) => setTimeout(resolve, 100));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await new Promise((resolve) => setTimeout(resolve, 150));
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      logger.debug("Haptics level complete failed:", error);
    }
  };

  return {
    trigger,
    celebrationPattern,
    gameOverPattern,
    doubleTap,
    escalatingPattern,
    // New specialized patterns
    comboPattern,
    brickCascadePattern,
    puzzleSolvedPattern,
    levelCompletePattern,
    isHapticsAvailable,
  };
}

export default useGameHaptics;
