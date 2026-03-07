/**
 * Mini Golf — Server-side Physics Simulation (duplicated for parity)
 *
 * MUST remain in sync with src/gamesV4/games/miniGolf/physics/sim.ts
 * Uses identical constants, fixed timestep, quantization.
 */
import type { HoleDef, SimulationResult, Vec2 } from "./types";
export declare function simulateShot(hole: HoleDef, startPos: Vec2, angleQ: number, powerQ: number): SimulationResult;
