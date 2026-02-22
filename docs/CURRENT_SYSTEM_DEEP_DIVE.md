# Current System Deep Dive

Last updated: 2026-02-20
Last verified against code: 2026-02-20 (post P1/P2/P3 implementation audit)
Scope: Full repo behavior review, with special emphasis on economy, achievements, decorations, and profile.

---

## 1. Executive Summary

`snapstyle-mvp` is a multi-surface social app that combines:

- Expo React Native client (`src/`)
- Firebase Auth + Firestore + Storage + Cloud Functions (`firebase-backend/`)
- Colyseus realtime multiplayer server (`colyseus-server/`)
- Embedded web game client (`client/`)

The app architecture is split between:

- UX/navigation/providers in the RN app
- persistent state and policy in Firestore + rules
- critical state transitions in Cloud Functions
- realtime game state in Colyseus rooms

This codebase is functional but not perfectly uniform. The largest inconsistencies are in the economy and purchase stack, where multiple generations of schemas and service paths coexist.

---

## 2. How The App Boots

### 2.1 Startup order

`App.tsx` does side-effect initialization before render:

- `initializeFirebase(firebaseConfig)`
- `lockToPortrait()`

During first render it mounts providers and app shell:

- `KeyboardProvider`
- `ErrorBoundary`
- `ThemeProvider`
- `GestureHandlerRootView`
- `PaperProvider`
- `SnackbarProvider`
- `AuthProvider`
- `UserProvider`
- `CallProvider`
- `InAppNotificationsProvider`
- `CameraProvider`
- `OutboxProcessorProvider` (runs `useOutboxProcessor`)
- `RootNavigator`
- `InAppToast`
- `IncomingCallOverlay`

Calls bootstrap is deferred and gated in `App.tsx`:

- `CALL_FEATURES.CALLS_ENABLED` must be true
- then `initializeBackgroundCallHandler`, `initializeAppStateListener`, `createCallNotificationChannel`

### 2.2 Auth + hydration state machine

The boot flow is hydration-safe and explicit:

- `AuthContext` hydrates Firebase auth state, loads custom claims, starts/stops presence, and manages push token registration.
- `UserContext` loads `Users/{uid}` profile doc after auth is ready.
- `AppGate` composes these into a state machine:
  - `loading`
  - `unauthenticated`
  - `needs_profile`
  - `banned`
  - `ready`

`RootNavigator.tsx` uses `AppGate` to decide which tree to mount:

- `AuthStack` when unauthenticated
- `ProfileSetupStack` when missing profile
- `MainStack` when ready

This prevents route flicker and race conditions at startup.

---

## 3. Navigation Topology

Primary shell is tab-based in `RootNavigator.tsx`:

- `Shop`
- `Play`
- `Inbox`
- `Moments`
- `Profile`

Many immersive screens are elevated to root stack routing (chat detail, group chat, games, calls, etc.) to overlay tabs cleanly.

Economy-relevant routes currently mounted:

- `Shop` tab -> `ShopHubScreen`
- root stack:
  - `PointsShop`
  - `PremiumShop`
  - `PurchaseHistory`
- profile stack still includes a legacy `Shop` route (`ShopScreen`)
- utility routes:
  - `Wallet`
  - `Tasks`

---

## 4. Data Plane And Backend Contract

### 4.1 Backend primitives

- Firestore rules: `firebase-backend/firestore.rules`
- indexes: `firebase-backend/firestore.indexes.json`
- Cloud Functions entrypoint: `firebase-backend/functions/src/index.ts`

### 4.2 Firestore security model shape

General pattern:

- user-owned reads under `Users/{uid}/...`
- high-risk writes (wallet, transactions, purchases) intended to be server-only
- many user preference/state docs writable by owner

Important caveat:

- There are both `Users/{uid}` and lowercase `users/{uid}` rule blocks for achievements-v2/social stats. Both currently exist.

---

## 5. Core Product Systems (Non-Emphasis Summary)

### 5.1 Messaging

Key modules:

- `src/services/messaging/*`
- `src/hooks/useChat.ts`
- `src/hooks/useUnifiedChatScreen.ts`
- local/outbox support in `src/services/database/*`, `src/services/sync/*`, `src/services/outbox.ts`

Design intent remains:

- optimistic UX
- idempotent send semantics
- server ordering

### 5.2 Games platform

Turn-based, single-player, and realtime all coexist.

Key modules:

- `src/screens/games/*`
- `src/hooks/useGameLobbyController.ts`
- `src/services/gameInvites.ts`
- `firebase-backend/functions/src/games.ts`
- `firebase-backend/functions/src/achievementsV2Evaluator.ts`

Notable operational features present in code:

- trace IDs (`src/utils/trace.ts`)
- universal invite schema
- unified lobby/watchdog recovery behavior
- spectator support and bug report pipeline

---

## 6. Economy System (Deep Emphasis)

## 6.1 Economy domain map

The economy is split across soft currency, token shop, premium shop, tasks, gifting, and purchase history.

Primary collections involved:

- `Wallets/{uid}`
- `Transactions/{txId}`
- `Tasks/{taskId}`
- `Users/{uid}/TaskProgress/{taskId}`
- `PointsShopCatalog/{itemId}`
- `PremiumProducts/{productId}`
- `IAPPurchases/{purchaseId}`
- `Gifts/{giftId}`
- inventory docs:
  - `Users/{uid}/inventory/{itemId}`
  - also legacy/alternate `Inventory/{uid}` map paths exist
- purchase history docs:
  - `Users/{uid}/purchases`
  - `Users/{uid}/PurchaseHistory`
  - legacy `Purchases`

## 6.2 Active wallet + transaction model used by client

Canonical client wallet service is `src/services/economy.ts`.

It reads:

- wallet: `Wallets/{uid}`
- field: `tokensBalance`
- transactions: top-level `Transactions` filtered by `uid`

UIs currently wired to this model:

- `WalletScreen`
- `TasksScreen` (via wallet subscription)
- `ShopHubScreen` (balance display)
- `usePointsShop` (affordability)

Type contract aligns with this shape:

- `src/types/models.ts` `Wallet.tokensBalance`

## 6.3 Task rewards and token minting

Client calls:

- `src/services/tasks.ts` -> callable `claimTaskReward`
- also records login via callable `recordDailyLogin`

Server implementation source:

- `firebase-backend/functions/src/economy.ts` re-exports from `legacy.ts`
- actual logic in `firebase-backend/functions/src/legacy.ts`

Observed behavior:

- `onUserCreated` creates `Wallets/{uid}` with starting `tokensBalance`
- `claimTaskReward`:
  - validates task/activity window/progress/claim state
  - updates `Users/{uid}/TaskProgress/{taskId}`
  - increments `Wallets/{uid}.tokensBalance`
  - writes a `Transactions` earn record
  - optionally grants inventory item in `Users/{uid}/inventory/{itemId}`

## 6.4 Points Shop flow

Client side:

- catalog read: `src/services/pointsShop.ts` from `PointsShopCatalog`
- purchase callable: `purchaseWithTokens`
- main UI: `PointsShopScreen` + `usePointsShop`

Server side:

- callable `purchaseWithTokens` in `firebase-backend/functions/src/shop.ts`
- atomic transaction:
  - validate item availability and stock
  - read wallet
  - ownership check in `Users/{uid}/inventory`
  - optional purchase limit check in `Users/{uid}/purchases`
  - deduct wallet
  - write inventory item
  - write purchase doc in `Users/{uid}/purchases`
  - decrement stock when applicable

## 6.5 Premium Shop / IAP flow

Client has two overlapping purchase services:

- `src/services/premiumShop.ts`
- `src/services/iap.ts`

`PremiumShopScreen` uses `usePremiumShop`, which uses `premiumShop.ts` for catalog/purchase APIs and only uses `iap.ts` for init/disconnect.

Server IAP callable that exists:

- `validateReceipt` in `firebase-backend/functions/src/iap.ts`

What `validateReceipt` does:

- validates receipt/token with Apple/Google flow stubs
- checks duplicate transaction in `IAPPurchases`
- loads product config from `PremiumProducts`/`StoreProducts`
- grants rewards:
  - tokens to `Wallets/{uid}.tokensBalance`
  - items to top-level `Inventory/{uid}.items` map (not `Users/{uid}/inventory`)
- writes purchase:
  - `IAPPurchases/{id}`
  - `Users/{uid}/purchases`

## 6.6 Gifting flow

Server callables in `firebase-backend/functions/src/gifting.ts`:

- `sendGift`
- `openGift`
- `expireGifts` scheduled
- `getGiftHistory`

Observed behavior:

- gift docs created with status `"pending"`
- `openGift` checks `"opened"`/`"expired"` states
- token grants in `openGift` go to `Users/{uid}/wallet/tokens.balance` (different wallet path)
- scheduler expires gifts in statuses `["pending", "delivered"]`

## 6.7 Purchase history surfaces

UI `PurchaseHistoryScreen` uses `src/services/purchaseHistory.ts`, which reads:

- `Users/{uid}/PurchaseHistory`

Other active writers write to different paths:

- `Users/{uid}/purchases`
- `IAPPurchases`
- legacy `Purchases`

Result: purchase history completeness depends on which writer path was used.

## 6.8 Economy rules/index alignment

Rules currently support core economy primitives:

- `Wallets`: read-own, server-only writes
- `Transactions`: read-own, server-only writes
- `PointsShopCatalog`, `PremiumProducts`: read auth, server-managed writes
- `Tasks`: read auth, server-managed writes
- `Users/{uid}/PurchaseHistory`: read-own, server-only writes
- `Gifts`: read by participants; restricted update transition

Indexes include:

- `Transactions(uid, createdAt desc)`
- `Transactions(uid, type, createdAt desc)`
- `PointsShopCatalog(active, sortOrder)`
- `PurchaseHistory` collection-group filters

## 6.9 Current economy inconsistencies (important)

Status after P1–P3 implementation (2026-02-20):

1. ~~Wallet field mismatch in shop function~~ **FIXED**:
   - `shop.ts` now reads `tokensBalance ?? tokens ?? 0` via `getTokenBalance()` helper
   - writes both `tokensBalance` + `tokens` for back-compat
2. Missing callable for bundles (**OPEN**):
   - client `bundles.ts` calls `purchaseBundleWithTokens`
   - no exported function found with that name
   - **Note:** `bundles.ts` is dead code — unreachable from active UI
3. ~~Missing callable for one client IAP path~~ **FIXED**:
   - `src/services/iap.ts` calls `verifyIAPPurchase`
   - backend now exports `verifyIAPPurchase` as alias for `validateReceipt`
4. Inventory path divergence (**OPEN**):
   - most app checks use `Users/{uid}/inventory`
   - IAP grants items to `Inventory/{uid}.items`
5. Gift status/rules mismatch (**OPEN**):
   - function uses statuses `pending/opened/expired/...`
   - rules update branch expects `'sent' -> 'claimed'`
6. ~~Wallet path divergence in gifting~~ **FIXED**:
   - `gifting.ts` now writes tokens to `Wallets/{uid}.tokensBalance` (canonical)
   - also writes `tokens` for back-compat
7. Purchase history fragmentation (**OPEN**):
   - active readers and writers are spread across multiple collections
8. Minor drift in legacy.ts `claimTaskReward` (**OPEN**):
   - only increments `tokensBalance` without back-compat `tokens` write
9. IAP field name drift (**OPEN**):
   - iap.ts uses `lifetimeTokensEarned` while other code uses `totalEarned`

---

## 7. Achievements System (Deep Emphasis)

## 7.1 Current architecture

Achievements-v2 is active in the current client:

- feature flags in `constants/featureFlags.ts`:
  - `ACHIEVEMENTS_V2_FEATURES.ENABLED = true`
  - `V2_UI = true`
  - `AUTO_MIGRATE = true`

UI routing:

- `AchievementsScreen` is a wrapper to `AchievementsV2Screen`

Read path:

- `src/services/achievementsV2.ts`
- reads lowercase paths:
  - `/users/{uid}/achievements/{achievementId}`
  - `/users/{uid}/achievementSummary/summary`

## 7.2 Server-authoritative evaluation flow

**Turn-based / multiplayer trigger:**

- `firebase-backend/functions/src/games.ts` `processGameCompletion`
- On terminal game transitions, for each player:
  - `updatePerGameStatsV2(...)`
  - `evaluateAchievementsV2(...)`

**Single-player trigger (added P3):**

- Client `singlePlayerSessions.ts` fire-and-forget calls `processSinglePlayerCompletion` callable
- Callable in `achievementsV2Evaluator.ts`:
  - validates auth + anti-cheat score range
  - calls `updatePerGameStatsV2(uid, gameType, outcome, score, gameSpecific)`
  - calls `evaluateAchievementsV2(uid)`
  - new unlocks trigger `grantAchievementRewards()` → tokens + entitlements

Evaluator module:

- `firebase-backend/functions/src/achievementsV2Evaluator.ts`

Writes:

- `/users/{uid}/achievements/*`
- `/users/{uid}/achievementSummary/summary`
- `Wallets/{uid}.tokensBalance` (token rewards)
- `Users/{uid}/Entitlements/{cosmeticId}` (badge rewards)

Reads:

- `/users/{uid}/statsPerGame/{gameType}` (including `gameSpecific` sub-map)
- `/users/{uid}/socialGameStats/counters`

Also syncs unlocked IDs into legacy `PlayerAchievements`.

## 7.3 Social achievement counters

Server helper:

- `firebase-backend/functions/src/socialGameStatsHelpers.ts`

Server increments in `onUniversalInviteUpdate`:

- `invitesSent`
- `invitesAcceptedByOthers`

Client helper:

- `src/services/socialGameStats.ts`

Client increments:

- `gamesWatched`
- `turnBasedRematchesCompleted`

Rules currently allow owner writes to `users/{uid}/socialGameStats/{docId}`.

## 7.4 Legacy overlap still present

Legacy systems remain in code:

- `src/services/achievements.ts` (`Users/{uid}/Achievements`)
- `src/services/gameAchievements.ts` (`PlayerAchievements`)
- `useGameAchievements` subscribes to legacy `PlayerAchievements`

So v2 is primary for current achievements UI, but legacy readers/writers still exist.

## 7.5 Achievements-v2 rule duplication nuance

Rules contain both:

- `match /Users/{uid}` achievements-v2 subcollection rules
- `match /users/{uid}` achievements-v2 rules

This likely reflects migration/compatibility layering and should be treated carefully before cleanup.

## 7.6 Current achievements risks

1. `AUTO_MIGRATE` flag appears declarative client-side, but no clear app-start migration call was found in current client code.
2. Dual legacy/v2 systems can drift unless server sync remains intact.
3. Mixed uppercase/lowercase user root paths increase long-term maintenance complexity.

---

## 8. Decorations System (Deep Emphasis)

## 8.1 Decoration definitions and availability

**Canonical catalog (P1):**

- `src/cosmetics/catalog.ts` — unified catalog covering badges, backgrounds, decorations, and themes
- `src/cosmetics/assetRegistry.ts` — static `require()` mappings for all cosmetic assets
- `src/cosmetics/types.ts` — `CosmeticDefinition`, `EntitlementDoc`, `EquippedCosmetics`
- `src/services/entitlements.ts` — ownership read/write service
- Ownership path: `Users/{uid}/Entitlements/{cosmeticId}`

**Legacy catalog (still present, will be removed):**

- `src/data/avatarDecorations.ts` — old decoration definitions (26 items)
- `assets/decorations/assetMap.ts` — deprecated shim, delegates to `src/cosmetics/assetRegistry.ts`

Asset files now live under:

- `assets/cosmetics/badges/` (12 files)
- `assets/cosmetics/backgrounds/` (8 files)
- `assets/cosmetics/decorations/` (12 files across basic/achievement/premium subdirs)
- `assets/cosmetics/themes/` (empty — theme previews not yet shipped)

## 8.2 Ownership and equip semantics

Service layer:

- `equipDecoration(userId, decorationId)`:
  - verifies ownership in `Users/{uid}.ownedDecorations`
  - auto-grants free+available decorations on first equip
  - writes `Users/{uid}.avatarDecoration`
- `grantDecoration(...)`:
  - appends to `Users/{uid}.ownedDecorations`
  - also writes `Users/{uid}/OwnedDecorations/{decorationId}`
- `unequipDecoration(...)` clears equipped id

UI behavior:

- `DecorationPicker` treats free+available decorations as owned, even if not yet in owned list.
- `useProfilePicture` loads `ownedDecorations` and equipped decoration from full profile.

## 8.3 Decoration persistence model

Profile doc fields:

- `avatarDecoration` (equipped state)
- `ownedDecorations` (owned IDs list)

Tracking subcollection:

- `Users/{uid}/OwnedDecorations/{decorationId}`

This is a dual-write model (list on user doc + subcollection detail record).

## 8.4 Decoration system constraints

1. Catalog breadth exceeds currently shipped assets.
2. The app UI can show many entries as locked/unavailable because assets are intentionally not mapped.
3. Shop messaging implies broader decoration availability than what is currently asset-backed.

---

## 9. Profile System (Deep Emphasis)

## 9.1 Data contract and hydration

Core profile type:

- `src/types/userProfile.ts` `UserProfileData`

Hydration/default enforcement:

- `src/services/profile/profileContract.ts` `hydrateProfileData`

Important defaults:

- `profilePicture.url = null`
- `avatarDecoration.decorationId = null`
- `bio.text = ""`
- `theme.equippedThemeId = "default"`
- `ownedThemes = ["default"]`
- `featuredBadges.badgeIds = []`
- privacy from `DEFAULT_PRIVACY_SETTINGS`

## 9.2 Primary profile service surface

`src/services/profileService.ts` currently owns most profile operations:

- read full profile + realtime subscribe
- relationship detection
- mutual friends
- profile picture upload/remove
- display name/bio/status updates
- decoration and theme equip/grant
- privacy update APIs
- sharing/moderation helpers

## 9.3 Privacy model: intended vs currently rendered

Privacy helpers are defined in `src/types/userProfile.ts`:

- `applyPrivacyFilters(profile, relationship)`

`profileService.ts` includes:

- private `getProfileDataForViewer(...)` that uses `applyPrivacyFilters`

Current viewer screen (`UserProfileScreen`) behavior:

- loads `getFullProfileData(userId)` directly
- applies only selected UI guards (for example `showLastActive`, `showGameScores`, `showMutualFriends`, `allowProfileSharing`)
- passes `bio` and `status` directly to header without full privacy filtering pipeline

This means privacy abstraction exists, but the main viewer screen does not centrally consume the filtered profile API today.

## 9.4 Theme behavior

Theme definitions are rich (`src/data/profileThemes.ts`) and service APIs exist (`equipTheme`, `grantTheme`), but active profile UIs mostly use global app theme from `ThemeContext`.

In other words:

- profile theme ownership/equip is persisted
- per-profile rendered theming is currently partial/non-universal across profile screens

## 9.5 Badge behavior

Two badge representations coexist:

- `Users/{uid}/Badges/{badgeId}` docs (managed by `src/services/badges.ts`)
- `Users/{uid}.featuredBadges.badgeIds` in profile doc (managed by profile service functions)

Profile privacy references featured badges on profile doc.

## 9.6 Profile screens currently in play

Own profile:

- `OwnProfileScreen`
- composes:
  - `useUser` base profile
  - `useProfileData` extended stats layer
  - `useFullProfileData` for full fields (bio/status/etc.)
  - `useProfilePicture` for picture/decoration state

Viewed profile:

- `UserProfileScreen`
- loads profile, relationship, mutuals, mute state in parallel
- dynamic action set based on relationship

## 9.7 Profile rules and validation alignment

Firestore rules validate profile fields under `Users/{uid}`:

- display name length
- bio structure
- status structure
- privacy enum/shape
- avatar decoration shape
- theme shape
- featured badges shape

Client-side validators in `profileContract.ts` are generally equal-or-stricter than rules, which is good for fast local failure.

## 9.8 Profile system risks

1. Central privacy filter helper is not the primary path in viewer screen.
2. Theme ownership/equip model exists but visual application is not consistently reflected across profile UI surfaces.
3. Badge data exists in both subcollection docs and top-level featured config, requiring careful consistency handling.

---

## 10. End-To-End Flow Narratives

## 10.1 Earn and spend tokens

1. User completes tracked actions (messages, games, stories, login).
2. server triggers update `Users/{uid}/TaskProgress/*`.
3. user claims task reward via callable `claimTaskReward`.
4. function increments `Wallets/{uid}.tokensBalance` and writes `Transactions`.
5. wallet and transaction subscriptions update UI (`WalletScreen`, `ShopHubScreen`, `TasksScreen`).
6. user purchases item in `PointsShopScreen`.
7. callable `purchaseWithTokens` deducts wallet and grants `Users/{uid}/inventory/{itemId}`.

## 10.2 Achievement unlock lifecycle (v2)

1. game ends in terminal state.
2. `processGameCompletion` trigger runs.
3. per-game stats are updated.
4. evaluator computes progress/unlocks and writes `/users/{uid}/achievements/*`.
5. client `useAchievementsV2` subscription receives updates.
6. `AchievementsV2Screen` renders unlocked/progress state.
7. legacy sync writes unlocked IDs to `PlayerAchievements` for compatibility.

## 10.3 Decoration lifecycle

1. user opens decoration picker on profile.
2. picker loads static catalog + owned IDs from profile doc.
3. if free and asset-backed, item is treated as ownable immediately.
4. `equipDecoration` writes `avatarDecoration` (and may auto-grant free ownership).
5. profile picture with decoration updates through profile subscription hooks.

## 10.4 Viewed profile lifecycle

1. `UserProfileScreen` loads full profile + relationship + mutuals + mute.
2. action bar is derived from relationship type.
3. selected privacy fields are enforced in UI checks.
4. profile header renders picture/decoration/name/username/bio/status.

---

## 11. High-Impact Inconsistencies To Resolve

Priority 1 (as of 2026-02-20):

- ~~Wallet schema mismatch (`tokensBalance` vs `tokens`) across shop/gift paths~~ **FIXED in P3**
- ~~Missing backend callable `verifyIAPPurchase`~~ **FIXED in P3** (alias of `validateReceipt`)
- Missing backend callable `purchaseBundleWithTokens` (**OPEN** — client `bundles.ts` is dead code, low risk)
- Inventory destination mismatch (`Users/{uid}/inventory` vs `Inventory/{uid}`) — **OPEN** in `iap.ts`
- Profile background not displayed: `OwnProfileHeader`/`UserProfileHeader` don't use `ProfileHeaderVisual` — **OPEN**

Priority 2:

- Gift status machine mismatch between function behavior and Firestore rules.
- Purchase history split across `PurchaseHistory`, `purchases`, `Purchases`, `IAPPurchases`.
- Profile privacy filter abstraction not used as primary view-data API.
- `claimTaskReward` only writes `tokensBalance` without `tokens` back-compat.
- `iap.ts` uses `lifetimeTokensEarned` instead of `totalEarned`.

Priority 3:

- Achievements-v2 uppercase/lowercase user path duplication.
- Theme system persistence not consistently reflected in UI rendering.
- Badge dual-representation consistency concerns.
- Legacy `avatarDecorations.ts` and `assetMap.ts` shim still imported by `DecorationOverlay` and `profileService`.

---

## 12. Recommended Canonical Sources Of Truth (Current Best Fit)

After P1–P3 implementation:

- Wallet balance: `Wallets/{uid}.tokensBalance`
- Token transactions: `Transactions` (top-level) + `Users/{uid}/Transactions` (achievement rewards)
- Cosmetics catalog: `src/cosmetics/catalog.ts` (single source of truth)
- Cosmetics ownership: `Users/{uid}/Entitlements/{cosmeticId}`
- Cosmetics equip: `Users/{uid}` profile doc — `equippedBackgroundId`, `avatarDecoration`, `equippedThemeId`, `featuredBadges`
- Token purchases: `purchaseWithTokens` / `purchaseCosmeticWithTokens` callables
- Achievements UI: v2 docs under lowercase `/users/{uid}/...`
- Profile doc contract: `UserProfileData` + `hydrateProfileData`
- Asset registry: `src/cosmetics/assetRegistry.ts`

---

## 13. Change Safety Checklist By Emphasis Area

### Economy

Before shipping economy changes:

- verify callable names exist in `functions/src/index.ts`
- verify wallet field names match all write/read paths
- verify inventory path is consistent
- verify rules permit intended reads/writes
- verify indexes for new query shapes

### Achievements

- keep server evaluator authoritative
- avoid introducing client-side unlock writes
- validate v2 + legacy sync behavior when touching completion triggers
- verify lowercase/uppercase path expectations explicitly

### Decorations

- add asset mapping before marking catalog items available
- keep owned list and `OwnedDecorations` subcollection in sync
- validate equip flow against ownership and free-item grant semantics

### Profile

- update `UserProfileData` and `hydrateProfileData` together
- ensure rules validation covers new fields
- apply privacy policy in service layer, not just ad hoc UI checks
- verify own-profile and viewed-profile behavior separately

---

## 14. File Reference Map

### App shell and navigation

- `App.tsx`
- `src/components/AppGate.tsx`
- `src/navigation/RootNavigator.tsx`
- `constants/featureFlags.ts`
- `src/store/AuthContext.tsx`
- `src/store/UserContext.tsx`

### Economy

- `src/services/economy.ts`
- `src/services/tasks.ts`
- `src/services/pointsShop.ts`
- `src/services/premiumShop.ts`
- `src/services/iap.ts`
- `src/services/purchaseHistory.ts`
- `src/services/bundles.ts`
- `src/screens/shop/ShopHubScreen.tsx`
- `src/screens/shop/PointsShopScreen.tsx`
- `src/screens/shop/PremiumShopScreen.tsx`
- `src/screens/shop/PurchaseHistoryScreen.tsx`
- `src/screens/tasks/TasksScreen.tsx`
- `src/screens/wallet/WalletScreen.tsx`
- `firebase-backend/functions/src/legacy.ts`
- `firebase-backend/functions/src/shop.ts`
- `firebase-backend/functions/src/iap.ts`
- `firebase-backend/functions/src/gifting.ts`
- `firebase-backend/functions/src/economy.ts`
- `firebase-backend/functions/src/index.ts`

### Achievements

- `src/screens/games/AchievementsScreen.tsx`
- `src/screens/games/AchievementsV2Screen.tsx`
- `src/hooks/useAchievementsV2.ts`
- `src/services/achievementsV2.ts`
- `src/services/socialGameStats.ts`
- `src/hooks/useGameAchievements.ts`
- `src/services/gameAchievements.ts`
- `src/services/achievements.ts`
- `firebase-backend/functions/src/games.ts`
- `firebase-backend/functions/src/achievementsV2Evaluator.ts`
- `firebase-backend/functions/src/socialGameStatsHelpers.ts`

### Decorations and profile

- `src/data/avatarDecorations.ts`
- `assets/decorations/assetMap.ts`
- `src/hooks/useProfilePicture.ts`
- `src/components/profile/ProfilePicture/DecorationPicker.tsx`
- `src/components/profile/ProfilePicture/DecorationPickerModal.tsx`
- `src/services/profileService.ts`
- `src/services/profile/profileContract.ts`
- `src/types/userProfile.ts`
- `src/screens/profile/OwnProfileScreen.tsx`
- `src/screens/profile/UserProfileScreen.tsx`
- `src/data/profileThemes.ts`
- `src/services/badges.ts`

### Rules and indexes

- `firebase-backend/firestore.rules`
- `firebase-backend/firestore.indexes.json`

---

## 15. Closing Notes

The project is production-capable in core social/game loops, but the economy and profile-adjacent domains carry schema drift from overlapping rollout phases. The safest way to ship new work is to treat service-layer contracts and function exports as authoritative interfaces and remove path/field duplication incrementally.
