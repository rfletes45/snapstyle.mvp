import * as THREE from "three";
import type { BoxCollider, WorldBounds } from "../collision";
import type { ZoneId } from "../../game/types";

export type InteractableType =
  | "fishing_spot"
  | "sell_stand"
  | "rod_shop"
  | "bait_shop"
  | "gate"
  | "zone_rod_pickup"
  | "challenge_start"
  | "quest_board"
  | "npc_hint"
  | "puzzle_pillar"
  | "relic_pickup";

export type InteractableLabel =
  | "FISH"
  | "SELL"
  | "SHOP"
  | "VIEW"
  | "QUEST"
  | "TALK"
  | "START"
  | "PICKUP"
  | "ROTATE";

export interface Interactable {
  id: string;
  type: InteractableType;
  label: InteractableLabel;
  position: THREE.Vector3;
  radius: number;
  title: string;
  zoneId?: ZoneId;
}

export interface ZoneRegion {
  zoneId: ZoneId;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface MovingPlatformRef {
  mesh: THREE.Mesh;
  axis: "x" | "z";
  base: number;
  amplitude: number;
  speed: number;
  phase: number;
}

export interface WorldBuildResult {
  spawnPosition: THREE.Vector3;
  colliders: BoxCollider[];
  worldBounds: WorldBounds;
  getGroundHeight: (x: number, z: number, currentY?: number) => number;
  interactables: Interactable[];
  zoneRegions: ZoneRegion[];
  volcanoGateDoor: THREE.Mesh;
  volcanoGateSign: THREE.Mesh;
  oasisGateDoor: THREE.Mesh;
  oasisGateEmblems: Record<"beach" | "river" | "cave" | "volcano", THREE.Mesh>;
  cavePuzzleDoor: THREE.Mesh;
  puzzlePillars: Record<string, THREE.Mesh>;
  oasisFinalDoor: THREE.Mesh;
  oasisChallengePlates: Record<"oasis_plate_a" | "oasis_plate_b" | "oasis_plate_c", THREE.Mesh>;
  movingPlatforms: MovingPlatformRef[];
  volcanoGateCollider: BoxCollider;
  oasisGateCollider: BoxCollider;
  oasisFinalDoorCollider: BoxCollider;
}
