"use strict";
/**
 * Games V4 — Server-Side Performance Tracing
 *
 * Lightweight structured logging for latency-sensitive backend paths.
 * Always active (server logs are not user-facing) but minimal overhead.
 *
 * @module gamesV4/perfTrace
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServerTrace = startServerTrace;
const TAG = "[perfTrace]";
function startServerTrace(id, context) {
    const startTs = Date.now();
    const marks = [];
    return {
        mark(label) {
            marks.push({ label, elapsed: Date.now() - startTs });
        },
        end() {
            const totalMs = Date.now() - startTs;
            const markMap = {};
            for (const m of marks)
                markMap[m.label] = m.elapsed;
            const milestones = marks
                .map((m) => `${m.label}=+${m.elapsed}ms`)
                .join(", ");
            console.log(`${TAG} ${id}${context ? ` (${context})` : ""} total=${totalMs}ms [${milestones}]`);
            return { totalMs, marks: markMap };
        },
    };
}
//# sourceMappingURL=perfTrace.js.map