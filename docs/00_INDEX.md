# Vibe App — Documentation Index

> **For Claude / LLM Context:** This index maps all project documentation. Use this to quickly find answers.
>
> **Last Updated**: February 2026

---

## Quick Reference

| Question                            | Document                                 | Section               |
| ----------------------------------- | ---------------------------------------- | --------------------- |
| How do I run the app?               | [README.md](../README.md)                | Quick Start           |
| What's the app structure?           | [01_ARCHITECTURE.md](01_ARCHITECTURE.md) | Folder Structure      |
| How does local storage work?        | [01_ARCHITECTURE.md](01_ARCHITECTURE.md) | Local Storage Layer   |
| What are the Firestore collections? | [02_FIREBASE.md](02_FIREBASE.md)         | Data Model            |
| How does the unified chat work?     | [03_CHAT_V2.md](03_CHAT_V2.md)           | Architecture          |
| How does message grouping work?     | [03_CHAT_V2.md](03_CHAT_V2.md)           | Message Grouping      |
| How do read receipts work?          | [03_CHAT_V2.md](03_CHAT_V2.md)           | Chat Privacy Features |
| How do typing indicators work?      | [03_CHAT_V2.md](03_CHAT_V2.md)           | Chat Privacy Features |
| How does presence/online work?      | [03_CHAT_V2.md](03_CHAT_V2.md)           | Chat Privacy Features |
| How does the reply system work?     | [03_CHAT_V2.md](03_CHAT_V2.md)           | Reply/Threading       |
| How do the games work?              | [06_GAMES.md](06_GAMES.md)               | All Sections          |
| How do game invites work?           | [06_GAMES.md](06_GAMES.md)               | Services              |
| How do I debug an issue?            | [05_RUNBOOK.md](05_RUNBOOK.md)           | Troubleshooting       |
| What tests should I run?            | [04_TESTING.md](04_TESTING.md)           | Test Matrix           |
| What was completed in each phase?   | [ARCHIVE.md](ARCHIVE.md)                 | Timeline Summary      |

---

## Document Map

### Core Documentation

| File                                     | Purpose                                                    | When to Read           |
| ---------------------------------------- | ---------------------------------------------------------- | ---------------------- |
| [README.md](../README.md)                | Project overview, quick start, commands                    | First time setup       |
| [01_ARCHITECTURE.md](01_ARCHITECTURE.md) | App structure, local storage, navigation, services         | Understanding codebase |
| [02_FIREBASE.md](02_FIREBASE.md)         | Firestore schema, security rules, Cloud Functions, indexes | Backend changes        |
| [03_CHAT_V2.md](03_CHAT_V2.md)           | Unified chat system, message grouping, composer, keyboard  | Chat feature work      |
| [04_TESTING.md](04_TESTING.md)           | Security test matrix, QA procedures                        | Before deploying       |
| [05_RUNBOOK.md](05_RUNBOOK.md)           | Common issues, debugging, deployment                       | When things break      |
| [06_GAMES.md](06_GAMES.md)               | Games system: architecture, types, services, testing       | Games feature work     |

### Reference & History

| File                             | Purpose                                          |
| -------------------------------- | ------------------------------------------------ |
| [ARCHIVE.md](ARCHIVE.md)         | Development history, completed phases, decisions |
| [../BRANDING.md](../BRANDING.md) | Vibe brand guide, terminology, design tokens     |

### Active Implementation Plans

| File                                                         | Purpose                                      | Status                          |
| ------------------------------------------------------------ | -------------------------------------------- | ------------------------------- |
| [GAME_SYSTEM_OVERHAUL_PLAN.md](GAME_SYSTEM_OVERHAUL_PLAN.md) | Game history, stats, navigation improvements | Phase 1 Complete, 2-8 Pending   |
| [GAME_PICKER_PLAN.md](GAME_PICKER_PLAN.md)                   | Game picker modal, queue visualization       | Core Complete, Enhancements TBD |

### Archived/Completed Plans

| File                                                   | Purpose                              | Status      |
| ------------------------------------------------------ | ------------------------------------ | ----------- |
| [CHAT_SETTINGS_AUDIT.md](CHAT_SETTINGS_AUDIT.md)       | Chat privacy features implementation | ✅ Complete |
| [CHAT_OPTIMIZATION_PLAN.md](CHAT_OPTIMIZATION_PLAN.md) | Chat performance improvements        | ✅ Complete |
| [REPLY_SYSTEM_DESIGN.md](REPLY_SYSTEM_DESIGN.md)       | Enhanced reply system design         | ✅ Complete |

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
- `database/` — **SQLite local storage** (messages, conversations)
- `sync/` — **Background sync engine** (Firestore bidirectional sync)
- `mediaCache.ts` — **Local media caching** (images, videos, audio)

### State (src/store/)

- `AuthContext.tsx` — Firebase auth state
- `UserContext.tsx` — Current user profile
- `ThemeContext.tsx` — Dark/light mode
- `InAppNotificationsContext.tsx` — In-app toasts

### Hooks (src/hooks/)

- `useChat.ts` — **Master chat hook** (unified DM & Group)
- `useUnifiedChatScreen.ts` — **Screen-level hook** (composes useChat + keyboard + scroll)
- `useLocalMessages.ts` — **SQLite subscription** (local-first message storage)
- `useUnifiedMessages.ts` — Unified message subscription + outbox
- `useChatComposer.ts` — Composer state management
- `useMessagesV2.ts` — V2 message subscription (legacy, re-exports unified)
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
