# Reply System Design Document

> Comprehensive design and implementation plan for the enhanced reply system
> **Status**: ✅ Implemented (2025)

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Design Goals](#design-goals)
3. [Implementation Plan](#implementation-plan)
4. [Component Changes](#component-changes)
5. [New Features](#new-features)

---

## Current State Analysis

### Existing Components

| Component                 | File                                              | Purpose                                 |
| ------------------------- | ------------------------------------------------- | --------------------------------------- |
| `SwipeableMessageWrapper` | `src/components/chat/SwipeableMessageWrapper.tsx` | Generic swipe-to-reply gesture handler  |
| `SwipeableMessage`        | `src/components/chat/SwipeableMessage.tsx`        | DM-specific swipe wrapper               |
| `SwipeableGroupMessage`   | `src/components/chat/SwipeableGroupMessage.tsx`   | Group-specific swipe wrapper            |
| `ReplyBubble`             | `src/components/chat/ReplyBubble.tsx`             | Apple-style reply preview above message |
| `ReplyPreviewBar`         | `src/components/chat/ReplyPreviewBar.tsx`         | Reply preview above composer input      |

### Current Data Model

```typescript
interface ReplyToMetadata {
  messageId: string; // Original message ID
  senderId: string; // Original sender's user ID
  senderName?: string; // Original sender's display name
  kind: MessageKind; // "text" | "media" | "voice" | "file" | "system"
  textSnippet?: string; // Truncated preview (first 100 chars)
  attachmentPreview?: {
    kind: AttachmentKind;
    thumbUrl?: string;
  };
}
```

### Current Limitations

1. **No visual feedback on scroll** - When tapping a reply bubble, the list scrolls but users can't identify the target message
2. **No jump-back functionality** - Once scrolled, no way to return to the reply context
3. **Basic visual design** - Hollow outline bubbles work but lack polish
4. **No reply chain visualization** - Consecutive replies don't show threading context
5. **Inconsistent alignment** - Reply bubble aligns to original sender, which can be confusing

---

## Design Goals

### Primary Goals

1. **✅ Highlight animation** - When scrolling to a replied message, highlight it with a pulse/flash animation
2. **✅ Polished visuals** - Modern, sleek design for reply bubbles matching top-tier messaging apps
3. **✅ Reply chain support** - Visual indication when messages form a conversation thread
4. **✅ Jump-back button** - After scrolling to original, show floating button to return

### Secondary Goals

1. **Smooth scrolling** - Ensure scroll + highlight feels seamless
2. **Performance** - No unnecessary re-renders
3. **Accessibility** - Proper contrast and touch targets

---

## Implementation Plan

### Phase 1: Message Highlight System

**New Hook: `useHighlightedMessage`**

```typescript
interface UseHighlightedMessage {
  highlightedMessageId: string | null;
  setHighlightedMessage: (messageId: string) => void;
  clearHighlight: () => void;
}
```

- Tracks which message should be highlighted
- Auto-clears after 2 seconds
- Provides animated value for highlight opacity

**Changes to DMMessageItem / GroupMessageItem:**

- Accept `isHighlighted` prop
- Apply highlight animation when true
- Use Reanimated for smooth pulse effect

### Phase 2: Enhanced ReplyBubble

**Visual Improvements:**

- Subtle gradient background instead of pure transparent
- Softer border with rounded corners
- Better typography hierarchy
- Smooth reveal animation when appearing
- Touch ripple effect on tap

**Alignment Fix:**

- Always align reply bubble above the main message (same side)
- Connector flows more naturally

### Phase 3: Jump-Back Feature

**New Component: `ScrollReturnButton`**

- Floating action button that appears after scrolling to a reply target
- Shows "Return to reply" with an arrow icon
- Fades in after scroll settles, auto-hides after 5 seconds or on tap
- Stores original scroll position before jump

### Phase 4: Reply Chain Indicator

**Thread Detection:**

- When rendering a message that is a reply to the message directly above it, show a simplified connector
- Consecutive replies in a thread show a vertical thread line

---

## Component Changes

### 1. DMMessageItem.tsx

```diff
+ import { useAnimatedStyle, withTiming, interpolateColor } from 'react-native-reanimated';

interface DMMessageItemProps {
  // ... existing props
+ isHighlighted?: boolean;
}

+ // Highlight animation
+ const highlightStyle = useAnimatedStyle(() => {
+   return {
+     backgroundColor: withTiming(
+       isHighlighted ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
+       { duration: 300 }
+     ),
+   };
+ });
```

### 2. ReplyBubble.tsx

**New Design:**

- Subtle frosted glass effect background
- Primary color accent bar on left edge
- Improved typography with sender name bold
- Smooth scale animation on appear
- Better connector with gradient opacity

### 3. ChatScreen.tsx / GroupChatScreen.tsx

**Changes:**

- Track `highlightedMessageId` state
- Pass to message list
- Clear highlight after timeout
- Track scroll position for jump-back

### 4. New: ScrollReturnButton.tsx

```typescript
interface ScrollReturnButtonProps {
  visible: boolean;
  onPress: () => void;
}
```

---

## New Features

### Feature 1: Message Highlight Animation

When user taps a reply bubble:

1. Scroll to target message
2. Apply highlight animation (soft blue pulse)
3. Pulse fades over 2 seconds
4. Show return button

**Animation spec:**

- Duration: 300ms fade in, hold 1.5s, 300ms fade out
- Color: `rgba(59, 130, 246, 0.15)` (blue overlay)
- Border: Optional subtle blue border flash

### Feature 2: Polished Reply Bubble

**New visual design:**

```
┌─────────────────────────────────┐
│ ▌ John Doe                      │
│ ▌ This is the message preview...│
└─────────────────────────────────┘
         │
         └─── (connector to main message)
```

- Left accent bar (primary color)
- Frosted/blurred background
- Sender name in bold
- Preview text in muted color
- Subtle shadow

### Feature 3: Jump-Back Button

**Behavior:**

1. User taps reply bubble → scroll to original
2. After scroll settles (300ms), show floating button
3. Button shows "↩ Back to reply"
4. Tap returns to original position
5. Auto-hide after 5 seconds of inactivity

### Feature 4: Reply Chain Visualization

When multiple consecutive messages form a reply chain:

```
┌──────────────────┐
│ Original message │
└──────────────────┘
        │
        ├── User A replied
        │
        └── User B replied to A
```

Visual: Thin vertical line connecting replies in a thread

---

## File Modifications Summary

| File                                         | Changes                              |
| -------------------------------------------- | ------------------------------------ |
| `src/components/chat/ReplyBubble.tsx`        | Complete redesign with new visuals   |
| `src/components/DMMessageItem.tsx`           | Add highlight animation              |
| `src/components/GroupMessageItem.tsx`        | Add highlight animation              |
| `src/screens/chat/ChatScreen.tsx`            | Add highlight state, jump-back logic |
| `src/screens/groups/GroupChatScreen.tsx`     | Add highlight state, jump-back logic |
| `src/components/chat/ScrollReturnButton.tsx` | **NEW** - Floating return button     |
| `src/hooks/useHighlightedMessage.ts`         | **NEW** - Highlight state management |

---

## Testing Checklist

- [ ] Swipe to reply still works
- [ ] Reply preview bar shows correctly
- [ ] Tapping reply bubble scrolls and highlights
- [ ] Highlight animation looks smooth
- [ ] Jump-back button appears and works
- [ ] Reply chains show visual connection
- [ ] Performance is acceptable (no jank)
- [ ] Works in both DM and Group chats
- [ ] Dark mode looks correct
- [ ] Light mode looks correct
