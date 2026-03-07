/**
 * Chess UI — Persisted Settings Hook
 *
 * Manages all chess-specific user preferences via AsyncStorage.
 * Settings persist across sessions and are cheap to read/write.
 *
 * @module gamesV4/screens/chess/useChessSettings
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

// =============================================================================
// Types
// =============================================================================

export type InputMode = "tap" | "drag";
export type HapticsLevel = "off" | "light" | "normal";
export type DisplayPreset = "minimal" | "standard" | "assisted";

export interface ChessSettings {
  /** Input mode: tap-to-move or drag-to-move */
  inputMode: InputMode;
  /** Confirm each move before committing */
  confirmMove: boolean;
  /** Allow queueing a move while waiting for opponent */
  queueMove: boolean;
  /** Show legal move indicators on piece select */
  showLegalMoves: boolean;
  /** Highlight the last move from/to squares */
  highlightLastMove: boolean;
  /** Highlight king square when in check */
  highlightCheck: boolean;
  /** Show coordinate labels (a-h, 1-8) */
  showCoordinates: boolean;
  /** Haptics intensity */
  haptics: HapticsLevel;
  /** Sound effects enabled */
  sounds: boolean;
  /** Board theme ID */
  boardTheme: string;
  /** Display preset (controls highlight density) */
  displayPreset: DisplayPreset;
  /** Reduced motion — disables animations */
  reducedMotion: boolean;
}

// =============================================================================
// Defaults
// =============================================================================

const DEFAULT_SETTINGS: ChessSettings = {
  inputMode: "tap",
  confirmMove: false,
  queueMove: true,
  showLegalMoves: true,
  highlightLastMove: true,
  highlightCheck: true,
  showCoordinates: true,
  haptics: "normal",
  sounds: true,
  boardTheme: "classic",
  displayPreset: "standard",
  reducedMotion: false,
};

const STORAGE_KEY = "@chess_settings_v1";

// =============================================================================
// Hook
// =============================================================================

export function useChessSettings() {
  const [settings, setSettings] = useState<ChessSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          // Merge with defaults to handle newly added keys
          setSettings((prev) => ({ ...prev, ...parsed }));
        }
      } catch {
        // Fail silently — use defaults
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Persist on change (debounce not needed — writes are fast)
  const updateSettings = useCallback((patch: Partial<ChessSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  /** Apply a display preset — sets related toggles */
  const applyPreset = useCallback(
    (preset: DisplayPreset) => {
      switch (preset) {
        case "minimal":
          updateSettings({
            displayPreset: preset,
            showLegalMoves: false,
            highlightLastMove: true,
            highlightCheck: false,
          });
          break;
        case "standard":
          updateSettings({
            displayPreset: preset,
            showLegalMoves: true,
            highlightLastMove: true,
            highlightCheck: true,
          });
          break;
        case "assisted":
          updateSettings({
            displayPreset: preset,
            showLegalMoves: true,
            highlightLastMove: true,
            highlightCheck: true,
          });
          break;
      }
    },
    [updateSettings],
  );

  return { settings, updateSettings, applyPreset, loaded };
}
