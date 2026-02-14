import { Client, Room, ServerError } from "colyseus";
import { IslandRoomState, NetworkPlayerState } from "./schema/IslandState.js";

interface JoinOptions {
  mode?: "join" | "game" | "spectate";
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

export class IslandRoom extends Room<IslandRoomState> {
  onCreate(options?: JoinOptions): void {
    this.maxClients = 10;
    this.setState(new IslandRoomState());
    if (options?.inviteCode) {
      this.setMetadata({ inviteCode: options.inviteCode });
    }

    this.onMessage(
      "player:update_transform",
      (client, payload: TransformPayload) => {
        const player = this.state.players.get(client.sessionId);
        if (!player) {
          return;
        }
        player.x = toFinite(payload.x, player.x);
        player.y = toFinite(payload.y, player.y);
        player.z = toFinite(payload.z, player.z);
        player.yaw = toFinite(payload.yaw, player.yaw);
        player.animState = payload.animState === "moving" ? "moving" : "idle";
      },
    );

    this.onMessage(
      "player:fishing_state",
      (client, payload: FishingStatePayload) => {
        const player = this.state.players.get(client.sessionId);
        if (!player) {
          return;
        }
        player.fishingState = mapFishingState(payload?.fishingState);
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
  }

  onAuth(_client: Client, options?: JoinOptions): boolean {
    if (options?.mode === "spectate") {
      throw new ServerError(403, "Spectating not supported");
    }
    return true;
  }

  onJoin(client: Client): void {
    const player = new NetworkPlayerState();
    player.x = 0;
    player.y = 0;
    player.z = 8;
    player.yaw = 0;
    player.animState = "idle";
    player.fishingState = "idle";
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
  }
}

function mapFishingState(
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
