/**
 * Last Open Chat Persistence
 *
 * Persists which chat the user was viewing when the app was backgrounded/closed.
 * On next app launch, if a valid chat was open, navigates directly to it.
 *
 * @module services/lastOpenChat
 */

import { createLogger } from "@/utils/log";
import AsyncStorage from "@react-native-async-storage/async-storage";

const log = createLogger("services/lastOpenChat");

const STORAGE_KEY = "@lastOpenChat";

export interface LastOpenChatState {
  /** Screen name: "ChatDetail" | "GroupChat" */
  screen: "ChatDetail" | "GroupChat";
  /** Route params for the screen */
  params: Record<string, unknown>;
  /** Timestamp when this was saved */
  savedAt: number;
}

/** Maximum age before we discard stale last-open state (24 hours) */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Save the currently open chat route.
 * Called when a chat screen gains focus.
 */
export async function saveLastOpenChat(
  screen: LastOpenChatState["screen"],
  params: Record<string, unknown>,
): Promise<void> {
  try {
    const state: LastOpenChatState = { screen, params, savedAt: Date.now() };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    log.warn("Failed to save last open chat:", e);
  }
}

/**
 * Clear the last-open-chat state.
 * Called when the user navigates away from a chat screen.
 */
export async function clearLastOpenChat(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    log.warn("Failed to clear last open chat:", e);
  }
}

/**
 * Read and validate the persisted last-open-chat state.
 * Returns null if none exists, expired, or invalid.
 */
export async function getLastOpenChat(): Promise<LastOpenChatState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const state: LastOpenChatState = JSON.parse(raw);

    // Validate shape
    if (!state.screen || !state.params || !state.savedAt) return null;

    // Check expiry
    if (Date.now() - state.savedAt > MAX_AGE_MS) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }

    // Validate screen name
    if (state.screen !== "ChatDetail" && state.screen !== "GroupChat") {
      return null;
    }

    return state;
  } catch (e) {
    log.warn("Failed to read last open chat:", e);
    return null;
  }
}
