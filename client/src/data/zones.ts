import type { ZoneId } from "../game/types";

export interface ZoneBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface ZonePoint {
  x: number;
  z: number;
}

export interface ZoneConnectionPoint extends ZonePoint {
  id: string;
  label: string;
  targetZoneId: ZoneId;
}

export interface ZonePoiPoint extends ZonePoint {
  id: string;
  label: string;
}

export interface ZoneDefinition {
  id: ZoneId;
  name: string;
  bestiaryTarget: number;
  bounds?: ZoneBounds;
  connectPoints?: ZoneConnectionPoint[];
  poiPoints?: ZonePoiPoint[];
}

export const ZONE_DEFINITIONS: ZoneDefinition[] = [
  {
    id: "beach",
    name: "Beach",
    bestiaryTarget: 17,
    bounds: { minX: -46, maxX: 24, minZ: -30, maxZ: 50 },
    connectPoints: [
      {
        id: "beach_to_river",
        label: "River Path",
        targetZoneId: "river",
        x: 21,
        z: 38.8,
      },
      {
        id: "beach_to_cave_hint",
        label: "Cave Trail",
        targetZoneId: "cave",
        x: 12.2,
        z: 46.6,
      },
      {
        id: "beach_to_volcano_hint",
        label: "Volcano",
        targetZoneId: "volcano",
        x: 21.6,
        z: 47.8,
      },
    ],
    poiPoints: [
      { id: "beach_fishing_spot", label: "Pier Edge Spot", x: 2.2, z: 21.8 },
      { id: "beach_reef_fishing_spot", label: "Reef Shore Spot", x: 13.2, z: 4.2 },
      { id: "beach_sell_stand", label: "Sell Stand", x: -6.4, z: 18 },
      { id: "beach_rod_shop", label: "Rod Shop", x: -21.8, z: 44.1 },
      { id: "beach_bait_shop", label: "Bait Shop", x: -12, z: 44.1 },
    ],
  },
  {
    id: "river",
    name: "River",
    bestiaryTarget: 17,
    bounds: { minX: 24, maxX: 84, minZ: -22, maxZ: 44 },
    connectPoints: [
      {
        id: "river_to_beach",
        label: "Back To Beach",
        targetZoneId: "beach",
        x: 27.2,
        z: 34.4,
      },
      {
        id: "river_to_cave_hint",
        label: "Cave Direction",
        targetZoneId: "cave",
        x: 74.5,
        z: 24.7,
      },
      {
        id: "river_to_volcano_hint",
        label: "Volcano Direction",
        targetZoneId: "volcano",
        x: 68.8,
        z: 33.1,
      },
    ],
    poiPoints: [
      { id: "river_sell_stand", label: "Sell Stand", x: 49.2, z: 21.6 },
      { id: "river_ranger", label: "River Ranger", x: 36.4, z: 19.4 },
      { id: "river_fishing_spot", label: "Waterfall Pool Spot", x: 63.6, z: 6.7 },
      { id: "river_challenge_start", label: "Challenge Trail", x: 39.8, z: -2.3 },
    ],
  },
];

export const PLAYABLE_PHASE2_ZONES: ZoneId[] = ["beach", "river"];
export const PLAYABLE_PHASE3_ZONES: ZoneId[] = ["beach", "river"];
export const PLAYABLE_PHASE4_ZONES: ZoneId[] = ["beach", "river"];
