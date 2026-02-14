/**
 * Minimal Colyseus Schema for the StarforgeRoom.
 * Only tracks player metadata — the full SimState is broadcast as messages.
 */
import { MapSchema, Schema, type } from "@colyseus/schema";

export class PlayerData extends Schema {
  @type("string") role: string = "player";
  @type("string") name: string = "";
}

export class StarforgeRoomState extends Schema {
  @type({ map: PlayerData }) players = new MapSchema<PlayerData>();
}
