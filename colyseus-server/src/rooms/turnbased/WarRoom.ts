/**
 * WarRoom â€” Server-authoritative War card game
 *
 * War is a simultaneous-flip game (NOT turn-based):
 * - Both players flip top card simultaneously
 * - Higher rank wins both cards
 * - On tie â†’ WAR: 3 face-down + 1 face-up
 * - If a player runs out during war, they lose
 * - Game ends when one player has all 52 cards (or opponent 0)
 *
 * Flow:
 * 1. Both players send "flip" â†’ server waits for both
 * 2. Once both flipped, server reveals cards + resolves
 * 3. Repeat
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md Phase 3
 */

import { Client } from "colyseus";
import {
  ServerCard,
  cardRankValue,
  createStandardDeck,
  shuffleDeck,
} from "../../schemas/cards";
import { CardGameRoom } from "../base/CardGameRoom";

// =============================================================================
// Room
// =============================================================================

export class WarRoom extends CardGameRoom {
  protected readonly gameTypeKey = "war_game";

  // Server-side private decks (War uses "decks" not "hands")
  private playerDecks = new Map<string, ServerCard[]>();
  private warPile: ServerCard[] = [];
  private flippedCards = new Map<string, ServerCard>();
  private roundResolveTimeout: ReturnType<typeof setTimeout> | null = null;

  // â”€â”€â”€ Game Setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  protected initializeGame(_options: Record<string, any>): void {
    // Create full deck, shuffle, deal 26 each
    const fullDeck = shuffleDeck(createStandardDeck());

    const [p1SessionId, p2SessionId] = this.playerOrder;
    if (!p1SessionId || !p2SessionId) return;

    this.playerDecks.set(p1SessionId, fullDeck.slice(0, 26));
    this.playerDecks.set(p2SessionId, fullDeck.slice(26));

    // Also set empty "hands" so base class doesn't break
    this.hands.set(p1SessionId, []);
    this.hands.set(p2SessionId, []);

    // Sync sizes
    this.state.p1DeckSize = 26;
    this.state.p2DeckSize = 26;
    this.state.warPileSize = 0;
    this.state.isWar = false;
    this.state.roundResult = "";

    this.flippedCards.clear();
    this.warPile = [];

    this.broadcast("war_ready", { message: "Both players flip!" });
  }

  // â”€â”€â”€ Handle Messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  protected handleGameMessage(
    client: Client,
    type: string,
    _payload: any,
  ): void {
    switch (type) {
      case "flip":
        this.handleFlip(client);
        break;
      default:
        client.send("error", { message: `Unknown action: ${type}` });
    }
  }

  // â”€â”€â”€ Flip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private handleFlip(client: Client): void {
    // Can't flip if already flipped this round
    if (this.flippedCards.has(client.sessionId)) {
      client.send("error", { message: "Already flipped" });
      return;
    }

    const deck = this.playerDecks.get(client.sessionId);
    if (!deck || deck.length === 0) {
      client.send("error", { message: "No cards left" });
      return;
    }

    // Draw top card
    const card = deck.pop()!;
    this.flippedCards.set(client.sessionId, card);
    this.syncDeckSizes();

    // Notify client of their own flip
    client.send("your_flip", { card: { suit: card.suit, rank: card.rank } });

    // Check if both players have flipped
    if (this.flippedCards.size === 2) {
      this.resolveRound();
    }
  }

  // â”€â”€â”€ Resolve Round â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private resolveRound(): void {
    const [p1Id, p2Id] = this.playerOrder;
    const card1 = this.flippedCards.get(p1Id)!;
    const card2 = this.flippedCards.get(p2Id)!;

    // Reveal both cards
    this.state.player1Card.suit = card1.suit;
    this.state.player1Card.rank = card1.rank;
    this.state.player1Card.faceUp = true;
    this.state.player2Card.suit = card2.suit;
    this.state.player2Card.rank = card2.rank;
    this.state.player2Card.faceUp = true;

    const rank1 = cardRankValue(card1.rank);
    const rank2 = cardRankValue(card2.rank);

    // Add both cards + war pile to pot
    const pot: ServerCard[] = [...this.warPile, card1, card2];
    this.warPile = [];

    if (rank1 > rank2) {
      // Player 1 wins round
      const deck1 = this.playerDecks.get(p1Id)!;
      deck1.unshift(...shuffleDeck(pot));
      this.state.roundResult = "player1";
      this.state.isWar = false;
      this.finishRound();
    } else if (rank2 > rank1) {
      // Player 2 wins round
      const deck2 = this.playerDecks.get(p2Id)!;
      deck2.unshift(...shuffleDeck(pot));
      this.state.roundResult = "player2";
      this.state.isWar = false;
      this.finishRound();
    } else {
      // WAR!
      this.state.isWar = true;
      this.state.roundResult = "war";
      this.warPile = pot;

      // Each player puts 3 cards face-down
      const deck1 = this.playerDecks.get(p1Id)!;
      const deck2 = this.playerDecks.get(p2Id)!;

      // If either player can't afford war, they lose
      if (deck1.length < 3) {
        this.declareWinner(p2Id, "out_of_cards_war");
        return;
      }
      if (deck2.length < 3) {
        this.declareWinner(p1Id, "out_of_cards_war");
        return;
      }

      // Take 3 face-down cards from each
      for (let i = 0; i < 3; i++) {
        this.warPile.push(deck1.pop()!);
        this.warPile.push(deck2.pop()!);
      }

      this.state.warPileSize = this.warPile.length;
      this.syncDeckSizes();

      // Clear flipped cards â€” both must flip again
      this.flippedCards.clear();

      this.broadcast("war_flip", {
        message: "WAR! Flip again!",
        warPileSize: this.warPile.length,
      });
    }
  }

  // â”€â”€â”€ Finish Round â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private finishRound(): void {
    this.flippedCards.clear();
    this.syncDeckSizes();
    this.state.warPileSize = 0;

    const [p1Id, p2Id] = this.playerOrder;
    const deck1 = this.playerDecks.get(p1Id)!;
    const deck2 = this.playerDecks.get(p2Id)!;

    // Check for game over
    if (deck1.length === 0) {
      this.declareWinner(p2Id, "all_cards");
      return;
    }
    if (deck2.length === 0) {
      this.declareWinner(p1Id, "all_cards");
      return;
    }

    // Schedule next round prompt after brief reveal delay
    if (this.roundResolveTimeout) clearTimeout(this.roundResolveTimeout);
    this.roundResolveTimeout = setTimeout(() => {
      // Clear revealed cards
      this.state.player1Card.faceUp = false;
      this.state.player2Card.faceUp = false;
      this.broadcast("war_ready", { message: "Flip!" });
    }, 1500);
  }

  // â”€â”€â”€ Winner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private declareWinner(winnerSessionId: string, reason: string): void {
    const player = this.state.cardPlayers.get(winnerSessionId);
    if (player) {
      this.state.winnerId = player.uid;
      this.state.winReason = reason;
    }

    // Set scores = deck size
    this.playerOrder.forEach((sid) => {
      const p = this.state.cardPlayers.get(sid);
      const deck = this.playerDecks.get(sid);
      if (p && deck) {
        p.score = deck.length;
      }
    });

    this.state.phase = "finished";
    this.syncDeckSizes();
  }

  // â”€â”€â”€ Sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private syncDeckSizes(): void {
    const [p1Id, p2Id] = this.playerOrder;
    if (p1Id) {
      this.state.p1DeckSize = this.playerDecks.get(p1Id)?.length ?? 0;
    }
    if (p2Id) {
      this.state.p2DeckSize = this.playerDecks.get(p2Id)?.length ?? 0;
    }
  }

  // â”€â”€â”€ Persistence â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  protected serializePrivateState(): Record<string, any> {
    const decks: Record<string, ServerCard[]> = {};
    this.playerDecks.forEach((d, sid) => {
      decks[sid] = d;
    });
    return {
      playerDecks: decks,
      warPile: this.warPile,
      playerOrder: this.playerOrder,
    };
  }

  protected restorePrivateState(saved: Record<string, any>): void {
    if (saved.playerDecks) {
      Object.entries(saved.playerDecks).forEach(([sid, cards]) => {
        this.playerDecks.set(sid, cards as ServerCard[]);
      });
    }
    this.warPile = saved.warPile || [];
    this.playerOrder = saved.playerOrder || [];
    this.syncDeckSizes();
    this.state.warPileSize = this.warPile.length;

    // Empty hands for base class
    this.playerOrder.forEach((sid) => this.hands.set(sid, []));
  }

  // â”€â”€â”€ Cleanup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async onDispose(): Promise<void> {
    if (this.roundResolveTimeout) clearTimeout(this.roundResolveTimeout);
    await super.onDispose();
  }
}

