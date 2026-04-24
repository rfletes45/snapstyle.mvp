jest.mock(
  "firebase-admin",
  () => ({
    firestore: {
      Timestamp: {
        now: jest.fn(() => ({
          toMillis: () => 1_712_345_678_000,
        })),
      },
    },
  }),
  { virtual: true },
);

jest.mock(
  "firebase-functions",
  () => ({
    https: {
      onCall: jest.fn((handler) => handler),
      HttpsError: class HttpsError extends Error {
        code: string;

        constructor(code: string, message: string) {
          super(message);
          this.code = code;
        }
      },
    },
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  }),
  { virtual: true },
);

jest.mock("../../../firebase-backend/functions/src/gamesV4/achievements", () => ({
  evaluateAchievementsV4: jest.fn(),
  getAllAchievementDefs: jest.fn(() => []),
}));

jest.mock("../../../firebase-backend/functions/src/gamesV4/adapters", () => ({
  computeOutcome: jest.fn(),
  extractPerformanceMetrics: jest.fn(() => ({})),
  hasAdapter: jest.fn(() => false),
}));

jest.mock("../../../firebase-backend/functions/src/gamesV4/helpers", () => ({
  computeIntegrityHash: jest.fn(() => "hash"),
  currentWeekKey: jest.fn(() => "2026-W17"),
  getDb: jest.fn(),
  nowMs: jest.fn(() => 0),
  unpinInviteFromConversation: jest.fn(),
}));

jest.mock("../../../firebase-backend/functions/src/gamesV4/levelRewardsV4", () => ({
  unlockLevelRewards: jest.fn(),
}));

jest.mock("../../../firebase-backend/functions/src/gamesV4/notifications", () => ({
  getGameDisplayName: jest.fn(() => "Chess"),
  notifyAchievementUnlocked: jest.fn(),
  notifyFriendBeatScore: jest.fn(),
  notifyResolved: jest.fn(),
}));

import {
  SCORECARD_SENTINEL,
  SCORECARD_VISIBLE_TEXT,
} from "../../../firebase-backend/functions/src/messagePreview";
import { postGameScorecardToChat } from "../../../firebase-backend/functions/src/gamesV4/resolve";

function createMockDb(options?: {
  scope?: "dm" | "group";
  autoSendScorecards?: boolean;
  winnerEquippedBackgroundId?: string | null;
  createError?: { code?: number | string };
}) {
  const scope = options?.scope ?? "dm";
  const rootCollection = scope === "dm" ? "Chats" : "Groups";
  const conversationId = scope === "dm" ? "chat-1" : "group-1";
  const hostId = "host-1";
  const winnerId = "winner-1";

  const createdMessages: Array<{ path: string; doc: Record<string, unknown> }> =
    [];
  const conversationUpdates: Array<{
    path: string;
    update: Record<string, unknown>;
  }> = [];
  const reads: string[] = [];

  function docRef(path: string) {
    return {
      async get() {
        reads.push(path);
        if (path === `${rootCollection}/${conversationId}/MembersPrivate/${hostId}`) {
          return {
            data: () =>
              options?.autoSendScorecards === undefined
                ? {}
                : { autoSendScorecards: options.autoSendScorecards },
          };
        }
        if (path === `Users/${winnerId}`) {
          return {
            data: () => ({
              equippedBackgroundId:
                options?.winnerEquippedBackgroundId ?? null,
            }),
          };
        }
        return { data: () => ({}) };
      },
      async create(doc: Record<string, unknown>) {
        if (options?.createError) {
          throw options.createError;
        }
        createdMessages.push({ path, doc });
      },
      async update(update: Record<string, unknown>) {
        conversationUpdates.push({ path, update });
      },
      collection(name: string) {
        return collectionRef(`${path}/${name}`);
      },
    };
  }

  function collectionRef(path: string) {
    return {
      doc(id: string) {
        return docRef(`${path}/${id}`);
      },
    };
  }

  return {
    db: {
      collection(name: string) {
        return collectionRef(name);
      },
    },
    createdMessages,
    conversationUpdates,
    reads,
    conversationId,
    hostId,
    winnerId,
    rootCollection,
  };
}

describe("postGameScorecardToChat", () => {
  const session = {
    sessionId: "session-1",
    gameId: "chess",
    runtimeType: "turnBased",
    conversationId: "chat-1",
    conversationScope: "dm",
    hostId: "host-1",
    players: [
      {
        uid: "host-1",
        displayName: "Host Player",
        decorationId: "host-decoration",
      },
      {
        uid: "winner-1",
        displayName: "Winner Player",
        decorationId: "winner-decoration",
      },
    ],
  };

  const result = {
    sessionId: "session-1",
    gameId: "chess",
    resolutionType: "win",
    winnerIds: ["winner-1"],
    durationMs: 42_000,
    scoreboard: [
      {
        uid: "host-1",
        displayName: "Host Player",
        profilePictureUrl: null,
        score: 0,
        placement: 2,
      },
      {
        uid: "winner-1",
        displayName: "Winner Player",
        profilePictureUrl: "https://cdn.example.com/winner.png",
        score: 1,
        placement: 1,
      },
    ],
  };

  it("posts a deterministic trusted DM scorecard and sanitizes the conversation preview", async () => {
    const mock = createMockDb({
      scope: "dm",
      winnerEquippedBackgroundId: "winner-bg",
    });

    await postGameScorecardToChat(
      mock.db as any,
      session as any,
      result as any,
    );

    expect(mock.createdMessages).toHaveLength(1);
    const posted = mock.createdMessages[0];
    expect(posted.path).toBe("Chats/chat-1/Messages/scorecard_session-1");
    expect(posted.doc.senderId).toBe("host-1");
    expect(posted.doc.senderName).toBe("Host Player");
    expect(posted.doc.kind).toBe("text");
    expect(posted.doc.clientId).toBe("server");
    expect(posted.doc.idempotencyKey).toBe("server:scorecard:session-1");
    expect(typeof posted.doc.text).toBe("string");
    expect(String(posted.doc.text).startsWith(SCORECARD_SENTINEL)).toBe(true);
    expect(String(posted.doc.text).endsWith(`\n${SCORECARD_VISIBLE_TEXT}`)).toBe(
      true,
    );

    const payloadJson = String(posted.doc.text)
      .slice(SCORECARD_SENTINEL.length)
      .split("\n")[0];
    const payload = JSON.parse(payloadJson);
    expect(payload.gameTitle).toBe("Chess");
    expect(payload.winnerEquippedBackgroundId).toBe("winner-bg");
    expect(payload.senderEquippedBackgroundId).toBeUndefined();
    expect(payload.scoreboard).toEqual([
      {
        uid: "host-1",
        displayName: "Host Player",
        profilePictureUrl: null,
        decorationId: "host-decoration",
        score: 0,
        placement: 2,
      },
      {
        uid: "winner-1",
        displayName: "Winner Player",
        profilePictureUrl: "https://cdn.example.com/winner.png",
        decorationId: "winner-decoration",
        score: 1,
        placement: 1,
      },
    ]);

    expect(mock.conversationUpdates).toEqual([
      {
        path: "Chats/chat-1",
        update: {
          lastMessageText: SCORECARD_VISIBLE_TEXT,
          lastMessageAt: 1_712_345_678_000,
          lastMessageSenderId: "host-1",
          updatedAt: 1_712_345_678_000,
        },
      },
    ]);
  });

  it("skips posting when the host disabled auto-send for the hosting group", async () => {
    const mock = createMockDb({
      scope: "group",
      autoSendScorecards: false,
    });
    const groupSession = {
      ...session,
      conversationId: "group-1",
      conversationScope: "group",
    };

    await postGameScorecardToChat(
      mock.db as any,
      groupSession as any,
      result as any,
    );

    expect(mock.createdMessages).toHaveLength(0);
    expect(mock.conversationUpdates).toHaveLength(0);
  });

  it("treats already-existing scorecards as an idempotent success", async () => {
    const mock = createMockDb({
      scope: "dm",
      createError: { code: 6 },
    });

    await expect(
      postGameScorecardToChat(mock.db as any, session as any, result as any),
    ).resolves.toBeUndefined();

    expect(mock.createdMessages).toHaveLength(0);
    expect(mock.conversationUpdates).toHaveLength(0);
  });
});
