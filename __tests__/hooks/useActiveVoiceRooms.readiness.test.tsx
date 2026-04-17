import React from "react";
import { AppState } from "react-native";
import renderer, { act } from "react-test-renderer";

const mockGetUserGroups = jest.fn();
const mockQueryVoiceChannel = jest.fn();

let mockAuthState = {
  currentFirebaseUser: { uid: "user-1" },
};

let mockStreamCallState = {
  isReady: false,
};

jest.mock("../../constants/featureFlags", () => ({
  CALL_FEATURES: {
    CALLS_ENABLED: true,
  },
}));

jest.mock("../../src/store/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

jest.mock("../../src/contexts/StreamCallContext", () => ({
  useStreamCall: () => mockStreamCallState,
}));

jest.mock("../../src/services/groups", () => ({
  getUserGroups: (...args: unknown[]) => mockGetUserGroups(...args),
}));

jest.mock("@/services/stream/voiceChannelService", () => ({
  queryVoiceChannel: (...args: unknown[]) => mockQueryVoiceChannel(...args),
}));

import { useActiveVoiceRooms } from "../../src/hooks/useActiveVoiceRooms";

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function Probe({
  onChange,
}: {
  onChange: (state: ReturnType<typeof useActiveVoiceRooms>) => void;
}) {
  const state = useActiveVoiceRooms(60_000);

  React.useEffect(() => {
    onChange(state);
  }, [onChange, state]);

  return null;
}

describe("useActiveVoiceRooms cold-start readiness", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest
      .spyOn(AppState, "addEventListener")
      .mockReturnValue({ remove: jest.fn() } as any);
    mockAuthState = {
      currentFirebaseUser: { uid: "user-1" },
    };
    mockStreamCallState = {
      isReady: false,
    };
    mockGetUserGroups.mockResolvedValue([
      { id: "group-1", name: "Group One", avatarUrl: null },
    ]);
    mockQueryVoiceChannel.mockResolvedValue({
      status: "active",
      state: {
        participants: [{ userId: "u2", name: "Friend" }],
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("waits for the Stream client before querying active rooms", async () => {
    const seenStates: Array<ReturnType<typeof useActiveVoiceRooms>> = [];

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <Probe onChange={(state) => seenStates.push(state)} />,
      );
      await flushMicrotasks();
    });

    expect(mockGetUserGroups).not.toHaveBeenCalled();
    expect(mockQueryVoiceChannel).not.toHaveBeenCalled();

    const initialState = seenStates.at(-1);
    expect(initialState?.loading).toBe(true);
    expect(initialState?.error).toBe(false);
    expect(initialState?.errorMessage).toBeNull();

    mockStreamCallState = {
      isReady: true,
    };

    await act(async () => {
      tree.update(<Probe onChange={(state) => seenStates.push(state)} />);
      await flushMicrotasks();
    });

    expect(mockGetUserGroups).toHaveBeenCalledTimes(1);
    expect(mockQueryVoiceChannel).toHaveBeenCalledWith("group-1");

    const readyState = seenStates.at(-1);
    expect(readyState?.loading).toBe(false);
    expect(readyState?.rooms).toHaveLength(1);
    expect(readyState?.error).toBe(false);

    act(() => {
      tree.unmount();
    });
  });

  it("retries transient group lookup failures before surfacing unavailable", async () => {
    const permissionError = Object.assign(
      new Error("Missing or insufficient permissions"),
      {
        code: "permission-denied",
      },
    );
    const seenStates: Array<ReturnType<typeof useActiveVoiceRooms>> = [];

    mockStreamCallState = {
      isReady: true,
    };
    mockGetUserGroups
      .mockRejectedValueOnce(permissionError)
      .mockResolvedValueOnce([
        { id: "group-1", name: "Group One", avatarUrl: null },
      ]);
    mockQueryVoiceChannel.mockResolvedValue({ status: "no_room" });

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <Probe onChange={(state) => seenStates.push(state)} />,
      );
      await flushMicrotasks();
    });

    const retryingState = seenStates.at(-1);
    expect(retryingState?.loading).toBe(true);
    expect(retryingState?.error).toBe(false);
    expect(retryingState?.errorMessage).toBeNull();
    expect(mockGetUserGroups).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(500);
      await flushMicrotasks();
    });

    expect(mockGetUserGroups).toHaveBeenCalledTimes(2);
    expect(mockQueryVoiceChannel).toHaveBeenCalledWith("group-1");

    const resolvedState = seenStates.at(-1);
    expect(resolvedState?.loading).toBe(false);
    expect(resolvedState?.error).toBe(false);
    expect(resolvedState?.errorMessage).toBeNull();
    expect(resolvedState?.rooms).toEqual([]);

    act(() => {
      tree.unmount();
    });
  });

  it("retries transient room discovery failures before surfacing unavailable", async () => {
    const seenStates: Array<ReturnType<typeof useActiveVoiceRooms>> = [];

    mockStreamCallState = {
      isReady: true,
    };
    mockQueryVoiceChannel
      .mockResolvedValueOnce({
        status: "error",
        message: "permission-denied",
      })
      .mockResolvedValueOnce({
        status: "active",
        state: {
          participants: [{ userId: "u2", name: "Friend" }],
        },
      });

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <Probe onChange={(state) => seenStates.push(state)} />,
      );
      await flushMicrotasks();
    });

    const retryingState = seenStates.at(-1);
    expect(retryingState?.loading).toBe(true);
    expect(retryingState?.error).toBe(false);
    expect(retryingState?.errorMessage).toBeNull();
    expect(mockQueryVoiceChannel).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(500);
      await flushMicrotasks();
    });

    expect(mockGetUserGroups).toHaveBeenCalledTimes(1);
    expect(mockQueryVoiceChannel).toHaveBeenCalledTimes(2);

    const resolvedState = seenStates.at(-1);
    expect(resolvedState?.loading).toBe(false);
    expect(resolvedState?.error).toBe(false);
    expect(resolvedState?.errorMessage).toBeNull();
    expect(resolvedState?.rooms).toHaveLength(1);

    act(() => {
      tree.unmount();
    });
  });

  it("does not show the full unavailable banner for partial room-check failures", async () => {
    const seenStates: Array<ReturnType<typeof useActiveVoiceRooms>> = [];

    mockStreamCallState = {
      isReady: true,
    };
    mockGetUserGroups.mockResolvedValueOnce([
      { id: "group-1", name: "Group One", avatarUrl: null },
      { id: "group-2", name: "Group Two", avatarUrl: null },
    ]);
    mockQueryVoiceChannel
      .mockResolvedValueOnce({ status: "no_room" })
      .mockResolvedValueOnce({
        status: "error",
        message: "permission-denied",
      });

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <Probe onChange={(state) => seenStates.push(state)} />,
      );
      await flushMicrotasks();
    });

    const resolvedState = seenStates.at(-1);
    expect(resolvedState?.loading).toBe(false);
    expect(resolvedState?.rooms).toEqual([]);
    expect(resolvedState?.error).toBe(false);
    expect(resolvedState?.errorMessage).toBeNull();
    expect(resolvedState?.hasPartialFailures).toBe(false);

    act(() => {
      tree.unmount();
    });
  });
});
