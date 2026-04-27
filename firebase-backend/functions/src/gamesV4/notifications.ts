/**
 * Games V4 notification helpers.
 *
 * All game notification delivery is delegated to the shared notification
 * center so foreground in-app delivery and background push delivery remain
 * mutually exclusive.
 */

import * as functions from "firebase-functions";
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

/**
 * Public helper so the resolve pipeline can label the auto-posted group
 * scorecard with the same name we use everywhere else.
 */
export function getGameDisplayName(gameId: GameId): string {
  return gameName(gameId);
}

export async function notifyInviteCreated(
  invite: GameInviteV4,
  senderDisplayName: string,
  recipientUids: string[],
): Promise<void> {
  const targets = recipientUids.filter((uid) => uid !== invite.createdBy);

  functions.logger.info("[gamesV4:notify] notifyInviteCreated", {
    inviteId: invite.inviteId,
    gameId: invite.gameId,
    scope: invite.conversationScope,
    conversationId: invite.conversationId,
    sender: invite.createdBy,
    recipientCount: targets.length,
  });

  const results = await Promise.allSettled(
    targets.map((uid) =>
      notifyUser({
        recipientUid: uid,
        type: "game_invite",
        category: "games",
        dedupeKey: `game_invite:${invite.inviteId}:${uid}`,
        collapseKey: `game_invite:${invite.conversationId}`,
        title: `${senderDisplayName} invited you to play`,
        subtitle: gameName(invite.gameId),
        body: `Tap to join the ${gameName(invite.gameId)} lobby`,
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

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    functions.logger.warn("[gamesV4:notify] Some invite notifications failed", {
      inviteId: invite.inviteId,
      total: targets.length,
      failed: failed.length,
      errors: failed.map((r) =>
        r.status === "rejected" ? String(r.reason) : "",
      ),
    });
  } else {
    functions.logger.info(
      "[gamesV4:notify] All invite notifications dispatched",
      {
        inviteId: invite.inviteId,
        total: targets.length,
        channels: results.map((r) =>
          r.status === "fulfilled" ? r.value.channel : "error",
        ),
      },
    );
  }
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
    title: `Your Turn — ${gameName(session.gameId)}`,
    body: `${lastActorName} made a move. Tap to play.`,
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
  function buildGameOverBody(uid: string): string {
    if (result.resolutionType === "draw") {
      return "The game ended in a draw.";
    }
    if (result.resolutionType === "loss") {
      return "Your run is over.";
    }
    if (result.winnerIds.length > 0) {
      if (result.winnerIds.includes(uid)) {
        return "Congratulations, you won!";
      }
      const winnerEntry = result.scoreboard.find((entry) =>
        result.winnerIds.includes(entry.uid),
      );
      return `${winnerEntry?.displayName ?? "Your opponent"} won the game.`;
    }
    return "The game has ended.";
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
          title: `Game Over — ${gameName(result.gameId)}`,
          body: buildGameOverBody(uid),
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
            conversationScope,
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

  // Resolve the joiner's uid from the invite's participant list — the joiner
  // is the most-recently-added participant who isn't the host.
  const joinerUid =
    [...invite.participantIds].reverse().find((p) => p !== invite.hostId) ??
    null;

  await notifyUser({
    recipientUid: invite.hostId,
    type: "game_lobby_ready",
    category: "games",
    dedupeKey: `game_lobby_ready:${invite.inviteId}:${invite.hostId}`,
    collapseKey: `game_invite:${invite.inviteId}`,
    title: `${joinerDisplayName} joined your lobby`,
    subtitle: gameName(invite.gameId),
    body: "Your game is ready to start!",
    actorUid: joinerUid,
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
  tokenRewards?: number[];
  sectionId?: string;
  gameId?: string;
  sessionId?: string;
}): Promise<void> {
  const {
    uid,
    achievementIds,
    achievementTitles,
    tokenRewards,
    sectionId,
    gameId,
    sessionId,
  } = params;

  if (achievementIds.length === 0) return;

  const achievementCount = achievementIds.length;
  const readableTitles = achievementIds.map((id, index) =>
    toAchievementTitle(achievementTitles?.[index] ?? id),
  );
  const totalTokenReward = (tokenRewards ?? []).reduce(
    (sum, amount) => sum + (Number.isFinite(amount) ? Math.max(0, amount) : 0),
    0,
  );
  const rewardBody =
    totalTokenReward > 0
      ? `+${totalTokenReward} token${totalTokenReward === 1 ? "" : "s"} added to your wallet`
      : "Achievement saved to your profile";

  await notifyUser({
    recipientUid: uid,
    type: "achievement_unlocked",
    category: "progression",
    dedupeKey: `achievement_unlocked:${uid}:${sessionId ?? achievementIds.join(",")}`,
    collapseKey: `achievement_unlocked:${uid}`,
    title:
      achievementCount === 1
        ? `Achievement unlocked: ${readableTitles[0]}`
        : `${achievementCount} Achievements Unlocked!`,
    body:
      achievementCount === 1
        ? rewardBody
        : `${readableTitles.slice(0, 2).join(", ")}${achievementCount > 2 ? " and more" : ""} · ${rewardBody}`,
    sectionId: sectionId ?? null,
    sessionId: sessionId ?? null,
    gameId: gameId ?? null,
    route: gameId
      ? {
          screen: "GameDetailV4",
          params: { gameId },
        }
      : {
          screen: "GamesHub",
        },
    data: {
      achievementIds,
      achievementTitles: readableTitles,
      tokenRewards: tokenRewards ?? [],
      totalTokenReward,
      sectionId: sectionId ?? null,
      gameId: gameId ?? null,
      sourceSessionId: sessionId ?? null,
    },
  });
}

function toAchievementTitle(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Notify a user that a friend just overtook them on a friends leaderboard.
 *
 * Reuses the `game_resolved` notification transport (so existing category,
 * channel, and mute plumbing all apply) but with a distinct title/body
 * and a route that deep-links to the game's detail/leaderboard view.
 *
 * `variant` is "default" for standard games and the difficulty key
 * ("easy" | "intermediate" | "expert") for Minesweeper so we dedupe
 * per-board rather than once per game.
 */
export async function notifyFriendBeatScore(params: {
  victimUid: string;
  actorUid: string;
  actorName: string;
  gameId: GameId;
  variant: string;
}): Promise<void> {
  const { victimUid, actorUid, actorName, gameId, variant } = params;

  // Defensive: never notify the actor or invalid uid.
  if (!victimUid || victimUid === actorUid) return;

  const label = gameName(gameId);
  const variantSuffix =
    gameId === "minesweeper" && variant !== "default"
      ? ` (${variant[0].toUpperCase()}${variant.slice(1)})`
      : "";

  await notifyUser({
    recipientUid: victimUid,
    type: "game_resolved",
    category: "games",
    // DedupeKey is victim+actor+game+variant so each overtake fires once.
    dedupeKey: `game_friend_beat:${victimUid}:${actorUid}:${gameId}:${variant}`,
    collapseKey: `game_friend_beat:${victimUid}:${gameId}:${variant}`,
    title: `${actorName} beat your score in ${label}${variantSuffix}!`,
    body: "Tap to see the friends leaderboard.",
    actorUid,
    actorName,
    gameId,
    route: {
      screen: "GameDetailV4",
      params: { gameId },
    },
    data: {
      gameId,
      actorUid,
      variant,
      kind: "friend_beat_score",
    },
    badgeEligible: true,
  });
}
