# Profile and Economy

Last verified: 2026-03-30

## Scope

This doc is the feature-level overview for:

- profile surfaces and viewer/owner behavior
- cosmetics, customization, and appearance settings
- wallet, shop, tasks, achievements, and related progression data

Use the deeper docs under `docs/profile/` for widget-board mechanics.

## Current Status

- own profile widget board: implemented
- viewed profile board: implemented in read-only mode
- cosmetics ownership and equip flows: implemented
- wallet, transactions, tasks, shop, and purchase history: implemented
- achievements and game-driven progression: implemented
- several legacy ownership fields remain for back-compat: still present

## Main Files

Profiles:

- [OwnProfileScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/profile/OwnProfileScreen.tsx)
- [UserProfileScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/profile/UserProfileScreen.tsx)
- `src/components/profile/WidgetBoard/*`

Customization and cosmetics:

- [CustomizationHubScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/customization/CustomizationHubScreen.tsx)
- [PROFILE_SYSTEM.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/PROFILE_SYSTEM.md)
- [entitlements.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/entitlements.ts)
- `src/cosmetics/*`

Economy and progression:

- [economy.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/economy.ts)
- [tasks.ts](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/services/tasks.ts)
- [ShopHubScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/shop/ShopHubScreen.tsx)
- [WalletScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/wallet/WalletScreen.tsx)
- [TasksScreen.tsx](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/src/screens/tasks/TasksScreen.tsx)
- `src/screens/shop/CosmeticsShopScreen.tsx`
- `src/screens/shop/PurchaseHistoryScreen.tsx`

Backend:

- `firebase-backend/functions/src/economy.ts`
- `firebase-backend/functions/src/shop.ts`
- `firebase-backend/functions/src/cosmeticEntitlements.ts`
- `firebase-backend/functions/src/iap.ts`

## Profile Surfaces

### Own profile

Own profile is no longer a fixed stack of cards. It is an editable widget board backed by `useBoardState(currentUid)`.

### Viewed profile

Viewed profiles are no longer described accurately by older docs that talk about a traditional card layout. The current `UserProfileScreen`:

- loads the target user’s saved board through `useBoardState(userId, { readOnly: true })`
- filters and adapts data for a non-owner viewer
- injects a synthetic `viewer-actions` widget at the bottom

That means both owner and viewer profiles are board-driven now, but only the owner surface is editable.

## Widget Inventory Snapshot

Current widget types in the registry:

- `profile-header`
- `social-proof`
- `friends`
- `badges`
- `achievements`
- `mutual-friends`
- `favorite-game`
- `profile-stats`
- `recent-activity`
- `viewer-actions`
- `tasks-overview`
- `wallet-balance`
- `theme-mode`
- `chat-layout-mode`

Current default owner layout includes:

- profile header
- social proof
- friends
- badges
- achievements
- tasks overview
- wallet balance

## Layout Persistence

Board persistence lives at:

- `Users/{uid}/ProfileLayout/board`

Current behavior:

- owner mode validates, migrates, and persists layouts
- read-only viewer mode subscribes to the target user’s board but does not persist defaults or edits

See [PROFILE_WIDGET_SYSTEM_MASTER.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/profile/PROFILE_WIDGET_SYSTEM_MASTER.md) for details.

## Appearance and Personalization

The current appearance model is split across:

- app theme and theme mode
- chat conversation display mode
- profile cosmetics and equipped visuals
- chat cosmetics such as bubble color, font, font color, and animal theme

Relevant docs:

- [PROFILE_SYSTEM.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/PROFILE_SYSTEM.md)
- [CHAT_SYSTEM.md](/c:/Users/rflet/OneDrive/Desktop/snapstyle-mvp/docs/CHAT_SYSTEM.md) (display modes, custom font colors, and all chat documentation)

## Cosmetics and Customization

Current ownership model:

- canonical path: `Users/{uid}/Entitlements/{cosmeticId}`
- canonical service: `entitlements.ts`

Back-compat writes still exist for:

- `ownedDecorations`
- `ownedThemes`
- legacy inventory-style paths

Customization Hub behavior today:

- equip-only, not purchase-first
- split into profile and chat sections
- owned-only browsing
- live previews for profile/chat appearance
- special categories for bubble colors, fonts, font colors, animal themes, and themes

Shop behavior today:

- Shop Hub routes into cosmetics, premium, and purchase history surfaces
- wallet balance is visible from the hub
- cosmetics purchasing remains separate from equipping

## Economy and Progression

### Wallet

Wallet authority:

- canonical document: `Wallets/{uid}`
- transaction feed: `Transactions`

The client subscribes to wallet and transaction reads, but writes remain server-authoritative.

### Tasks

Task authority:

- task definitions: `Tasks`
- per-user progress: `Users/{uid}/TaskProgress`
- claims: callable `claimTaskReward`

Current UI behavior:

- `TasksScreen` separates daily and monthly tasks
- it calls `recordDailyLogin` on mount
- the default client timezone constant in `tasks.ts` is `America/Indiana/Indianapolis`

### Achievements

Achievements are fed primarily by Games V4. Profile surfaces then render featured subsets and achievement summaries.

## Important Runtime Truths

- viewer profiles use the board system now
- entitlements are the canonical cosmetic ownership source
- wallet and reward state should still be treated as server-authoritative
- tasks and shop flows are live and connected to production-facing data contracts, not just placeholder UI

## Known Current Rough Edges

- legacy ownership fields still exist alongside the canonical entitlements path
- some older docs still describe viewed profiles as a separate card-stack architecture
- mutual-friends is meaningful on viewed profiles, but mostly not useful on your own board
- parts of the customization and shop code still carry older naming or plan references even though the live behavior has moved on

## Recommended Validation

```bash
npm run type-check
npm run lint
npm run test
npm --prefix firebase-backend/functions run build
```
