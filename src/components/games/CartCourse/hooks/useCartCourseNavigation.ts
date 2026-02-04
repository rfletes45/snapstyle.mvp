/**
 * Cart Course Navigation Hook
 *
 * Provides navigation integration for Cart Course game.
 * Handles screen transitions, deep linking, and game state management.
 */

import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, BackHandler } from "react-native";

// ============================================
// Navigation Types
// ============================================

export type CartCourseRouteParams = {
  CartCourseGame: {
    courseId?: string;
    modeId?: string;
    skinId?: string;
    fromDeepLink?: boolean;
  };
  CartCourseLobby: undefined;
  CartCourseResults: {
    courseId: string;
    score: number;
    time: number;
    stars: number;
    isNewRecord: boolean;
    bananasCollected: number;
    totalBananas: number;
  };
  CartCourseLeaderboard: {
    courseId: string;
    tab?: "global" | "friends";
  };
  CartCourseStamps: undefined;
  CartCourseSkins: undefined;
  CartCourseModes: undefined;
  CartCourseTutorial: {
    step?: number;
  };
};

export type CartCourseNavigationProp = NativeStackNavigationProp<
  CartCourseRouteParams,
  keyof CartCourseRouteParams
>;

// ============================================
// Game Session State
// ============================================

export interface GameSessionState {
  isPlaying: boolean;
  isPaused: boolean;
  courseId: string | null;
  modeId: string;
  skinId: string;
  startTime: number | null;
  pauseTime: number | null;
  totalPausedTime: number;
}

// ============================================
// useCartCourseNavigation Hook
// ============================================

export interface UseCartCourseNavigationResult {
  // Navigation actions
  goToLobby: () => void;
  goToGame: (courseId: string, modeId?: string, skinId?: string) => void;
  goToResults: (params: CartCourseRouteParams["CartCourseResults"]) => void;
  goToLeaderboard: (courseId: string, tab?: "global" | "friends") => void;
  goToStamps: () => void;
  goToSkins: () => void;
  goToModes: () => void;
  goToTutorial: (step?: number) => void;
  goBack: () => void;

  // Game session management
  startSession: (courseId: string, modeId?: string, skinId?: string) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => void;

  // Session state
  sessionState: GameSessionState;

  // Route params
  routeParams: CartCourseRouteParams["CartCourseGame"] | undefined;
}

/**
 * Hook for Cart Course navigation and session management
 */
export function useCartCourseNavigation(): UseCartCourseNavigationResult {
  const navigation = useNavigation<CartCourseNavigationProp>();
  const route = useRoute<RouteProp<CartCourseRouteParams, "CartCourseGame">>();

  const [sessionState, setSessionState] = useState<GameSessionState>({
    isPlaying: false,
    isPaused: false,
    courseId: null,
    modeId: "mode_standard",
    skinId: "skin_default",
    startTime: null,
    pauseTime: null,
    totalPausedTime: 0,
  });

  const pauseStartRef = useRef<number | null>(null);

  // Handle hardware back button during gameplay
  useEffect(() => {
    const handleBackPress = () => {
      if (sessionState.isPlaying && !sessionState.isPaused) {
        // Pause the game instead of going back
        pauseSession();
        return true; // Prevent default back behavior
      }
      return false; // Allow default back behavior
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress,
    );

    return () => subscription.remove();
  }, [sessionState.isPlaying, sessionState.isPaused]);

  // Navigation actions
  const goToLobby = useCallback(() => {
    navigation.navigate("CartCourseLobby" as never);
  }, [navigation]);

  const goToGame = useCallback(
    (courseId: string, modeId?: string, skinId?: string) => {
      (navigation as any).navigate("CartCourseGame", {
        courseId,
        modeId: modeId ?? "mode_standard",
        skinId: skinId ?? "skin_default",
      });
    },
    [navigation],
  );

  const goToResults = useCallback(
    (params: CartCourseRouteParams["CartCourseResults"]) => {
      (navigation as any).navigate("CartCourseResults", params);
    },
    [navigation],
  );

  const goToLeaderboard = useCallback(
    (courseId: string, tab?: "global" | "friends") => {
      (navigation as any).navigate("CartCourseLeaderboard", {
        courseId,
        tab: tab ?? "global",
      });
    },
    [navigation],
  );

  const goToStamps = useCallback(() => {
    navigation.navigate("CartCourseStamps" as never);
  }, [navigation]);

  const goToSkins = useCallback(() => {
    (navigation as any).navigate("CartCourseSkins");
  }, [navigation]);

  const goToModes = useCallback(() => {
    (navigation as any).navigate("CartCourseModes");
  }, [navigation]);

  const goToTutorial = useCallback(
    (step?: number) => {
      (navigation as any).navigate("CartCourseTutorial", { step });
    },
    [navigation],
  );

  const goBack = useCallback(() => {
    if (sessionState.isPlaying) {
      // Confirm before leaving active game
      Alert.alert("Leave Game?", "Your progress will be lost. Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => {
            endSession();
            navigation.goBack();
          },
        },
      ]);
    } else {
      navigation.goBack();
    }
  }, [navigation, sessionState.isPlaying]);

  // Session management
  const startSession = useCallback(
    (courseId: string, modeId?: string, skinId?: string) => {
      setSessionState({
        isPlaying: true,
        isPaused: false,
        courseId,
        modeId: modeId ?? "mode_standard",
        skinId: skinId ?? "skin_default",
        startTime: Date.now(),
        pauseTime: null,
        totalPausedTime: 0,
      });
    },
    [],
  );

  const pauseSession = useCallback(() => {
    if (sessionState.isPlaying && !sessionState.isPaused) {
      pauseStartRef.current = Date.now();
      setSessionState((prev) => ({
        ...prev,
        isPaused: true,
        pauseTime: Date.now(),
      }));
    }
  }, [sessionState.isPlaying, sessionState.isPaused]);

  const resumeSession = useCallback(() => {
    if (sessionState.isPlaying && sessionState.isPaused) {
      const pauseDuration = pauseStartRef.current
        ? Date.now() - pauseStartRef.current
        : 0;
      pauseStartRef.current = null;

      setSessionState((prev) => ({
        ...prev,
        isPaused: false,
        pauseTime: null,
        totalPausedTime: prev.totalPausedTime + pauseDuration,
      }));
    }
  }, [sessionState.isPlaying, sessionState.isPaused]);

  const endSession = useCallback(() => {
    setSessionState({
      isPlaying: false,
      isPaused: false,
      courseId: null,
      modeId: "mode_standard",
      skinId: "skin_default",
      startTime: null,
      pauseTime: null,
      totalPausedTime: 0,
    });
  }, []);

  // Get route params
  const routeParams = route?.params;

  return {
    goToLobby,
    goToGame,
    goToResults,
    goToLeaderboard,
    goToStamps,
    goToSkins,
    goToModes,
    goToTutorial,
    goBack,
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    sessionState,
    routeParams,
  };
}

// ============================================
// Deep Link Configuration
// ============================================

export const CART_COURSE_LINKING_CONFIG = {
  screens: {
    CartCourseLobby: "games/cart-course",
    CartCourseGame: {
      path: "games/cart-course/play/:courseId?",
      parse: {
        courseId: (courseId: string) => courseId || "course_1",
      },
    },
    CartCourseLeaderboard: {
      path: "games/cart-course/leaderboard/:courseId",
      parse: {
        courseId: (courseId: string) => courseId,
        tab: (tab: string) => tab as "global" | "friends",
      },
    },
    CartCourseStamps: "games/cart-course/stamps",
    CartCourseSkins: "games/cart-course/skins",
    CartCourseModes: "games/cart-course/modes",
  },
};

// ============================================
// Game Mode Helpers
// ============================================

export interface GameModeSettings {
  livesCount: number;
  timeLimit: number; // ms, 0 = unlimited
  gravity: number; // multiplier
  mirrorX: boolean;
  mirrorY: boolean;
  noCheckpoints: boolean;
  timerCountsUp: boolean;
}

export function getGameModeSettings(modeId: string): GameModeSettings {
  const defaults: GameModeSettings = {
    livesCount: 3,
    timeLimit: 10 * 60 * 1000, // 10 minutes
    gravity: 1.0,
    mirrorX: false,
    mirrorY: false,
    noCheckpoints: false,
    timerCountsUp: false,
  };

  switch (modeId) {
    case "mode_standard":
      return defaults;

    case "mode_time_attack":
      return {
        ...defaults,
        livesCount: Infinity,
        timerCountsUp: true,
        timeLimit: 0,
      };

    case "mode_one_life":
      return {
        ...defaults,
        livesCount: 1,
      };

    case "mode_mirror":
      return {
        ...defaults,
        mirrorX: true,
      };

    case "mode_low_gravity":
      return {
        ...defaults,
        gravity: 0.5,
      };

    case "mode_high_gravity":
      return {
        ...defaults,
        gravity: 1.5,
      };

    case "mode_no_checkpoints":
      return {
        ...defaults,
        noCheckpoints: true,
      };

    case "mode_sprint":
      return {
        ...defaults,
        livesCount: Infinity,
        timeLimit: 3 * 60 * 1000, // 3 minutes
      };

    default:
      return defaults;
  }
}

// ============================================
// Elapsed Time Helper
// ============================================

export function calculateElapsedTime(sessionState: GameSessionState): number {
  if (!sessionState.startTime) return 0;

  const now = Date.now();
  let elapsed = now - sessionState.startTime - sessionState.totalPausedTime;

  if (sessionState.isPaused && sessionState.pauseTime) {
    // Subtract current pause duration
    elapsed -= now - sessionState.pauseTime;
  }

  return Math.max(0, elapsed);
}

/**
 * Format time for display
 */
export function formatGameTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
  }
  return `${seconds}.${centiseconds.toString().padStart(2, "0")}`;
}

/**
 * Format time for leaderboard display
 */
export function formatLeaderboardTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);

  return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
}
