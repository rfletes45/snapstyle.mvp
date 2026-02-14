import { Client, Room, ServerError } from "colyseus";
import {
  TropicalFishingPlayerState,
  TropicalFishingState,
} from "../../schemas/tropicalFishing";
import { createServerLogger } from "../../utils/logger";

const log = createServerLogger("TropicalFishingRoom");

interface JoinOptions {
  mode?: "join" | "game" | "spectate";
  firestoreGameId?: string;
  inviteCode?: string;
}

interface TransformPayload {
  x: number;
  y: number;
  z: number;
  yaw: number;
  animState: "idle" | "moving";
}

interface FishingStatePayload {
  fishingState: "idle" | "casting" | "waiting" | "caught" | "fail";
}

interface CelebrationPayload {
  rarity: "mythic";
}

function toFinite(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toFishingState(
  value: unknown,
): "idle" | "casting" | "waiting" | "caught" | "fail" {
  switch (value) {
    case "casting":
    case "waiting":
    case "caught":
    case "fail":
      return value;
    default:
      return "idle";
  }
}

export class TropicalFishingRoom extends Room<{ state: TropicalFishingState }> {
  maxClients = 10;
  patchRate = 100;
  autoDispose = true;

  onCreate(options?: JoinOptions): void {
    this.setState(new TropicalFishingState());

    // Keep metadata aligned with the standard Firestore-matched room key.
    const firestoreGameId = options?.firestoreGameId ?? options?.inviteCode;
    if (firestoreGameId) {
      this.setMetadata({ firestoreGameId });
    }

    this.onMessage(
      "player:update_transform",
      (client, payload: TransformPayload) => {
        const player = this.state.players.get(client.sessionId);
        if (!player) {
          return;
        }
        player.x = toFinite(payload?.x, player.x);
        player.y = toFinite(payload?.y, player.y);
        player.z = toFinite(payload?.z, player.z);
        player.yaw = toFinite(payload?.yaw, player.yaw);
        player.animState = payload?.animState === "moving" ? "moving" : "idle";
      },
    );

    this.onMessage(
      "player:fishing_state",
      (client, payload: FishingStatePayload) => {
        const player = this.state.players.get(client.sessionId);
        if (!player) {
          return;
        }
        player.fishingState = toFishingState(payload?.fishingState);
      },
    );

    this.onMessage(
      "player:celebration",
      (client, payload: CelebrationPayload) => {
        const rarity = payload?.rarity === "mythic" ? "mythic" : null;
        if (!rarity) {
          return;
        }
        this.broadcast("player:celebration", {
          sessionId: client.sessionId,
          rarity,
        });
      },
    );

    log.info(`[tropical_fishing] room created ${this.roomId}`);
  }

  onAuth(_client: Client, options?: JoinOptions): boolean {
    if (options?.mode === "spectate") {
      throw new ServerError(403, "Spectating not supported");
    }
    return true;
  }

  onJoin(client: Client): void {
    const player = new TropicalFishingPlayerState();
    player.x = 0;
    player.y = 0;
    player.z = 8;
    player.yaw = 0;
    player.animState = "idle";
    player.fishingState = "idle";
    this.state.players.set(client.sessionId, player);
    log.info(
      `[tropical_fishing] player joined ${client.sessionId} (${this.state.players.size}/${this.maxClients})`,
    );
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    log.info(
      `[tropical_fishing] player left ${client.sessionId} (${this.state.players.size}/${this.maxClients})`,
    );
  }
}
