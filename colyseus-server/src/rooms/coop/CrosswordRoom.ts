import { createServerLogger } from "../../utils/logger";
const log = createServerLogger("CrosswordRoom");

/**
 * CrosswordRoom â€” Cooperative 5Ã—5 Mini Crossword
 *
 * Gameplay:
 * 1. Both players join â†’ "waiting"
 * 2. Both ready â†’ "countdown" (3s)
 * 3. Shared 5Ã—5 grid â€” both players place letters collaboratively
 * 4. Real-time cursor positions visible to both players
 * 5. Letters validated against the solution on placement
 * 6. Puzzle completes when all cells are correctly filled
 *
 * Cooperative scoring:
 *   - Both players "win" when the puzzle is completed
 *   - Individual contribution tracked (letters placed)
 *   - Final score = total elapsed time (lower is better)
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md â€” Phase 5.3
 */

import { Client, Room } from "colyseus";
import { BaseGameState } from "../../schemas/common";
import {
  CrosswordClue,
  CrosswordPlayer,
  CrosswordState,
} from "../../schemas/draw";
import { verifyFirebaseToken } from "../../services/firebase";
import { persistGameResult } from "../../services/persistence";

// =============================================================================
// Puzzle Data (mirrors client-side CrosswordGameScreen puzzles)
// =============================================================================

interface PuzzleDef {
  grid: (string | null)[][];
  acrossClues: { num: number; clue: string; row: number; col: number }[];
  downClues: { num: number; clue: string; row: number; col: number }[];
}

const PUZZLES: PuzzleDef[] = [
  {
    grid: [
      ["S", "T", "A", "R", "T"],
      ["H", "I", "D", "E", null],
      ["A", "N", "D", null, "A"],
      ["R", null, "S", "E", "T"],
      ["E", "V", "E", "N", null],
    ],
    acrossClues: [
      { num: 1, clue: "Begin", row: 0, col: 0 },
      { num: 6, clue: "Conceal", row: 1, col: 0 },
      { num: 7, clue: "Also", row: 2, col: 0 },
      { num: 8, clue: "Group of things", row: 3, col: 2 },
      { num: 9, clue: "Flat, level", row: 4, col: 0 },
    ],
    downClues: [
      { num: 1, clue: "Portion", row: 0, col: 0 },
      { num: 2, clue: "Shade, color", row: 0, col: 1 },
      { num: 3, clue: "Includes", row: 0, col: 2 },
      { num: 4, clue: "Gain, make", row: 0, col: 3 },
      { num: 5, clue: "Small feline", row: 2, col: 4 },
    ],
  },
  {
    grid: [
      ["L", "I", "G", "H", "T"],
      ["O", "N", "E", null, "A"],
      ["O", "D", null, "B", "L"],
      ["P", null, "A", "I", "L"],
      [null, "S", "P", "T", "Y"],
    ],
    acrossClues: [
      { num: 1, clue: "Not heavy", row: 0, col: 0 },
      { num: 5, clue: "Single", row: 1, col: 0 },
      { num: 6, clue: "Bucket", row: 3, col: 2 },
      { num: 7, clue: "Devious, crafty", row: 4, col: 1 },
    ],
    downClues: [
      { num: 1, clue: "Repeated circle", row: 0, col: 0 },
      { num: 2, clue: "Not outdoors", row: 0, col: 1 },
      { num: 3, clue: "Space, opening", row: 0, col: 2 },
      { num: 4, clue: "Highest, also ...", row: 1, col: 4 },
    ],
  },
  {
    grid: [
      ["B", "R", "A", "V", "E"],
      ["L", "O", null, "I", "A"],
      ["A", "C", "U", "P", null],
      ["D", "K", "S", "E", "D"],
      ["E", null, "E", "R", null],
    ],
    acrossClues: [
      { num: 1, clue: "Courageous", row: 0, col: 0 },
      { num: 5, clue: "Drinking vessel", row: 2, col: 1 },
      { num: 6, clue: "Cutting tool", row: 3, col: 0 },
      { num: 7, clue: "Employ, utilize", row: 4, col: 2 },
    ],
    downClues: [
      { num: 1, clue: "Sword part", row: 0, col: 0 },
      { num: 2, clue: "Solid stone", row: 0, col: 1 },
      { num: 3, clue: "Snake relative", row: 1, col: 3 },
      { num: 4, clue: "Listen to", row: 0, col: 4 },
    ],
  },
  {
    grid: [
      ["F", "L", "A", "S", "H"],
      ["L", "I", "N", "E", null],
      ["A", "N", "T", null, "B"],
      ["T", null, "H", "U", "E"],
      [null, "R", "E", "N", "D"],
    ],
    acrossClues: [
      { num: 1, clue: "Quick burst of light", row: 0, col: 0 },
      { num: 6, clue: "Queue, row", row: 1, col: 0 },
      { num: 7, clue: "Small insect", row: 2, col: 0 },
      { num: 8, clue: "Popular direction", row: 4, col: 1 },
    ],
    downClues: [
      { num: 1, clue: "Apartment", row: 0, col: 0 },
      { num: 2, clue: "Connection", row: 0, col: 1 },
      { num: 3, clue: "Song, melody", row: 0, col: 2 },
      { num: 4, clue: "Utilize, send", row: 0, col: 3 },
      { num: 5, clue: "Curve, turn", row: 2, col: 4 },
    ],
  },
  {
    grid: [
      ["G", "R", "O", "W", "N"],
      ["L", "I", "V", "E", null],
      ["A", "D", "E", null, "M"],
      ["D", null, "R", "A", "N"],
      [null, "S", "T", "O", "P"],
    ],
    acrossClues: [
      { num: 1, clue: "Mature, adult", row: 0, col: 0 },
      { num: 6, clue: "Exist, be alive", row: 1, col: 0 },
      { num: 7, clue: "Finished, completed", row: 1, col: 0 },
      { num: 8, clue: "Halt, cease", row: 4, col: 1 },
    ],
    downClues: [
      { num: 1, clue: "Happy, pleased", row: 0, col: 0 },
      { num: 2, clue: "Go up, ascend", row: 0, col: 1 },
      { num: 3, clue: "Above, past", row: 0, col: 2 },
      { num: 4, clue: "Desire, require", row: 0, col: 3 },
      { num: 5, clue: "Guy, fellow", row: 2, col: 4 },
    ],
  },
  {
    grid: [
      ["P", "L", "A", "N", "E"],
      ["L", "O", "S", "E", null],
      ["A", "V", "K", null, "B"],
      ["N", null, "E", "A", "I"],
      [null, "D", "D", "R", "T"],
    ],
    acrossClues: [
      { num: 1, clue: "Aircraft", row: 0, col: 0 },
      { num: 6, clue: "Not win", row: 1, col: 0 },
      { num: 7, clue: "Inquire", row: 2, col: 1 },
      { num: 8, clue: "Small amount", row: 4, col: 1 },
    ],
    downClues: [
      { num: 1, clue: "Scheme, strategy", row: 0, col: 0 },
      { num: 2, clue: "Adore, care for", row: 0, col: 1 },
      { num: 3, clue: "Requested", row: 0, col: 2 },
      { num: 4, clue: "Close, proximate", row: 0, col: 3 },
      { num: 5, clue: "Chew, munch", row: 2, col: 4 },
    ],
  },
  {
    grid: [
      ["C", "H", "A", "I", "R"],
      ["L", "O", "N", "E", null],
      ["E", "P", "E", null, "S"],
      ["A", null, "W", "E", "T"],
      ["R", "E", "S", "T", null],
    ],
    acrossClues: [
      { num: 1, clue: "Seat furniture", row: 0, col: 0 },
      { num: 6, clue: "Solo, single", row: 1, col: 0 },
      { num: 7, clue: "Not dry", row: 3, col: 2 },
      { num: 8, clue: "Relax, sleep", row: 4, col: 0 },
    ],
    downClues: [
      { num: 1, clue: "Obvious, plain", row: 0, col: 0 },
      { num: 2, clue: "Wish, expect", row: 0, col: 1 },
      { num: 3, clue: "Response", row: 0, col: 2 },
      { num: 4, clue: "Frozen water", row: 0, col: 3 },
      { num: 5, clue: "Road, avenue", row: 2, col: 4 },
    ],
  },
];

// =============================================================================
// Room
// =============================================================================

// Intentionally standalone room: cooperative crossword move/cursor semantics
// differ from generic turn-based room contracts.
export class CrosswordRoom extends Room<{ state: CrosswordState }> {
  maxClients = 2;
  patchRate = 100; // 10fps
  autoDispose = true;

  /** The puzzle solution (server-side only) */
  private solution: (string | null)[][] = [];

  /** Firebase UID map */
  private playerUids = new Map<string, string>();

  // ===========================================================================
  // Auth
  // ===========================================================================

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

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  onCreate(options: Record<string, any>): void {
    this.setState(new CrosswordState());
    this.state.gameId = this.roomId;
    this.state.seed = Math.floor(Math.random() * 2147483647);
    this.state.phase = "waiting";

    // Select puzzle
    const puzzleIdx =
      options.puzzleIndex !== undefined
        ? options.puzzleIndex % PUZZLES.length
        : this.state.seed % PUZZLES.length;
    this.state.puzzleIndex = puzzleIdx;

    const puzzle = PUZZLES[puzzleIdx];
    this.solution = puzzle.grid;

    // Initialize grid
    this.state.initGrid(this.solution);

    // Add clues
    for (const ac of puzzle.acrossClues) {
      const clue = new CrosswordClue();
      clue.num = ac.num;
      clue.clue = ac.clue;
      clue.row = ac.row;
      clue.col = ac.col;
      clue.direction = "across";
      this.state.clues.push(clue);
    }
    for (const dc of puzzle.downClues) {
      const clue = new CrosswordClue();
      clue.num = dc.num;
      clue.clue = dc.clue;
      clue.row = dc.row;
      clue.col = dc.col;
      clue.direction = "down";
      this.state.clues.push(clue);
    }

    log.info(
      `[crossword] Room created: ${this.roomId} (puzzle: ${puzzleIdx})`,
    );
  }

  // ===========================================================================
  // Messages
  // ===========================================================================

  messages: Record<string, (client: Client, payload?: any) => void> = {
    /** Player signals ready */
    ready: (client: Client) => {
      const player = this.state.cwPlayers.get(client.sessionId);
      if (player) {
        player.ready = true;
        log.info(`[crossword] Player ready: ${player.displayName}`);
        this.checkAllReady();
      }
    },

    /**
     * Player places a letter in a cell.
     * Server validates against the solution.
     */
    place_letter: (
      client: Client,
      payload: { row: number; col: number; letter: string },
    ) => {
      if (this.state.phase !== "playing" || this.state.completed) return;

      const player = this.state.cwPlayers.get(client.sessionId);
      if (!player) return;

      const { row, col, letter } = payload;
      if (row < 0 || row >= 5 || col < 0 || col >= 5) return;

      const cell = this.state.getCell(row, col);
      if (!cell || cell.blocked) return;

      const normalizedLetter = (letter || "").toUpperCase().charAt(0);
      if (!normalizedLetter || !/^[A-Z]$/.test(normalizedLetter)) return;

      // Place the letter
      cell.letter = normalizedLetter;
      cell.placedBy = client.sessionId;

      // Check correctness
      const solutionLetter = this.solution[row]?.[col];
      cell.correct = normalizedLetter === solutionLetter;

      player.lettersPlaced++;

      // Broadcast to partner
      this.broadcast(
        "letter_placed",
        {
          row,
          col,
          letter: normalizedLetter,
          placedBy: client.sessionId,
          playerName: player.displayName,
          correct: cell.correct,
        },
        { except: client },
      );

      // Check if puzzle is complete
      this.checkCompletion();
    },

    /**
     * Player clears a cell.
     */
    clear_cell: (client: Client, payload: { row: number; col: number }) => {
      if (this.state.phase !== "playing" || this.state.completed) return;

      const { row, col } = payload;
      if (row < 0 || row >= 5 || col < 0 || col >= 5) return;

      const cell = this.state.getCell(row, col);
      if (!cell || cell.blocked) return;

      cell.letter = "";
      cell.correct = false;
      cell.placedBy = "";

      this.broadcast(
        "cell_cleared",
        { row, col, clearedBy: client.sessionId },
        { except: client },
      );
    },

    /**
     * Player moves their cursor.
     */
    cursor_move: (
      client: Client,
      payload: { row: number; col: number; direction: string },
    ) => {
      const player = this.state.cwPlayers.get(client.sessionId);
      if (!player) return;

      player.cursorRow = payload.row ?? -1;
      player.cursorCol = payload.col ?? -1;
      player.cursorDirection = payload.direction || "across";
    },

    /** Rematch */
    rematch: (client: Client) => {
      if (this.state.phase !== "finished") return;
      this.broadcast("rematch_request", {
        fromSessionId: client.sessionId,
        fromName:
          this.state.cwPlayers.get(client.sessionId)?.displayName || "Player",
      });
    },

    rematch_accept: (_client: Client) => {
      if (this.state.phase !== "finished") return;
      this.resetForRematch();
    },

    app_state: (client: Client, payload: { state: string }) => {
      log.info(
        `[crossword] Player app state: ${client.sessionId} â†’ ${payload.state}`,
      );
    },
  };

  // ===========================================================================
  // Player Lifecycle
  // ===========================================================================

  onJoin(client: Client, _options: Record<string, any>, auth: any): void {
    const player = new CrosswordPlayer();
    player.uid = auth.uid;
    player.sessionId = client.sessionId;
    player.displayName = auth.displayName || "Player";
    player.avatarUrl = auth.avatarUrl || "";
    player.playerIndex = this.state.cwPlayers.size;
    player.connected = true;

    this.state.cwPlayers.set(client.sessionId, player);
    this.playerUids.set(client.sessionId, auth.uid);

    client.send("welcome", {
      sessionId: client.sessionId,
      playerIndex: player.playerIndex,
      seed: this.state.seed,
      puzzleIndex: this.state.puzzleIndex,
    });

    log.info(
      `[crossword] Player joined: ${auth.displayName} (${client.sessionId}) [${this.state.cwPlayers.size}/${this.maxClients}]`,
    );

    if (this.state.cwPlayers.size >= this.maxClients) {
      this.lock();
    }
  }

  onDrop(client: Client, _code: number): void {
    const player = this.state.cwPlayers.get(client.sessionId);
    if (player) player.connected = false;

    this.broadcast(
      "opponent_reconnecting",
      { sessionId: client.sessionId },
      { except: client },
    );

    const timeout = parseInt(process.env.RECONNECTION_TIMEOUT_COOP || "30", 10);
    this.allowReconnection(client, timeout);
  }

  onReconnect(client: Client): void {
    const player = this.state.cwPlayers.get(client.sessionId);
    if (player) player.connected = true;

    this.broadcast(
      "opponent_reconnected",
      { sessionId: client.sessionId },
      { except: client },
    );
  }

  onLeave(client: Client, _code: number): void {
    const player = this.state.cwPlayers.get(client.sessionId);
    if (player && this.state.phase === "playing" && !this.state.completed) {
      // Cooperative game can't continue with one player â€” end it
      this.state.phase = "finished";
      this.state.winnerId = "";
      this.state.winReason = "opponent_left";

      this.broadcast("game_over", {
        winnerId: "",
        winReason: "opponent_left",
        elapsedSeconds: Math.floor(this.state.elapsed / 1000),
        results: [],
      });
    }
    log.info(`[crossword] Player left: ${client.sessionId}`);
  }

  async onDispose(): Promise<void> {
    if (this.state.phase === "finished") {
      await persistGameResult(this.state as unknown as BaseGameState, this.state.elapsed);
    }
    log.info(`[crossword] Room disposed: ${this.roomId}`);
  }

  // ===========================================================================
  // Game Flow
  // ===========================================================================

  private checkAllReady(): void {
    if (this.state.cwPlayers.size < 2) return;

    let allReady = true;
    this.state.cwPlayers.forEach((p: CrosswordPlayer) => {
      if (!p.ready) allReady = false;
    });

    if (allReady) {
      this.startCountdown();
    }
  }

  private startCountdown(): void {
    this.state.phase = "countdown";
    this.state.countdown = 3;

    const interval = this.clock.setInterval(() => {
      this.state.countdown--;
      if (this.state.countdown <= 0) {
        interval.clear();
        this.startGame();
      }
    }, 1000);
  }

  private startGame(): void {
    this.state.phase = "playing";
    this.state.elapsed = 0;

    // Elapsed timer (counts up)
    this.setSimulationInterval((dt: number) => {
      if (this.state.phase === "playing" && !this.state.completed) {
        this.state.elapsed += dt;
      }
    }, 1000);

    this.broadcast("game_start", {
      gridSize: this.state.gridSize,
      puzzleIndex: this.state.puzzleIndex,
    });

    log.info(`[crossword] Game started! Puzzle: ${this.state.puzzleIndex}`);
  }

  private checkCompletion(): void {
    let allCorrect = true;
    const size = this.state.gridSize;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = this.state.getCell(r, c);
        if (!cell || cell.blocked) continue;

        if (!cell.letter || !cell.correct) {
          allCorrect = false;
          break;
        }
      }
      if (!allCorrect) break;
    }

    if (allCorrect) {
      this.state.completed = true;
      this.endGame();
    }
  }

  private endGame(): void {
    if (this.state.phase === "finished") return;
    this.state.phase = "finished";

    // Cooperative win â€” both players are "winners"
    // Set winnerId to empty for cooperative games
    this.state.winnerId = "";
    this.state.winReason = "puzzle_complete";

    const players = Array.from(
      this.state.cwPlayers.values(),
    ) as CrosswordPlayer[];

    const results = players.map((p: CrosswordPlayer) => ({
      uid: p.uid,
      displayName: p.displayName,
      lettersPlaced: p.lettersPlaced,
      score: Math.max(0, 1000 - Math.floor(this.state.elapsed / 1000)),
    }));

    // Set scores
    players.forEach((p: CrosswordPlayer) => {
      p.score = Math.max(0, 1000 - Math.floor(this.state.elapsed / 1000));
    });

    this.broadcast("game_over", {
      winnerId: this.state.winnerId,
      winReason: this.state.winReason,
      elapsedSeconds: Math.floor(this.state.elapsed / 1000),
      results,
    });

    log.info(
      `[crossword] Puzzle complete! Time: ${Math.floor(this.state.elapsed / 1000)}s`,
    );
  }

  private resetForRematch(): void {
    // Pick a new puzzle
    this.state.seed = Math.floor(Math.random() * 2147483647);
    const newPuzzleIdx = this.state.seed % PUZZLES.length;
    this.state.puzzleIndex = newPuzzleIdx;
    const puzzle = PUZZLES[newPuzzleIdx];
    this.solution = puzzle.grid;

    // Re-initialize grid
    this.state.initGrid(this.solution);

    // Re-add clues
    this.state.clues.clear();
    for (const ac of puzzle.acrossClues) {
      const clue = new CrosswordClue();
      clue.num = ac.num;
      clue.clue = ac.clue;
      clue.row = ac.row;
      clue.col = ac.col;
      clue.direction = "across";
      this.state.clues.push(clue);
    }
    for (const dc of puzzle.downClues) {
      const clue = new CrosswordClue();
      clue.num = dc.num;
      clue.clue = dc.clue;
      clue.row = dc.row;
      clue.col = dc.col;
      clue.direction = "down";
      this.state.clues.push(clue);
    }

    // Reset players
    this.state.cwPlayers.forEach((p: CrosswordPlayer) => {
      p.score = 0;
      p.lettersPlaced = 0;
      p.cursorRow = -1;
      p.cursorCol = -1;
      p.cursorDirection = "across";
      p.ready = false;
    });

    this.state.phase = "waiting";
    this.state.winnerId = "";
    this.state.winReason = "";
    this.state.completed = false;
    this.state.elapsed = 0;
    this.state.countdown = 0;

    this.unlock();
    log.info(`[crossword] Room reset for rematch (puzzle: ${newPuzzleIdx})`);
  }
}


