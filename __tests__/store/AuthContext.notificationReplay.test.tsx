import React from "react";
import renderer, { act } from "react-test-renderer";

const mockAddNotificationReceivedListener = jest.fn();
const mockAddNotificationResponseListener = jest.fn();
const mockClearLastNotificationResponse = jest.fn();
const mockGetLastNotificationResponse = jest.fn();
const mockRegisterForPushNotifications = jest.fn();
const mockRemovePushToken = jest.fn();
const mockSavePushToken = jest.fn();
const mockGetAuthInstance = jest.fn();
const mockNavigate = jest.fn();
const mockNormalizeNotificationPayload = jest.fn();
const mockShouldHandleNotificationByDedupeKey = jest.fn();
const mockCleanupPresence = jest.fn();
const mockInitializePresence = jest.fn();
const mockSetPresenceOnline = jest.fn();
const mockMarkUserNotificationRead = jest.fn();
const mockConsumeExplicitLogoutIntent = jest.fn();

jest.mock("../../src/services/firebase", () => ({
  getAuthInstance: () => mockGetAuthInstance(),
}));

jest.mock("../../src/services/auth", () => ({
  consumeExplicitLogoutIntent: () => mockConsumeExplicitLogoutIntent(),
}));

jest.mock("../../src/services/navigationRef", () => ({
  navigate: (...args: unknown[]) => mockNavigate(...args),
}));

jest.mock("../../src/services/notifications", () => ({
  addNotificationReceivedListener: (...args: unknown[]) =>
    mockAddNotificationReceivedListener(...args),
  addNotificationResponseListener: (...args: unknown[]) =>
    mockAddNotificationResponseListener(...args),
  clearLastNotificationResponse: () => mockClearLastNotificationResponse(),
  getLastNotificationResponse: () => mockGetLastNotificationResponse(),
  registerForPushNotifications: () => mockRegisterForPushNotifications(),
  removePushToken: (...args: unknown[]) => mockRemovePushToken(...args),
  savePushToken: (...args: unknown[]) => mockSavePushToken(...args),
}));

jest.mock("../../src/services/notifications/normalizeNotification", () => ({
  normalizeNotificationPayload: (...args: unknown[]) =>
    mockNormalizeNotificationPayload(...args),
  shouldHandleNotificationByDedupeKey: (...args: unknown[]) =>
    mockShouldHandleNotificationByDedupeKey(...args),
}));

jest.mock("../../src/services/presence", () => ({
  cleanupPresence: () => mockCleanupPresence(),
  initializePresence: (...args: unknown[]) => mockInitializePresence(...args),
  setPresenceOnline: (...args: unknown[]) => mockSetPresenceOnline(...args),
}));

jest.mock("../../src/services/userNotifications", () => ({
  markUserNotificationRead: (...args: unknown[]) =>
    mockMarkUserNotificationRead(...args),
}));

jest.mock("../../src/services/users", () => ({
  backfillUserEmailIfMissing: jest.fn(),
}));

jest.mock("../../src/utils/startupTrace", () => ({
  getStartupSessionId: () => "test-startup-session",
  logStartupEvent: jest.fn(),
  logStartupMount: jest.fn(),
  logStartupUnmount: jest.fn(),
  logStartupError: jest.fn(),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider, useAuth } from "../../src/store/AuthContext";

const HANDLED_NOTIFICATION_RESPONSES_KEY =
  "@vibe/handled_notification_responses_v1";
const DEFAULT_NOTIFICATION_RESPONSE_KEY =
  "expo-notification-request-1|expo.modules.notifications.actions.DEFAULT|notification:message_request:abc123|notif-doc-1";

async function flushMicrotasks(count = 5) {
  for (let i = 0; i < count; i += 1) {
    await Promise.resolve();
  }
}

describe("AuthContext notification startup replay", () => {
  let authStateChangedCallback:
    | ((user: any) => Promise<void> | void)
    | undefined;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    await AsyncStorage.clear();

    authStateChangedCallback = undefined;

    mockAddNotificationReceivedListener.mockReturnValue({
      remove: jest.fn(),
    });
    mockAddNotificationResponseListener.mockReturnValue({
      remove: jest.fn(),
    });
    mockClearLastNotificationResponse.mockResolvedValue(undefined);
    mockRegisterForPushNotifications.mockResolvedValue(null);
    mockNormalizeNotificationPayload.mockReturnValue({
      dedupeKey: "notification:message_request:abc123",
      notificationId: "notif-doc-1",
      route: {
        screen: "Friends",
        params: {
          tab: "requests",
        },
      },
    });
    mockShouldHandleNotificationByDedupeKey.mockReturnValue(true);
    mockMarkUserNotificationRead.mockResolvedValue(undefined);
    mockConsumeExplicitLogoutIntent.mockReturnValue(false);

    mockGetAuthInstance.mockReturnValue({
      currentUser: null,
      onAuthStateChanged: jest.fn((callback: (user: any) => Promise<void>) => {
        authStateChangedCallback = callback;
        return jest.fn();
      }),
      onIdTokenChanged: jest.fn(() => jest.fn()),
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("handles the cached last notification response only once across auth churn", async () => {
    mockGetLastNotificationResponse.mockReturnValue({
      actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
      notification: {
        request: {
          identifier: "expo-notification-request-1",
          content: {
            data: {
              type: "message_request",
              senderId: "friend-1",
            },
          },
        },
      },
    });

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AuthProvider>
          <React.Fragment />
        </AuthProvider>,
      );
      await flushMicrotasks();
    });

    expect(mockGetLastNotificationResponse).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("Friends", {
      tab: "requests",
    });
    expect(mockClearLastNotificationResponse).toHaveBeenCalledTimes(1);

    const firstUser = {
      uid: "user-1",
      email: "user1@example.com",
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: {} }),
    };

    await act(async () => {
      await authStateChangedCallback?.(firstUser);
      await flushMicrotasks();
    });

    const secondUserObjectSameUid = {
      uid: "user-1",
      email: "user1@example.com",
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: {} }),
    };

    await act(async () => {
      await authStateChangedCallback?.(secondUserObjectSameUid);
      await flushMicrotasks();
    });

    expect(mockGetLastNotificationResponse).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockClearLastNotificationResponse).toHaveBeenCalledTimes(1);

    act(() => {
      tree.unmount();
    });
  });

  it("ignores a cached notification response already handled in a previous launch", async () => {
    await AsyncStorage.setItem(
      HANDLED_NOTIFICATION_RESPONSES_KEY,
      JSON.stringify([
        {
          key: DEFAULT_NOTIFICATION_RESPONSE_KEY,
          handledAt: Date.now(),
        },
      ]),
    );

    mockGetLastNotificationResponse.mockReturnValue({
      actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
      notification: {
        request: {
          identifier: "expo-notification-request-1",
          content: {
            data: {
              type: "message_request",
              senderId: "friend-1",
            },
          },
        },
      },
    });

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AuthProvider>
          <React.Fragment />
        </AuthProvider>,
      );
      await flushMicrotasks();
    });

    expect(mockGetLastNotificationResponse).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockClearLastNotificationResponse).toHaveBeenCalledTimes(1);

    act(() => {
      tree.unmount();
    });
  });

  it("does not commit a transient auth null before the same user is restored", async () => {
    mockGetLastNotificationResponse.mockReturnValue(null);

    const observedUids: Array<string | null> = [];
    function Probe() {
      const { currentFirebaseUser } = useAuth();
      React.useEffect(() => {
        observedUids.push(currentFirebaseUser?.uid ?? null);
      }, [currentFirebaseUser?.uid]);
      return null;
    }

    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
      await flushMicrotasks();
    });

    const firstUser = {
      uid: "user-1",
      email: "user1@example.com",
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: {} }),
    };

    await act(async () => {
      await authStateChangedCallback?.(firstUser);
      await flushMicrotasks();
    });

    expect(observedUids[observedUids.length - 1]).toBe("user-1");
    const nullCountAfterInitialRestore = observedUids.filter(
      (uid) => uid === null,
    ).length;

    await act(async () => {
      await authStateChangedCallback?.(null);
      await flushMicrotasks();
    });

    expect(mockConsumeExplicitLogoutIntent).toHaveBeenCalledTimes(1);
    expect(observedUids[observedUids.length - 1]).toBe("user-1");

    const restoredSameUser = {
      uid: "user-1",
      email: "user1@example.com",
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: {} }),
    };

    await act(async () => {
      await authStateChangedCallback?.(restoredSameUser);
      await flushMicrotasks();
    });

    act(() => {
      jest.advanceTimersByTime(2_000);
    });

    await act(async () => {
      await flushMicrotasks();
    });

    expect(observedUids[observedUids.length - 1]).toBe("user-1");
    expect(observedUids.filter((uid) => uid === null)).toHaveLength(
      nullCountAfterInitialRestore,
    );

    act(() => {
      tree.unmount();
    });
  });
});
