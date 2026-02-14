export type NetAnimState = "idle" | "moving";

export type NetFishingState =
  | "idle"
  | "casting"
  | "waiting"
  | "caught"
  | "fail";

export type NetCelebrationRarity = "epic" | "mythic";

export interface RemotePlayerSnapshot {
  sessionId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  animState: NetAnimState;
  fishingState: NetFishingState;
}

export interface ConnectionInfo {
  roomId: string;
  sessionId: string;
  playerCount: number;
}

export interface CelebrationSnapshot {
  sessionId: string;
  rarity: NetCelebrationRarity;
}
