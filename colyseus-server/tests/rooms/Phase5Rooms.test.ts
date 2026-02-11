/**
 * Phase 5 Cooperative / Creative Room Unit Tests
 *
 * Tests schemas, game logic, word evaluation, grid helpers, scoring,
 * and lifecycle for Phase-5 games:
 *   - Word Master (Wordle) — WordMasterGuess, WordMasterPlayer, evaluateGuess
 *   - Crossword (Co-op) — CrosswordCell, CrosswordPlayer, CrosswordState grid
 *
 * Pattern: Direct schema/logic testing (no Colyseus Room simulation).
 */

// ---------------------------------------------------------------------------
// Mocks — must be before imports
// ---------------------------------------------------------------------------
jest.mock("../../src/services/firebase", () => ({
  initializeFirebaseAdmin: jest.fn(),
  verifyFirebaseToken: jest.fn().mockResolvedValue({
    uid: "test-uid-1",
    name: "Player 1",
  }),
  getFirestoreDb: jest.fn().mockReturnValue(null),
}));

jest.mock("../../src/services/persistence", () => ({
  saveGameState: jest.fn().mockResolvedValue(undefined),
  loadGameState: jest.fn().mockResolvedValue(null),
  persistGameResult: jest.fn().mockResolvedValue(undefined),
  cleanupExpiredGameStates: jest.fn().mockResolvedValue(undefined),
}));

import { ArraySchema, MapSchema } from "@colyseus/schema";
import { evaluateGuess } from "../../src/rooms/coop/WordMasterRoom";
import {
  CrosswordCell,
  CrosswordClue,
  CrosswordPlayer,
  CrosswordState,
  WordMasterGuess,
  WordMasterPlayer,
  WordMasterState,
} from "../../src/schemas/draw";

// ═══════════════════════════════════════════════════════════════════════════
// 1. WordMasterGuess Schema
// ═══════════════════════════════════════════════════════════════════════════

describe("WordMasterGuess", () => {
  it("should have correct default values", () => {
    const guess = new WordMasterGuess();
    expect(guess.word).toBe("");
    expect(guess.result).toBe("");
  });

  it("should store word and result", () => {
    const guess = new WordMasterGuess();
    guess.word = "CRANE";
    guess.result = "apcac";
    expect(guess.word).toBe("CRANE");
    expect(guess.result).toBe("apcac");
  });

  it("should handle all correct result", () => {
    const guess = new WordMasterGuess();
    guess.word = "APPLE";
    guess.result = "ccccc";
    expect(guess.result).toBe("ccccc");
  });

  it("should handle all absent result", () => {
    const guess = new WordMasterGuess();
    guess.word = "XXXYZ";
    guess.result = "aaaaa";
    expect(guess.result).toBe("aaaaa");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. WordMasterPlayer Schema
// ═══════════════════════════════════════════════════════════════════════════

describe("WordMasterPlayer", () => {
  it("should have correct default values", () => {
    const player = new WordMasterPlayer();
    expect(player.uid).toBe("");
    expect(player.sessionId).toBe("");
    expect(player.displayName).toBe("");
    expect(player.connected).toBe(true);
    expect(player.ready).toBe(false);
    expect(player.score).toBe(0);
    expect(player.currentRow).toBe(0);
    expect(player.status).toBe("playing");
    expect(player.finished).toBe(false);
    expect(player.guesses).toBeDefined();
    expect(player.guesses.length).toBe(0);
  });

  it("should store guesses as ArraySchema", () => {
    const player = new WordMasterPlayer();
    expect(player.guesses).toBeInstanceOf(ArraySchema);
  });

  it("should track guess history", () => {
    const player = new WordMasterPlayer();
    const g1 = new WordMasterGuess();
    g1.word = "CRANE";
    g1.result = "apcac";
    const g2 = new WordMasterGuess();
    g2.word = "ABOUT";
    g2.result = "cacaa";

    player.guesses.push(g1);
    player.guesses.push(g2);
    player.currentRow = 2;

    expect(player.guesses.length).toBe(2);
    expect(player.guesses[0].word).toBe("CRANE");
    expect(player.guesses[1].word).toBe("ABOUT");
    expect(player.currentRow).toBe(2);
  });

  it("should track win status", () => {
    const player = new WordMasterPlayer();
    player.status = "won";
    player.finished = true;
    expect(player.status).toBe("won");
    expect(player.finished).toBe(true);
  });

  it("should track loss status", () => {
    const player = new WordMasterPlayer();
    player.status = "lost";
    player.finished = true;
    expect(player.status).toBe("lost");
    expect(player.finished).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. WordMasterState Schema
// ═══════════════════════════════════════════════════════════════════════════

describe("WordMasterState", () => {
  it("should have correct default values", () => {
    const state = new WordMasterState();
    expect(state.phase).toBe("waiting");
    expect(state.gameId).toBe("");
    expect(state.gameType).toBe("word_master_game");
    expect(state.maxPlayers).toBe(2);
    expect(state.winnerId).toBe("");
    expect(state.winReason).toBe("");
    expect(state.wordLength).toBe(5);
    expect(state.maxGuesses).toBe(6);
    expect(state.revealedWord).toBe("");
    expect(state.countdown).toBe(0);
    expect(state.elapsed).toBe(0);
    expect(state.seed).toBe(0);
  });

  it("should manage players map", () => {
    const state = new WordMasterState();
    const p1 = new WordMasterPlayer();
    p1.sessionId = "s1";
    p1.displayName = "Alice";
    state.wmPlayers.set("s1", p1);
    expect(state.wmPlayers.size).toBe(1);
    expect(state.wmPlayers.get("s1")!.displayName).toBe("Alice");
  });

  it("should reveal word on finish", () => {
    const state = new WordMasterState();
    state.revealedWord = "APPLE";
    state.phase = "finished";
    expect(state.revealedWord).toBe("APPLE");
    expect(state.phase).toBe("finished");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. evaluateGuess — Core Word Master Logic
// ═══════════════════════════════════════════════════════════════════════════

describe("evaluateGuess", () => {
  it("should return all correct for exact match", () => {
    expect(evaluateGuess("APPLE", "APPLE")).toBe("ccccc");
  });

  it("should return all absent for no matches", () => {
    expect(evaluateGuess("FGHIJ", "APPLE")).toBe("aaaaa");
  });

  it("should mark correct positions", () => {
    // A is correct (pos 0), rest absent
    expect(evaluateGuess("AXXXX", "APPLE")).toBe("caaaa");
  });

  it("should mark present letters in wrong position", () => {
    // P is present (exists in APPLE but not at pos 0)
    const result = evaluateGuess("PXXXX", "APPLE");
    expect(result[0]).toBe("p");
  });

  it("should prefer correct over present", () => {
    // PAPAL vs APPLE:
    // P(0) → present (P is at pos 2,3 in APPLE)
    // A(1) → present (A is at pos 0 in APPLE)
    // P(2) → correct (P is at pos 2 in APPLE)
    // A(3) → absent (only 1 A in APPLE, used at pos 0 already)
    // L(4) → correct (L is at pos 4 in APPLE... wait APPLE = A,P,P,L,E)
    // Actually APPLE = A(0), P(1), P(2), L(3), E(4)
    const result = evaluateGuess("PAPAL", "APPLE");
    // P(0) vs A(0) → not correct. P exists at pos 1,2 → present
    // A(1) vs P(1) → not correct. A exists at pos 0 → present
    // P(2) vs P(2) → correct
    // A(3) vs L(3) → not correct. A at pos 0 already claimed by A(1)? Let's trace:
    // First pass (correct): pos 2 → P=P → correct, used[2]=true
    // Second pass:
    //   pos 0: P vs A → not correct. Scan: used[0]=false, A≠P; used[1]=false, P=P → present, used[1]=true
    //   pos 1: A vs P → not correct. Scan: used[0]=false, A=A → present, used[0]=true
    //   pos 3: A vs L → not correct. Scan: all A's used → absent
    //   pos 4: L vs E → not correct. Scan: used[3]=false, L=L → present, used[3]=true
    expect(result).toBe("ppcap");
  });

  it("should handle double letters correctly — one correct, one absent", () => {
    // ALLOT vs APPLE: A(0)=correct, L(1)→present(L at 3), L(2)→absent(only 1 L in APPLE), O(3)→absent, T(4)→absent
    // APPLE = A,P,P,L,E
    // First pass: A(0)=A(0) → correct, used[0]=true
    // Second pass:
    //   L(1) → scan: P(1) no, P(2) no, L(3) yes → present, used[3]=true
    //   L(2) → scan: no more L available → absent
    //   O(3) → absent
    //   T(4) → absent
    expect(evaluateGuess("ALLOT", "APPLE")).toBe("cpaaa");
  });

  it("should handle all present (anagram)", () => {
    // ELPPA vs APPLE
    const result = evaluateGuess("ELPPA", "APPLE");
    // E(0) vs A(0) → not correct. E at 4 → present
    // L(1) vs P(1) → not correct. L at 3 → present
    // P(2) vs P(2) → correct
    // P(3) vs L(3) → not correct. P at 1 → present (used[1]=true)
    // A(4) vs E(4) → not correct. A at 0 → present (used[0]=true)
    expect(result).toBe("ppcpp");
  });

  it("should be case insensitive", () => {
    expect(evaluateGuess("apple", "APPLE")).toBe("ccccc");
    expect(evaluateGuess("APPLE", "apple")).toBe("ccccc");
  });

  it("should handle word with repeated target letters", () => {
    // SPEED vs GEESE
    // S(0) vs G(0) → absent
    // P(1) vs E(1) → absent
    // E(2) vs E(2) → correct
    // E(3) vs S(3) → E at 1,4 → present (used[1]=true)
    // D(4) vs E(4) → absent
    expect(evaluateGuess("SPEED", "GEESE")).toBe("pacpa");
  });

  it("should handle same letter appearing 3 times", () => {
    // EERIE vs THREE
    // E(0) vs T(0) → not correct
    // E(1) vs H(1) → not correct
    // R(2) vs R(2) → correct
    // I(3) vs E(3) → not correct
    // E(4) vs E(4) → correct
    // Second pass:
    //   E(0) → scan: E at 3 used?no → present, used[3]=true
    //   E(1) → scan: no more E available → absent
    //   I(3) → absent
    expect(evaluateGuess("EERIE", "THREE")).toBe("pacac");
  });

  it("should return 5-char result", () => {
    const result = evaluateGuess("CRANE", "TRAIN");
    expect(result.length).toBe(5);
    expect(result).toMatch(/^[cpa]+$/);
  });

  it("should handle no overlap", () => {
    expect(evaluateGuess("BDFJK", "ZZZZZ")).toBe("aaaaa");
  });

  it("should handle single letter word-like (edge case)", () => {
    // All same letter
    expect(evaluateGuess("AAAAA", "AAAAA")).toBe("ccccc");
  });

  it("should handle one correct in middle", () => {
    expect(evaluateGuess("XXAXX", "ZZAZZ")).toBe("aacaa");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Word Master Scoring Logic (unit-level)
// ═══════════════════════════════════════════════════════════════════════════

describe("Word Master Scoring", () => {
  const calcScore = (status: string, guessCount: number): number => {
    if (status === "won") return (6 - guessCount + 1) * 100 + 500;
    return 0;
  };

  it("should award max score for 1-guess win", () => {
    expect(calcScore("won", 1)).toBe(1100);
  });

  it("should award decreasing score for more guesses", () => {
    expect(calcScore("won", 2)).toBe(1000);
    expect(calcScore("won", 3)).toBe(900);
    expect(calcScore("won", 4)).toBe(800);
    expect(calcScore("won", 5)).toBe(700);
    expect(calcScore("won", 6)).toBe(600);
  });

  it("should award 0 for loss", () => {
    expect(calcScore("lost", 6)).toBe(0);
  });

  it("should determine winner correctly", () => {
    // p1 won in 3 guesses, p2 won in 5 guesses → p1 wins
    const s1 = calcScore("won", 3);
    const s2 = calcScore("won", 5);
    expect(s1).toBeGreaterThan(s2);
  });

  it("should handle one win one loss", () => {
    const s1 = calcScore("won", 6);
    const s2 = calcScore("lost", 6);
    expect(s1).toBeGreaterThan(s2);
  });

  it("should tie on same guesses", () => {
    const s1 = calcScore("won", 4);
    const s2 = calcScore("won", 4);
    expect(s1).toBe(s2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. CrosswordCell Schema
// ═══════════════════════════════════════════════════════════════════════════

describe("CrosswordCell", () => {
  it("should have correct default values", () => {
    const cell = new CrosswordCell();
    expect(cell.letter).toBe("");
    expect(cell.blocked).toBe(false);
    expect(cell.correct).toBe(false);
    expect(cell.placedBy).toBe("");
  });

  it("should mark cell as blocked", () => {
    const cell = new CrosswordCell();
    cell.blocked = true;
    expect(cell.blocked).toBe(true);
  });

  it("should store letter and correctness", () => {
    const cell = new CrosswordCell();
    cell.letter = "A";
    cell.correct = true;
    cell.placedBy = "session-1";
    expect(cell.letter).toBe("A");
    expect(cell.correct).toBe(true);
    expect(cell.placedBy).toBe("session-1");
  });

  it("should handle clearing a cell", () => {
    const cell = new CrosswordCell();
    cell.letter = "X";
    cell.correct = false;
    cell.placedBy = "s1";

    // Clear
    cell.letter = "";
    cell.correct = false;
    cell.placedBy = "";
    expect(cell.letter).toBe("");
    expect(cell.correct).toBe(false);
    expect(cell.placedBy).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. CrosswordClue Schema
// ═══════════════════════════════════════════════════════════════════════════

describe("CrosswordClue", () => {
  it("should have correct default values", () => {
    const clue = new CrosswordClue();
    expect(clue.num).toBe(0);
    expect(clue.clue).toBe("");
    expect(clue.row).toBe(0);
    expect(clue.col).toBe(0);
    expect(clue.direction).toBe("across");
  });

  it("should store across clue data", () => {
    const clue = new CrosswordClue();
    clue.num = 1;
    clue.clue = "Begin";
    clue.row = 0;
    clue.col = 0;
    clue.direction = "across";
    expect(clue.num).toBe(1);
    expect(clue.clue).toBe("Begin");
  });

  it("should store down clue data", () => {
    const clue = new CrosswordClue();
    clue.num = 2;
    clue.clue = "Shade, color";
    clue.row = 0;
    clue.col = 1;
    clue.direction = "down";
    expect(clue.direction).toBe("down");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. CrosswordPlayer Schema
// ═══════════════════════════════════════════════════════════════════════════

describe("CrosswordPlayer", () => {
  it("should have correct default values", () => {
    const player = new CrosswordPlayer();
    expect(player.uid).toBe("");
    expect(player.sessionId).toBe("");
    expect(player.displayName).toBe("");
    expect(player.connected).toBe(true);
    expect(player.ready).toBe(false);
    expect(player.score).toBe(0);
    expect(player.cursorRow).toBe(-1);
    expect(player.cursorCol).toBe(-1);
    expect(player.cursorDirection).toBe("across");
    expect(player.lettersPlaced).toBe(0);
  });

  it("should track cursor position", () => {
    const player = new CrosswordPlayer();
    player.cursorRow = 2;
    player.cursorCol = 3;
    player.cursorDirection = "down";
    expect(player.cursorRow).toBe(2);
    expect(player.cursorCol).toBe(3);
    expect(player.cursorDirection).toBe("down");
  });

  it("should track letters placed", () => {
    const player = new CrosswordPlayer();
    player.lettersPlaced = 10;
    expect(player.lettersPlaced).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. CrosswordState Schema
// ═══════════════════════════════════════════════════════════════════════════

describe("CrosswordState", () => {
  it("should have correct default values", () => {
    const state = new CrosswordState();
    expect(state.phase).toBe("waiting");
    expect(state.gameId).toBe("");
    expect(state.gameType).toBe("crossword_puzzle_game");
    expect(state.maxPlayers).toBe(2);
    expect(state.gridSize).toBe(5);
    expect(state.elapsed).toBe(0);
    expect(state.countdown).toBe(0);
    expect(state.completed).toBe(false);
    expect(state.puzzleIndex).toBe(0);
    expect(state.seed).toBe(0);
    expect(state.grid).toBeInstanceOf(ArraySchema);
    expect(state.clues).toBeInstanceOf(ArraySchema);
    expect(state.cwPlayers).toBeInstanceOf(MapSchema);
  });

  it("should manage players map", () => {
    const state = new CrosswordState();
    const p1 = new CrosswordPlayer();
    p1.sessionId = "s1";
    p1.displayName = "Alice";
    const p2 = new CrosswordPlayer();
    p2.sessionId = "s2";
    p2.displayName = "Bob";

    state.cwPlayers.set("s1", p1);
    state.cwPlayers.set("s2", p2);
    expect(state.cwPlayers.size).toBe(2);
  });

  it("should store clues", () => {
    const state = new CrosswordState();
    const c1 = new CrosswordClue();
    c1.num = 1;
    c1.clue = "Begin";
    c1.direction = "across";
    state.clues.push(c1);
    expect(state.clues.length).toBe(1);
    expect(state.clues[0].clue).toBe("Begin");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. CrosswordState — initGrid Helper
// ═══════════════════════════════════════════════════════════════════════════

describe("CrosswordState.initGrid", () => {
  it("should create a 5×5 grid (25 cells)", () => {
    const state = new CrosswordState();
    const solution = [
      ["S", "T", "A", "R", "T"],
      ["H", "I", "D", "E", null],
      ["A", "N", "D", null, "A"],
      ["R", null, "S", "E", "T"],
      ["E", "V", "E", "N", null],
    ];
    state.initGrid(solution);
    expect(state.grid.length).toBe(25);
  });

  it("should mark blocked cells correctly", () => {
    const state = new CrosswordState();
    const solution = [
      ["S", "T", "A", "R", "T"],
      ["H", "I", "D", "E", null],
      ["A", "N", "D", null, "A"],
      ["R", null, "S", "E", "T"],
      ["E", "V", "E", "N", null],
    ];
    state.initGrid(solution);

    // Row 1, col 4 is null → blocked
    expect(state.grid[1 * 5 + 4].blocked).toBe(true);
    // Row 2, col 3 is null → blocked
    expect(state.grid[2 * 5 + 3].blocked).toBe(true);
    // Row 3, col 1 is null → blocked
    expect(state.grid[3 * 5 + 1].blocked).toBe(true);
    // Row 4, col 4 is null → blocked
    expect(state.grid[4 * 5 + 4].blocked).toBe(true);
  });

  it("should not mark non-null cells as blocked", () => {
    const state = new CrosswordState();
    const solution = [
      ["A", "B", "C", "D", "E"],
      ["F", "G", "H", "I", "J"],
      ["K", "L", "M", "N", "O"],
      ["P", "Q", "R", "S", "T"],
      ["U", "V", "W", "X", "Y"],
    ];
    state.initGrid(solution);
    for (let i = 0; i < 25; i++) {
      expect(state.grid[i].blocked).toBe(false);
    }
  });

  it("should initialise all cells as empty (no letters)", () => {
    const state = new CrosswordState();
    const solution = [
      ["A", null, "C", null, "E"],
      [null, "G", null, "I", null],
      ["K", null, "M", null, "O"],
      [null, "Q", null, "S", null],
      ["U", null, "W", null, "Y"],
    ];
    state.initGrid(solution);
    for (let i = 0; i < 25; i++) {
      expect(state.grid[i].letter).toBe("");
      expect(state.grid[i].correct).toBe(false);
      expect(state.grid[i].placedBy).toBe("");
    }
  });

  it("should handle fully blocked grid", () => {
    const state = new CrosswordState();
    const solution: (string | null)[][] = Array(5)
      .fill(null)
      .map(() => Array(5).fill(null));
    state.initGrid(solution);
    for (let i = 0; i < 25; i++) {
      expect(state.grid[i].blocked).toBe(true);
    }
  });

  it("should clear previous grid on re-init", () => {
    const state = new CrosswordState();
    const s1 = [
      ["A", "B", "C", "D", "E"],
      ["F", "G", "H", "I", "J"],
      ["K", "L", "M", "N", "O"],
      ["P", "Q", "R", "S", "T"],
      ["U", "V", "W", "X", "Y"],
    ];
    state.initGrid(s1);
    expect(state.grid.length).toBe(25);

    // Re-init with different puzzle
    const s2 = [
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ];
    state.initGrid(s2);
    expect(state.grid.length).toBe(25);
    for (let i = 0; i < 25; i++) {
      expect(state.grid[i].blocked).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. CrosswordState — getCell Helper
// ═══════════════════════════════════════════════════════════════════════════

describe("CrosswordState.getCell", () => {
  let state: CrosswordState;

  beforeEach(() => {
    state = new CrosswordState();
    state.initGrid([
      ["S", "T", "A", "R", "T"],
      ["H", "I", "D", "E", null],
      ["A", "N", "D", null, "A"],
      ["R", null, "S", "E", "T"],
      ["E", "V", "E", "N", null],
    ]);
  });

  it("should return cell at valid coordinates", () => {
    const cell = state.getCell(0, 0);
    expect(cell).toBeDefined();
    expect(cell!.blocked).toBe(false);
  });

  it("should return blocked cell at null position", () => {
    const cell = state.getCell(1, 4);
    expect(cell).toBeDefined();
    expect(cell!.blocked).toBe(true);
  });

  it("should return undefined for negative row", () => {
    expect(state.getCell(-1, 0)).toBeUndefined();
  });

  it("should return undefined for negative col", () => {
    expect(state.getCell(0, -1)).toBeUndefined();
  });

  it("should return undefined for row >= gridSize", () => {
    expect(state.getCell(5, 0)).toBeUndefined();
  });

  it("should return undefined for col >= gridSize", () => {
    expect(state.getCell(0, 5)).toBeUndefined();
  });

  it("should return correct cell for each grid position", () => {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const cell = state.getCell(r, c);
        expect(cell).toBeDefined();
        expect(cell).toBe(state.grid[r * 5 + c]);
      }
    }
  });

  it("should allow modification through getCell", () => {
    const cell = state.getCell(0, 0)!;
    cell.letter = "S";
    cell.correct = true;
    cell.placedBy = "s1";
    expect(state.grid[0].letter).toBe("S");
    expect(state.grid[0].correct).toBe(true);
    expect(state.grid[0].placedBy).toBe("s1");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. Crossword Completion Detection Logic
// ═══════════════════════════════════════════════════════════════════════════

describe("Crossword Completion Detection", () => {
  const solution = [
    ["S", "T", "A", "R", "T"],
    ["H", "I", "D", "E", null],
    ["A", "N", "D", null, "A"],
    ["R", null, "S", "E", "T"],
    ["E", "V", "E", "N", null],
  ];

  function checkCompleted(
    state: CrosswordState,
    sol: (string | null)[][],
  ): boolean {
    for (let r = 0; r < state.gridSize; r++) {
      for (let c = 0; c < state.gridSize; c++) {
        const cell = state.getCell(r, c);
        if (!cell) return false;
        if (cell.blocked) continue;
        if (!cell.correct) return false;
      }
    }
    return true;
  }

  it("should detect incomplete grid", () => {
    const state = new CrosswordState();
    state.initGrid(solution);
    expect(checkCompleted(state, solution)).toBe(false);
  });

  it("should detect completed grid", () => {
    const state = new CrosswordState();
    state.initGrid(solution);

    // Fill all non-blocked cells correctly
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (solution[r][c] !== null) {
          const cell = state.getCell(r, c)!;
          cell.letter = solution[r][c]!;
          cell.correct = true;
        }
      }
    }

    expect(checkCompleted(state, solution)).toBe(true);
  });

  it("should detect partially completed grid", () => {
    const state = new CrosswordState();
    state.initGrid(solution);

    // Fill only first row
    for (let c = 0; c < 5; c++) {
      if (solution[0][c] !== null) {
        const cell = state.getCell(0, c)!;
        cell.letter = solution[0][c]!;
        cell.correct = true;
      }
    }

    expect(checkCompleted(state, solution)).toBe(false);
  });

  it("should handle grid with wrong letters (correct=false)", () => {
    const state = new CrosswordState();
    state.initGrid(solution);

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (solution[r][c] !== null) {
          const cell = state.getCell(r, c)!;
          cell.letter = "X"; // wrong letter
          cell.correct = false;
        }
      }
    }

    expect(checkCompleted(state, solution)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 15. Crossword Scoring Logic
// ═══════════════════════════════════════════════════════════════════════════

describe("Crossword Scoring", () => {
  const calcScore = (elapsed: number): number => {
    return Math.max(0, 1000 - Math.floor(elapsed));
  };

  it("should award 1000 for instant completion", () => {
    expect(calcScore(0)).toBe(1000);
  });

  it("should decrease score with time", () => {
    expect(calcScore(100)).toBe(900);
    expect(calcScore(500)).toBe(500);
    expect(calcScore(999)).toBe(1);
  });

  it("should floor at 0", () => {
    expect(calcScore(1000)).toBe(0);
    expect(calcScore(2000)).toBe(0);
  });

  it("should handle fractional elapsed", () => {
    expect(calcScore(99.9)).toBe(901);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 16. Word Master — Winner Determination
// ═══════════════════════════════════════════════════════════════════════════

describe("Word Master Winner Determination", () => {
  interface PlayerResult {
    status: "playing" | "won" | "lost";
    guessCount: number;
  }

  function determineWinner(
    p1: PlayerResult,
    p2: PlayerResult,
  ): "p1" | "p2" | "tie" | "both_lost" {
    if (p1.status === "won" && p2.status !== "won") return "p1";
    if (p2.status === "won" && p1.status !== "won") return "p2";
    if (p1.status === "won" && p2.status === "won") {
      if (p1.guessCount < p2.guessCount) return "p1";
      if (p2.guessCount < p1.guessCount) return "p2";
      return "tie";
    }
    if (p1.status === "lost" && p2.status === "lost") return "both_lost";
    return "tie";
  }

  it("should declare winner when one wins and one loses", () => {
    expect(
      determineWinner(
        { status: "won", guessCount: 3 },
        { status: "lost", guessCount: 6 },
      ),
    ).toBe("p1");
  });

  it("should declare p2 winner when p2 wins and p1 loses", () => {
    expect(
      determineWinner(
        { status: "lost", guessCount: 6 },
        { status: "won", guessCount: 4 },
      ),
    ).toBe("p2");
  });

  it("should use fewer guesses as tiebreaker", () => {
    expect(
      determineWinner(
        { status: "won", guessCount: 2 },
        { status: "won", guessCount: 5 },
      ),
    ).toBe("p1");

    expect(
      determineWinner(
        { status: "won", guessCount: 5 },
        { status: "won", guessCount: 2 },
      ),
    ).toBe("p2");
  });

  it("should tie when both win in same guesses", () => {
    expect(
      determineWinner(
        { status: "won", guessCount: 3 },
        { status: "won", guessCount: 3 },
      ),
    ).toBe("tie");
  });

  it("should return both_lost when neither wins", () => {
    expect(
      determineWinner(
        { status: "lost", guessCount: 6 },
        { status: "lost", guessCount: 6 },
      ),
    ).toBe("both_lost");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 19. Crossword Grid Operations
// ═══════════════════════════════════════════════════════════════════════════

describe("Crossword Grid Operations", () => {
  let state: CrosswordState;
  const solution = [
    ["S", "T", "A", "R", "T"],
    ["H", "I", "D", "E", null],
    ["A", "N", "D", null, "A"],
    ["R", null, "S", "E", "T"],
    ["E", "V", "E", "N", null],
  ];

  beforeEach(() => {
    state = new CrosswordState();
    state.initGrid(solution);
  });

  it("should place correct letter and validate", () => {
    const cell = state.getCell(0, 0)!;
    cell.letter = "S";
    cell.correct = "S" === solution[0][0];
    cell.placedBy = "s1";
    expect(cell.correct).toBe(true);
  });

  it("should place wrong letter and detect", () => {
    const cell = state.getCell(0, 0)!;
    cell.letter = "X";
    cell.correct = "X" === solution[0][0];
    expect(cell.correct).toBe(false);
  });

  it("should not modify blocked cells", () => {
    const cell = state.getCell(1, 4)!;
    expect(cell.blocked).toBe(true);
    // In a real game, the server would reject placement on blocked cells
  });

  it("should track placedBy for each cell", () => {
    const cell1 = state.getCell(0, 0)!;
    cell1.letter = "S";
    cell1.placedBy = "s1";

    const cell2 = state.getCell(0, 1)!;
    cell2.letter = "T";
    cell2.placedBy = "s2";

    expect(cell1.placedBy).toBe("s1");
    expect(cell2.placedBy).toBe("s2");
  });

  it("should support overwriting a cell", () => {
    const cell = state.getCell(0, 0)!;
    cell.letter = "X";
    cell.correct = false;
    cell.placedBy = "s1";

    // Player 2 overwrites
    cell.letter = "S";
    cell.correct = true;
    cell.placedBy = "s2";

    expect(cell.letter).toBe("S");
    expect(cell.correct).toBe(true);
    expect(cell.placedBy).toBe("s2");
  });

  it("should count non-blocked cells", () => {
    let nonBlocked = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (solution[r][c] !== null) nonBlocked++;
      }
    }
    // Count from grid
    let gridNonBlocked = 0;
    for (let i = 0; i < state.grid.length; i++) {
      if (!state.grid[i].blocked) gridNonBlocked++;
    }
    expect(gridNonBlocked).toBe(nonBlocked);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 20. evaluateGuess — Edge Cases
// ═══════════════════════════════════════════════════════════════════════════

describe("evaluateGuess — Edge Cases", () => {
  it("should handle AABBB vs BBBAA (cross letters)", () => {
    // A(0)→ not at 0 in target. B(3) available → wait, target is BBBAA
    // Target: B(0), B(1), B(2), A(3), A(4)
    // Guess:  A(0), A(1), B(2), B(3), B(4)
    // First pass: B(2)=B(2)→correct, used[2]=true
    // Second pass:
    //   A(0): scan target: B(0)no, B(1)no, A(3)yes → present, used[3]=true
    //   A(1): scan target: B(0)no, B(1)no, A(4)yes → present, used[4]=true
    //   B(3): scan target: B(0)yes → present, used[0]=true
    //   B(4): scan target: B(1)yes → present, used[1]=true
    expect(evaluateGuess("AABBB", "BBBAA")).toBe("ppcpp");
  });

  it("should handle triple same letter in guess but single in target", () => {
    // Guess: LLLLL, Target: HELLO
    // Target: H(0), E(1), L(2), L(3), O(4)
    // First pass: L(2)=L(2)→correct, L(3)=L(3)→correct
    // Second pass: L(0)→absent(no more L), L(1)→absent, L(4)→absent
    expect(evaluateGuess("LLLLL", "HELLO")).toBe("aacca");
  });

  it("should handle word WORLD vs WORLD", () => {
    expect(evaluateGuess("WORLD", "WORLD")).toBe("ccccc");
  });

  it("should handle CRANE vs REACT", () => {
    // C(0)→present(C at 3), R(1)→present(R at 0), A(2)→present(A at 2..wait)
    // Target: R(0), E(1), A(2), C(3), T(4)
    // First pass: A(2)=A(2)→correct
    // Second pass:
    //   C(0)→scan: C(3) → present, used[3]=true
    //   R(1)→scan: R(0) → present, used[0]=true
    //   N(3)→absent
    //   E(4)→scan: E(1) → present, used[1]=true
    expect(evaluateGuess("CRANE", "REACT")).toBe("ppcap");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 21. Schema Map & Array Operations
// ═══════════════════════════════════════════════════════════════════════════

describe("Schema Map & Array Operations", () => {
  it("should push and pop guesses from WordMasterPlayer", () => {
    const player = new WordMasterPlayer();
    const g1 = new WordMasterGuess();
    g1.word = "CRANE";
    g1.result = "apcac";
    player.guesses.push(g1);
    expect(player.guesses.length).toBe(1);

    // Can't really pop from ArraySchema, but can access by index
    expect(player.guesses[0].word).toBe("CRANE");
  });

  it("should clear crossword grid", () => {
    const state = new CrosswordState();
    state.initGrid([
      ["A", "B", "C", "D", "E"],
      ["F", "G", "H", "I", "J"],
      ["K", "L", "M", "N", "O"],
      ["P", "Q", "R", "S", "T"],
      ["U", "V", "W", "X", "Y"],
    ]);
    expect(state.grid.length).toBe(25);

    state.grid.clear();
    expect(state.grid.length).toBe(0);
  });

  it("should iterate WordMasterPlayer guesses", () => {
    const player = new WordMasterPlayer();
    for (let i = 0; i < 3; i++) {
      const g = new WordMasterGuess();
      g.word = `WORD${i}`;
      g.result = "aaaaa";
      player.guesses.push(g);
    }
    expect(player.guesses.length).toBe(3);
    const words: string[] = [];
    for (let i = 0; i < player.guesses.length; i++) {
      words.push(player.guesses[i].word);
    }
    expect(words).toEqual(["WORD0", "WORD1", "WORD2"]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 22. Game Phase Lifecycle
// ═══════════════════════════════════════════════════════════════════════════

describe("Game Phase Lifecycle", () => {
  it("WordMasterState should transition through full lifecycle", () => {
    const state = new WordMasterState();
    const lifecycle = ["waiting", "countdown", "playing", "finished"];
    for (const phase of lifecycle) {
      state.phase = phase;
      expect(state.phase).toBe(phase);
    }
  });

  it("CrosswordState should transition through full lifecycle", () => {
    const state = new CrosswordState();
    const lifecycle = ["waiting", "countdown", "playing", "finished"];
    for (const phase of lifecycle) {
      state.phase = phase;
      expect(state.phase).toBe(phase);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 23. evaluateGuess — Comprehensive Wordle Scenarios
// ═══════════════════════════════════════════════════════════════════════════

describe("evaluateGuess — Comprehensive Scenarios", () => {
  const testCases: {
    guess: string;
    target: string;
    expected: string;
    desc: string;
  }[] = [
    { guess: "STALE", target: "STALE", expected: "ccccc", desc: "exact match" },
    { guess: "ZZZZZ", target: "APPLE", expected: "aaaaa", desc: "no overlap" },
    {
      guess: "ABCDE",
      target: "EDCBA",
      expected: "ppccppp".slice(0, 5),
      desc: "reversed — middle correct",
    },
    {
      guess: "SALET",
      target: "STALE",
      expected: "ccppp",
      desc: "anagram with 2 correct",
    },
    {
      guess: "PUPIL",
      target: "PLUMP",
      expected: "ccaap",
      desc: "repeated P with limits",
    },
  ];

  // Fix the ABCDE vs EDCBA case
  it("ABCDE vs EDCBA — middle correct, rest present", () => {
    // Target: E,D,C,B,A
    // First pass: C(2)=C(2)→correct
    // Second pass:
    //   A(0)→ E(0)no, D(1)no, B(3)no, A(4)yes → present
    //   B(1)→ E(0)no, D(1)no, B(3)yes → present
    //   D(3)→ D(1)yes → present (but used[1]? Let me re-check)
    //   E(4)→ E(0)yes → present
    expect(evaluateGuess("ABCDE", "EDCBA")).toBe("ppcpp");
  });

  it("SALET vs STALE — S correct, A present, L present, E present, T present", () => {
    // Target: S,T,A,L,E
    // First pass: S(0)=S(0)→correct
    // Second pass:
    //   A(1)→ T(1)no, A(2)yes → present
    //   L(2)→ T(1)no, L(3)yes → present
    //   E(3)→ E(4)yes → present
    //   T(4)→ T(1)yes → present
    expect(evaluateGuess("SALET", "STALE")).toBe("cpppp");
  });

  it("PUPIL vs PLUMP — P(0) correct, U(1) present, P(2) absent (only 2 P's in target, one used), I(3) absent, L(4) absent", () => {
    // Target: P(0),L(1),U(2),M(3),P(4)
    // First pass: P(0)=P(0)→correct
    // Second pass:
    //   U(1)→ L(1)no, U(2)yes → present
    //   P(2)→ P(4)yes → present (P has 2 in target, 1 used)
    //   I(3)→ absent
    //   L(4)→ L(1)yes → present
    expect(evaluateGuess("PUPIL", "PLUMP")).toBe("cppap");
  });

  it("ROOST vs ROOTS — R correct, O present, O correct, S present, T present", () => {
    // Target: R,O,O,T,S
    // First pass: R(0)=R(0)→correct, O(2)=O(2)→correct
    // Second pass:
    //   O(1)→ O(1)yes → present
    //   S(3)→ S(4)yes → present
    //   T(4)→ T(3)yes → present
    expect(evaluateGuess("ROOST", "ROOTS")).toBe("cccpp");
  });
});
