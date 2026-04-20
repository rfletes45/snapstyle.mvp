# TestFlight Keyboard System Technical Dossier

Status: read-only audit of the live workspace. No product fixes were applied in this pass.

Audit goal: describe the current keyboard system precisely enough that a later agent can fix, refactor, and harden it without having to rediscover ownership, runtime paths, or major risks.

## 1. Executive Summary

The app does not currently have one global keyboard system. It has one coordinated chat keyboard subsystem and a large number of independent non-chat input surfaces.

The coordinated subsystem exists only inside the main chat routes. Its core owners are:

- `App.tsx` for root `KeyboardProvider` registration
- `src/navigation/RootNavigator.tsx` for per-route `ComposerSheetProvider` wrapping and navigation behavior
- `src/components/chat/ChatKeyboardScrollView.tsx` for chat layout, footer lift, keyboard backdrop, and safe-area spacer behavior
- `src/contexts/ComposerSheetContext.tsx` for keyboard-replacement sheet coordination and transient UI lifecycle
- `src/hooks/chat/useChatKeyboard.ts` for keyboard height/progress state
- `src/components/chat/ChatComposer.tsx` and `src/components/chat/NativeComposerInput.tsx` for composer rendering and focus/send behavior
- `modules/native-keyboard/ios/NativeComposerView.swift` and `modules/native-keyboard/ios/NativeKeyboardModule.swift` for the iOS native composer path

Outside chat, the app uses many separate patterns:

- `KeyboardAvoidingView`
- `Modal`
- `Portal` + `Dialog`
- `DraggableBottomSheet`
- ad hoc `Keyboard.dismiss()` calls
- screen-local `Keyboard.addListener()` usage

The most important current conclusion is that the live iOS native path is a `UITextView` using Apple's system keyboard, not the historical custom `inputView` keyboard described in older docs and repo memories. Those historical materials are now secondary evidence only.

The highest-risk areas for TestFlight and production hardening are:

- ownership fragmentation outside chat
- stale documentation and comments around the native keyboard path
- runtime environment gating that can produce different behavior across Expo Go, dev builds, TestFlight, and Android
- `ThreadScreen` diverging from the DM/group chat composer architecture
- many modal and sheet flows with text inputs that do not participate in the chat transient-UI coordinator

## 2. Audit Method And Source Of Truth

Source-of-truth order used for this dossier:

1. Live code in the workspace
2. Current config and native module registration
3. Existing docs in `docs/`
4. Existing repo memory notes in `/memories/repo/`

Confidence labels used throughout this document:

- Proven from code: directly verified in the current workspace
- Inference / risk: plausible production consequence derived from the code structure, but not directly observed in a running build during this pass
- Historical note: older docs or memories that may no longer match the current runtime

## 3. Current System Inventory And Ownership

| Layer                             | Primary owner                                            | Responsibility                                                                                                                        | Scope             | Current status   |
| --------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------- |
| App root keyboard provider        | `App.tsx`                                                | Registers `KeyboardProvider` from the compatibility layer                                                                             | App-wide          | Proven from code |
| Navigation ownership              | `src/navigation/RootNavigator.tsx`                       | Wraps `ChatDetail`, `GroupChat`, and `ThreadView` in `ComposerSheetProvider`; enables `freezeOnBlur`; tabs use `tabBarHideOnKeyboard` | Route-level       | Proven from code |
| Optional RKBC compatibility layer | `src/utils/optionalKeyboardController.tsx`               | Safe import layer for `react-native-keyboard-controller` with fallback animation bridge                                               | App-wide          | Proven from code |
| Chat layout engine                | `src/components/chat/ChatKeyboardScrollView.tsx`         | KCSV adapter, footer lift logic, keyboard backdrop, safe-area spacer, KCSV availability detection                                     | Chat only         | Proven from code |
| Chat transient UI owner           | `src/contexts/ComposerSheetContext.tsx`                  | Coordinates keyboard replacement sheets, handoff floor, last keyboard height, blur cleanup                                            | Chat only         | Proven from code |
| Chat keyboard state bridge        | `src/hooks/chat/useChatKeyboard.ts`                      | Produces keyboard height, progress, open state, final keyboard height                                                                 | Chat only         | Proven from code |
| Main composer UI                  | `src/components/chat/ChatComposer.tsx`                   | Main composer row, picker button composition, reply UI, send/refocus behavior                                                         | Chat only         | Proven from code |
| Native composer bridge            | `src/components/chat/NativeComposerInput.tsx`            | Unified JS interface over native iOS composer and `TextInput` fallback                                                                | Chat only         | Proven from code |
| Native iOS composer view          | `modules/native-keyboard/ios/NativeComposerView.swift`   | `UITextView` responder, events, content sizing, send interception                                                                     | iOS native builds | Proven from code |
| Native iOS module                 | `modules/native-keyboard/ios/NativeKeyboardModule.swift` | Imperative focus/blur/clear/insert/cursor APIs, prop wiring                                                                           | iOS native builds | Proven from code |
| Search-specific modal system      | `src/components/chat/search/SearchSheet.tsx`             | Independent search sheet, search input lifecycle, filter transitions                                                                  | Chat-adjacent     | Proven from code |
| Generic bottom sheet infra        | `src/components/chat/DraggableBottomSheet.tsx`           | Shared bottom sheet for pickers and some modal flows                                                                                  | Broad             | Proven from code |
| Non-chat forms and modals         | Many screen-local files                                  | Each screen owns its own keyboard behavior                                                                                            | Outside chat      | Proven from code |

Important ownership boundary: `ComposerSheetProvider` is not app-global. It is instantiated separately per chat route. That means coordinated keyboard replacement, `lastKeyboardHeight`, sheet dismissal, and handoff logic are route-local, not global.

## 4. Live Runtime Paths

### 4.1 iOS native build / TestFlight path

Proven from code:

- `src/modules/nativeKeyboard/NativeKeyboardModule.ts` only loads the local native module on iOS and only when the app is not running in Expo Go.
- `src/modules/nativeKeyboard/NativeKeyboardView.tsx` only renders the native view when the native module is available.
- `src/components/chat/NativeComposerInput.tsx` switches to the native view on iOS when `isNativeComposerAvailable` is true.
- `modules/native-keyboard/ios/NativeComposerView.swift` explicitly describes itself as a `UITextView` using Apple's system keyboard.
- `NativeComposerView.swift` sets `textView.returnKeyType = .send` and intercepts `"\n"` in `shouldChangeTextIn` to trigger send.
- `NativeComposerView.swift` does not set a custom `inputView`. It explicitly leaves `inputAccessoryView = nil` and uses the default system keyboard.

Practical meaning:

- TestFlight and dev-client iOS builds can run a native chat composer path that Expo Go cannot.
- The live native behavior is closer to a native `UITextView` replacement for the RN composer than to a custom iOS keyboard product.

### 4.2 Chat layout path with RKBC / KCSV available

Proven from code:

- `ChatKeyboardScrollView.tsx` checks for the `ClippingScrollViewDecoratorView` native view, the optional RKBC import, and `OptionalKeyboardChatScrollView`.
- It then attempts `require("@stream-io/react-native-webrtc")` before enabling the KCSV path.
- When that gate passes, `ChatKeyboardScrollViewComponent` renders `KeyboardChatScrollView` instead of a plain `ScrollView`.
- `ChatFooterWrapper` and `KeyboardSafeAreaSpacer` use the shared layout logic in this file to keep the footer and spacer aligned with keyboard and sheet state.

Inference / risk:

- KCSV availability currently depends on indirect heuristics, not on a single explicit app capability flag.
- The `@stream-io/react-native-webrtc` `require()` acts as a native-build proxy, but it is not semantically about keyboards. That increases the chance of future false positives or false negatives when build composition changes.

### 4.3 Fallback path when native keyboard-controller behavior is unavailable

Proven from code:

- `src/utils/optionalKeyboardController.tsx` uses a `require()` guard around `react-native-keyboard-controller`.
- When unavailable, it exports fallback wrappers and `useFallbackKeyboardAnimation()`.
- The fallback path uses RN `Keyboard` events and Reanimated `withTiming` to drive height and progress shared values.
- `ChatKeyboardScrollViewComponent` falls back to a plain `ScrollView` when KCSV is unavailable.

Practical meaning:

- Expo Go and other non-native environments stay bootable.
- The fallback experience remains functional, but it is structurally a second-class path compared to the native chat path.

### 4.4 Thread screen divergence

Proven from code:

- `src/screens/chat/ThreadScreen.tsx` uses the chat keyboard container pieces but not the main native composer path.
- It uses a plain `TextInput` and a simpler screen-local send/scroll flow.
- It does not share the exact same composition model as DM/group chat.

This is the clearest architectural inconsistency inside the main chat domain.

### 4.5 Environment matrix

| Environment    | Native composer module        | RKBC/KCSV path     | Composer implementation  | Notes                                |
| -------------- | ----------------------------- | ------------------ | ------------------------ | ------------------------------------ |
| Expo Go iOS    | No                            | Fallback only      | RN `TextInput`           | Proven from code                     |
| Dev build iOS  | Yes if local module linked    | Potentially yes    | Native `UITextView` path | Proven from code                     |
| TestFlight iOS | Yes if build linked correctly | Potentially yes    | Native `UITextView` path | Inference based on build composition |
| Android        | Local native module is a stub | Fallback chat path | RN `TextInput`           | Proven from code                     |

## 5. Chat Event Flow And Lifecycle

### 5.1 Main composer focus flow

Proven from code:

1. The user focuses the main composer.
2. `ChatComposer.tsx` calls `handleMainInputFocus()`.
3. `handleMainInputFocus()` calls `beginKeyboardHandoff()` and then `dismissActiveSheet()` from `ComposerSheetContext`.
4. The input becomes first responder through either the native path or the fallback RN path.
5. `useChatKeyboard.ts` updates keyboard state.
6. `ChatKeyboardScrollView.tsx` derives the effective bottom inset and backdrop height from keyboard height, sheet state, initial snap height, and handoff floor.

Why this matters:

- The chat stack is explicitly designed to treat picker sheets as keyboard replacements, not as unrelated overlays.
- The handoff floor exists to keep the footer and backdrop visually stable while keyboard state catches up.

### 5.2 Picker button open flow

Proven from code:

- `EmojiButton.tsx`, `GifButton.tsx`, `StickerButton.tsx`, `GameButton.tsx`, and `GifStickerButton.tsx` all use `activateSheet(undefined, handleClose)`.
- They pass `lastKeyboardHeight` and `sheetTranslateY` into their picker sheets.
- They clean up with `deactivateSheet()` if unmounted while their picker is open.

Practical meaning:

- These pickers are part of the chat keyboard system, not random overlays.
- Their initial size and translation depend on remembered keyboard height, which is why `setLastKeyboardHeight()` matters.

### 5.3 Picker search focus flow

Proven from code:

- `FullEmojiPicker.tsx`, `GifPicker.tsx`, `StickerPicker.tsx`, and `GifStickerPicker.tsx` each have search inputs with `onFocus={handleSearchFocus}`.
- These sheets run inside `DraggableBottomSheet` and continue to behave like keyboard replacements even after focus moves from the main composer into a picker search field.

### 5.4 Send flow

Proven from code:

- `useChatComposer.ts` snapshots outgoing text state, clears immediately on send, and restores text on error.
- `ChatComposer.tsx` uses post-send clear/refocus logic to keep the composer active.
- `NativeComposerView.swift` emits `onSendPress` instead of inserting a newline when return is pressed.

Inference / risk:

- Because send, clear, cursor restoration, and refocus span JS state, native imperative APIs, and async send outcomes, this path is resilient but also timing-sensitive.

### 5.5 Mention and cursor sync

Proven from code:

- `useMentionAutocomplete.ts` owns mention trigger detection, query extraction, and suggestion reset behavior.
- `useChatComposer.ts` inserts mentions and calls the native cursor setter after insertion.
- `NativeComposerView.swift` emits selection changes for the native path.

### 5.6 Screen blur and transient cleanup

Proven from code:

- `ChatScreen.tsx` and `GroupChatScreen.tsx` call `useDismissTransientUiOnBlur()`.
- `ComposerSheetContext.tsx` documents that this works with `freezeOnBlur: true` because blur fires before the frozen route is preserved.
- `dismissAllTransientUi()` is the route-level cleanup path.

Inference / risk:

- The blur cleanup is deliberate and well targeted, but it still depends on each relevant route opting into the hook. That is safer than no cleanup, but weaker than a true global transient-UI owner.

## 6. Screen And Surface Inventory

### 6.1 Core chat surfaces

| Surface                                       | Input stack                                                                                                   | Keyboard handling model                                    | Important notes                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/screens/chat/ChatScreen.tsx`             | `ChatKeyboardContainer` + `ChatMessageList` + `ChatFooterWrapper` + `KeyboardSafeAreaSpacer` + `ChatComposer` | Full coordinated chat keyboard system                      | Sets `lastKeyboardHeight`; dismisses active sheet before camera/gallery actions |
| `src/screens/groups/GroupChatScreen.tsx`      | Same overall pattern as DM chat                                                                               | Full coordinated chat keyboard system                      | Same transient-UI cleanup and height propagation pattern                        |
| `src/screens/chat/ThreadScreen.tsx`           | Chat wrappers + plain `FlatList` + plain `TextInput`                                                          | Partial chat integration                                   | Architecturally behind DM/group path                                            |
| `src/components/chat/ChatComposer.tsx`        | Main input row, reply bar, picker toolbar                                                                     | Owns focus and send orchestration, not whole layout engine | Calls `beginKeyboardHandoff()` and `dismissActiveSheet()`                       |
| `src/components/chat/NativeComposerInput.tsx` | Native iOS view or RN fallback                                                                                | Environment-sensitive                                      | Current native path uses system keyboard                                        |

### 6.2 Chat picker and sheet surfaces

| Surface                                       | Input presence                          | Ownership model                | Important notes                                                       |
| --------------------------------------------- | --------------------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| `FullEmojiPicker.tsx`                         | Search `TextInput`                      | Chat sheet system              | Uses `DraggableBottomSheet` and `handleSearchFocus`                   |
| `GifPicker.tsx`                               | Search `TextInput`                      | Chat sheet system              | Uses KLIPY search, debounced query, handled taps                      |
| `StickerPicker.tsx`                           | Search `TextInput`                      | Chat sheet system              | Same keyboard replacement pattern                                     |
| `GifStickerPicker.tsx`                        | Dual search inputs                      | Chat sheet system              | Tabbed combined picker; still driven by remembered keyboard height    |
| `src/components/chat/search/SearchSheet.tsx`  | Searchbar input                         | Separate custom modal system   | Not powered by `ComposerSheetContext`; heavy `Keyboard.dismiss()` use |
| `src/components/chat/MessageActionsSheet.tsx` | Multiline edit `TextInput` in edit mode | Generic `DraggableBottomSheet` | Chat-adjacent input path that bypasses the main composer stack        |

### 6.3 Chat-adjacent moderation and utility sheets

| Surface                                        | Input presence                           | Ownership model        | Important notes                                 |
| ---------------------------------------------- | ---------------------------------------- | ---------------------- | ----------------------------------------------- |
| `src/components/BlockUserModal.tsx`            | Optional multiline reason input          | `DraggableBottomSheet` | Not integrated with `ComposerSheetContext`      |
| `src/components/ReportUserModal.tsx`           | Optional multiline description input     | `DraggableBottomSheet` | Same modal family as block flow                 |
| `src/screens/chat/ScheduledMessagesScreen.tsx` | Auto-focused edit input                  | `Portal` modal         | Separate input lifecycle from chat composer     |
| `src/screens/chat/InboxSettingsScreen.tsx`     | No direct text input in inspected region | `Portal` dialog        | Settings-style modal flow                       |
| `src/screens/chat/ChatSettingsScreen.tsx`      | No direct text input in inspected region | `Portal` modal         | More modal surface diversity inside chat domain |

### 6.4 Friends and discovery surfaces

| Surface                                      | Input stack                                     | Keyboard handling model     | Important notes                                                                                  |
| -------------------------------------------- | ----------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/components/friends/QuickAddSheet.tsx`   | Text input in modal + manual keyboard listeners | Independent keyboard system | Explicitly avoids `phone-pad` because iOS showed an accessory toolbar and removed the return key |
| `src/components/friends/AddFriendsSheet.tsx` | No main text field in inspected body            | `DraggableBottomSheet` host | Launches other flows; not a keyboard owner itself                                                |
| `src/screens/friends/FriendsScreen.tsx`      | Hosts Add Friends / moderation flows            | Mixed                       | Not a unified keyboard owner                                                                     |

### 6.5 Profile, status, and settings surfaces

| Surface                                                  | Input stack                                                          | Keyboard handling model | Important notes                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------- |
| `src/components/profile/ProfileBio/ProfileBioEditor.tsx` | Paper `TextInput` inside page-sheet `Modal` + `KeyboardAvoidingView` | Independent             | Uses slide page sheet and its own save/cancel header        |
| `src/components/profile/Status/StatusPicker.tsx`         | Plain text input flow                                                | Independent             | Does not reuse chat infrastructure                          |
| `src/screens/profile/SetStatusScreen.tsx`                | Multiline `TextInput` + `KeyboardAvoidingView`                       | Independent             | Standard form path                                          |
| `src/screens/settings/SettingsScreen.tsx`                | Multiple `Portal` dialogs with `TextInput` fields                    | Independent             | Includes a `phone-pad` field and password confirmation flow |

### 6.6 Group management surfaces

| Surface                                        | Input stack                                       | Keyboard handling model | Important notes                                      |
| ---------------------------------------------- | ------------------------------------------------- | ----------------------- | ---------------------------------------------------- |
| `src/screens/groups/GroupChatCreateScreen.tsx` | `Searchbar`, `TextInput`, `KeyboardAvoidingView`  | Independent             | Uses handled taps but no shared keyboard coordinator |
| `src/screens/groups/GroupChatInfoScreen.tsx`   | Auto-focused modal `TextInput` for edit-name flow | Independent             | Portal/modal behavior separate from chat stack       |

### 6.7 Camera and media surfaces

| Surface                                 | Input stack                               | Keyboard handling model | Important notes                            |
| --------------------------------------- | ----------------------------------------- | ----------------------- | ------------------------------------------ |
| `src/screens/camera/CameraScreen.tsx`   | Text dialog modal                         | Independent             | Own modal keyboard behavior                |
| `src/components/camera/PollCreator.tsx` | Text inputs inside `KeyboardAvoidingView` | Independent             | Separate from chat system                  |
| `src/screens/camera/ShareScreen.tsx`    | Caption/search style inputs               | Independent             | Not wired into composer sheet coordination |

### 6.8 Auth and onboarding surfaces

| Surface                                               | Input stack                                              | Keyboard handling model        | Important notes                                         |
| ----------------------------------------------------- | -------------------------------------------------------- | ------------------------------ | ------------------------------------------------------- |
| `src/screens/auth/LoginScreen.tsx`                    | Standard form fields                                     | `ScrollView` with handled taps | Conventional form path                                  |
| `src/screens/auth/SignupPasswordScreen.tsx`           | Two Paper inputs inside `KeyboardAvoidingView`           | Independent                    | Uses `keyboardVerticalOffset={-40}` on iOS              |
| `src/screens/onboarding/OnboardingUsernameScreen.tsx` | Username + display name inputs in `KeyboardAvoidingView` | Independent                    | Uses `autoFocus`, `returnKeyType`, and sequential focus |
| Other auth/onboarding screens inspected               | Standard RN/Paper input patterns                         | Independent                    | No shared owner beyond screen-local layout              |

### 6.9 Admin and scheduling surfaces

| Surface                                         | Input stack                                     | Keyboard handling model | Important notes                                           |
| ----------------------------------------------- | ----------------------------------------------- | ----------------------- | --------------------------------------------------------- |
| `src/screens/admin/AdminReportsQueueScreen.tsx` | Multiline resolution-notes input inside a modal | Independent             | Admin-only but still a production input surface           |
| `src/screens/chat/ScheduledMessagesScreen.tsx`  | Auto-focused edit input in portal modal         | Independent             | Another modal text surface outside the main composer path |

### 6.10 Secondary input surfaces still worth QA coverage

These are not central keyboard owners, but they are still user-facing input surfaces:

- `src/screens/shop/CosmeticsShopScreen.tsx` search field with explicit `Keyboard.dismiss()` on blur/clear
- `src/screens/shop/PurchaseHistoryScreen.tsx` search field in a page-sheet context
- `src/gamesV4/screens/AchievementsHubScreen.tsx` search bar intentionally placed outside `FlatList` to reduce dismissal issues
- `src/gamesV4/screens/SketchPartyScreenV4.tsx` keyboard listeners plus dismiss controls
- `src/gamesV4/screens/DeadDropScreenV4.tsx` text inputs using conventional screen-local behavior

## 7. Layout, Safe Area, Insets, And Visual Surface Rules

### 7.1 Chat visual surface contract

Proven from code:

- `constants/theme.ts` defines semantic tokens for `inputBackground`, `inputPlaceholder`, `composerBackground`, `composerBorder`, and `keyboardSurface`.
- `constants/theme.ts` intentionally resolves `keyboardSurface` to the same value as `composerBackground` by default so the keyboard backdrop, composer, and safe-area spacer form one continuous surface.
- `ChatKeyboardScrollView.tsx` uses `composerBackground` as the keyboard backdrop color when no override is provided.
- `KeyboardSafeAreaSpacer` also defaults to `composerBackground`.

Practical meaning:

- The app treats visual seam elimination as part of keyboard architecture, not just styling.
- Theme changes can affect perceived keyboard correctness because the composer surface and keyboard backdrop are visually coupled.

### 7.2 Chat footer and backdrop behavior

Proven from code:

- `KeyboardBackdropLayer` is an absolute animated layer sized by derived keyboard/sheet height.
- `ChatFooterWrapper` is responsible for keeping the footer visually attached to the active keyboard or replacement sheet.
- `KeyboardSafeAreaSpacer` collapses or persists depending on the active path and state.

### 7.3 Generic bottom sheet overlay model

Proven from code:

- `DraggableBottomSheet.tsx` has a special keyboard-replacement overlay mode.
- In keyboard-replacement mode, the dimming overlay only covers the region above the sheet.
- The overlay is visual only; dismissal in chat is handled by `SheetDismissLayer` rather than by the sheet overlay itself.

Why this matters:

- Chat gestures, long presses, and swipe interactions were intentionally considered when designing the overlay.
- This is more advanced than the non-chat modal systems.

### 7.4 Non-chat offsets and inset strategy are not centralized

Proven from code:

- `SignupPasswordScreen.tsx` uses `keyboardVerticalOffset={Platform.OS === "ios" ? -40 : 0}`.
- `SketchPartyScreenV4.tsx` uses `keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}`.
- Many other screens rely on vanilla `KeyboardAvoidingView` behavior or page-sheet defaults.

Inference / risk:

- Non-chat keyboard layout correctness is not governed by a shared contract, so regressions are more likely to be fixed locally and inconsistently.

## 8. State And Data Flow

### 8.1 Chat keyboard state

Proven from code:

- `useChatKeyboard.ts` provides `keyboardHeight`, `keyboardProgress`, `isKeyboardOpen`, `finalKeyboardHeight`, and safe-area data.
- `ChatScreen.tsx` and `GroupChatScreen.tsx` push `screen.keyboard.finalKeyboardHeight` into `ComposerSheetContext` through `setLastKeyboardHeight()`.
- `ComposerSheetContext.tsx` stores both React state and Reanimated shared values including `lastKeyboardHeight`, `liveKeyboardHeight`, `sheetTranslateY`, `initialSnapHeight`, `isSheetActive`, and `handoffFloor`.

### 8.2 Chat composer state

Proven from code:

- `useChatComposer.ts` owns text, cursor position, mention UIDs, sending state, attachment/voice integration, schedule UI visibility, and insertion helpers.
- Mention insertion drives both text state and cursor repositioning.
- Send failures can restore previously cleared text.

### 8.3 Screen composition state

Proven from code:

- `useChat.ts` composes message list state, keyboard state, reply state, selection state, and optimistic send state.
- `ChatMessageList.tsx` is configured with `keyboardDismissMode="interactive"` and `keyboardShouldPersistTaps="handled"`.

### 8.4 Non-chat state pattern

Proven from code:

- Most non-chat surfaces keep keyboard-related state local to the screen or modal.
- There is no shared non-chat equivalent to `ComposerSheetContext`.

## 9. Native And Platform Dependencies

Proven from code and config:

- React Native `0.81.5`
- Expo SDK `54`
- React `19.1.0`
- `react-native-keyboard-controller` `1.21.2`
- `react-native-reanimated` `4.1.1`
- `react-native-gesture-handler` `2.28.0`
- `react-native-safe-area-context` `5.6.0`
- local Expo module in `modules/native-keyboard`
- iOS deployment target `16.0`

Native module facts:

- `modules/native-keyboard/expo-module.config.json` registers the local module for iOS and Android.
- The Android side is a stub, so there is no Android-native composer parity today.
- `app.config.ts` does not currently contain explicit keyboard-specific Info.plist or platform keyboard manager configuration.

Important runtime gatekeepers:

- `src/utils/optionalKeyboardController.tsx`
- `src/modules/nativeKeyboard/NativeKeyboardModule.ts`
- `src/modules/nativeKeyboard/NativeKeyboardView.tsx`
- `src/components/chat/ChatKeyboardScrollView.tsx`

Inference / risk:

- Production behavior depends more on runtime availability and native build composition than on static app config.
- That makes TestFlight parity testing especially important.

## 10. Existing Diagnostics And Debug Surface

Proven from code:

- `ChatKeyboardScrollView.tsx` contains `ENABLE_KEYBOARD_BACKDROP_DEBUG = false` and a detailed keyboard backdrop debug logger.
- `ComposerSheetContext.tsx` logs `[ChatTransientUi]` lifecycle events for activate/deactivate/dismiss/blur behavior.
- `ChatMessageList.tsx` and `SheetDismissLayer.tsx` include transient-UI related logs.

What is missing:

- No unified keyboard telemetry across non-chat surfaces
- No release-mode structured analytics for focus/open/close failures
- No shared instrumentation contract across page sheets, dialogs, and bottom sheets
- No explicit instrumentation around native composer module availability in production sessions

## 11. Historical Mismatches And Code Archaeology

### 11.1 Native keyboard architecture mismatch

Historical note:

- Older repo memories still describe a custom `inputView` keyboard architecture for iOS.
- `native_keyboard_architecture_2026_04_12.md` still claims the native composer uses a custom keyboard view.

Proven from live code:

- `NativeComposerView.swift` now says it uses Apple's system keyboard.
- The live file does not assign a custom `inputView`.
- `NativeKeyboardView.tsx` still contains a stale comment saying the native view is backed by a custom `inputView` keyboard.

Conclusion:

- Future debugging must treat the live Swift implementation as authoritative, not the older memory files.

### 11.2 Legacy custom keyboard artifact still present

Proven from code:

- `modules/native-keyboard/ios/CustomInputKeyboardView.swift` still exists.
- That file still contains substantial custom keyboard logic.

Audit conclusion:

- The file is still present, but the live composer path inspected in this audit does not use it.
- During this audit, no active assignment of `textView.inputView = CustomInputKeyboardView(...)` was found in the inspected live path.

Inference / risk:

- Even if unused at runtime today, this file is a code archaeology hazard because it can mislead future refactors and make release issues harder to reason about.

### 11.3 Older chat keyboard notes are partially obsolete

Historical note:

- Older memory files describe earlier KAV/KSV arrangements and gap fixes.
- The current `ChatKeyboardScrollView.tsx` architecture is more advanced and now owns backdrop height, safe-area continuity, and sheet handoff logic in a different way.

## 12. Primary Fragilities And Root Causes

1. There is no single app-wide keyboard owner. Chat has one. The rest of the app does not.
2. The app mixes multiple modal systems with different focus, dismissal, and layout semantics: `Modal`, page sheet, `Portal` + `Dialog`, `Portal` + `Modal`, `DraggableBottomSheet`, and chat-specific overlays.
3. Environment-dependent gating creates materially different behavior across Expo Go, iOS dev builds, TestFlight, and Android.
4. `ThreadScreen` is not architecturally aligned with DM/group chat.
5. Many input-bearing sheets and moderation/profile flows bypass `ComposerSheetContext` entirely.
6. Manual `Keyboard.dismiss()` is used widely in separate feature areas, which makes lifecycle reasoning more implicit and timing-sensitive.
7. Non-chat safe-area and keyboard offset rules are not centralized.
8. Historical docs and comments are stale enough to misdirect future fixes.
9. iOS has a native composer implementation while Android remains on the fallback path.
10. Observability is strongest in chat and weak elsewhere.

## 13. TestFlight And Release Risk Assessment

### 13.1 Top release-amplified risks

| Severity    | Risk                                              | Why it matters in TestFlight / production                                                                 |
| ----------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| High        | Fragmented ownership outside chat                 | More modal/sheet/form combinations reach real users than are covered by one coherent layout engine        |
| High        | Stale assumptions about native iOS path           | A future fix pass can easily debug the wrong architecture if it assumes the custom keyboard is still live |
| High        | Indirect runtime gating for KCSV/native behavior  | Build composition changes can change behavior without a single explicit feature flag                      |
| High        | `ThreadScreen` divergence                         | Users can hit a chat surface that looks related but behaves differently                                   |
| Medium-High | Chat-adjacent sheets with their own `TextInput`   | Edit/report/block/search flows can violate main-composer assumptions                                      |
| Medium-High | `phone-pad` and accessory quirks on iOS           | Already explicitly worked around in Quick Add; other phone fields still need QA                           |
| Medium      | `freezeOnBlur` plus per-route transient ownership | Cleanup is explicit but route-local; subtle navigation timing bugs remain possible                        |
| Medium      | Extensive manual `Keyboard.dismiss()` use         | Abrupt or conflicting dismiss behavior is more likely under real navigation and modal usage               |
| Medium      | Android parity gap                                | Fixes validated only on TestFlight/iOS may not hold on Android                                            |
| Medium      | Limited release instrumentation                   | Repro details from testers may be weaker than the underlying bug complexity                               |

### 13.2 What is most likely to differ between dev and TestFlight

Inference / risk:

- Native module availability
- KCSV path activation
- animation timing around sheet-to-keyboard handoff
- portal and modal focus timing
- native keyboard appearance and accessory behavior on real devices

## 14. Instrumentation Plan For The Next Pass

If a future agent is allowed to make changes, the first observability pass should add structured diagnostics before large refactors.

Recommended instrumentation targets:

1. Add a single keyboard debug flag that can be enabled in dev and optionally in internal TestFlight builds.
2. Log route name, active input owner, keyboard height, keyboard progress, `isSheetActive`, `sheetTranslateY`, `initialSnapHeight`, and `handoffFloor` whenever chat transient state changes.
3. Log native composer availability and which composer path was selected at screen mount.
4. Log sheet open and close events for all picker buttons plus search/edit/report/block sheets.
5. Add one reusable helper for non-chat screens to log focus, blur, dismiss, and modal visibility transitions.
6. Add a one-shot warning when a screen uses `phone-pad` on iOS so those flows can be tracked explicitly.

## 15. Recommended Future Fix Strategy

The next implementation pass should not start by tweaking random offsets. It should start by locking down ownership and deleting ambiguity.

Recommended sequence:

1. Confirm the intended current native architecture.
   - Decide whether `CustomInputKeyboardView.swift` is dead code, future code, or accidental residue.
   - Update stale comments and docs only after that verdict is certain.
2. Normalize environment detection.
   - Replace indirect runtime heuristics with explicit capability checks where possible.
3. Bring `ThreadScreen` to parity or intentionally mark it as a separate architecture.
4. Define which non-chat modal/input families should join a shared coordinator and which should remain independent.
5. Standardize phone-input behavior on iOS before more phone-based surfaces are added.
6. Only after the ownership map is stable, tune safe-area offsets and animation polish.

## 16. Manual QA Matrix

The next QA pass should cover all of the following on small and large iPhones, at least one modern Android device, dark mode and light mode, and real TestFlight binaries.

### 16.1 Core chat

1. Open DM chat, focus composer, type, send, keep keyboard open, and repeat.
2. Open group chat and repeat the same flow.
3. Open thread view and compare behavior against DM/group chat.
4. Open each picker from the composer, then focus its search field, then close it.
5. Open a picker, navigate away, and confirm transient UI is dismissed on blur.
6. Open a picker, background the app, resume, and confirm state recovery.
7. Trigger mention autocomplete and confirm cursor placement after insertion.
8. Edit a message from `MessageActionsSheet` and observe keyboard/layout behavior.

### 16.2 Chat-adjacent flows

1. Open `SearchSheet`, type, toggle filters, tap a result, and close.
2. Open block and report flows from profile/chat entry points and interact with their multiline fields.
3. Edit a scheduled message via its modal.

### 16.3 Friends, settings, and profile

1. Open Quick Add and test the input and dismiss controls.
2. Test any phone-number entry field on iOS specifically.
3. Edit profile bio.
4. Edit status.
5. Open settings dialogs with text inputs, including the phone number dialog and password confirmation flow.

### 16.4 Group and camera flows

1. Create a group using member search and group naming.
2. Edit group info name.
3. Open camera text dialog, poll creator, and share screen inputs.

### 16.5 Auth, shop, admin, and secondary flows

1. Login, signup password, onboarding username, and other auth forms.
2. Shop search and purchase history search.
3. Admin resolution notes modal.
4. Games with text input such as Sketch Party and Dead Drop.
5. Achievements search field.

### 16.6 Navigation and environment cases

1. Tab switch with keyboard open.
2. Push and pop navigation while keyboard or picker is open.
3. Rotate device where supported.
4. Background and foreground transitions.
5. Light theme and dark theme verification for composer, backdrop, and sheet surface continuity.

## 17. Open Questions

1. Is `CustomInputKeyboardView.swift` intentionally retained for future work, or should it be removed after verification?
2. Should `ThreadScreen` be upgraded to the same composer/input architecture as DM and group chat?
3. Is the `@stream-io/react-native-webrtc` `require()` in KCSV detection intentional long-term architecture, or just a build heuristic that should be replaced?
4. Which non-chat modal/input families are important enough to join a shared keyboard coordinator?
5. Are there already known TestFlight-only keyboard bugs tied to specific devices or iOS versions that were not visible in this static audit?
6. Is Android expected to remain on the fallback path indefinitely, or is native parity planned?

## 18. Top 10 Files For Future Keyboard Work

| Rank | File                                                   | Why it matters                                                                          |
| ---- | ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 1    | `src/components/chat/ChatKeyboardScrollView.tsx`       | Main chat layout engine, KCSV detection, footer lift, backdrop, safe-area spacer        |
| 2    | `src/contexts/ComposerSheetContext.tsx`                | Core owner of sheet handoff, last keyboard height, blur cleanup, transient UI lifecycle |
| 3    | `src/components/chat/ChatComposer.tsx`                 | Main focus/send/orchestration point for the composer                                    |
| 4    | `src/hooks/chat/useChatKeyboard.ts`                    | Keyboard height/progress source for chat state                                          |
| 5    | `src/components/chat/NativeComposerInput.tsx`          | JS bridge between native composer and fallback `TextInput`                              |
| 6    | `modules/native-keyboard/ios/NativeComposerView.swift` | Actual current iOS native keyboard behavior                                             |
| 7    | `src/navigation/RootNavigator.tsx`                     | Route-level provider placement, `freezeOnBlur`, and tab keyboard behavior               |
| 8    | `src/screens/chat/ThreadScreen.tsx`                    | Largest architectural outlier inside the chat domain                                    |
| 9    | `src/components/chat/search/SearchSheet.tsx`           | Separate search-specific input lifecycle inside the chat area                           |
| 10   | `src/components/friends/QuickAddSheet.tsx`             | Independent modal keyboard system with explicit iOS phone-input workaround              |

Files just outside the top 10 but still important:

- `src/screens/chat/ChatScreen.tsx`
- `src/screens/groups/GroupChatScreen.tsx`
- `src/components/chat/DraggableBottomSheet.tsx`
- `src/screens/settings/SettingsScreen.tsx`
- `src/components/profile/ProfileBio/ProfileBioEditor.tsx`

## 19. Top 10 Risks

1. The app has one coherent chat keyboard architecture and many incoherent non-chat ones.
2. The repo still contains stale assumptions that the iOS native path uses a custom keyboard when the live path uses Apple's system keyboard.
3. Runtime gating for KCSV/native behavior is indirect and therefore brittle.
4. `ThreadScreen` is an architectural outlier in the main chat family.
5. Chat-adjacent sheets with text inputs bypass the main transient-UI coordinator.
6. iOS phone-entry behavior is already known to have accessory/return-key quirks.
7. Non-chat offsets and `KeyboardAvoidingView` choices are not standardized.
8. Per-route transient ownership is safer than nothing but weaker than a truly centralized owner.
9. Android parity is limited because the native composer is iOS-only.
10. Diagnostic coverage is not strong enough for fast production forensics across all surfaces.

## 20. Final Actionable Summary

If a future agent starts fixing the keyboard system, it should work from these assumptions:

- The current authoritative iOS composer path is `UITextView` plus Apple's system keyboard.
- The chat keyboard system is real, coordinated, and relatively sophisticated.
- That coordinated system stops at the boundary of the main chat routes.
- Most production risk now comes from the edges: thread view, search/edit/report/block sheets, settings/profile/friends forms, and other modal text surfaces.
- The first implementation step should be architecture clarification and instrumentation, not random offset tuning.

The most productive next move after this dossier is a focused implementation pass in this order:

1. eliminate native-path ambiguity
2. normalize capability detection
3. unify `ThreadScreen` with the main chat architecture or explicitly separate it
4. decide which non-chat surfaces deserve shared keyboard ownership
5. then harden screen-by-screen layout details
