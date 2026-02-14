# Vibe App Architecture

> App structure, navigation, state management, and service layer

---

## Overview

Vibe is a React Native + Expo social app with Firebase backend, Colyseus multiplayer server, and **local-first storage**. Features include real-time messaging (1:1 and groups), disappearing photos (Shots), 24-hour stories (Moments), friend streaks (Rituals), 26+ mini-games with real-time Colyseus multiplayer, Three.js 3D visual effects, avatar customization with decorations, dual profile system, shop with IAP, and virtual economy.

### Architecture Pattern

```
User Action → SQLite (instant) → UI Update
                    ↓
         Background Sync → Firestore (eventual)
```

The app uses a **local-first architecture** where messages are stored in SQLite immediately, providing instant UI updates. Background sync ensures eventual consistency with Firebase.

---

## Folder Structure

```
snapstyle-mvp/
├── App.tsx                    # Root component with providers
├── app.config.ts              # Expo configuration
├── constants/
│   ├── theme.ts               # Catppuccin colors (30 themes), spacing, typography
│   ├── gamesTheme.ts          # Game-specific visual tokens
│   └── featureFlags.ts        # Feature toggles (~130 flags across 7 groups)
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── chat/              # Chat-specific components (V2)
│   │   │   ├── inbox/         # Inbox screen components (14 files)
│   │   │   └── ...            # Composer, reactions, attachments, etc.
│   │   ├── games/             # Game-specific components
│   │   │   ├── graphics/      # Skia graphics (chess, checkers, 2048, etc.)
│   │   │   └── ...            # Overlays, modals, invites, spectator
│   │   ├── profile/           # Profile system (20+ sub-modules)
│   │   ├── shop/              # Shop components (10 files)
│   │   ├── three/             # Three.js 3D visual effects
│   │   │   ├── ThreeCanvas.tsx         # Foundation GLView wrapper
│   │   │   ├── geometries.ts           # Reusable 3D geometry helpers
│   │   │   ├── ThreeGameBackground.tsx # Full-screen 3D backgrounds
│   │   │   ├── ThreeHeroBanner.tsx     # 3D hero banner (floating pieces)
│   │   │   ├── ThreeInviteCard.tsx     # 3D invite card overlay
│   │   │   ├── ThreeGameTrophy.tsx     # 3D victory trophy
│   │   │   ├── ThreeFloatingIcons.tsx  # Floating 3D game icons
│   │   │   └── index.ts               # Barrel export
│   │   ├── calls/             # Video/audio call components
│   │   ├── camera/            # Camera overlay components
│   │   ├── customization/     # Theme & chat bubble customization
│   │   ├── animations/        # Badge/level-up animations
│   │   ├── badges/            # Badge display components
│   │   ├── ui/                # Primitives (EmptyState, LoadingState, etc.)
│   │   └── ...                # Avatar, ErrorBoundary, Modals
│   ├── data/
│   │   ├── cosmetics.ts       # Static cosmetic item definitions
│   │   ├── gameAchievements.ts # Achievement definitions
│   │   └── index.ts           # Barrel export
│   ├── hooks/                 # Custom React hooks
│   │   ├── useChat.ts         # **Master chat hook** (unified DM & Group)
│   │   ├── useUnifiedMessages.ts # Message subscription + outbox integration
│   │   ├── useChatComposer.ts # Composer state management
│   │   ├── useUnifiedChatScreen.ts # Combined hook for chat screens
│   │   ├── useOutboxProcessor.ts # Offline message queue
│   │   ├── useAttachmentPicker.ts # Multi-attachment selection
│   │   ├── useVoiceRecorder.ts # Voice message recording
│   │   ├── useMentionAutocomplete.ts # @mention autocomplete
│   │   ├── useInboxData.ts    # Unified inbox data with filters
│   │   ├── useConversationActions.ts # Pin/mute/delete actions
│   │   ├── useFriendRequests.ts # Friend request subscription
│   │   ├── chat/              # Keyboard & scroll hooks
│   │   │   ├── useChatKeyboard.ts # Keyboard tracking (react-native-keyboard-controller)
│   │   │   ├── useAtBottom.ts     # Scroll position detection
│   │   │   ├── useNewMessageAutoscroll.ts # Smart autoscroll rules
│   │   │   └── index.ts       # Barrel export
│   │   └── index.ts           # Barrel export
│   ├── navigation/
│   │   └── RootNavigator.tsx  # All navigation stacks
│   ├── screens/               # Screen components by feature (~70 screens)
│   │   ├── admin/             # Admin moderation, banned user screen
│   │   ├── auth/              # Login, signup, forgot password, profile setup
│   │   ├── chat/              # DM/Inbox: ChatList, Chat, Settings, Search, Snaps
│   │   ├── camera/            # Camera, Editor, Share screens
│   │   ├── calls/             # Audio, Video, Group call screens + history
│   │   ├── friends/           # Connections management
│   │   ├── games/             # 26+ game screens + 20 Play screen components
│   │   │   ├── GamesHubScreen.tsx       # Main games hub (Play tab)
│   │   │   ├── components/              # Play screen components
│   │   │   └── [40 game screens]        # Individual game screens
│   │   ├── groups/            # Group chat screens (create, info, chat, invites)
│   │   ├── profile/           # OwnProfile, UserProfile, Badges, Status, Mutual
│   │   ├── settings/          # Settings, Privacy, Blocked, Theme
│   │   ├── shop/              # ShopHub, PointsShop, PremiumShop, History
│   │   ├── social/            # Activity feed
│   │   ├── stories/           # Moments (stories) + viewer
│   │   ├── tasks/             # Daily/monthly tasks
│   │   ├── wallet/            # Token wallet
│   │   └── debug/             # Debug + local storage debug
│   ├── services/              # Firebase/backend operations
│   │   ├── messaging/         # **Unified messaging module**
│   │   │   ├── adapters/      # Message type adapters
│   │   │   │   ├── groupAdapter.ts # GroupMessage ↔ MessageV2
│   │   │   │   └── index.ts   # Barrel export
│   │   │   ├── index.ts       # Public API barrel
│   │   │   ├── memberState.ts # Unified member state
│   │   │   ├── send.ts        # Unified message sending
│   │   │   └── subscribe.ts   # Unified subscriptions
│   │   ├── database/          # **SQLite local storage (NEW)**
│   │   │   ├── index.ts       # Database singleton, schema init
│   │   │   ├── messageRepository.ts  # Message CRUD
│   │   │   ├── conversationRepository.ts # Conversation CRUD
│   │   │   ├── maintenance.ts # Vacuum, prune, reset utilities
│   │   │   └── repositories.ts # Barrel export
│   │   ├── sync/              # **Background sync engine (NEW)**
│   │   │   ├── index.ts       # Public API
│   │   │   └── syncEngine.ts  # Firestore sync state machine
│   │   ├── mediaCache.ts      # **Local media caching (NEW)**
│   │   ├── games/             # Game logic (chess, 2048, etc.)
│   │   ├── gameValidation/    # Move validators
│   │   ├── inboxSettings.ts   # Inbox settings service
│   │   ├── chatV2.ts          # DM operations (uses unified)
│   │   ├── groups.ts          # Group operations (uses unified)
│   │   ├── index.ts           # Barrel export (non-conflicting)
│   │   └── ...
│   ├── store/                 # Context providers
│   │   └── index.ts           # Barrel export
│   ├── types/
│   │   ├── models.ts          # Core TypeScript interfaces
│   │   ├── messaging.ts       # V2 messaging types
│   │   ├── database.ts        # SQLite row types (NEW)
│   │   └── index.ts           # Barrel export (non-conflicting)
│   └── utils/                 # Pure utility functions
│       ├── animations.ts      # Reusable animation utilities
│       ├── haptics.ts         # Centralized haptic feedback
│       ├── log.ts             # Logging utility
│       ├── physics/           # Game physics utilities
│       ├── performance/       # Performance optimization utils
│       ├── index.ts           # Barrel export
│       └── ...
└── firebase-backend/          # Cloud Functions, rules, indexes
```

---

## Naming Conventions

| Type       | Convention                 | Example                                |
| ---------- | -------------------------- | -------------------------------------- |
| Components | PascalCase                 | `GameCard.tsx`                         |
| Screens    | PascalCase + Screen suffix | `ChatScreen.tsx`, `GamesHubScreen.tsx` |
| Hooks      | camelCase + use prefix     | `useChat.ts`                           |
| Services   | camelCase                  | `auth.ts`, `gameInvites.ts`            |
| Types      | PascalCase (exported)      | `GameState`, `UserProfile`             |
| Constants  | SCREAMING_SNAKE_CASE       | `MAX_RETRY_COUNT`                      |
| Utilities  | camelCase                  | `formatDate.ts`                        |
| Test files | _.test.ts or _.spec.ts     | `auth.test.ts`                         |

---

## Navigation Structure

```
RootNavigator
├── AuthStack (unauthenticated)
│   ├── Welcome
│   ├── Login / Signup / ForgotPassword
│   └── ProfileSetup
│
└── AppTabs (authenticated — 5 tabs)
    ├── ShopStack (Shop tab)
    │   ├── ShopHub
    │   ├── PointsShop / PremiumShop
    │   └── PurchaseHistory
    │
    ├── PlayStack (Play tab — 19+ game screens)
    │   ├── GamesHubScreen
    │   ├── [19 game screens]           # All games: Chess, 2048, etc.
    │   ├── Leaderboard / Achievements
    │   ├── GameHistory / SpectatorView
    │   └── ...
    │
    ├── InboxStack (Inbox tab)
    │   ├── ChatListV2 (main inbox)
    │   ├── ScheduledMessages / GroupInvites
    │   ├── InboxSettings / InboxSearch
    │   └── Chat / GroupChat (overlay)
    │
    ├── MomentsStack (Moments tab)
    │   ├── Stories
    │   └── StoryViewer
    │
    └── ProfileStack (Profile tab)
        ├── OwnProfile / UserProfile
        ├── Settings / Privacy / ThemeSettings
        ├── BadgeCollection / Wallet / Tasks
        ├── Debug / LocalStorageDebug
        └── AdminReports

    Root-Level Overlays (slide over tabs):
    ├── Camera (fullScreenModal)
    ├── AudioCall / VideoCall / GroupCall
    ├── ChatSettings / GroupChatInfo
    ├── SetStatus / MutualFriendsList
    ├── ActivityFeed
    └── FriendsScreen
```

---

## State Management

### Context Providers (src/store/)

| Context                     | Purpose        | Key State                                                                                                                                 |
| --------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `AuthContext`               | Firebase auth  | `user`, `loading`, `isAdmin`                                                                                                              |
| `UserContext`               | User profile   | `profile`, `refreshProfile()`                                                                                                             |
| `ThemeContext`              | Theme mode     | `isDark`, `toggleTheme()`                                                                                                                 |
| `SnackbarContext`           | Toast messages | `showSnackbar()`                                                                                                                          |
| `InAppNotificationsContext` | In-app banners | Supports `chat`, `game_invite`, `achievement` notification types. Per-screen suppression (e.g., game invites suppressed on game screens). |
| `ProfileThemeColorsContext` | Profile themes | Profile-specific color overrides for own/other profile views                                                                              |

### Provider Hierarchy (App.tsx)

```tsx
<AuthProvider>
  <ThemeProvider>
    <UserProvider>
      <SnackbarProvider>
        <InAppNotificationsProvider>
          <RootNavigator />
        </InAppNotificationsProvider>
      </SnackbarProvider>
    </UserProvider>
  </ThemeProvider>
</AuthProvider>
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRESENTATION                             │
│  Screens → Components → Navigation                               │
│  Three.js 3D layers (ThreeCanvas → GLView → expo-three)          │
│  Skia 2D graphics (@shopify/react-native-skia)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ useAuth, useUser, useAppTheme
┌─────────────────────────────────────────────────────────────────┐
│                          STATE (Context)                         │
│  AuthContext │ UserContext │ ThemeContext │ SnackbarContext       │
│  InAppNotificationsContext │ ProfileThemeColorsContext            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SERVICES (src/services/)                  │
│  auth │ users │ database/ │ sync/ │ games │ colyseus │ ...       │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐
│  LOCAL STORAGE   │  │  FIREBASE       │  │  COLYSEUS SERVER    │
│  SQLite          │  │  Firestore      │  │  31 game rooms      │
│  File System     │  │  Storage / Auth │  │  WebSocket (ws://)  │
│  AsyncStorage    │  │  Cloud Functions│  │  Docker / nginx     │
└─────────────────┘  └─────────────────┘  └─────────────────────┘
```

---

## Local Storage Layer (NEW)

The app uses a **local-first architecture** for messaging. Messages are stored in SQLite immediately, then synced to Firebase in the background.

### SQLite Database (`services/database/`)

| File                        | Purpose              | Key Functions                                                |
| --------------------------- | -------------------- | ------------------------------------------------------------ |
| `index.ts`                  | Database singleton   | `getDatabase()`, schema initialization                       |
| `messageRepository.ts`      | Message CRUD         | `insertMessage()`, `getMessagesForConversation()`            |
| `conversationRepository.ts` | Conversation CRUD    | `getOrCreateDMConversation()`, `getConversations()`          |
| `maintenance.ts`            | Database maintenance | `vacuumDatabase()`, `pruneOldMessages()`, `resetLocalData()` |

### Database Schema

```sql
-- Core tables
conversations (id, scope, name, last_message_*, is_archived, is_muted, ...)
messages (id, conversation_id, sender_id, kind, text, sync_status, ...)
attachments (id, message_id, kind, local_uri, remote_url, upload_status, ...)
reactions (id, message_id, user_id, emoji, sync_status)
sync_cursors (conversation_id, last_synced_at, sync_token)
```

### Sync Engine (`services/sync/`)

| File            | Purpose          | Key Functions                                    |
| --------------- | ---------------- | ------------------------------------------------ |
| `syncEngine.ts` | Background sync  | `syncPendingMessages()`, `pullMessages()`        |
|                 | State management | `getSyncState()`, `subscribeSyncState()`         |
|                 | Online/offline   | `setOnlineStatus()`, `isBackgroundSyncRunning()` |

### Media Cache (`services/mediaCache.ts`)

| Function                 | Purpose                  |
| ------------------------ | ------------------------ |
| `initializeMediaCache()` | Create cache directories |
| `cacheMediaFile()`       | Download and cache media |
| `getCachedMediaPath()`   | Get local path for media |
| `getCacheStats()`        | Get cache size/counts    |
| `clearMediaCache()`      | Remove all cached files  |

### Feature Flag

Toggle local storage on/off via `constants/featureFlags.ts`:

```typescript
export const USE_LOCAL_STORAGE = true; // Set false to rollback
```

### Sync States

Messages have a `sync_status` field:

| Status     | Meaning                                  |
| ---------- | ---------------------------------------- |
| `pending`  | Awaiting sync to server                  |
| `synced`   | Successfully synced                      |
| `failed`   | Sync failed (will retry)                 |
| `conflict` | Server/local conflict (needs resolution) |

---

## Service Layer (src/services/)

### Unified Messaging (`services/messaging/`)

The messaging module provides a unified API for both DM and group chats:

| File                       | Purpose                 | Key Functions                               |
| -------------------------- | ----------------------- | ------------------------------------------- |
| `send.ts`                  | Unified message sending | `sendMessage({ scope, conversationId })`    |
| `subscribe.ts`             | Unified subscriptions   | `subscribeToMessages(scope, id)`            |
| `memberState.ts`           | Unified member state    | `setMuted`, `setArchived`, `setNotifyLevel` |
| `adapters/groupAdapter.ts` | Type conversion         | `fromGroupMessage`, `toGroupMessage`        |

### Core Services

| Service             | Purpose            | Key Functions                                       |
| ------------------- | ------------------ | --------------------------------------------------- |
| `auth.ts`           | Authentication     | `signupUser`, `loginUser`, `logoutUser`             |
| `users.ts`          | User profiles      | `createUserProfile`, `updateProfile`, `getUser`     |
| `friends.ts`        | Connections        | `sendFriendRequest`, `acceptRequest`, `unfriend`    |
| `chat.ts`           | DM chat CRUD       | `getOrCreateChat`, `getUserChats`                   |
| `chatV2.ts`         | DM messaging       | `sendMessageWithOutbox`, `processPendingMessages`   |
| `messageList.ts`    | Subscriptions      | `subscribeToDMMessages`, `subscribeToGroupMessages` |
| `messageActions.ts` | Edit/Delete        | `editMessage`, `deleteMessageForAll/Me`             |
| `reactions.ts`      | Reactions          | `toggleReaction`, `subscribeToReactions`            |
| `groups.ts`         | Group chats        | `createGroup`, `sendGroupMessage`, role management  |
| `chatMembers.ts`    | DM member state    | `updateReadWatermark`, `setMuted`, `setArchived`    |
| `groupMembers.ts`   | Group member state | `updateGroupReadWatermark`, `setGroupMuted`         |
| `outbox.ts`         | Offline queue      | `enqueueMessage`, `processOutbox`, `retryItem`      |
| `stories.ts`        | Moments            | `postStory`, `getStoriesForUser`, `markAsViewed`    |
| `games.ts`          | Mini-games         | `submitGameScore`, `sendScorecard`                  |
| `turnBasedGames.ts` | Multiplayer games  | `createGame`, `makeMove`, `resignGame`              |
| `shop.ts`           | Purchases          | `purchaseItem`, `getShopCatalog`                    |
| `economy.ts`        | Wallet             | `getWallet`, `awardTokens`                          |
| `tasks.ts`          | Daily tasks        | `getTasks`, `claimReward`                           |
| `moderation.ts`     | Reports/bans       | `submitReport`, admin functions                     |
| `notifications.ts`  | Push tokens        | `registerPushToken`                                 |
| `storage.ts`        | File uploads       | `uploadImage`, `uploadVoiceMessage`                 |
| `inboxSettings.ts`  | Inbox preferences  | `getInboxSettings`, `updateInboxSettings`           |
| `colyseus/`         | Real-time games    | `joinRoom`, `leaveRoom`, `sendAction`               |
| `leaderboards.ts`   | Leaderboards       | `getLeaderboard`, `submitScore`, rankings           |
| `achievements.ts`   | Achievements       | `getAchievements`, `checkAchievement`               |
| `badges.ts`         | Badge system       | `getBadges`, `awardBadge`, `checkEligibility`       |
| `profileService.ts` | Dual profiles      | `updateOwnProfile`, `getPublicProfile`              |
| `camera/`           | Camera system      | `capturePhoto`, `editPhoto`, `sharePhoto`           |
| `callService.ts`    | Video/audio calls  | `startCall`, `endCall`, `toggleAudio/Video`         |
| `decorations.ts`    | Avatar decorations | `getDecorations`, `equipDecoration`                 |

---

## Key Patterns

### Unified Chat Hooks

Chat screens use a layered hook architecture:

```typescript
// Master hook - composes all chat functionality
const chat = useChat({
  scope: "dm" | "group",
  conversationId: string,
  currentUserId: string,
});

// Provides:
// - messages, displayMessages (with outbox merge)
// - sendMessage, loadOlder, loadNewer
// - replyTo state management
// - reaction handling
// - scroll position tracking
// - auto-scroll behavior
```

### Optimistic Updates + Outbox

Chat messages use an outbox pattern for offline support:

1. Message added to local outbox (AsyncStorage)
2. Optimistic UI update shows message immediately
3. Background processor sends to Cloud Function
4. On success: remove from outbox
5. On failure: mark for retry

### Real-time Subscriptions

Use Firestore `onSnapshot` for real-time data:

- Chat messages: `subscribeToDMMessages()`, `subscribeToGroupMessages()`
- Chat list: Real-time unread counts
- Group members: Live role updates

### Watermark-based Read State

Read/unread tracking uses watermarks instead of per-message flags:

- `MembersPrivate/{uid}.lastSeenAtPrivate` stores last read timestamp
- Messages after watermark are unread
- Single document update per conversation view

---

## Terminology (Vibe Branding)

| Internal | User-Facing     |
| -------- | --------------- |
| Stories  | **Moments**     |
| Snaps    | **Shots**       |
| Friends  | **Connections** |
| Streaks  | **Rituals**     |
| Games    | **Play**        |
| Chat     | **Inbox**       |

---

## Colyseus Real-Time Multiplayer (colyseus-server/)

The app uses **Colyseus v0.17** for real-time game multiplayer, deployed via Docker + nginx.

### Room Architecture (22 rooms)

| Category               | Room Types                                                            | Count |
| ---------------------- | --------------------------------------------------------------------- | ----- |
| Base patterns          | `CardGameRoom`, `ScoreRaceRoom`, `TurnBasedRoom`, `PhysicsRoom`       | 4     |
| Score-race (quickplay) | TimedTap, Reaction, DotMatch                                          | 3     |
| Turn-based             | TicTacToe, Chess, Checkers, CrazyEights, ConnectFour, Gomoku, Reversi | 7     |
| Physics                | Pong, AirHockey, BrickBreaker, BounceBlitz, Pool                      | 5     |
| Cooperative            | WordMaster, Crossword                                                 | 2     |
| Spectator              | SpectatorRoom                                                         | 1     |

### Client SDK Integration

- **SDK**: `colyseus.js@0.17.31` (client) ↔ `@colyseus/core@0.17.35` (server)
- **Hooks**: `useColyseusRoom`, `useQuickplayRoom`, `useTurnBasedRoom`, `usePhysicsRoom`
- **State sync**: Automatic state patching via Colyseus `@type()` decorators
- **Reconnection**: Token-based reconnection with 30s timeout

---

## Three.js 3D Integration (src/components/three/)

Three.js provides GPU-accelerated 3D visuals via `expo-gl` + `expo-three`.

### Components

| Component             | Purpose                                         |
| --------------------- | ----------------------------------------------- |
| `ThreeCanvas`         | Foundation `GLView` wrapper with animation loop |
| `geometries.ts`       | Reusable 3D geometry helper functions           |
| `ThreeGameBackground` | Full-screen 3D backgrounds for game screens     |
| `ThreeHeroBanner`     | 3D hero banner with floating game pieces        |
| `ThreeInviteCard`     | 3D overlay for game invite cards                |
| `ThreeGameTrophy`     | Animated 3D victory trophy                      |
| `ThreeFloatingIcons`  | Floating 3D game icons for GamesHub             |

### Feature Flags (THREE_JS_FEATURES)

```typescript
export const THREE_JS_FEATURES = {
  INVITE_CARDS: true, // 3D invite card overlays
  HERO_BANNERS: true, // 3D hero banners
  GAME_BACKGROUNDS: false, // Full-screen 3D backgrounds (performance-gated)
  TROPHIES: true, // 3D victory trophies
  FLOATING_ICONS: true, // 3D floating icons on GamesHub
};
```

---

## Skia 2D Graphics (src/components/games/graphics/)

`@shopify/react-native-skia` provides GPU-accelerated 2D rendering for game boards.

### Components

- `SkiaChessPieces` — Vector chess piece rendering
- `SkiaCheckersPieces` — Checkers piece rendering
- `SkiaGameBoard` — Generic game board grid
- `Skia2048Tiles` — Animated 2048 tile rendering
- `SkiaParticleSystem` — Particle effects for game events
- Additional Skia helpers for Go boards, etc.

---

## Cloud Functions (firebase-backend/functions/)

8 modules deployed via Firebase Cloud Functions:

| Module          | Purpose                                |
| --------------- | -------------------------------------- |
| `economy.ts`    | Token wallet transactions, rewards     |
| `games.ts`      | Score submission, matchmaking          |
| `messaging.ts`  | Push notifications, message processing |
| `moderation.ts` | Report handling, auto-ban              |
| `onboarding.ts` | New user setup, welcome flow           |
| `scheduled.ts`  | Cron: streak checks, cleanup           |
| `social.ts`     | Friend requests, activity feed         |
| `shop.ts`       | Purchase validation, IAP receipts      |
