import {
  describeRemoteUrlForLog,
  getPreparedGroupChatData,
  rememberPreparedGroupChatData,
} from "../../src/services/chat/groupWallpaperDebug";

describe("groupWallpaperDebug", () => {
  it("normalizes remote URLs before hashing them for logs", () => {
    const trimmed = describeRemoteUrlForLog(" https://cdn.example.com/bg.jpg ");
    const untrimmed = describeRemoteUrlForLog("https://cdn.example.com/bg.jpg");

    expect(trimmed.present).toBe(true);
    expect(trimmed.normalized).toBe("https://cdn.example.com/bg.jpg");
    expect(trimmed.key).toBe(untrimmed.key);
  });

  it("merges prepared group data without clearing known fields on partial updates", () => {
    rememberPreparedGroupChatData(
      "group-1",
      {
        name: "Study Group",
        avatarUrl: "https://cdn.example.com/avatar.jpg",
        backgroundUrl: "https://cdn.example.com/bg.jpg",
      },
      "initial",
    );

    rememberPreparedGroupChatData(
      "group-1",
      {
        name: "Study Group",
      },
      "partial",
    );

    expect(getPreparedGroupChatData("group-1")).toMatchObject({
      name: "Study Group",
      avatarUrl: "https://cdn.example.com/avatar.jpg",
      backgroundUrl: "https://cdn.example.com/bg.jpg",
      source: "partial",
    });
  });

  it("allows explicit null updates when the background is intentionally removed", () => {
    rememberPreparedGroupChatData(
      "group-2",
      {
        backgroundUrl: "https://cdn.example.com/bg.jpg",
      },
      "initial",
    );

    rememberPreparedGroupChatData(
      "group-2",
      {
        backgroundUrl: null,
      },
      "cleared",
    );

    expect(getPreparedGroupChatData("group-2")).toMatchObject({
      backgroundUrl: null,
      source: "cleared",
    });
  });
});
