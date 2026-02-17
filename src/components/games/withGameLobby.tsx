/**
 * withGameLobby – Higher-order component that wraps any multiplayer game screen
 * with the unified lobby pattern from MiniGolfDuels / SketchParty.
 *
 * This HOC intercepts the "menu" phase and adds lobby/queue functionality
 * WITHOUT changing the game screen's existing gameplay code.
 *
 * Behavior:
 * - If navigated with no params → show lobby as host (can invite)
 * - If navigated with inviteId → show lobby in queue mode
 * - If navigated with matchId → fast-path to game (existing behavior)
 * - Lobby phase → GameLobby component handles waiting, invites, queue
 * - Once game is ready → delegates to the original game screen's startMultiplayer flow
 *
 * Usage:
 *   // In navigation config, wrap the screen:
 *   export default withGameLobby(ChessGameScreen, {
 *     gameType: "chess",
 *     gameTitle: "Chess",
 *     gameIcon: "♟️",
 *     isTurnBased: true,
 *   });
 *
 * @module components/games/withGameLobby
 */

import { GameLobby } from "@/components/games/GameLobby";
import InvitePickerModal, {
  type FriendItem,
  type GroupItem,
} from "@/components/InvitePickerModal";
import { useGameLobby, type UseGameLobbyReturn } from "@/hooks/useGameLobby";
import { colyseusService } from "@/services/colyseus";
import { getGroupMembers } from "@/services/groups";
import { useAuth } from "@/store/AuthContext";
import { createLogger } from "@/utils/log";
import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";

const logger = createLogger("withGameLobby");

// =============================================================================
// Types
// =============================================================================

export interface GameLobbyConfig {
  /** The game type key (e.g. "chess", "tic_tac_toe") */
  gameType: string;
  /** Display title */
  gameTitle: string;
  /** Emoji icon */
  gameIcon?: string;
  /** Whether this is a turn-based game */
  isTurnBased?: boolean;
  /** Room key prefix for host room IDs */
  roomKeyPrefix?: string;
  /** Whether to show the Ready button in lobby */
  showReadyButton?: boolean;
  /**
   * If true, the lobby phase is mandatory for multiplayer.
   * If false (default for backwards compat), the existing menu is kept
   * but lobby is added for invite/queue flows.
   */
  forceLobbForMultiplayer?: boolean;
}

export interface WithGameLobbyInjectedProps {
  /** The lobby hook — game screen can read phase/players/etc */
  lobby: UseGameLobbyReturn;
  /** Whether the lobby is currently active (should be rendered over game) */
  isLobbyActive: boolean;
  /** Call this to dismiss the lobby (e.g. when game screen's Colyseus connection is established) */
  dismissLobby: () => void;
  /** The resolved game ID from the lobby (matchId or hostRoomKey) */
  lobbyGameId: string | null;
  /** Entry point for navigation */
  entryPoint?: string;
}

// =============================================================================
// HOC Implementation
// =============================================================================

export function withGameLobby<P extends object>(
  WrappedComponent: React.ComponentType<P & WithGameLobbyInjectedProps>,
  config: GameLobbyConfig,
) {
  const {
    gameType,
    gameTitle,
    gameIcon = "🎮",
    isTurnBased = false,
    roomKeyPrefix,
    showReadyButton = true,
  } = config;

  function GameWithLobby(props: P & { navigation: any; route: any }) {
    const { navigation, route } = props;
    const { currentFirebaseUser } = useAuth();

    const matchId = route?.params?.matchId;
    const inviteId = route?.params?.inviteId;
    const spectator = route?.params?.spectatorMode || route?.params?.spectator;
    const entryPoint = route?.params?.entryPoint;

    // Determine if we need to show the lobby
    // Skip lobby when:
    // 1. matchId is provided (direct join / resume — go straight to game)
    // 2. spectator mode
    const skipLobby = !!matchId || !!spectator;

    const [isLobbyActive, setIsLobbyActive] = useState(!skipLobby);
    const [resolvedGameId, setResolvedGameId] = useState<string | null>(
      matchId || null,
    );
    const [showInvitePicker, setShowInvitePicker] = useState(false);

    const handleGameReady = useCallback((gameId: string) => {
      logger.info(`[withGameLobby] Game ready: ${gameId}`);
      setResolvedGameId(gameId);
      setIsLobbyActive(false);
    }, []);

    const handleLeaveLobby = useCallback(async () => {
      // Clear the Colyseus session fully (Bug #2 fix)
      await colyseusService.clearActiveSession();
      // Navigate back based on entry point
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate("GamesHub");
      }
    }, [navigation]);

    const lobby = useGameLobby({
      gameType,
      matchId: skipLobby ? matchId : undefined,
      inviteId: skipLobby ? undefined : inviteId,
      spectator,
      entryPoint,
      onGameReady: handleGameReady,
      onLeaveLobby: handleLeaveLobby,
      isTurnBased,
      roomKeyPrefix,
    });

    const dismissLobby = useCallback(() => {
      setIsLobbyActive(false);
    }, []);

    // ── Invite handlers ──────────────────────────────────────────────────
    const handleSelectFriend = useCallback(
      async (friend: FriendItem) => {
        setShowInvitePicker(false);
        await lobby.sendFriendInvite(
          friend.friendUid,
          friend.displayName || friend.username,
          undefined,
        );
      },
      [lobby],
    );

    const handleSelectGroup = useCallback(
      async (group: GroupItem) => {
        setShowInvitePicker(false);
        try {
          const members = await getGroupMembers(group.groupId);
          await lobby.sendGroupInvite(
            group.groupId,
            group.name,
            members.map((m: any) => m.uid),
          );
        } catch (err) {
          logger.error("[withGameLobby] Error sending group invite:", err);
        }
      },
      [lobby],
    );

    // ── Render ───────────────────────────────────────────────────────────

    // Show lobby when active
    if (isLobbyActive && !skipLobby) {
      return (
        <View style={styles.container}>
          <GameLobby
            lobby={lobby}
            gameTitle={gameTitle}
            gameIcon={gameIcon}
            onInvitePress={() => setShowInvitePicker(true)}
            onLeave={handleLeaveLobby}
            showReadyButton={showReadyButton}
          />

          <InvitePickerModal
            visible={showInvitePicker}
            onDismiss={() => setShowInvitePicker(false)}
            onSelectFriend={handleSelectFriend}
            onSelectGroup={handleSelectGroup}
            currentUserId={currentFirebaseUser?.uid || ""}
            title={`Invite to ${gameTitle}`}
          />
        </View>
      );
    }

    // Otherwise render the game screen with the lobby props injected
    return (
      <WrappedComponent
        {...props}
        lobby={lobby}
        isLobbyActive={isLobbyActive}
        dismissLobby={dismissLobby}
        lobbyGameId={resolvedGameId || lobby.effectiveGameId}
        entryPoint={entryPoint}
      />
    );
  }

  GameWithLobby.displayName = `withGameLobby(${
    WrappedComponent.displayName || WrappedComponent.name || "Component"
  })`;

  return GameWithLobby;
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default withGameLobby;
