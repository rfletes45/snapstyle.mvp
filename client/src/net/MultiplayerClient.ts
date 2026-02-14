import { Client as ColyseusClient, Room } from "colyseus.js";
import type { CelebrationSnapshot, ConnectionInfo, NetCelebrationRarity, NetFishingState, RemotePlayerSnapshot } from "./types";

interface ConnectOptions {
  roomId?: string;
  firestoreGameId?: string;
  inviteCode?: string;
  mode: "join" | "game" | "spectate";
}

interface MultiplayerCallbacks {
  onConnected: (info: ConnectionInfo) => void;
  onDisconnected: () => void;
  onPlayerCountChanged: (count: number) => void;
  onRemotePlayerUpdate: (snapshot: RemotePlayerSnapshot) => void;
  onRemotePlayerRemoved: (sessionId: string) => void;
  onCelebration: (snapshot: CelebrationSnapshot) => void;
}

function toNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Connection failed.";
  }
}

export class MultiplayerClient {
  private client: ColyseusClient;
  private room: Room | null = null;
  private connectionInfo: ConnectionInfo | null = null;

  constructor(serverUrl: string, private readonly callbacks: MultiplayerCallbacks) {
    this.client = new ColyseusClient(serverUrl);
  }

  isConnected(): boolean {
    return this.room !== null;
  }

  getConnectionInfo(): ConnectionInfo | null {
    return this.connectionInfo;
  }

  async connect(options: ConnectOptions): Promise<ConnectionInfo> {
    await this.leave();

    const firestoreGameId = options.firestoreGameId ?? options.inviteCode;
    const joinOptions = {
      mode: options.mode,
      firestoreGameId,
      inviteCode: options.inviteCode
    };

    try {
      this.room = options.roomId
        ? await this.client.joinById(options.roomId, joinOptions)
        : await this.client.joinOrCreate("island_room", joinOptions);
    } catch (error) {
      this.room = null;
      throw new Error(parseErrorMessage(error));
    }

    this.attachRoomListeners(this.room);
    const playerCount = this.getPlayerCountFromRoom(this.room);
    this.connectionInfo = {
      roomId: this.room.id,
      sessionId: this.room.sessionId,
      playerCount
    };
    this.callbacks.onConnected(this.connectionInfo);
    this.callbacks.onPlayerCountChanged(playerCount);
    return this.connectionInfo;
  }

  async leave(): Promise<void> {
    if (!this.room) {
      return;
    }
    const room = this.room;
    this.room = null;
    this.connectionInfo = null;
    await room.leave(true);
    this.callbacks.onDisconnected();
  }

  sendTransform(payload: { x: number; y: number; z: number; yaw: number; animState: "idle" | "moving" }): void {
    if (!this.room) {
      return;
    }
    this.room.send("player:update_transform", payload);
  }

  sendFishingState(fishingState: NetFishingState): void {
    if (!this.room) {
      return;
    }
    this.room.send("player:fishing_state", {
      fishingState
    });
  }

  sendCelebration(rarity: NetCelebrationRarity): void {
    if (!this.room) {
      return;
    }
    this.room.send("player:celebration", { rarity });
  }

  private attachRoomListeners(room: Room): void {
    const state = room.state as {
      players: {
        onAdd: (cb: (player: any, sessionId: string) => void) => void;
        onRemove: (cb: (_player: any, sessionId: string) => void) => void;
        forEach: (cb: (_player: any, sessionId: string) => void) => void;
      };
    };

    state.players.onAdd((player, sessionId) => {
      this.callbacks.onPlayerCountChanged(this.getPlayerCountFromRoom(room));
      this.callbacks.onRemotePlayerUpdate(this.toRemotePlayerSnapshot(player, sessionId));
      player.onChange(() => {
        this.callbacks.onRemotePlayerUpdate(this.toRemotePlayerSnapshot(player, sessionId));
      });
    });

    state.players.onRemove((_player, sessionId) => {
      this.callbacks.onPlayerCountChanged(this.getPlayerCountFromRoom(room));
      this.callbacks.onRemotePlayerRemoved(sessionId);
    });

    room.onLeave(() => {
      this.room = null;
      this.connectionInfo = null;
      this.callbacks.onDisconnected();
    });

    room.onMessage("player:celebration", (message: { sessionId?: string; rarity?: NetCelebrationRarity }) => {
      if (!message?.sessionId || !message.rarity) {
        return;
      }
      this.callbacks.onCelebration({
        sessionId: message.sessionId,
        rarity: message.rarity
      });
    });
  }

  private getPlayerCountFromRoom(room: Room): number {
    const state = room.state as { players: { forEach: (cb: (_player: any, sessionId: string) => void) => void } };
    let count = 0;
    state.players.forEach(() => {
      count += 1;
    });
    return count;
  }

  private toRemotePlayerSnapshot(player: any, sessionId: string): RemotePlayerSnapshot {
    return {
      sessionId,
      x: toNumber(player.x),
      y: toNumber(player.y),
      z: toNumber(player.z),
      yaw: toNumber(player.yaw),
      animState: player.animState === "moving" ? "moving" : "idle",
      fishingState: toNetFishingState(player.fishingState)
    };
  }
}

function toNetFishingState(value: unknown): NetFishingState {
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
