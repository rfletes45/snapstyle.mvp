jest.mock(
  "firebase-admin",
  () => {
    const firestore = Object.assign(jest.fn(() => ({})), {
      FieldValue: {
        serverTimestamp: jest.fn(),
        increment: jest.fn(),
        delete: jest.fn(),
        arrayUnion: jest.fn(),
      },
      Timestamp: {
        now: jest.fn(() => ({ toMillis: () => 0 })),
      },
    });

    return { firestore };
  },
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

jest.mock("../../firebase-backend/functions/src/chatMedia", () => ({
  commitStagedAttachments: jest.fn(),
}));

jest.mock("../../firebase-backend/functions/src/messageRequests", () => ({
  checkDmAcceptance: jest.fn(),
}));

jest.mock("../../firebase-backend/functions/src/rateLimiter", () => ({
  checkGlobalRateLimit: jest.fn(),
}));

import {
  buildSenderStyleFromChatAppearance,
  normalizeSenderStyleSnapshot,
} from "../../firebase-backend/functions/src/messaging";

describe("messaging senderStyle normalization", () => {
  it("preserves font color fields when normalizing a stamped sender style", () => {
    expect(
      normalizeSenderStyleSnapshot({
        bubbleColorId: "bubble-blue",
        bubbleColorHex: "#0099FF",
        fontId: "font-handwritten",
        fontKey: "handwritten",
        fontColorId: "font-gold",
        fontColorHex: "#FFD700",
        animalThemeId: "animal-fox",
        v: 1,
      }),
    ).toEqual({
      bubbleColorId: "bubble-blue",
      bubbleColorHex: "#0099FF",
      fontId: "font-handwritten",
      fontKey: "handwritten",
      fontColorId: "font-gold",
      fontColorHex: "#FFD700",
      animalThemeId: "animal-fox",
      v: 1,
    });
  });

  it("threads fontColorId through profile-fallback sender style snapshots", () => {
    expect(
      buildSenderStyleFromChatAppearance({
        bubbleColorId: "bubble-blue",
        fontId: "font-handwritten",
        fontColorId: "font-gold",
        animalThemeId: "animal-fox",
      }),
    ).toEqual({
      bubbleColorId: "bubble-blue",
      bubbleColorHex: null,
      fontId: "font-handwritten",
      fontKey: null,
      fontColorId: "font-gold",
      fontColorHex: null,
      animalThemeId: "animal-fox",
      v: 1,
    });
  });
});
