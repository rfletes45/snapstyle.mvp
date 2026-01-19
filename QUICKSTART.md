# SnapStyle MVP - Quick Start Guide

## Phase 0 Complete ✅

The SnapStyle MVP project is now bootstrapped and ready to run!

### Quick Commands

```bash
# Install dependencies (already done)
npm install

# Type check
npm run type-check

# Lint code
npm run lint

# Start dev server
npm start

# Run on Android
npm run android

# Run on iOS (macOS only)
npm run ios

# Run on web
npm run web
```

### Directory Structure

```
snapstyle-mvp/
├── src/
│   ├── assets/              # Images, icons, fonts
│   ├── components/          # Reusable UI components
│   ├── navigation/          # Navigation structure (RootNavigator)
│   ├── screens/
│   │   ├── auth/           # Login, Signup, ProfileSetup, Welcome
│   │   ├── chat/           # Chat screens
│   │   ├── stories/        # Stories screens
│   │   ├── games/          # Games screens
│   │   ├── friends/        # Friends screens
│   │   └── profile/        # Profile screens
│   ├── services/           # Firebase services (currently placeholder)
│   ├── store/              # React Context (AuthContext, UserContext)
│   ├── types/              # TypeScript models (User, Friend, Message, etc.)
│   └── utils/              # Helpers (ids, dates, validators)
├── firebase/               # Cloud Functions (deploy later)
├── App.tsx                 # Root component
├── app.config.ts           # Expo config
├── tsconfig.json           # TypeScript config
├── package.json            # Dependencies
└── README.md               # Project documentation

```

### What's Working Right Now

✅ Full navigation structure (Auth stack + App tabs)  
✅ Welcome, Login, Signup, Profile screens  
✅ Bottom tab navigation  
✅ TypeScript strict mode, proper types  
✅ React Native Paper UI  
✅ React Context for state management  
✅ Utility functions (ID generation, date formatting, validators)

### What's Not Working Yet

❌ Firebase (Phase 1)  
❌ Authentication (Phase 1)  
❌ Username uniqueness (Phase 1)  
❌ Friends system (Phase 2)  
❌ Chat (Phase 3)  
❌ Photo snaps (Phase 4)  
❌ Stories (Phase 5)  
❌ Notifications & Streaks (Phase 6)  
❌ Cosmetics & Awards (Phase 7)  
❌ Safety features (Phase 8)

### Next Steps

1. **Test Phase 0** - Follow [TESTING_PHASE_0.md](./TESTING_PHASE_0.md)
2. **Phase 1: Firebase + Auth + Profile** - Will implement real authentication and profile setup

### Tech Stack Used

| Layer                | Technology                                      |
| -------------------- | ----------------------------------------------- |
| **Mobile Framework** | React Native + Expo                             |
| **Language**         | TypeScript (strict)                             |
| **Navigation**       | React Navigation                                |
| **UI**               | React Native Paper                              |
| **State**            | React Context API                               |
| **Backend**          | Firebase (Auth, Firestore, Storage) _(Phase 1)_ |
| **Functions**        | Firebase Cloud Functions _(Phase 6+)_           |
| **Notifications**    | Expo Push Notifications _(Phase 6)_             |

### Firebase Setup (For Phase 1)

When ready for Phase 1, you'll need to:

1. Create a Firebase project at [firebase.google.com](https://firebase.google.com)
2. Enable:
   - Authentication (Email/Password)
   - Firestore Database
   - Cloud Storage
   - Cloud Functions
3. Create `src/services/firebaseConfig.local.ts` with your credentials
4. Deploy Firestore rules and Cloud Functions

### Notes

- **Expo Go**: Can test on phone without building native code
- **Strict TypeScript**: All code is type-safe; catch bugs early
- **Minimal Dependencies**: Only essential packages (Paper, Firebase, Navigation)
- **Modular Code**: Each screen, service, and utility is isolated
- **MVP Focus**: No AR filters, video, paid IAP, or multiplayer games

---

**Status: Phase 0 Bootstrap Complete 🎉**  
**Ready for: Phase 1 - Firebase + Auth + Profile Setup**
