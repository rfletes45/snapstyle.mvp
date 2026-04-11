# Grouped Card System — Stacked Message Renderer

> Comprehensive documentation for the adaptive grouped-card container system
> used in stacked (Discord-style) chat mode for both DM and group chats.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Inventory](#file-inventory)
4. [Layout System](#layout-system)
5. [Card Container Rendering](#card-container-rendering)
6. [Adaptive Width Tracking](#adaptive-width-tracking)
7. [Width Snapping](#width-snapping)
8. [Adaptive Corner Rounding](#adaptive-corner-rounding)
9. [Date Dividers](#date-dividers)
10. [Prop Wiring (Parent → Renderer)](#prop-wiring)
11. [Constants Reference](#constants-reference)
12. [Visual Examples](#visual-examples)
13. [Known Constraints](#known-constraints)

---

## Overview

The grouped card system wraps consecutive messages from the same sender into
visually unified card containers with adaptive corner rounding. Messages within
a group have **zero vertical gap** (`withinGroupGap: 0`) and share a continuous
background, creating a cohesive block. The right-edge corners of each card
adapt based on the relative widths of neighboring messages — right corners are
rounded when the current card is wider than its neighbor (exposed edge) and
flattened when the current card is the same width or narrower (flush edge).

**Key behaviors:**

- Messages from the same sender within a time window are grouped
- Each card uses a two-View structure: outer `cardWrapper` (background, radii, minWidth) wrapping inner `cardContent` (padding, self-sizing, onLayout)
- Cards use `colors.background` as their solid background color
- Adjacent cards with similar widths (within `GROUPED_CARD_SNAP_THRESHOLD = 24px`) are cluster-snapped to the widest member
- Right-edge corners round/flatten based on directional width comparison with neighbors
- Left-edge corners are always flat within groups (left-aligned, edges flush)
- Group boundary corners (first message's top, last message's bottom) are always rounded
- All card layout logic is shared via the `useGroupedCardLayout` hook and `groupedCardLayout` pure utility module

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ GroupChatScreen / ChatScreen (parent)                            │
│                                                                  │
│  ┌─ CardWidthTracker (single instance per conversation) ───────┐ │
│  │  - nodes: Map<messageId, CardWidthNode>                     │ │
│  │    (CardWidthNode: { width?, prevId?, nextId? })            │ │
│  │  - listeners: Map<messageId, Set<snapshot callback>>        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─ FlatList (inverted) ───────────────────────────────────────┐ │
│  │                                                              │ │
│  │  renderItem → for each TimelineItem:                        │ │
│  │    ├─ type: "date-divider" → <DateDivider />                │ │
│  │    └─ type: "message" →                                     │ │
│  │        ├─ Compute groupPrevMessageId / groupNextMessageId   │ │
│  │        └─ <GroupStackedMessageRenderer /> (group chats)      │ │
│  │           or <ChatMessageRenderer /> → <StackedMessageRenderer /> (DMs) │ │
│  │             └─ useGroupedCardLayout() hook                   │ │
│  │               └─ cardWrapper View (background, radii, snap)  │ │
│  │                 └─ cardContent View (onLayout → width track) │ │
│  │                   ├─ MessageHighlightOverlay                │ │
│  │                   ├─ Author header (group-start only)       │ │
│  │                   ├─ Reply preview (StackedReplyReference)  │ │
│  │                   ├─ Message content (text / image / voice) │ │
│  │                   └─ Reaction pills                         │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
onLayout (cardContent measured)
    │
    ▼
normalizeGroupedCardWidth(width)  →  Math.ceil(width / 2) * 2  (2px grid)
    │
    ▼
CardWidthTracker.report(messageId, normalizedWidth)
    │
    ├─ Stores in node.width (deduplicates if unchanged)
    ├─ Collects all message IDs in the same group (graph walk via prevId/nextId)
    └─ Notifies ALL subscribers in the affected group with CardWidthSnapshot
         │
         ▼
    useGroupedCardLayout receives snapshot via setState
         │
         ├─ buildGroupedCardRadii(snappedWidths) → border radius object
         └─ getGroupedCardMinWidth(rawWidth, snappedWidth) → minWidth
              │
              ▼
         Re-render with updated rounding + snapping
```

### Shared Logic Architecture

Card layout logic is NOT duplicated in the renderers. Instead, both
`GroupStackedMessageRenderer` and `StackedMessageRenderer` delegate to:

1. **`useGroupedCardLayout` hook** — Manages tracker subscription, layout
   callbacks, and memoized radius/snap computation
2. **`groupedCardLayout.ts` module** — Pure functions for width normalization,
   snap cluster resolution, and border radius computation
3. **`CardWidthTracker` class** — Graph-based pub/sub system with
   group-aware snapshot notifications

---

## File Inventory

| File                                                  | Purpose                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| `src/components/chat/GroupStackedMessageRenderer.tsx` | Group chat stacked renderer with card containers                  |
| `src/components/chat/StackedMessageRenderer.tsx`      | DM chat stacked renderer with card containers                     |
| `src/components/chat/useGroupedCardLayout.ts`         | Shared React hook for card layout (radii, snap, onLayout)         |
| `src/components/chat/groupedCardLayout.ts`            | Pure utility functions (radii math, snap clusters, normalization) |
| `src/components/chat/CardWidthTracker.ts`             | Graph-based width measurement + snapshot pub/sub system           |
| `src/components/chat/DateDivider.tsx`                 | Day separator with centered label in a pill-shaped box            |
| `src/components/chat/ChatMessageRenderer.tsx`         | DM entry point — delegates to Stacked or Bubble renderer          |
| `src/chat/displayMode.ts`                             | Layout tokens (`FEED_LAYOUT`) including gap/padding constants     |
| `src/screens/groups/GroupChatScreen.tsx`              | Group chat parent — instantiates tracker, computes neighbor IDs   |
| `src/screens/chat/ChatScreen.tsx`                     | DM chat parent — instantiates tracker, computes neighbor IDs      |

---

## Layout System

### FEED_LAYOUT Tokens (from `displayMode.ts`)

```typescript
export const FEED_LAYOUT: FeedLayoutTokens = {
  screenEdgeInset: 0,
  gutterWidth: 40, // Left column reserved for avatars
  gutterGap: 14, // Gap between gutter and content
  contentIndent: 54, // Total indent: 0 + 40 + 14
  avatarSize: 40, // Avatar diameter at group-start
  groupGap: 14, // Vertical space between sender groups
  withinGroupGap: 0, // NO gap between grouped messages (cards flush)
  rowPaddingV: 2, // Vertical padding per feed row
  rowPaddingH: 8, // Horizontal padding per feed row
  mediaRadius: 8, // Corner radius for media cards
  imageMaxWidth: 260, // Max image width in pixels
  imageMaxHeight: 300, // Max image height in pixels
  imageMinWidth: 140, // Min image width in pixels
  authorNameFontSize: 16,
  timestampFontSize: 12.5,
  messageFontSize: 16,
  messageLineHeight: 22.5,
  reactionRowGap: 2,
  replyPreviewGap: 4,
  selfTintOpacity: 0, // No self-message tint (disabled)
  selfAccentWidth: 0, // No self-message accent (disabled)
};
```

### Row Grid Structure

Each message row follows a fixed two-column grid:

```
┌──────────────────────────────────────────────────────────┐
│ feedRow (width: 100%, paddingHorizontal: 8)              │
│                                                          │
│  ┌──────────┐  ┌──────────────────────────────────────┐  │
│  │  gutter   │  │  contentColumn (flex: 1)             │  │
│  │  (40px)   │  │                                      │  │
│  │  + gap    │  │  ┌─ cardWrapper (outer) ───────────┐ │  │
│  │  (14px)   │  │  │  alignSelf: "flex-start"       │ │  │
│  │           │  │  │  backgroundColor: background   │ │  │
│  │  [avatar] │  │  │  overflow: "hidden"             │ │  │
│  │  or       │  │  │  [adaptive border radii]        │ │  │
│  │  [spacer] │  │  │  [minWidth: snapMinWidth]       │ │  │
│  │           │  │  │                                 │ │  │
│  │           │  │  │  ┌─ cardContent (inner) ──────┐ │ │  │
│  │           │  │  │  │  alignSelf: "flex-start"   │ │ │  │
│  │           │  │  │  │  paddingH: 12, paddingV: 6 │ │ │  │
│  │           │  │  │  │  onLayout → width tracking  │ │ │  │
│  │           │  │  │  │                            │ │ │  │
│  │           │  │  │  │  [highlight overlay]       │ │ │  │
│  │           │  │  │  │  [author header]           │ │ │  │
│  │           │  │  │  │  [reply preview]           │ │ │  │
│  │           │  │  │  │  [message content]         │ │ │  │
│  │           │  │  │  │  [reactions]               │ │ │  │
│  │           │  │  │  └────────────────────────────┘ │ │  │
│  │           │  │  └─────────────────────────────────┘ │  │
│  └──────────┘  └──────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

- **Group-start rows**: Avatar in gutter, author name + timestamp in header
- **Within-group rows**: Empty spacer in gutter (same width), no header
- **Spacing**: `marginTop: groupGap (14px)` for group-start, `marginTop: 0` within group

---

## Card Container Rendering

Each message uses a two-View structure for card chrome. The outer `cardWrapper`
owns background color, border radii, overflow clipping, and snap width. The
inner `cardContent` owns padding and the `onLayout` handler for width measurement.

```typescript
// Both renderers use the same StyleSheet split:
cardWrapper: {
  alignSelf: "flex-start",                    // Self-sizing width (shrink to content)
}
cardContent: {
  alignSelf: "flex-start",                    // Content determines natural width
  paddingHorizontal: F.rowPaddingH + 4,       // 8 + 4 = 12px horizontal padding
  paddingVertical: F.rowPaddingV + 4,          // 2 + 4 = 6px vertical padding
}

// cardWrapper — applied inline:
style={[
  s.cardWrapper,
  { backgroundColor: groupCardBg, overflow: "hidden" },  // Solid background, clip children
  groupCardRadius,                                        // Adaptive border radii object
  snapMinWidth !== undefined && { minWidth: snapMinWidth }, // Width snap constraint
  mentionRowStyle,                                        // Optional mention highlight (group only)
]}

// cardContent — applied inline:
<View onLayout={handleCardLayout} style={s.cardContent}>
  {/* children: highlight overlay, header, reply, content, reactions */}
</View>
```

### Why Two Views?

The `onLayout` handler measures the _inner content_ width, not the outer
container width. This ensures that when `minWidth` expands the outer wrapper
(snap), the measured width reflects the natural content size, preventing
feedback loops where a snap-expanded width gets re-reported.

### Background Color

- **GroupStackedMessageRenderer**: `colors.background` (from theme context prop)
- **StackedMessageRenderer**: `theme.colors.background` (from react-native-paper theme)

Both resolve to the same value — the conversation's primary background color, creating
a subtle raised-card effect against the underlying surface.

---

## Adaptive Width Tracking

### CardWidthTracker Class

A graph-based pub/sub system that tracks message widths and their group
adjacency. Each message is a node with optional prev/next links forming a
doubly-linked list per sender group. When any width changes, the tracker
resolves snap clusters across the entire connected group and notifies all
affected subscribers with a `CardWidthSnapshot`.

One instance is created per conversation screen and shared across all message
renderers via the `cardWidthTracker` prop.

```typescript
interface CardWidthNode {
  width?: number; // Measured width (normalized to 2px grid via Math.ceil(w/2)*2)
  prevId?: string; // Message ID of neighbor above in same group
  nextId?: string; // Message ID of neighbor below in same group
}

interface CardWidthSnapshot {
  rawWidth?: number; // This message's measured width
  snappedWidth?: number; // This message's cluster-resolved snapped width
  prevSnappedWidth?: number; // Neighbor above's snapped width
  nextSnappedWidth?: number; // Neighbor below's snapped width
  prevMessageId?: string; // Neighbor above's message ID
  nextMessageId?: string; // Neighbor below's message ID
}

class CardWidthTracker {
  private nodes = new Map<string, CardWidthNode>();
  private listeners = new Map<string, Set<(snapshot) => void>>();

  report(id, width); // Store normalized width + notify group
  setGroupNeighbors(id, prevId, nextId); // Update adjacency links + notify affected groups
  getWidth(id); // Read cached raw width
  getSnapshot(id); // Read full snapshot with snapped widths
  subscribe(id, callback); // Listen for snapshot changes, returns unsubscribe fn
  clear(); // Reset all nodes (notifies any remaining listeners)
}
```

### Graph Traversal

When a width is reported or neighbors change, the tracker:

1. Collects all connected message IDs by walking the prev/next links (graph traversal via stack)
2. For each affected message, resolves its `snappedWidth` by finding its snap cluster
3. Builds a `CardWidthSnapshot` with the snapped widths of self and neighbors
4. Notifies all subscribers in the affected group

### useGroupedCardLayout Hook

Both renderers delegate all card layout logic to this shared hook:

```typescript
const { handleCardLayout, groupCardRadius, snapMinWidth } =
  useGroupedCardLayout({
    messageId: item.id,
    cardWidthTracker,
    groupPrevMessageId,
    groupNextMessageId,
    isGroupStart: vm.isGroupStart,
    isGroupEnd: vm.isGroupEnd,
  });
```

The hook:

1. **Registers group neighbors** via `cardWidthTracker.setGroupNeighbors()` on mount/update
2. **Subscribes** to snapshot changes for the message ID
3. **Provides `handleCardLayout`** — the `onLayout` callback that normalizes and reports width
4. **Memoizes `groupCardRadius`** via `buildGroupedCardRadii()` from snapshot widths
5. **Memoizes `snapMinWidth`** via `getGroupedCardMinWidth()` from raw vs snapped width

### Neighbor ID Computation (Parent)

Neighbor IDs are computed in the parent screen's `renderItem` callback using
the inverted FlatList's index system:

```typescript
// IMPORTANT: List is inverted, so index+1 = visually above, index-1 = visually below
const prevTl = timelineDataRef.current[index + 1]; // message above
const nextTl = timelineDataRef.current[index - 1]; // message below

const groupPrevMessageId =
  isGroupedWithPrev && prevTl && "data" in prevTl ? prevTl.data.id : undefined;
const groupNextMessageId =
  isGroupedWithNext && nextTl && "data" in nextTl ? nextTl.data.id : undefined;
```

**Only messages within the same group** get neighbor IDs. If a message is at a
group boundary (first or last in its sender group), the corresponding neighbor
ID is `undefined`.

---

## Width Snapping

Width snapping uses a **cluster-based** algorithm. Rather than comparing only
immediate neighbors, the tracker walks the entire chain of adjacent messages
to find the connected "snap cluster" — the longest contiguous run of messages
whose pairwise widths are all within `GROUPED_CARD_SNAP_THRESHOLD = 24px`.

### Snap Cluster Resolution

```typescript
// In groupedCardLayout.ts:

function collectSnapClusterIdsInDirection(
  startId,
  getAdjacentId,
  getWidth,
  threshold,
): string[] {
  // Walk in one direction, collecting IDs as long as consecutive
  // pairs are within threshold. Stop at first gap.
}

function resolveGroupedCardSnapCluster(args): string[] {
  // Walk backward (prev chain) + forward (next chain) from messageId
  // Return the full cluster: [...prevIds, messageId, ...nextIds]
}

function resolveGroupedCardSnappedWidth(args): number | undefined {
  // Get the cluster, return Math.max of all widths in the cluster
}
```

All messages in a snap cluster are expanded to the width of the widest member.

### MinWidth Application

The hook computes `snapMinWidth` via `getGroupedCardMinWidth`:

```typescript
export function getGroupedCardMinWidth(
  rawWidth?: number,
  snappedWidth?: number,
): number | undefined {
  if (
    rawWidth === undefined ||
    rawWidth <= 0 ||
    snappedWidth === undefined ||
    snappedWidth <= 0
  ) {
    return undefined; // Not yet measured or invalid
  }
  return snappedWidth; // Always returns the snapped width when valid
}
```

Applied via inline style on the outer `cardWrapper`:

```typescript
snapMinWidth !== undefined && { minWidth: snapMinWidth };
```

### Snapping vs. Old Algorithm

The old approach compared only immediate prev/next neighbors. The new cluster
approach ensures that if messages A, B, C all have similar widths, they ALL
snap to the same max — even if A and C individually differ by more than the
threshold, as long as B bridges the gap.

---

## Adaptive Corner Rounding

### Algorithm

The rounding system determines each of the four border radii independently
using the `buildGroupedCardRadii` pure function in `groupedCardLayout.ts`:

```
GROUPED_CARD_RADIUS = 8px
GROUPED_CARD_SNAP_THRESHOLD = 24px

┌─────────────────────────────────────────────────────────────────┐
│                      SOLO MESSAGES                              │
│  All four corners = GROUPED_CARD_RADIUS (fully rounded)         │
│  ┌────────────────────────────┐                                 │
│  │  TL:8   message text  TR:8 │                                 │
│  │  BL:8               BR:8   │                                 │
│  └────────────────────────────┘                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      GROUPED MESSAGES                           │
│                                                                 │
│  LEFT EDGES: Always flush within group (consumers are left-     │
│  aligned). Only the group-start top-left and group-end          │
│  bottom-left get GROUPED_CARD_RADIUS.                           │
│                                                                 │
│  RIGHT EDGES: Determined by directional width comparison.       │
│  A corner is rounded when the current card is WIDER than its    │
│  neighbor (edge is exposed). A corner is flat (0) when the      │
│  current card is the same width or narrower than its neighbor   │
│  (edge is flush or tucked under). Unknown neighbor widths       │
│  also produce flat corners (0).                                 │
│                                                                 │
│  Group boundary corners (group-start top, group-end bottom):    │
│  always GROUPED_CARD_RADIUS regardless of width comparison.     │
└─────────────────────────────────────────────────────────────────┘
```

### Decision Matrix

| Corner           | Group Start                    | Group End                      | Within Group |
| ---------------- | ------------------------------ | ------------------------------ | ------------ |
| **Top-Left**     | `GROUPED_CARD_RADIUS`          | `0`                            | `0`          |
| **Bottom-Left**  | `0`                            | `GROUPED_CARD_RADIUS`          | `0`          |
| **Top-Right**    | `GROUPED_CARD_RADIUS` (always) | See rule ↓                     | See rule ↓   |
| **Bottom-Right** | See rule ↓                     | `GROUPED_CARD_RADIUS` (always) | See rule ↓   |

**Right-edge rule** (for non-boundary corners):

```
IF current snapped width OR adjacent snapped width is unknown:
  → 0 (flat — safe fallback, not yet measured)

IF currentWidth > adjacentWidth:
  → GROUPED_CARD_RADIUS (exposed corner — current card sticks out)

IF currentWidth ≤ adjacentWidth:
  → 0 (flush — current card is same or narrower, edge hidden)
```

### Implementation (`groupedCardLayout.ts`)

```typescript
function resolveDirectionalRightRadius(
  currentWidth: number | undefined,
  adjacentWidth: number | undefined,
  radius: number,
): number {
  if (currentWidth === undefined || adjacentWidth === undefined) {
    return 0; // Unknown → flat (safe fallback)
  }
  return currentWidth > adjacentWidth ? radius : 0;
}

export function buildGroupedCardRadii(
  args: BuildGroupedCardRadiiArgs,
): GroupedCardRadiusStyle {
  const radius = args.radius ?? GROUPED_CARD_RADIUS;
  const isSolo = args.isGroupStart && args.isGroupEnd;

  if (isSolo) {
    return { TL: radius, TR: radius, BL: radius, BR: radius };
  }

  return {
    borderTopLeftRadius: args.isGroupStart ? radius : 0,
    borderTopRightRadius: args.isGroupStart
      ? radius
      : resolveDirectionalRightRadius(
          args.currentWidth,
          args.prevWidth,
          radius,
        ),
    borderBottomLeftRadius: args.isGroupEnd ? radius : 0,
    borderBottomRightRadius: args.isGroupEnd
      ? radius
      : resolveDirectionalRightRadius(
          args.currentWidth,
          args.nextWidth,
          radius,
        ),
  };
}
```

Note: the widths passed into `buildGroupedCardRadii` are `snappedWidth`,
`prevSnappedWidth`, and `nextSnappedWidth` from the snapshot — so messages
in the same snap cluster will have identical widths, producing `0` (flat)
right-edge corners between them.

### Visual Example — Mixed Widths

```
Group of 3 messages (same sender):

  ┌──────────────────────────────────────┐   ← group-start: TL=8, TR=8
  │  Hey everyone, how's it going today? │                   BL=0, BR=8 (wider than below → rounded)
  ├──────────────────────────────────────┤   ← within-group: TL=0, TR=0 (same width as above)
  │  Just checking in with the group     │                   BL=0, BR=8 (wider than below → rounded)
  ├─────────────────┐                        ← within-group: TL=0, TR=0 (narrower than above)
  │  Sounds good!   │                                        BL=8, BR=8
  └─────────────────┘                        ← group-end:   (bottom corners forced to 8)
```

### Visual Example — Same Widths (snapped)

```
Group of 3 similar-width messages (all snap to max):

  ┌────────────────────────────┐   ← TL=8, TR=8 (group-start)
  │  Hello there friend!       │      BL=0, BR=0  (same width as below)
  ├────────────────────────────┤   ← TL=0, TR=0  (same width as above & below)
  │  How are you doing?        │      BL=0, BR=0
  ├────────────────────────────┤   ← TL=0, TR=0  (same width as above)
  │  Pretty good thanks!       │      BL=8, BR=8 (group-end)
  └────────────────────────────┘
```

---

## Date Dividers

Day separators use the `DateDivider` component — a horizontal row with two
hairline rules flanking a centered date label in a pill-shaped box.

```
  ───────────────── [ Mar 24, 2026 ] ─────────────────
```

### Structure

```typescript
<View style={styles.container}>                           // Row layout (marginVertical: 4)
  <View style={{ backgroundColor: colors.divider }} />    // Left line (flex: 1, hairlineWidth)
  <View style={{ backgroundColor: colors.background }}>   // Pill box
    <Text style={{ color: colors.textSecondary }}>         // Date text
      {label}
    </Text>
  </View>
  <View style={{ backgroundColor: colors.divider }} />    // Right line (flex: 1, hairlineWidth)
</View>
```

### Pill Box Styling

```typescript
container: {
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 16,
  paddingVertical: 12,
  marginVertical: 4,
},
labelBox: {
  paddingHorizontal: 10,
  paddingVertical: 4,
  borderRadius: 10,
  marginHorizontal: 12,
},
label: {
  fontSize: 12,
  fontWeight: "600",
  letterSpacing: 0.2,
},
```

### Theme Integration

Uses `useAppTheme()` hook (from `@/store/ThemeContext`) — not props:

- `colors.divider` — hairline rule color (adapts light/dark)
- `colors.textSecondary` — date label text color
- `colors.background` — pill background (matches card background)

---

## Prop Wiring

### Parent → Renderer Props

Both parent screens (`GroupChatScreen`, `ChatScreen`) pass three card-system props:

| Prop                 | Type                  | Source                                                                                        |
| -------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| `cardWidthTracker`   | `CardWidthTracker`    | `useMemo(() => new CardWidthTracker(), [conversationKey])` — recreated on conversation change |
| `groupPrevMessageId` | `string \| undefined` | Computed from `timelineData[index + 1]` (inverted list)                                       |
| `groupNextMessageId` | `string \| undefined` | Computed from `timelineData[index - 1]` (inverted list)                                       |

### Tracker Lifecycle

```typescript
// Conversation key — triggers fresh tracker on conversation change
const trackerConversationKey = groupId ?? "__pending-group__"; // or chatId ?? "__pending-chat__"

// Created fresh per conversation (useMemo, not useRef)
const cardWidthTracker = useMemo(() => {
  void trackerConversationKey; // Ensure dependency triggers re-creation
  return new CardWidthTracker();
}, [trackerConversationKey]);
```

Unlike the old `useRef` + `clear()` pattern, the tracker is now **recreated**
via `useMemo` when the conversation ID changes. This naturally garbage-collects
the old instance and all its state.

### ChatMessageRenderer (DM bridge)

For DM chats, `ChatScreen` → `ChatMessageRenderer` → `StackedMessageRenderer`.
The `ChatMessageRenderer` passes through all three props transparently:

```typescript
<StackedMessageRenderer
  // ...other props...
  cardWidthTracker={cardWidthTracker}
  groupPrevMessageId={groupPrevMessageId}
  groupNextMessageId={groupNextMessageId}
/>
```

---

## Constants Reference

| Constant                      | Value               | Location               | Description                                 |
| ----------------------------- | ------------------- | ---------------------- | ------------------------------------------- |
| `GROUPED_CARD_RADIUS`         | `8`                 | `groupedCardLayout.ts` | Corner radius for rounded edges             |
| `GROUPED_CARD_SNAP_THRESHOLD` | `24`                | `groupedCardLayout.ts` | Max width diff for snap cluster membership  |
| `withinGroupGap`              | `0`                 | `FEED_LAYOUT`          | Zero gap between grouped messages           |
| `groupGap`                    | `14`                | `FEED_LAYOUT`          | Vertical space between sender groups        |
| `rowPaddingH`                 | `8`                 | `FEED_LAYOUT`          | Horizontal row padding                      |
| `rowPaddingV`                 | `2`                 | `FEED_LAYOUT`          | Vertical row padding                        |
| `cardContent.paddingH`        | `12`                | StyleSheet             | `rowPaddingH + 4` — inner card padding      |
| `cardContent.paddingV`        | `6`                 | StyleSheet             | `rowPaddingV + 4` — inner card padding      |
| `groupCardBg`                 | `colors.background` | Both renderers         | Solid card fill color                       |
| `imageMaxWidth`               | `260`               | `FEED_LAYOUT`          | Max image width in pixels                   |
| `imageMaxHeight`              | `300`               | `FEED_LAYOUT`          | Max image height in pixels                  |
| `imageMinWidth`               | `140`               | `FEED_LAYOUT`          | Min image width in pixels                   |
| `authorNameFontSize`          | `16`                | `FEED_LAYOUT`          | Author name font size                       |
| `timestampFontSize`           | `12.5`              | `FEED_LAYOUT`          | Timestamp font size                         |
| `messageFontSize`             | `16`                | `FEED_LAYOUT`          | Message text font size                      |
| `messageLineHeight`           | `22.5`              | `FEED_LAYOUT`          | Message text line height                    |
| `reactionRowGap`              | `2`                 | `FEED_LAYOUT`          | Space between reaction row and message body |
| `selfTintOpacity`             | `0`                 | `FEED_LAYOUT`          | Self-message tint (disabled)                |
| `selfAccentWidth`             | `0`                 | `FEED_LAYOUT`          | Self-message accent (disabled)              |

---

## Known Constraints

### Inverted FlatList

The chat list uses an inverted FlatList (`scaleY: -1`). This means:

- `index + 1` = message visually **above** (older)
- `index - 1` = message visually **below** (newer)
- `marginTop` in styles becomes visual **bottom** spacing after the flip
- The `feedRowGroupStart` and `feedRowWithinGroup` styles use `marginTop` which
  works correctly because the flip applies uniformly

### Width Measurement Timing

- Cards render with `rawWidth = undefined` initially (before `onLayout` fires)
- Neighbor snapped widths start as `undefined` (before tracker computes snapshots)
- Widths are normalized to a **2px grid** (`Math.ceil(width / 2) * 2`) to eliminate
  sub-pixel rounding differences that caused 1px misalignment between similar messages
- The rounding algorithm defaults to `0` (flat) for unknown widths — unlike the previous
  behavior which defaulted to rounded. This means **first frame shows flat corners**
  that settle into the correct adaptive shape on second frame
- After layout, `CardWidthTracker.report()` triggers group-wide snapshot notifications
  which update all affected subscribers

### Two-View Card Structure

- `onLayout` is on the **inner** `cardContent` View, not the outer `cardWrapper`
- This prevents feedback loops: when `minWidth` expands the outer wrapper for snapping,
  the inner content's measured width remains unchanged, so it doesn't re-report a
  larger width that would cascade to other messages

### Width Snapping Direction

- Snapping always expands narrower cards to match the widest in the snap cluster (`Math.max`)
- Snapping is only applied via `minWidth` style on the outer `cardWrapper`, not by resizing content
- Very long text will still word-wrap at the content column's available width

### Cluster-Based Snapping

- Snap clusters are resolved transitively: if A↔B and B↔C are each within threshold,
  all three snap to `max(A, B, C)` even if `|A - C| > threshold`
- Cluster resolution walks the prev/next chain, not a global pass — it's scoped to the
  connected sender group

### Shared Logic

Both `GroupStackedMessageRenderer` and `StackedMessageRenderer` share the
same card logic via the `useGroupedCardLayout` hook and `groupedCardLayout.ts`
pure functions. Any change to card behavior applies to both renderers
automatically.

### Renderer Differences

While card layout logic is shared, the renderers differ in:

- **GroupStackedMessageRenderer**: Receives `colors` prop, uses `@mention` row highlighting
  with tint + left accent border, uses `MessageWithMentions` for text rendering,
  thread press via `onThreadPress` callback prop
- **StackedMessageRenderer**: Uses `useTheme()` from react-native-paper directly, no mention
  highlighting (DMs have no mentions), uses plain `Text` for text rendering, manages its
  own link preview state via `useLinkPreviews` hook, thread press navigates directly via
  `navigation.navigate("ThreadView", ...)`, has `gutterSpacer` with extra `marginRight`
