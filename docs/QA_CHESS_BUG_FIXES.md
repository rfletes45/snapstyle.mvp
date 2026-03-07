# QA Checklist — Chess UI Bug Fixes

Covers the fixes for 6 reported bugs + findings from the end-to-end audit.
Test in **Expo Go** on both iOS and Android.

---

## Bug 1 · Queued Move Cancel

| #   | Step                                             | Expected                                                                                   |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 1   | Open chess game, wait for opponent to move first | "Waiting for opponent…"                                                                    |
| 2   | Enable **Queue Move** in Options (default ON)    | Toggle shows ON                                                                            |
| 3   | Tap own piece → tap a target square              | Blue overlay on from/to squares, "Move queued" notice, orange **Cancel Queue** bar appears |
| 4   | Tap **Cancel Queue**                             | Blue overlay clears, notice clears, haptic fires                                           |
| 5   | Queue another move, then opponent moves          | Queued move auto-submits on your turn, bar + notice disappear                              |
| 6   | Queue a move → game ends (opponent checkmates)   | Queued move + cancel bar clear automatically                                               |

---

## Bug 2 · Queued Move Legality

| #   | Step                                                            | Expected                                                   |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | It's opponent's turn; tap own pawn                              | Pawn is highlighted (selected)                             |
| 2   | Tap an impossible square (e.g., 3 ranks forward for a pawn)     | Illegal haptic fires, selection clears, move is NOT queued |
| 3   | Tap own knight → tap a valid knight-move square                 | Move queues correctly (blue overlay)                       |
| 4   | Tap own piece → tap a square occupied by own piece              | Should not queue                                           |
| 5   | Disable **Queue Move** in Options → tap own piece while waiting | Nothing happens (input ignored)                            |

---

## Bug 3 · Promotion Payload ("invalid promotion piece")

| #   | Step                                                                           | Expected                                                                         |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 1   | Get a pawn to the 7th rank                                                     | Standard move                                                                    |
| 2   | It's your turn: move pawn to 8th rank                                          | Promotion picker appears (Q/R/B/N)                                               |
| 3   | Choose Knight (♞)                                                              | Move submits with `promotion: "n"`, no error                                     |
| 4   | **Queued promotion**: opponent's turn, pawn on 7th rank, queue the pawn to 8th | Promotion picker appears immediately                                             |
| 5   | Choose Queen (♛) in the queued promo picker                                    | Blue overlay shows queued promo. "Move queued" notice                            |
| 6   | Opponent moves → queued promo auto-submits                                     | Move submits cleanly, pawn promotes to queen, no "invalid promotion piece" error |
| 7   | **Cancel queued promo**: repeat step 4, then tap the dim background            | Picker dismisses, no move queued                                                 |
| 8   | Android: repeat step 4, press ← back button                                    | Picker dismisses, no move queued                                                 |

---

## Bug 4 · Moves List Layout Shift

| #   | Step                                       | Expected                                                        |
| --- | ------------------------------------------ | --------------------------------------------------------------- |
| 1   | Play several moves (4+)                    | Board and player bars are centered                              |
| 2   | Tap **Moves** button                       | Moves panel slides up from bottom **without pushing the board** |
| 3   | Verify board position hasn't shifted       | Board stays exactly where it was                                |
| 4   | Tap chevron (▼) or Moves button again      | Panel closes                                                    |
| 5   | Show moves list → queue a move             | Moves list auto-hides when cancel bar shows                     |
| 6   | Show moves list → confirm-move bar appears | Moves list auto-hides when confirm bar shows                    |

---

## Bug 5 · Drag-to-Move

| #   | Step                                                             | Expected                                                              |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | Open Options → change Input Mode to **Drag**                     | Setting persists                                                      |
| 2   | Long-press own piece and drag to target                          | Piece lifts (scaled ~1.15×), follows finger, original square is empty |
| 3   | Release on a legal square                                        | Move submits, piece appears at destination                            |
| 4   | Release on an illegal square                                     | Piece snaps back, illegal-move haptic fires                           |
| 5   | Drag-drop to trigger promotion (pawn to 8th)                     | Promotion picker appears after drop                                   |
| 6   | Switch to **Tap** mode in Options while NOT dragging             | Tap mode works normally                                               |
| 7   | Spectator mode + drag setting enabled                            | Dragging does NOT visually pick up pieces                             |
| 8   | Drag-release on same square                                      | Toggles piece selection (like a tap)                                  |
| 9   | **Premove via drag**: opponent's turn → drag own piece to target | Move queues (blue overlay)                                            |

---

## Bug 6 · End-to-End Reliability (Audit Fixes)

| #   | Step                                                                 | Expected                                                |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | **Haptics on opponent moves**: opponent captures your piece          | Capture haptic (medium buzz) fires                      |
| 2   | **Haptics on check**: opponent puts you in check                     | Check warning haptic fires after ~100ms delay           |
| 3   | **Replay mode + drag**: enter replay, try drag-to-move               | Exits replay (returns to live) first                    |
| 4   | **Error notice priority**: trigger an error while replaying          | Error message shown (not replay message)                |
| 5   | **Promotion picker dismiss**: open promo picker → tap dim background | Picker closes, no side effects                          |
| 6   | **Settings switch mid-game**: toggle drag↔tap during play            | Smooth switch, no visual artifacts, no invisible pieces |
| 7   | **Terminal state cleanup**: game ends with queued move + confirm bar | All transient UI (queue bar, confirm bar) clears        |

---

## Test Coverage

| Test File                                         | Tests                                                                |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `__tests__/gamesV4/chess/chessUIBugFixes.test.ts` | 12 (promotion payload ×3, premove validation ×4, notice priority ×5) |
| `__tests__/gamesV4/chess/chessEngine.test.ts`     | Pre-existing engine tests                                            |
| `__tests__/gamesV4/adapters/chess.test.ts`        | Pre-existing adapter tests                                           |

---

## Files Modified

| File                                              | Summary                                                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/gamesV4/screens/chess/ChessScreenV4.tsx`     | Queued move legality, promotion payload fix, cancel UI, drag handler, notice priority, haptic ref fix, terminal cleanup |
| `src/gamesV4/screens/chess/ChessBoard.tsx`        | Drag-to-move (GestureDetector + floating piece), spectator guard, mode-switch cleanup, piece key fix                    |
| `src/gamesV4/screens/chess/ChessPromotion.tsx`    | Added `onCancel` prop + dismiss-on-backdrop-tap                                                                         |
| `__tests__/gamesV4/chess/chessUIBugFixes.test.ts` | New test file (12 tests)                                                                                                |
