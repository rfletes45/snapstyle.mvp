jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn((value) => ({ type: "limit", value })),
  onSnapshot: jest.fn(),
  orderBy: jest.fn((field, direction) => ({
    type: "orderBy",
    field,
    direction,
  })),
  query: jest.fn(),
  Timestamp: {
    fromMillis: jest.fn((value) => ({ toMillis: () => value })),
  },
  where: jest.fn((field, op, value) => ({ type: "where", field, op, value })),
}));

jest.mock("firebase/functions", () => ({
  httpsCallable: jest.fn(),
}));

jest.mock("@/services/database", () => ({
  getDatabase: jest.fn(),
  getDatabaseUnavailableReason: jest.fn(() => "unavailable"),
  isDatabaseRuntimeAvailable: jest.fn(() => false),
}));

jest.mock("@/services/database/messageRepository", () => ({
  getPendingMessages: jest.fn(),
  markMessagePermanentlyFailed: jest.fn(),
  markMessageSynced: jest.fn(),
  markMessageSyncFailed: jest.fn(),
  MAX_MESSAGE_RETRIES: 10,
  updateAttachmentUploadStatus: jest.fn(),
  upsertMessageFromServer: jest.fn(),
}));

jest.mock("@/services/firebase", () => ({
  getFirestoreInstance: jest.fn(),
  getFunctionsInstance: jest.fn(),
}));

jest.mock("@/services/messaging/adapters/groupAdapter", () => ({
  fromGroupMessage: jest.fn(),
  isLegacyGroupMessage: jest.fn(() => false),
}));

jest.mock("@/services/notifications", () => ({
  getNotificationDeviceId: jest.fn(),
}));

jest.mock("@/services/storage", () => ({
  uploadMultipleAttachments: jest.fn(),
}));

const { getConversationSubscriptionQueryPlan } = jest.requireActual(
  "@/services/sync/syncEngine",
) as typeof import("@/services/sync/syncEngine");

describe("syncEngine conversation subscription planning", () => {
  it("uses a bounded newest-message window when no cursor exists", () => {
    expect(getConversationSubscriptionQueryPlan(0)).toEqual({
      orderField: "createdAt",
      lowerBound: null,
      limit: 100,
    });
  });

  it("keeps a bounded lower-bound window when a cursor exists", () => {
    expect(getConversationSubscriptionQueryPlan(1710000000000)).toEqual({
      orderField: "createdAt",
      lowerBound: 1710000000000,
      limit: 100,
    });
  });

  it("treats invalid cursors as missing", () => {
    expect(getConversationSubscriptionQueryPlan(Number.NaN)).toEqual({
      orderField: "createdAt",
      lowerBound: null,
      limit: 100,
    });
  });
});
