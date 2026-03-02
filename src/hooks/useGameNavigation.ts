/**
 * useGameNavigation - Smart navigation hook for game screens
 *
 * Problem: Games can be entered from multiple places:
 * - Play screen (GamesHub)
 * - Chat (via invite card)
 * - Push notification
 * - Deep link
 *
 * Using goBack() breaks when the entry point varies because the navigation
 * stack may not contain the expected screen.
 *
 * Solution: This hook provides navigation functions that always go
 * to the right place based on the game's conversation context.
 *
 * Integration with:
 * - Phase 5 (GameHistoryScreen): exitGame navigates to appropriate screens
 * - Phase 7 (Achievements): After game completion, can redirect properly
 *
 * @see docs/GAME_SYSTEM_OVERHAUL_PLAN.md Phase 6
 */

import { useNavigation, useRoute } from "@react-navigation/native";
import { useCallback, useMemo } from "react";

import { GAME_SESSIONS_V3 } from "@/constants/featureFlags";
import {
  resolveGameSession,
  type ResolveGameParams,
} from "@/services/sessionBridge";
import {
  exitGameSession,
  navigateToDmChat,
  navigateToGroupChat,
  navigateToPlayHub,
  navigateToSessionGameOver,
  type ExitDestination,
} from "@/utils/gameNavHelpers";
import { createLogger } from "@/utils/log";
const logger = createLogger("hooks/useGameNavigation");
// =============================================================================
// Types
// =============================================================================

/**
 * Generic match type for hook compatibility with different game types
 */
interface GenericMatch {
  /** Conversation context - where this game originated */
  conversationId?: string;
  /** Type of conversation (DM or group chat) */
  conversationType?: "dm" | "group";
  /** Players in the match */
  players?: {
    player1?: { userId: string; displayName?: string };
    player2?: { userId: string; displayName?: string };
  };
  /** Current user ID (for determining opponent) */
  currentTurn?: string;
}

interface UseGameNavigationOptions {
  /**
   * The match object containing conversation context
   * Can be any TurnBasedMatch variant (chess, checkers, etc.)
   */
  match?: GenericMatch | null;

  /**
   * Explicit conversation ID (overrides match.conversationId)
   */
  conversationId?: string;

  /**
   * Explicit conversation type (overrides match.conversationType)
   */
  conversationType?: "dm" | "group";

  /**
   * Current user's ID (for determining opponent in DM navigation)
   */
  currentUserId?: string;

  /**
   * Where the user entered the game from.
   * - "play": User came from the Play screen (GamesHub)
   * - "chat": User came from a chat screen
   * - undefined: Use default smart navigation based on conversationId
   */
  entryPoint?: "play" | "chat";
}

interface UseGameNavigationReturn {
  /**
   * Exit game and go to appropriate screen.
   *
   * When in a v3 session, optionally pass resolution data so the session
   * is resolved (closed) before navigating to the game-over screen.
   */
  exitGame: (resolution?: Omit<ResolveGameParams, "sessionId">) => void;

  /**
   * Go to the associated chat (if game was started from chat)
   * Does nothing if game has no associated chat
   */
  goToChat: () => void;

  /**
   * Go directly to Play screen (GamesHub)
   */
  goToPlayScreen: () => void;

  /**
   * Go to game history screen
   */
  goToGameHistory: () => void;

  /**
   * Whether this game has an associated chat
   */
  hasChat: boolean;

  /**
   * Get opponent's user ID (useful for DM navigation)
   */
  opponentId: string | null;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Smart navigation hook for game screens
 *
 * @example
 * // In a game screen component
 * const { exitGame, goToChat, hasChat } = useGameNavigation({
 *   match,
 *   currentUserId: currentFirebaseUser?.uid,
 * });
 *
 * // Replace navigation.goBack() with:
 * exitGame();
 *
 * // Add "Go to Chat" button:
 * {hasChat && (
 *   <TouchableOpacity onPress={goToChat}>
 *     <Ionicons name="chatbubble" size={24} />
 *   </TouchableOpacity>
 * )}
 */
export function useGameNavigation(
  options: UseGameNavigationOptions = {},
): UseGameNavigationReturn {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { match, conversationId, conversationType, currentUserId, entryPoint } =
    options;

  // Detect v3 session context from route params (set by SessionLobbyScreen).
  // `v3Session` is the session ID string when present (truthy = v3 flow).
  const v3SessionId: string | undefined =
    typeof route.params?.v3Session === "string"
      ? route.params.v3Session
      : undefined;

  // Determine conversation info from match or explicit options
  const chatConversationId = conversationId || match?.conversationId;
  const chatConversationType = conversationType || match?.conversationType;
  const hasChat = !!chatConversationId && !!chatConversationType;

  // Determine opponent ID for DM navigation
  // Priority: 1) From match players, 2) Extract from DM conversation ID
  const opponentId = useMemo(() => {
    // Try to get from match players first
    if (match?.players && currentUserId) {
      const { player1, player2 } = match.players;
      if (player1?.userId === currentUserId) {
        return player2?.userId || null;
      }
      if (player2?.userId === currentUserId) {
        return player1?.userId || null;
      }
    }

    // Fallback: Extract from DM conversation ID
    // DM conversation IDs are formatted as "{uid1}_{uid2}" (sorted)
    if (
      chatConversationType === "dm" &&
      chatConversationId &&
      currentUserId &&
      chatConversationId.includes("_")
    ) {
      const parts = chatConversationId.split("_");
      if (parts.length === 2) {
        // Return the ID that is NOT the current user
        const [id1, id2] = parts;
        if (id1 === currentUserId) return id2;
        if (id2 === currentUserId) return id1;
      }
    }

    return null;
  }, [match?.players, currentUserId, chatConversationType, chatConversationId]);

  /**
   * Exit the game — unified pipeline with session cleanup + navigation.
   *
   * v3 flow: If this game was entered via SessionLobbyScreen (v3Session
   * route param), resolve the session (if resolution data provided) and
   * navigate to SessionGameOverScreen.
   *
   * v2 flow: "Back to Hub" ALWAYS goes to the Play hub root (GamesHub),
   * regardless of entryPoint. Use `goToChat()` for explicit chat return.
   *
   * Uses exitGameSession for: double-tap guard → clear session → navigate.
   */
  const exitGame = useCallback(
    (resolution?: Omit<ResolveGameParams, "sessionId">) => {
      const localDispatch = navigation.dispatch;

      // v3: Resolve session + navigate to SessionGameOverScreen
      if (
        v3SessionId &&
        GAME_SESSIONS_V3.ENABLED &&
        GAME_SESSIONS_V3.UNIVERSAL_GAME_OVER
      ) {
        if (__DEV__) {
          logger.info("[GameNav] exitGame → SessionGameOverScreen (v3)", {
            sessionId: v3SessionId,
            hasResolution: !!resolution,
          });
        }

        // Fire-and-forget resolve — navigation happens immediately
        if (resolution) {
          void resolveGameSession({
            sessionId: v3SessionId,
            ...resolution,
          });
        }

        navigateToSessionGameOver(v3SessionId, localDispatch);
        return;
      }

      if (__DEV__) {
        logger.info("[GameNav] exitGame → playHub", { entryPoint });
      }

      // Always navigate to Play hub root
      const destination: ExitDestination = { type: "playHub" };

      // Unified pipeline: double-tap guard → clear session → navigate
      void exitGameSession(destination, { dispatch: localDispatch });
    },
    [entryPoint, v3SessionId, navigation],
  );

  /**
   * Go directly to the associated chat
   */
  const goToChat = useCallback(() => {
    if (!hasChat) {
      logger.warn("[GameNav] No chat associated with this game");
      return;
    }

    const localDispatch = navigation.dispatch;
    if (chatConversationType === "dm" && opponentId) {
      navigateToDmChat(opponentId, localDispatch);
    } else if (chatConversationType === "group" && chatConversationId) {
      navigateToGroupChat(chatConversationId, localDispatch);
    }
  }, [
    hasChat,
    chatConversationType,
    chatConversationId,
    opponentId,
    navigation,
  ]);

  /**
   * Go directly to Play screen (GamesHub)
   */
  const goToPlayScreen = useCallback(() => {
    navigateToPlayHub(navigation.dispatch);
  }, [navigation]);

  /**
   * Go to game history screen
   * Integrates with Phase 5 (GameHistoryScreen)
   */
  const goToGameHistory = useCallback(() => {
    navigation.navigate("GameHistory");
  }, [navigation]);

  return {
    exitGame,
    goToChat,
    goToPlayScreen,
    goToGameHistory,
    hasChat,
    opponentId,
  };
}

// =============================================================================
// Export Types
// =============================================================================

export type { UseGameNavigationOptions, UseGameNavigationReturn };
