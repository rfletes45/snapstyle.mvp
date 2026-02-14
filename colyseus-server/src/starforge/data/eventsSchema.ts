/**
 * TypeScript types for events.v1.json.
 * Pure data — no DOM / Three.js.
 */
import type { ResourceKey } from "../sim/types";

// ─── Event effect variants ──────────────────────────────────

export interface ResourceBurstEffect {
  t: "RESOURCE_BURST";
  key: ResourceKey;
  amountMicro: number;
}

export interface ProdBoostEffect {
  t: "PROD_BOOST";
  /** Multiplicative bonus to all production for durationTicks. */
  mult: number;
  durationTicks: number;
}

export interface CapBoostEffect {
  t: "CAP_BOOST";
  key: ResourceKey;
  amountMicro: number;
  durationTicks: number;
}

export type EventEffect =
  | ResourceBurstEffect
  | ProdBoostEffect
  | CapBoostEffect;

// ─── Event trigger type ─────────────────────────────────────

export type EventTrigger =
  | "TAP" // Player must tap the floating orb
  | "AUTO"; // Applies automatically when spawned

// ─── Event definition ───────────────────────────────────────

export interface EventDef {
  id: string;
  title: string;
  desc: string;
  /** How the player activates this event. */
  trigger: EventTrigger;
  /** Effects applied when triggered. */
  effects: EventEffect[];
  /** VFX hint for the renderer. */
  vfxHint: "spark" | "pulse" | "ring" | "star";
  /** Weight for random selection (higher = more common). */
  weight: number;
}

export interface EventsCatalog {
  schemaVersion: "starforge.events.v1";
  events: EventDef[];
}
