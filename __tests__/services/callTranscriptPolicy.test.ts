/**
 * Tests for `resolveTranscriptPolicy` — the fail-closed policy gate that
 * governs whether direct audio calls may begin transcribing.
 */

const mockGetSettingsSync = jest.fn();
const mockHttpsCallable = jest.fn();

jest.mock("../../src/services/firebase", () => ({
  getAuthInstance: () => ({ currentUser: { uid: "local-uid" } }),
  getFunctionsInstance: () => ({}),
}));

jest.mock("../../src/utils/log", () => ({
  createLogger: () => ({
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock("../../src/services/calls/callSettingsService", () => ({
  callSettingsService: {
    getSettingsSync: (...args: unknown[]) => mockGetSettingsSync(...args),
    addListener: jest.fn(),
  },
}));

jest.mock("../../src/services/calls/callTranscriptDb", () => ({
  upsertTranscriptMeta: jest.fn(),
  patchTranscriptMeta: jest.fn(),
  saveTranscriptTransactional: jest.fn(),
  setTranscriptStatus: jest.fn(),
  getTranscriptMeta: jest.fn(),
}));

jest.mock("firebase/functions", () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

import { resolveTranscriptPolicy } from "../../src/services/calls/callTranscriptService";

describe("resolveTranscriptPolicy — fail-closed semantics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects non-direct calls", async () => {
    mockGetSettingsSync.mockReturnValue({
      audioCallTranscriptionsEnabled: true,
    });
    const r = await resolveTranscriptPolicy({
      mode: "audio",
      isDirect: false,
      otherUserId: "u2",
    });
    expect(r).toEqual({ allowed: false, reason: "not_direct" });
  });

  it("rejects non-audio modes", async () => {
    mockGetSettingsSync.mockReturnValue({
      audioCallTranscriptionsEnabled: true,
    });
    const r = await resolveTranscriptPolicy({
      mode: "video",
      isDirect: true,
      otherUserId: "u2",
    });
    expect(r).toEqual({ allowed: false, reason: "mode_not_audio" });
  });

  it("rejects when local setting is disabled (fast bail, no callable)", async () => {
    mockGetSettingsSync.mockReturnValue({
      audioCallTranscriptionsEnabled: false,
    });
    const r = await resolveTranscriptPolicy({
      mode: "audio",
      isDirect: true,
      otherUserId: "u2",
    });
    expect(r).toEqual({ allowed: false, reason: "local_disabled" });
    expect(mockHttpsCallable).not.toHaveBeenCalled();
  });

  it("fails closed when otherUserId is missing", async () => {
    mockGetSettingsSync.mockReturnValue({
      audioCallTranscriptionsEnabled: true,
    });
    const r = await resolveTranscriptPolicy({
      mode: "audio",
      isDirect: true,
      otherUserId: null,
    });
    expect(r).toEqual({ allowed: false, reason: "unresolved" });
  });

  it("fails closed when the backend callable throws", async () => {
    mockGetSettingsSync.mockReturnValue({
      audioCallTranscriptionsEnabled: true,
    });
    const fakeCallable = jest.fn().mockRejectedValue(new Error("network"));
    mockHttpsCallable.mockReturnValue(fakeCallable);
    const r = await resolveTranscriptPolicy({
      mode: "audio",
      isDirect: true,
      otherUserId: "u2",
    });
    expect(r).toEqual({ allowed: false, reason: "unresolved" });
  });

  it("fails closed on malformed backend response", async () => {
    mockGetSettingsSync.mockReturnValue({
      audioCallTranscriptionsEnabled: true,
    });
    const fakeCallable = jest.fn().mockResolvedValue({ data: { nope: true } });
    mockHttpsCallable.mockReturnValue(fakeCallable);
    const r = await resolveTranscriptPolicy({
      mode: "audio",
      isDirect: true,
      otherUserId: "u2",
    });
    expect(r).toEqual({ allowed: false, reason: "unresolved" });
  });

  it("returns allowed when both users have transcripts enabled", async () => {
    mockGetSettingsSync.mockReturnValue({
      audioCallTranscriptionsEnabled: true,
    });
    const fakeCallable = jest
      .fn()
      .mockResolvedValue({ data: { allowed: true, reason: "ok" } });
    mockHttpsCallable.mockReturnValue(fakeCallable);
    const r = await resolveTranscriptPolicy({
      mode: "audio",
      isDirect: true,
      otherUserId: "u2",
    });
    expect(r).toEqual({ allowed: true, reason: "ok" });
    expect(fakeCallable).toHaveBeenCalledWith({ calleeUid: "u2" });
  });

  it("returns remote_disabled when backend denies", async () => {
    mockGetSettingsSync.mockReturnValue({
      audioCallTranscriptionsEnabled: true,
    });
    const fakeCallable = jest.fn().mockResolvedValue({
      data: { allowed: false, reason: "remote_disabled" },
    });
    mockHttpsCallable.mockReturnValue(fakeCallable);
    const r = await resolveTranscriptPolicy({
      mode: "audio",
      isDirect: true,
      otherUserId: "u2",
    });
    expect(r).toEqual({ allowed: false, reason: "remote_disabled" });
  });
});
