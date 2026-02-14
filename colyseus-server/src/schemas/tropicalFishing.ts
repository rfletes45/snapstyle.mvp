import { MapSchema, Schema, type } from "@colyseus/schema";

export class TropicalFishingPlayerState extends Schema {
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
  @type("float32") z: number = 0;
  @type("float32") yaw: number = 0;
  @type("string") animState: string = "idle";
  @type("string") fishingState: string = "idle";
}

export class TropicalFishingState extends Schema {
  @type({ map: TropicalFishingPlayerState })
  players = new MapSchema<TropicalFishingPlayerState>();
}
