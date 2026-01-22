# Phase 7: Avatar + Cosmetics - Preparation Document

**Status:** In Progress 🔄  
**Last Updated:** January 2025

---

## 📋 Overview

Phase 7 adds avatar customization and a cosmetics system where users can:

1. **Customize their avatar** with hats, glasses, and accessories
2. **Earn cosmetics** through streak milestones
3. **Manage inventory** of unlocked items
4. **Equip/unequip** items on their avatar

---

## 🎯 Goals

1. Create a cosmetics catalog with items for each slot (hat, glasses, background)
2. Build an inventory system to track unlocked items per user
3. Auto-award cosmetics when streak milestones are reached
4. UI for customizing avatar on ProfileScreen
5. Display equipped cosmetics on avatar throughout the app

---

## 📦 Data Models (Already Defined)

### CosmeticItem (cosmetics catalog)

```typescript
interface CosmeticItem {
  id: string;
  name: string;
  slot: "hat" | "glasses" | "background";
  imagePath: string;
  rarity: "common" | "rare" | "epic";
  unlock: {
    type: "free" | "milestone" | "starter";
    value?: string; // e.g., "streak_7", "streak_30"
  };
}
```

### InventoryItem (user's unlocked items)

```typescript
interface InventoryItem {
  itemId: string;
  acquiredAt: number;
}
```

### AvatarConfig (equipped items)

```typescript
interface AvatarConfig {
  baseColor: string;
  hat?: string; // itemId or null
  glasses?: string; // itemId or null
  background?: string; // itemId or null
}
```

---

## 🏗️ Architecture

### 1. Cosmetics Catalog

Static data defining all available cosmetic items:

```
src/data/cosmetics.ts
├── COSMETIC_ITEMS: CosmeticItem[]
├── getItemById(id)
├── getItemsBySlot(slot)
├── getMilestoneReward(milestone)
└── getStarterItems()
```

### 2. Inventory Service

Manages user inventory in Firestore:

```
src/services/cosmetics.ts
├── getUserInventory(userId)
├── addToInventory(userId, itemId)
├── hasItem(userId, itemId)
└── grantMilestoneReward(userId, milestone)
```

### 3. Avatar Component

Renders avatar with equipped cosmetics:

```
src/components/Avatar.tsx
├── Props: { config: AvatarConfig, size: number }
├── Layers: background → base → hat → glasses
└── Uses images from cosmetics catalog
```

### 4. Cloud Function: Award Milestone Cosmetics

Triggered when streak milestone is reached:

```
firebase/functions/src/index.ts
├── onStreakMilestone (trigger)
└── Awards cosmetic item to user inventory
```

---

## 📁 File Structure (New Files)

```
src/
├── data/
│   └── cosmetics.ts          # Cosmetics catalog (static data)
├── components/
│   ├── Avatar.tsx            # Avatar display component
│   └── AvatarCustomizer.tsx  # Avatar editing UI
├── services/
│   └── cosmetics.ts          # Inventory service
└── screens/profile/
    └── ProfileScreen.tsx     # Updated with customization UI
```

---

## 🎨 Cosmetics Catalog

### Starter Items (Free)

| ID             | Name       | Slot       | Rarity |
| -------------- | ---------- | ---------- | ------ |
| `bg_default`   | Default    | background | common |
| `hat_none`     | No Hat     | hat        | common |
| `glasses_none` | No Glasses | glasses    | common |

### Milestone Rewards

| Milestone | Item ID         | Name           | Slot       | Rarity |
| --------- | --------------- | -------------- | ---------- | ------ |
| 3 days    | `hat_flame`     | Flame Cap      | hat        | common |
| 7 days    | `glasses_cool`  | Cool Shades    | glasses    | common |
| 14 days   | `bg_gradient`   | Gradient BG    | background | rare   |
| 30 days   | `hat_crown`     | Golden Crown   | hat        | rare   |
| 50 days   | `glasses_star`  | Star Glasses   | glasses    | rare   |
| 100 days  | `bg_rainbow`    | Rainbow BG     | background | epic   |
| 365 days  | `hat_legendary` | Legendary Halo | hat        | epic   |

---

## 📱 UI Design

### ProfileScreen Changes

```
┌─────────────────────────────────────┐
│            Profile                   │
├─────────────────────────────────────┤
│        ┌─────────────┐              │
│        │   AVATAR    │              │
│        │  (w/ items) │              │
│        └─────────────┘              │
│      [Customize Avatar] button      │
├─────────────────────────────────────┤
│  Username: @johndoe                 │
│  Display Name: John                 │
│  Email: john@example.com            │
├─────────────────────────────────────┤
│  [Edit Profile]  [Sign Out]         │
└─────────────────────────────────────┘
```

### Avatar Customizer Modal

```
┌─────────────────────────────────────┐
│        Customize Avatar              │
├─────────────────────────────────────┤
│        ┌─────────────┐              │
│        │   PREVIEW   │              │
│        │  (live)     │              │
│        └─────────────┘              │
├─────────────────────────────────────┤
│  BACKGROUND                          │
│  [Default] [Gradient🔒] [Rainbow🔒] │
├─────────────────────────────────────┤
│  HAT                                 │
│  [None] [Flame🔓] [Crown🔒]         │
├─────────────────────────────────────┤
│  GLASSES                             │
│  [None] [Cool🔓] [Star🔒]           │
├─────────────────────────────────────┤
│  BASE COLOR                          │
│  [🟡] [🔴] [🟢] [🔵] [🟠] [🟣]      │
├─────────────────────────────────────┤
│      [Save]         [Cancel]        │
└─────────────────────────────────────┘
```

---

## 🔥 Firestore Schema

### Collection: `users/{userId}/inventory`

```javascript
// Document: itemId
{
  itemId: "hat_flame",
  acquiredAt: 1705123456789
}
```

### Updated User Document

```javascript
{
  uid: "user123",
  username: "johndoe",
  displayName: "John",
  avatarConfig: {
    baseColor: "#FFFC00",
    hat: "hat_flame",        // equipped item ID
    glasses: null,           // no glasses equipped
    background: "bg_default" // background ID
  },
  // ... other fields
}
```

---

## 🔒 Security Rules

```javascript
// users/{userId}/inventory
match /users/{userId}/inventory/{itemId} {
  // Users can read their own inventory
  allow read: if request.auth.uid == userId;

  // Only Cloud Functions can write (via admin SDK)
  allow write: if false;
}
```

---

## ☁️ Cloud Function: onStreakMilestone

Already integrated into `onNewMessage` function. When streak reaches milestone:

1. Check if cosmetic reward exists for milestone
2. Check if user already has item
3. If not, add to user's inventory
4. Send push notification about reward

```typescript
// Milestone cosmetic mapping
const MILESTONE_REWARDS: Record<number, string> = {
  3: "hat_flame",
  7: "glasses_cool",
  14: "bg_gradient",
  30: "hat_crown",
  50: "glasses_star",
  100: "bg_rainbow",
  365: "hat_legendary",
};
```

---

## 📋 Implementation Checklist

### Data Layer

- [ ] Create `src/data/cosmetics.ts` with full catalog
- [ ] Update `AvatarConfig` type with background field
- [ ] Create `src/services/cosmetics.ts` for inventory management

### Components

- [ ] Create `src/components/Avatar.tsx`
- [ ] Create `src/components/AvatarCustomizer.tsx`

### Screens

- [ ] Update ProfileScreen with avatar customization
- [ ] Add "Customize" button to profile
- [ ] Modal for avatar editing

### Cloud Functions

- [ ] Add milestone reward logic to `onNewMessage`
- [ ] Add `grantCosmeticReward` helper function
- [ ] Send notification on reward unlock

### Testing

- [ ] Test starter items granted on signup
- [ ] Test milestone rewards at each threshold
- [ ] Test avatar rendering with all item combos
- [ ] Test inventory persistence

---

## 📊 Estimated Lines of Code

| File                                  | Lines    | Purpose           |
| ------------------------------------- | -------- | ----------------- |
| `src/data/cosmetics.ts`               | ~120     | Cosmetics catalog |
| `src/services/cosmetics.ts`           | ~80      | Inventory service |
| `src/components/Avatar.tsx`           | ~100     | Avatar renderer   |
| `src/components/AvatarCustomizer.tsx` | ~200     | Customization UI  |
| ProfileScreen changes                 | ~50      | Integration       |
| Cloud Function changes                | ~40      | Milestone rewards |
| **Total**                             | **~590** |                   |

---

## ⚠️ MVP Constraints

1. **Simple visuals** - Use emoji/icons instead of custom images for MVP
2. **No store** - All items earned through milestones (no purchase)
3. **Limited slots** - Only hat, glasses, background for now
4. **Static catalog** - Hardcoded items, not from Firestore
5. **Basic animations** - No fancy transitions for now

---

## 🚀 Next Steps

1. ✅ Create PHASE_7_PREP.md (this document)
2. Create cosmetics catalog data
3. Build Avatar component
4. Build AvatarCustomizer component
5. Update ProfileScreen
6. Add Cloud Function milestone rewards
7. Test end-to-end
8. Create PHASE_7_COMPLETE.md

---

**Ready to implement Phase 7! 🎨**
