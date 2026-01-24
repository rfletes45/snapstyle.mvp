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
| How do I debug an issue?            | [04_RUNBOOK.md](04_RUNBOOK.md)           | Troubleshooting  |
| What tests should I run?            | [05_TESTING.md](05_TESTING.md)           | Test Matrix      |

---

## Document Map

### Core Documentation

| File                                     | Purpose                                                    | When to Read           |
| ---------------------------------------- | ---------------------------------------------------------- | ---------------------- |
| [README.md](../README.md)                | Project overview, quick start, commands                    | First time setup       |
| [01_ARCHITECTURE.md](01_ARCHITECTURE.md) | App structure, navigation, state, services                 | Understanding codebase |
| [02_FIREBASE.md](02_FIREBASE.md)         | Firestore schema, security rules, Cloud Functions, indexes | Backend changes        |
| [03_CHAT_V2.md](03_CHAT_V2.md)           | Chat/messaging V2 specification and implementation         | Chat feature work      |
| [04_RUNBOOK.md](04_RUNBOOK.md)           | Common issues, debugging, deployment                       | When things break      |
| [05_TESTING.md](05_TESTING.md)           | Security test matrix, QA procedures                        | Before deploying       |

### Reference

| File                             | Purpose                                            |
| -------------------------------- | -------------------------------------------------- |
| [ARCHIVE.md](ARCHIVE.md)         | Historical/legacy information retained for context |
| [../BRANDING.md](../BRANDING.md) | Vibe brand guide, terminology, design tokens       |

---

## Key Code Paths

### Entry Points

- `App.tsx` — Root component with providers
- `src/navigation/RootNavigator.tsx` — All navigation stacks

### Services (src/services/)

- `auth.ts` — Authentication
- `chat.ts` — DM chat operations
- `chatV2.ts` — V2 messaging with outbox
- `groups.ts` — Group chat operations
- `users.ts` — User profile CRUD
- `friends.ts` — Friend requests and connections
- `stories.ts` — Moments (stories)
- `games.ts` — Mini-games and scores

### State (src/store/)

- `AuthContext.tsx` — Firebase auth state
- `UserContext.tsx` — Current user profile
- `ThemeContext.tsx` — Dark/light mode
- `InAppNotificationsContext.tsx` — In-app toasts

### Cloud Functions (firebase-backend/functions/src/)

- `index.ts` — All function exports
- `messaging.ts` — V2 messaging callable functions

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
