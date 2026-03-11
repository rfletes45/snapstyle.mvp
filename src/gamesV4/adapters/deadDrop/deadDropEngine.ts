/**
 * Games V4 — Dead Drop Engine
 *
 * Pure-function game logic for board generation, clue validation, guess
 * resolution, and win-condition checks. No side effects, no Firebase deps.
 *
 * @module gamesV4/adapters/deadDrop/deadDropEngine
 */

import { selectWords, type WordPack } from "../../data/deadDropWords";
import type {
  AdvancedClueMode,
  CardAlignment,
  ClueLegalityMode,
  EndReason,
  GamePhase,
  PublicCard,
  TeamAssignment,
  TeamColor,
} from "./deadDropTypes";

// =============================================================================
// Board Generation
// =============================================================================

const BOARD_SIZE = 25;

export interface GeneratedBoard {
  cards: PublicCard[];
  keyMap: Record<number, CardAlignment>;
  startingTeam: TeamColor;
  redTotal: number;
  blueTotal: number;
}

/**
 * Generate a fresh 5×5 board with hidden alignment assignments.
 *
 * Starting team gets 9 words, other team gets 8, 7 neutral, 1 assassin.
 */
export function generateBoard(
  pack: WordPack,
  startingTeam: TeamColor,
): GeneratedBoard {
  const words = selectWords(pack, BOARD_SIZE);

  // Build alignment slots: 9 + 8 + 7 + 1 = 25
  const alignments: CardAlignment[] = [];
  const firstCount = 9;
  const secondCount = 8;
  const neutralCount = 7;

  for (let i = 0; i < firstCount; i++) alignments.push(startingTeam);
  for (let i = 0; i < secondCount; i++)
    alignments.push(startingTeam === "red" ? "blue" : "red");
  for (let i = 0; i < neutralCount; i++) alignments.push("neutral");
  alignments.push("assassin");

  // Shuffle alignments (Fisher-Yates)
  for (let i = alignments.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [alignments[i], alignments[j]] = [alignments[j], alignments[i]];
  }

  const cards: PublicCard[] = words.map((word, idx) => ({
    id: idx,
    word: word.toUpperCase(),
    revealed: false,
    revealedAs: null,
    revealedByTeam: null,
    revealedTurn: null,
    revealedFromClueId: null,
  }));

  const keyMap: Record<number, CardAlignment> = {};
  for (let i = 0; i < BOARD_SIZE; i++) {
    keyMap[i] = alignments[i];
  }

  return {
    cards,
    keyMap,
    startingTeam,
    redTotal: startingTeam === "red" ? firstCount : secondCount,
    blueTotal: startingTeam === "blue" ? firstCount : secondCount,
  };
}

// =============================================================================
// Team / Role Helpers
// =============================================================================

export function getTeamAssignment(
  teams: TeamAssignment[],
  uid: string,
): TeamAssignment | undefined {
  return teams.find((t) => t.uid === uid);
}

export function getSpymaster(
  teams: TeamAssignment[],
  team: TeamColor,
): TeamAssignment | undefined {
  return teams.find((t) => t.team === team && t.role === "spymaster");
}

export function getOperative(
  teams: TeamAssignment[],
  team: TeamColor,
): TeamAssignment | undefined {
  return teams.find((t) => t.team === team && t.role === "operative");
}

// =============================================================================
// Clue Validation
// =============================================================================

/**
 * Normalize a string for comparison: lowercase, trim, remove accents.
 */
function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, "'")
    .replace(/[^\w']/g, "");
}

/**
 * Simple English stemming: strip common suffixes.
 * Not a full NLP stemmer — just enough for obvious inflections.
 */
function roughStem(word: string): string {
  let s = normalize(word);
  // Order matters: longest suffixes first
  if (s.endsWith("ies") && s.length > 4) s = s.slice(0, -3) + "y";
  else if (s.endsWith("ves") && s.length > 4) s = s.slice(0, -3) + "f";
  else if (s.endsWith("ness") && s.length > 5) s = s.slice(0, -4);
  else if (s.endsWith("ment") && s.length > 5) s = s.slice(0, -4);
  else if (s.endsWith("ing") && s.length > 4) s = s.slice(0, -3);
  else if (s.endsWith("tion") && s.length > 5) s = s.slice(0, -4);
  else if (s.endsWith("sion") && s.length > 5) s = s.slice(0, -4);
  else if (s.endsWith("able") && s.length > 5) s = s.slice(0, -4);
  else if (s.endsWith("ible") && s.length > 5) s = s.slice(0, -4);
  else if (s.endsWith("ful") && s.length > 4) s = s.slice(0, -3);
  else if (s.endsWith("less") && s.length > 5) s = s.slice(0, -4);
  else if (s.endsWith("ous") && s.length > 4) s = s.slice(0, -3);
  else if (s.endsWith("ive") && s.length > 4) s = s.slice(0, -3);
  else if (s.endsWith("ed") && s.length > 3) s = s.slice(0, -2);
  else if (s.endsWith("es") && s.length > 3) s = s.slice(0, -2);
  else if (s.endsWith("er") && s.length > 3) s = s.slice(0, -2);
  else if (s.endsWith("ly") && s.length > 3) s = s.slice(0, -2);
  else if (s.endsWith("s") && s.length > 2) s = s.slice(0, -1);
  return s;
}

/** Meta/positional clue patterns blocked in Standard and Tournament modes. */
const META_PATTERNS =
  /^(top|bottom|left|right|middle|center|corner|edge|row|column|col|first|second|third|fourth|fifth|[1-5]|adjacent|diagonal|above|below|next|this|that|here|there)$/;

export interface ClueValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a proposed clue against the board and rule set.
 */
export function validateClue(
  word: string,
  count: number,
  cards: PublicCard[],
  mode: ClueLegalityMode,
  advancedClues: AdvancedClueMode,
): ClueValidationResult {
  const trimmed = word.trim();

  // Must be non-empty
  if (!trimmed) {
    return { valid: false, error: "Clue cannot be empty." };
  }

  // Must be a single word (no spaces except hyphenated compounds)
  if (/\s/.test(trimmed) && !trimmed.match(/^\S+-\S+$/)) {
    return { valid: false, error: "Clue must be a single word." };
  }

  // Must not contain only numbers
  if (/^\d+$/.test(trimmed)) {
    return { valid: false, error: "Clue cannot be a number." };
  }

  // Count validation
  if (advancedClues === "off") {
    if (count < 1) {
      return {
        valid: false,
        error: "Count must be at least 1 in standard mode.",
      };
    }
  } else if (advancedClues === "zero") {
    if (count < 0) {
      return {
        valid: false,
        error: "Unlimited clues are not enabled. Count must be 0 or higher.",
      };
    }
  }
  // "zero_unlimited" allows -1 (unlimited) and 0

  if (count > 25) {
    return { valid: false, error: "Count cannot exceed 25." };
  }

  // Check against visible board words
  const clueNorm = normalize(trimmed);
  const clueStem = roughStem(trimmed);

  for (const card of cards) {
    if (card.revealed) continue; // Only check unrevealed words
    const cardNorm = normalize(card.word);
    const cardStem = roughStem(card.word);

    // Exact match
    if (clueNorm === cardNorm) {
      return {
        valid: false,
        error: `Clue matches a visible board word: "${card.word}".`,
      };
    }

    // Standard and Tournament: check stem similarity
    if (mode !== "relaxed") {
      if (clueStem === cardStem) {
        return {
          valid: false,
          error: `Clue appears to be a form of board word "${card.word}".`,
        };
      }
      // Check if clue contains or is contained by a board word
      if (
        clueNorm.length >= 4 &&
        cardNorm.length >= 4 &&
        (clueNorm.includes(cardNorm) || cardNorm.includes(clueNorm))
      ) {
        return {
          valid: false,
          error: `Clue is too similar to board word "${card.word}".`,
        };
      }
    }
  }

  // Standard and Tournament: block meta/positional clues
  if (mode !== "relaxed" && META_PATTERNS.test(clueNorm)) {
    return {
      valid: false,
      error: "Positional or meta clues are not allowed in this mode.",
    };
  }

  // Tournament: extra restrictions
  if (mode === "tournament") {
    // Block very short clues (likely meta)
    if (clueNorm.length < 2) {
      return {
        valid: false,
        error: "Tournament mode requires clues of at least 2 characters.",
      };
    }
  }

  return { valid: true };
}

// =============================================================================
// Guess Resolution
// =============================================================================

export interface GuessResult {
  alignment: CardAlignment;
  outcome: "correct" | "neutral" | "enemy" | "assassin";
  turnEnds: boolean;
  gameEnds: boolean;
  endReason?: EndReason;
  winnerTeam?: TeamColor;
}

/**
 * Resolve a guess against the secret key map.
 */
export function resolveGuess(
  cardId: number,
  guessingTeam: TeamColor,
  keyMap: Record<number, CardAlignment>,
  redRemaining: number,
  blueRemaining: number,
): GuessResult {
  const alignment = keyMap[cardId];

  if (alignment === guessingTeam) {
    // Correct — reveal team's agent
    const newRemaining =
      guessingTeam === "red" ? redRemaining - 1 : blueRemaining - 1;
    if (newRemaining === 0) {
      return {
        alignment,
        outcome: "correct",
        turnEnds: true,
        gameEnds: true,
        endReason: "all_agents_found",
        winnerTeam: guessingTeam,
      };
    }
    return { alignment, outcome: "correct", turnEnds: false, gameEnds: false };
  }

  if (alignment === "assassin") {
    const winnerTeam = guessingTeam === "red" ? "blue" : "red";
    return {
      alignment,
      outcome: "assassin",
      turnEnds: true,
      gameEnds: true,
      endReason: "assassin",
      winnerTeam,
    };
  }

  if (alignment === "neutral") {
    return {
      alignment,
      outcome: "neutral",
      turnEnds: true,
      gameEnds: false,
    };
  }

  // Enemy team's word
  const enemyTeam = guessingTeam === "red" ? "blue" : "red";
  const enemyRemaining = enemyTeam === "red" ? redRemaining : blueRemaining;
  if (enemyRemaining - 1 === 0) {
    // Accidentally revealed the last enemy agent — enemy wins
    return {
      alignment,
      outcome: "enemy",
      turnEnds: true,
      gameEnds: true,
      endReason: "all_agents_found",
      winnerTeam: enemyTeam,
    };
  }
  return { alignment, outcome: "enemy", turnEnds: true, gameEnds: false };
}

// =============================================================================
// Turn Logic Helpers
// =============================================================================

/**
 * Compute the maximum guesses allowed for a clue.
 */
export function computeMaxGuesses(
  count: number,
  bonusGuessAllowed: boolean,
): number {
  if (count === -1) return 25; // unlimited
  if (count === 0) return bonusGuessAllowed ? 1 : 0;
  return count + (bonusGuessAllowed ? 1 : 0);
}

/**
 * Get the next team (opposite of current).
 */
export function oppositeTeam(team: TeamColor): TeamColor {
  return team === "red" ? "blue" : "red";
}

/**
 * Determine whose turn it is next and what phase.
 */
export function nextTurnState(
  currentTeam: TeamColor,
  teams: TeamAssignment[],
): {
  turnTeam: TeamColor;
  currentTurnPlayerId: string;
  currentTurnRole: "spymaster";
  phase: GamePhase;
} {
  const nextTeam = oppositeTeam(currentTeam);
  const sm = getSpymaster(teams, nextTeam);
  return {
    turnTeam: nextTeam,
    currentTurnPlayerId: sm!.uid,
    currentTurnRole: "spymaster",
    phase: "clue_input",
  };
}
