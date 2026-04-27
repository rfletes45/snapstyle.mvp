import { createLogger } from "@/utils/log";

const log = createLogger("startupTrace");

const startupSessionId = `${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;

const mountCounts = new Map<string, number>();

export function getStartupSessionId(): string {
  return startupSessionId;
}

export function logStartupEvent(
  event: string,
  data?: Record<string, unknown>,
): void {
  log.info(event, {
    data: {
      startupSessionId,
      ...(data ?? {}),
    },
  });
}

export function logStartupWarning(
  event: string,
  data?: Record<string, unknown>,
): void {
  log.warn(event, {
    data: {
      startupSessionId,
      ...(data ?? {}),
    },
  });
}

export function logStartupError(
  event: string,
  error: unknown,
  data?: Record<string, unknown>,
): void {
  log.error(event, error, {
    data: {
      startupSessionId,
      ...(data ?? {}),
    },
  });
}

export function logStartupMount(
  scope: string,
  data?: Record<string, unknown>,
): number {
  const mountCount = (mountCounts.get(scope) ?? 0) + 1;
  mountCounts.set(scope, mountCount);

  logStartupEvent(`${scope}:mount`, {
    mountCount,
    ...(data ?? {}),
  });

  return mountCount;
}

export function logStartupUnmount(
  scope: string,
  data?: Record<string, unknown>,
): void {
  logStartupEvent(`${scope}:unmount`, data);
}
