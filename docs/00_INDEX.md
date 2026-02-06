# Vibe App — Documentation Index

> **For Claude / LLM Context:** This index maps all project documentation. Use this to quickly find answers.
>
> **Last Updated**: February 2026

---

## Quick Reference

| Question                             | Document                                                     | Section                |
| ------------------------------------ | ------------------------------------------------------------ | ---------------------- |
| How do I run the app?                | [README.md](../README.md)                                    | Quick Start            |
| What's the app structure?            | [01_ARCHITECTURE.md](01_ARCHITECTURE.md)                     | Folder Structure       |
| How does local storage work?         | [01_ARCHITECTURE.md](01_ARCHITECTURE.md)                     | Local Storage Layer    |
| What are the Firestore collections?  | [02_FIREBASE.md](02_FIREBASE.md)                             | Data Model             |
| How does the unified chat work?      | [03_CHAT_V2.md](03_CHAT_V2.md)                               | Architecture           |
| How does message grouping work?      | [03_CHAT_V2.md](03_CHAT_V2.md)                               | Message Grouping       |
| How do read receipts work?           | [03_CHAT_V2.md](03_CHAT_V2.md)                               | Chat Privacy Features  |
| How do typing indicators work?       | [03_CHAT_V2.md](03_CHAT_V2.md)                               | Chat Privacy Features  |
| How does presence/online work?       | [03_CHAT_V2.md](03_CHAT_V2.md)                               | Chat Privacy Features  |
| How does the reply system work?      | [03_CHAT_V2.md](03_CHAT_V2.md)                               | Reply/Threading        |
| How does keyboard handling work?     | [03_CHAT_V2.md](03_CHAT_V2.md)                               | Keyboard & Composer    |
| How does the inbox work?             | [03_CHAT_V2.md](03_CHAT_V2.md)                               | Inbox Overhaul         |
| How do the games work?               | [06_GAMES.md](06_GAMES.md)                                   | All Sections           |
| How do game invites work?            | [06_GAMES.md](06_GAMES.md)                                   | Universal Game Invites |
| How do in-app notifications work?    | [01_ARCHITECTURE.md](01_ARCHITECTURE.md)                     | State / Providers      |
| How does Tank Battle work?           | [TANK_BATTLE_GAME_PLAN.md](TANK_BATTLE_GAME_PLAN.md)         | All Sections           |
| How does Cart Course work?           | [CART_COURSE_GAME_PLAN.md](CART_COURSE_GAME_PLAN.md)         | All Sections           |
| How do I debug an issue?             | [05_RUNBOOK.md](05_RUNBOOK.md)                               | Troubleshooting        |
| What tests should I run?             | [04_TESTING.md](04_TESTING.md)                               | Test Matrix            |
| What was completed in each phase?    | [ARCHIVE.md](ARCHIVE.md)                                     | Timeline Summary       |
| What are the profile redesign plans? | [NEW_PROFILE_SYSTEM_PLAN.md](NEW_PROFILE_SYSTEM_PLAN.md)     | All Sections           |
| What are the shop redesign plans?    | [SHOP_OVERHAUL_PLAN.md](SHOP_OVERHAUL_PLAN.md)               | All Sections           |
| What are the Play screen plans?      | [PLAY_SCREEN_OVERHAUL_PLAN.md](PLAY_SCREEN_OVERHAUL_PLAN.md) | All Sections           |

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

| File                     | Purpose                                          |
| ------------------------ | ------------------------------------------------ |
| [ARCHIVE.md](ARCHIVE.md) | Development history, completed phases, decisions |

### Active Implementation Plans

| File                                                         | Purpose                                        | Status                        |
| ------------------------------------------------------------ | ---------------------------------------------- | ----------------------------- |
| [NEW_PROFILE_SYSTEM_PLAN.md](NEW_PROFILE_SYSTEM_PLAN.md)     | Profile redesign, badges, bio, decorations     | Planning Phase                |
| [SHOP_OVERHAUL_PLAN.md](SHOP_OVERHAUL_PLAN.md)               | Points shop + premium shop, IAP integration    | Planning Phase                |
| [PLAY_SCREEN_OVERHAUL_PLAN.md](PLAY_SCREEN_OVERHAUL_PLAN.md) | Play screen UI/UX redesign, search, categories | Planning Phase                |
| [GAME_SYSTEM_OVERHAUL_PLAN.md](GAME_SYSTEM_OVERHAUL_PLAN.md) | Game history, stats, navigation improvements   | Phase 1 Complete, 2-8 Pending |
| [GAME_PICKER_PLAN.md](GAME_PICKER_PLAN.md)                   | Game picker modal, queue visualization         | Core Complete, TBD            |
| [TANK_BATTLE_GAME_PLAN.md](TANK_BATTLE_GAME_PLAN.md)         | Wii Tanks-style 2-player multiplayer game      | Planning Phase                |
| [CART_COURSE_GAME_PLAN.md](CART_COURSE_GAME_PLAN.md)         | DK Crash Course-style tilt obstacle course     | Planning Phase                |

### Archived Plans

> **Note**: Completed plan summaries are consolidated in [ARCHIVE.md](ARCHIVE.md).

| File                                                                                     | Purpose                    | Status         |
| ---------------------------------------------------------------------------------------- | -------------------------- | -------------- |
| [archived/VIDEO_CALL_IMPLEMENTATION_PLAN.md](archived/VIDEO_CALL_IMPLEMENTATION_PLAN.md) | Voice/video calling system | ✅ Implemented |

---

## Key Code Paths

### Entry Points

- `App.tsx` — Root component with providers
- `src/navigation/RootNavigator.tsx` — All navigation stacks (default screen: Inbox)

### Services (src/services/)

| Service                   | Purpose                                              |
| ------------------------- | ---------------------------------------------------- |
| `messaging/`              | **Unified messaging** (send, subscribe, memberState) |
| `messaging/adapters/`     | GroupMessage ↔ MessageV2 conversion                  |
| `chatV2.ts`               | V2 messaging with outbox (legacy, being migrated)    |
| `groups.ts`               | Group chat operations                                |
| `users.ts`                | User profile CRUD                                    |
| `friends.ts`              | Friend requests and connections                      |
| `stories.ts`              | Moments (stories)                                    |
| `games.ts`                | Mini-games and scores                                |
| `turnBasedGames.ts`       | Turn-based multiplayer (chess, checkers, etc.)       |
| `gameInvites.ts`          | Universal game invitation system                     |
| `matchmaking.ts`          | Automatic matchmaking with ELO                       |
| `gameStats.ts`            | Player statistics and leaderboards                   |
| `gameAchievements.ts`     | Game achievement system                              |
| `singlePlayerSessions.ts` | Single-player game records                           |
| `database/`               | **SQLite local storage** (messages, conversations)   |
| `sync/`                   | **Background sync engine** (Firestore sync)          |
| `mediaCache.ts`           | **Local media caching** (images, videos, audio)      |
| `calls/`                  | **Voice/video calling** (WebRTC, feature-flagged)    |
| `inboxSettings.ts`        | User inbox preferences                               |
| `cache/profileCache.ts`   | LRU profile caching (5-min TTL)                      |

### State (src/store/)

| Provider                        | Purpose                                              |
| ------------------------------- | ---------------------------------------------------- |
| `AuthContext.tsx`               | Firebase auth state                                  |
| `UserContext.tsx`               | Current user profile                                 |
| `ThemeContext.tsx`              | Dark/light mode                                      |
| `InAppNotificationsContext.tsx` | In-app toasts (chat, game_invite, achievement types) |
| `ProfileThemeColorsContext.tsx` | Profile-specific theme colors                        |

### Hooks (src/hooks/)

| Hook                              | Purpose                                              |
| --------------------------------- | ---------------------------------------------------- |
| `useChat.ts`                      | **Master chat hook** (unified DM & Group)            |
| `useUnifiedChatScreen.ts`         | **Screen-level hook** (useChat + keyboard + scroll)  |
| `useLocalMessages.ts`             | **SQLite subscription** (local-first messages)       |
| `useUnifiedMessages.ts`           | Unified message subscription + outbox                |
| `useChatComposer.ts`              | Composer state management                            |
| `useOutboxProcessor.ts`           | Offline message queue processing                     |
| `useInboxData.ts`                 | Unified inbox data with filters                      |
| `useConversationActions.ts`       | Pin/mute/delete actions                              |
| `useFriendRequests.ts`            | Friend request subscription                          |
| `useGameLoop.ts`                  | 60fps game loop with delta time                      |
| `chat/useChatKeyboard.ts`         | Keyboard tracking (react-native-keyboard-controller) |
| `chat/useAtBottom.ts`             | Scroll position detection for inverted lists         |
| `chat/useNewMessageAutoscroll.ts` | Smart autoscroll rules for new messages              |

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
