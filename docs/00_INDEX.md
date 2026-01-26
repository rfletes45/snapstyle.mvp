# Vibe App — Documentation Index

> **For Claude / LLM Context:** This index maps all project documentation. Use this to quickly find answers.

---

## Quick Reference

| Question                            | Document                                 | Section          |
| ----------------------------------- | ---------------------------------------- | ---------------- |
| How do I run the app?               | [README.md](../README.md)                | Quick Start      |
| What's the app structure?           | [01_ARCHITECTURE.md](01_ARCHITECTURE.md) | Folder Structure |
| What are the Firestore collections? | [02_FIREBASE.md](02_FIREBASE.md)         | Data Model       |
| How does Chat V2 messaging work?    | [03_CHAT_V2.md](03_CHAT_V2.md)           | Implementation   |
| How do the games work?              | [06_GAMES.md](06_GAMES.md)               | All Sections     |
| How do I debug an issue?            | [05_RUNBOOK.md](05_RUNBOOK.md)           | Troubleshooting  |
| What tests should I run?            | [04_TESTING.md](04_TESTING.md)           | Test Matrix      |

---

## Document Map

### Core Documentation

| File                                     | Purpose                                                    | When to Read           |
| ---------------------------------------- | ---------------------------------------------------------- | ---------------------- |
| [README.md](../README.md)                | Project overview, quick start, commands                    | First time setup       |
| [01_ARCHITECTURE.md](01_ARCHITECTURE.md) | App structure, navigation, state, services                 | Understanding codebase |
| [02_FIREBASE.md](02_FIREBASE.md)         | Firestore schema, security rules, Cloud Functions, indexes | Backend changes        |
| [03_CHAT_V2.md](03_CHAT_V2.md)           | Chat/messaging V2 specification and implementation         | Chat feature work      |
| [04_TESTING.md](04_TESTING.md)           | Security test matrix, QA procedures                        | Before deploying       |
| [05_RUNBOOK.md](05_RUNBOOK.md)           | Common issues, debugging, deployment                       | When things break      |
| [06_GAMES.md](06_GAMES.md)               | Games system: architecture, types, services, testing       | Games feature work     |

### Reference

| File                                                       | Purpose                                            |
| ---------------------------------------------------------- | -------------------------------------------------- |
| [ARCHIVE.md](ARCHIVE.md)                                   | Historical/legacy information retained for context |
| [REORGANIZATION_CHANGELOG.md](REORGANIZATION_CHANGELOG.md) | Record of codebase cleanup and reorganization      |
| [../BRANDING.md](../BRANDING.md)                           | Vibe brand guide, terminology, design tokens       |

---

## Key Code Paths

### Entry Points

- `App.tsx` — Root component with providers
- `src/navigation/RootNavigator.tsx` — All navigation stacks

### Barrel Exports (index.ts)

| Directory       | Purpose                               |
| --------------- | ------------------------------------- |
| `src/hooks/`    | All custom hooks                      |
| `src/types/`    | Type definitions (non-conflicting)    |
| `src/services/` | Core services (non-conflicting)       |
| `src/utils/`    | Utility functions                     |
| `src/store/`    | Context providers and hooks           |
| `src/data/`     | Static data (cosmetics, achievements) |

### Services (src/services/)

- `auth.ts` — Authentication
- `chat.ts` — DM chat operations
- `chatV2.ts` — V2 messaging with outbox
- `groups.ts` — Group chat operations
- `users.ts` — User profile CRUD
- `friends.ts` — Friend requests and connections
- `stories.ts` — Moments (stories)
- `games.ts` — Mini-games and scores
- `turnBasedGames.ts` — Turn-based multiplayer games (chess, checkers, etc.)
- `gameInvites.ts` — Game invitation system
- `matchmaking.ts` — Automatic matchmaking with ELO
- `gameStats.ts` — Player statistics and leaderboards
- `gameAchievements.ts` — Game achievement system
- `singlePlayerSessions.ts` — Single-player game records

### State (src/store/)

- `AuthContext.tsx` — Firebase auth state
- `UserContext.tsx` — Current user profile
- `ThemeContext.tsx` — Dark/light mode
- `InAppNotificationsContext.tsx` — In-app toasts

### Hooks (src/hooks/)

- `useMessagesV2.ts` — V2 message subscription
- `useOutboxProcessor.ts` — Offline message queue processing
- `useInboxData.ts` — Unified inbox data with filters
- `useConversationActions.ts` — Pin/mute/delete actions
- `useFriendRequests.ts` — Friend request subscription
- `useGameLoop.ts` — 60fps game loop with delta time
- `chat/useChatKeyboard.ts` — Keyboard tracking with react-native-keyboard-controller
- `chat/useAtBottom.ts` — Scroll position detection for inverted lists
- `chat/useNewMessageAutoscroll.ts` — Smart autoscroll rules for new messages

### Cloud Functions (firebase-backend/functions/src/)

- `index.ts` — All function exports
- `messaging.ts` — V2 messaging callable functions
- `games.ts` — Game creation, matchmaking, achievements

---

## Firebase Resources

| Resource        | Location                                  |
| --------------- | ----------------------------------------- |
| Project ID      | `gamerapp-37e70`                          |
| Region          | `us-central1`                             |
| Firestore Rules | `firebase-backend/firestore.rules`        |
| Storage Rules   | `firebase-backend/storage.rules`          |
| Indexes         | `firebase-backend/firestore.indexes.json` |
| Functions       | `firebase-backend/functions/src/`         |

---

## Version Info

- **App Name:** Vibe
- **Platforms:** iOS, Android, Web (Expo)
- **React Native:** 0.81.5
- **Expo SDK:** 54
- **Firebase:** 12.8.0
