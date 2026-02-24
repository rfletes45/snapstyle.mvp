/**
 * CrazyCardsRoom — Server-authoritative UNO-inspired card game
 *
 * Display name: "Crazy Cards" — internal gameId remains "crazy_eights"
 * for routing and integration stability.
 *
 * Rules:
 * - Play cards matching color, number/symbol, or play a wild
 * - Skip: next player loses turn
 * - Reverse: flip direction (in 2P acts as skip)
 * - Draw Two: next player draws 2, loses turn
 * - Wild: player picks next color, always playable
 * - Wild Draw Four: player picks color, next draws 4, loses turn
 *   (only playable when no matching-color card in hand — server-validated)
 * - Draw 1 if no playable card; if drawn card playable, may play immediately
 * - No stacking
 * - UNO call: optional "call" when hand reaches 1 card
 * - First to empty hand wins
 *
 * Private info: Player hands sent via targeted messages, NOT synced state.
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md Phase 3
 */

import { Client } from "colyseus";
import {
  CRAZY_CARDS_INITIAL_HAND_SIZE,
  type CrazyCard,
  type CrazyCardColor,
  calculateCrazyCardsHandScore,
  canPlayCrazyCard,
  createCrazyCardsDeck,
  shuffleCrazyCards,
} from "../../schemas/crazyCards";
import { CardGameRoom } from "../base/CardGameRoom";

// =============================================================================
// Types
// =============================================================================

/** Play direction: 1 = clockwise, -1 = counter-clockwise */
type Direction = 1 | -1;

/** Card played event broadcast to all clients (for animation) */
interface CardPlayedEvent {
  playerId: string;
  card: CrazyCard;
  chosenColor?: CrazyCardColor;
  effect?: "skip" | "reverse" | "draw_two" | "wild_draw_four";
  nextPlayerId: string;
  direction: Direction;
}

// =============================================================================
// Room
// =============================================================================

export class CrazyCardsRoom extends CardGameRoom {
  protected readonly gameTypeKey = "crazy_eights_game";

  /** Play direction: 1=clockwise, -1=counter-clockwise */
  private direction: Direction = 1;

  /** The active color (may differ from top card if wild was played) */
  private currentColor: CrazyCardColor = "red";

  /** Cards the next player must draw (from Draw Two / WD4) */
  private pendingDrawCount = 0;

  /** Whether the next player's turn should be skipped */
  private pendingSkip = false;

  /** Stalemate: consecutive passes with no drawable cards */
  private consecutivePasses = 0;

  /** UNO call tracking: sessionId → whether they called UNO for their 1-card hand */
  private unoCalled = new Map<string, boolean>();

  /** UNO call window: sessionId → timeout handle */
  private unoCallTimers = new Map<string, any>();

  /** Stats tracking per player for achievements */
  private playerStats = new Map<
    string,
    {
      wildsPlayed: number;
      wildDrawFoursPlayed: number;
      skipsPlayed: number;
      reversesPlayed: number;
      drawTwosPlayed: number;
      unoCalls: number;
      cardsDrawn: number;
    }
  >();

  // ─── Game Setup ─────────────────────────────────────────────────────

  /** Override base startGame so we deliver CrazyCard hands (not base-class hands) */
  protected startGame(): void {
    super.startGame();
    // Base class called sendHand() which reads this.hands (empty for us).
    // Deliver the real CrazyCard hands now:
    this.broadcastCrazyHands();
    this.syncCrazyHandSizes();

    // If first player is a bot, kick off their turn
    this.scheduleBotPlayIfNeeded();
  }

  protected initializeGame(_options: Record<string, any>): void {
    // Reset game-specific state
    this.direction = 1;
    this.pendingDrawCount = 0;
    this.pendingSkip = false;
    this.consecutivePasses = 0;
    this.unoCalled.clear();
    this.unoCallTimers.forEach((timer) => clearTimeout(timer));
    this.unoCallTimers.clear();

    // Create and shuffle deck — CrazyCards uses the CrazyCard type
    // but CardGameRoom.deck uses ServerCard. We store our deck separately.
    const fullDeck = shuffleCrazyCards(createCrazyCardsDeck());

    // We'll use the base class's deck/discardPile/hands but store CrazyCards
    // by casting — the ServerCard interface is { suit, rank, id } but we extend it.
    // Instead, we keep our own typed storage and bridge to the base class.
    this.crazyDeck = fullDeck;
    this.crazyDiscardPile = [];
    this.crazyHands = new Map();

    // Initialize per-player stats
    this.playerStats.clear();
    this.playerOrder.forEach((sessionId) => {
      this.playerStats.set(sessionId, {
        wildsPlayed: 0,
        wildDrawFoursPlayed: 0,
        skipsPlayed: 0,
        reversesPlayed: 0,
        drawTwosPlayed: 0,
        unoCalls: 0,
        cardsDrawn: 0,
      });
    });

    // Deal 7 cards to each player
    this.playerOrder.forEach((sessionId) => {
      const hand: CrazyCard[] = [];
      for (let i = 0; i < CRAZY_CARDS_INITIAL_HAND_SIZE; i++) {
        if (this.crazyDeck.length > 0) {
          hand.push(this.crazyDeck.pop()!);
        }
      }
      this.crazyHands.set(sessionId, hand);
    });

    // Flip first discard card — skip wilds and action cards for first card
    let topCard = this.crazyDeck.pop()!;
    while (
      (topCard.color === "wild" || topCard.type !== "number") &&
      this.crazyDeck.length > 0
    ) {
      this.crazyDeck.unshift(topCard);
      this.crazyDeck = shuffleCrazyCards(this.crazyDeck);
      topCard = this.crazyDeck.pop()!;
    }

    this.crazyDiscardPile = [topCard];
    this.currentColor = topCard.color as CrazyCardColor;

    // Sync shared state using the base class fields
    this.syncCrazyTopCard(topCard);
    this.state.currentSuit = this.currentColor; // reuse currentSuit for color
    this.state.deckSize = this.crazyDeck.length;
    this.state.discardSize = 1;
    this.state.drawCount = 0;

    // Sync hand sizes
    this.syncCrazyHandSizes();
  }

  // ─── Our own typed storage (CrazyCard[]) ────────────────────────────

  private crazyDeck: CrazyCard[] = [];
  private crazyDiscardPile: CrazyCard[] = [];
  private crazyHands = new Map<string, CrazyCard[]>();

  // ─── Handle Messages ────────────────────────────────────────────────

  protected handleGameMessage(
    client: Client,
    type: string,
    payload: any,
  ): void {
    switch (type) {
      case "play":
        this.handlePlay(client, payload);
        break;
      case "draw":
        this.handleDraw(client);
        break;
      case "pass":
        this.handlePass(client);
        break;
      case "call_uno":
        this.handleCallUno(client);
        break;
      case "challenge_uno":
        this.handleChallengeUno(client, payload);
        break;
      default:
        client.send("error", { message: `Unknown action: ${type}` });
    }
  }

  // ─── Play a card ────────────────────────────────────────────────────

  private handlePlay(client: Client, payload: any): void {
    const hand = this.crazyHands.get(client.sessionId);
    if (!hand) return;

    const cardId = payload?.cardId;
    if (!cardId) {
      client.send("error", { message: "No card specified" });
      return;
    }

    // Find card in hand
    const cardIndex = hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) {
      client.send("error", { message: "Card not in hand" });
      return;
    }

    const card = hand[cardIndex];
    const topCard = this.crazyDiscardPile[this.crazyDiscardPile.length - 1];

    // Validate the play
    if (!canPlayCrazyCard(card, topCard, this.currentColor, hand)) {
      client.send("error", { message: "Card cannot be played" });
      return;
    }

    // Wild / Wild Draw Four requires a chosen color
    if (
      (card.type === "wild" || card.type === "wild_draw_four") &&
      !payload?.chosenColor
    ) {
      client.send("error", {
        message: "Must choose a color when playing a wild",
      });
      return;
    }

    // Validate chosen color
    const validColors: CrazyCardColor[] = ["red", "yellow", "green", "blue"];
    if (payload?.chosenColor && !validColors.includes(payload.chosenColor)) {
      client.send("error", { message: "Invalid color choice" });
      return;
    }

    // ── Execute the play ──

    // Remove card from hand
    hand.splice(cardIndex, 1);

    // Add to discard pile
    this.crazyDiscardPile.push(card);
    this.syncCrazyTopCard(card);

    // Update color
    if (card.type === "wild" || card.type === "wild_draw_four") {
      this.currentColor = payload.chosenColor as CrazyCardColor;
    } else {
      this.currentColor = card.color;
    }
    this.state.currentSuit = this.currentColor;

    // Track stats
    const stats = this.playerStats.get(client.sessionId);
    if (stats) {
      switch (card.type) {
        case "wild":
          stats.wildsPlayed++;
          break;
        case "wild_draw_four":
          stats.wildDrawFoursPlayed++;
          break;
        case "skip":
          stats.skipsPlayed++;
          break;
        case "reverse":
          stats.reversesPlayed++;
          break;
        case "draw_two":
          stats.drawTwosPlayed++;
          break;
      }
    }

    this.state.discardSize = this.crazyDiscardPile.length;
    this.state.drawCount = 0;
    this.consecutivePasses = 0;

    // ── Check UNO call ── (penalty if player had 2 cards, now 1, didn't call)
    if (hand.length === 1) {
      const calledUno =
        !!payload?.calledUno || this.unoCalled.get(client.sessionId) === true;
      if (!calledUno) {
        // Penalty: draw 2 cards for not calling
        this.drawCardsForPlayer(client.sessionId, 2);

        const playerName =
          this.state.cardPlayers.get(client.sessionId)?.displayName ?? "Player";
        this.broadcast("uno_penalty", {
          targetSessionId: client.sessionId,
          targetName: playerName,
          challengerSessionId: null,
          challengerName: "Auto",
          penaltyCards: 2,
        });
      }
      // Reset uno call status
      this.unoCalled.delete(client.sessionId);
    }

    // ── Check for winner ──
    if (hand.length === 0) {
      this.finishWithWinner(client.sessionId);
      return;
    }

    // ── Apply card effects ──
    let effect: CardPlayedEvent["effect"] | undefined;

    switch (card.type) {
      case "skip":
        this.pendingSkip = true;
        effect = "skip";
        break;

      case "reverse":
        this.direction *= -1;
        // In 2-player, reverse acts as skip
        if (this.playerOrder.length === 2) {
          this.pendingSkip = true;
        }
        effect = "reverse";
        break;

      case "draw_two":
        this.pendingDrawCount = 2;
        this.pendingSkip = true;
        effect = "draw_two";
        break;

      case "wild_draw_four":
        this.pendingDrawCount = 4;
        this.pendingSkip = true;
        effect = "wild_draw_four";
        break;
    }

    // Advance turn
    this.advanceCrazyTurn();

    // Apply pending effects to the new current player
    if (this.pendingDrawCount > 0) {
      this.applyPendingDraw();
    }
    if (this.pendingSkip) {
      this.pendingSkip = false;
      // Skip this player's turn — advance again
      this.advanceCrazyTurn();
    }

    // Broadcast the play event (for client animation)
    const nextPlayerId = this.state.currentTurnPlayerId;
    this.broadcast("card_played", {
      playerId: client.sessionId,
      card,
      chosenColor: payload?.chosenColor,
      effect,
      nextPlayerId,
      direction: this.direction,
    } as CardPlayedEvent);

    this.syncCrazyHandSizes();
    this.broadcastCrazyHands();
  }

  // ─── Draw a card ────────────────────────────────────────────────────

  private handleDraw(client: Client): void {
    const player = this.state.cardPlayers.get(client.sessionId);
    if (!player) return;

    // Can only draw once per turn
    if (player.hasDrawnThisTurn) {
      client.send("error", {
        message: "Already drawn this turn. Play a card or pass.",
      });
      return;
    }

    const hand = this.crazyHands.get(client.sessionId);
    if (!hand) return;

    // Reshuffle if deck empty
    this.reshuffleIfNeeded();

    if (this.crazyDeck.length === 0) {
      // No cards at all — auto-pass
      client.send("error", { message: "No cards to draw — pass instead" });
      return;
    }

    // Draw one card
    const drawn = this.crazyDeck.pop()!;
    hand.push(drawn);

    player.hasDrawnThisTurn = true;
    this.state.deckSize = this.crazyDeck.length;
    this.state.drawCount++;
    this.consecutivePasses = 0;

    // Track stats
    const stats = this.playerStats.get(client.sessionId);
    if (stats) stats.cardsDrawn++;

    // Notify the player what they drew
    this.sendCrazyHand(client.sessionId);
    this.syncCrazyHandSizes();

    // Tell client if drawn card is playable (for immediate play option)
    const topCard = this.crazyDiscardPile[this.crazyDiscardPile.length - 1];
    const canPlayDrawn = canPlayCrazyCard(
      drawn,
      topCard,
      this.currentColor,
      hand,
    );
    client.send("draw_result", {
      card: drawn,
      canPlay: canPlayDrawn,
    });
  }

  // ─── Pass turn ──────────────────────────────────────────────────────

  private handlePass(client: Client): void {
    const player = this.state.cardPlayers.get(client.sessionId);
    if (!player) return;

    // Can only pass if drawn already or deck + discard are truly exhausted
    const canReshuffle = this.crazyDiscardPile.length > 1;
    if (
      !player.hasDrawnThisTurn &&
      (this.crazyDeck.length > 0 || canReshuffle)
    ) {
      client.send("error", { message: "Must draw before passing" });
      return;
    }

    // Track consecutive passes for stalemate
    if (!player.hasDrawnThisTurn) {
      this.consecutivePasses++;
    } else {
      this.consecutivePasses = 0;
    }

    this.state.drawCount = 0;
    this.advanceCrazyTurn();
    this.syncCrazyHandSizes();

    // Stalemate: all players passed without being able to draw
    if (this.consecutivePasses >= this.playerOrder.length) {
      this.endInStalemate();
    }
  }

  // ─── UNO Call ───────────────────────────────────────────────────────

  private handleCallUno(client: Client): void {
    const hand = this.crazyHands.get(client.sessionId);
    if (!hand) return;

    // Allow call with 2 cards (pre-play) or 1 card
    if (hand.length > 2) {
      client.send("error", { message: "Can only call with 2 or fewer cards" });
      return;
    }

    this.unoCalled.set(client.sessionId, true);

    // Clear any legacy timer if still active
    const timer = this.unoCallTimers.get(client.sessionId);
    if (timer) {
      clearTimeout(timer);
      this.unoCallTimers.delete(client.sessionId);
    }

    // Track stat
    const stats = this.playerStats.get(client.sessionId);
    if (stats) stats.unoCalls++;

    // Broadcast to all players that UNO was called
    this.broadcast("uno_called", {
      playerId: client.sessionId,
      playerName:
        this.state.cardPlayers.get(client.sessionId)?.displayName ?? "Player",
    });
  }

  private handleChallengeUno(client: Client, payload: any): void {
    const targetSessionId = payload?.targetSessionId;
    if (!targetSessionId) {
      client.send("error", { message: "Must specify target player" });
      return;
    }

    // Check if target has 1 card and hasn't called UNO
    const targetHand = this.crazyHands.get(targetSessionId);
    if (!targetHand || targetHand.length !== 1) {
      client.send("error", { message: "Target does not have 1 card" });
      return;
    }

    // Check if UNO was already called
    if (this.unoCalled.get(targetSessionId) === true) {
      client.send("error", { message: "Player already called UNO" });
      return;
    }

    // Check if the challenge window is still open
    if (!this.unoCallTimers.has(targetSessionId)) {
      client.send("error", { message: "Challenge window has expired" });
      return;
    }

    // Clear the timer
    const timer = this.unoCallTimers.get(targetSessionId);
    if (timer) {
      clearTimeout(timer);
      this.unoCallTimers.delete(targetSessionId);
    }

    // Penalty: target draws 2 cards
    this.drawCardsForPlayer(targetSessionId, 2);

    // Broadcast the penalty
    this.broadcast("uno_penalty", {
      targetSessionId,
      targetName:
        this.state.cardPlayers.get(targetSessionId)?.displayName ?? "Player",
      challengerSessionId: client.sessionId,
      challengerName:
        this.state.cardPlayers.get(client.sessionId)?.displayName ?? "Player",
      penaltyCards: 2,
    });

    this.syncCrazyHandSizes();
    this.broadcastCrazyHands();
  }

  // ─── Pending Draw (from +2/+4) ─────────────────────────────────────

  private applyPendingDraw(): void {
    const targetSessionId = this.state.currentTurnPlayerId;
    this.drawCardsForPlayer(targetSessionId, this.pendingDrawCount);

    // Notify target of forced draw
    this.broadcast("forced_draw", {
      playerId: targetSessionId,
      count: this.pendingDrawCount,
    });

    this.pendingDrawCount = 0;
    this.syncCrazyHandSizes();
    this.broadcastCrazyHands();
  }

  /**
   * Draw N cards for a player from the deck, reshuffling if needed.
   */
  private drawCardsForPlayer(sessionId: string, count: number): void {
    const hand = this.crazyHands.get(sessionId);
    if (!hand) return;

    for (let i = 0; i < count; i++) {
      this.reshuffleIfNeeded();
      if (this.crazyDeck.length === 0) break;
      hand.push(this.crazyDeck.pop()!);
    }

    this.state.deckSize = this.crazyDeck.length;
  }

  // ─── Reshuffle ──────────────────────────────────────────────────────

  private reshuffleIfNeeded(): void {
    if (this.crazyDeck.length > 0) return;
    if (this.crazyDiscardPile.length <= 1) return;

    // Keep the top card, shuffle the rest back into the deck
    const topCard = this.crazyDiscardPile.pop()!;
    this.crazyDeck = shuffleCrazyCards(this.crazyDiscardPile);
    this.crazyDiscardPile = [topCard];

    this.state.deckSize = this.crazyDeck.length;
    this.state.discardSize = this.crazyDiscardPile.length;
  }

  // ─── Turn Management ───────────────────────────────────────────────

  /**
   * Advance to the next player in the current direction.
   * Resets per-turn flags for the new player.
   */
  private advanceCrazyTurn(): void {
    const currentIdx = this.playerOrder.indexOf(this.state.currentTurnPlayerId);
    const len = this.playerOrder.length;
    const nextIdx = (((currentIdx + this.direction) % len) + len) % len;
    this.state.currentTurnPlayerId = this.playerOrder[nextIdx];
    this.state.turnNumber++;

    // Reset per-turn flags
    const nextPlayer = this.state.cardPlayers.get(this.playerOrder[nextIdx]);
    if (nextPlayer) {
      nextPlayer.hasDrawnThisTurn = false;
      nextPlayer.hasPassed = false;
    }

    // If the next player is a bot, schedule their move
    this.scheduleBotPlayIfNeeded();
  }

  // ─── AI Bot Logic ──────────────────────────────────────────────────

  /** Schedule a bot move after a brief delay (to feel natural) */
  private scheduleBotPlayIfNeeded(): void {
    const nextSessionId = this.state.currentTurnPlayerId;
    if (!this.isBot(nextSessionId)) return;
    if (this.state.phase !== "playing") return;

    // Delay 800–1500ms for a natural feel
    const delay = 800 + Math.floor(Math.random() * 700);
    this.clock.setTimeout(() => {
      if (this.state.phase !== "playing") return;
      if (this.state.currentTurnPlayerId !== nextSessionId) return;
      this.executeBotTurn(nextSessionId);
    }, delay);
  }

  /** Execute a bot's turn with simple AI strategy */
  private executeBotTurn(sessionId: string): void {
    const hand = this.crazyHands.get(sessionId);
    if (!hand || hand.length === 0) return;

    const topCard = this.crazyDiscardPile[this.crazyDiscardPile.length - 1];

    // Find all playable cards
    const playable = hand.filter((card) =>
      canPlayCrazyCard(card, topCard, this.currentColor, hand),
    );

    if (playable.length > 0) {
      // AI strategy: prioritize action cards, then pick highest value
      const card = this.chooseBotCard(playable, hand);

      // Choose color for wild cards
      let chosenColor: CrazyCardColor | undefined;
      if (card.type === "wild" || card.type === "wild_draw_four") {
        chosenColor = this.chooseBotColor(hand);
      }

      // Execute the play (reuse handlePlay logic but without Client)
      this.executeBotPlay(sessionId, card, chosenColor);
    } else {
      // No playable card — draw
      this.executeBotDraw(sessionId);
    }
  }

  /** Bot AI: choose the best card to play */
  private chooseBotCard(playable: CrazyCard[], hand: CrazyCard[]): CrazyCard {
    // Priority: action cards > high-value numbers > low-value numbers > wilds
    // Save wilds for when nothing else is playable
    const nonWild = playable.filter((c) => c.color !== "wild");
    const actionCards = nonWild.filter((c) => c.type !== "number");
    const numberCards = nonWild.filter((c) => c.type === "number");

    // Play action cards first (skip, reverse, draw_two)
    if (actionCards.length > 0) {
      return actionCards[0];
    }

    // Play highest-value number card
    if (numberCards.length > 0) {
      numberCards.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
      return numberCards[0];
    }

    // Last resort: wild card (prefer regular wild over WD4)
    const wilds = playable.filter((c) => c.type === "wild");
    if (wilds.length > 0) return wilds[0];

    return playable[0];
  }

  /** Bot AI: choose the best color for a wild card */
  private chooseBotColor(hand: CrazyCard[]): CrazyCardColor {
    // Count non-wild cards by color, pick the most common
    const counts: Record<string, number> = {
      red: 0,
      yellow: 0,
      green: 0,
      blue: 0,
    };
    for (const card of hand) {
      if (card.color !== "wild") {
        counts[card.color] = (counts[card.color] || 0) + 1;
      }
    }

    let bestColor: CrazyCardColor = "red";
    let bestCount = -1;
    for (const [color, count] of Object.entries(counts)) {
      if (count > bestCount) {
        bestCount = count;
        bestColor = color as CrazyCardColor;
      }
    }
    return bestColor;
  }

  /** Execute a bot playing a card (mirrors handlePlay but without Client) */
  private executeBotPlay(
    sessionId: string,
    card: CrazyCard,
    chosenColor?: CrazyCardColor,
  ): void {
    const hand = this.crazyHands.get(sessionId);
    if (!hand) return;

    const cardIndex = hand.findIndex((c) => c.id === card.id);
    if (cardIndex === -1) return;

    // Remove from hand
    hand.splice(cardIndex, 1);

    // Add to discard
    this.crazyDiscardPile.push(card);
    this.syncCrazyTopCard(card);

    // Update color
    if (card.type === "wild" || card.type === "wild_draw_four") {
      this.currentColor = chosenColor ?? "red";
    } else {
      this.currentColor = card.color;
    }
    this.state.currentSuit = this.currentColor;

    // Track stats
    const stats = this.playerStats.get(sessionId);
    if (stats) {
      switch (card.type) {
        case "wild":
          stats.wildsPlayed++;
          break;
        case "wild_draw_four":
          stats.wildDrawFoursPlayed++;
          break;
        case "skip":
          stats.skipsPlayed++;
          break;
        case "reverse":
          stats.reversesPlayed++;
          break;
        case "draw_two":
          stats.drawTwosPlayed++;
          break;
      }
    }

    this.state.discardSize = this.crazyDiscardPile.length;
    this.state.drawCount = 0;
    this.consecutivePasses = 0;

    // Bot auto-calls UNO with 1 card
    if (hand.length === 1) {
      this.unoCalled.set(sessionId, true);
    }

    // Check for winner
    if (hand.length === 0) {
      this.finishWithWinner(sessionId);
      return;
    }

    // Apply card effects
    let effect: CardPlayedEvent["effect"] | undefined;
    switch (card.type) {
      case "skip":
        this.pendingSkip = true;
        effect = "skip";
        break;
      case "reverse":
        this.direction *= -1;
        if (this.playerOrder.length === 2) {
          this.pendingSkip = true;
        }
        effect = "reverse";
        break;
      case "draw_two":
        this.pendingDrawCount = 2;
        this.pendingSkip = true;
        effect = "draw_two";
        break;
      case "wild_draw_four":
        this.pendingDrawCount = 4;
        this.pendingSkip = true;
        effect = "wild_draw_four";
        break;
    }

    // Advance turn
    this.advanceCrazyTurn();

    // Apply pending effects
    if (this.pendingDrawCount > 0) {
      this.applyPendingDraw();
    }
    if (this.pendingSkip) {
      this.pendingSkip = false;
      this.advanceCrazyTurn();
    }

    // Broadcast
    const nextPlayerId = this.state.currentTurnPlayerId;
    this.broadcast("card_played", {
      playerId: sessionId,
      card,
      chosenColor,
      effect,
      nextPlayerId,
      direction: this.direction,
    } as CardPlayedEvent);

    this.syncCrazyHandSizes();
    this.broadcastCrazyHands();
  }

  /** Execute a bot drawing a card (mirrors handleDraw without Client) */
  private executeBotDraw(sessionId: string): void {
    const player = this.state.cardPlayers.get(sessionId);
    if (!player) return;

    const hand = this.crazyHands.get(sessionId);
    if (!hand) return;

    // Reshuffle if needed
    this.reshuffleIfNeeded();

    if (this.crazyDeck.length === 0) {
      // No cards — auto-pass
      this.consecutivePasses++;
      this.state.drawCount = 0;
      this.advanceCrazyTurn();
      this.syncCrazyHandSizes();
      if (this.consecutivePasses >= this.playerOrder.length) {
        this.endInStalemate();
      }
      return;
    }

    // Draw one card
    const drawn = this.crazyDeck.pop()!;
    hand.push(drawn);

    player.hasDrawnThisTurn = true;
    this.state.deckSize = this.crazyDeck.length;
    this.state.drawCount++;
    this.consecutivePasses = 0;

    const stats = this.playerStats.get(sessionId);
    if (stats) stats.cardsDrawn++;

    // Check if drawn card is playable
    const topCard = this.crazyDiscardPile[this.crazyDiscardPile.length - 1];
    if (canPlayCrazyCard(drawn, topCard, this.currentColor, hand)) {
      // Bot plays it immediately
      let chosenColor: CrazyCardColor | undefined;
      if (drawn.type === "wild" || drawn.type === "wild_draw_four") {
        chosenColor = this.chooseBotColor(hand);
      }
      // Small delay before playing drawn card
      this.clock.setTimeout(() => {
        if (this.state.phase !== "playing") return;
        if (this.state.currentTurnPlayerId !== sessionId) return;
        this.executeBotPlay(sessionId, drawn, chosenColor);
      }, 500);
    } else {
      // Can't play drawn card — pass
      this.state.drawCount = 0;
      this.advanceCrazyTurn();
      this.syncCrazyHandSizes();
    }
  }

  // ─── Win / Stalemate ───────────────────────────────────────────────

  private finishWithWinner(winnerSessionId: string): void {
    const player = this.state.cardPlayers.get(winnerSessionId);
    if (!player) return;

    this.state.winnerId = player.uid;
    this.state.winReason = "empty_hand";
    this.state.phase = "finished";

    // Score: winner gets sum of all opponents' remaining cards
    let totalScore = 0;
    this.state.cardPlayers.forEach((p: any) => {
      if (p.sessionId !== winnerSessionId) {
        const opHand = this.crazyHands.get(p.sessionId);
        if (opHand) {
          const handScore = calculateCrazyCardsHandScore(opHand);
          p.score = handScore; // opponent's penalty score
          totalScore += handScore;
        }
      }
    });

    // Winner's score is the sum of opponents' hand values
    player.score = totalScore;

    // Broadcast final hands + stats
    this.broadcast("game_result", {
      winnerId: player.uid,
      winnerSessionId,
      winnerName: player.displayName,
      winnerScore: totalScore,
      reason: "empty_hand",
      playerStats: this.getPlayerStatsPayload(),
    });

    this.syncCrazyHandSizes();
    this.broadcastCrazyHands();
  }

  private endInStalemate(): void {
    // Lowest hand value wins in stalemate
    let lowestScore = Infinity;
    let winnerId = "";
    let winnerSessionId = "";

    this.state.cardPlayers.forEach((p: any) => {
      const hand = this.crazyHands.get(p.sessionId);
      if (hand) {
        const score = calculateCrazyCardsHandScore(hand);
        p.score = score;
        if (score < lowestScore) {
          lowestScore = score;
          winnerId = p.uid;
          winnerSessionId = p.sessionId;
        }
      }
    });

    this.state.winnerId = winnerId;
    this.state.winReason = "stalemate";
    this.state.phase = "finished";

    this.broadcast("game_result", {
      winnerId,
      winnerSessionId,
      winnerName:
        this.state.cardPlayers.get(winnerSessionId)?.displayName ?? "Player",
      reason: "stalemate",
      playerStats: this.getPlayerStatsPayload(),
    });

    this.syncCrazyHandSizes();
    this.broadcastCrazyHands();
  }

  // ─── Sync Helpers ───────────────────────────────────────────────────

  /**
   * Sync the top card to the shared Colyseus state.
   * We reuse SyncCard's suit/rank fields:
   *   suit → CrazyCard stringified "{color}|{type}|{value}"
   *   rank → card.id
   * This allows the client to fully reconstruct the top card.
   */
  private syncCrazyTopCard(card: CrazyCard): void {
    this.state.topCard.suit = `${card.color}|${card.type}|${card.value ?? ""}`;
    this.state.topCard.rank = card.id;
    this.state.topCard.faceUp = true;
  }

  /** Sync hand sizes for all players in the shared state */
  private syncCrazyHandSizes(): void {
    this.state.cardPlayers.forEach((p: any) => {
      const hand = this.crazyHands.get(p.sessionId);
      p.handSize = hand ? hand.length : 0;
    });
  }

  /** Send a player their private hand (CrazyCard[]) */
  private sendCrazyHand(sessionId: string): void {
    // Bots don't have a real client connection
    if (this.isBot(sessionId)) return;

    const hand = this.crazyHands.get(sessionId);
    if (!hand) return;

    for (const c of this.clients) {
      if (c.sessionId === sessionId) {
        c.send("hand", { cards: hand });
        break;
      }
    }
  }

  /** Brief all players on their current hands */
  private broadcastCrazyHands(): void {
    this.playerOrder.forEach((sid) => this.sendCrazyHand(sid));
  }

  // ─── Stats ──────────────────────────────────────────────────────────

  private getPlayerStatsPayload(): Record<string, any> {
    const result: Record<string, any> = {};
    this.playerStats.forEach((stats, sessionId) => {
      const player = this.state.cardPlayers.get(sessionId);
      result[sessionId] = {
        uid: player?.uid ?? "",
        displayName: player?.displayName ?? "",
        ...stats,
      };
    });
    return result;
  }

  // ─── Persistence ───────────────────────────────────────────────────

  protected serializePrivateState(): Record<string, any> {
    const hands: Record<string, CrazyCard[]> = {};
    this.crazyHands.forEach((h, sid) => {
      hands[sid] = h;
    });
    return {
      hands,
      deck: this.crazyDeck,
      discardPile: this.crazyDiscardPile,
      currentColor: this.currentColor,
      direction: this.direction,
      pendingDrawCount: this.pendingDrawCount,
      pendingSkip: this.pendingSkip,
      consecutivePasses: this.consecutivePasses,
      playerOrder: this.playerOrder,
      playerStats: Object.fromEntries(this.playerStats),
    };
  }

  protected restorePrivateState(saved: Record<string, any>): void {
    if (saved.hands) {
      Object.entries(saved.hands).forEach(([sid, cards]) => {
        this.crazyHands.set(sid, cards as CrazyCard[]);
      });
    }
    this.crazyDeck = saved.deck || [];
    this.crazyDiscardPile = saved.discardPile || [];
    this.playerOrder = saved.playerOrder || [];
    this.currentColor = saved.currentColor || "red";
    this.direction = saved.direction || 1;
    this.pendingDrawCount = saved.pendingDrawCount || 0;
    this.pendingSkip = saved.pendingSkip || false;
    this.consecutivePasses = saved.consecutivePasses || 0;

    if (saved.playerStats) {
      Object.entries(saved.playerStats).forEach(([sid, stats]) => {
        this.playerStats.set(sid, stats as any);
      });
    }

    if (this.crazyDiscardPile.length > 0) {
      this.syncCrazyTopCard(
        this.crazyDiscardPile[this.crazyDiscardPile.length - 1],
      );
    }
    this.state.currentSuit = this.currentColor;
    this.state.deckSize = this.crazyDeck.length;
    this.state.discardSize = this.crazyDiscardPile.length;
    this.syncCrazyHandSizes();
  }
}
