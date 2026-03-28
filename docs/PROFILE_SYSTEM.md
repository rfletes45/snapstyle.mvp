# Profile System — Cosmetics, Ownership & Equip Flows

> **⚠️ SCOPE NOTICE (2026-03-27):** This document covers **cosmetic ownership, equip flows, and rendering**. It does NOT cover the Widget Board, profile hero card size variants, or social widgets. For the full Profile system documentation, start at **[docs/profile/PROFILE_SYSTEM_OVERVIEW.md](profile/PROFILE_SYSTEM_OVERVIEW.md)**.

Last verified: 2026-03-27 (scope narrowed; cosmetics/equip content confirmed current)

## 1) Overview

This document covers the cosmetic and ownership layer of the Profile system:

- profile identity and visuals (PFP, decoration, profile background, theme)
- featured badges/master badges
- chat appearance (bubble color, font, animal)
- tokens/wallet and cosmetic ownership plumbing
- granular privacy controls (23 fields across visibility and boolean toggles)

For these topics, see the new canonical profile docs at `docs/profile/`:

- **Widget board architecture** → [WIDGET_BOARD_ARCHITECTURE.md](profile/WIDGET_BOARD_ARCHITECTURE.md)
- **Profile hero card & size variants** → [PROFILE_HERO_CARD.md](profile/PROFILE_HERO_CARD.md)
- **Widget inventory & reference** → [PROFILE_WIDGETS_REFERENCE.md](profile/PROFILE_WIDGETS_REFERENCE.md)
- **Edit/customize mode & interactions** → [INTERACTIONS_AND_EDIT_MODE.md](profile/INTERACTIONS_AND_EDIT_MODE.md)
- **Widget data sources & persistence** → [DATA_AND_PERSISTENCE.md](profile/DATA_AND_PERSISTENCE.md)
- **Social & streak widgets** → [SOCIAL_WIDGETS_AND_STREAKS.md](profile/SOCIAL_WIDGETS_AND_STREAKS.md)

Separation of concerns (non-negotiable):

- Customization Hub is equip-only
- Cosmetics Shop is purchase-only

## 2) Architecture

Primary client files (cosmetics/ownership scope):

- Navigation: `src/navigation/RootNavigator.tsx`, `src/types/navigation/root.ts`
- Profile screens: `src/screens/profile/OwnProfileScreen.tsx`, `src/screens/profile/UserProfileScreen.tsx`
- Profile sub-screens: `src/screens/profile/BadgeCollectionScreen.tsx`, `src/screens/profile/ProfileAchievementsScreen.tsx`
- Overview cards: `src/components/profile/OverviewCards/` (OverviewCard, FriendsCard, BadgesCard, AchievementsTrophyCaseCard)
- Profile achievements service: `src/services/profileAchievementsService.ts`
- Social proof (UserProfileScreen only): `src/components/profile/SocialProof/SocialProofSection.tsx`
- Privacy settings: `src/screens/settings/PrivacySettingsScreen.tsx`
- Privacy contract: `src/services/profile/profileContract.ts` (validation + hydration)
- Privacy types: `src/types/userProfile.ts` (`ProfilePrivacySettings`)
- Customization: `src/screens/customization/CustomizationHubScreen.tsx`, `src/hooks/useCustomizationHub.ts`
- Shop: `src/screens/shop/CosmeticsShopScreen.tsx`, `src/hooks/useCosmeticsShop.ts`
- Profile writes: `src/services/profileService.ts`
- Ownership reads: `src/services/entitlements.ts`
- Hydration/contract checks: `src/services/profile/profileContract.ts`
- Catalog/assets: `src/cosmetics/catalog.ts`, `src/cosmetics/assetRegistry.ts`, `src/cosmetics/chatCatalog.ts`, `src/cosmetics/themeRegistry.ts`

> **Widget Board files** are documented separately in [docs/profile/WIDGET_BOARD_ARCHITECTURE.md](profile/WIDGET_BOARD_ARCHITECTURE.md). Key directory: `src/components/profile/WidgetBoard/`.

Primary backend files:

- purchases and grants: `firebase-backend/functions/src/cosmeticEntitlements.ts`
- chat sender style and animal entitlement checks: `firebase-backend/functions/src/messaging.ts`

## 3) Data Model (Exact)

### 3.1 User profile document

Path:

- `Users/{uid}`

Core profile/customization fields:

- `username`
- `usernameLower`
- `displayName`
- `avatarConfig`
- `profilePicture.{url, thumbnailUrl, updatedAt}`
- `avatarDecoration.decorationId`
- `equippedBackgroundId`
- `theme.equippedThemeId`
- `featuredBadges.badgeIds`
- `featuredAchievements.achievementIds`
- `chatAppearance.bubbleColorId`
- `chatAppearance.fontId`
- `chatAppearance.animalThemeId`
- `lastProfileUpdate`

Legacy compatibility fields still in use:

- `ownedDecorations`
- `ownedThemes`
- `cosmeticPoints`

### 3.2 Entitlements ownership

Path:

- `Users/{uid}/Entitlements/{cosmeticId}`

Entitlement doc fields:

- `cosmeticId`
- `type`
- `grantedAt`
- `source`
- `metadata?`

### 3.3 Wallet/tokens

Path:

- `Wallets/{uid}`

Fields:

- `tokensBalance` (canonical)
- `tokens` (legacy/back-compat)
- `totalEarned`
- `totalSpent`

### 3.4 Purchase and transaction history

Paths:

- `Transactions/{transactionId}`
- `Users/{uid}/PurchaseHistory/{transactionId}`

### 3.5 Badges

Legacy badge path still active:

- `Users/{uid}/Badges/{badgeId}`

### 3.6 Featured Achievements (Profile Trophy Case)

Field on user profile document:

- `featuredAchievements.achievementIds` — string[] (max 2, de-duplicated)
- `featuredAchievements.updatedAt` — number

Backward-compatible: optional/nullable, defaults to empty array in hydration.

Achievement source of truth: `Users/{uid}/Achievements` subcollection
(written by Games V4 achievement system, read by profile service).

## 4) Cosmetics Catalog

Canonical catalog:

- `src/cosmetics/catalog.ts`

Asset registry:

- `src/cosmetics/assetRegistry.ts`

Related generated catalogs:

- themes: `src/cosmetics/themeRegistry.ts`
- chat cosmetics: `src/cosmetics/chatCatalog.ts`

Catalog contract:

- `id`: canonical cosmetic ID (must match entitlement doc ID)
- `type`: slot/category (`background`, `decoration`, `badge`, `theme`, chat types)
- `source`: acquisition route (`free`, `starter`, `shop`, `milestone`, etc.)
- `priceTokens`: required for shop items
- `metadata`: value payloads for non-image cosmetics (chat colors/fonts, etc.)

Inventory filtering:

- `getOwnedCosmeticsByType(...)` in `catalog.ts` is the canonical owned-only selector for Customization Hub.

## 5) Ownership / Entitlements

Purchase path:

1. client calls callable `purchaseCosmeticWithTokens`
2. backend validates pricing/ownership
3. backend debits wallet
4. backend writes entitlement doc
5. backend writes transaction/purchase history

Claim path:

- free/starter client claim path: `grantFreeEntitlement(...)` in `src/services/entitlements.ts`
- master-badge grants: backend + service flows write entitlement docs

Owned-only rule:

- Customization Hub renders owned items only (entitled items + free/starter defaults)
- equip attempts validate ownership before writing profile equip fields

## 6) Equip Flow (Customization Hub)

UI entry:

- `src/screens/customization/CustomizationHubScreen.tsx`

Sections:

- Profile section tabs: decoration/background/badge/theme
- Chat section tabs: bubble color/font/animal

Flow:

1. subscribe entitlements (`subscribeEntitlements`)
2. build owned set
3. filter catalog by active tab + search (owned-only)
4. preview locally in header/chat preview
5. equip writes to `Users/{uid}` through profile services

Equip field writes:

- decoration -> `avatarDecoration.decorationId`
- background -> `equippedBackgroundId`
- theme -> `theme.equippedThemeId`
- badges -> `featuredBadges.badgeIds`
- chat bubble -> `chatAppearance.bubbleColorId`
- chat font -> `chatAppearance.fontId`
- chat animal -> `chatAppearance.animalThemeId`

## 7) Profile Overview UI

### 7.1 Layout Structure

## 7) Profile Overview UI

> **⚠️ NOTE:** The own-profile screen now uses a **Widget Board** system. Overview cards (Friends, Badges, Achievements) and the Social Proof streak widget are now rendered as board widgets, not as a fixed layout. See [PROFILE_SYSTEM_OVERVIEW.md](profile/PROFILE_SYSTEM_OVERVIEW.md) for the current architecture. The UserProfileScreen still uses a traditional card layout.

### 7.1 Privacy Model

`ProfilePrivacySettings` (16 fields total):

Visibility fields (`PrivacyVisibility`: "everyone" | "friends" | "nobody"):

- `showProfilePicture`, `showBio`, `showStatus`, `showOnlineStatus`
- `showFriendsList`, `showMutualFriends`, `showBadges`, `showAchievements`
- `showDecorations`, `showChatAppearance`
- `showStreaks`, `showRecentActivity`

Boolean toggles:

- `allowFriendRequests`, `showInSearch`
- `showLastActive`

Presets (public / friendsOnly / private) defined in `src/types/userProfile.ts`.
Validation array: `VISIBILITY_FIELDS` in `src/services/profile/profileContract.ts`.

Privacy evaluation on UserProfileScreen:

- Each card/section derives a `*PrivacyHidden` flag from the setting + viewer relationship
- Pattern: `privacy.showX === "nobody" || (privacy.showX === "friends" && !isFriend)`

## 8) Rendering Pipeline

### 8.1 Profile screen header

Files:

- `OwnProfileHeader.tsx`
- `UserProfileHeader.tsx`
- `ProfileHeaderVisual.tsx`

Rules:

- background image is resolved by equipped background ID
- background is clipped to header region (from top through level bar)
- area below header falls back to theme/page background color
- decoration overlays render on top of PFP via `ProfilePictureWithDecoration`

### 8.2 Chat rendering

Files:

- `src/cosmetics/chatAppearanceResolver.ts`
- backend sender-style stamping: `firebase-backend/functions/src/messaging.ts`

Rules:

- outgoing bubble/font resolved from equipped chatAppearance IDs
- sender style is stamped onto message payload for recipient rendering
- animal send path validates entitlement and equipped state

## 9) Navigation Map

Routes relevant to profile system:

- Profile tab stack:
  - `ProfileMain`
  - `Customization`
  - `Wallet`
  - `BadgeCollection` (params: `{ userId?: string }`)
- Root stack:
  - `Customization`
  - `CosmeticsShop`
  - `UserProfile`
  - `SetStatus`
  - `ProfileAchievements` (params: `{ userId: string; displayName?: string; featuredIds?: string[] }`)

Cross-tab navigation:

- BadgeCollection from UserProfile → `navigate("MainTabs", { screen: "Profile", params: { screen: "BadgeCollection", params: { userId } } })`

Deep-link behaviors fixed:

- customization route supports `initialTab` + `initialSection`

## 10) Cookbook: Add New Cosmetic Type or Equipped Slot

### 10.1 New cosmetic type checklist

1. Define/extend type in `src/cosmetics/types.ts`.
2. Add catalog entries in the canonical source (`catalog.ts` or generated registry module).
3. Add asset mapping in `assetRegistry.ts` if image-backed.
4. Add shop pricing entry in `shared/cosmetics/shopPricingTable.json` if purchasable.
5. Ensure backend purchase validation recognizes the new type.
6. Add entitlement grant paths (milestone/admin) as needed.
7. Add Customization Hub tab/filter UI if user-equipable.
8. Add rendering resolver logic for the target surface(s).
9. Add/extend ownership checks in equip service methods.
10. Update docs in this file and run validation commands.

### 10.2 New equipped slot checklist

1. Add field to `Users/{uid}` profile schema (backward-compatible, optional/null default).
2. Hydrate field in `profileContract.hydrateProfileData()`.
3. Add dev validation checks for catalog/type/asset (if image-backed).
4. Add equip/unequip writer(s) in `profileService.ts`.
5. Wire Customization Hub state and actions for the slot.
6. Render slot in profile and any secondary surfaces (chat/etc.).
7. Add backend validation if slot affects server-authored payloads.
8. Keep existing fields intact; never rename/remove production fields without migration/fallback.

## 11) Troubleshooting

### "You do not own this"

- check `Users/{uid}/Entitlements/{cosmeticId}` exists
- verify item `source` and entitlement type in catalog
- verify free/starter items are correctly marked in catalog

### Equipped ID does not render

- check catalog entry exists for ID
- check type matches slot
- check `assetRegistry` mapping exists for image-backed types
- in dev, inspect `profileContract` warnings in console

### Slow/missing image loads

- verify static `require(...)` mapping in `assetRegistry.ts`
- verify source image actually exists in assets path

### Widget board issues

See [INTERACTIONS_AND_EDIT_MODE.md](profile/INTERACTIONS_AND_EDIT_MODE.md#troubleshooting--gotchas) for widget board troubleshooting.

## 12) Validation Commands

Run after profile-system changes:

1. `npm run type-check`
2. `npm run lint`
3. `npm run build` (from `firebase-backend/functions`)
