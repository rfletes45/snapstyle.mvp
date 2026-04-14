# Keyboard System — Complete Reference

**Last Updated:** April 14, 2026  
**Covers:** Expo Go fallback keyboard, TestFlight native system keyboard (via UITextView wrapper), keyboard avoidance engine, keyboard backdrop color system, composer sheet coordination, sheet dismissal policy, safe area handling

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Runtime Detection Logic](#2-runtime-detection-logic)
3. [File Inventory](#3-file-inventory)
4. [Expo Go (Fallback) Keyboard Path](#4-expo-go-fallback-keyboard-path)
5. [TestFlight (Native) Keyboard Path](#5-testflight-native-keyboard-path)
   5A. [Keyboard Backdrop & Color System](#5a-keyboard-backdrop--color-system)
6. [Keyboard Avoidance Engine](#6-keyboard-avoidance-engine)
7. [Composer Sheet Coordination](#7-composer-sheet-coordination)
8. [Safe Area Handling](#8-safe-area-handling)
9. [Chat Screen Layout Hierarchy](#9-chat-screen-layout-hierarchy)
10. [Data Flow Diagrams](#10-data-flow-diagrams)
11. [Known Issues & Edge Cases](#11-known-issues--edge-cases)
12. [Debugging Guide](#12-debugging-guide)
13. [Build Requirements](#13-build-requirements)

---

## 1. Architecture Overview

The keyboard system has **two independent paths** that are selected at runtime:

### Path A: TestFlight / Native Build (KCSV + Native UITextView)

- **Apple's system keyboard** with a native `UITextView` wrapper rendered via an Expo local native module (`NativeComposerView`). No custom `inputView` — the UITextView uses the standard iOS keyboard while providing native text editing, auto-grow, and cursor management.
- **KeyboardChatScrollView (KCSV)** from `react-native-keyboard-controller` (RKBC) handles message list content inset on the UI thread at 60fps
- **KeyboardStickyView (KSV)** positions the composer footer exactly at the keyboard top
- **Keyboard backdrop layer** fills the space below the composer with the composer's surface color, animated in sync with keyboard height
- iOS sends standard keyboard notifications → RKBC works transparently

### Path B: Expo Go Fallback (Standard TextInput + Animated PaddingBottom)

- **Standard React Native `TextInput`** with system keyboard
- **FallbackKeyboardContainer** uses Reanimated `paddingBottom` animated by RN `Keyboard` events bridged into shared values
- **ChatFooterWrapper** renders children as a plain fragment (no KSV)
- Step-wise animation (event-driven, not 60fps) but fully functional

### Why Two Paths?

Expo Go does not include native modules compiled from `modules/` or native cocoapods like `react-native-keyboard-controller`. The fallback ensures the app boots and works in Expo Go for development, while the native path provides the production-quality experience.

---

## 2. Runtime Detection Logic

### Is KCSV Available?

**File:** `src/components/chat/ChatKeyboardScrollView.tsx` (lines 48-73)

```typescript
let kcsvAvailable = false;
try {
  const nativeView = "ClippingScrollViewDecoratorView";
  const hasNativeView =
    UIManager.hasViewManagerConfig?.(nativeView) ??
    UIManager.getViewManagerConfig(nativeView) != null;

  if (
    hasNativeView &&
    isKeyboardControllerAvailable &&
    OptionalKeyboardChatScrollView
  ) {
    try {
      require("@stream-io/react-native-webrtc"); // proxy for "is this a native build?"
      KeyboardChatScrollView = OptionalKeyboardChatScrollView;
      kcsvAvailable = true;
    } catch {
      kcsvAvailable = false;
    }
  }
} catch {
  kcsvAvailable = false;
}
export const isKCSVAvailable = kcsvAvailable;
```

**Detection chain:**

1. Check `UIManager` for `ClippingScrollViewDecoratorView` (native RKBC view)
2. Check `isKeyboardControllerAvailable` (from `optionalKeyboardController.tsx`)
3. Attempt `require("@stream-io/react-native-webrtc")` as a native-build proxy
4. All three must pass → `kcsvAvailable = true`

### Is Native Keyboard Module Available?

**File:** `src/modules/nativeKeyboard/NativeKeyboardModule.ts` (lines 18-33)

```typescript
const IS_EXPO_GO =
  Constants.executionEnvironment === "storeClient" ||
  Constants.appOwnership === "expo" ||
  Constants.expoVersion != null;

if (Platform.OS === "ios" && !IS_EXPO_GO) {
  try {
    const { requireNativeModule } = require("expo-modules-core");
    mod = requireNativeModule("NativeKeyboard");
  } catch {
    mod = null;
  }
}
export const isNativeKeyboardModuleAvailable = mod !== null;
```

### Is Native Composer View Available?

**File:** `src/modules/nativeKeyboard/NativeKeyboardView.tsx` (lines 21-31)

```typescript
if (Platform.OS === "ios" && isNativeKeyboardModuleAvailable) {
  try {
    const { requireNativeViewManager } = require("expo-modules-core");
    NativeViewComponent = requireNativeViewManager("NativeKeyboard");
  } catch {
    NativeViewComponent = null;
  }
}
export const isNativeComposerAvailable = NativeViewComponent !== null;
```

### How ChatComposer Decides

**File:** `src/components/chat/ChatComposer.tsx` (line 181)

```typescript
const useNative = Platform.OS === "ios" && isNativeComposerAvailable;
```

If `useNative` is true → renders `<NativeComposerInput>` (native UITextView + system keyboard)  
If false → renders standard `<TextInput>` (system keyboard)

---

## 3. File Inventory

### Native iOS Module (`modules/native-keyboard/`)

| File                                  | Purpose                                                                                                                                                                           | Lines |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `expo-module.config.json`             | Expo autolinking configuration                                                                                                                                                    | 9     |
| `ios/NativeKeyboardModule.swift`      | Expo module definition: 5 imperative functions + View prop/event registration. Registers `keyboardAppearance` prop (replaces old `keyboardTheme`).                                | ~90   |
| `ios/NativeComposerView.swift`        | `ExpoView` subclass: `UITextView` with system keyboard (`inputView = nil`), `UITextViewDelegate`, auto-grow, event dispatchers, text sync. Return key intercepts `"\n"` for send. | ~180  |
| `android/.../NativeKeyboardModule.kt` | Minimal stub (Name only — no Android implementation)                                                                                                                              | 11    |

> **Removed files (April 2026):** `CustomInputKeyboardView.swift`, `KeyboardKeyButton.swift`, `KeyPopupView.swift` were deleted when the custom keyboard was replaced by Apple’s system keyboard.

### TypeScript Bridge (`src/modules/nativeKeyboard/`)

| File                      | Purpose                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `types.ts`                | `NativeComposerViewProps` (with `keyboardAppearance`), event types (`TextChangeEvent`, `SelectionChangeEvent`, `SendPressEvent`, `FocusChangeEvent`, `ContentSizeChangeEvent`) |
| `NativeKeyboardModule.ts` | `requireNativeModule` bridge: `focus()`, `blur()`, `clear()`, `insertTextAtCursor()`, `setCursorPosition()`. All no-ops when unavailable.                                      |
| `NativeKeyboardView.tsx`  | `requireNativeViewManager` wrapper component. Renders `null` when unavailable.                                                                                                 |
| `index.ts`                | Barrel re-exports                                                                                                                                                              |

### Keyboard Avoidance Engine (`src/components/chat/`)

| File                         | Key Exports                                                                                                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChatKeyboardScrollView.tsx` | `isKCSVAvailable`, `setChatScrollViewConfig()`, `ChatKeyboardScrollViewComponent`, `useRenderChatScrollComponent()`, `ChatFooterWrapper`, `ChatKeyboardContainer`, `FallbackKeyboardContainer`, `KeyboardSafeAreaSpacer`, `AnimatedSafeAreaSpacer`, `useEffectiveBottomInset()` |

### Keyboard Hook (`src/hooks/chat/`)

| File                 | Key Exports                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `useChatKeyboard.ts` | `useChatKeyboard()` → `ChatKeyboardState` (`keyboardHeight`, `keyboardProgress`, `isKeyboardOpen`, `finalKeyboardHeight`, `safeAreaBottom`) |

### Optional RKBC Wrapper (`src/utils/`)

| File                             | Key Exports                                                                                                                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `optionalKeyboardController.tsx` | `isKeyboardControllerAvailable`, `KeyboardProvider`, `KeyboardAvoidingView`, `KeyboardStickyView`, `KeyboardChatScrollView`, `useKeyboardHandlerCompat`, `useReanimatedKeyboardAnimationCompat`, `useFallbackKeyboardAnimation()` |

### Composer Integration (`src/components/chat/`)

| File                      | Role                                                                                                                                                                                                                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChatComposer.tsx`        | Composer UI component. Conditionally renders `NativeComposerInput` (iOS native) or `TextInput` (fallback). Manages send, focus, toolbar, voice, mentions, etc. Container background: `composerBackground ?? background`. Dismisses active sheet on main input focus via `handleMainInputFocus`.                |
| `NativeComposerInput.tsx` | React wrapper over native UITextView. Passes `keyboardAppearance` (`"dark"` / `"light"` based on theme). Imperative ref (`focus`/`blur`/`clear`/`isFocused`), event mapping (onTextChange → onChangeText, onSendPress → onSubmitEditing, onFocusChange → onFocus, etc.). Falls back to `TextInput` on Android. |

### Composer Sheet System (`src/contexts/`)

| File                       | Role                                                                                                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ComposerSheetContext.tsx` | Shared Reanimated values for keyboard↔sheet coordination: `sheetTranslateY`, `initialSnapHeight`, `isSheetActive`, `sheetExtraPadding`, `liveKeyboardHeight`. Functions: `activateSheet()`, `deactivateSheet()`, `dismissActiveSheet()`. |

### Screen-Level Integration

| File                                     | Keyboard Components Used                                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/screens/chat/ChatScreen.tsx`        | `ChatKeyboardContainer`, `ChatFooterWrapper`, `KeyboardSafeAreaSpacer`, `useRenderChatScrollComponent`, `setChatScrollViewConfig` |
| `src/screens/groups/GroupChatScreen.tsx` | Same set + `backgroundLayer` prop for wallpaper                                                                                   |
| `src/screens/chat/ThreadScreen.tsx`      | Same set (uses plain `TextInput`, not `NativeComposerInput`)                                                                      |

---

## 4. Expo Go (Fallback) Keyboard Path

### How It Works

When `isKCSVAvailable === false` (Expo Go), the following fallback chain activates:

#### 4.1 Keyboard Event Bridge

**File:** `src/utils/optionalKeyboardController.tsx`, `useFallbackKeyboardAnimation()`

```typescript
function useFallbackKeyboardAnimation() {
  const height = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const duration = e.duration > 0 ? e.duration : 250;
      height.value = withTiming(e.endCoordinates.height, { duration });
      progress.value = withTiming(1, { duration });
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      const duration = e?.duration > 0 ? e.duration : 250;
      height.value = withTiming(0, { duration });
      progress.value = withTiming(0, { duration });
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [height, progress]);

  return { height, progress };
}
```

**Key behaviors:**

- iOS uses `keyboardWillShow`/`keyboardWillHide` (fires before animation)
- Android uses `keyboardDidShow`/`keyboardDidHide` (only reliable events)
- Values are animated with `withTiming({ duration })` to smooth the transition
- `height` goes from 0 → keyboard pixel height (positive, unlike RKBC which is negative)
- `progress` goes from 0 → 1

**IMPORTANT convention difference:** RKBC's `useReanimatedKeyboardAnimation().height` is **negative** when open. The fallback `height` is **positive**. Code consuming these values (like `useEffectiveBottomInset`) uses `Math.abs(keyboardHeight.value)` to normalize.

#### 4.2 FallbackKeyboardContainer

**File:** `ChatKeyboardScrollView.tsx`, lines 300-327

Wraps the entire chat in an `Animated.View` whose `paddingBottom` tracks the effective bottom inset:

```typescript
function FallbackKeyboardContainer({ children, style, backdrop, backgroundUnderlay }) {
  const effectiveInset = useEffectiveBottomInset();
  const animatedStyle = useAnimatedStyle(() => ({
    paddingBottom: effectiveInset.value,
  }));
  return (
    <Animated.View style={[{ flex: 1 }, animatedStyle, style]}>
      {backdrop}
      {backgroundUnderlay}
      {children}
    </Animated.View>
  );
}
```

#### 4.3 useEffectiveBottomInset

**File:** `ChatKeyboardScrollView.tsx`, lines 206-224

```typescript
function useEffectiveBottomInset(): SharedValue<number> {
  const { sheetTranslateY, initialSnapHeight, isSheetActive } =
    useComposerSheet();
  const { height: keyboardHeight } = useReanimatedKeyboardAnimationCompat();

  return useDerivedValue(() => {
    const kbH = Math.abs(keyboardHeight.value);
    if (isSheetActive.value === 0) return kbH;

    const sheetVisible = FOOTER_SCREEN_HEIGHT - sheetTranslateY.value;
    const clamped = Math.min(
      Math.max(sheetVisible, 0),
      initialSnapHeight.value,
    );
    const composerOffset = Math.max(0, clamped - kbH);
    return kbH + composerOffset; // always >= kbH
  });
}
```

**Key formula:** `effectiveBottomInset = |keyboardHeight| + max(0, clampedSheetVisible - |keyboardHeight|)`

During keyboard→sheet transition:

- kbH drops from full → 0
- composerOffset rises from 0 → full sheet height
- Sum stays constant → no visual jump

#### 4.4 ChatFooterWrapper (Fallback)

In fallback mode, `ChatFooterWrapper` returns `<>{children}</>` — a plain fragment. The `FallbackKeyboardContainer`'s `paddingBottom` is the **single source of truth** for footer positioning. No `translateY` transform is applied.

#### 4.5 Scroll Component

`ChatKeyboardScrollViewComponent` returns a plain `<ScrollView>` when KCSV is unavailable:

```typescript
if (!kcsvAvailable || !KeyboardChatScrollView) {
  return <ScrollView ref={ref} {...props} />;
}
```

#### 4.6 TextInput

Standard React Native `<TextInput>` with:

- `multiline`
- `maxLength={1000}`
- `returnKeyType="send"`
- `submitBehavior="submit"`
- `keyboardAppearance` set by theme (`dark` / `light`)

---

## 5. TestFlight (Native) Keyboard Path

### 5.1 Native Module Architecture

The native path uses a `UITextView` wrapper with **Apple's system keyboard** (no custom `inputView`):

```
┌─────────────────────────────────────────────┐
│  NativeComposerView (ExpoView subclass)     │
│  ├─ UITextView (main text editing)          │
│  │   ├─ .inputView = nil (system keyboard)  │
│  │   ├─ .inputAccessoryView = nil           │
│  │   └─ UITextViewDelegate methods          │
│  └─ UILabel (placeholder)                   │
└─────────────────────────────────────────────┘
```

**Why keep a native UITextView wrapper at all?** The UITextView provides native-quality text editing (auto-grow, cursor management, text sync from RN props, `insertTextAtCursor`, `setCursorPosition`) that RN's `TextInput` cannot match. It also allows the return key to be intercepted for "send" behavior, and imperatively controlled focus/blur/clear.

**Keyboard notifications:** With the system keyboard, iOS sends standard keyboard notifications (`keyboardWillShow`, `keyboardWillHide`). RKBC works transparently — the avoidance engine requires no special handling.

> **Historical note (April 2026):** The custom keyboard (`CustomInputKeyboardView.swift`, `KeyboardKeyButton.swift`, `KeyPopupView.swift`) was removed. Those files no longer exist. The native UITextView wrapper was preserved for its text editing advantages.

### 5.2 NativeComposerView.swift — Detailed Behavior

**Keyboard appearance:**

```swift
func setKeyboardAppearance(_ appearance: String) {
    switch appearance {
    case "dark":  textView.keyboardAppearance = .dark
    case "light": textView.keyboardAppearance = .light
    default:      textView.keyboardAppearance = .default
    }
}
```

Driven by `NativeComposerInput.tsx` passing `keyboardAppearance={isDark ? "dark" : "light"}`.

**Return key intercept:**

```swift
func textView(_ textView: UITextView, shouldChangeTextIn range: NSRange,
              replacementText text: String) -> Bool {
    if text == "\n" {
        handleSendPress()
        return false  // prevent newline insertion — always triggers send
    }
    // ... maxLength check
}
```

The return key always triggers send (no globe-toggle guard needed since there is no custom keyboard).

**Auto-grow:**

```swift
override var intrinsicContentSize: CGSize {
    let textHeight = textView.sizeThatFits(...).height
    let clamped = min(max(textHeight, 36), 120)  // 36pt min, 120pt max
    return CGSize(width: UIView.noIntrinsicMetric, height: clamped)
}
```

**Text sync from RN props:**

```swift
func setTextFromProp(_ text: String) {
    guard textView.text != text else { return }
    isUpdatingFromProp = true
    textView.text = text
    // Cursor placed at end of text (for mention insertion / draft restore)
    textView.selectedRange = NSRange(location: (text as NSString).length, length: 0)
    isUpdatingFromProp = false
    updatePlaceholderVisibility()
    checkContentSizeChange()
}
```

### 5.3 NativeKeyboardModule.swift — Imperative Functions

| Function                   | Description                                                              | Threading                  |
| -------------------------- | ------------------------------------------------------------------------ | -------------------------- |
| `focus()`                  | `textView.becomeFirstResponder()`                                        | `DispatchQueue.main.async` |
| `blur()`                   | `textView.resignFirstResponder()`                                        | `DispatchQueue.main.async` |
| `clear()`                  | Calls `clearText()` → sets text to "", updates placeholder, emits change | `DispatchQueue.main.async` |
| `insertTextAtCursor(text)` | `textView.insertText(text)`                                              | `DispatchQueue.main.async` |
| `setCursorPosition(pos)`   | Sets `textView.selectedRange = NSRange(location: clamped, length: 0)`    | `DispatchQueue.main.async` |

**Static reference pattern:** `NativeKeyboardModule.activeComposer` is a weak reference set in `NativeComposerView.init()` and cleared in `deinit`. All module functions operate on this static reference.

**Prop registration:**

```swift
Prop("keyboardAppearance") { (view: NativeComposerView, appearance: String?) in
    view.setKeyboardAppearance(appearance ?? "default")
}
```

### 5.4 NativeComposerInput.tsx — RN Wrapper

**Event mapping:**

| Native Event          | RN Callback                   | Transformation                                             |
| --------------------- | ----------------------------- | ---------------------------------------------------------- |
| `onTextChange`        | `onChangeText(text)`          | Extract `event.nativeEvent.text`                           |
| `onSelectionChange`   | `onSelectionChange(e)`        | Construct `{ nativeEvent: { selection: { start, end } } }` |
| `onSendPress`         | `onSubmitEditing()`           | Direct call                                                |
| `onFocusChange`       | Internal `setIsFocused(bool)` | Extract `event.nativeEvent.isFocused`                      |
| `onContentSizeChange` | (unused)                      | Available for consumers                                    |

**Keyboard appearance (replaces old theme bridging):**

```tsx
<NativeComposerView
  keyboardAppearance={isDark ? "dark" : "light"}
  // ... other props
/>
```

No `KeyboardTheme` interface, no color helpers (`lighten`/`darken`/`adjustColor`). The system keyboard is styled entirely by iOS via the `keyboardAppearance` prop.

**Imperative ref:**

```typescript
useImperativeHandle(ref, () => ({
  focus: () => (useNative ? nativeFocus() : fallbackRef.current?.focus()),
  blur: () => (useNative ? nativeBlur() : fallbackRef.current?.blur()),
  clear: () => (useNative ? nativeClear() : fallbackRef.current?.clear()),
  isFocused: () => isFocused,
}));
```

---

## 5A. Keyboard Backdrop & Color System

### 5A.1 The Backdrop Layer

**File:** `src/components/chat/ChatKeyboardScrollView.tsx`

When the keyboard (or a composer sheet) is open, a **keyboard backdrop layer** fills the region between the composer footer and the bottom of the screen. This prevents the chat background (wallpaper, gradient, etc.) from showing through behind the keyboard.

```
┌──────────────────────────────────────────────┐
│  Chat messages                               │
├──────────────────────────────────────────────┤
│  Typing indicator                            │
│  ChatComposer (toolbar)                      │  ← composerBackground ?? background
│  KeyboardSafeAreaSpacer                      │  ← same color (internal default)
├──────────────────────────────────────────────┤
│  ████ Keyboard Backdrop ████████████████████ │  ← same color (keyboardBackdropColor)
│  ████████████████████████████████████████████ │  z-index: KEYBOARD_BACKDROP_Z_INDEX (10)
├──────────────────────────────────────────────┤
│  [iOS System Keyboard]                       │  ← managed by iOS
└──────────────────────────────────────────────┘
```

**Z-ordering:**

| Layer                | Z-Index | Purpose                          |
| -------------------- | ------- | -------------------------------- |
| Keyboard backdrop    | 10      | Color fill behind keyboard       |
| Chat footer (KSV)    | 20      | Composer + spacer (sits on top)  |
| Scroll return button | 30      | Floating "jump to latest" button |

### 5A.2 Color Resolution — Single Source of Truth

All three regions (composer container, safe area spacer, keyboard backdrop) resolve to the **same token chain**:

```
composerBackground ?? background
```

**Where each component reads it:**

| Component                | Color Source                                                       |
| ------------------------ | ------------------------------------------------------------------ |
| `ChatComposer`           | `colors.composerBackground ?? colors.background`                   |
| `KeyboardSafeAreaSpacer` | Internal default: `colors.composerBackground ?? colors.background` |
| Keyboard backdrop        | `colors.composerBackground ?? colors.background`                   |
| Picker sheet surfaces    | `colors.keyboardSurface ?? colors.surface` (see note)              |

**Semantic token resolution in `constants/theme.ts`:**

```typescript
keyboardSurface: colors.keyboardSurface ?? colors.composerBackground ?? colors.background,
```

The `keyboardSurface` token now resolves through `composerBackground` before falling back to `background`. This ensures picker sheets (GIF, emoji, sticker pickers) that use `keyboardSurface` also align with the composer surface — creating visual continuity during keyboard ↔ sheet transitions.

### 5A.3 Why This Matters

On light themes, `colors.background` and `colors.surface` are often different values (e.g., pure white vs. slightly off-white). Before this alignment:

- Composer used `composerBackground → background` (white)
- Keyboard backdrop used `keyboardSurface → surface` (off-white)
- Result: visible color seam between composer and keyboard backdrop

After alignment, all regions read from the same chain → no seam on any theme.

### 5A.4 Theme Override Mechanism

If a theme needs a distinct keyboard backdrop color, it can explicitly set `keyboardSurface` in its theme definition. No theme currently does this — all 30 themes use the default resolution.

---

## 6. Keyboard Avoidance Engine

### 6.1 KCSV Path (Native Build)

When `isKCSVAvailable === true`:

```
ChatKeyboardContainer → plain View (flex: 1)
  ├─ Keyboard backdrop layer (z-index: 10, composerBackground color)
  ├─ ChatHeader
  ├─ SheetDismissLayer
  │   └─ ChatMessageList
  │       └─ FlatList renderScrollComponent → KeyboardChatScrollView
  │           (native contentInset management, 60fps UI thread)
  ├─ ChatFooterWrapper → KeyboardStickyView (z-index: 20)
  │   ├─ Animated.View (translateY = -composerOffset)
  │   │   ├─ TypingBar or TypingBubble
  │   │   ├─ ChatComposer
  │   │   └─ KeyboardSafeAreaSpacer
  └─ ScrollReturnButton (position: absolute)
```

**How content lifts:**

- `KeyboardChatScrollView` receives keyboard height from RKBC natively
- Sets FlatList `contentInset.bottom` to keyboard height on the UI thread
- No layout reflow needed — pure inset adjustment
- `extraContentPadding` prop receives `sheetExtraPadding` for sheet offset

**How footer positions:**

- `KeyboardStickyView` with `offset={{ closed: 0, opened: 0 }}`
- KSV translates footer by `-keyboardHeight` (from RKBC)
- `composerOffset` adds additional translateY for sheet offset
- Formula: `composerOffset = max(0, clampedSheetVisible - |keyboardHeight|)`

**How safe area collapses:**

- `AnimatedSafeAreaSpacer` interpolates height from `insets.bottom` → 0
- Uses `progress` from RKBC (keyboard) + derived `sheetProgress` (sheet)
- `factor = max(progress, sheetProgress)` → collapse when either is active

### 6.2 Fallback Path (Expo Go)

```
ChatKeyboardContainer → FallbackKeyboardContainer (Animated.View)
  ├─ paddingBottom = useEffectiveBottomInset()
  ├─ Keyboard backdrop layer (composerBackground color)
  ├─ ChatHeader
  ├─ SheetDismissLayer
  │   └─ ChatMessageList
  │       └─ FlatList renderScrollComponent → plain ScrollView
  ├─ ChatFooterWrapper → <>{children}</> (just a fragment)
  │   ├─ TypingBar or TypingBubble
  │   ├─ ChatComposer
  │   └─ KeyboardSafeAreaSpacer
  └─ ScrollReturnButton (position: absolute)
```

**How content lifts:**

- `FallbackKeyboardContainer` animated `paddingBottom` = effective bottom inset
- FlatList has `flex: 1` → shrinks as paddingBottom increases
- Messages scroll up as the available height decreases

**How footer positions:**

- No KSV, no translateY
- Footer sits at the bottom of the flex container
- `paddingBottom` pushes the bottom of the container up by keyboard height
- Footer naturally sits above the keyboard because the container shrinks

---

## 7. Composer Sheet Coordination

### 7.1 What Are Composer Sheets?

Emoji picker, GIF picker, sticker picker, and game picker are "keyboard-replacement" bottom sheets. When opened, they:

1. Dismiss the keyboard
2. Open to the same height the keyboard occupied
3. The composer stays in the same position (no visual jump)

### 7.2 Activation Flow

```
User taps emoji button
  → EmojiButton calls composerSheet.activateSheet(undefined, closeCallback)
    → activateSheet():
        1. If another sheet is open, call its closeCallback (via switchingRef)
        2. Store new closeCallback in activeCloseRef
        3. kbH = currentKeyboardHeight || liveKeyboardHeight.value || lastKeyboardHeight
           (prefers live RKBC SharedValue to eliminate React-state lag)
        4. initialSheetHeight = getKeyboardReplacementSheetHeight(kbH)
        5. Set initialSnapHeight.value = initialSheetHeight
        6. Set isSheetActive.value = 1
        7. Pre-seed sheetTranslateY.value = SCREEN_HEIGHT - initialSheetHeight
        8. Keyboard.dismiss()
  → Bottom sheet opens with snap point at initialSheetHeight
  → Sheet's onFrame/onChange drives sheetTranslateY on every animation frame
  → ChatFooterWrapper reads composerOffset (clamped to initialSnapHeight)
  → KeyboardSafeAreaSpacer collapses (sheetProgress > 0)
```

### 7.3 Deactivation Flow

```
User taps backdrop / swipes sheet down
  → Sheet calls composerSheet.deactivateSheet()
    → deactivateSheet():
        1. If switchingRef.current → skip (switching between sheets)
        2. Clear activeCloseRef
        3. Set isSheetActive.value = 0
        4. Set sheetTranslateY.value = SCREEN_HEIGHT
        5. Set initialSnapHeight.value = 0
        6. Set sheetExtraPadding.value = 0
```

### 7.4 Sheet Switching

When switching from one picker to another (e.g., emoji → GIF):

1. `activateSheet()` detects `activeCloseRef.current` is set
2. Saves reference to old close callback
3. Calls it via `requestAnimationFrame` (1-frame overlap for Portal transition)
4. Sets `switchingRef.current = true` during the old sheet's close
5. When old sheet's `deactivateSheet()` is called, it sees `switchingRef.current === true` and skips resetting shared values → no 1-frame visual gap

### 7.5 Shared Value Summary

| SharedValue             | Idle          | Keyboard Open          | Sheet Open                         |
| ----------------------- | ------------- | ---------------------- | ---------------------------------- |
| `sheetTranslateY`       | SCREEN_HEIGHT | SCREEN_HEIGHT          | SCREEN_HEIGHT - sheetVisibleHeight |
| `initialSnapHeight`     | 0             | 0                      | keyboard-equivalent height         |
| `isSheetActive`         | 0             | 0                      | 1                                  |
| `sheetExtraPadding`     | 0             | 0                      | composerOffset (KCSV path only)    |
| `liveKeyboardHeight`    | 0             | -keyboardPx (negative) | 0 (keyboard dismissed)             |
| `keyboardHeight` (RKBC) | 0             | -keyboardPx (negative) | 0 (keyboard dismissed)             |
| `progress` (RKBC)       | 0             | 1                      | 0                                  |

`liveKeyboardHeight` is piped from RKBC's `keyboardHeight` by `ChatFooterWrapper`'s `useAnimatedReaction`. It is a UI-thread mirror of the same value, stored in `ComposerSheetContext` so that `activateSheet()` can read the real keyboard height synchronously at call-time instead of relying on the `lastKeyboardHeight` React state (which lags 2-3 frames behind the RKBC value).

### 7.6 Sheet Dismissal Policy

Active composer sheets are dismissed in four scenarios:

1. **Main composer gains focus.** When the user taps the main text field (NativeComposerInput or fallback TextInput), `ChatComposer.handleMainInputFocus()` calls `dismissActiveSheet()`. Picker search TextInputs do NOT trigger this because they are separate components inside the picker — only the main composer input fires the callback.

2. **Camera / gallery launch.** `handleCaptureFromCamera()` and `handleAddAttachment()` in ChatScreen and GroupChatScreen call `dismissActiveSheet()` before opening the camera or image gallery.

3. **Tap / scroll to dismiss.** `SheetDismissLayer` handles tap-to-dismiss on the chat content area and scroll-to-dismiss while a sheet is active.

4. **Sheet internal gestures.** Swipe-down, drag-past-threshold, backdrop tap, and Android back button trigger the sheet's own `onClose → deactivateSheet()` flow.

---

## 8. Safe Area Handling

### 8.1 KeyboardSafeAreaSpacer

**Purpose:** Renders a view of height `insets.bottom` (~34px on notched iPhones) that sits below the composer. Collapses to 0 when the keyboard or a composer sheet is open (because the keyboard/sheet itself accounts for safe area).

**Location in tree:** Inside `ChatFooterWrapper`, below `ChatComposer`.

**Animation logic:**

```typescript
const animatedStyle = useAnimatedStyle(() => {
  let sheetProgress = 0;
  if (isSheetActive.value === 1 && initialSnapHeight.value > 0) {
    const sheetVisible = FOOTER_SCREEN_HEIGHT - sheetTranslateY.value;
    sheetProgress = Math.min(
      1,
      Math.max(0, sheetVisible / initialSnapHeight.value),
    );
  }
  const factor = Math.max(progress.value, sheetProgress);
  return {
    height: interpolate(factor, [0, 1], [height, 0]),
    backgroundColor,
  };
});
```

### 8.2 System Keyboard Safe Area

The iOS system keyboard includes its own bottom safe area padding. When the keyboard is open:

- RKBC reports total keyboard height including safe area
- `KeyboardSafeAreaSpacer` collapses to 0 (because `progress = 1`)
- No double-counting of safe area

> **Historical note:** The old custom keyboard (`CustomInputKeyboardView`) had its own `intrinsicContentSize` that included `bottomSafeArea`. This is no longer relevant — the system keyboard handles safe area natively.

### 8.3 No-Notch Devices

When `insets.bottom === 0`, `KeyboardSafeAreaSpacer` returns `null` (no rendering at all).

---

## 9. Chat Screen Layout Hierarchy

### Common Pattern (All 3 Screens)

```jsx
<ChatKeyboardContainer style={{ flex: 1, backgroundColor }}>
  {/* Keyboard backdrop — fills behind keyboard with composerBackground color */}
  {backdrop}

  {/* Fixed header at top */}
  <ChatHeader />

  {/* Optional pinned bar */}
  <PinnedInviteBar />

  {/* Dismiss layer wrapping scrollable content */}
  <SheetDismissLayer>
    <ChatMessageList
      renderScrollComponent={renderScrollComponent}
      {/* ... */}
    />
  </SheetDismissLayer>

  {/* Footer: positioned by KSV (KCSV) or container padding (fallback) */}
  <ChatFooterWrapper>
    <TypingBar /> or <TypingBubble />
    <ChatComposer />
    <KeyboardSafeAreaSpacer />
  </ChatFooterWrapper>

  {/* Floating button */}
  <ScrollReturnButton />
</ChatKeyboardContainer>
```

### Screen-Specific Differences

| Feature                  | ChatScreen (DM)        | GroupChatScreen              | ThreadScreen          |
| ------------------------ | ---------------------- | ---------------------------- | --------------------- |
| Scope                    | `"dm"`                 | `"group"`                    | n/a (plain TextInput) |
| Uses NativeComposerInput | Yes (via ChatComposer) | Yes (via ChatComposer)       | No (plain TextInput)  |
| Keyboard backdrop        | Yes                    | Yes                          | Yes                   |
| Mention autocomplete     | No                     | Yes                          | No                    |
| Background wallpaper     | No                     | Yes (`backgroundLayer` prop) | No                    |
| Voice recording          | Yes                    | Yes                          | No                    |
| Animal picker            | Yes                    | Yes                          | No                    |
| Toolbar customization    | Yes                    | Yes                          | No                    |

### setChatScrollViewConfig Usage

Each screen calls this in a `useEffect` or at mount to configure the KCSV:

```typescript
useEffect(() => {
  setChatScrollViewConfig({
    offset: 0,
    keyboardLiftBehavior: "whenAtEnd",
    extraContentPadding: sheetExtraPadding,
  });
}, [sheetExtraPadding]);
```

- `offset: 0` — KCSV adds full keyboard height as content inset (no reduction)
- `keyboardLiftBehavior: "whenAtEnd"` — only auto-scroll to bottom when user is at the bottom
- `extraContentPadding` — piped from `ComposerSheetContext.sheetExtraPadding` so sheet offset lifts content

---

## 10. Data Flow Diagrams

### Keyboard Open (KCSV Path)

```
iOS keyboard notification (keyboardWillShow)
  ↓
react-native-keyboard-controller (RKBC)
  ↓
useReanimatedKeyboardAnimation()
  ├─ height: SharedValue (negative, e.g. -336)
  └─ progress: SharedValue (0 → 1)
      ↓                         ↓
KeyboardChatScrollView      KeyboardStickyView
  (contentInset.bottom =      (translateY = -height)
   |height| on UI thread)         ↓
  ↓                         ChatFooterWrapper
Messages scroll up            Composer moves up
  ↓                              ↓
                          KeyboardSafeAreaSpacer
                            (height → 0, collapses)
```

### Keyboard Open (Fallback Path)

```
RN Keyboard event (keyboardWillShow / keyboardDidShow)
  ↓
useFallbackKeyboardAnimation()
  ├─ height: SharedValue (positive, e.g. 336)
  └─ progress: SharedValue (0 → 1)
      ↓
useEffectiveBottomInset()
  ↓
FallbackKeyboardContainer
  (paddingBottom = |height|)
  ↓
FlatList (flex: 1) shrinks
  ↓
Messages scroll up, footer pushed up
  ↓
KeyboardSafeAreaSpacer
  (height → 0, collapses)
```

### Sheet Open (Both Paths)

```
activateSheet(keyboardHeight, closeCallback)
  ├─ kbH = liveKeyboardHeight.value (or lastKeyboardHeight fallback)
  ├─ Keyboard.dismiss()              → RKBC height goes to 0
  ├─ isSheetActive.value = 1
  ├─ initialSnapHeight.value = sheetH
  └─ sheetTranslateY.value = SCREEN_HEIGHT - sheetH
      ↓
Sheet opens, drives sheetTranslateY on every frame
      ↓
ChatFooterWrapper reads composerOffset:
  composerOffset = max(0, clamped - |kbH|)

During transition (kbH dropping, sheet rising):
  kbH: 336 → 0
  composerOffset: 0 → 336
  Sum stays at 336 → NO VISUAL JUMP

KCSV Path:
  ├─ KSV translateY = -0 (keyboard gone)
  ├─ + composerOffset translateY = -336 (sheet)
  └─ sheetExtraPadding = 336 → KCSV adds to contentInset

Fallback Path:
  └─ effectiveBottomInset = 0 + 336 = 336 → paddingBottom stays 336
```

### Main Composer Focus → Sheet Dismiss

```
User taps main composer text field while sheet is active
  ↓
NativeComposerInput.handleNativeFocusChange(isFocused: true)
  ↓ calls onFocus()
ChatComposer.handleMainInputFocus()
  ↓ calls dismissActiveSheet()
ComposerSheetContext.dismissActiveSheet()
  ↓ invokes activeCloseRef.current() (picker's handleClose)
Sheet closes → deactivateSheet() → shared values reset
  ↓
iOS system keyboard opens (textView.becomeFirstResponder)
  ↓
RKBC drives keyboardHeight → KSV + KCSV take over from composerOffset
```

---

## 11. Known Issues & Edge Cases

### 11.1 First Sheet Open Before Keyboard

**Symptom:** If a picker sheet is opened before the keyboard has ever been shown, the sheet opens to `DEFAULT_KEYBOARD_HEIGHT = 336` (system keyboard with QuickType bar).

**Why:** No keyboard event has fired yet, so `liveKeyboardHeight.value` is `0` and `lastKeyboardHeight` is the default.

**Impact:** Negligible — auto-corrects after the first keyboard show. `DEFAULT_KEYBOARD_HEIGHT = 336` closely matches the actual system keyboard height on most iPhones.

### 11.2 Android Has No Native Composer

The native keyboard module has only a stub on Android (`NativeKeyboardModule.kt` with just `Name("NativeKeyboard")`). Android always uses the standard `TextInput` with the system keyboard.

### 11.3 Thread Screen Uses Plain TextInput

`ThreadScreen.tsx` does NOT use `NativeComposerInput` or `ChatComposer`. It has a plain `TextInput` with `returnKeyType="default"` (not "send"). This means:

- No native UITextView wrapper in threads
- Return key inserts newlines (not send)
- No toolbar, no voice recording, no mention autocomplete

### 11.4 RKBC Height Sign Convention

`react-native-keyboard-controller`'s `useReanimatedKeyboardAnimation().height` returns **negative** values when keyboard is open. The fallback bridge returns **positive** values. All consuming code uses `Math.abs()` to normalize. If a new consumer forgets `Math.abs()`, the layout will break.

### 11.5 Expo Go Keyboard Animation Is Step-Wise

The fallback path uses `withTiming` to animate keyboard height changes, but the source events are `keyboardWillShow`/`keyboardWillHide` which fire once with total height. This means the animation is a single interpolation from 0 → height, not a frame-by-frame tracking of the actual keyboard position. Interactive keyboard dismiss (drag-to-dismiss) does NOT work in the fallback path.

### 11.6 Keyboard Backdrop Color Alignment

The keyboard backdrop, `KeyboardSafeAreaSpacer`, and `ChatComposer` container all resolve to `composerBackground ?? background`. If a theme defines both `composerBackground` and `background` to different values, the composer will use `composerBackground` while any component that reads `colors.background` directly may show a different color. Always use the semantic token chain rather than `colors.background` directly when adding keyboard-region UI.

### 11.7 Resolved: Send Teleport (April 2026)

**Was:** Sending a message at the bottom of chat in TestFlight caused the chat to teleport downward.

**Root cause:** `handleSend` in ChatComposer used a triple-refocus pattern (`focus()` + `setTimeout(50ms)` + `setTimeout(150ms)`) inherited from before the native path existed. These redundant JS wakeups interleaved with KCSV layout passes and MVCP scroll adjustments, causing a visible content-offset flicker.

**Fix:** Replaced triple refocus with a single conditional refocus that only fires if the composer actually lost focus during the send flow (which never happens on the native path since `nativeInput.clear()` does not resign first responder).

### 11.8 Resolved: KB→Sheet Composer Jump (April 2026)

**Was:** Keyboard open → tap picker button caused the composer to teleport upward before settling.

**Root cause:** `activateSheet` used `lastKeyboardHeight` (React state) which lagged 2-3 frames behind RKBC's actual keyboard height. If the stored height didn't match the live keyboard height, `composerOffset = sheetH - actualKbH ≠ 0` on the first frame, producing an instant upward jump.

**Fix:** Added `liveKeyboardHeight` SharedValue to `ComposerSheetContext`, piped from RKBC by `ChatFooterWrapper.useAnimatedReaction`. `activateSheet` now reads `Math.abs(liveKeyboardHeight.value)` first, falling back to `lastKeyboardHeight` only if the live value is 0.

### 11.9 Resolved: Sheet Stays Behind Keyboard (April 2026)

**Was:** (a) Opening the main typing keyboard while a picker sheet was active caused both to be visible — the sheet stayed behind the keyboard. (b) This also caused a brief composer jump and chat teleport as the keyboard opened on top of the sheet's offset.

**Root cause:** No mechanism existed to dismiss the active sheet when the main composer gained focus. `NativeComposerInput` had no `onFocus` callback, and `ChatComposer` had no wiring to detect main-input focus.

**Fix:** Added `onFocus` prop to `NativeComposerInput`. `ChatComposer` passes `handleMainInputFocus` which calls `dismissActiveSheet()`. The fallback `TextInput` also receives this `onFocus`. Picker search `TextInput`s are unaffected because they are separate components inside the picker, not the main composer.

### 11.10 Resolved: Camera/Gallery Leaves Sheet Open (April 2026)

**Was:** Opening camera or image picker while a sheet was active left the sheet visible behind the camera screen.

**Root cause:** `handleCaptureFromCamera` and `handleAddAttachment` in ChatScreen and GroupChatScreen called `attachmentPicker.captureFromCamera()` / `pickFromGallery()` without first dismissing the active sheet.

**Fix:** Added `dismissActiveSheet()` call before each camera/gallery invocation in both screens.

---

## 12. Debugging Guide

### Symptom: Composer has a gap above the keyboard

**Check:**

1. Is `KeyboardSafeAreaSpacer` collapsing? → Check `progress` shared value (should be 1 when keyboard open)
2. Is KSV offset correct? → Should be `{ closed: 0, opened: 0 }`
3. Is KCSV offset correct? → Should be 0 via `setChatScrollViewConfig({ offset: 0 })`

**Root cause history:** A non-zero KSV offset or KCSV offset causes the safe area spacer (34px) to be visible between composer and keyboard.

### Symptom: Chat jumps down when sheet opens

**Check:**

1. Is `useEffectiveBottomInset` returning a constant during transition?
2. Is `composerOffset` rising at the same rate keyboard height drops?
3. Is `switchingRef` being set correctly during sheet switching?

**Root cause history:** Old KAV only tracked keyboard → when sheet opened and keyboard closed, paddingBottom dropped to 0 → FlatList expanded downward.

### Symptom: Chat bounces when keyboard appears/disappears

**Check:** Is the keyboard backdrop animating in sync with `keyboardHeight`? Is `KeyboardSafeAreaSpacer` collapsing smoothly (progress 0→1)?

**Root cause history:** Without the backdrop layer, the chat background would flash through between composer and keyboard during transitions.

### Symptom: Sheet stays behind keyboard when composer is tapped

**Check:**

1. Does `NativeComposerInput` receive `onFocus` prop? → It should call `handleMainInputFocus` from ChatComposer
2. Is `handleNativeFocusChange` calling `onFocus()` when `isFocused` becomes `true`?
3. Is `dismissActiveSheet()` wired in ChatComposer via `useComposerSheet()`?

**Root cause history:** Before the fix, no mechanism existed to dismiss sheets when the main composer gained focus.

### Symptom: Sheet stays open when camera is launched

**Check:** Do `handleCaptureFromCamera` and `handleAddAttachment` call `dismissActiveSheet()` before the picker/camera call?

### Symptom: Composer teleports upward when opening a picker sheet

**Check:**

1. Is `liveKeyboardHeight` being piped by `ChatFooterWrapper`'s `useAnimatedReaction`?
2. Does `activateSheet` prefer `liveKeyboardHeight.value` over `lastKeyboardHeight`?
3. Log `Math.abs(liveKeyboardHeight.value)` and `lastKeyboardHeight` at the point of `activateSheet` — if they differ, the stale value is the cause.

**Root cause history:** Before the fix, `lastKeyboardHeight` (React state) lagged 2-3 frames behind the actual keyboard height.

### Symptom: Return key inserts newline instead of sending

**Check:** Is `textView(_:shouldChangeTextIn:replacementText:)` intercepting `"\n"`? The guard should be unconditional (no `!isUsingCustomKeyboard` check — the custom keyboard no longer exists).

### Symptom: Keyboard doesn't appear at all

**Check:**

1. Is `isNativeKeyboardModuleAvailable` true? (Run in debug console)
2. Is `isNativeComposerAvailable` true?
3. Is `NativeKeyboardModule.activeComposer` set? (Weak reference — may be nil if view was deallocated)
4. Was `npx expo prebuild --clean` run after adding the module?

### Symptom: Keyboard backdrop color doesn't match composer

**Check:**

1. Does the active theme define an explicit `keyboardSurface`? If so, it overrides the default `composerBackground ?? background` chain.
2. Is `ChatComposer` using `composerBackground ?? background` for its container?
3. Is `KeyboardSafeAreaSpacer` receiving an explicit `backgroundColor` prop? (It shouldn't — the internal default handles it.)
4. Verify in `constants/theme.ts` that `keyboardSurface` resolves through `composerBackground`.

### Symptom: Picker sheet color doesn't match composer

**Check:** Picker sheets use `colors.keyboardSurface ?? colors.surface`. Since `keyboardSurface` now resolves through `composerBackground`, it should match. If a theme defines `keyboardSurface` explicitly, verify it matches `composerBackground`.

### Inspecting Shared Values

Add temporary logging to worklets:

```typescript
useAnimatedReaction(
  () => keyboardHeight.value,
  (current) => {
    console.log("[KB] height:", current);
  },
);
```

Or use Reanimated's `runOnJS` to bridge values to the JS thread for inspection.

---

## 13. Build Requirements

### For Expo Go (Fallback Path)

No special build steps needed. The app boots with all keyboard features degraded:

- System keyboard only (no native UITextView wrapper)
- Step-wise animation (no 60fps tracking)
- No interactive dismiss

### For TestFlight / Dev Build (Full Path)

```bash
# 1. Generate native projects with native module linked
npx expo prebuild --clean

# 2. Build iOS app (or use EAS)
npx expo run:ios
# or
npx eas build --platform ios --profile production

# 3. For development builds
npx eas build --platform ios --profile development
```

**Required dependencies:**

- `react-native-keyboard-controller` (RKBC) — native keyboard avoidance
- `expo-modules-core` — for `requireNativeModule` / `requireNativeViewManager`
- `react-native-reanimated` — for shared values and animated styles
- `@stream-io/react-native-webrtc` — used as proxy check for native build detection

**Expo SDK:** 54  
**React Native:** 0.81.5

---

## Appendix A: ChatComposer TextInput Decision Tree

```
Platform.OS === "ios" && isNativeComposerAvailable
  ├─ YES → <NativeComposerInput>
  │         ├─ Renders NativeComposerView (UITextView, system keyboard)
  │         ├─ keyboardAppearance={isDark ? "dark" : "light"}
  │         ├─ Return key intercepted → handleSendPress()
  │         ├─ onSubmitEditing → onSendPress event
  │         └─ Imperative: nativeFocus() / nativeBlur() / nativeClear()
  │
  └─ NO  → <TextInput>
            ├─ Standard RN TextInput
            ├─ System keyboard
            ├─ returnKeyType="send", submitBehavior="submit"
            └─ Imperative: ref.current.focus() / .blur() / .clear()
```

## Appendix B: Complete Event Flow — User Types "Hi" and Sends

### Native Path:

```
1. User taps composer → NativeComposerView.textViewDidBeginEditing()
   → onFocusChange({ isFocused: true })
   → iOS sends keyboardWillShow notification (system keyboard)
   → RKBC updates shared values (-336pt height, progress 0→1)
   → KeyboardStickyView moves footer up 336px
   → KeyboardChatScrollView adds 336px contentInset
   → KeyboardSafeAreaSpacer collapses 34px → 0px
   → Keyboard backdrop fills with composerBackground color

2. User types "H" on system keyboard
   → iOS inserts text natively into UITextView
   → textViewDidChange → emitTextChange({ text: "H", cursor: 1 })
   → RN receives onTextChange → onChangeText("H")
   → ChatComposer updates value state → Send button appears

3. User types "i" → same flow → onChangeText("Hi")

4. User presses Return key on system keyboard
   → shouldChangeTextIn catches "\n" → handleSendPress()
   → onSendPress({ text: "Hi" }) → RN onSubmitEditing()
   → ChatComposer.handleSend():
     a. nativeComposerRef.clear() → NativeKeyboardModule.clear()
        → NativeComposerView.clearText() → text = "", emit change
     b. await onSend() (message pipeline)
     c. nativeComposerRef.focus() → NativeKeyboardModule.focus()
        → textView.becomeFirstResponder() (keeps keyboard open)
```

### Fallback Path:

```
1. User taps TextInput → RN focus
   → Keyboard.addListener("keyboardWillShow") fires
   → useFallbackKeyboardAnimation: height → 336, progress → 1
   → FallbackKeyboardContainer paddingBottom → 336
   → FlatList shrinks → messages scroll up
   → KeyboardSafeAreaSpacer collapses

2. User types "Hi" → RN TextInput onChangeText("H"), then ("Hi")

3. User presses Send (returnKeyType="send"):
   → onSubmitEditing fires → handleSend()
   → Same clear + refocus logic but via inputRef.current
```
