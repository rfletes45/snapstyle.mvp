// ──────────────────────────────────────────────────────────
// Template: Leaderboard Descriptor for a New Game
//
// Leaderboard descriptors live in the GameDetailContent JSON
// (see game_detail_content.example.json) but this file
// shows how the descriptor maps to backend metric extraction
// and Firestore structures.
// ──────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════
// 1. LEADERBOARD DESCRIPTOR (in GameDetailContent)
// ═══════════════════════════════════════════════════════════

// This goes inside the GameDetailContent for your game.
// Located in: src/gamesV4/constants.ts (GAME_DETAIL_CONTENT map)

/**
 * Win/Loss descriptor — "Wins" metric pulled from PB subcollection
 *
 * Use this when the game has clear winners and win-count is the
 * primary competitive metric.
 */
const winLossDescriptor = {
  leaderboardDescriptor: {
    title: "Weekly Wins",
    metric: "wins", // Maps to PB field "totalWins"
    format: "integer", // "integer" | "decimal" | "time" | "score"
    label: "Wins", // Column header in leaderboard UI
    sortOrder: "desc" as const, // "desc" (higher is better) | "asc" (lower is better, e.g. speed runs)
  },
};

/**
 * Score-based descriptor — "Best Score" metric
 *
 * Use this for games where high score matters more than win/loss.
 * The metric name must match the field stored in the resolved
 * leaderboard entry.
 */
const scoreDescriptor = {
  leaderboardDescriptor: {
    title: "Weekly Best Score",
    metric: "bestScore", // Maps to PB field "bestScore"
    format: "score",
    label: "Score",
    sortOrder: "desc" as const,
  },
};

/**
 * Time-based descriptor — "Fastest Time"
 *
 * Use this for speed-based games where lower times are better.
 */
const timeDescriptor = {
  leaderboardDescriptor: {
    title: "Fastest Completion",
    metric: "bestTime",
    format: "time", // Rendered as mm:ss or similar
    label: "Time",
    sortOrder: "asc" as const, // Lower is better
  },
};

// ═══════════════════════════════════════════════════════════
// 2. BACKEND METRIC EXTRACTION
// ═══════════════════════════════════════════════════════════

// In resolve.ts → resolveSessionV4Internal, leaderboard metrics
// are extracted during Phase 7 (Leaderboard Update).
// The backend does the following for each participant:
//
//   Leaderboard/{gameId}/weekly/{weekKey}/entries/{uid}
//
// Example entry:
//   {
//     uid: "abc123",
//     displayName: "Player One",
//     photoURL: "https://...",
//     value: 42,          // The metric value (wins, score, time, etc.)
//     updatedAt: Timestamp
//   }
//
// The "value" field is populated based on the metric name
// from the descriptor:
//
//   metric: "wins"      → value = pb.totalWins
//   metric: "bestScore" → value = pb.bestScore (set via max())
//   metric: "bestTime"  → value = pb.bestTime  (set via min())

// ═══════════════════════════════════════════════════════════
// 3. FIRESTORE LEADERBOARD STRUCTURE
// ═══════════════════════════════════════════════════════════

// Collection path:
//   Leaderboard/{gameId}/weekly/{weekKey}/entries/{uid}
//
// Week key format: "2025-W03" (ISO week)
//
// Global leaderboard: queries all entries for the week
// Friends leaderboard: queries where uid IN friendsList
//
// Composite index required in firestore.indexes.json:
//   {
//     "collectionGroup": "entries",
//     "queryScope": "COLLECTION",
//     "fields": [
//       { "fieldPath": "value", "order": "DESCENDING" }
//     ]
//   }

// ═══════════════════════════════════════════════════════════
// 4. PERSONAL BEST (PB) DOC — feeds leaderboard metrics
// ═══════════════════════════════════════════════════════════

// Path: GamePBs/{uid}/games/{gameId}
//
// Standard fields (auto-managed by resolve.ts):
//   totalPlays:  number (incremented every resolution)
//   totalWins:   number (incremented on win)
//   bestScore:   number (set via Math.max on resolution)
//   bestTime:    number (set via Math.min on resolution)
//   lastPlayedAt: Timestamp
//
// You do NOT need to add PB logic for standard metrics.
// For custom metrics, add extraction logic in resolve.ts
// inside the Phase 4 (PB Update) block.

// ═══════════════════════════════════════════════════════════
// 5. SCOREBOARD DESCRIPTOR (per-game-instance results)
// ═══════════════════════════════════════════════════════════

// The scoreboard shows per-player results at game over.
// It's distinct from the leaderboard (which is a weekly aggregate).
//
// Defined in GameDetailContent:
const scoreboardDescriptor = {
  scoreboardDescriptor: {
    primaryMetric: "score", // Field from GameResultPlayerV4
    primaryLabel: "Score", // Column header
    secondaryMetric: "moves", // Optional additional column
    secondaryLabel: "Moves",
    showOutcome: true, // Shows "Won" / "Lost" / "Draw"
  },
};

// ═══════════════════════════════════════════════════════════
// CHECKLIST
// ═══════════════════════════════════════════════════════════
// □ Add leaderboardDescriptor to GameDetailContent for your game
// □ Ensure PB fields align with metric name in descriptor
// □ Add scoreboardDescriptor if game has per-session scoring
// □ Add Firestore composite index if using custom sort order
// □ Test with `npm run test -- --grep "leaderboard"` to verify metric extraction
// □ Verify weekly reset works (watch firestore console for new week keys)
