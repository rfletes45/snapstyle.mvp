# Custom Font Color System

## Overview

Users can select a custom font color for their chat messages through the Customization Hub. The default option is **theme-adaptive** — text color changes with the active theme. Any non-default custom font color is **fixed** — it stays the same regardless of theme changes.

## Data Model

### ChatAppearance (per-user, Firestore)

```typescript
interface ChatAppearance {
  bubbleColorId: string | null;
  fontId: string | null;
  fontColorId: string | null; // ← NEW: null = theme-adaptive default
  animalThemeId: string | null;
}
```

Stored at `Users/{uid}.chatAppearance` with dot-notation updates for atomic field changes.

### SenderStyle (per-message stamp)

```typescript
interface SenderStyle {
  // ... existing fields
  fontColorId?: string | null; // catalog reference
  fontColorHex?: string | null; // pre-resolved hex for forward-compat
  v: 1;
}
```

Stamped on every outgoing message via `buildSenderStyle()` so recipients can render the sender's custom font color without fetching their profile.

### ResolvedChatStyle

```typescript
interface ResolvedChatStyle {
  bubbleBgColor: string;
  bubbleTextColor: string;
  fontFamily: string | undefined;
  fontColorHex: string | null; // null = use theme token
}
```

## Resolution Logic

### Outgoing Messages

`resolveOutgoingChatStyle()` resolves `fontColorId` → hex:

1. Look up `fontColorId` in cosmetic catalog
2. Look up hex in `CHAT_FONT_COLORS` map
3. Fall back to catalog metadata (`fontColorValue`)
4. If all fail → `null` (theme-adaptive)

### Incoming Messages

`resolveIncomingBubbleStyle()` resolves from `senderStyle`:

1. Prefer pre-resolved `senderStyle.fontColorHex`
2. Fall back to catalog lookup via `senderStyle.fontColorId`
3. Fall back to metadata
4. If all fail → `null` (theme-adaptive)

## Rendering Behavior

### Stacked/Feed Mode (no bubbles)

- **Default:** `theme.colors.onSurface` — adapts to theme
- **Custom:** Fixed hex color from `fontColorHex`
- Author names, timestamps, metadata: always theme-adaptive

### Bubble Mode

- **Default:** Contrast-computed `bubbleTextColor` based on bubble background
- **Custom:** `fontColorHex` overrides `bubbleTextColor` — user's explicit choice is respected

### Where Custom Font Color Applies

| Applies                   | Does NOT Apply                   |
| ------------------------- | -------------------------------- |
| Chat message body text    | Error/destructive text           |
| Bubble mode message text  | Button labels on accent surfaces |
| Stacked mode message text | Badge/chip content               |
|                           | Status indicators                |
|                           | Navigation labels                |
|                           | Placeholder text                 |
|                           | Timestamps/metadata              |

## Catalog

16 curated colors across rarity tiers:

| Tier         | Colors                                               | Acquisition          |
| ------------ | ---------------------------------------------------- | -------------------- |
| Free/Starter | Snow (#FFFFFF), Charcoal (#2D2D2D), Silver (#B0B0B0) | Available by default |
| Common       | Sky Blue, Lavender, Mint, Rose, Peach                | 150 tokens in shop   |
| Uncommon     | Coral, Gold, Aqua, Lime                              | 250 tokens in shop   |
| Rare         | Neon Pink, Electric Blue, Emerald                    | 400 tokens in shop   |

Defined in `src/cosmetics/chatCatalog.ts` as `CHAT_FONT_COLOR_CATALOG`.

## UI

The Customization Hub (`CustomizationHubScreen.tsx`) has a "Font Colors" tab under the Chat section:

- **Default card** — prominent card with theme-light-dark icon, "Adapts automatically to your theme" description
- **Custom color grid** — swatches with "Aa" preview text, equipped checkmark
- **Empty state** — shop link when no colors are owned
- **Shop upsell** — "Want more colors?" link

Equip/unequip via `equipChatFontColor()` / `unequipChatFontColor()` in `profileService.ts`.

## Hooks

### useFontColor

Centralized hook for consumers (`src/hooks/useFontColor.ts`):

```typescript
const { textColor, textSecondaryColor, isCustom, customHex, chatTextColor } =
  useFontColor();
```

### resolveFontColor

Standalone utility for non-hook contexts:

```typescript
const color = resolveFontColor(fontColorHex, themeTextColor);
```

## Files Modified

| File                                                   | Change                                                 |
| ------------------------------------------------------ | ------------------------------------------------------ |
| `src/cosmetics/types.ts`                               | Added `fontColorId` to `ChatAppearance`, `SenderStyle` |
| `src/cosmetics/chatCatalog.ts`                         | Added `CHAT_FONT_COLOR_CATALOG` (16 entries)           |
| `src/cosmetics/chatDefaults.ts`                        | Added `CHAT_FONT_COLORS` map, `getChatFontColor()`     |
| `src/cosmetics/chatAppearanceResolver.ts`              | Added `fontColorHex` to resolver + sanitizer           |
| `src/cosmetics/index.ts`                               | Barrel exports                                         |
| `src/services/profileService.ts`                       | `equipChatFontColor()`, `unequipChatFontColor()`       |
| `src/hooks/useCustomizationHub.ts`                     | Font Colors tab, equip/unequip wiring                  |
| `src/hooks/useFontColor.ts`                            | New centralized hook                                   |
| `src/screens/customization/CustomizationHubScreen.tsx` | FontColorCard, Default card, grid UI                   |
| `src/components/chat/StackedMessageRenderer.tsx`       | Font color resolution + rendering                      |
| `src/components/chat/GroupStackedMessageRenderer.tsx`  | `fontColorHex` prop + rendering                        |
| `src/components/DMMessageItem.tsx`                     | Font color override in bubble mode                     |
| `src/screens/groups/GroupChatScreen.tsx`               | Thread fontColorHex to renderers                       |
| `src/types/userProfile.ts`                             | Added `fontColorId` to default profile                 |
| `docs/features/conversation-display-modes.md`          | Updated theme token docs                               |

## Migration / Backward Compatibility

- `sanitizeChatAppearance()` uses `{ ...DEFAULT_CHAT_APPEARANCE, ...chatAppearance }` spread — old users without `fontColorId` get `null` (theme-adaptive default)
- `senderStyle` fields are optional — old messages without `fontColorId`/`fontColorHex` render with theme defaults
- No breaking changes to existing rendering behavior
