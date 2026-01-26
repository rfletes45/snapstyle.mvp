/**
 * Logging Utility
 *
 * Centralized logging helper with:
 * - Environment-aware logging (verbose in dev, minimal in prod)
 * - Structured log formatting
 * - Context tagging
 * - Safe sanitization (no secrets in logs)
 *
 * NO EXTERNAL DEPENDENCIES - vanilla console wrapper with enhancements
 */

// =============================================================================
// Types
// =============================================================================

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  /** Source/component name */
  source?: string;
  /** User ID (safe to log) */
  userId?: string;
  /** Operation being performed */
  operation?: string;
  /** Additional structured data */
  data?: Record<string, unknown>;
}

interface LogConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Whether to include timestamps */
  showTimestamp: boolean;
  /** Whether to include stack traces for errors */
  showStackTrace: boolean;
}

// =============================================================================
// Configuration
// =============================================================================

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_LEVEL_EMOJI: Record<LogLevel, string> = {
  debug: "🔍",
  info: "ℹ️",
  warn: "⚠️",
  error: "❌",
};

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m", // Cyan
  info: "\x1b[34m", // Blue
  warn: "\x1b[33m", // Yellow
  error: "\x1b[31m", // Red
};

const RESET_COLOR = "\x1b[0m";

// Default config based on environment
const defaultConfig: LogConfig = {
  minLevel: __DEV__ ? "debug" : "warn",
  showTimestamp: __DEV__,
  showStackTrace: __DEV__,
};

let currentConfig: LogConfig = { ...defaultConfig };

// =============================================================================
// Sanitization
// =============================================================================

/** Keys that should never be logged */
const SENSITIVE_KEYS = [
  "password",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "credential",
  "authToken",
  "auth_token",
  "privateKey",
  "private_key",
  "sessionToken",
  "session_token",
];

/**
 * Sanitize an object to remove sensitive data before logging
 */
function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    // Check if it looks like a JWT or token
    if (obj.startsWith("eyJ") || obj.length > 100) {
      return "[REDACTED]";
    }
    return obj;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitize(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// =============================================================================
// Formatting
// =============================================================================

/**
 * Format a log entry
 */
function formatLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
): string {
  const parts: string[] = [];

  // Timestamp
  if (currentConfig.showTimestamp) {
    const now = new Date();
    const timestamp = now.toISOString().split("T")[1].slice(0, -1);
    parts.push(`[${timestamp}]`);
  }

  // Level emoji
  parts.push(LOG_LEVEL_EMOJI[level]);

  // Source tag
  if (context?.source) {
    parts.push(`[${context.source}]`);
  }

  // Operation tag
  if (context?.operation) {
    parts.push(`(${context.operation})`);
  }

  // Message
  parts.push(message);

  return parts.join(" ");
}

// =============================================================================
// Core Logger
// =============================================================================

class Logger {
  private source?: string;

  constructor(source?: string) {
    this.source = source;
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return (
      LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentConfig.minLevel]
    );
  }

  /**
   * Output a log entry
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: unknown,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const fullContext: LogContext = {
      ...context,
      source: context?.source || this.source,
    };

    const formatted = formatLogEntry(level, message, fullContext);

    // Get the console method
    const consoleMethod =
      level === "debug"
        ? console.debug
        : level === "info"
          ? console.info
          : level === "warn"
            ? console.warn
            : console.error;

    // Build log arguments
    const logArgs: unknown[] = [formatted];

    // Add sanitized data if present
    if (fullContext.data) {
      logArgs.push("\n  Data:", sanitize(fullContext.data));
    }

    // Add error if present
    if (error) {
      if (error instanceof Error) {
        logArgs.push("\n  Error:", error.message);
        if (currentConfig.showStackTrace && error.stack) {
          logArgs.push("\n  Stack:", error.stack);
        }
      } else {
        logArgs.push("\n  Error:", sanitize(error));
      }
    }

    consoleMethod(...logArgs);
  }

  /**
   * Debug level log (dev only)
   */
  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  /**
   * Info level log
   */
  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  /**
   * Warning level log
   */
  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  /**
   * Error level log
   */
  error(message: string, error?: unknown, context?: LogContext): void {
    this.log("error", message, context, error);
  }

  /**
   * Create a child logger with a specific source
   */
  child(source: string): Logger {
    return new Logger(source);
  }
}

// =============================================================================
// Factory & Configuration
// =============================================================================

/**
 * Configure the logger
 */
export function configureLogger(config: Partial<LogConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Reset logger to default configuration
 */
export function resetLoggerConfig(): void {
  currentConfig = { ...defaultConfig };
}

/**
 * Create a logger instance with an optional source tag
 *
 * @example
 * ```typescript
 * const log = createLogger("ChatService");
 * log.info("Message sent", { operation: "sendMessage", data: { chatId } });
 * log.error("Failed to send", error, { operation: "sendMessage" });
 * ```
 */
export function createLogger(source?: string): Logger {
  return new Logger(source);
}

// =============================================================================
// Default Export (Global Logger)
// =============================================================================

/**
 * Global logger instance
 *
 * @example
 * ```typescript
 * import log from "@/utils/log";
 * log.info("App started");
 * log.error("Something failed", error, { source: "App" });
 * ```
 */
const globalLogger = new Logger();

export default globalLogger;

// =============================================================================
// Convenience Exports
// =============================================================================

export const log = {
  debug: globalLogger.debug.bind(globalLogger),
  info: globalLogger.info.bind(globalLogger),
  warn: globalLogger.warn.bind(globalLogger),
  error: globalLogger.error.bind(globalLogger),
  child: globalLogger.child.bind(globalLogger),
};

export type { LogConfig, LogContext, LogLevel };
