# Reaction System — Architecture & Reference

_Last updated: 2026-03-25_

## Overview

The reaction system allows users to add emoji reactions to any message in DM or group chats. It supports the full Unicode emoji set via a polished quick-reaction tray and an integrated full emoji picker (`rn-emoji-keyboard`).

## UX Flow

1. **Long-press a message** → `MessageActionsSheet` opens.
2. **Quick reactions** — 6 curated emojis (👍 ❤️ 😂 😮 😢 🔥) shown at the top of the sheet. Tap one to toggle it instantly.
3. **"+" button** — Opens the full emoji picker (`rn-emoji-keyboard`) with categories, search, recent emojis, and skin tone support.
4. **Selecting an emoji** closes the picker/sheet and calls `toggleReactionV2` on the server.
5. **Reaction pills** appear below the message bubble, showing emoji + count. Tapping a pill toggles your participation.
6. **Tapping an existing pill** on a message you already reacted with removes your reaction.

## Data Model

### Message document

```
Chats/{chatId}/Messages/{messageId}
Groups/{groupId}/Messages/{messageId}
  └─ reactionsSummary: Record<string, number>  // denormalized: { "🔥": 2, "❤️": 1 }
```

### Reactions subcollection

```
.../Messages/{messageId}/Reactions/{emoji}
  ├─ emoji: string        // the emoji character
  ├─ uids: string[]       // user IDs who reacted
  ├─ count: number        // length of uids
  └─ updatedAt: number    // last modification timestamp
```

- Document ID = emoji character itself.
- Max 20 unique emojis per message.
- Max 10 users displayed per emoji in the detail sheet.

## Component Architecture

| Component             | Location                                      | Purpose                                            |
| --------------------- | --------------------------------------------- | -------------------------------------------------- |
| `ReactionPills`       | `src/components/chat/ReactionBar.tsx`         | Animated emoji + count pills below message bubbles |
| `QuickReactionBar`    | `src/components/chat/ReactionBar.tsx`         | 6-emoji tray + "+" picker in `MessageActionsSheet` |
| `ReactionDetailSheet` | `src/components/chat/ReactionDetailSheet.tsx` | Modal showing who reacted per emoji                |
| `MessageActionsSheet` | `src/components/chat/MessageActionsSheet.tsx` | Long-press sheet that hosts `QuickReactionBar`     |

## Service Layer

| Function                                | Location                    | Description                                              |
| --------------------------------------- | --------------------------- | -------------------------------------------------------- |
| `toggleReaction()`                      | `src/services/reactions.ts` | Calls `toggleReactionV2` Cloud Function                  |
| `applyOptimisticReaction()`             | `src/services/reactions.ts` | Pure function: computes next reactions array locally     |
| `subscribeToReactions()`                | `src/services/reactions.ts` | Real-time Firestore listener for one message's reactions |
| `subscribeToMultipleMessageReactions()` | `src/services/reactions.ts` | Batch subscription for visible messages                  |
| `getReactions()`                        | `src/services/reactions.ts` | One-shot fetch of reactions for a message                |
| `parseReactionsFromMessage()`           | `src/services/reactions.ts` | Parse denormalized summary into `ReactionSummary[]`      |

## Cloud Function

**`toggleReactionV2`** (`firebase-backend/functions/src/messaging.ts`)

- **Input**: `{ conversationId, scope, messageId, emoji }`
- **Validation**: Auth, membership, rate limit (10/min), emoji is valid string ≤ 10 chars
- **Logic**: Firestore transaction — reads reaction doc + message doc, adds/removes UID, updates denormalized `reactionsSummary` on message.
- **Output**: `{ success, action: "added"|"removed", reactionsSummary }`

## Firestore Security Rules

- **Read**: Any conversation member can read `Reactions/{reactionId}` docs.
- **Write**: All writes go through the Cloud Function (admin SDK), so client write rules are permissive for the function but restrictive for direct client access.
- Rule paths: `Chats/{chatId}/Messages/{messageId}/Reactions/{reactionId}` and `Groups/{groupId}/Messages/{messageId}/Reactions/{reactionId}`.

## Integration Points

### DM Chat (`ChatScreen.tsx`)

- `subscribeToMultipleMessageReactions("dm", chatId, messageIds, uid, callback)` creates real-time subscriptions.
- Reactions state passed to `DMMessageItem` via `reactions` prop.
- `ReactionPills` rendered inside `messageBubbleWrapper`, after the bubble and timestamp.

### Group Chat (`GroupChatScreen.tsx`)

- Same subscription pattern with `scope: "group"`.
- `ReactionPills` rendered after `messageRow`, with `paddingLeft: 45` for received messages to align with avatar indent.

## Emoji Picker

- Package: `rn-emoji-keyboard`
- Features: Categories, search bar, recently used, skin tones
- Theme: Fully styled to match the app's light/dark theme via `theme` prop
- Triggered from the "+" button in `QuickReactionBar`

## Animations & Polish

- **Pill tap**: Spring scale animation via `react-native-reanimated` (`withSequence(withSpring(1.25), withSpring(1))`)
- **Pill enter/exit**: `FadeIn.duration(200)` / `FadeOut.duration(150)`
- **Layout transitions**: `LinearTransition.springify()` for smooth reflow when pills are added/removed
- **Haptic feedback**: `expo-haptics` `ImpactFeedbackStyle.Light` on pill tap and quick reaction selection
- **Theme-aware**: Pills use `primaryContainer`/`primary` for user's own reactions, `surfaceVariant` for others

## Optimistic Updates

Reactions use an **optimistic UI** pattern so they appear instantly without waiting for the Firebase round-trip.

### Flow

1. User taps a reaction pill or picks an emoji from the quick-reaction tray / full picker.
2. `applyOptimisticReaction(currentReactions, emoji, uid)` computes the next local state in pure function form (no mutation).
3. The parent screen (`ChatScreen` / `GroupChatScreen`) calls `setMessageReactions()` immediately with the optimistic result.
4. The Cloud Function call (`toggleReaction()`) is fired in the background (**fire-and-forget**).
5. On success: Firestore listener will deliver the authoritative state, overwriting the optimistic one (usually identical).
6. On failure or `!result.success`: The same `applyOptimisticReaction()` is called again to **roll back** the toggle.

### Key Implementation Details

- **Per-emoji debounce**: `ReactionPills` uses an `inflight` ref Set (keyed by emoji) so the same emoji can't be double-tapped, but different emojis on the same message can be toggled in parallel.
- **`optimisticIds` ref**: Each screen keeps a `Set<string>` of message IDs that received optimistic reactions. These IDs are always included in the subscription set, fixing the **first-reaction blindspot** (messages with no `reactionsSummary` were previously never subscribed to).
- **MessageActionsSheet**: Closes immediately on reaction tap. The parent screen's `handleSheetReaction` callback handles both the optimistic update and the background server call.
- **No blocking state**: The old `loadingEmoji` state (which blocked ALL pills during one in-flight reaction) has been replaced with the per-emoji `inflight` ref.

## Performance Considerations

- Subscriptions are created for messages that have `reactionsSummary` **plus** any message ID in the `optimisticIds` set.
- `ReactionPill` is memoized and animated individually.
- `ReactionPills` uses `React.memo` to avoid unnecessary rerenders.
- Pill `key` is the emoji character, ensuring stable identity across updates.
- Optimistic updates eliminate perceived latency — pills appear in < 16 ms (one frame).

## Testing Checklist

- [ ] Long-press message → quick reaction tray appears with 6 emojis
- [ ] Tap quick reaction → reaction pill appears below correct message
- [ ] Tap "+" → full emoji picker opens with categories and search
- [ ] Select emoji from full picker → reaction added to correct message
- [ ] Tap own reaction pill → reaction removed
- [ ] Reaction counts update in real-time for all participants
- [ ] Sent message reactions align right
- [ ] Received message reactions align left
- [ ] Group chat: received reactions indent past avatar column
- [ ] DM chat: reactions appear (were previously missing)
- [ ] Reactions work for text, image, voice, and animal messages
- [ ] Multiple emojis on same message render correctly
- [ ] Fast scrolling does not cause pills to appear on wrong messages
- [ ] Theme switching updates pill colors correctly
- [ ] Haptic feedback fires on pill tap (iOS/Android)
- [ ] Full picker respects dark/light theme
- [ ] Rate limit error shows alert if user reacts too fast

## Known Limitations

- The denormalized `reactionsSummary` on the message doc does not include per-user data, so `hasReacted` is always `false` when reading from the summary alone. Full reaction subscriptions (via `subscribeToReactions`) are needed for accurate `hasReacted` state.
- The `ReactionDetailSheet` loads user profiles one-by-one; for messages with many reactors, this could be slow.
- If the Cloud Function fails silently (network timeout with no error thrown), the optimistic state will persist until the Firestore listener delivers the authoritative data.
