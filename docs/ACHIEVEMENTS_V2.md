# Achievements V2 System

> **Last Updated**: 2025-01-15
> **Status**: ✅ Implemented — Server-authoritative, feature-flagged
> **Feature Flag**: `ACHIEVEMENTS_V2_FEATURES` in `constants/featureFlags.ts`

---

## Overview

Achievements V2 is a server-authoritative achievement system that replaces the
client-evaluated V1 approach. Achievements are evaluated by Cloud Functions
after game completion and stored as individual Firestore documents per user.

### Key Differences from V1

| Aspect              | V1 (Legacy)                          | V2                                                |
| ------------------- | ------------------------------------ | ------------------------------------------------- |
| Evaluation          | Client-side (hook)                   | Server-side (Cloud Function)                      |
| Storage             | `PlayerAchievements/{id}` single doc | `users/{uid}/achievements/{achvId}` subcollection |
| Progress tracking   | Binary (unlocked/locked)             | Numeric progress toward target                    |
| Catalog             | Code-defined in client               | Static catalog + server copy                      |
| Social achievements | None                                 | Invites, spectating, rematches                    |
| Feature flag        | Always on                            | `ACHIEVEMENTS_V2_FEATURES.ENABLED`                |

---

## Architecture

```
┌──────────────┐    game completion    ┌──────────────────────────┐
│ Game Screen  │ ──────────────────▶  │ processGameCompletion()  │
│ (Client)     │                       │ (Cloud Function)         │
└──────────────┘                       └────────┬─────────────────┘
                                                │
                                    ┌───────────▼───────────────┐
                                    │ updatePerGameStatsV2()    │
                                    │ evaluateAchievementsV2()  │
                                    │ syncLegacyAchievements()  │
                                    └───────────┬───────────────┘
                                                │
                              ┌─────────────────┼─────────────────────┐
                              │                 │                     │
                    ┌─────────▼───┐   ┌─────────▼───┐   ┌────────────▼──────┐
                    │ /users/{uid}│   │ /users/{uid}│   │ PlayerAchievements│
                    │ /achievements│  │ /summary   │   │ /{playerId} (V1)  │
                    └─────────────┘   └─────────────┘   └───────────────────┘
```

---

## Firestore Schema

### Achievement Documents

**Path**: `/users/{uid}/achievements/{achievementId}`

```typescript
interface UserAchievementDoc {
  achievementId: string;
  state: "locked" | "progress" | "unlocked";
  progress: number; // Current progress toward target
  target: number; // Target value from catalog
  unlockedAt: number | null;
  version: number; // Catalog version at evaluation time
  source: "server" | "migration" | "client";
  updatedAt: number;
  createdAt: number;
}
```

### Per-Game Stats

**Path**: `/users/{uid}/statsPerGame/{gameType}`

```typescript
interface PerGameStatsDoc {
  gameType: ExtendedGameType;
  played: number;
  wins: number;
  completed: number;
  solved: number;
  streak: number;
  bestStreak: number;
  highScore: number;
  matches: number;
  lastPlayedAt: number;
  firstPlayedAt: number;
  updatedAt: number;
}
```

### Achievement Summary

**Path**: `/users/{uid}/achievementSummary/summary`

Aggregated totals updated after each evaluation pass.

### Social Game Stats

**Path**: `/users/{uid}/socialGameStats/counters`

```typescript
interface SocialGameStatsDoc {
  invitesSent: number;
  invitesAcceptedByOthers: number;
  gamesWatched: number;
  turnBasedRematchesCompleted: number;
  updatedAt: number;
}
```

---

## Achievement Catalog

Defined in `src/config/achievementsCatalog.ts`.

### Categories

| Category        | Description                                  | Count |
| --------------- | -------------------------------------------- | ----- |
| `global`        | Cross-game (play X games, variety, social)   | 8     |
| `single_player` | Per-game first-play + score tiers            | ~30   |
| `turn_based`    | Per-game first-match, first-win, wins, plays | ~33   |
| `real_time`     | Crossword multiplayer achievements           | 2     |

### Tiers

| Tier     | XP Reward | Coin Reward |
| -------- | --------- | ----------- |
| Bronze   | 25        | 10          |
| Silver   | 50        | 25          |
| Gold     | 100       | 50          |
| Platinum | 250       | 100         |
| Diamond  | 500       | 250         |

### Progress Types

- **count**: Cumulative count toward target (games played, wins)
- **threshold**: Reach a value (high score >= X)
- **streak**: Consecutive streak (best streak >= X)
- **instant**: Binary unlock on first trigger (target = 1)
- **pct_of_max**: Percentage of score limit max (high score / max >= threshold)

### Gating

`isAchievementActive(def)` checks:

1. `def.isEnabledByDefault === true`
2. If `def.gameType` exists: `GAME_METADATA[gameType].isAvailable && !comingSoon`

---

## Server-Side Evaluator

**File**: `firebase-backend/functions/src/achievementsV2Evaluator.ts`

### Functions

| Export                          | Purpose                                     |
| ------------------------------- | ------------------------------------------- |
| `evaluateAchievementsV2()`      | Full evaluation pass for a user             |
| `updatePerGameStatsV2()`        | Update per-game stats after game completion |
| `migrateExistingAchievements()` | Seed v2 docs from legacy + V1 data          |

### Design Principles

1. **Idempotent**: Running multiple times never reduces progress or re-locks
2. **Server-authoritative**: `source = "server"` — can't be spoofed by client
3. **Minimal reads**: Only reads stats relevant to active achievements
4. **Batch writes**: Groups all updates into a single Firestore batch
5. **Score validation**: Inline check against `SCORE_LIMITS` per game type

### Integration Point

Called from `processGameCompletion()` in `firebase-backend/functions/src/games.ts`:

```typescript
// After existing v1 stats/achievements:
await updatePerGameStatsV2(playerId, gameType, outcome, score);
await evaluateAchievementsV2(playerId);
```

---

## Social Counter Tracking

### Server-Side (Cloud Functions)

**File**: `firebase-backend/functions/src/socialGameStatsHelpers.ts`

- `incrementInvitesSent(userId)` — called in `onUniversalInviteUpdate`
- `incrementInvitesAccepted(userId)` — called in `onUniversalInviteUpdate`

### Client-Side (Colyseus hooks)

**File**: `src/services/socialGameStats.ts`

- `recordSpectatorWatch(userId)` — called in `useSpectator.ts` on spectator connection
- `recordRematchCompleted(userId)` — called in `useMultiplayerGame.ts`, `useCrosswordMultiplayer.ts`, `useMiniGolfDuels.ts` on rematch request/accept

---

## Client Hooks & UI

### useAchievementsV2

**File**: `src/hooks/useAchievementsV2.ts`

Real-time subscription to v2 achievement docs. Returns:

- `displayItems` — merged catalog + user docs with progress bars
- `unlockedIds` — set of unlocked achievement IDs
- `isUnlocked(id)` — quick check helper
- `summary` — total unlocked, XP earned, tier breakdown
- `newUnlocks` — IDs unlocked since last render (for toasts)

### AchievementsV2Screen

**File**: `src/screens/games/AchievementsV2Screen.tsx`

Activated when `ACHIEVEMENTS_V2_FEATURES.V2_UI = true`. Features:

- Tab-based: Global / Solo / Turn / Live
- Progress bars on each achievement card
- Tier badges with color coding
- Summary card with tier breakdown
- Secret achievements (hidden until in-progress)
- Sorted: In-progress → Unlocked → Locked

### Feature Flag Integration

`AchievementsScreen.tsx` delegates to `AchievementsV2Screen` via dynamic require:

```typescript
if (ACHIEVEMENTS_V2_FEATURES.V2_UI) {
  const AchievementsV2Screen = require("./AchievementsV2Screen").default;
  return <AchievementsV2Screen ... />;
}
```

---

## Legacy Compatibility

### Dual Write (Server)

The evaluator's `syncLegacyAchievements()` writes unlocked V2 IDs back to
`PlayerAchievements/{playerId}` progress map so V1 UI continues to work.

### Dual Read (Client)

When `ACHIEVEMENTS_V2_FEATURES.ENABLED = false`, the existing `useGameAchievements`
hook operates exactly as before. V2 is purely additive.

### Migration Path

1. Deploy server-side changes (evaluator + helpers)
2. Enable `ACHIEVEMENTS_V2_FEATURES.ENABLED = true` — V2 data starts accumulating
3. Run migration for existing users (via `migrateExistingAchievements()`)
4. Enable `ACHIEVEMENTS_V2_FEATURES.V2_UI = true` — switch to V2 screen
5. Eventually deprecate V1 hooks/services

---

## Firestore Rules

Server-write-only for achievement docs:

```
match /users/{uid}/achievements/{achievementId} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow write: if false; // Server-only
}
```

Client-writable for social stats (owner only):

```
match /users/{uid}/socialGameStats/{docId} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow create, update: if request.auth != null && request.auth.uid == uid;
}
```

---

## Testing

Test files in `__tests__/achievements/`:

| File                  | Tests | Coverage                               |
| --------------------- | ----- | -------------------------------------- |
| `catalogV2.test.ts`   | 30    | Catalog integrity, filtering, gating   |
| `evaluatorV2.test.ts` | 27    | Progress computation, evaluation logic |
| `serviceV2.test.ts`   | 18    | Display items, unlocked IDs, summary   |
| `triggers.test.ts`    | 9     | V1 achievement triggers (unchanged)    |

Run all: `npx jest __tests__/achievements/ --no-coverage`

---

## File Index

### New Files

| File                                                        | Purpose                            |
| ----------------------------------------------------------- | ---------------------------------- |
| `src/types/achievementsV2.ts`                               | V2 type definitions                |
| `src/config/achievementsCatalog.ts`                         | Static achievement catalog         |
| `src/services/achievementsV2.ts`                            | Client-side V2 read service        |
| `src/services/socialGameStats.ts`                           | Client-side social counter helpers |
| `src/hooks/useAchievementsV2.ts`                            | V2 React hook                      |
| `src/screens/games/AchievementsV2Screen.tsx`                | V2 achievements UI                 |
| `firebase-backend/functions/src/achievementsV2Evaluator.ts` | Server-side evaluator              |
| `firebase-backend/functions/src/socialGameStatsHelpers.ts`  | Server-side counter helpers        |

### Modified Files

| File                                       | Change                                        |
| ------------------------------------------ | --------------------------------------------- |
| `firebase-backend/functions/src/games.ts`  | Integration of V2 evaluator + invite counters |
| `firebase-backend/firestore.rules`         | V2 subcollection rules                        |
| `constants/featureFlags.ts`                | `ACHIEVEMENTS_V2_FEATURES` flag               |
| `src/hooks/useSpectator.ts`                | `recordSpectatorWatch()` calls                |
| `src/hooks/useMultiplayerGame.ts`          | `recordRematchCompleted()` calls              |
| `src/hooks/useCrosswordMultiplayer.ts`     | `recordRematchCompleted()` calls              |
| `src/hooks/useMiniGolfDuels.ts`            | `recordRematchCompleted()` calls              |
| `src/screens/games/AchievementsScreen.tsx` | V2 delegation via feature flag                |
