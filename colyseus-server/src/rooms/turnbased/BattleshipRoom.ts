/**
 * BattleshipRoom — Colyseus room for the Battleship game
 *
 * A 2-player invite-driven realtime room with turn-based combat.
 *
 * Key design:
 * - Fog-of-war: placements stored server-side, never broadcast via state sync
 * - Private boards sent via targeted `client.send("your_board", …)` messages
 * - Spectators join with `{ spectator: true }`, read-only (no gameplay messages)
 * - Completion persisted to RealtimeGameSessions → triggers backend pipeline
 *
 * Phase machine: WAITING → PLACEMENT → COMBAT → FINISHED
 *
 * @see colyseus-server/src/schemas/battleship.ts
 */

import { Client, Room } from "colyseus";
import {
  BATTLESHIP_GRID_SIZE,
  BattleshipPlayer,
  BattleshipState,
  FLEET,
  type PlayerBoard,
  type ShipDef,
  type ShipPlacement,
  ShotRecord,
  SunkShip,
  SunkShipCell,
} from "../../schemas/battleship";
import type { BaseGameState } from "../../schemas/common";
import { SpectatorEntry } from "../../schemas/spectator";
import { verifyFirebaseToken } from "../../services/firebase";
import {
  deleteGameAndInvite,
  extractInviteIdFromExtGameId,
  markGameVacant,
  persistGameResult,
} from "../../services/persistence";
import type { ServerLogger } from "../../utils/logger";
import { createServerLogger } from "../../utils/logger";
import { checkProtocolVersion } from "../../utils/protocol";

const log = createServerLogger("BattleshipRoom");

// =============================================================================
// Constants
// =============================================================================

const PLACEMENT_TIMEOUT_MS = 90_000; // 90 s for ship placement
const TURN_TIMEOUT_MS = 25_000; // 25 s per turn
const RECONNECT_GRACE_S = 45; // 45 s reconnection window
const TIMER_INTERVAL_MS = 250; // Timer tick frequency

// =============================================================================
// BattleshipRoom
// =============================================================================

export class BattleshipRoom extends Room {
  maxClients = 12; // 2 players + spectators
  patchRate = 100; // 10 fps
  autoDispose = true;

  // ── Server-side state (NEVER synced to clients) ────────────────────────
  /** uid → board (placements + grid + shots received) */
  private boards = new Map<string, PlayerBoard>();
  /** sessionId → uid */
  private sessionToUid = new Map<string, string>();
  /** uid → sessionId */
  private uidToSession = new Map<string, string>();
  /** Spectator session IDs */
  private spectatorSessionIds = new Set<string>();

  /**
   * Firestore game ID — stored locally, NOT on state for persistence.
   * External Colyseus games use `ext_battleship_<inviteId>` which has no
   * TurnBasedGames doc. By clearing it on state before `persistGameResult`,
   * we ensure results write to RealtimeGameSessions instead.
   */
  private firestoreGameId = "";

  /**
   * Invite ID — passed explicitly from client join options as defense-in-depth.
   * Used alongside ext_ parsing in onDispose for reliable invite finalization.
   */
  private inviteId: string | undefined;

  /** Scoped logger */
  private roomLog: ServerLogger = log;
  /** Timestamp when combat began (for duration tracking) */
  private gameStartTime = 0;
  /** Active timer interval reference */
  private timerInterval: { clear: () => void } | null = null;

  // ── Typed state accessor ───────────────────────────────────────────────

  private get s(): BattleshipState {
    return this.state as BattleshipState;
  }

  private isSpectator(sessionId: string): boolean {
    return this.spectatorSessionIds.has(sessionId);
  }

  // =========================================================================
  // Lifecycle — onCreate
  // =========================================================================

  onCreate(options: any): void {
    const state = new BattleshipState();
    this.setState(state);

    state.gameId = this.roomId;
    state.gameType = "battleship";
    state.traceId = options.traceId || "";
    state.phase = "waiting";

    if (options.firestoreGameId) {
      this.firestoreGameId = options.firestoreGameId;
      state.firestoreGameId = options.firestoreGameId;
    }
    if (options.inviteId) {
      this.inviteId = options.inviteId;
    }
    if (options.isRated !== undefined) {
      state.isRated = options.isRated;
    }

    this.roomLog = log.child({
      roomId: this.roomId,
      gameType: "battleship",
      firestoreGameId: this.firestoreGameId || undefined,
      traceId: options.traceId || undefined,
    });

    this.roomLog.info("Room created");
  }

  // =========================================================================
  // Lifecycle — onAuth
  // =========================================================================

  async onAuth(
    client: Client,
    options: Record<string, any>,
    context: any,
  ): Promise<any> {
    const proto = checkProtocolVersion(options);
    if (!proto.ok) {
      this.roomLog.warn(`Protocol rejected: ${proto.reason}`);
      throw new Error(proto.reason);
    }

    const decoded = await verifyFirebaseToken(
      context?.token || options?.token || "",
    );

    return {
      uid: decoded.uid,
      displayName: (decoded as any).name || (decoded as any).email || "Player",
      avatarUrl: (decoded as any).picture || "",
      traceId: options?.traceId,
    };
  }

  // =========================================================================
  // Lifecycle — onJoin
  // =========================================================================

  onJoin(client: Client, options: any, auth: any): void {
    const s = this.s;

    // ── Debug: log every join attempt ────────────────────────────────
    const seatedUids = Array.from(this.uidToSession.keys());
    this.roomLog.info(
      `onJoin attempt: uid=${auth.uid}, sessionId=${client.sessionId}, ` +
        `spectator=${options.spectator ?? false}, ` +
        `phase=${s.phase}, seatedPlayers=[${seatedUids.join(",")}], ` +
        `playerCount=${s.players.size}, spectatorCount=${s.spectatorCount}, ` +
        `firestoreGameId=${options.firestoreGameId ?? this.firestoreGameId}`,
    );

    // ── Spectator join ──────────────────────────────────────────────────
    if (options.spectator === true) {
      // Block a seated player uid from joining as spectator
      if (this.uidToSession.has(auth.uid)) {
        this.roomLog.warn(
          `Rejected spectator join for seated player uid=${auth.uid}`,
        );
        client.error(4003, "Cannot spectate a game you are playing in");
        client.leave(4003);
        return;
      }
      if (s.spectatorCount >= s.maxSpectators) {
        client.error(4001, "Spectator slots full");
        client.leave(4001);
        return;
      }
      const entry = new SpectatorEntry();
      entry.uid = auth.uid;
      entry.sessionId = client.sessionId;
      entry.displayName = auth.displayName || "Spectator";
      entry.avatarUrl = auth.avatarUrl || "";
      entry.joinedAt = Date.now();

      s.spectators.set(client.sessionId, entry);
      s.spectatorCount++;
      this.spectatorSessionIds.add(client.sessionId);
      this.roomLog.info(
        `Spectator joined: ${auth.uid} (${s.spectatorCount} watching)`,
      );
      return;
    }

    // ── Reject if room full ─────────────────────────────────────────────
    if (s.players.size >= 2) {
      this.roomLog.warn(
        `Rejected player join — room full: uid=${auth.uid}, ` +
          `sessionId=${client.sessionId}, seated=[${seatedUids.join(",")}]`,
      );
      client.error(4000, "Room is full — game already has 2 players");
      client.leave(4000);
      return;
    }

    // ── Duplicate uid handling (M2: enforce seat uniqueness) ────────────
    if (this.uidToSession.has(auth.uid)) {
      const existingSessionId = this.uidToSession.get(auth.uid)!;
      const existingPlayer = s.players.get(existingSessionId) as
        | BattleshipPlayer
        | undefined;

      if (existingPlayer && existingPlayer.connected) {
        // Same user is still connected — reject the duplicate
        this.roomLog.warn(
          `Rejected duplicate uid (still connected): uid=${auth.uid}, ` +
            `existingSession=${existingSessionId}, newSession=${client.sessionId}`,
        );
        client.error(4002, "Already seated in this game");
        client.leave(4002);
        return;
      }

      // Old session disconnected — "session takeover": rebind seat to new
      // session.  Remove old session key from the players map, update
      // mappings, then fall through to create a fresh player entry that
      // preserves the original playerIndex.
      this.roomLog.info(
        `Session takeover: uid=${auth.uid}, oldSession=${existingSessionId} → ` +
          `newSession=${client.sessionId}`,
      );

      const preservedIndex = existingPlayer?.playerIndex ?? s.players.size;
      const preservedPlacementReady = existingPlayer?.placementReady ?? false;

      // Tear down old session
      s.players.delete(existingSessionId);
      this.sessionToUid.delete(existingSessionId);
      // uidToSession will be overwritten below

      // Create replacement player entry
      const player = new BattleshipPlayer();
      player.uid = auth.uid;
      player.sessionId = client.sessionId;
      player.displayName = auth.displayName || "Player";
      player.avatarUrl = auth.avatarUrl || "";
      player.playerIndex = preservedIndex;
      player.connected = true;
      player.placementReady = preservedPlacementReady;

      // Restore combat stats from the old player entry if it exists
      if (existingPlayer) {
        player.shipCellsRemaining = existingPlayer.shipCellsRemaining;
        player.shipsRemaining = existingPlayer.shipsRemaining;
        player.shotsFired = existingPlayer.shotsFired;
        player.hits = existingPlayer.hits;
        player.misses = existingPlayer.misses;
      }

      s.players.set(client.sessionId, player);
      this.sessionToUid.set(client.sessionId, auth.uid);
      this.uidToSession.set(auth.uid, client.sessionId);

      if (auth.traceId && !s.traceId) {
        s.traceId = auth.traceId;
      }

      client.send("welcome", {
        sessionId: client.sessionId,
        playerIndex: player.playerIndex,
        gridSize: BATTLESHIP_GRID_SIZE,
        fleet: FLEET,
      });

      // Re-send the player's private board
      this.sendBoardToPlayer(auth.uid);

      this.roomLog.info(
        `Player re-seated (session takeover): ${auth.uid} ` +
          `(index ${player.playerIndex}) [${s.players.size}/2]`,
      );
      return;
    }

    // ── Player join (fresh seat) ────────────────────────────────────────
    const player = new BattleshipPlayer();
    player.uid = auth.uid;
    player.sessionId = client.sessionId;
    player.displayName = auth.displayName || "Player";
    player.avatarUrl = auth.avatarUrl || "";
    player.playerIndex = s.players.size;
    player.connected = true;

    s.players.set(client.sessionId, player);
    this.sessionToUid.set(client.sessionId, auth.uid);
    this.uidToSession.set(auth.uid, client.sessionId);

    if (auth.traceId && !s.traceId) {
      s.traceId = auth.traceId;
    }

    client.send("welcome", {
      sessionId: client.sessionId,
      playerIndex: player.playerIndex,
      gridSize: BATTLESHIP_GRID_SIZE,
      fleet: FLEET,
    });

    this.roomLog.info(
      `Player joined: ${auth.uid} (index ${player.playerIndex}) [${s.players.size}/2]`,
    );

    // ── Auto-start placement when both players join ─────────────────────
    if (s.players.size === 2 && s.phase === "waiting") {
      this.startPlacementPhase();
    }
  }

  // =========================================================================
  // Messages
  // =========================================================================

  messages: Record<string, (client: Client, payload?: any) => void> = {
    // ── Placement ────────────────────────────────────────────────────────
    place_ship: (client: Client, payload: any) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.s.phase !== "placement") return;
      this.handlePlaceShip(client, payload);
    },

    remove_ship: (client: Client, payload: any) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.s.phase !== "placement") return;
      this.handleRemoveShip(client, payload);
    },

    randomize: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.s.phase !== "placement") return;
      this.handleRandomize(client);
    },

    lock_in: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.s.phase !== "placement") return;
      this.handleLockIn(client);
    },

    // ── Combat ───────────────────────────────────────────────────────────
    fire: (client: Client, payload: any) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.s.phase !== "combat") return;
      this.handleFire(client, payload);
    },

    // ── Universal ────────────────────────────────────────────────────────
    surrender: (client: Client) => {
      if (this.isSpectator(client.sessionId)) return;
      if (this.s.phase !== "combat" && this.s.phase !== "placement") return;
      this.handleSurrender(client);
    },

    app_state: (client: Client, payload: any) => {
      this.roomLog.info(`App state: ${client.sessionId} → ${payload?.state}`);
    },
  };

  // =========================================================================
  // Phase — Placement
  // =========================================================================

  private startPlacementPhase(): void {
    const s = this.s;
    s.phase = "placement";
    s.placementTimeRemaining = PLACEMENT_TIMEOUT_MS;
    s.timerRunning = true;

    // Initialize empty boards for each player
    s.players.forEach((player: BattleshipPlayer) => {
      this.boards.set(player.uid, {
        placements: [],
        grid: new Map(),
        shotsReceived: new Set(),
      });
    });

    this.startTimer("placement");
    this.roomLog.info("Placement phase started");
  }

  private handlePlaceShip(client: Client, payload: any): void {
    const uid = this.sessionToUid.get(client.sessionId);
    if (!uid) return;

    const player = this.s.players.get(client.sessionId);
    if (!player || player.placementReady) {
      client.send("error", { message: "Already locked in" });
      return;
    }

    const { shipId, startRow, startCol, orientation } = payload || {};
    const shipDef = FLEET.find((f) => f.id === shipId);
    if (!shipDef) {
      client.send("error", { message: `Unknown ship: ${shipId}` });
      return;
    }

    const board = this.boards.get(uid)!;

    // Remove existing placement of this ship so re-placing is idempotent
    this.removeShipFromBoard(board, shipId);

    const err = this.validatePlacement(
      board,
      shipDef,
      startRow,
      startCol,
      orientation,
    );
    if (err) {
      client.send("error", { message: err });
      return;
    }

    // Place the ship
    const cells = this.computeCells(
      shipDef,
      startRow,
      startCol,
      orientation as "horizontal" | "vertical",
    );
    const placement: ShipPlacement = {
      shipId: shipDef.id,
      shipName: shipDef.name,
      size: shipDef.size,
      startRow,
      startCol,
      orientation: orientation as "horizontal" | "vertical",
      cells,
      hitsRemaining: shipDef.size,
    };
    board.placements.push(placement);
    for (const cell of cells) {
      board.grid.set(`${cell.row},${cell.col}`, shipDef.id);
    }

    this.sendBoardToPlayer(uid);
    client.send("ship_placed", { shipId, startRow, startCol, orientation });
  }

  private handleRemoveShip(client: Client, payload: any): void {
    const uid = this.sessionToUid.get(client.sessionId);
    if (!uid) return;

    const player = this.s.players.get(client.sessionId);
    if (!player || player.placementReady) {
      client.send("error", { message: "Already locked in" });
      return;
    }

    const board = this.boards.get(uid);
    if (!board) return;

    const { shipId } = payload || {};
    if (!shipId) return;

    this.removeShipFromBoard(board, shipId);
    this.sendBoardToPlayer(uid);
    client.send("ship_removed", { shipId });
  }

  private handleRandomize(client: Client): void {
    const uid = this.sessionToUid.get(client.sessionId);
    if (!uid) return;

    const player = this.s.players.get(client.sessionId);
    if (!player || player.placementReady) {
      client.send("error", { message: "Already locked in" });
      return;
    }

    this.autoPlaceFleet(uid);
    this.sendBoardToPlayer(uid);
    client.send("fleet_randomized", {});
  }

  private handleLockIn(client: Client): void {
    const uid = this.sessionToUid.get(client.sessionId);
    if (!uid) return;

    const player = this.s.players.get(client.sessionId);
    if (!player || player.placementReady) return;

    const board = this.boards.get(uid);
    if (!board) return;

    if (board.placements.length !== FLEET.length) {
      client.send("error", {
        message: `Place all ${FLEET.length} ships before locking in (${board.placements.length}/${FLEET.length})`,
      });
      return;
    }

    player.placementReady = true;
    this.roomLog.info(`Player ${uid} locked in placement`);
    this.checkBothPlacementsReady();
  }

  private checkBothPlacementsReady(): void {
    let allReady = true;
    this.s.players.forEach((p: BattleshipPlayer) => {
      if (!p.placementReady) allReady = false;
    });

    if (allReady && this.s.players.size === 2) {
      this.startCombatPhase();
    }
  }

  // =========================================================================
  // Phase — Combat
  // =========================================================================

  private startCombatPhase(): void {
    const s = this.s;
    s.phase = "combat";
    s.turnNumber = 1;
    s.timerRunning = true;
    this.gameStartTime = Date.now();

    // Pick first player at random
    const entries: BattleshipPlayer[] = [];
    s.players.forEach((p: BattleshipPlayer) => entries.push(p));
    const first = entries[Math.floor(Math.random() * entries.length)];
    s.currentTurnUid = first.uid;
    s.turnTimeRemaining = TURN_TIMEOUT_MS;

    this.clearTimer();
    this.startTimer("combat");

    this.broadcast("combat_started", { firstTurnUid: s.currentTurnUid });
    this.roomLog.info(`Combat phase started. First turn: ${s.currentTurnUid}`);
  }

  private handleFire(client: Client, payload: any): void {
    const s = this.s;
    const uid = this.sessionToUid.get(client.sessionId);
    if (!uid) return;

    if (s.currentTurnUid !== uid) {
      client.send("error", { message: "Not your turn" });
      return;
    }

    const { row, col } = payload || {};
    if (
      typeof row !== "number" ||
      typeof col !== "number" ||
      row < 0 ||
      row >= BATTLESHIP_GRID_SIZE ||
      col < 0 ||
      col >= BATTLESHIP_GRID_SIZE
    ) {
      client.send("error", { message: "Invalid coordinates" });
      return;
    }

    const opponentUid = this.getOpponentUid(uid);
    if (!opponentUid) return;

    const opponentBoard = this.boards.get(opponentUid);
    if (!opponentBoard) return;

    const key = `${row},${col}`;
    if (opponentBoard.shotsReceived.has(key)) {
      client.send("error", { message: "Already fired at this coordinate" });
      return;
    }

    this.processShot(uid, opponentUid, row, col);
  }

  private processShot(
    shooterUid: string,
    targetUid: string,
    row: number,
    col: number,
  ): void {
    const s = this.s;
    const targetBoard = this.boards.get(targetUid)!;
    const key = `${row},${col}`;
    targetBoard.shotsReceived.add(key);

    const shipId = targetBoard.grid.get(key);
    const shooter = this.getPlayerByUid(shooterUid);
    const target = this.getPlayerByUid(targetUid);
    if (!shooter || !target) return;

    shooter.shotsFired++;

    let result: "miss" | "hit" | "sunk" = "miss";
    let hitPlacement: ShipPlacement | undefined;

    if (shipId) {
      hitPlacement = targetBoard.placements.find((p) => p.shipId === shipId);
      if (hitPlacement) {
        hitPlacement.hitsRemaining--;
        shooter.hits++;
        target.shipCellsRemaining--;

        if (hitPlacement.hitsRemaining <= 0) {
          result = "sunk";
          target.shipsRemaining--;

          // Reveal sunk ship outline to everyone
          const sunkShip = new SunkShip();
          sunkShip.shipId = hitPlacement.shipId;
          sunkShip.shipName = hitPlacement.shipName;
          sunkShip.size = hitPlacement.size;
          sunkShip.ownerUid = targetUid;
          for (const cell of hitPlacement.cells) {
            const sc = new SunkShipCell();
            sc.row = cell.row;
            sc.col = cell.col;
            sunkShip.cells.push(sc);
          }
          s.sunkShips.push(sunkShip);
        } else {
          result = "hit";
        }
      }
    } else {
      shooter.misses++;
    }

    // Record shot in shared history
    const record = new ShotRecord();
    record.row = row;
    record.col = col;
    record.shooterUid = shooterUid;
    record.targetUid = targetUid;
    record.result = result;
    record.shipId = hitPlacement?.shipId || "";
    record.shipName = hitPlacement?.shipName || "";
    record.turnNumber = s.turnNumber;
    s.shotHistory.push(record);

    // Set last-action fields for client-side animation triggers
    s.lastActionType = result;
    s.lastActionRow = row;
    s.lastActionCol = col;
    s.lastActionShipName = hitPlacement?.shipName || "";

    this.roomLog.info(
      `Shot: ${shooterUid} → (${row},${col}) = ${result}${hitPlacement ? ` [${hitPlacement.shipName}]` : ""}`,
    );

    // Check for win (all opponent cells destroyed)
    if (target.shipCellsRemaining <= 0 || target.shipsRemaining <= 0) {
      this.endGame(shooterUid, "sunk");
      return;
    }

    // Advance turn to opponent
    this.advanceTurn();
  }

  private advanceTurn(): void {
    const s = this.s;
    const opponentUid = this.getOpponentUid(s.currentTurnUid);
    if (!opponentUid) return;

    s.currentTurnUid = opponentUid;
    s.turnNumber++;
    s.turnTimeRemaining = TURN_TIMEOUT_MS;
  }

  // =========================================================================
  // Surrender
  // =========================================================================

  private handleSurrender(client: Client): void {
    const uid = this.sessionToUid.get(client.sessionId);
    if (!uid) return;
    const opponentUid = this.getOpponentUid(uid);
    if (!opponentUid) return;

    this.roomLog.info(`Player ${uid} surrendered`);
    this.endGame(opponentUid, "surrender");
  }

  // =========================================================================
  // Timer Management
  // =========================================================================

  private startTimer(type: "placement" | "combat"): void {
    this.clearTimer();
    let lastTick = Date.now();

    this.timerInterval = this.clock.setInterval(() => {
      const now = Date.now();
      const dt = now - lastTick;
      lastTick = now;

      if (type === "placement") {
        this.s.placementTimeRemaining = Math.max(
          0,
          this.s.placementTimeRemaining - dt,
        );
        if (this.s.placementTimeRemaining <= 0) {
          this.onPlacementTimeout();
        }
      } else {
        this.s.turnTimeRemaining = Math.max(0, this.s.turnTimeRemaining - dt);
        if (this.s.turnTimeRemaining <= 0) {
          this.onTurnTimeout();
        }
      }
    }, TIMER_INTERVAL_MS);
  }

  private clearTimer(): void {
    if (this.timerInterval) {
      this.timerInterval.clear();
      this.timerInterval = null;
    }
  }

  private onPlacementTimeout(): void {
    this.roomLog.info("Placement timeout — auto-placing remaining ships");

    this.s.players.forEach((player: BattleshipPlayer) => {
      if (!player.placementReady) {
        this.autoPlaceFleet(player.uid);
        player.placementReady = true;
        this.sendBoardToPlayer(player.uid);
      }
    });

    this.startCombatPhase();
  }

  private onTurnTimeout(): void {
    const currentUid = this.s.currentTurnUid;
    if (!currentUid) return;

    this.roomLog.info(`Turn timeout for ${currentUid} — auto-firing`);

    const opponentUid = this.getOpponentUid(currentUid);
    if (!opponentUid) return;

    const coord = this.getRandomUnshotCell(opponentUid);
    if (coord) {
      this.processShot(currentUid, opponentUid, coord.row, coord.col);
    } else {
      // No unshot cells remaining — shouldn't happen normally
      this.endGame(opponentUid, "timeout");
    }
  }

  // =========================================================================
  // Game End
  // =========================================================================

  private endGame(winnerId: string, reason: string): void {
    if (this.s.phase === "finished") return;

    const s = this.s;
    s.phase = "finished";
    s.winnerId = winnerId;
    s.winReason = reason;
    s.timerRunning = false;
    this.clearTimer();

    const gameDurationMs = this.gameStartTime
      ? Date.now() - this.gameStartTime
      : 0;

    const results: Array<Record<string, any>> = [];
    s.players.forEach((p: BattleshipPlayer) => {
      results.push({
        uid: p.uid,
        displayName: p.displayName,
        hits: p.hits,
        misses: p.misses,
        shotsFired: p.shotsFired,
        shipsRemaining: p.shipsRemaining,
        shipCellsRemaining: p.shipCellsRemaining,
        playerIndex: p.playerIndex,
      });
    });

    this.broadcast("game_over", {
      winnerId,
      winReason: reason,
      results,
      gameDurationMs,
      turnCount: s.turnNumber,
    });

    // Lift fog-of-war — reveal both boards to all clients
    this.revealAllBoards();

    this.roomLog.info(
      `Game over! Winner: ${winnerId} (${reason}) — ${s.turnNumber} turns, ${gameDurationMs}ms`,
    );
  }

  // =========================================================================
  // Lifecycle — onLeave / Reconnection
  // =========================================================================

  async onLeave(client: Client, code?: number): Promise<void> {
    const s = this.s;

    // ── Spectator leave ─────────────────────────────────────────────────
    if (this.spectatorSessionIds.has(client.sessionId)) {
      s.spectators.delete(client.sessionId);
      s.spectatorCount = Math.max(0, s.spectatorCount - 1);
      this.spectatorSessionIds.delete(client.sessionId);
      this.roomLog.info(`Spectator left (${s.spectatorCount} watching)`);
      return;
    }

    const player = s.players.get(client.sessionId);
    if (!player) return;

    player.connected = false;
    const consented = typeof code === "number" && code >= 4000;

    // Game already finished — no reconnection needed
    if (s.phase === "finished") {
      this.roomLog.info(`Player left after game ended: ${player.uid}`);
      return;
    }

    // Game in progress — try reconnection
    if ((s.phase === "placement" || s.phase === "combat") && !consented) {
      this.broadcast(
        "opponent_reconnecting",
        { uid: player.uid },
        { except: client },
      );

      try {
        await this.allowReconnection(client, RECONNECT_GRACE_S);
        // Reconnected successfully
        player.connected = true;
        this.broadcast(
          "opponent_reconnected",
          { uid: player.uid },
          { except: client },
        );
        this.sendBoardToPlayer(player.uid);
        this.roomLog.info(`Player reconnected: ${player.uid}`);
        return;
      } catch {
        // Check if this session was taken over by a new session (M2).
        // If so, the old player entry has been removed from s.players and
        // uidToSession now points to the new sessionId — no forfeit needed.
        const currentSessionForUid = this.uidToSession.get(player.uid);
        if (currentSessionForUid && currentSessionForUid !== client.sessionId) {
          this.roomLog.info(
            `Reconnection timed out for old session ${client.sessionId}, ` +
              `but uid=${player.uid} was re-seated via session takeover ` +
              `(newSession=${currentSessionForUid}) — skipping forfeit`,
          );
          return;
        }

        this.roomLog.info(`Reconnection timed out: ${player.uid} — forfeit`);
      }
    }

    // Player truly left — forfeit if game is live
    if (s.phase === "placement" || s.phase === "combat") {
      const opponentUid = this.getOpponentUid(player.uid);
      if (opponentUid) {
        this.endGame(opponentUid, "disconnect");
      }
    }

    this.roomLog.info(`Player left: ${player.uid} (code: ${code})`);
  }

  // =========================================================================
  // Lifecycle — onDispose
  // =========================================================================

  async onDispose(): Promise<void> {
    this.clearTimer();

    const gameDurationMs = this.gameStartTime
      ? Date.now() - this.gameStartTime
      : undefined;

    const firestoreGameId =
      this.firestoreGameId || this.s.gameId || this.roomId;

    if (this.s.phase === "finished" && this.s.winnerId) {
      // ── Game resolved → persist results ────────────────────────────────

      // Extract inviteId from ext_battleship_<inviteId> for explicit passing.
      // Fall back to this.inviteId (passed from client join options) as
      // defense-in-depth.
      const inviteId =
        extractInviteIdFromExtGameId(firestoreGameId) ??
        this.inviteId ??
        undefined;

      try {
        // Temporarily clear firestoreGameId on state so persistGameResult
        // writes a new RealtimeGameSessions doc (triggering the backend
        // completion pipeline) instead of trying to update a non-existent
        // TurnBasedGames doc for external Colyseus games.
        const savedFsId = this.s.firestoreGameId;
        this.s.firestoreGameId = "";

        const perPlayerStats: Record<string, Record<string, number>> = {};
        this.s.players.forEach((p: BattleshipPlayer) => {
          const opponentShipsSunk = FLEET.length - p.shipsRemaining;
          const accuracy =
            p.shotsFired > 0 ? Math.round((p.hits / p.shotsFired) * 100) : 0;
          const isWinner = p.uid === this.s.winnerId;

          perPlayerStats[p.uid] = {
            hits: p.hits,
            misses: p.misses,
            shotsFired: p.shotsFired,
            shipsRemaining: p.shipsRemaining,
            shipCellsRemaining: p.shipCellsRemaining,
            shipsSunk: opponentShipsSunk,
            accuracy,
            // Boolean achievement flags (1 = achieved, 0 = not) — winner only
            flawlessWin: isWinner && p.shipsRemaining === FLEET.length ? 1 : 0,
            sharpshooterWin: isWinner && accuracy >= 70 ? 1 : 0,
            comebackWin: isWinner && p.shipsRemaining === 1 ? 1 : 0,
            perfectGame: isWinner && p.misses === 0 ? 1 : 0,
            speedrunWin: isWinner && p.shotsFired <= 25 ? 1 : 0,
          };
        });

        await persistGameResult(
          this.s as unknown as BaseGameState,
          gameDurationMs,
          perPlayerStats,
          { inviteId, firestoreGameId },
        );

        // Restore for cleanup
        this.s.firestoreGameId = savedFsId;
      } catch (e) {
        this.roomLog.error("Failed to persist game result:", e);
      }

      // Always attempt invite cleanup, even if persistence failed
      try {
        await deleteGameAndInvite(firestoreGameId, inviteId);
        this.roomLog.info("Game completed, persisted, and cleaned up");
      } catch (e) {
        this.roomLog.error("Failed to clean up game/invite:", e);
      }
    } else if (this.s.phase === "combat" || this.s.phase === "placement") {
      // ── Ongoing game → mark vacant (10-min cleanup) ────────────────────
      await markGameVacant(firestoreGameId, "battleship", false);
      this.roomLog.info("Ongoing game marked vacant (10-min TTL)");
    } else if (this.s.phase === "waiting") {
      // ── Pre-start abandonment → delete immediately ─────────────────────
      const inviteId =
        extractInviteIdFromExtGameId(firestoreGameId) ??
        this.inviteId ??
        undefined;
      await deleteGameAndInvite(firestoreGameId, inviteId);
      this.roomLog.info("Pre-start abandonment — deleted game + invite");
    }

    this.roomLog.info(`Room disposed: ${this.roomId}`);
  }

  // =========================================================================
  // Board Helpers — Private data delivery
  // =========================================================================

  /** Send a player their own board (fog-of-war: only their placements) */
  private sendBoardToPlayer(uid: string): void {
    const sessionId = this.uidToSession.get(uid);
    if (!sessionId) return;

    const board = this.boards.get(uid);
    if (!board) return;

    const payload = board.placements.map((p) => ({
      shipId: p.shipId,
      shipName: p.shipName,
      size: p.size,
      startRow: p.startRow,
      startCol: p.startCol,
      orientation: p.orientation,
      cells: p.cells,
      hitsRemaining: p.hitsRemaining,
    }));

    for (const c of this.clients) {
      if (c.sessionId === sessionId) {
        c.send("your_board", { placements: payload });
        break;
      }
    }
  }

  /** Reveal both boards to all clients (called when game ends) */
  private revealAllBoards(): void {
    const allBoards: Record<string, any> = {};
    this.boards.forEach((board, uid) => {
      allBoards[uid] = board.placements.map((p) => ({
        shipId: p.shipId,
        shipName: p.shipName,
        size: p.size,
        startRow: p.startRow,
        startCol: p.startCol,
        orientation: p.orientation,
        cells: p.cells,
      }));
    });
    this.broadcast("boards_revealed", { boards: allBoards });
  }

  // =========================================================================
  // Placement Helpers
  // =========================================================================

  private validatePlacement(
    board: PlayerBoard,
    shipDef: ShipDef,
    startRow: number,
    startCol: number,
    orientation: string,
  ): string | null {
    if (orientation !== "horizontal" && orientation !== "vertical") {
      return "Orientation must be 'horizontal' or 'vertical'";
    }
    if (
      typeof startRow !== "number" ||
      typeof startCol !== "number" ||
      startRow < 0 ||
      startCol < 0
    ) {
      return "Invalid starting position";
    }

    // Bounds check
    if (orientation === "horizontal") {
      if (
        startRow >= BATTLESHIP_GRID_SIZE ||
        startCol + shipDef.size > BATTLESHIP_GRID_SIZE
      ) {
        return "Ship extends beyond grid boundary";
      }
    } else {
      if (
        startCol >= BATTLESHIP_GRID_SIZE ||
        startRow + shipDef.size > BATTLESHIP_GRID_SIZE
      ) {
        return "Ship extends beyond grid boundary";
      }
    }

    // Overlap check (allow self-overlap for re-placement of same ship)
    const cells = this.computeCells(
      shipDef,
      startRow,
      startCol,
      orientation as "horizontal" | "vertical",
    );
    for (const cell of cells) {
      const existing = board.grid.get(`${cell.row},${cell.col}`);
      if (existing && existing !== shipDef.id) {
        return `Overlaps with ${existing}`;
      }
    }

    return null;
  }

  private computeCells(
    shipDef: ShipDef,
    startRow: number,
    startCol: number,
    orientation: "horizontal" | "vertical",
  ): Array<{ row: number; col: number }> {
    const cells: Array<{ row: number; col: number }> = [];
    for (let i = 0; i < shipDef.size; i++) {
      cells.push({
        row: orientation === "vertical" ? startRow + i : startRow,
        col: orientation === "horizontal" ? startCol + i : startCol,
      });
    }
    return cells;
  }

  private removeShipFromBoard(board: PlayerBoard, shipId: string): void {
    const idx = board.placements.findIndex((p) => p.shipId === shipId);
    if (idx === -1) return;
    const placement = board.placements[idx];
    for (const cell of placement.cells) {
      board.grid.delete(`${cell.row},${cell.col}`);
    }
    board.placements.splice(idx, 1);
  }

  /** Auto-place all ships randomly (used for timeout + randomize button) */
  private autoPlaceFleet(uid: string): void {
    const board = this.boards.get(uid);
    if (!board) return;

    // Clear existing placements
    board.placements = [];
    board.grid = new Map();

    for (const shipDef of FLEET) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 200) {
        attempts++;
        const orientation: "horizontal" | "vertical" =
          Math.random() < 0.5 ? "horizontal" : "vertical";
        const maxRow =
          orientation === "vertical"
            ? BATTLESHIP_GRID_SIZE - shipDef.size
            : BATTLESHIP_GRID_SIZE - 1;
        const maxCol =
          orientation === "horizontal"
            ? BATTLESHIP_GRID_SIZE - shipDef.size
            : BATTLESHIP_GRID_SIZE - 1;

        const startRow = Math.floor(Math.random() * (maxRow + 1));
        const startCol = Math.floor(Math.random() * (maxCol + 1));

        const err = this.validatePlacement(
          board,
          shipDef,
          startRow,
          startCol,
          orientation,
        );
        if (!err) {
          const cells = this.computeCells(
            shipDef,
            startRow,
            startCol,
            orientation,
          );
          board.placements.push({
            shipId: shipDef.id,
            shipName: shipDef.name,
            size: shipDef.size,
            startRow,
            startCol,
            orientation,
            cells,
            hitsRemaining: shipDef.size,
          });
          for (const cell of cells) {
            board.grid.set(`${cell.row},${cell.col}`, shipDef.id);
          }
          placed = true;
        }
      }

      if (!placed) {
        this.roomLog.error(
          `Failed to auto-place ${shipDef.name} for ${uid} after ${attempts} attempts`,
        );
      }
    }
  }

  // =========================================================================
  // Combat Helpers
  // =========================================================================

  /** Get a random unshot cell on the target's board (for auto-fire) */
  private getRandomUnshotCell(
    targetUid: string,
  ): { row: number; col: number } | null {
    const board = this.boards.get(targetUid);
    if (!board) return null;

    const unshot: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < BATTLESHIP_GRID_SIZE; r++) {
      for (let c = 0; c < BATTLESHIP_GRID_SIZE; c++) {
        if (!board.shotsReceived.has(`${r},${c}`)) {
          unshot.push({ row: r, col: c });
        }
      }
    }
    if (unshot.length === 0) return null;
    return unshot[Math.floor(Math.random() * unshot.length)];
  }

  // =========================================================================
  // Player Helpers
  // =========================================================================

  private getPlayerByUid(uid: string): BattleshipPlayer | null {
    const sessionId = this.uidToSession.get(uid);
    if (!sessionId) return null;
    return (this.s.players.get(sessionId) as BattleshipPlayer) || null;
  }

  private getOpponentUid(uid: string): string | null {
    let opponentUid: string | null = null;
    this.s.players.forEach((p: BattleshipPlayer) => {
      if (p.uid !== uid) opponentUid = p.uid;
    });
    return opponentUid;
  }
}
