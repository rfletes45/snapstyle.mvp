# Chess UI/UX Polish — Manual QA Script & Acceptance Checklist

## Pre-QA Setup

1. Run `npx expo start` and open in Expo Go on a physical device (iOS preferred for haptics).
2. Start a new Chess game from the Games Hub against a friend (or second device).
3. Have both devices ready for turn-based testing.

---

## A) Core UX

| #   | Test                     | Steps                                              | Expected                                                                                      | Pass? |
| --- | ------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----- |
| A1  | Piece selection feedback | Tap a piece on your turn                           | Piece square highlights yellow; legal move dots/rings appear instantly; haptic tick felt      |       |
| A2  | Move animation           | Move a piece to a legal square                     | Piece slides smoothly from origin to destination (~150ms); no frame drops                     |       |
| A3  | Capture animation        | Capture an opponent's piece                        | Captured piece shrinks/fades; capturing piece slides in; medium haptic felt                   |       |
| A4  | Last move highlight      | After any move                                     | Both from and to squares show green-tinted overlay                                            |       |
| A5  | Check highlight          | Make a move that puts king in check                | King's square pulses red; "CHECK" pill appears in status pills row; warning haptic felt       |       |
| A6  | No UI overlaps (iOS)     | Observe screen on iPhone with Dynamic Island/notch | TurnStatusCard, board, and action buttons all below safe area; back/resign buttons accessible |       |
| A7  | No UI overlaps (Android) | Observe on Android phone                           | Status bar doesn't overlap HUD; board centered properly                                       |       |
| A8  | Move commit feels smooth | Rapidly make several moves                         | No perceivable lag between tap and visual feedback                                            |       |

## B) Settings

| #   | Test                     | Steps                                                                        | Expected                                                                              | Pass? |
| --- | ------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----- |
| B1  | Open settings            | Tap "Options" button                                                         | Settings modal slides up from bottom with all sections visible                        |       |
| B2  | Confirm move toggle      | Enable "Confirm each move" → make a move                                     | After selecting destination: confirm/cancel bar appears; tapping ✓ submits, ✕ cancels |       |
| B3  | Input mode: Tap          | Set input mode to "Tap"                                                      | Tap piece → tap destination workflow works                                            |       |
| B4  | Queue move toggle        | Enable "Queue move" → wait for opponent's turn → select piece + destination  | Shows "Move queued" inline notice; blue ghost overlay on queued squares               |       |
| B5  | Queue auto-submit        | Queue a move → opponent makes their move → it becomes your turn              | Queued move auto-submits if still legal; medium haptic                                |       |
| B6  | Queue cancelled          | Queue move that becomes illegal (e.g., piece captured) → opponent makes move | Queue cleared; warning haptic; inline notice disappears                               |       |
| B7  | Show legal moves off     | Disable "Show legal moves" in settings → select piece                        | No dots/rings shown                                                                   |       |
| B8  | Highlight last move off  | Disable "Highlight last move" → make a move                                  | No green overlay on from/to squares                                                   |       |
| B9  | Highlight check off      | Disable "Highlight check" → create check position                            | No red pulse on king square (but CHECK pill still shows)                              |       |
| B10 | Coordinates toggle       | Toggle "Coordinates" off/on                                                  | A-H / 1-8 labels appear/disappear on board edges                                      |       |
| B11 | Haptics: Off             | Set haptics to "Off" → make moves                                            | No haptic feedback felt at all                                                        |       |
| B12 | Haptics: Light           | Set haptics to "Light" → make moves and captures                             | Lighter haptic on all events                                                          |       |
| B13 | Haptics: Normal          | Set haptics to "Normal" → make moves                                         | Standard haptic intensity; different for select/move/capture/check                    |       |
| B14 | Board theme switch       | Change board theme to each option                                            | Board colors update immediately; pieces remain visible with good contrast             |       |
| B15 | High contrast theme      | Select "High Contrast" theme                                                 | White/dark grey squares; blue legal moves; strong check overlay                       |       |
| B16 | Display preset: Minimal  | Select "Minimal"                                                             | Only last move highlight shown; no legal move dots; no check square highlight         |       |
| B17 | Display preset: Standard | Select "Standard"                                                            | Legal moves + last move + check highlight all visible                                 |       |
| B18 | Display preset: Assisted | Select "Assisted"                                                            | Same as standard but with stronger visual cues                                        |       |
| B19 | Reduced motion           | Enable "Reduced motion" → make moves                                         | Pieces snap to position (no slide animation); no check pulse animation                |       |
| B20 | Settings persist         | Change several settings → close and reopen app → start new chess game        | All settings retained from previous session                                           |       |

## C) Move List / Replay

| #   | Test                | Steps                                      | Expected                                                             | Pass? |
| --- | ------------------- | ------------------------------------------ | -------------------------------------------------------------------- | ----- |
| C1  | Move list opens     | Tap "Moves" button                         | Panel slides up from bottom with "Moves" header                      |       |
| C2  | Move pairs shown    | Play several moves → open move list        | Shows "1. e4 e5 2. Nf3 Nc6" format with proper numbering             |       |
| C3  | Auto-scroll         | Make a new move while move list is open    | List scrolls to show latest move                                     |       |
| C4  | Tap to replay       | Tap a historical move in the list          | That move's SAN is highlighted; board should show replay hint notice |       |
| C5  | Jump to live        | While in replay mode, tap "Live" button    | Returns to current board state; "Live" button disappears             |       |
| C6  | Replay nav arrows   | Use < > arrows in replay mode              | Steps forward/backward through ply history                           |       |
| C7  | Replay blocks input | While replaying, tap a square on the board | Exits replay mode (returns to live); doesn't submit a move           |       |
| C8  | Move list closes    | Tap chevron-down or "Moves" button again   | Panel slides out cleanly                                             |       |

## D) Spectator Mode

| #   | Test               | Steps                                  | Expected                                                     | Pass? |
| --- | ------------------ | -------------------------------------- | ------------------------------------------------------------ | ----- |
| D1  | Spectator banner   | Join as spectator (third user watches) | "WATCHING" pill visible in status pills area                 |       |
| D2  | No move input      | Tap pieces as spectator                | No selection, no legal moves, no move submission             |       |
| D3  | Flip board         | Tap "Flip" button as spectator         | Board orientation reverses; button only shown for spectators |       |
| D4  | Live state updates | Active players make moves              | Spectator's board updates in real-time with animations       |       |

## E) Promotion

| #   | Test                     | Steps                                  | Expected                                                          | Pass? |
| --- | ------------------------ | -------------------------------------- | ----------------------------------------------------------------- | ----- |
| E1  | Promotion picker         | Advance a pawn to the 8th rank         | Modern slide-up card with 4 pieces (Q/R/B/N) using icons + labels |       |
| E2  | Promotion selection      | Tap Queen                              | Pawn promoted; picker closes; move submitted; haptic tick         |       |
| E3  | Promotion + confirm mode | Enable "Confirm move" → promote a pawn | After picking piece, confirm bar appears (not double-confirm)     |       |

## F) End of Game

| #   | Test                     | Steps                                       | Expected                                                                        | Pass? |
| --- | ------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------- | ----- |
| F1  | Checkmate display        | Play to checkmate                           | TurnStatusCard shows "You win!" or "You lose"; status color updates (green/red) |       |
| F2  | Draw display             | Trigger a draw (e.g., stalemate, agreement) | Shows "Draw — stalemate" or similar; neutral color                              |       |
| F3  | Terminal reason subtitle | After game ends                             | Terminal reason displayed as subtitle in TurnStatusCard                         |       |
| F4  | Game over navigation     | After game ends, wait for auto-navigation   | Auto-navigates to GameOverV4 screen after ~1.5s (handled by shell)              |       |
| F5  | Board frozen             | After terminal state                        | No squares selectable; no move submission possible                              |       |

## G) HUD / Visual Polish

| #   | Test                    | Steps                                       | Expected                                                                            | Pass? |
| --- | ----------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------- | ----- |
| G1  | Player bars             | Observe top and bottom of board             | Each shows player pip (W/B icon) + name + captured pieces + material advantage chip |       |
| G2  | Material advantage      | Capture pieces to create material imbalance | "+3" chip appears next to the player with more material                             |       |
| G3  | Captured pieces         | Capture several pieces                      | Captured piece icons shown in order (Q, R, B, N, P) using MaterialCommunityIcons    |       |
| G4  | No captures yet         | At game start                               | Captured area shows "—" placeholder                                                 |       |
| G5  | Draw offer pill         | One player offers draw                      | "DRAW OFFERED" pill appears in status area; opponent sees "DRAW OFFERED TO YOU"     |       |
| G6  | Active player indicator | Observe player bars                         | Active player has green dot and highlighted background; inactive is muted           |       |
| G7  | BoardTray framing       | Observe board container                     | Board is inside an elevated tray with rounded corners and subtle shadow             |       |

---

## Summary Checklist

| Phase | Area                                            | Implemented | QA Verified |
| ----- | ----------------------------------------------- | :---------: | :---------: |
| P0    | Piece slide animation                           |     ✅      |             |
| P0    | Capture shrink/fade                             |     ✅      |             |
| P0    | Check pulse + CHECK pill                        |     ✅      |             |
| P0    | Haptics (3 levels)                              |     ✅      |             |
| P0    | Confirm move mode                               |     ✅      |             |
| P0    | Legal move dots/rings                           |     ✅      |             |
| P0    | Last move highlight                             |     ✅      |             |
| P0    | Configurable display presets                    |     ✅      |             |
| P0    | All settings toggles                            |     ✅      |             |
| P0    | TurnStatusCard + PlayerChips                    |     ✅      |             |
| P0    | BoardTray framing                               |     ✅      |             |
| P0    | InlineNotice integration                        |     ✅      |             |
| P0    | Material advantage chip                         |     ✅      |             |
| P0    | Captured pieces icons                           |     ✅      |             |
| P0    | Safe area handling                              |     ✅      |             |
| P1    | Queued move (premove)                           |     ✅      |             |
| P1    | Move list collapsible panel                     |     ✅      |             |
| P1    | Replay mode + Jump to Live                      |     ✅      |             |
| P1    | Polished promotion picker                       |     ✅      |             |
| P1    | Spectator polish (pill + flip + disabled input) |     ✅      |             |
| P2    | 6 board themes (incl. high-contrast)            |     ✅      |             |
| P2    | Theme selector in settings                      |     ✅      |             |
| P2    | Reduced motion toggle                           |     ✅      |             |
| P2    | Settings persistence (AsyncStorage)             |     ✅      |             |
