/**
 * useGameScores Hook
 *
 * Fetches and manages user game scores for profile display.
 * Supports both own profile and viewing other profiles.
 *
 * @module hooks/useGameScores
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  getGameScoresConfig,
  updateGameScoresConfig as persistGameScoresConfig,
} from "@/services/profileService";
import { getAllHighScores } from "@/services/singlePlayerSessions";
import { ExtendedGameType, GAME_METADATA } from "@/types/games";
import type {
  ProfileGameScore,
  ProfileGameScoresConfig,
} from "@/types/userProfile";

// =============================================================================
// Types
// =============================================================================

export interface UseGameScoresResult {
  /** All available high scores for the user */
  allScores: ProfileGameScore[];
  /** Configured scores to display (based on user preferences) */
  displayScores: ProfileGameScore[];
  /** Game scores configuration */
  config: ProfileGameScoresConfig;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Refresh the scores */
  refresh: () => Promise<void>;
  /** Update the configuration */
  updateConfig: (newConfig: ProfileGameScoresConfig) => Promise<void>;
}

export interface UseGameScoresOptions {
  /** User ID to fetch scores for */
  userId: string;
  /** Viewer ID for comparison (optional) */
  viewerId?: string;
  /** Whether to auto-fetch on mount */
  autoFetch?: boolean;
  /** Maximum scores to return */
  maxScores?: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getGameInfo(gameId: string): { name: string; icon: string } {
  const metadata = GAME_METADATA[gameId as ExtendedGameType];
  return {
    name: metadata?.shortName || metadata?.name || gameId,
    icon: metadata?.icon || "🎮",
  };
}

function convertToProfileGameScore(
  highScore: { gameType: string; highScore: number; achievedAt: number },
  order: number,
): ProfileGameScore {
  const info = getGameInfo(highScore.gameType);
  return {
    gameId: highScore.gameType,
    gameName: info.name,
    gameIcon: info.icon,
    score: highScore.highScore,
    achievedAt: highScore.achievedAt,
    displayOrder: order,
  };
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: ProfileGameScoresConfig = {
  enabled: true,
  displayedGames: [],
  updatedAt: Date.now(),
};

// =============================================================================
// Hook Implementation
// =============================================================================

export function useGameScores({
  userId,
  viewerId,
  autoFetch = true,
  maxScores = 5,
}: UseGameScoresOptions): UseGameScoresResult {
  const [allScores, setAllScores] = useState<ProfileGameScore[]>([]);
  const [config, setConfig] = useState<ProfileGameScoresConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const configLoadedRef = useRef(false);

  // Load saved config from Firestore
  const loadSavedConfig = useCallback(async () => {
    if (!userId) return;
    try {
      const savedConfig = await getGameScoresConfig(userId);
      if (savedConfig && savedConfig.displayedGames.length > 0) {
        setConfig(savedConfig);
        configLoadedRef.current = true;
      }
    } catch (err) {
      console.error("Failed to load game scores config:", err);
    }
  }, [userId]);

  // Fetch all high scores for the user
  const fetchScores = useCallback(async () => {
    if (!userId) {
      setAllScores([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const highScores = await getAllHighScores(userId);

      // Convert to ProfileGameScore format
      const profileScores = highScores
        .sort((a, b) => b.highScore - a.highScore) // Sort by score descending
        .map((score, index) => convertToProfileGameScore(score, index + 1));

      setAllScores(profileScores);

      // If no saved configuration was loaded, auto-select top scores
      if (!configLoadedRef.current && profileScores.length > 0) {
        setConfig((prev) => {
          if (prev.displayedGames.length > 0) return prev;
          return {
            ...prev,
            displayedGames: profileScores.slice(0, maxScores),
          };
        });
      }
    } catch (err) {
      console.error("Failed to fetch game scores:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to fetch scores"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId, maxScores]);

  // Auto-fetch on mount: load config first, then scores
  useEffect(() => {
    if (autoFetch && userId) {
      loadSavedConfig().then(() => fetchScores());
    }
  }, [autoFetch, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh function
  const refresh = useCallback(async () => {
    await loadSavedConfig();
    await fetchScores();
  }, [loadSavedConfig, fetchScores]);

  // Update configuration — persists to Firestore
  const updateConfig = useCallback(
    async (newConfig: ProfileGameScoresConfig) => {
      setConfig(newConfig);
      configLoadedRef.current = true;

      // Persist to Firestore
      if (userId) {
        try {
          await persistGameScoresConfig(userId, newConfig);
        } catch (err) {
          console.error("Failed to persist game scores config:", err);
          // Still keep the local state update even if Firestore fails
        }
      }
    },
    [userId],
  );

  // Calculate display scores based on configuration
  const displayScores =
    config.displayedGames.length > 0
      ? config.displayedGames.slice(0, maxScores)
      : allScores.slice(0, maxScores);

  return {
    allScores,
    displayScores,
    config,
    isLoading,
    error,
    refresh,
    updateConfig,
  };
}

// =============================================================================
// Comparison Hook
// =============================================================================

export interface UseScoreComparisonResult {
  /** Owner's scores */
  ownerScores: ProfileGameScore[];
  /** Viewer's scores */
  viewerScores: ProfileGameScore[];
  /** Whether data is loading */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Refresh all scores */
  refresh: () => Promise<void>;
}

export interface UseScoreComparisonOptions {
  /** Profile owner's user ID */
  ownerId: string;
  /** Viewer's user ID */
  viewerId: string;
  /** Whether to auto-fetch on mount */
  autoFetch?: boolean;
}

export function useScoreComparison({
  ownerId,
  viewerId,
  autoFetch = true,
}: UseScoreComparisonOptions): UseScoreComparisonResult {
  const [ownerScores, setOwnerScores] = useState<ProfileGameScore[]>([]);
  const [viewerScores, setViewerScores] = useState<ProfileGameScore[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAllScores = useCallback(async () => {
    if (!ownerId || !viewerId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch both user's scores in parallel
      const [ownerHighScores, viewerHighScores] = await Promise.all([
        getAllHighScores(ownerId),
        getAllHighScores(viewerId),
      ]);

      // Convert to ProfileGameScore format
      const ownerProfileScores = ownerHighScores
        .sort((a, b) => b.highScore - a.highScore)
        .map((score, index) => convertToProfileGameScore(score, index + 1));

      const viewerProfileScores = viewerHighScores
        .sort((a, b) => b.highScore - a.highScore)
        .map((score, index) => convertToProfileGameScore(score, index + 1));

      setOwnerScores(ownerProfileScores);
      setViewerScores(viewerProfileScores);
    } catch (err) {
      console.error("Failed to fetch comparison scores:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to fetch scores"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [ownerId, viewerId]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && ownerId && viewerId) {
      fetchAllScores();
    }
  }, [autoFetch, ownerId, viewerId, fetchAllScores]);

  // Refresh function
  const refresh = useCallback(async () => {
    await fetchAllScores();
  }, [fetchAllScores]);

  return {
    ownerScores,
    viewerScores,
    isLoading,
    error,
    refresh,
  };
}

export default useGameScores;
