# Metro Magnate — Implementation Plan

> Produced: 2026-03-11
> Based on: full audit of the V4 codebase as checked out.
> Status: **planning only — no code written yet.**

---

## Table of Contents

1. [Architecture Verdict](#1-architecture-verdict)
2. [Reference Inventory & Architectural Patterns](#2-reference-inventory--architectural-patterns)
3. [Exact Integration Surface](#3-exact-integration-surface)
4. [Recommended Runtime Shape](#4-recommended-runtime-shape)
5. [Game Design Specification](#5-game-design-specification)
6. [File-by-File Action Plan](#6-file-by-file-action-plan)
7. [Phase-by-Phase Implementation Plan](#7-phase-by-phase-implementation-plan)
8. [Do Not Drift Checklist](#8-do-not-drift-checklist)
9. [Blockers & Risks](#9-blockers--risks)
10. [Recommended Next Take](#10-recommended-next-take)

---

## 1. Architecture Verdict

**Metro Magnate is a Firebase turn-based, public-state, 2–6 player game.**

### Why Firebase turn-based

- Turns are sequential (roll → move → buy/pay/draw/trade → end turn). No simultaneous input.
- All game state can be serialized as a single Firestore document. No socket latency requirement.
- The existing `submitTurnMoveV4` pipeline handles multi-player turn order, turn validation, terminal detection, and async resolution — all of which Metro Magnate needs.
- Crazy Eights already proves the system handles 2–6 player round-robin with `direction` and `nextTurnPlayerId` overrides.

### Why public-state (no private state)

- In Monopoly-like games, all meaningful information is public: who owns what, how much money each player has, board positions, improvement levels, mortgage status, card effects.
- The only potentially "hidden" element would be player cash balances. However, in the real board game, cash is technically public information (any player can ask to count another player's money). Keeping it public simplifies the architecture enormously and avoids the complexity of `PrivateState/{uid}` documents, serialization, and partial client validation.
- Chance/Community-Chest-equivalent card decks (Market Shift / City Brief) can store the deck order in state and reveal cards on draw. Since it's turn-based and the server validates all moves, a player cannot peek at upcoming cards from the client — the server only reveals the top card on the draw move.

**Decision: No `createInitialPrivateState`. No `PrivateState/{uid}` documents. All state in `PublicState/state`.**

### Why spectators are supported

- The game is fully public-state, so spectators see the complete board.
- `spectateMode: "public_only"` — spectators see the same state as players.
- `supportsSpectate: true` aligns with all other turn-based games in the codebase.

### Why Express and Classic modes

- Classic: play until all but one player are bankrupt (elimination).
- Express: fixed number of rounds (e.g., 20, 30, 40), highest net worth wins.
- This is a lobby setting, not a separate game. Uses `settingsSchema` with a `"gameMode"` select field.
- Express mode is important because Classic games can run very long. Express gives a bounded, casual alternative.

---

## 2. Reference Inventory & Architectural Patterns

### Primary references by concern

| Concern                                      | Best Reference                                                   | Why                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Multi-player turn order (2–6)                | `crazy_eights`                                                   | Only existing 2–6 player turn-based game. Same `turnOrder[]` + `currentTurnIndex` + `direction` pattern.                                                                                                                                                                                                                                                                                                   |
| Complex adapter sub-folder structure         | `crazy_eights`, `chess`, `battleship`, `dead_drop`               | All use `{game}Types.ts` + `{game}Engine.ts` + `{game}Adapter.ts` + `index.ts`.                                                                                                                                                                                                                                                                                                                            |
| Lobby settings schema with validation        | `crazy_eights`, `dots_and_boxes`                                 | Both have `settingsSchema` with `"select"` and `"number"` field types and `validateSettings()`.                                                                                                                                                                                                                                                                                                            |
| Flat-array board storage (Firestore safe)    | `hex`, `dots_and_boxes`                                          | Both avoid nested arrays. Hex uses `cells: HexCell[]` (flat 81-cell array). Dots uses `horizontalEdges: boolean[]`, `verticalEdges: boolean[]`, `boxOwners: (string                                                                                                                                                                                                                                        | null)[]`. |
| Per-player scoring in multi-player           | `crazy_eights`                                                   | `scores: Record<string, number>` → `finalScoreboard[]` with placements.                                                                                                                                                                                                                                                                                                                                    |
| Extra turn / retained turn                   | `dots_and_boxes`                                                 | `turnAdvance: false` + `turnRetained: true` when a box is completed. Metro Magnate needs this for double rolls.                                                                                                                                                                                                                                                                                            |
| Complex move types within one adapter        | `battleship`, `crazy_eights`                                     | Battleship has `"place_fleet"` / `"fire"` / `"salvo_fire"` / `"resign"`. Crazy Eights has `"PLAY_CARD"` / `"DRAW_CARD"` / `"PASS"` / `"CALL_CRAZY"` / `"CHALLENGE_WILD4"`. Metro Magnate will have `"roll_dice"`, `"buy_district"`, `"auction_bid"`, `"pay_lease"`, `"build_improvement"`, `"mortgage"`, `"unmortgage"`, `"trade_offer"`, `"trade_respond"`, `"draw_card"`, `"end_turn"`, `"resign"`, etc. |
| Performance metrics extraction               | `chess`, `dots_and_boxes`                                        | Both extract rich stats (e.g., `winMargin`, `shutout`, `capturesByUid`, etc.)                                                                                                                                                                                                                                                                                                                              |
| Achievement section + evaluator              | Every game                                                       | Pattern: section def + per-game achievement defs with `evaluate: (ctx) => boolean`.                                                                                                                                                                                                                                                                                                                        |
| Scoreboard descriptors & leaderboard         | All turn-based games                                             | Win-based: `"wins"` metric. Metro Magnate should use `"wins"` for leaderboard (like all competitive multiplayer).                                                                                                                                                                                                                                                                                          |
| Backend adapter with Firestore serialization | All backend adapters                                             | `serializeStateForFirestore` / `deserializeStateFromFirestore` handles nested arrays automatically in the `runMove()` pipeline.                                                                                                                                                                                                                                                                            |
| Game screen with shell integration           | `DotsAndBoxesScreenV4`, `ReversiScreenV4`, `CrazyEightsScreenV4` | All use `withGameV4Shell(Component, gameId)`, receive shell props, and call `submitMove(movePayload)`.                                                                                                                                                                                                                                                                                                     |

### Patterns Metro Magnate will need that have no exact precedent

| Concern                                    | Notes                                                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Board as a loop (circular track)           | No existing game has a circular board. Must model as a flat array of spaces with wrap-around index arithmetic.                        |
| Economy system (buy/sell/mortgage/improve) | No existing game has a property economy. Must be modeled entirely in public state.                                                    |
| Auction sub-phase                          | No existing game has auctions. Must handle as a move-type within the adapter. Could use `nextTurnPlayerId` to cycle through bidders.  |
| Trade negotiation                          | No existing game has player-to-player trading. Must be modeled as offer/accept/reject moves.                                          |
| Bankruptcy / elimination during game       | Crazy Eights handles round-over but not player elimination. Metro Magnate must handle mid-game elimination in a multi-player context. |
| Dice rolls (RNG)                           | Server must generate dice rolls deterministically to prevent client manipulation. Use a seeded PRNG initialized at session creation.  |
| Card decks (shuffled)                      | Same seeded PRNG for Market Shift / City Brief deck shuffle. Cards are public once drawn.                                             |

---

## 3. Exact Integration Surface

### 3.1 Files that must be EDITED (existing files)

| #   | File                                                     | Change                                                                                                                                                        |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/gamesV4/types/common.ts`                            | Add `"metro_magnate"` to `GameId` union type                                                                                                                  |
| 2   | `firebase-backend/functions/src/gamesV4/types.ts`        | Add `"metro_magnate"` to backend `GameId` union type                                                                                                          |
| 3   | `src/gamesV4/constants.ts`                               | Add entries to: `GAME_METADATA`, `GAME_DESCRIPTIONS`, `SCOREBOARD_DESCRIPTORS`, `LEADERBOARD_DESCRIPTORS`. Add to `IMPLEMENTED_GAME_IDS` **only at the end**. |
| 4   | `src/gamesV4/adapters/index.ts`                          | Add `import "./metroMagnate"`                                                                                                                                 |
| 5   | `src/gamesV4/screens/GamePlayDispatcherV4.tsx`           | Add `metro_magnate: MetroMagnateScreenV4` to `GAME_SCREEN_MAP`                                                                                                |
| 6   | `src/gamesV4/data/achievementDefinitions.ts`             | Add `metro_magnate` section def + achievement defs                                                                                                            |
| 7   | `firebase-backend/functions/src/gamesV4/adapters.ts`     | Register backend Metro Magnate adapter                                                                                                                        |
| 8   | `firebase-backend/functions/src/gamesV4/invites.ts`      | Add `metro_magnate` entry to `GAME_META` map                                                                                                                  |
| 9   | `firebase-backend/functions/src/gamesV4/types.ts`        | Add `metro_magnate: "wins"` to `LEADERBOARD_METRICS`                                                                                                          |
| 10  | `firebase-backend/functions/src/gamesV4/achievements.ts` | Add `metro_magnate` section + achievement evaluators                                                                                                          |

### 3.2 Files that must be CREATED

| #   | File                                                       | Purpose                                                                                                                                                                                             |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/gamesV4/adapters/metroMagnate/metroMagnateTypes.ts`   | All TypeScript interfaces: board spaces, districts, sectors, cards, player state, public state, move payloads, settings                                                                             |
| 2   | `src/gamesV4/adapters/metroMagnate/metroMagnateEngine.ts`  | Pure game logic: dice roll, movement, rent calculation, improvement pricing, bankruptcy detection, auction resolution, trade validation, terminal detection, deck management, net worth calculation |
| 3   | `src/gamesV4/adapters/metroMagnate/metroMagnateBoard.ts`   | Static board definition: the 40-space loop with district names, sector groupings, costs, rents, card draw spaces, special spaces. Equivalent of the board layout data.                              |
| 4   | `src/gamesV4/adapters/metroMagnate/metroMagnateAdapter.ts` | Client `GameAdapterV4` implementation                                                                                                                                                               |
| 5   | `src/gamesV4/adapters/metroMagnate/index.ts`               | Register + re-export                                                                                                                                                                                |
| 6   | `src/gamesV4/screens/MetroMagnateScreenV4.tsx`             | Gameplay screen with board rendering, dice animation, player tokens, district cards, trade UI, etc.                                                                                                 |
| 7   | `__tests__/gamesV4/adapters/metroMagnate.test.ts`          | Comprehensive adapter tests                                                                                                                                                                         |

### 3.3 Files that need NO changes (auto-integrate via metadata)

These surfaces consume game data generically and need no per-game edits:

- `src/gamesV4/screens/GamesHubScreenV4.tsx`
- `src/gamesV4/screens/GameDetailScreenV4.tsx`
- `src/gamesV4/screens/GameLobbyScreenV4.tsx`
- `src/gamesV4/screens/GameOverScreenV4.tsx`
- `src/gamesV4/screens/GameLeaderboardScreenV4.tsx`
- `src/gamesV4/screens/GameStatsScreenV4.tsx`
- `src/gamesV4/screens/AchievementsHubScreen.tsx`
- `src/gamesV4/screens/AchievementSectionScreen.tsx`
- `src/gamesV4/components/GameScreenShell.tsx`
- `src/gamesV4/hooks/useGameSessionV4.ts`
- `src/gamesV4/hooks/useGameLobbyV4.ts`
- `src/gamesV4/services/gameServiceV4.ts`
- `firebase-backend/functions/src/gamesV4/resolve.ts`
- `firebase-backend/functions/src/gamesV4/sessions.ts`
- `firebase-backend/functions/src/gamesV4/triggers.ts`

---

## 4. Recommended Runtime Shape

### 4.1 Identity & Classification

```
gameId:           "metro_magnate"
displayName:      "Metro Magnate"
runtimeType:      "turnBased"
minPlayers:       2
maxPlayers:       6
supportsSpectate: true
spectateMode:     "public_only"
icon:             "city-variant-outline"   (MaterialCommunityIcons)
```

### 4.2 Leaderboard & Scoring

```
leaderboardMetric:  "wins"
scoreboardTitle:    "NET WORTH"
formatScore:        (s) => `$${s.toLocaleString()}`
sortDirection:      "desc"
leaderboardLabel:   "Wins"
leaderboardFormat:  (v) => `${v} win${v !== 1 ? "s" : ""}`
```

### 4.3 Settings Schema

| Key               | Label            | Type    | Default      | Options                                                                | Group          |
| ----------------- | ---------------- | ------- | ------------ | ---------------------------------------------------------------------- | -------------- |
| `gameMode`        | Game Mode        | select  | `"classic"`  | Classic, Express (20 rounds), Express (30 rounds), Express (40 rounds) | Match Settings |
| `startingCapital` | Starting Capital | select  | `"standard"` | Standard ($1500), High ($2500), Low ($1000)                            | Economy        |
| `auctionEnabled`  | Auctions         | boolean | `true`       | —                                                                      | Rules          |
| `tradingEnabled`  | Trading          | boolean | `true`       | —                                                                      | Rules          |
| `turnTimer`       | Turn Timer       | select  | `"off"`      | Off, 60s, 90s, 120s                                                    | Match Settings |

### 4.4 Public State Shape (summary)

```typescript
interface MetroMagnatePublicState {
  // Board
  boardSpaces: BoardSpace[]; // 40-space loop, static structure

  // Players
  playerOrder: string[]; // UIDs in turn order
  currentPlayerIndex: number;
  players: Record<string, PlayerState>;
  // PlayerState: { position, capital, ownedDistricts[], netWorth,
  //                isEliminated, isBankrupt, turnsInInspection,
  //                hasGetOutCard, doublesCount }

  // Districts (properties)
  districts: Record<string, DistrictState>;
  // DistrictState: { ownerId, sectorId, isMortgaged, improvementLevel,
  //                  originalCost, currentRent }

  // Sectors (color groups)
  sectors: SectorDefinition[];

  // Turn state
  phase: TurnPhase; // "pre_roll" | "rolled" | "buying" | "auction" |
  // "paying" | "card_effect" | "trading" | "building" |
  // "bankrupt_resolution" | "game_over"
  currentDiceRoll: [number, number] | null;
  doublesThisTurn: number;

  // Auction state (when active)
  auction: AuctionState | null;
  // AuctionState: { districtId, currentBid, currentBidderId,
  //                 biddingOrder[], passedPlayers[] }

  // Trade state (when active)
  activeTrade: TradeOffer | null;

  // Card decks
  marketShiftDeck: number[]; // indices into card definitions (order hidden until drawn)
  cityBriefDeck: number[];
  marketShiftDiscard: number[];
  cityBriefDiscard: number[];
  lastDrawnCard: CardEffect | null;

  // Game mode
  settings: MetroMagnateSettings;
  roundNumber: number;
  maxRounds: number | null; // null for Classic, number for Express

  // RNG
  seed: number;
  rngCounter: number; // deterministic PRNG state

  // Metrics
  moveCount: number;
  totalRentCollected: Record<string, number>;
  totalImprovementsBuilt: Record<string, number>;
  districtsPurchased: Record<string, number>;
  timesInInspection: Record<string, number>;
}
```

### 4.5 Move Types

| Move Type           | Payload                                                   | When Valid                                                                   |
| ------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `roll_dice`         | `{}`                                                      | `phase === "pre_roll"`, current player's turn                                |
| `buy_district`      | `{ districtId }`                                          | `phase === "buying"`, landed on unowned district, player has enough capital  |
| `decline_purchase`  | `{}`                                                      | `phase === "buying"`, triggers auction if enabled                            |
| `auction_bid`       | `{ amount }`                                              | `phase === "auction"`, player's bid turn, amount > current bid               |
| `auction_pass`      | `{}`                                                      | `phase === "auction"`, player's bid turn                                     |
| `pay_lease`         | `{}`                                                      | `phase === "paying"`, auto-deducted, advances phase                          |
| `draw_card`         | `{}`                                                      | `phase === "card_effect"`, landed on card space                              |
| `build_improvement` | `{ districtId }`                                          | `phase === "building"` or during pre-roll, owns full sector, enough capital  |
| `sell_improvement`  | `{ districtId }`                                          | During turn, has improvements to sell                                        |
| `mortgage`          | `{ districtId }`                                          | During turn, owns district, not already mortgaged, no improvements in sector |
| `unmortgage`        | `{ districtId }`                                          | During turn, owns district, is mortgaged, has capital for unmortgage cost    |
| `propose_trade`     | `{ toUid, offering: TradeTerms, requesting: TradeTerms }` | During turn, trading enabled                                                 |
| `trade_respond`     | `{ accept: boolean }`                                     | `phase === "trading"`, target player's turn to respond                       |
| `end_turn`          | `{}`                                                      | After mandatory actions completed                                            |
| `resign`            | `{}`                                                      | Any time during own turn                                                     |
| `bankruptcy_settle` | `{ creditorUid }`                                         | `phase === "bankrupt_resolution"`, forced asset liquidation                  |

### 4.6 Terminal Conditions

**Classic mode:**

- Last player standing (all others bankrupt) → `terminal: { type: "win", winnerIds: [lastPlayerUid] }`

**Express mode:**

- All rounds completed → highest net worth wins → `terminal: { type: "win", winnerIds: [highestNetWorthUid] }`
- Tie in net worth → `terminal: { type: "draw" }` or tiebreak by most districts

**Both modes:**

- All but one player resign → `terminal: { type: "win", winnerIds: [remainingUid] }`

### 4.7 Firestore Considerations

- **No nested arrays.** The board is a flat `BoardSpace[]`. Districts are a flat `Record<string, DistrictState>`. Card decks are flat `number[]`.
- The automatic `serializeStateForFirestore` / `deserializeStateFromFirestore` in the backend `runMove()` pipeline handles any nested arrays transparently (e.g., if `boardSpaces` contains sub-arrays for any reason, they'll be serialized). But designing with flat structures avoids surprises.
- State document size: worst case ~15–20KB with 6 players, 28 districts, full auction/trade state. Well within Firestore's 1MB limit.

---

## 5. Game Design Specification

### 5.1 Board Layout (40 Spaces)

**The board is a loop of 40 spaces.** Spaces fall into these categories:

| Type              | Count | Description                                                         |
| ----------------- | ----- | ------------------------------------------------------------------- |
| District          | 22    | Purchasable properties grouped into 8 sectors (color groups)        |
| Transit Line      | 4     | Purchasable transit hubs (rent scales with how many you own)        |
| Service Node      | 2     | Purchasable utilities (rent = dice × multiplier based on ownership) |
| Market Shift      | 3     | Draw from Market Shift deck (like Chance)                           |
| City Brief        | 3     | Draw from City Brief deck (like Community Chest)                    |
| Central Terminal  | 1     | Start/salary space (collect $200 on pass)                           |
| Inspection Hold   | 1     | Jail equivalent                                                     |
| Go To Inspection  | 1     | Go-to-jail equivalent                                               |
| Plaza             | 1     | Free parking / rest space                                           |
| Capital Gains Tax | 1     | Pay fixed amount ($200)                                             |
| Transit Levy      | 1     | Pay percentage of net worth (10%) or flat amount ($75)              |

### 5.2 Sectors (Color Groups)

| Sector         | Color      | Districts | Cost Range | Improvement Cost |
| -------------- | ---------- | --------- | ---------- | ---------------- |
| Riverside      | Brown      | 2         | $60–$60    | $50              |
| Docklands      | Light Blue | 3         | $100–$120  | $50              |
| Midtown        | Pink       | 3         | $140–$160  | $100             |
| Eastgate       | Orange     | 3         | $180–$200  | $100             |
| Uptown         | Red        | 3         | $220–$240  | $150             |
| Heritage Row   | Yellow     | 3         | $260–$280  | $150             |
| Financial Core | Green      | 3         | $300–$320  | $200             |
| Summit Ridge   | Dark Blue  | 2         | $350–$400  | $200             |

### 5.3 Improvements

- **Storefront** (level 1–3): Each storefront increases rent on the district. A district can have up to 3 storefronts.
- **Tower** (level 4): Replaces all storefronts. Maximum rent. Only one tower per district.
- **Even build rule**: Cannot build on one district of a sector more than one level ahead of others in the same sector.
- **Sell**: Improvements sell back at half their build cost, from highest level down.

### 5.4 Rent Calculation

- **Unimproved district (no full sector)**: base rent from district card.
- **Unimproved district (full sector owned)**: base rent × 2.
- **With storefronts**: defined per district card (escalating rents).
- **With tower**: maximum rent per district card.
- **Mortgaged district**: $0 rent.
- **Transit Lines**: $25 / $50 / $100 / $200 (based on 1/2/3/4 owned).
- **Service Nodes**: dice × 4 (1 owned) or dice × 10 (2 owned).

### 5.5 Inspection Hold (Jail)

- Sent via: "Go To Inspection" space, Market Shift / City Brief cards, rolling 3 doubles.
- Release options: pay $50 fine, use "Transit Pass" card (Get Out Free), roll doubles (up to 3 tries), or auto-pay after 3 turns.
- While in Inspection: still collect rent, still participate in trades.

### 5.6 Market Shift & City Brief Cards

16 cards per deck. Effects include:

- Move to specific space
- Collect/pay amounts
- Collect from each player
- Pay each player
- Advance to nearest Transit Line / Service Node
- Get Out of Inspection Free ("Transit Pass")
- Go to Inspection
- Property assessment (pay per storefront/tower)

### 5.7 Auction Mechanics

- Triggered when a player lands on an unowned district and declines to buy.
- All players (including the declining player) can bid.
- Bidding cycles through players in turn order from the current player.
- Minimum bid: $1. Each bid must exceed the current bid.
- Pass removes you from the auction.
- Last bidder remaining wins at their bid price.
- If all pass, the district remains unowned.

### 5.8 Trading

- Current player can propose a trade to any other non-eliminated player.
- Trade can include: districts, capital, Transit Pass cards.
- Target player can accept or reject.
- No counter-offers in V1 (simplicity).
- Validation: cannot trade districts with improvements (must sell improvements first).
- Validation: cannot trade mortgaged districts without explicitly including the mortgage transfer.

### 5.9 Bankruptcy

- Triggered when a player cannot pay a debt (rent, tax, card effect).
- Must sell improvements and mortgage districts to raise capital.
- If still unable to pay:
  - **If debt is to another player**: all assets transfer to creditor.
  - **If debt is to the bank**: all assets are auctioned individually.
- Bankrupt player is eliminated (`isEliminated: true`).
- Eliminated players are skipped in turn order.

### 5.10 Seeded RNG

- A seed is generated at game creation and stored in public state.
- An `rngCounter` increments with each random event (dice roll, card draw, etc.).
- The PRNG function is deterministic: `prng(seed, counter) → number`.
- This allows server-side validation of dice rolls without client manipulation.
- The client adapter calls `validateMove()` with the same PRNG, producing identical results.

---

## 6. File-by-File Action Plan

### 6.1 Files to CREATE

#### Client Adapter (sub-folder pattern)

| File                                                       | Size Est.  | Content                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/gamesV4/adapters/metroMagnate/metroMagnateTypes.ts`   | ~300 lines | All interfaces: `MetroMagnatePublicState`, `BoardSpace`, `DistrictState`, `SectorDefinition`, `PlayerState`, `AuctionState`, `TradeOffer`, `CardEffect`, `MetroMagnateSettings`, move payload types, turn phases                                                                                                                    |
| `src/gamesV4/adapters/metroMagnate/metroMagnateBoard.ts`   | ~400 lines | Static board data: 40 board spaces, 8 sector definitions, 22 district cards with rents, 4 transit lines, 2 service nodes, 16+16 card definitions, starting capital configs                                                                                                                                                          |
| `src/gamesV4/adapters/metroMagnate/metroMagnateEngine.ts`  | ~800 lines | Pure functions: `rollDice()`, `movePlayer()`, `calculateRent()`, `canBuyDistrict()`, `processAuction()`, `validateTrade()`, `processBankruptcy()`, `calculateNetWorth()`, `checkTerminal()`, `drawCard()`, `applyCardEffect()`, `canBuildImprovement()`, `evenBuildCheck()`, `mortgageDistrict()`, `unmortgageDistrict()`, `prng()` |
| `src/gamesV4/adapters/metroMagnate/metroMagnateAdapter.ts` | ~500 lines | `GameAdapterV4` implementation: `createInitialPublicState()`, `validateMove()` (dispatcher for all move types), `computeOutcome()`, `computeSummary()`, `extractPerformanceMetrics()`, `getSpectatorView()`, `validateSettings()`, settings schema                                                                                  |
| `src/gamesV4/adapters/metroMagnate/index.ts`               | ~10 lines  | `registerAdapter(metroMagnateAdapter); export { ... }`                                                                                                                                                                                                                                                                              |

#### Gameplay Screen

| File                                           | Size Est.   | Content                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/gamesV4/screens/MetroMagnateScreenV4.tsx` | ~1200 lines | Board rendering (loop layout), player token positions, dice animation, district cards overlay, buy/decline/auction UI, trade proposal modal, improvement build UI, mortgage controls, player stats panel, turn phase indicators. Uses `withGameV4Shell(MetroMagnateScreen, "metro_magnate")`. |

#### Tests

| File                                              | Size Est.  | Content                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/gamesV4/adapters/metroMagnate.test.ts` | ~600 lines | 12-section test suite: metadata, initial state, move validation (all 16+ move types), game logic (rent, auction, trade, bankruptcy, elimination), `computeOutcome()`, `computeSummary()`, `extractPerformanceMetrics()`, spectator view, settings validation, full simulation (2-player Express game to completion) |

### 6.2 Files to EDIT

#### Client-side registration (6 files)

| File                                           | Change                                                                                                                                                            | Lines Added |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `src/gamesV4/types/common.ts`                  | Add `\| "metro_magnate"` to `GameId` union, in the turn-based section                                                                                             | 1           |
| `src/gamesV4/constants.ts`                     | Add `GAME_METADATA["metro_magnate"]`, `GAME_DESCRIPTIONS["metro_magnate"]`, `SCOREBOARD_DESCRIPTORS["metro_magnate"]`, `LEADERBOARD_DESCRIPTORS["metro_magnate"]` | ~80         |
| `src/gamesV4/adapters/index.ts`                | Add `import "./metroMagnate"`                                                                                                                                     | 1           |
| `src/gamesV4/screens/GamePlayDispatcherV4.tsx` | Add `metro_magnate: MetroMagnateScreenV4` to screen map + import                                                                                                  | 2           |
| `src/gamesV4/data/achievementDefinitions.ts`   | Add section def + ~12–15 achievement defs                                                                                                                         | ~60         |

#### Backend registration (4 files)

| File                                                     | Change                                                                                        | Lines Added |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------- |
| `firebase-backend/functions/src/gamesV4/types.ts`        | Add `\| "metro_magnate"` to `GameId` union + `metro_magnate: "wins"` to `LEADERBOARD_METRICS` | 2           |
| `firebase-backend/functions/src/gamesV4/invites.ts`      | Add `metro_magnate` entry to `GAME_META` map                                                  | 1           |
| `firebase-backend/functions/src/gamesV4/adapters.ts`     | Register full backend Metro Magnate adapter (can import shared engine) or inline              | ~800        |
| `firebase-backend/functions/src/gamesV4/achievements.ts` | Add `metro_magnate` section + evaluator defs (~12–15 achievements)                            | ~80         |

#### Enable gate (last step)

| File                       | Change                                                |
| -------------------------- | ----------------------------------------------------- |
| `src/gamesV4/constants.ts` | Add `"metro_magnate"` to `IMPLEMENTED_GAME_IDS` array |

---

## 7. Phase-by-Phase Implementation Plan

### Phase 1: Scaffolding + Types + Board Data + Static Definitions

**Goal**: All type definitions, static board data, and metadata registrations exist. The game appears in the catalog as "Coming Soon" but is not playable.

**Deliverables**:

1. Add `"metro_magnate"` to both `GameId` unions (client + backend).
2. Create `metroMagnateTypes.ts` — all interfaces.
3. Create `metroMagnateBoard.ts` — 40-space board definition, sector definitions, district rent tables, card decks.
4. Add `GAME_METADATA["metro_magnate"]` entry to `src/gamesV4/constants.ts`.
5. Add `GAME_DESCRIPTIONS["metro_magnate"]` entry.
6. Add `SCOREBOARD_DESCRIPTORS["metro_magnate"]` entry.
7. Add `LEADERBOARD_DESCRIPTORS["metro_magnate"]` entry.
8. Add `metro_magnate` to backend `GAME_META` in `invites.ts`.
9. Add `metro_magnate: "wins"` to `LEADERBOARD_METRICS` in backend `types.ts`.
10. Do NOT add to `IMPLEMENTED_GAME_IDS` yet.

**Verification**: TypeScript compiles. No runtime errors. Game shows as "Coming Soon" in Games Hub.

---

### Phase 2: Core Engine — Movement, Rent, Ownership

**Goal**: The pure game engine handles the core turn loop: roll dice → move → land → buy/pay rent → end turn.

**Deliverables**:

1. Create `metroMagnateEngine.ts` with:
   - Seeded PRNG (`prng(seed, counter)`)
   - `rollDice(state)` → `[die1, die2]` using seeded RNG
   - `movePlayer(state, uid, steps)` → new position, pass-Central-Terminal salary
   - `calculateRent(state, districtId, diceTotal)` → amount owed (handles all rent tiers)
   - `canBuyDistrict(state, uid, districtId)` → boolean
   - `buyDistrict(state, uid, districtId)` → next state
   - `calculateNetWorth(state, uid)` → total value
   - `checkTerminal(state)` → terminal result or null
   - Tax space handlers
   - Inspection Hold entry/exit logic
   - Doubles detection and counting
2. Write Phase 2 tests:
   - PRNG determinism
   - Movement wrap-around
   - Salary collection on pass
   - Basic rent calculation at all improvement levels
   - District purchase validation
   - Doubles → extra turn
   - Three doubles → Inspection Hold
   - Net worth calculation
   - Terminal detection for Express mode (round limit reached)

**Verification**: All unit tests pass. Engine functions are pure and deterministic.

---

### Phase 3: Economy Systems — Auctions, Improvements, Mortgages, Bankruptcy, Trading

**Goal**: All economic mechanics work in the engine.

**Deliverables**:

1. Add to `metroMagnateEngine.ts`:
   - `startAuction(state, districtId)` → auction sub-state
   - `processAuctionBid(state, uid, amount)` → next auction state
   - `processAuctionPass(state, uid)` → next state (may resolve auction)
   - `canBuildImprovement(state, uid, districtId)` → boolean (even build rule)
   - `buildImprovement(state, uid, districtId)` → next state
   - `sellImprovement(state, uid, districtId)` → next state
   - `mortgageDistrict(state, uid, districtId)` → next state
   - `unmortgageDistrict(state, uid, districtId)` → next state
   - `validateTradeOffer(state, offer)` → validation result
   - `executeTrade(state, offer)` → next state
   - `processBankruptcy(state, debtorUid, creditorUid, amount)` → next state (may eliminate player)
   - Card deck management: `drawCard(state, deckType)`, `applyCardEffect(state, card)`
   - `reshuffleDeck(state, deckType)` when deck is empty
2. Write Phase 3 tests:
   - Auction bidding cycle (2–6 players)
   - Auction resolution (last bidder wins, all pass → no sale)
   - Even build rule enforcement
   - Improvement build/sell at correct prices
   - Mortgage/unmortgage with 10% interest
   - Trade validation (no improvements on traded districts, capital checks)
   - Trade execution
   - Bankruptcy to player (asset transfer)
   - Bankruptcy to bank (asset auction)
   - Player elimination and turn order skip
   - Classic mode termination (last player standing)
   - Card draw and effect application
   - Full sector ownership detection (rent doubling)

**Verification**: All unit tests pass. Economy is balanced and all edge cases handled.

---

### Phase 4: Client Adapter + Backend Adapter

**Goal**: The game adapter dispatches all move types through the engine, and both client and backend adapters are registered and validated.

**Deliverables**:

1. Create `metroMagnateAdapter.ts`:
   - `createInitialPublicState(players, settings)` — initialize board, shuffle decks, assign starting positions, distribute starting capital
   - `validateMove(state, _, movePayload, ctx)` — dispatcher: switch on `movePayload.type` → route to appropriate engine function → return `MoveValidationResult`
   - `computeOutcome(state, players)` — sort by net worth, assign placements
   - `computeSummary(state, players, currentTurnUid)` — capital as score summary
   - `extractPerformanceMetrics(state, players)` — districts owned, improvements built, rent collected, times in inspection, rounds survived
   - `getSpectatorView(state)` — return state as-is (public state game)
   - `validateSettings(patch)` — merge with defaults, validate game mode/capital/rules
   - Settings schema definition
   - Scoreboard descriptor
2. Create `index.ts` — register adapter.
3. Add `import "./metroMagnate"` to `src/gamesV4/adapters/index.ts`.
4. Register backend adapter in `firebase-backend/functions/src/gamesV4/adapters.ts`:
   - Backend adapter mirrors client logic (can share engine code if backend supports import, otherwise duplicate pure functions).
   - Backend adapter is authoritative; client adapter is for optimistic UI.
5. Write full adapter test suite (`__tests__/gamesV4/adapters/metroMagnate.test.ts`):
   - 12-section structure matching existing test patterns
   - Metadata correctness
   - Initial state for 2, 3, 4, 5, 6 players
   - All move type validations (valid + invalid)
   - Full 2-player Express game simulation to terminal

**Verification**: `npx jest --testPathPattern=metroMagnate` passes. Backend builds: `cd firebase-backend/functions && npm run build`.

---

### Phase 5: Gameplay Screen & UI

**Goal**: The game is playable in the app with a complete board UI.

**Deliverables**:

1. Create `MetroMagnateScreenV4.tsx`:
   - Board rendering: 40-space loop displayed as a rectangular perimeter (10×10 grid border like Monopoly) or a circular path
   - Player tokens with distinctive colors/icons (up to 6)
   - Dice display with animation
   - Current player indicator
   - Phase-specific action buttons:
     - Pre-roll: "Roll Dice" button
     - Buying: "Buy ($X)" / "Decline" buttons
     - Auction: bid input + "Bid" / "Pass" buttons
     - Trading: trade proposal form
     - Building: improvement selector per district
     - Mortgage: mortgage/unmortgage toggles
   - District detail overlay (tap a space to see ownership, rent schedule, improvements)
   - Player panel: name, capital, owned districts count, net worth
   - Turn phase indicator header
   - Express mode: round counter
   - "End Turn" button (gated on mandatory actions completed)
   - Resign confirmation dialog
   - Scroll/zoom for smaller screens
2. Wire into `GamePlayDispatcherV4.tsx`.
3. Use `withGameV4Shell(MetroMagnateScreen, "metro_magnate")` wrapper.
4. Integrate with shell props: `publicState`, `submitMove`, `isMyTurn`, `isTerminal`, `actionLoading`, `actionError`.

**Verification**: Manual testing with 2+ players through full lobby → gameplay → game over flow.

---

### Phase 6: Achievements + Result + Game Over + Stats + History Integration

**Goal**: Full post-game integration. Achievements unlock, leaderboards update, stats show correctly.

**Deliverables**:

1. Add client achievement definitions to `src/gamesV4/data/achievementDefinitions.ts`:

   | Achievement              | Difficulty | Description                         |
   | ------------------------ | ---------- | ----------------------------------- |
   | `mm_first_commute`       | easy       | Play your first game                |
   | `mm_district_mogul`      | easy       | Own 5 districts in one game         |
   | `mm_first_tower`         | medium     | Build your first Tower              |
   | `mm_sector_monopoly`     | medium     | Complete a full sector              |
   | `mm_rent_collector`      | medium     | Collect $2000+ in rent in one game  |
   | `mm_express_winner`      | medium     | Win an Express mode game            |
   | `mm_tycoon`              | hard       | Win with net worth over $5000       |
   | `mm_five_player_victory` | hard       | Win a 5+ player game                |
   | `mm_bankruptor`          | hard       | Bankrupt 3 opponents in one game    |
   | `mm_no_mortgage_win`     | expert     | Win without mortgaging any district |
   | `mm_tower_empire`        | expert     | Build 5 towers in one game          |
   | `mm_metro_legend`        | legendary  | Win 25 games                        |

2. Add backend achievement evaluators to `firebase-backend/functions/src/gamesV4/achievements.ts`:
   - Mirror the client definitions with `evaluate: (ctx) => boolean` functions
   - Use `ctx.performanceMetrics` for game-specific stats
   - Use `ctx.pbStats.totalWins` for cumulative win achievements

3. Verify Game Over screen renders correctly:
   - Net worth as score
   - Placement ranking
   - Stats: districts owned, improvements built, rent collected, rounds survived
   - XP award row
   - Achievement unlock rows

4. Verify leaderboard shows wins correctly.
5. Verify PB doc writes `totalPlays` and `totalWins`.
6. Verify stats screen shows Metro Magnate history.

**Verification**: Full end-to-end test: lobby → gameplay → game over → check result doc → check PB doc → check leaderboard → check achievements.

---

### Phase 7: Hardening, Polish, Enable

**Goal**: Production-ready. Enabled in `IMPLEMENTED_GAME_IDS`.

**Deliverables**:

1. Edge case hardening:
   - All players resign except one
   - Player disconnects mid-auction
   - 7-day inactivity auto-resolution
   - 6-player game with 4 eliminations
   - Trade with mortgaged district edge cases
   - Empty card deck reshuffle
   - Express mode exact round boundary
2. Mobile polish:
   - Board fits on small screens (responsive layout)
   - Touch targets are large enough
   - Scroll behavior on board
   - District detail overlay dismissal
   - Dice animation performance
3. Final test pass:
   - `npx jest --testPathPattern=metroMagnate`
   - `cd firebase-backend/functions && npm run build`
   - Manual QA: 2-player Classic, 4-player Express, spectator join, resign mid-game
4. Add `"metro_magnate"` to `IMPLEMENTED_GAME_IDS`.
5. Add `GAME_DESCRIPTIONS.metro_magnate` with finalized how-to-play and tips text.

**Verification**: Game appears as playable. Full QA checklist from §12.3 of Game Integration Guide passes.

---

## 8. Do Not Drift Checklist

These are the V4 contracts that must not be violated during Metro Magnate implementation.

### 8.1 Type System Contracts

- [ ] `GameId` union in `src/gamesV4/types/common.ts` and `firebase-backend/functions/src/gamesV4/types.ts` must both contain `"metro_magnate"` and stay in sync.
- [ ] `GameAdapterV4` interface in `src/gamesV4/types/adapter.ts` must not be modified. Metro Magnate must conform to the existing interface.
- [ ] `MoveValidationResult` shape must not be altered. Use existing fields: `ok`, `error`, `nextPublicState`, `turnAdvance`, `nextTurnPlayerId`, `terminal`, `scoreDelta`.
- [ ] `GameOutcome` shape must not be altered. `finalScoreboard` entries must have `uid`, `score`, `placement`, `stats`.

### 8.2 Registration Contracts

- [ ] Client adapter must call `registerAdapter()` on import.
- [ ] Client adapter `index.ts` must be imported in `src/gamesV4/adapters/index.ts`.
- [ ] Backend adapter must be registered in `firebase-backend/functions/src/gamesV4/adapters.ts`.
- [ ] Backend invite metadata must be added to `GAME_META` in `invites.ts`.
- [ ] `LEADERBOARD_METRICS` must include `metro_magnate: "wins"`.
- [ ] Screen must be registered in `GamePlayDispatcherV4.tsx` `GAME_SCREEN_MAP`.

### 8.3 Lifecycle Contracts

- [ ] Do not modify `submitTurnMoveV4` in `sessions.ts`. The adapter's `validateMove()` is called by the existing pipeline.
- [ ] Do not modify `resolveSessionV4Internal` in `resolve.ts`. The existing 10-phase pipeline handles XP, PB, leaderboards, achievements, and notifications.
- [ ] Do not write PBs, leaderboard entries, or XP directly from the adapter. Let the resolve pipeline handle it.
- [ ] Do not modify `GameScreenShell`. Use `withGameV4Shell(Component, gameId)` as-is.
- [ ] Do not modify `useGameSessionV4` or `useGameLobbyV4`. Use the shell's injected props.
- [ ] Do not add Firebase triggers for Metro Magnate. The existing session lifecycle triggers are sufficient for turn-based games.

### 8.4 State Contracts

- [ ] Public state must be a flat `Record<string, unknown>` with no nested arrays (or use flat arrays like Hex/Dots & Boxes).
- [ ] If nested arrays are unavoidable, rely on the existing `serializeStateForFirestore` / `deserializeStateFromFirestore` pipeline — do not create a custom serializer.
- [ ] Public state must include enough data for `computeOutcome()` to determine winner, placements, and scores without external lookups.
- [ ] Public state must include enough data for `computeSummary()` to produce `turnPlayerId` and `scoreSummary[]`.

### 8.5 Scoring & Leaderboard Contracts

- [ ] Scoreboard descriptor `formatScore` must produce the same visual format as displayed on Game Over.
- [ ] Leaderboard descriptor `metric` must match the backend `LEADERBOARD_METRICS` value.
- [ ] `computeOutcome().finalScoreboard[].score` must be the canonical value that the leaderboard metric uses. For `"wins"`, this means winner gets score=1, losers get score=0 (the resolve pipeline increments `totalWins` based on `placement === 1`, not the `score` field, but consistency helps).
- [ ] Actually — for wins-based games, the resolve pipeline uses `placement === 1` to determine wins and increments `totalWins`. The `score` field is used for `"bestScore"` metrics. For Metro Magnate with `"wins"` metric, `score` can be net worth (for display) and the pipeline will still correctly track wins by placement.

### 8.6 Achievement Contracts

- [ ] Client achievement definitions in `achievementDefinitions.ts` must mirror backend evaluators in `achievements.ts` exactly (same `type` string, same `sectionId`).
- [ ] Achievement evaluators must use `ctx.performanceMetrics` for game-specific stats and `ctx.pbStats` for cumulative stats.
- [ ] Section `sectionId` must match between client and backend.
- [ ] Achievement `type` strings must be unique across the entire system.

### 8.7 UI Contracts

- [ ] Game screen must export via `withGameV4Shell(Component, gameId)`.
- [ ] Game screen must gate all interactions on `isMyTurn && !isTerminal && !actionLoading`.
- [ ] Game screen must call `submitMove(movePayload)` without awaiting — the shell handles async + optimistic revert.
- [ ] Game screen must not implement its own terminal navigation — the shell handles game-over transition.
- [ ] Game screen must not implement its own presence writes — the shell handles presence.

### 8.8 Testing Contracts

- [ ] Adapter tests must follow the 12-section structure used by all other adapter tests.
- [ ] Tests must live in `__tests__/gamesV4/adapters/metroMagnate.test.ts`.
- [ ] Tests must verify: metadata, initial state, valid/invalid moves, game logic, outcome, summary, metrics, spectator view, settings validation, full simulation.

### 8.9 Enablement Contract

- [ ] `"metro_magnate"` must not be added to `IMPLEMENTED_GAME_IDS` until ALL of the following are true:
  - Client adapter exists and is registered
  - Backend adapter exists and is registered
  - Backend invite metadata exists
  - Gameplay screen exists and is in the dispatcher
  - Achievement definitions exist in both client and backend
  - Scoreboard and leaderboard descriptors exist
  - Adapter tests pass
  - Backend builds successfully

---

## 9. Blockers & Risks

### 9.1 State Size

**Risk**: A 6-player Metro Magnate game with full auction history, trade history, and 40 spaces of data could produce a large public state document.

**Mitigation**: Keep state minimal. Do not store full history of every trade or auction — only the current active auction/trade and accumulated metrics. Estimated worst case: ~15–20KB, well within Firestore's 1MB limit.

### 9.2 Backend Adapter Code Sharing

**Risk**: The backend adapter in `firebase-backend/functions/src/gamesV4/adapters.ts` must duplicate the game engine logic from the client adapter because the two are in separate TypeScript compilation units (client = React Native, backend = Cloud Functions).

**Mitigation**: Extract the pure engine functions into a shape that can be copy-pasted or kept in sync manually. All engine functions are pure (no side effects, no imports from React Native or Firebase). Consider a `shared/` directory if the build system supports it, but the current codebase pattern is to duplicate logic between client and backend adapters (see Chess, Battleship, etc.).

### 9.3 Game Balance

**Risk**: Monopoly-like games are notoriously hard to balance. The rent/cost/improvement curves determine whether games drag or end too quickly.

**Mitigation**: Use well-known Monopoly balance ratios as a starting point (the numbers in §5.2 are already calibrated to classic Monopoly values). Express mode provides a natural bounded variant. Adjustable starting capital setting allows tuning.

### 9.4 Turn Complexity

**Risk**: A single Metro Magnate turn can involve multiple sub-phases (roll → move → land → buy/decline → auction → build → trade → end turn). This makes the `validateMove()` function more complex than any existing adapter.

**Mitigation**: Model turn sub-phases explicitly via the `phase` field in public state. Each move type is only valid in its corresponding phase. The `validateMove()` function dispatches by move type, and each handler is a focused pure function.

### 9.5 Auction Turn Order

**Risk**: During an auction, the "current player" is the active bidder, not the turn-order player. The shell's `isMyTurn` is based on `session.currentTurnPlayerId`. If the auction needs to cycle through bidders, we need to update `currentTurnPlayerId` on each bid.

**Mitigation**: Use `nextTurnPlayerId` in the `MoveValidationResult` to explicitly set which bidder is next during the auction phase. The shell will correctly show `isMyTurn = true` for the active bidder. When the auction resolves, set `nextTurnPlayerId` back to the turn-order player for the end-of-turn phase.

### 9.6 Client Screen Complexity

**Risk**: The board UI is significantly more complex than any existing game screen. A 40-space loop board with 6 player tokens, district cards, auction overlay, trade modal, improvement indicators, and dice animation is a major React Native rendering challenge.

**Mitigation**: Phase 5 is dedicated entirely to UI. Consider breaking the screen into sub-components (Board, PlayerPanel, DiceRoll, DistrictCard, AuctionOverlay, TradeModal, BuildMenu). Use `React.memo` aggressively for the board to prevent re-renders on every state update.

### 9.7 Firestore Nested Array Serialization

**Risk**: If the board contains any nested arrays (e.g., a 2D array for the board grid), Firestore will reject the write.

**Mitigation**: Design the board as a flat `BoardSpace[]` array (40 elements). All sub-structures use `Record<string, T>` maps instead of nested arrays. The existing `serializeStateForFirestore` handles edge cases if any slip through, but avoiding them by design is better.

---

## 10. Recommended Next Take

### Take 2: Phase 1 — Scaffolding + Types + Board Data + Metadata

This is the ideal next step because:

1. It is entirely non-invasive — no runtime behavior changes.
2. It establishes the type foundation that all subsequent phases build on.
3. It registers the game as "Coming Soon" in the catalog, proving metadata integration works.
4. It can be verified quickly: TypeScript compilation + Games Hub visual check.
5. It unblocks Phases 2–4 (engine and adapter work) which depend on the type definitions.

**Scope for Take 2**:

- Add `"metro_magnate"` to both `GameId` unions
- Create `metroMagnateTypes.ts` (all interfaces)
- Create `metroMagnateBoard.ts` (40-space board, sectors, cards)
- Add all metadata entries to `constants.ts`
- Add backend invite metadata
- Add backend leaderboard metric
- Do NOT create adapter, engine, screen, or tests yet
- Do NOT add to `IMPLEMENTED_GAME_IDS`

**Expected deliverable**: ~700 lines of new type/data code spread across 2 new files + ~90 lines of metadata edits across 5 existing files.
