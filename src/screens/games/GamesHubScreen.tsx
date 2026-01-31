/**
 * GamesScreen - Game Hub
 *
 * Features:
 * - List of available games organized by category
 * - Personal best scores
 * - Recent game history
 * - Navigation to individual game screens
 * - Coming soon badges for future games
 * - Active multiplayer games section with filtering
 * - Game invites handling
 * - Archive/resign/rematch quick actions
 */

import { GameInviteBadge } from "@/components/GameInviteCard";
import { UniversalInviteCard } from "@/components/games";
import { ErrorState, LoadingState } from "@/components/ui";
import {
  cancelGameInvite,
  claimInviteSlot,
  joinAsSpectator,
  subscribeToPlayPageInvites,
  unclaimInviteSlot,
} from "@/services/gameInvites";
import {
  formatScore,
  getAllPersonalBests,
  getGameDisplayName,
  getRecentGames,
  PersonalBest,
} from "@/services/games";
import {
  formatScore as formatSinglePlayerScore,
  getAllHighScores,
  getRecentSessions,
  PlayerHighScore,
} from "@/services/singlePlayerSessions";
import {
  archiveGame,
  getActiveMatches,
  resignGame,
  subscribeToActiveMatches,
} from "@/services/turnBasedGames";
import { useAuth } from "@/store/AuthContext";
import {
  countGamesByTurn,
  DEFAULT_GAME_FILTERS,
  filterGames,
  GameFilters,
} from "@/types/gameFilters";
import {
  ExtendedGameType,
  GAME_METADATA,
  SinglePlayerGameType,
} from "@/types/games";
import { GameSession } from "@/types/models";
import { SinglePlayerGameSession } from "@/types/singlePlayerGames";
import {
  AnyMatch,
  RealTimeGameType,
  TurnBasedGameType,
  UniversalGameInvite,
} from "@/types/turnBased";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Card, Chip, Divider, Text, useTheme } from "react-native-paper";
import { BorderRadius, Spacing } from "../../../constants/theme";
import { ActiveGamesSection, GameFilterBar } from "./components";

// =============================================================================
// Types
// =============================================================================

interface GamesScreenProps {
  navigation: any;
}

interface GameCardProps {
  gameId: ExtendedGameType;
  personalBest: number | null;
  onPlay: () => void;
  isComingSoon?: boolean;
}

// =============================================================================
// Game Card Component
// =============================================================================

function GameCard({
  gameId,
  personalBest,
  onPlay,
  isComingSoon,
}: GameCardProps) {
  const theme = useTheme();
  const metadata = GAME_METADATA[gameId];

  if (!metadata) return null;

  const formatBestScore = () => {
    if (personalBest === null) return null;

    // Use original games service for legacy games
    if (gameId === "reaction_tap" || gameId === "timed_tap") {
      return formatScore(gameId, personalBest);
    }
    // Use single player service for new games
    return formatSinglePlayerScore(gameId as any, personalBest);
  };

  return (
    <Card
      style={[
        styles.gameCard,
        { backgroundColor: theme.colors.surface },
        isComingSoon && styles.gameCardDisabled,
      ]}
      onPress={isComingSoon ? undefined : onPlay}
    >
      <Card.Content style={styles.gameCardContent}>
        <View
          style={[
            styles.gameIconContainer,
            {
              backgroundColor: isComingSoon
                ? theme.colors.surfaceDisabled
                : theme.colors.surfaceVariant,
            },
          ]}
        >
          <Text style={styles.gameEmoji}>{metadata.icon}</Text>
        </View>
        <View style={styles.gameInfo}>
          <View style={styles.gameNameRow}>
            <Text
              style={[
                styles.gameName,
                {
                  color: isComingSoon
                    ? theme.colors.onSurfaceDisabled
                    : theme.colors.onSurface,
                },
              ]}
            >
              {metadata.name}
            </Text>
            {isComingSoon && (
              <Chip
                mode="flat"
                compact
                style={styles.comingSoonChip}
                textStyle={styles.comingSoonText}
              >
                Soon
              </Chip>
            )}
          </View>
          <Text
            style={[
              styles.gameDescription,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {metadata.description}
          </Text>
          {personalBest !== null && !isComingSoon && (
            <View style={styles.personalBestContainer}>
              <MaterialCommunityIcons name="trophy" size={16} color="#FFD700" />
              <Text style={styles.personalBestText}>
                Best: {formatBestScore()}
              </Text>
            </View>
          )}
        </View>
        {!isComingSoon && (
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={theme.colors.onSurfaceVariant}
          />
        )}
      </Card.Content>
    </Card>
  );
}

// =============================================================================
// Recent Game Item
// =============================================================================

// Unified recent game type
interface UnifiedRecentGame {
  id: string;
  gameType: ExtendedGameType;
  score: number;
  playedAt: number;
}

function RecentGameItem({ session }: { session: UnifiedRecentGame }) {
  const theme = useTheme();
  const timeAgo = getTimeAgo(session.playedAt);
  const metadata = GAME_METADATA[session.gameType];

  // Format score based on game type
  const formattedScore =
    session.gameType === "reaction_tap" || session.gameType === "timed_tap"
      ? formatScore(session.gameType, session.score)
      : formatSinglePlayerScore(
          session.gameType as SinglePlayerGameType,
          session.score,
        );

  return (
    <View
      style={[
        styles.recentGameItem,
        { borderBottomColor: theme.colors.outlineVariant },
      ]}
    >
      <View
        style={[
          styles.recentGameIcon,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <Text style={{ fontSize: 20 }}>{metadata?.icon || "🎮"}</Text>
      </View>
      <View style={styles.recentGameInfo}>
        <Text
          style={[styles.recentGameName, { color: theme.colors.onSurface }]}
        >
          {metadata?.name || getGameDisplayName(session.gameType as any)}
        </Text>
        <Text
          style={[
            styles.recentGameTime,
            { color: theme.colors.onSurfaceVariant },
          ]}
        >
          {timeAgo}
        </Text>
      </View>
      <Text
        style={[
          styles.recentGameScore,
          {
            color: theme.colors.primary,
            backgroundColor: theme.colors.surfaceVariant,
          },
        ]}
      >
        {formattedScore}
      </Text>
    </View>
  );
}

// =============================================================================
// Category Section Component
// =============================================================================

interface CategorySectionProps {
  title: string;
  subtitle: string;
  games: ExtendedGameType[];
  highScores: Map<string, number>;
  onPlayGame: (gameId: ExtendedGameType) => void;
}

function CategorySection({
  title,
  subtitle,
  games,
  highScores,
  onPlayGame,
}: CategorySectionProps) {
  const theme = useTheme();

  return (
    <>
      <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
        {title}
      </Text>
      <Text
        style={[
          styles.sectionSubtitle,
          { color: theme.colors.onSurfaceVariant },
        ]}
      >
        {subtitle}
      </Text>
      {games.map((gameId) => {
        const metadata = GAME_METADATA[gameId];
        return (
          <GameCard
            key={gameId}
            gameId={gameId}
            personalBest={highScores.get(gameId) ?? null}
            onPlay={() => onPlayGame(gameId)}
            isComingSoon={!metadata?.isAvailable}
          />
        );
      })}
    </>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function GamesScreen({ navigation }: GamesScreenProps) {
  const theme = useTheme();
  const { currentFirebaseUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personalBests, setPersonalBests] = useState<PersonalBest[]>([]);
  const [singlePlayerHighScores, setSinglePlayerHighScores] = useState<
    PlayerHighScore[]
  >([]);
  const [recentGames, setRecentGames] = useState<GameSession[]>([]);
  const [recentSinglePlayerGames, setRecentSinglePlayerGames] = useState<
    SinglePlayerGameSession[]
  >([]);

  // Multiplayer state
  const [activeGames, setActiveGames] = useState<AnyMatch[]>([]);
  const [universalInvites, setUniversalInvites] = useState<
    UniversalGameInvite[]
  >([]);

  // Game filter state
  const [gameFilters, setGameFilters] =
    useState<GameFilters>(DEFAULT_GAME_FILTERS);

  // Combine all high scores into a single map
  const highScoresMap = new Map<string, number>();
  personalBests.forEach((pb) => highScoresMap.set(pb.gameId, pb.bestScore));
  singlePlayerHighScores.forEach((hs) =>
    highScoresMap.set(hs.gameType, hs.highScore),
  );

  // Calculate filtered games and counts
  const filteredActiveGames = useMemo(() => {
    if (!currentFirebaseUser) return [];
    return filterGames(activeGames, gameFilters, currentFirebaseUser.uid);
  }, [activeGames, gameFilters, currentFirebaseUser]);

  const gameCounts = useMemo(() => {
    if (!currentFirebaseUser) return { yourTurn: 0, theirTurn: 0, total: 0 };
    return countGamesByTurn(activeGames, currentFirebaseUser.uid);
  }, [activeGames, currentFirebaseUser]);

  const loadData = useCallback(async () => {
    if (!currentFirebaseUser) return;

    try {
      setError(null);
      const [bests, recent, spHighScores, spRecent, active] = await Promise.all(
        [
          getAllPersonalBests(currentFirebaseUser.uid),
          getRecentGames(currentFirebaseUser.uid, undefined, 5),
          getAllHighScores(currentFirebaseUser.uid),
          getRecentSessions(currentFirebaseUser.uid, undefined, 5),
          getActiveMatches(currentFirebaseUser.uid).catch(() => []),
        ],
      );

      setPersonalBests(bests);
      setRecentGames(recent);
      setSinglePlayerHighScores(spHighScores);
      setRecentSinglePlayerGames(spRecent);
      setActiveGames(active);
    } catch (err) {
      console.error("[GamesScreen] Error loading data:", err);
      setError("Couldn't load games");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentFirebaseUser]);

  // Subscribe to real-time invite updates
  // Subscribe to real-time active matches updates
  useEffect(() => {
    if (!currentFirebaseUser) return;

    const unsubscribe = subscribeToActiveMatches(
      currentFirebaseUser.uid,
      (matches) => {
        setActiveGames(matches);
      },
      (error) => {
        console.error(
          "[GamesScreen] Active matches subscription error:",
          error,
        );
      },
    );

    return () => unsubscribe();
  }, [currentFirebaseUser]);

  // Subscribe to universal invites for Play page (DM invites)
  useEffect(() => {
    if (!currentFirebaseUser) return;

    const unsubscribe = subscribeToPlayPageInvites(
      currentFirebaseUser.uid,
      (invites) => {
        setUniversalInvites(invites);
      },
    );

    return () => unsubscribe();
  }, [currentFirebaseUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh when coming back from a game
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation, loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const navigateToGame = (gameId: ExtendedGameType) => {
    const screenMap: Partial<Record<ExtendedGameType, string>> = {
      reaction_tap: "ReactionTapGame",
      timed_tap: "TimedTapGame",
      flappy_snap: "FlappySnapGame",
      bounce_blitz: "BounceBlitzGame",
      memory_snap: "MemorySnapGame",
      word_snap: "WordSnapGame",
      snap_2048: "Snap2048Game",
      snap_snake: "SnapSnakeGame",
      tic_tac_toe: "TicTacToeGame",
      checkers: "CheckersGame",
      chess: "ChessGame",
      crazy_eights: "CrazyEightsGame",
    };

    const screen = screenMap[gameId];
    if (screen) {
      navigation.navigate(screen);
    }
  };

  const handleSelectActiveGame = (game: AnyMatch) => {
    // Navigate to the appropriate game screen with the match ID
    const screenMap: Record<string, string> = {
      tic_tac_toe: "TicTacToeGame",
      checkers: "CheckersGame",
      chess: "ChessGame",
      crazy_eights: "CrazyEightsGame",
    };

    const screen = screenMap[game.gameType];
    if (screen) {
      navigation.navigate(screen, { matchId: game.id, entryPoint: "play" });
    }
  };

  const handleAcceptInvite = (
    matchId: string,
    gameType: TurnBasedGameType | RealTimeGameType,
  ) => {
    const screenMap: Record<string, string> = {
      tic_tac_toe: "TicTacToeGame",
      checkers: "CheckersGame",
      chess: "ChessGame",
      crazy_eights: "CrazyEightsGame",
    };

    const screen = screenMap[gameType];
    if (screen) {
      navigation.navigate(screen, { matchId, entryPoint: "play" });
    }
    loadData(); // Refresh the data
  };

  // =========================================================================
  // Game Action Handlers (Archive, Resign, Rematch)
  // =========================================================================

  const handleArchiveGame = useCallback(
    async (gameId: string) => {
      if (!currentFirebaseUser) return;
      try {
        await archiveGame(gameId, currentFirebaseUser.uid);
        loadData(); // Refresh to update the list
      } catch (err) {
        console.error("[GamesScreen] Failed to archive game:", err);
      }
    },
    [currentFirebaseUser, loadData],
  );

  const handleResignGame = useCallback(
    async (gameId: string) => {
      console.log("[GamesScreen] handleResignGame called with gameId:", gameId);
      if (!currentFirebaseUser) {
        console.warn("[GamesScreen] No current user, cannot resign");
        return;
      }
      try {
        console.log("[GamesScreen] Calling resignGame...");
        await resignGame(gameId, currentFirebaseUser.uid);
        console.log("[GamesScreen] resignGame succeeded, refreshing data...");
        loadData(); // Refresh to update the list
      } catch (err) {
        console.error("[GamesScreen] Failed to resign game:", err);
      }
    },
    [currentFirebaseUser, loadData],
  );

  const handleRematchGame = useCallback(
    (game: AnyMatch) => {
      // Navigate to game screen with rematch flag
      const screenMap: Record<string, string> = {
        tic_tac_toe: "TicTacToeGame",
        checkers: "CheckersGame",
        chess: "ChessGame",
        crazy_eights: "CrazyEightsGame",
      };

      const screen = screenMap[game.gameType];
      if (screen) {
        // Get opponent ID for rematch
        const opponentId =
          game.players.player1.userId === currentFirebaseUser?.uid
            ? game.players.player2.userId
            : game.players.player1.userId;

        navigation.navigate(screen, {
          rematchOpponentId: opponentId,
          gameType: game.gameType,
          entryPoint: "play",
        });
      }
    },
    [currentFirebaseUser, navigation],
  );

  // =========================================================================
  // Universal Invite Handlers
  // =========================================================================

  const handleJoinUniversalInvite = useCallback(
    async (invite: UniversalGameInvite) => {
      if (!currentFirebaseUser) return;

      const userName =
        currentFirebaseUser.displayName || currentFirebaseUser.email || "User";

      const result = await claimInviteSlot(
        invite.id,
        currentFirebaseUser.uid,
        userName,
        undefined, // avatar
      );

      if (!result.success) {
        console.error("[GamesScreen] Failed to join invite:", result.error);
      }
    },
    [currentFirebaseUser],
  );

  const handleLeaveUniversalInvite = useCallback(
    async (invite: UniversalGameInvite) => {
      if (!currentFirebaseUser) return;

      const result = await unclaimInviteSlot(
        invite.id,
        currentFirebaseUser.uid,
      );

      if (!result.success) {
        console.error("[GamesScreen] Failed to leave invite:", result.error);
      }
    },
    [currentFirebaseUser],
  );

  const handleSpectateUniversalInvite = useCallback(
    async (invite: UniversalGameInvite) => {
      if (!currentFirebaseUser) return;

      const userName =
        currentFirebaseUser.displayName || currentFirebaseUser.email || "User";

      const result = await joinAsSpectator(
        invite.id,
        currentFirebaseUser.uid,
        userName,
        undefined, // avatar
      );

      if (result.success && result.gameId) {
        // Navigate to game in spectator mode
        const screenMap: Record<string, string> = {
          tic_tac_toe: "TicTacToeGame",
          checkers: "CheckersGame",
          chess: "ChessGame",
          crazy_eights: "CrazyEightsGame",
        };
        const screen = screenMap[invite.gameType];
        if (screen) {
          navigation.navigate(screen, {
            matchId: result.gameId,
            spectatorMode: true,
            entryPoint: "play",
          });
        }
      }
    },
    [currentFirebaseUser, navigation],
  );

  const handleCancelUniversalInvite = useCallback(
    async (invite: UniversalGameInvite) => {
      if (!currentFirebaseUser) return;

      await cancelGameInvite(invite.id, currentFirebaseUser.uid);
      loadData();
    },
    [currentFirebaseUser, loadData],
  );

  const handlePlayUniversalInvite = useCallback(
    (gameId: string, gameType: string) => {
      const screenMap: Record<string, string> = {
        tic_tac_toe: "TicTacToeGame",
        checkers: "CheckersGame",
        chess: "ChessGame",
        crazy_eights: "CrazyEightsGame",
      };
      const screen = screenMap[gameType];
      if (screen) {
        navigation.navigate(screen, { matchId: gameId, entryPoint: "play" });
      }
    },
    [navigation],
  );

  // Game categories
  const quickPlayGames: ExtendedGameType[] = [
    "reaction_tap",
    "timed_tap",
    "flappy_snap",
    "bounce_blitz",
  ];
  const puzzleGames: ExtendedGameType[] = [
    "snap_2048",
    "snap_snake",
    "memory_snap",
  ];
  const dailyGames: ExtendedGameType[] = ["word_snap"];
  const multiplayerGames: ExtendedGameType[] = [
    "tic_tac_toe",
    "checkers",
    "chess",
    "crazy_eights",
  ];

  if (loading) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <LoadingState message="Loading games..." />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.background }]}
      >
        <ErrorState
          title="Something went wrong"
          message={error}
          onRetry={loadData}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
    >
      {/* Active Games Section - Show first if there are any */}
      {activeGames.length > 0 && currentFirebaseUser && (
        <>
          {/* Game Filter Bar */}
          <GameFilterBar
            filters={gameFilters}
            onFiltersChange={setGameFilters}
            yourTurnCount={gameCounts.yourTurn}
            theirTurnCount={gameCounts.theirTurn}
            invitesCount={universalInvites.length}
          />

          {/* Active Games */}
          <ActiveGamesSection
            games={filteredActiveGames}
            currentUserId={currentFirebaseUser.uid}
            onSelectGame={handleSelectActiveGame}
            onArchiveGame={handleArchiveGame}
            onResignGame={handleResignGame}
            onRematchGame={handleRematchGame}
          />
          <Divider style={styles.divider} />
        </>
      )}

      {/* Universal Invites Section (Open Invites) */}
      {universalInvites.length > 0 && (
        <>
          <View style={styles.invitesSectionHeader}>
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.colors.onBackground },
              ]}
            >
              📬 Open Invites
            </Text>
            <GameInviteBadge count={universalInvites.length} />
          </View>
          <Text
            style={[
              styles.sectionSubtitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Join a game with your friends!
          </Text>
          <View style={styles.universalInvitesList}>
            {universalInvites.map((invite) => (
              <UniversalInviteCard
                key={invite.id}
                invite={invite}
                currentUserId={currentFirebaseUser?.uid || ""}
                onJoin={() => handleJoinUniversalInvite(invite)}
                onLeave={() => handleLeaveUniversalInvite(invite)}
                onSpectate={() => handleSpectateUniversalInvite(invite)}
                onCancel={() => handleCancelUniversalInvite(invite)}
                onPlay={handlePlayUniversalInvite}
              />
            ))}
          </View>
          <Divider style={styles.divider} />
        </>
      )}

      {/* Quick Play Games Section */}
      <CategorySection
        title="⚡ Quick Play"
        subtitle="Fast-paced action games"
        games={quickPlayGames}
        highScores={highScoresMap}
        onPlayGame={navigateToGame}
      />

      {/* Puzzle Games Section */}
      <Divider style={styles.divider} />
      <CategorySection
        title="🧩 Puzzle"
        subtitle="Test your brain"
        games={puzzleGames}
        highScores={highScoresMap}
        onPlayGame={navigateToGame}
      />

      {/* Multiplayer Games Section */}
      <Divider style={styles.divider} />
      <CategorySection
        title="👥 Multiplayer"
        subtitle="Challenge your friends!"
        games={multiplayerGames}
        highScores={highScoresMap}
        onPlayGame={navigateToGame}
      />

      {/* Daily Games Section */}
      <Divider style={styles.divider} />
      <CategorySection
        title="📅 Daily Challenge"
        subtitle="New puzzle every day!"
        games={dailyGames}
        highScores={highScoresMap}
        onPlayGame={navigateToGame}
      />

      {/* Leaderboards, Achievements & History Section */}
      <Divider style={styles.divider} />
      <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
        Compete & Collect
      </Text>

      <View style={styles.navCardsRow}>
        <TouchableOpacity
          style={[
            styles.navCard,
            {
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
          onPress={() => navigation.navigate("Leaderboard")}
        >
          <MaterialCommunityIcons name="trophy" size={32} color="#FFD700" />
          <Text
            style={[styles.navCardTitle, { color: theme.colors.onSurface }]}
          >
            Leaderboards
          </Text>
          <Text
            style={[
              styles.navCardSubtitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Weekly rankings
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navCard,
            {
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
          onPress={() => navigation.navigate("Achievements")}
        >
          <MaterialCommunityIcons
            name="medal"
            size={32}
            color={theme.colors.primary}
          />
          <Text
            style={[styles.navCardTitle, { color: theme.colors.onSurface }]}
          >
            Achievements
          </Text>
          <Text
            style={[
              styles.navCardSubtitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Unlock badges
          </Text>
        </TouchableOpacity>
      </View>

      {/* Second row with Game History */}
      <View style={styles.navCardsRow}>
        <TouchableOpacity
          style={[
            styles.navCard,
            {
              backgroundColor: theme.colors.surfaceVariant,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
          onPress={() => navigation.navigate("GameHistory")}
        >
          <MaterialCommunityIcons
            name="history"
            size={32}
            color={theme.colors.secondary}
          />
          <Text
            style={[styles.navCardTitle, { color: theme.colors.onSurface }]}
          >
            Game History
          </Text>
          <Text
            style={[
              styles.navCardSubtitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            Past matches & stats
          </Text>
        </TouchableOpacity>

        {/* Placeholder for future card - keeps layout balanced */}
        <View style={[styles.navCard, { opacity: 0 }]} />
      </View>

      {/* Recent Games Section */}
      {(() => {
        // Combine and sort recent games from both sources
        const allRecentGames: UnifiedRecentGame[] = [
          ...recentGames.map((s) => ({
            id: s.id,
            gameType: s.gameId as ExtendedGameType,
            score: s.score,
            playedAt: s.playedAt,
          })),
          ...recentSinglePlayerGames.map((s) => ({
            id: s.id,
            gameType: s.gameType as ExtendedGameType,
            score: s.finalScore,
            playedAt: s.endedAt,
          })),
        ]
          .sort((a, b) => b.playedAt - a.playedAt)
          .slice(0, 5);

        if (allRecentGames.length > 0) {
          return (
            <>
              <Divider style={styles.divider} />
              <Text
                style={[
                  styles.sectionTitle,
                  { color: theme.colors.onBackground },
                ]}
              >
                Recent Games
              </Text>

              <View
                style={[
                  styles.recentGamesContainer,
                  { backgroundColor: theme.colors.surfaceVariant },
                ]}
              >
                {allRecentGames.map((session) => (
                  <RecentGameItem key={session.id} session={session} />
                ))}
              </View>
            </>
          );
        }

        return (
          <>
            <Divider style={styles.divider} />
            <View style={styles.noGamesContainer}>
              <MaterialCommunityIcons
                name="gamepad-variant-outline"
                size={48}
                color={theme.colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.noGamesText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Play your first game to see your history here!
              </Text>
            </View>
          </>
        );
      })()}
    </ScrollView>
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor applied inline via theme
  },
  content: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
    // color applied inline
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: Spacing.lg,
    // color applied inline
  },
  gameCard: {
    marginBottom: Spacing.md,
    elevation: 2,
    // backgroundColor applied inline
  },
  gameCardDisabled: {
    opacity: 0.7,
  },
  gameCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
  },
  gameIconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
    // backgroundColor applied inline
  },
  gameEmoji: {
    fontSize: 32,
  },
  gameInfo: {
    flex: 1,
  },
  gameNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  gameName: {
    fontSize: 18,
    fontWeight: "bold",
    // color applied inline
  },
  comingSoonChip: {
    backgroundColor: "rgba(255, 152, 0, 0.2)",
    height: 22,
  },
  comingSoonText: {
    fontSize: 10,
    color: "#FF9800",
  },
  gameDescription: {
    fontSize: 12,
    marginTop: 2,
    // color applied inline
  },
  personalBestContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  personalBestText: {
    fontSize: 12,
    color: "#FFD700",
    marginLeft: 4,
    fontWeight: "600",
  },
  divider: {
    marginVertical: Spacing.xl,
  },
  recentGamesContainer: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    // backgroundColor applied inline
  },
  recentGameItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
    // borderBottomColor applied inline
  },
  recentGameIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
    // backgroundColor applied inline
  },
  recentGameInfo: {
    flex: 1,
  },
  recentGameName: {
    fontSize: 14,
    fontWeight: "600",
    // color applied inline
  },
  recentGameTime: {
    fontSize: 12,
    // color applied inline
  },
  recentGameScore: {
    fontSize: 16,
    fontWeight: "bold",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    // color and backgroundColor applied inline
  },
  noGamesContainer: {
    alignItems: "center",
    padding: Spacing.xxl,
  },
  noGamesText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.md,
    // color applied inline
  },
  navCardsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  navCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    // backgroundColor and borderColor applied inline
  },
  navCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: Spacing.sm,
    // color applied inline
  },
  navCardSubtitle: {
    fontSize: 12,
    marginTop: 2,
    // color applied inline
  },
  invitesSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  universalInvitesList: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
});
