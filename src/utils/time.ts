/**
 * Time Formatting Utilities
 *
 * Consolidated time/duration formatting functions.
 * Use these instead of defining local formatDuration/formatTime functions.
 *
 * @module utils/time
 */

// =============================================================================
// Seconds-based formatters
// =============================================================================

/**
 * Format seconds into "M:SS" (e.g., "1:05", "0:30").
 * Does not zero-pad minutes.
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string like "1:05"
 */
export function formatDurationSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format seconds into "MM:SS" with zero-padded minutes (e.g., "01:05", "00:30").
 * Used for call duration displays.
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string like "01:05"
 */
export function formatDurationSecondsPadded(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format seconds into "M:SS" or "H:MM:SS" depending on duration.
 * Handles null/zero gracefully.
 *
 * @param seconds - Duration in seconds (nullable)
 * @returns Formatted string like "1:05" or "1:01:01"
 */
export function formatDurationFull(seconds: number | null): string {
  if (seconds === null || seconds === 0) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

// =============================================================================
// Milliseconds-based formatters
// =============================================================================

/**
 * Format milliseconds into "M:SS" (e.g., "1:05", "0:30").
 * Clamps to >= 0.
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string like "1:05"
 */
export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
