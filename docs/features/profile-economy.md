# Profile and Economy

Last verified: 2026-02-22

## Scope

This doc covers profile data contracts, privacy and relationship behavior, moderation touchpoints, and the wallet/tasks/shop economy pipeline.

## Profile Data Contract

Primary profile document path:

- `Users/{uid}`

Client contract and hydration:

- `src/services/profile/profileContract.ts`
- `src/services/profileService.ts`

Hydrated profile includes key fields such as:

- Identity/display: `uid`, `username`, `usernameLower`, `displayName`
- Visual identity: `avatarConfig`, `profilePicture`, `avatarDecoration`, `theme`
- Social/profile: `bio`, `status`, `featuredBadges`
- Privacy: `privacy`
- Metadata: `createdAt`, `lastActive`, `lastProfileUpdate`

## Profile Validation and Limits

Client validation (profileContract):

- `displayName`: 1-50 chars
- `bio.text`: <= 200 chars
- `status.text`: <= 50 chars
- privacy visibility fields must be one of: `everyone`, `friends`, `nobody`

Rules in Firestore enforce related constraints; keep client + rules aligned whenever field limits or schema change.

## Privacy Model

Visibility enum:

- `everyone`
- `friends`
- `nobody`

Defaults are defined in:

- `src/types/userProfile.ts` (`DEFAULT_PRIVACY_SETTINGS`)

Privacy controls cover:

- profile visibility
- status/badge visibility
- friends list and mutual friend display
- contact permissions (messages/calls/friend requests)
- discovery toggles (search/sharing/suggestions)

## Relationship and Moderation Flow

Relationship resolution path:

- `getRelationship(...)` in `src/services/profileService.ts`

Possible relationship outcomes include:

- self
- friend
- pending sent/received
- blocked by you
- blocked by them
- stranger

Moderation-adjacent services:

- `src/services/blocking.ts`
- `src/services/reporting.ts`
- `src/services/moderation.ts`

## Profile UI Entry Points

Main screens:

- `src/screens/profile/OwnProfileScreen.tsx`
- `src/screens/profile/UserProfileScreen.tsx`
- `src/screens/profile/BadgeCollectionScreen.tsx`
- `src/screens/settings/PrivacySettingsScreen.tsx`

## Economy Contract

Primary data collections and services:

- Wallet:
  - collection: `Wallets`
  - client: `src/services/economy.ts`
- Transactions:
  - collection: `Transactions`
  - client: `src/services/economy.ts`
- Tasks/rewards:
  - collections: `Tasks`, `Users/{uid}/TaskProgress`
  - client: `src/services/tasks.ts`
- Shop/purchases:
  - collections: `ShopCatalog`, purchase history collections
  - client: `src/services/shop.ts`, `src/services/purchaseHistory.ts`

Server-authoritative write paths:

- `firebase-backend/functions/src/economy.ts`
- `firebase-backend/functions/src/shop.ts`
- `firebase-backend/functions/src/cosmeticEntitlements.ts`
- `firebase-backend/functions/src/iap.ts`

## Feature Flags

Relevant rollout groups in `constants/featureFlags.ts`:

- `PROFILE_V2_FEATURES`

Treat these as runtime gates that may intentionally leave compatibility paths active.

## Critical Invariants

1. Profile schema changes must update client validators and Firestore rules together.
2. `usernameLower` normalization must remain consistent with username changes.
3. Privacy filtering must be applied before exposing non-owner profile data.
4. Economy balance and purchase writes must stay server-authoritative.
5. Client-side convenience writes should not bypass rules/contracts for money-like state.

## Change Checklist

1. For new profile fields:
   - add to `src/types/userProfile.ts`
   - hydrate/validate in `profileContract`
   - support update/read paths in `profileService`
   - update rules/indexes if needed
2. For privacy changes:
   - verify UI behavior in both own-profile and viewed-profile screens
   - verify rules and relationship-based visibility assumptions
3. For economy/shop changes:
   - verify callable contract and server validation
   - verify wallet + transaction consistency in UI subscriptions
4. Update this doc when schema/limits/visibility semantics change.
