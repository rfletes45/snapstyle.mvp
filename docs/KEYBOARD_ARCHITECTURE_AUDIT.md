# Keyboard Architecture Audit — Full Issue & Tradeoff Analysis

> Date: 2026-03-28 (updated 2026-03-28)  
> Package versions: `react-native` 0.81.5, `expo` ~54.0.31, `react-native-keyboard-controller` ^1.21.2 (JS & node_modules), `react-native-reanimated` ~4.1.1  
> App config: `newArchEnabled: true` in `app.json`  
> Runtime: Expo Go (`npx expo start`) — **`expo-dev-client` now installed; native build needed for full KCSV support**  
> Platform: Android (primary dev target, but must work iOS)
>
> **Resolution Status**: PATH B chosen — `expo-dev-client` installed, KCSV + KSV architecture implemented as primary. KAV `behavior="padding"` + animated safe-area spacer as Expo Go fallback.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Runtime Environment Reality](#2-runtime-environment-reality)
3. [Available Components from react-native-keyboard-controller](#3-available-components)
4. [Current Architecture (v3 — KAV fallback)](#4-current-architecture)
5. [Observed Bugs — Current KAV Approach](#5-observed-bugs-kav)
6. [Previous Architecture (v2 — KSV-only)](#6-previous-architecture)
7. [Observed Bugs — Previous KSV Approach](#7-observed-bugs-ksv)
8. [Root Cause Analysis — Why Both Approaches Fail](#8-root-cause-analysis)
9. [Component Deep-Dive — Animation Math](#9-component-deep-dive)
10. [Inventory of All Layout Elements](#10-layout-element-inventory)
11. [Constraints & Requirements](#11-constraints)
12. [Potential Solution Approaches](#12-potential-solutions)
13. [File Reference](#13-file-reference)

---

## 1. Executive Summary

The chat screen keyboard integration has been through three iterations. Each solved some problems but introduced others. The fundamental challenge is:

**The app runs on Expo Go, which does NOT include the native `KeyboardChatScrollView` (KCSV) component.** KCSV requires a custom native build (`expo prebuild --clean` + compile). It registers a native view called `ClippingScrollViewDecoratorView` on Android — runtime detection via `UIManager.getViewManagerConfig()` confirms it is **not present**.

Without KCSV, the two remaining library components are:

- `KeyboardStickyView` (KSV) — translateY-based, RN Animated
- `KeyboardAvoidingView` (KAV) — height/padding/position-based, Reanimated

Both have fundamental tradeoffs that cause visual bugs when used as the sole keyboard management strategy for an inverted chat FlatList with a composer footer.

---

## 2. Runtime Environment Reality

| Fact                               | Value                                                  |
| ---------------------------------- | ------------------------------------------------------ |
| JS package version                 | 1.21.2                                                 |
| Native binary version              | Whatever Expo Go SDK 54 ships (likely 1.15–1.18)       |
| `isKCSVAvailable` at runtime       | `false`                                                |
| `KeyboardStickyView` available     | ✅ Yes (pure JS/Animated — no native view needed)      |
| `KeyboardAvoidingView` available   | ✅ Yes (pure JS/Reanimated — no native view needed)    |
| `KeyboardGestureArea` available    | ❓ May or may not be — it's a native view component    |
| `KeyboardChatScrollView` available | ❌ No — requires native rebuild                        |
| `KeyboardProvider`                 | ✅ Wraps entire app in `App.tsx`                       |
| `useKeyboardAnimation()`           | ✅ Returns RN `Animated.Value` (height, progress)      |
| `useReanimatedKeyboardAnimation()` | ✅ Returns Reanimated `SharedValue` (height, progress) |
| `useKeyboardHandler()`             | ✅ Worklet-based keyboard event handler                |
| New Architecture                   | Enabled in config but Expo Go may not fully support it |

**Key insight**: Expo Go may ship an older keyboard-controller native module. The JS code is 1.21.2 but the native side only exposes what was compiled into the Expo Go binary. All JS-only components (KSV, KAV) work because they use `Animated`/`Reanimated` which are available. But KCSV's `ClippingScrollViewDecoratorView` is not registered.

---

## 3. Available Components

### KeyboardStickyView (KSV)

- **Animation engine**: RN `Animated` (not Reanimated)
- **Mechanism**: `translateY` on the entire view
- **Math**: `translateY = height + interpolate(progress, [0,1] → [closed, opened])`
  - Where `height` is `Animated.AnimatedMultiplication` (NEGATIVE when keyboard open, e.g., `-318`)
  - With `closed: 0, opened: 0`: keyboard closed → translateY = 0, keyboard open → translateY = -318
- **What it does**: Slides the footer view upward by the keyboard height
- **What it does NOT do**: Does not change the flex layout. The container size stays the same. The FlatList doesn't know anything changed.
- **Import**: `import { KeyboardStickyView } from "react-native-keyboard-controller"`

### KeyboardAvoidingView (KAV)

- **Animation engine**: Reanimated `SharedValue` + `useAnimatedStyle`
- **Behaviors available**:
  - `"height"` — Sets `{ height: frame.height - bottom, flex: 0 }` when keyboard is open. **Removes flex: 1** and sets an explicit height.
  - `"padding"` — Sets `{ paddingBottom: bottom }`. Adds padding equal to keyboard height.
  - `"position"` — Sets `{ bottom: bottom }`. Translates content up.
  - `"translate-with-padding"` — Uses both `paddingTop` and `translateY`.
- **Internal keyboard hook** (different from the exported one!): Uses its own `useKeyboardAnimation` from `./hooks.ts` which creates **local** `SharedValue`s updated via `useKeyboardHandler`. This tracks `height`, `progress`, `heightWhenOpened`, `isClosed`.
- **Layout measurement**: Captures `onLayout` frame (y, height) and computes `relativeKeyboardHeight = max(0, frame.y + frame.height - keyboardY)` where `keyboardY = screenHeight - heightWhenOpened - keyboardVerticalOffset`.
- **`behavior: "height"` quirk**: Only captures initial frame when keyboard is CLOSED (to avoid measuring the already-shrunken view). When keyboard opens, it sets `{ height: initialFrame.height - bottom, flex: 0 }`. When keyboard closes, it returns `{}` (restoring flex: 1).
- **Renders as**: `Reanimated.View` with animated styles
- **Import**: `import { KeyboardAvoidingView } from "react-native-keyboard-controller"`

### KeyboardChatScrollView (KCSV)

- **NOT AVAILABLE in current runtime** (Expo Go)
- **Would** handle everything: contentInset adjustment, UI-thread scroll position changes, interactive dismiss sync, inverted list support
- **Requires**: Native `ClippingScrollViewDecoratorView` compiled in

---

## 4. Current Architecture (v3 — KAV fallback)

### Layout Structure

```
<KeyboardAvoidingView behavior="height" enabled={!isKCSVAvailable} style={flex:1}>
  <Header />
  <PinnedInviteBar />  (conditional)
  <ChatMessageList>    (flex:1 — inverted FlatList with plain ScrollView fallback)
  <NetworkBanner />    (in flex flow, collapses when hidden)
  <ChatFooterWrapper>  (renders children directly — no KSV wrapping)
    <TypingBar/Bubble />
    <ChatComposer />   (overflow: visible, ~56px tall)
    <View height={insets.bottom} />  (safe-area spacer, ~34px on Android)
  </ChatFooterWrapper>
  <ScrollReturnButton />  (position: absolute — doesn't affect layout)
</KeyboardAvoidingView>
```

### What ChatFooterWrapper Does

When `isKCSVAvailable` is false (current state), it renders `<>{children}</>` — i.e., children are directly in the flex layout. No KSV wrapping.

### Files

- `src/components/chat/ChatKeyboardScrollView.tsx` — `ChatFooterWrapper`, `isKCSVAvailable`
- `src/screens/chat/ChatScreen.tsx` — `KeyboardAvoidingView` wrapper, `ChatFooterWrapper` footer
- `src/screens/groups/GroupChatScreen.tsx` — same pattern
- `src/components/chat/ChatMessageList.tsx` — `paddingTop: 8` (visual bottom gap on inverted list)

---

## 5. Observed Bugs — Current KAV Approach

### Bug 5.1: Jittery keyboard animation

- **Symptom**: When keyboard opens/closes, the content visibly jitters or stutters
- **Likely cause**: KAV `behavior: "height"` switches between `{ flex: 1 }` and `{ height: X, flex: 0 }`. This triggers a complete flex layout recalculation. On every animation frame, the container height changes → FlatList re-measures → content shifts → another layout pass. RN layout is async on the JS thread, so there's at least 1-frame lag between the Reanimated animated style and the RN layout engine actually applying the new height to children.
- **Compounding factor**: KAV uses Reanimated `useAnimatedStyle` which runs on the UI thread, but React Native's Yoga (flexbox) layout runs on the JS thread. The height change triggers an async layout pass that always lags behind the animation.
- **Additional factor**: `behavior: "height"` checks `!keyboard.isClosed.value` — the transition from `isClosed: true → false` happens at `onStart`, meaning the height constraint applies BEFORE the keyboard has fully animated. When the keyboard starts closing, `isClosed` becomes `true` again at `onEnd`, restoring `flex: 1` — but there's a brief moment where the view snaps.

### Bug 5.2: Large gap between typing UI and keyboard

- **Symptom**: When keyboard is open, there's a ~34px gap between the ChatComposer bottom and the keyboard top
- **Root cause**: The safe-area spacer `<View style={{ height: insets.bottom }}>` (34px on most Android devices) is always rendered below the ChatComposer. When the keyboard is open, this spacer appears between the composer and keyboard because nothing hides it. KAV `behavior: "height"` shrinks the container by the keyboard height, but the spacer is inside the container and still takes up space.
- **Why this didn't exist with KSV**: KSV uses `translateY` which shifts ALL children upward by the full keyboard height. The spacer gets pushed behind/below the keyboard. With KAV `behavior: "height"`, the container shrinks but the spacer is still visible in the flex layout.

### Bug 5.3: Typing UI doesn't close all the way when keyboard closes

- **Symptom**: When keyboard dismisses, the composer/footer area doesn't return to its proper resting position
- **Likely cause**: KAV's `behavior: "height"` animation restores `{}` (removing height constraint) when `keyboard.isClosed.value` becomes true. But `isClosed` is set in `onEnd` — after the animation completes. During the closing animation, the height keeps shrinking toward `frame.height - 0 = frame.height` but there's a gap between the animated value reaching 0 and `isClosed` being set. The transition from `{ height: X, flex: 0 }` back to `{ flex: 1 }` is discontinuous — it's a digital snap, not an animated transition.
- **Contributing factor**: `initialFrame` may have been captured with a stale value if the layout changed (e.g., NetworkBanner appeared/disappeared, TypingBar visibility changed).

---

## 6. Previous Architecture (v2 — KSV-only)

### Layout Structure

```
<View style={flex:1}>
  <Header />
  <ChatMessageList>   (flex:1 — inverted FlatList with plain ScrollView)
  <NetworkBanner />
  <KeyboardStickyView offset={{ closed: 0 }}>
    <TypingBar/Bubble />
    <ChatComposer />
    <View height={insets.bottom} />  (safe-area spacer)
  </KeyboardStickyView>
  <ScrollReturnButton />
</View>
```

---

## 7. Observed Bugs — Previous KSV Approach

### Bug 7.1: Messages don't move upward with keyboard

- **Root cause**: KSV uses `translateY` — it visually moves the footer upward but does NOT change the flex layout. The outer `<View style={flex:1}>` is the same size. The FlatList (flex:1) occupies the same number of pixels. The messages stay in place. Only the footer slides up — and it overlaps the bottom messages.
- **This is the fundamental flaw of KSV-only**: It's designed to be used WITH KCSV, which handles the message list. Without KCSV, the list has no keyboard awareness.

### Bug 7.2: Large gap between typing UI and keyboard when open

- **Root cause**: The safe-area spacer (34px) is inside the KSV. KSV's `translateY = height + offset` lifts everything by keyboard height. The spacer gets lifted above the keyboard, creating a 34px dead band.
- **Math**: Container resting bottom = screen bottom. After translateY: container is at `screen bottom - keyboardHeight`. The spacer (34px) sits below the composer, so the gap = spacer height = 34px.

### Bug 7.3: Composer clipping when keyboard closed

- **Symptom**: When keyboard closes, the composer is clipped at the bottom or not fully visible.
- **Root cause**: When `closed: 0`, KSV at rest has `translateY = Animated.add(height, offset)`. With height=0 (keyboard closed), translateY=0+0=0 — correct. But if there was previously a non-zero `closed` offset (e.g., `insets.bottom`), the view would be pushed DOWN by that amount. Early iterations had `closed: insets.bottom` which caused this.

### Bug 7.4: Gap between bottom messages and composer gone

- **Root cause**: The migration removed `listBottomInset`/`staticBottomInset`/animated spacer from ChatMessageList. Nothing replaced the bottom content padding. (Partially fixed in v3 with `paddingTop: 8`, but this was only 8px.)

---

## 8. Root Cause Analysis — Why Both Approaches Fail

### The Fundamental Problem

Both KSV and KAV are designed for "simple" keyboard avoidance use cases — a fixed-height view that needs to move or resize when the keyboard appears. They were NOT designed for the specific combination of:

1. **Inverted FlatList** — newest messages at bottom (index 0), `maintainVisibleContentPosition` active
2. **Composer at bottom that must track keyboard** — must sit flush above the keyboard when open
3. **Message list must resize** — when keyboard opens, the visible message area must shrink so messages appear to move up
4. **Safe area that applies conditionally** — bottom safe area needed when keyboard closed, not when open
5. **Interactive keyboard dismiss** — iOS drag-to-dismiss must be smooth, not stepped

### Why KSV Fails

KSV uses `translateY` which is a **visual-only** transform. It doesn't trigger a flex layout change. The parent `View` is still the same height. The FlatList still occupies the same pixel count. Only the footer moves — floating over the bottom messages. This is intentional: KSV is designed to be paired with KCSV, which separately adjusts the list's contentInset.

### Why KAV `behavior: "height"` Fails

KAV's `"height"` behavior sets an explicit `height` + `flex: 0` on the container when the keyboard is open. This DOES trigger a layout change — the FlatList shrinks. However:

1. **Layout is async**: Reanimated animated styles run on the UI thread. RN Yoga layout runs on the JS thread. There's always a 1+ frame lag between the animated height change and the actual layout reflow. This causes jitter.
2. **Digital flex transition**: When keyboard opens, `flex: 1` → `{ height: X, flex: 0 }`. When keyboard closes, back to `flex: 1`. These transitions are discontinuous rather than animated.
3. **Safe area spacer stays visible**: Unlike KSV (which slides everything behind the keyboard), KAV just shrinks the container. The safe-area spacer is still IN the layout, eating 34px of the now-smaller container.
4. **Frame measurement issues**: KAV only captures `initialFrame` when keyboard is closed. If the layout changes between keyboard opens (e.g., TypingBar visibility, NetworkBanner), the frame is stale.

### Why KAV `behavior: "padding"` Would Also Fail

KAV `"padding"` adds `paddingBottom` equal to keyboard height. On the outer container with `flex: 1`, this would push content up — but the FlatList inside would shrink. The problems:

1. Same async layout lag → jitter
2. The padding adds to the BOTTOM of the container, but the FlatList is inverted, so the visual effect is complex
3. The safe area spacer issue remains

### Why KAV `behavior: "position"` Would Also Fail

KAV `"position"` moves content via `bottom` style. This is similar to KSV's `translateY` — it's a visual shift, not a layout change. Same fundamental problem as KSV: FlatList doesn't resize.

### The Safe-Area Spacer Problem

Both approaches need safe-area padding when the keyboard is closed (so the composer doesn't sit behind the Android navigation bar). When the keyboard is open, this padding becomes a gap. Solutions:

- KSV: The spacer slides behind the keyboard (hidden) — works naturally but list doesn't resize
- KAV height: The spacer stays in layout (visible gap) — broken
- Animated safe area: Animate the spacer height from `insets.bottom` → 0 as keyboard opens — adds complexity but could work with either approach

---

## 9. Component Deep-Dive — Animation Math

### KSV Animation

```
// From react-native-keyboard-controller/src/components/KeyboardStickyView/index.tsx
// Uses: useKeyboardAnimation() from ../../hooks (RN Animated values from context)

const { height, progress } = useKeyboardAnimation();
// height: Animated.AnimatedMultiplication — NEGATIVE when open (e.g., -318)
// progress: Animated.Value — 0 when closed, 1 when open

const offset = progress.interpolate({
  inputRange: [0, 1],
  outputRange: [closed, opened],  // e.g., [0, 0]
});
// offset: 0 when closed, 0 when open (with both = 0)

const active = Animated.add(height, offset);
// active: height + offset = -318 + 0 = -318 when keyboard open
// active: 0 + 0 = 0 when keyboard closed

// Final style:
{ transform: [{ translateY: active }] }
// keyboard closed: translateY = 0
// keyboard open: translateY = -318
```

### KAV Animation (behavior: "height")

```
// From react-native-keyboard-controller/src/components/KeyboardAvoidingView/index.tsx
// Uses: INTERNAL useKeyboardAnimation() from ./hooks.ts (Reanimated SharedValues)
// This is a DIFFERENT hook than the exported one — it creates its own local SharedValues

// Internal hook tracks:
// - height: SharedValue (keyboard height, changes on onMove/onInteractive/onEnd)
// - progress: SharedValue (0→1)
// - heightWhenOpened: SharedValue (captured at onStart when height > 0)
// - isClosed: SharedValue<boolean> (set at onStart/onEnd)

const relativeKeyboardHeight = () => {
  // How much of the keyboard overlaps THIS view
  const keyboardY = screenHeight - heightWhenOpened - keyboardVerticalOffset;
  return max(0, frame.y + frame.height - keyboardY);
};

const bottom = interpolate(progress.value, [0, 1], [0, relativeKeyboardHeight()]);
const height = frame.height - bottom;

// When keyboard opens:
if (!isClosed && height > 0) {
  return { height: frame.height - bottom, flex: 0 };
}
// When keyboard closes:
return {};  // flex: 1 restores from the style prop
```

### Key Differences

| Aspect                       | KSV                                | KAV (height)                       |
| ---------------------------- | ---------------------------------- | ---------------------------------- |
| Animation engine             | RN Animated                        | Reanimated SharedValue             |
| Layout effect                | None (visual translateY)           | Yes (height + flex: 0)             |
| Transition quality           | Smooth (pure Animated)             | Jittery (layout reflow lag)        |
| Works with inverted FlatList | Only with KCSV                     | Partial (list resizes but jitters) |
| Safe area handling           | Spacer hides behind keyboard       | Spacer remains visible             |
| Interactive dismiss          | Smooth (Animated tracks it)        | Should work but may jitter         |
| Children awareness           | Children don't know about keyboard | Children resize via layout         |

---

## 10. Inventory of All Layout Elements

### Chat Screen Flex Stack (top to bottom, inside KAV)

| Element            | Height                | Flex    | Notes                               |
| ------------------ | --------------------- | ------- | ----------------------------------- |
| ChatHeader         | ~56px                 | —       | Fixed height                        |
| PinnedInviteBar    | ~48px or 0            | —       | Conditional                         |
| ChatMessageList    | Remaining             | flex: 1 | Inverted FlatList                   |
| NetworkBanner      | ~28px or 0            | —       | Animated, slides in/out             |
| TypingBar/Bubble   | ~24px or 0            | —       | Conditional                         |
| ChatComposer       | ~56px                 | —       | `minHeight: 40`, with padding ~56px |
| Safe-area spacer   | insets.bottom (~34px) | —       | Always rendered                     |
| ScrollReturnButton | —                     | —       | `position: absolute`                |

### Total footer height when keyboard closed

~56 (composer) + 34 (safe area) = ~90px

### KCSV offset config (currently unused since KCSV unavailable)

`offset: 60 + insets.bottom` — This tells KCSV how much space the footer occupies so it can subtract from keyboard height. Currently set but has no effect.

---

## 11. Constraints & Requirements

### Must Have

1. **Messages must scroll up when keyboard opens** — the FlatList visible area must shrink
2. **Composer must sit flush above keyboard** — no gap
3. **Composer must sit above safe area when keyboard closed** — no clipping
4. **Smooth animation** — no jitter, stutter, or snapping
5. **Interactive dismiss must work** — iOS drag-to-dismiss, composer follows keyboard down
6. **Must work in Expo Go** — no native rebuild (at least for now)
7. **`maintainVisibleContentPosition` must not fight keyboard** — no double-scrolling or jumping
8. **Must work in both stacked and bubble display modes**
9. **Must work for both ChatScreen (DM) and GroupChatScreen**

### Nice to Have

10. **Works seamlessly when KCSV becomes available** after native rebuild
11. **Single approach** — not two separate code paths that both have bugs

### Hard Constraints

- No `expo-dev-client` currently installed
- `KeyboardProvider` already wraps the app
- `useReanimatedKeyboardAnimation` and `useKeyboardHandler` are available
- FlatList is inverted with `maintainVisibleContentPosition`
- Various conditional elements above/below the list (PinnedInviteBar, NetworkBanner, TypingBar)

---

## 12. Potential Solution Approaches

### Approach A: KAV `behavior: "padding"` Instead of `"height"`

- **Idea**: Use `paddingBottom` instead of explicit height. This avoids the `flex: 0` snap.
- **Pros**: No digital flex transition, padding is animated smoothly
- **Cons**: On an inverted FlatList, paddingBottom on the parent might not work as expected. The FlatList would still have `flex: 1` and would resize to fill `parentHeight - paddingBottom`. Might have same async layout lag. Safe area spacer still visible.
- **Risk**: Medium

### Approach B: Animated spacer inside FlatList + KSV for footer

- **Idea**: Go back to KSV for the footer (smooth translateY). For the message list, add an animated spacer as ListFooterComponent (which is visual top on inverted list) OR animate `contentContainerStyle.paddingTop` to match keyboard height. This makes the FlatList's content taller → scroll offset changes → messages shift.
- **Pros**: KSV footer animation is smooth. Content padding doesn't cause layout reflow on the container.
- **Cons**: Animated `paddingTop` on an inverted FlatList might fight with `maintainVisibleContentPosition`. Need to sync spacer animation with keyboard perfectly.
- **Risk**: Medium-High

### Approach C: KSV for footer + `scrollTo` on keyboard events

- **Idea**: KSV slides the footer. On keyboard open, programmatically `scrollTo` the FlatList to adjust content offset. The messages don't actually need to "resize" — they just need to appear to have scrolled up.
- **Pros**: KSV animation is smooth. scrollTo is a single call, no ongoing animation sync.
- **Cons**: `scrollTo` timing must match keyboard animation exactly or it'll look jerky. On interactive dismiss, need continuous `scrollTo` calls. `maintainVisibleContentPosition` might fight the programmatic scroll.
- **Risk**: High

### Approach D: Pure Reanimated manual approach (no library components)

- **Idea**: Ditch KSV and KAV entirely. Use `useReanimatedKeyboardAnimation()` (or `useKeyboardHandler`) to get keyboard height as a SharedValue. Build custom animated styles:
  - Footer: `Reanimated.View` with `transform: [{ translateY: -keyboardHeight }]` (same as KSV but with Reanimated)
  - Safe area spacer: Animate height from `insets.bottom` → 0 with keyboard progress
  - FlatList container: Animate `marginBottom` or `paddingBottom` or explicit height using Reanimated
- **Pros**: Full control. Can use `useAnimatedStyle` (UI thread) for the footer transform AND animated props for the spacer. No library component quirks.
- **Cons**: Essentially reimplementing KSV + KAV from scratch. Risk of same layout lag issues if using height/padding to resize the FlatList parent.
- **Risk**: Medium — but most flexible

### Approach E: Install `expo-dev-client` and do a native rebuild

- **Idea**: Install expo-dev-client, run `npx expo prebuild --clean`, build a development client. This makes KCSV native available. Use the KCSV + KSV architecture as originally designed.
- **Pros**: KCSV was purpose-built for this exact use case. It handles contentInset on the UI thread with zero layout reflow. KSV pairs perfectly with it.
- **Cons**: Requires infrastructure change (dev client build pipeline). Takes time. May have its own bugs on first integration.
- **Risk**: Low (if KCSV works as documented) — but has the highest upfront investment.

### Approach F: React Native's built-in KeyboardAvoidingView

- **Idea**: Use RN's own `KeyboardAvoidingView` instead of the library's. It's battle-tested and doesn't use Reanimated.
- **Pros**: Well-known behavior, no native dependency issues.
- **Cons**: RN's KAV is notoriously bad with inverted FlatLists and on Android. This is likely WHY the library was adopted in the first place. Also doesn't solve the jitter problem — same async layout issue.
- **Risk**: High

### Approach G: Hybrid — KSV footer + KAV wrapping only the FlatList

- **Idea**: Instead of KAV wrapping the entire screen, wrap only the `ChatMessageList` in `KeyboardAvoidingView behavior="height"`. Use KSV for the footer. This separates the two concerns:
  - KSV handles footer positioning (smooth, translateY-driven)
  - KAV handles list resizing (triggers layout reflow only on the FlatList)
  - Safe-area spacer inside KSV (hides behind keyboard naturally)
- **Pros**: Footer animation is smooth (KSV). List resizing might be smoother since only the list container changes height, not the entire screen.
- **Cons**: Two keyboard-aware components might conflict. KAV measures its frame to calculate `relativeKeyboardHeight` — but if it's placed in the middle of the flex layout (not at the bottom of the screen), the math might be wrong because it accounts for elements below it.
- **Risk**: Medium-High

### Approach H: KSV footer + `contentContainerStyle.paddingTop` animated via Reanimated

- **Idea**: KSV for the footer. For the FlatList, pass `contentContainerStyle` with an animated `paddingTop` (visual bottom on inverted list). As keyboard opens, increase this padding to push content up. This doesn't change the list CONTAINER height — it changes the content INSIDE the scroll view.
- **Pros**: Doesn't trigger container layout reflow. `contentInset` approach (what KCSV does natively) is conceptually similar.
- **Cons**: Animated styles on `contentContainerStyle` may not be supported by `FlatList` (it may not be an `Animated.View` internally). Would need to wrap the content container or use a different mechanism. May fight `maintainVisibleContentPosition`.
- **Risk**: Medium-High

---

## 13. File Reference

### Modified Files (current state)

| File                                             | Role                                                   |
| ------------------------------------------------ | ------------------------------------------------------ |
| `src/components/chat/ChatKeyboardScrollView.tsx` | KCSV adapter + `ChatFooterWrapper` + `isKCSVAvailable` |
| `src/components/chat/ChatMessageList.tsx`        | Inverted FlatList, `paddingTop: 8` for bottom gap      |
| `src/components/chat/ChatComposer.tsx`           | Composer UI, `overflow: "visible"`, ~56px tall         |
| `src/hooks/chat/useChatKeyboard.ts`              | Exports keyboard SharedValues + JS state               |
| `src/screens/chat/ChatScreen.tsx`                | DM chat — `KeyboardAvoidingView` + `ChatFooterWrapper` |
| `src/screens/groups/GroupChatScreen.tsx`         | Group chat — same pattern                              |
| `App.tsx`                                        | `KeyboardProvider` wrapping the app                    |

### Library Source Files (for reference)

| File                                                                                            | Role                                                                                           |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `node_modules/react-native-keyboard-controller/src/components/KeyboardStickyView/index.tsx`     | KSV — pure RN Animated, translateY                                                             |
| `node_modules/react-native-keyboard-controller/src/components/KeyboardAvoidingView/index.tsx`   | KAV — Reanimated, height/padding/position                                                      |
| `node_modules/react-native-keyboard-controller/src/components/KeyboardAvoidingView/hooks.ts`    | KAV's internal keyboard hooks (separate SharedValues)                                          |
| `node_modules/react-native-keyboard-controller/src/hooks/index.ts`                              | Exported hooks: `useKeyboardAnimation`, `useReanimatedKeyboardAnimation`, `useKeyboardHandler` |
| `node_modules/react-native-keyboard-controller/src/context.ts`                                  | AnimatedContext (RN Animated) vs ReanimatedContext (SharedValues)                              |
| `node_modules/react-native-keyboard-controller/src/components/KeyboardChatScrollView/index.tsx` | KCSV — native view wrapper (unavailable)                                                       |

---

## Appendix: Quick Summary of What the Solving Agent Needs to Do

1. Pick an approach from Section 12 (or devise a new one)
2. Must satisfy ALL requirements in Section 11
3. Must fix ALL three current bugs in Section 5
4. Must NOT reintroduce bugs from Section 7
5. Test on Android via Expo Go (primary dev environment)
6. Changes should be minimal — modify only the files in Section 13
7. TypeScript must compile: `npx tsc --noEmit`
8. Tests must pass: `npx jest --testPathPattern="chat|timeline|divider"`
