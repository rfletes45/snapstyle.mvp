import { createLogger } from "@/utils/log";
const logger = createLogger("services/calls/backgroundCallHandler.web");
/**
 * Background Call Handler - Web Stub
 * This is a no-op stub for web platform.
 */

export function initializeBackgroundCallHandler(): void {
  logger.warn("[backgroundCallHandler] Not available on web");
}

export function initializeAppStateListener(): void {
  // No-op on web
}

export function createCallNotificationChannel(): void {
  // No-op on web
}
