/**
 * Games V4 — Crazy 8's Adapter
 *
 * Full turn-based adapter for Crazy 8's (UNO-style card game).
 * Self-registers via registerAdapter() on import.
 *
 * Hidden-information model:
 *   - Player hands ONLY in PrivateState (per-player, owner-only read).
 *   - PublicState contains hand counts, top discard, color — safe for spectators.
 *   - Draw pile card order in PublicState for server use, stripped for spectators.
 *
 * Move types:
 *   PLAY_CARD         — play a card from hand
 *   DRAW_CARD         — draw from pile
 *   PASS              — pass after drawing (draw_one_then_pass mode)
 *   CALL_CRAZY        — call CRAZY! when at 1 card (embedded in PLAY_CARD or standalone)
 *   CATCH_NO_CRAZY    — catch opponent who didn't call CRAZY!
 *   CHALLENGE_WILD4   — challenge or accept a Wild Draw Four
 *
 * @module gamesV4/adapters/crazyEights/crazyEightsAdapter
 */

import type {
  GameAdapterV4,
  GameOutcome,
  MoveValidationResult,
  SettingsFieldDef,
} from "../../types/adapter";
import { registerAdapter } from "../registry";
import {
  applySevenZeroSwap,
  calculateRoundScores,
  couldPlayOtherColor,
  createInitialCrazyEightsState,
  createSpectatorView,
  drawCards,
  getNextTurnIndex,
  isCardPlayable,
} from "./crazyEightsEngine";
import type {
  Card,
  CardColor,
  CrazyEightsMovePayload,
  CrazyEightsPrivateState,
  CrazyEightsPublicState,
  CrazyEightsSettings,
  LastMove,
} from "./crazyEightsTypes";
import { ALL_COLORS, DEFAULT_CRAZY_EIGHTS_SETTINGS } from "./crazyEightsTypes";

// =============================================================================
// Type Helpers
// =============================================================================

// Temporary cache so createInitialPrivateState uses the same deal as
// createInitialPublicState (they are called sequentially in the pipeline).
let _lastDealCache: {
  privateState: Record<string, CrazyEightsPrivateState>;
} | null = null;

function asPublicState(raw: Record<string, unknown>): CrazyEightsPublicState {
  return raw as unknown as CrazyEightsPublicState;
}

function asRecord(state: CrazyEightsPublicState): Record<string, unknown> {
  return state as unknown as Record<string, unknown>;
}

function asPrivateMap(
  raw: Record<string, Record<string, unknown>>,
): Record<string, CrazyEightsPrivateState> {
  return raw as unknown as Record<string, CrazyEightsPrivateState>;
}

function privateToRecord(
  map: Record<string, CrazyEightsPrivateState>,
): Record<string, Record<string, unknown>> {
  return map as unknown as Record<string, Record<string, unknown>>;
}

// =============================================================================
// Settings Schema
// =============================================================================

const SETTINGS_SCHEMA: SettingsFieldDef[] = [
  {
    key: "stackDraw2",
    label: "Stack +2",
    type: "boolean",
    default: false,
    helperText: "Allow stacking +2 on another +2",
    group: "Stacking Rules",
  },
  {
    key: "stackDraw4",
    label: "Stack +4",
    type: "boolean",
    default: false,
    helperText: "Allow stacking Wild +4 on another Wild +4",
    group: "Stacking Rules",
  },
  {
    key: "stackingMode",
    label: "Stacking Mode",
    type: "select",
    default: "same_only",
    options: [
      { label: "Same Type Only", value: "same_only" },
      { label: "Mix +2 and +4", value: "draws_mix" },
    ],
    helperText: "Whether +2 and +4 can stack on each other",
    group: "Stacking Rules",
  },
  {
    key: "forcePlay",
    label: "Force Play After Draw",
    type: "boolean",
    default: true,
    helperText: "Must play a drawn card if it's playable",
    group: "Draw & Play",
  },
  {
    key: "drawMode",
    label: "Draw Mode",
    type: "select",
    default: "draw_one_then_pass",
    options: [
      { label: "Draw One, Then Pass", value: "draw_one_then_pass" },
      { label: "Draw Until Playable", value: "draw_until_playable" },
    ],
    helperText: "How many cards to draw when you can't play",
    group: "Draw & Play",
  },
  {
    key: "sevenZeroRule",
    label: "7-0 Rule",
    type: "boolean",
    default: false,
    helperText: "7 swaps hands; 0 rotates all hands",
    group: "Special Rules",
  },
  {
    key: "wildDraw4Challenge",
    label: "Challenge Wild +4",
    type: "boolean",
    default: false,
    helperText:
      "Allow challenging if the player could have played another card",
    group: "Special Rules",
  },
  {
    key: "turnTimer",
    label: "Turn Timer",
    type: "select",
    default: "off",
    options: [
      { label: "Off", value: "off" },
      { label: "20 seconds", value: "20s" },
      { label: "30 seconds", value: "30s" },
      { label: "45 seconds", value: "45s" },
    ],
    group: "Match Settings",
  },
  {
    key: "roundModel",
    label: "Game Mode",
    type: "select",
    default: "single_hand",
    options: [
      { label: "Single Hand", value: "single_hand" },
      { label: "Match (Points)", value: "match_points" },
    ],
    helperText: "Single hand or race to a point target",
    group: "Match Settings",
  },
  {
    key: "targetPoints",
    label: "Target Points",
    type: "number",
    default: 500,
    min: 100,
    max: 1000,
    step: 50,
    group: "Match Settings",
  },
];

// =============================================================================
// Settings Validation
// =============================================================================

function mergeSettings(patch: Record<string, unknown>): CrazyEightsSettings {
  const d = DEFAULT_CRAZY_EIGHTS_SETTINGS;
  return {
    stackDraw2:
      typeof patch.stackDraw2 === "boolean" ? patch.stackDraw2 : d.stackDraw2,
    stackDraw4:
      typeof patch.stackDraw4 === "boolean" ? patch.stackDraw4 : d.stackDraw4,
    stackingMode: ["same_only", "draws_mix"].includes(
      patch.stackingMode as string,
    )
      ? (patch.stackingMode as CrazyEightsSettings["stackingMode"])
      : d.stackingMode,
    forcePlay:
      typeof patch.forcePlay === "boolean" ? patch.forcePlay : d.forcePlay,
    drawMode: ["draw_one_then_pass", "draw_until_playable"].includes(
      patch.drawMode as string,
    )
      ? (patch.drawMode as CrazyEightsSettings["drawMode"])
      : d.drawMode,
    sevenZeroRule:
      typeof patch.sevenZeroRule === "boolean"
        ? patch.sevenZeroRule
        : d.sevenZeroRule,
    jumpIn: false, // Not supported in turn-based architecture
    wildDraw4Challenge:
      typeof patch.wildDraw4Challenge === "boolean"
        ? patch.wildDraw4Challenge
        : d.wildDraw4Challenge,
    turnTimer: ["off", "20s", "30s", "45s"].includes(patch.turnTimer as string)
      ? (patch.turnTimer as CrazyEightsSettings["turnTimer"])
      : d.turnTimer,
    roundModel: ["single_hand", "match_points"].includes(
      patch.roundModel as string,
    )
      ? (patch.roundModel as CrazyEightsSettings["roundModel"])
      : d.roundModel,
    targetPoints:
      typeof patch.targetPoints === "number" &&
      patch.targetPoints >= 100 &&
      patch.targetPoints <= 1000
        ? patch.targetPoints
        : d.targetPoints,
  };
}

// =============================================================================
// Move Helpers
// =============================================================================

function findCardInHand(hand: Card[], cardId: string): Card | undefined {
  return hand.find((c) => c.id === cardId);
}

function removeCardFromHand(hand: Card[], cardId: string): Card[] {
  const idx = hand.findIndex((c) => c.id === cardId);
  if (idx === -1) return hand;
  const newHand = [...hand];
  newHand.splice(idx, 1);
  return newHand;
}

function buildLastMove(
  actor: string,
  action: string,
  detail?: string,
): LastMove {
  return { actor, action, detail };
}

// =============================================================================
// Adapter Implementation
// =============================================================================

const crazyEightsAdapter: GameAdapterV4 = {
  gameId: "crazy_eights",
  runtimeType: "turnBased",
  maxPlayers: 6,
  minPlayers: 2,
  supportsSpectate: true,
  spectateMode: "public_only",

  scoreboardDescriptor: {
    title: "ROUND RESULT",
    formatScore: (s: number) =>
      s > 0 ? `+${s} pts` : s === 0 ? "0 pts" : `${s} pts`,
    sortDirection: "desc",
  },

  settingsSchema: SETTINGS_SCHEMA,
  defaultSettings: DEFAULT_CRAZY_EIGHTS_SETTINGS as unknown as Record<
    string,
    unknown
  >,

  // ── State Creation ──────────────────────────────────────────────────

  createInitialPublicState(
    players: Array<{ uid: string; slotIndex: number }>,
    settings: Record<string, unknown>,
  ): Record<string, unknown> {
    const s = mergeSettings(settings);
    const { publicState, privateState } = createInitialCrazyEightsState(
      players,
      s,
    );
    // Cache the private state for createInitialPrivateState
    _lastDealCache = { privateState };
    return asRecord(publicState);
  },

  createInitialPrivateState(
    _players: Array<{ uid: string; slotIndex: number }>,
    _settings: Record<string, unknown>,
  ): Record<string, Record<string, unknown>> {
    const cache = _lastDealCache;
    _lastDealCache = null;

    if (!cache) {
      // Fallback: shouldn't happen in normal flow
      const s = mergeSettings(_settings);
      const { privateState } = createInitialCrazyEightsState(_players, s);
      return privateToRecord(privateState);
    }

    return privateToRecord(cache.privateState);
  },

  // ── Move Validation ─────────────────────────────────────────────────

  validateMove(
    publicState: Record<string, unknown>,
    privateStateByPlayer: Record<string, Record<string, unknown>>,
    movePayload: Record<string, unknown>,
    ctx: {
      uid: string;
      turnOrder: string[];
      currentTurnIndex: number;
      settings: Record<string, unknown>;
    },
  ): MoveValidationResult {
    const state = asPublicState(publicState);
    const privateMap = asPrivateMap(privateStateByPlayer);
    const payload = movePayload as unknown as CrazyEightsMovePayload;
    const { uid } = ctx;
    const settings = state.settings;
    const playerPriv = privateMap[uid];

    // Game must be in playing phase
    if (state.phase !== "playing") {
      return { ok: false, error: "Game is not in playing phase." };
    }

    // Turn ownership (the session enforces this, but we double-check)
    if (state.currentTurnUid !== uid) {
      return { ok: false, error: "It is not your turn." };
    }

    const playerCount = state.turnOrder.length;

    switch (payload.action) {
      // ────────────────────────────────────────────────────────────────
      // CHALLENGE_WILD4
      // ────────────────────────────────────────────────────────────────
      case "CHALLENGE_WILD4": {
        if (!state.challengeWindow?.active) {
          return { ok: false, error: "No active Wild +4 challenge window." };
        }
        if (state.challengeWindow.targetUid !== uid) {
          return { ok: false, error: "You are not the challenge target." };
        }
        if (!settings.wildDraw4Challenge) {
          return { ok: false, error: "Wild +4 challenges are disabled." };
        }

        const challengeAction = payload.challengeAction;
        if (challengeAction !== "challenge" && challengeAction !== "accept") {
          return { ok: false, error: "Must choose 'challenge' or 'accept'." };
        }

        const wild4PlayerUid = state.challengeWindow.wild4PlayerUid;
        const couldHavePlayed = state.challengeWindow.couldHavePlayedOtherColor;

        let newState = { ...state };
        let newPrivateMap = { ...privateMap };

        if (challengeAction === "challenge") {
          if (couldHavePlayed) {
            // Challenge succeeds: W+4 player draws 4 instead
            const wild4Priv = { ...newPrivateMap[wild4PlayerUid] };
            const drawResult = drawCards(
              4,
              [...state.drawPile],
              [...state.discardPile],
              state.cardLookup,
            );
            wild4Priv.hand = [...wild4Priv.hand, ...drawResult.drawnCards];
            newPrivateMap[wild4PlayerUid] = wild4Priv;

            newState = {
              ...newState,
              drawPile: drawResult.newDrawPile,
              discardPile: drawResult.newDiscardPile,
              drawPileCount: drawResult.newDrawPile.length,
              discardCount: drawResult.newDiscardPile.length,
              handCounts: {
                ...newState.handCounts,
                [wild4PlayerUid]: wild4Priv.hand.length,
              },
              pendingDraw: { count: 0, source: null },
              challengeWindow: null,
              lastMove: buildLastMove(
                uid,
                "CHALLENGE_WILD4",
                "Challenge succeeded! Opponent draws 4",
              ),
              moveCount: state.moveCount + 1,
            };

            // Turn stays with current player (they can now play normally)
            return {
              ok: true,
              nextPublicState: asRecord(newState),
              nextPrivateState: privateToRecord(newPrivateMap),
              turnAdvance: false,
            };
          } else {
            // Challenge fails: challenger draws 6 (4 + 2 penalty)
            const challengerPriv = { ...newPrivateMap[uid] };
            const drawResult = drawCards(
              6,
              [...state.drawPile],
              [...state.discardPile],
              state.cardLookup,
            );
            challengerPriv.hand = [
              ...challengerPriv.hand,
              ...drawResult.drawnCards,
            ];
            newPrivateMap[uid] = challengerPriv;

            const nextIdx = getNextTurnIndex(
              state.currentTurnIndex,
              state.direction,
              playerCount,
            );

            newState = {
              ...newState,
              drawPile: drawResult.newDrawPile,
              discardPile: drawResult.newDiscardPile,
              drawPileCount: drawResult.newDrawPile.length,
              discardCount: drawResult.newDiscardPile.length,
              handCounts: {
                ...newState.handCounts,
                [uid]: challengerPriv.hand.length,
              },
              pendingDraw: { count: 0, source: null },
              challengeWindow: null,
              currentTurnIndex: nextIdx,
              currentTurnUid: state.turnOrder[nextIdx],
              turnCounter: state.turnCounter + 1,
              lastMove: buildLastMove(
                uid,
                "CHALLENGE_WILD4",
                "Challenge failed! Drew 6 cards",
              ),
              moveCount: state.moveCount + 1,
            };

            return {
              ok: true,
              nextPublicState: asRecord(newState),
              nextPrivateState: privateToRecord(newPrivateMap),
              turnAdvance: false,
              nextTurnPlayerId: state.turnOrder[nextIdx],
            };
          }
        } else {
          // Accept: draw the pending amount (4)
          const accepterPriv = { ...newPrivateMap[uid] };
          const drawResult = drawCards(
            state.pendingDraw.count,
            [...state.drawPile],
            [...state.discardPile],
            state.cardLookup,
          );
          accepterPriv.hand = [...accepterPriv.hand, ...drawResult.drawnCards];
          newPrivateMap[uid] = accepterPriv;

          const nextIdx = getNextTurnIndex(
            state.currentTurnIndex,
            state.direction,
            playerCount,
          );

          newState = {
            ...newState,
            drawPile: drawResult.newDrawPile,
            discardPile: drawResult.newDiscardPile,
            drawPileCount: drawResult.newDrawPile.length,
            discardCount: drawResult.newDiscardPile.length,
            handCounts: {
              ...newState.handCounts,
              [uid]: accepterPriv.hand.length,
            },
            pendingDraw: { count: 0, source: null },
            challengeWindow: null,
            currentTurnIndex: nextIdx,
            currentTurnUid: state.turnOrder[nextIdx],
            turnCounter: state.turnCounter + 1,
            lastMove: buildLastMove(
              uid,
              "CHALLENGE_WILD4",
              `Accepted, drew ${state.pendingDraw.count} cards`,
            ),
            moveCount: state.moveCount + 1,
          };

          return {
            ok: true,
            nextPublicState: asRecord(newState),
            nextPrivateState: privateToRecord(newPrivateMap),
            turnAdvance: false,
            nextTurnPlayerId: state.turnOrder[nextIdx],
          };
        }
      }

      // ────────────────────────────────────────────────────────────────
      // CATCH_NO_CRAZY
      // ────────────────────────────────────────────────────────────────
      case "CATCH_NO_CRAZY": {
        const targetUid = payload.targetUid;
        if (!targetUid) {
          return { ok: false, error: "Must specify targetUid." };
        }
        if (!state.callEligibleUid || state.callEligibleUid !== targetUid) {
          return { ok: false, error: "No eligible CRAZY! call to catch." };
        }
        if (state.calledCrazy[targetUid]) {
          return { ok: false, error: "Player already called CRAZY!." };
        }

        // Penalty: target draws 2 cards
        const targetPriv = { ...privateMap[targetUid] };
        const drawResult = drawCards(
          2,
          [...state.drawPile],
          [...state.discardPile],
          state.cardLookup,
        );
        targetPriv.hand = [...targetPriv.hand, ...drawResult.drawnCards];

        const newPrivateMap2 = { ...privateMap, [targetUid]: targetPriv };
        const newState2: CrazyEightsPublicState = {
          ...state,
          drawPile: drawResult.newDrawPile,
          discardPile: drawResult.newDiscardPile,
          drawPileCount: drawResult.newDrawPile.length,
          discardCount: drawResult.newDiscardPile.length,
          handCounts: {
            ...state.handCounts,
            [targetUid]: targetPriv.hand.length,
          },
          callEligibleUid: null,
          lastMove: buildLastMove(
            uid,
            "CATCH_NO_CRAZY",
            `Caught ${targetUid} — penalty draw 2`,
          ),
          moveCount: state.moveCount + 1,
        };

        // Turn doesn't advance — current player still needs to play
        return {
          ok: true,
          nextPublicState: asRecord(newState2),
          nextPrivateState: privateToRecord(newPrivateMap2),
          turnAdvance: false,
        };
      }

      // ────────────────────────────────────────────────────────────────
      // CALL_CRAZY (standalone — for the player who forgot to embed it)
      // ────────────────────────────────────────────────────────────────
      case "CALL_CRAZY": {
        if (state.callEligibleUid !== uid) {
          return { ok: false, error: "You are not eligible to call CRAZY!." };
        }
        if (state.calledCrazy[uid]) {
          return { ok: false, error: "You already called CRAZY!." };
        }

        const newState3: CrazyEightsPublicState = {
          ...state,
          calledCrazy: { ...state.calledCrazy, [uid]: true },
          lastMove: buildLastMove(uid, "CALL_CRAZY", "CRAZY!"),
          moveCount: state.moveCount + 1,
        };

        // Turn doesn't advance — current player still plays
        return {
          ok: true,
          nextPublicState: asRecord(newState3),
          turnAdvance: false,
        };
      }

      // ────────────────────────────────────────────────────────────────
      // DRAW_CARD
      // ────────────────────────────────────────────────────────────────
      case "DRAW_CARD": {
        // If there's a challenge window, must resolve that first
        if (
          state.challengeWindow?.active &&
          state.challengeWindow.targetUid === uid
        ) {
          return { ok: false, error: "Must resolve Wild +4 challenge first." };
        }

        // If pending draw stack, draw the full stack
        if (state.pendingDraw.count > 0) {
          const drawCount = state.pendingDraw.count;
          const drawResult = drawCards(
            drawCount,
            [...state.drawPile],
            [...state.discardPile],
            state.cardLookup,
          );

          const myPriv = { ...playerPriv };
          myPriv.hand = [...myPriv.hand, ...drawResult.drawnCards];
          myPriv.hasDrawnThisTurn = true;

          const newPM = { ...privateMap, [uid]: myPriv };
          const nextIdx = getNextTurnIndex(
            state.currentTurnIndex,
            state.direction,
            playerCount,
          );

          const newSt: CrazyEightsPublicState = {
            ...state,
            drawPile: drawResult.newDrawPile,
            discardPile: drawResult.newDiscardPile,
            drawPileCount: drawResult.newDrawPile.length,
            discardCount: drawResult.newDiscardPile.length,
            handCounts: { ...state.handCounts, [uid]: myPriv.hand.length },
            pendingDraw: { count: 0, source: null },
            currentTurnIndex: nextIdx,
            currentTurnUid: state.turnOrder[nextIdx],
            turnCounter: state.turnCounter + 1,
            callEligibleUid: null,
            lastMove: buildLastMove(
              uid,
              "DRAW_CARD",
              `Drew ${drawCount} cards from stack`,
            ),
            moveCount: state.moveCount + 1,
          };

          return {
            ok: true,
            nextPublicState: asRecord(newSt),
            nextPrivateState: privateToRecord(newPM),
            turnAdvance: false,
            nextTurnPlayerId: state.turnOrder[nextIdx],
          };
        }

        // Normal draw
        if (
          playerPriv?.hasDrawnThisTurn &&
          settings.drawMode === "draw_one_then_pass"
        ) {
          return {
            ok: false,
            error: "Already drew this turn. Play a card or pass.",
          };
        }

        const drawResult = drawCards(
          1,
          [...state.drawPile],
          [...state.discardPile],
          state.cardLookup,
        );

        if (drawResult.drawnCards.length === 0) {
          return { ok: false, error: "No cards available to draw." };
        }

        const myPriv = {
          ...(playerPriv ?? { hand: [], hasDrawnThisTurn: false }),
        };
        myPriv.hand = [...myPriv.hand, ...drawResult.drawnCards];
        myPriv.hasDrawnThisTurn = true;

        const newPM = { ...privateMap, [uid]: myPriv };

        // If draw_until_playable and drawn card is playable, allow play
        // If force_play is on and we drew a playable card, player must play it
        // For now, just update state and let player decide
        const drawnCard = drawResult.drawnCards[0];
        const canPlayDrawn = isCardPlayable(
          drawnCard,
          state.currentColor,
          state.topDiscard,
          settings,
        );

        // In draw_until_playable mode, if drawn card isn't playable, auto-draw more
        if (settings.drawMode === "draw_until_playable" && !canPlayDrawn) {
          // Keep drawing until we find a playable card or run out
          let currentDrawPile = drawResult.newDrawPile;
          let currentDiscardPile = drawResult.newDiscardPile;
          let hand = [...myPriv.hand];
          let found = false;

          while (currentDrawPile.length > 0 || currentDiscardPile.length > 1) {
            const nextDraw = drawCards(
              1,
              currentDrawPile,
              currentDiscardPile,
              state.cardLookup,
            );
            if (nextDraw.drawnCards.length === 0) break;
            hand = [...hand, ...nextDraw.drawnCards];
            currentDrawPile = nextDraw.newDrawPile;
            currentDiscardPile = nextDraw.newDiscardPile;

            if (
              isCardPlayable(
                nextDraw.drawnCards[0],
                state.currentColor,
                state.topDiscard,
                settings,
              )
            ) {
              found = true;
              break;
            }
          }

          myPriv.hand = hand;
          const updatedPM = { ...privateMap, [uid]: myPriv };

          if (!found) {
            // Couldn't find playable card — turn passes
            const nextIdx = getNextTurnIndex(
              state.currentTurnIndex,
              state.direction,
              playerCount,
            );

            const newSt: CrazyEightsPublicState = {
              ...state,
              drawPile: currentDrawPile,
              discardPile: currentDiscardPile,
              drawPileCount: currentDrawPile.length,
              discardCount: currentDiscardPile.length,
              handCounts: { ...state.handCounts, [uid]: myPriv.hand.length },
              currentTurnIndex: nextIdx,
              currentTurnUid: state.turnOrder[nextIdx],
              turnCounter: state.turnCounter + 1,
              callEligibleUid: null,
              lastMove: buildLastMove(
                uid,
                "DRAW_CARD",
                `Drew ${hand.length - (playerPriv?.hand.length ?? 0)} cards`,
              ),
              moveCount: state.moveCount + 1,
            };

            return {
              ok: true,
              nextPublicState: asRecord(newSt),
              nextPrivateState: privateToRecord(updatedPM),
              turnAdvance: false,
              nextTurnPlayerId: state.turnOrder[nextIdx],
            };
          }

          // Found playable card — player can now play it
          const newSt: CrazyEightsPublicState = {
            ...state,
            drawPile: currentDrawPile,
            discardPile: currentDiscardPile,
            drawPileCount: currentDrawPile.length,
            discardCount: currentDiscardPile.length,
            handCounts: { ...state.handCounts, [uid]: myPriv.hand.length },
            lastMove: buildLastMove(
              uid,
              "DRAW_CARD",
              `Drew ${hand.length - (playerPriv?.hand.length ?? 0)} cards`,
            ),
            moveCount: state.moveCount + 1,
          };

          return {
            ok: true,
            nextPublicState: asRecord(newSt),
            nextPrivateState: privateToRecord(updatedPM),
            turnAdvance: false,
          };
        }

        // draw_one_then_pass mode
        const newSt: CrazyEightsPublicState = {
          ...state,
          drawPile: drawResult.newDrawPile,
          discardPile: drawResult.newDiscardPile,
          drawPileCount: drawResult.newDrawPile.length,
          discardCount: drawResult.newDiscardPile.length,
          handCounts: { ...state.handCounts, [uid]: myPriv.hand.length },
          lastMove: buildLastMove(uid, "DRAW_CARD", "Drew 1 card"),
          moveCount: state.moveCount + 1,
        };

        // If forcePlay and drawn card is playable, player must play
        // (but we still allow them to choose — the client UI should highlight)
        return {
          ok: true,
          nextPublicState: asRecord(newSt),
          nextPrivateState: privateToRecord(newPM),
          turnAdvance: false,
        };
      }

      // ────────────────────────────────────────────────────────────────
      // PASS
      // ────────────────────────────────────────────────────────────────
      case "PASS": {
        if (!playerPriv?.hasDrawnThisTurn) {
          return { ok: false, error: "Must draw before passing." };
        }

        const nextIdx = getNextTurnIndex(
          state.currentTurnIndex,
          state.direction,
          playerCount,
        );

        // Reset draw flag for next turn
        const resetPriv = { ...playerPriv, hasDrawnThisTurn: false };

        const newSt: CrazyEightsPublicState = {
          ...state,
          currentTurnIndex: nextIdx,
          currentTurnUid: state.turnOrder[nextIdx],
          turnCounter: state.turnCounter + 1,
          callEligibleUid: null,
          lastMove: buildLastMove(uid, "PASS", "Passed"),
          moveCount: state.moveCount + 1,
        };

        return {
          ok: true,
          nextPublicState: asRecord(newSt),
          nextPrivateState: privateToRecord({
            ...privateMap,
            [uid]: resetPriv,
          }),
          turnAdvance: false,
          nextTurnPlayerId: state.turnOrder[nextIdx],
        };
      }

      // ────────────────────────────────────────────────────────────────
      // PLAY_CARD
      // ────────────────────────────────────────────────────────────────
      case "PLAY_CARD": {
        const { cardId, declaredColor, callCrazy, swapTargetUid } = payload;

        if (!cardId) {
          return { ok: false, error: "Must specify cardId." };
        }

        // If challenge window is active, must resolve first
        if (
          state.challengeWindow?.active &&
          state.challengeWindow.targetUid === uid
        ) {
          return { ok: false, error: "Must resolve Wild +4 challenge first." };
        }

        // Find card in player's hand
        if (!playerPriv) {
          return { ok: false, error: "No private state found." };
        }

        const card = findCardInHand(playerPriv.hand, cardId);
        if (!card) {
          return { ok: false, error: "Card not in your hand." };
        }

        // If there's a pending draw, player can only stack or must draw
        if (state.pendingDraw.count > 0) {
          const canStack = checkCanStack(card, state, settings);
          if (!canStack) {
            return {
              ok: false,
              error:
                "Cannot play this card while draws are pending. Draw or stack.",
            };
          }
        }

        // Card must be playable
        if (
          state.pendingDraw.count === 0 &&
          !isCardPlayable(card, state.currentColor, state.topDiscard, settings)
        ) {
          return {
            ok: false,
            error: "Card is not playable on the current discard.",
          };
        }

        // Wild cards require declaredColor
        if (
          (card.type === "wild" || card.type === "wild_draw_four") &&
          !declaredColor
        ) {
          return { ok: false, error: "Must declare a color for wild cards." };
        }

        if (declaredColor && !ALL_COLORS.includes(declaredColor)) {
          return { ok: false, error: "Invalid declared color." };
        }

        // Remove card from hand
        const newHand = removeCardFromHand(playerPriv.hand, cardId);
        let newPrivateMap = {
          ...privateMap,
          [uid]: {
            ...playerPriv,
            hand: newHand,
            hasDrawnThisTurn: false,
          },
        };

        // Update discard pile
        const newDiscardPile = [...state.discardPile, cardId];
        const newColor: CardColor =
          declaredColor ?? card.color ?? state.currentColor;

        // Calculate next turn
        let newDirection = state.direction;
        let skipCount = 1;
        let newPendingDraw = { ...state.pendingDraw };
        let newChallengeWindow: CrazyEightsPublicState["challengeWindow"] =
          null;

        // Apply card effects
        switch (card.type) {
          case "reverse":
            if (playerCount === 2) {
              // In 2-player, reverse acts as skip
              skipCount = 2;
            } else {
              newDirection = (state.direction === 1 ? -1 : 1) as 1 | -1;
            }
            break;

          case "skip":
            skipCount = 2; // Skip next player
            break;

          case "draw_two":
            if (settings.stackDraw2 || settings.stackDraw4) {
              newPendingDraw = {
                count: state.pendingDraw.count + 2,
                source: "D2",
              };
            } else {
              newPendingDraw = { count: 2, source: "D2" };
            }
            skipCount = 1; // Advance to next player (they must draw)
            break;

          case "wild_draw_four": {
            // Track whether player could have played another color
            const couldPlay = couldPlayOtherColor(
              playerPriv.hand, // Hand BEFORE playing (include the card since we check alternatives)
              state.currentColor,
              state.topDiscard,
            );

            if (settings.stackDraw4) {
              newPendingDraw = {
                count: state.pendingDraw.count + 4,
                source: "D4",
              };
            } else {
              newPendingDraw = { count: 4, source: "D4" };
            }

            // If challenge is enabled, set challenge window
            if (settings.wildDraw4Challenge) {
              newChallengeWindow = {
                active: true,
                wild4PlayerUid: uid,
                targetUid: "", // Will be set to next player
                couldHavePlayedOtherColor: couldPlay,
              };
            }
            break;
          }

          default:
            break;
        }

        // Seven-Zero rule
        if (settings.sevenZeroRule && card.type === "number") {
          if (card.value === 7 && swapTargetUid) {
            newPrivateMap = applySevenZeroSwap(
              newPrivateMap as Record<string, CrazyEightsPrivateState>,
              state.turnOrder,
              state.direction,
              card,
              swapTargetUid,
              uid,
            );
          } else if (card.value === 0) {
            newPrivateMap = applySevenZeroSwap(
              newPrivateMap as Record<string, CrazyEightsPrivateState>,
              state.turnOrder,
              state.direction,
              card,
            );
          }
        }

        // Update hand counts after potential swaps
        const newHandCounts: Record<string, number> = {};
        for (const pUid of state.turnOrder) {
          newHandCounts[pUid] =
            (newPrivateMap[pUid] as CrazyEightsPrivateState)?.hand?.length ??
            state.handCounts[pUid];
        }

        // Check if player won (hand empty)
        if (newHand.length === 0) {
          return handleRoundWin(
            uid,
            state,
            newPrivateMap as Record<string, CrazyEightsPrivateState>,
            newDiscardPile,
            newColor,
            card,
            newHandCounts,
            newDirection,
          );
        }

        // CRAZY! call logic
        let callEligibleUid = state.callEligibleUid;
        let calledCrazy = { ...state.calledCrazy };

        // Clear previous eligible if a new move happened
        if (state.callEligibleUid && state.callEligibleUid !== uid) {
          callEligibleUid = null;
        }

        if (newHand.length === 1) {
          callEligibleUid = uid;
          calledCrazy[uid] = !!callCrazy;
        } else {
          if (callEligibleUid === uid) {
            callEligibleUid = null;
          }
        }

        // Calculate next turn index
        const nextIdx = getNextTurnIndex(
          state.currentTurnIndex,
          newDirection,
          playerCount,
          skipCount,
        );

        // Set challenge window target
        if (newChallengeWindow) {
          newChallengeWindow.targetUid = state.turnOrder[nextIdx];
        }

        const newPublicState: CrazyEightsPublicState = {
          ...state,
          topDiscard: card,
          currentColor: newColor,
          direction: newDirection,
          drawPileCount: state.drawPile.length,
          discardPile: newDiscardPile,
          discardCount: newDiscardPile.length,
          handCounts: newHandCounts,
          pendingDraw: newPendingDraw,
          callEligibleUid,
          calledCrazy,
          challengeWindow: newChallengeWindow,
          currentTurnIndex: nextIdx,
          currentTurnUid: state.turnOrder[nextIdx],
          turnCounter: state.turnCounter + 1,
          lastMove: buildLastMove(
            uid,
            "PLAY_CARD",
            formatCardDescription(card, declaredColor),
          ),
          moveCount: state.moveCount + 1,
        };

        return {
          ok: true,
          nextPublicState: asRecord(newPublicState),
          nextPrivateState: privateToRecord(
            newPrivateMap as Record<string, CrazyEightsPrivateState>,
          ),
          turnAdvance: false,
          nextTurnPlayerId: state.turnOrder[nextIdx],
        };
      }

      default:
        return { ok: false, error: `Unknown action: ${payload.action}` };
    }
  },

  // ── Summary (for invite card) ───────────────────────────────────────

  computeSummary(publicState, players, currentTurnPlayerId) {
    const state = asPublicState(publicState);

    // Sort players by hand count (ascending) for summary
    const sorted = [...players].sort((a, b) => {
      const aCount = state.handCounts[a.uid] ?? 99;
      const bCount = state.handCounts[b.uid] ?? 99;
      return aCount - bCount;
    });

    return {
      turnPlayerId: state.currentTurnUid ?? currentTurnPlayerId,
      scoreSummary: sorted.slice(0, 3).map((p) => ({
        uid: p.uid,
        displayName: p.displayName,
        score: state.handCounts[p.uid] ?? 0,
      })),
    };
  },

  // ── Outcome ─────────────────────────────────────────────────────────

  computeOutcome(publicState, players): GameOutcome {
    const state = asPublicState(publicState);
    const winnerUid = state.resolved?.winnerUid;

    if (winnerUid) {
      const roundScores = state.resolved?.roundScores ?? {};

      // Sort by score descending for placement
      const sorted = players
        .map((p) => ({
          ...p,
          score: roundScores[p.uid] ?? 0,
          handCount: state.handCounts[p.uid] ?? 0,
        }))
        .sort((a, b) => b.score - a.score);

      return {
        winnerIds: [winnerUid],
        finalScoreboard: sorted.map((p, i) => ({
          uid: p.uid,
          score: p.score,
          placement: p.uid === winnerUid ? 1 : i + 1,
          stats: {
            handCount: p.handCount,
            roundScores: roundScores[p.uid] ?? 0,
            matchScore: state.scores[p.uid] ?? 0,
          } as Record<string, unknown>,
        })),
      };
    }

    return {
      winnerIds: [],
      finalScoreboard: players.map((p, i) => ({
        uid: p.uid,
        score: 0,
        placement: i + 1,
        stats: {},
      })),
    };
  },

  // ── Spectator View ──────────────────────────────────────────────────

  getSpectatorView(publicState): Record<string, unknown> {
    const state = asPublicState(publicState);
    return createSpectatorView(state);
  },

  // ── Performance Metrics ─────────────────────────────────────────────

  extractPerformanceMetrics(publicState, players): Record<string, unknown> {
    const state = asPublicState(publicState);
    return {
      totalMoves: state.moveCount,
      turnCounter: state.turnCounter,
      roundNumber: state.roundNumber,
      direction: state.direction,
      handCounts: state.handCounts,
      scores: state.scores,
      phase: state.phase,
      settings: state.settings,
    };
  },

  // ── Settings Validation ─────────────────────────────────────────────

  validateSettings(patch: Record<string, unknown>): Record<string, unknown> {
    return mergeSettings(patch) as unknown as Record<string, unknown>;
  },
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if a card can be stacked on a pending draw.
 */
function checkCanStack(
  card: Card,
  state: CrazyEightsPublicState,
  settings: CrazyEightsSettings,
): boolean {
  const pending = state.pendingDraw;

  if (pending.source === "D2") {
    if (card.type === "draw_two" && settings.stackDraw2) return true;
    if (
      card.type === "wild_draw_four" &&
      settings.stackingMode === "draws_mix" &&
      settings.stackDraw4
    )
      return true;
  }

  if (pending.source === "D4") {
    if (card.type === "wild_draw_four" && settings.stackDraw4) return true;
    if (
      card.type === "draw_two" &&
      settings.stackingMode === "draws_mix" &&
      settings.stackDraw2
    )
      return true;
  }

  return false;
}

/**
 * Format a card description for the micro-log.
 */
function formatCardDescription(card: Card, declaredColor?: CardColor): string {
  const colorStr = card.color
    ? card.color.charAt(0).toUpperCase() + card.color.slice(1)
    : "";
  switch (card.type) {
    case "number":
      return `${colorStr} ${card.value}`;
    case "skip":
      return `${colorStr} Skip`;
    case "reverse":
      return `${colorStr} Reverse`;
    case "draw_two":
      return `${colorStr} +2`;
    case "wild":
      return `Wild → ${declaredColor ?? ""}`;
    case "wild_draw_four":
      return `Wild +4 → ${declaredColor ?? ""}`;
    default:
      return card.id;
  }
}

/**
 * Handle a round win (player emptied their hand).
 */
function handleRoundWin(
  winnerUid: string,
  state: CrazyEightsPublicState,
  privateMap: Record<string, CrazyEightsPrivateState>,
  newDiscardPile: string[],
  newColor: CardColor,
  playedCard: Card,
  newHandCounts: Record<string, number>,
  newDirection: 1 | -1,
): MoveValidationResult {
  const roundScores = calculateRoundScores(
    winnerUid,
    privateMap,
    state.turnOrder,
  );

  // Update cumulative scores
  const newScores = { ...state.scores };
  for (const uid of state.turnOrder) {
    newScores[uid] = (newScores[uid] ?? 0) + (roundScores[uid] ?? 0);
  }

  // Check match end (points mode)
  const isMatchEnd =
    state.settings.roundModel === "match_points" &&
    newScores[winnerUid] >= state.settings.targetPoints;

  const phase: CrazyEightsPublicState["phase"] = isMatchEnd
    ? "match_over"
    : state.settings.roundModel === "match_points"
      ? "round_over"
      : "round_over";

  const newState: CrazyEightsPublicState = {
    ...state,
    phase,
    topDiscard: playedCard,
    currentColor: newColor,
    direction: newDirection,
    discardPile: newDiscardPile,
    discardCount: newDiscardPile.length,
    handCounts: newHandCounts,
    pendingDraw: { count: 0, source: null },
    callEligibleUid: null,
    scores: newScores,
    lastMove: buildLastMove(winnerUid, "PLAY_CARD", "Wins the round!"),
    moveCount: state.moveCount + 1,
    resolved: {
      winnerUid,
      reason: "hand_empty",
      roundScores,
      matchWinner: isMatchEnd ? winnerUid : undefined,
    },
  };

  return {
    ok: true,
    nextPublicState: asRecord(newState),
    nextPrivateState: privateToRecord(privateMap),
    turnAdvance: false,
    terminal: {
      type: "win",
      winnerIds: [winnerUid],
      reason: isMatchEnd ? "match_points_reached" : "hand_empty",
    },
  };
}

// Auto-register on import
registerAdapter(crazyEightsAdapter);

export default crazyEightsAdapter;
