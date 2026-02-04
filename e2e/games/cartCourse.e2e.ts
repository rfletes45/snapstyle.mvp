/**
 * Cart Course Game End-to-End Tests
 * Phase 8: E2E Testing
 *
 * E2E tests using Detox for full game flow testing.
 * These tests run on device/emulator and test the complete UI flow.
 *
 * Prerequisites:
 * - Detox configured in package.json
 * - Test user accounts created
 * - Accelerometer simulation enabled
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
  shake: () => Promise<void>;
  setOrientation: (orientation: "portrait" | "landscape") => Promise<void>;
  setLocation: (lat: number, lon: number) => Promise<void>;
};

declare const element: (matcher: any) => {
  tap: () => Promise<void>;
  longPress: () => Promise<void>;
  multiTap: (times: number) => Promise<void>;
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
  toHaveValue: (value: string) => Promise<void>;
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
  email: string = "cartcourse-test@example.com",
  password: string = "testpass123",
): Promise<void> {
  // Check if already logged in
  try {
    await expect(element(by.id("games-hub-screen"))).toBeVisible();
    return; // Already logged in
  } catch {
    // Need to login
  }

  await element(by.id("login-email-input")).typeText(email);
  await element(by.id("login-password-input")).typeText(password);
  await element(by.id("login-submit-button")).tap();

  await waitFor(element(by.id("main-tab-bar")))
    .toBeVisible()
    .withTimeout(10000);
}

/**
 * Navigate to Cart Course game from Games Hub
 */
async function navigateToCartCourse(): Promise<void> {
  await element(by.id("tab-play")).tap();
  await waitFor(element(by.id("games-hub-screen")))
    .toBeVisible()
    .withTimeout(5000);

  // Scroll to find Cart Course if needed
  await element(by.id("games-list")).scroll(300, "down");
  await element(by.id("game-card-cart-course")).tap();

  await waitFor(element(by.id("cart-course-lobby")))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Start a course
 */
async function startCourse(courseId: string = "course_1"): Promise<void> {
  await element(by.id(`course-select-${courseId}`)).tap();
  await element(by.id("start-game-button")).tap();

  // Wait for countdown
  await waitFor(element(by.id("cart-course-game")))
    .toBeVisible()
    .withTimeout(5000);
}

/**
 * Simulate device tilt (platform specific)
 */
async function simulateTilt(x: number, y: number): Promise<void> {
  // This would use platform-specific APIs to simulate accelerometer
  // On iOS simulator: xcrun simctl ...
  // On Android emulator: adb emu sensor set acceleration ...
  console.log(`[E2E] Simulating tilt: x=${x}, y=${y}`);
}

/**
 * Wait for game to load
 */
async function waitForGameLoad(): Promise<void> {
  await waitFor(element(by.id("cart-course-hud")))
    .toBeVisible()
    .withTimeout(10000);

  // Wait for tutorial countdown if first time
  try {
    await waitFor(element(by.id("tutorial-overlay")))
      .not.toBeVisible()
      .withTimeout(5000);
  } catch {
    // Tutorial might not show, that's okay
  }
}

/**
 * Pause the game
 */
async function pauseGame(): Promise<void> {
  await element(by.id("pause-button")).tap();
  await waitFor(element(by.id("pause-menu")))
    .toBeVisible()
    .withTimeout(2000);
}

/**
 * Resume the game
 */
async function resumeGame(): Promise<void> {
  await element(by.id("resume-button")).tap();
  await waitFor(element(by.id("pause-menu")))
    .not.toBeVisible()
    .withTimeout(2000);
}

// =============================================================================
// Cart Course E2E Tests
// =============================================================================

describe("Cart Course Game E2E", () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await loginAsTestUser();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  // ===========================================================================
  // Navigation Tests
  // ===========================================================================

  describe("Navigation", () => {
    it("should navigate to Cart Course from Games Hub", async () => {
      await navigateToCartCourse();
      await expect(element(by.id("cart-course-lobby"))).toBeVisible();
    });

    it("should display all courses in lobby", async () => {
      await navigateToCartCourse();

      await expect(element(by.id("course-select-course_1"))).toBeVisible();
      // Course 2 should be visible but may be locked
      await expect(element(by.id("course-select-course_2"))).toExist();
    });

    it("should show locked state for unavailable courses", async () => {
      await navigateToCartCourse();

      // Course 2 should be locked for new users
      await expect(element(by.id("course-locked-course_2"))).toBeVisible();
    });

    it("should navigate to stamps screen", async () => {
      await navigateToCartCourse();
      await element(by.id("stamps-button")).tap();

      await expect(element(by.id("stamps-screen"))).toBeVisible();
    });

    it("should navigate to leaderboard", async () => {
      await navigateToCartCourse();
      await element(by.id("leaderboard-button")).tap();

      await expect(element(by.id("leaderboard-screen"))).toBeVisible();
    });

    it("should navigate back from lobby", async () => {
      await navigateToCartCourse();
      await element(by.id("back-button")).tap();

      await expect(element(by.id("games-hub-screen"))).toBeVisible();
    });
  });

  // ===========================================================================
  // Game Start Tests
  // ===========================================================================

  describe("Game Start", () => {
    it("should start Course 1", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");

      await expect(element(by.id("cart-course-game"))).toBeVisible();
    });

    it("should display HUD elements", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      await expect(element(by.id("hud-lives"))).toBeVisible();
      await expect(element(by.id("hud-score"))).toBeVisible();
      await expect(element(by.id("hud-timer"))).toBeVisible();
      await expect(element(by.id("hud-banana-counter"))).toBeVisible();
      await expect(element(by.id("hud-area-indicator"))).toBeVisible();
    });

    it("should display control zones", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      await expect(element(by.id("control-left-button"))).toBeVisible();
      await expect(element(by.id("control-right-button"))).toBeVisible();
    });

    it("should show tutorial for first-time players", async () => {
      // Clear tutorial flag first
      await navigateToCartCourse();
      await element(by.id("settings-button")).tap();
      await element(by.id("reset-tutorial-button")).tap();
      await element(by.id("back-button")).tap();

      await startCourse("course_1");

      await expect(element(by.id("tutorial-overlay"))).toBeVisible();
    });

    it("should skip tutorial when already completed", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");

      // Tutorial should not appear for returning players
      await expect(element(by.id("cart-course-game"))).toBeVisible();
      // Just wait briefly and confirm game is playing
      await waitForGameLoad();
    });
  });

  // ===========================================================================
  // Pause/Resume Tests
  // ===========================================================================

  describe("Pause and Resume", () => {
    it("should pause game when pause button tapped", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      await pauseGame();

      await expect(element(by.id("pause-menu"))).toBeVisible();
      await expect(element(by.id("resume-button"))).toBeVisible();
      await expect(element(by.id("restart-button"))).toBeVisible();
      await expect(element(by.id("quit-button"))).toBeVisible();
    });

    it("should resume game when resume button tapped", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      await pauseGame();
      await resumeGame();

      await expect(element(by.id("pause-menu"))).not.toBeVisible();
      await expect(element(by.id("cart-course-game"))).toBeVisible();
    });

    it("should restart course from pause menu", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      await pauseGame();
      await element(by.id("restart-button")).tap();

      // Should show confirmation
      await expect(element(by.id("confirm-dialog"))).toBeVisible();
      await element(by.id("confirm-yes")).tap();

      // Should restart at beginning
      await waitForGameLoad();
      await expect(element(by.id("hud-area-indicator"))).toHaveText(
        "Area 1/10",
      );
    });

    it("should quit to lobby from pause menu", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      await pauseGame();
      await element(by.id("quit-button")).tap();

      // Should show confirmation
      await expect(element(by.id("confirm-dialog"))).toBeVisible();
      await element(by.id("confirm-yes")).tap();

      await expect(element(by.id("cart-course-lobby"))).toBeVisible();
    });
  });

  // ===========================================================================
  // Control Tests
  // ===========================================================================

  describe("Controls", () => {
    it("should respond to L button press", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      await element(by.id("control-left-button")).tap();
      // Verify L button activated (visual indicator)
      await expect(element(by.id("l-button-active"))).toBeVisible();
    });

    it("should respond to R button press", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      await element(by.id("control-right-button")).tap();
      // Verify R button activated
      await expect(element(by.id("r-button-active"))).toBeVisible();
    });

    it("should respond to long press for hold mechanisms", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      await element(by.id("control-left-button")).longPress();
      // Verify mechanism is in held state
      await expect(element(by.id("mechanism-held-indicator"))).toBeVisible();
    });

    it("should calibrate tilt when calibrate button tapped", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      await pauseGame();
      await element(by.id("calibrate-button")).tap();

      await expect(element(by.id("calibration-screen"))).toBeVisible();
      await element(by.id("calibrate-confirm")).tap();

      await expect(element(by.id("calibration-success"))).toBeVisible();
    });
  });

  // ===========================================================================
  // Crash and Respawn Tests
  // ===========================================================================

  describe("Crash and Respawn", () => {
    it("should show crash animation on fatal impact", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      // Tilt hard to cause crash (implementation would need accelerometer simulation)
      await simulateTilt(1.0, 0);

      // Wait for potential crash
      await waitFor(element(by.id("crash-overlay")))
        .toBeVisible()
        .withTimeout(10000);
    });

    it("should decrement lives on crash", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      // Initial lives should be 3
      await expect(element(by.id("hud-lives"))).toHaveText("3");

      // Cause a crash (would need accelerometer simulation)
      // After crash, lives should be 2
      // This test stub shows the pattern
    });

    it("should respawn at checkpoint after crash", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      // Progress to Area 2, then crash
      // Should respawn at Area 2 checkpoint
      // This test stub shows the pattern
    });

    it("should show game over when all lives lost", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      // Crash 3 times
      // Should show game over screen
      await waitFor(element(by.id("game-over-screen")))
        .toBeVisible()
        .withTimeout(60000);
    });
  });

  // ===========================================================================
  // Collectible Tests
  // ===========================================================================

  describe("Collectibles", () => {
    it("should update banana counter when collecting", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      // Initial counter
      await expect(element(by.id("hud-banana-counter"))).toHaveText("0");

      // Collect a banana (would need game interaction simulation)
      // Counter should update
    });

    it("should update score when collecting items", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      // Initial score
      await expect(element(by.id("hud-score"))).toHaveText("0");

      // Collect items (would need game interaction simulation)
      // Score should update
    });
  });

  // ===========================================================================
  // Checkpoint Tests
  // ===========================================================================

  describe("Checkpoints", () => {
    it("should show checkpoint reached notification", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      // Progress to checkpoint
      // Should show checkpoint notification
      await waitFor(element(by.id("checkpoint-notification")))
        .toBeVisible()
        .withTimeout(120000);
    });

    it("should update area indicator at checkpoint", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      await expect(element(by.id("hud-area-indicator"))).toHaveText(
        "Area 1/10",
      );

      // Progress to Area 2
      // Indicator should update
    });
  });

  // ===========================================================================
  // Completion Tests
  // ===========================================================================

  describe("Course Completion", () => {
    it("should show results screen on course completion", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      // Complete the course (this would take time in real E2E)
      await waitFor(element(by.id("results-screen")))
        .toBeVisible()
        .withTimeout(600000); // 10 minute timeout
    });

    it("should display score breakdown on results", async () => {
      // After completing course
      await expect(element(by.id("results-final-score"))).toBeVisible();
      await expect(element(by.id("results-time"))).toBeVisible();
      await expect(element(by.id("results-bananas"))).toBeVisible();
      await expect(element(by.id("results-stars"))).toBeVisible();
    });

    it("should show new record indicator for personal best", async () => {
      // After beating personal best
      await expect(element(by.id("new-record-indicator"))).toBeVisible();
    });

    it("should unlock Course 2 after completing Course 1", async () => {
      // After completing Course 1
      await element(by.id("continue-button")).tap();

      await expect(element(by.id("cart-course-lobby"))).toBeVisible();
      await expect(element(by.id("course-unlocked-course_2"))).toBeVisible();
    });
  });

  // ===========================================================================
  // Stamps/Achievements Tests
  // ===========================================================================

  describe("Stamps", () => {
    it("should show stamp earned notification", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      // Complete course to earn "First Finish" stamp
      await waitFor(element(by.id("stamp-earned-notification")))
        .toBeVisible()
        .withTimeout(600000);
    });

    it("should display earned stamps in stamps screen", async () => {
      await navigateToCartCourse();
      await element(by.id("stamps-button")).tap();

      await expect(element(by.id("stamp-first_finish"))).toBeVisible();
    });

    it("should show stamp progress for incomplete stamps", async () => {
      await navigateToCartCourse();
      await element(by.id("stamps-button")).tap();

      // Find a stamp in progress
      await expect(element(by.id("stamp-progress-banana_lover"))).toExist();
    });
  });

  // ===========================================================================
  // Leaderboard Tests
  // ===========================================================================

  describe("Leaderboard", () => {
    it("should display weekly leaderboard", async () => {
      await navigateToCartCourse();
      await element(by.id("leaderboard-button")).tap();

      await expect(element(by.id("leaderboard-global-tab"))).toBeVisible();
      await expect(element(by.id("leaderboard-list"))).toBeVisible();
    });

    it("should switch between global and friends tabs", async () => {
      await navigateToCartCourse();
      await element(by.id("leaderboard-button")).tap();

      await element(by.id("leaderboard-friends-tab")).tap();
      await expect(element(by.id("friends-leaderboard-list"))).toBeVisible();

      await element(by.id("leaderboard-global-tab")).tap();
      await expect(element(by.id("global-leaderboard-list"))).toBeVisible();
    });

    it("should highlight user's rank in leaderboard", async () => {
      await navigateToCartCourse();
      await element(by.id("leaderboard-button")).tap();

      await expect(element(by.id("user-leaderboard-entry"))).toBeVisible();
    });
  });

  // ===========================================================================
  // Cart Skins Tests
  // ===========================================================================

  describe("Cart Skins", () => {
    it("should display available skins", async () => {
      await navigateToCartCourse();
      await element(by.id("skins-button")).tap();

      await expect(element(by.id("skin-skin_default"))).toBeVisible();
    });

    it("should show locked state for unavailable skins", async () => {
      await navigateToCartCourse();
      await element(by.id("skins-button")).tap();

      await expect(element(by.id("skin-locked-skin_golden"))).toBeVisible();
    });

    it("should select a skin", async () => {
      await navigateToCartCourse();
      await element(by.id("skins-button")).tap();

      await element(by.id("skin-skin_default")).tap();
      await element(by.id("select-skin-button")).tap();

      await expect(element(by.id("skin-selected-skin_default"))).toBeVisible();
    });

    it("should use selected skin in game", async () => {
      await navigateToCartCourse();
      await element(by.id("skins-button")).tap();
      await element(by.id("skin-skin_blue")).tap();
      await element(by.id("select-skin-button")).tap();
      await element(by.id("back-button")).tap();

      await startCourse("course_1");
      await waitForGameLoad();

      // Cart should display with blue skin
      await expect(element(by.id("cart-skin-blue"))).toBeVisible();
    });
  });

  // ===========================================================================
  // Game Modes Tests
  // ===========================================================================

  describe("Game Modes", () => {
    it("should display available modes", async () => {
      await navigateToCartCourse();
      await element(by.id("modes-button")).tap();

      await expect(element(by.id("mode-mode_standard"))).toBeVisible();
    });

    it("should show locked state for unavailable modes", async () => {
      await navigateToCartCourse();
      await element(by.id("modes-button")).tap();

      await expect(element(by.id("mode-locked-mode_mirror"))).toBeVisible();
    });

    it("should select a mode", async () => {
      await navigateToCartCourse();
      await element(by.id("modes-button")).tap();

      await element(by.id("mode-mode_standard")).tap();
      await element(by.id("select-mode-button")).tap();

      await expect(element(by.id("mode-selected-mode_standard"))).toBeVisible();
    });

    it("should apply Time Attack mode rules", async () => {
      // First unlock Time Attack by completing a course
      // Then select and start with Time Attack mode

      await navigateToCartCourse();
      await element(by.id("modes-button")).tap();
      await element(by.id("mode-mode_time_attack")).tap();
      await element(by.id("select-mode-button")).tap();
      await element(by.id("back-button")).tap();

      await startCourse("course_1");
      await waitForGameLoad();

      // Timer should count up in Time Attack
      await expect(element(by.id("hud-timer-counting-up"))).toBeVisible();
      // No lives display in Time Attack
      await expect(element(by.id("hud-lives"))).not.toBeVisible();
    });
  });

  // ===========================================================================
  // Orientation Tests
  // ===========================================================================

  describe("Orientation", () => {
    it("should work in landscape mode", async () => {
      await device.setOrientation("landscape");
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      await expect(element(by.id("cart-course-game"))).toBeVisible();
      await expect(element(by.id("cart-course-hud"))).toBeVisible();
    });

    it("should work in portrait mode", async () => {
      await device.setOrientation("portrait");
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      await expect(element(by.id("cart-course-game"))).toBeVisible();
    });
  });

  // ===========================================================================
  // Performance Tests
  // ===========================================================================

  describe("Performance", () => {
    it("should maintain acceptable frame rate", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      // Run for 30 seconds
      await new Promise((resolve) => setTimeout(resolve, 30000));

      // Check performance metrics (would need custom instrumentation)
      await expect(element(by.id("performance-warning"))).not.toBeVisible();
    });

    it("should not crash during extended play", async () => {
      await navigateToCartCourse();
      await startCourse("course_1");
      await waitForGameLoad();

      // Play for 5 minutes
      await new Promise((resolve) => setTimeout(resolve, 300000));

      // Game should still be running
      await expect(element(by.id("cart-course-game"))).toBeVisible();
    });
  });
});
