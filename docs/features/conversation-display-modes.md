# Conversation Display Modes

Last updated: 2026-03-24

## Overview

Users can choose between two visual layouts for chat messages: **Bubbles** (classic) and **Stacked** (Discord-style dense feed). The setting is viewer-side only — it changes how the current user sees messages, not how messages are stored or sent. Other participants are unaffected.

## Modes

### Bubbles (default)

The original layout. Outgoing messages align right with colored bubbles; incoming messages align left. Avatar, timestamp, and status indicators are positioned relative to bubble alignment. This is powered by the existing `DMMessageItem` (DMs) and inline rendering in `GroupChatScreen` (groups).

### Stacked (Discord-style feed)

A dense, fully left-oriented feed layout structurally inspired by Discord. This is **not** "bubbles moved left" — it is a completely separate renderer architecture.

Key characteristics:

- **No bubble chrome** — text messages render as flat feed text, no rounded colored containers
- **Fixed gutter/content-column grid** — a left gutter area (40px) holds avatars; all content starts at the same horizontal position (48px from edge)
- **Sender grouping** — consecutive messages from the same sender within a 2-minute window are grouped; only the first message shows avatar + author name + inline timestamp
- **No blanket self-message tint** — own messages look identical to others; your real display name (not "You") is used in the author header
- **Targeted mention highlighting** — only messages that `@mention` the current user or use `@everyone`/`@all` get a subtle row-level tint + left accent border (Discord-style)
- **Content-column anchoring** — images, reactions, replies, threads, timestamps all anchor to the same left content column
- **Dense vertical rhythm** — 2px within groups, 17px between groups
- **Larger avatars** — 40px avatars for clear sender identity

## Architecture

```
┌─────────────────────────────────┐
│  ConversationDisplayModeProvider │  ← React context (App.tsx)
│  AsyncStorage + Firestore sync  │
└──────────┬──────────────────────┘
           │ displayMode
           ▼
┌─────────────────────────────────┐
│     ChatMessageRenderer         │  ← Unified entry point (DM)
│  or GroupStackedMessageRenderer │  ← Group stacked path
│                                 │
│  buildMessageViewModel()        │  ← Pure function normalizes data
│  FEED_LAYOUT / BUBBLE_LAYOUT    │  ← Mode-specific layout tokens
└──────────┬──────────────────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
 Bubbles      Feed (Stacked)
 (existing)   (new renderer)
```

### Key Principles

1. The shared chat pipeline (fetching, send, sync, reactions, thread state, read receipts) is untouched. Display mode only affects the **rendering layer**.
2. The stacked renderer has its **own layout primitives** (`FeedLayoutTokens`, gutter/content-column grid). It does not reuse bubble-mode layout code.
3. Reactions are **always left-aligned** in feed mode (passed `isOwnMessage={false}` to ReactionPills to override bubble-era alignment logic).

## Feed Row Structure

Every message in stacked mode uses this grid:

```
┌──────────────────────────────────────────────────┐
│ [rowPaddingH]                        [rowPaddingH]│
│                                                   │
│  ┌─────────┐  ┌─────────────────────────────────┐│
│  │ gutter  │  │ content column                   ││
│  │ (40px)  │  │ (flex: 1)                       ││
│  │         │  │                                  ││
│  │ avatar  │  │  Author Name    12:34 PM         ││  ← group start only
│  │  (40px) │  │  Message text goes here...       ││
│  │         │  │  [image]                         ││  ← anchored to content column
│  │         │  │  [reaction pills]                ││  ← always left-aligned
│  │         │  │                                  ││
│  └─────────┘  └─────────────────────────────────┘│
│                                                   │
└──────────────────────────────────────────────────┘

Within-group messages (no header):
┌──────────────────────────────────────────────────┐
│  ┌─────────┐  ┌─────────────────────────────────┐│
│  │ (empty  │  │  Another message from same user  ││
│  │  gutter)│  │                                  ││
│  └─────────┘  └─────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

## Files

| File                                                  | Role                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/chat/displayMode.ts`                             | Core types, `FeedLayoutTokens`, `ChatLayoutTokens`, `buildMessageViewModel()`, `hexToRgb()` |
| `src/store/ConversationDisplayModeContext.tsx`        | React context + hook, dual persistence                                                      |
| `src/components/chat/ChatMessageRenderer.tsx`         | Unified DM renderer (delegates by mode)                                                     |
| `src/components/chat/StackedMessageRenderer.tsx`      | DM feed-mode renderer                                                                       |
| `src/components/chat/GroupStackedMessageRenderer.tsx` | Group feed-mode renderer                                                                    |
| `src/screens/chat/ChatScreen.tsx`                     | DM screen integration                                                                       |
| `src/screens/groups/GroupChatScreen.tsx`              | Group screen integration                                                                    |
| `src/screens/settings/SettingsScreen.tsx`             | Conversation Style picker in Appearance                                                     |
| `src/types/models.ts`                                 | `conversationDisplayMode` field on `User`                                                   |
| `src/services/accountDeletion.ts`                     | Cleanup key in deletion flow                                                                |

## Persistence

Dual-write pattern matching existing `ThemeContext`:

1. **AsyncStorage** (`@vibe/conversation_display_mode`): Immediate local read on app start.
2. **Firestore** (`Users/{uid}.conversationDisplayMode`): Cross-device sync. Firestore value is synced to local on provider mount if present.

On change, both stores are written simultaneously. AsyncStorage is the fast-read cache; Firestore is the durable sync target.

## Feed Layout Tokens (`FeedLayoutTokens`)

The stacked renderer uses `FEED_LAYOUT` — a dedicated token set for the gutter/content-column grid. These are **not** derived from bubble-mode tokens.

| Token                | Value | Purpose                                                    |
| -------------------- | ----- | ---------------------------------------------------------- |
| `screenEdgeInset`    | 0     | Outer edge inset (screen padding handled by `rowPaddingH`) |
| `gutterWidth`        | 34    | Fixed left gutter width (avatar area)                      |
| `gutterGap`          | 8     | Gap between gutter and content column                      |
| `contentIndent`      | 42    | Total = screenEdgeInset + gutterWidth + gutterGap          |
| `avatarSize`         | 34    | Avatar diameter at group starts                            |
| `groupGap`           | 10    | Vertical gap between sender groups                         |
| `withinGroupGap`     | 2     | Vertical gap within a sender group                         |
| `rowPaddingV`        | 2     | Vertical padding per feed row                              |
| `rowPaddingH`        | 8     | Horizontal padding per feed row                            |
| `mediaRadius`        | 8     | Border radius for images                                   |
| `imageMaxWidth`      | 280   | Maximum image width                                        |
| `imageMaxHeight`     | 320   | Maximum image height                                       |
| `imageMinWidth`      | 160   | Minimum image width                                        |
| `authorNameFontSize` | 13    | Author name size                                           |
| `timestampFontSize`  | 11    | Timestamp size                                             |
| `messageFontSize`    | 15    | Message text size                                          |
| `messageLineHeight`  | 20    | Message text line height                                   |
| `selfTintOpacity`    | 0     | Deprecated — self-messages no longer tinted                |
| `selfAccentWidth`    | 0     | Deprecated — self-messages no longer have accent           |

Bubble mode continues to use `BUBBLE_LAYOUT` (type `ChatLayoutTokens`), with one important anchoring rule for DM bubbles:

- Outgoing DM bubbles must align to the trailing edge of their bubble/footer column
- This prevents short sent bubbles from drifting inward when the delivery-status + timestamp footer is wider than the bubble body
- The fix belongs on the bubble alignment layer, not as extra right margin or list padding

Group bubble mode does not currently hit this issue because its footer row is timestamp-only and does not widen the sender column the same way DM delivery/read labels do.

## Content-Column Anchoring

This is the core structural change from the v1 stacked implementation. In v1, content used ad-hoc avatar spacers and inherited bubble `alignSelf` rules, causing zig-zagging alignment.

In v2:

- **Every message row** includes a fixed-width `gutterSpacer` (48px wide) on the left
- The `contentColumn` fills the remaining space (`flex: 1`)
- Text, images, reactions, replies, threads, and timestamps all render inside the content column
- This means all content shares the same left edge regardless of message type
- The gutter spacer is present even for within-group messages (no avatar shown) to maintain alignment

## Image Alignment

Images are rendered as direct children of the content column with a modest `borderRadius: 8`. There is:

- No bubble wrapper around images
- No `alignSelf` override
- No background color behind images

Images are bounded by `imageMaxWidth: 280` and `imageMaxHeight: 320` with aspect-ratio preservation. They flow naturally within the content column, anchored to its left edge.

## Reaction Alignment Fix

**Root cause of v1 bug**: `ReactionPills` uses `isOwnMessage` to choose `justifyContent: "flex-end"` (own) vs `"flex-start"` (other). In stacked mode, own messages should still have left-aligned reactions since all content is left-oriented.

**Fix**: Both stacked renderers pass `isOwnMessage={false}` to `ReactionPills`, forcing left alignment. The toggle/API logic (which needs the real sender) is handled separately via `scope`/`conversationId`/`messageId`/`currentUid` props.

## Self-Message Distinction

In stacked mode, own messages have **no visual distinction** from other users' messages. This matches Discord's approach where your messages look identical to everyone else's in the feed.

- **No background tint** on self-messages
- **No left accent border** on self-messages
- **Real display name** used in the author header (not "You")
- Self vs other is distinguished only by the author name color (primary vs secondary)

The blanket self-tint from v2 (rgba primary at 6% opacity) was removed in v3 as it created a "purple highlight" effect across 50% of conversations.

## Mention Highlighting (Group Chats)

In group chats, messages that mention the current user get a Discord-style row-level highlight.

### When highlight applies:

- `item.mentionUids` includes the current user's UID (direct `@mention`)
- `item.mentionUids` includes `"everyone"`, `"all"`, or `"@all"` (group-wide mention)

### When highlight does NOT apply:

- Message mentions someone else only — no highlight
- Message is from the current user — no highlight just for being yours
- Message has no mentions — no highlight
- DM messages — no mention highlight (mentions aren't a DM concept)

### Visual treatment:

- **Row background**: `rgba(tertiary, 0.06)` (dark) / `rgba(tertiary, 0.04)` (light)
- **Left accent border**: 2px at `rgba(tertiary, 0.5)` (dark) / `rgba(tertiary, 0.4)` (light)
- Uses `theme.colors.tertiary` (falls back to `primary`) — typically a warm/earth tone, distinct from the primary color

This is a targeted, low-frequency visual signal — not a blanket treatment.

## Sender Grouping

Messages are grouped when:

1. Same sender as the adjacent message
2. Within a 2-minute time window
3. Neither message is a system message

### Group start

- Avatar rendered in the left gutter (DMs use letter avatar; groups use `ProfilePictureWithDecoration`)
- Author name displayed in bold with sender-colored text
- Timestamp shown inline to the right of the name (Discord-style)

### Within-group messages

- Gutter spacer present (empty) — maintains alignment
- No avatar, no name, no header timestamp
- Only content + optional reactions

### Between groups

- 17px gap (vs 2px within a group) for clear visual separation

## Feature Parity

Both modes support all message features identically:

- Text, image, voice, animal theme messages
- Reactions (pills below message)
- Reply threading (reply preview above message)
- Swipe-to-reply gesture
- Thread indicators
- Read receipts / delivery status
- Timestamps (grouped and standalone)
- Link previews
- Mentions (group chat)
- Profile pictures with decorations (group chat)
- Message actions (long-press)

## Settings UI

Found in **Settings → Appearance** section, below the theme selector:

- Label: "Conversation Style"
- Description: "Choose how messages appear in your conversations"
- Two buttons: **Bubbles** (default) and **Stacked**
- Active button uses `mode: "contained"`, inactive uses `mode: "outlined"`
- Change is applied immediately across all conversations

## Theme Integration

Both renderers consume theme tokens from `react-native-paper`'s `useTheme()`. The stacked renderer uses:

- `theme.colors.primary` — own-sender author name color
- `theme.colors.secondary` — other-sender author name color
- `theme.colors.tertiary` — mention highlight tint (row background + left accent)
- `theme.colors.onSurface` — message text color (default, when no custom font color is set)
- `theme.colors.onSurfaceVariant` — timestamps, metadata
- `theme.colors.primaryContainer` / `secondaryContainer` — DM avatar backgrounds
- `theme.dark` — adjusts mention tint opacity for light vs dark mode

All 30+ themes (light, dark, AMOLED, pastel, vibrant) are supported without mode-specific overrides.

### Custom Font Color in Stacked Mode

The stacked renderers support custom font colors from the cosmetics system. When a user has equipped a custom font color (`chatAppearance.fontColorId`), their message text renders in that fixed hex color instead of the theme's `onSurface` token. For incoming messages, the sender's `fontColorHex` from the stamped `senderStyle` is used when present.

- **Default** (`fontColorId === null`): text uses `theme.colors.onSurface` — adapts to theme
- **Custom** (`fontColorId !== null`): text uses the resolved hex color — stays fixed across themes
- Author names, timestamps, and metadata remain theme-adaptive (not affected by font color)

In bubble mode (`DMMessageItem`, `GroupChatScreen`), custom font color overrides the contrast-computed `bubbleTextColor` when set. This respects the user's explicit choice of both bubble color and font color.

## Testing Checklist

### Spacing & Alignment (Stacked Mode)

- [ ] Author name sits close to the message text (no large visible gap)
- [ ] Avatar aligns to top of header row, visually spanning name + first message line
- [ ] Avatar is 34px (not 40px) — proportional to the dense feed
- [ ] Gap between different sender groups is ~10px (not 17px) — tight but distinct
- [ ] Within-group messages are 2px apart — virtually seamless
- [ ] Header row has 0px bottom margin — name flows directly into content
- [ ] Author name has 2px top offset to align with upper portion of avatar
- [ ] Timestamp has 3px top offset to sit slightly lower than name baseline
- [ ] Content column indents 42px (34 gutter + 8 gap) — consistent across all rows
- [ ] The feed feels dense and intentional, not loose or cramped

### Feed Structure (Stacked Mode)

- [ ] No bubble chrome visible around text messages
- [ ] Content column starts at the same horizontal position across all message types
- [ ] Avatar appears in the left gutter at group starts
- [ ] Gutter spacer maintains alignment for within-group messages
- [ ] Group-start header shows name + inline timestamp (Discord-style)
- [ ] Self-messages have no blanket background tint
- [ ] Mention-highlighted messages show subtle tertiary tint + left accent
- [ ] Only direct self-mentions and @everyone trigger the mention highlight
- [ ] Author names use real display name (not "You")
- [ ] No right-aligned elements anywhere in stacked mode

### Image Alignment (Stacked Mode)

- [ ] Images render within the content column, not in bubble shells
- [ ] Images are left-anchored with consistent left edge
- [ ] Portrait, landscape, and square images all align cleanly
- [ ] Image cards have modest border radius (8px), no bubble radius
- [ ] Fullscreen open-on-tap behavior still works

### Reaction Alignment (Stacked Mode)

- [ ] Reactions sit directly below their message, left-aligned
- [ ] Own-message reactions are left-aligned (not pushed right)
- [ ] Reactions on images align to the content column
- [ ] Add/remove/toggle behavior remains correct
- [ ] Reaction picker anchors correctly

### Basic Switching

- [ ] Bubbles mode renders existing layout identically (no regressions)
- [ ] Stacked mode renders as a dense feed, not left-shifted bubbles
- [ ] Switching modes in Settings takes effect immediately
- [ ] Preference persists across app restarts (AsyncStorage)
- [ ] Preference syncs across devices (Firestore)

### DM Chat

- [ ] Text messages render cleanly in both modes
- [ ] Short outgoing DM bubbles stay flush with the right gutter even when status labels are wider than the message body
- [ ] Image messages properly left-oriented in stacked mode
- [ ] Voice messages render with playback controls
- [ ] Animal theme messages render correctly and left-oriented
- [ ] Reply preview shows above message in content column
- [ ] Swipe-to-reply works in both modes
- [ ] Read receipts / delivery status visible
- [ ] Link previews bounded and left-aligned

### Group Chat

- [ ] Profile pictures with decorations render at group starts
- [ ] Mentions highlighted via MessageWithMentions
- [ ] Multi-sender conversations show clear sender attribution
- [ ] Grouping works correctly across sender transitions
- [ ] Thread indicators align to content column

### Performance

- [ ] No jank on rapid scrolling in either mode
- [ ] Mode switch does not trigger full list re-mount
- [ ] `getItemLayout` still works for scroll-to-message

### Edge Cases

- [ ] System messages render identically in both modes
- [ ] Single-message conversations anchor correctly
- [ ] Very long text wraps within content column width
- [ ] Mixed message types in a sender group all align

## V1 → V2 Refactor Notes

The first stacked-mode implementation (v1) had these structural problems:

1. **Bubble containers around every message** — `stackedStyles.bubble` with `borderRadius: 12`, padding, and `backgroundColor` still created visible rounded colored containers
2. **Reactions used `isOwnMessage` alignment** — `ReactionPills` applied `justifyContent: "flex-end"` for own messages, pushing them right
3. **Images wrapped in bubble shells** — rendered inside a bubble View with `alignSelf: "flex-start"`, inheriting bubble layout
4. **No fixed gutter grid** — avatar spacers were conditionally rendered under multiple conflicting guards, causing content to start at different positions
5. **Self-messages used full bubble color** — `chatStyle.bubbleBgColor` made colored rectangles indistinguishable from bubbles
6. **Layout tokens still named "bubble"** — reinforced bubble thinking in stacked-mode code

V2 addresses all of these by introducing `FeedLayoutTokens` with a proper gutter/content-column grid and removing all bubble-era layout primitives from the stacked renderers.

## QA Polish Pass Notes

A follow-up QA pass addressed these additional items:

1. **`hexToRgb` consolidation** — the helper was duplicated in both stacked renderers; it is now exported from `displayMode.ts` and imported by both
2. **Dead avatar branch** — DM StackedMessageRenderer had a ternary where both branches rendered identical avatars; simplified to unconditional render
3. **Light/dark tint consistency** — DM renderer reduced self-tint opacity for light themes (`selfTintOpacity * 0.7`) but Group renderer used the flat value; Group now matches DM behavior using `useTheme().dark`
4. **Dead props removed** — `bubbleBgColor` and `chatStyleBgColor` were declared in GroupStackedMessageRenderer's interface but never destructured or used; removed from interface and caller

## V3 Refinement Pass

V3 addressed remaining deviations from the intended Discord-style dense feed:

1. **Blanket self-message tint removed** — v2 applied `rgba(primary, 0.06)` background + 2px left accent to ALL own messages, creating a "purple highlight" across 50% of conversations. Removed entirely; own messages now look the same as others.
2. **Targeted mention highlighting added** — group chat messages that mention the current user or use `@everyone`/`@all` now get a subtle row-level tint using `theme.colors.tertiary`. Unrelated mentions do not highlight.
3. **Animal images left-oriented** — `AnimalBubble` was receiving `isMine={true}` which caused `alignSelf: "flex-end"`. Now always passed `isMine={false}` in stacked mode to force left alignment.
4. **Tighter left-wall spacing** — `rowPaddingH` reduced 16→8, `gutterGap` reduced 12→8. Content now starts at 56px from screen edge (was 68px), 12px closer to the left wall.
5. **Larger avatars** — `avatarSize` increased 32→40, filling the gutter completely for clearer sender identity.
6. **Real display name instead of "You"** — stacked renderers now show the user's actual display name in author headers, matching Discord's convention. `ChatMessageRenderer` accepts `currentUserDisplayName` prop from the screen.
7. **`selfTintOpacity` and `selfAccentWidth` zeroed** — tokens kept for interface compatibility but effectively disabled.
