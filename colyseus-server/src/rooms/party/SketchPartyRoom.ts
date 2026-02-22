/**
 * SketchPartyRoom — Multiplayer drawing & guessing game (skribbl-style)
 *
 * Gameplay overview:
 * 1. Players join lobby → host configures settings → starts game
 * 2. Each round, every player takes a turn as drawer
 * 3. Drawer chooses a word from N options → draws on canvas
 * 4. Other players guess via chat; correct guesses earn points
 * 5. After all rounds complete → final scores → game over
 *
 * IMPORTANT: Drawing operations are broadcast via messages, NOT stored in
 * schema state. Late joiners receive a canvas snapshot on join.
 *
 * Server-authoritative: secret word, scoring, turn timers, rate-limiting.
 *
 * @see colyseus-server/src/schemas/sketchParty.ts
 * @see colyseus-server/src/data/sketchPartyWords.ts
 */

import { Client, Room } from "colyseus";
import { loadWordPool, pickWords } from "../../data/sketchPartyWords";
import { BaseGameState } from "../../schemas/common";
import { SketchPartyPlayer, SketchPartyState } from "../../schemas/sketchParty";
import { SpectatorEntry } from "../../schemas/spectator";
import { verifyFirebaseToken } from "../../services/firebase";
import { persistGameResult } from "../../services/persistence";
import type { ServerLogger } from "../../utils/logger";
import { createServerLogger } from "../../utils/logger";
import { checkProtocolVersion } from "../../utils/protocol";

const log = createServerLogger("SketchPartyRoom");

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_ROUNDS = 3;
const DEFAULT_DRAW_TIME_SEC = 80;
const DEFAULT_CHOOSE_TIME_SEC = 10;
const DEFAULT_REVEAL_TIME_SEC = 6;
const DEFAULT_WORD_CHOICE_COUNT = 3;
const DEFAULT_MAX_PLAYERS = 10;

const MIN_ROUNDS = 2;
const MAX_ROUNDS = 10;
const MIN_DRAW_TIME = 15;
const MAX_DRAW_TIME = 240;
const MIN_WORD_CHOICES = 1;
const MAX_WORD_CHOICES = 5;
const MIN_HINTS = 0;
const MAX_HINTS = 5;

/** Rate limit: guess token bucket */
const GUESS_BUCKET_SIZE = 6;
const GUESS_BUCKET_REFILL_MS = 3000;
const GUESS_SUSTAINED_RATE_MS = 1000;

/** Rate limit: draw_points messages per second */
const DRAW_POINTS_PER_SEC = 30;

/** Max points array length in a single draw_points message */
const MAX_DRAW_POINTS_PER_MSG = 200;

/** Max integer value for draw coords */
const MAX_DRAW_COORD = 1023;

/** Pacing: if first correct guess with >30s remaining, shorten turn */
const PACING_THRESHOLD_SEC = 30;

// =============================================================================
// Token Bucket Rate Limiter
// =============================================================================

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

function checkGuessBucket(bucket: TokenBucket, now: number): boolean {
  const elapsed = now - bucket.lastRefill;
  if (elapsed >= GUESS_BUCKET_REFILL_MS) {
    bucket.tokens = GUESS_BUCKET_SIZE;
    bucket.lastRefill = now;
  } else {
    // Sustained refill: 1 token per second
    const refillTokens = Math.floor(elapsed / GUESS_SUSTAINED_RATE_MS);
    if (refillTokens > 0) {
      bucket.tokens = Math.min(GUESS_BUCKET_SIZE, bucket.tokens + refillTokens);
      bucket.lastRefill = now;
    }
  }
  if (bucket.tokens > 0) {
    bucket.tokens--;
    return true;
  }
  return false;
}

// =============================================================================
// Text Normalization
// =============================================================================

function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\+/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

// =============================================================================
// Word Mask Helpers
// =============================================================================

function buildInitialMask(word: string, mode: string): string {
  if (mode === "hidden") {
    // All hidden — show just the length as ?
    return word
      .split("")
      .map((ch) => (ch === " " ? " " : "?"))
      .join("");
  }
  // normal / combination — underscores, preserve spaces
  return word
    .split("")
    .map((ch) => (ch === " " ? " " : "_"))
    .join("");
}

function revealLetterInMask(
  mask: string,
  word: string,
  revealedIndices: Set<number>,
): { newMask: string; revealedIndex: number } {
  // Find unrevealed non-space indices
  const candidates: number[] = [];
  for (let i = 0; i < word.length; i++) {
    if (word[i] !== " " && !revealedIndices.has(i)) {
      candidates.push(i);
    }
  }
  if (candidates.length === 0) return { newMask: mask, revealedIndex: -1 };

  const idx = candidates[Math.floor(Math.random() * candidates.length)];
  const chars = mask.split("");
  chars[idx] = word[idx];
  return { newMask: chars.join(""), revealedIndex: idx };
}

// =============================================================================
// Room
// =============================================================================

export class SketchPartyRoom extends Room<{ state: SketchPartyState }> {
  // =========================================================================
  // Server-only state (NOT synced to clients via schema)
  // =========================================================================

  /** The actual secret word for the current turn */
  private secretWord: string = "";

  /** Word choices offered to the drawer this turn */
  private wordChoices: string[] = [];

  /** Canvas drawing operations for the current turn (for late-joiner snapshot) */
  private canvasOps: any[] = [];

  /** Firebase UID → session ID mapping (uid is stable, sessionId changes on reconnect) */
  private uidToSessionId = new Map<string, string>();

  /** Session ID → Firebase UID mapping */
  private sessionToUid = new Map<string, string>();

  /** Set of spectator session IDs (for blocking game actions) */
  private spectatorSessionIds = new Set<string>();

  /** Guess rate limiter: session ID → TokenBucket */
  private guessBuckets = new Map<string, TokenBucket>();

  /** Draw rate limiter: session ID → { count, windowStart } */
  private drawRateLimits = new Map<
    string,
    { count: number; windowStart: number }
  >();

  /** Word pool for this room (loaded once from data + custom words) */
  private wordPool: string[] = [];

  /** Set of words already used this game (to avoid repeats) */
  private usedWords = new Set<string>();

  /** Set of revealed letter indices for current turn */
  private revealedIndices = new Set<number>();

  /** Timestamp of last correct guess (for drawer bonus) */
  private lastCorrectGuessAt: number = 0;

  /** Number of non-spectator non-drawer players at turn start (for rank bonus) */
  private maxGuessersThisTurn: number = 0;

  /** Game start timestamp (for total duration tracking) */
  private gameStartedAt: number = 0;

  /** Timer handles for cleanup */
  private chooseTimer: any = null;
  private turnTimer: any = null;
  private revealTimer: any = null;
  private hintTimers: any[] = [];
  private roomLog: ServerLogger = log;

  // ── Per-player cumulative stats (for achievement evaluation) ──────────
  /**
   * Accumulated stats per player UID, tracked across *all* turns.
   * These are flushed to the game result at onDispose so the Cloud Function
   * trigger can feed them into `updatePerGameStatsV2(…, gameSpecific)`.
   */
  private playerAchievementStats = new Map<
    string,
    {
      correctGuesses: number;
      drawingTurns: number;
      perfectDrawerTurns: number;
      fastestGuessMs: number;
      totalGuesserPoints: number;
      totalDrawerPoints: number;
      firstGuessCount: number; // times this player guessed 1st
    }
  >();

  /** Initialise stat entry for a player (idempotent). */
  private _ensureStats(uid: string) {
    if (!this.playerAchievementStats.has(uid)) {
      this.playerAchievementStats.set(uid, {
        correctGuesses: 0,
        drawingTurns: 0,
        perfectDrawerTurns: 0,
        fastestGuessMs: 0,
        totalGuesserPoints: 0,
        totalDrawerPoints: 0,
        firstGuessCount: 0,
      });
    }
    return this.playerAchievementStats.get(uid)!;
  }

  // =========================================================================
  // Auth (Firebase ID token verification — existing pattern)
  // =========================================================================

  async onAuth(
    client: Client,
    options: Record<string, any>,
    context: any,
  ): Promise<any> {
    // ── Protocol version gate ─────────────────────────────────────────────
    const proto = checkProtocolVersion(options);
    if (!proto.ok) {
      log.warn(`Protocol rejected: ${proto.reason}`, {
        sessionId: client.sessionId,
        gameType: "sketch_party_game",
        traceId: options?.traceId,
      });
      throw new Error(proto.reason);
    }

    const decoded = await verifyFirebaseToken(
      context?.token || options?.token || "",
    );
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
    };
  }

  // =========================================================================
  // Lifecycle: onCreate
  // =========================================================================

  onCreate(options: Record<string, any>): void {
    this.setState(new SketchPartyState());
    this.state.gameId = this.roomId;
    this.state.traceId = options.traceId || "";
    this.state.gameType = "sketch_party_game";
    this.state.phase = "waiting";
    this.state.turnSubphase = "lobby";
    this.state.firestoreGameId = options.firestoreGameId || "";
    this.state.hostUid = options.hostUid || "";

    // Apply lobby settings with clamping
    this.state.rounds = clamp(
      options.rounds ?? DEFAULT_ROUNDS,
      MIN_ROUNDS,
      MAX_ROUNDS,
    );
    this.state.drawTimeSec = clamp(
      options.drawTimeSec ?? DEFAULT_DRAW_TIME_SEC,
      MIN_DRAW_TIME,
      MAX_DRAW_TIME,
    );
    this.state.wordMode = ["normal", "hidden", "combination"].includes(
      options.wordMode,
    )
      ? options.wordMode
      : "normal";
    this.state.wordChoiceCount = clamp(
      options.wordChoiceCount ?? DEFAULT_WORD_CHOICE_COUNT,
      MIN_WORD_CHOICES,
      MAX_WORD_CHOICES,
    );
    this.state.hints =
      this.state.wordMode === "hidden"
        ? 0
        : clamp(options.hints ?? 2, MIN_HINTS, MAX_HINTS);
    this.state.language = options.language ?? "en";
    this.state.customWordsEnabled = !!options.customWordsCsv;
    this.state.useCustomWordsOnly = !!options.useCustomWordsOnly;
    this.state.maxPlayers = clamp(
      options.maxPlayers ?? DEFAULT_MAX_PLAYERS,
      2,
      DEFAULT_MAX_PLAYERS,
    );
    this.state.isRated = false;

    this.maxClients = this.state.maxPlayers + this.state.maxSpectators;

    // Load word pool
    this.wordPool = loadWordPool({
      language: this.state.language,
      customWordsCsv: options.customWordsCsv,
      useCustomWordsOnly: !!options.useCustomWordsOnly,
    });

    // Register message handlers
    this._registerMessages();

    this.roomLog = log.child({
      roomId: this.roomId,
      gameType: this.state.gameType,
      firestoreGameId: this.state.firestoreGameId || undefined,
      traceId: options.traceId || undefined,
    });

    this.roomLog.info(
      `[sketch_party] Room created: ${this.roomId} (firestoreGameId=${this.state.firestoreGameId}, rounds=${this.state.rounds}, drawTime=${this.state.drawTimeSec}s)`,
    );
  }

  // =========================================================================
  // Lifecycle: onJoin
  // =========================================================================

  onJoin(client: Client, options: Record<string, any>, auth: any): void {
    const isSpectator = !!options.spectator;

    if (isSpectator) {
      this._addSpectator(client, auth);
      return;
    }

    // Check if this UID is already in the room (reconnect with new session)
    const existingSessionId = this.uidToSessionId.get(auth.uid);
    if (existingSessionId && this.state.spPlayers.has(existingSessionId)) {
      // Reconnect: update session mapping
      const existingPlayer = this.state.spPlayers.get(existingSessionId)!;
      this.state.spPlayers.delete(existingSessionId);
      this.state.players.delete(existingSessionId);
      this.sessionToUid.delete(existingSessionId);

      existingPlayer.sessionId = client.sessionId;
      existingPlayer.connected = true;
      this.state.spPlayers.set(client.sessionId, existingPlayer);
      this.state.players.set(client.sessionId, existingPlayer);
      this.uidToSessionId.set(auth.uid, client.sessionId);
      this.sessionToUid.set(client.sessionId, auth.uid);

      this.roomLog.info(
        `[sketch_party] Player reconnected with new session: ${auth.displayName} (${existingSessionId} → ${client.sessionId})`,
      );
    } else {
      // New player
      const player = new SketchPartyPlayer();
      player.uid = auth.uid;
      player.sessionId = client.sessionId;
      player.displayName = auth.displayName || "Player";
      player.avatarUrl = auth.avatarUrl || "";
      player.playerIndex = this.state.spPlayers.size;
      player.connected = true;
      player.score = 0;

      this.state.spPlayers.set(client.sessionId, player);
      this.state.players.set(client.sessionId, player);
      this.uidToSessionId.set(auth.uid, client.sessionId);
      this.sessionToUid.set(client.sessionId, auth.uid);

      // First player becomes host if not set
      if (!this.state.hostUid) {
        this.state.hostUid = auth.uid;
      }

      // Add to player order if game not started and not already present
      if (
        this.state.phase === "waiting" &&
        !this.state.playerOrder.includes(auth.uid)
      ) {
        this.state.playerOrder.push(auth.uid);
      }

      this.roomLog.info(
        `[sketch_party] Player joined: ${auth.displayName} (${client.sessionId}) [${this.state.spPlayers.size} players]`,
      );
    }

    // Send welcome
    client.send("welcome", {
      sessionId: client.sessionId,
      playerIndex: this.state.spPlayers.get(client.sessionId)?.playerIndex ?? 0,
      isHost: auth.uid === this.state.hostUid,
    });

    // Send canvas snapshot if joining mid-turn
    if (this.state.turnSubphase === "drawing" && this.canvasOps.length > 0) {
      client.send("canvas_snapshot", { ops: this.canvasOps });
    }
  }

  // =========================================================================
  // Lifecycle: onLeave
  // =========================================================================

  async onLeave(client: Client, _code: number): Promise<void> {
    // Spectator leave
    if (this.spectatorSessionIds.has(client.sessionId)) {
      this.spectatorSessionIds.delete(client.sessionId);
      this.state.spectators.delete(client.sessionId);
      this.state.spectatorCount = this.state.spectators.size;
      this.roomLog.info(`[sketch_party] Spectator left: ${client.sessionId}`);
      return;
    }

    const player = this.state.spPlayers.get(client.sessionId);
    if (player) {
      player.connected = false;
    }

    const consented = _code >= 4000 || _code === 1000;

    if (!consented) {
      try {
        const timeout = parseInt(
          process.env.RECONNECTION_TIMEOUT_PARTY || "30",
          10,
        );
        await this.allowReconnection(client, timeout);

        // Reconnected
        if (player) {
          player.connected = true;
        }
        this.roomLog.info(
          `[sketch_party] Player reconnected: ${client.sessionId}`,
        );
        return;
      } catch {
        // Reconnection timed out
      }
    }

    // Permanent leave
    const uid = this.sessionToUid.get(client.sessionId);
    this.state.spPlayers.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.sessionToUid.delete(client.sessionId);
    if (uid) this.uidToSessionId.delete(uid);

    this.roomLog.info(
      `[sketch_party] Player left permanently: ${client.sessionId}`,
    );

    // If game is active, handle drawer leaving or insufficient players
    if (this.state.phase === "playing" || this.state.phase === "countdown") {
      const activePlayers = this._getActivePlayers();
      if (activePlayers.length < 2) {
        this._finishGame();
        return;
      }

      // If the drawer left, skip to reveal
      if (uid && uid === this.state.currentDrawerUid) {
        this._clearTurnTimers();
        this._endTurnReveal();
      }
    }
  }

  // =========================================================================
  // Lifecycle: onDispose
  // =========================================================================

  async onDispose(): Promise<void> {
    this._clearTurnTimers();

    if (this.state.phase === "finished") {
      try {
        const duration = this.gameStartedAt
          ? Date.now() - this.gameStartedAt
          : 0;

        // Build per-player gameSpecific stats for achievement evaluation
        const perPlayerStats: Record<string, Record<string, number>> = {};
        this.state.spPlayers.forEach((p: SketchPartyPlayer) => {
          const s = this.playerAchievementStats.get(p.uid);
          perPlayerStats[p.uid] = {
            correctGuesses: s?.correctGuesses ?? 0,
            drawingTurns: s?.drawingTurns ?? 0,
            perfectDrawerTurns: s?.perfectDrawerTurns ?? 0,
            fastestGuessMs: s?.fastestGuessMs ?? 0,
            totalGuesserPoints: s?.totalGuesserPoints ?? 0,
            totalDrawerPoints: s?.totalDrawerPoints ?? 0,
            firstGuessCount: s?.firstGuessCount ?? 0,
            bestScore: p.score,
          };
        });

        await persistGameResult(
          this.state as unknown as BaseGameState,
          duration,
          perPlayerStats,
        );
      } catch (err) {
        this.roomLog.error(
          "[sketch_party] Failed to persist game result:",
          err,
        );
      }
    }
    this.roomLog.info(`[sketch_party] Room disposed: ${this.roomId}`);
  }

  // =========================================================================
  // Message Registration
  // =========================================================================

  private _registerMessages(): void {
    // --- Lobby: ready ---
    this.onMessage("ready", (client: Client) => {
      if (this._isSpectator(client)) return;
      if (this.state.phase !== "waiting") return;
      const player = this.state.spPlayers.get(client.sessionId);
      if (!player) return;
      player.ready = true;
      this.roomLog.info(`[sketch_party] Player ready: ${player.displayName}`);
      this._checkAutoStart();
    });

    // --- Lobby: host force start ---
    this.onMessage("start_game", (client: Client) => {
      if (this._isSpectator(client)) return;
      if (this.state.phase !== "waiting") return;
      const player = this.state.spPlayers.get(client.sessionId);
      if (!player || player.uid !== this.state.hostUid) return;

      const activePlayers = this._getActivePlayers();
      if (activePlayers.length < 2) {
        client.send("error", {
          message: "Need at least 2 players to start",
        });
        return;
      }

      this.roomLog.info(
        `[sketch_party] Game force-started by host: ${player.displayName}`,
      );
      this._startCountdown();
    });

    // --- Lobby: host update settings ---
    this.onMessage(
      "update_settings",
      (client: Client, payload: Record<string, unknown>) => {
        if (this._isSpectator(client)) return;
        if (this.state.phase !== "waiting") return;
        const player = this.state.spPlayers.get(client.sessionId);
        if (!player || player.uid !== this.state.hostUid) return;

        if (typeof payload.rounds === "number") {
          this.state.rounds = Math.max(
            1,
            Math.min(10, Math.round(payload.rounds)),
          );
        }
        if (typeof payload.drawTimeSec === "number") {
          this.state.drawTimeSec = Math.max(
            30,
            Math.min(180, Math.round(payload.drawTimeSec)),
          );
        }
        if (typeof payload.wordChoiceCount === "number") {
          this.state.wordChoiceCount = Math.max(
            2,
            Math.min(5, Math.round(payload.wordChoiceCount)),
          );
        }
        if (typeof payload.hints === "number") {
          this.state.hints = Math.max(
            0,
            Math.min(5, Math.round(payload.hints)),
          );
        }

        this.roomLog.info(
          `[sketch_party] Settings updated by host: rounds=${this.state.rounds} drawTime=${this.state.drawTimeSec}`,
        );
      },
    );

    // --- Drawing turn: choose word ---
    this.onMessage(
      "choose_word",
      (client: Client, payload: { index: number }) => {
        if (this._isSpectator(client)) return;
        if (this.state.turnSubphase !== "choosing") return;
        const player = this.state.spPlayers.get(client.sessionId);
        if (!player || player.uid !== this.state.currentDrawerUid) return;

        const idx = payload.index;
        if (idx < 0 || idx >= this.wordChoices.length) return;

        const word = this.wordChoices[idx];
        this.roomLog.info(`[sketch_party] Drawer chose: "${word}"`);
        this._clearChooseTimer();
        this._beginDrawing(word);
      },
    );

    // --- Guess ---
    this.onMessage("guess", (client: Client, payload: { text: string }) => {
      if (this._isSpectator(client)) return;
      if (this.state.phase !== "playing") return;
      if (this.state.turnSubphase !== "drawing") return;

      const player = this.state.spPlayers.get(client.sessionId);
      if (!player) return;
      if (player.uid === this.state.currentDrawerUid) return;
      if (player.hasGuessed) return;

      // Rate limit
      const now = Date.now();
      let bucket = this.guessBuckets.get(client.sessionId);
      if (!bucket) {
        bucket = { tokens: GUESS_BUCKET_SIZE, lastRefill: now };
        this.guessBuckets.set(client.sessionId, bucket);
      }
      if (!checkGuessBucket(bucket, now)) {
        client.send("chat", {
          sessionId: "__system__",
          displayName: "System",
          text: "Slow down! You're guessing too fast.",
          isSystem: true,
          kind: "warning",
        });
        return;
      }

      const guessNorm = normalizeText(payload.text || "");
      const answerNorm = normalizeText(this.secretWord);

      if (!guessNorm) return;

      // Check for correct guess
      if (guessNorm === answerNorm) {
        this._handleCorrectGuess(client, player, now);
      } else {
        // Broadcast as normal chat
        this.broadcast("chat", {
          sessionId: client.sessionId,
          displayName: player.displayName,
          text: payload.text,
          isCorrect: false,
          kind: "chat",
        });
      }
    });

    // --- Canvas: draw_begin ---
    this.onMessage("draw_begin", (client: Client, payload: any) => {
      if (this._isSpectator(client)) return;
      if (!this._isCurrentDrawer(client)) return;
      if (this.state.turnSubphase !== "drawing") return;

      const op = { type: "begin", ...payload };
      this.canvasOps.push(op);
      this.broadcast("draw_op", op, { except: client });
    });

    // --- Canvas: draw_points ---
    this.onMessage("draw_points", (client: Client, payload: any) => {
      if (this._isSpectator(client)) return;
      if (!this._isCurrentDrawer(client)) return;
      if (this.state.turnSubphase !== "drawing") return;

      // Rate limit: max N per second
      const now = Date.now();
      let rl = this.drawRateLimits.get(client.sessionId);
      if (!rl || now - rl.windowStart >= 1000) {
        rl = { count: 0, windowStart: now };
        this.drawRateLimits.set(client.sessionId, rl);
      }
      if (rl.count >= DRAW_POINTS_PER_SEC) return;
      rl.count++;

      // Validate points array
      if (payload.points) {
        if (!Array.isArray(payload.points)) return;
        if (payload.points.length > MAX_DRAW_POINTS_PER_MSG) return;
        if (payload.points.length % 2 !== 0) return;
        for (const v of payload.points) {
          if (typeof v !== "number" || v < 0 || v > MAX_DRAW_COORD) return;
        }
      }

      const op = { type: "points", ...payload };
      this.canvasOps.push(op);
      this.broadcast("draw_op", op, { except: client });
    });

    // --- Canvas: draw_end ---
    this.onMessage("draw_end", (client: Client, payload: any) => {
      if (this._isSpectator(client)) return;
      if (!this._isCurrentDrawer(client)) return;
      if (this.state.turnSubphase !== "drawing") return;

      const op = { type: "end", ...payload };
      this.canvasOps.push(op);
      this.broadcast("draw_op", op, { except: client });
    });

    // --- Canvas: draw_undo ---
    this.onMessage("draw_undo", (client: Client) => {
      if (this._isSpectator(client)) return;
      if (!this._isCurrentDrawer(client)) return;
      if (this.state.turnSubphase !== "drawing") return;

      let i = this.canvasOps.length - 1;
      while (i >= 0 && this.canvasOps[i]?.type !== "begin") {
        i--;
      }
      if (i >= 0) {
        this.canvasOps.splice(i);
      }
      this.broadcast("draw_op", { type: "undo" }, { except: client });
    });

    // --- Canvas: draw_clear ---
    this.onMessage("draw_clear", (client: Client) => {
      if (this._isSpectator(client)) return;
      if (!this._isCurrentDrawer(client)) return;
      if (this.state.turnSubphase !== "drawing") return;

      this.canvasOps = [];
      this.broadcast("draw_op", { type: "clear" }, { except: client });
    });

    // --- App state ---
    this.onMessage(
      "app_state",
      (client: Client, payload: { state: string }) => {
        this.roomLog.info(
          `[sketch_party] App state: ${client.sessionId} → ${payload.state}`,
        );
      },
    );
  }

  // =========================================================================
  // Auto-Start Check
  // =========================================================================

  private _checkAutoStart(): void {
    if (this.state.phase !== "waiting") return;

    const activePlayers = this._getActivePlayers();
    if (activePlayers.length < 2) return;

    const allReady = activePlayers.every((p) => p.ready);
    if (allReady) {
      this.roomLog.info("[sketch_party] All players ready — auto-starting");
      this._startCountdown();
    }
  }

  // =========================================================================
  // Countdown → Playing
  // =========================================================================

  private _startCountdown(): void {
    this.state.phase = "countdown";
    this.state.countdown = 3;
    this.gameStartedAt = Date.now();

    const interval = this.clock.setInterval(() => {
      this.state.countdown--;
      if (this.state.countdown <= 0) {
        interval.clear();
        this.state.phase = "playing";
        this.state.roundNumber = 1;
        this.state.turnIndex = 0;
        this._startTurn();
      }
    }, 1000);
  }

  // =========================================================================
  // Turn Engine
  // =========================================================================

  private _startTurn(): void {
    const playerCount = this.state.playerOrder.length;
    if (playerCount === 0) {
      this._finishGame();
      return;
    }

    // Determine drawer UID from playerOrder rotation
    const drawerUid =
      this.state.playerOrder[this.state.turnIndex % playerCount];

    // Check if drawer is still connected
    const drawerSession = this.uidToSessionId.get(drawerUid);
    const drawerPlayer = drawerSession
      ? this.state.spPlayers.get(drawerSession)
      : null;

    if (!drawerPlayer || !drawerPlayer.connected) {
      // Skip disconnected drawer
      this._advanceTurnIndex();
      return;
    }

    // Reset per-turn state for all players
    this.state.spPlayers.forEach((p: SketchPartyPlayer) => {
      p.hasGuessed = false;
      p.guessedAtMs = 0;
      p.guessRank = 0;
      p.isDrawer = p.uid === drawerUid;
    });

    this.state.currentDrawerUid = drawerUid;
    this.canvasOps = [];
    this.secretWord = "";
    this.revealedIndices.clear();
    this.lastCorrectGuessAt = 0;
    this.state.correctGuessCount = 0;
    this.state.wordMask = "";
    this.state.wordLength = 0;
    this.state.revealedCount = 0;

    // Count max guessers for rank bonus
    this.maxGuessersThisTurn = this._getActivePlayers().filter(
      (p) => p.uid !== drawerUid,
    ).length;

    // Generate word choices
    this.wordChoices = pickWords(
      this.wordPool,
      this.state.wordChoiceCount,
      this.usedWords,
    );

    // Set choosing phase
    this.state.turnSubphase = "choosing";
    const now = Date.now();
    this.state.chooseEndsAt = now + DEFAULT_CHOOSE_TIME_SEC * 1000;

    // Send word choices to drawer only
    if (drawerSession) {
      const drawerClient = this.clients.find(
        (c) => c.sessionId === drawerSession,
      );
      if (drawerClient) {
        drawerClient.send("word_choices", { words: this.wordChoices });
      }
    }

    // System message
    this.broadcast("chat", {
      sessionId: "__system__",
      displayName: "System",
      text: `${drawerPlayer.displayName} is choosing a word...`,
      isSystem: true,
      kind: "system",
    });

    this.roomLog.info(
      `[sketch_party] Turn started: drawer=${drawerPlayer.displayName} round=${this.state.roundNumber}`,
    );

    // Choose timeout: auto-pick first word
    this.chooseTimer = this.clock.setTimeout(() => {
      if (this.state.turnSubphase === "choosing") {
        this.roomLog.info(
          "[sketch_party] Choose timeout — auto-picking word 0",
        );
        this._beginDrawing(this.wordChoices[0]);
      }
    }, DEFAULT_CHOOSE_TIME_SEC * 1000);
  }

  // =========================================================================
  // Begin Drawing Phase
  // =========================================================================

  private _beginDrawing(word: string): void {
    this._clearChooseTimer();

    this.secretWord = word;
    this.usedWords.add(word.toLowerCase());

    // Build mask
    this.state.wordLength = word.length;
    this.state.wordMask = buildInitialMask(word, this.state.wordMode);
    this.state.revealedCount = 0;
    this.revealedIndices.clear();
    this.state.correctGuessCount = 0;

    // Timing
    const now = Date.now();
    this.state.turnStartedAt = now;
    this.state.turnEndsAt = now + this.state.drawTimeSec * 1000;
    this.state.turnSubphase = "drawing";

    // Send the chosen word privately to the drawer
    const drawerSession = this.uidToSessionId.get(this.state.currentDrawerUid);
    if (drawerSession) {
      const drawerClient = this.clients.find(
        (c) => c.sessionId === drawerSession,
      );
      if (drawerClient) {
        drawerClient.send("drawer_word", { word });
      }
    }

    // System message
    const drawerPlayer = drawerSession
      ? this.state.spPlayers.get(drawerSession)
      : null;
    this.broadcast("chat", {
      sessionId: "__system__",
      displayName: "System",
      text: `${drawerPlayer?.displayName ?? "Drawer"} is drawing now!`,
      isSystem: true,
      kind: "system",
    });

    // Schedule hints (normal/combination only)
    this._scheduleHints();

    // Turn end timer
    this.turnTimer = this.clock.setTimeout(() => {
      if (this.state.turnSubphase === "drawing") {
        this._endTurnReveal();
      }
    }, this.state.drawTimeSec * 1000);
  }

  // =========================================================================
  // Hint Scheduling
  // =========================================================================

  private _scheduleHints(): void {
    if (this.state.wordMode === "hidden") return;
    if (this.state.hints <= 0) return;

    const drawTimeMs = this.state.drawTimeSec * 1000;
    const hintCount = Math.min(this.state.hints, this.state.wordLength - 1);

    for (let h = 0; h < hintCount; h++) {
      // Evenly space hints through the drawing time
      const delayMs = Math.round((drawTimeMs * (h + 1)) / (hintCount + 1));

      const timer = this.clock.setTimeout(() => {
        if (this.state.turnSubphase !== "drawing") return;

        const { newMask, revealedIndex } = revealLetterInMask(
          this.state.wordMask,
          this.secretWord,
          this.revealedIndices,
        );
        if (revealedIndex >= 0) {
          this.revealedIndices.add(revealedIndex);
          this.state.wordMask = newMask;
          this.state.revealedCount = this.revealedIndices.size;

          this.broadcast("hint_revealed", {
            mask: newMask,
            revealedCount: this.state.revealedCount,
          });
        }
      }, delayMs);

      this.hintTimers.push(timer);
    }
  }

  // =========================================================================
  // Correct Guess Handling
  // =========================================================================

  private _handleCorrectGuess(
    client: Client,
    player: SketchPartyPlayer,
    now: number,
  ): void {
    player.hasGuessed = true;
    player.guessedAtMs = now - this.state.turnStartedAt;
    this.state.correctGuessCount++;
    player.guessRank = this.state.correctGuessCount;
    this.lastCorrectGuessAt = now;

    // Calculate and apply guesser points
    const guesserPoints = this._calcGuesserPoints(now, player.guessRank);
    player.score += guesserPoints;

    // ── Achievement stats: guesser ──────────────────────────────────────
    const gStats = this._ensureStats(player.uid);
    gStats.correctGuesses++;
    gStats.totalGuesserPoints += guesserPoints;
    if (player.guessRank === 1) gStats.firstGuessCount++;
    const guessMs = player.guessedAtMs; // ms since turn start
    if (gStats.fastestGuessMs === 0 || guessMs < gStats.fastestGuessMs) {
      gStats.fastestGuessMs = guessMs;
    }

    // Broadcast
    this.broadcast("player_guessed", {
      uid: player.uid,
      displayName: player.displayName,
      guessRank: player.guessRank,
      pointsEarned: guesserPoints,
    });

    this.broadcast("chat", {
      sessionId: "__system__",
      displayName: "System",
      text: `${player.displayName} guessed the word! (+${guesserPoints})`,
      isSystem: true,
      kind: "correct",
    });

    // Pacing: if this is first correct guess and >30s remaining, shorten
    if (
      this.state.correctGuessCount === 1 &&
      this.state.turnEndsAt - now > PACING_THRESHOLD_SEC * 1000
    ) {
      const newEnd = now + PACING_THRESHOLD_SEC * 1000;
      this.state.turnEndsAt = newEnd;

      // Reschedule turn timer
      this._clearTurnTimer();
      this.turnTimer = this.clock.setTimeout(() => {
        if (this.state.turnSubphase === "drawing") {
          this._endTurnReveal();
        }
      }, PACING_THRESHOLD_SEC * 1000);
    }

    // Check if all non-drawer players have guessed
    const nonDrawerPlayers = this._getActivePlayers().filter(
      (p) => p.uid !== this.state.currentDrawerUid,
    );
    const allGuessed = nonDrawerPlayers.every((p) => p.hasGuessed);
    if (allGuessed) {
      this._clearTurnTimers();
      this._endTurnReveal();
    }
  }

  // =========================================================================
  // End Turn — Reveal
  // =========================================================================

  private _endTurnReveal(): void {
    this._clearTurnTimers();
    this.state.turnSubphase = "reveal";

    const now = Date.now();
    this.state.revealEndsAt = now + DEFAULT_REVEAL_TIME_SEC * 1000;

    // Calculate drawer points
    const drawerPoints = this._calcDrawerPoints();
    const drawerSession = this.uidToSessionId.get(this.state.currentDrawerUid);
    if (drawerSession) {
      const drawer = this.state.spPlayers.get(drawerSession);
      if (drawer) {
        drawer.score += drawerPoints;
      }
    }

    // ── Achievement stats: drawer ──────────────────────────────────────
    const dStats = this._ensureStats(this.state.currentDrawerUid);
    dStats.drawingTurns++;
    dStats.totalDrawerPoints += drawerPoints;
    // Perfect turn = every non-drawer guessed
    const nonDrawers = this._getActivePlayers().filter(
      (p) => p.uid !== this.state.currentDrawerUid,
    );
    if (nonDrawers.length > 0 && nonDrawers.every((p) => p.hasGuessed)) {
      dStats.perfectDrawerTurns++;
    }

    // Build score deltas for broadcast
    const deltas: Array<{ uid: string; delta: number }> = [];
    const scores: Array<{ uid: string; score: number }> = [];

    this.state.spPlayers.forEach((p: SketchPartyPlayer) => {
      let delta = 0;
      if (p.uid === this.state.currentDrawerUid) {
        delta = drawerPoints;
      } else if (p.hasGuessed) {
        delta = this._calcGuesserPoints(
          this.state.turnStartedAt + p.guessedAtMs,
          p.guessRank,
        );
      }
      deltas.push({ uid: p.uid, delta });
      scores.push({ uid: p.uid, score: p.score });
    });

    this.broadcast("turn_reveal", {
      word: this.secretWord,
      deltas,
      scores,
    });

    // After reveal delay, advance turn
    this.revealTimer = this.clock.setTimeout(() => {
      this._advanceTurnIndex();
    }, DEFAULT_REVEAL_TIME_SEC * 1000);
  }

  // =========================================================================
  // Turn Advancement
  // =========================================================================

  private _advanceTurnIndex(): void {
    const playerCount = this.state.playerOrder.length;
    if (playerCount === 0) {
      this._finishGame();
      return;
    }

    this.state.turnIndex++;
    const totalTurns = this.state.rounds * playerCount;

    if (this.state.turnIndex >= totalTurns) {
      this._finishGame();
      return;
    }

    // Update round number (1-indexed)
    this.state.roundNumber = Math.floor(this.state.turnIndex / playerCount) + 1;

    this._startTurn();
  }

  // =========================================================================
  // Finish Game
  // =========================================================================

  private _finishGame(): void {
    this._clearTurnTimers();
    this.state.phase = "finished";
    this.state.turnSubphase = "lobby";

    // Find winner (highest score)
    let maxScore = -1;
    let winnerId = "";
    this.state.spPlayers.forEach((p: SketchPartyPlayer) => {
      if (p.score > maxScore) {
        maxScore = p.score;
        winnerId = p.uid;
      }
    });
    this.state.winnerId = winnerId;
    this.state.winReason = "score";

    // Build final scores
    const finalScores: Array<{
      uid: string;
      displayName: string;
      score: number;
    }> = [];
    this.state.spPlayers.forEach((p: SketchPartyPlayer) => {
      finalScores.push({
        uid: p.uid,
        displayName: p.displayName,
        score: p.score,
      });
    });
    finalScores.sort((a, b) => b.score - a.score);

    this.broadcast("game_over", {
      winnerId,
      finalScores,
    });

    this.roomLog.info(
      `[sketch_party] Game finished: winner=${winnerId} (${maxScore} pts)`,
    );
  }

  // =========================================================================
  // Scoring Formulas
  // =========================================================================

  /**
   * Guesser points on correct guess.
   *
   * totalMs = drawTimeSec * 1000
   * remainingMs = max(0, turnEndsAt - now)
   * speedFactor = clamp(remainingMs / totalMs, 0..1)
   * base = 50 + round(450 * speedFactor)
   * rankBonus = max(0, (maxGuessers - guessRank)) * 10
   * points = clamp(base + rankBonus, 50..600)
   */
  private _calcGuesserPoints(
    guessTimestamp: number,
    guessRank: number,
  ): number {
    const totalMs = this.state.drawTimeSec * 1000;
    const remainingMs = Math.max(0, this.state.turnEndsAt - guessTimestamp);
    const speedFactor = clamp(remainingMs / totalMs, 0, 1);
    const base = 50 + Math.round(450 * speedFactor);
    const rankBonus = Math.max(0, this.maxGuessersThisTurn - guessRank) * 10;
    return clamp(base + rankBonus, 50, 600);
  }

  /**
   * Drawer points at turn end.
   *
   * if correctGuessCount == 0 → 0
   * drawerBase = 50 * correctGuessCount
   * drawerSpeedBonus = round(200 * (remainingAtLastCorrect / totalMs))
   * drawerPoints = drawerBase + drawerSpeedBonus
   */
  private _calcDrawerPoints(): number {
    if (this.state.correctGuessCount === 0) return 0;

    const totalMs = this.state.drawTimeSec * 1000;
    const remainingAtLast = this.lastCorrectGuessAt
      ? Math.max(0, this.state.turnEndsAt - this.lastCorrectGuessAt)
      : 0;
    const drawerBase = 50 * this.state.correctGuessCount;
    const drawerSpeedBonus = Math.round(200 * (remainingAtLast / totalMs));
    return drawerBase + drawerSpeedBonus;
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private _addSpectator(client: Client, auth: any): void {
    this.spectatorSessionIds.add(client.sessionId);

    const entry = new SpectatorEntry();
    entry.uid = auth.uid;
    entry.sessionId = client.sessionId;
    entry.displayName = auth.displayName || "Spectator";
    entry.avatarUrl = auth.avatarUrl || "";
    entry.joinedAt = Date.now();
    this.state.spectators.set(client.sessionId, entry);
    this.state.spectatorCount = this.state.spectators.size;

    // Send canvas snapshot
    if (this.canvasOps.length > 0) {
      client.send("canvas_snapshot", { ops: this.canvasOps });
    }

    this.roomLog.info(
      `[sketch_party] Spectator joined: ${auth.displayName} (${client.sessionId})`,
    );
  }

  private _isSpectator(client: Client): boolean {
    return this.spectatorSessionIds.has(client.sessionId);
  }

  private _isCurrentDrawer(client: Client): boolean {
    const player = this.state.spPlayers.get(client.sessionId);
    return !!player && player.uid === this.state.currentDrawerUid;
  }

  private _getActivePlayers(): SketchPartyPlayer[] {
    const result: SketchPartyPlayer[] = [];
    this.state.spPlayers.forEach((p: SketchPartyPlayer) => {
      if (p.connected) result.push(p);
    });
    return result;
  }

  // =========================================================================
  // Timer Cleanup
  // =========================================================================

  private _clearChooseTimer(): void {
    if (this.chooseTimer) {
      this.chooseTimer.clear();
      this.chooseTimer = null;
    }
  }

  private _clearTurnTimer(): void {
    if (this.turnTimer) {
      this.turnTimer.clear();
      this.turnTimer = null;
    }
  }

  private _clearTurnTimers(): void {
    this._clearChooseTimer();
    this._clearTurnTimer();

    if (this.revealTimer) {
      this.revealTimer.clear();
      this.revealTimer = null;
    }

    for (const ht of this.hintTimers) {
      ht.clear();
    }
    this.hintTimers = [];
  }
}

// =============================================================================
// Utility
// =============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
