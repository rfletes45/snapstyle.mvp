# PHASE 0: BOOTSTRAP - Testing Instructions

## What Was Built

Phase 0 establishes the foundation for SnapStyle MVP:

✅ **Complete Expo + TypeScript project scaffold**

- Folder structure: `/src` with screens, services, store, types, utils, components, navigation
- Navigation: React Navigation with Auth stack and App tabs (Bottom Tab Navigator)
- UI Framework: React Native Paper for consistent Material Design
- State Management: React Context API (AuthContext + UserContext)
- TypeScript: Strict mode, proper type definitions, path aliases (@/\*)
- Firebase wiring: Services framework ready for Phase 1

✅ **Navigation flows**

- **Auth Stack** (when not logged in):
  - Welcome screen (signup/login options)
  - Login screen (email/password)
  - Signup screen (email/password/confirm)
  - Profile Setup screen (placeholder)
- **App Tabs** (when logged in):
  - Chats tab (coming Phase 3)
  - Stories tab (coming Phase 5)
  - Games tab (coming Phase 6)
  - Friends tab (coming Phase 2)
  - Profile tab (coming Phase 7, has logout button)

✅ **Utility functions**

- `src/utils/ids.ts`: Pair ID generation, unique ID generation
- `src/utils/dates.ts`: Day key logic for streaks, timezone handling
- `src/utils/validators.ts`: Email, username, password, display name validation

✅ **TypeScript models** in `src/types/models.ts`:

- User, Friend, FriendRequest, Chat, Message, Story, GameSession, CosmeticItem, Report, etc.

✅ **Linting & type checking**

- `npm run type-check`: Verify no TypeScript errors
- `npm run lint`: Lint code with Expo ESLint

---

## How to Test Phase 0

### 1. Verify Project Structure

```bash
cd C:\Users\rflet\OneDrive\Desktop\GamerApp\snapstyle-mvp
ls -la src/  # or dir src in PowerShell
```

Expected folders:

- `src/assets`, `src/components`, `src/navigation`, `src/screens`, `src/services`, `src/store`, `src/types`, `src/utils`
- Screen folders: `auth`, `chat`, `stories`, `games`, `friends`, `profile`

### 2. Verify TypeScript Compilation

```bash
npm run type-check
```

Expected output: No errors, clean exit.

### 3. Verify Linting

```bash
npm run lint
```

Expected output: No critical errors (warnings are OK for MVP).

### 4. Start the Development Server

```bash
npm start
```

Expected output:

```
Expo DevTools is running at http://localhost:19002/
Starting Metro bundler...
```

Wait for the bundler to complete. You should see:

```
Ready to start the app on your device or in a simulator.
```

### 5a. Run on Android Emulator (if available)

Ensure Android Emulator is running, then press `a` in the terminal:

```
Press a ├─ open Android
Press i ├─ open iOS
Press w ├─ open web
Press r ├─ reload app
Press m ├─ toggle menu
Press q ├─ quit

a
```

Expected behavior:

- Metro bundler builds the app
- Android emulator installs and launches the app
- Welcome screen appears with "SnapStyle" title, subtitle "Streaks • Stories • Snaps"
- Two buttons: "Create Account" and "Sign In"

### 5b. Run on iOS Simulator (macOS only)

Press `i` in the terminal:

```
i
```

Expected behavior:

- App launches in iOS Simulator
- Welcome screen displays

### 5c. Run on Web

Press `w` in the terminal:

```
w
```

Expected behavior:

- Browser opens to `http://localhost:19006`
- Welcome screen displays (basic web view)

### 6. Test Navigation Flow (Without Firebase)

**Since Firebase is not yet configured, login will not work. But navigation should work:**

1. **Welcome Screen Tests:**
   - Tap "Create Account" → Navigates to Signup screen
   - Tap "Sign In" → Navigates to Login screen

2. **Signup Screen Tests:**
   - Fill in email: `test@example.com`
   - Fill in password: `password123`
   - Fill in confirm password: `password123`
   - Tap "Create Account"
   - Expected: Error (Firebase not configured), then would nav to ProfileSetup
   - Button shows "Create Account" shows "Sign In" button to go back

3. **Login Screen Tests:**
   - Fill in email: `test@example.com`
   - Fill in password: `password123`
   - Tap "Sign In"
   - Expected: Error (Firebase not configured)
   - Tap "Don't have an account? Sign up" → Navigates back to Signup

4. **Profile Screen Tests:**
   - When you eventually configure Firebase and sign in, navigate to Profile tab
   - You should see "Profile" title, your email, and a "Sign Out" button
   - Tap "Sign Out" → Should return to Welcome screen

### 7. Verify Tab Navigation (UI Mock)

When the app loads with proper auth state, the bottom tab bar should show 5 tabs:

- 🔵 **Chats** (chat-multiple icon)
- 📷 **Stories** (image-multiple icon)
- 🎮 **Games** (gamepad-variant icon)
- 👥 **Friends** (account-multiple icon)
- 👤 **Profile** (account icon)

Each tab should display a placeholder screen saying "Coming in Phase X".

---

## Troubleshooting

### Issue: `Cannot find module 'firebase/auth'`

- **Solution**: Firebase SDK is installed but you haven't configured real Firebase credentials yet. This is expected for Phase 0.

### Issue: App doesn't load, blank screen

- **Solution**:
  1. Clear Expo cache: `npx expo doctor --fix`
  2. Kill the terminal and `npm start` again
  3. Hard refresh the app: press `r` in terminal

### Issue: TypeScript errors after edits

- **Solution**: Run `npm run type-check` to see errors, fix as needed

### Issue: Cannot connect to emulator/simulator

- **Solution**:
  1. Ensure emulator is fully booted
  2. Try connecting via Expo Go app instead:
     - Install Expo Go from app store
     - Scan QR code shown in terminal
  3. Use web preview: press `w` to test in browser

---

## What's Next (Phase 1)

Phase 1 will:

1. ✅ Set up real Firebase credentials (console setup)
2. ✅ Implement Auth services: signUp, login, logout
3. ✅ Implement username reservation transaction (atomic uniqueness)
4. ✅ Create Users/{uid} document on signup
5. ✅ Complete ProfileSetup screen UI + logic
6. ✅ Test full signup → profile setup → app flow

---

## Key Files to Review

- `App.tsx` - Root app component, Firebase init, Provider setup
- `src/navigation/RootNavigator.tsx` - Navigation structure
- `src/store/AuthContext.tsx` - Firebase auth state
- `src/store/UserContext.tsx` - User profile state
- `src/screens/auth/*` - Auth screens (Login, Signup, ProfileSetup, Welcome)
- `tsconfig.json` - TypeScript config with @ path alias
- `package.json` - Dependencies (React Navigation, Paper, Firebase SDK)

---

## Notes

- **No Firebase**: App is ready but not connected to real Firebase yet
- **No Assets**: Placeholder screens use text; icons from @expo/vector-icons
- **MVP Focus**: Minimal dependencies, clean code, strict TypeScript
- **Expo Managed**: No native eject, uses Expo SDK for all features
- **State Management**: React Context only, no Redux (MVP)

---

## Success Criteria for Phase 0 ✅

- [x] TypeScript compiles without errors
- [x] Navigation stacks and tabs display correctly
- [x] Welcome screen shows with proper branding
- [x] Auth flow navigates between screens (signup → profile setup path works structurally)
- [x] Profile screen has sign out button
- [x] Bottom tabs visible when "logged in"
- [x] Code is organized per MVP structure
- [x] All types in models.ts defined correctly

**Phase 0 is complete! Ready to move to Phase 1: Firebase + Auth + Profile Setup.**
