# Profile System

Last verified: 2026-02-24

This is the canonical source of truth for SnapStyle profile architecture, cosmetic ownership, equip flows, and profile/chat rendering.

## 1) Overview

The Profile system includes:
- profile identity and visuals (PFP, decoration, profile background, theme)
- featured badges/master badges
- chat appearance (bubble color, font, animal)
- progression surfaces (XP/level, level rewards)
- tokens/wallet and cosmetic ownership plumbing

Separation of concerns (non-negotiable):
- Customization Hub is equip-only
- Cosmetics Shop is purchase-only

## 2) Architecture

Primary client files:
- Navigation: `src/navigation/RootNavigator.tsx`, `src/types/navigation/root.ts`
- Profile screens: `src/screens/profile/OwnProfileScreen.tsx`, `src/screens/profile/UserProfileScreen.tsx`
- Customization: `src/screens/customization/CustomizationHubScreen.tsx`, `src/hooks/useCustomizationHub.ts`
- Shop: `src/screens/shop/CosmeticsShopScreen.tsx`, `src/hooks/useCosmeticsShop.ts`
- Profile writes: `src/services/profileService.ts`
- Ownership reads: `src/services/entitlements.ts`
- Hydration/contract checks: `src/services/profile/profileContract.ts`
- Catalog/assets: `src/cosmetics/catalog.ts`, `src/cosmetics/assetRegistry.ts`, `src/cosmetics/chatCatalog.ts`, `src/cosmetics/themeRegistry.ts`

Primary backend files:
- purchases and grants: `firebase-backend/functions/src/cosmeticEntitlements.ts`
- XP/level rewards: `firebase-backend/functions/src/games.ts`
- achievements rewards: `firebase-backend/functions/src/achievementsV2Evaluator.ts`
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
- `chatAppearance.bubbleColorId`
- `chatAppearance.fontId`
- `chatAppearance.animalThemeId`
- `gameXp`
- `gameLevel`
- `gameLevelXp`
- `gameXpToNextLevel`
- `claimedLevels`
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

### 3.5 Achievements and badges
Active v2 achievements paths:
- `users/{uid}/achievements/{achievementId}`
- `users/{uid}/achievementSummary/summary`

Legacy badge path still active:
- `Users/{uid}/Badges/{badgeId}`

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
- `source`: acquisition route (`free`, `starter`, `shop`, `achievement`, `milestone`, etc.)
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
- achievement/master-badge grants: backend + service flows write entitlement docs
- level milestone background rewards: `claimLevelReward` now writes background entitlement docs for milestone levels with configured background rewards

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

## 7) Rendering Pipeline

### 7.1 Profile screen header
Files:
- `OwnProfileHeader.tsx`
- `UserProfileHeader.tsx`
- `ProfileHeaderVisual.tsx`

Rules:
- background image is resolved by equipped background ID
- background is clipped to header region (from top through level bar)
- area below header falls back to theme/page background color
- decoration overlays render on top of PFP via `ProfilePictureWithDecoration`

### 7.2 Play header profile card
Files:
- `src/components/games/EnhancedGamesProfileHeader.tsx`
- `src/hooks/usePlayerSummary.ts`

Displays:
- display name + XP bar
- wallet token chip(s)
- summary of equipped profile cosmetics sourced from live profile state

### 7.3 Chat rendering
Files:
- `src/cosmetics/chatAppearanceResolver.ts`
- backend sender-style stamping: `firebase-backend/functions/src/messaging.ts`

Rules:
- outgoing bubble/font resolved from equipped chatAppearance IDs
- sender style is stamped onto message payload for recipient rendering
- animal send path validates entitlement and equipped state

## 8) Navigation Map

Routes relevant to profile system:
- Profile tab stack:
  - `ProfileMain`
  - `Customization`
  - `Wallet`
  - `LevelRewards`
- Play stack:
  - `Achievements`
  - `LevelRewards`
- Root stack:
  - `Customization`
  - `CosmeticsShop`
  - `UserProfile`
  - `SetStatus`

Deep-link behaviors fixed:
- achievement toast opens `Play -> Achievements` and can pass `targetAchievementId`
- customization route supports `initialTab` + `initialSection`

## 9) Level Rewards

Catalog:
- `src/data/levelRewards.ts` (levels 1-50)

Claim API:
- callable `claimLevelReward` in `firebase-backend/functions/src/games.ts`

Idempotency:
- `Users/{uid}.claimedLevels` is the source of truth

Reward behavior:
- non-milestones: token reward
- milestones: larger token reward
- configured milestone background levels also grant entitlement docs (`source: "milestone"`)

## 10) Cookbook: Add New Cosmetic Type or Equipped Slot

### 10.1 New cosmetic type checklist
1. Define/extend type in `src/cosmetics/types.ts`.
2. Add catalog entries in the canonical source (`catalog.ts` or generated registry module).
3. Add asset mapping in `assetRegistry.ts` if image-backed.
4. Add shop pricing entry in `shared/cosmetics/shopPricingTable.json` if purchasable.
5. Ensure backend purchase validation recognizes the new type.
6. Add entitlement grant paths (achievement/milestone/admin) as needed.
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
6. Render slot in profile and any secondary surfaces (play header/chat/etc.).
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

### Level reward claimed but cosmetic missing
- verify level is a configured milestone background level in `games.ts` map
- verify entitlement doc was written to `Users/{uid}/Entitlements/{backgroundId}`

### Achievement toast opens wrong destination
- verify toast uses root route `Play` with nested `Achievements` params
- verify `targetAchievementId` exists in achievements catalog

### Slow/missing image loads
- verify static `require(...)` mapping in `assetRegistry.ts`
- verify source image actually exists in assets path

## 12) Validation Commands

Run after profile-system changes:
1. `npm run type-check`
2. `npm run lint`
3. `npm run build` (from `firebase-backend/functions`)
