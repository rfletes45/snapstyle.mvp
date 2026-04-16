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

jest.mock("../../src/services/firebase", () => ({
  getAuthInstance: () => mockGetAuthInstance(),
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

jest.mock("../../src/utils/startupTrace", () => ({
  getStartupSessionId: () => "test-startup-session",
  logStartupEvent: jest.fn(),
  logStartupMount: jest.fn(),
  logStartupUnmount: jest.fn(),
  logStartupError: jest.fn(),
}));

import { AuthProvider } from "../../src/store/AuthContext";

describe("AuthContext notification startup replay", () => {
  let authStateChangedCallback:
    | ((user: any) => Promise<void> | void)
    | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

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
        screen: "MainTabs",
        params: {
          screen: "Messages",
        },
      },
    });
    mockShouldHandleNotificationByDedupeKey.mockReturnValue(true);
    mockMarkUserNotificationRead.mockResolvedValue(undefined);

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
      await Promise.resolve();
    });

    expect(mockGetLastNotificationResponse).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("MainTabs", {
      screen: "Messages",
    });
    expect(mockClearLastNotificationResponse).toHaveBeenCalledTimes(1);

    const firstUser = {
      uid: "user-1",
      email: "user1@example.com",
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: {} }),
    };

    await act(async () => {
      await authStateChangedCallback?.(firstUser);
      await Promise.resolve();
    });

    const secondUserObjectSameUid = {
      uid: "user-1",
      email: "user1@example.com",
      getIdTokenResult: jest.fn().mockResolvedValue({ claims: {} }),
    };

    await act(async () => {
      await authStateChangedCallback?.(secondUserObjectSameUid);
      await Promise.resolve();
    });

    expect(mockGetLastNotificationResponse).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockClearLastNotificationResponse).toHaveBeenCalledTimes(1);

    act(() => {
      tree.unmount();
    });
  });
});
