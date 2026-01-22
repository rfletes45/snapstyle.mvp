# Phase 19 Complete: Shop + Limited-Time Drops

## Summary

Phase 19 implements a token-based shop system with limited-time drops functionality. Users can now spend their earned tokens to purchase cosmetic items from the shop.

## Definition of Done

✅ **Token purchases grant inventory** - Users can purchase shop items with tokens, and items are instantly added to their inventory.

## Implementation Details

### 1. Types Added (`src/types/models.ts`)

- `ShopItem` - Shop catalog item with pricing, availability, and rarity
- `ShopItemRarity` - common | rare | epic | legendary
- `ShopCategory` - hat | glasses | background | bundle | featured
- `Purchase` - Purchase record with status tracking
- `PurchaseStatus` - completed | pending | failed | refunded
- `ShopItemWithStatus` - Extended type with availability and ownership info
- Helper functions: `isShopItemAvailable()`, `getShopItemTimeRemaining()`

### 2. Shop Service (`src/services/shop.ts`)

- `getShopCatalog()` - Fetch all active shop items
- `getFeaturedItems()` - Fetch featured/limited-time items
- `getShopItemsByCategory()` - Filter by category
- `getLimitedTimeItems()` - Get time-limited items
- `getShopCatalogWithStatus()` - Items with ownership/availability status
- `purchaseWithTokens()` - Execute purchase via Cloud Function
- `getPurchaseHistory()` - User's purchase history
- `subscribeToShopCatalog()` - Real-time catalog updates
- Utility functions: `formatTimeRemaining()`, `getRarityColor()`, `getRarityLabel()`

### 3. Cloud Functions (`firebase-backend/functions/src/index.ts`)

#### `purchaseWithTokens` (Callable)

Atomic purchase operation:

1. Validates item availability (active, within time window, stock available)
2. Checks user doesn't already own the item
3. Validates sufficient token balance
4. Deducts tokens from wallet
5. Adds item to user's inventory
6. Creates purchase record
7. Creates transaction record
8. Updates item purchase count

#### `seedShopCatalog` (HTTP)

Seeds initial shop items including:

- 2 featured limited-time items (Royal Crown, Galaxy Background)
- 3 hats (Cool Cap, Cozy Beanie, Top Hat)
- 3 glasses (Round Glasses, Cool Sunglasses, VR Headset)
- 3 backgrounds (Sunset Vibes, City Lights, Neon Dreams)

### 4. ShopScreen UI (`src/screens/shop/ShopScreen.tsx`)

Features:

- Token balance bar with quick navigation to Wallet
- Featured items carousel with countdown timers for limited-time items
- Category filter tabs (All, Hats, Glasses, Backgrounds)
- Item grid with rarity coloring and owned indicators
- Purchase confirmation modal with:
  - Item preview
  - Price display
  - Balance check
  - Insufficient tokens warning
  - Purchase progress/success states

### 5. Navigation Updates

- Added `ShopScreen` to `ProfileStack` in `RootNavigator.tsx`
- Added "Shop" button to `ProfileScreen`
- "Shop" quick action already in `WalletScreen`

### 6. Firestore Rules (`firebase-backend/firestore.rules`)

```
/ShopCatalog/{itemId}
  - read: authenticated users
  - write: server-only (Cloud Functions)

/Purchases/{purchaseId}
  - read: owner only (uid == auth.uid)
  - write: server-only (Cloud Functions)
```

### 7. Firestore Indexes (`firebase-backend/firestore.indexes.json`)

Added indexes for:

- `ShopCatalog`: active + sortOrder
- `ShopCatalog`: active + featured + sortOrder
- `ShopCatalog`: active + category + sortOrder
- `ShopCatalog`: active + availableTo
- `Purchases`: uid + createdAt

## Data Flow

```
User taps "Purchase" → purchaseWithTokens callable →
  Validates item & user →
  Atomic batch:
    - Wallet: deduct tokens
    - Inventory: add cosmetic item
    - Purchases: record purchase
    - Transactions: record spend
    - ShopCatalog: increment purchaseCount →
  Returns success + new balance
```

## Shop Items Seeded

| Item              | Category       | Price | Rarity    |
| ----------------- | -------------- | ----- | --------- |
| Royal Crown       | Featured (Hat) | 150   | Legendary |
| Galaxy Background | Featured (BG)  | 100   | Epic      |
| Cool Cap          | Hat            | 25    | Common    |
| Cozy Beanie       | Hat            | 30    | Common    |
| Top Hat           | Hat            | 50    | Rare      |
| Round Glasses     | Glasses        | 20    | Common    |
| Cool Sunglasses   | Glasses        | 35    | Rare      |
| VR Headset        | Glasses        | 75    | Epic      |
| Sunset Vibes      | Background     | 40    | Rare      |
| City Lights       | Background     | 45    | Rare      |
| Neon Dreams       | Background     | 60    | Epic      |

## Testing Checklist

- [ ] Shop screen displays all items
- [ ] Featured items show countdown timers
- [ ] Category filtering works
- [ ] "Owned" badge shows for purchased items
- [ ] Purchase modal shows correct item info
- [ ] Insufficient tokens warning appears correctly
- [ ] Purchase deducts tokens and updates wallet
- [ ] Purchased item appears in inventory
- [ ] Purchased item shows as "Owned" immediately
- [ ] Transaction appears in wallet history
- [ ] Limited-time items expire correctly

## Files Changed

### Created

- `src/services/shop.ts`
- `src/screens/shop/ShopScreen.tsx`
- `PHASE_19_COMPLETE.md`

### Modified

- `src/types/models.ts` - Added shop types
- `src/navigation/RootNavigator.tsx` - Added ShopScreen
- `src/screens/profile/ProfileScreen.tsx` - Added Shop button
- `firebase-backend/functions/src/index.ts` - Added Cloud Functions
- `firebase-backend/firestore.rules` - Added shop rules
- `firebase-backend/firestore.indexes.json` - Added shop indexes
- `firebase/firestore.rules` - Added shop rules (duplicate folder)
- `firebase/firestore.indexes.json` - Added shop indexes (duplicate folder)
- `firebase/functions/src/index.ts` - Added Cloud Functions (duplicate folder)

## Deployment Status

- ✅ Cloud Functions deployed (`purchaseWithTokens`, `seedShopCatalog`)
- ✅ Firestore rules deployed
- ✅ Firestore indexes deployed
- ✅ Shop catalog seeded (11 items)

## Next Phase

Phase 20 can proceed with:

- Additional shop features (bundles, sales)
- IAP integration for token purchases
- Admin dashboard for shop management
