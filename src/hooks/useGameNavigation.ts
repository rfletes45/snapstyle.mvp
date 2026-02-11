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

import { CommonActions, useNavigation } from "@react-navigation/native";
import { useCallback, useMemo } from "react";


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
   * Exit game and go to appropriate screen
   * - If game has conversation context -> go to that chat
   * - Otherwise -> go to Play screen (GamesHub)
   */
  exitGame: () => void;

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
  const { match, conversationId, conversationType, currentUserId, entryPoint } =
    options;

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
   * Exit the game - smart navigation based on entry point and context
   *
   * Priority:
   * 1. If entryPoint is "play" -> always go to Play screen
   * 2. If entryPoint is "chat" and has conversation context -> go to that chat
   * 3. If no entryPoint but has conversation context -> go to that chat (legacy)
   * 4. Otherwise -> go to Play screen
   *
   * Navigation structure:
   * - AppTabs (Tab.Navigator): Inbox, Moments, Play, Connections, Profile
   * - Inbox tab contains InboxStack with: ChatList, ChatDetail, GroupChat, etc.
   * - Play tab contains PlayStack with: GamesHub, game screens, etc.
   */
  const exitGame = useCallback(() => {
    // Debug logging
    logger.info("[useGameNavigation] exitGame called:", {
      entryPoint,
      hasChat,
      chatConversationType,
      chatConversationId,
      opponentId,
      currentUserId,
    });

    // If user entered from Play screen, always go back to Play screen
    if (entryPoint === "play") {
      goToPlayScreen();
      return;
    }

    // If user entered from chat (or no entry point specified), use conversation context
    if (hasChat && chatConversationType && chatConversationId) {
      // Navigate to the associated chat within the Inbox tab
      if (chatConversationType === "dm") {
        if (!opponentId) {
          logger.warn(
            "[useGameNavigation] DM navigation but no opponentId found!",
            { chatConversationId, currentUserId },
          );
          // Fallback to Play screen if we can't determine opponent
          goToPlayScreen();
          return;
        }
        // For DMs, navigate to Inbox tab -> ChatDetail screen
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [
              {
                name: "Inbox",
                state: {
                  routes: [
                    { name: "ChatList" },
                    { name: "ChatDetail", params: { friendUid: opponentId } },
                  ],
                  index: 1,
                },
              },
            ],
          }),
        );
        return;
      } else if (chatConversationType === "group") {
        // For groups, navigate to Inbox tab -> GroupChat screen
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [
              {
                name: "Inbox",
                state: {
                  routes: [
                    { name: "ChatList" },
                    {
                      name: "GroupChat",
                      params: { groupId: chatConversationId },
                    },
                  ],
                  index: 1,
                },
              },
            ],
          }),
        );
        return;
      }
    }

    // Default: go to Play screen
    goToPlayScreen();
  }, [
    entryPoint,
    hasChat,
    chatConversationType,
    chatConversationId,
    opponentId,
    currentUserId,
    navigation,
  ]);

  /**
   * Go directly to the associated chat
   */
  const goToChat = useCallback(() => {
    if (!hasChat) {
      logger.warn("[useGameNavigation] No chat associated with this game");
      return;
    }

    if (chatConversationType === "dm" && opponentId) {
      // Navigate to Inbox tab -> ChatDetail screen
      navigation.navigate("Inbox", {
        screen: "ChatDetail",
        params: { friendUid: opponentId },
      });
    } else if (chatConversationType === "group" && chatConversationId) {
      // Navigate to Inbox tab -> GroupChat screen
      navigation.navigate("Inbox", {
        screen: "GroupChat",
        params: { groupId: chatConversationId },
      });
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
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: "Play",
            state: {
              routes: [{ name: "GamesHub" }],
              index: 0,
            },
          },
        ],
      }),
    );
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
