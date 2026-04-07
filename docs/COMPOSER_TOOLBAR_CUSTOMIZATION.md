# Composer Toolbar Customization

Architecture documentation for the customizable chat composer toolbar system.

## Overview

The composer toolbar allows users to customize the buttons in the chat input bar. Users can:

- **Reorder** buttons by long-pressing and dragging horizontally
- **Add** new buttons from a picker menu
- **Remove** buttons they don't use (except the message bar)
- **Resize** the message bar horizontally (flex weight adjustment)

The system is modeled after the profile WidgetBoard's drag-and-drop architecture, adapted for a 1D horizontal toolbar.

## Architecture

### Data Model

```
ComposerToolbarLayout (Firestore document)
├── schemaVersion: number
└── items: ComposerToolbarItem[]
    ├── id: ComposerToolbarItemId  (e.g., "camera", "message-bar", "game")
    ├── position: number           (0-based left-to-right order)
    └── flexWeight?: number        (only for "message-bar", 0.3–0.8)
```

**Item IDs** (`ComposerToolbarItemId`):
| ID | Description | Removable | Default |
|-----|-------------|-----------|---------|
| `message-bar` | Text input + voice button | No | Yes (pos 1) |
| `camera` | Camera (tap) + gallery (hold) | Yes | Yes (pos 0) |
| `game` | Open game picker | Yes | Yes (pos 2) |
| `animal` | Send/pick animal | Yes | Yes (pos 3) |
| `send` | Dedicated send button | Yes | No |
| `emoji` | Emoji picker | Yes | No |
| `schedule` | Schedule message | Yes | No |
| `gif` | GIF picker (KLIPY-powered) | Yes | No |
| `sticker` | Sticker picker (KLIPY-powered) | Yes | No |
| `gif-sticker` | Combined GIF + Sticker picker | Yes | No |
| `image-picker` | Photo library image picker | Yes | No |

### Default Layout

```
[Camera] [Message Bar (flex: 1)] [Game] [Animal]
```

This matches the original hardcoded layout exactly. Users who never customize see no change.

## File Structure

```
src/components/chat/ComposerToolbar/
├── types.ts                        # Data model, constants, default layout
├── ComposerToolbarRegistry.ts      # Item definitions (icon, name, category, constraints)
├── ComposerToolbarItem.tsx         # Draggable item wrapper (pan gesture + animation)
├── ComposerToolbarRow.tsx          # Horizontal row orchestrator (swap logic)
├── ComposerItemPicker.tsx          # Bottom sheet for adding items
├── ComposerCustomizeToolbar.tsx    # Floating Cancel/Done/Add toolbar
└── index.ts                        # Barrel exports

src/components/chat/
├── SendButton.tsx                  # Dedicated send button component
├── EmojiButton.tsx                 # Emoji picker button component
└── ChatComposer.tsx                # Main composer (refactored to use toolbar row)

src/hooks/
└── useComposerToolbarLayout.ts     # State + persistence hook
```

## Persistence

### Dual-Write Pattern

The toolbar layout uses the same dual-write pattern as other settings:

1. **AsyncStorage** — `@composer_toolbar_{uid}` — instant boot cache
2. **Firestore** — `Users/{uid}/settings/composerToolbar` — authoritative cross-device sync

**Load sequence:**

1. Read from AsyncStorage (instant, no network)
2. Read from Firestore (authoritative)
3. If Firestore has data → use it, update cache
4. If no Firestore data → persist defaults to both stores
5. Subscribe to real-time updates (onSnapshot) with echo-guard

**Save sequence:**

1. Update React state immediately
2. Write to AsyncStorage (best-effort)
3. Write to Firestore with echo-guard (500ms pause on listener)

### Edit Mode State Tiers

```
Persisted (Firestore + AsyncStorage)
    ↓ [enter edit mode]
Snapshot (saved for cancel/revert)
    ↓
Working State (live edits)
    ↓ [done]
Persisted (committed)
```

## Drag-and-Drop System

### Entry

- **Long-press** (500ms) any toolbar item in normal mode → enters edit mode
- Edit mode shows: dashed outlines, delete badges (×), floating toolbar

### Dragging

- Uses `react-native-gesture-handler` `PanGestureHandler` + `react-native-reanimated` shared values
- **Frozen-origin pattern**: On drag start, freeze position; visual = origin + gesture translation
- **Swap threshold**: When dragged item crosses 60% of neighbor's width, swap positions
- **200ms cooldown** between swaps to prevent oscillation
- **Haptic feedback** on drag start, swap, and drop

### Animation

- Spring configs: `damping: 18, stiffness: 120, mass: 0.8` (passive reflow)
- Snap spring: `damping: 15, stiffness: 150, mass: 0.5` (active drop)
- `ReduceMotion.Never` — functional animation that always runs

### Visual Feedback

- Dragged item scales to 1.08× and gets elevated zIndex
- Dashed border outline in edit mode (primary color when dragging)
- Delete badges (×) on removable items

## Adding New Toolbar Items

To add a new button type:

### 1. Add the ID to `types.ts`

```typescript
export type ComposerToolbarItemId =
  | "message-bar"
  | "camera"
  // ... existing ...
  | "my-new-button"; // Add here
```

### 2. Register in `ComposerToolbarRegistry.ts`

```typescript
{
  itemId: "my-new-button",
  displayName: "My Button",
  description: "Does something cool.",
  icon: "star-outline",
  category: "actions",
  canRemove: true,
  canResize: false,
  maxInstances: 1,
  defaultPosition: 5,
  available: true,  // false for "coming soon"
},
```

### 3. Add rendering in `ChatComposer.tsx`

In the `renderToolbarItem` switch statement:

```typescript
case "my-new-button":
  return onMyButtonPress ? (
    <IconButton
      icon="star-outline"
      size={24}
      onPress={onMyButtonPress}
      style={styles.actionButton}
    />
  ) : null;
```

### 4. Add prop to `ChatComposerProps`

```typescript
onMyButtonPress?: () => void;
```

### 5. Wire in screens

Pass the handler from `ChatScreen.tsx` and/or `GroupChatScreen.tsx`.

## Constraints

- **Maximum 6 items** in the toolbar (prevents overflow)
- **Message bar cannot be removed** (enforced in registry and UI)
- **One instance per item type** (no duplicates)
- **Layout is per-user**, not per-conversation
- **Voice button stays inside the message bar** (contextual to empty state)
- **Same layout for DM and Group chats** (consistent UX)

## Key Design Decisions

1. **1D horizontal layout** (not 2D grid) — simpler, fits the single-row composer
2. **Flex weight for message bar** — allows proportional sizing alongside other buttons
3. **Registry pattern** — declarative item definitions make adding new buttons trivial
4. **Snapshot-based revert** — cancel in edit mode restores exact pre-edit state
5. **Echo-guard on save** — prevents Firestore listener from overwriting local state during save
6. **Coming soon items** — registered but `available: false`, shown grayed in picker

## Testing Checklist

- [ ] Default layout renders as `[Camera] [Input+Voice] [Game] [Animal]`
- [ ] Long-press enters edit mode (dashed outlines, × badges, floating toolbar)
- [ ] Drag reorders with spring animation, haptic feedback
- [ ] Delete removes item, message bar × is absent
- [ ] "+" opens picker with ungrouped available items
- [ ] Add item from picker → appears in toolbar
- [ ] Cancel reverts all edits
- [ ] Done persists to Firestore and AsyncStorage
- [ ] Kill app → custom layout loads from cache
- [ ] Send button works when added
- [ ] Emoji button opens picker, inserts emoji
- [ ] No regression in keyboard, voice, animal picker
- [ ] Both DM and Group screens work
