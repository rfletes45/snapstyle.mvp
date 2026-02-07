# Game System Overhaul - Implementation Plan

> **Purpose**: This document provides step-by-step implementation instructions for the complete game system overhaul. Written for AI agent implementation - every code change includes exact file paths, line numbers, and complete code snippets.

---

## Implementation Status

| Phase   | Status          | Description                   |
| ------- | --------------- | ----------------------------- |
| Phase 1 | ✅ **COMPLETE** | Data Layer & Game History     |
| Phase 2 | ⏳ Not Started  | Enhanced Play Screen          |
| Phase 3 | ⏳ Not Started  | Game Management Actions       |
| Phase 4 | ⏳ Not Started  | Chat Integration Improvements |
| Phase 5 | ⏳ Not Started  | Game History Screen           |
| Phase 6 | ⏳ Not Started  | Navigation Overhaul           |
| Phase 7 | ⏳ Not Started  | Achievements & Statistics     |
| Phase 8 | ⏳ Not Started  | Leaderboards                  |

---

## Table of Contents

1. [Current System Analysis](#current-system-analysis)
2. [Phase 1: Data Layer & Game History](#phase-1-data-layer--game-history)
3. [Phase 2: Enhanced Play Screen](#phase-2-enhanced-play-screen)
4. [Phase 3: Game Management Actions](#phase-3-game-management-actions)
5. [Phase 4: Chat Integration Improvements](#phase-4-chat-integration-improvements)
6. [Phase 5: Game History Screen](#phase-5-game-history-screen)
7. [Phase 6: Navigation Overhaul](#phase-6-navigation-overhaul)
8. [Phase 7: Achievements & Statistics](#phase-7-achievements--statistics)
9. [Phase 8: Leaderboards](#phase-8-leaderboards)
10. [Implementation Sequence](#implementation-sequence)
11. [Testing Strategy](#testing-strategy)
12. [Deployment Checklist](#deployment-checklist)

---

## Current System Analysis

### Key Files and Their Purposes

| File                                           | Purpose                    | Lines | Key Exports                                                    |
| ---------------------------------------------- | -------------------------- | ----- | -------------------------------------------------------------- |
| `src/types/turnBased.ts`                       | Type definitions for games | ~889  | `TurnBasedMatch`, `GameType`, `MatchStatus`                    |
| `src/services/turnBasedGames.ts`               | Game CRUD operations       | ~1116 | `createMatch`, `submitMove`, `resignMatch`, `getActiveMatches` |
| `src/services/gameInvites.ts`                  | Universal invite system    | ~1606 | `createUniversalInvite`, `claimInviteSlot`, `startGameEarly`   |
| `src/screens/games/GamesHubScreen.tsx`         | Main Play screen           | ~1075 | `GamesHubScreen` component                                     |
| `src/components/ActiveGamesList.tsx`           | Active games display       | ~495  | `ActiveGamesList` component                                    |
| `src/components/games/UniversalInviteCard.tsx` | Invite card UI             | ~637  | `UniversalInviteCard` component                                |
| `firebase-backend/functions/src/games.ts`      | Cloud Functions            | ~1547 | `onUniversalInviteUpdate`, `processGameCompletion`             |

### Current Data Model

**TurnBasedMatch Interface** (src/types/turnBased.ts, lines 13-58):

```typescript
interface TurnBasedMatch {
  id: string;
  gameType: GameType;
  status: MatchStatus;
  players: MatchPlayer[];
  currentTurn: string;
  gameState: any;
  moves: GameMove[];
  settings: MatchSettings;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  winner?: string;
  // MISSING: conversationId, conversationType, playerArchivedAt
}
```

### Navigation Pattern Issue

**Current**: Game screens use `navigation.goBack()` which breaks when entering from different contexts (chat vs Play screen vs notification).

**Files with `navigation.goBack()` that need updating**:

- `src/screens/games/ChessGameScreen.tsx` (4 instances)
- `src/screens/games/CheckersGameScreen.tsx` (4 instances)
- `src/screens/games/CrazyEightsGameScreen.tsx` (5 instances)
- `src/screens/games/TicTacToeGameScreen.tsx` (4 instances)
- `src/screens/games/PoolGameScreen.tsx` (3 instances)
- Plus 10+ more single-player game screens

---

## Phase 1: Data Layer & Game History

### Overview

Add conversation context tracking to games and create the GameHistory infrastructure for completed games.

### Step 1.1: Update TurnBasedMatch Type

**File**: `src/types/turnBased.ts`

**Find this code** (around lines 13-58):

```typescript
export interface TurnBasedMatch {
  id: string;
  gameType: GameType;
  status: MatchStatus;
  players: MatchPlayer[];
  currentTurn: string;
  gameState: any;
  moves: GameMove[];
  settings: MatchSettings;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  winner?: string;
```

**Add these fields after `winner?: string;`**:

```typescript
  // Conversation context - where this game originated
  conversationId?: string;
  conversationType?: 'dm' | 'group';

  // Per-player archive status (playerUid -> timestamp when archived)
  playerArchivedAt?: Record<string, number>;
```

### Step 1.2: Create GameHistory Types

**Create new file**: `src/types/gameHistory.ts`

```typescript
/**
 * GameHistory - Stores completed game records for history/stats
 *
 * This is separate from TurnBasedMatch to:
 * 1. Keep active games collection lean
 * 2. Allow different security rules for history
 * 3. Enable efficient stats queries
 */

import { GameType, MatchStatus } from "./turnBased";

export interface GameHistoryRecord {
  id: string;

  // Game identification
  gameType: GameType;
  matchId: string;

  // Players involved
  players: GameHistoryPlayer[];
  winnerId?: string;

  // Outcome details
  status: MatchStatus; // 'completed', 'resigned', 'draw', 'timeout'
  endReason: GameEndReason;

  // Conversation context
  conversationId?: string;
  conversationType?: "dm" | "group";
  conversationName?: string;

  // Timestamps
  startedAt: number;
  completedAt: number;
  duration: number; // in milliseconds

  // Game stats
  totalMoves: number;
  finalScore?: Record<string, number>; // For scored games

  // Achievements earned this game
  achievementsEarned?: string[];
}

export interface GameHistoryPlayer {
  oderId: string;
  odername: string;
  avatarUrl?: string;

  // Stats for this game
  isWinner: boolean;
  finalScore?: number;
  movesPlayed: number;

  // Rating change (if rated game)
  ratingBefore?: number;
  ratingAfter?: number;
  ratingChange?: number;
}

export type GameEndReason =
  | "checkmate" // Chess
  | "stalemate" // Chess draw
  | "resignation" // Player resigned
  | "timeout" // Time ran out
  | "agreement" // Draw by agreement
  | "no_moves" // No legal moves (checkers)
  | "completion" // Normal game completion
  | "abandonment" // Game abandoned
  | "forfeit"; // Player forfeited

export interface GameHistoryQuery {
  oderId: string;
  gameType?: GameType;
  opponentId?: string;
  conversationId?: string;
  dateFrom?: number;
  dateTo?: number;
  outcome?: "win" | "loss" | "draw";
  limit?: number;
  startAfter?: string; // For pagination
}

export interface GameHistoryStats {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;

  byGameType: Record<
    GameType,
    {
      played: number;
      wins: number;
      losses: number;
      draws: number;
      winRate: number;
    }
  >;

  currentStreak: {
    type: "win" | "loss" | "none";
    count: number;
  };

  longestWinStreak: number;
  averageGameDuration: number;
}
```

### Step 1.3: Create GameHistory Service

**Create new file**: `src/services/gameHistory.ts`

```typescript
/**
 * GameHistory Service
 *
 * Handles querying and managing game history records.
 * Records are created by Cloud Functions when games complete.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  GameHistoryRecord,
  GameHistoryQuery,
  GameHistoryStats,
} from "../types/gameHistory";
import { GameType } from "../types/turnBased";

const GAME_HISTORY_COLLECTION = "GameHistory";

/**
 * Get game history for a user with optional filters
 */
export async function getGameHistory(params: GameHistoryQuery): Promise<{
  records: GameHistoryRecord[];
  hasMore: boolean;
  lastId?: string;
}> {
  const {
    oderId,
    gameType,
    opponentId,
    conversationId,
    dateFrom,
    dateTo,
    outcome,
    limit: queryLimit = 20,
    startAfter: startAfterId,
  } = params;

  // Build query - user must be a participant
  let q = query(
    collection(db, GAME_HISTORY_COLLECTION),
    where("playerIds", "array-contains", oderId),
    orderBy("completedAt", "desc"),
    limit(queryLimit + 1), // +1 to check if there are more
  );

  // Add optional filters
  if (gameType) {
    q = query(q, where("gameType", "==", gameType));
  }

  if (conversationId) {
    q = query(q, where("conversationId", "==", conversationId));
  }

  if (dateFrom) {
    q = query(q, where("completedAt", ">=", dateFrom));
  }

  if (dateTo) {
    q = query(q, where("completedAt", "<=", dateTo));
  }

  // Handle pagination
  if (startAfterId) {
    const startAfterDoc = await getDoc(
      doc(db, GAME_HISTORY_COLLECTION, startAfterId),
    );
    if (startAfterDoc.exists()) {
      q = query(q, startAfter(startAfterDoc));
    }
  }

  const snapshot = await getDocs(q);
  const records: GameHistoryRecord[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data() as GameHistoryRecord;

    // Client-side filter for opponent (can't do compound array queries)
    if (opponentId) {
      const hasOpponent = data.players.some((p) => p.oderId === opponentId);
      if (!hasOpponent) return;
    }

    // Client-side filter for outcome
    if (outcome) {
      const userPlayer = data.players.find((p) => p.oderId === oderId);
      if (!userPlayer) return;

      if (outcome === "win" && !userPlayer.isWinner) return;
      if (outcome === "loss" && userPlayer.isWinner) return;
      if (outcome === "draw" && data.winnerId) return;
    }

    records.push({ ...data, id: doc.id });
  });

  // Check if there are more results
  const hasMore = records.length > queryLimit;
  if (hasMore) {
    records.pop(); // Remove the extra one
  }

  return {
    records,
    hasMore,
    lastId: records.length > 0 ? records[records.length - 1].id : undefined,
  };
}

/**
 * Get a single game history record by ID
 */
export async function getGameHistoryById(
  historyId: string,
): Promise<GameHistoryRecord | null> {
  const docRef = doc(db, GAME_HISTORY_COLLECTION, historyId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  return { ...snapshot.data(), id: snapshot.id } as GameHistoryRecord;
}

/**
 * Get game history between two specific users
 */
export async function getHeadToHeadHistory(
  oderId: string,
  opponentId: string,
  gameType?: GameType,
  limitCount: number = 10,
): Promise<GameHistoryRecord[]> {
  const result = await getGameHistory({
    oderId,
    opponentId,
    gameType,
    limit: limitCount,
  });

  return result.records;
}

/**
 * Calculate stats for a user from their game history
 * Note: For performance, consider caching this or using aggregated stats
 */
export async function calculateUserStats(
  oderId: string,
  gameType?: GameType,
): Promise<GameHistoryStats> {
  // Fetch all history (in production, use aggregated stats collection)
  const result = await getGameHistory({
    oderId,
    gameType,
    limit: 1000, // Max for stats calculation
  });

  const stats: GameHistoryStats = {
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
    byGameType: {} as any,
    currentStreak: { type: "none", count: 0 },
    longestWinStreak: 0,
    averageGameDuration: 0,
  };

  let totalDuration = 0;
  let currentStreakType: "win" | "loss" | "none" = "none";
  let currentStreakCount = 0;
  let longestWinStreak = 0;
  let tempWinStreak = 0;

  for (const record of result.records) {
    stats.totalGames++;
    totalDuration += record.duration;

    const userPlayer = record.players.find((p) => p.oderId === oderId);
    if (!userPlayer) continue;

    // Track by game type
    const gt = record.gameType;
    if (!stats.byGameType[gt]) {
      stats.byGameType[gt] = {
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
      };
    }
    stats.byGameType[gt].played++;

    // Determine outcome
    if (!record.winnerId) {
      // Draw
      stats.draws++;
      stats.byGameType[gt].draws++;
      tempWinStreak = 0;
    } else if (userPlayer.isWinner) {
      // Win
      stats.wins++;
      stats.byGameType[gt].wins++;
      tempWinStreak++;
      longestWinStreak = Math.max(longestWinStreak, tempWinStreak);

      if (currentStreakType === "win" || currentStreakType === "none") {
        currentStreakType = "win";
        currentStreakCount++;
      } else {
        currentStreakType = "win";
        currentStreakCount = 1;
      }
    } else {
      // Loss
      stats.losses++;
      stats.byGameType[gt].losses++;
      tempWinStreak = 0;

      if (currentStreakType === "loss" || currentStreakType === "none") {
        currentStreakType = "loss";
        currentStreakCount++;
      } else {
        currentStreakType = "loss";
        currentStreakCount = 1;
      }
    }
  }

  // Calculate rates
  stats.winRate =
    stats.totalGames > 0 ? (stats.wins / stats.totalGames) * 100 : 0;
  stats.averageGameDuration =
    stats.totalGames > 0 ? totalDuration / stats.totalGames : 0;
  stats.longestWinStreak = longestWinStreak;
  stats.currentStreak = { type: currentStreakType, count: currentStreakCount };

  // Calculate per-game-type win rates
  for (const gt of Object.keys(stats.byGameType) as GameType[]) {
    const gtStats = stats.byGameType[gt];
    gtStats.winRate =
      gtStats.played > 0 ? (gtStats.wins / gtStats.played) * 100 : 0;
  }

  return stats;
}
```

### Step 1.4: Update exports

**File**: `src/types/index.ts`

**Add this export**:

```typescript
export * from "./gameHistory";
```

### Step 1.5: Create Cloud Function for Game Completion

**File**: `firebase-backend/functions/src/games.ts`

**Add this new function** (after the existing `processGameCompletion` function, around line 800):

```typescript
/**
 * Cloud Function: Create GameHistory record when a game completes
 *
 * Triggers when a TurnBasedMatch document's status changes to a terminal state
 */
export const onGameCompletedCreateHistory = onDocumentWritten(
  "TurnBasedMatches/{matchId}",
  async (event) => {
    const before = event.data?.before?.data() as TurnBasedMatch | undefined;
    const after = event.data?.after?.data() as TurnBasedMatch | undefined;

    if (!after) return; // Document deleted

    // Only process when status changes to terminal state
    const terminalStates = [
      "completed",
      "resigned",
      "draw",
      "timeout",
      "abandoned",
    ];
    const wasTerminal = before && terminalStates.includes(before.status);
    const isTerminal = terminalStates.includes(after.status);

    if (wasTerminal || !isTerminal) return; // Already processed or not terminal

    const matchId = event.params.matchId;

    logger.info(`Creating GameHistory for match ${matchId}`, {
      status: after.status,
    });

    // Determine end reason from status and game state
    let endReason: string = "completion";
    if (after.status === "resigned") {
      endReason = "resignation";
    } else if (after.status === "draw") {
      endReason = "agreement";
    } else if (after.status === "timeout") {
      endReason = "timeout";
    } else if (after.gameType === "chess" && after.gameState?.isCheckmate) {
      endReason = "checkmate";
    } else if (after.gameType === "chess" && after.gameState?.isStalemate) {
      endReason = "stalemate";
    }

    // Build player records
    const players = after.players.map((player) => ({
      oderId: player.oderId,
      odername: player.odername || player.displayName || "Unknown",
      avatarUrl: player.avatarUrl,
      isWinner: player.oderId === after.winner,
      finalScore: player.score,
      movesPlayed:
        after.moves?.filter((m) => m.playerId === player.oderId).length || 0,
      ratingBefore: player.ratingBefore,
      ratingAfter: player.ratingAfter,
      ratingChange:
        player.ratingAfter && player.ratingBefore
          ? player.ratingAfter - player.ratingBefore
          : undefined,
    }));

    // Create history record
    const historyRecord = {
      gameType: after.gameType,
      matchId: matchId,
      players,
      playerIds: after.players.map((p) => p.oderId), // For querying
      winnerId: after.winner,
      status: after.status,
      endReason,
      conversationId: after.conversationId,
      conversationType: after.conversationType,
      startedAt: after.createdAt,
      completedAt: after.completedAt || Date.now(),
      duration: (after.completedAt || Date.now()) - after.createdAt,
      totalMoves: after.moves?.length || 0,
      finalScore: after.players.reduce(
        (acc, p) => {
          if (p.score !== undefined) acc[p.oderId] = p.score;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };

    // Write to GameHistory collection
    const historyRef = admin.firestore().collection("GameHistory").doc();
    await historyRef.set({
      ...historyRecord,
      id: historyRef.id,
      createdAt: Date.now(),
    });

    logger.info(`GameHistory created: ${historyRef.id} for match ${matchId}`);
  },
);
```

**Don't forget to export it** at the bottom of the file:

```typescript
// Add to exports
exports.onGameCompletedCreateHistory = onGameCompletedCreateHistory;
```

### Step 1.6: Update createMatch to Accept Context

**File**: `src/services/turnBasedGames.ts`

**Find the `createMatch` function** (around line 232):

```typescript
export async function createMatch(
  gameType: GameType,
  players: { oderId: string; displayName: string }[],
  settings: MatchSettings = {}
): Promise<TurnBasedMatch> {
```

**Replace with**:

```typescript
export interface CreateMatchOptions {
  gameType: GameType;
  players: { oderId: string; displayName: string }[];
  settings?: MatchSettings;
  context?: {
    conversationId: string;
    conversationType: 'dm' | 'group';
  };
}

export async function createMatch(
  options: CreateMatchOptions
): Promise<TurnBasedMatch> {
  const { gameType, players, settings = {}, context } = options;
```

**Also update the match object creation** (in the same function, find where the match object is built):

```typescript
const match: TurnBasedMatch = {
  id: matchRef.id,
  gameType,
  status: "active",
  players: matchPlayers,
  currentTurn: matchPlayers[0].oderId,
  gameState: initialState,
  moves: [],
  settings: matchSettings,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  // ADD THESE LINES:
  ...(context && {
    conversationId: context.conversationId,
    conversationType: context.conversationType,
  }),
};
```

### Step 1.7: Update startGameEarly to Pass Context

**File**: `src/services/gameInvites.ts`

**Find the `startGameEarly` function** (around line 1020). Look for where it calls `createMatch`:

```typescript
// Current code (approximate):
const match = await createMatch(invite.gameType, players, invite.settings);
```

**Replace with**:

```typescript
const match = await createMatch({
  gameType: invite.gameType,
  players,
  settings: invite.settings,
  context: invite.conversationId
    ? {
        conversationId: invite.conversationId,
        conversationType: invite.context as "dm" | "group",
      }
    : undefined,
});
```

### Step 1.8: Add Firestore Security Rules

**File**: `firebase-backend/firestore.rules`

**Add these rules** (after the TurnBasedMatches rules section):

```javascript
    // GameHistory collection - completed game records
    match /GameHistory/{historyId} {
      // Anyone can read their own game history
      allow read: if request.auth != null &&
        request.auth.uid in resource.data.playerIds;

      // Only Cloud Functions can write (no client writes)
      allow write: if false;
    }
```

### Step 1.9: Add Firestore Indexes

**File**: `firebase-backend/firestore.indexes.json`

**Add these indexes to the `indexes` array**:

```json
{
  "collectionGroup": "GameHistory",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "playerIds", "arrayConfig": "CONTAINS" },
    { "fieldPath": "completedAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "GameHistory",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "playerIds", "arrayConfig": "CONTAINS" },
    { "fieldPath": "gameType", "order": "ASCENDING" },
    { "fieldPath": "completedAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "GameHistory",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "playerIds", "arrayConfig": "CONTAINS" },
    { "fieldPath": "conversationId", "order": "ASCENDING" },
    { "fieldPath": "completedAt", "order": "DESCENDING" }
  ]
}
```

---

## Phase 2: Enhanced Play Screen

### Overview

Redesign the Play screen to show active games grouped by turn status with filtering and quick actions.

### Step 2.1: Create Filter Types

**Create new file**: `src/types/gameFilters.ts`

```typescript
import { GameType } from "./turnBased";

export type GameFilterTab = "all" | "your-turn" | "their-turn" | "invites";

export interface GameFilters {
  tab: GameFilterTab;
  gameTypes: GameType[];
  conversationId?: string;
  showArchived: boolean;
}

export const DEFAULT_GAME_FILTERS: GameFilters = {
  tab: "all",
  gameTypes: [],
  showArchived: false,
};

export interface ActiveGameGroup {
  title: string;
  games: any[]; // Will be TurnBasedMatch[]
  emptyMessage: string;
}
```

### Step 2.2: Create ActiveGameCard Component

**Create new file**: `src/screens/games/components/ActiveGameCard.tsx`

```typescript
/**
 * ActiveGameCard - Card component for a single active game
 *
 * Features:
 * - Shows game type icon, opponent name, turn indicator
 * - 3-dot menu with: Go to Chat, Resign, Archive
 * - Tapping card navigates to game
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { TurnBasedMatch } from '../../../types/turnBased';
import { useAuth } from '../../../hooks/useAuth';
import { resignMatch, archiveGame } from '../../../services/turnBasedGames';
import { GAME_TYPE_CONFIG } from '../../../constants/gamesTheme';
import { colors, spacing, typography } from '../../../constants/theme';

interface ActiveGameCardProps {
  game: TurnBasedMatch;
  onGameAction?: () => void;
}

export function ActiveGameCard({ game, onGameAction }: ActiveGameCardProps) {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);

  const isYourTurn = game.currentTurn === user?.uid;
  const opponent = game.players.find(p => p.oderId !== user?.uid);
  const gameConfig = GAME_TYPE_CONFIG[game.gameType];

  const handlePress = () => {
    // Navigate to game screen
    const screenName = getGameScreenName(game.gameType);
    navigation.navigate(screenName, { matchId: game.id });
  };

  const handleGoToChat = () => {
    setMenuVisible(false);
    if (game.conversationId && game.conversationType) {
      if (game.conversationType === 'dm') {
        navigation.navigate('Chat', { oderId: opponent?.oderId });
      } else {
        navigation.navigate('GroupChat', { groupId: game.conversationId });
      }
    } else {
      Alert.alert('No Chat', 'This game was not started from a conversation.');
    }
  };

  const handleResign = () => {
    setMenuVisible(false);
    Alert.alert(
      'Resign Game',
      'Are you sure you want to resign? This will count as a loss.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resign',
          style: 'destructive',
          onPress: async () => {
            await resignMatch(game.id, user!.uid);
            onGameAction?.();
          },
        },
      ]
    );
  };

  const handleArchive = async () => {
    setMenuVisible(false);
    await archiveGame(game.id, user!.uid);
    onGameAction?.();
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress}>
      {/* Game Icon */}
      <View style={[styles.iconContainer, { backgroundColor: gameConfig?.color || colors.primary }]}>
        <Ionicons name={gameConfig?.icon || 'game-controller'} size={24} color="white" />
      </View>

      {/* Game Info */}
      <View style={styles.info}>
        <Text style={styles.gameName}>{gameConfig?.name || game.gameType}</Text>
        <Text style={styles.opponent}>vs {opponent?.displayName || 'Unknown'}</Text>
        <View style={styles.turnIndicator}>
          <View style={[styles.turnDot, isYourTurn ? styles.yourTurn : styles.theirTurn]} />
          <Text style={styles.turnText}>
            {isYourTurn ? 'Your turn' : `${opponent?.displayName}'s turn`}
          </Text>
        </View>
      </View>

      {/* Menu Button */}
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setMenuVisible(!menuVisible)}
      >
        <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Dropdown Menu */}
      {menuVisible && (
        <View style={styles.menu}>
          {game.conversationId && (
            <TouchableOpacity style={styles.menuItem} onPress={handleGoToChat}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.text} />
              <Text style={styles.menuItemText}>Go to Chat</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.menuItem} onPress={handleResign}>
            <Ionicons name="flag-outline" size={18} color={colors.error} />
            <Text style={[styles.menuItemText, { color: colors.error }]}>Resign</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={handleArchive}>
            <Ionicons name="archive-outline" size={18} color={colors.text} />
            <Text style={styles.menuItemText}>Archive</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

function getGameScreenName(gameType: string): string {
  const screenMap: Record<string, string> = {
    chess: 'ChessGame',
    checkers: 'CheckersGame',
    tic_tac_toe: 'TicTacToeGame',
    crazy_eights: 'CrazyEightsGame',
    pool: 'PoolGame',
    // Add more as needed
  };
  return screenMap[gameType] || 'ChessGame';
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
  },
  gameName: {
    ...typography.subtitle,
    color: colors.text,
  },
  opponent: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  turnIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  turnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  yourTurn: {
    backgroundColor: colors.success,
  },
  theirTurn: {
    backgroundColor: colors.textSecondary,
  },
  turnText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  menuButton: {
    padding: spacing.sm,
  },
  menu: {
    position: 'absolute',
    right: spacing.md,
    top: 50,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingVertical: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  menuItemText: {
    ...typography.body,
    marginLeft: spacing.sm,
    color: colors.text,
  },
});
```

### Step 2.3: Create ActiveGamesSection Component

**Create new file**: `src/screens/games/components/ActiveGamesSection.tsx`

```typescript
/**
 * ActiveGamesSection - Groups active games by turn status
 *
 * Shows:
 * - "Your Turn" section (highlighted)
 * - "Their Turn" section
 * - Empty states for each
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { TurnBasedMatch } from '../../../types/turnBased';
import { GameFilters } from '../../../types/gameFilters';
import { ActiveGameCard } from './ActiveGameCard';
import { useAuth } from '../../../hooks/useAuth';
import { colors, spacing, typography } from '../../../constants/theme';

interface ActiveGamesSectionProps {
  games: TurnBasedMatch[];
  filters: GameFilters;
  onRefresh?: () => void;
}

export function ActiveGamesSection({ games, filters, onRefresh }: ActiveGamesSectionProps) {
  const { user } = useAuth();

  const { yourTurnGames, theirTurnGames } = useMemo(() => {
    // Apply filters
    let filtered = games;

    // Filter by game type
    if (filters.gameTypes.length > 0) {
      filtered = filtered.filter(g => filters.gameTypes.includes(g.gameType));
    }

    // Filter out archived (unless showing archived)
    if (!filters.showArchived) {
      filtered = filtered.filter(g => {
        const archived = g.playerArchivedAt?.[user?.uid || ''];
        return !archived;
      });
    }

    // Split by turn
    const yourTurn = filtered.filter(g => g.currentTurn === user?.uid);
    const theirTurn = filtered.filter(g => g.currentTurn !== user?.uid);

    return { yourTurnGames: yourTurn, theirTurnGames: theirTurn };
  }, [games, filters, user?.uid]);

  const showYourTurn = filters.tab === 'all' || filters.tab === 'your-turn';
  const showTheirTurn = filters.tab === 'all' || filters.tab === 'their-turn';

  return (
    <View style={styles.container}>
      {/* Your Turn Section */}
      {showYourTurn && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Turn</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{yourTurnGames.length}</Text>
            </View>
          </View>

          {yourTurnGames.length > 0 ? (
            yourTurnGames.map(game => (
              <ActiveGameCard
                key={game.id}
                game={game}
                onGameAction={onRefresh}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No games waiting for your move</Text>
            </View>
          )}
        </View>
      )}

      {/* Their Turn Section */}
      {showTheirTurn && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, styles.theirTurnTitle]}>Waiting for Opponent</Text>
            <View style={[styles.badge, styles.theirTurnBadge]}>
              <Text style={styles.badgeText}>{theirTurnGames.length}</Text>
            </View>
          </View>

          {theirTurnGames.length > 0 ? (
            theirTurnGames.map(game => (
              <ActiveGameCard
                key={game.id}
                game={game}
                onGameAction={onRefresh}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No games waiting for opponent</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.success,
  },
  theirTurnTitle: {
    color: colors.textSecondary,
  },
  badge: {
    backgroundColor: colors.success,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  theirTurnBadge: {
    backgroundColor: colors.textSecondary,
  },
  badgeText: {
    ...typography.caption,
    color: 'white',
    fontWeight: 'bold',
  },
  emptyState: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
```

### Step 2.4: Create GameFilterBar Component

**Create new file**: `src/screens/games/components/GameFilterBar.tsx`

```typescript
/**
 * GameFilterBar - Filter tabs and game type chips
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GameFilters, GameFilterTab } from '../../../types/gameFilters';
import { GameType } from '../../../types/turnBased';
import { GAME_TYPE_CONFIG } from '../../../constants/gamesTheme';
import { colors, spacing, typography } from '../../../constants/theme';

interface GameFilterBarProps {
  filters: GameFilters;
  onFiltersChange: (filters: GameFilters) => void;
  availableGameTypes: GameType[];
}

const TABS: { key: GameFilterTab; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'your-turn', label: 'Your Turn', icon: 'arrow-forward-circle' },
  { key: 'their-turn', label: 'Waiting', icon: 'time' },
  { key: 'invites', label: 'Invites', icon: 'mail' },
];

export function GameFilterBar({ filters, onFiltersChange, availableGameTypes }: GameFilterBarProps) {
  const handleTabPress = (tab: GameFilterTab) => {
    onFiltersChange({ ...filters, tab });
  };

  const handleGameTypeToggle = (gameType: GameType) => {
    const current = filters.gameTypes;
    const updated = current.includes(gameType)
      ? current.filter(t => t !== gameType)
      : [...current, gameType];
    onFiltersChange({ ...filters, gameTypes: updated });
  };

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              filters.tab === tab.key && styles.activeTab,
            ]}
            onPress={() => handleTabPress(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={filters.tab === tab.key ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                filters.tab === tab.key && styles.activeTabText,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Game Type Chips */}
      {availableGameTypes.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipBar}
        >
          {availableGameTypes.map(gameType => {
            const config = GAME_TYPE_CONFIG[gameType];
            const isSelected = filters.gameTypes.includes(gameType);

            return (
              <TouchableOpacity
                key={gameType}
                style={[
                  styles.chip,
                  isSelected && { backgroundColor: config?.color || colors.primary },
                ]}
                onPress={() => handleGameTypeToggle(gameType)}
              >
                <Ionicons
                  name={config?.icon || 'game-controller'}
                  size={14}
                  color={isSelected ? 'white' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.chipText,
                    isSelected && styles.activeChipText,
                  ]}
                >
                  {config?.name || gameType}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  tabBar: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  activeTab: {
    backgroundColor: colors.primaryLight,
  },
  tabText: {
    ...typography.body,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: '600',
  },
  chipBar: {
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.xs,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  activeChipText: {
    color: 'white',
  },
});
```

### Step 2.5: Update GamesHubScreen

**File**: `src/screens/games/GamesHubScreen.tsx`

**Import the new components** at the top:

```typescript
import { ActiveGamesSection } from "./components/ActiveGamesSection";
import { GameFilterBar } from "./components/GameFilterBar";
import { GameFilters, DEFAULT_GAME_FILTERS } from "../../types/gameFilters";
```

**Add state for filters** (in the component body):

```typescript
const [filters, setFilters] = useState<GameFilters>(DEFAULT_GAME_FILTERS);
```

**Replace the current ActiveGamesList usage** with the new components:

```typescript
{/* Filter Bar */}
<GameFilterBar
  filters={filters}
  onFiltersChange={setFilters}
  availableGameTypes={getUniqueGameTypes(activeGames)}
/>

{/* Active Games (grouped by turn) */}
{filters.tab !== 'invites' && (
  <ActiveGamesSection
    games={activeGames}
    filters={filters}
    onRefresh={refreshGames}
  />
)}

{/* Invites Tab */}
{filters.tab === 'invites' && (
  <UniversalInvitesList invites={pendingInvites} />
)}
```

**Add helper function**:

```typescript
function getUniqueGameTypes(games: TurnBasedMatch[]): GameType[] {
  return [...new Set(games.map((g) => g.gameType))];
}
```

### Step 2.6: Add Archive/Unarchive Functions to Service

**File**: `src/services/turnBasedGames.ts`

**Add these functions** (near the end of the file, before exports):

```typescript
/**
 * Archive a game for a specific player
 * Archived games are hidden from the active games list but not deleted
 */
export async function archiveGame(
  matchId: string,
  playerId: string,
): Promise<void> {
  const matchRef = doc(db, "TurnBasedMatches", matchId);

  await updateDoc(matchRef, {
    [`playerArchivedAt.${playerId}`]: Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * Unarchive a game for a specific player
 */
export async function unarchiveGame(
  matchId: string,
  playerId: string,
): Promise<void> {
  const matchRef = doc(db, "TurnBasedMatches", matchId);

  await updateDoc(matchRef, {
    [`playerArchivedAt.${playerId}`]: deleteField(),
    updatedAt: Date.now(),
  });
}
```

**Import `deleteField`** at the top of the file if not already:

```typescript
import { deleteField } from "firebase/firestore";
```

---

## Phase 3: Game Management Actions

### Overview

Add resign, cancel, and draw offer functionality.

### Step 3.1: Add Cancel Game Function

**File**: `src/services/turnBasedGames.ts`

**Add this function**:

```typescript
/**
 * Cancel a game - only allowed if no moves have been made
 * This removes the game entirely rather than marking it as resigned
 */
export async function cancelGame(
  matchId: string,
  playerId: string,
): Promise<{ success: boolean; error?: string }> {
  const matchRef = doc(db, "TurnBasedMatches", matchId);
  const matchDoc = await getDoc(matchRef);

  if (!matchDoc.exists()) {
    return { success: false, error: "Game not found" };
  }

  const match = matchDoc.data() as TurnBasedMatch;

  // Check if player is in the game
  const isPlayer = match.players.some((p) => p.oderId === playerId);
  if (!isPlayer) {
    return { success: false, error: "Not a player in this game" };
  }

  // Only allow cancel if no moves made
  if (match.moves && match.moves.length > 0) {
    return {
      success: false,
      error: "Cannot cancel after moves have been made. Use resign instead.",
    };
  }

  // Delete the match
  await deleteDoc(matchRef);

  return { success: true };
}
```

**Import `deleteDoc`** if needed:

```typescript
import { deleteDoc } from "firebase/firestore";
```

### Step 3.2: Enhance Draw Offer System

The existing `offerDraw` and `acceptDraw` functions in `turnBasedGames.ts` already exist. Verify they work with these signatures:

**File**: `src/services/turnBasedGames.ts`

**Verify or add these functions** (around lines 800-900):

```typescript
/**
 * Offer a draw to the opponent
 */
export async function offerDraw(
  matchId: string,
  playerId: string,
): Promise<void> {
  const matchRef = doc(db, "TurnBasedMatches", matchId);

  await updateDoc(matchRef, {
    drawOfferedBy: playerId,
    drawOfferedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * Accept a draw offer
 */
export async function acceptDraw(
  matchId: string,
  playerId: string,
): Promise<void> {
  const matchRef = doc(db, "TurnBasedMatches", matchId);
  const matchDoc = await getDoc(matchRef);

  if (!matchDoc.exists()) {
    throw new Error("Match not found");
  }

  const match = matchDoc.data() as TurnBasedMatch;

  // Verify there's a pending draw offer from the other player
  if (!match.drawOfferedBy || match.drawOfferedBy === playerId) {
    throw new Error("No valid draw offer to accept");
  }

  await updateDoc(matchRef, {
    status: "draw",
    completedAt: Date.now(),
    drawOfferedBy: deleteField(),
    drawOfferedAt: deleteField(),
    updatedAt: Date.now(),
  });
}

/**
 * Decline a draw offer
 */
export async function declineDraw(
  matchId: string,
  playerId: string,
): Promise<void> {
  const matchRef = doc(db, "TurnBasedMatches", matchId);
  const matchDoc = await getDoc(matchRef);

  if (!matchDoc.exists()) {
    throw new Error("Match not found");
  }

  const match = matchDoc.data() as TurnBasedMatch;

  // Verify there's a pending draw offer
  if (!match.drawOfferedBy || match.drawOfferedBy === playerId) {
    throw new Error("No valid draw offer to decline");
  }

  await updateDoc(matchRef, {
    drawOfferedBy: deleteField(),
    drawOfferedAt: deleteField(),
    updatedAt: Date.now(),
  });
}
```

### Step 3.3: Update TurnBasedMatch Type for Draw Fields

**File**: `src/types/turnBased.ts`

**Add these fields to the interface** (if not already present):

```typescript
  // Draw offer tracking
  drawOfferedBy?: string;
  drawOfferedAt?: number;
```

---

## Phase 4: Chat Integration Improvements

### Overview

When both players accept an invite, automatically navigate both to the game.

### Step 4.1: Add Auto-Navigation Effect to UniversalInviteCard

**File**: `src/components/games/UniversalInviteCard.tsx`

**Find the imports section** and add:

```typescript
import { useEffect, useRef } from "react";
```

**Add this useEffect inside the component** (after the existing hooks, around line 100):

```typescript
// Track previous status to detect transitions
const prevStatusRef = useRef(invite.status);

// Auto-navigate when game becomes ready/active
useEffect(() => {
  const prevStatus = prevStatusRef.current;
  prevStatusRef.current = invite.status;

  // Only navigate if status just changed to 'active' and we have a matchId
  if (prevStatus !== "active" && invite.status === "active" && invite.matchId) {
    // Small delay to ensure game document is ready
    const timer = setTimeout(() => {
      const screenName = getGameScreenName(invite.gameType);
      navigation.navigate(screenName, { matchId: invite.matchId });
    }, 300);

    return () => clearTimeout(timer);
  }
}, [invite.status, invite.matchId, invite.gameType, navigation]);

// Helper function (add inside component or outside)
function getGameScreenName(gameType: string): string {
  const screenMap: Record<string, string> = {
    chess: "ChessGame",
    checkers: "CheckersGame",
    tic_tac_toe: "TicTacToeGame",
    crazy_eights: "CrazyEightsGame",
    pool: "PoolGame",
  };
  return screenMap[gameType] || "ChessGame";
}
```

### Step 4.2: Update Cloud Function to Include matchId in Invite

**File**: `firebase-backend/functions/src/games.ts`

**Find the `onUniversalInviteUpdate` function** and ensure it updates the invite with the `matchId` when the game is created:

```typescript
// In the section where the game is created (after startGameEarly or createMatch)
// Make sure to update the invite document with the matchId

await inviteRef.update({
  status: "active",
  matchId: match.id,
  updatedAt: Date.now(),
});
```

---

## Phase 5: Game History Screen

### Overview

Create a dedicated screen for viewing completed games with filtering.

### Step 5.1: Create GameHistoryScreen

**Create new file**: `src/screens/games/GameHistoryScreen.tsx`

```typescript
/**
 * GameHistoryScreen - View completed games with filtering
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GameHistoryRecord, GameHistoryStats } from '../../types/gameHistory';
import { GameType } from '../../types/turnBased';
import { getGameHistory, calculateUserStats } from '../../services/gameHistory';
import { useAuth } from '../../hooks/useAuth';
import { GAME_TYPE_CONFIG } from '../../constants/gamesTheme';
import { colors, spacing, typography } from '../../constants/theme';

type OutcomeFilter = 'all' | 'win' | 'loss' | 'draw';

export function GameHistoryScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [records, setRecords] = useState<GameHistoryRecord[]>([]);
  const [stats, setStats] = useState<GameHistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastId, setLastId] = useState<string | undefined>();

  // Filters
  const [gameTypeFilter, setGameTypeFilter] = useState<GameType | undefined>();
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');

  const loadHistory = useCallback(async (refresh = false) => {
    if (!user?.uid) return;

    if (refresh) {
      setRefreshing(true);
      setLastId(undefined);
    }

    try {
      const result = await getGameHistory({
        oderId: user.uid,
        gameType: gameTypeFilter,
        outcome: outcomeFilter === 'all' ? undefined : outcomeFilter,
        limit: 20,
        startAfter: refresh ? undefined : lastId,
      });

      if (refresh) {
        setRecords(result.records);
      } else {
        setRecords(prev => [...prev, ...result.records]);
      }

      setHasMore(result.hasMore);
      setLastId(result.lastId);

      // Load stats on refresh
      if (refresh) {
        const statsResult = await calculateUserStats(user.uid, gameTypeFilter);
        setStats(statsResult);
      }
    } catch (error) {
      console.error('Failed to load game history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [user?.uid, gameTypeFilter, outcomeFilter, lastId]);

  useEffect(() => {
    loadHistory(true);
  }, [gameTypeFilter, outcomeFilter]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      loadHistory(false);
    }
  };

  const renderStatsCard = () => {
    if (!stats) return null;

    return (
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Your Stats</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalGames}</Text>
            <Text style={styles.statLabel}>Played</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.success }]}>{stats.wins}</Text>
            <Text style={styles.statLabel}>Wins</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.error }]}>{stats.losses}</Text>
            <Text style={styles.statLabel}>Losses</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.winRate.toFixed(0)}%</Text>
            <Text style={styles.statLabel}>Win Rate</Text>
          </View>
        </View>
        {stats.currentStreak.count > 0 && (
          <View style={styles.streakBadge}>
            <Ionicons
              name={stats.currentStreak.type === 'win' ? 'flame' : 'trending-down'}
              size={16}
              color={stats.currentStreak.type === 'win' ? colors.warning : colors.error}
            />
            <Text style={styles.streakText}>
              {stats.currentStreak.count} {stats.currentStreak.type} streak
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderFilters = () => (
    <View style={styles.filters}>
      {/* Outcome Filter Tabs */}
      <View style={styles.filterTabs}>
        {(['all', 'win', 'loss', 'draw'] as OutcomeFilter[]).map(outcome => (
          <TouchableOpacity
            key={outcome}
            style={[
              styles.filterTab,
              outcomeFilter === outcome && styles.activeFilterTab,
            ]}
            onPress={() => setOutcomeFilter(outcome)}
          >
            <Text
              style={[
                styles.filterTabText,
                outcomeFilter === outcome && styles.activeFilterTabText,
              ]}
            >
              {outcome.charAt(0).toUpperCase() + outcome.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderHistoryItem = ({ item }: { item: GameHistoryRecord }) => {
    const userPlayer = item.players.find(p => p.oderId === user?.uid);
    const opponent = item.players.find(p => p.oderId !== user?.uid);
    const config = GAME_TYPE_CONFIG[item.gameType];

    let outcomeColor = colors.textSecondary;
    let outcomeText = 'Draw';
    if (item.winnerId) {
      if (userPlayer?.isWinner) {
        outcomeColor = colors.success;
        outcomeText = 'Victory';
      } else {
        outcomeColor = colors.error;
        outcomeText = 'Defeat';
      }
    }

    return (
      <TouchableOpacity style={styles.historyItem}>
        <View style={[styles.gameIcon, { backgroundColor: config?.color || colors.primary }]}>
          <Ionicons name={config?.icon || 'game-controller'} size={20} color="white" />
        </View>

        <View style={styles.historyInfo}>
          <Text style={styles.historyOpponent}>vs {opponent?.odername || 'Unknown'}</Text>
          <Text style={styles.historyDate}>
            {new Date(item.completedAt).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.historyOutcome}>
          <Text style={[styles.outcomeText, { color: outcomeColor }]}>{outcomeText}</Text>
          <Text style={styles.historyMoves}>{item.totalMoves} moves</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Game History</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={records}
        keyExtractor={item => item.id}
        renderItem={renderHistoryItem}
        ListHeaderComponent={
          <>
            {renderStatsCard()}
            {renderFilters()}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="game-controller-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No games yet</Text>
            <Text style={styles.emptySubtext}>Play some games to see your history!</Text>
          </View>
        }
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadHistory(true)}
            colors={[colors.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h2,
    flex: 1,
    textAlign: 'center',
    color: colors.text,
  },
  headerSpacer: {
    width: 32,
  },
  listContent: {
    padding: spacing.md,
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statsTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.h2,
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 12,
    alignSelf: 'center',
  },
  streakText: {
    ...typography.body,
    color: colors.text,
    marginLeft: spacing.xs,
  },
  filters: {
    marginBottom: spacing.md,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeFilterTab: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  activeFilterTabText: {
    color: 'white',
    fontWeight: '600',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  gameIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  historyOpponent: {
    ...typography.subtitle,
    color: colors.text,
  },
  historyDate: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  historyOutcome: {
    alignItems: 'flex-end',
  },
  outcomeText: {
    ...typography.subtitle,
    fontWeight: '600',
  },
  historyMoves: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.md,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  loadingMore: {
    padding: spacing.md,
    alignItems: 'center',
  },
});
```

### Step 5.2: Add Route to Navigator

**File**: `src/navigation/RootNavigator.tsx`

**Add import**:

```typescript
import { GameHistoryScreen } from "../screens/games/GameHistoryScreen";
```

**Add screen to the appropriate stack** (find the games-related screens section):

```typescript
<Stack.Screen
  name="GameHistory"
  component={GameHistoryScreen}
  options={{ headerShown: false }}
/>
```

### Step 5.3: Add Navigation Types

**File**: `src/navigation/types.ts` (or wherever navigation types are defined)

**Add to the navigation param list**:

```typescript
GameHistory: undefined;
```

---

## Phase 6: Navigation Overhaul

### Overview

Replace all `navigation.goBack()` calls with a smart `useGameNavigation` hook.

### Step 6.1: Create useGameNavigation Hook

**Create new file**: `src/hooks/useGameNavigation.ts`

```typescript
/**
 * useGameNavigation - Smart navigation hook for game screens
 *
 * Problem: Games can be entered from multiple places:
 * - Play screen
 * - Chat (via invite card)
 * - Push notification
 * - Deep link
 *
 * Using goBack() breaks when the entry point varies.
 *
 * Solution: This hook provides navigation functions that always go
 * to the right place based on context.
 */

import { useCallback } from "react";
import {
  useNavigation,
  CommonActions,
  StackActions,
} from "@react-navigation/native";
import { TurnBasedMatch } from "../types/turnBased";

interface UseGameNavigationOptions {
  match?: TurnBasedMatch | null;
  conversationId?: string;
  conversationType?: "dm" | "group";
}

interface UseGameNavigationReturn {
  /** Exit game and go to appropriate screen */
  exitGame: () => void;

  /** Go to the associated chat (if game was started from chat) */
  goToChat: () => void;

  /** Go directly to Play screen */
  goToPlayScreen: () => void;

  /** Whether this game has an associated chat */
  hasChat: boolean;
}

export function useGameNavigation(
  options: UseGameNavigationOptions = {},
): UseGameNavigationReturn {
  const navigation = useNavigation<any>();
  const { match, conversationId, conversationType } = options;

  // Determine conversation info from match or explicit options
  const chatConversationId = match?.conversationId || conversationId;
  const chatConversationType = match?.conversationType || conversationType;
  const hasChat = !!chatConversationId && !!chatConversationType;

  /**
   * Exit the game - smart navigation based on context
   *
   * Priority:
   * 1. If game has conversation context -> go to that chat
   * 2. Otherwise -> go to Play screen
   */
  const exitGame = useCallback(() => {
    if (hasChat) {
      // Navigate to the associated chat
      if (chatConversationType === "dm") {
        // For DMs, we need the other user's ID
        const otherPlayerId = match?.players?.find(
          (p) => p.oderId !== match?.currentTurn,
        )?.oderId;
        if (otherPlayerId) {
          navigation.dispatch(
            CommonActions.reset({
              index: 1,
              routes: [
                { name: "Main" },
                { name: "Chat", params: { oderId: otherPlayerId } },
              ],
            }),
          );
          return;
        }
      } else if (chatConversationType === "group") {
        navigation.dispatch(
          CommonActions.reset({
            index: 1,
            routes: [
              { name: "Main" },
              { name: "GroupChat", params: { groupId: chatConversationId } },
            ],
          }),
        );
        return;
      }
    }

    // Default: go to Play screen
    goToPlayScreen();
  }, [hasChat, chatConversationType, chatConversationId, match, navigation]);

  /**
   * Go directly to the associated chat
   */
  const goToChat = useCallback(() => {
    if (!hasChat) {
      console.warn("useGameNavigation: No chat associated with this game");
      return;
    }

    if (chatConversationType === "dm") {
      const otherPlayerId = match?.players?.find(
        (p) => p.oderId !== match?.currentTurn,
      )?.oderId;
      if (otherPlayerId) {
        navigation.navigate("Chat", { oderId: otherPlayerId });
      }
    } else if (chatConversationType === "group") {
      navigation.navigate("GroupChat", { groupId: chatConversationId });
    }
  }, [hasChat, chatConversationType, chatConversationId, match, navigation]);

  /**
   * Go directly to Play screen
   */
  const goToPlayScreen = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Main", state: { routes: [{ name: "Play" }] } }],
      }),
    );
  }, [navigation]);

  return {
    exitGame,
    goToChat,
    goToPlayScreen,
    hasChat,
  };
}
```

### Step 6.2: Export the Hook

**File**: `src/hooks/index.ts`

**Add export**:

```typescript
export { useGameNavigation } from "./useGameNavigation";
```

### Step 6.3: Update ChessGameScreen (Example)

**File**: `src/screens/games/ChessGameScreen.tsx`

**Add import**:

```typescript
import { useGameNavigation } from "../../hooks/useGameNavigation";
```

**Add hook call** (inside the component, after getting match data):

```typescript
const { exitGame, goToChat, hasChat } = useGameNavigation({ match });
```

**Replace all instances of**:

```typescript
navigation.goBack();
```

**With**:

```typescript
exitGame();
```

**For the "Go to Chat" button** (if it exists), use:

```typescript
{hasChat && (
  <TouchableOpacity onPress={goToChat}>
    <Ionicons name="chatbubble" size={24} />
  </TouchableOpacity>
)}
```

### Step 6.4: Update All Other Game Screens

Repeat the same pattern for these files:

- `src/screens/games/CheckersGameScreen.tsx`
- `src/screens/games/TicTacToeGameScreen.tsx`
- `src/screens/games/CrazyEightsGameScreen.tsx`
- `src/screens/games/PoolGameScreen.tsx`
- `src/screens/games/ConnectFourGameScreen.tsx`
- And any other game screens with `navigation.goBack()`

---

## Phase 7: Achievements & Statistics

### Overview

Add game-specific achievements that trigger on certain events.

### Step 7.1: Add Achievement Definitions

**File**: `src/data/gameAchievements.ts`

**Add new achievements** (append to existing arrays):

```typescript
// Multiplayer Game Achievements
export const MULTIPLAYER_ACHIEVEMENTS = [
  {
    id: "first_win",
    name: "First Victory",
    description: "Win your first multiplayer game",
    icon: "trophy",
    rarity: "common",
    trigger: { type: "game_win", count: 1 },
  },
  {
    id: "winning_streak_3",
    name: "Hot Streak",
    description: "Win 3 games in a row",
    icon: "flame",
    rarity: "rare",
    trigger: { type: "win_streak", count: 3 },
  },
  {
    id: "winning_streak_5",
    name: "Unstoppable",
    description: "Win 5 games in a row",
    icon: "flame",
    rarity: "epic",
    trigger: { type: "win_streak", count: 5 },
  },
  {
    id: "games_played_10",
    name: "Getting Started",
    description: "Play 10 multiplayer games",
    icon: "game-controller",
    rarity: "common",
    trigger: { type: "games_played", count: 10 },
  },
  {
    id: "games_played_50",
    name: "Regular Player",
    description: "Play 50 multiplayer games",
    icon: "game-controller",
    rarity: "rare",
    trigger: { type: "games_played", count: 50 },
  },
  {
    id: "games_played_100",
    name: "Dedicated Gamer",
    description: "Play 100 multiplayer games",
    icon: "game-controller",
    rarity: "epic",
    trigger: { type: "games_played", count: 100 },
  },
  {
    id: "quick_win",
    name: "Speed Demon",
    description: "Win a game in under 2 minutes",
    icon: "flash",
    rarity: "rare",
    trigger: { type: "game_duration", maxSeconds: 120 },
  },
  {
    id: "comeback_win",
    name: "Never Give Up",
    description: "Win a game after being down significantly",
    icon: "trending-up",
    rarity: "epic",
    trigger: { type: "comeback_win" },
  },
  // Chess-specific
  {
    id: "chess_checkmate",
    name: "Checkmate!",
    description: "Win a chess game by checkmate",
    icon: "chess",
    rarity: "common",
    gameType: "chess",
    trigger: { type: "checkmate" },
  },
  {
    id: "chess_scholar_mate",
    name: "Scholar's Mate",
    description: "Win a chess game in 4 moves or less",
    icon: "school",
    rarity: "rare",
    gameType: "chess",
    trigger: { type: "quick_checkmate", maxMoves: 4 },
  },
];
```

### Step 7.2: Create Achievement Trigger Service

**Create new file**: `src/services/achievementTriggers.ts`

```typescript
/**
 * Achievement Triggers - Check and award achievements after game events
 */

import { TurnBasedMatch } from "../types/turnBased";
import { GameHistoryStats } from "../types/gameHistory";
import { MULTIPLAYER_ACHIEVEMENTS } from "../data/gameAchievements";
import { grantAchievement, hasAchievement } from "./achievements";

export interface GameCompletionContext {
  match: TurnBasedMatch;
  oderId: string;
  isWinner: boolean;
  stats: GameHistoryStats;
}

/**
 * Check and grant achievements after a game completes
 */
export async function checkGameAchievements(
  context: GameCompletionContext,
): Promise<string[]> {
  const { match, oderId, isWinner, stats } = context;
  const awarded: string[] = [];

  for (const achievement of MULTIPLAYER_ACHIEVEMENTS) {
    // Skip if already has this achievement
    if (await hasAchievement(oderId, achievement.id)) {
      continue;
    }

    // Skip if achievement is for different game type
    if (achievement.gameType && achievement.gameType !== match.gameType) {
      continue;
    }

    // Check trigger conditions
    const shouldAward = checkTrigger(achievement.trigger, context);

    if (shouldAward) {
      await grantAchievement(oderId, achievement.id);
      awarded.push(achievement.id);
    }
  }

  return awarded;
}

function checkTrigger(trigger: any, context: GameCompletionContext): boolean {
  const { match, isWinner, stats } = context;

  switch (trigger.type) {
    case "game_win":
      return isWinner && stats.wins >= trigger.count;

    case "win_streak":
      return (
        isWinner &&
        stats.currentStreak.type === "win" &&
        stats.currentStreak.count >= trigger.count
      );

    case "games_played":
      return stats.totalGames >= trigger.count;

    case "game_duration":
      const duration = (match.completedAt || Date.now()) - match.createdAt;
      return isWinner && duration <= trigger.maxSeconds * 1000;

    case "checkmate":
      return isWinner && match.gameState?.isCheckmate === true;

    case "quick_checkmate":
      return (
        isWinner &&
        match.gameState?.isCheckmate === true &&
        (match.moves?.length || 0) <= trigger.maxMoves * 2
      ); // *2 for both players' moves

    default:
      return false;
  }
}
```

---

## Phase 8: Leaderboards

### Overview

Add global and friend leaderboards for competitive play.

### Step 8.1: Create Leaderboard Types

**Create new file**: `src/types/leaderboard.ts`

```typescript
import { GameType } from "./turnBased";

export interface LeaderboardEntry {
  oderId: string;
  odername: string;
  avatarUrl?: string;
  rank: number;
  score: number;
  wins: number;
  losses: number;
  winRate: number;
  gamesPlayed: number;
}

export interface LeaderboardData {
  gameType: GameType | "all";
  scope: "global" | "friends";
  entries: LeaderboardEntry[];
  userEntry?: LeaderboardEntry;
  updatedAt: number;
}

export type LeaderboardTimeframe = "all-time" | "monthly" | "weekly";
```

### Step 8.2: Create Leaderboard Service

**Create new file**: `src/services/leaderboard.ts`

```typescript
/**
 * Leaderboard Service
 *
 * Fetches leaderboard data from aggregated stats.
 * In production, this would query a LeaderboardStats collection
 * that's updated by Cloud Functions.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  LeaderboardData,
  LeaderboardEntry,
  LeaderboardTimeframe,
} from "../types/leaderboard";
import { GameType } from "../types/turnBased";
import { getFriendIds } from "./friends";

const LEADERBOARD_COLLECTION = "LeaderboardStats";

export async function getGlobalLeaderboard(
  gameType: GameType | "all",
  timeframe: LeaderboardTimeframe = "all-time",
  limitCount: number = 50,
): Promise<LeaderboardData> {
  const q = query(
    collection(db, LEADERBOARD_COLLECTION),
    where("gameType", "==", gameType),
    where("timeframe", "==", timeframe),
    orderBy("score", "desc"),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);
  const entries: LeaderboardEntry[] = [];
  let rank = 1;

  snapshot.forEach((doc) => {
    const data = doc.data();
    entries.push({
      oderId: data.oderId,
      odername: data.odername,
      avatarUrl: data.avatarUrl,
      rank: rank++,
      score: data.score,
      wins: data.wins,
      losses: data.losses,
      winRate: data.winRate,
      gamesPlayed: data.gamesPlayed,
    });
  });

  return {
    gameType,
    scope: "global",
    entries,
    updatedAt: Date.now(),
  };
}

export async function getFriendsLeaderboard(
  oderId: string,
  gameType: GameType | "all",
  timeframe: LeaderboardTimeframe = "all-time",
): Promise<LeaderboardData> {
  // Get friend IDs
  const friendIds = await getFriendIds(oderId);
  const allUserIds = [oderId, ...friendIds];

  // Query stats for friends
  const q = query(
    collection(db, LEADERBOARD_COLLECTION),
    where("oderId", "in", allUserIds.slice(0, 10)), // Firestore limit
    where("gameType", "==", gameType),
    where("timeframe", "==", timeframe),
    orderBy("score", "desc"),
  );

  const snapshot = await getDocs(q);
  const entries: LeaderboardEntry[] = [];
  let rank = 1;

  snapshot.forEach((doc) => {
    const data = doc.data();
    entries.push({
      oderId: data.oderId,
      odername: data.odername,
      avatarUrl: data.avatarUrl,
      rank: rank++,
      score: data.score,
      wins: data.wins,
      losses: data.losses,
      winRate: data.winRate,
      gamesPlayed: data.gamesPlayed,
    });
  });

  // Find user's entry
  const userEntry = entries.find((e) => e.oderId === oderId);

  return {
    gameType,
    scope: "friends",
    entries,
    userEntry,
    updatedAt: Date.now(),
  };
}
```

### Step 8.3: Create Cloud Function for Leaderboard Updates

**File**: `firebase-backend/functions/src/games.ts`

**Add this function**:

```typescript
/**
 * Update leaderboard stats when a game completes
 * Runs after onGameCompletedCreateHistory
 */
export const updateLeaderboardStats = onDocumentCreated(
  "GameHistory/{historyId}",
  async (event) => {
    const history = event.data?.data();
    if (!history) return;

    const batch = admin.firestore().batch();

    for (const player of history.players) {
      const statsRef = admin
        .firestore()
        .collection("LeaderboardStats")
        .doc(`${player.oderId}_${history.gameType}_all-time`);

      // Get current stats
      const currentStats = await statsRef.get();
      const current = currentStats.data() || {
        oderId: player.oderId,
        odername: player.odername,
        avatarUrl: player.avatarUrl,
        gameType: history.gameType,
        timeframe: "all-time",
        score: 1000, // Starting ELO
        wins: 0,
        losses: 0,
        draws: 0,
        gamesPlayed: 0,
        winRate: 0,
      };

      // Update stats
      const updated = {
        ...current,
        gamesPlayed: current.gamesPlayed + 1,
        wins: current.wins + (player.isWinner ? 1 : 0),
        losses: current.losses + (!player.isWinner && history.winnerId ? 1 : 0),
        draws: current.draws + (!history.winnerId ? 1 : 0),
        score: player.ratingAfter || current.score,
        updatedAt: Date.now(),
      };

      updated.winRate =
        updated.gamesPlayed > 0
          ? (updated.wins / updated.gamesPlayed) * 100
          : 0;

      batch.set(statsRef, updated);
    }

    await batch.commit();
  },
);
```

---

## Implementation Sequence

### Recommended Order

```
Phase 1 (Data Layer) ─────────────────────────────────────┐
    │                                                      │
    ▼                                                      │
Phase 2 (Play Screen) ──────► Phase 3 (Game Actions)      │
    │                              │                       │
    ▼                              │                       │
Phase 4 (Chat Integration) ◄───────┘                       │
    │                                                      │
    ▼                                                      │
Phase 5 (History Screen) ◄─────────────────────────────────┘
    │
    ▼
Phase 6 (Navigation) ─────► Can be done in parallel
    │
    ▼
Phase 7 (Achievements) ──► Phase 8 (Leaderboards)
```

### Dependencies

| Phase   | Depends On | Blocks           |
| ------- | ---------- | ---------------- |
| Phase 1 | None       | Phase 2, 3, 4, 5 |
| Phase 2 | Phase 1    | None             |
| Phase 3 | Phase 1    | None             |
| Phase 4 | Phase 1    | None             |
| Phase 5 | Phase 1    | None             |
| Phase 6 | None       | None (parallel)  |
| Phase 7 | Phase 1    | Phase 8          |
| Phase 8 | Phase 7    | None             |

---

## Testing Strategy

### Unit Tests

**Create**: `__tests__/services/gameHistory.test.ts`

```typescript
describe("gameHistory service", () => {
  test("getGameHistory returns records for user");
  test("getGameHistory filters by gameType");
  test("getGameHistory filters by outcome");
  test("getGameHistory paginates correctly");
  test("calculateUserStats computes correct winRate");
  test("calculateUserStats tracks current streak");
});
```

**Create**: `__tests__/services/turnBasedGames.test.ts`

```typescript
describe("turnBasedGames service", () => {
  test("createMatch includes conversation context");
  test("archiveGame sets playerArchivedAt");
  test("unarchiveGame removes playerArchivedAt");
  test("cancelGame fails if moves exist");
  test("cancelGame succeeds with no moves");
});
```

### Integration Tests

**Create**: `__tests__/integration/gameHistory.test.ts`

```typescript
describe("Game History Integration", () => {
  test("completing a game creates history record");
  test("history record includes correct player stats");
  test("history query respects security rules");
});
```

### E2E Tests

**Create**: `e2e/games/gameHistory.e2e.ts`

```typescript
describe("Game History E2E", () => {
  test("user can view game history screen");
  test("user can filter by win/loss");
  test("user can see stats card");
});
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual testing complete for each phase
- [ ] Code review approved
- [ ] No TypeScript errors

### Firestore

- [ ] Deploy updated security rules: `firebase deploy --only firestore:rules`
- [ ] Deploy indexes: `firebase deploy --only firestore:indexes`
- [ ] Verify indexes are built (check Firebase Console)

### Cloud Functions

- [ ] Deploy functions: `firebase deploy --only functions`
- [ ] Verify `onGameCompletedCreateHistory` is active
- [ ] Verify `updateLeaderboardStats` is active
- [ ] Check function logs for errors

### Client

- [ ] Build and test on iOS
- [ ] Build and test on Android
- [ ] Submit to app stores (if applicable)

### Post-Deployment

- [ ] Monitor error rates
- [ ] Check function execution times
- [ ] Verify history records are being created
- [ ] Test real user flow end-to-end

---

## Quick Reference

### File Changes Summary

| File                                                  | Action | Phase |
| ----------------------------------------------------- | ------ | ----- |
| `src/types/turnBased.ts`                              | Modify | 1     |
| `src/types/gameHistory.ts`                            | Create | 1     |
| `src/types/gameFilters.ts`                            | Create | 2     |
| `src/types/leaderboard.ts`                            | Create | 8     |
| `src/services/turnBasedGames.ts`                      | Modify | 1, 3  |
| `src/services/gameInvites.ts`                         | Modify | 1     |
| `src/services/gameHistory.ts`                         | Create | 1     |
| `src/services/achievementTriggers.ts`                 | Create | 7     |
| `src/services/leaderboard.ts`                         | Create | 8     |
| `src/hooks/useGameNavigation.ts`                      | Create | 6     |
| `src/screens/games/GamesHubScreen.tsx`                | Modify | 2     |
| `src/screens/games/GameHistoryScreen.tsx`             | Create | 5     |
| `src/screens/games/components/ActiveGameCard.tsx`     | Create | 2     |
| `src/screens/games/components/ActiveGamesSection.tsx` | Create | 2     |
| `src/screens/games/components/GameFilterBar.tsx`      | Create | 2     |
| `src/components/games/UniversalInviteCard.tsx`        | Modify | 4     |
| `src/navigation/RootNavigator.tsx`                    | Modify | 5     |
| `firebase-backend/functions/src/games.ts`             | Modify | 1, 8  |
| `firebase-backend/firestore.rules`                    | Modify | 1     |
| `firebase-backend/firestore.indexes.json`             | Modify | 1     |
| `src/data/gameAchievements.ts`                        | Modify | 7     |
| All game screens                                      | Modify | 6     |

### New Collections

| Collection         | Purpose                 | Phase |
| ------------------ | ----------------------- | ----- |
| `GameHistory`      | Completed game records  | 1     |
| `LeaderboardStats` | Aggregated player stats | 8     |

### Common Imports Template

```typescript
// Types
import { TurnBasedMatch, GameType, MatchStatus } from "../types/turnBased";
import { GameHistoryRecord, GameHistoryStats } from "../types/gameHistory";
import { GameFilters, GameFilterTab } from "../types/gameFilters";

// Services
import {
  createMatch,
  resignMatch,
  archiveGame,
} from "../services/turnBasedGames";
import { getGameHistory, calculateUserStats } from "../services/gameHistory";

// Hooks
import { useGameNavigation } from "../hooks/useGameNavigation";

// Constants
import { GAME_TYPE_CONFIG } from "../constants/gamesTheme";
import { colors, spacing, typography } from "../constants/theme";
```

---

_Last Updated: January 2025_
_Status: Ready for Implementation_

