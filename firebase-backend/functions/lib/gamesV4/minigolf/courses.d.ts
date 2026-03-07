/**
 * Mini Golf — Server-side Course Pack (duplicated for parity)
 *
 * MUST remain in sync with src/gamesV4/games/miniGolf/courses/pigeonClassic.ts
 * The hole geometry is identical to ensure deterministic simulation.
 */
import type { CoursePackDef } from "./types";
export declare const PIGEON_CLASSIC: CoursePackDef;
export declare function getCoursePack(id: string): CoursePackDef | null;
export declare function getTotalPar(pack: CoursePackDef, holeCount: number): number;
