# Phase 18 Complete: Wallet + Daily Tasks

## Summary

Phase 18 implements the token economy system with wallets and daily tasks that reward users with tokens for completing in-app activities.

## Definition of Done ✅

- **Tasks**: 7 daily task types implemented with progress tracking
- **Claims**: Idempotent reward claiming via Cloud Function
- **Tokens**: Wallet system with 100 starting tokens for all users

## Features Implemented

### 1. Token Wallet System

- **Wallet per user**: `Wallets/{uid}` with token balance tracking
- **Transaction history**: `Transactions/{txId}` for all credits/debits
- **Starting balance**: 100 tokens for new and existing users
- **Real-time updates**: Live subscription to wallet balance changes

### 2. Daily Tasks

- **7 Task Types**:
  - Send 5 Messages (10 tokens)
  - Send 3 Snaps (15 tokens)
  - View 5 Stories (8 tokens)
  - Post 1 Story (12 tokens)
  - Play 3 Games (15 tokens)
  - Add 1 Friend (20 tokens)
  - Login Daily (5 tokens)
- **Progress tracking**: Real-time progress updates via Cloud Functions
- **Daily reset**: Tasks reset at midnight in America/Indiana/Indianapolis timezone

### 3. Cloud Functions

- `onUserCreated`: Auto-creates wallet with 100 tokens for new users
- `claimTaskReward`: Atomic, idempotent reward claiming
- `recordDailyLogin`: Callable for login task progress
- Task progress triggers:
  - `onMessageSentTaskProgress` - Tracks message sending
  - `onStoryViewedTaskProgress` - Tracks story viewing
  - `onStoryPostedTaskProgress` - Tracks story posting
  - `onGamePlayedTaskProgress` - Tracks game playing
  - `onFriendAddedTaskProgress` - Tracks friend additions
- `seedDailyTasks`: HTTP endpoint to create task definitions
- `initializeExistingWallets`: HTTP endpoint to migrate existing users

### 4. UI Screens

- **WalletScreen**: Token balance display, transaction history, quick actions
- **TasksScreen**: Daily tasks with progress bars, claim buttons, reset timer

## Files Created

### Types

- `src/types/models.ts` - Added Wallet, Transaction, Task, TaskProgress types

### Services

- `src/services/economy.ts` - Wallet operations, transaction queries
- `src/services/tasks.ts` - Task queries, progress tracking, reward claims

### Screens

- `src/screens/wallet/WalletScreen.tsx` - Wallet UI
- `src/screens/tasks/TasksScreen.tsx` - Tasks UI

### Backend

- `firebase-backend/functions/src/index.ts` - Added economy/task functions
- `firebase-backend/firestore.rules` - Added Wallets, Transactions, Tasks rules
- `firebase-backend/firestore.indexes.json` - Added required indexes

### Configuration

- `metro.config.js` - Created to exclude firebase-backend from bundling
- `firebase.json` - Updated paths to firebase-backend folder
- `tsconfig.json` - Updated to exclude firebase-backend from TypeScript

## Navigation Updates

- Added Wallet and Tasks buttons to ProfileScreen
- Added Stack.Screen entries in RootNavigator

## Important Note

The `firebase` folder was renamed to `firebase-backend` to avoid module resolution conflicts with the `firebase` npm package. All deployment paths have been updated accordingly.

## Deployment Status

- ✅ Firestore rules deployed
- ✅ Firestore indexes deployed
- ✅ Cloud Functions deployed (10 new functions)
- ✅ Daily tasks seeded (7 tasks)
- ✅ Existing user wallets initialized (11 users, 100 tokens each)

## Testing

1. Log in to the app
2. Navigate to Profile → "My Wallet" to see token balance
3. Navigate to Profile → "Daily Tasks" to see available tasks
4. Complete tasks (send messages, view stories, etc.) and watch progress update
5. Claim rewards when tasks are complete
6. Verify tokens added to wallet and transaction appears in history

## API Endpoints

- Seed tasks: `GET https://us-central1-gamerapp-37e70.cloudfunctions.net/seedDailyTasks`
- Init wallets: `GET https://us-central1-gamerapp-37e70.cloudfunctions.net/initializeExistingWallets`

## Next Phase

Phase 19: Token Shop (Cosmetics purchasing with tokens)
