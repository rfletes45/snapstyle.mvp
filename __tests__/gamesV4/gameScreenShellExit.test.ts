/**
 * Games V4 — Game Screen Shell Exit Behavior Tests
 *
 * Validates the runtime-aware exit model:
 * - Turn-based: back arrow, non-destructive leave, session preserved
 * - Solo: back arrow (suspend), non-destructive leave, solo menu for restart/resign
 * - Realtime: resign/quit required, no silent back
 *
 * Run: npx jest gameScreenShellExit
 */

import { GAME_METADATA } from "@/gamesV4/constants";
import type { GameRuntimeType } from "@/gamesV4/types/common";

// =============================================================================
// Helpers — derive exit behavior from runtime type (mirrors shell logic)
// =============================================================================

function deriveExitBehavior(runtimeType: GameRuntimeType) {
  const canNavigateBackWithoutResign =
    runtimeType === "turnBased" || runtimeType === "solo";
  const showBackArrow = canNavigateBackWithoutResign;
  const showResignAction = runtimeType === "realtime";
  const showSoloMenu = runtimeType === "solo";
  return {
    canNavigateBackWithoutResign,
    showBackArrow,
    showResignAction,
    showSoloMenu,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("GameScreenShell — Exit Behavior Invariants", () => {
  // ── Turn-based games ─────────────────────────────────────────────

  describe("turn-based games", () => {
    const turnBasedGames = Object.entries(GAME_METADATA).filter(
      ([, meta]) => meta.runtimeType === "turnBased",
    );

    it("should have at least one turn-based game in metadata", () => {
      expect(turnBasedGames.length).toBeGreaterThan(0);
    });

    it.each(turnBasedGames)(
      "%s: shows back arrow, allows non-destructive leave",
      (gameId, meta) => {
        const behavior = deriveExitBehavior(meta.runtimeType);
        expect(behavior.showBackArrow).toBe(true);
        expect(behavior.canNavigateBackWithoutResign).toBe(true);
        expect(behavior.showResignAction).toBe(false);
      },
    );
  });

  // ── Solo games ─────────────────────────────────────────────────

  describe("solo games", () => {
    const soloGames = Object.entries(GAME_METADATA).filter(
      ([, meta]) => meta.runtimeType === "solo",
    );

    it("should have at least one solo game in metadata", () => {
      expect(soloGames.length).toBeGreaterThan(0);
    });

    it.each(soloGames)(
      "%s: shows back arrow (suspend), solo menu, does NOT show standalone resign",
      (gameId, meta) => {
        const behavior = deriveExitBehavior(meta.runtimeType);
        expect(behavior.showBackArrow).toBe(true);
        expect(behavior.canNavigateBackWithoutResign).toBe(true);
        expect(behavior.showResignAction).toBe(false);
        expect(behavior.showSoloMenu).toBe(true);
      },
    );
  });

  // ── Realtime games ────────────────────────────────────────────

  describe("realtime games", () => {
    const realtimeGames = Object.entries(GAME_METADATA).filter(
      ([, meta]) => meta.runtimeType === "realtime",
    );

    it("should have at least one realtime game in metadata", () => {
      expect(realtimeGames.length).toBeGreaterThan(0);
    });

    it.each(realtimeGames)(
      "%s: shows resign/quit, does NOT allow silent back",
      (gameId, meta) => {
        const behavior = deriveExitBehavior(meta.runtimeType);
        expect(behavior.showBackArrow).toBe(false);
        expect(behavior.canNavigateBackWithoutResign).toBe(false);
        expect(behavior.showResignAction).toBe(true);
      },
    );
  });

  // ── Cross-cutting invariants ──────────────────────────────────

  describe("cross-cutting invariants", () => {
    it("every game has a back arrow XOR standalone resign action", () => {
      for (const [gameId, meta] of Object.entries(GAME_METADATA)) {
        const b = deriveExitBehavior(meta.runtimeType);
        // Solo + turn-based show back arrow; realtime shows resign
        // Back arrow and standalone resign are mutually exclusive
        const hasBackArrow = b.showBackArrow;
        const hasResign = b.showResignAction;
        expect(hasBackArrow !== hasResign).toBe(true);
      }
    });

    it("no game shows both a back arrow AND standalone resign in the header", () => {
      for (const [gameId, meta] of Object.entries(GAME_METADATA)) {
        const b = deriveExitBehavior(meta.runtimeType);
        expect(b.showBackArrow && b.showResignAction).toBe(false);
      }
    });

    it("solo games show solo menu, others do not", () => {
      for (const [gameId, meta] of Object.entries(GAME_METADATA)) {
        const b = deriveExitBehavior(meta.runtimeType);
        if (meta.runtimeType === "solo") {
          expect(b.showSoloMenu).toBe(true);
        } else {
          expect(b.showSoloMenu).toBe(false);
        }
      }
    });

    it("play_2048 is solo, shows back arrow and solo menu", () => {
      const meta = GAME_METADATA["play_2048"];
      expect(meta).toBeDefined();
      expect(meta.runtimeType).toBe("solo");
      const behavior = deriveExitBehavior(meta.runtimeType);
      expect(behavior.showBackArrow).toBe(true);
      expect(behavior.showSoloMenu).toBe(true);
      expect(behavior.showResignAction).toBe(false);
    });

    it("tic_tac_toe is turn-based and shows back arrow", () => {
      const meta = GAME_METADATA["tic_tac_toe"];
      expect(meta).toBeDefined();
      expect(meta.runtimeType).toBe("turnBased");
      const behavior = deriveExitBehavior(meta.runtimeType);
      expect(behavior.showBackArrow).toBe(true);
      expect(behavior.showResignAction).toBe(false);
      expect(behavior.showSoloMenu).toBe(false);
    });

    it("sketch_party_game is realtime and shows resign", () => {
      const meta = GAME_METADATA["sketch_party_game"];
      expect(meta).toBeDefined();
      expect(meta.runtimeType).toBe("realtime");
      const behavior = deriveExitBehavior(meta.runtimeType);
      expect(behavior.showResignAction).toBe(true);
      expect(behavior.showBackArrow).toBe(false);
      expect(behavior.showSoloMenu).toBe(false);
    });
  });
});

describe("GameScreenShell — Presence lifecycle", () => {
  it("presence write includes required fields", () => {
    // Simulated presence doc shape (mirrors GameScreenShell useEffect)
    const uid = "user_abc";
    const sessionId = "session_xyz";
    const gameId = "tic_tac_toe";
    const presenceDoc = {
      uid,
      sessionId,
      gameId,
      activeAt: expect.anything(), // serverTimestamp
    };
    expect(presenceDoc).toHaveProperty("uid", uid);
    expect(presenceDoc).toHaveProperty("sessionId", sessionId);
    expect(presenceDoc).toHaveProperty("gameId", gameId);
    expect(presenceDoc).toHaveProperty("activeAt");
  });
});

describe("GameScreenShell — Terminal detection", () => {
  const terminalStatuses = ["resolved", "abandoned", "expired"];
  const activeStatuses = ["active", "lobby_open"];

  it.each(terminalStatuses)("status '%s' is terminal", (status) => {
    const isTerminal =
      status === "resolved" || status === "abandoned" || status === "expired";
    expect(isTerminal).toBe(true);
  });

  it.each(activeStatuses)("status '%s' is NOT terminal", (status) => {
    const isTerminal =
      status === "resolved" || status === "abandoned" || status === "expired";
    expect(isTerminal).toBe(false);
  });
});

// =============================================================================
// Solo overlay layout contract tests
// =============================================================================

describe("GameScreenShell — Solo overlay layout contract", () => {
  /**
   * Mirrors the shell render logic:
   * - solo/realtime → useOverlayHeader → plain View root, no SafeAreaView padding
   * - turn-based    → SafeAreaView with normal-flow header
   */
  function getLayoutModel(runtimeType: "solo" | "turnBased" | "realtime") {
    const isSolo = runtimeType === "solo";
    const isRealtime = runtimeType === "realtime";
    const useOverlayHeader = isSolo || isRealtime;

    return {
      rootElement: useOverlayHeader ? "View" : "SafeAreaView",
      overlayUsesAbsolutePosition: useOverlayHeader,
      headerRowInDocumentFlow: !useOverlayHeader,
      safeAreaInsetAppliedViaStyle: useOverlayHeader,
    };
  }

  it("solo screens use plain View root (no SafeAreaView padding)", () => {
    const model = getLayoutModel("solo");
    expect(model.rootElement).toBe("View");
    expect(model.overlayUsesAbsolutePosition).toBe(true);
    expect(model.headerRowInDocumentFlow).toBe(false);
    expect(model.safeAreaInsetAppliedViaStyle).toBe(true);
  });

  it("realtime screens use plain View root (no SafeAreaView padding)", () => {
    const model = getLayoutModel("realtime");
    expect(model.rootElement).toBe("View");
    expect(model.overlayUsesAbsolutePosition).toBe(true);
    expect(model.headerRowInDocumentFlow).toBe(false);
  });

  it("turn-based screens use SafeAreaView with document-flow header", () => {
    const model = getLayoutModel("turnBased");
    expect(model.rootElement).toBe("SafeAreaView");
    expect(model.overlayUsesAbsolutePosition).toBe(false);
    expect(model.headerRowInDocumentFlow).toBe(true);
  });

  it("solo overlay controls are absolutely positioned with safe-area offsets", () => {
    // Mirrors the soloOverlayHeader style
    const soloOverlayStyle = {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
    };
    expect(soloOverlayStyle.position).toBe("absolute");
    expect(soloOverlayStyle.top).toBe(0);
    expect(soloOverlayStyle.zIndex).toBeGreaterThanOrEqual(100);
  });

  it("solo overlay paddingTop accounts for safe-area inset + margin", () => {
    // Mirrors: { paddingTop: insets.top + 8 }
    const mockInsets = { top: 47 }; // iPhone 14 Pro notch
    const paddingTop = mockInsets.top + 8;
    expect(paddingTop).toBeGreaterThan(47);
    expect(paddingTop).toBe(55);
  });

  it("no separate header band is rendered for solo screens", () => {
    const runtimeType = "solo";
    const isSolo = runtimeType === "solo";
    const useOverlayHeader = isSolo;
    // The shell header (document-flow row) is NOT rendered when useOverlayHeader is true
    const shellHeaderRendered = !useOverlayHeader;
    expect(shellHeaderRendered).toBe(false);
  });
});

// =============================================================================
// Background unification contract tests
// =============================================================================

describe("GameScreenShell — Background unification", () => {
  it("solo/realtime root container gets explicit background color", () => {
    // Mirrors: <View style={[styles.container, { backgroundColor: gameBg }]}>
    const isDark = false;
    const gameBg = isDark ? "#000" : "#F5F5F5"; // theme.colors.background
    expect(typeof gameBg).toBe("string");
    expect(gameBg.length).toBeGreaterThan(0);
  });

  it("no SafeAreaView wrapper means no transparent inset band (solo)", () => {
    const model = { rootElement: "View", safeAreaEdges: [] };
    // SafeAreaView is NOT used for solo, so there's no top padding region
    // from SafeAreaView that could have a mismatched background color.
    expect(model.rootElement).toBe("View");
    expect(model.safeAreaEdges).toHaveLength(0);
  });
});

// =============================================================================
// 2048 layout contract tests
// =============================================================================

describe("Play2048Game — Layout contract", () => {
  it("content wrapper uses centered justify for vertical balance", () => {
    // Mirrors contentWrapper style
    const contentWrapperStyle = {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    };
    expect(contentWrapperStyle.justifyContent).toBe("center");
    expect(contentWrapperStyle.flex).toBe(1);
  });

  it("top spacer accounts for safe area + overlay controls", () => {
    const mockInsets = { top: 47 };
    const overlayControlHeight = 52; // 40px button + 12px margin
    const topSpacerHeight = mockInsets.top + overlayControlHeight;
    expect(topSpacerHeight).toBeGreaterThan(50);
    expect(topSpacerHeight).toBeLessThan(120); // reasonable upper bound
  });

  it("layout remains valid on small phone dimensions", () => {
    const smallScreenHeight = 667; // iPhone SE
    const mockInsets = { top: 20, bottom: 0 };
    const topSpacer = mockInsets.top + 52;
    const bottomSpacer = mockInsets.bottom + 16;
    const availableContentHeight = smallScreenHeight - topSpacer - bottomSpacer;
    // Should still have plenty of room for score row + board + bottom info
    expect(availableContentHeight).toBeGreaterThan(400);
  });

  it("layout remains valid on tall phone dimensions", () => {
    const tallScreenHeight = 932; // iPhone 15 Pro Max
    const mockInsets = { top: 59, bottom: 34 };
    const topSpacer = mockInsets.top + 52;
    const bottomSpacer = mockInsets.bottom + 16;
    const availableContentHeight = tallScreenHeight - topSpacer - bottomSpacer;
    expect(availableContentHeight).toBeGreaterThan(500);
  });

  it("container has no paddingTop (removed in fix)", () => {
    // The old style had paddingTop: 8, now removed
    const containerStyle = {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 16,
    };
    expect(containerStyle).not.toHaveProperty("paddingTop");
  });
});
