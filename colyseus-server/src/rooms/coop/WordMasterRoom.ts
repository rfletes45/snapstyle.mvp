import { createServerLogger } from "../../utils/logger";
const log = createServerLogger("WordMasterRoom");

/**
 * WordMasterRoom â€” Competitive Wordle (parallel play)
 *
 * Gameplay:
 * 1. Both players join â†’ "waiting"
 * 2. Both ready â†’ "countdown" (3s)
 * 3. Both players get the SAME 5-letter target word
 * 4. Players guess simultaneously (up to 6 guesses each)
 * 5. Each guess is evaluated: correct / present / absent per letter
 * 6. Opponent's guesses are visible in real-time (letters hidden,
 *    only colour feedback shown to prevent cheating)
 * 7. Game ends when both players finish (win/lose/max guesses)
 *
 * Scoring:
 *   - Win: (maxGuesses - guessesUsed) * 100 + 500
 *   - Loss: 0
 *   - If tied on win status, fewer guesses wins
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md â€” Phase 5.2
 */

import { Client, Room } from "colyseus";
import { BaseGameState } from "../../schemas/common";
import {
  WordMasterGuess,
  WordMasterPlayer,
  WordMasterState,
} from "../../schemas/draw";
import { verifyFirebaseToken } from "../../services/firebase";
import { persistGameResult } from "../../services/persistence";

// =============================================================================
// Constants
// =============================================================================

const MAX_GUESSES = 6;
const WORD_LENGTH = 5;

/**
 * Curated word list for multiplayer.
 * Subset of common 5-letter words for a fair game.
 */
const WORD_LIST = [
  "ABOUT",
  "ABOVE",
  "ABUSE",
  "ACTOR",
  "ACUTE",
  "ADMIT",
  "ADOPT",
  "ADULT",
  "AFTER",
  "AGAIN",
  "AGENT",
  "AGREE",
  "AHEAD",
  "ALARM",
  "ALBUM",
  "ALERT",
  "ALIEN",
  "ALIGN",
  "ALIKE",
  "ALIVE",
  "ALLOW",
  "ALONE",
  "ALONG",
  "ALTER",
  "AMONG",
  "ANGEL",
  "ANGER",
  "ANGLE",
  "ANGRY",
  "APART",
  "APPLE",
  "APPLY",
  "ARENA",
  "ARGUE",
  "ARISE",
  "ARMOR",
  "ARROW",
  "ASIDE",
  "AVOID",
  "AWARD",
  "AWARE",
  "BASIC",
  "BEACH",
  "BEGIN",
  "BEING",
  "BELOW",
  "BENCH",
  "BIRTH",
  "BLACK",
  "BLADE",
  "BLAME",
  "BLANK",
  "BLAST",
  "BLEND",
  "BLIND",
  "BLOCK",
  "BLOOD",
  "BOARD",
  "BOOST",
  "BRAIN",
  "BRAND",
  "BRAVE",
  "BREAD",
  "BREAK",
  "BRICK",
  "BRIEF",
  "BRING",
  "BROAD",
  "BROWN",
  "BUILD",
  "BUNCH",
  "BURST",
  "BUYER",
  "CABLE",
  "CARRY",
  "CATCH",
  "CAUSE",
  "CHAIN",
  "CHAIR",
  "CHAOS",
  "CHARM",
  "CHART",
  "CHASE",
  "CHEAP",
  "CHECK",
  "CHESS",
  "CHEST",
  "CHIEF",
  "CHILD",
  "CHOSE",
  "CIVIL",
  "CLAIM",
  "CLASS",
  "CLEAN",
  "CLEAR",
  "CLIMB",
  "CLOCK",
  "CLOSE",
  "CLOUD",
  "COACH",
  "COAST",
  "COUNT",
  "COURT",
  "COVER",
  "CRAFT",
  "CRASH",
  "CRAZY",
  "CREAM",
  "CRIME",
  "CROSS",
  "CROWD",
  "CROWN",
  "DANCE",
  "DEATH",
  "DELAY",
  "DEPTH",
  "DIRTY",
  "DOUBT",
  "DRAFT",
  "DRAIN",
  "DRAMA",
  "DREAM",
  "DRESS",
  "DRINK",
  "DRIVE",
  "EARLY",
  "EARTH",
  "EIGHT",
  "ELECT",
  "EMPTY",
  "ENEMY",
  "ENJOY",
  "ENTER",
  "ENTRY",
  "EQUAL",
  "ERROR",
  "EVENT",
  "EVERY",
  "EXACT",
  "EXIST",
  "EXTRA",
  "FAITH",
  "FALSE",
  "FAULT",
  "FEAST",
  "FIELD",
  "FIFTY",
  "FIGHT",
  "FINAL",
  "FIRST",
  "FLAME",
  "FLASH",
  "FLOAT",
  "FLOOD",
  "FLOOR",
  "FOCUS",
  "FORCE",
  "FORTH",
  "FORTY",
  "FOUND",
  "FRAME",
  "FRAUD",
  "FRESH",
  "FRONT",
  "FRUIT",
  "FUNNY",
  "GHOST",
  "GIANT",
  "GIVEN",
  "GLASS",
  "GLOBE",
  "GRACE",
  "GRADE",
  "GRAIN",
  "GRAND",
  "GRANT",
  "GRAPE",
  "GRASP",
  "GRASS",
  "GRAVE",
  "GREAT",
  "GREEN",
  "GREET",
  "GROSS",
  "GROUP",
  "GROWN",
  "GUARD",
  "GUESS",
  "GUIDE",
  "HAPPY",
  "HARSH",
  "HEART",
  "HEAVY",
  "HORSE",
  "HOTEL",
  "HOUSE",
  "HUMAN",
  "HUMOR",
  "HURRY",
  "IMAGE",
  "IMPLY",
  "INDEX",
  "INNER",
  "INPUT",
  "ISSUE",
  "IVORY",
  "JEWEL",
  "JOINT",
  "JUDGE",
  "JUICE",
  "KNOCK",
  "KNOWN",
  "LABEL",
  "LABOR",
  "LARGE",
  "LASER",
  "LATER",
  "LAUGH",
  "LAYER",
  "LEARN",
  "LEASE",
  "LEAST",
  "LEGAL",
  "LEVEL",
  "LIGHT",
  "LIMIT",
  "LINEN",
  "LIVER",
  "LOCAL",
  "LOGIC",
  "LOOSE",
  "LOVER",
  "LOWER",
  "LUCKY",
  "LUNCH",
  "MAGIC",
  "MAJOR",
  "MAKER",
  "MARCH",
  "MATCH",
  "MAYOR",
  "MEDIA",
  "MERCY",
  "METAL",
  "MIGHT",
  "MINOR",
  "MINUS",
  "MIXED",
  "MODEL",
  "MONEY",
  "MONTH",
  "MORAL",
  "MOTOR",
  "MOUNT",
  "MOUSE",
  "MOUTH",
  "MOVIE",
  "MUSIC",
  "NASTY",
  "NAVAL",
  "NERVE",
  "NEVER",
  "NIGHT",
  "NOISE",
  "NORTH",
  "NOTED",
  "NOVEL",
  "NURSE",
  "OCEAN",
  "OFFER",
  "OFTEN",
  "OPERA",
  "ORDER",
  "OTHER",
  "OUGHT",
  "OUTER",
  "OWNER",
  "PAINT",
  "PANEL",
  "PAPER",
  "PARTY",
  "PATCH",
  "PAUSE",
  "PEACE",
  "PENNY",
  "PHASE",
  "PHONE",
  "PHOTO",
  "PIANO",
  "PIECE",
  "PILOT",
  "PITCH",
  "PIXEL",
  "PIZZA",
  "PLACE",
  "PLAIN",
  "PLANE",
  "PLANT",
  "PLATE",
  "PLAZA",
  "PLEAD",
  "PLUME",
  "POINT",
  "POLAR",
  "POUND",
  "POWER",
  "PRESS",
  "PRICE",
  "PRIDE",
  "PRIME",
  "PRINT",
  "PRIOR",
  "PRIZE",
  "PROOF",
  "PROUD",
  "PROVE",
  "QUEEN",
  "QUEST",
  "QUICK",
  "QUIET",
  "QUOTE",
  "RADIO",
  "RAISE",
  "RANGE",
  "RAPID",
  "RATIO",
  "REACH",
  "REALM",
  "REBEL",
  "REIGN",
  "RELAX",
  "REPLY",
  "RIGHT",
  "RIGID",
  "RISKY",
  "RIVAL",
  "RIVER",
  "ROBIN",
  "ROBOT",
  "ROCKY",
  "ROUGH",
  "ROUND",
  "ROUTE",
  "ROYAL",
  "RURAL",
  "SAINT",
  "SALAD",
  "SCALE",
  "SCENE",
  "SCOPE",
  "SCORE",
  "SENSE",
  "SERVE",
  "SEVEN",
  "SHALL",
  "SHAME",
  "SHAPE",
  "SHARE",
  "SHARP",
  "SHELF",
  "SHELL",
  "SHIFT",
  "SHINE",
  "SHIRT",
  "SHOCK",
  "SHOOT",
  "SHORT",
  "SHOUT",
  "SIGHT",
  "SINCE",
  "SIXTH",
  "SIXTY",
  "SKILL",
  "SLAVE",
  "SLEEP",
  "SLICE",
  "SLIDE",
  "SMALL",
  "SMART",
  "SMELL",
  "SMILE",
  "SMOKE",
  "SNAKE",
  "SOLAR",
  "SOLID",
  "SOLVE",
  "SORRY",
  "SOUND",
  "SOUTH",
  "SPACE",
  "SPARE",
  "SPEAK",
  "SPEED",
  "SPEND",
  "SPENT",
  "SPILL",
  "SPLIT",
  "SPOKE",
  "SPORT",
  "SPRAY",
  "STACK",
  "STAFF",
  "STAGE",
  "STAKE",
  "STALE",
  "STAND",
  "STARE",
  "START",
  "STATE",
  "STEAM",
  "STEEL",
  "STEEP",
  "STEER",
  "STICK",
  "STIFF",
  "STILL",
  "STOCK",
  "STONE",
  "STOOD",
  "STORE",
  "STORM",
  "STORY",
  "STOVE",
  "STRIP",
  "STUCK",
  "STUDY",
  "STUFF",
  "STYLE",
  "SUGAR",
  "SUITE",
  "SUNNY",
  "SUPER",
  "SURGE",
  "SWEAR",
  "SWEET",
  "SWEPT",
  "SWIFT",
  "SWING",
  "SWORN",
  "TABLE",
  "TASTE",
  "TEACH",
  "TEETH",
  "THANK",
  "THEME",
  "THERE",
  "THICK",
  "THING",
  "THINK",
  "THIRD",
  "THOSE",
  "THREE",
  "THREW",
  "THROW",
  "TIGHT",
  "TIMER",
  "TIRED",
  "TITLE",
  "TODAY",
  "TOKEN",
  "TOTAL",
  "TOUCH",
  "TOUGH",
  "TOWER",
  "TOXIC",
  "TRACE",
  "TRACK",
  "TRADE",
  "TRAIL",
  "TRAIN",
  "TRAIT",
  "TRASH",
  "TREAT",
  "TREND",
  "TRIAL",
  "TRIBE",
  "TRICK",
  "TRIED",
  "TROOP",
  "TRUCK",
  "TRULY",
  "TRUST",
  "TRUTH",
  "TWICE",
  "TWIST",
  "ULTRA",
  "UNCLE",
  "UNDER",
  "UNION",
  "UNITE",
  "UNITY",
  "UNTIL",
  "UPPER",
  "UPSET",
  "URBAN",
  "USAGE",
  "USUAL",
  "UTTER",
  "VAGUE",
  "VALID",
  "VALUE",
  "VIDEO",
  "VIGOR",
  "VIRAL",
  "VISIT",
  "VITAL",
  "VIVID",
  "VOCAL",
  "VOICE",
  "VOTER",
  "WAGER",
  "WASTE",
  "WATCH",
  "WATER",
  "WEAVE",
  "WHEEL",
  "WHERE",
  "WHICH",
  "WHILE",
  "WHITE",
  "WHOLE",
  "WHOSE",
  "WIDTH",
  "WOMAN",
  "WORLD",
  "WORRY",
  "WORSE",
  "WORST",
  "WORTH",
  "WOULD",
  "WOUND",
  "WRITE",
  "WRONG",
  "WROTE",
  "YIELD",
  "YOUNG",
  "YOUTH",
];

/**
 * Minimal dictionary for guess validation â€” any 5-letter word is accepted.
 * We just check length and alpha characters.
 */
function isValidGuess(word: string): boolean {
  return word.length === WORD_LENGTH && /^[A-Z]+$/.test(word.toUpperCase());
}

/**
 * Evaluate a guess against the target word.
 * Returns a 5-char string: "c" = correct, "p" = present, "a" = absent
 */
export function evaluateGuess(guess: string, target: string): string {
  const g = guess.toUpperCase().split("");
  const t = target.toUpperCase().split("");
  const result = Array(WORD_LENGTH).fill("a");
  const used = Array(WORD_LENGTH).fill(false);

  // First pass: exact matches
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (g[i] === t[i]) {
      result[i] = "c";
      used[i] = true;
    }
  }

  // Second pass: present but wrong position
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "c") continue;
    for (let j = 0; j < WORD_LENGTH; j++) {
      if (!used[j] && g[i] === t[j]) {
        result[i] = "p";
        used[j] = true;
        break;
      }
    }
  }

  return result.join("");
}

// =============================================================================
// Room
// =============================================================================

// Intentionally standalone room: guess-evaluation and per-round synchronization
// differ from score-race room assumptions.
export class WordMasterRoom extends Room<{ state: WordMasterState }> {
  maxClients = 2;
  patchRate = 100; // 10fps
  autoDispose = true;

  /** The target word (hidden until game ends) */
  private targetWord: string = "";

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
    this.setState(new WordMasterState());
    this.state.gameId = this.roomId;
    this.state.seed = Math.floor(Math.random() * 2147483647);
    this.state.phase = "waiting";

    // Pick target word using seed for determinism
    this.targetWord = WORD_LIST[this.state.seed % WORD_LIST.length];

    log.info(`[word_master] Room created: ${this.roomId}`);
  }

  // ===========================================================================
  // Messages
  // ===========================================================================

  messages: Record<string, (client: Client, payload?: any) => void> = {
    /** Player signals ready */
    ready: (client: Client) => {
      const player = this.state.wmPlayers.get(client.sessionId);
      if (player) {
        player.ready = true;
        log.info(`[word_master] Player ready: ${player.displayName}`);
        this.checkAllReady();
      }
    },

    /** Player submits a guess */
    guess: (client: Client, payload: { word: string }) => {
      if (this.state.phase !== "playing") return;

      const player = this.state.wmPlayers.get(client.sessionId);
      if (!player || player.finished) return;

      const word = (payload.word || "").toUpperCase().trim();
      if (!isValidGuess(word)) {
        client.send("invalid_guess", { reason: "Not a valid 5-letter word" });
        return;
      }

      if (player.currentRow >= MAX_GUESSES) return;

      // Evaluate the guess
      const result = evaluateGuess(word, this.targetWord);

      // Record the guess
      const guessRecord = new WordMasterGuess();
      guessRecord.word = word;
      guessRecord.result = result;
      player.guesses.push(guessRecord);
      player.currentRow++;

      // Check if won
      if (result === "ccccc") {
        player.status = "won";
        player.finished = true;
        player.score = (MAX_GUESSES - player.currentRow + 1) * 100 + 500;

        this.broadcast("player_finished", {
          sessionId: client.sessionId,
          displayName: player.displayName,
          status: "won",
          guessCount: player.currentRow,
        });
      } else if (player.currentRow >= MAX_GUESSES) {
        // Used all guesses
        player.status = "lost";
        player.finished = true;
        player.score = 0;

        this.broadcast("player_finished", {
          sessionId: client.sessionId,
          displayName: player.displayName,
          status: "lost",
          guessCount: player.currentRow,
        });
      }

      // Notify the opponent about the guess (they can see colour results
      // but NOT the actual letters, to prevent cheating)
      this.broadcast(
        "opponent_guess",
        {
          sessionId: client.sessionId,
          row: player.currentRow - 1,
          result, // "cpcaa" etc â€” colour feedback only
          finished: player.finished,
          status: player.status,
        },
        { except: client },
      );

      this.checkAllFinished();
    },

    /** Rematch */
    rematch: (client: Client) => {
      if (this.state.phase !== "finished") return;
      this.broadcast("rematch_request", {
        fromSessionId: client.sessionId,
        fromName:
          this.state.wmPlayers.get(client.sessionId)?.displayName || "Player",
      });
    },

    rematch_accept: (_client: Client) => {
      if (this.state.phase !== "finished") return;
      this.resetForRematch();
    },

    app_state: (client: Client, payload: { state: string }) => {
      log.info(
        `[word_master] Player app state: ${client.sessionId} â†’ ${payload.state}`,
      );
    },
  };

  // ===========================================================================
  // Player Lifecycle
  // ===========================================================================

  onJoin(client: Client, _options: Record<string, any>, auth: any): void {
    const player = new WordMasterPlayer();
    player.uid = auth.uid;
    player.sessionId = client.sessionId;
    player.displayName = auth.displayName || "Player";
    player.avatarUrl = auth.avatarUrl || "";
    player.playerIndex = this.state.wmPlayers.size;
    player.connected = true;

    this.state.wmPlayers.set(client.sessionId, player);
    this.playerUids.set(client.sessionId, auth.uid);

    client.send("welcome", {
      sessionId: client.sessionId,
      playerIndex: player.playerIndex,
      seed: this.state.seed,
    });

    log.info(
      `[word_master] Player joined: ${auth.displayName} (${client.sessionId}) [${this.state.wmPlayers.size}/${this.maxClients}]`,
    );

    if (this.state.wmPlayers.size >= this.maxClients) {
      this.lock();
    }
  }

  onDrop(client: Client, _code: number): void {
    const player = this.state.wmPlayers.get(client.sessionId);
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
    const player = this.state.wmPlayers.get(client.sessionId);
    if (player) player.connected = true;

    this.broadcast(
      "opponent_reconnected",
      { sessionId: client.sessionId },
      { except: client },
    );
  }

  onLeave(client: Client, _code: number): void {
    const player = this.state.wmPlayers.get(client.sessionId);
    if (player && this.state.phase === "playing" && !player.finished) {
      player.status = "lost";
      player.finished = true;
      player.score = 0;
      this.checkAllFinished();
    }
    log.info(`[word_master] Player left: ${client.sessionId}`);
  }

  async onDispose(): Promise<void> {
    if (this.state.phase === "finished") {
      await persistGameResult(this.state as unknown as BaseGameState, this.state.elapsed);
    }
    log.info(`[word_master] Room disposed: ${this.roomId}`);
  }

  // ===========================================================================
  // Game Flow
  // ===========================================================================

  private checkAllReady(): void {
    if (this.state.wmPlayers.size < 2) return;

    let allReady = true;
    this.state.wmPlayers.forEach((p: WordMasterPlayer) => {
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

    this.broadcast("game_start", {
      wordLength: WORD_LENGTH,
      maxGuesses: MAX_GUESSES,
    });

    // Start elapsed timer
    this.setSimulationInterval((dt: number) => {
      if (this.state.phase === "playing") {
        this.state.elapsed += dt;
      }
    }, 1000);

    log.info(`[word_master] Game started!`);
  }

  private checkAllFinished(): void {
    let allFinished = true;
    this.state.wmPlayers.forEach((p: WordMasterPlayer) => {
      if (!p.finished) allFinished = false;
    });

    if (allFinished) {
      this.endGame();
    }
  }

  private endGame(): void {
    if (this.state.phase === "finished") return;
    this.state.phase = "finished";
    this.state.revealedWord = this.targetWord;

    const players = Array.from(
      this.state.wmPlayers.values(),
    ) as WordMasterPlayer[];

    if (players.length >= 2) {
      // Determine winner
      const p1 = players[0];
      const p2 = players[1];

      if (p1.status === "won" && p2.status !== "won") {
        this.state.winnerId = p1.uid;
        this.state.winReason = "solved";
      } else if (p2.status === "won" && p1.status !== "won") {
        this.state.winnerId = p2.uid;
        this.state.winReason = "solved";
      } else if (p1.status === "won" && p2.status === "won") {
        // Both won â€” fewer guesses wins
        if (p1.currentRow < p2.currentRow) {
          this.state.winnerId = p1.uid;
          this.state.winReason = "fewer_guesses";
        } else if (p2.currentRow < p1.currentRow) {
          this.state.winnerId = p2.uid;
          this.state.winReason = "fewer_guesses";
        } else {
          this.state.winnerId = "";
          this.state.winReason = "tie";
        }
      } else {
        // Both lost
        this.state.winnerId = "";
        this.state.winReason = "both_lost";
      }
    }

    const results = players.map((p: WordMasterPlayer) => ({
      uid: p.uid,
      displayName: p.displayName,
      score: p.score,
      status: p.status,
      guessCount: p.currentRow,
    }));

    this.broadcast("game_over", {
      winnerId: this.state.winnerId,
      winReason: this.state.winReason,
      targetWord: this.targetWord,
      results,
    });

    log.info(
      `[word_master] Game over! Winner: ${this.state.winnerId || "NONE"}`,
    );
  }

  private resetForRematch(): void {
    this.state.wmPlayers.forEach((p: WordMasterPlayer) => {
      p.score = 0;
      p.currentRow = 0;
      p.status = "playing";
      p.finished = false;
      p.ready = false;
      p.guesses.clear();
    });

    this.state.phase = "waiting";
    this.state.winnerId = "";
    this.state.winReason = "";
    this.state.revealedWord = "";
    this.state.elapsed = 0;
    this.state.countdown = 0;
    this.state.seed = Math.floor(Math.random() * 2147483647);

    // New word
    this.targetWord = WORD_LIST[this.state.seed % WORD_LIST.length];

    this.unlock();
    log.info(`[word_master] Room reset for rematch`);
  }
}


