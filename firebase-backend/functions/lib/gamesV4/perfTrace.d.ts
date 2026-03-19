/**
 * Games V4 — Server-Side Performance Tracing
 *
 * Lightweight structured logging for latency-sensitive backend paths.
 * Always active (server logs are not user-facing) but minimal overhead.
 *
 * @module gamesV4/perfTrace
 */
interface ServerTrace {
    mark(label: string): void;
    end(): {
        totalMs: number;
        marks: Record<string, number>;
    };
}
export declare function startServerTrace(id: string, context?: string): ServerTrace;
export {};
