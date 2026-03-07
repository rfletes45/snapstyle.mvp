/**
 * Sketch Party — Colyseus Room (Authoritative Game Server)
 *
 * Manages the full lifecycle of a Sketch Party match:
 * - Player join/leave with membership verification
 * - Turn phases: choosing → drawing → turn_end → next turn or match_end
 * - Stroke relay (only from current drawer)
 * - Guess checking with scoring
 * - Hint scheduling
 * - Match resolution via Firebase Cloud Functions bridge
 *
 * Security: Only the current drawer may send stroke messages.
 * All scoring is server-authoritative.
 *
 * @module rooms/SketchPartyRoom
 */

import { Client, Room } from "colyseus";
import {
  computeDrawerGainPerGuesser,
  computeGuesserPoints,
  computeTimeBonus,
} from "../data/scoring";
import {
  computeMaskedWord,
  isCorrectGuess,
  pickRandomWords,
} from "../data/wordBank";

// =============================================================================
// Types
// =============================================================================

interface PlayerInfo {
  uid: string;
  displayName: string;
  sessionId: string; // Colyseus client sessionId
  connected: boolean;
}

interface StrokeData {
  strokeId: string;
  tool: "pen" | "eraser";
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

interface PlayerMetrics {
  totalScore: number;
  correctGuesses: number;
  firstCorrectCount: number;
  totalGuessTimeSec: number;
  turnsDrawn: number;
  allGuessedTurns: number; // turns where ≥75% guessed
}

interface RoomSettings {
  maxPlayers: number;
  rounds: number;
  drawTimeSec: number;
  turnChooseTimeSec: number;
  wordChoices: number;
  hints: number;
  customWordsEnabled: boolean;
  customWordsList: string;
}

// =============================================================================
// Room State (broadcast to clients)
// =============================================================================

interface SketchPartyState {
  phase: "waiting" | "choosing" | "drawing" | "turn_end" | "match_end";
  currentRound: number;
  totalRounds: number;
  currentTurnIndex: number;
  drawerId: string;
  turnOrder: string[];
  maskedWord: string;
  wordLength: number;
  secretWord: string; // filtered per-client
  scores: Record<string, number>;
  correctGuessers: string[];
  timeRemainingSec: number;
  drawTimeSec: number;
  hintsUsed: number;
  maxHints: number;
  wordChoices: string[];
  players: Array<{ uid: string; displayName: string; connected: boolean }>;
  effectiveSettings: RoomSettings;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_STROKES_PER_TURN = 500;
const TURN_END_DELAY_MS = 4000;
const MAX_REPLAY_BUFFER_SIZE = 2000; // max points across all strokes
const GUESS_RATE_LIMIT_MS = 400; // min ms between guesses per player
const REACTION_RATE_LIMIT_MS = 1200; // min ms between reactions per player
const VALID_REACTIONS = new Set(["thumbsup", "thumbsdown", "fire", "laugh"]);

// =============================================================================
// Room Implementation
// =============================================================================

export class SketchPartyRoom extends Room {
  /** Game state — broadcast to clients via "state_sync" messages (not Schema). */
  private gs: SketchPartyState = {} as SketchPartyState;

  private players = new Map<string, PlayerInfo>(); // uid → info
  private settings: RoomSettings = {
    maxPlayers: 8,
    rounds: 3,
    drawTimeSec: 80,
    turnChooseTimeSec: 10,
    wordChoices: 3,
    hints: 2,
    customWordsEnabled: false,
    customWordsList: "",
  };
  private sessionId = ""; // V4 session ID
  private turnOrder: string[] = [];
  private currentRound = 1;
  private currentTurnIdx = 0;
  private secretWord = "";
  private drawStartTime = 0;
  private turnTimer: ReturnType<typeof setInterval> | null = null;
  private chooseTimer: ReturnType<typeof setTimeout> | null = null;
  private hintTimers: ReturnType<typeof setTimeout>[] = [];
  private strokes: StrokeData[] = [];
  private correctGuessersSet = new Set<string>();
  private playerMetrics = new Map<string, PlayerMetrics>();
  private usedWords = new Set<string>();
  private hintsUsed = 0;
  private guessTimestamps = new Map<string, number>(); // uid → last guess time (rate limit)
  private reactionTimestamps = new Map<string, number>(); // uid → last reaction time (rate limit)

  // ── Lifecycle ────────────────────────────────────────────────────────

  onCreate(options: Record<string, unknown>) {
    this.sessionId = (options.sessionId as string) ?? "";
    this.maxClients = 8;

    // Apply settings from session if provided
    if (options.settings && typeof options.settings === "object") {
      const s = options.settings as Record<string, unknown>;
      if (typeof s.maxPlayers === "number")
        this.settings.maxPlayers = Math.max(2, Math.min(8, s.maxPlayers));
      if (typeof s.rounds === "number")
        this.settings.rounds = Math.max(1, Math.min(10, s.rounds));
      if (typeof s.drawTimeSec === "number")
        this.settings.drawTimeSec = Math.max(30, Math.min(180, s.drawTimeSec));
      if (typeof s.turnChooseTimeSec === "number")
        this.settings.turnChooseTimeSec = Math.max(
          5,
          Math.min(15, s.turnChooseTimeSec),
        );
      if (typeof s.wordChoices === "number")
        this.settings.wordChoices = Math.max(1, Math.min(5, s.wordChoices));
      if (typeof s.hints === "number")
        this.settings.hints = Math.max(0, Math.min(3, s.hints));
      if (typeof s.customWordsEnabled === "boolean")
        this.settings.customWordsEnabled = s.customWordsEnabled;
      if (typeof s.customWordsList === "string")
        this.settings.customWordsList = s.customWordsList.slice(0, 2000);
    }
    this.maxClients = this.settings.maxPlayers;

    // Initialize game state (broadcast via messages, NOT Schema state)
    this.gs = {
      phase: "waiting",
      currentRound: 1,
      totalRounds: this.settings.rounds,
      currentTurnIndex: 0,
      drawerId: "",
      turnOrder: [],
      maskedWord: "",
      wordLength: 0,
      secretWord: "",
      scores: {},
      correctGuessers: [],
      timeRemainingSec: this.settings.drawTimeSec,
      drawTimeSec: this.settings.drawTimeSec,
      hintsUsed: 0,
      maxHints: this.settings.hints,
      wordChoices: [],
      players: [],
      effectiveSettings: { ...this.settings },
    };

    console.log(
      `[SketchParty] Room created for session ${this.sessionId} with settings:`,
      JSON.stringify(this.settings),
    );

    // Register message handlers
    // Broadcast state to all clients on a 1-second tick
    this.clock.setInterval(() => this.broadcastState(), 1000);

    this.onMessage("stroke_begin", this.handleStrokeBegin.bind(this));
    this.onMessage("stroke_points", this.handleStrokePoints.bind(this));
    this.onMessage("stroke_end", this.handleStrokeEnd.bind(this));
    this.onMessage("guess", this.handleGuess.bind(this));
    this.onMessage("word_choice", this.handleWordChoice.bind(this));
    this.onMessage("undo", this.handleUndo.bind(this));
    this.onMessage("clear", this.handleClear.bind(this));
    this.onMessage("reaction", this.handleReaction.bind(this));
  }

  onJoin(client: Client, options: Record<string, unknown>) {
    const uid = options.uid as string;
    const displayName = (options.displayName as string) ?? "Player";

    // Reconnect check
    const existing = this.players.get(uid);
    if (existing) {
      existing.sessionId = client.sessionId;
      existing.connected = true;
      this.syncPlayersState();

      // Send board snapshot for reconnect
      client.send("board_snapshot", { strokes: this.strokes });
      return;
    }

    const info: PlayerInfo = {
      uid,
      displayName,
      sessionId: client.sessionId,
      connected: true,
    };
    this.players.set(uid, info);

    if (!this.gs.scores[uid]) {
      this.gs.scores[uid] = 0;
    }
    if (!this.playerMetrics.has(uid)) {
      this.playerMetrics.set(uid, {
        totalScore: 0,
        correctGuesses: 0,
        firstCorrectCount: 0,
        totalGuessTimeSec: 0,
        turnsDrawn: 0,
        allGuessedTurns: 0,
      });
    }

    this.syncPlayersState();

    // Send current state to the joining client immediately
    client.send("state_sync", this.getPublicState());
    // Send effective settings so client can display them
    client.send("settings_applied", { ...this.settings });
    // Send board snapshot for reconnect / late join
    client.send("board_snapshot", { strokes: this.strokes });

    console.log(
      `[SketchParty] ${displayName} (${uid}) joined room ${this.roomId}. Players: ${this.players.size}`,
    );
    this.broadcastChat(null, `${displayName} joined the game`, true, false);
    this.broadcastState();

    // Start game when we have enough players and phase is waiting
    if (this.gs.phase === "waiting" && this.players.size >= 2) {
      this.startMatch();
    }
  }

  onLeave(client: Client, _consented: boolean) {
    // Find player by Colyseus sessionId
    for (const [uid, info] of this.players) {
      if (info.sessionId === client.sessionId) {
        info.connected = false;

        // If drawer disconnects during drawing, skip turn
        if (this.gs.drawerId === uid && this.gs.phase === "drawing") {
          this.endTurn(true);
        }

        this.syncPlayersState();
        this.broadcastChat(
          null,
          `${info.displayName} disconnected`,
          true,
          false,
        );

        // Check if all players disconnected
        const connectedCount = Array.from(this.players.values()).filter(
          (p) => p.connected,
        ).length;
        if (connectedCount === 0) {
          this.endMatch("disconnect");
        }
        break;
      }
    }
  }

  onDispose() {
    this.clearTimers();
  }

  // ── Match flow ────────────────────────────────────────────────────

  private startMatch() {
    this.turnOrder = Array.from(this.players.keys()).sort(
      () => Math.random() - 0.5,
    );
    this.currentRound = 1;
    this.currentTurnIdx = 0;
    this.gs.turnOrder = [...this.turnOrder];
    this.gs.totalRounds = this.settings.rounds;
    this.startTurn();
  }

  private startTurn() {
    const drawerId =
      this.turnOrder[this.currentTurnIdx % this.turnOrder.length];
    if (!drawerId) return;

    this.gs.drawerId = drawerId;
    this.gs.currentRound = this.currentRound;
    this.gs.currentTurnIndex = this.currentTurnIdx;
    this.gs.correctGuessers = [];
    this.correctGuessersSet.clear();
    this.strokes = [];
    this.hintsUsed = 0;
    this.gs.hintsUsed = 0;
    this.secretWord = "";
    this.gs.secretWord = "";
    this.gs.maskedWord = "";
    this.gs.wordLength = 0;

    // Send turn start to clear canvases
    this.broadcast("turn_start", {});

    // Update metrics
    const metrics = this.playerMetrics.get(drawerId);
    if (metrics) metrics.turnsDrawn++;

    // Enter choosing phase
    this.gs.phase = "choosing";
    const words = pickRandomWords(this.settings.wordChoices, this.usedWords);

    // Send word choices only to drawer
    const drawerClient = this.getClientByUid(drawerId);
    if (drawerClient) {
      drawerClient.send("word_choices", {
        words,
        timeRemaining: this.settings.turnChooseTimeSec,
      });
    }
    this.gs.wordChoices = words;

    // Auto-pick on timeout
    this.chooseTimer = setTimeout(() => {
      if (this.gs.phase === "choosing") {
        const randomIdx = Math.floor(Math.random() * words.length);
        this.selectWord(words[randomIdx]);
      }
    }, this.settings.turnChooseTimeSec * 1000);
  }

  private selectWord(word: string) {
    this.secretWord = word;
    this.usedWords.add(word);
    this.gs.secretWord = word; // Will be filtered per-client
    this.gs.wordLength = word.length;
    this.gs.maskedWord = computeMaskedWord(word, 0);
    this.gs.phase = "drawing";
    this.gs.timeRemainingSec = this.settings.drawTimeSec;
    this.drawStartTime = Date.now();

    if (this.chooseTimer) {
      clearTimeout(this.chooseTimer);
      this.chooseTimer = null;
    }

    // Schedule hints
    this.scheduleHints();

    // Start draw timer (1s ticks)
    this.startDrawTimer();

    this.broadcastChat(
      null,
      `${this.players.get(this.gs.drawerId)?.displayName ?? "Drawer"} is drawing!`,
      true,
      false,
    );
  }

  private scheduleHints() {
    const maxHints = this.settings.hints;
    if (maxHints <= 0) return;

    const drawTime = this.settings.drawTimeSec * 1000;
    for (let i = 1; i <= maxHints; i++) {
      const delay = (drawTime / (maxHints + 1)) * i;
      const timer = setTimeout(() => {
        if (this.gs.phase !== "drawing") return;
        this.hintsUsed = i;
        this.gs.hintsUsed = i;
        this.gs.maskedWord = computeMaskedWord(this.secretWord, i);
      }, delay);
      this.hintTimers.push(timer);
    }
  }

  private startDrawTimer() {
    this.turnTimer = setInterval(() => {
      if (this.gs.phase !== "drawing") {
        if (this.turnTimer) clearInterval(this.turnTimer);
        return;
      }
      this.gs.timeRemainingSec--;
      if (this.gs.timeRemainingSec <= 0) {
        this.endTurn(false);
      }
    }, 1000);
  }

  private endTurn(drawerDisconnected: boolean) {
    this.clearTimers();
    this.gs.phase = "turn_end";

    // Reveal word
    this.gs.maskedWord = this.secretWord;
    this.broadcast("word_reveal", { word: this.secretWord });

    // Check if drawer had ≥75% guessed
    const eligibleGuessers = this.turnOrder.filter(
      (uid) => uid !== this.gs.drawerId,
    ).length;
    const correctCount = this.correctGuessersSet.size;
    if (eligibleGuessers > 0 && correctCount / eligibleGuessers >= 0.75) {
      const metrics = this.playerMetrics.get(this.gs.drawerId);
      if (metrics) metrics.allGuessedTurns++;
    }

    const msg = drawerDisconnected
      ? `Drawer disconnected! The word was "${this.secretWord}"`
      : `Time's up! The word was "${this.secretWord}"`;
    this.broadcastChat(null, msg, true, false);

    // Broadcast turn scores
    this.broadcast("turn_scores", { scores: this.gs.scores });

    // Advance after delay
    setTimeout(() => {
      this.advanceTurn();
    }, TURN_END_DELAY_MS);
  }

  private advanceTurn() {
    this.currentTurnIdx++;

    // Check if round is complete (every player drew once)
    if (this.currentTurnIdx >= this.turnOrder.length * this.currentRound) {
      this.currentRound++;
      if (this.currentRound > this.settings.rounds) {
        this.endMatch("complete");
        return;
      }
    }

    this.startTurn();
  }

  private async endMatch(reason: "complete" | "disconnect") {
    this.clearTimers();
    this.gs.phase = "match_end";

    // Compute final placements
    const sorted = this.turnOrder
      .map((uid) => ({
        uid,
        displayName: this.players.get(uid)?.displayName ?? uid,
        score: this.gs.scores[uid] ?? 0,
        metrics: this.playerMetrics.get(uid),
      }))
      .sort((a, b) => b.score - a.score);

    const maxScore = sorted[0]?.score ?? 0;
    const winnerIds =
      reason === "disconnect"
        ? []
        : sorted
            .filter((p) => p.score === maxScore && p.score > 0)
            .map((p) => p.uid);

    const scoreboard = sorted.map((p, i) => ({
      uid: p.uid,
      displayName: p.displayName,
      score: p.score,
      placement: i + 1,
      stats: {
        correctGuesses: p.metrics?.correctGuesses ?? 0,
        firstCorrectCount: p.metrics?.firstCorrectCount ?? 0,
        turnsDrawn: p.metrics?.turnsDrawn ?? 0,
        allGuessedTurns: p.metrics?.allGuessedTurns ?? 0,
      },
    }));

    // Call Firebase Cloud Functions bridge to resolve via V4 pipeline
    try {
      const { resolveRealtimeSessionV4 } =
        await import("../bridge/firebaseBridge");
      await resolveRealtimeSessionV4(
        this.sessionId,
        reason === "disconnect"
          ? "disconnect"
          : winnerIds.length > 0
            ? "win"
            : "draw",
        winnerIds,
        scoreboard,
      );
    } catch (err) {
      console.error(
        "[SketchParty] Failed to resolve via Firebase bridge:",
        err,
      );
    }

    // Dispose room after a short delay
    setTimeout(() => {
      this.disconnect();
    }, 10000);
  }

  // ── Message handlers ──────────────────────────────────────────────

  private handleStrokeBegin(client: Client, msg: Record<string, unknown>) {
    const uid = this.getUidByClient(client);
    if (!uid || uid !== this.gs.drawerId || this.gs.phase !== "drawing") return;
    if (this.strokes.length >= MAX_STROKES_PER_TURN) return;

    const stroke: StrokeData = {
      strokeId: msg.strokeId as string,
      tool: (msg.tool as "pen" | "eraser") ?? "pen",
      color: (msg.color as string) ?? "#000000",
      width: (msg.width as number) ?? 4,
      points: [{ x: msg.x as number, y: msg.y as number }],
    };
    this.strokes.push(stroke);

    // Relay to all OTHER clients
    this.broadcast("stroke_begin", msg, { except: client });
  }

  private handleStrokePoints(client: Client, msg: Record<string, unknown>) {
    const uid = this.getUidByClient(client);
    if (!uid || uid !== this.gs.drawerId || this.gs.phase !== "drawing") return;

    const strokeId = msg.strokeId as string;
    const points = msg.points as Array<{ x: number; y: number; t: number }>;
    if (!Array.isArray(points)) return;

    // Update replay buffer
    const stroke = this.strokes.find((s) => s.strokeId === strokeId);
    if (stroke) {
      // Cap total points
      const totalPoints = this.strokes.reduce(
        (sum, s) => sum + s.points.length,
        0,
      );
      if (totalPoints + points.length > MAX_REPLAY_BUFFER_SIZE) return;

      stroke.points.push(...points.map((p) => ({ x: p.x, y: p.y })));
    }

    // Relay to all OTHER clients
    this.broadcast(
      "stroke_points",
      {
        strokeId,
        points: points.map((p) => ({ x: p.x, y: p.y })),
      },
      { except: client },
    );
  }

  private handleStrokeEnd(client: Client, msg: Record<string, unknown>) {
    const uid = this.getUidByClient(client);
    if (!uid || uid !== this.gs.drawerId) return;
    this.broadcast("stroke_end", msg, { except: client });
  }

  private handleGuess(client: Client, msg: Record<string, unknown>) {
    const uid = this.getUidByClient(client);
    if (!uid) return;
    if (uid === this.gs.drawerId) return; // Drawer cannot guess
    if (this.gs.phase !== "drawing") return;
    if (this.correctGuessersSet.has(uid)) return; // Already guessed

    const text = (msg.text as string)?.trim();
    if (!text) return;

    // Rate limit: 1 guess per GUESS_RATE_LIMIT_MS per player
    const now = Date.now();
    const lastGuess = this.guessTimestamps.get(uid) ?? 0;
    if (now - lastGuess < GUESS_RATE_LIMIT_MS) {
      client.send("chat", {
        uid: "system",
        displayName: "System",
        text: "Slow down! You're guessing too fast.",
        isCorrect: false,
        isSystem: true,
        timestamp: now,
      });
      return;
    }
    this.guessTimestamps.set(uid, now);

    const player = this.players.get(uid);
    const displayName = player?.displayName ?? uid;

    if (isCorrectGuess(text, this.secretWord)) {
      // Correct guess!
      this.correctGuessersSet.add(uid);
      this.gs.correctGuessers = Array.from(this.correctGuessersSet);

      const elapsedSec = (Date.now() - this.drawStartTime) / 1000;
      const guesserPts = computeGuesserPoints(
        this.secretWord.length,
        elapsedSec,
        this.settings.drawTimeSec,
        this.hintsUsed,
      );
      const timeBonus = computeTimeBonus(elapsedSec, this.settings.drawTimeSec);
      const drawerGain = computeDrawerGainPerGuesser(timeBonus);

      // Award points
      this.gs.scores[uid] = (this.gs.scores[uid] ?? 0) + guesserPts;
      this.gs.scores[this.gs.drawerId] =
        (this.gs.scores[this.gs.drawerId] ?? 0) + drawerGain;

      // Update metrics
      const guesserMetrics = this.playerMetrics.get(uid);
      if (guesserMetrics) {
        guesserMetrics.totalScore += guesserPts;
        guesserMetrics.correctGuesses++;
        guesserMetrics.totalGuessTimeSec += elapsedSec;
        if (this.correctGuessersSet.size === 1) {
          guesserMetrics.firstCorrectCount++;
        }
      }

      // Broadcast correct guess (without revealing the word)
      this.broadcastChat(uid, `${displayName} guessed correctly!`, false, true);

      // Check if all non-drawer players guessed
      const eligibleGuessers = this.turnOrder.filter(
        (id) => id !== this.gs.drawerId && this.players.get(id)?.connected,
      );
      if (
        eligibleGuessers.length > 0 &&
        eligibleGuessers.every((id) => this.correctGuessersSet.has(id))
      ) {
        // All guessed — end turn early
        this.broadcastChat(null, "Everyone guessed correctly!", true, false);
        this.endTurn(false);
      }
    } else {
      // Wrong guess — show in chat (but don't reveal if close)
      this.broadcastChat(uid, text, false, false);
    }
  }

  private handleWordChoice(client: Client, msg: Record<string, unknown>) {
    const uid = this.getUidByClient(client);
    if (!uid || uid !== this.gs.drawerId || this.gs.phase !== "choosing")
      return;

    const idx = msg.wordIndex as number;
    const choices = this.gs.wordChoices;
    if (typeof idx !== "number" || idx < 0 || idx >= choices.length) return;

    this.selectWord(choices[idx]);
  }

  private handleUndo(client: Client) {
    const uid = this.getUidByClient(client);
    if (!uid || uid !== this.gs.drawerId || this.gs.phase !== "drawing") return;

    const removed = this.strokes.pop();
    if (removed) {
      this.broadcast("undo_stroke", { strokeId: removed.strokeId });
    }
  }

  private handleClear(client: Client) {
    const uid = this.getUidByClient(client);
    if (!uid || uid !== this.gs.drawerId || this.gs.phase !== "drawing") return;

    this.strokes = [];
    this.broadcast("clear_canvas", {});
  }

  private handleReaction(client: Client, msg: Record<string, unknown>) {
    const uid = this.getUidByClient(client);
    if (!uid) return;

    const kind = msg.kind as string;
    if (!kind || !VALID_REACTIONS.has(kind)) return;

    // Rate limit
    const now = Date.now();
    const last = this.reactionTimestamps.get(uid) ?? 0;
    if (now - last < REACTION_RATE_LIMIT_MS) return;
    this.reactionTimestamps.set(uid, now);

    const player = this.players.get(uid);
    this.broadcast("reaction_event", {
      uid,
      displayName: player?.displayName ?? uid,
      kind,
      ts: now,
    });
  }

  // ── State broadcasting ────────────────────────────────────────────

  /**
   * Build a sanitized public state snapshot (no secretWord for non-drawers).
   */
  private getPublicState(): Record<string, unknown> {
    return {
      phase: this.gs.phase,
      currentRound: this.gs.currentRound,
      totalRounds: this.gs.totalRounds,
      currentTurnIndex: this.gs.currentTurnIndex,
      drawerId: this.gs.drawerId,
      turnOrder: this.gs.turnOrder,
      maskedWord: this.gs.maskedWord,
      wordLength: this.gs.wordLength,
      scores: { ...this.gs.scores },
      correctGuessers: [...this.gs.correctGuessers],
      timeRemainingSec: this.gs.timeRemainingSec,
      drawTimeSec: this.gs.drawTimeSec,
      hintsUsed: this.gs.hintsUsed,
      maxHints: this.gs.maxHints,
      players: this.gs.players,
      effectiveSettings: this.gs.effectiveSettings,
    };
  }

  /**
   * Broadcast the public state to all connected clients.
   */
  private broadcastState(): void {
    const pub = this.getPublicState();
    this.broadcast("state_sync", pub);
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private getUidByClient(client: Client): string | null {
    for (const [uid, info] of this.players) {
      if (info.sessionId === client.sessionId) return uid;
    }
    return null;
  }

  private getClientByUid(uid: string): Client | undefined {
    const info = this.players.get(uid);
    if (!info) return undefined;
    return this.clients.find((c) => c.sessionId === info.sessionId);
  }

  private syncPlayersState() {
    this.gs.players = Array.from(this.players.values()).map((p) => ({
      uid: p.uid,
      displayName: p.displayName,
      connected: p.connected,
    }));
  }

  private broadcastChat(
    uid: string | null,
    text: string,
    isSystem: boolean,
    isCorrect: boolean,
  ) {
    this.broadcast("chat", {
      uid: uid ?? "system",
      displayName: uid ? (this.players.get(uid)?.displayName ?? uid) : "System",
      text,
      isCorrect,
      isSystem,
      timestamp: Date.now(),
    });
  }

  private clearTimers() {
    if (this.turnTimer) {
      clearInterval(this.turnTimer);
      this.turnTimer = null;
    }
    if (this.chooseTimer) {
      clearTimeout(this.chooseTimer);
      this.chooseTimer = null;
    }
    for (const t of this.hintTimers) {
      clearTimeout(t);
    }
    this.hintTimers = [];
  }
}
