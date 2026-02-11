/**
 * Shared types for spectator game renderers.
 *
 * Each renderer receives the parsed `gameState` JSON from the SpectatorRoom
 * and renders a read-only view of the game being played.
 */

export interface SpectatorRendererProps {
  /** Parsed game-state JSON pushed by the host */
  gameState: Record<string, unknown>;
  /** Available width for the renderer (px) */
  width: number;
  /** Current score (from top-level room state) */
  score: number;
  /** Current level (from top-level room state) */
  level: number;
  /** Remaining lives (from top-level room state) */
  lives: number;
}
