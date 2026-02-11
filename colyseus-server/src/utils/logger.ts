/**
 * Simple structured logger for Colyseus server.
 * Keeps call sites close to console semantics while tagging output by source.
 */
export function createServerLogger(source: string) {
  const tag = `[${source}]`;

  return {
    info: (message: string, ...meta: unknown[]) => {
      console.log(tag, message, ...meta);
    },
    warn: (message: string, ...meta: unknown[]) => {
      console.warn(tag, message, ...meta);
    },
    error: (message: string, ...meta: unknown[]) => {
      console.error(tag, message, ...meta);
    },
    debug: (message: string, ...meta: unknown[]) => {
      if (process.env.NODE_ENV !== "production") {
        console.log(tag, "[DEBUG]", message, ...meta);
      }
    },
  };
}
