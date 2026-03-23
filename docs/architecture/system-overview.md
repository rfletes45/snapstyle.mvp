# System Overview

Last verified: 2026-03-18

## Scope

SnapStyle is an Expo/React Native app backed by Firebase.

Primary runtime surfaces:

- app shell: `App.tsx`
- client code: `src/`
- backend functions: `firebase-backend/functions/src/`
- security rules and indexes: `firebase-backend/firestore.rules`, `firebase-backend/firestore.indexes.json`, `firebase-backend/storage.rules`

## Bootstrap And Provider Order

Startup sequence in `App.tsx`:

1. initialize Firebase before app render
2. lock orientation
3. load fonts and shell assets
4. mount providers in this order:
   - `ThemeProvider`
   - `SnackbarProvider`
   - `AuthProvider`
   - `UserProvider`
   - `CallProvider`
   - `InAppNotificationsProvider`
   - `CameraProvider`
5. hand control to `RootNavigator`

`RootNavigator` chooses between auth flow, profile setup flow, and the main app.

## Navigation Topology

Core files:

- `src/navigation/RootNavigator.tsx`
- `src/types/navigation/root.ts`

Important routes for the messaging ecosystem:

- `ChatList`
- `ChatDetail`
- `GroupChat`
- `Thread`
- game and call overlays that can be reached from chats

## Data Authority

The app has three important authority planes:

1. client read/cache plane
   - Firebase SDK reads
   - SQLite cache for native messaging
   - local optimistic UI state
2. backend authoritative plane
   - Cloud Functions for canonical messaging writes, moderation-sensitive flows, and notification routing
3. rules/storage plane
   - Firestore and Storage rules define client trust boundaries

## Messaging And Notification Strategy

Messaging is hybrid, but not symmetric:

- native is local-first by default through SQLite plus `syncEngine`
- web still uses the Firestore-first fallback path
- `useChat` now disables the inactive Firestore-first hook on native, so one conversation screen has one active message owner at a time
- `useChat` also owns native auto-read watermark writes, so screen-level DM/group read side effects should not fork that logic again

Notifications are unified:

- backend chooses `in_app`, `push`, or `none` in `notificationCenter.ts`
- canonical notification records live under `Users/{uid}/Notifications`
- session presence for notification suppression lives under `Users/{uid}/NotificationSessions`
- client chat-notification consumers must preserve `conversationScope` instead of collapsing DM and group state onto a bare conversation ID

## High-Value Source Files

- app shell: `App.tsx`
- navigation: `src/navigation/RootNavigator.tsx`
- feature flags: `constants/featureFlags.ts`
- messaging contracts: `src/types/messaging.ts`
- messaging runtime:
  - `src/hooks/useChat.ts`
  - `src/hooks/useLocalMessages.ts`
  - `src/hooks/useUnifiedMessages.ts`
  - `src/services/sync/syncEngine.ts`
- notification runtime:
  - `src/store/InAppNotificationsContext.tsx`
  - `src/services/userNotifications.ts`
  - `firebase-backend/functions/src/notificationCenter.ts`

## Critical Invariants

1. Firebase must be initialized before any service uses `get*Instance()`.
2. Route names in `RootNavigator.tsx` and `src/types/navigation/root.ts` must stay aligned.
3. Native messaging screens must not mount duplicate message runtimes.
4. Canonical message writes stay server-authoritative.
5. Canonical notification routing stays in the backend notification center, not in ad hoc client logic.

## Change-Safety Checklist

1. If you modify messaging ownership, test both native local-first and web fallback behavior.
2. If you change notification behavior, update both backend routing logic and client session consumers.
3. If you add a new chat- or game-driven notification type, route it through `notificationCenter.ts`.
4. If you change route names, update both type definitions and navigation wiring.
