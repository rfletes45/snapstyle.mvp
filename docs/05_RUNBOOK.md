# Developer Runbook

> Setup, commands, troubleshooting, and deployment procedures

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npx expo start

# 3. Run on device/simulator
# Press 'i' for iOS, 'a' for Android, 'w' for Web
```

---

## Environment Setup

### Prerequisites

| Tool           | Version | Notes                     |
| -------------- | ------- | ------------------------- |
| Node.js        | 18+     | LTS recommended           |
| npm            | 9+      | Comes with Node           |
| Expo CLI       | Latest  | `npm i -g expo-cli`       |
| Firebase CLI   | Latest  | `npm i -g firebase-tools` |
| Xcode          | 15+     | iOS development           |
| Android Studio | Latest  | Android development       |

### Firebase Configuration

1. Firebase project: `gamerapp-37e70`
2. Config files already in repo:
   - `app.json` — Contains Firebase keys
   - `firebase.json` — Hosting/emulator config

### EAS Build (Production)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build iOS
eas build --platform ios

# Build Android
eas build --platform android
```

---

## Common Commands

### Development

```bash
# Start dev server
npx expo start

# Start with cache cleared
npx expo start --clear

# Start for web only
npx expo start --web

# TypeScript check
npx tsc --noEmit

# Lint
npx eslint .

# Lint with fix
npx eslint . --fix
```

### Firebase

```bash
# Login to Firebase
firebase login

# Deploy functions
cd firebase-backend/functions
npm run deploy

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy storage rules
firebase deploy --only storage

# Deploy indexes
firebase deploy --only firestore:indexes

# View function logs
firebase functions:log

# View specific function logs
firebase functions:log --only sendMessageV2
```

### Testing

```bash
# Check for TypeScript errors
npx tsc --noEmit

# Run linter
npx eslint .

# Test build (production)
eas build --profile preview --platform ios
```

---

## Project Structure Summary

```
snapstyle-mvp/
├── App.tsx                 # Entry point
├── src/
│   ├── components/         # Reusable UI
│   ├── screens/            # Screen components
│   ├── navigation/         # React Navigation config
│   ├── services/           # Firebase/API calls
│   ├── hooks/              # Custom React hooks
│   ├── store/              # Zustand stores
│   ├── types/              # TypeScript definitions
│   ├── utils/              # Pure utility functions
│   └── data/               # Static data (cosmetics)
├── firebase-backend/
│   └── functions/
│       └── src/            # Cloud Functions code
├── assets/                 # Images, fonts
├── constants/              # Theme, feature flags
└── docs/                   # This documentation
```

---

## Firebase Cloud Functions

### Deployment

```bash
cd firebase-backend/functions
npm install
npm run build
npm run deploy
```

### Function Categories

| Category      | Functions                                     | Purpose            |
| ------------- | --------------------------------------------- | ------------------ |
| Messaging     | sendMessageV2, editMessageV2, deleteMessageV2 | Chat operations    |
| Reactions     | toggleReactionV2                              | Emoji reactions    |
| Groups        | createGroup, updateGroupV2, manageGroupMember | Group management   |
| Notifications | onMessageCreated (trigger)                    | Push notifications |
| Moderation    | blockUser, unblockUser                        | User blocking      |
| Scheduled     | dailyStreakReset                              | Cron jobs          |

### Testing Locally

```bash
# Start emulator (if configured)
firebase emulators:start

# Point app to emulator
# Set USE_EMULATOR=true in constants
```

---

## Troubleshooting

### Build Issues

**"Cannot find module" errors**

```bash
rm -rf node_modules
rm package-lock.json
npm install
```

**Metro bundler stuck**

```bash
npx expo start --clear
```

**iOS build fails**

```bash
cd ios
pod deintegrate
pod install
cd ..
npx expo run:ios
```

**Android build fails**

```bash
cd android
./gradlew clean
cd ..
npx expo run:android
```

### Runtime Issues

**White screen on launch**

- Check console for errors
- Verify Firebase config
- Check ErrorBoundary caught error

**Auth not working**

- Verify GoogleService files
- Check Firebase Auth enabled
- Verify OAuth credentials

**Messages not sending**

```bash
# Check outbox
AsyncStorage.getItem("@snapstyle/message_outbox_v2")

# Check function logs
firebase functions:log --only sendMessageV2
```

### Unified Messaging Debugging

**Enable debug logging**

```typescript
// In constants/featureFlags.ts
export const DEBUG_UNIFIED_MESSAGING = true;
export const DEBUG_CHAT_V2 = true;

// Console outputs:
// [messaging/subscribe] Subscribed to dm:xxxxx
// [messaging/send] Sending message via unified service
// [groupAdapter] Converting GroupMessage to MessageV2
```

**Messages not appearing (DM)**

- Check `useChat` hook is initialized with correct `conversationId`
- Verify subscription: look for `[messaging/subscribe]` logs
- Check `displayMessages` array in React DevTools
- Verify `scope: "dm"` is passed correctly

**Messages not appearing (Group)**

- Check GroupAdapter is converting messages correctly
- Look for `[groupAdapter]` console logs
- Verify `subscribeToGroupMessages` is called
- Check member array includes current user

**Outbox messages stuck in "sending"**

```typescript
// Get current outbox state
import { getOutboxItems } from "@/services/outbox";
const items = await getOutboxItems("conversationId");
console.log(items);

// Retry stuck messages
import { retryFailedMessage } from "@/services/chatV2";
await retryFailedMessage("messageId");
```

**useChat hook not updating**

- Check `conversationId` is not empty string
- Verify `currentUserId` is valid
- Check hook dependencies aren't causing re-subscriptions

**Reply state not clearing**

- Verify `clearReplyOnSend: true` is passed to `sendMessage`
- Check `unifiedChat.clearReplyTo()` is being called
- Check for multiple hook instances (should be single per screen)

**Delete-for-me not working**

- Check Firestore rules allow `hiddenFor` arrayUnion operation
- Verify user UID is being passed to subscription for filtering
- Check `subscribeToGroupMessages` includes `currentUid` parameter
- Firestore rule must handle both new field and existing field cases

**Delete-for-all not working (only local)**

- Check Cloud Function `deleteMessageForAllV2` logs
- Verify `deletedForAll` field is being returned in message subscription
- Check `renderMessage` handles `deletedForAll` field to show placeholder
- Confirm scope is "group" for group messages, "dm" for DM messages

**Push notifications not arriving**

- iOS: Check APNs cert in Firebase Console
- Android: Check FCM key
- Check user has notification token saved
- Check user notification settings

### Keyboard / Composer Issues

**Composer not following keyboard**

- Ensure `KeyboardProvider` wraps app in `App.tsx`
- Check `react-native-keyboard-controller` is installed
- iOS: Verify pod install completed successfully
- Android: Check Reanimated babel plugin in `babel.config.js`

**Jumpy keyboard animation**

- Never use `KeyboardAvoidingView` - use our keyboard hooks
- Enable debug: set `DEBUG_CHAT_KEYBOARD = true` in `constants/featureFlags.ts`
- Check console logs for `[ChatKeyboard]` entries

**Messages auto-scroll unexpectedly**

- User must be within 200px of bottom for auto-scroll
- If >30 messages behind, shows "Return to bottom" pill instead
- Check `useNewMessageAutoscroll` threshold values

**Interactive dismiss not working**

- Only works on iOS (Android lacks native support)
- Ensure `keyboardDismissMode="interactive"` on FlatList
- Check `simultaneousHandlers` if using gesture handlers

**Debug keyboard behavior**

```typescript
// In constants/featureFlags.ts
export const DEBUG_CHAT_KEYBOARD = true;

// Then check console for:
// [ChatKeyboard] height=XXX progress=X.XX isOpen=true/false
```

### Firebase Issues

**Permission denied errors**

- Check Firestore rules
- Verify user authentication
- Check document path matches rule

**Function timeout**

- Check Cloud Function logs
- Verify no infinite loops
- Check external API response time

**Index required error**

- Create composite index in console
- Or use provided index definitions

---

## Deployment Checklist

### Before Release

- [ ] TypeScript passes: `npx tsc --noEmit`
- [ ] Lint passes: `npx eslint .`
- [ ] Test all critical flows
- [ ] Update version in app.json
- [ ] Deploy Cloud Functions first
- [ ] Test on physical device

### App Store (iOS)

1. Bump version in `app.json`
2. Run `eas build --platform ios --profile production`
3. Submit via `eas submit --platform ios`
4. Complete App Store Connect review

### Play Store (Android)

1. Bump version in `app.json`
2. Run `eas build --platform android --profile production`
3. Submit via `eas submit --platform android`
4. Complete Play Console review

---

## Environment Variables

### app.json Keys

```json
{
  "extra": {
    "firebaseApiKey": "...",
    "firebaseAuthDomain": "...",
    "firebaseProjectId": "gamerapp-37e70",
    "firebaseStorageBucket": "...",
    "firebaseMessagingSenderId": "...",
    "firebaseAppId": "..."
  }
}
```

### Feature Flags

Location: `constants/featureFlags.ts`

```typescript
export const FEATURE_FLAGS = {
  ENABLE_VOICE_MESSAGES: true,
  ENABLE_REACTIONS: true,
  ENABLE_LINK_PREVIEWS: true,
  // ...
};
```

---

## Debugging Tips

### React Native Debugger

1. Enable Debug mode in Expo
2. Open React Native Debugger
3. Inspect state, network, etc.

### Firebase Debug

```javascript
// Enable verbose logging
firebase.setLogLevel("debug");
```

### Network Debugging

Use Flipper or Charles Proxy to inspect requests.

### Crash Reporting

- Errors caught by ErrorBoundary
- Uncaught errors logged to console
- Consider adding Sentry/Crashlytics for production

---

## Code Style

### TypeScript

- Strict mode enabled
- No `any` unless absolutely necessary
- Prefer interfaces over types for objects
- Use enums sparingly (prefer union types)

### Components

- Functional components only
- Use hooks for state/effects
- Destructure props
- Memoize expensive computations

### Naming

- Components: PascalCase
- Hooks: camelCase with `use` prefix
- Services: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Types/Interfaces: PascalCase

---

## Useful Scripts

### Check Streak Data

```bash
node scripts/check-streak.js <userId>
```

### Debug All Users

```bash
node scripts/debug-all-users.js
```

### Fix Cosmetics

```bash
node scripts/fix-cosmetics.js <userId>
```

---

## Emergency Procedures

### Disable Feature Quickly

1. Update feature flag in `constants/featureFlags.ts`
2. Push and rebuild (fast track via EAS)

### Disable Local Storage (Rollback to Server-Only)

If local storage causes issues:

```typescript
// constants/featureFlags.ts
export const USE_LOCAL_STORAGE = false; // Set to false for server-only mode
```

### Rollback Cloud Functions

```bash
firebase functions:delete <functionName>
# Then redeploy previous version
```

### Database Emergency

1. Firebase Console → Firestore
2. Can manually edit/delete documents
3. Export data first if major change

### Local SQLite Database Issues

**Debug Screen Access:**
Settings → Developer → Local Storage Debug

**Common Issues:**

| Issue                   | Solution                                             |
| ----------------------- | ---------------------------------------------------- |
| Messages not showing    | Check sync status in Debug screen                    |
| Duplicate messages      | Run "Clear Pending Messages" maintenance             |
| Database locked error   | Restart app (kills all DB connections)               |
| Out of sync with server | Use "Force Full Sync" in Debug screen                |
| Corrupt database        | Clear app data (Settings → Apps → Vibe → Clear Data) |

**Maintenance Actions (Debug Screen):**

- **Clear All Data**: Wipes local database completely
- **Clear Media Cache**: Frees storage by removing cached images
- **Clear Pending Messages**: Removes stuck messages from sync queue
- **Vacuum Database**: Reclaims storage and optimizes performance

---

## Contact & Resources

- **Firebase Console**: https://console.firebase.google.com/project/gamerapp-37e70
- **Expo Dashboard**: https://expo.dev
- **EAS Build**: https://expo.dev/accounts/[account]/projects/snapstyle-mvp/builds
