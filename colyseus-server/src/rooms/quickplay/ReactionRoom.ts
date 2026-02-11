/**
 * ReactionRoom â€” Reaction Time competitive game
 *
 * Both players wait for a stimulus, then tap as fast as possible.
 * The server synchronizes rounds. Best-of-5 rounds (configurable).
 * Lower reaction time wins each round.
 *
 * Unlike other quick-play games, this one is round-based:
 * - Server controls when each round's stimulus appears
 * - Players report their tap timestamp
 * - Server determines round winner
 */

import { MapSchema, Schema, type } from "@colyseus/schema";
import { Client, Room } from "colyseus";
import { Player } from "../../schemas/common";
import { verifyFirebaseToken } from "../../services/firebase";

// =============================================================================
// Reaction-specific Schema
// =============================================================================

class ReactionPlayer extends Player {
  @type("int32") reactionTimeMs: number = 0;
  @type("int32") roundsWon: number = 0;
  @type("boolean") tappedThisRound: boolean = false;
  @type("boolean") tooEarly: boolean = false;
  @type("int32") bestReactionMs: number = 9999;
  @type("int32") totalReactionMs: number = 0;
  @type("uint8") roundsTapped: number = 0;
}

class ReactionState extends Schema {
  @type("string") phase: string = "waiting";
  @type("string") gameId: string = "";
  @type("string") gameType: string = "reaction_tap_game";
  @type({ map: ReactionPlayer }) players = new MapSchema<ReactionPlayer>();
  @type("uint8") maxPlayers: number = 2;
  @type("string") winnerId: string = "";
  @type("string") winReason: string = "";
  @type("uint8") currentRound: number = 0;
  @type("uint8") totalRounds: number = 5;
  @type("string") roundPhase: string = "waiting";
  @type("uint8") countdown: number = 0;
  @type("boolean") isRated: boolean = true;
  @type("string") firestoreGameId: string = "";
}

// =============================================================================
// Room
// =============================================================================

// Intentionally standalone room: reaction-time rounds and early-tap handling
// do not fit the score-race base contract.
export class ReactionRoom extends Room<{ state: ReactionState }> {
  maxClients = 2;
  patchRate = 50;
  autoDispose = true;

  private stimulusTimer: any = null;
  private stimulusTimestamp: number = 0;

  async onAuth(client: Client, options: any, context: any) {
    const decoded = await verifyFirebaseToken(
      context?.token || options?.token || "",
    );
    return {
      uid: decoded.uid,
      displayName: (decoded as { name?: string; email?: string; picture?: string }).name || "Player",
    };
  }

  onCreate(options: any) {
    this.setState(new ReactionState());
    this.state.totalRounds = options.rounds || 5;
    this.state.gameId = this.roomId;
    this.state.phase = "waiting";
  }

  messages = {
    ready: (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.ready = true;
        this.checkAllReady();
      }
    },

    /**
     * Player tapped â€” record their reaction time.
     */
    tap: (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.tappedThisRound) return;

      if (this.state.roundPhase === "waiting_for_stimulus") {
        // Tapped too early!
        player.tooEarly = true;
        player.tappedThisRound = true;
        player.reactionTimeMs = -1;
        client.send("too_early", {});
        this.checkRoundComplete();
        return;
      }

      if (this.state.roundPhase === "stimulus_shown") {
        const reactionMs = Date.now() - this.stimulusTimestamp;
        player.reactionTimeMs = reactionMs;
        player.tappedThisRound = true;
        player.totalReactionMs += reactionMs;
        player.roundsTapped++;
        if (reactionMs < player.bestReactionMs) {
          player.bestReactionMs = reactionMs;
        }
        this.checkRoundComplete();
      }
    },

    rematch: (client: Client) => {
      if (this.state.phase !== "finished") return;
      this.broadcast("rematch_request", { fromSessionId: client.sessionId });
    },

    rematch_accept: () => {
      if (this.state.phase !== "finished") return;
      this.resetForRematch();
    },
  };

  onJoin(client: Client, options: any, auth: any) {
    const player = new ReactionPlayer();
    player.uid = auth.uid;
    player.sessionId = client.sessionId;
    player.displayName = auth.displayName || "Player";
    player.playerIndex = this.state.players.size;
    this.state.players.set(client.sessionId, player);

    client.send("welcome", {
      sessionId: client.sessionId,
      playerIndex: player.playerIndex,
    });

    if (this.state.players.size >= this.maxClients) {
      this.lock();
    }
  }

  onDrop(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;
    this.allowReconnection(client, 15);
  }

  onReconnect(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = true;
  }

  onLeave(client: Client) {
    if (this.state.phase === "playing") {
      const remaining = (
        Array.from(this.state.players.values()) as ReactionPlayer[]
      ).find(
        (p: ReactionPlayer) => p.sessionId !== client.sessionId && p.connected,
      );
      if (remaining) {
        this.state.winnerId = remaining.uid;
        this.state.winReason = "opponent_left";
        this.state.phase = "finished";
      }
    }
  }

  async onDispose() {
    if (this.stimulusTimer) this.stimulusTimer.clear();
  }

  // ===========================================================================
  // Round Flow
  // ===========================================================================

  private checkAllReady() {
    let allReady = true;
    this.state.players.forEach((p: ReactionPlayer) => {
      if (!p.ready) allReady = false;
    });
    if (allReady && this.state.players.size >= 2) {
      this.startGame();
    }
  }

  private startGame() {
    this.state.phase = "playing";
    this.state.currentRound = 0;
    this.startNextRound();
  }

  private startNextRound() {
    this.state.currentRound++;
    if (this.state.currentRound > this.state.totalRounds) {
      this.endGame();
      return;
    }

    // Reset round state for each player
    this.state.players.forEach((p: ReactionPlayer) => {
      p.tappedThisRound = false;
      p.tooEarly = false;
      p.reactionTimeMs = 0;
    });

    this.state.roundPhase = "waiting_for_stimulus";

    // Random delay before stimulus (1.5-5 seconds)
    const delay = 1500 + Math.random() * 3500;
    this.stimulusTimer = this.clock.setTimeout(() => {
      this.state.roundPhase = "stimulus_shown";
      this.stimulusTimestamp = Date.now();
      this.broadcast("stimulus", { round: this.state.currentRound });

      // Auto-end round after 3 seconds if someone hasn't tapped
      this.clock.setTimeout(() => {
        if (this.state.roundPhase === "stimulus_shown") {
          // Mark non-tappers as missed
          this.state.players.forEach((p: ReactionPlayer) => {
            if (!p.tappedThisRound) {
              p.tappedThisRound = true;
              p.reactionTimeMs = 3000;
            }
          });
          this.resolveRound();
        }
      }, 3000);
    }, delay);
  }

  private checkRoundComplete() {
    let allTapped = true;
    this.state.players.forEach((p: ReactionPlayer) => {
      if (!p.tappedThisRound) allTapped = false;
    });
    if (allTapped) {
      this.resolveRound();
    }
  }

  private resolveRound() {
    this.state.roundPhase = "round_result";

    const players = Array.from(this.state.players.values()) as ReactionPlayer[];
    const validPlayers = players.filter(
      (p: ReactionPlayer) => !p.tooEarly && p.reactionTimeMs > 0,
    );

    if (validPlayers.length === 1) {
      validPlayers[0].roundsWon++;
    } else if (validPlayers.length >= 2) {
      const sorted = [...validPlayers].sort(
        (a: ReactionPlayer, b: ReactionPlayer) =>
          a.reactionTimeMs - b.reactionTimeMs,
      );
      if (sorted[0].reactionTimeMs < sorted[1].reactionTimeMs) {
        sorted[0].roundsWon++;
      }
      // Tie: no one wins the round
    }

    this.broadcast("round_result", {
      round: this.state.currentRound,
      results: players.map((p: ReactionPlayer) => ({
        uid: p.uid,
        reactionMs: p.reactionTimeMs,
        tooEarly: p.tooEarly,
        roundsWon: p.roundsWon,
      })),
    });

    // Check for early win (enough rounds won)
    const roundsToWin = Math.ceil(this.state.totalRounds / 2);
    const earlyWinner = players.find(
      (p: ReactionPlayer) => p.roundsWon >= roundsToWin,
    );
    if (earlyWinner) {
      this.clock.setTimeout(() => this.endGame(), 2000);
      return;
    }

    // Next round after 2 second delay
    this.clock.setTimeout(() => this.startNextRound(), 2000);
  }

  private endGame() {
    this.state.phase = "finished";

    const players = Array.from(this.state.players.values()) as ReactionPlayer[];
    const sorted = [...players].sort(
      (a: ReactionPlayer, b: ReactionPlayer) => b.roundsWon - a.roundsWon,
    );

    if (sorted.length >= 2) {
      if (sorted[0].roundsWon > sorted[1].roundsWon) {
        this.state.winnerId = sorted[0].uid;
        this.state.winReason = "most_rounds_won";
      } else {
        // Tie on rounds â€” compare average reaction time
        const avg = (p: ReactionPlayer) =>
          p.roundsTapped > 0 ? p.totalReactionMs / p.roundsTapped : 9999;
        if (avg(sorted[0]) < avg(sorted[1])) {
          this.state.winnerId = sorted[0].uid;
        } else if (avg(sorted[1]) < avg(sorted[0])) {
          this.state.winnerId = sorted[1].uid;
        }
        this.state.winReason = "best_average_time";
      }
    }

    this.broadcast("game_over", {
      winnerId: this.state.winnerId,
      winReason: this.state.winReason,
      results: players.map((p: ReactionPlayer) => ({
        uid: p.uid,
        displayName: p.displayName,
        roundsWon: p.roundsWon,
        bestReactionMs: p.bestReactionMs,
        averageMs:
          p.roundsTapped > 0
            ? Math.round(p.totalReactionMs / p.roundsTapped)
            : 0,
      })),
    });
  }

  private resetForRematch() {
    this.state.players.forEach((p: ReactionPlayer) => {
      p.ready = false;
      p.roundsWon = 0;
      p.reactionTimeMs = 0;
      p.tappedThisRound = false;
      p.tooEarly = false;
      p.bestReactionMs = 9999;
      p.totalReactionMs = 0;
      p.roundsTapped = 0;
    });
    this.state.phase = "waiting";
    this.state.currentRound = 0;
    this.state.winnerId = "";
    this.state.winReason = "";
    this.state.roundPhase = "waiting";
    this.unlock();
  }
}

