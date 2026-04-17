const mockGetAuthInstance = jest.fn();
const mockGetFirestoreInstance = jest.fn(() => ({}));
const mockCollection = jest.fn(() => ({ path: "history" }));
const mockQuery = jest.fn((...args: unknown[]) => ({ args }));
const mockOrderBy = jest.fn(() => ({ type: "orderBy" }));
const mockLimit = jest.fn((value: number) => ({ type: "limit", value }));
const mockWhere = jest.fn((...args: unknown[]) => ({ type: "where", args }));
const mockGetDocs = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock("../../src/services/firebase", () => ({
  getAuthInstance: () => mockGetAuthInstance(),
  getFirestoreInstance: () => mockGetFirestoreInstance(),
}));

jest.mock("../../src/utils/log", () => ({
  createLogger: () => ({
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

import {
  getStreamCallHistory,
  subscribeToStreamCallHistory,
} from "../../src/services/stream/streamCallHistoryService";

describe("streamCallHistoryService startup retries", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockGetAuthInstance.mockReturnValue({
      currentUser: { uid: "user-1" },
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("retries getStreamCallHistory after transient permission delays", async () => {
    const permissionError = Object.assign(
      new Error("Missing or insufficient permissions"),
      {
        code: "permission-denied",
      },
    );

    mockGetDocs.mockRejectedValueOnce(permissionError).mockResolvedValueOnce({
      docs: [
        {
          data: () => ({ id: "entry-1", entryType: "voice_room" }),
        },
      ],
    });

    const pending = getStreamCallHistory();
    await Promise.resolve();

    jest.advanceTimersByTime(500);
    await Promise.resolve();

    const result = await pending;

    expect(mockGetDocs).toHaveBeenCalledTimes(2);
    expect(result).toEqual([{ id: "entry-1", entryType: "voice_room" }]);
  });

  it("retries subscribeToStreamCallHistory after transient permission delays", async () => {
    const permissionError = Object.assign(
      new Error("Missing or insufficient permissions"),
      {
        code: "permission-denied",
      },
    );
    const secondUnsubscribe = jest.fn();
    const onUpdate = jest.fn();
    const onError = jest.fn();

    mockOnSnapshot
      .mockImplementationOnce(
        (
          _query: unknown,
          _onNext: (snapshot: unknown) => void,
          snapshotError: (error: Error) => void,
        ) => {
          snapshotError(permissionError);
          return jest.fn();
        },
      )
      .mockImplementationOnce(
        (
          _query: unknown,
          onNext: (snapshot: { docs: Array<{ data: () => unknown }> }) => void,
        ) => {
          onNext({
            docs: [
              {
                data: () => ({ id: "entry-2", entryType: "direct_audio" }),
              },
            ],
          });
          return secondUnsubscribe;
        },
      );

    const unsubscribe = subscribeToStreamCallHistory(onUpdate, 50, onError);

    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    await Promise.resolve();

    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledWith([
      { id: "entry-2", entryType: "direct_audio" },
    ]);
    expect(onError).not.toHaveBeenCalled();

    unsubscribe();
    expect(secondUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
