# Profile System Audit

Last verified: 2026-02-24  
Status: Phase 1-3 complete (discovery, cleanup, contract fixes).

## 1) Scope and Objective

This audit maps the live Profile system in the SnapStyle client + Firebase backend, then records the cleanup and fixes applied in this pass.

Primary goals completed:
- map UI -> services -> Firestore/functions -> assets
- validate profile/equip/ownership contracts
- remove deprecated and unused profile-related modules
- fix navigation and reward-flow contract gaps without breaking production field names

## 2) Architecture Map (UI -> services -> Firestore/functions -> assets)

```text
UI Surfaces
  Profile tab (ProfileMain)
  Play header profile card (EnhancedGamesProfileHeader)
  Customization Hub (equip-only)
  Cosmetics Shop (purchase-only)
  Achievements + Level Rewards
  Chat bubbles/composer sender style
        |
        v
Hooks / Composition
  useProfileData / useFullProfileData / useProfilePicture
  useCustomizationHub
  useCosmeticsShop
  usePlayerSummary
  useAchievementsV2
        |
        v
Client Services
  profileService.ts (equip writes)
  profile/profileContract.ts (hydration + validation + dev guardrails)
  entitlements.ts (Users/{uid}/Entitlements reads + free/starter grant path)
  levelRewardsService.ts (claim callable + claimedLevels read)
  achievementsV2.ts / masterBadgeClaim.ts / badges.ts
  economy.ts (wallet subscriptions)
        |
        v
Cloud Functions (authoritative server writes)
  cosmeticEntitlements.ts (purchase and grants)
  games.ts (onGameResult, claimLevelReward)
  achievementsV2Evaluator.ts
  messaging.ts (chat senderStyle stamping + animal entitlement enforcement)
        |
        v
Firestore
  Users/{uid}
  Users/{uid}/Entitlements/{cosmeticId}
  Wallets/{uid}
  Transactions/{transactionId}
  users/{uid}/achievements/* (v2)
  Users/{uid}/Badges/* (legacy badge path still active)
  Users/{uid}/PurchaseHistory/*
  Users/{uid}/inventory/* (legacy back-compat)
        |
        v
Asset + Catalog Registry
  src/cosmetics/catalog.ts
  src/cosmetics/assetRegistry.ts
  src/cosmetics/chatCatalog.ts
  src/cosmetics/themeRegistry.ts
```

## 3) Navigation Map

Canonical wiring:
- `src/navigation/RootNavigator.tsx`
- `src/types/navigation/root.ts`

Entry points validated:
1. Profile tab -> `ProfileStack.ProfileMain` -> `OwnProfileScreen`
2. Play header profile card actions -> profile tab routes, wallet, level rewards, shop
3. Achievement unlock toast tap -> now routes to `Play` tab nested `Achievements`
4. Level bar taps:
   - own profile header -> `LevelRewards`
   - play header XP bar -> `LevelRewards`

Route contract updates applied:
- `PlayStackParamList.Achievements` now supports `targetAchievementId`
- `Customization` route params now include `initialSection: "profile" | "chat"` (both profile stack and root stack)

## 4) Data Model (Exact Paths/Fields)

### 4.1 Profile document
Path:
- `Users/{uid}`

Fields actively used by profile/customization:
- identity/media: `username`, `usernameLower`, `displayName`, `profilePicture`, `avatarConfig`
- equipped profile cosmetics:
  - `avatarDecoration.decorationId`
  - `equippedBackgroundId`
  - `theme.equippedThemeId`
  - `featuredBadges.badgeIds`
- equipped chat cosmetics:
  - `chatAppearance.bubbleColorId`
  - `chatAppearance.fontId`
  - `chatAppearance.animalThemeId`
- progression: `gameXp`, `gameLevel`, `gameLevelXp`, `gameXpToNextLevel`
- rewards idempotency: `claimedLevels`
- metadata: `lastProfileUpdate`
- legacy compatibility still present:
  - `ownedDecorations`
  - `ownedThemes`
  - `cosmeticPoints`

Hydration:
- `src/services/profile/profileContract.ts`

### 4.2 Entitlements ownership
Path:
- `Users/{uid}/Entitlements/{cosmeticId}`

Fields:
- `cosmeticId`
- `type` (`badge|background|decoration|theme|chat_bubble_color|chat_font|chat_animal_theme`)
- `grantedAt`
- `source`
- `metadata?`

### 4.3 Wallet / tokens
Path:
- `Wallets/{uid}`

Fields used:
- `tokensBalance` (canonical)
- `tokens` (legacy/back-compat)
- `totalEarned`, `totalSpent`
- `updatedAt` / `lastUpdated`

### 4.4 Purchase + transaction history
Paths:
- `Transactions/{transactionId}`
- `Users/{uid}/PurchaseHistory/{transactionId}`

### 4.5 Achievements V2 (lowercase namespace)
Paths:
- `users/{uid}/achievements/{achievementId}`
- `users/{uid}/achievementSummary/summary`
- `users/{uid}/statsPerGame/{gameType}`
- `users/{uid}/socialGameStats/{docId}`

### 4.6 Legacy badge path still active
Path:
- `Users/{uid}/Badges/{badgeId}`

## 5) Equip + Entitlements Flow

### 5.1 Shop purchase -> entitlement
- Client: `useCosmeticsShop.purchaseItem()` -> callable `purchaseCosmeticWithTokens`
- Server (`cosmeticEntitlements.ts`):
  1. validate catalog/pricing
  2. ensure not already owned
  3. debit wallet
  4. write entitlement (`Users/{uid}/Entitlements/{cosmeticId}`)
  5. write transaction + purchase history
  6. write legacy ownership compatibility docs

### 5.2 Customization Hub equip-only
- Screen: `src/screens/customization/CustomizationHubScreen.tsx`
- Hook: `src/hooks/useCustomizationHub.ts`
- Ownership source: entitlements + free/starter catalog items
- Equip writes (`Users/{uid}`):
  - decoration -> `avatarDecoration.decorationId`
  - background -> `equippedBackgroundId`
  - theme -> `theme.equippedThemeId`
  - badges -> `featuredBadges.badgeIds`
  - chat cosmetics -> `chatAppearance.*`

### 5.3 Level rewards claim
- Client: `levelRewardsService.claimLevelReward(level)`
- Server: `games.ts` callable `claimLevelReward`
- Fixed in this pass:
  - milestone levels with background rewards now grant entitlement docs in `Users/{uid}/Entitlements/{backgroundId}`
  - `claimedLevels` remains idempotency gate

## 6) Rendering Pipeline

### 6.1 Profile headers (own + user)
Files:
- `src/components/profile/ProfileHeader/OwnProfileHeader.tsx`
- `src/components/profile/ProfileHeader/UserProfileHeader.tsx`
- `src/components/profile/ProfileHeaderVisual.tsx`

Behavior:
- background image resolved via `getCosmeticAsset("background", equippedBackgroundId)`
- background is clipped to header region (`overflow: "hidden"`)
- profile picture uses `ProfilePictureWithDecoration` with equipped decoration
- level bar renders at bottom of header

### 6.2 Play header profile card
- `src/components/games/EnhancedGamesProfileHeader.tsx`
- Data hook: `src/hooks/usePlayerSummary.ts`

Fix applied:
- removed placeholder equipped slots
- now maps equipped state from profile fields (`equippedBackgroundId`, first featured badge, extended avatar slots)

### 6.3 Chat appearance rendering
- Resolver: `src/cosmetics/chatAppearanceResolver.ts`
- Message writes stamped with sender style by server in `messaging.ts`
- animal sends validated against entitlement/equipped state in backend

## 7) Deprecated Material Cleanup (Applied)

Removed after repo-wide reference and route checks:
- `src/screens/profile/ProfileScreen.tsx`
  - dead legacy screen, not registered in RootNavigator
- `src/components/profile/LegacyProfileHeader.tsx`
  - only consumed by removed legacy profile screen
- `src/components/customization/CustomizationModal.tsx`
- `src/components/customization/ThemePreview.tsx`
- `src/components/customization/ChatBubblePreview.tsx`
- `src/components/customization/index.ts`
  - unused legacy customization modal stack
- `src/screens/customization/CustomizationHubScreen.tsx.bak`
  - backup artifact committed in source tree
- `src/types/navigation/profile.ts`
  - unused legacy navigation types
- `src/data/profileThemes.ts`
  - duplicate legacy theme list; canonical source is now `constants/theme.ts` -> `cosmetics/themeRegistry.ts`
- `src/cosmetics/consistencyChecks.ts`
  - unused helper module; replaced with active dev checks in profileContract hydration
- `src/components/profile/LegacyProfileActions.tsx`
  - replaced by canonical active component `src/components/profile/ProfileQuickActions.tsx`

Consolidation performed:
- `src/components/profile/index.ts` now exports `ProfileActions` from `ProfileQuickActions` (active canonical own-profile action list)

## 8) Known Issues Found -> Fixes Applied

1. Achievement toast navigation target mismatch
- was: toast routed to Profile stack for `Achievements` (invalid)
- fixed: `GameResultToastManager` now routes to `Play` tab nested `Achievements`

2. Achievement deep-link payload mismatch
- was: toast passed `targetAchievementId`, screen ignored it
- fixed: `AchievementsV2Screen` now:
  - reads `targetAchievementId`
  - switches to matching category tab
  - auto-expands containing section
  - highlights targeted achievement card

3. Customization route param drift
- was: runtime used `initialSection`, navigation types did not
- fixed: root/profile stack `Customization` params now include `initialSection`

4. Level rewards contract gap
- was: milestone background rewards did not grant background entitlements
- fixed: server claim writes entitlement docs for milestone background levels

5. Play header equipped state gap
- was: equipped chip slots hardcoded null placeholders
- fixed: `usePlayerSummary` maps equipped values from live profile fields

6. Missing dev contract guardrails
- fixed: `profileContract.hydrateProfileData()` now emits dev-only warnings when equipped IDs:
  - are missing from catalog
  - have wrong type for slot
  - require assets but have no asset mapping

## 9) Validation Notes

Validation steps run in this pass:
- repo-wide import/route tracing before deletion
- post-deletion reference sweeps for removed modules
- navigation contract checks on root/profile/play stack params

Recommended final verification commands (workspace currently has unrelated in-flight changes):
1. `npm run type-check`
2. `npm run lint`
3. `npm run build` (from `firebase-backend/functions`)

## 10) Remaining Risk / Follow-up

- Existing legacy back-compat fields (`ownedDecorations`, `ownedThemes`, `cosmeticPoints`, `inventory`) are intentionally retained to avoid production data breakage.
- `Users/{uid}/Badges` legacy path is still active in some badge flows and should be removed only with a staged migration.
