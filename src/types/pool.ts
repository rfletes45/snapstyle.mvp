/**
 * Core type definitions for 8-ball pool.
 *
 * These types are intentionally lean and shared by the pool engine,
 * UI screen, and tests.
 */

export type BallType = "cue" | "solid" | "stripe" | "eight";
export type BallGroup = "solids" | "stripes";

export type GamePhase =
  | "menu"
  | "break"
  | "playing"
  | "ball-in-hand"
  | "shooting-eight"
  | "animating"
  | "game-over";

export type FoulType =
  | "scratch"
  | "no_contact"
  | "wrong_ball_first"
  | "no_rail"
  | "early_eight";

export interface PlayerState {
  group: BallGroup | null;
  remaining: number;
  fouls: number;
}

export function getBallType(id: number): BallType {
  if (id === 0) return "cue";
  if (id === 8) return "eight";
  if (id >= 1 && id <= 7) return "solid";
  return "stripe";
}

export function getBallColor(id: number): string {
  const colors: Record<number, string> = {
    0: "#F7F7F7",
    1: "#F4C531",
    2: "#2E67D1",
    3: "#C6332B",
    4: "#6A3FA4",
    5: "#D97B1F",
    6: "#2F8C52",
    7: "#7B1D1D",
    8: "#101010",
    9: "#F4C531",
    10: "#2E67D1",
    11: "#C6332B",
    12: "#6A3FA4",
    13: "#D97B1F",
    14: "#2F8C52",
    15: "#7B1D1D",
  };

  return colors[id] ?? "#999999";
}

export function getBallNumber(id: number): number {
  return Math.max(0, Math.min(15, Math.trunc(id)));
}

export function groupToBallType(group: BallGroup): Exclude<BallType, "cue" | "eight"> {
  return group === "solids" ? "solid" : "stripe";
}

export function oppositeGroup(group: BallGroup): BallGroup {
  return group === "solids" ? "stripes" : "solids";
}

