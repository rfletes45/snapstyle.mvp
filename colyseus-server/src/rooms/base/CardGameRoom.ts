import { createServerLogger } from "../../utils/logger";
const log = createServerLogger("CardGameRoom");

/**
 * CardGameRoom â€” Abstract base for card games with hidden information
 *
 * Card games differ from grid games because player hands are PRIVATE.
 * Colyseus state sync broadcasts to ALL clients, so hands are stored
 * server-side and sent via targeted messages to individual players.
 *
 * Shared state (synced to all): top card, hand sizes, current suit, deck size
 * Private state (per-client messages): actual hand cards
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md Â§6.4
 */

import { Client, Room } from "colyseus";
import { CardGameState, CardPlayer, ServerCard } from "../../schemas/cards";
import { SpectatorEntry } from "../../schemas/spectator";
import { verifyFirebaseToken } from "../../services/firebase";
import {
  loadGameState,
  persistGameResult,
  saveGameState,
} from "../../services/persistence";

// =============================================================================
// Abstract Base
// =============================================================================

export abstract class CardGameRoom extends Room<{ state: CardGameState }> {
  maxClients = 12;
  patchRate = 100; // 10fps
  autoDispose = true;

  protected abstract readonly gameTypeKey: string;

  /** Server-side hands â€” NOT synced via state */
  protected hands = new Map<string, ServerCard[]>();

  /** Server-side deck */
  protected deck: ServerCard[] = [];

  /** Server-side discard pile (full history) */
  protected discardPile: ServerCard[] = [];

  /** Map session â†’ uid */
  protected playerUids = new Map<string, string>();

  /** Player order for turn management */
  protected playerOrder: string[] = [];

  private allPlayersLeft = false;
  private gameStartTime = 0;
  private countdownInterval: { clear: () => void } | null = null;

  /** Track spectator session IDs */
  private spectatorSessionIds = new Set<string>();

  /** Check if a session is a spectator */
  protected isSpectator(sessionId: string): boolean {
    return this.spectatorSessionIds.has(sessionId);
  }

  // â”€â”€â”€ Abstract Methods â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /** Set up initial game state (deal cards, etc.) */
  protected abstract initializeGame(options: Record<string, any>): void;

  /** Handle a game-specific message from a client */
  protected abstract handleGameMessage(
    client: Client,
    type: string,
    payload: any,
  ): void;

  /** Serialize private state for persistence */
  protected abstract serializePrivateState(): Record<string, any>;

  /** Restore private state from persistence */
  protected abstract restorePrivateState(saved: Record<string, any>): void;

  // â”€â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async onAuth(
    client: Client,
    options: Record<string, any>,
    context: any,
  ): Promise<any> {
    const decoded = await verifyFirebaseToken(
      context?.token || options?.token || "",
    );
    return {
      uid: decoded.uid,
      displayName: (decoded as { name?: string; email?: string; picture?: string }).name || (decoded as { name?: string; email?: string; picture?: string }).email || "Player",
      avatarUrl: (decoded as { name?: string; email?: string; picture?: string }).picture || "",
    };
  }

  // â”€â”€â”€ onCreate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async onCreate(options: Record<string, any>): Promise<void> {
    this.setState(new CardGameState());
    this.state.gameType = this.gameTypeKey;
    this.state.gameId = this.roomId;
    this.state.maxPlayers = this.maxClients;

    // Restore from Firestore?
    if (options.firestoreGameId) {
      const saved = await loadGameState(options.firestoreGameId);
      if (saved) {
        this.restoreFromSaved(saved);
        this.state.firestoreGameId = options.firestoreGameId;
        return;
      }
    }

    this.state.phase = "waiting";
  }

  // â”€â”€â”€ onJoin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async onJoin(client: Client, options: any, auth: any): Promise<void> {
    // â”€â”€â”€ Spectator join â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (options.spectator === true) {
      const spectator = new SpectatorEntry();
      spectator.uid = auth.uid;
      spectator.sessionId = client.sessionId;
      spectator.displayName = auth.displayName || "Spectator";
      spectator.avatarUrl = auth.avatarUrl || "";
      spectator.joinedAt = Date.now();
      this.state.spectators.set(client.sessionId, spectator);
      this.state.spectatorCount++;
      this.spectatorSessionIds.add(client.sessionId);
      log.info(
        `[${this.gameTypeKey}] Spectator joined: ${auth.displayName} (${this.state.spectatorCount} watching)`,
      );
      return;
    }

    const player = new CardPlayer();
    player.uid = auth.uid;
    player.sessionId = client.sessionId;
    player.displayName = auth.displayName || "Player";
    player.avatarUrl = auth.avatarUrl || "";
    player.connected = true;
    player.playerIndex = this.state.cardPlayers.size;
    player.ready = false;

    this.state.cardPlayers.set(client.sessionId, player);
    this.playerUids.set(client.sessionId, auth.uid);
    this.playerOrder.push(client.sessionId);

    log.info(
      `[${this.gameTypeKey}] Player joined: ${player.displayName} (index ${player.playerIndex})`,
    );

    if (this.state.cardPlayers.size >= 2) {
      this.lock();

      // Auto-ready all players and start when the room is full.
      // (Individual "ready" messages also work as a fallback.)
      this.state.cardPlayers.forEach((p: CardPlayer) => {
        p.ready = true;
      });
      this.checkAllReady();
    }
  }

  // â”€â”€â”€ onLeave â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async onLeave(client: Client, code?: number): Promise<void> {
    // â”€â”€â”€ Spectator leave â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (this.spectatorSessionIds.has(client.sessionId)) {
      this.state.spectators.delete(client.sessionId);
      this.state.spectatorCount = Math.max(0, this.state.spectatorCount - 1);
      this.spectatorSessionIds.delete(client.sessionId);
      log.info(
        `[${this.gameTypeKey}] Spectator left (${this.state.spectatorCount} watching)`,
      );
      return;
    }

    const player = this.state.cardPlayers.get(client.sessionId);
    if (player) {
      player.connected = false;
    }
    const consented = typeof code === "number" && code >= 4000;

    if (this.state.phase === "playing" && !consented) {
      try {
        await this.allowReconnection(client, 300);
        if (player) player.connected = true;
        // Re-send hand
        this.sendHand(client.sessionId);
        return;
      } catch {
        // Reconnection failed
      }
    }

    // Check if all players left
    let anyConnected = false;
    this.state.cardPlayers.forEach((p: CardPlayer) => {
      if (p.connected) anyConnected = true;
    });

    if (!anyConnected && this.state.phase === "playing") {
      this.allPlayersLeft = true;
      // Opponent wins by abandonment
      const opponent = this.findOpponent(client.sessionId);
      if (opponent) {
        this.state.winnerId = opponent.uid;
        this.state.winReason = "opponent_left";
        this.state.phase = "finished";
      }
    }
  }

  // â”€â”€â”€ Messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  messages: Record<string, (client: Client, payload?: any) => void> = {
    ready: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      const player = this.state.cardPlayers.get(client.sessionId);
      if (player) {
        player.ready = true;
        this.checkAllReady();
      }
    },

    game_action: (client: Client, payload: any) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.state.phase !== "playing") {
        client.send("error", { message: "Game is not in progress" });
        return;
      }
      if (this.state.currentTurnPlayerId !== client.sessionId) {
        client.send("error", { message: "Not your turn" });
        return;
      }
      this.handleGameMessage(client, payload?.type || "", payload);
    },

    resign: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.state.phase !== "playing") return;
      const opponent = this.findOpponent(client.sessionId);
      if (opponent) {
        this.state.winnerId = opponent.uid;
        this.state.winReason = "resignation";
        this.state.phase = "finished";
      }
    },

    rematch: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      this.broadcast("rematch_request", {
        fromSessionId: client.sessionId,
      });
    },

    rematch_accept: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      // Reset game
      this.state.phase = "waiting";
      this.state.winnerId = "";
      this.state.winReason = "";
      this.state.turnNumber = 0;
      this.hands.clear();
      this.deck = [];
      this.discardPile = [];
      // Swap player indices
      this.state.cardPlayers.forEach((p: CardPlayer) => {
        p.playerIndex = p.playerIndex === 0 ? 1 : 0;
        p.ready = false;
        p.handSize = 0;
      });
    },
  };

  // â”€â”€â”€ Shared Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  protected checkAllReady(): void {
    if (this.state.cardPlayers.size < 2) return;
    let allReady = true;
    this.state.cardPlayers.forEach((p: CardPlayer) => {
      if (!p.ready) allReady = false;
    });
    if (!allReady) return;
    this.startCountdown();
  }

  private startCountdown(): void {
    this.state.phase = "countdown";
    this.state.countdown = 3;

    const interval = this.clock.setInterval(() => {
      this.state.countdown--;
      if (this.state.countdown <= 0) {
        interval.clear();
        this.countdownInterval = null;
        this.startGame();
      }
    }, 1000);
    this.countdownInterval = interval;
  }

  protected startGame(): void {
    this.state.phase = "playing";
    this.gameStartTime = Date.now();

    // Initialize game-specific state
    this.initializeGame({});

    // Set first turn
    if (this.playerOrder.length > 0) {
      this.state.currentTurnPlayerId = this.playerOrder[0];
    }

    // Send hands to all players
    this.playerOrder.forEach((sessionId) => {
      this.sendHand(sessionId);
    });
  }

  /** Send a player their current hand (private data) */
  protected sendHand(sessionId: string): void {
    const hand = this.hands.get(sessionId);
    if (!hand) return;

    const clients = this.clients;
    for (const c of clients) {
      if (c.sessionId === sessionId) {
        c.send("hand", { cards: hand });
        break;
      }
    }
  }

  /** Send hand to all players */
  protected broadcastHands(): void {
    this.playerOrder.forEach((sid) => this.sendHand(sid));
  }

  /** Advance to next player's turn */
  protected advanceTurn(): void {
    const currentIdx = this.playerOrder.indexOf(this.state.currentTurnPlayerId);
    const nextIdx = (currentIdx + 1) % this.playerOrder.length;
    this.state.currentTurnPlayerId = this.playerOrder[nextIdx];
    this.state.turnNumber++;

    // Reset per-turn flags
    const nextPlayer = this.state.cardPlayers.get(this.playerOrder[nextIdx]);
    if (nextPlayer) {
      nextPlayer.hasDrawnThisTurn = false;
      nextPlayer.hasPassed = false;
    }
  }

  /** Update the synced top card */
  protected syncTopCard(card: ServerCard): void {
    this.state.topCard.suit = card.suit;
    this.state.topCard.rank = card.rank;
    this.state.topCard.faceUp = true;
  }

  /** Find opponent player */
  protected findOpponent(sessionId: string): CardPlayer | null {
    let opponent: CardPlayer | null = null;
    this.state.cardPlayers.forEach((p: CardPlayer) => {
      if (p.sessionId !== sessionId) opponent = p;
    });
    return opponent;
  }

  /** Update hand sizes in synced state */
  protected syncHandSizes(): void {
    this.state.cardPlayers.forEach((p: CardPlayer) => {
      const hand = this.hands.get(p.sessionId);
      p.handSize = hand ? hand.length : 0;
    });
  }

  // â”€â”€â”€ Persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private restoreFromSaved(saved: any): void {
    this.state.phase = saved.phase || "playing";
    this.state.turnNumber = saved.turnNumber || 0;
    this.state.currentTurnPlayerId = saved.currentTurnPlayerId || "";
    if (saved.private) {
      this.restorePrivateState(saved.private);
    }
  }

  async onDispose(): Promise<void> {
    if (this.countdownInterval) {
      this.countdownInterval.clear();
      this.countdownInterval = null;
    }

    const gameDurationMs = this.gameStartTime
      ? Date.now() - this.gameStartTime
      : undefined;

    if (this.state.phase === "finished") {
      try {
        await persistGameResult(this.state, gameDurationMs);
      } catch (e) {
        log.error(`[${this.gameTypeKey}] Failed to persist result:`, e);
      }
    } else if (this.allPlayersLeft && this.state.phase === "playing") {
      try {
        await saveGameState(this.state, this.roomId, {
          private: this.serializePrivateState(),
        });
      } catch (e) {
        log.error(`[${this.gameTypeKey}] Failed to save state:`, e);
      }
    }
  }
}


