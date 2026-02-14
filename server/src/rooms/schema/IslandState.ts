import { MapSchema, Schema, type } from "@colyseus/schema";

export class NetworkPlayerState extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;
  @type("number") yaw = 0;
  @type("string") animState = "idle";
  @type("string") fishingState = "idle";
}

export class IslandRoomState extends Schema {
  @type({ map: NetworkPlayerState }) players = new MapSchema<NetworkPlayerState>();
}
