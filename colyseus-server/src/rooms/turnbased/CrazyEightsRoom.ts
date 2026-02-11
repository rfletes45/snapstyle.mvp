/**
 * CrazyEightsRoom â€” Server-authoritative Crazy Eights card game
 *
 * Rules:
 * - Play cards matching rank or suit of top discard
 * - 8s are wild â€” player declares next suit
 * - Draw from deck if no playable cards (max 1 draw per turn)
 * - After drawing, must play drawn card if able, else pass
 * - First to empty hand wins
 *
 * Private info: Player hands are sent via targeted messages, NOT synced state.
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md Phase 3
 */

import { Client } from "colyseus";
import {
  ServerCard,
  createStandardDeck,
  shuffleDeck,
} from "../../schemas/cards";
import { CardGameRoom } from "../base/CardGameRoom";

// =============================================================================
// Room
// =============================================================================

export class CrazyEightsRoom extends CardGameRoom {
  protected readonly gameTypeKey = "crazy_eights_game";

  // â”€â”€â”€ Game Setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  protected initializeGame(_options: Record<string, any>): void {
    // Create and shuffle deck
    this.deck = shuffleDeck(createStandardDeck());

    // Deal 7 cards to each player
    this.playerOrder.forEach((sessionId) => {
      const hand: ServerCard[] = [];
      for (let i = 0; i < 7; i++) {
        if (this.deck.length > 0) {
          hand.push(this.deck.pop()!);
        }
      }
      this.hands.set(sessionId, hand);
    });

    // Draw first discard card (skip 8s)
    let topCard = this.deck.pop()!;
    while (topCard.rank === "8" && this.deck.length > 0) {
      this.deck.unshift(topCard);
      this.deck = shuffleDeck(this.deck);
      topCard = this.deck.pop()!;
    }

    this.discardPile = [topCard];
    this.syncTopCard(topCard);
    this.state.currentSuit = topCard.suit;
    this.state.deckSize = this.deck.length;
    this.state.discardSize = 1;
    this.state.drawCount = 0;

    this.syncHandSizes();
  }

  // â”€â”€â”€ Handle Messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      default:
        client.send("error", { message: `Unknown action: ${type}` });
    }
  }

  // â”€â”€â”€ Play a card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private handlePlay(client: Client, payload: any): void {
    const hand = this.hands.get(client.sessionId);
    if (!hand) return;

    const cardData = payload?.card;
    if (!cardData?.suit || !cardData?.rank) {
      client.send("error", { message: "No card specified" });
      return;
    }

    // Find card in hand
    const cardIndex = hand.findIndex(
      (c) => c.suit === cardData.suit && c.rank === cardData.rank,
    );
    if (cardIndex === -1) {
      client.send("error", { message: "Card not in hand" });
      return;
    }

    const card = hand[cardIndex];

    // Check if card can be played
    if (!this.canPlay(card)) {
      client.send("error", { message: "Card cannot be played" });
      return;
    }

    // If playing an 8, must declare suit
    if (card.rank === "8" && !payload?.declaredSuit) {
      client.send("error", {
        message: "Must declare suit when playing an 8",
      });
      return;
    }

    // Remove card from hand
    hand.splice(cardIndex, 1);

    // Add to discard pile
    this.discardPile.push(card);
    this.syncTopCard(card);

    // Update current suit
    if (card.rank === "8" && payload?.declaredSuit) {
      this.state.currentSuit = payload.declaredSuit;
    } else {
      this.state.currentSuit = card.suit;
    }

    this.state.discardSize = this.discardPile.length;
    this.state.drawCount = 0;

    // Check for winner
    if (hand.length === 0) {
      const player = this.state.cardPlayers.get(client.sessionId);
      if (player) {
        this.state.winnerId = player.uid;
        this.state.winReason = "empty_hand";
        this.state.phase = "finished";

        // Score remaining cards for opponent
        const opponent = this.findOpponent(client.sessionId);
        if (opponent) {
          const opHand = this.hands.get(opponent.sessionId);
          if (opHand) {
            opponent.score = this.calculateHandScore(opHand);
          }
        }
      }
      this.syncHandSizes();
      this.broadcastHands();
      return;
    }

    // Advance turn
    this.advanceTurn();
    this.syncHandSizes();
    this.broadcastHands();
  }

  // â”€â”€â”€ Draw a card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    // Reshuffle if deck empty
    if (this.deck.length === 0) {
      if (this.discardPile.length <= 1) {
        client.send("error", { message: "No cards to draw â€” pass instead" });
        return;
      }
      const topCard = this.discardPile.pop()!;
      this.deck = shuffleDeck(this.discardPile);
      this.discardPile = [topCard];
    }

    // Draw one card
    const hand = this.hands.get(client.sessionId);
    if (!hand) return;

    const drawn = this.deck.pop()!;
    hand.push(drawn);

    player.hasDrawnThisTurn = true;
    this.state.deckSize = this.deck.length;
    this.state.discardSize = this.discardPile.length;
    this.state.drawCount++;

    this.syncHandSizes();
    this.sendHand(client.sessionId);
  }

  // â”€â”€â”€ Pass turn â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private handlePass(client: Client): void {
    const player = this.state.cardPlayers.get(client.sessionId);
    if (!player) return;

    // Can only pass if drawn already or deck empty
    if (!player.hasDrawnThisTurn && this.deck.length > 0) {
      client.send("error", { message: "Must draw before passing" });
      return;
    }

    this.advanceTurn();
    this.syncHandSizes();
  }

  // â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private canPlay(card: ServerCard): boolean {
    if (card.rank === "8") return true; // 8s are wild
    const topCard = this.discardPile[this.discardPile.length - 1];
    return card.suit === this.state.currentSuit || card.rank === topCard.rank;
  }

  private calculateHandScore(hand: ServerCard[]): number {
    let score = 0;
    for (const card of hand) {
      if (card.rank === "8") score += 50;
      else if (["J", "Q", "K"].includes(card.rank)) score += 10;
      else if (card.rank === "A") score += 1;
      else score += parseInt(card.rank, 10);
    }
    return score;
  }

  // â”€â”€â”€ Persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  protected serializePrivateState(): Record<string, any> {
    const hands: Record<string, ServerCard[]> = {};
    this.hands.forEach((h, sid) => {
      hands[sid] = h;
    });
    return {
      hands,
      deck: this.deck,
      discardPile: this.discardPile,
      currentSuit: this.state.currentSuit,
      playerOrder: this.playerOrder,
    };
  }

  protected restorePrivateState(saved: Record<string, any>): void {
    if (saved.hands) {
      Object.entries(saved.hands).forEach(([sid, cards]) => {
        this.hands.set(sid, cards as ServerCard[]);
      });
    }
    this.deck = saved.deck || [];
    this.discardPile = saved.discardPile || [];
    this.playerOrder = saved.playerOrder || [];

    if (this.discardPile.length > 0) {
      this.syncTopCard(this.discardPile[this.discardPile.length - 1]);
    }
    this.state.currentSuit = saved.currentSuit || "";
    this.state.deckSize = this.deck.length;
    this.state.discardSize = this.discardPile.length;
    this.syncHandSizes();
  }
}

