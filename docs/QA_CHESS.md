# QA Checklist — Chess (Games V4)

> Manual test script for the Chess game integration.

## Prerequisites

- App running on device/emulator
- Two test accounts logged in (or use split-screen / two devices)
- Firebase emulators running or connected to dev project

---

## 1. Game Discovery & Launch

| #   | Test                    | Expected                                           | Pass? |
| --- | ----------------------- | -------------------------------------------------- | ----- |
| 1.1 | Open game catalog/list  | Chess appears with ♟ icon, "Chess" title           | ☐     |
| 1.2 | Tap Chess entry         | Game detail shows description, "How to Play", tips | ☐     |
| 1.3 | Tap "Play" from catalog | Lobby/invite screen opens for chess                | ☐     |

## 2. Game Creation & Join

| #   | Test                           | Expected                                        | Pass? |
| --- | ------------------------------ | ----------------------------------------------- | ----- |
| 2.1 | Create game from Play          | Session created, waiting for opponent           | ☐     |
| 2.2 | Create game from Chat (invite) | Chat message with invite appears, tapping joins | ☐     |
| 2.3 | Second player joins            | Game starts, board visible, white moves first   | ☐     |
| 2.4 | Board orientation              | Each player sees their color at the bottom      | ☐     |

## 3. Gameplay — Basic Moves

| #   | Test                              | Expected                                     | Pass? |
| --- | --------------------------------- | -------------------------------------------- | ----- |
| 3.1 | Tap own pawn                      | Square highlights, legal moves shown as dots | ☐     |
| 3.2 | Tap legal target square           | Piece moves, turn switches to opponent       | ☐     |
| 3.3 | Tap opponent's piece on your turn | No selection (ignored)                       | ☐     |
| 3.4 | Try to move out of turn           | Move rejected, stays on opponent's turn      | ☐     |
| 3.5 | Last-move highlight               | Previous move's from/to squares highlighted  | ☐     |
| 3.6 | King-in-check highlight           | King square highlighted red when in check    | ☐     |
| 3.7 | Captured pieces display           | Captured pieces shown above/below board      | ☐     |
| 3.8 | Move list panel                   | Moves appear in algebraic notation list      | ☐     |

## 4. Special Moves

| #   | Test                           | Expected                                              | Pass? |
| --- | ------------------------------ | ----------------------------------------------------- | ----- |
| 4.1 | Castling kingside              | King+rook move together, rights updated               | ☐     |
| 4.2 | Castling queenside             | King+rook move together, rights updated               | ☐     |
| 4.3 | En passant capture             | Diagonal capture removes pawn from correct square     | ☐     |
| 4.4 | Pawn promotion                 | Modal appears on last rank, must choose piece         | ☐     |
| 4.5 | Underpromotion (not queen)     | Can select knight/bishop/rook, piece placed correctly | ☐     |
| 4.6 | Cannot dismiss promotion modal | Modal stays until piece is selected                   | ☐     |

## 5. Draw Mechanics

| #   | Test                            | Expected                                      | Pass? |
| --- | ------------------------------- | --------------------------------------------- | ----- |
| 5.1 | Offer draw                      | "Draw offered" indicator appears for opponent | ☐     |
| 5.2 | Accept draw offer               | Game ends as draw, "draw_agreed" reason       | ☐     |
| 5.3 | Decline draw (make normal move) | Draw offer cleared, game continues            | ☐     |
| 5.4 | Claim threefold repetition      | Only succeeds when position seen 3+ times     | ☐     |
| 5.5 | Claim 50-move rule              | Only succeeds when halfmoveClock >= 100       | ☐     |

## 6. Terminal Conditions

| #   | Test                  | Expected                                            | Pass? |
| --- | --------------------- | --------------------------------------------------- | ----- |
| 6.1 | Checkmate             | Game ends, winner declared, navigates to GameOverV4 | ☐     |
| 6.2 | Stalemate             | Game ends as draw                                   | ☐     |
| 6.3 | Insufficient material | Game ends as draw (K vs K, K+N vs K, etc.)          | ☐     |
| 6.4 | Resignation           | Game ends, resigning player loses                   | ☐     |

## 7. Spectator Mode

| #   | Test                         | Expected                                      | Pass? |
| --- | ---------------------------- | --------------------------------------------- | ----- |
| 7.1 | Third user watches game      | Full board visible, moves update live         | ☐     |
| 7.2 | Spectator flip toggle        | Board flips between white/black perspective   | ☐     |
| 7.3 | No interaction for spectator | Tapping pieces does nothing, no move controls | ☐     |

## 8. Game Over / History

| #   | Test                      | Expected                                       | Pass? |
| --- | ------------------------- | ---------------------------------------------- | ----- |
| 8.1 | GameOverV4 screen appears | Shows result, stats (captures, checks, reason) | ☐     |
| 8.2 | Scoreboard display        | Win/Loss/Draw formatted correctly              | ☐     |
| 8.3 | Game appears in history   | Past games list shows chess session            | ☐     |
| 8.4 | Re-opening completed game | Shows final board state, no further moves      | ☐     |

## 9. Leaderboard

| #   | Test                         | Expected                           | Pass? |
| --- | ---------------------------- | ---------------------------------- | ----- |
| 9.1 | Win increments "wins" metric | Leaderboard entry created/updated  | ☐     |
| 9.2 | Chess leaderboard visible    | Shows "♟ Chess — Wins" leaderboard | ☐     |

## 10. Achievements

| #    | Test                              | Expected                            | Pass? |
| ---- | --------------------------------- | ----------------------------------- | ----- |
| 10.1 | "First Move" unlocks on first win | Toast appears, achievement marked   | ☐     |
| 10.2 | En passant achievement            | Unlocks after performing en passant | ☐     |
| 10.3 | Castling achievement              | Unlocks after castling in a game    | ☐     |
| 10.4 | Promotion achievement             | Unlocks after promoting a pawn      | ☐     |
| 10.5 | Scholar's Mate (≤10 ply)          | Unlocks on fast checkmate           | ☐     |
| 10.6 | Achievement section in profile    | Chess section appears with ♟ icon   | ☐     |

## 11. Notifications & Invites

| #    | Test                        | Expected                                        | Pass? |
| ---- | --------------------------- | ----------------------------------------------- | ----- |
| 11.1 | Turn notification fires     | Opponent gets "Your turn in Chess" notification | ☐     |
| 11.2 | Invite from chat works      | Tapping invite opens game                       | ☐     |
| 11.3 | Deep-link from notification | Opens correct game session                      | ☐     |

---

## Self-Audit Checklist

| #   | Integration Hook                                    | Status | Notes                              |
| --- | --------------------------------------------------- | ------ | ---------------------------------- |
| A1  | `chess` in `IMPLEMENTED_GAME_IDS`                   | ✅     | constants.ts                       |
| A2  | Adapter self-registers via `registerAdapter()`      | ✅     | chessAdapter.ts bottom             |
| A3  | `import "./chess"` in adapters/index.ts             | ✅     | Auto-registration on bundle import |
| A4  | `SCOREBOARD_DESCRIPTORS.chess` defined              | ✅     | constants.ts                       |
| A5  | `LEADERBOARD_DESCRIPTORS.chess` defined             | ✅     | constants.ts                       |
| A6  | `GAME_DESCRIPTIONS.chess` defined                   | ✅     | constants.ts                       |
| A7  | `chess: "wins"` in backend `LEADERBOARD_METRICS`    | ✅     | firebase-backend types.ts          |
| A8  | `ChessScreenV4` mapped in `GAME_SCREEN_MAP`         | ✅     | GamePlayDispatcherV4.tsx           |
| A9  | 15 achievements defined (client)                    | ✅     | achievementDefinitions.ts          |
| A10 | 15 achievement evaluators (backend)                 | ✅     | achievements.ts                    |
| A11 | `isGameSection("chess")` returns true               | ✅     | achievementDefinitions.ts          |
| A12 | Chess section in `ACHIEVEMENT_SECTIONS` (client)    | ✅     | achievementDefinitions.ts          |
| A13 | Chess section in `ACHIEVEMENT_SECTIONS` (backend)   | ✅     | achievements.ts                    |
| A14 | `extractPerformanceMetrics` returns all needed keys | ✅     | Verified by test                   |
| A15 | `underPromotionsByUid` tracks only N/B/R (not Q)    | ✅     | Fixed — separate counter           |
| A16 | `computeOutcome` returns correct scoreboard         | ✅     | Verified by test                   |
| A17 | `getSpectatorView` returns full state               | ✅     | No hidden info                     |
| A18 | Unit tests: 48 engine + 22 adapter = 70 passing     | ✅     | All green                          |

---

## Files Created / Modified

### New Files

| File                                          | Purpose            |
| --------------------------------------------- | ------------------ |
| `src/gamesV4/adapters/chess/chessTypes.ts`    | Type definitions   |
| `src/gamesV4/adapters/chess/chessEngine.ts`   | Pure rules engine  |
| `src/gamesV4/adapters/chess/chessAdapter.ts`  | V4 adapter         |
| `src/gamesV4/adapters/chess/index.ts`         | Barrel export      |
| `src/gamesV4/screens/chess/ChessScreenV4.tsx` | Game UI            |
| `__tests__/gamesV4/chess/chessEngine.test.ts` | Engine tests (48)  |
| `__tests__/gamesV4/adapters/chess.test.ts`    | Adapter tests (22) |

### Modified Files

| File                                                     | Change                             |
| -------------------------------------------------------- | ---------------------------------- |
| `src/gamesV4/constants.ts`                               | Added chess to all descriptor maps |
| `src/gamesV4/adapters/index.ts`                          | Added auto-registration import     |
| `src/gamesV4/screens/GamePlayDispatcherV4.tsx`           | Added screen mapping               |
| `src/gamesV4/data/achievementDefinitions.ts`             | 15 achievements + section          |
| `firebase-backend/functions/src/gamesV4/types.ts`        | Leaderboard metric                 |
| `firebase-backend/functions/src/gamesV4/achievements.ts` | 15 evaluators + section            |
