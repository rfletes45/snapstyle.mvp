/**
 * Spectator Game Renderer
 *
 * Maps a `gameType` string to the correct per-game spectator renderer.
 * If no renderer exists for the game type, a fallback stats-only view
 * is shown.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import type { SpectatorRendererProps } from "./types";

import { BounceBlitzSpectatorRenderer } from "./BounceBlitzSpectatorRenderer";
import { BrickBreakerSpectatorRenderer } from "./BrickBreakerSpectatorRenderer";
import { CheckersSpectatorRenderer } from "./CheckersSpectatorRenderer";
import { ChessSpectatorRenderer } from "./ChessSpectatorRenderer";
import { ConnectFourSpectatorRenderer } from "./ConnectFourSpectatorRenderer";
import { CrazyEightsSpectatorRenderer } from "./CrazyEightsSpectatorRenderer";
import { CrosswordSpectatorRenderer } from "./CrosswordSpectatorRenderer";
import { DotMatchSpectatorRenderer } from "./DotMatchSpectatorRenderer";
import { GomokuSpectatorRenderer } from "./GomokuSpectatorRenderer";
import { HexSpectatorRenderer } from "./HexSpectatorRenderer";
import { LightsOutSpectatorRenderer } from "./LightsOutSpectatorRenderer";
import { MinesweeperSpectatorRenderer } from "./MinesweeperSpectatorRenderer";
import { Play2048SpectatorRenderer } from "./Play2048SpectatorRenderer";
import { PongSpectatorRenderer } from "./PongSpectatorRenderer";
import { ReversiSpectatorRenderer } from "./ReversiSpectatorRenderer";
import { TicTacToeSpectatorRenderer } from "./TicTacToeSpectatorRenderer";
import { WordMasterSpectatorRenderer } from "./WordMasterSpectatorRenderer";

// ─── Renderer map ───────────────────────────────────────────────────────

const RENDERERS: Record<string, React.ComponentType<SpectatorRendererProps>> = {
  brick_breaker: BrickBreakerSpectatorRenderer,
  checkers: CheckersSpectatorRenderer,
  chess: ChessSpectatorRenderer,
  connect_four: ConnectFourSpectatorRenderer,
  crazy_eights: CrazyEightsSpectatorRenderer,
  crossword_puzzle: CrosswordSpectatorRenderer,
  dot_match: DotMatchSpectatorRenderer,
  gomoku_master: GomokuSpectatorRenderer,
  hex: HexSpectatorRenderer,
  reversi_game: ReversiSpectatorRenderer,
  tic_tac_toe: TicTacToeSpectatorRenderer,
  play_2048: Play2048SpectatorRenderer,
  pong_game: PongSpectatorRenderer,
  word_master: WordMasterSpectatorRenderer,
  lights_out: LightsOutSpectatorRenderer,
  minesweeper_classic: MinesweeperSpectatorRenderer,
  bounce_blitz: BounceBlitzSpectatorRenderer,
};

// ─── Public API ─────────────────────────────────────────────────────────

interface SpectatorGameRendererProps extends SpectatorRendererProps {
  /** The game type string (e.g. "brick_breaker") */
  gameType: string;
}

export function SpectatorGameRenderer({
  gameType,
  gameState,
  width,
  score,
  level,
  lives,
}: SpectatorGameRendererProps) {
  const Renderer = RENDERERS[gameType];

  if (!Renderer) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackEmoji}>🎮</Text>
        <Text style={styles.fallbackText}>
          Live view not available for this game
        </Text>
        <Text style={styles.fallbackScore}>Score: {score}</Text>
      </View>
    );
  }

  return (
    <Renderer
      gameState={gameState}
      width={width}
      score={score}
      level={level}
      lives={lives}
    />
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  fallbackEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  fallbackText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
    textAlign: "center",
  },
  fallbackScore: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 8,
  },
});
