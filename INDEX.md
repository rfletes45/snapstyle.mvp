# 📚 SnapStyle MVP - Documentation Index

**Project Status:** Phase 0 Complete ✅  
**Last Updated:** January 18, 2026  
**Framework:** React Native + Expo + TypeScript + Firebase

---

## 🚀 START HERE

### New to the project?

**→ Read [QUICKSTART.md](./QUICKSTART.md)** (5 min read)

- What's built
- How to run the app
- Basic commands

### Want to test Phase 0?

**→ Follow [TESTING_PHASE_0.md](./TESTING_PHASE_0.md)** (20 min test)

- Detailed testing instructions
- All user flows to test
- Troubleshooting tips

### Want the full overview?

**→ Read [PHASE_0_COMPLETION.md](./PHASE_0_COMPLETION.md)** (15 min read)

- Complete project status
- What was built vs. what's not
- Architecture decisions

---

## 📖 Documentation by Topic

### Project Overview

- [README.md](./README.md) - Full project info
- [QUICKSTART.md](./QUICKSTART.md) - Get started quickly
- [PHASE_0_COMPLETION.md](./PHASE_0_COMPLETION.md) - Phase 0 summary

### Phase 0 (Complete)

- [PHASE_0_SUMMARY.md](./PHASE_0_SUMMARY.md) - What was delivered
- [TESTING_PHASE_0.md](./TESTING_PHASE_0.md) - How to test
- [PHASE_0_COMPLETION.md](./PHASE_0_COMPLETION.md) - Success checklist

### Next: Phase 1

- [PHASE_1_PREP.md](./PHASE_1_PREP.md) - Firebase setup checklist
- [(Coming) PHASE_1_IMPLEMENTATION.md] - Phase 1 code walkthrough

### Architecture

- [Project Structure](#project-structure) (below)
- [Technology Stack](#technology-stack) (below)
- [Data Models](#data-models) (below)

---

## 🏗️ Project Structure

```
snapstyle-mvp/
│
├── src/                          # Application source code
│   ├── assets/                   # Images, fonts, icons
│   │   ├── icon.png             # App icon (placeholder)
│   │   ├── splash.png           # Splash screen (placeholder)
│   │   └── favicon.png          # Web favicon (placeholder)
│   │
│   ├── components/               # Reusable UI components (empty for Phase 0)
│   │   # To be filled: buttons, cards, modals, etc.
│   │
│   ├── navigation/               # Navigation configuration
│   │   └── RootNavigator.tsx    # Auth stack + App tabs (COMPLETE)
│   │
│   ├── screens/                  # Screen components
│   │   ├── auth/
│   │   │   ├── WelcomeScreen.tsx         # Logo + signup/signin buttons
│   │   │   ├── LoginScreen.tsx           # Email + password login
│   │   │   ├── SignupScreen.tsx          # Email + password + confirm
│   │   │   └── ProfileSetupScreen.tsx    # Username + display name
│   │   ├── chat/
│   │   │   └── ChatListScreen.tsx        # Placeholder (Phase 3)
│   │   ├── stories/
│   │   │   └── StoriesScreen.tsx         # Placeholder (Phase 5)
│   │   ├── games/
│   │   │   └── GamesScreen.tsx           # Placeholder (Phase 6)
│   │   ├── friends/
│   │   │   └── FriendsScreen.tsx         # Placeholder (Phase 2)
│   │   └── profile/
│   │       └── ProfileScreen.tsx         # Profile + logout (COMPLETE)
│   │
│   ├── services/                 # Business logic & Firebase
│   │   ├── firebase.ts          # Firebase initialization (READY)
│   │   # To be filled in Phase 1+:
│   │   # ├── auth.ts            # Auth functions
│   │   # ├── users.ts           # User CRUD
│   │   # ├── friends.ts         # Friend requests
│   │   # ├── chat.ts            # Messages
│   │   # ├── stories.ts         # Stories
│   │   # ├── games.ts           # Games
│   │   # ├── cosmetics.ts       # Avatar items
│   │   # └── notifications.ts   # Push notifications
│   │
│   ├── store/                    # React Context (State Management)
│   │   ├── AuthContext.tsx       # Firebase auth state (READY)
│   │   └── UserContext.tsx       # User profile state (READY)
│   │
│   ├── types/                    # TypeScript type definitions
│   │   └── models.ts            # All data models (COMPLETE)
│   │       # Includes: User, Friend, FriendRequest, Chat, Message, Story,
│   │       #           GameSession, CosmeticItem, InventoryItem, Report
│   │
│   └── utils/                    # Helper functions
│       ├── ids.ts               # ID generation (COMPLETE)
│       ├── dates.ts             # Date & streak logic (COMPLETE)
│       └── validators.ts        # Input validation (COMPLETE)
│
├── firebase/                     # Cloud Functions (for Phase 6+)
│   ├── functions/
│   │   └── src/
│   │       ├── index.ts         # Function entry point (Phase 6)
│   │       ├── expoPush.ts      # Push notifications (Phase 6)
│   │       ├── streaks.ts       # Streak updates (Phase 6)
│   │       ├── cleanup.ts       # TTL cleanup (Phase 6)
│   │       └── awards.ts        # Cosmetic awards (Phase 7)
│   ├── firestore.rules          # Security rules (Phase 8)
│   ├── storage.rules            # Storage rules (Phase 8)
│   └── firestore.indexes.json   # Firestore indexes (Phase 8)
│
├── App.tsx                       # Root app component (COMPLETE)
├── app.config.ts                 # Expo configuration (COMPLETE)
├── tsconfig.json                 # TypeScript configuration (COMPLETE)
├── .eslintrc.json                # ESLint rules (COMPLETE)
├── .gitignore                    # Git ignore rules (COMPLETE)
├── package.json                  # Dependencies (COMPLETE)
│
└── Documentation/
    ├── README.md                 # Project overview
    ├── QUICKSTART.md             # Quick start guide
    ├── PHASE_0_SUMMARY.md        # Phase 0 details
    ├── PHASE_0_COMPLETION.md     # Phase 0 completion
    ├── TESTING_PHASE_0.md        # Phase 0 testing
    ├── PHASE_1_PREP.md           # Phase 1 preparation
    └── INDEX.md                  # This file
```

---

## 🛠️ Technology Stack

### Mobile & UI

| Layer          | Technology         | Version | Purpose                    |
| -------------- | ------------------ | ------- | -------------------------- |
| **Framework**  | React Native       | 0.81.5  | Native mobile UI           |
| **Packaging**  | Expo               | 54.0    | Managed workflow           |
| **Language**   | TypeScript         | 5.9     | Type-safe code             |
| **Navigation** | React Navigation   | 7.1     | Stack + Tab routing        |
| **UI Library** | React Native Paper | 5.12    | Material Design components |
| **Icons**      | @expo/vector-icons | 15.0    | Material Design icons      |

### State Management

| Tool              | Purpose      | Scope                         |
| ----------------- | ------------ | ----------------------------- |
| **React Context** | Auth state   | Firebase user, loading, error |
| **React Context** | User profile | Current user profile data     |

### Backend (Phase 1+)

| Service             | Purpose             | Status   |
| ------------------- | ------------------- | -------- |
| **Firebase Auth**   | Email/password auth | Phase 1  |
| **Firestore**       | Real-time database  | Phase 2+ |
| **Cloud Storage**   | Photo storage       | Phase 4  |
| **Cloud Functions** | Backend logic       | Phase 6+ |
| **Expo Push**       | Push notifications  | Phase 6  |

### Development Tools

| Tool           | Purpose            |
| -------------- | ------------------ |
| **ESLint**     | Code linting       |
| **TypeScript** | Type checking      |
| **npm**        | Package management |

---

## 📊 Data Models

All types defined in `src/types/models.ts`. Key models:

### User

```typescript
interface User {
  uid: string;
  usernameLower: string; // Lowercase for searching
  username: string; // Display username
  displayName: string; // Full name
  avatarConfig: AvatarConfig; // Avatar customization
  expoPushToken?: string; // For notifications
  createdAt: number; // Timestamp
  lastActive: number; // Last activity
}
```

### Friend Relationship

```typescript
interface Friend {
  id: string; // pairId(uid1, uid2)
  users: [string, string]; // [uid1, uid2]
  createdAt: number;
  streakCount: number; // Current streak
  streakUpdatedDay: string; // "YYYY-MM-DD"
  lastSentDay_uid1?: string; // Last day user1 sent snap
  lastSentDay_uid2?: string; // Last day user2 sent snap
  blockedBy?: string | null; // Who blocked (if any)
}
```

### Message (Chat)

```typescript
interface Message {
  id: string;
  sender: string; // uid
  type: "text" | "image"; // Message type
  content: string; // Text or storage path
  createdAt: number;
  expiresAt: number; // Auto-delete timestamp (24h)
  openedAt?: number; // When opened (for images)
  openedBy?: string; // Who opened
}
```

### Story

```typescript
interface Story {
  id: string;
  authorId: string; // uid
  mediaPath: string; // Storage path
  postedAt: number;
  expiresAt: number; // Auto-delete (24h)
  caption?: string;
}
```

See [src/types/models.ts](./src/types/models.ts) for all 11 models.

---

## 🧮 Utility Functions

### IDs (`src/utils/ids.ts`)

```typescript
pairId(uid1, uid2); // → "uid1_uid2" for friend IDs
generateId(); // → Timestamp-based unique ID
extractPairUids(pairId); // → Extract [uid1, uid2] from pair ID
```

### Dates (`src/utils/dates.ts`)

```typescript
dayKey(timestamp, tz); // → "YYYY-MM-DD" for streak logic
todayKey(tz); // → Today's day key
yesterdayKey(tz); // → Yesterday's day key
isToday(dayStr, tz); // → Check if day is today
isYesterday(dayStr, tz); // → Check if day is yesterday
expiresAt(duration); // → Expiration timestamp
ONE_DAY_MS; // → 86,400,000 ms
```

### Validators (`src/utils/validators.ts`)

```typescript
isValidEmail(email); // → Email regex
isValidUsername(username); // → 3-20 alphanumeric + underscore
isValidPassword(password); // → Min 6 chars
isValidDisplayName(displayName); // → 1-50 chars
```

---

## 🔗 Phase Overview

### Phase 0: Bootstrap ✅ COMPLETE

- Navigation scaffold
- Screen placeholders
- Type definitions
- Utility functions

### Phase 1: Firebase + Auth (Next)

- Real Firebase connection
- Sign up / login / logout
- Username uniqueness check
- User profile creation

### Phase 2: Friends

- Friend search
- Friend requests
- Accept/decline
- Friends list with streaks

### Phase 3: Text Chat

- Message sending
- Message history
- 24h expiry
- Read receipts

### Phase 4: Photo Snaps

- Photo capture
- Upload to Storage
- View once + delete
- 24h auto-delete

### Phase 5: Stories

- Post story photo
- View friends' stories
- View counter
- 24h auto-delete

### Phase 6: Notifications + Streaks

- Push notifications
- Streak counter
- Daily updates
- Streak milestones

### Phase 7: Avatar + Cosmetics

- Avatar customization
- Cosmetic items
- Inventory system
- Milestone rewards

### Phase 8: Safety + Polish

- Report user
- Block user
- Final UI polish
- QA & bug fixes

---

## 📋 Checklist: Phase 0

- [x] Project initialized with Expo + TypeScript
- [x] Folder structure created (src/, firebase/)
- [x] Navigation setup (Auth stack + App tabs)
- [x] All screens created (8 screens total)
- [x] React Context setup (Auth + User)
- [x] Firebase services layer (ready for Phase 1)
- [x] Type definitions (11 models)
- [x] Utility functions (IDs, dates, validators)
- [x] TypeScript strict mode (zero errors)
- [x] ESLint configured
- [x] Dependencies installed
- [x] Documentation written (5 guides)

---

## 🚀 Quick Commands

```bash
# Get Started
npm install              # Install dependencies (already done)
npm start                # Start dev server

# Development
npm run type-check      # Check TypeScript errors
npm run lint            # Lint code
npm run android         # Run on Android emulator
npm run ios             # Run on iOS simulator
npm run web             # Run on web browser

# Later Phases
firebase deploy         # Deploy Cloud Functions
firebase deploy:rules   # Deploy Firestore rules
```

---

## 📞 Common Questions

**Q: How do I run the app?**  
A: `npm start` then press `w` (web), `a` (Android), or scan QR code

**Q: Does it work without Firebase?**  
A: Yes! Navigation & UI work. Authentication needs Phase 1.

**Q: Where's the Firebase config?**  
A: Not yet created. Will be at `src/services/firebaseConfig.local.ts` in Phase 1.

**Q: How do I add new screens?**  
A: Create file in `src/screens/{feature}/`, then add to navigation in `src/navigation/RootNavigator.tsx`

**Q: Can I change the colors?**  
A: Yes! Edit button colors in component files. Snap yellow is `#FFFC00`.

**Q: Is this production-ready?**  
A: Skeleton is solid. Backend (Firebase) needed for real app.

---

## 🎓 Learning Resources

- [React Native Docs](https://reactnative.dev/)
- [Expo Docs](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [React Native Paper](https://callstack.github.io/react-native-paper/)
- [Firebase Docs](https://firebase.google.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## 📞 Support

If you encounter issues:

1. Check [TESTING_PHASE_0.md](./TESTING_PHASE_0.md) troubleshooting section
2. Run `npm run type-check` to find errors
3. Run `npx expo doctor --fix` to fix common issues
4. Check console logs in emulator/browser

---

## 📝 File Navigation Quick Links

| Need         | File                                                                   |
| ------------ | ---------------------------------------------------------------------- |
| App setup    | [App.tsx](./App.tsx)                                                   |
| Navigation   | [src/navigation/RootNavigator.tsx](./src/navigation/RootNavigator.tsx) |
| Auth screens | [src/screens/auth/](./src/screens/auth/)                               |
| Auth state   | [src/store/AuthContext.tsx](./src/store/AuthContext.tsx)               |
| User state   | [src/store/UserContext.tsx](./src/store/UserContext.tsx)               |
| Data types   | [src/types/models.ts](./src/types/models.ts)                           |
| Utilities    | [src/utils/](./src/utils/)                                             |
| Dependencies | [package.json](./package.json)                                         |
| Config       | [app.config.ts](./app.config.ts)                                       |
| TypeScript   | [tsconfig.json](./tsconfig.json)                                       |

---

## 🎉 Next Steps

1. **Test Phase 0** → Follow [TESTING_PHASE_0.md](./TESTING_PHASE_0.md)
2. **Prepare for Phase 1** → Follow [PHASE_1_PREP.md](./PHASE_1_PREP.md)
3. **Set up Firebase** → Firebase console steps (in PHASE_1_PREP.md)
4. **Start Phase 1** → Implement auth when ready

---

**Build Date:** January 18, 2026  
**Status:** Phase 0 Complete ✅  
**Next:** Phase 1 - Firebase Integration 🔥

---

_SnapStyle MVP - Built with ❤️ for iOS, Android, and Web_
