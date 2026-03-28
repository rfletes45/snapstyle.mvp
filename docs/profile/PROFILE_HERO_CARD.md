# Profile Hero Card

Last verified: 2026-03-27

← Back to [Profile System Overview](PROFILE_SYSTEM_OVERVIEW.md)

The Profile Hero Card is the main identity widget on the profile board. It is the only **non-removable** widget — it can be moved and resized but never deleted.

## Widget Metadata

| Property        | Value                   |
| --------------- | ----------------------- |
| Widget type ID  | `profile-header`        |
| Category        | Profile                 |
| Default size    | `hero` (4×4)            |
| Supported sizes | `wide`, `large`, `hero` |
| Removable       | **No**                  |
| Resizable       | Yes                     |
| Max instances   | 1                       |

## Size Variants

The hero card has three distinct layouts that adapt to the widget's current size. Content progressively reveals as the card grows larger.

### Wide (4×1, 88px height)

```
┌────────────────────────────────────────┐
│ [PFP 48px]  Display Name   Lv.3   ⚙️  │
└────────────────────────────────────────┘
```

**Content:**

- Profile picture (48px) with decoration overlay
- Display name (bold, single line)
- Compact level indicator: "Lv. X" — tappable, navigates to Level Rewards
- Settings button (cog icon, 20px) — top-right corner

**Hidden in this size:** username, bio, status, XP numbers, action buttons (Shop, Customize), rewards pill

**Interactions:**

- Tap level indicator → Level Rewards screen
- Tap settings → Settings screen

### Large (4×2, 184px height)

```
┌────────────────────────────────────────┐
│ [PFP 64px]  Display Name   [Status] ⚙️│
│             @username                  │
│  Level 3 ████░░░ 120/500              │
│  [🛍 Shop]  [🎨 Customize]             │
└────────────────────────────────────────┘
```

**Content:**

- Profile picture (64px) with decoration
- Display name + username
- Status chip (emoji + text if active, or "Set Status" placeholder)
- Compact level progress bar with XP numbers
- Action buttons: Shop, Customize
- Settings button (cog icon, 16px) — top-right corner
- Background image support (if equipped)

**Hidden in this size:** bio, rewards pill, detailed XP breakdown

**Interactions:**

- Tap Shop → Shop screen
- Tap Customize → Customization Hub
- Tap level bar area → Level Rewards screen
- Tap settings → Settings screen
- Tap status chip → Set Status screen

### Hero (4×4, 376px height)

```
┌────────────────────────────────────────┐
│                                     ⚙️ │
│           [PFP 88px]                   │
│         Display Name                   │
│          @username                     │
│       [😊 Having a great day]          │
│                                        │
│   This is my bio text that can span    │
│   multiple lines with a max height.    │
│                                        │
│   [🛍 Shop]     [🎨 Customize]         │
│                                        │
│   ⭐ Level 3  │  ████░░░  120/500 XP  │
│   🎁 1 reward ready              ›     │
└────────────────────────────────────────┘
```

**Content (everything):**

- Profile picture (88px, centered) with decoration
- Display name (centered, bold)
- Username (centered, secondary)
- Status chip (full emoji + text, or "Set Status" placeholder)
- Bio container (multi-line, editable on own profile)
- Action buttons: Shop, Customize (side by side)
- Rich level section:
  - Top row: level badge circle + "Level X" + XP counter + unclaimed rewards pill + chevron
  - Progress bar (colored, showing XP toward next level)
  - Bottom hint: "500 XP to next level" or "X rewards ready!"
- Settings button (cog icon, 18px) — top-right corner
- Background image support with gradient scrim

**Interactions:**

- Tap profile picture → Picture Editor modal (own profile)
- Tap bio → Bio Editor modal (own profile)
- Tap status chip → Set Status screen (own profile)
- Tap display name → Settings screen (own profile)
- Tap Shop → Shop screen
- Tap Customize → Customization Hub
- Tap level section / chevron → Level Rewards screen
- Tap settings → Settings screen

## Content Visibility by Size

| Content                |    Wide    |  Large  |  Hero   |
| ---------------------- | :--------: | :-----: | :-----: |
| Profile picture        |  ✅ 48px   | ✅ 64px | ✅ 88px |
| Display name           |     ✅     |   ✅    |   ✅    |
| Username               |     ❌     |   ✅    |   ✅    |
| Status chip            |     ❌     |   ✅    |   ✅    |
| Bio                    |     ❌     |   ❌    |   ✅    |
| Level indicator        | ✅ compact | ✅ bar  | ✅ rich |
| XP numbers             |     ❌     |   ✅    |   ✅    |
| Unclaimed rewards pill |     ❌     |   ❌    |   ✅    |
| Shop button            |     ❌     |   ✅    |   ✅    |
| Customize button       |     ❌     |   ✅    |   ✅    |
| Settings button        |     ✅     |   ✅    |   ✅    |
| Background image       |     ❌     |   ✅    |   ✅    |
| Edit picture tap       |     ❌     |   ❌    |   ✅    |
| Edit bio tap           |     ❌     |   ❌    |   ✅    |
| Edit status tap        |     ❌     |   ✅    |   ✅    |

## Settings Button Placement

The settings button (cog/gear icon) is **always visible** in all three sizes. It is positioned in the top-right corner of the widget.

| Size  | Icon Size | Appearance                                                           |
| ----- | --------- | -------------------------------------------------------------------- |
| Wide  | 20px      | Standard cog                                                         |
| Large | 16px      | Standard cog                                                         |
| Hero  | 18px      | Semi-transparent background circle when background image is equipped |

When a background image is present (large and hero sizes), the settings button gets a semi-transparent white background circle to ensure visibility against the image.

## Level/Progression Section

Level data comes from the `useProfileData` hook which returns a `LevelInfo` object:

```typescript
interface LevelInfo {
  current: number; // Current level (1+)
  xp: number; // XP toward next level
  xpToNextLevel: number; // Total XP needed for next level
  totalXp: number; // Historical total XP earned
}
```

### Compact Level (Wide, Large)

- Level badge: small circle with level number
- Progress bar: thin (4px height)
- XP text: "120/500" (large only)
- Tapping navigates to Level Rewards

### Rich Level (Hero only)

- Full row with level badge + "Level X" text + XP counter + unclaimed rewards count
- Thick progress bar (primary theme color)
- Bottom hint text: either reward count or XP remaining
- Chevron (›) indicating navigation
- Tapping anywhere on the level section navigates to Level Rewards
- Unclaimed rewards pill shows `🎁 N` when `pendingRewards.unclaimedLevelRewardCount > 0`

**At max level** (`MAX_REWARD_LEVEL`): progress bar shows 100%, text shows "MAX".

## Background Image Behavior

When the user has equipped a `backgroundId`:

- The background image fills the card area
- A gradient scrim fades from transparent (top) to dark (bottom) for text readability
- Name, username, and other text switch to white with text shadow
- On hero size, the background extends to the safe area (negative margin by `topInset`)
- Shop and Customize buttons gain semi-transparent white styling
- Settings button gets a semi-transparent background circle

When no background is equipped, the card uses the theme surface color.

## Movement and Removability Rules

| Rule                    | Behavior                                                        |
| ----------------------- | --------------------------------------------------------------- |
| **Removable**           | No — the profile hero card can never be deleted or hidden       |
| **Movable**             | Yes — it can be dragged to any valid grid position              |
| **Resizable**           | Yes — between `wide`, `large`, and `hero`                       |
| **Max instances**       | 1 — only one profile hero card exists on the board              |
| **Guaranteed on board** | Persistence validation inserts the hero card if somehow missing |

## Data Props

The profile hero card receives its data from `OwnProfileScreen` via the `widgetData["profile-header"]` payload:

```typescript
{
  displayName: string,
  username: string,
  pictureUrl: string | null,
  decorationId: string | null,
  backgroundId: string | null,
  bio: ProfileBio | null,
  status: ProfileStatus | null,
  level: LevelInfo,
  onEditPicturePress: () => void,
  onEditBioPress: () => void,
  onEditStatusPress: () => void,
  onEditNamePress: () => void,
  onLevelPress: () => void,         // → Level Rewards screen
  onCustomizePress: () => void,     // → Customization Hub
  onShopPress: () => void,          // → Shop screen
  onSettingsPress: () => void,      // → Settings screen
  unclaimedRewards: number,         // Pending level rewards count
}
```

## Other-User Profile Header

The `UserProfileHeader` component (used on `UserProfileScreen`) is **not** a widget board widget — it is rendered as a standalone card at the top of the scroll view:

- Always displays at full size (similar to hero variant)
- Avatar: 120px, non-editable
- Shows friendship details if friends: streak count + friendship duration
- Shows last active indicator if applicable
- No action buttons (those appear in `ProfileActionsBar` below)
- No edit interactions (read-only)
- Privacy-evaluated: status, bio, level may be hidden based on settings

## See Also

- [Widget Board Architecture](WIDGET_BOARD_ARCHITECTURE.md) — grid model and drag/resize mechanics
- [Profile Widgets Reference](PROFILE_WIDGETS_REFERENCE.md) — all widget types
- [Interactions and Edit Mode](INTERACTIONS_AND_EDIT_MODE.md) — customize mode behavior
