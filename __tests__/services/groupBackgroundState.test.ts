import { getDefaultMemberState } from "../../src/services/chat/normalizeInboxRow";
import type { InboxConversation } from "../../src/types/messaging";

function getAsyncStorage() {
  const storageModule = require("@react-native-async-storage/async-storage");
  return storageModule.default ?? storageModule;
}

function buildGroupConversation(
  overrides: Partial<InboxConversation> = {},
): InboxConversation {
  return {
    id: "group-1",
    type: "group",
    name: "Study Group",
    avatarUrl: null,
    backgroundUrl: "https://cdn.example.com/bg-old.jpg",
    lastMessage: null,
    memberState: getDefaultMemberState("user-1"),
    unreadCount: 0,
    hasMentions: false,
    createdAt: 1,
    ...overrides,
  } as InboxConversation;
}

describe("groupBackgroundState", () => {
  beforeEach(async () => {
    jest.resetModules();
    await getAsyncStorage().clear();
  });

  it("suppresses stale background candidates after an explicit local removal", async () => {
    const backgroundState = require("../../src/services/chat/groupBackgroundState");

    backgroundState.setSessionGroupBackgroundState({
      groupId: "group-1",
      backgroundUrl: null,
      source: "test-removal",
      authority: "optimistic-delete",
    });

    expect(
      backgroundState.resolveGroupBackgroundUrl(
        "group-1",
        "https://cdn.example.com/bg-old.jpg",
        { source: "test-removal-resolve", candidateAuthority: "helper" },
      ),
    ).toBeNull();
  });

  it("blocks helper background candidates when no trusted state exists", async () => {
    const backgroundState = require("../../src/services/chat/groupBackgroundState");

    expect(
      backgroundState.resolveGroupBackgroundUrl(
        "group-1",
        "https://cdn.example.com/bg-helper.jpg",
        { source: "test-helper-candidate", candidateAuthority: "helper" },
      ),
    ).toBeNull();

    expect(
      backgroundState.resolveGroupBackgroundUrl(
        "group-1",
        "https://cdn.example.com/bg-authoritative.jpg",
        {
          source: "test-authoritative-candidate",
          candidateAuthority: "authoritative",
        },
      ),
    ).toBe("https://cdn.example.com/bg-authoritative.jpg");
  });

  it("patches both persisted inbox caches when a background change is committed", async () => {
    const AsyncStorage = getAsyncStorage();

    await AsyncStorage.setItem(
      "@inbox_cache:user-1",
      JSON.stringify({
        dmConversations: [],
        groupConversations: [buildGroupConversation()],
        timestamp: 1,
      }),
    );
    await AsyncStorage.setItem(
      "@agg_inbox_cache:user-1",
      JSON.stringify({
        conversations: [buildGroupConversation()],
        timestamp: 1,
      }),
    );

    const backgroundState = require("../../src/services/chat/groupBackgroundState");

    backgroundState.commitGroupBackgroundState({
      uid: "user-1",
      groupId: "group-1",
      backgroundUrl: null,
      source: "test-commit",
      authority: "authoritative",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const inboxCache = JSON.parse(
      (await AsyncStorage.getItem("@inbox_cache:user-1")) || "{}",
    );
    const aggCache = JSON.parse(
      (await AsyncStorage.getItem("@agg_inbox_cache:user-1")) || "{}",
    );

    expect(inboxCache.groupConversations[0].backgroundUrl).toBeNull();
    expect(aggCache.conversations[0].backgroundUrl).toBeNull();
  });

  it("updates prepared and visual caches when a new background is committed", async () => {
    const backgroundState = require("../../src/services/chat/groupBackgroundState");
    const wallpaperDebug = require("../../src/services/chat/groupWallpaperDebug");
    const visualCache = require("../../src/services/chat/groupVisualCache");

    backgroundState.commitGroupBackgroundState({
      groupId: "group-1",
      backgroundUrl: "https://cdn.example.com/bg-new.jpg",
      source: "test-new-background",
      authority: "authoritative",
    });

    expect(
      wallpaperDebug.getPreparedGroupChatData("group-1")?.backgroundUrl,
    ).toBe("https://cdn.example.com/bg-new.jpg");
    expect(visualCache.getCachedGroupVisuals("group-1")?.backgroundUrl).toBe(
      "https://cdn.example.com/bg-new.jpg",
    );
  });
});
