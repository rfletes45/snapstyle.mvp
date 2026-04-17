import React from "react";
import renderer, { act } from "react-test-renderer";

const mockInitStreamClient = jest.fn();
const mockDestroyStreamClient = jest.fn();
const mockClearTokenCache = jest.fn();

let mockAuthState = {
  currentFirebaseUser: { uid: "user-1" },
};

let mockUserState = {
  profile: {
    displayName: "Test User",
    profilePicture: {
      url: "https://example.com/profile.png",
    },
  },
};

jest.mock("../../constants/featureFlags", () => ({
  CALL_FEATURES: {
    CALLS_ENABLED: true,
  },
}));

jest.mock("@stream-io/video-react-native-sdk", () => ({
  CallingState: {
    LEFT: "LEFT",
    IDLE: "IDLE",
    RECONNECTING_FAILED: "RECONNECTING_FAILED",
  },
  StreamVideo: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("expo-crypto", () => ({
  randomUUID: () => "test-random-uuid",
}));

jest.mock("../../src/store/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

jest.mock("../../src/store/UserContext", () => ({
  useUser: () => mockUserState,
}));

jest.mock("../../src/services/stream", () => ({
  startDirectCall: jest.fn(),
  acceptDirectCall: jest.fn(),
  rejectDirectCall: jest.fn(),
  endDirectCall: jest.fn(),
  joinVoiceChannel: jest.fn(),
  leaveVoiceChannel: jest.fn(),
  initStreamClient: (...args: unknown[]) => mockInitStreamClient(...args),
  destroyStreamClient: () => mockDestroyStreamClient(),
  clearTokenCache: () => mockClearTokenCache(),
  stopCallAudioSession: jest.fn(),
}));

jest.mock("../../src/utils/startupTrace", () => ({
  logStartupEvent: jest.fn(),
  logStartupMount: jest.fn(),
  logStartupUnmount: jest.fn(),
  logStartupError: jest.fn(),
}));

import { StreamCallProvider } from "../../src/contexts/StreamCallContext";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("StreamCallProvider stability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      currentFirebaseUser: { uid: "user-1" },
    };
    mockUserState = {
      profile: {
        displayName: "Test User",
        profilePicture: {
          url: "https://example.com/profile.png",
        },
      },
    };
  });

  it("does not remount children when the Stream client becomes ready", async () => {
    const deferredClient = createDeferred<{ id: string }>();
    const mountSpy = jest.fn();
    const unmountSpy = jest.fn();

    mockInitStreamClient.mockReturnValueOnce(deferredClient.promise);

    function Probe() {
      React.useEffect(() => {
        mountSpy();
        return () => {
          unmountSpy();
        };
      }, []);

      return null;
    }

    let tree!: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <StreamCallProvider>
          <Probe />
        </StreamCallProvider>,
      );
      await Promise.resolve();
    });

    expect(mountSpy).toHaveBeenCalledTimes(1);
    expect(unmountSpy).not.toHaveBeenCalled();

    await act(async () => {
      deferredClient.resolve({ id: "stream-client-1" });
      await deferredClient.promise;
      await Promise.resolve();
    });

    expect(mountSpy).toHaveBeenCalledTimes(1);
    expect(unmountSpy).not.toHaveBeenCalled();

    act(() => {
      tree.unmount();
    });

    expect(unmountSpy).toHaveBeenCalledTimes(1);
  });
});
