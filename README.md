# Vibe

A social mobile app built with Expo and Firebase.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Press 'i' for iOS, 'a' for Android, 'w' for Web
```

## Documentation

All project documentation lives in the [docs/](docs/) folder:

| Document                                      | Contents                                    |
| --------------------------------------------- | ------------------------------------------- |
| [00_INDEX.md](docs/00_INDEX.md)               | Quick reference for key paths and resources |
| [01_ARCHITECTURE.md](docs/01_ARCHITECTURE.md) | App structure, navigation, services         |
| [02_FIREBASE.md](docs/02_FIREBASE.md)         | Firestore schema, rules, Cloud Functions    |
| [03_CHAT_V2.md](docs/03_CHAT_V2.md)           | Messaging system specification              |
| [04_TESTING.md](docs/04_TESTING.md)           | Test scenarios and validation               |
| [05_RUNBOOK.md](docs/05_RUNBOOK.md)           | Commands, deployment, troubleshooting       |
| [06_GAMES.md](docs/06_GAMES.md)               | Games system: types, services, physics      |

## Tech Stack

- **Frontend**: React Native 0.81.5 + Expo SDK 54
- **Backend**: Firebase (Firestore, Auth, Functions, Storage)
- **State**: Zustand + TanStack Query
- **Navigation**: React Navigation 7
- **Language**: TypeScript (strict)

## Project Structure

```
src/
├── components/     # Reusable UI components
├── screens/        # Screen components
├── navigation/     # React Navigation config
├── services/       # Firebase/API operations
├── hooks/          # Custom React hooks
├── store/          # Zustand state stores
├── types/          # TypeScript definitions
└── utils/          # Pure utility functions
```

## Key Commands

```bash
npx expo start          # Dev server
npx tsc --noEmit        # Type check
npx eslint .            # Lint
```

## Firebase

Project: `gamerapp-37e70`

```bash
cd firebase-backend/functions
npm run deploy          # Deploy Cloud Functions
```

## Requirements

- Node.js 18+
- Expo CLI
- Firebase CLI (for backend deployment)
- Xcode (iOS) / Android Studio (Android)

## Branding

**App Name**: Vibe (formerly SnapStyle)  
**Package**: com.snapstyle.app
