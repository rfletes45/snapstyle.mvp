# Vibe App — Documentation Index

> **For Claude / LLM Context:** This index maps all project documentation. Use this to quickly find answers.
>
> **Last Updated**: February 2026

---

## Quick Reference

| Question                            | Document                                                     | Section                |
| ----------------------------------- | ------------------------------------------------------------ | ---------------------- |
| How do I run the app?               | [README.md](../README.md)                                    | Quick Start            |
| What's the app structure?           | [01_ARCHITECTURE.md](01_ARCHITECTURE.md)                     | Folder Structure       |
| How does local storage work?        | [01_ARCHITECTURE.md](01_ARCHITECTURE.md)                     | Local Storage Layer    |
| What are the Firestore collections? | [02_FIREBASE.md](02_FIREBASE.md)                             | Data Model             |
| How does the unified chat work?     | [03_CHAT_V2.md](03_CHAT_V2.md)                               | Architecture           |
| How does message grouping work?     | [03_CHAT_V2.md](03_CHAT_V2.md)                               | Message Grouping       |
| How do read receipts work?          | [03_CHAT_V2.md](03_CHAT_V2.md)                               | Chat Privacy Features  |
| How do typing indicators work?      | [03_CHAT_V2.md](03_CHAT_V2.md)                               | Chat Privacy Features  |
| How does presence/online work?      | [03_CHAT_V2.md](03_CHAT_V2.md)                               | Chat Privacy Features  |
| How does the reply system work?     | [03_CHAT_V2.md](03_CHAT_V2.md)                               | Reply/Threading        |
| How does keyboard handling work?    | [03_CHAT_V2.md](03_CHAT_V2.md)                               | Keyboard & Composer    |
| How does the inbox work?            | [03_CHAT_V2.md](03_CHAT_V2.md)                               | Inbox Overhaul         |
| How do the games work?              | [06_GAMES.md](06_GAMES.md)                                   | All Sections           |
| How do game invites work?           | [06_GAMES.md](06_GAMES.md)                                   | Universal Game Invites |
| How does Colyseus multiplayer work? | [COLYSEUS_MULTIPLAYER_PLAN.md](COLYSEUS_MULTIPLAYER_PLAN.md) | Architecture           |
| How do in-app notifications work?   | [01_ARCHITECTURE.md](01_ARCHITECTURE.md)                     | State / Providers      |
| How does the profile system work?   | [NEW_PROFILE_SYSTEM_PLAN.md](NEW_PROFILE_SYSTEM_PLAN.md)     | All Sections           |
| How does the shop system work?      | [SHOP_OVERHAUL_PLAN.md](SHOP_OVERHAUL_PLAN.md)               | All Sections           |
| How does the play screen work?      | [PLAY_SCREEN_OVERHAUL_PLAN.md](PLAY_SCREEN_OVERHAUL_PLAN.md) | All Sections           |
| How do I debug an issue?            | [05_RUNBOOK.md](05_RUNBOOK.md)                               | Troubleshooting        |
| What tests should I run?            | [04_TESTING.md](04_TESTING.md)                               | Test Matrix            |
| What was completed in each phase?   | [ARCHIVE.md](ARCHIVE.md)                                     | Timeline Summary       |

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

| File                                                             | Purpose                                          |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| [ARCHIVE.md](ARCHIVE.md)                                         | Development history, completed phases, decisions |
| [PERMISSIONS_CONFIGURATION.md](PERMISSIONS_CONFIGURATION.md)     | iOS/Android permission declarations              |
| [VISUAL_ENHANCEMENT_PACKAGES.md](VISUAL_ENHANCEMENT_PACKAGES.md) | Visual package audit and upgrade roadmap         |

### Implemented System Plans

> These plans were fully executed. They serve as detailed reference documentation for their respective systems.

| File                                                                       | System                                          | Status         |
| -------------------------------------------------------------------------- | ----------------------------------------------- | -------------- |
| [NEW_PROFILE_SYSTEM_PLAN.md](NEW_PROFILE_SYSTEM_PLAN.md)                   | Dual profile system (Own + User), decorations   | ✅ Implemented |
| [SHOP_OVERHAUL_PLAN.md](SHOP_OVERHAUL_PLAN.md)                             | Points shop + premium shop, IAP integration     | ✅ Implemented |
| [PLAY_SCREEN_OVERHAUL_PLAN.md](PLAY_SCREEN_OVERHAUL_PLAN.md)               | Play screen UI/UX redesign, search, categories  | ✅ Implemented |
| [GAME_SYSTEM_OVERHAUL_PLAN.md](GAME_SYSTEM_OVERHAUL_PLAN.md)               | Game history, stats, achievements, leaderboards | ✅ Implemented |
| [GAME_PICKER_PLAN.md](GAME_PICKER_PLAN.md)                                 | Game picker modal, queue visualization          | ✅ Implemented |
| [COLYSEUS_MULTIPLAYER_PLAN.md](COLYSEUS_MULTIPLAYER_PLAN.md)               | Colyseus real-time multiplayer (25 rooms)       | ✅ Implemented |
| [COLYSEUS_INVITE_INTEGRATION_PLAN.md](COLYSEUS_INVITE_INTEGRATION_PLAN.md) | Game invite → Colyseus room integration         | ✅ Implemented |
| [SPECTATOR_SYSTEM_PLAN.md](SPECTATOR_SYSTEM_PLAN.md)                       | Colyseus-native spectator system                | ✅ Implemented |

### Archived Plans

> Completed or shelved plans moved to the archive.

| File                                                                                     | Purpose                    | Status                                       |
| ---------------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------- |
| [archived/VIDEO_CALL_IMPLEMENTATION_PLAN.md](archived/VIDEO_CALL_IMPLEMENTATION_PLAN.md) | Voice/video calling system | ⏸️ Infrastructure built, feature-flagged off |

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
| `colyseus.ts`             | Colyseus real-time multiplayer client                |
| `gameStats.ts`            | Player statistics and leaderboards                   |
| `gameAchievements.ts`     | Game achievement system                              |
| `singlePlayerSessions.ts` | Single-player game records                           |
| `leaderboards.ts`         | Global leaderboards                                  |
| `database/`               | **SQLite local storage** (messages, conversations)   |
| `sync/`                   | **Background sync engine** (Firestore sync)          |
| `mediaCache.ts`           | **Local media caching** (images, videos, audio)      |
| `calls/`                  | **Voice/video calling** (WebRTC, feature-flagged)    |
| `camera/`                 | Camera capture, editing, filters                     |
| `inboxSettings.ts`        | User inbox preferences                               |
| `cache/profileCache.ts`   | LRU profile caching (5-min TTL)                      |
| `shop.ts`                 | Cosmetics shop operations                            |
| `pointsShop.ts`           | Points shop (earn & spend coins)                     |
| `premiumShop.ts`          | Premium shop (IAP)                                   |
| `economy.ts`              | Wallet and token management                          |
| `tasks.ts`                | Daily/monthly task system                            |
| `profileService.ts`       | Profile data management                              |
| `profileThemes.ts`        | Profile theme customization                          |
| `badges.ts`               | Badge system                                         |
| `cosmetics.ts`            | Cosmetic items management                            |
| `presence.ts`             | Online presence tracking                             |
| `moderation.ts`           | Reports/bans/admin                                   |

### State (src/store/)

| Provider                        | Purpose                                              |
| ------------------------------- | ---------------------------------------------------- |
| `AuthContext.tsx`               | Firebase auth state                                  |
| `UserContext.tsx`               | Current user profile                                 |
| `ThemeContext.tsx`              | Dark/light mode (30 Catppuccin themes)               |
| `InAppNotificationsContext.tsx` | In-app toasts (chat, game_invite, achievement types) |
| `ProfileThemeColorsContext.tsx` | Profile-specific theme colors                        |
| `SnackbarContext.tsx`           | Toast messages                                       |
| `CameraContext.tsx`             | Camera state management                              |

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
| `useGameHaptics.ts`               | Standardized haptic feedback for games               |
| `useGameConnection.ts`            | Colyseus game connection lifecycle                   |
| `useMultiplayerGame.ts`           | Generic real-time multiplayer hook                   |
| `useScoreRace.ts`                 | Score-race pattern multiplayer                       |
| `useTurnBasedGame.ts`             | Turn-based multiplayer hook                          |
| `useCardGame.ts`                  | Card game multiplayer hook                           |
| `usePhysicsGame.ts`               | Physics-based multiplayer hook                       |
| `useColyseus.ts`                  | Colyseus SDK connection                              |
| `useProfileData.ts`               | Profile data fetching                                |
| `chat/useChatKeyboard.ts`         | Keyboard tracking (react-native-keyboard-controller) |
| `chat/useAtBottom.ts`             | Scroll position detection for inverted lists         |
| `chat/useNewMessageAutoscroll.ts` | Smart autoscroll rules for new messages              |

### Cloud Functions (firebase-backend/functions/src/)

| Module          | Purpose                             |
| --------------- | ----------------------------------- |
| `index.ts`      | All function exports                |
| `messaging.ts`  | V2 messaging callable functions     |
| `games.ts`      | Game creation, matchmaking, invites |
| `shop.ts`       | Shop transactions                   |
| `iap.ts`        | In-app purchase verification        |
| `calls.ts`      | Call signaling                      |
| `dailyDeals.ts` | Daily deal rotation                 |
| `gifting.ts`    | Gift sending between users          |

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

## Tech Stack

| Technology         | Version | Purpose                                   |
| ------------------ | ------- | ----------------------------------------- |
| React Native       | 0.81.5  | Mobile framework                          |
| Expo SDK           | 54      | Build/dev toolchain                       |
| React              | 19.1.0  | UI library                                |
| TypeScript         | ~5.9.2  | Type safety                               |
| Firebase           | 12.8.0  | Auth, Firestore, Storage, Cloud Functions |
| Colyseus SDK       | 0.17.31 | Real-time multiplayer                     |
| Three.js           | 0.166.1 | 3D graphics (via expo-gl + expo-three)    |
| React Navigation   | 7.x     | Screen navigation                         |
| React Native Paper | 5.14.5  | Material Design components                |
| Reanimated         | 4.1.1   | 60fps animations                          |
| Skia               | 2.2.12  | GPU-accelerated 2D graphics               |
| Matter.js          | 0.20.0  | 2D physics engine                         |
| expo-sqlite        | 16.0.10 | Local-first message storage               |
| WebRTC             | 124.0.7 | Video/audio calling (feature-flagged)     |

---

## Version Info

- **App Name:** Vibe
- **Platforms:** iOS, Android, Web (Expo)
- **React Native:** 0.81.5
- **Expo SDK:** 54
- **Firebase:** 12.8.0
