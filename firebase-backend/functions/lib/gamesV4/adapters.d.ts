/**
 * Games V4 — Backend Adapter System
 *
 * Self-contained adapter framework for the Cloud Functions environment.
 * Contains:
 * - Adapter interface (mirrors client types)
 * - Registry (register/query)
 * - Game runner (validate, apply, outcome)
 * - Pilot adapters (tic_tac_toe, connect_four, play_2048)
 *
 * @module gamesV4/adapters
 */
import type { GameId } from "./types";
export interface MoveValidationResult {
    ok: boolean;
    error?: string;
    nextPublicState?: Record<string, unknown>;
    nextPrivateState?: Record<string, Record<string, unknown>>;
    scoreDelta?: Array<{
        uid: string;
        delta: number;
    }>;
    turnAdvance?: boolean;
    nextTurnPlayerId?: string;
    terminal?: {
        type: "win" | "draw" | "timeout";
        winnerIds?: string[];
        reason?: string;
    };
}
export interface GameOutcome {
    winnerIds: string[];
    finalScoreboard: Array<{
        uid: string;
        score: number;
        placement: number;
        stats: Record<string, unknown>;
    }>;
}
export interface GameAdapterV4 {
    gameId: GameId;
    runtimeType: "solo" | "turnBased" | "realtime";
    maxPlayers: number;
    minPlayers: number;
    defaultSettings: Record<string, unknown>;
    createInitialPublicState(players: Array<{
        uid: string;
        slotIndex: number;
    }>, settings: Record<string, unknown>): Record<string, unknown>;
    createInitialPrivateState?(players: Array<{
        uid: string;
        slotIndex: number;
    }>, settings: Record<string, unknown>): Record<string, Record<string, unknown>>;
    validateMove?(publicState: Record<string, unknown>, privateStateByPlayer: Record<string, Record<string, unknown>>, movePayload: Record<string, unknown>, ctx: {
        uid: string;
        turnOrder: string[];
        currentTurnIndex: number;
        settings: Record<string, unknown>;
    }): MoveValidationResult;
    computeOutcome?(publicState: Record<string, unknown>, players: Array<{
        uid: string;
        slotIndex: number;
    }>): GameOutcome;
    extractPerformanceMetrics?(publicState: Record<string, unknown>, players: Array<{
        uid: string;
    }>): Record<string, unknown>;
    validateSettings?(patch: Record<string, unknown>): Record<string, unknown>;
}
export declare function serializeStateForFirestore(state: Record<string, unknown>): Record<string, unknown>;
export declare function deserializeStateFromFirestore(state: Record<string, unknown>): Record<string, unknown>;
export declare function registerAdapter(adapter: GameAdapterV4): void;
export declare function getAdapter(gameId: GameId): GameAdapterV4 | null;
export declare function requireAdapter(gameId: GameId): GameAdapterV4;
export declare function hasAdapter(gameId: GameId): boolean;
export interface RunMoveInput {
    gameId: GameId;
    publicState: Record<string, unknown>;
    privateStateByPlayer: Record<string, Record<string, unknown>>;
    movePayload: Record<string, unknown>;
    uid: string;
    turnOrder: string[];
    currentTurnIndex: number;
    settings: Record<string, unknown>;
}
export interface RunMoveResult {
    valid: boolean;
    error?: string;
    nextPublicState: Record<string, unknown>;
    nextPrivateState: Record<string, Record<string, unknown>>;
    scoreDelta: Array<{
        uid: string;
        delta: number;
    }>;
    turnAdvance: boolean;
    nextTurnPlayerId?: string;
    terminal: MoveValidationResult["terminal"];
}
export declare function createInitialState(gameId: GameId, players: Array<{
    uid: string;
    slotIndex: number;
}>, settings: Record<string, unknown>): {
    publicState: Record<string, unknown>;
    privateStateByPlayer: Record<string, Record<string, unknown>>;
};
export declare function runMove(input: RunMoveInput): RunMoveResult;
export declare function computeOutcome(gameId: GameId, publicState: Record<string, unknown>, players: Array<{
    uid: string;
    slotIndex: number;
}>, fallbackWinnerIds?: string[]): GameOutcome;
export declare function extractPerformanceMetrics(gameId: GameId, publicState: Record<string, unknown>, players: Array<{
    uid: string;
}>): Record<string, unknown>;
