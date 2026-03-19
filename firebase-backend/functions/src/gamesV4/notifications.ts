/**
 * Games V4 notification helpers.
 *
 * All game notification delivery is delegated to the shared notification
 * center so foreground in-app delivery and background push delivery remain
 * mutually exclusive.
 */

import { notifyUser } from "../notificationCenter";
import type {
  GameId,
  GameInviteV4,
  GameResultV4,
  GameSessionV4,
} from "./types";

const GAME_DISPLAY_NAMES: Record<GameId, string> = {
  bounce_blitz: "Bounce Blitz",
  play_2048: "2048",
  brick_breaker: "Brick Breaker",
  word_master: "Word Master",
  minesweeper: "Minesweeper",
  lights_out: "Lights Out",
  tic_tac_toe: "Tic Tac Toe",
  chess: "Chess",
  checkers: "Checkers",
  connect_four: "Connect Four",
  gomoku: "Gomoku",
  reversi: "Reversi",
  dots_and_boxes: "Dots & Boxes",
  pong_game: "Pong",
  battleship: "Battleship",
  sketch_party_game: "Sketch Party",
  crazy_eights: "Crazy 8's",
  starforge_game: "Starforge",
  crossword_puzzle: "Crossword",
  minigolf_duels: "Mini Golf",
  dot_match: "Dot Match",
  knockout_game: "Knockout",
  solitaire_klondike: "Solitaire",
  hex: "Hex",
  dead_drop: "Dead Drop",
  metro_magnate: "Metro Magnate",
};

function gameName(gameId: GameId): string {
  return GAME_DISPLAY_NAMES[gameId] || gameId;
}

export async function notifyInviteCreated(
  invite: GameInviteV4,
  senderDisplayName: string,
  recipientUids: string[],
): Promise<void> {
  await Promise.all(
    recipientUids
      .filter((uid) => uid !== invite.createdBy)
      .map((uid) =>
        notifyUser({
          recipientUid: uid,
          type: "game_invite",
          category: "games",
          dedupeKey: `game_invite:${invite.inviteId}:${uid}`,
          collapseKey: `game_invite:${invite.conversationId}`,
          title: `${gameName(invite.gameId)} invite`,
          body: `${senderDisplayName} invited you to play ${gameName(invite.gameId)}`,
          actorUid: invite.createdBy,
          actorName: senderDisplayName,
          conversationId: invite.conversationId,
          conversationScope: invite.conversationScope,
          inviteId: invite.inviteId,
          gameId: invite.gameId,
          route: {
            screen: "GameLobbyV4",
            params: { inviteId: invite.inviteId },
          },
          data: {
            inviteId: invite.inviteId,
            conversationId: invite.conversationId,
            conversationScope: invite.conversationScope,
            gameId: invite.gameId,
          },
          respectConversationMute: true,
        }),
      ),
  );
}

export async function notifyTurn(
  session: GameSessionV4,
  turnPlayerUid: string,
  lastActorName: string,
  versionToken?: number,
): Promise<void> {
  if (!turnPlayerUid || session.runtimeType !== "turnBased") {
    return;
  }

  await notifyUser({
    recipientUid: turnPlayerUid,
    type: "game_turn",
    category: "games",
    dedupeKey: `game_turn:${session.sessionId}:${turnPlayerUid}:${versionToken ?? session.integrity.version}`,
    collapseKey: `game_turn:${session.sessionId}`,
    title: `Your turn - ${gameName(session.gameId)}`,
    body: `${lastActorName} made a move. It's your turn.`,
    conversationId: session.conversationId,
    conversationScope: session.conversationScope,
    sessionId: session.sessionId,
    inviteId: session.inviteId,
    gameId: session.gameId,
    route: {
      screen: "GamePlayV4",
      params: {
        sessionId: session.sessionId,
        gameId: session.gameId,
      },
    },
    data: {
      sessionId: session.sessionId,
      inviteId: session.inviteId,
      conversationId: session.conversationId,
      conversationScope: session.conversationScope,
      gameId: session.gameId,
      gameName: gameName(session.gameId),
      opponentName: lastActorName,
    },
    respectConversationMute: true,
  });
}

export async function notifyResolved(
  result: GameResultV4,
  conversationScope: "dm" | "group",
  resolverUid?: string,
): Promise<void> {
  let body = "The game has ended.";
  if (result.resolutionType === "draw") {
    body = "The game ended in a draw.";
  } else if (result.winnerIds.length > 0) {
    const winnerEntry = result.scoreboard.find((entry) =>
      result.winnerIds.includes(entry.uid),
    );
    body = `${winnerEntry?.displayName ?? "Someone"} won the game.`;
  }

  await Promise.all(
    result.participantIds
      .filter((uid) => uid !== resolverUid)
      .map((uid) =>
        notifyUser({
          recipientUid: uid,
          type: "game_resolved",
          category: "games",
          dedupeKey: `game_resolved:${result.sessionId}:${uid}`,
          collapseKey: `game_resolved:${result.sessionId}`,
          title: `Game over - ${gameName(result.gameId)}`,
          body,
          conversationId: result.conversationId,
          conversationScope,
          sessionId: result.sessionId,
          inviteId: result.inviteId,
          gameId: result.gameId,
          route: {
            screen: "GameOverV4",
            params: { sessionId: result.sessionId },
          },
          data: {
            sessionId: result.sessionId,
            inviteId: result.inviteId,
            conversationId: result.conversationId,
            gameId: result.gameId,
            resolutionType: result.resolutionType,
          },
          respectConversationMute: true,
        }),
      ),
  );
}

export async function notifyPlayerJoinedLobby(
  invite: GameInviteV4,
  joinerDisplayName: string,
): Promise<void> {
  if (!invite.hostId) return;

  await notifyUser({
    recipientUid: invite.hostId,
    type: "game_lobby_ready",
    category: "games",
    dedupeKey: `game_lobby_ready:${invite.inviteId}:${invite.hostId}`,
    collapseKey: `game_invite:${invite.inviteId}`,
    title: `${gameName(invite.gameId)} lobby`,
    body: `${joinerDisplayName} joined the lobby`,
    actorName: joinerDisplayName,
    conversationId: invite.conversationId,
    conversationScope: invite.conversationScope,
    inviteId: invite.inviteId,
    gameId: invite.gameId,
    route: {
      screen: "GameLobbyV4",
      params: { inviteId: invite.inviteId },
    },
    data: {
      inviteId: invite.inviteId,
      conversationId: invite.conversationId,
      conversationScope: invite.conversationScope,
      gameId: invite.gameId,
    },
    respectConversationMute: true,
  });
}

export async function notifyAchievementUnlocked(params: {
  uid: string;
  achievementIds: string[];
  achievementTitles?: string[];
  sectionId?: string;
  gameId?: string;
  sessionId?: string;
}): Promise<void> {
  const {
    uid,
    achievementIds,
    achievementTitles,
    sectionId,
    gameId,
    sessionId,
  } = params;

  if (achievementIds.length === 0) return;

  const achievementCount = achievementIds.length;
  const body =
    achievementCount === 1
      ? achievementTitles?.[0] || "You unlocked a new achievement"
      : `You unlocked ${achievementCount} achievements`;

  await notifyUser({
    recipientUid: uid,
    type: "achievement_unlocked",
    category: "progression",
    dedupeKey: `achievement_unlocked:${uid}:${sessionId ?? achievementIds.join(",")}`,
    collapseKey: `achievement_unlocked:${uid}`,
    title: "Achievement unlocked",
    body,
    sectionId: sectionId ?? null,
    sessionId: sessionId ?? null,
    gameId: gameId ?? null,
    route: sectionId
      ? {
          screen: "AchievementSection",
          params: { sectionId },
        }
      : {
          screen: "AchievementsHub",
        },
    data: {
      achievementIds,
      achievementTitles: achievementTitles ?? [],
      sectionId: sectionId ?? null,
      gameId: gameId ?? null,
      sourceSessionId: sessionId ?? null,
    },
  });
}
