# PHASE 1 PREPARATION CHECKLIST

## Before We Start Phase 1

This checklist ensures you have everything ready for Phase 1: Firebase + Auth + Profile Setup.

---

## Firebase Setup (Manual Steps - Do These Before Phase 1)

### Step 1: Create Firebase Project

- [ ] Go to [firebase.google.com](https://firebase.google.com)
- [ ] Click "Get Started"
- [ ] Create a new project (or use existing):
  - Name: `snapstyle-mvp` (or your choice)
  - Enable Google Analytics (optional)
  - Create project
- [ ] Project should be ready in ~30 seconds

### Step 2: Enable Authentication

- [ ] In Firebase Console, go to **Authentication**
- [ ] Click **"Get Started"** (or **"Sign-in method"**)
- [ ] Select **"Email/Password"**
- [ ] Toggle **"Enable"** → Confirm
- [ ] Save
- [ ] Keep the default: Disable "Email link" and "Passwordless sign-in" (not needed for MVP)

### Step 3: Create Firestore Database

- [ ] Go to **Firestore Database**
- [ ] Click **"Create Database"**
- [ ] Choose:
  - Region: `us-central1` (or closest to you)
  - Start in **"Production mode"** (we'll add rules)
- [ ] Create database
- [ ] Wait for database to initialize (~1 min)

### Step 4: Set Up Cloud Storage

- [ ] Go to **Cloud Storage**
- [ ] Click **"Get Started"**
- [ ] Select location: `us-central1`
- [ ] Keep default settings
- [ ] Create storage

### Step 5: Enable Cloud Functions (for Phase 6+)

- [ ] Go to **Cloud Functions**
- [ ] Click **"Get Started"** or **"Create function"**
- [ ] You'll deploy functions from `firebase/functions/` later
- [ ] For now, just note the region (likely same as Firestore)

### Step 6: Create Firebase Web App Config

- [ ] Go to **Project Settings** (gear icon, top left)
- [ ] Go to **"Your apps"** section
- [ ] Click **"</>""** (web icon) to register web app
- [ ] App nickname: `snapstyle-web` (or any name)
- [ ] Accept terms
- [ ] Click **"Register app"**
- [ ] Copy the config object (looks like):
  ```javascript
  const firebaseConfig = {
    apiKey: "XXXXX",
    authDomain: "snapstyle-mvp.firebaseapp.com",
    projectId: "snapstyle-mvp",
    storageBucket: "snapstyle-mvp.appspot.com",
    messagingSenderId: "XXXXX",
    appId: "XXXXX",
  };
  ```
- [ ] Save this somewhere safe

### Step 7: Set Up Firestore Security Rules

- [ ] In Firestore, go to **"Rules"** tab at top
- [ ] Clear existing rules and paste (Phase 1 will provide starter rules)
- [ ] Click **"Publish"**

---

## Local Project Setup (When Ready for Phase 1)

### Step 1: Create Firebase Config File

- [ ] In `src/services/`, create new file: `firebaseConfig.local.ts`
- [ ] Paste the config from Step 6 above:
  ```typescript
  export const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
  };
  ```
- [ ] Save file

### Step 2: Update App.tsx to Use Local Config

- [ ] Open `App.tsx`
- [ ] Replace hardcoded config with:
  ```typescript
  import { firebaseConfig } from "@/services/firebaseConfig.local";
  ```
- [ ] Remove the inline `firebaseConfig` definition

### Step 3: Verify .gitignore Ignores Local Config

- [ ] Check `.gitignore` includes:
  ```
  firebaseConfig.local.ts
  src/services/firebaseConfig.local.ts
  ```
- [ ] This ensures secrets don't commit

---

## Phase 0 Verification (Run Before Phase 1)

Make sure Phase 0 is still working:

```bash
# Type check
npm run type-check
# Expected: No errors

# Lint
npm run lint
# Expected: No critical errors

# Start dev server
npm start
# Expected: Bundler ready
```

- [ ] Type check passes
- [ ] Linting passes
- [ ] Dev server starts
- [ ] App loads on emulator/simulator/web

---

## Phase 1 Implementation Plan

Phase 1 will add:

1. **Auth Service** (`src/services/auth.ts`):
   - `signUp(email, password)` - Create Firebase user + Firestore doc
   - `login(email, password)` - Sign in
   - `logout()` - Sign out
   - `getCurrentUser()` - Get current user

2. **Users Service** (`src/services/users.ts`):
   - `checkUsernameAvailable(username)` - Check uniqueness in Firestore
   - `reserveUsername(username, uid)` - Atomic transaction
   - `getUserProfile(uid)` - Fetch user doc
   - `createUserProfile(uid, username, displayName)` - Create user doc
   - `updateProfile(uid, displayName, avatarConfig)` - Update user doc

3. **ProfileSetup Screen**:
   - Username input + availability checker
   - Display name input
   - Avatar color picker (base)
   - "Continue" button to finish signup
   - Calls `reserveUsername()` + `createUserProfile()`
   - Auto-navigates to app on success

4. **Firestore Collections** (will auto-create on first write):
   - `Users` - User profiles
   - `Usernames` - Reserved usernames (for uniqueness)

---

## Expected Phase 1 Workflow

```
Welcome Screen
  ↓ (tap "Create Account")
Signup Screen (email + password)
  ↓ (submit)
ProfileSetup Screen (username + display name + avatar)
  ↓ (submit)
→ Username checked for uniqueness (Firebase)
→ User created in Firestore
→ Auto-logged in
→ App Tabs (Chats, Stories, Games, Friends, Profile)
  ↓ (tap "Sign Out")
Welcome Screen
```

---

## What Not To Do Before Phase 1

- ❌ Don't modify screens if you don't need to
- ❌ Don't change navigation structure
- ❌ Don't add new dependencies without checking
- ❌ Don't deploy Cloud Functions yet (Phase 6)
- ❌ Don't create Firestore collections manually (let writes auto-create them)

---

## Questions to Ask Before Starting

1. **Do I have a Firebase project created?** (Step 1-6 above)
2. **Is firebaseConfig.local.ts created with real credentials?** (Local Setup Step 1)
3. **Does `npm run type-check` still pass?** (Phase 0 verification)
4. **Can I run `npm start` without errors?** (Phase 0 verification)

---

## Helpful Links

- [Firebase Console](https://console.firebase.google.com/)
- [Firebase Docs - Web SDK](https://firebase.google.com/docs/web/setup)
- [Firebase Docs - Authentication](https://firebase.google.com/docs/auth)
- [Firebase Docs - Firestore](https://firebase.google.com/docs/firestore)
- [Firebase Docs - Storage](https://firebase.google.com/docs/storage)
- [Expo Firebase Integration](https://docs.expo.dev/guides/using-firebase/)

---

## Ready for Phase 1?

When you have:

- ✅ Firebase project created + configured
- ✅ `firebaseConfig.local.ts` file with credentials
- ✅ Phase 0 still compiles and runs
- ✅ All steps above completed

**You're ready! Let me know and we'll start Phase 1: Firebase + Auth + Profile Setup**

---

## Quick Reference: File Locations

| File                                      | Purpose              | Modify When                     |
| ----------------------------------------- | -------------------- | ------------------------------- |
| `firebaseConfig.local.ts`                 | Firebase credentials | After creating Firebase project |
| `App.tsx`                                 | Import config        | After creating config file      |
| `src/services/firebase.ts`                | Firebase init        | When services need updates      |
| `src/services/auth.ts`                    | Auth functions       | Phase 1 (new file)              |
| `src/services/users.ts`                   | User CRUD            | Phase 1 (new file)              |
| `src/screens/auth/ProfileSetupScreen.tsx` | Profile setup UI     | Phase 1 (implement logic)       |

---

**Phase 0 Complete. Ready for Phase 1!** 🚀
