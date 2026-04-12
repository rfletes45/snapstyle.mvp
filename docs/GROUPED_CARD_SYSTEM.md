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
6. [Thread Indicator Placement](#thread-indicator-placement)
7. [Adaptive Width Tracking](#adaptive-width-tracking)
8. [Width Snapping](#width-snapping)
9. [Adaptive Corner Rounding](#adaptive-corner-rounding)
10. [First-Paint Strategy](#first-paint-strategy)
11. [Date Dividers](#date-dividers)
12. [Prop Wiring (Parent → Renderer)](#prop-wiring)
13. [Constants Reference](#constants-reference)
14. [Visual Examples](#visual-examples)
15. [Known Constraints](#known-constraints)

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
- Thread indicators for mid-group messages render **inline** inside the card to preserve grouped continuity
- Cards render immediately at full opacity with deterministic flag-based corners — no opacity gate or delayed pop-in
- All card layout logic is shared via the `useGroupedCardLayout` hook and `groupedCardLayout` pure utility module

### Grouping Rules

Grouping is determined by `buildTimeline()` in `src/chat/buildTimeline.ts`.
Two adjacent messages are grouped when they satisfy all of:

1. **Same sender** (`senderId` match)
2. **Within time threshold** (`MESSAGE_GROUP_THRESHOLD_MS = 2 minutes`)
3. **Neither message is a reply** (`replyTo` is falsy on both)
4. **Same calendar day** (grouping is broken at day boundaries)
5. **Neither is a system message** (group chats only)

**Important:** Grouping is NOT broken by `replyCount` (thread roots). A message
that is the root of a thread can appear in the middle of a grouped run. This is
why thread indicator placement must be handled carefully (see
[Thread Indicator Placement](#thread-indicator-placement)).

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
│  │                   ├─ Reaction pills                         │ │
│  │                   └─ ThreadIndicator (inline, mid-group)    │ │
│  │               └─ ThreadIndicator (external, group-end/solo) │ │
│  │                                                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
buildTimeline(messages)
    │
    ▼
TimelineItem[] with precomputed isGroupedWithPrevious / isGroupedWithNext
    │
    ├─ useMemo: seed estimated widths for cold-cache rows
    │    │
    │    ├─ estimateMessageWidth() — predict width from text/media/metadata
    │    └─ cardWidthTracker.seedBatch() — pre-populate WITHOUT overwriting cache
    │
    ▼
Renderer receives raw grouping flag props (primitives)
    │
    ├─ useMemo builds MessageViewModel internally (stable on same flags)
    │
    ▼
MessageViewModel with isGroupStart, isGroupEnd, threadPlacement, etc.
    │
    ▼
useState lazy initializer:  getSnapshot(messageId) → estimated OR cached width
    │
    ▼
useLayoutEffect (BEFORE first paint)
    │
    ├─ cardWidthTracker.setGroupNeighbors() — establish graph links
    ├─ stableSetSnapshot(getSnapshot()) — read cached/estimated widths
    └─ subscribe(messageId, stableSetSnapshot) — listen for future updates
    │
    ▼
First paint: corners from flags + estimated/cached widths
    │   (cold rows: ~correct radii from estimates)
    │   (warm rows: fully resolved from cache)
    │
    ▼
onLayout (cardContent measured)
    │
    ▼
normalizeGroupedCardWidth(width)  →  Math.ceil(width / 2) * 2  (2px grid)
    │
    ▼
CardWidthTracker.report(messageId, normalizedWidth)
    │
    ├─ Stores in node.width (deduplicates if unchanged)
    ├─ Clears estimatedIds flag (now measured)
    ├─ Caches in cross-instance WIDTH_CACHE (persists across tracker instances)
    └─ Enqueues coalesced async notification via setTimeout(0)
         │
         ▼   (all reports within a JS turn are merged into ONE flush)
    stableSetSnapshot receives snapshot
         │
         ├─ snapshotWidthsEqual() comparison — skip if unchanged
         ├─ buildGroupedCardRadii(snappedWidths) → refined border radius object
         └─ getGroupedCardMinWidth(rawWidth, snappedWidth) → minWidth
              │
              ▼
         Single coalesced re-render with final rounding + snapping
         (if estimate was accurate: no visible change)
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
| `src/components/chat/estimateMessageWidth.ts`         | Pre-mount width estimation for cold-cache rows                    |
| `src/components/chat/ThreadIndicator.tsx`             | "View thread (N replies)" link — inline or external placement     |
| `src/components/chat/DateDivider.tsx`                 | Day separator with centered label in a pill-shaped box            |
| `src/components/chat/ChatMessageRenderer.tsx`         | DM entry point — delegates to Stacked or Bubble renderer          |
| `src/chat/displayMode.ts`                             | Layout tokens, `MessageViewModel`, `buildMessageViewModel()`      |
| `src/chat/buildTimeline.ts`                           | Precomputes grouping flags + date dividers from message array     |
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

// cardContent — applied inline with adaptive vertical padding:
<View
  onLayout={handleCardLayout}
  style={[
    s.cardContent,
    { paddingTop: cardPaddingTop, paddingBottom: cardPaddingBottom },
  ]}
>
  {/* children: highlight overlay, header, reply, content, reactions */}
  {/* + inline ThreadIndicator when vm.threadPlacement === "inline" */}
</View>
```

### Vertical Padding Tightening

Within-group cards use reduced vertical padding to create a tighter visual
run. The padding adapts based on group position:

```typescript
const CARD_PAD_V = F.rowPaddingV + 4; // 6px — at group boundaries & solo
const CARD_PAD_V_INNER = 2; // 2px — between grouped cards

const cardPaddingTop = vm.isGroupStart ? CARD_PAD_V : CARD_PAD_V_INNER;
const cardPaddingBottom = vm.isGroupEnd ? CARD_PAD_V : CARD_PAD_V_INNER;
```

### Why Two Views?

The `onLayout` handler measures the _inner content_ width, not the outer
container width. This ensures that when `minWidth` expands the outer wrapper
(snap), the measured width reflects the natural content size, preventing
feedback loops where a snap-expanded width gets re-reported.

### No Opacity Gate

Cards render at full opacity (`1`) immediately on first paint. There is no
opacity gate hiding cards while geometry settles. The initial shape from
grouping flags alone is correct enough:

- **Left edges**: Deterministic from group position (always 0 within group)
- **Boundary corners**: Always `GROUPED_CARD_RADIUS` (group-start top, group-end bottom)
- **Right edges**: Default to flat (`0`) for unknown widths — correct for the common
  same-width case where snapped messages produce identical widths

The cross-instance width cache in `CardWidthTracker` pre-seeds widths for
messages the user has seen before, so re-opened conversations start with
fully resolved corners on frame 1.

### Background Color

- **GroupStackedMessageRenderer**: `colors.background` (from theme context prop)
- **StackedMessageRenderer**: `theme.colors.background` (from react-native-paper theme)

Both resolve to the same value — the conversation's primary background color, creating
a subtle raised-card effect against the underlying surface.

---

## Thread Indicator Placement

### Problem

Thread root messages (`replyCount > 0`) can appear in the middle of a grouped
run because `areMessagesGrouped` breaks on `replyTo` (reply messages) but NOT
on `replyCount` (thread roots). If the thread indicator is always rendered
outside the card in a separate row, it creates a visual gap between consecutive
flush cards, breaking the grouped continuity.

### Solution: `threadPlacement` View-Model Property

The `MessageViewModel` includes a `threadPlacement` field. In the
`GroupStackedMessageRenderer`, the VM is built internally via `useMemo` from
raw primitive flag props, making it stable across re-renders when the flags
don't change:

```typescript
threadPlacement: !p.hasThread
  ? "none"                        // No thread indicator needed
  : p.isGroupedWithNext
    ? "inline"                    // Mid-group → inside the card
    : "external",                 // Group-end or solo → below the card
```

| Value        | When                                     | Rendering Location                                   |
| ------------ | ---------------------------------------- | ---------------------------------------------------- |
| `"none"`     | `replyCount` is 0 or falsy               | Not rendered                                         |
| `"inline"`   | Thread root AND grouped with next        | Inside `cardContent`, after reactions                |
| `"external"` | Thread root AND group-end / solo message | In a separate `threadRow` below the TouchableOpacity |

### Inline Rendering (mid-group)

When `vm.threadPlacement === "inline"`, the `ThreadIndicator` renders inside
the `cardContent` View, after reaction pills. It inherits the card's
background and participates in the card's width (measured by `onLayout`):

```typescript
{/* Inside cardContent, after reactions */}
{vm.threadPlacement === "inline" && (
  <ThreadIndicator
    replyCount={message.replyCount!}
    isOutgoing={isSentByMe}
    onPress={handleThreadPress}
  />
)}
```

This preserves grouped continuity — the thread link is visually part of the
card, with no gap between this card and the next.

### External Rendering (group-end / solo)

When `vm.threadPlacement === "external"`, the `ThreadIndicator` renders in a
separate row below the card, aligned to the content column:

```typescript
{/* Outside the TouchableOpacity, after the card */}
{vm.threadPlacement === "external" && (
  <View style={s.threadRow}>
    <View style={s.gutterSpacer} />
    <ThreadIndicator
      replyCount={message.replyCount!}
      isOutgoing={isSentByMe}
      onPress={handleThreadPress}
    />
  </View>
)}
```

At group-end there is no message below in the group, so the external position
does not break any grouped continuity.

### Visual Example — Thread Root in Mid-Group

```
Group of 3 messages (same sender), middle has a thread:

  ┌──────────────────────────────────────┐   ← group-start
  │  Hey everyone, how's it going today? │
  ├──────────────────────────────────────┤   ← within-group (thread root)
  │  Anyone up for a game later?         │
  │  💬 View thread (3 replies)          │   ← INLINE inside card
  ├──────────────────────────────────────┤   ← within-group (flush, no gap)
  │  Let me know!                        │
  └──────────────────────────────────────┘   ← group-end
```

### Visual Example — Thread Root at Group-End

```
Group of 2 messages (same sender), last has a thread:

  ┌──────────────────────────────────────┐   ← group-start
  │  Hey everyone, how's it going today? │
  ├──────────────────────────────────────┤   ← group-end (thread root)
  │  Anyone up for a game later?         │
  └──────────────────────────────────────┘
  💬 View thread (3 replies)                 ← EXTERNAL below card
```

### ThreadIndicator Component

The `ThreadIndicator` component (`src/components/chat/ThreadIndicator.tsx`)
renders a horizontal row with a reply icon and a "View thread (N replies)"
text link. It uses `useAppTheme()` for the `colors.primary` accent color.

```typescript
<TouchableOpacity onPress={onPress} style={styles.container}>
  <MaterialCommunityIcons name="message-reply-text-outline" size={14} />
  <Text style={styles.text}>{label}</Text>
</TouchableOpacity>
```

The component is `React.memo`'d and has its own `TouchableOpacity`, which
works correctly when nested inside the card's `TouchableOpacity` (same
pattern as `StackedReplyReference`).

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

The hook returns three values:

- **`handleCardLayout`** — `onLayout` callback that normalizes and reports width
- **`groupCardRadius`** — Memoized border radius object from `buildGroupedCardRadii()`
- **`snapMinWidth`** — Memoized snap width from `getGroupedCardMinWidth()`

The hook:

1. **Pre-seeds from width cache** on mount via `cardWidthTracker.getSnapshot()` (in `useState` lazy initializer)
2. **Registers group neighbors** via `cardWidthTracker.setGroupNeighbors()` in `useLayoutEffect` (before first paint)
3. **Reads snapshot after neighbor setup** via `stableSetSnapshot(getSnapshot())` — skips re-render if width data is unchanged from the initial state (common for cold-cache rows)
4. **Subscribes** to snapshot changes with a stable setter that uses `snapshotWidthsEqual()` to prevent re-renders from object reference inequality
5. **Memoizes** radii and snap width from the latest snapshot

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

## First-Paint Strategy

The grouped card system is designed to render cards in their correct grouped
shape on the very first frame, with no visible pop-in, delayed regrouping, or
"correct itself after render" effect.

### Why Cards Appear Correct on First Frame

The system uses a multi-layer strategy to achieve instant-correct rendering:

#### 1. Precomputed Grouping Flags (Zero Runtime Cost)

Grouping flags (`isGroupedWithPrevious`, `isGroupedWithNext`) are computed in
`buildTimeline()` before any row renders. The parent screen passes these as
**primitive boolean props** to the renderer. Inside `GroupStackedMessageRenderer`,
the derived `MessageViewModel` (including `isGroupStart`, `isGroupEnd`,
`threadPlacement`) is built via `useMemo` from those primitives — stable across
re-renders when flags are unchanged, and zero-cost when `React.memo` short-
circuits the render entirely. No row-level effect or state is needed for
grouping decisions.

#### 2. Deterministic Initial Corners

Before any width measurement (`onLayout`) fires, cards render with
deterministic corners based solely on group position flags:

| Corner Position | Initial Value (pre-measurement) | Why                              |
| --------------- | ------------------------------- | -------------------------------- |
| Group-start TL  | `GROUPED_CARD_RADIUS` (8)       | Always rounded at group boundary |
| Group-start TR  | `GROUPED_CARD_RADIUS` (8)       | Always rounded at group boundary |
| Group-end BL    | `GROUPED_CARD_RADIUS` (8)       | Always rounded at group boundary |
| Group-end BR    | `GROUPED_CARD_RADIUS` (8)       | Always rounded at group boundary |
| Within-group    | `0` (flat)                      | Unknown widths default to flat   |

The flat-corners default is correct for the common case where adjacent
messages have similar widths (which snap to the same value, producing flat
right edges). Only when messages have significantly different widths will
the right-edge corners change from flat to rounded after measurement — a
subtle 8px radius change on one corner.

#### 3. Cross-Instance Width Cache

`CardWidthTracker` maintains a static `WIDTH_CACHE` (Map, max 5000 entries)
that persists across tracker instances. When a conversation is re-opened:

- The new tracker pre-seeds node widths from the cache in `ensureNode()`
- `useGroupedCardLayout` reads the pre-seeded snapshot on mount via the `useState` lazy initializer
- `useLayoutEffect` reads the snapshot after neighbor setup — for warm-cache rows this includes neighbor widths → fully resolved corners before first paint
- Cards start with their previously measured widths → fully resolved corners

This means re-visiting a conversation produces pixel-perfect first-frame
rendering with no corner or width adjustments.

**Important limitation**: The width cache only contains entries for messages
that have been previously measured in this session. Newly paginated history
(scrolling upward to load older messages) is always cold-cache. The cache
helps re-opened conversations and remounted cells, not first-ever renders
of previously unseen messages.

#### 4. Pre-Mount Width Estimation (Cold Rows)

For cold-cache rows (newly paginated history, first-ever conversation load),
the system pre-seeds estimated widths into `CardWidthTracker` before rows mount:

**Estimator** (`estimateMessageWidth.ts`):

- Pure function that predicts card-content width from message metadata
- Text messages: per-character width accounting for script categories:
  - Latin/Cyrillic/narrow glyphs: `8.2px` per character
  - CJK ideographs (Chinese/Japanese/Korean): `16px` per character
  - Emoji: `16px` per character
  - Mixed text: weighted average across character classes
- Text width = `charCount × effectiveCharWidth + CARD_PADDING_H(24)`,
  clamped to the available content column
- Media messages: Uses the same image-sizing formula as the renderer
  (`imageMaxWidth`, `imageMaxHeight`, `imageMinWidth`)
- Applies minimum-width boosts for author headers, reply previews, thread
  indicators, and reaction pills
- Normalizes to the 2px grid via `normalizeGroupedCardWidth()`
- Accepts optional `screenWidth` parameter for reactive dimension tracking
- Target: within `GROUPED_CARD_SNAP_THRESHOLD` (24px) of true measured width,
  not pixel-perfect

**Seeding pipeline** (`GroupChatScreen.tsx` and `ChatScreen.tsx`):

- A `useMemo` keyed on `[timelineData, cardWidthTracker, displayMode, windowWidth]`
  iterates all message timeline items and calls `cardWidthTracker.seedBatch()`
  with estimated widths
- Reaction presence is sourced from `msg.reactionsSummary` (on the MessageV2
  object) rather than the async reactions ref — no lag from pending Firestore
  subscriptions
- `screenWidth` is provided via `useWindowDimensions()` — stays current after
  rotation or split-screen changes
- `seedBatch()` pre-populates tracker nodes WITHOUT overwriting existing
  measured widths or cross-instance `WIDTH_CACHE` entries
- Runs synchronously during render, before row components mount
- Applied to **both** group chats and DM chats
- When `useGroupedCardLayout`'s `useState` lazy initializer calls
  `getSnapshot()`, the estimated width is already present → first paint
  uses approximately correct right-edge radii and snap minWidth

**Lifecycle**:

1. `timelineData` changes (pagination loads new messages)
2. Seeding `useMemo` runs → `seedBatch()` populates estimated widths
3. New row components mount → `useState(() => getSnapshot())` reads estimates
4. `useLayoutEffect` confirms snapshot (no change for cold rows → skip render)
5. `onLayout` fires → `report()` overwrites estimate with real measurement
6. `report()` clears the `estimatedIds` flag for that message
7. If real width differs from estimate, coalesced notification triggers
   a re-render — typically a subtle corner refinement

#### 5. Pre-Paint Setup via `useLayoutEffect`

The `useGroupedCardLayout` hook uses `useLayoutEffect` (not `useEffect`) for
neighbor registration and snapshot reading. `useLayoutEffect` runs synchronously
after React commits but BEFORE the frame is painted on screen. If a state update
occurs in `useLayoutEffect`, React re-renders synchronously before paint.

This provides two benefits:

- **Warm cache**: The first visible frame already includes resolved neighbor
  widths from cache (previously, `useEffect` ran AFTER paint, causing a
  visible flash of incorrect corners)
- **Cold cache**: The `stableSetSnapshot` comparison detects that all width
  fields are still `undefined` (same as the initial state) and skips the
  re-render entirely — zero wasted renders

#### 6. Coalesced Notifications + Snapshot Comparison

All `CardWidthTracker` notifications (both from `report()` and
`setGroupNeighbors()`) are coalesced via `setTimeout(0)`. Multiple calls
within the same JS turn are merged into a single flush. This eliminates
the O(N²) cascade storm that previously occurred during pagination: each
`report()` would synchronously notify all N group members, and with N
messages reporting, that was N×N subscriber calls.

Additionally, the subscriber uses a `snapshotWidthsEqual()` comparison
that only triggers a React state update when width-relevant fields
(`rawWidth`, `snappedWidth`, `prevSnappedWidth`, `nextSnappedWidth`)
actually changed. This eliminates re-renders from object reference
inequality where the underlying data is identical.

### What Can Still Change After First Frame

One coalesced refinement pass occurs after `onLayout` fires for all newly
mounted cards:

1. **Right-edge corners**: A within-group card may go from flat (0) to
   rounded (8) if it is significantly wider than its neighbor. This is a
   single-corner, 8px change — not a shape or position jump.

2. **Snap width**: A card may widen by up to `GROUPED_CARD_SNAP_THRESHOLD`
   (24px) when its snap cluster resolves. Applied via `minWidth` on the
   outer wrapper, so content doesn't reflow — only the right edge grows.

For the **common case** of same-width messages within a snap cluster, the
initial flat right-edge corners are already correct (equal snapped widths
produce `0`). These rows render once and never re-render for width
refinement. Only mixed-width groups see the subtle corner change.

### FlatList Virtualization Tuning

The chat list uses aggressive virtualization settings to keep cells mounted
and prevent blank-space flicker during fast scrolling:

```typescript
windowSize: 101,              // 50 screens above + 1 viewport + 50 below
initialNumToRender: 20,       // Snappy first paint
maxToRenderPerBatch: 50,      // Fast fill during flings
updateCellsBatchingPeriod: 16, // One frame (60 fps)
removeClippedSubviews: false,  // Must stay false on inverted lists
```

This keeps virtually every loaded message mounted, so the width cache is
populated for all visible and nearby messages without needing `onLayout`
to re-fire on scroll.

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

### Parent → Renderer Props (Card System)

Both parent screens (`GroupChatScreen`, `ChatScreen`) pass three card-system props:

| Prop                 | Type                  | Source                                                                                        |
| -------------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| `cardWidthTracker`   | `CardWidthTracker`    | `useMemo(() => new CardWidthTracker(), [conversationKey])` — recreated on conversation change |
| `groupPrevMessageId` | `string \| undefined` | Computed from `timelineData[index + 1]` (inverted list)                                       |
| `groupNextMessageId` | `string \| undefined` | Computed from `timelineData[index - 1]` (inverted list)                                       |

### GroupStackedMessageRenderer — Raw Flag Props

`GroupChatScreen` passes raw primitive flags instead of a pre-built
`MessageViewModel` object. This allows `React.memo`'s default shallow
comparison to detect unchanged props and skip re-renders entirely.

| Prop                    | Type      | Source (in `renderMessage`)                              |
| ----------------------- | --------- | -------------------------------------------------------- |
| `isGroupedWithPrevious` | `boolean` | From `buildTimeline()` grouping computation              |
| `isGroupedWithNext`     | `boolean` | From `buildTimeline()` grouping computation              |
| `hasReactions`          | `boolean` | `(messageReactionsRef.current.get(id) ?? []).length > 0` |
| `hasReplyPreview`       | `boolean` | `!!item.replyTo`                                         |
| `hasThread`             | `boolean` | `!!item.replyCount && item.replyCount > 0`               |

The renderer builds the `MessageViewModel` internally via `useMemo`:

```typescript
const vm = useMemo(
  () =>
    buildMessageViewModel({
      isMine: isOwnMessage,
      isGroupChat: true,
      isGroupedWithPrevious,
      isGroupedWithNext,
      isSystemMessage: false,
      hasReactions,
      hasReplyPreview,
      hasThread,
      displayMode: "stacked",
    }),
  [
    isOwnMessage,
    isGroupedWithPrevious,
    isGroupedWithNext,
    hasReactions,
    hasReplyPreview,
    hasThread,
  ],
);
```

### GroupStackedMessageRenderer — Stable Callbacks

Callback props use stable parent-level `useCallback` refs. The renderer wraps
them in its own `useCallback` to bind per-message data:

| Prop            | Signature (parent → renderer)                                            | Parent Source                                                     |
| --------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `onImagePress`  | `(attachments: AttachmentV2[], index: number, name: string, ts: number)` | `handleOpenMediaViewer` (stable, `[]` deps)                       |
| `onThreadPress` | `(messageId: string) => void`                                            | `handleStackedThreadPress` (stable, `[navigation, groupId]` deps) |

Inside the renderer:

```typescript
// Wraps stable parent callback with per-message data
const handleImagePress = useCallback(() => {
  const imageAtt = item.attachments?.find((a) => a.kind === "image");
  if (item.kind === "media" && imageAtt) {
    onImagePress([imageAtt], 0, senderDisplayName, item.createdAt);
  }
}, [
  item.attachments,
  item.kind,
  item.createdAt,
  senderDisplayName,
  onImagePress,
]);

const handleThreadPress = useCallback(() => {
  onThreadPress(item.id);
}, [item.id, onThreadPress]);
```

This pattern ensures:

- **Parent provides a single stable function ref** (not per-row inline closures)
- **`React.memo` works** — callback props are reference-stable across renders
- **Renderer binds its own data** — no stale closures over parent scope variables

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
- The rounding algorithm defaults to `0` (flat) for unknown widths, which is correct
  for the common same-width case where snapped messages produce flush edges
- Cards render at full opacity on first frame — no blank-then-pop cycle
- `useLayoutEffect` registers neighbors and reads cached snapshots BEFORE the first
  visible paint, so warm-cache rows start with fully resolved corners
- After layout, `CardWidthTracker.report()` enqueues coalesced async notifications
  via `setTimeout(0)`. Multiple reports within the same JS turn are merged into a
  single flush, preventing O(N²) cascade storms during pagination
- The subscriber uses `snapshotWidthsEqual()` to skip re-renders when width data
  hasn't actually changed, further reducing unnecessary render cycles

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

### Thread Indicators and Grouping

- `areMessagesGrouped` breaks on `replyTo` (reply messages) but NOT on `replyCount`
  (thread roots). A thread root can be in the middle of a grouped run.
- `vm.threadPlacement` determines whether the indicator renders inline (inside card)
  or external (below card), preserving grouped continuity
- Inline thread indicators participate in the card's width measurement, since they
  are children of `cardContent` which has the `onLayout` handler
- Both inline and external thread indicators use the same `ThreadIndicator` component
  with the same `onPress` handler

### Shared Logic

Both `GroupStackedMessageRenderer` and `StackedMessageRenderer` share the
same card logic via the `useGroupedCardLayout` hook and `groupedCardLayout.ts`
pure functions. Any change to card behavior applies to both renderers
automatically.

### Renderer Differences

While card layout logic is shared, the renderers differ in:

- **GroupStackedMessageRenderer**: Receives raw grouping flag primitives and
  builds `MessageViewModel` internally via `useMemo`. Uses `colors` prop,
  `@mention` row highlighting with tint + left accent border,
  `MessageWithMentions` for text rendering. Thread press and image press are
  handled via stable parent callbacks (`onThreadPress(messageId)`,
  `onImagePress(attachments, index, senderName, timestamp)`) — the renderer
  wraps these in its own `useCallback` to pass per-message data.
- **StackedMessageRenderer**: Uses `useTheme()` from react-native-paper directly, no mention
  highlighting (DMs have no mentions), uses plain `Text` for text rendering, manages its
  own link preview state via `useLinkPreviews` hook, thread press navigates directly via
  `navigation.navigate("ThreadView", ...)`, has `gutterSpacer` with extra `marginRight`

### MessageViewModel Fields

The `MessageViewModel` (from `buildMessageViewModel()` in `displayMode.ts`)
provides the following fields. In `GroupStackedMessageRenderer`, the VM is
built internally from raw primitive props via `useMemo`, ensuring React.memo
can skip re-renders when grouping flags haven't changed:

| Field                   | Type                               | Description                                |
| ----------------------- | ---------------------------------- | ------------------------------------------ |
| `isMine`                | `boolean`                          | Current user sent this message             |
| `isGroupChat`           | `boolean`                          | Group chat vs DM                           |
| `isGroupedWithPrevious` | `boolean`                          | Grouped with message visually above        |
| `isGroupedWithNext`     | `boolean`                          | Grouped with message visually below        |
| `isGroupStart`          | `boolean`                          | First in sender group (show avatar + name) |
| `isGroupEnd`            | `boolean`                          | Last in sender group (show timestamp)      |
| `showAvatar`            | `boolean`                          | Avatar should be rendered                  |
| `showDisplayName`       | `boolean`                          | Author name should be rendered             |
| `showTimestamp`         | `boolean`                          | Timestamp row should be rendered           |
| `isSystemMessage`       | `boolean`                          | System-generated message                   |
| `hasReactions`          | `boolean`                          | Message has reaction pills                 |
| `hasReplyPreview`       | `boolean`                          | Message has a reply-to reference           |
| `hasThread`             | `boolean`                          | Message is root of a reply thread          |
| `threadPlacement`       | `"inline" \| "external" \| "none"` | Where to render the thread indicator       |
