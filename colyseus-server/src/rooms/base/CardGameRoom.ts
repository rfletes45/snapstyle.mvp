import type { ServerLogger } from "../../utils/logger";
import { createServerLogger } from "../../utils/logger";
const log = createServerLogger("CardGameRoom");

/**
 * CardGameRoom — Abstract base for card games with hidden information
 *
 * Card games differ from grid games because player hands are PRIVATE.
 * Colyseus state sync broadcasts to ALL clients, so hands are stored
 * server-side and sent via targeted messages to individual players.
 *
 * Shared state (synced to all): top card, hand sizes, current suit, deck size
 * Private state (per-client messages): actual hand cards
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md §6.4
 */

import { Client, Room } from "colyseus";
import { CardGameState, CardPlayer, ServerCard } from "../../schemas/cards";
import { SpectatorEntry } from "../../schemas/spectator";
import { verifyFirebaseToken } from "../../services/firebase";
import {
  deleteGameAndInvite,
  loadGameState,
  persistGameResult,
  saveGameState,
} from "../../services/persistence";
import { checkProtocolVersion } from "../../utils/protocol";

// =============================================================================
// Abstract Base
// =============================================================================

export abstract class CardGameRoom extends Room<{ state: CardGameState }> {
  maxClients = 12;
  patchRate = 100; // 10fps
  autoDispose = true;

  protected abstract readonly gameTypeKey: string;

  /** Server-side hands — NOT synced via state */
  protected hands = new Map<string, ServerCard[]>();

  /** Server-side deck */
  protected deck: ServerCard[] = [];

  /** Server-side discard pile (full history) */
  protected discardPile: ServerCard[] = [];

  /** Map session → uid */
  protected playerUids = new Map<string, string>();

  /** Player order for turn management */
  protected playerOrder: string[] = [];

  private allPlayersLeft = false;
  private gameStartTime = 0;
  private countdownInterval: { clear: () => void } | null = null;

  /** Track spectator session IDs */
  private spectatorSessionIds = new Set<string>();

  /** Scoped logger with room-level context */
  protected roomLog: ServerLogger = log;

  /** Bot session IDs (virtual players — no real Colyseus client) */
  protected botSessionIds = new Set<string>();

  /** Whether this room is in practice/solo mode */
  protected practiceMode = false;

  /** Check if a session is a spectator */
  protected isSpectator(sessionId: string): boolean {
    return this.spectatorSessionIds.has(sessionId);
  }

  // ─── Abstract Methods ───────────────────────────────────────────────

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

  // ─── Auth ───────────────────────────────────────────────────────────

  async onAuth(
    client: Client,
    options: Record<string, any>,
    context: any,
  ): Promise<any> {
    // -- Protocol version gate ---------------------------------------------
    const proto = checkProtocolVersion(options);
    if (!proto.ok) {
      log.warn(`Protocol rejected: ${proto.reason}`, {
        sessionId: client.sessionId,
        gameType: this.gameTypeKey,
        traceId: options?.traceId,
      });
      throw new Error(proto.reason);
    }

    const decoded = await verifyFirebaseToken(
      context?.token || options?.token || "",
    );

    log.info("Auth success", {
      uid: decoded.uid,
      sessionId: client.sessionId,
      gameType: this.gameTypeKey,
      firestoreGameId: options?.firestoreGameId,
      traceId: options?.traceId,
      protocolVersion: proto.clientVersion,
      platform: options?.buildInfo?.platform,
    });

    return {
      uid: decoded.uid,
      displayName:
        (decoded as { name?: string; email?: string; picture?: string }).name ||
        (decoded as { name?: string; email?: string; picture?: string })
          .email ||
        "Player",
      avatarUrl:
        (decoded as { name?: string; email?: string; picture?: string })
          .picture || "",
      traceId: options?.traceId,
    };
  }

  // ─── onCreate ───────────────────────────────────────────────────────

  async onCreate(options: Record<string, any>): Promise<void> {
    this.setState(new CardGameState());
    this.state.gameType = this.gameTypeKey;
    this.state.gameId = this.roomId;
    this.state.traceId = options.traceId || "";
    this.state.maxPlayers = this.maxClients;

    this.roomLog = log.child({
      roomId: this.roomId,
      gameType: this.gameTypeKey,
      firestoreGameId: options.firestoreGameId || undefined,
      traceId: options.traceId || undefined,
    });

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

  // ─── onJoin ─────────────────────────────────────────────────────────

  async onJoin(client: Client, options: any, auth: any): Promise<void> {
    // ─── Spectator join ─────────────────────────────────────────────────
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
      this.roomLog.info(
        `Spectator joined: ${auth.displayName} (${this.state.spectatorCount} watching)`,
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

    this.roomLog.info(
      `Player joined: ${player.displayName} (index ${player.playerIndex})`,
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

    // ── Practice mode: add a bot and auto-start ──
    if (options.practice === true && this.state.cardPlayers.size === 1) {
      this.practiceMode = true;
      this.lock();
      this.addBotPlayer("Bot");
      this.state.cardPlayers.forEach((p: CardPlayer) => {
        p.ready = true;
      });
      this.checkAllReady();
    }
  }

  // ─── onLeave ────────────────────────────────────────────────────────

  async onLeave(client: Client, code?: number): Promise<void> {
    // ─── Spectator leave ────────────────────────────────────────────────
    if (this.spectatorSessionIds.has(client.sessionId)) {
      this.state.spectators.delete(client.sessionId);
      this.state.spectatorCount = Math.max(0, this.state.spectatorCount - 1);
      this.spectatorSessionIds.delete(client.sessionId);
      this.roomLog.info(
        `Spectator left (${this.state.spectatorCount} watching)`,
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

  // ─── Messages ───────────────────────────────────────────────────────

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

  // ─── Shared Helpers ─────────────────────────────────────────────────

  protected checkAllReady(): void {
    const totalPlayers = this.state.cardPlayers.size;
    if (totalPlayers < 2) return;
    let allReady = true;
    this.state.cardPlayers.forEach((p: CardPlayer) => {
      if (!p.ready) allReady = false;
    });
    if (!allReady) return;
    this.startCountdown();
  }

  /** Add a bot (AI) player to the room without a real client connection */
  protected addBotPlayer(name: string): string {
    const botSessionId = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const botUid = `bot-${botSessionId}`;

    const player = new CardPlayer();
    player.uid = botUid;
    player.sessionId = botSessionId;
    player.displayName = name;
    player.avatarUrl = "";
    player.connected = true;
    player.playerIndex = this.state.cardPlayers.size;
    player.ready = true;

    this.state.cardPlayers.set(botSessionId, player);
    this.playerUids.set(botSessionId, botUid);
    this.playerOrder.push(botSessionId);
    this.botSessionIds.add(botSessionId);

    this.roomLog.info(`Bot added: ${name} (${botSessionId})`);
    return botSessionId;
  }

  /** Check if a session ID belongs to a bot */
  protected isBot(sessionId: string): boolean {
    return this.botSessionIds.has(sessionId);
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

  // ─── Persistence ────────────────────────────────────────────────────

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
        // Clean up game docs + mark invite as completed
        const firestoreGameId =
          this.state.firestoreGameId || this.state.gameId || this.roomId;
        await deleteGameAndInvite(firestoreGameId);
      } catch (e) {
        this.roomLog.error(`Failed to persist result:`, e);
      }
    } else if (this.allPlayersLeft && this.state.phase === "playing") {
      try {
        await saveGameState(this.state, this.roomId, {
          private: this.serializePrivateState(),
        });
      } catch (e) {
        this.roomLog.error(`Failed to save state:`, e);
      }
    }
  }
}
