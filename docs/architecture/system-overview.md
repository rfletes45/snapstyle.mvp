# System Overview

Last verified: 2026-03-30

## Scope

This is the top-level architecture reference for the checked-out workspace. It documents the runtime that exists now, including active integrations, partial migrations, and notable legacy surfaces that still exist in the repo.

Primary code surfaces:

- app shell: `App.tsx`
- client app: `src/`
- Firebase backend: `firebase-backend/functions/src/`
- security/index config: `firebase-backend/firestore.rules`, `firebase-backend/firestore.indexes.json`, `firebase-backend/storage.rules`
- realtime server: `colyseus-server/src/`

## Bootstrap Flow

`App.tsx` performs the following startup sequence:

1. initialize Firebase via `initializeFirebase(firebaseConfig)`
2. lock the app to portrait
3. load fonts with a timeout safety net
4. mount the provider tree
5. render `RootNavigator`, `InAppToast`, `IncomingCallHandler`, and the status bar

Actual provider order:

1. `KeyboardProvider`
2. `ErrorBoundary`
3. `ThemeProvider`
4. `GestureHandlerRootView`
5. `PaperProvider`
6. `SnackbarProvider`
7. `AuthProvider`
8. `UserProvider`
9. `ConversationDisplayModeProvider`
10. `StreamCallProvider`
11. `InAppNotificationsProvider`
12. `CameraProvider`
13. `OutboxProcessorProvider`

Two important consequences:

- Firebase must be initialized before any auth, Firestore, Functions, or Storage helper is used.
- Calling is now owned by `StreamCallProvider`, not the removed legacy `CallProvider`.

## Navigation and App Gating

The main routing logic lives in [RootNavigator.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/navigation/RootNavigator.tsx) and [AppGate.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/components/AppGate.tsx).

Current route families:

- auth flow: `Welcome`, `Login`, `SignupEmail`, `SignupPassword`, `ForgotPassword`
- onboarding/profile setup: `OnboardingUsername`, `OnboardingPhoto`, `OnboardingDisplayStyle`, `OnboardingComplete`
- main tabs: `Messages`, `Calls`, `Profile`
- stack screens layered on top of tabs:
  - chat, groups, threads, scheduled messages, inbox/chat settings
  - friends and user profile surfaces
  - customization, shop, wallet, tasks
  - Games V4 hub, lobby, gameplay, results, leaderboards
  - camera/share flows
  - Stream direct call and voice-channel screens when calling is available

`AppGate` is hydration-safe:

- unauthenticated users stay in the auth flow
- authenticated users only enter onboarding when `profileFetchStatus === "not_found"` or the fetched profile is missing a username
- profile fetch errors do not route to onboarding
- user ban state is checked before entering the main app

## Runtime Domains

| Domain | Primary owner | Source of truth | Status |
| --- | --- | --- | --- |
| Auth/session | `src/store/AuthContext.tsx` | Firebase Auth + custom claims | implemented |
| User bootstrap | `src/store/UserContext.tsx` | `Users/{uid}` with AsyncStorage safety cache | implemented |
| Theme/app appearance | `src/store/ThemeContext.tsx` | AsyncStorage + `Users/{uid}` theme fields | implemented |
| Conversation layout mode | `src/store/ConversationDisplayModeContext.tsx` | AsyncStorage + `Users/{uid}.conversationDisplayMode` | implemented |
| Messaging | `src/hooks/useChat.ts` | native: SQLite + sync engine, web: Firestore fallback | implemented, split runtime |
| Inbox aggregation | backend `Users/{uid}/Inbox/*` + client hooks | backend docs exist, client still defaults to fan-out reads | partial migration |
| Notifications | `notificationCenter.ts` + client notification contexts | `Users/{uid}/Notifications`, sessions, devices | implemented |
| Direct calls / voice channels | Stream Video via `StreamCallProvider` | Stream SDK + Firebase call history/token functions | implemented |
| Profile boards | widget board hooks/components | `Users/{uid}/ProfileLayout/board` | implemented |
| Cosmetics / shop / wallet / tasks | Firestore reads + callable writes | Functions are authoritative for rewards and purchases | implemented |
| Games V4 | `src/gamesV4/*` + Functions + Colyseus | Firebase for lifecycle/results, Colyseus for realtime play | implemented |
| Stories / moments | code exists under `src/screens/stories/*` | not wired into current navigation | dormant / partial |
| Legacy call stack | old Firestore/WebRTC docs and services | not the live runtime | legacy |

## Integration Boundaries

### Firebase

Firebase is the default backend for:

- auth and custom claims
- Firestore app data and subscriptions
- Storage uploads
- callable functions and triggers
- notification persistence
- wallet, tasks, entitlements, purchases, and Games V4 lifecycle

### Stream

Stream owns live media sessions:

- direct ringing calls
- group voice channels
- device registration for native call push delivery
- webhook-driven call history fan-out back into Firestore

### Colyseus

Colyseus is only used for realtime games. Current rooms:

- `knockout_game`
- `sketch_party`
- `pong_game`

Firebase still owns invite/session lifecycle, rewards, PBs, achievements, and final resolution.

## Messaging and Notifications Snapshot

Messaging is intentionally asymmetric:

- native uses the local-first SQLite runtime through [useLocalMessages.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/hooks/useLocalMessages.ts) and the sync engine
- web uses the Firestore-first compatibility path through [useUnifiedMessages.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/hooks/useUnifiedMessages.ts)
- `useChat` ensures only one runtime owns a conversation screen at a time

Notification routing is backend-authoritative:

- producers call into `notifyUser(...)`
- the notification center chooses `in_app`, `push`, or `none`
- canonical notification docs live under `Users/{uid}/Notifications`
- fresh session heartbeats under `Users/{uid}/NotificationSessions` suppress duplicates and wrong-surface alerts

## Profile, Economy, and Appearance Snapshot

Profile now has two live surfaces:

- own profile: editable widget board
- viewer profile: the other user’s saved widget board rendered read-only, plus a synthetic viewer-actions widget

Appearance is split across three settings layers:

- global app theme and theme mode
- per-viewer conversation display mode (`bubbles` or `stacked`)
- chat cosmetics stamped onto outgoing messages

Economy writes stay server-authoritative:

- wallet balance comes from `Wallets/{uid}`
- tasks come from `Tasks` plus `Users/{uid}/TaskProgress`
- purchases and claims go through Cloud Functions

## Known Current-State Rough Edges

- backend inbox aggregation is live, but the client default inbox reader still uses fan-out chat/group reads
- `ThreadScreen` remains a specialized local-first implementation rather than sharing the full `useChat` stack
- stories and moments screens exist in code but are not a current navigation surface
- `src/services/calls/` mostly represents old infrastructure now that Stream powers the live call stack; `callSettingsService` remains active
- call settings include DND scheduling, but time selection UI is still placeholder-only in `CallSettingsScreen`

## High-Value Source Files

- [App.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/App.tsx)
- [RootNavigator.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/navigation/RootNavigator.tsx)
- [AppGate.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/components/AppGate.tsx)
- [AuthContext.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/store/AuthContext.tsx)
- [UserContext.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/store/UserContext.tsx)
- [ThemeContext.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/store/ThemeContext.tsx)
- [ConversationDisplayModeContext.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/store/ConversationDisplayModeContext.tsx)
- [InAppNotificationsContext.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/store/InAppNotificationsContext.tsx)
- [StreamCallContext.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/contexts/StreamCallContext.tsx)
- [notificationCenter.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/notificationCenter.ts)
- [index.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/index.ts)

## Change-Safety Checklist

1. Keep route names and navigation types aligned when adding or renaming screens.
2. Preserve the auth/profile hydration contract; only true `not_found` profiles should enter onboarding.
3. Do not make client-side writes authoritative for messaging, notifications, wallet state, purchases, or rewards.
4. Test both native and web messaging paths when changing shared chat behavior.
5. If you add a new notification type, route it through the shared notification center instead of ad hoc client logic.
