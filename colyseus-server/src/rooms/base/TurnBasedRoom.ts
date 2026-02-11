import { createServerLogger } from "../../utils/logger";
const log = createServerLogger("TurnBasedRoom");

/**
 * TurnBasedRoom â€” Abstract base for all Tier 2 turn-based games
 *
 * Pattern: Two players alternate turns. The server validates every move,
 * applies it to the authoritative state, checks win conditions, and
 * syncs the result to both clients via Colyseus state patches.
 *
 * Lifecycle:
 * 1. Both players join â†’ "waiting"
 * 2. Both send "ready" â†’ "countdown" (3 seconds)
 * 3. Countdown expires â†’ "playing" (player 0 goes first)
 * 4. Players alternate sending "move" messages
 * 5. Server validates â†’ applies â†’ checks win â†’ advances turn
 * 6. On win/draw/resign â†’ "finished"
 * 7. On dispose: if finished â†’ persistGameResult(); if abandoned â†’ saveGameState()
 *
 * Firestore Persistence:
 * - When both players leave a game in progress, the full board state is
 *   serialized to Firestore's ColyseusGameState collection.
 * - When either player returns, a new room loads the saved state.
 *
 * Subclasses must implement:
 *   - gameTypeKey (string)
 *   - defaultBoardWidth / defaultBoardHeight (numbers)
 *   - initializeBoard(options) â€” set up the initial board
 *   - validateMove(sessionId, move) â€” return true if move is legal
 *   - applyMove(sessionId, move) â€” mutate state to apply the move
 *   - checkWinCondition() â€” return winner info or null
 *   - serializeExtraState() â€” game-specific persistence fields
 *   - restoreExtraState(saved) â€” restore game-specific fields
 *
 * Used by: TicTacToe, ConnectFour, Gomoku, Hex, Reversi (Phase 2)
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md Â§7.2
 */

import { Client, Room } from "colyseus";
import { Player } from "../../schemas/common";
import { SpectatorEntry } from "../../schemas/spectator";
import {
  MoveRecord,
  TurnBasedPlayer,
  TurnBasedState,
} from "../../schemas/turnbased";
import { verifyFirebaseToken } from "../../services/firebase";
import {
  loadGameState,
  persistGameResult,
  saveGameState,
} from "../../services/persistence";

// =============================================================================
// Move Payload â€” what clients send with "move" messages
// =============================================================================

export interface MovePayload {
  /** Row index (0-based) */
  row: number;
  /** Column index (0-based) */
  col: number;
  /** Optional target row (for chess-style movement) */
  toRow?: number;
  /** Optional target col (for chess-style movement) */
  toCol?: number;
  /** Optional additional data (promotion piece, etc.) */
  extra?: any;
}

// =============================================================================
// Win Result â€” returned by checkWinCondition()
// =============================================================================

export interface WinResult {
  /** Firebase UID of the winner, or "" for draw */
  winnerId: string;
  /** Session ID of the winner, or "" for draw */
  winnerSessionId: string;
  /** Reason: "line", "territory", "resignation", "draw_board_full", etc. */
  reason: string;
}

// =============================================================================
// Abstract Base
// =============================================================================

export abstract class TurnBasedRoom extends Room<{ state: TurnBasedState }> {
  maxClients = 12;
  patchRate = 100; // 10fps sync (turns don't need fast updates)
  autoDispose = true;

  /** Game type key â€” must match client-side GAME_REGISTRY */
  protected abstract readonly gameTypeKey: string;

  /** Default board width */
  protected abstract readonly defaultBoardWidth: number;

  /** Default board height */
  protected abstract readonly defaultBoardHeight: number;

  /** Track Firebase UIDs mapped by session ID */
  protected playerUids = new Map<string, string>();

  /** Whether all players have left mid-game (triggers cold storage) */
  private allPlayersLeft = false;

  /** Track which sessions are spectators */
  private spectatorSessionIds = new Set<string>();

  /** Game start timestamp for duration tracking */
  private gameStartTime = 0;

  /** Countdown timer handle (Colyseus clock-managed) */
  private countdownInterval: { clear: () => void } | null = null;

  /** Whether this room was restored from a saved game (enables async play) */
  private isRestoredGame = false;

  /** Saved player data from Firestore (UID â†’ serialized player) for re-mapping */
  private savedPlayers = new Map<string, any>();

  /** UID of the player whose turn it is (persists across sessions) */
  private currentTurnUid: string = "";

  // =========================================================================
  // Abstract Methods â€” Subclasses MUST implement
  // =========================================================================

  /**
   * Set up the initial board state.
   * Called during onCreate for fresh games.
   */
  protected abstract initializeBoard(options: Record<string, any>): void;

  /**
   * Validate whether a move is legal.
   * @returns true if the move is valid
   */
  protected abstract validateMove(
    sessionId: string,
    move: MovePayload,
  ): boolean;

  /**
   * Apply a validated move to the game state.
   * Must mutate this.state (board, scores, etc.).
   * Should also record the move in moveHistory.
   */
  protected abstract applyMove(sessionId: string, move: MovePayload): void;

  /**
   * Check if the game has ended (win, draw, etc.).
   * @returns WinResult if game is over, null if game continues
   */
  protected abstract checkWinCondition(): WinResult | null;

  /**
   * Serialize game-specific extra state for Firestore persistence.
   * Return an object with any fields beyond the base board/players.
   */
  protected serializeExtraState(): Record<string, any> {
    return {};
  }

  /**
   * Restore game-specific extra state from Firestore.
   */
  protected restoreExtraState(_saved: Record<string, any>): void {
    // Default: no-op. Override in subclasses with extra state.
  }

  /**
   * Check if a session belongs to a spectator.
   */
  protected isSpectator(sessionId: string): boolean {
    return this.spectatorSessionIds.has(sessionId);
  }

  // =========================================================================
  // Lifecycle â€” onAuth
  // =========================================================================

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

  // =========================================================================
  // Lifecycle â€” onCreate
  // =========================================================================

  async onCreate(options: Record<string, any>): Promise<void> {
    this.setState(new TurnBasedState());
    this.state.gameType = this.gameTypeKey;
    this.state.gameId = this.roomId;
    this.state.maxPlayers = this.maxClients;

    // Always track the firestoreGameId for persistence
    if (options.firestoreGameId) {
      this.state.firestoreGameId = options.firestoreGameId;
    }

    // Check if restoring from Firestore
    if (options.firestoreGameId) {
      const savedState = await loadGameState(options.firestoreGameId);
      if (savedState) {
        this.isRestoredGame = true;
        this.restoreFromSaved(savedState);
        log.info(
          `[${this.gameTypeKey}] Restored game from Firestore: ${options.firestoreGameId}`,
        );
        return;
      }
    }

    // Fresh game
    this.state.phase = "waiting";
    this.state.initBoard(this.defaultBoardWidth, this.defaultBoardHeight);
    this.initializeBoard(options);

    log.info(
      `[${this.gameTypeKey}] Room created: ${this.roomId} (${this.defaultBoardWidth}x${this.defaultBoardHeight})`,
    );
  }

  // =========================================================================
  // Messages
  // =========================================================================

  messages: Record<string, (client: Client, payload?: any) => void> = {
    /**
     * Player signals ready to start.
     * No-op if the game is already in playing phase (restored async game).
     */
    ready: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      // Ignore ready signals during an active game (async restored games)
      if (this.state.phase === "playing" || this.state.phase === "finished") {
        return;
      }
      const player = this.state.tbPlayers.get(client.sessionId);
      if (player) {
        player.ready = true;
        log.info(
          `[${this.gameTypeKey}] Player ready: ${player.displayName}`,
        );
        this.checkAllReady();
      }
    },

    /**
     * Player makes a move.
     */
    move: (client: Client, payload: MovePayload) => {
      if (this.isSpectator(client.sessionId)) return;
      // Must be playing phase
      if (this.state.phase !== "playing") {
        client.send("error", { message: "Game is not in progress" });
        return;
      }

      // Must be their turn
      if (this.state.currentTurnPlayerId !== client.sessionId) {
        client.send("error", { message: "Not your turn" });
        return;
      }

      // Validate move
      if (!this.validateMove(client.sessionId, payload)) {
        client.send("error", { message: "Invalid move" });
        return;
      }

      // Apply move
      this.applyMove(client.sessionId, payload);
      this.state.turnNumber++;

      // Check win condition
      const result = this.checkWinCondition();
      if (result) {
        this.state.winnerId = result.winnerId;
        this.state.winReason = result.reason;
        this.state.phase = "finished";
        log.info(
          `[${this.gameTypeKey}] Game over: ${result.reason} â€” winner: ${result.winnerId || "draw"}`,
        );
        return;
      }

      // Advance turn
      this.advanceTurn();
    },

    /**
     * Player resigns.
     */
    resign: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.state.phase !== "playing") return;

      const opponent = this.getOpponent(client.sessionId);
      if (opponent) {
        this.state.winnerId =
          this.playerUids.get(opponent.sessionId) || opponent.uid;
        this.state.winReason = "resignation";
        this.state.phase = "finished";
        log.info(
          `[${this.gameTypeKey}] Player resigned: ${client.sessionId}`,
        );
      }
    },

    /**
     * Player offers a draw.
     */
    offer_draw: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.state.phase !== "playing") return;
      this.state.drawOfferedBy = client.sessionId;
      this.state.drawPending = true;
    },

    /**
     * Opponent accepts the draw offer.
     */
    accept_draw: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      if (
        this.state.drawPending &&
        this.state.drawOfferedBy !== client.sessionId
      ) {
        this.state.winnerId = "";
        this.state.winReason = "draw_agreed";
        this.state.phase = "finished";
        log.info(`[${this.gameTypeKey}] Draw agreed`);
      }
    },

    /**
     * Opponent declines the draw offer.
     */
    decline_draw: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      if (
        this.state.drawPending &&
        this.state.drawOfferedBy !== client.sessionId
      ) {
        this.state.drawPending = false;
        this.state.drawOfferedBy = "";
      }
    },

    /**
     * Rematch request.
     */
    rematch: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.state.phase !== "finished") return;
      this.broadcast("rematch_request", { from: client.sessionId });
    },

    /**
     * Rematch accepted â€” reset the game.
     */
    rematch_accept: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.state.phase !== "finished") return;
      this.resetForRematch();
    },
  };

  // =========================================================================
  // Lifecycle â€” onJoin
  // =========================================================================

  onJoin(client: Client, options: Record<string, any>, auth: any): void {
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

    this.playerUids.set(client.sessionId, auth.uid);

    // â”€â”€â”€ Restored game: re-map player by UID to their existing slot â”€â”€â”€â”€â”€â”€
    if (this.isRestoredGame && this.state.phase === "playing") {
      // Check if this player's UID already has a slot (returning player)
      let existingKey: string | null = null;
      this.state.tbPlayers.forEach((p: TurnBasedPlayer, key: string) => {
        if (p.uid === auth.uid) existingKey = key;
      });

      if (existingKey) {
        // Re-map: delete old session key, re-add under new session ID
        const existing = this.state.tbPlayers.get(existingKey)!;
        this.state.tbPlayers.delete(existingKey);
        this.state.players.delete(existingKey);

        existing.sessionId = client.sessionId;
        existing.connected = true;
        existing.displayName = auth.displayName || existing.displayName;
        existing.avatarUrl = auth.avatarUrl || existing.avatarUrl;

        this.state.tbPlayers.set(client.sessionId, existing);

        const basePlayer = new Player();
        basePlayer.uid = auth.uid;
        basePlayer.sessionId = client.sessionId;
        basePlayer.displayName = existing.displayName;
        basePlayer.avatarUrl = existing.avatarUrl;
        basePlayer.playerIndex = existing.playerIndex;
        basePlayer.connected = true;
        this.state.players.set(client.sessionId, basePlayer);

        // Update currentTurnPlayerId if this player's turn
        if (this.currentTurnUid === auth.uid) {
          this.state.currentTurnPlayerId = client.sessionId;
        }

        log.info(
          `[${this.gameTypeKey}] Player rejoined restored game: ${existing.displayName} (index=${existing.playerIndex})`,
        );
        return;
      }

      // Check if there's saved player data for this UID (from Firestore)
      const saved = this.savedPlayers.get(auth.uid);
      if (saved) {
        const player = new TurnBasedPlayer();
        player.uid = auth.uid;
        player.sessionId = client.sessionId;
        player.displayName = auth.displayName || saved.displayName || "Player";
        player.avatarUrl = auth.avatarUrl || saved.avatarUrl || "";
        player.playerIndex = saved.playerIndex ?? this.state.tbPlayers.size;
        player.connected = true;
        player.piece = player.playerIndex === 0 ? "1" : "2";
        player.score = saved.score ?? 0;
        player.capturedPieces = saved.capturedPieces ?? 0;

        this.state.tbPlayers.set(client.sessionId, player);
        const basePlayer = new Player();
        basePlayer.uid = auth.uid;
        basePlayer.sessionId = client.sessionId;
        basePlayer.displayName = player.displayName;
        basePlayer.avatarUrl = player.avatarUrl;
        basePlayer.playerIndex = player.playerIndex;
        basePlayer.connected = true;
        this.state.players.set(client.sessionId, basePlayer);

        // Update currentTurnPlayerId if this player's turn
        if (this.currentTurnUid === auth.uid) {
          this.state.currentTurnPlayerId = client.sessionId;
        }

        log.info(
          `[${this.gameTypeKey}] Player joined restored game from saved data: ${player.displayName} (index=${player.playerIndex})`,
        );
        return;
      }

      // Brand new player joining a restored game (shouldn't normally happen)
    }

    // â”€â”€â”€ Fresh game: create a new player slot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const player = new TurnBasedPlayer();
    player.uid = auth.uid;
    player.sessionId = client.sessionId;
    player.displayName = auth.displayName || "Player";
    player.avatarUrl = auth.avatarUrl || "";
    player.playerIndex = this.state.tbPlayers.size;
    player.connected = true;

    // Assign piece identifiers (subclasses can override via initializeBoard)
    player.piece = player.playerIndex === 0 ? "1" : "2";

    this.state.tbPlayers.set(client.sessionId, player);
    // Also set in base players map for persistence compatibility
    const basePlayer = new Player();
    basePlayer.uid = auth.uid;
    basePlayer.sessionId = client.sessionId;
    basePlayer.displayName = auth.displayName || "Player";
    basePlayer.avatarUrl = auth.avatarUrl || "";
    basePlayer.playerIndex = player.playerIndex;
    basePlayer.connected = true;
    this.state.players.set(client.sessionId, basePlayer);

    log.info(
      `[${this.gameTypeKey}] Player joined: ${player.displayName} (index=${player.playerIndex})`,
    );

    if (this.state.tbPlayers.size >= 2) {
      this.lock();

      // Auto-ready all players and start when the room is full.
      // Turn-based games don't have a pre-game lobby â€” start immediately.
      // (Individual "ready" messages also work as a fallback.)
      this.state.tbPlayers.forEach((p: TurnBasedPlayer) => {
        p.ready = true;
      });
      this.checkAllReady();
    }
  }

  // =========================================================================
  // Lifecycle â€” onLeave
  // =========================================================================

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

    const player = this.state.tbPlayers.get(client.sessionId);
    const basePlayer = this.state.players.get(client.sessionId);
    if (player) player.connected = false;
    if (basePlayer) basePlayer.connected = false;

    // Code 4000+ = consented leave; lower codes = unexpected disconnect
    const consented = code !== undefined && code >= 4000;

    if (this.state.phase === "playing" && !consented) {
      // Brief reconnection window for accidental disconnects (30s)
      try {
        await this.allowReconnection(client, 30);
        // Reconnected!
        if (player) player.connected = true;
        if (basePlayer) basePlayer.connected = true;
        log.info(
          `[${this.gameTypeKey}] Player reconnected: ${client.sessionId}`,
        );
        return;
      } catch {
        // Reconnection timed out â€” player is gone
        log.info(
          `[${this.gameTypeKey}] Reconnection timeout: ${client.sessionId}`,
        );
      }
    }

    // Track current turn UID for persistence (so the correct player
    // resumes their turn after an async rejoin)
    if (this.state.currentTurnPlayerId) {
      const turnPlayer = this.state.tbPlayers.get(
        this.state.currentTurnPlayerId,
      );
      if (turnPlayer) {
        this.currentTurnUid = turnPlayer.uid;
      }
    }

    // Check if ALL players have now left
    let anyConnected = false;
    this.state.tbPlayers.forEach((p: TurnBasedPlayer) => {
      if (p.connected) anyConnected = true;
    });

    if (!anyConnected && this.state.phase === "playing") {
      this.allPlayersLeft = true;
      // Don't delete players â€” needed for restoration
    }
  }

  // =========================================================================
  // Lifecycle â€” onDispose
  // =========================================================================

  async onDispose(): Promise<void> {
    // Clear countdown interval if any (clock-managed, but be safe)
    if (this.countdownInterval) {
      this.countdownInterval.clear();
      this.countdownInterval = null;
    }

    const gameDurationMs = this.gameStartTime
      ? Date.now() - this.gameStartTime
      : undefined;

    if (this.state.phase === "finished") {
      // Game completed â€” persist final result
      await persistGameResult(this.state, gameDurationMs);
      log.info(
        `[${this.gameTypeKey}] Game completed and persisted: ${this.roomId}`,
      );
    } else if (this.state.phase === "playing") {
      // Game in progress â€” always save to Firestore for async restoration.
      // Track the current turn player's UID so we can re-map when they rejoin.
      let turnUid = this.currentTurnUid;
      if (!turnUid && this.state.currentTurnPlayerId) {
        const turnPlayer = this.state.tbPlayers.get(
          this.state.currentTurnPlayerId,
        );
        if (turnPlayer) turnUid = turnPlayer.uid;
      }

      // Serialize all player data by UID for re-mapping on rejoin
      const playersByUid: Record<string, any> = {};
      this.state.tbPlayers.forEach((p: TurnBasedPlayer) => {
        playersByUid[p.uid] = {
          uid: p.uid,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          playerIndex: p.playerIndex,
          piece: p.piece,
          score: p.score,
          capturedPieces: p.capturedPieces,
          timeRemainingMs: p.timeRemainingMs,
        };
      });

      const extraFields = {
        ...this.serializeExtraState(),
        board: this.state.serializeBoard(),
        boardWidth: this.state.boardWidth,
        boardHeight: this.state.boardHeight,
        currentTurnUid: turnUid,
        playersByUid,
        moveHistory: Array.from(this.state.moveHistory).map(
          (m: MoveRecord) => ({
            playerId: m.playerId,
            x: m.x,
            y: m.y,
            toX: m.toX,
            toY: m.toY,
            notation: m.notation,
            timestamp: m.timestamp,
            playerIndex: m.playerIndex,
          }),
        ),
      };

      await saveGameState(this.state, this.roomId, extraFields);
      log.info(
        `[${this.gameTypeKey}] Game suspended and saved: ${this.roomId}`,
      );
    } else {
      log.info(
        `[${this.gameTypeKey}] Room disposed (phase: ${this.state.phase}): ${this.roomId}`,
      );
    }
  }

  // =========================================================================
  // Helpers â€” Turn Management
  // =========================================================================

  /**
   * Check if all players are ready and start countdown.
   */
  private checkAllReady(): void {
    let allReady = true;
    let count = 0;
    this.state.tbPlayers.forEach((p: TurnBasedPlayer) => {
      if (!p.ready) allReady = false;
      count++;
    });

    if (allReady && count >= 2) {
      this.startCountdown();
    }
  }

  /**
   * Start the 3-2-1 countdown before gameplay begins.
   */
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

  /**
   * Transition to playing phase. Player 0 goes first.
   */
  private startGame(): void {
    this.state.phase = "playing";
    this.gameStartTime = Date.now();

    // First player (index 0) goes first
    const players = Array.from(
      this.state.tbPlayers.values(),
    ) as TurnBasedPlayer[];
    if (players.length > 0) {
      const firstPlayer =
        players.find((p) => p.playerIndex === 0) || players[0];
      this.state.currentTurnPlayerId = firstPlayer.sessionId;
      this.currentTurnUid = firstPlayer.uid;
    }

    log.info(`[${this.gameTypeKey}] Game started: ${this.roomId}`);
  }

  /**
   * Advance to the next player's turn.
   */
  protected advanceTurn(): void {
    const players = Array.from(
      this.state.tbPlayers.values(),
    ) as TurnBasedPlayer[];
    const currentIndex = players.findIndex(
      (p) => p.sessionId === this.state.currentTurnPlayerId,
    );
    const nextIndex = (currentIndex + 1) % players.length;
    this.state.currentTurnPlayerId = players[nextIndex].sessionId;
    // Track UID for async persistence
    this.currentTurnUid = players[nextIndex].uid;
  }

  /**
   * Get the opponent of the given session ID.
   */
  protected getOpponent(sessionId: string): TurnBasedPlayer | undefined {
    let opponent: TurnBasedPlayer | undefined;
    this.state.tbPlayers.forEach((p: TurnBasedPlayer) => {
      if (p.sessionId !== sessionId) opponent = p;
    });
    return opponent;
  }

  /**
   * Get the player for the given session ID.
   */
  protected getPlayer(sessionId: string): TurnBasedPlayer | undefined {
    return this.state.tbPlayers.get(sessionId) as TurnBasedPlayer | undefined;
  }

  /**
   * Get player index (0 or 1) for a session ID.
   */
  protected getPlayerIndex(sessionId: string): number {
    const player = this.state.tbPlayers.get(sessionId) as
      | TurnBasedPlayer
      | undefined;
    return player?.playerIndex ?? -1;
  }

  /**
   * Record a move in the history.
   */
  protected recordMove(
    sessionId: string,
    row: number,
    col: number,
    notation: string = "",
  ): void {
    const move = new MoveRecord();
    move.playerId = sessionId;
    move.x = col;
    move.y = row;
    move.notation = notation;
    move.timestamp = Date.now();
    move.playerIndex = this.getPlayerIndex(sessionId);
    this.state.moveHistory.push(move);
    this.state.lastMoveNotation = notation;
  }

  // =========================================================================
  // Helpers â€” Persistence
  // =========================================================================

  /**
   * Restore full game state from a Firestore snapshot.
   */
  private restoreFromSaved(saved: Record<string, any>): void {
    // Restore board
    const width = saved.boardWidth || this.defaultBoardWidth;
    const height = saved.boardHeight || this.defaultBoardHeight;
    this.state.initBoard(width, height);

    if (saved.board) {
      this.state.restoreBoard(saved.board);
    }

    // Restore basic state
    this.state.phase = "playing"; // Resume immediately
    this.state.turnNumber = saved.turnNumber || 0;
    this.state.isRated = saved.isRated ?? true;
    this.state.gameType = saved.gameType || this.gameTypeKey;

    // Restore current turn UID (persisted so we can re-map to new session IDs)
    this.currentTurnUid = saved.currentTurnUid || "";
    // The currentTurnPlayerId (session-based) will be set when the player
    // with this UID joins â€” see onJoin's restored game branch.
    this.state.currentTurnPlayerId = "";

    // Restore player data by UID for re-mapping when players rejoin.
    // Also pre-populate tbPlayers so advanceTurn, getOpponent, and client
    // state sync all work correctly even when only one player is present.
    const playerEntries: Array<{ uid: string; data: any }> = [];
    if (saved.playersByUid) {
      for (const [uid, pData] of Object.entries(saved.playersByUid)) {
        this.savedPlayers.set(uid, pData);
        playerEntries.push({ uid, data: pData });
      }
    } else if (saved.players) {
      // Legacy fallback: saved.players is keyed by old session ID
      for (const [, pData] of Object.entries(saved.players) as [
        string,
        any,
      ][]) {
        if (pData.uid) {
          this.savedPlayers.set(pData.uid, pData);
          playerEntries.push({ uid: pData.uid, data: pData });
        }
      }
    }

    // Pre-populate all players in tbPlayers with placeholder session IDs.
    // When a real player joins, onJoin() re-maps the placeholder to their
    // actual sessionId. This ensures advanceTurn(), getOpponent(), and
    // the client UI all function correctly with fewer than 2 live players.
    for (const entry of playerEntries) {
      const pData = entry.data;
      const placeholderSessionId = `__saved_${entry.uid}`;

      const player = new TurnBasedPlayer();
      player.uid = entry.uid;
      player.sessionId = placeholderSessionId;
      player.displayName = pData.displayName || "Player";
      player.avatarUrl = pData.avatarUrl || "";
      player.playerIndex = pData.playerIndex ?? this.state.tbPlayers.size;
      player.connected = false; // Not connected until they actually join
      player.piece = player.playerIndex === 0 ? "1" : "2";
      player.score = pData.score ?? 0;
      player.capturedPieces = pData.capturedPieces ?? 0;
      player.timeRemainingMs = pData.timeRemainingMs ?? 0;

      this.state.tbPlayers.set(placeholderSessionId, player);

      const basePlayer = new Player();
      basePlayer.uid = entry.uid;
      basePlayer.sessionId = placeholderSessionId;
      basePlayer.displayName = player.displayName;
      basePlayer.avatarUrl = player.avatarUrl;
      basePlayer.playerIndex = player.playerIndex;
      basePlayer.connected = false;
      this.state.players.set(placeholderSessionId, basePlayer);

      // If this is the current turn player, set the placeholder session ID
      if (this.currentTurnUid === entry.uid) {
        this.state.currentTurnPlayerId = placeholderSessionId;
      }
    }

    // Restore move history
    if (saved.moveHistory) {
      for (const m of saved.moveHistory) {
        const move = new MoveRecord();
        move.playerId = m.playerId;
        move.x = m.x;
        move.y = m.y;
        move.toX = m.toX || 0;
        move.toY = m.toY || 0;
        move.notation = m.notation || "";
        move.timestamp = m.timestamp || 0;
        move.playerIndex = m.playerIndex || 0;
        this.state.moveHistory.push(move);
      }
    }

    // Let subclass restore game-specific state
    this.restoreExtraState(saved);

    this.gameStartTime = Date.now();
    log.info(
      `[${this.gameTypeKey}] State restored: turn ${this.state.turnNumber}, ${this.state.moveHistory.length} moves, currentTurnUid=${this.currentTurnUid}`,
    );
  }

  /**
   * Reset the game for a rematch (swap who goes first).
   */
  private resetForRematch(): void {
    this.state.initBoard(this.defaultBoardWidth, this.defaultBoardHeight);
    this.state.moveHistory.clear();
    this.state.winnerId = "";
    this.state.winReason = "";
    this.state.lastMoveNotation = "";
    this.state.drawPending = false;
    this.state.drawOfferedBy = "";
    this.state.turnNumber = 0;

    // Swap player indices for fairness
    this.state.tbPlayers.forEach((p: TurnBasedPlayer) => {
      p.ready = false;
      p.score = 0;
      p.capturedPieces = 0;
      p.offeredDraw = false;
      p.playerIndex = p.playerIndex === 0 ? 1 : 0;
      p.piece = p.playerIndex === 0 ? "1" : "2";
    });
    this.state.players.forEach((p: Player) => {
      p.ready = false;
      p.score = 0;
    });

    // Re-initialize board (subclass handles game-specific setup)
    this.initializeBoard({});
    this.state.phase = "waiting";

    log.info(`[${this.gameTypeKey}] Rematch started: ${this.roomId}`);
  }
}


