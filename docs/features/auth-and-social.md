# Auth and Social

Last verified: 2026-03-30

## Scope

This doc covers:

- auth bootstrap and session hydration
- onboarding/profile bootstrap
- friend graph and friend requests
- profile relationship state
- contact discovery
- camera/share entry points and story-related status

## Current Status

- auth and profile bootstrap: implemented
- onboarding gating: implemented and hydration-safe
- friends and friend requests: implemented
- contacts discovery: implemented for MVP, but still split between client-side matching and a server callable
- stories and moments: code exists, not a current primary navigation surface

## Main Files

Auth and bootstrap:

- [AuthContext.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/store/AuthContext.tsx)
- [UserContext.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/store/UserContext.tsx)
- [AppGate.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/components/AppGate.tsx)
- [RootNavigator.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/navigation/RootNavigator.tsx)

Social graph and profiles:

- [friends.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/friends.ts)
- [profileService.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/profileService.ts)
- [OwnProfileScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/profile/OwnProfileScreen.tsx)
- [UserProfileScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/profile/UserProfileScreen.tsx)

Contacts:

- [contacts.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/contacts.ts)
- [useContactsDiscovery.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/hooks/useContactsDiscovery.ts)
- `src/hooks/useContactsOnboarding.ts`
- [contacts.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/firebase-backend/functions/src/contacts.ts)

Camera and story-related code:

- `src/screens/camera/*`
- `src/screens/stories/StoriesScreen.tsx`
- `src/screens/stories/StoryViewerScreen.tsx`
- `src/screens/stories/MomentsUnderConstructionScreen.tsx`

## Auth and Session Bootstrap

`AuthContext` owns the Firebase auth listener and session-level side effects:

- listens to `onAuthStateChanged`
- refreshes and stores Firebase custom claims
- registers Expo push tokens
- handles push taps through normalized notification payloads
- initializes and cleans up presence
- refreshes push registration every 7 days when the app returns to the foreground

`UserContext` owns Firestore profile hydration:

- reads `Users/{uid}`
- uses AsyncStorage as a safety cache for existing users
- exposes `profileFetchStatus` to prevent bad routing decisions

Important routing rule:

- only `profileFetchStatus === "not_found"` should send a user into onboarding
- fetch failures stay in an error/loading state instead of pretending the user is new

## Onboarding Flow

Current onboarding screens:

- `OnboardingUsername`
- `OnboardingPhoto`
- `OnboardingDisplayStyle`
- `OnboardingComplete`

The main gate checks:

- auth hydration
- profile hydration
- whether the user is banned
- whether the profile exists and contains required setup data

This is one of the most important safety boundaries in the app because stale or incorrect docs here can mislead future work into routing existing users into onboarding by mistake.

## Friends and Relationship Model

Friend-system storage:

- requests: `FriendRequests`
- friendships: `Friends`
- per-user blocks: `Users/{uid}/blockedUsers`

Core behavior today:

- friend requests are created client-side through Firestore writes
- accepted requests create a `Friends` document
- friend reads filter blocked users where the current rules allow it
- relationship states exposed by profile services include self, friend, pending, blocked, and stranger-style cases

Relationship-sensitive profile actions include:

- add friend / cancel / accept / decline
- message
- mute / unmute
- block / unblock
- report
- share profile

## Profiles and Social Viewing

Profile docs live primarily under [docs/profile/PROFILE_SYSTEM_OVERVIEW.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/profile/PROFILE_SYSTEM_OVERVIEW.md) and [profile-economy.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/features/profile-economy.md), but the social-viewing pieces matter here:

- own profile renders the editable widget board
- viewed profiles render the target user’s board in read-only mode
- viewer actions are injected as a synthetic widget rather than a completely separate layout system
- relationship and privacy checks still shape what data the viewer sees

## Contacts Discovery

Contacts discovery is present and usable, but still intentionally MVP-grade.

Current behavior:

- permission is never auto-requested; the user must explicitly opt in
- client fetches minimal contact fields through `expo-contacts`
- identifiers are normalized locally
- the active client matching path still runs Firestore batched `in` queries in the app
- a callable `matchContacts` also exists in Functions, but the client has not fully switched to it

That means the system is real, but not fully consolidated yet.

## Camera, Stories, and Moments

Camera/share routes are active in navigation:

- `Camera`
- `CameraShare`

Story and moments code exists, but it is not a current primary route family in `RootNavigator`. The right way to describe this subsystem today is:

- camera/share: live
- stories/moments screens and services: code-present
- stories/moments as a first-class live app surface: partial / dormant

## Known Current Rough Edges

- contacts discovery is split between client-side matching and a server callable
- some older social docs still talk about traditional viewed-profile layouts; that is no longer true
- stories and moments code can be mistaken for a fully launched feature if you only browse the screen files without checking navigation

## Recommended Validation

```bash
npm run type-check
npm run lint
npm run test
```
