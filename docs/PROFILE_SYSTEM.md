# Profile System

Last updated: 2026-02-18

## Scope

Profile data is centered in `Users/{uid}` with domain writes routed through `src/services/profileService.ts`. UI surfaces should call profile service methods rather than generic user patch APIs.

## Core Fields And Defaults

Canonical profile type: `src/types/userProfile.ts` (`UserProfileData`).

Default/fallback behavior is enforced by `hydrateProfileData()` in `src/services/profile/profileContract.ts` and used by `getFullProfileData()` + `subscribeToProfile()` in `src/services/profileService.ts`.

Important defaults:

- `profilePicture`: `{ url: null, updatedAt: now }`
- `avatarDecoration`: `{ decorationId: null }`
- `bio`: `{ text: "", updatedAt: now }`
- `theme`: `{ equippedThemeId: "default", updatedAt: now }`
- `featuredBadges`: `{ badgeIds: [], updatedAt: now }`
- `privacy`: `DEFAULT_PRIVACY_SETTINGS`
- `ownedThemes`: `["default"]`

## Privacy And Relationship Matrix

Source of truth: `applyPrivacyFilters()` in `src/types/userProfile.ts`.

- `self`: full profile visible.
- `friend`: visibility controlled by per-field privacy values (`everyone`/`friends`/`nobody`).
- `stranger`: same field-level checks; `friends`-only fields are hidden.
- `blocked_by_you` or `blocked_by_them`: minimal profile only (`uid`, `username`, `displayName`, avatar fallback, timestamps reduced).

## Canonical Write Paths

Primary write service: `src/services/profileService.ts`.

- Display name: `updateDisplayName(userId, displayName)`
- Avatar config: `updateAvatarConfig(userId, avatarConfig)`
- Profile picture: `uploadProfilePicture()`, `removeProfilePicture()`
- Bio: `updateBio()`
- Status: `setStatus()`, `clearStatus()`
- Game score display config: `updateGameScoresConfig()`
- Decorations: `equipDecoration()`, `unequipDecoration()`, `grantDecoration()`
- Themes: `equipTheme()`, `grantTheme()`
- Privacy: `updateFullPrivacySettings()`

Validation helpers live in `src/services/profile/profileContract.ts`:

- `validateDisplayName`
- `validateAvatarConfig`
- `validateBioText`
- `validateStatusInput`
- `validateFullPrivacySettings`

## Firestore Rule Expectations

Rules file: `firebase-backend/firestore.rules` under `match /Users/{uid}`.

Validated profile fields include:

- `displayName` (1-50)
- `bio` shape (`text <= 200`, `updatedAt`)
- `status` shape (`text`, `mood`, `setAt`, nullable)
- `privacy` shape (visibility enums + booleans)
- `avatarDecoration` shape
- `theme` shape
- `featuredBadges` shape (max 5)

Service-level validators are intentionally equal-or-stricter than rule validators to fail fast on client-side bad payloads.

## Tests

Contract tests: `__tests__/services/profileContract.test.ts`

- hydration defaults
- privacy validator enforcement
- display name/bio/status validation behavior
