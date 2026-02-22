# Current Profile System Guide

Snapshot date: 2026-02-21

This document is a complete, standalone technical reference for the current profile system implementation.
It is intended to let an external AI reason about the system and propose safe changes without needing any other document.

---

## 1) System Scope and Runtime Entry Points

The profile system spans these main areas:

- Profile data model and defaults in `src/types/userProfile.ts` and `src/services/profile/profileContract.ts`.
- Profile data/service operations in `src/services/profileService.ts`.
- Auth/profile hydration and route gating in `src/components/AppGate.tsx` and `src/store/UserContext.tsx`.
- Profile screens in `src/screens/profile/`.
- Privacy settings UI in `src/screens/settings/PrivacySettingsScreen.tsx`.
- Social/relationship/moderation services in:
  - `src/services/friends.ts`
  - `src/services/blocking.ts`
  - `src/services/reporting.ts`
- Cosmetic ownership and equip behavior in:
  - `src/services/entitlements.ts`
  - `src/cosmetics/catalog.ts`
  - `src/cosmetics/assetRegistry.ts`
  - `src/cosmetics/themeRegistry.ts`
  - `src/data/avatarDecorations.ts`
- Firestore and Storage access rules in:
  - `firebase-backend/firestore.rules`
  - `firebase-backend/storage.rules`

---

## 2) Active Navigation and App Gating

### 2.1 Active profile routes

Navigation wiring is in `src/navigation/RootNavigator.tsx` and types in `src/types/navigation/root.ts`.

Active profile-related routes are:

- Tab stack route: `ProfileMain` -> `OwnProfileScreen`
- Root stack route: `UserProfile` -> `UserProfileScreen`
- Root stack route: `SetStatus` -> `SetStatusScreen`
- Root stack route: `MutualFriendsList` -> `MutualFriendsListScreen`

### 2.2 Legacy profile route status

- `src/screens/profile/ProfileScreen.tsx` still exists but is not used by the active profile tab stack.
- A separate type file `src/types/navigation/profile.ts` defines an older profile route model and is not the active root navigation contract.

### 2.3 Hydration and profile setup gate

`src/components/AppGate.tsx` drives startup state with:

- `loading`
- `unauthenticated`
- `needs_profile`
- `banned`
- `ready`

Routing behavior:

- `ready` -> `MainStack`
- `needs_profile` -> `ProfileSetup` flow
- otherwise -> auth stack

Profile completeness check:

- User is considered complete only when `profile.username` exists.

Profile hydration source:

- `src/store/UserContext.tsx` reads `Users/{uid}` once authenticated and exposes `profile`, `isHydrated`, and `refreshProfile()`.

---

## 3) Canonical Profile Data Contract

Primary type: `UserProfileData` in `src/types/userProfile.ts`.
Hydration/validation contract: `src/services/profile/profileContract.ts`.

### 3.1 Main document path

- Firestore: `Users/{uid}`

### 3.2 Core fields currently used

`UserProfileData` includes:

- Identity:
  - `uid`
  - `username`
  - `usernameLower`
  - `displayName`
- Avatar/profile visuals:
  - `avatarConfig` (legacy fallback avatar)
  - `profilePicture` (`url`, optional `thumbnailUrl`, `updatedAt`)
  - `avatarDecoration` (`decorationId`, optional `equippedAt`)
  - `equippedBackgroundId`
- Rich profile:
  - `bio`
  - `status`
  - `gameScores`
  - `theme`
  - `featuredBadges`
  - `privacy`
- Ownership arrays (legacy/back-compat):
  - `ownedDecorations`
  - `ownedThemes`
- Metadata:
  - `createdAt`
  - `lastActive`
  - `lastProfileUpdate`
  - optional `profileViews`
  - optional `expoPushToken`

### 3.3 Defaulting and hydration

`hydrateProfileData(userId, source)` in `profileContract.ts` does all default merges.

Important defaults:

- `profilePicture.url` defaults to `null`
- `bio.text` defaults to empty string
- `gameScores.enabled` defaults to `false`
- `gameScores.displayedGames` defaults to `[]`
- `theme.equippedThemeId` defaults to `"default"`
- `ownedThemes` defaults to `["default"]`
- `equippedBackgroundId` defaults to `null`
- `privacy` defaults to `DEFAULT_PRIVACY_SETTINGS`

### 3.4 Validation constraints in profileContract

- `validateDisplayName`: 1-50 chars after trim
- `validateBioText`: max 200 chars after trim
- `validateStatusInput`: max 50 chars + valid mood
- `validateAvatarConfig`: object with valid `baseColor` and optional string fields
- `validateFullPrivacySettings`: requires all visibility and boolean privacy fields to be correctly typed

### 3.5 Privacy model

Privacy type: `ProfilePrivacySettings` in `src/types/userProfile.ts`.

Includes:

- Visibility enums (`everyone`, `friends`, `nobody`) for:
  - profile visibility and profile sections
  - activity visibility
  - contact permissions
- Boolean toggles for:
  - mutual friends
  - friend count
  - search/suggestions/sharing
  - profile view tracking

Defaults are in `DEFAULT_PRIVACY_SETTINGS`.
Presets are in `PRIVACY_PRESETS` (`public`, `friendsOnly`, `private`).

### 3.6 Privacy filtering helper

`applyPrivacyFilters(profile, relationship)` exists in `src/types/userProfile.ts` and is designed to return a filtered `Partial<UserProfileData>`.

Key behavior:

- `self` gets full profile
- blocked relationships get minimal profile
- other relationships are filtered field-by-field via `canViewWithPrivacy`

Important current state:

- This helper is not used in the active `UserProfileScreen` data path.

---

## 4) Firestore and Storage Schema (Profile-Relevant)

### 4.1 Core profile doc

- `Users/{uid}`

Rules (from `firebase-backend/firestore.rules`):

- Any authenticated user can read user docs.
- Owner can create/update own doc.
- Update applies validators for selected profile fields (bio/status/privacy/avatarDecoration/theme/featuredBadges).

### 4.2 Profile-related subcollections under `Users/{uid}`

- `blockedUsers/{blockedUid}`
  - owner read/write
  - blocked target can read their specific block doc
- `Badges/{badgeId}`
  - auth read
  - owner create/update for display fields
- `OwnedDecorations/{decorationId}`
  - owner read/create
  - immutable after create
- `OwnedThemes/{themeId}`
  - owner read/create
  - immutable after create
- `Entitlements/{cosmeticId}`
  - auth read
  - owner create only for free/starter sources
  - immutable
- `mutedUsers/{mutedUid}`
  - owner read/create/update/delete

### 4.3 Global collections used by profile features

- `Usernames/{usernameLower}` for username reservation
- `FriendRequests/{requestId}`
- `Friends/{friendId}`
- `Reports/{reportId}` via `src/services/reporting.ts`
- `UserReports/{reportId}` via internal (currently unused) report functions in `profileService.ts`

### 4.4 Storage paths for profile pictures

`firebase-backend/storage.rules` allows:

- Path: `/users/{userId}/profile/{filename}`
- Read: any authenticated user
- Write: owner only
- Type: image MIME only (`jpeg/png/gif/webp`)
- Size limit: 5MB

`uploadProfilePicture()` in `profileService.ts` writes:

- `users/{uid}/profile/picture.jpg`
- `users/{uid}/profile/picture_thumb.jpg`

---

## 5) Service Layer Responsibilities

Main service: `src/services/profileService.ts`

### 5.1 Exported profile APIs (actively usable)

Reads/subscriptions:

- `getFullProfileData(userId)`
- `subscribeToProfile(userId, callback)`

Relationship/social context:

- `getRelationship(currentUserId, targetUserId)`
- `getFriendshipDetailsForUser(currentUserId, friendUserId)`
- `getMutualFriends(currentUserId, targetUserId)`

Core profile writes:

- `updateDisplayName(userId, displayName)`
- `updateAvatarConfig(userId, avatarConfig)`
- `updateBio(userId, text)`
- `setStatus(userId, text, mood, expiresIn?)`
- `clearStatus(userId)`

Profile picture:

- `uploadProfilePicture(userId, imageUri)`
- `removeProfilePicture(userId)`

Game score config:

- `updateGameScoresConfig(userId, config)`
- `getGameScoresConfig(userId)`

Decoration/theme operations:

- `equipDecoration(userId, decorationId)`
- `unequipDecoration(userId)`
- `grantDecoration(userId, decorationId, obtainedVia)`
- `equipTheme(userId, themeId)`
- `grantTheme(userId, themeId, obtainedVia)`

Sharing:

- `generateProfileShare(userId)`

Moderation/profile analytics:

- `muteUser(currentUserId, targetUserId, duration?)`
- `unmuteUser(currentUserId, targetUserId)`
- `isUserMuted(currentUserId, targetUserId)`
- `incrementProfileViews(userId)`

Privacy:

- `updateFullPrivacySettings(userId, settings)`

### 5.2 Internal functions currently not exported/used

Present but currently not referenced elsewhere in the repo:

- `updatePrivacySettings`
- `updateFeaturedBadges`
- `shareProfile`
- `submitUserReport`
- `getMyReports`
- `muteUserExtended`
- `getMuteConfig`
- `getMutedUsers`
- `getProfileDataForViewer`
- `applyPrivacyPreset`

These functions include logic that is not currently part of the active UI path.

### 5.3 Ownership resolution strategy in equip flows

`equipDecoration` and `equipTheme` check ownership in this order:

1. Entitlements (`Users/{uid}/Entitlements/{cosmeticId}`)
2. Unified cosmetics catalog source is `free` or `starter`
3. Legacy arrays on user doc (`ownedDecorations`, `ownedThemes`)

Decoration flow also attempts legacy free-item auto-grant from `src/data/avatarDecorations.ts`.

---

## 6) Supporting Services Used by Profile Flows

### 6.1 User setup and username reservation

`src/services/users.ts`:

- `setupNewUser`:
  - checks username availability
  - creates `Users/{uid}` base document
  - reserves `Usernames/{usernameLower}`
  - attempts starter cosmetic grant via legacy cosmetics service

Called by `src/screens/auth/ProfileSetupScreen.tsx`.

### 6.2 Friends and relationship actions

`src/services/friends.ts` provides:

- send/cancel/accept/decline friend requests
- list friends and pending requests
- remove friend

`UserProfileScreen` uses these APIs for action buttons.

### 6.3 Blocking

`src/services/blocking.ts`:

- block writes to `Users/{currentUser}/blockedUsers/{target}`
- attempts friendship removal
- cancels pending friend requests in both directions

### 6.4 Reporting

`src/services/reporting.ts` writes reports to `Reports` collection.

Note: this differs from internal report functions in `profileService.ts`, which target `UserReports`.

### 6.5 Entitlements

`src/services/entitlements.ts` is the canonical ownership model:

- path: `Users/{uid}/Entitlements/{cosmeticId}`
- includes back-compat writes to legacy arrays/subcollections for decorations/themes

---

## 7) Hooks and Data Composition

### 7.1 `useFullProfileData`

File: `src/hooks/useFullProfileData.ts`

- source of full `UserProfileData`
- supports optional realtime subscription
- used by status/privacy/profile screens

### 7.2 `useProfilePicture`

File: `src/hooks/useProfilePicture.ts`

- reads/writes `profilePicture`, `avatarDecoration`, and `ownedDecorations`
- wraps upload/remove/equip/unequip operations

### 7.3 `useGameScores`

File: `src/hooks/useGameScores.ts`

- merges single-player high scores from `getAllHighScores`
- loads persisted display config from user doc
- persists config changes
- also provides `useScoreComparison` for owner vs viewer score comparison

### 7.4 `useProfileData`

File: `src/hooks/useProfileData.ts`

- composes base profile from `UserContext` + badge stats/cache
- computes extended profile stats/level
- not a full replacement for `useFullProfileData`

### 7.5 Own profile screen uses multiple hooks at once

`OwnProfileScreen` pulls overlapping profile data from:

- `useProfileData`
- `useFullProfileData`
- `useProfilePicture`
- `useGameScores`

This is functionally valid but increases coordination complexity and data overlap.

---

## 8) Screen-Level Behavior

### 8.1 `OwnProfileScreen`

File: `src/screens/profile/OwnProfileScreen.tsx`

Main features:

- editable profile header (picture, decoration, name via settings, bio, status)
- game scores panel with editor modal
- featured badges section
- friends preview strip
- stats block and action grid
- sign out action

Edit paths:

- Picture upload/remove via `ProfilePictureEditor` -> `uploadProfilePicture/removeProfilePicture`
- Decoration equip via `DecorationPickerModal` -> `equipDecoration/unequipDecoration`
- Bio update via `ProfileBioEditor` -> `updateBio`
- Status via `SetStatus` route -> `setStatus/clearStatus`
- Scores via `GameScoresEditor` -> `updateGameScoresConfig`

### 8.2 `UserProfileScreen`

File: `src/screens/profile/UserProfileScreen.tsx`

Load sequence (parallel):

- `getFullProfileData(targetUserId)`
- `getRelationship(currentUserId, targetUserId)`
- `getMutualFriends(currentUserId, targetUserId)`
- `isUserMuted(currentUserId, targetUserId)`

Conditional follow-up:

- if relationship is `friend`, load `getFriendshipDetailsForUser`

Non-critical async:

- `incrementProfileViews(targetUserId)` if viewing non-self

Actions wired:

- friend request lifecycle (send/cancel/accept/decline/remove)
- message/call navigation
- block/unblock
- report submit
- mute/unmute
- share profile

### 8.3 `SetStatusScreen`

File: `src/screens/profile/SetStatusScreen.tsx`

- edits mood + status text + optional expiry
- reads current status from `useFullProfileData`
- writes via `setStatus` and `clearStatus`

### 8.4 `MutualFriendsListScreen`

File: `src/screens/profile/MutualFriendsListScreen.tsx`

- loads mutual friends via `getMutualFriends`
- supports local search/filter
- pushes into `UserProfile` on selection

### 8.5 Legacy profile screen

`src/screens/profile/ProfileScreen.tsx` is still present but not part of the active Profile tab route.

---

## 9) Component-Level Behavior

### 9.1 Header components

Files:

- `src/components/profile/ProfileHeader/OwnProfileHeader.tsx`
- `src/components/profile/ProfileHeader/UserProfileHeader.tsx`

Both headers:

- support background rendering from cosmetics asset registry
- render profile picture + decoration
- show bio/status content

### 9.2 Picture + decoration rendering

Core files:

- `ProfilePictureWithDecoration.tsx`
- `DecorationOverlay.tsx`
- `ProfilePictureEditor.tsx`
- `DecorationPickerModal.tsx`
- `DecorationPicker.tsx`

Important rendering details:

- decoration scale constant: `DECORATION_SCALE = 1.55`
- `DecorationOverlay` resolution order:
  - legacy decoration dataset (`src/data/avatarDecorations.ts`)
  - unified cosmetics asset registry (`src/cosmetics/assetRegistry.ts`)

### 9.3 Scores

Files:

- `GameScoresDisplay.tsx`
- `GameScoresEditor.tsx`
- `ScoreComparisonView.tsx`

Behavior:

- own profile: editable display config
- other user (friend): comparison mode
- other user (non-friend): plain score list if allowed

### 9.4 Sharing

Files:

- `ShareProfileButton.tsx`
- `ShareProfileModal.tsx`
- `QRCodeModal.tsx`

Notes:

- Uses `generateProfileShare` from profile service.
- QR modal currently renders a placeholder QR-like component, not a real encoded QR bitmap.

### 9.5 Moderation options UI

Two separate MoreOptionsMenu implementations exist:

- `src/components/profile/ProfileActions/MoreOptionsMenu.tsx` (used by `UserProfileScreen`)
- `src/components/profile/ProfileModeration/MoreOptionsMenu.tsx` (alternate implementation)

This is duplicate UI surface area and can drift.

---

## 10) End-to-End Flow Reference

### 10.1 New user setup flow

1. User authenticates.
2. `AppGate` sees authenticated user with missing `profile.username`.
3. App routes to `ProfileSetup`.
4. `ProfileSetupScreen` validates username/display name and calls `setupNewUser`.
5. `setupNewUser` creates base user doc + reserves username + starter grants.
6. `UserContext.refreshProfile()` hydrates profile.
7. `AppGate` transitions to `ready` and app enters main navigation.

### 10.2 Own profile load/edit flow

1. Profile tab opens `OwnProfileScreen` (`ProfileMain`).
2. Screen composes data from profile hooks.
3. User edits picture/bio/status/scores/decorations.
4. Writes go to `Users/{uid}` and, for images, Storage path under `/users/{uid}/profile/`.
5. UI refreshes from hooks and optionally subscriptions.

### 10.3 View another user flow

1. Navigate to `UserProfile` with `userId`.
2. Screen loads full profile + relationship + mutual friends + mute status.
3. If friend, additional friendship details are loaded.
4. Non-self view triggers fire-and-forget `incrementProfileViews`.
5. Action buttons and menus expose social/moderation features based on relationship type.

---

## 11) Current Privacy Enforcement Reality

This is the most important behavioral area to understand before making changes.

### 11.1 Designed privacy enforcement path

Designed helper path:

- `applyPrivacyFilters(profile, relationship)` in `src/types/userProfile.ts`
- internal `getProfileDataForViewer()` in `src/services/profileService.ts`

### 11.2 Actual active path in `UserProfileScreen`

Active screen does **not** call filtered profile APIs. It calls `getFullProfileData` directly and then applies only partial UI checks.

Observed checks in UI:

- Last active hidden only when `showLastActive === "nobody"`
- Game scores hidden only when `showGameScores === "nobody"`
- Mutual friends based on boolean `showMutualFriends`
- Share button based on `allowProfileSharing`

Not fully enforced at screen boundary:

- `showProfilePicture`
- `showBio`
- `showStatus`
- full `friends` vs `everyone` privacy distinctions for several fields

### 11.3 Security implication

Because Firestore user docs are broadly readable by authenticated users (`allow read: if isAuth()`), strict privacy currently depends on client-side filtering discipline.

Current profile view path is not consistently enforcing that discipline.

---

## 12) Known Inconsistencies and Risk Points

### 12.1 Route mismatch in profile game score taps

`OwnProfileScreen` and `UserProfileScreen` call:

- `navigation.navigate("Games", { gameId })`

But the active navigation contract exposes `Play` stack and `GamesHub` / game-specific routes, not a `Games` route.

### 12.2 Theme default ID mismatch

Profile defaults/hydration use `"default"` theme ID (`profileContract.ts`, `userProfile.ts`, `profileService.ts` fallback arrays), but canonical app theme IDs come from `constants/theme.ts` (for example `catppuccin-latte`, `catppuccin-mocha`).

No canonical theme metadata entry with id `"default"` exists.

### 12.3 Game score config default mismatch

- `DEFAULT_USER_PROFILE_DATA.gameScores.enabled` is `false`.
- `useGameScores.DEFAULT_CONFIG.enabled` is `true`.
- `useGameScores.loadSavedConfig` only adopts saved config when `displayedGames.length > 0`.

Result:

- a persisted config with `enabled: false` and empty `displayedGames` may not be respected as intended by the hook.

### 12.4 Rule/client validation mismatch for status length

- client contract validator limits status text to 50 chars (`validateStatusInput`)
- Firestore rule `validStatus` allows up to 60 chars

### 12.5 Rule/client schema mismatch for privacy fields

`validPrivacySettings` in rules validates only a subset of privacy fields compared to the full `ProfilePrivacySettings` contract used by client validators.

### 12.6 Duplicate report collection paths in implementation

- Active reporting service writes to `Reports`.
- Internal (unused) profile report functions write to `UserReports`.

Also in Firestore rules, `Reports` appears in more than one section, increasing audit complexity.

### 12.7 Dead/internal service code in `profileService.ts`

There are multiple implemented but unreferenced internal functions (listed in section 5.2), which increases maintenance surface and can mislead automated refactors.

### 12.8 Mutual friend retrieval can silently degrade

`getMutualFriends()` catches failures from `getFriends(targetUserId)` and returns empty target list fallback, which can produce empty mutual results due to permission constraints around `Friends` reads.

### 12.9 Duplicate moderation menu components

Two separate `MoreOptionsMenu` implementations exist under profile component directories; only one is currently used by `UserProfileScreen`.

### 12.10 Unused profile gallery service namespace

`src/services/profile/snapGalleryService.ts` appears unreferenced by imports in active code paths.

---

## 13) Test Coverage Status

### 13.1 Existing tests relevant to profile contract/privacy

- `__tests__/services/profileContract.test.ts`
  - hydration defaults
  - validators (display name, bio, status, full privacy settings)
- `__tests__/services/profilePrivacyFilters.test.ts`
  - behavior of `applyPrivacyFilters` for self/friend/stranger/blocked

### 13.2 Gaps

No direct tests currently validate:

- active `UserProfileScreen` privacy enforcement behavior against relationship matrix
- route validity for `navigation.navigate("Games", ...)` calls in profile screens
- consistency between hook score-config defaults and persisted disabled/empty config cases
- end-to-end alignment between profile service filtering and rendered profile data

---

## 14) Practical Change-Safety Checklist

Use this when proposing or implementing profile changes.

### 14.1 If changing profile privacy behavior

- Centralize viewer-facing profile reads through one filtered API boundary.
- Ensure all `ProfilePrivacySettings` fields are enforced at render/use sites.
- Add tests for self/friend/stranger/blocked across bio/status/picture/scores/badges/lastActive.

### 14.2 If changing profile navigation

- Verify route names against `src/types/navigation/root.ts`.
- Remove or migrate stale route strings in profile screens.
- Keep `OwnProfileScreen` as tab entry unless intentionally replacing `ProfileMain`.

### 14.3 If changing themes/cosmetics

- Resolve `"default"` theme ID strategy (either add real default theme id mapping or migrate defaults to canonical theme IDs).
- Keep entitlements as canonical ownership source.
- Preserve back-compat writes only while legacy consumers remain.

### 14.4 If changing score display

- Align defaults across:
  - `DEFAULT_USER_PROFILE_DATA`
  - `profileContract` hydration
  - `useGameScores.DEFAULT_CONFIG`
- Handle persisted `enabled=false` even when displayed list is empty.

### 14.5 If changing moderation/reporting

- Decide on one canonical report collection (`Reports` vs `UserReports`) and delete or migrate the other path.
- Consolidate duplicate MoreOptions menu components to one source.

### 14.6 If changing rules/contracts

- Keep client validators and Firestore validators consistent (especially status length and privacy field set).
- Confirm read/write rules for all profile-related subcollections after changes.

---

## 15) High-Level System Summary

Current profile architecture is functional and feature-rich, with strong componentization and broad capabilities (picture/decorations, status, scores, social actions, moderation, sharing). The major technical risk is privacy enforcement inconsistency between intended helper-based filtering and current screen-level full-profile reads. The second largest risk is contract drift (route names, theme defaults, score defaults, report collection divergence).

If external AI suggestions focus first on privacy boundary unification, route/type alignment, and default-contract consistency, the profile system becomes significantly safer to evolve.
