import { createServerLogger } from "../../utils/logger";
const log = createServerLogger("RaceRoom");

/**
 * RaceRoom â€” Competitive Typing Race
 *
 * Both players type the same sentence. Server provides the sentence,
 * tracks progress (typed characters / total), WPM, and accuracy.
 * First to complete the sentence wins. If both finish, fastest wins.
 *
 * Architecture: Event-driven (no physics loop). Client sends progress
 * updates on each keystroke; server validates and broadcasts.
 *
 * @see docs/COLYSEUS_MULTIPLAYER_PLAN.md â€” Phase 4.6
 */

import { Client, Room } from "colyseus";
import { BaseGameState } from "../../schemas/common";
import { RacePlayerState, RaceState } from "../../schemas/physics";
import { verifyFirebaseToken } from "../../services/firebase";
import { persistGameResult } from "../../services/persistence";

// =============================================================================
// Sentences Pool
// =============================================================================

const SENTENCES = [
  "The quick brown fox jumps over the lazy dog",
  "Pack my box with five dozen liquor jugs",
  "How vexingly quick daft zebras jump",
  "The five boxing wizards jump quickly",
  "Bright vixens jump dozy fowl quack",
  "Sphinx of black quartz judge my vow",
  "Two driven jocks help fax my big quiz",
  "The jay pig fox and zebra did waltz quickly",
  "Crazy Frederick bought many very exquisite opal jewels",
  "We promptly judged antique ivory buckles for the next prize",
  "A mad boxer shot a quick gloved jab to the jaw of his dizzy opponent",
  "The wizard quickly jinxed the gnomes before they vaporized",
  "Jackdaws love my big sphinx of quartz",
  "Amazingly few discotheques provide jukeboxes",
  "My girl wove six dozen plaid jackets before she quit",
];

// =============================================================================
// Room
// =============================================================================

// Intentionally standalone room: typing-race payloads and completion semantics
// differ from score-race abstractions.
export class RaceRoom extends Room<{ state: RaceState }> {
  maxClients = 2;
  patchRate = 100; // 10fps for progress updates
  autoDispose = true;

  private gameStartTime = 0;

  // ===========================================================================
  // Lifecycle
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
    };
  }

  onCreate(options: Record<string, any>): void {
    this.setState(new RaceState());
    this.state.gameType = "race_game";
    this.state.gameId = this.roomId;
    this.state.seed = Math.floor(Math.random() * 2147483647);
    this.state.phase = "waiting";

    // Select sentence using seed
    const idx = this.state.seed % SENTENCES.length;
    this.state.sentence = options.sentence || SENTENCES[idx];

    log.info(`[race_game] Room created: ${this.roomId}`);
  }

  // ===========================================================================
  // Messages
  // ===========================================================================

  messages: Record<string, (client: Client, payload?: any) => void> = {
    ready: (client: Client) => {
      const player = this.state.racePlayers.get(client.sessionId);
      if (player) {
        player.ready = true;
        this.checkAllReady();
      }
    },

    progress: (
      client: Client,
      payload: {
        progress: number;
        wpm: number;
        accuracy: number;
      },
    ) => {
      if (this.state.phase !== "playing") return;
      const player = this.state.racePlayers.get(client.sessionId);
      if (!player || player.finished) return;

      // Validate progress is monotonically increasing
      if (payload.progress < player.progress) return;
      if (payload.progress > 1) return;

      player.progress = payload.progress;
      player.wpm = Math.max(0, Math.min(300, payload.wpm)); // cap at 300 WPM
      player.accuracy = Math.max(0, Math.min(100, payload.accuracy));
      player.score = Math.round(payload.wpm);

      // Check completion
      if (payload.progress >= 1) {
        player.finished = true;
        player.finishTime = (Date.now() - this.gameStartTime) / 1000;
        this.checkAllFinished();
      }
    },

    finished: (client: Client, payload: { wpm: number; accuracy: number }) => {
      if (this.state.phase !== "playing") return;
      const player = this.state.racePlayers.get(client.sessionId);
      if (!player || player.finished) return;

      player.progress = 1;
      player.wpm = payload.wpm;
      player.accuracy = payload.accuracy;
      player.score = Math.round(payload.wpm);
      player.finished = true;
      player.finishTime = (Date.now() - this.gameStartTime) / 1000;
      this.checkAllFinished();
    },

    rematch: (client: Client) => {
      if (this.state.phase !== "finished") return;
      this.broadcast("rematch_request", {
        fromSessionId: client.sessionId,
        fromName:
          this.state.racePlayers.get(client.sessionId)?.displayName || "Player",
      });
    },

    rematch_accept: (_client: Client) => {
      if (this.state.phase !== "finished") return;
      this.resetForRematch();
    },
  };

  // ===========================================================================
  // Player Lifecycle
  // ===========================================================================

  onJoin(client: Client, _options: Record<string, any>, auth: any): void {
    const player = new RacePlayerState();
    player.uid = auth.uid;
    player.sessionId = client.sessionId;
    player.displayName = auth.displayName || "Player";
    player.playerIndex = this.state.racePlayers.size;
    player.connected = true;

    this.state.racePlayers.set(client.sessionId, player);

    client.send("welcome", {
      sessionId: client.sessionId,
      playerIndex: player.playerIndex,
      sentence: this.state.sentence,
      seed: this.state.seed,
    });

    if (this.state.racePlayers.size >= this.maxClients) {
      this.lock();
    }
  }

  onDrop(client: Client, _code: number): void {
    const player = this.state.racePlayers.get(client.sessionId);
    if (player) player.connected = false;
    this.broadcast(
      "opponent_reconnecting",
      { sessionId: client.sessionId },
      { except: client },
    );
    this.allowReconnection(client, 30);
  }

  onReconnect(client: Client): void {
    const player = this.state.racePlayers.get(client.sessionId);
    if (player) player.connected = true;
    this.broadcast(
      "opponent_reconnected",
      { sessionId: client.sessionId },
      { except: client },
    );
  }

  onLeave(client: Client, _code: number): void {
    const player = this.state.racePlayers.get(client.sessionId);
    if (player && this.state.phase === "playing" && !player.finished) {
      player.finished = true;
      player.finishTime = (Date.now() - this.gameStartTime) / 1000;
      this.checkAllFinished();
    }
  }

  async onDispose(): Promise<void> {
    if (this.state.phase === "finished" && this.state.winnerId) {
      await persistGameResult(this.state as unknown as BaseGameState, this.state.elapsed);
    }
    log.info(`[race_game] Room disposed: ${this.roomId}`);
  }

  // ===========================================================================
  // Game Flow
  // ===========================================================================

  private checkAllReady(): void {
    if (this.state.racePlayers.size < 2) return;
    let allReady = true;
    this.state.racePlayers.forEach((p: RacePlayerState) => {
      if (!p.ready) allReady = false;
    });
    if (allReady) this.startCountdown();
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
    this.gameStartTime = Date.now();

    // Track elapsed time
    this.setSimulationInterval((dt: number) => {
      if (this.state.phase !== "playing") return;
      this.state.elapsed += dt;
    }, 200);

    log.info("[race_game] Game started!");
  }

  private checkAllFinished(): void {
    let allFinished = true;
    this.state.racePlayers.forEach((p: RacePlayerState) => {
      if (!p.finished) allFinished = false;
    });
    if (allFinished) this.endGame();
  }

  private endGame(): void {
    if (this.state.phase === "finished") return;
    this.state.phase = "finished";

    const players = Array.from(
      this.state.racePlayers.values(),
    ) as RacePlayerState[];

    if (players.length >= 2) {
      // Winner: fastest finish time. Tiebreak: higher WPM.
      const completers = players.filter((p) => p.progress >= 1);
      if (completers.length === 0) {
        // Neither finished â€” highest progress wins
        const sorted = [...players].sort((a, b) => b.progress - a.progress);
        if (sorted[0].progress === sorted[1].progress) {
          this.state.winnerId = "";
          this.state.winReason = "tie";
        } else {
          this.state.winnerId = sorted[0].uid;
          this.state.winReason = "most_progress";
        }
      } else if (completers.length === 1) {
        this.state.winnerId = completers[0].uid;
        this.state.winReason = "completed_first";
      } else {
        // Both finished â€” fastest wins
        const sorted = [...completers].sort(
          (a, b) => a.finishTime - b.finishTime,
        );
        if (sorted[0].finishTime === sorted[1].finishTime) {
          // Same time â€” higher WPM wins
          const wpmSorted = [...sorted].sort((a, b) => b.wpm - a.wpm);
          this.state.winnerId = wpmSorted[0].uid;
          this.state.winReason = "higher_wpm";
        } else {
          this.state.winnerId = sorted[0].uid;
          this.state.winReason = "completed_first";
        }
      }
    }

    const results = players.map((p) => ({
      uid: p.uid,
      displayName: p.displayName,
      wpm: p.wpm,
      accuracy: p.accuracy,
      progress: p.progress,
      finishTime: p.finishTime,
    }));

    this.broadcast("game_over", {
      winnerId: this.state.winnerId,
      winReason: this.state.winReason,
      results,
    });

    log.info(
      `[race_game] Game over! Winner: ${this.state.winnerId || "TIE"}`,
    );
  }

  private resetForRematch(): void {
    this.state.racePlayers.forEach((p: RacePlayerState) => {
      p.score = 0;
      p.ready = false;
      p.finished = false;
      p.progress = 0;
      p.wpm = 0;
      p.accuracy = 0;
      p.finishTime = 0;
    });
    this.state.phase = "waiting";
    this.state.winnerId = "";
    this.state.winReason = "";
    this.state.elapsed = 0;
    this.state.countdown = 0;
    this.state.seed = Math.floor(Math.random() * 2147483647);
    // New sentence for rematch
    const idx = this.state.seed % SENTENCES.length;
    this.state.sentence = SENTENCES[idx];
    this.unlock();
  }
}


