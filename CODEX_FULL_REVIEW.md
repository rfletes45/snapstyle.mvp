# Codex Full Codebase Review & Refactor

> **For**: OpenAI Codex (codex-5.3)
> **Repository**: `snapstyle-mvp` — React Native + Expo social app called "Vibe"
> **Date**: February 2026
> **Objective**: Exhaustive review, refactor, and consistency enforcement across the entire codebase

---

## Mission

You are performing a **complete, exhaustive codebase audit and refactor** of a production React Native + Expo application. Your job is to find and fix every inconsistency, inefficiency, dead code path, type safety hole, and architectural smell across the entire project. Do not stop until every system is consistent, clean, and properly typed.

**You must**:

1. Read and understand every file before modifying it
2. Run `npx tsc --noEmit` after each batch of changes to verify zero TypeScript errors
3. Never break existing functionality — all refactors must be behavior-preserving
4. Work systematically through each section below; do not skip any

---

## Tech Stack (Ground Truth)

| Technology       | Version                             | Purpose                                   |
| ---------------- | ----------------------------------- | ----------------------------------------- |
| React Native     | 0.81.5                              | Mobile framework                          |
| Expo SDK         | 54                                  | Build/dev toolchain                       |
| React            | 19.1.0                              | UI library                                |
| TypeScript       | ~5.9.2                              | Type safety (`strict: true`)              |
| Firebase         | 12.8.0                              | Auth, Firestore, Storage, Cloud Functions |
| Colyseus SDK     | 0.17.31 (client) / 0.17.35 (server) | Real-time multiplayer                     |
| React Navigation | 7.x                                 | Screen navigation                         |
| expo-sqlite      | 16.0.10                             | Local-first message storage               |
| Path alias       | `@/*` → `src/*`                     | Import paths                              |

**tsconfig.json** excludes `firebase-backend/`, `colyseus-server/`, and `node_modules` from compilation. The client app is in `src/`. Cloud Functions are in `firebase-backend/functions/src/`. Colyseus server is in `colyseus-server/src/`.

---

## Current Codebase Stats (Pre-Audit Baseline)

- **557 TypeScript/TSX files** in `src/`
- **133 `as any` casts** remaining in `src/` (grep: ` as any[^A-Za-z]| as any$`)
- **~1,445 raw `console.log/warn/error` calls** in `src/` — only 72 files use `createLogger()`
- **9 untyped `<any>` navigation params** in `src/navigation/`
- **3,148 lines** in `firebase-backend/functions/src/index.ts` (should be <200; most logic is still inline)
- **858 lines** in `constants/featureFlags.ts` across 8 flag groups
- **Barrel exports** have documented naming conflicts in `src/services/index.ts`, `src/types/index.ts`, `src/data/index.ts`, `src/utils/index.ts`

---

## Section 1: Import Path Consistency

### Problem

The codebase mixes relative imports (`../../../services/auth`) with path-alias imports (`@/services/auth`). The `tsconfig.json` defines `@/*` → `src/*`.

### Task

1. Scan every `.ts` and `.tsx` file under `src/`
2. Convert all cross-directory relative imports to use the `@/` alias
3. Keep same-directory relative imports (e.g., `./MyComponent`) as-is
4. Keep imports from `constants/` using `@/constants/` (there's a `@/constants/*` alias too)
5. Verify: `npx tsc --noEmit` passes with zero errors

---

## Section 2: Console.log Cleanup → createLogger Migration

### Problem

There are ~1,445 raw `console.log/warn/error/info/debug` calls. The codebase has a centralized `createLogger()` utility at `src/utils/log.ts` (349 lines) that provides structured, environment-aware logging. Only 72 files currently use it.

### Task

1. Read `src/utils/log.ts` to understand the `createLogger()` API
2. For every file in `src/` that uses raw `console.log/warn/error`:
   - Add `import { createLogger } from "@/utils/log";` (or equivalent)
   - Create a module-level logger: `const logger = createLogger("ModuleName");`
   - Replace `console.log(...)` → `logger.info(...)` or `logger.debug(...)`
   - Replace `console.warn(...)` → `logger.warn(...)`
   - Replace `console.error(...)` → `logger.error(...)`
   - Preserve the original log message content and any interpolated values
3. For files that already use `createLogger`, verify they don't ALSO have raw `console.*` calls
4. Exception: Leave `console.*` calls inside `__DEV__` guards as-is if they're debug-only
5. Do NOT modify files in `firebase-backend/` or `colyseus-server/` — only `src/`

---

## Section 3: `as any` Type Safety Audit

### Problem

133 `as any` casts remain across `src/`. Each one is a type safety hole.

### Task

1. For every `as any` in `src/`:
   - Determine the actual type the expression produces
   - Determine the type the surrounding context expects
   - Replace `as any` with the correct type assertion, or better yet, fix the underlying type mismatch
2. Common patterns to fix:
   - **Firestore `doc.data()` returns `DocumentData`** → cast to the proper interface (e.g., `as UserProfile`)
   - **Firestore Timestamp duck-typing** → use a `FirestoreTimestamp` interface with `toDate()`, `toMillis()`, `seconds`, `nanoseconds`
   - **React Navigation params** → define proper `ParamList` types (see Section 4)
   - **Event handler types** → use the correct React Native event type
   - **Timer IDs** → use `ReturnType<typeof setTimeout>`
   - **JSON.parse results** → add a type annotation or use a type guard
3. If a cast is genuinely unavoidable (e.g., third-party library boundary), change it to a more specific type than `any`, or add a `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with an explanatory comment
4. Verify: zero TypeScript errors after each batch

---

## Section 4: Navigation Type Safety

### Problem

`src/navigation/RootNavigator.tsx` uses `<any>` for all stack/tab navigator generic params. There are 9 such occurrences. This means `navigation.navigate("ScreenName", { ... })` has zero type checking on route params.

### Task

1. Read `src/navigation/RootNavigator.tsx` and `src/navigation/ShopNavigator.tsx` to understand all navigator stacks
2. Read `src/types/navigation/` to see if any `ParamList` types already exist
3. For each navigator stack, define a proper `ParamList` type:
   - `AuthStackParamList`
   - `InboxStackParamList`
   - `PlayStackParamList`
   - `MomentsStackParamList`
   - `ProfileStackParamList`
   - `ShopStackParamList`
   - `AppTabsParamList`
   - `RootStackParamList`
4. For each screen in each stack, define its params (or `undefined` if it takes no params)
5. Replace all `<any>` with the proper `ParamList` type
6. Update screen components to use `NativeStackScreenProps<XxxParamList, "ScreenName">` for their props
7. Verify: zero TypeScript errors

---

## Section 5: Chat System Consistency

### Problem

The messaging system has multiple layers from a migration that left inconsistencies:

- `src/services/chatV2.ts` (legacy DM operations)
- `src/services/messaging/` (unified messaging: send.ts, subscribe.ts, memberState.ts, adapters/)
- `src/services/messageList.ts` (legacy subscriptions)
- `src/services/outbox.ts` (legacy offline queue)
- `src/services/chat.ts` (legacy chat CRUD)
- `src/services/chatMembers.ts` (legacy member state)
- `src/services/messageActions.ts` (edit/delete)
- `src/services/reactions.ts` (reactions)

### Task

1. **Map the dependency graph**: For each file above, identify every importer (use grep or find-references)
2. **Identify dead exports**: Functions that are exported but never imported anywhere
3. **Identify inconsistent patterns**:
   - Are DM and Group chat screens using the same hook chain? (`useChat` → `useUnifiedChatScreen` → etc.)
   - Do both DM and Group paths go through `src/services/messaging/send.ts` for sending?
   - Is the adapter (`src/services/messaging/adapters/groupAdapter.ts`) consistently used for Group ↔ MessageV2 conversion?
4. **Ensure consistency**:
   - Both DM and Group chat screens should use identical hook hierarchies
   - Error handling patterns should be the same in both paths
   - `getPreviewText()` exists in 3 files — all 3 must handle the same set of `MessageKind` values (check `src/types/messaging.ts` for the union). If any `getPreviewText` is missing a case, add it.
   - The `ReplyPreviewBar`, `ReplyBubbleNew`, and Cloud Functions `messaging.ts` must all handle the same message kinds
5. **Remove truly dead code**: If a function in the legacy services has zero importers, delete it
6. **Standardize error handling**: Every `try/catch` in messaging services should log via `createLogger`, not raw `console.error`

---

## Section 6: Game System Consistency

### Problem

There are 37 game screen files, 6 game logic files, 13+ game hooks, and multiple component layers. Patterns vary wildly between games.

### Task

1. **Audit every game screen** in `src/screens/games/`:
   - Does it clean up all `useEffect` subscriptions on unmount? (return cleanup functions)
   - Does it stop all animations (`Animated.Value.stopAnimation()`, `cancelAnimationFrame()`) on unmount?
   - Does it use `useGameBackHandler` for Android back button?
   - Does it use `useGameHaptics` for feedback (or explicitly opt out)?
   - Does it handle the `AppState` change (background/foreground) if it has active game loops?
2. **Standardize the game screen pattern**:
   - All game screens should follow the same structural pattern:
     ```
     1. Feature flag check (if applicable)
     2. Navigation params extraction
     3. Game hook(s) initialization
     4. useEffect cleanup
     5. Render: loading → error → game UI
     ```
   - Ensure every game screen has an `ErrorBoundary` wrapper (check `withErrorBoundary` usage)
3. **Audit Colyseus multiplayer hooks** (`useGameConnection`, `useMultiplayerGame`, `useTurnBasedGame`, `usePhysicsGame`, `useCardGame`, `useScoreRace`):
   - Do they all handle reconnection consistently?
   - Do they all handle room disposal on unmount?
   - Do they all use the same error reporting pattern?
4. **Game-specific multiplayer hooks** (`useCrosswordMultiplayer`, `useWordMasterMultiplayer`):
   - Do they follow the same pattern as the generic hooks?
   - Are there duplicated patterns that could be extracted to the generic hooks?
5. **Game logic files** (`src/services/games/*.ts`):
   - Are they pure functions (no side effects)?
   - Do they have consistent interfaces?
6. **Game validation** (`src/services/gameValidation/`):
   - Is every game that accepts moves validated server-side?
   - Are the validation functions consistent in their signatures?

---

## Section 7: Feature Flag Cleanup

### Problem

`constants/featureFlags.ts` is 858 lines with 8 flag groups. Two groups (`PROFILE_FEATURES` and `SHOP_FEATURES`) are marked as "GRADUATED" — all flags are permanently `true`. These add dead conditional paths.

### Task

1. **PROFILE_FEATURES** and **SHOP_FEATURES**: Both are graduated. Previous audit inlined usages but the flag objects still exist (858 lines).
   - Search the entire `src/` tree for any remaining references to `PROFILE_FEATURES.*` or `SHOP_FEATURES.*`
   - If zero references remain, delete the flag object declarations entirely
   - If references remain, inline them (replace `PROFILE_FEATURES.X` → `true`, then simplify the conditional)
2. **PROFILE_V2_FEATURES**: Check which flags are `true` and universally used vs `false` and never checked
   - Flags set to `false` that are never checked in code → delete them
   - Flags set to `true` that could be graduated → note them but don't graduate yet
3. **PLAY_SCREEN_FEATURES**: Same audit — which are dead?
4. **CALL_FEATURES**: Master switch `CALLS_ENABLED: false` — verify that all call-related code is properly gated behind this flag
5. **COLYSEUS_FEATURES**: `MATCHMAKING_ENABLED: false` and `RANKED_ENABLED: false` — verify these are properly gated
6. **THREE_JS_FEATURES**: Verify web platform guard (`!IS_WEB`) works correctly
7. **Remove any `__DEV__` debug flags that are duplicated** — if a debug flag just equals `__DEV__`, the code could use `__DEV__` directly

---

## Section 8: Cloud Functions `index.ts` Split

### Problem

`firebase-backend/functions/src/index.ts` is still 3,148 lines. The link preview section was already extracted to `linkPreview.ts`. The file has these inline sections that should be separate modules:

- **Lines ~145-275**: Input validation helpers + Expo push notification utilities
- **Lines ~277-440**: `onNewMessage` (DM push notifications)
- **Lines ~442-892**: `onNewGroupMessageV2` (Group push notifications with mention support)
- **Lines ~892-980**: Social triggers (onNewFriendRequest, onStoryViewed)
- **Lines ~982-1200**: Scheduled functions (streakReminder, cleanupExpiredSnaps, cleanupExpiredStories)
- **Lines ~1208-1450**: Scheduled messages
- **Lines ~1454-1738**: Leaderboards + achievements
- **Lines ~1740-2380**: Economy + wallet + tasks
- **Lines ~2384-2790**: Shop + limited-time drops (but `purchaseWithTokens` is already re-exported from `shop.ts`)
- **Lines ~2797-2990**: Rate limiting + moderation
- **Lines ~2992-3088**: Push token cleanup
- **Lines ~3089-3148**: Admin moderation functions + domain events + ban expiration

### Task

1. **Create a shared utilities module** (`firebase-backend/functions/src/utils.ts`):
   - Move `isValidString()`, `isValidUid()`, `sanitizeForLog()`
   - Move `sendExpoPushNotification()`, `getUserPushToken()`
   - Move `isDmChatMuted()`, `isGroupChatMuted()`
   - Move the `ExpoPushMessage` interface
   - Export everything; update `index.ts` to import from `./utils`
2. **Create `notifications.ts`**: Move `onNewMessage`, `onNewGroupMessageV2`
3. **Create `social.ts`**: Move `onNewFriendRequest`, `onStoryViewed`
4. **Create `scheduled.ts`**: Move `streakReminder`, `cleanupExpiredSnaps`, `cleanupExpiredStories`, `cleanupOldScheduledMessages`, `cleanupExpiredPushTokens`
5. **Create `scheduledMessages.ts`**: Move `processScheduledMessages`, `onScheduledMessageCreated`
6. **Create `leaderboards.ts`**: Move `onGameSessionCreated`, `onStreakAchievementCheck`, `weeklyLeaderboardReset`
7. **Create `economy.ts`**: Move `onUserCreated`, `claimTaskReward`, `recordDailyLogin`, `seedDailyTasks`, `initializeExistingWallets`, task progress triggers
8. **Create `admin.ts`**: Move `adminSetBan`, `adminLiftBan`, `adminApplyStrike`, `adminApplyWarning`, `adminResolveReport`, `adminSetAdminClaim`, `initializeFirstAdmin`
9. **Create `moderation.ts`**: Move `sendFriendRequestWithRateLimit`, `checkMessageRateLimit`, `onNewMessageEvent`, `onNewReport`, `updateExpiredBans`
10. **After all extractions, `index.ts` should be ONLY imports and re-exports** — target <200 lines
11. **Critical**: Every exported function name must remain exactly the same — these are deployed Cloud Function names
12. Verify the Cloud Functions TypeScript compiles: `cd firebase-backend/functions && npx tsc --noEmit`

---

## Section 9: Barrel Export Consistency

### Problem

Multiple barrel files (`src/services/index.ts`, `src/types/index.ts`, `src/data/index.ts`, `src/utils/index.ts`) have commented-out exports due to naming conflicts. This is messy.

### Task

1. **Identify all naming conflicts** by attempting to uncomment each disabled export and checking the error
2. **Resolve conflicts** using one of these strategies:
   - Rename the conflicting export at its source (preferred if it's an internal function)
   - Use `export { x as specificX } from "./module"` to rename at the barrel level
   - If a module is only used in 1-2 places, skip barrel export and document why
3. **Goal**: Every module under each directory should either be exported from the barrel or have a clear documented reason why not
4. **Verify**: No duplicate export names across any barrel file

---

## Section 10: Component & Hook Consistency Patterns

### Task

1. **Error boundaries**: Verify every screen component is wrapped with `withErrorBoundary` or has an `<ErrorBoundary>` in its render tree
2. **Loading states**: Verify every screen that fetches data shows a loading skeleton or `<LoadingScreen />`
3. **Empty states**: Verify every list screen handles the empty case with `<EmptyState />`
4. **Hook cleanup**: Verify every `useEffect` that creates a subscription, timer, or listener returns a cleanup function
5. **Memoization**: Check for expensive computations in render that should use `useMemo` or `useCallback`
6. **Consistent prop patterns**: Screens that accept `userId`, `chatId`, `gameId` etc. should get them from navigation params, not from multiple inconsistent sources

---

## Section 11: Colyseus Server Consistency

### Task

1. Audit `colyseus-server/src/rooms/` — there are 22 rooms across 6 subdirectories:
   - `base/`: CardGameRoom, PhysicsRoom, ScoreRaceRoom, TurnBasedRoom
   - `quickplay/`: DotMatchRoom, ReactionRoom, TimedTapRoom
   - `physics/`: AirHockeyRoom, BounceBlitzRoom, BrickBreakerRoom, PongRoom, PoolRoom
   - `turnbased/`: CheckersRoom, ChessRoom, ConnectFourRoom, CrazyEightsRoom, GomokuRoom, ReversiRoom, TicTacToeRoom
   - `coop/`: CrosswordRoom, WordMasterRoom
   - `spectator/`: SpectatorRoom
2. **Verify every room** extends the correct base room (`ScoreRaceRoom`, `TurnBasedRoom`, `PhysicsRoom`, or `CardGameRoom`)
3. **Check `as any` casts** in colyseus-server — fix them the same way as Section 3
4. **Verify consistent lifecycle** (`onCreate`, `onJoin`, `onLeave`, `onDispose`) across all rooms
5. **Verify reconnection handling** is consistent across all rooms
6. **Verify score submission** to Firebase is consistent (same function, same error handling)

---

## Section 12: Dead Code Sweep

### Task

1. **Unused exports**: For every exported function/type/constant in `src/services/`, `src/utils/`, `src/types/`, `src/data/`, `src/hooks/`:
   - grep for its usage across the entire `src/` tree
   - If zero imports exist (besides the barrel re-export), flag it
   - Delete truly dead exports (functions that are exported, re-exported from barrel, but never actually used)
2. **Unused dependencies**: Check `package.json` dependencies — are all of them actually imported somewhere in the codebase?
3. **Empty files**: Search for any `.ts`/`.tsx` files that are empty or contain only comments
4. **Duplicate utilities**: Search for functions that do the same thing in different files (e.g., date formatting, ID generation, haptic patterns)

---

## Section 13: Firestore Security Rules Consistency

### Task

1. Read `firebase-backend/firestore.rules` entirely
2. **Verify every Firestore collection** accessed in `src/services/` has corresponding security rules
3. **Verify rule patterns are consistent**:
   - All user-write rules check `request.auth != null`
   - All user-write rules check the user is writing to their own document (where applicable)
   - Edit windows are consistent (15-minute window for message edits)
   - The scorecard exception (bypasses edit window) is properly scoped
4. **Check for overly permissive rules** — any `allow read, write: if true` or `if request.auth != null` without additional constraints on sensitive collections

---

## Execution Rules

1. **Work in order** — Section 1 through 13
2. **Batch changes** — make all changes for one section, then verify TypeScript compiles
3. **Never break types** — `npx tsc --noEmit` must pass after every section
4. **Never change behavior** — all refactors must be behavior-preserving
5. **Be thorough** — do not skip files. If a section says "every file", check every file
6. **Document decisions** — if you choose NOT to fix something, leave a `// TODO:` comment explaining why
7. **Run until done** — do not stop partway through a section. Complete all 13 sections.

---

## Verification Checklist (Run After All Sections)

After completing all 13 sections, verify:

- [ ] `npx tsc --noEmit` — zero errors (client app)
- [ ] `cd firebase-backend/functions && npx tsc --noEmit` — zero errors (Cloud Functions)
- [ ] `cd colyseus-server && npx tsc --noEmit` — zero errors (Colyseus server)
- [ ] `grep -r "as any" src/ --include="*.ts" --include="*.tsx" | wc -l` — should be <10 (ideally 0)
- [ ] `grep -r "console\.\(log\|warn\|error\)" src/ --include="*.ts" --include="*.tsx" | wc -l` — should be <20 (only `__DEV__` guarded)
- [ ] `firebase-backend/functions/src/index.ts` line count — should be <200
- [ ] No `<any>` in navigation — all navigators use proper ParamList types
- [ ] All barrel exports are clean — no commented-out exports without resolution
- [ ] Every game screen has cleanup in useEffect
- [ ] Every screen has error boundary coverage
- [ ] DM and Group chat use identical hook chains
- [ ] All 3 `getPreviewText` implementations handle the same MessageKind set
