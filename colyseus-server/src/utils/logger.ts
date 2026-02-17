/**
 * Structured Logger for Colyseus Game Server
 *
 * Produces JSON logs in production and human-readable logs in dev.
 * Every log entry carries a `source` tag and optional correlation context
 * (traceId, firestoreGameId, gameType, uid) for end-to-end observability.
 *
 * Usage:
 *   const log = createServerLogger("TurnBasedRoom");
 *   log.info("Player joined", { uid: "abc", traceId: "gs_123" });
 *   const scoped = log.child({ firestoreGameId: "xyz", traceId: "gs_1" });
 *   scoped.info("Game started");       // carries firestoreGameId + traceId
 *
 * @see docs/GAME_SYSTEM_REFERENCE.md §3 (Server Architecture)
 */

// =============================================================================
// Types
// =============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Contextual fields threaded through every log line. */
export interface LogContext {
  traceId?: string;
  firestoreGameId?: string;
  gameType?: string;
  uid?: string;
  sessionId?: string;
  roomId?: string;
  [key: string]: unknown;
}

export interface ServerLogger {
  info(message: string, ctx?: LogContext | unknown): void;
  warn(message: string, ctx?: LogContext | unknown): void;
  error(message: string, ctx?: LogContext | unknown): void;
  debug(message: string, ctx?: LogContext | unknown): void;
  /** Create a child logger with merged context — every call inherits these fields */
  child(ctx: LogContext): ServerLogger;
}

// =============================================================================
// Configuration
// =============================================================================

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "debug";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[LOG_LEVEL];
}

// =============================================================================
// Formatting
// =============================================================================

function formatJson(
  level: LogLevel,
  source: string,
  message: string,
  ctx: LogContext,
): string {
  return JSON.stringify({
    ts: new Date().toISOString(),
    level,
    source,
    msg: message,
    ...ctx,
  });
}

function formatDev(
  level: LogLevel,
  source: string,
  message: string,
  ctx: LogContext,
): string {
  const ctxEntries = Object.entries(ctx);
  const ctxStr =
    ctxEntries.length > 0
      ? " " + ctxEntries.map(([k, v]) => `${k}=${v}`).join(" ")
      : "";
  return `[${source}] ${message}${ctxStr}`;
}

const format = IS_PRODUCTION ? formatJson : formatDev;

// =============================================================================
// Logger Factory
// =============================================================================

function buildLogger(source: string, baseCtx: LogContext): ServerLogger {
  const emit = (
    level: LogLevel,
    message: string,
    ctxOrError?: LogContext | unknown,
  ) => {
    if (!shouldLog(level)) return;

    // Normalise second argument: accept LogContext, Error, or any extra value.
    let extra: LogContext;
    if (
      ctxOrError instanceof Error ||
      (ctxOrError !== null &&
        ctxOrError !== undefined &&
        typeof ctxOrError !== "object")
    ) {
      extra = {
        error:
          ctxOrError instanceof Error ? ctxOrError.message : String(ctxOrError),
      };
    } else {
      extra = (ctxOrError as LogContext) ?? {};
    }

    const mergedCtx = { ...baseCtx, ...extra };
    const line = format(level, source, message, mergedCtx);
    switch (level) {
      case "error":
        console.error(line);
        break;
      case "warn":
        console.warn(line);
        break;
      default:
        console.log(line);
        break;
    }
  };

  return {
    info: (msg, ctx?) => emit("info", msg, ctx),
    warn: (msg, ctx?) => emit("warn", msg, ctx),
    error: (msg, ctx?) => emit("error", msg, ctx),
    debug: (msg, ctx?) => emit("debug", msg, ctx),
    child: (ctx: LogContext) => buildLogger(source, { ...baseCtx, ...ctx }),
  };
}

/**
 * Create a server logger tagged by source module.
 *
 * @param source - Module/class tag (e.g. "TurnBasedRoom", "persistence")
 */
export function createServerLogger(source: string): ServerLogger {
  return buildLogger(source, {});
}
