/**
 * Chess Game End-to-End Tests
 * Phase 7: Testing Requirements
 *
 * E2E tests using Detox for full game flow testing.
 * These tests run on device/emulator and test the complete UI flow.
 *
 * Prerequisites:
 * - Detox configured in package.json
 * - Test user accounts created
 * - Backend running
 *
 * @see https://wix.github.io/Detox/
 */

/**
 * NOTE: These are E2E test stubs showing the structure and patterns.
 * Actual implementation requires Detox setup and device configuration.
 *
 * To run these tests:
 * 1. npm install -g detox-cli
 * 2. npm install detox --save-dev
 * 3. Configure detox in package.json
 * 4. Build test app: detox build --configuration ios.sim.debug
 * 5. Run tests: detox test --configuration ios.sim.debug
 */

// Detox globals (when Detox is configured)
declare const device: {
  launchApp: (params?: { newInstance?: boolean }) => Promise<void>;
  reloadReactNative: () => Promise<void>;
  terminateApp: () => Promise<void>;
};

declare const element: (matcher: any) => {
  tap: () => Promise<void>;
  longPress: () => Promise<void>;
  typeText: (text: string) => Promise<void>;
  clearText: () => Promise<void>;
  scroll: (pixels: number, direction: "up" | "down") => Promise<void>;
  swipe: (direction: "left" | "right" | "up" | "down") => Promise<void>;
};

declare const expect: (element: any) => {
  toBeVisible: () => Promise<void>;
  toExist: () => Promise<void>;
  toHaveText: (text: string) => Promise<void>;
  toHaveId: (id: string) => Promise<void>;
  not: {
    toBeVisible: () => Promise<void>;
    toExist: () => Promise<void>;
  };
};

declare const by: {
  id: (id: string) => any;
  text: (text: string) => any;
  label: (label: string) => any;
  type: (type: string) => any;
};

declare const waitFor: (element: any) => {
  toBeVisible: () => { withTimeout: (ms: number) => Promise<void> };
  toExist: () => { withTimeout: (ms: number) => Promise<void> };
  not: {
    toBeVisible: () => { withTimeout: (ms: number) => Promise<void> };
    toExist: () => { withTimeout: (ms: number) => Promise<void> };
  };
};

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Login as test user
 */
async function loginAsTestUser(
  email: string = "test@example.com",
  password: string = "testpass123",
): Promise<void> {
  // Check if already logged in
  try {
    await expect(element(by.id("games-tab"))).toBeVisible();
    return; // Already logged in
  } catch {
    // Need to log in
  }

  await element(by.id("email-input")).typeText(email);
  await element(by.id("password-input")).typeText(password);
  await element(by.id("login-button")).tap();

  await waitFor(element(by.id("home-screen")))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Navigate to Games Hub
 */
async function navigateToGamesHub(): Promise<void> {
  await element(by.id("games-tab")).tap();
  await waitFor(element(by.text("Games")))
    .toBeVisible()
    .withTimeout(3000);
}

/**
 * Wait for element with logging
 */
async function waitForElement(
  testId: string,
  timeout: number = 5000,
): Promise<void> {
  console.log(`Waiting for element: ${testId}`);
  await waitFor(element(by.id(testId)))
    .toBeVisible()
    .withTimeout(timeout);
}

// =============================================================================
// Chess Game E2E Tests
// =============================================================================

describe("Chess Game E2E", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await loginAsTestUser();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it("should navigate to Games Hub", async () => {
    await navigateToGamesHub();
    await expect(element(by.text("Games"))).toBeVisible();
  });

  it("should display game categories", async () => {
    await navigateToGamesHub();

    await expect(element(by.id("category-quick-play"))).toBeVisible();
    await expect(element(by.id("category-puzzle"))).toBeVisible();
    await expect(element(by.id("category-multiplayer"))).toBeVisible();
  });

  it("should open chess game", async () => {
    await navigateToGamesHub();

    await element(by.id("category-multiplayer")).tap();
    await element(by.id("game-card-chess")).tap();

    await waitForElement("chess-options-screen", 3000);
  });

  it("should show challenge friend option", async () => {
    await navigateToGamesHub();

    await element(by.id("challenge-friend-button")).tap();

    await expect(element(by.text("Select Game"))).toBeVisible();
    await expect(element(by.text("Chess"))).toBeVisible();
  });

  it("should complete a full chess game flow", async () => {
    // Navigate to Games Hub
    await navigateToGamesHub();

    // Challenge a friend
    await element(by.id("challenge-friend-button")).tap();
    await element(by.text("Chess")).tap();
    await element(by.text("TestFriend")).tap();

    // Wait for friend to accept (simulated in test environment)
    await waitFor(element(by.text("Game Started!")))
      .toBeVisible()
      .withTimeout(10000);

    // Make a move
    await element(by.id("square-e2")).tap();
    await element(by.id("square-e4")).tap();

    // Verify move made
    await expect(element(by.id("move-1"))).toHaveText("1. e4");

    // Wait for opponent move (simulated)
    await waitFor(element(by.id("move-2")))
      .toBeVisible()
      .withTimeout(10000);

    // Resign the game
    await element(by.id("menu-button")).tap();
    await element(by.id("resign-button")).tap();
    await element(by.text("Confirm")).tap();

    // Verify game over screen
    await expect(element(by.text("Game Over"))).toBeVisible();
    await expect(element(by.text("You Lost"))).toBeVisible();
  });

  it("should show game invites notification", async () => {
    await navigateToGamesHub();

    // Check invite badge exists
    await expect(element(by.id("invite-badge"))).toBeVisible();

    // Open invites
    await element(by.id("pending-invites")).tap();

    // Verify invites list visible
    await expect(element(by.id("invites-list"))).toBeVisible();
  });

  it("should accept game invite", async () => {
    await navigateToGamesHub();

    // Open invites
    await element(by.id("pending-invites")).tap();

    // Accept first invite
    await element(by.id("accept-invite-0")).tap();

    // Verify navigated to game
    await waitFor(element(by.id("chess-board")))
      .toBeVisible()
      .withTimeout(5000);
  });

  it("should decline game invite", async () => {
    await navigateToGamesHub();

    await element(by.id("pending-invites")).tap();
    await element(by.id("decline-invite-0")).tap();

    // Confirm decline
    await element(by.text("Decline")).tap();

    // Invite should be removed
    await expect(element(by.id("invite-0"))).not.toExist();
  });

  it("should show active games", async () => {
    await navigateToGamesHub();

    await element(by.id("active-games-section")).tap();

    await expect(element(by.id("active-games-list"))).toBeVisible();
  });

  it("should resume active game", async () => {
    await navigateToGamesHub();

    await element(by.id("active-games-section")).tap();
    await element(by.id("active-game-0")).tap();

    // Should navigate to game with current state
    await waitFor(element(by.id("chess-board")))
      .toBeVisible()
      .withTimeout(5000);
  });
});

// =============================================================================
// Single Player Game E2E Tests
// =============================================================================

describe("Single Player Games E2E", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await loginAsTestUser();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it("should play Flappy Snap", async () => {
    await navigateToGamesHub();

    await element(by.id("category-quick-play")).tap();
    await element(by.id("game-card-flappy-snap")).tap();

    // Wait for game to load
    await waitFor(element(by.id("flappy-game-canvas")))
      .toBeVisible()
      .withTimeout(3000);

    // Tap to start
    await element(by.id("flappy-game-canvas")).tap();

    // Tap a few times to play
    for (let i = 0; i < 5; i++) {
      await element(by.id("flappy-game-canvas")).tap();
      await new Promise((r) => setTimeout(r, 300));
    }

    // Eventually game over
    await waitFor(element(by.id("game-over-modal")))
      .toBeVisible()
      .withTimeout(30000);

    await expect(element(by.text("Game Over"))).toBeVisible();
  });

  it("should play Memory Snap", async () => {
    await navigateToGamesHub();

    await element(by.id("category-puzzle")).tap();
    await element(by.id("game-card-memory-snap")).tap();

    // Wait for game to load
    await waitFor(element(by.id("memory-game-board")))
      .toBeVisible()
      .withTimeout(3000);

    // Tap first card
    await element(by.id("card-0")).tap();

    // Verify card flips
    await expect(element(by.id("card-0-revealed"))).toBeVisible();
  });

  it("should show personal best", async () => {
    await navigateToGamesHub();

    await element(by.id("category-quick-play")).tap();

    // Game card should show personal best
    await expect(element(by.id("flappy-snap-personal-best"))).toBeVisible();
  });

  it("should show leaderboard rank", async () => {
    await navigateToGamesHub();

    await element(by.id("category-quick-play")).tap();
    await element(by.id("game-card-flappy-snap")).longPress();

    // Should show details including rank
    await expect(element(by.id("leaderboard-rank"))).toBeVisible();
  });
});

// =============================================================================
// Daily Challenge E2E Tests
// =============================================================================

describe("Daily Challenge E2E", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await loginAsTestUser();
  });

  it("should show daily challenge on Games Hub", async () => {
    await navigateToGamesHub();

    await expect(element(by.id("daily-challenge-card"))).toBeVisible();
  });

  it("should show challenge countdown", async () => {
    await navigateToGamesHub();

    await expect(element(by.id("challenge-countdown"))).toBeVisible();
  });

  it("should play daily challenge", async () => {
    await navigateToGamesHub();

    await element(by.id("daily-challenge-card")).tap();

    // Should navigate to challenge game
    await waitFor(element(by.id("challenge-game-screen")))
      .toBeVisible()
      .withTimeout(3000);
  });

  it("should mark completed challenge", async () => {
    await navigateToGamesHub();

    // After completing challenge, card should show completed state
    await expect(element(by.id("challenge-completed-badge"))).toBeVisible();
  });
});

// =============================================================================
// Matchmaking E2E Tests
// =============================================================================

describe("Matchmaking E2E", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await loginAsTestUser();
  });

  it("should enter matchmaking queue", async () => {
    await navigateToGamesHub();

    await element(by.id("category-multiplayer")).tap();
    await element(by.id("game-card-chess")).tap();
    await element(by.id("find-match-button")).tap();

    // Should show matchmaking modal
    await expect(element(by.id("matchmaking-modal"))).toBeVisible();
    await expect(element(by.text("Finding opponent..."))).toBeVisible();
  });

  it("should show estimated wait time", async () => {
    await navigateToGamesHub();

    await element(by.id("category-multiplayer")).tap();
    await element(by.id("game-card-chess")).tap();
    await element(by.id("find-match-button")).tap();

    await expect(element(by.id("estimated-wait-time"))).toBeVisible();
  });

  it("should allow canceling matchmaking", async () => {
    await navigateToGamesHub();

    await element(by.id("category-multiplayer")).tap();
    await element(by.id("game-card-chess")).tap();
    await element(by.id("find-match-button")).tap();

    await element(by.id("cancel-matchmaking")).tap();

    await expect(element(by.id("matchmaking-modal"))).not.toBeVisible();
  });
});

// =============================================================================
// Achievement E2E Tests
// =============================================================================

describe("Achievement E2E", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await loginAsTestUser();
  });

  it("should show achievement toast on unlock", async () => {
    // This test assumes achievements are triggered by gameplay
    // The toast should appear after unlocking

    await navigateToGamesHub();

    // Play a game that triggers achievement
    await element(by.id("category-quick-play")).tap();
    await element(by.id("game-card-reaction-tap")).tap();

    // Play game...
    await element(by.id("tap-target")).tap();

    // Achievement toast should appear
    await waitFor(element(by.id("achievement-toast")))
      .toBeVisible()
      .withTimeout(10000);
  });

  it("should navigate to achievements from toast", async () => {
    // When achievement toast is visible
    await element(by.id("achievement-toast")).tap();

    // Should navigate to achievements screen
    await expect(element(by.id("achievements-screen"))).toBeVisible();
  });
});
