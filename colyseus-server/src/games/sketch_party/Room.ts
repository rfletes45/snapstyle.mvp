/**
 * Sketch Party — Room Implementation (Refactored onto BaseRealtimeRoom)
 *
 * This room extends BaseRealtimeRoom, leveraging the shared framework for:
 * - Firebase auth verification
 * - Session membership validation
 * - Reconnect / disconnect handling
 * - Resolution bridge writing
 * - Runtime summary mirroring
 * - Message rate limiting
 *
 * Game-specific logic preserved:
 * - Phase management (choosing → drawing → turn_end → match_end)
 * - Stroke relay
 * - Guess checking and scoring
 * - Hint scheduling
 * - Word bank and word choice
 *
 * @module games/sketch_party/Room
 */

import type { Client } from "colyseus";
import { BaseRealtimeRoom } from "../../core/BaseRealtimeRoom";
import type {
  RealtimeGameDefinition,
  RealtimeScoreboardEntry,
} from "../../core/types";
import {
  computeDrawerGainPerGuesser,
  computeGuesserPoints,
  computeTimeBonus,
} from "../../data/scoring";
import {
  computeMaskedWord,
  isCorrectGuess,
  pickRandomWords,
} from "../../data/wordBank";
import { SKETCH_PARTY_DEFINITION } from "./Definition";

// =============================================================================
// Types
// =============================================================================

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
  allGuessedTurns: number;
}

type SketchPhase =
  | "waiting"
  | "choosing"
  | "drawing"
  | "turn_end"
  | "match_end";

// =============================================================================
// Constants
// =============================================================================

const MAX_STROKES_PER_TURN = 500;
const TURN_END_DELAY_MS = 4000;
const MAX_REPLAY_BUFFER_SIZE = 2000;

// =============================================================================
// Room Implementation
// =============================================================================

export class SketchPartyRoomV2 extends BaseRealtimeRoom {
  // ── Game-specific state ───────────────────────────────────────────
  private sketchPhase: SketchPhase = "waiting";
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
  private scores: Record<string, number> = {};
  private drawerId = "";
  private timeRemainingSec = 80;
  private wordChoices: string[] = [];
  private chooseDeadlineAt = 0;

  // ── Framework hooks ───────────────────────────────────────────────

  protected getGameDefinition(): RealtimeGameDefinition {
    return SKETCH_PARTY_DEFINITION;
  }

  protected registerGameMessages(): void {
    // Register all Sketch Party message definitions with the message registry
    for (const def of SKETCH_PARTY_DEFINITION.messages) {
      this.messageRegistry.register(def);
    }

    // Register handlers (using raw onMessage since Sketch Party has
    // custom eligibility checks like "only drawer can stroke")
    this.onMessage("stroke_begin", this.handleStrokeBegin.bind(this));
    this.onMessage("stroke_points", this.handleStrokePoints.bind(this));
    this.onMessage("stroke_end", this.handleStrokeEnd.bind(this));
    this.onMessage("guess", this.handleGuess.bind(this));
    this.onMessage("word_choice", this.handleWordChoice.bind(this));
    this.onMessage("undo", this.handleUndo.bind(this));
    this.onMessage("clear", this.handleClear.bind(this));
    this.onMessage("reaction", this.handleReaction.bind(this));
  }

  protected onMatchStart(): void {
    // Initialize turn order from connected players
    this.turnOrder = Array.from(this.players.keys()).sort(
      () => Math.random() - 0.5,
    );
    this.currentRound = 1;
    this.currentTurnIdx = 0;

    // Initialize scores and metrics
    for (const uid of this.turnOrder) {
      this.scores[uid] = 0;
      this.playerMetrics.set(uid, {
        totalScore: 0,
        correctGuesses: 0,
        firstCorrectCount: 0,
        totalGuessTimeSec: 0,
        turnsDrawn: 0,
        allGuessedTurns: 0,
      });
    }

    this.startTurn();
  }

  protected onMatchEnd(reason: string): {
    scoreboard: RealtimeScoreboardEntry[];
    winnerIds: string[];
    playerMetrics: Record<string, Record<string, unknown>>;
  } {
    this.clearGameTimers();
    this.sketchPhase = "match_end";

    const sorted = this.turnOrder
      .map((uid) => ({
        uid,
        displayName: this.rosterDisplayNames.get(uid) ?? uid,
        score: this.scores[uid] ?? 0,
        metrics: this.playerMetrics.get(uid),
      }))
      .sort((a, b) => b.score - a.score);

    const maxScore = sorted[0]?.score ?? 0;
    const winnerIds =
      reason === "disconnect" || reason === "abandoned"
        ? []
        : sorted
            .filter((p) => p.score === maxScore && p.score > 0)
            .map((p) => p.uid);

    const scoreboard: RealtimeScoreboardEntry[] = sorted.map((p, i) => ({
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

    const playerMetricsMap: Record<string, Record<string, unknown>> = {};
    for (const p of sorted) {
      playerMetricsMap[p.uid] = {
        totalScore: p.metrics?.totalScore ?? 0,
        correctGuesses: p.metrics?.correctGuesses ?? 0,
        firstCorrectCount: p.metrics?.firstCorrectCount ?? 0,
        totalGuessTimeSec: p.metrics?.totalGuessTimeSec ?? 0,
        turnsDrawn: p.metrics?.turnsDrawn ?? 0,
        allGuessedTurns: p.metrics?.allGuessedTurns ?? 0,
      };
    }

    return { scoreboard, winnerIds, playerMetrics: playerMetricsMap };
  }

  protected onPlayerReconnect(client: Client, uid: string): void {
    // Send board snapshot for reconnect
    client.send("board_snapshot", { strokes: this.strokes });
    // Send pending word choices if this player is the drawer
    this.sendPendingWordChoices(client, uid);
  }

  protected onPlayerDisconnect(uid: string): void {
    // If drawer disconnects during drawing, skip turn
    if (this.drawerId === uid && this.sketchPhase === "drawing") {
      this.endTurn(true);
    }
  }

  protected getGameState(
    viewerUid?: string,
    _isSpectator?: boolean,
  ): Record<string, unknown> {
    const isDrawer = !!viewerUid && viewerUid === this.drawerId;
    const rounds = (this.settings.rounds as number) ?? 3;
    const drawTimeSec = (this.settings.drawTimeSec as number) ?? 80;
    const maxHints = (this.settings.hints as number) ?? 2;

    return {
      phase: this.sketchPhase,
      currentRound: this.currentRound,
      totalRounds: rounds,
      currentTurnIndex: this.currentTurnIdx,
      drawerId: this.drawerId,
      turnOrder: this.turnOrder,
      maskedWord:
        this.sketchPhase === "turn_end"
          ? this.secretWord
          : computeMaskedWord(this.secretWord, this.hintsUsed),
      wordLength: this.secretWord.length,
      secretWord: isDrawer ? this.secretWord : "",
      scores: { ...this.scores },
      correctGuessers: Array.from(this.correctGuessersSet),
      timeRemainingSec: this.timeRemainingSec,
      drawTimeSec,
      hintsUsed: this.hintsUsed,
      maxHints,
      wordChoices:
        isDrawer && this.sketchPhase === "choosing"
          ? [...this.wordChoices]
          : [],
      effectiveSettings: { ...this.settings },
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Sketch Party game logic
  // ═══════════════════════════════════════════════════════════════════

  private startTurn(): void {
    const drawerId =
      this.turnOrder[this.currentTurnIdx % this.turnOrder.length];
    if (!drawerId) return;

    this.drawerId = drawerId;
    this.correctGuessersSet.clear();
    this.strokes = [];
    this.hintsUsed = 0;
    this.secretWord = "";
    this.timeRemainingSec = (this.settings.drawTimeSec as number) ?? 80;

    // Send turn start to clear canvases
    this.broadcast("turn_start", {});

    // Update metrics
    const metrics = this.playerMetrics.get(drawerId);
    if (metrics) metrics.turnsDrawn++;

    // Enter choosing phase
    this.sketchPhase = "choosing";
    const words = this.pickWordChoices();
    this.wordChoices = words;
    const chooseTimeSec = (this.settings.turnChooseTimeSec as number) ?? 10;
    this.chooseDeadlineAt = Date.now() + chooseTimeSec * 1000;

    // Send word choices only to drawer
    const drawerClient = this.getClientByUid(drawerId);
    if (drawerClient) {
      drawerClient.send("word_choices", {
        words,
        timeRemaining: chooseTimeSec,
      });
    }

    // Auto-pick on timeout
    this.chooseTimer = setTimeout(() => {
      if (this.sketchPhase === "choosing") {
        const randomIdx = Math.floor(Math.random() * words.length);
        this.selectWord(words[randomIdx]);
      }
    }, chooseTimeSec * 1000);

    this.broadcastGameState();
  }

  private selectWord(word: string): void {
    this.secretWord = word;
    this.usedWords.add(word);
    this.sketchPhase = "drawing";
    this.timeRemainingSec = (this.settings.drawTimeSec as number) ?? 80;
    this.drawStartTime = Date.now();

    if (this.chooseTimer) {
      clearTimeout(this.chooseTimer);
      this.chooseTimer = null;
    }
    this.chooseDeadlineAt = 0;

    this.scheduleHints();
    this.startDrawTimer();

    const drawerName = this.rosterDisplayNames.get(this.drawerId) ?? "Drawer";
    this.broadcastChat(null, `${drawerName} is drawing!`, true, false);
    this.broadcastGameState();
  }

  private scheduleHints(): void {
    const maxHints = (this.settings.hints as number) ?? 2;
    if (maxHints <= 0) return;

    const drawTime = ((this.settings.drawTimeSec as number) ?? 80) * 1000;
    for (let i = 1; i <= maxHints; i++) {
      const delay = (drawTime / (maxHints + 1)) * i;
      const timer = setTimeout(() => {
        if (this.sketchPhase !== "drawing") return;
        this.hintsUsed = i;
      }, delay);
      this.hintTimers.push(timer);
    }
  }

  private startDrawTimer(): void {
    this.turnTimer = setInterval(() => {
      if (this.sketchPhase !== "drawing") {
        if (this.turnTimer) clearInterval(this.turnTimer);
        return;
      }
      this.timeRemainingSec--;
      if (this.timeRemainingSec <= 0) {
        this.endTurn(false);
      }
    }, 1000);
  }

  private endTurn(drawerDisconnected: boolean): void {
    this.clearGameTimers();
    this.sketchPhase = "turn_end";

    // Reveal word
    this.broadcast("word_reveal", { word: this.secretWord });

    // Check if drawer had ≥75% guessed
    const eligibleGuessers = this.turnOrder.filter(
      (uid) => uid !== this.drawerId,
    ).length;
    const correctCount = this.correctGuessersSet.size;
    if (eligibleGuessers > 0 && correctCount / eligibleGuessers >= 0.75) {
      const metrics = this.playerMetrics.get(this.drawerId);
      if (metrics) metrics.allGuessedTurns++;
    }

    const msg = drawerDisconnected
      ? `Drawer disconnected! The word was "${this.secretWord}"`
      : `Time's up! The word was "${this.secretWord}"`;
    this.broadcastChat(null, msg, true, false);

    this.broadcast("turn_scores", { scores: this.scores });
    this.broadcastGameState();

    // Advance after delay
    setTimeout(() => {
      this.advanceTurn();
    }, TURN_END_DELAY_MS);
  }

  private advanceTurn(): void {
    this.currentTurnIdx++;
    const rounds = (this.settings.rounds as number) ?? 3;

    if (this.currentTurnIdx >= this.turnOrder.length * this.currentRound) {
      this.currentRound++;
      if (this.currentRound > rounds) {
        this.endMatch("complete");
        return;
      }
    }

    this.startTurn();
  }

  // ── Message handlers ──────────────────────────────────────────────

  private handleStrokeBegin(
    client: Client,
    msg: Record<string, unknown>,
  ): void {
    const uid = this.getUidByClient(client);
    if (!uid || uid !== this.drawerId || this.sketchPhase !== "drawing") return;
    if (this.strokes.length >= MAX_STROKES_PER_TURN) return;

    const stroke: StrokeData = {
      strokeId: msg.strokeId as string,
      tool: (msg.tool as "pen" | "eraser") ?? "pen",
      color: (msg.color as string) ?? "#000000",
      width: (msg.width as number) ?? 4,
      points: [{ x: msg.x as number, y: msg.y as number }],
    };
    this.strokes.push(stroke);
    this.broadcast("stroke_begin", msg, { except: client });
  }

  private handleStrokePoints(
    client: Client,
    msg: Record<string, unknown>,
  ): void {
    const uid = this.getUidByClient(client);
    if (!uid || uid !== this.drawerId || this.sketchPhase !== "drawing") return;

    const strokeId = msg.strokeId as string;
    const points = msg.points as Array<{ x: number; y: number; t: number }>;
    if (!Array.isArray(points)) return;

    const stroke = this.strokes.find((s) => s.strokeId === strokeId);
    if (stroke) {
      const totalPoints = this.strokes.reduce(
        (sum, s) => sum + s.points.length,
        0,
      );
      if (totalPoints + points.length > MAX_REPLAY_BUFFER_SIZE) return;
      stroke.points.push(...points.map((p) => ({ x: p.x, y: p.y })));
    }

    this.broadcast(
      "stroke_points",
      { strokeId, points: points.map((p) => ({ x: p.x, y: p.y })) },
      { except: client },
    );
  }

  private handleStrokeEnd(client: Client, msg: Record<string, unknown>): void {
    const uid = this.getUidByClient(client);
    if (!uid || uid !== this.drawerId) return;
    this.broadcast("stroke_end", msg, { except: client });
  }

  private handleGuess(client: Client, msg: Record<string, unknown>): void {
    const uid = this.getUidByClient(client);
    if (!uid) return;
    if (uid === this.drawerId) return;
    if (this.sketchPhase !== "drawing") return;
    if (this.correctGuessersSet.has(uid)) return;

    const text = (msg.text as string)?.trim();
    if (!text) return;

    const player = this.players.get(uid);
    const displayName = player?.displayName ?? uid;

    if (isCorrectGuess(text, this.secretWord)) {
      this.correctGuessersSet.add(uid);

      const elapsedSec = (Date.now() - this.drawStartTime) / 1000;
      const drawTimeSec = (this.settings.drawTimeSec as number) ?? 80;
      const guesserPts = computeGuesserPoints(
        this.secretWord.length,
        elapsedSec,
        drawTimeSec,
        this.hintsUsed,
      );
      const timeBonus = computeTimeBonus(elapsedSec, drawTimeSec);
      const drawerGain = computeDrawerGainPerGuesser(timeBonus);

      this.scores[uid] = (this.scores[uid] ?? 0) + guesserPts;
      this.scores[this.drawerId] =
        (this.scores[this.drawerId] ?? 0) + drawerGain;

      const guesserMetrics = this.playerMetrics.get(uid);
      if (guesserMetrics) {
        guesserMetrics.totalScore += guesserPts;
        guesserMetrics.correctGuesses++;
        guesserMetrics.totalGuessTimeSec += elapsedSec;
        if (this.correctGuessersSet.size === 1) {
          guesserMetrics.firstCorrectCount++;
        }
      }

      this.broadcastChat(uid, `${displayName} guessed correctly!`, false, true);

      // Check if all guessers got it
      const eligibleGuessers = this.turnOrder.filter(
        (id) => id !== this.drawerId && this.players.get(id)?.connected,
      );
      if (
        eligibleGuessers.length > 0 &&
        eligibleGuessers.every((id) => this.correctGuessersSet.has(id))
      ) {
        this.broadcastChat(null, "Everyone guessed correctly!", true, false);
        this.endTurn(false);
      }
    } else {
      this.broadcastChat(uid, text, false, false);
    }
  }

  private handleWordChoice(client: Client, msg: Record<string, unknown>): void {
    const uid = this.getUidByClient(client);
    if (!uid || uid !== this.drawerId || this.sketchPhase !== "choosing")
      return;

    const idx = msg.wordIndex as number;
    if (typeof idx !== "number" || idx < 0 || idx >= this.wordChoices.length)
      return;

    this.selectWord(this.wordChoices[idx]);
  }

  private handleUndo(client: Client): void {
    const uid = this.getUidByClient(client);
    if (!uid || uid !== this.drawerId || this.sketchPhase !== "drawing") return;

    const removed = this.strokes.pop();
    if (removed) {
      this.broadcast("undo_stroke", { strokeId: removed.strokeId });
    }
  }

  private handleClear(client: Client): void {
    const uid = this.getUidByClient(client);
    if (!uid || uid !== this.drawerId || this.sketchPhase !== "drawing") return;

    this.strokes = [];
    this.broadcast("clear_canvas", {});
  }

  private handleReaction(client: Client, msg: Record<string, unknown>): void {
    const uid = this.getUidByClient(client);
    if (!uid) return;

    const kind = msg.kind as string;
    if (!kind) return;

    const player = this.players.get(uid);
    this.broadcast("reaction_event", {
      uid,
      displayName: player?.displayName ?? uid,
      kind,
      ts: Date.now(),
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private broadcastChat(
    uid: string | null,
    text: string,
    isSystem: boolean,
    isCorrect: boolean,
  ): void {
    this.broadcast("chat", {
      uid: uid ?? "system",
      displayName: uid ? (this.players.get(uid)?.displayName ?? uid) : "System",
      text,
      isCorrect,
      isSystem,
      timestamp: Date.now(),
    });
  }

  private pickWordChoices(): string[] {
    const customList = (this.settings.customWordsList as string) ?? "";
    const customEnabled =
      (this.settings.customWordsEnabled as boolean) ?? false;
    const wordChoiceCount = (this.settings.wordChoices as number) ?? 3;

    if (customEnabled && customList.length > 0) {
      const pool = getCustomWordPool(customList);
      if (pool.length > 0) {
        return pickWordsFromPool(pool, wordChoiceCount, this.usedWords);
      }
    }

    return pickRandomWords(wordChoiceCount, this.usedWords);
  }

  private sendPendingWordChoices(client: Client, uid: string): void {
    if (
      uid !== this.drawerId ||
      this.sketchPhase !== "choosing" ||
      this.wordChoices.length === 0
    ) {
      return;
    }

    const timeRemaining = Math.max(
      1,
      Math.ceil((this.chooseDeadlineAt - Date.now()) / 1000),
    );
    client.send("word_choices", {
      words: [...this.wordChoices],
      timeRemaining,
    });
  }

  private clearGameTimers(): void {
    if (this.turnTimer) {
      clearInterval(this.turnTimer);
      this.turnTimer = null;
    }
    if (this.chooseTimer) {
      clearTimeout(this.chooseTimer);
      this.chooseTimer = null;
    }
    this.chooseDeadlineAt = 0;
    for (const t of this.hintTimers) {
      clearTimeout(t);
    }
    this.hintTimers = [];
  }
}

// ── Utilities ─────────────────────────────────────────────────────────

function getCustomWordPool(rawList: string): string[] {
  const deduped = new Set<string>();
  for (const entry of rawList.split(/[\n,]/)) {
    const word = entry.trim().replace(/\s+/g, " ");
    if (word.length >= 2) {
      deduped.add(word);
    }
  }
  return Array.from(deduped);
}

function pickWordsFromPool(
  pool: string[],
  count: number,
  usedWords: Set<string>,
): string[] {
  const available = pool.filter((word) => !usedWords.has(word));
  const source = available.length > 0 ? available : pool;
  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.max(1, Math.min(count, shuffled.length)));
}
